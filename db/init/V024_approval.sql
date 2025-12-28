-- Add PENDING status and approval-aware booking
alter table api.reservations
  drop constraint if exists reservations_status_check,
  add constraint reservations_status_check check (status in ('APPROVED','CANCELED','PENDING'));

-- Helper: does this reservation require approval?
create or replace function api._requires_approval(p_resource text, p_experiment text)
returns boolean language sql stable as $$
  select coalesce(
    (select re.requires_approval from api.resource_experiments re where re.resource=p_resource and re.experiment_code=p_experiment),
    (select e.requires_approval from api.experiments e where e.code=p_experiment),
    false
  );
$$;

-- Update create_reservation to set status based on approval rules
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
  v_status text;
begin
  if p_start >= p_end then raise exception 'ERR_BAD_RANGE'; end if;

  if not api._enforce_allowed(p_email, p_resource) then raise exception 'ERR_NOT_ALLOWED'; end if;
  if not api._enforce_advance_days(p_resource, p_start) then raise exception 'ERR_ADVANCE_WINDOW'; end if;
  if api._in_maint(p_resource, p_start, p_end) then raise exception 'ERR_MAINTENANCE'; end if;

  if api._is_weekend_24h(p_start,p_end) and not api._weekend_24h_cap_ok(p_email,p_resource,p_start) then
    raise exception 'ERR_WEEKEND_CAP';
  end if;

  select rate, code into v_rate, v_code from api._price_for(p_resource, p_experiment, p_probe, p_start);
  v_rate := coalesce(v_rate,0);
  v_hours := extract(epoch from (p_end - p_start))/3600.0;
  v_price := round(v_hours * v_rate::numeric * 100)/100;

  v_status := case when api._requires_approval(p_resource, p_experiment) then 'PENDING' else 'APPROVED' end;

  insert into api.reservations(user_email, resource, start_ts, end_ts, experiment, probe, label, status, price_eur, rate_code)
  values (p_email, p_resource, p_start, p_end, p_experiment, p_probe, p_label, v_status, v_price, coalesce(v_code,''))
  returning * into v_row;

  insert into api.audit(actor, action, reservation_id, payload)
  values (p_email, 'CREATE', v_row.id, jsonb_build_object(
    'email',p_email,'resource',p_resource,'start',p_start,'end',p_end,
    'experiment',p_experiment,'probe',p_probe,'label',p_label,'price_eur',v_price,
    'rate_code',coalesce(v_code,''),'status',v_status
  ));

  return v_row;
end;
$$;
