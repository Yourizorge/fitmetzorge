-- Read-only release status. No customer identifiers, secrets, or message contents.
begin read only;
select jsonb_build_object(
 'at',clock_timestamp(),
 'enabled',(select enabled from fmz_agenda.config where id),
 'subscriptions',(select count(*) from fmz_agenda.subscriptions),
 'deliveries',(select count(*) from fmz_agenda.deliveries),
 'syntheticAccountsRemaining',(select count(*) from auth.users where raw_user_meta_data->>'fmz_release' like 'fmz-agenda-%'),
 'cron',(select jsonb_build_object('active',active,'schedule',schedule) from cron.job where jobname='appfmz-agenda-reminders'),
 'cronSuccesses',(select count(*) from cron.job_run_details where jobid=(select jobid from cron.job where jobname='appfmz-agenda-reminders') and status='succeeded'),
 'cronFailures',(select count(*) from cron.job_run_details where jobid=(select jobid from cron.job where jobname='appfmz-agenda-reminders') and status='failed'),
 'rls',(select jsonb_object_agg(c.relname,c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fmz_agenda' and c.relkind='r'),
 'anonReadAllowed',has_function_privilege('anon','public.fmz_agenda_read()','EXECUTE'),
 'userWorkerAllowed',has_function_privilege('authenticated','public.fmz_agenda_worker(text,jsonb)','EXECUTE'),
 'directEventsReadAllowed',has_table_privilege('authenticated','fmz_agenda.events','SELECT')
) as proof;
commit;
