-- GoTrue invite verification generates a temporary random password internally.
-- Presence alone does not prove an invited member chose/knows a password.
-- Signed AMR password proof survives refresh; user_metadata is never trusted.
begin;
create or replace function public.fmz_password_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); ready boolean;
begin
 if uid is null or not exists (
  select 1 from auth.sessions s
  where s.user_id=uid and s.id::text=auth.jwt()->>'session_id'
 ) then raise exception 'Active session required' using errcode='28000'; end if;
 select coalesce(u.encrypted_password,'')<>'' and (
  u.invited_at is null or coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"password"}]'::jsonb
 ) into ready from auth.users u where u.id=uid;
 if not found then raise exception 'Active account required' using errcode='28000'; end if;
 return jsonb_build_object('user_id',uid,'password_set',ready);
end $$;
revoke all on function public.fmz_password_status() from public,anon;
grant execute on function public.fmz_password_status() to authenticated;
comment on function public.fmz_password_status() is 'Own live session only; invited accounts require signed password AMR proof, not a GoTrue temporary password. No hashes or customer rows returned or written.';
commit;
