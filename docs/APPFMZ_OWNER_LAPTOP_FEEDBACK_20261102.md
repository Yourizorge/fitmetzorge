# APPFMZ — herziene afgeschermde owner-laptoptest

Datum: 2 november 2026. Alleen de synthetische owner-test wordt vervangen. Deze release is geen vrijgave van de nieuwe productie-inschrijving. De privacytekst blijft concept.

## Afbakening en herkomst

- Opdrachtbasis / remote main vóór deze correctie: `7ad819d09e5e772980b8ec8bba1889df7027caae`.
- Bewezen gewone livebasis: `309cb0db3569f14ac54442c8daec678020ba149a`.
- Hersteltag: `appfmz-live-before-member-onboarding-20261102`; beschermde branch: `backup/appfmz-pre-member-onboarding-20261102`. Beide wijzen naar de livebasis; branch blijft vergrendeld, met admin enforcement en zonder force-push/verwijderen.
- Voorbereide ontwikkelbron en uitvoerbare regressietests staan afzonderlijk op `codex/members-billing-20261026`, commit `ba0f9f6288a50d2ad63b7a8ad3024c8671cbee4c`. Browser-/databasetests worden vanuit die broncheckout uitgevoerd, waar de synthetische fixtures en testafhankelijkheden staan. De losse releasecheckout bevat alleen de publicatieverifiers. Alleen het verpakte `owner-test/` en controlebestanden/documentatie komen naar main. Geen root-appcode, SQL of Edge-bron uit die ontwikkelbranch wordt uitgerold.
- De definitieve hashes, publicatiecommit en data-/livecontrole staan in de gekoppelde bewijsbestanden hieronder. Een afsluitende bewijscommit verandert geen runtime.

## Verwerkte feedback

**Pakketten:** precies drie individuele PT-kaarten uit de actieve lokale catalogus: Basis €200 / 4 / €50, Progressie €380 / 8 / €47,50, Transformatie €480 / 12 / €40. Alleen naam, vierwekenbedrag, aantal, eenheidsprijs en Kiezen. Duo en online blijven in de catalogus. Geen afwijkende hardcoded prijslijst.

**Formulier:** één verticale kolom. Volledige naam, e-mail, telefoon, geboortedatum en startdatum; vervolgens straat, huisnummer, toevoeging, postcode, plaats, land; daarna doelen, ervaring, begeleiding, vrijwillige gezondheidsinformatie en aanvullende informatie. Aparte vrijwillige toestemming en conceptprivacy blijven zichtbaar. Een oud concept met korting of afwijkende eerste periode vereist expliciete pakketherkeuze.

**Kosten:** €380 voor acht trainingen en €47,50 per training bij Progressie; inclusief btw, begin/einddatum en factuurdatum volgens dezelfde vastgelegde perioderegel als overeenkomst en herinneringen. Voor start 2 november is de eerste periode 2–29 november en de bestaande factuurdatumregel 29 november; de volgende periode start 30 november. Geen inschrijfkorting, toeslag, prorata, automatische factuur of mail. Handmatige factuurkortingen in de bestaande administratie blijven beschikbaar.

**Hoofdmenu:** Dashboard, Agenda, Schema builder, Leden, Administratie, Facturen, Instellingen. Dashboard zonder ledenlijst of vaste geselecteerd-lidbalk. Onder Leden staat zoeken vooraan. Een resultaat opent direct het volledige profiel. Terug naar het algemene dashboard wist de zichtbare lidcontext.

**Profiel:** Overzicht, Coaching, Training, Voeding, Trackers, Agenda, Financiën, Documenten, Notities, Historie. De bestaande functies worden onder de juiste lidcontext geplaatst, niet opnieuw als aparte systemen gebouwd. Wisselen bewaakt de lidcontext. Alleen werkelijke wijzigingen tellen als onopgeslagen invoer; het bekijken van een lege week maakt geen nieuw concept.

