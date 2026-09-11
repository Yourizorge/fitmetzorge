/* Pure accounting projections. Signed ledger cents: debit positive, credit negative. */
(function(root){
 const money=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format((n||0)/100);
 function cents(raw,signed=false){
  let s=String(raw??'').trim().replace(/\s|€/g,'');
  if(s.includes(','))s=s.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');
  if(!(signed?/^-?\d+(?:\.\d{1,2})?$/:/^\d+(?:\.\d{1,2})?$/).test(s))throw Error('Vul een geldig bedrag in, met maximaal twee decimalen.');
  const sign=s.startsWith('-')?-1:1,[a,b='']=s.replace('-','').split('.'),n=sign*(Number(a)*100+Number(b.padEnd(2,'0')));
  if(!Number.isSafeInteger(n)||Math.abs(n)>900000000000)throw Error('Bedrag is te groot.');return n;
 }
 function date(raw){let s=String(raw||'').trim();if(/^\d{8}$/.test(s))s=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`;else if(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(s)){const [d,m,y]=s.split(/[-/]/);s=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Ongeldige datum');return s;}
 function csv(text,delimiter){
  text=String(text).replace(/^\uFEFF/,'');delimiter ||= text.split(/\r?\n/)[0].split(';').length>text.split(/\r?\n/)[0].split(',').length?';':',';
  let rows=[],row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';}else field+=c;}
  if(quoted)throw Error('CSV heeft een niet-afgesloten aanhalingsteken');row.push(field);if(row.some(x=>x!==''))rows.push(row);return rows;
 }
 function mapping(headers){const h=headers.map(x=>x.toLowerCase().replace(/[^a-z]/g,''));const find=(...keys)=>h.findIndex(x=>keys.includes(x));return {date:find('datum','date','boekdatum'),amount:find('bedrageur','bedrag','amount'),direction:find('afbij','debetcredit'),account:find('rekening','iban','account'),counterparty:find('tegenrekening','counterparty'),description:find('naamomschrijving','omschrijving','description'),note:find('mededelingen','note'),reference:find('transactieid','transactionid','uniekereferentie')};}
 async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function importRows(rows,map,account,existing=[]){
  const seen=new Set(),saved=new Set(existing.map(r=>r.source_key)),result=[];
  for(let i=1;i<rows.length;i++){
   const r=rows[i],get=k=>map[k]>=0?String(r[map[k]]??'').trim():'',v={line:i+1,id:crypto.randomUUID(),account_id:account.id};
   try{v.date=date(get('date'));v.cents=cents(get('amount'),true);if(!v.cents)throw Error('Nulmutatie');const dir=get('direction').toLowerCase();if(dir==='af'||dir==='debet')v.cents=-Math.abs(v.cents);else if(dir==='bij'||dir==='credit')v.cents=Math.abs(v.cents);else if(dir)throw Error('Onbekende Af/Bij waarde');
    v.description=[get('description'),get('note')].filter(Boolean).join(' — ');v.counterparty=get('counterparty');v.source_account=get('account');v.external_reference=get('reference');
    if(v.source_account&&account.data.iban&&v.source_account.replace(/\s/g,'').toUpperCase()!==account.data.iban.replace(/\s/g,'').toUpperCase())throw Error('CSV-rekening wijkt af van gekozen rekening');
    v.source_key=await hash(JSON.stringify([account.id,...(v.external_reference?['reference',v.external_reference]:[v.date,v.cents,v.counterparty,v.description.replace(/\s+/g,' ').trim()])]));
    v.duplicate=saved.has(v.source_key);v.ambiguous=seen.has(v.source_key);seen.add(v.source_key);v.selected=!v.duplicate&&!v.ambiguous;
   }catch(e){v.error=e.message;v.selected=false;}result.push(v);
  }return result;
 }
 function period(type,value){if(!({year:/^[1-9]\d{3}$/,month:/^[1-9]\d{3}-(0[1-9]|1[0-2])$/,quarter:/^[1-9]\d{3}-Q[1-4]$/}[type]?.test(String(value))))throw Error('Kies een geldig jaar en een geldige maand of kwartaal.');const y=Number(value.slice(0,4));if(type==='year')return {from:`${y}-01-01`,to:`${y}-12-31`};let m=type==='quarter'?(Number(value.slice(-1))-1)*3+1:Number(value.slice(5,7));const end=type==='quarter'?m+2:m;return {from:`${y}-${String(m).padStart(2,'0')}-01`,to:new Date(Date.UTC(y,end,0)).toISOString().slice(0,10)};}
 function expenseBase(d){if(['21','9'].includes(d.vat_treatment))return d.business_cents-Number((BigInt(d.vat_cents)*BigInt(d.business_bp)+5000n)/10000n);if(['zero','exempt','kor','reverse'].includes(d.vat_treatment))return d.business_cents;return null;}
 function project(s,from='0001-01-01',to='9999-12-31'){
  const journals=new Map(s.journals.map(j=>[j.id,j])),records=new Map(s.records.map(r=>[r.id,r]));
  const balance=(code,ref=null,start='0001-01-01',end=to)=>s.lines.filter(l=>l.account_code===code&&(!ref||l.reference_id===ref)&&journals.get(l.journal_id)?.date>=start&&journals.get(l.journal_id)?.date<=end).reduce((n,l)=>n+l.cents,0);
  const revenue=-s.accounts.filter(a=>a.category==='income').reduce((n,a)=>n+balance(a.code,null,from,to),0)||0,cost=s.accounts.filter(a=>a.category==='expense').reduce((n,a)=>n+balance(a.code,null,from,to),0);
  const accounts=s.accounts.map(a=>({...a,cents:balance(a.code),period_cents:balance(a.code,null,from,to)}));
  const bank=s.records.filter(r=>r.kind==='account').map(r=>({...r,known:r.data.opening_date!==null&&r.data.opening_date<=to,cents:balance(r.data.code)}));
  const invoices=s.records.filter(r=>r.kind==='invoice'&&r.status==='posted'&&!r.parent_id&&r.date<=to).map(r=>{const outstanding=balance('1100',r.id),credits=s.records.filter(c=>c.kind==='invoice'&&c.status==='posted'&&c.parent_id===r.id&&c.date<=to).reduce((n,c)=>n+c.data.document.totalCents,0),total=r.data.document.totalCents,cancelled=!!r.data.cancellation_id&&r.data.cancellation_date<=to;return {...r,outstanding,credits,cancelled,paidCents:cancelled?0:total+credits-outstanding,statusLabel:cancelled?'Geannuleerd':credits===-total?'Gecrediteerd':outstanding<0?'Terug te betalen':outstanding===0?'Betaald':outstanding<total+credits?'Gedeeltelijk betaald':'Openstaand'};});
  const expenses=s.records.filter(r=>r.kind==='expense').map(r=>({...r,outstanding:-balance(r.data.control,r.id)}));
  const settings=d=>s.records.filter(r=>r.kind==='settings'&&r.status==='confirmed'&&r.date<=d).at(-1)?.data;
  const flags=[];if(!s.organization.legacy_reviewed)flags.push('Historische aansluiting nog niet bevestigd');if(bank.some(a=>!a.known))flags.push('Beginsaldo ontbreekt');
  if(!settings(from)||!settings(to))flags.push('Fiscale instellingen ontbreken voor (een deel van) de periode');
  const vat=[];
  for(const r of s.records){
   if(r.kind==='invoice'&&r.status==='posted'&&r.data.document.vatMethod==='invoice'&&r.date>=from&&r.date<=to)vat.push({id:r.id,date:r.date,label:r.number,output:r.data.document.vatCents,input:0,rate:r.data.document.vatBasisPoints,revenue:r.data.document.netCents,cost:0,correction:!!r.parent_id});
   if(r.kind==='expense'&&r.date>=from&&r.date<=to){vat.push({id:r.id,date:r.date,label:r.data.supplier,output:r.data.charge_vat_cents,input:r.data.input_vat_cents,rate:['21','9'].includes(r.data.vat_treatment)?Number(r.data.vat_treatment)*100:null,revenue:0,cost:expenseBase(r.data)});flags.push(...(r.data.flags||[]).map(f=>`${r.data.supplier}: ${f}`));if(!settings(r.date))flags.push(`${r.data.supplier}: fiscale instellingen ontbreken`);}
   if(r.kind==='correction'&&r.data.expense_reversal&&r.date>=from&&r.date<=to){const e=records.get(r.parent_id);vat.push({id:r.id,date:r.date,label:'Tegenboeking '+e?.data.supplier,output:-(e?.data.charge_vat_cents||0),input:-(e?.data.input_vat_cents||0),rate:['21','9'].includes(e?.data.vat_treatment)?Number(e.data.vat_treatment)*100:null,revenue:0,cost:e&&expenseBase(e.data)!==null?-expenseBase(e.data):null,correction:true});}
   if(r.kind==='correction'&&r.data.invoice_cancellation&&r.date>=from&&r.date<=to){const original=records.get(r.parent_id),doc=original?.data.document;if(doc?.vatMethod==='invoice')vat.push({id:r.id,date:r.date,label:'Annulering '+original.number,output:-doc.vatCents,input:0,rate:doc.vatBasisPoints,revenue:-doc.netCents,cost:0,correction:true});}
  }
  const cumulative=new Map();
  const allocations=s.records.filter(r=>r.kind==='allocation').map(r=>({r,b:records.get(r.data.bank_id)})).sort((a,b)=>(a.b.date+a.r.created_at).localeCompare(b.b.date+b.r.created_at));
  for(const {r,b} of allocations)for(const part of r.data.parts){const inv=records.get(part.target_id);if(part.type!=='invoice'||inv?.data.document.vatMethod!=='cash')continue;const doc=inv.data.document,prev=cumulative.get(inv.id)||0,next=prev+part.cents*Math.sign(b.data.cents);cumulative.set(inv.id,next);if(b.date>=from&&b.date<=to){const tax=Math.round(next*doc.vatCents/doc.totalCents)-Math.round(prev*doc.vatCents/doc.totalCents);vat.push({id:r.id,date:b.date,label:`Ontvangst/terugbetaling ${inv.number}`,output:tax,input:0,rate:doc.vatBasisPoints,revenue:next-prev-tax,cost:0,correction:b.data.cents<0});}}
  const unallocated=s.records.filter(r=>r.kind==='bank'&&r.date<=to&&balance('1400',r.id)!==0);if(unallocated.length)flags.push(`${unallocated.length} ongekoppelde bankmutaties; controleer o.a. nog niet herkende btw-ontvangsten`);
  if(s.files.some(f=>f.status!=='ready'))flags.push('Bronbestanden nog niet volledig opgeslagen');
  if(s.records.some(r=>r.kind==='invoice'&&r.status==='posted'&&r.date<=to&&!s.files.some(f=>f.record_id===r.id&&f.kind==='invoice_pdf'&&f.status==='ready')))flags.push('Definitieve PDF ontbreekt bij een factuur');
  const vatGroups=[...new Set(vat.map(v=>v.rate))].map(rate=>({rate,costUnknown:vat.some(v=>v.rate===rate&&v.cost===null),...Object.fromEntries(['revenue','cost','output','input'].map(k=>[k,vat.filter(v=>v.rate===rate).reduce((n,v)=>n+(v[k]||0),0)]))}));
  const methods=[...new Set(s.records.filter(r=>r.kind==='settings'&&r.status==='confirmed'&&r.date<=to&&(r.date>=from||r.data===settings(from))).map(r=>r.data.vat_method))];
  return {balance,revenue,cost,profit:revenue-cost,accounts,bank,invoices,expenses,unallocated,vat,vatGroups,methods,flags:[...new Set(flags)],outputVAT:vat.reduce((n,v)=>n+v.output,0),inputVAT:vat.reduce((n,v)=>n+v.input,0)};
 }
 function csvOut(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(typeof v!=='number'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');}
 function quantity(raw){const s=String(raw??'').trim().replace(',','.');if(!/^\d+(?:\.\d{1,3})?$/.test(s))throw Error('Vul een positief aantal in (maximaal drie decimalen).');const [a,b='']=s.split('.'),n=Number(a)*1000+Number(b.padEnd(3,'0'));if(!Number.isSafeInteger(n)||n<=0||n>1000000000)throw Error('Ongeldig aantal');return n;}
 function invoiceTotals(body,rate){
  if(![0,900,2100].includes(rate))throw Error('Bevestigd btw-tarief ontbreekt');
  if(!Array.isArray(body.lines)||body.lines.length<1||body.lines.length>200)throw Error('Gebruik 1 tot 200 factuurregels');
  if(!['inclusive','exclusive'].includes(body.price_mode))throw Error('Kies inclusief of exclusief btw');
  const round=(n,d)=>Number((n*2n+d)/(d*2n));
  const lines=body.lines.map(l=>{if(!l.description?.trim()||!Number.isSafeInteger(l.unit_cents)||l.unit_cents<0||!Number.isSafeInteger(l.quantity_milli)||l.quantity_milli<=0||l.quantity_milli>1000000000)throw Error('Controleer aantal, eenheidsprijs en omschrijving');return {description:l.description,quantity:l.quantity_milli/1000,unitCents:l.unit_cents,amountCents:round(BigInt(l.unit_cents)*BigInt(l.quantity_milli),1000n)};});
  const subtotalCents=lines.reduce((n,l)=>n+l.amountCents,0);if(!Number.isSafeInteger(subtotalCents)||subtotalCents>900000000000)throw Error('Factuurbedrag is te groot');
  if(body.discount_mode==='percent'&&(!Number.isInteger(body.discount_bp)||body.discount_bp<0||body.discount_bp>10000))throw Error('Korting moet tussen 0 en 100 procent liggen');
  if(!['fixed','percent'].includes(body.discount_mode))throw Error('Kies vaste korting of kortingspercentage');
  const discountInputCents=body.discount_mode==='percent'?round(BigInt(subtotalCents)*BigInt(body.discount_bp),10000n):body.discount_input_cents;
  if(!Number.isSafeInteger(discountInputCents)||discountInputCents<0||discountInputCents>subtotalCents)throw Error('Korting is ongeldig of hoger dan het factuurbedrag');
  const after=subtotalCents-discountInputCents,netCents=body.price_mode==='exclusive'?after:round(BigInt(after)*10000n,BigInt(10000+rate));
  const vatCents=body.price_mode==='exclusive'?round(BigInt(netCents)*BigInt(rate),10000n):after-netCents,totalCents=netCents+vatCents;
  const grossCents=body.price_mode==='exclusive'?subtotalCents+round(BigInt(subtotalCents)*BigInt(rate),10000n):subtotalCents;
  return {lines,subtotalCents,discountInputCents,grossCents,discountCents:grossCents-totalCents,netCents,vatCents,totalCents};
 }
 const api={money,cents,date,csv,mapping,hash,importRows,period,project,csvOut,quantity,invoiceTotals};if(typeof module!=='undefined')module.exports=api;else root.FMZAccountingModel=api;
})(typeof window!=='undefined'?window:globalThis);
