const {seed:base,login}=require('./layout-fixture.cjs');
async function seed(p){
 await base(p);const s=await p.database.read('trainer');
 s.clients[0].appointments=[
  {id:'sample-duo',date:'2026-10-15',time:'09:00',duration:60,type:'Duo krachttraining',location:'Voorbeeldstudio',status:'planned',occurrenceId:'sample-duo',notes:'Synthetische afspraak'},
  {id:'sample-attended',date:'2026-10-12',time:'11:00',duration:45,type:'Personal training',status:'attended'},
  {id:'sample-unknown',date:'2026-10-02',time:'08:30',duration:60,type:'Oude afspraak zonder aanwezigheid'},
  {id:'sample-cancelled',date:'2026-10-14',time:'15:00',duration:60,type:'Personal training',status:'cancelled'},
  {id:'sample-long',date:'2026-10-16',time:'16:15',duration:90,type:'Een extra lange omschrijving van een voorbeeldafspraak met techniek en mobiliteit',status:'planned'}
 ];
 s.clients[1].appointments=[{...s.clients[0].appointments[0]}];
 await p.database.db.query('update public.coach_workspaces set state=$1 where trainer_id=$2',[JSON.stringify(s),p.database.ids.trainer]);
}
module.exports={seed,login};