**Schema builder:** algemeen concept, daarna expliciet doel kiezen, naam/lidnummer controleren en bevestigen. Een stabiele toewijzingsidentiteit voorkomt een tweede schema bij herhalen; pas bevestigde opslag maakt de toewijzing zichtbaar onder Training. Een oudere opslagbevestiging kan nieuwe invoer niet als opgeslagen markeren.

**Camera:** Foto maken is primair, Bestaande foto kiezen secundair. Een door de eigenaar geopende dialoog vraagt via native `getUserMedia` cameratoestemming. Live voorbeeld, Foto nemen, Opnieuw maken, Foto gebruiken en Sluiten. Tijdens de foto-preview blijft de indicator melden dat de camera aan staat; afronden/sluiten/sessiewissel stopt de tracks. Alleen de gekozen JPEG gaat naar de lokale testdatabase. Geen audio of videobestand; geen echte Storage-upload. De opaque testiframe krijgt geen camerarecht of productieverbinding: een bron-/nonce-gecontroleerde brug naar de eigenaarhost levert uitsluitend de expliciet gekozen foto.

**Herinneringen:** uitsluitend uit actieve synthetische betaalafspraken en de bestaande periodeberekening. Vier weken en kalendermaand blijven afzonderlijk, met Europe/Amsterdam, zeven dagen vooraf en op de factuurdatum. Agenda en in-appweergave openen de bestaande Facturen-pagina; voltooid markeren blijft na hervatten behouden. Geen financiële mutatie of push. Voor vaste oefenleden worden alleen ontbrekende lokale voorbeeldafspraken toegevoegd; bestaande afspraken worden niet omgezet.

**Verwijderd uit deze test:** planning, automatische concepten, e-mailconcepten, mailboxkoppeling, geplande verzending en verzendsimulatie. De betreffende commandoroutes zijn geblokkeerd; de lokale inschrijftrigger voor communicatie staat uit. Oude lokale testhistorie blijft wel in de exacte verwijderlijst zichtbaar. De gewone productieadministratie blijft byte-identiek.

## Controlebewijs en beperkingen

Bewijsmap: [owner-laptop-feedback-20261102](examples/owner-laptop-feedback-20261102/). Screenshots: [laptop en zoom](images/owner-laptop-feedback-20261102/). Alle personen, overeenkomsten, foto's en bedragen in dit materiaal zijn synthetisch.

| Controle | Uitkomst / bewijs |
|---|---|
| Model, formulier en PDF | Acht gerichte regressiecases geslaagd; geen nul-korting op test-PDF, bestaande kortingssnapshots behouden. |
| Gehele inschrijving Edge | PASS; `enrollment-edge.json`, 89,1 s testproces. |
| Gehele inschrijving Chrome | PASS; `enrollment-chrome.json`, 53,1 s testproces. |
| Beide volledige browserketens | Concept/hervatten, leeg handtekeningvak blokkeren, wissen/tekenen, geldige PDF, lokale foto, offline profielwijziging/audit, herstart, byte-identieke PDF, exacte cleanup; geen parentdatamutatie. |
| Lokale database en herstart | Vijf cases PASS: idempotentie/verloren antwoord, foto-/verwijdermanifest, JSON/Blob/datumroute en twee herinnerings-/tijdzonecases. Geen factuur/mail bij inschrijving. |
| Camera native | Edge 155 en Chrome 156: echte native getUserMedia-stream 1280×720 geopend en gestopt, geen frame opgenomen. `camera-evidence.json`. |
| Camera bediening | Twee synthetische opname/retake/use-scenario's plus weigering; Chrome volledige parent→iframe→bijsnijden→lokale opslag→reset PASS (`camera-bridge.json`). Edge gebruikt voor deze beeldtest een canvasfixture omdat de headless nep-device-stream zichzelf beëindigde. Native cameraondersteuning is afzonderlijk bewezen. |
| Herinneringsbediening | Edge en Chrome PASS, agenda/open Facturen/voltooid/herladen/geen financiële neveneffecten. `reminders-edge.json`, `reminders-chrome.json`. |
| Hostbeveiliging | PASS: onbevoegde gebruiker geweigerd, sessiewissel, tabvergrendeling, procesherstart en behouden concept. `host-security-evidence.json`. |
| Navigatie en zoom | PASS 2/2: Edge-navigatie en Chrome-layout, 48,28 s. Native zoom 100/125/150/200%, schermen 390×844, 844×390, 768×1024 en 1366×768, toetsenbord en tien tabs. Alle zeven menuknoppen aantoonbaar binnen het scherm, ook zonder negatieve afsnijding. `navigation-evidence.json` / `layout-evidence.json`; native Chrome-zoom gebruikt setZoom/getZoom, geen CSS-simulatie. |
| Productie en publicatie | Definitieve uitslagen in `production-after.json`, `release-live.json`, `release-hosting.json`, `live-browser-smoke.json`. |

