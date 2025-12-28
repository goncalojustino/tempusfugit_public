insert into api.labs(name) values
  ('CoreLab'),
  ('CHANGE:Your_Lab_Name_Here'),
  ('CHANGE:Another_Lab_Name_Here'),
  ('CHANGE:And_Another_Lab_Name_Here')
on conflict do nothing;

insert into api.resources(name,visible,advance_days)
values ('NMR300',true,7),('NMR400',true,7),('NMR500',true,14)
on conflict do nothing;

insert into api.pricing(resource,experiment,probe,rate_code,rate_per_hour_eur) values
('NMR300','REGULAR','*','STD300',15),
('NMR400','REGULAR','*','STD400',18),
('NMR500','REGULAR','*','STD500',25)
on conflict do nothing;

insert into api.users(email,name,role,lab_id,allowed_nmr300,allowed_nmr400,allowed_nmr500)
select 'CHANGE:admin_mail_here','Admin','DANTE',l.id,true,true,true from api.labs l where l.name='CoreLab'
on conflict do nothing;
