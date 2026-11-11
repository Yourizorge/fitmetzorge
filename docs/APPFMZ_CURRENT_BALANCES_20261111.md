# Actuele betaalstand — lokale owner-test, 11 november 2026

Historische status bij de lokale owner-test: nog niet gepubliceerd. De opvolgende release staat in [het actuele releaserapport](APPFMZ_OWNER_NOTES_RELEASE_20261111.md). Geen productieboekingen, facturen, betaaldatums, PDF's of Bank/Kas-regels gewijzigd.

## Oorzaak en read-only onderzoek

Drie gerichte `BEGIN READ ONLY`-queries op het toegestane APPFMZ-project controleerden tabeldefinities, de oktoberfacturen en de bijbehorende debiteurenboekingen. De gemelde €332,50 is volledig en eenmaal gekoppeld aan een ontvangst van 10 november. Het actuele debiteurensaldo is nul; dezelfde factuur had op 31 oktober nog €332,50 open. Alle drie onderzochte oktoberfacturen hebben inmiddels een restsaldo van nul. Geen ontbrekende of foutieve betaalkoppeling gevonden. Persoonsgegevens en echte factuurnummers zijn niet in dit rapport of de testbeelden opgenomen.

`Facturen` gebruikte de actuele grootboekprojectie. Het financiële dashboard selecteerde zowel facturen als betalingen tot de laatste dag van de gekozen periode. Vervolgens vergeleek het die historische openstand met de vervaldatum van vandaag. Daardoor verscheen een inmiddels betaalde factuur alsnog als achterstallig.

## Correctie

- De periode selecteert de factuurdatum. De factuurkaarten gebruiken vervolgens de actuele grootboekstand, inclusief latere betalingen, credits, annuleringen en correcties.
- De doorkliklijsten gebruiken dezelfde actuele factuurverzameling als de kaarten.
- Ontvangen op deze facturen vermeldt expliciet dat ook ontvangst na het periode-einde meetelt.
- Omzet, btw, kasstromen en rekeningstanden blijven periodegebonden. Historische rapporten zijn apart gelabeld met `stand op [einddatum]`.
- Alleen presentatie/projectie gewijzigd; de bestaande betalingsroute en historische boekingen blijven intact.

## Bewijs

Zes model/regressietests geslaagd via `tests/current-balances.test.cjs`, `tests/finance-model.test.cjs` en `tests/accounting-model.test.cjs`. Ze behandelen betaling vóór/na maandgrens, deelbetaling, werkelijk achterstallige factuur, latere deelcredit, annulering, tegenboeking en behoud van historische omzet/btw/kasstromen.

Eén gerichte browsertest geslaagd: `tests/current-balances-ui.test.cjs`. Werkelijke APPFMZ-schermen in Edge met synthetische lokale SQL/RPC-opslag, op 1440×1000 en 390×844. Deze test reproduceert de oude €332,50-reststand, toont daarna €0 nog te ontvangen / €0 achterstallig / 0 openstaande facturen, controleert de bijbehorende doorkliklijsten en herhaalt de controle na herladen en opnieuw aanmelden. De test blokkeert netwerkverzoeken buiten de lokale preview. Dit is browseremulatie, geen fysieke telefoontest.

De eerste browserrun tijdens parallelle frontendbewerking liep vast bij de synthetische login; na voltooiing van die tussenstand slaagde dezelfde gerichte run. Dit was geen productieaanmelding. De daadwerkelijke browsercache van de eigenaar is niet bekeken en de lokale correctie staat nog niet live.

De fictieve dataset bevat twee oktoberfacturen: €150 betaald op 10 oktober en €332,50 betaald op 10 november. Er zijn na alle herladingen nog precies twee facturen en twee ontvangsten.

## Screenshots — uitsluitend synthetisch

- [Laptop vóór](images/owner-navigation-20261111/payments-before-1440.png)
- [Laptop na](images/owner-navigation-20261111/payments-after-1440.png)
- [Telefoon vóór](images/owner-navigation-20261111/payments-before-390.png)
- [Telefoon na](images/owner-navigation-20261111/payments-after-390.png)

De voorweergave gebruikt de oorspronkelijke financiële modules uit de basiscommit; de naweergave gebruikt de lokale wijziging, met exact dezelfde fictieve SQL-gegevens. Screenshots zijn van het relevante administratievenster. Productie, staging, JARVIS en de bedrijfswebsite zijn ongewijzigd.
