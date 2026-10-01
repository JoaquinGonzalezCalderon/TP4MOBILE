-- Permisos base para que el rol autenticado pueda llegar a las policies RLS.
-- La pertenencia a una organizacion sigue siendo validada por las policies.
grant usage on schema public to authenticated;
grant select on public.organizations,
  public.memberships,
  public.plots,
  public.stations,
  public.readings,
  public.valves,
  public.irrigation_commands
  to authenticated;
grant execute on function public.request_irrigation(uuid, public.command_action, integer, uuid) to authenticated;
grant execute on function public.update_plot_threshold(uuid, numeric) to authenticated;
