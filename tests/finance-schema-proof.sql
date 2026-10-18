select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fmz_accounting' and p.proname in('vat_basis','vat_plan','vat_preview','vat_command','guard_vat_bank') or n.nspname='public' and p.proname in('fmz_vat_preview','fmz_vat_command')),
 'constraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='fmz_accounting.records'::regclass and conname='records_kind_check'),
 'trigger',(select pg_get_triggerdef(oid) from pg_trigger where tgrelid='fmz_accounting.records'::regclass and tgname='fmz_accounting_vat_bank'),
 'history',(select jsonb_build_object('version',version,'name',name,'statements',statements) from supabase_migrations.schema_migrations where version='20261018073658')
) proof;
