const fs = require('node:fs');
const svg = (width,height,animated=false) => 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 400 600"><rect width="400" height="600" fill="#f3f5f7"/><text x="200" y="45" text-anchor="middle" font-family="Arial" font-size="22">VOORBEELDOEFENING</text><circle cx="200" cy="130" r="38" fill="#0b4f78"/><g stroke="#0b4f78" stroke-width="24" stroke-linecap="round"><path d="M200 180V330M200 220L100 290M200 220L300 290M200 330L130 470M200 330L270 470"/>${animated?'<animateTransform attributeName="transform" type="translate" values="0 0;0 25;0 0" dur="1s" repeatCount="indefinite"/>':''}</g><text x="200" y="555" text-anchor="middle" font-family="Arial" font-size="20">SYNTHETISCH</text></svg>`);
async function seed(preview) {
 const motion='data:image/gif;base64,'+fs.readFileSync(require('node:path').join(__dirname,'fixtures/exercise-motion.gif')).toString('base64');
 const state = await preview.database.read('trainer');
 for (const [i,c] of state.clients.entries()) {
  c.name = ['Voorbeeldlid Alex','Voorbeeldlid Bo','Voorbeeldlid Chris'][i];
  c.goal = 'Sterker worden met gecontroleerde techniek';
  c.planSummary = 'Voorbeeldschema. Alle getoonde gegevens zijn synthetisch.';
  c.trainingPlan = Array.from({length:12},(_,i)=>({id:'layout-'+i,day:'Dinsdag',exercise:i===0?'Squat met gecontroleerde uitvoering en een extra lange oefennaam voor de schermcontrole':i===1?'Bewegende voorbeeldmedia':i===2?'Oefening zonder beschikbare foto':'Voorbeeldoefening '+(i+1),group:'Kracht en techniek',equipment:'Eigen lichaamsgewicht',sets:3,reps:'8–12',targetWeight:20,rest:'90 sec',tempo:'3–1–2',schemaName:'Voorbeeldschema hele lichaam',published:i!==11,image:i===2?'/missing-exercise.png':i===1?motion:svg(i%2?1600:400,i%2?900:2400),logsByWeek:{'2026-10-12':{actualSets:'3',actualReps:'10/10/9',actualWeight:'20',notes:'Voorbeeldregistratie'}}}));
 }
 await preview.database.db.query('update public.coach_workspaces set state=$1 where trainer_id=$2',[JSON.stringify(state),preview.database.ids.trainer]);
}
async function login(page, role) {
 await page.locator('#loginForm select[name=role]').selectOption(role==='trainer'?'trainer':'client');
 await page.locator('#loginForm input[name=email]').fill(role==='trainer'?'trainer@example.test':'a@example.test');
 await page.locator('#loginForm input[name=password]').fill('test');
 await page.locator('#loginForm button[type=submit]').click();
 await page.waitForFunction(()=>onlineReady);
 await page.evaluate(()=>{state.ui.selectedClientId='a';state.ui.trackingWeekStart='2026-10-12';state.ui.trainingDay='Dinsdag';renderAll();});
}
module.exports={seed,login,svg};
