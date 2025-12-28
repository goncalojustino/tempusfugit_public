-- UTC enforcement view helper (optional)
create or replace view api.v_reservations_utc as
  select *, (start_ts at time zone 'UTC') as start_utc, (end_ts at time zone 'UTC') as end_utc
  from api.reservations;

-- Round money on update too
create or replace function api._reprice_all()
returns void language plpgsql as $$
declare r record; v_rate numeric; v_code text; v_hours numeric;
begin
  for r in select * from api.reservations loop
    select rate,code into v_rate,v_code from api._price_for(r.resource,r.experiment,r.probe,r.start_ts);
    v_hours := extract(epoch from (r.end_ts-r.start_ts))/3600.0;
    update api.reservations set price_eur=round(v_hours*coalesce(v_rate,0)*100)/100, rate_code=coalesce(v_code,'') where id=r.id;
  end loop;
end;
$$;