De volledige zakelijke browserketens testten runtime SHA-256 `d790c6691d98ceebb1e3e0183ca624f4ba972d12626b79cb13dc4983c7bb1be7`. Daarna is alleen de menuplaatsing bij vergrote tekst en het automatisch inklappen van de gids bij een smal venster aangepast. Het uiteindelijke pakket is opnieuw op navigatie en native zoom getest: PASS. Definitieve runtime SHA-256: `0f777cfb4d9b78d3bc5d8a09626791d2293530ab81dd8e5fc1bcf0fcc2365d1a`. Dit is geen fysieke eigenaaracceptatie of telefoon-/push-/mailbox-PASS.

De PDF is werkelijk gegenereerd, tekstmatig gecontroleerd en gerenderd bekeken. Elke testovereenkomst draagt “OEFENOVEREENKOMST - NIET GELDIG”. Herdownload na profielbewerking levert dezelfde PDF-bytes. De echte productie-PDF's worden niet gelezen of gewijzigd.

## Nieuwe test op jouw laptop

Open na aanmelden als eigenaar: **https://appfmz.nl/?owner-test=1&retest=20261102**. Gebruik de afgeschermde testlauncher; controleer steeds TESTMODUS.

1. Controleer TESTMODUS.
2. Open Leden, zoek Noor en open direct het volledige profiel.
3. Controleer de horizontale profieltabbladen.
4. Open Coaching, Training, Voeding en Trackers binnen het profiel.
5. Start een nieuwe inschrijving.
6. Controleer de drie rustige PT-kaarten en kies Progressie.
7. Controleer de verticale persoonsgegevens-, adres- en doelenindeling.
8. Bewaar, ververs en hervat het concept.
9. Controleer €380, acht trainingen en €47,50 per training.
10. Teken, wis, teken opnieuw en open de testovereenkomst.
11. Open het profiel opnieuw en maak met de laptopcamera een foto; kies bewust Foto gebruiken.
12. Maak in Schema builder een testschema; controleer naam/lidnummer en bevestig de koppeling aan het fictieve lid.
13. Controleer het schema onder Training.
14. Controleer beide vierweekse herinneringen, open Facturen en markeer ze voltooid.
15. Bekijk de exacte verwijderlijst en wis uitsluitend deze testgegevens.

De gids bevat deze vijftien stappen. Je fysieke camerabediening en inhoudelijke goedkeuring staan nog open. Daarna pas kan een afzonderlijke productie-toelating worden beoordeeld.

## Publicatiestatus

**Gepubliceerd en technisch geverifieerd:** runtimecommit `ecae3454bf4ed97c5e21033a4ea9ad09c1570344`. GitHub Pages bevestigt deze commit op `main`, HTTPS en status `built`. De afsluitende bewijscommit verandert uitsluitend dit rapport en JSON-bewijs; de definitieve remote HEAD wordt bij oplevering gemeld.

