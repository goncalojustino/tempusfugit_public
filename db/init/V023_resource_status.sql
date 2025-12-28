alter table api.resources
  add column if not exists status text not null default 'OK',           -- OK | LIMITED | DOWN
  add column if not exists limitation_note text not null default '';

-- keep existing rows as OK with empty note
update api.resources set status=coalesce(status,'OK'), limitation_note=coalesce(limitation_note,'');