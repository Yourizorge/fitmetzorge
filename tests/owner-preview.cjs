/* Loopback-only owner review. Everything lives in an in-memory synthetic database. */
const {start}=require('./preview.cjs');
(async()=>{
 const preview=await start(Number(process.argv[2]||8896));
 await require('./agenda-fixture.cjs').seed(preview);
 await require('./current-balances-fixture.cjs').provision(preview.database);
 console.log('LOKALE TESTMODUS - NIET LIVE: '+preview.url);
 console.log('Trainer: trainer@example.test. Lid: a@example.test. Wachtwoord: synthetic.');
 console.log('Alleen fictieve gegevens. Geen productieverbinding, externe API of e-mail.');
 const close=async()=>{await preview.close();process.exit(0);};process.once('SIGINT',close);process.once('SIGTERM',close);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
