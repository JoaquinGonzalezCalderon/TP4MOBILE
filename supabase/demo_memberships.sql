-- Reemplazar los UUID por los IDs de Auth de cada usuario creado manualmente.
insert into public.memberships(user_id,organization_id,role) values
('USER_UUID_PRODUCTOR','10000000-0000-0000-0000-000000000001','producer'),
('USER_UUID_OPERADOR','10000000-0000-0000-0000-000000000001','operator'),
('USER_UUID_ASESOR','10000000-0000-0000-0000-000000000001','advisor');

