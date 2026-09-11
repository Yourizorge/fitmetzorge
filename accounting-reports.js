/* Readable owner reports use the same ledger projection as the on-screen period overview. */
window.FMZAccountingReports=(()=>{
 const M=FMZAccountingModel,money=M.money;
 function build(s,period,type='all'){
  const p=M.project(s,period.from,period.to),inPeriod=r=>r.date>=period.from&&r.date<=period.to;
  const vat={title:'Btw-overzicht',rows:[['Methode',p.methods.map(x=>x==='cash'?'Kasstelsel':'Factuurstelsel').join(' / ')||'Nog niet bevestigd'],[p.flags.length?'Overzicht onvolledig':'Technisch afgestemd — controleer vóór aangifte'],...p.vatGroups.flatMap(v=>[[v.rate===null?'Overige / grondslag controleren':`Tarief ${v.rate/100}%`,'Omzet excl. btw',money(v.revenue),'Zakelijke kosten excl. btw',v.costUnknown?'Grondslag onvolledig; bekend: '+money(v.cost):money(v.cost)],['Verschuldigd',money(v.output),'Aftrekbare voorbelasting',money(v.input)]]),[p.outputVAT-p.inputVAT>=0?'Naar verwachting te betalen':'Naar verwachting terug te vragen',money(Math.abs(p.outputVAT-p.inputVAT))]]};
  const corrections={title:'Correcties en creditfacturen',rows:p.vat.filter(v=>v.correction).map(v=>[v.date,v.label,'Omzet',money(v.revenue||0),'Btw',money(v.output),'Voorbelasting',money(v.input)])};
  const sales={title:'Verkoopfacturen in de gekozen periode',rows:s.records.filter(r=>r.kind==='invoice'&&inPeriod(r)).map(r=>{const i=p.invoices.find(x=>x.id===r.id);return [r.number||'Concept',r.date,r.status==='draft'?'Concept — geen omzet':r.parent_id?'Credit op '+s.records.find(x=>x.id===r.parent_id)?.number:i?.statusLabel,r.data.document?.customer.name||r.data.customer?.name||'',r.data.document?money(r.data.document.totalCents):'Nog niet definitief'];})};
  const expenses={title:'Uitgaven in de gekozen periode',rows:s.records.filter(r=>r.kind==='expense'&&inPeriod(r)).map(r=>[r.date,r.data.supplier,r.data.description,'Bonbedrag',money(r.data.gross_cents),'Kosten',money(r.data.cost_cents),'Voorbelasting',money(r.data.input_vat_cents)])};
  const flags={title:'Aansluiting en controlepunten',rows:p.flags.length?p.flags:['Technisch afgestemd — controleer vóór aangifte']};
  const bank={title:'Bank, Kas en begin-/eindsaldi',rows:p.bank.map(r=>{const before=p.balance(r.data.code,null,'0001-01-01',period.from)-p.balance(r.data.code,null,period.from,period.from);return [r.data.name,r.data.type==='cash'?'Kas (werkelijk contant geld)':'Bank',r.data.hidden?'Verborgen':'Actief','Beginstand periode',r.data.opening_date&&r.data.opening_date<=period.from?money(before+(r.data.opening_date===period.from?r.data.opening_cents:0)):'Onbekend','Eindstand',r.known?money(r.cents):'Onbekend'];})};
  const open={title:'Openstaande klanten en betaalde facturen t/m einddatum',rows:p.invoices.map(r=>[r.number,r.statusLabel,'Factuur',money(r.data.document.totalCents),'Credits',money(r.credits),'Betaald',money(r.paidCents),'Openstaand',money(r.outstanding)])};
  const result={title:'Resultaat',rows:[['Omzet excl. btw',money(p.revenue)],['Zakelijke kosten',money(p.cost)],['Winst / verlies',money(p.profit)],['Privéstortingen',money(-p.balance('2010',null,period.from,period.to))],['Privéopnames / privédeel',money(p.balance('2020',null,period.from,period.to))]]};
  const assets={title:'Bezittingen, schulden en vermogen t/m einddatum',rows:p.accounts.filter(a=>['asset','liability','equity'].includes(a.category)&&a.cents).map(a=>[a.code,a.name,money(a.category==='liability'||a.category==='equity'?-a.cents:a.cents)])};
  const sources={title:'Bronnen van het btw-overzicht',rows:p.vat.map(v=>[v.date,v.label,'Verschuldigd',money(v.output),'Voorbelasting',money(v.input)])};
  const chosen={vat:[vat,corrections,sources,flags],sales:[sales,open,flags],expenses:[expenses,flags],all:[result,bank,sales,open,expenses,assets,vat,corrections,flags]}[type];
  for(const section of chosen)if(!section.rows.length)section.rows=['Geen posten in deze selectie.'];
  const settings=s.records.filter(r=>r.kind==='settings'&&r.status==='confirmed'&&r.date<=period.to).at(-1)?.data||{};
  return {title:{vat:'Btw-overzicht',sales:'Verkoopfacturen',expenses:'Uitgavenoverzicht',all:'Volledig administratieoverzicht'}[type],settings,period,sections:chosen};
 }
 return {build};
})();
