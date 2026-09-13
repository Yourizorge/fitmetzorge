begin;
-- Cash-system VAT follows the original bank date. A later allocation date must not
-- silently change a closed VAT period. Reopening remains explicit and audited.
create function fmz_accounting.guard_closed_bank_period() returns trigger
language plpgsql set search_path='' as $$
declare source_date date;
begin
 if new.kind='allocation' then
  select date into source_date from fmz_accounting.records where org_id=new.org_id and id=(new.data->>'bank_id')::uuid and kind='bank';
  if source_date is not null then perform fmz_accounting.open_date(new.org_id,source_date);end if;
 elsif new.kind='transfer' then
  for source_date in select date from fmz_accounting.records where org_id=new.org_id and kind='bank' and id in ((new.data->>'from_id')::uuid,(new.data->>'to_id')::uuid) loop
   perform fmz_accounting.open_date(new.org_id,source_date);
  end loop;
 end if;
 return new;
end $$;
revoke all on function fmz_accounting.guard_closed_bank_period() from public,anon,authenticated;
create trigger fmz_accounting_closed_bank_period before insert on fmz_accounting.records for each row execute function fmz_accounting.guard_closed_bank_period();
commit;
