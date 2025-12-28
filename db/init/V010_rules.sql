-- FK, indexes, overlap guard, advance_days, allowed flags, weekend cap helper
create extension if not exists btree_gist;
alter table api.reservations
  add constraint fk_user_email foreign key (user_email) references api.users(email) on update cascade on delete restrict;

create index if not exists idx_res_by_res_start on api.reservations(resource, start_ts);
create index if not exists idx_res_by_user_start on api.reservations(user_email, start_ts);

-- Overlap exclusion per resource
do $$ begin
  execute 'alter table api.reservations add constraint res_overlap_excl
           exclude using gist (resource with =, tstzrange(start_ts,end_ts,''[)'') with &&)';
exception when duplicate_object then null; end $$;

-- Pricing versioning
alter table api.pricing add column if not exists effective_from date not null default '2024-01-01';
create index if not exists idx_price_key on api.pricing(resource,experiment,probe,effective_from);

-- Maintenance windows
create table if not exists api.maintenance_windows (
  id serial primary key,
  resource text not null references api.resources(name) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  reason text not null default ''
);
create index if not exists idx_maint_res on api.maintenance_windows(resource,start_ts);

-- Training windows
create table if not exists api.training_windows (
  id serial primary key,
  resource text not null references api.resources(name) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  reason text not null default ''
);
create index if not exists idx_training_res on api.training_windows(resource,start_ts);

-- Replace helpers
create or replace function api._price_for(p_resource text, p_experiment text, p_probe text, p_at timestamptz)
returns table(rate numeric, code text)
language sql stable as $$
  -- Prefer an exact probe match; otherwise fallback to generic '*' rows
  select rate_per_hour_eur, rate_code
  from api.pricing
  where resource=p_resource and experiment=p_experiment and (probe=p_probe or probe='*')
    and effective_from <= (p_at at time zone 'UTC')::date
  order by (probe=p_probe) desc, effective_from desc
  limit 1;
$$;

create or replace function api._in_maint(p_resource text, p_start timestamptz, p_end timestamptz)
returns boolean language sql stable as $$
  select exists(
    select 1 from api.maintenance_windows m
    where m.resource=p_resource
      and tstzrange(m.start_ts,m.end_ts,'[)') && tstzrange(p_start,p_end,'[)')
  );
$$;

create or replace function api._in_training(p_resource text, p_start timestamptz, p_end timestamptz)
returns boolean language sql stable as $$
  select exists(
    select 1 from api.training_windows t
    where t.resource=p_resource
      and tstzrange(t.start_ts,t.end_ts,'[)') && tstzrange(p_start,p_end,'[)')
  );
$$;

create or replace function api._enforce_allowed(p_email citext, p_resource text)
returns boolean language sql stable as $$
  select case p_resource
    when 'NMR300' then (select allowed_nmr300 from api.users where lower(email)=lower(p_email))
    when 'NMR400' then (select allowed_nmr400 from api.users where lower(email)=lower(p_email))
    when 'NMR500' then (select allowed_nmr500 from api.users where lower(email)=lower(p_email))
    else false end;
$$;

create or replace function api._enforce_advance_days(p_resource text, p_start timestamptz)
returns boolean language sql stable as $$
  select (p_start at time zone 'UTC')::date <= (current_date + (select advance_days from api.resources where name=p_resource));
$$;

create or replace function api._is_weekend_24h(p_start timestamptz, p_end timestamptz)
returns boolean language sql immutable as $$
  select extract(epoch from (p_end-p_start))=86400
     and extract(dow from p_start at time zone 'Europe/Lisbon') in (6,0)
     and extract(dow from p_end   at time zone 'Europe/Lisbon') in (6,1);
$$;

create or replace function api._weekend_24h_cap_ok(p_email citext, p_resource text, p_start timestamptz)
returns boolean language sql stable as $$
  with w as (
    select id,start_ts,end_ts
    from api.reservations
    where user_email=p_email and resource=p_resource and status='APPROVED'
      and api._is_weekend_24h(start_ts,end_ts)
  ),
  target as (
    -- Anchor day as DATE so we can safely do d and d+1 comparisons
    select (date_trunc('day', p_start at time zone 'Europe/Lisbon'))::date as d
  ),
  runs as (
    select count(*) as cnt
    from w, target
    where (start_ts at time zone 'Europe/Lisbon')::date in ( (select d from target)
                                                           ,(select d from target)+1 )
  )
  select coalesce(cnt,0) < 2 from runs;
$$;

-- Create/cancel with all checks
create or replace function api.create_reservation(
  p_email citext,
  p_resource text,
  p_start timestamptz,
  p_end   timestamptz,
  p_experiment text default 'REGULAR',
  p_probe text default 'BBO3',
  p_label text default '30m'
) returns api.reservations
language plpgsql security definer as $$
declare
  v_rate numeric; v_code text;
  v_hours numeric; v_price numeric;
  v_row api.reservations;
begin
  if p_start >= p_end then raise exception 'ERR_BAD_RANGE'; end if;

  if not api._enforce_allowed(p_email, p_resource) then raise exception 'ERR_NOT_ALLOWED'; end if;
  if not api._enforce_advance_days(p_resource, p_start) then raise exception 'ERR_ADVANCE_WINDOW'; end if;
  if api._in_maint(p_resource, p_start, p_end) then raise exception 'ERR_MAINTENANCE'; end if;
  if api._in_training(p_resource, p_start, p_end) then raise exception 'ERR_TRAINING'; end if;

  if api._is_weekend_24h(p_start,p_end) and not api._weekend_24h_cap_ok(p_email,p_resource,p_start) then
    raise exception 'ERR_WEEKEND_CAP';
  end if;

  select rate, code into v_rate, v_code from api._price_for(p_resource, p_experiment, p_probe, p_start);
  v_rate := coalesce(v_rate,0);
  v_hours := extract(epoch from (p_end - p_start))/3600.0;
  v_price := round(v_hours * v_rate::numeric * 100)/100;

  insert into api.reservations(user_email, resource, start_ts, end_ts, experiment, probe, label, status, price_eur, rate_code)
  values (p_email, p_resource, p_start, p_end, p_experiment, p_probe, p_label, 'APPROVED', v_price, coalesce(v_code,''))
  returning * into v_row;

  insert into api.audit(actor, action, reservation_id, payload)
  values (p_email, 'CREATE', v_row.id, jsonb_build_object(
    'email',p_email,'resource',p_resource,'start',p_start,'end',p_end,
    'experiment',p_experiment,'probe',p_probe,'label',p_label,'price_eur',v_price,'rate_code',coalesce(v_code,'')
  ));

  return v_row;
end;
$$;
