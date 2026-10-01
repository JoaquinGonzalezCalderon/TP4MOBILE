insert into public.organizations(id,name,region) values ('10000000-0000-0000-0000-000000000001','Estancia Didáctica Concordia','Concordia, Entre Ríos') on conflict do nothing;
insert into public.plots(id,organization_id,name,crop,polygon,threshold_min,threshold_max) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Costa 1','Citrus','{"type":"Polygon","coordinates":[[[-58.02,-31.38],[-58.01,-31.38],[-58.01,-31.37],[-58.02,-31.37],[-58.02,-31.38]]]}',25,45),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Costa 2','Citrus','{"type":"Polygon","coordinates":[[[-58.01,-31.38],[-58.00,-31.38],[-58.00,-31.37],[-58.01,-31.37],[-58.01,-31.38]]]}',25,45),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Monte A','Soja','{"type":"Polygon","coordinates":[[[-58.02,-31.37],[-58.01,-31.37],[-58.01,-31.36],[-58.02,-31.36],[-58.02,-31.37]]]}',25,45) on conflict do nothing;
insert into public.stations(id,plot_id,name,lat,lng) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Estación Costa 1',-31.375,-58.015),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Estación Costa 2',-31.375,-58.005),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Estación Monte A',-31.365,-58.015) on conflict do nothing;
insert into public.valves(id,plot_id,name,status) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Válvula Costa 1','closed'),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Válvula Costa 2','closed'),
('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Válvula Monte A','closed') on conflict do nothing;

-- Doce puntos por estación para que el gráfico tenga historia desde el primer arranque.
insert into public.readings(station_id,measured_at,moisture_pct,temp_c,rain_mm,source)
select s.id, now() - (case when s.id='30000000-0000-0000-0000-000000000003' then interval '20 minutes' else interval '0 minutes' end) - (interval '30 minutes' * n),
  case when s.id='30000000-0000-0000-0000-000000000002' then 18 + (n % 3) * 0.2 else 35 + (n % 4) * 0.3 end,
  25.5 + (n % 4) * 0.4, 0, 'sensor'
from public.stations s cross join generate_series(0,11) as g(n)
where not exists (select 1 from public.readings r where r.station_id=s.id);
