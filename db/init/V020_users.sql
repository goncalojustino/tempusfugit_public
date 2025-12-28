-- Crypto helpers for passcode hashing
create extension if not exists pgcrypto;

-- Ensure lab column exists
alter table api.users add column if not exists lab text;

-- List users
create or replace function api.users_list()
returns table(email citext, role text, lab text)
language sql stable security definer
as $$
  select email, role, lab from api.users order by email;
$$;

-- Add or update user
create or replace function api.users_add(
  p_email citext,
  p_role text,
  p_lab text,
  p_passcode text
) returns void
language plpgsql security definer
as $$
declare
  s text;
begin
  -- generate salt
  s := encode(gen_random_bytes(8),'hex');
  insert into api.users(email,role,lab,salt,passcode_hash)
  values (
    p_email,
    upper(p_role),
    p_lab,
    s,
    encode(digest(s || p_passcode,'sha256'),'hex')
  )
  on conflict (email) do update
    set role=excluded.role,
        lab=excluded.lab,
        salt=excluded.salt,
        passcode_hash=excluded.passcode_hash;
end;
$$;
