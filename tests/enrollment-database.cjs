/* Shared synthetic-only integration schema. No production network. */
const fs=require('node:fs'),path=require('node:path');
async function extend(database){
 for(const file of ['20261026154916_appfmz_members.sql','20261026154917_appfmz_billing_planning.sql','20261026154918_appfmz_communication.sql']){
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8');
  if(!sql.trim())throw Error('Release migration is still being prepared: '+file);
  await database.db.exec(sql);
 }
 return database;
}
module.exports={extend};
