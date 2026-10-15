const {randomUUID}=require('node:crypto');
async function setup(method='invoice'){
 const d=await require('./database.cjs').setup();await require('./accounting-database.cjs').extend(d);
 return provision(d,method);
}
async function provision(d,method='invoice'){
 const cmd=async(action,payload={},request=randomUUID())=>(await d.as('trainer','select public.fmz_accounting_command($1,$2,$3) result',[action,JSON.stringify(payload),request])).rows[0].result;
 const pay=async(action,payload,request=randomUUID(),role='trainer')=>(await d.as(role,'select public.fmz_payment_command($1,$2,$3) result',[action,JSON.stringify(payload),request])).rows[0].result;
 const snapshot=async()=>(await d.as('trainer','select public.fmz_accounting_read() result')).rows[0].result;
 await cmd('settings',{data:{date:'2026-01-01',confirmed:true,businessName:'FitMetZorge Oefenbedrijf',address:'Voorbeeldstraat 10',postalCity:'1000 AA Voorbeeldstad',country:'Nederland',kvk_registered:true,chamberNumber:'00000000',vatNumber:'NL000000000B00',vat_status:'standard',vat_method:method,vat_period:'quarter',vat_basis_points:2100}});
 const bank=await cmd('account',{data:{name:'Zakelijke oefenbank',type:'bank',iban:'OEFENREKENING'}}),cash=await cmd('account',{data:{name:'Oefenkas',type:'cash'}});for(const a of [bank,cash])await cmd('opening',{data:{account_id:a.id,date:'2026-01-01',cents:0}});
 async function invoice(amount=38000,discount=3000){const id=randomUUID(),r=await cmd('draft',{id,version:0,data:{date:'2026-09-01',description:'Progressie — 8 trainingen',gross_cents:amount,discount_cents:discount,discountNote:'Synthetische korting',customer:{name:'Noor Voorbeeld',address:'Oefenlaan 2',postalCity:'1000 BB Voorbeeldstad',country:'Nederland'},service_date:'2026-09-01',service_extent:'8 trainingen in september',quantity:1,term_days:14}});return cmd('final_invoice',{id,version:r.version});}
 return {...d,cmd,pay,snapshot,invoice,bank,cash};
}
module.exports={setup,provision};
