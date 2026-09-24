/* Legacy monthly agreement setup for old UI regressions. Synthetic local DB only. */
async function monthly(preview,p,pkg,id='a'){
 if(!preview)throw Error('Billing fixture requires the isolated preview database');
 const {db,ids}=preview.database;
 const w=(await db.query('select state from public.coach_workspaces where trainer_id=$1',[ids.trainer])).rows[0].state;
 w.clients.find(c=>c.id===id).profile.package=pkg;
 await db.query('update public.coach_workspaces set state=$1 where trainer_id=$2',[JSON.stringify(w),ids.trainer]);
 const oid=(await db.query('select id from fmz_accounting.organizations where owner_id=$1',[ids.trainer])).rows[0].id;
 await db.query('select fmz_accounting.billing_register_legacy($1,$2,true,$3)',[oid,id,'2026-09-01']);
 await p.evaluate(async id=>{await refreshOnlineWorkspace();state.ui.selectedClientId=id;await FMZAccounting.refresh();},id);
}
async function open(p,id='a',at='2026-09-10'){
 await p.locator('[data-billing-invoice] [name=client_id]').selectOption(id);await p.locator('[data-billing-invoice] [name=at_date]').fill(at);await p.locator('[data-billing-invoice] [type=submit]').click();await p.locator('#invoiceDraftForm').waitFor();
}
module.exports={monthly,open};
