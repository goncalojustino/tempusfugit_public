create role web_anon nologin;
create role app_auth noinherit login password 'devpass';

create schema if not exists api;
grant usage on schema api to web_anon;

create table api.labs (
  id serial primary key,
  name text unique not null
);

create extension if not exists citext;

create table api.users (
  id serial primary key,
  email citext unique not null,
  name text not null default '',
  role text not null check (role in ('USER','STAFF','DANTE')),
  lab_id int references api.labs(id) on delete set null,
  allowed_nmr300 boolean not null default false,
  allowed_nmr400 boolean not null default false,
  allowed_nmr500 boolean not null default false,
  salt text default null,
  passcode_hash text default null,
  created_at timestamptz not null default now()
);

create table api.resources (
  id serial primary key,
  name text unique not null,
  visible boolean not null default true,
  advance_days int not null default 0
);

create table api.pricing (
  id serial primary key,
  resource text not null references api.resources(name) on delete cascade,
  experiment text not null,
  probe text not null,
  rate_code text not null,
  rate_per_hour_eur numeric(10,2) not null,
  unique(resource, experiment, probe)
);

create table api.reservations (
  id bigserial primary key,
  user_email citext not null,
  resource text not null references api.resources(name) on delete cascade,
  start_ts timestamptz not null,
  end_ts   timestamptz not null,
  experiment text not null default 'REGULAR',
  probe text not null default 'BBO3',
  label text not null,
  status text not null default 'APPROVED' check (status in ('APPROVED','CANCELED')),
  price_eur numeric(10,2) not null default 0,
  rate_code text default '',
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by citext
);

create table api.audit (
  id bigserial primary key,
  ts timestamptz not null default now(),
  actor citext,
  action text not null,
  ip text,
  reservation_id bigint,
  payload jsonb not null
);

create view api.v_my_upcoming as
  select id, user_email, resource, start_ts, end_ts, experiment, probe, status, price_eur, rate_code
  from api.reservations
  where status='APPROVED' and end_ts >= now();

grant select on all tables in schema api to web_anon;
revoke all on api.audit from web_anon;
revoke insert, update, delete on all tables in schema api from web_anon;
