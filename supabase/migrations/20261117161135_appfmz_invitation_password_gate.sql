-- Read-only self check; no customer rows, credentials or existing permissions changed.
begin;
create function public.fmz_password_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); ready boolean;
begin
 if uid is null or not exists (
  select 1 from auth.sessions s
  where s.user_id=uid and s.id::text=auth.jwt()->>'session_id'
 ) then raise exception 'Active session required' using errcode='28000'; end if;
 select coalesce(u.encrypted_password,'')<>'' into ready from auth.users u where u.id=uid;
 if not found then raise exception 'Active account required' using errcode='28000'; end if;
 return jsonb_build_object('user_id',uid,'password_set',ready);
end $$;
revoke all on function public.fmz_password_status() from public,anon;
grant execute on function public.fmz_password_status() to authenticated;
comment on function public.fmz_password_status() is 'Own live session only. Returns password presence, never a password/hash. Does not grant app roles or create profiles.';
commit;