- 108/108 gepubliceerde bestanden plus de root-URL byte-identiek aan Git: 88 bestaande runtimeassets en twintig owner-testbestanden.
- Alle 449 bestanden van de oorspronkelijke livebasis gecontroleerd. Alleen de reeds bestaande launcher-invoeging in index.html en twee bestaande owner-test-attributen wijken van die oude basis af. Ten opzichte van opdrachtbasis `7ad819d…` verandert geen gewoon runtimebestand.
- Anonieme live Edge-controle: app opent zonder scriptfout, ownerlauncher en sandbox zijn afwezig voor onbevoegden, nul schrijfverzoeken.
- Twaalf productiemigrations exact gelijk; geen migration, Edge-deployment, schema-/Auth-/Storage- of gegevensschrijfactie uitgevoerd.
- Bestaande herstelbranch en tag gecontroleerd; geen wijziging aan hun doelen of bescherming.

### Datavergelijking — expliciete beperking

De nulmeting was om 16:05:19 UTC; de nameting om 16:43:51 UTC. **21 van 24 volledige tabelhashes zijn identiek.** Daaronder alle financiële tabellen, betaalafspraken, agenda, profielen, Storage-metadata en fotoannotaties. Patrick, Debora en andere bestaande betaalafspraken zijn niet omgezet. De release heeft geen echte foto of overeenkomst opgeslagen.

Drie afwijkingen worden niet verborgen of als ongewijzigd gerapporteerd:

1. `fmz_private.write_receipts`: van 1482 naar 1499. Alle oorspronkelijke 1482 rijen zijn aantoonbaar byte-identiek behouden. De zeventien toevoegingen dateren van 16:08:36–16:10:16 UTC, ruim vóór het begin van deze publicatie om 16:43:24 UTC.
2. `public.coach_workspaces`: één rij vóór en na, maar gewijzigde inhoudshash; laatste wijziging 16:10:16 UTC. Zonder eerdere veldsnapshot is niet onafhankelijk te bewijzen welke waarden veranderden of of iedere oude waarde behouden bleef.
3. `auth.users`: tien accounts vóór en na, geen nieuw account, maar één gewijzigde rijhash/updated_at om 16:08:20 UTC. Geen nieuwe aanmelding of auditregel in dit meetvenster. Zonder eerdere veldsnapshot is de oorzaak niet vastgesteld.

Deze tijdstippen bewijzen dat de afwijkingen vóór deze publicatie optraden. Ze bewijzen niet wie ze veroorzaakte. Er wordt geen gebruikershandeling, sessieverversing of dataverlies verondersteld. Er is niets teruggezet, verwijderd of overschreven. **Volledige hashgelijkheid van alle productiegegevens over het hele meetvenster is dus niet bewezen.** Zie `production-after.json` voor de exacte tellingen, hashes en read-only vervolgcontrole.

### Eindstatus

- Owner laptop retest: **GO**, uitsluitend voor de geïsoleerde test; fysieke eigenaaracceptatie staat open.
- New member flow live for members: **NO**.
- Real member photo storage enabled: **NO**.
- Real invoice automation enabled: **NO**.
- Real invoice emails enabled: **NO**.
- Automatic invoice sending enabled: **NO**.
- Invoice reminders in synthetic test: **YES**.
- Existing monthly clients preserved: **YES**, overeenkomstentabel hash-identiek.
- Existing data preserved: **niet volledig bewijsbaar voor de gewijzigde werkruimte/Auth-rij**; bovenstaande 21 tabelhashes en alle oorspronkelijke opslagbevestigingen zijn bewezen behouden. Geen dataverlies vastgesteld of gegevensherstel uitgevoerd.
- Rollback point verified: **YES**.
- Staging touched: **NO**.
- JARVIS touched: **NO**.
- Business website touched: **NO**.

De volgende stap is jouw vijftienstappen-laptoptest, geen vrijgave van de echte inschrijfroute. Gebruik een voorwerp of fictief beeld bij de camera-oefening en verwijder na afloop de lokale testgegevens via de getoonde verwijderlijst.
