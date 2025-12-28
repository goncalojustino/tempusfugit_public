-- Experiments master
create table if not exists api.experiments(
  code text primary key,
  name text not null,
  requires_approval boolean not null default false
);

insert into api.experiments(code,name,requires_approval) values
  ('REGULAR','Standard experiments',false),
  ('VT','Variable Temperature',true)
on conflict (code) do update set name=excluded.name, requires_approval=excluded.requires_approval;

-- Resource ↔ experiment mapping (override requires_approval per resource)
create table if not exists api.resource_experiments(
  resource text not null,
  experiment_code text not null references api.experiments(code),
  requires_approval boolean not null default false,
  primary key(resource,experiment_code)
);

insert into api.resource_experiments(resource,experiment_code,requires_approval) values
  ('NMR300','REGULAR',false),('NMR400','REGULAR',false),('NMR500','REGULAR',false),
  ('NMR300','VT',true),('NMR400','VT',true),('NMR500','VT',true)
on conflict do nothing;

-- Anti-stockpiling caps per resource+block label
-- per_day_hours / per_week_hours in hours (0 = unlimited)
create table if not exists api.caps(
  resource text not null,
  block_label text not null,   -- '30m' | '3h' | '12h' | '24h'
  per_day_hours int,
  per_week_hours int,
  primary key(resource, block_label)
);

-- Defaults exactly as specified
insert into api.caps(resource,block_label,per_day_hours,per_week_hours) values
  ('NMR300','30m',2,4),
  ('NMR300','3h',6,12),
  ('NMR300','12h',0,0),
  ('NMR300','24h',0,0),
  ('NMR400','30m',1,2),
  ('NMR400','3h',6,12),
  ('NMR400','12h',0,0),
  ('NMR400','24h',0,0),
  ('NMR500','12h',0,0)
on conflict (resource,block_label) do update set per_day_hours=excluded.per_day_hours, per_week_hours=excluded.per_week_hours;

-- Cancellation cutoffs (minutes before start)
create table if not exists api.cancel_rules(
  resource text not null,
  block_label text not null,     -- '30m' | '3h' | '24h'
  cutoff_minutes int not null,   -- e.g., 60, 60, 720; NMR500 uses 0
  primary key(resource, block_label)
);

insert into api.cancel_rules(resource,block_label,cutoff_minutes) values
  ('NMR300','30m',60),('NMR300','3h',60),('NMR300','24h',720),
  ('NMR400','30m',60),('NMR400','3h',60),('NMR400','24h',720),
  ('NMR500','30m',0), ('NMR500','3h',0), ('NMR500','12h',0), ('NMR500','24h',0)
on conflict (resource,block_label) do update set cutoff_minutes=excluded.cutoff_minutes;
