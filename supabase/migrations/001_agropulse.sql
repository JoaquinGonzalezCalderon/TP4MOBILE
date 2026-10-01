create extension if not exists pgcrypto;

create type public.membership_role as enum ('producer','operator','advisor');
create type public.plot_status as enum ('stale','dry','optimal','wet');
create type public.valve_status as enum ('open','closed');
create type public.command_action as enum ('open','close');
create type public.command_status as enum ('pending','applied','failed','cancelled');

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, region text not null);
create table public.memberships (
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role public.membership_role not null,
  primary key (user_id, organization_id)
);
create table public.plots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, crop text, polygon jsonb not null, threshold_min numeric not null default 25 check (threshold_min between 0 and 100),
  threshold_max numeric not null default 45 check (threshold_max between 0 and 100), created_at timestamptz not null default now(), check (threshold_min <= threshold_max)
);
create table public.stations (
  id uuid primary key default gen_random_uuid(), plot_id uuid not null references public.plots(id) on delete cascade,
  name text not null, lat double precision not null, lng double precision not null
);
create table public.readings (
  id uuid primary key default gen_random_uuid(), station_id uuid not null references public.stations(id) on delete cascade,
  measured_at timestamptz not null default now(), moisture_pct numeric not null check (moisture_pct between 0 and 100),
  temp_c numeric not null, rain_mm numeric check (rain_mm is null or rain_mm >= 0), source text not null default 'sensor' check (source in ('sensor','manual'))
);
create index readings_station_measured_idx on public.readings(station_id, measured_at desc);
create table public.valves (
  id uuid primary key default gen_random_uuid(), plot_id uuid not null references public.plots(id) on delete cascade,
  name text not null, status public.valve_status not null default 'closed'
);
create table public.irrigation_commands (
  id uuid primary key default gen_random_uuid(), valve_id uuid not null references public.valves(id) on delete cascade,
  requested_by uuid not null references auth.users(id), action public.command_action not null, duration_min integer check (duration_min is null or duration_min between 1 and 120),
  status public.command_status not null default 'pending', client_request_id uuid not null unique, created_at timestamptz not null default now(), applied_at timestamptz, error_reason text
);
create unique index one_pending_command_per_valve on public.irrigation_commands(valve_id) where status = 'pending';

create or replace function public.user_has_org(org_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships m where m.organization_id = org_id and m.user_id = auth.uid());
$$;
create or replace function public.user_role_for_plot(plot_id uuid) returns public.membership_role language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m join public.plots p on p.organization_id = m.organization_id where p.id = plot_id and m.user_id = auth.uid() limit 1;
$$;
create or replace function public.user_can_valve(valve_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.valves v join public.plots p on p.id=v.plot_id where v.id=valve_id and public.user_has_org(p.organization_id));
$$;
create or replace function public.request_irrigation(p_valve_id uuid, p_action public.command_action, p_duration_min integer, p_client_request_id uuid)
returns public.irrigation_commands language plpgsql security invoker set search_path = public as $$
declare result public.irrigation_commands;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_client_request_id is null then raise exception 'client_request_id is required'; end if;
  if not public.user_can_valve(p_valve_id) then raise exception 'not authorized'; end if;
  if public.user_role_for_plot((select plot_id from public.valves where id=p_valve_id)) = 'advisor' then raise exception 'advisor is read-only'; end if;
  if p_duration_min is not null and (p_duration_min < 1 or p_duration_min > 120) then raise exception 'duration must be between 1 and 120'; end if;
  select * into result from public.irrigation_commands where client_request_id=p_client_request_id;
  if result.id is not null then return result; end if;
  insert into public.irrigation_commands(valve_id, requested_by, action, duration_min, client_request_id) values (p_valve_id, auth.uid(), p_action, p_duration_min, p_client_request_id) returning * into result;
  return result;
exception when unique_violation then
  select * into result from public.irrigation_commands where client_request_id=p_client_request_id;
  if result.id is not null then return result; end if;
  raise;
end; $$;

create or replace function public.update_plot_threshold(p_plot_id uuid, p_threshold_min numeric)
returns public.plots language plpgsql security definer set search_path = public as $$
declare result public.plots;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_threshold_min is null or p_threshold_min < 0 or p_threshold_min > 100 then raise exception 'threshold_min must be between 0 and 100'; end if;
  if public.user_role_for_plot(p_plot_id) <> 'producer' then raise exception 'only producer can edit thresholds'; end if;
  if p_threshold_min > (select threshold_max from public.plots where id = p_plot_id) then raise exception 'threshold_min cannot exceed threshold_max'; end if;
  update public.plots set threshold_min = p_threshold_min where id = p_plot_id returning * into result;
  return result;
end; $$;

alter table public.organizations enable row level security; alter table public.memberships enable row level security; alter table public.plots enable row level security; alter table public.stations enable row level security; alter table public.readings enable row level security; alter table public.valves enable row level security; alter table public.irrigation_commands enable row level security;
create policy memberships_self on public.memberships for select using (user_id = auth.uid());
create policy organizations_member on public.organizations for select using (public.user_has_org(id));
create policy plots_member on public.plots for select using (public.user_has_org(organization_id));
create policy plots_producer_update on public.plots for update using (public.user_role_for_plot(id)='producer') with check (public.user_role_for_plot(id)='producer');
create policy stations_member on public.stations for select using (exists(select 1 from public.plots p where p.id=plot_id and public.user_has_org(p.organization_id)));
create policy readings_member on public.readings for select using (exists(select 1 from public.stations s join public.plots p on p.id=s.plot_id where s.id=station_id and public.user_has_org(p.organization_id)));
create policy valves_member on public.valves for select using (exists(select 1 from public.plots p where p.id=plot_id and public.user_has_org(p.organization_id)));
create policy commands_member on public.irrigation_commands for select using (public.user_can_valve(valve_id));
create policy commands_insert on public.irrigation_commands for insert with check (requested_by=auth.uid() and public.user_can_valve(valve_id) and public.user_role_for_plot((select plot_id from public.valves where id=valve_id)) in ('producer','operator'));
revoke update on public.plots from authenticated;
grant execute on function public.update_plot_threshold(uuid,numeric) to authenticated;

alter table public.readings replica identity full; alter table public.valves replica identity full; alter table public.irrigation_commands replica identity full;
do $$ begin alter publication supabase_realtime add table public.readings, public.valves, public.irrigation_commands; exception when duplicate_object then null; end $$;
