-- Resource-probe availability matrix
create table if not exists api.resource_probes (
  resource text not null,
  probe    text not null,
  active   boolean not null default true,
  primary key(resource, probe)
);

-- Full probe catalog we care about
-- BBO3, BBO5, BBO10, TXI, HR-MAS, LOW BAND, DIFF, SS-NMR

-- Seed: NMR300 → only BBO5
insert into api.resource_probes(resource, probe, active) values
  ('NMR300','BBO3',false),
  ('NMR300','BBO5',true),
  ('NMR300','BBO10',false),
  ('NMR300','TXI',false),
  ('NMR300','HR-MAS',false),
  ('NMR300','LOW BAND',false),
  ('NMR300','DIFF',false),
  ('NMR300','SS-NMR',false)
on conflict do nothing;

-- Seed: NMR400 → BBO5 and BBO10
insert into api.resource_probes(resource, probe, active) values
  ('NMR400','BBO3',false),
  ('NMR400','BBO5',true),
  ('NMR400','BBO10',true),
  ('NMR400','TXI',false),
  ('NMR400','HR-MAS',false),
  ('NMR400','LOW BAND',false),
  ('NMR400','DIFF',false),
  ('NMR400','SS-NMR',false)
on conflict do nothing;

-- Seed: NMR500 → all
insert into api.resource_probes(resource, probe, active) values
  ('NMR500','BBO3',true),
  ('NMR500','BBO5',true),
  ('NMR500','BBO10',true),
  ('NMR500','TXI',true),
  ('NMR500','HR-MAS',true),
  ('NMR500','LOW BAND',true),
  ('NMR500','DIFF',true),
  ('NMR500','SS-NMR',true)
on conflict do nothing;

-- Helper view/function (optional)
create or replace view api.v_active_probes as
  select resource, probe from api.resource_probes where active = true;

create or replace function api.probes_for_resource(p_resource text)
returns table(probe text)
language sql stable as $$
  select probe from api.resource_probes
  where resource = p_resource and active = true
  order by probe;
$$;