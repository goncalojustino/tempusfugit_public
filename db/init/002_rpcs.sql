create or replace function api._price_for(p_resource text, p_experiment text, p_probe text)
returns table(rate numeric, code text)
language sql stable as $$
  select rate_per_hour_eur, rate_code
  from api.pricing
  where resource=p_resource and experiment=p_experiment and probe=p_probe
  limit 1;
$$;

create or replace function api._has_overlap(p_resource text, p_start timestamptz, p_end timestamptz)
returns boolean language sql stable as $$
  select exists(
    select 1 from api.reservations r
    where r.resource=p_resource
      and r.status='APPROVED'
      and tstzrange(r.start_ts, r.end_ts, '[)') && tstzrange(p_start, p_end, '[)')
  );
$$;

create or replace function api._future_cap_ok(p_email citext, p_resource text, p_label text)
returns boolean language sql stable as $$
  with fut as (
    select sum(extract(epoch from (end_ts-start_ts))/3600.0) as hrs
    from api.reservations
    where user_email=p_email and resource=p_resource and status='APPROVED' and end_ts>=now()
  )
  select coalesce(hrs,0) <=
    case p_label
      when '3h'  then 6
      when '24h' then 48
      else 6
    end
  from fut;
$$;

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
  if p_start >= p_end then
    raise exception 'BAD TIME RANGE';
  end if;

  if api._has_overlap(p_resource, p_start, p_end) then
    raise exception 'TIME ALREADY BOOKED';
  end if;

  if not api._future_cap_ok(p_email, p_resource, p_label) then
    raise exception 'FUTURE HOURS CAP EXCEEDED';
  end if;

  select rate, code into v_rate, v_code from api._price_for(p_resource, p_experiment, p_probe);
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

create or replace function api.cancel_reservation(
  p_email citext,
  p_id bigint
) returns api.reservations
language plpgsql security definer as $$
declare v api.reservations;
begin
  select * into v from api.reservations where id=p_id;
  if not found then raise exception 'RESERVATION NOT FOUND'; end if;
  if v.status='CANCELED' then return v; end if;
  if lower(v.user_email) <> lower(p_email) then
    raise exception 'FORBIDDEN';
  end if;

  update api.reservations
    set status='CANCELED', canceled_at=now(), canceled_by=p_email
    where id=p_id
  returning * into v;

  insert into api.audit(actor, action, reservation_id, payload)
  values (p_email, 'CANCEL', v.id, jsonb_build_object('email',p_email,'id',p_id));

  return v;
end;
$$;
