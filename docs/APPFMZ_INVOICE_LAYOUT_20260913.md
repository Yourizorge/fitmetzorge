# APPFMZ — factuurlayout volgens ownerreferentie

## Scope en acceptatie

Startpunt: `214f5fcbceeaa9d7e3f621d7e5db2cc1f88be357`, gelijk aan actuele `origin/main` bij controle. Repository `Yourizorge/fitmetzorge`; publicatie uitsluitend `appfmz.nl`.

De owner heeft pakket-/doelopslag, administratie, factuurfuncties, PDF openen/downloaden en Bank/Kas functioneel geaccepteerd in de opdracht voor deze visuele hotfix. **De nieuwe factuurtemplate wacht nog op fysieke ownercontrole en acceptatie.** De meegestuurde afbeelding dient alleen als compositiereferentie. Externe branding en voorbeeldgegevens zijn niet overgenomen.

De later toegevoegde opdracht voor een administratietutorial stopt bij “Stap 1 — overzicht v”. Het ontbrekende vervolg is opgevraagd. Deze release bevat geen gedeeltelijke tutorial of oefenmodus en verzint geen tutorialstappen.

## Wijziging

- Witte A4, donkerblauwe tekst, beperkte gouden accenten. Het bestaande originele FMZ-logo staat groot linksboven; de zichtbare logoranden zijn uitgelijnd zonder het PNG-bronbestand te wijzigen. De ingevulde bedrijfsgegevens staan rechts naast een dunne verticale lijn.
- FACTUUR/klant links, compacte metadata met vette veldnamen rechts, daarna de daadwerkelijke dienst- of pakkettitel. Lege optionele bedrijfs-/klantvelden blijven weg.
- Eén brede tabel: omschrijving, aantal, prijs per stuk met expliciet inclusief/exclusief btw, btw en totaal exclusief btw. Bedragen staan rechts en worden op centen weergegeven. Lange tekst loopt door; gewone regels blijven bijeen. Korting is een afzonderlijke negatieve regel.
- Een licht IBAN-blok links en compacte totalen rechts, gevolgd door betaalinstructie en bedanktekst. Rekeninghouder komt uit de ingevulde rekeninghouder/eigenaar/bedrijfsnaam; BIC wordt alleen getoond wanneer aanwezig. Geen fictieve gegevens of nieuw instellingenveld.
- Vaste footer en paginanummers op iedere pagina. Vervolgpagina’s behouden referentie en waar nodig tabelkoppen. Grote bedragen passen binnen hun kolom.
- Proportionele A4-preview plus **PDF vergroten**, zoomknoppen, Passend, verschuiven met muis/vinger en Sluiten. Het extra venster gebruikt alleen de reeds gerenderde PDF-canvassen. Het sluit en wist zijn inhoud wanneer de bronpreview verdwijnt, vervangen wordt of de sessie vervalt. Geen publieke URL, externe PDF-dienst of opslagactie.
- Bij de mobiele visuele controle bleek de donkere vaste titel-/actiebalk doorschijnend. Alleen bij factuurpreviews is deze nu ondoorzichtig. De actieknoppen blijven bereikbaar bij verkleinde toetsenbordruimte.

Alleen `invoice-documents.js`, de relevante previewregels in `styles.css` en hun twee cacheversies in `index.html` wijzigen de runtime. Het gedeelde rapport-PDF-template blijft gelijk. Nieuwe tests en dit rapport beschrijven de correctie.

## Bedragen en archief

De PDF leest de bestaande definitieve documenttotalen. De presentatielaag verdeelt deze centen over de tabelregels, inclusief afzonderlijke korting, zodat de getoonde regels exact op netto en btw aansluiten. De opgeslagen documentgegevens worden niet gewijzigd. Progressie €380 min €30 is €350 te betalen: €289,26 exclusief btw plus €60,74 bij de bestaande 21%-instelling.

De app ondersteunt één ingesteld btw-tarief per factuur. 0%, 9% en 21%, vrijstelling/KOR en inclusief/exclusief zijn afzonderlijk getest; meerdere tarieven binnen dezelfde factuur zijn geen bestaande functie en worden hier niet toegevoegd. Cumulatieve afronding bij gedeeltelijke credits blijft de bestaande bronberekening volgen.

Nieuwe concepten en nieuw uitgegeven documenten gebruiken de nieuwe template. Reeds gearchiveerde PDF’s worden uit de bestaande privéopslag geladen. Opnieuw downloaden en delen gebruiken dezelfde bytes, hetzelfde nummer en dezelfde bedragen. Annulering, credit, conceptopslag, definitief maken, idempotentie, PT409 en alle financiële serverfuncties blijven ongewijzigd.

## Verificatie

De volledige lokale suite slaagt: **19 tests, 19 PASS, 0 FAIL, 0 skipped**, inclusief synthetische PostgreSQL/RLS- en browsertests. Duur van de vastgelegde run: 244,3 seconden. Geen productieaccounts of productievoorbeeldfacturen aangemaakt; alle test-Auth, RPC, Storage en databasehandelingen zijn lokaal geïsoleerd. Uitgaande externe browserverzoeken zijn geblokkeerd.

- Bestaande regressies: opslag/workouts/voeding/foto’s, rollen/sessies, doelen/pakketten, alle administratieonderdelen, zes canonical migrations, lost-response/retry, PT409, servercenten, annulering, deelcredits, historische PDF-bytes en opnieuw inloggen.
- Nieuwe PDF-matrix: Progressie met korting, twee regels, 9%, 0%, KOR, exclusief/procentkorting, ontbrekende optionele velden, lange klantgegevens, zeer lange omschrijving, gedeeltelijke credit, deelbetaling en groot bedrag. De 12 varianten hebben samen 15 A4-pagina’s. Ook de bestaande 65-regelfactuur met 6 pagina’s blijft volledig.
- Onafhankelijke PDF-inspectie: echte `%PDF-`-inhoud, exacte A4-maten, bedragen, volledige teksten, negatieve korting, paginanummers en tekst binnen de paginaranden. De PDF-generator laat de aangeleverde documentobjecten inhoudelijk identiek.
- Alle varianten zijn via Poppler daadwerkelijk naar PNG gerenderd en visueel bekeken; contactbladen en afzonderlijke pagina’s zijn lokaal bewaard. Eurotekens en gewone fonts renderen correct. Poppler meldde beschikbare fallbackfonts voor Symbol/ArialUnicode niet te vinden; de gebruikte Helvetica-/HelveticaBold-factuurteksten zijn wel volledig gerenderd en uitgelezen.
- Browser: 320×700, 390×844, 768×1024 en 1400×1000, licht én donker. Geen horizontale paginaoverloop, correcte A4-verhouding en witte PDF-canvassen. Vergroten/zoomen/verschuiven/sluiten geven nul extra serververzoeken. Sessieverloop verwijdert het extra PDF-venster en de privépreview.
- Na de correctie van de donkere balken is de gerichte browsertest opnieuw geslaagd, inclusief controle op ondoorzichtige achtergrondkleuren en nieuwe screenshots op alle acht scherm-/themacombinaties.
- Echte lokale PDF-download met `.pdf` en de native deel-API met `application/pdf`. De deel-API is in de test onderschept en afgebroken; er is niets verzonden. De download, herdownload en aan de deel-API aangeboden bytes zijn identiek. Het fysieke systeemdeelmenu en het echte telefoontoetsenbord blijven onderdeel van de ownercontrole.

Herhalen: `node --test --test-concurrency=1 tests/*.test.cjs`, daarna `python tests/hotfix-pdf-content.py` en `python tests/invoice-layout-content.py`. Render de fixture-PDF’s onder `tests/artifacts/invoice-layout` met Poppler vóór de visuele inspectie/contactbladen. Testvariabelen: `FMZ_LIVE_TESTS=0`, `FMZ_SKIP_CONTROL_MATRIX=0`.

## Behoud en herstel

Geen SQL, migration, productiehistory, rechten, Edge, Auth, financiële/memberdata of Storage gewijzigd. Geen echte factuur of e-mail verzonden. De zes SQL-hashes en canonical bestandsnamen zijn door de bestaande regressie gecontroleerd. Ook `supabase migration list --linked --project-ref hgoygcviutmynaihcvpd` toont alle zes local/remote versies gelijk. `supabase db push --linked --project-ref hgoygcviutmynaihcvpd --dry-run --skip-vault` geeft `upToDate: true`, `dryRun: true`, lege migrations/seeds/roles en **Remote database is up to date.** Er is niets toegepast.

Er is geen databaseherstel nodig voor deze visuele frontendrelease. Bij een weergaveprobleem kunnen alleen de drie genoemde runtimebestanden naar het vorige Git-startpunt worden teruggezet; nieuwere gegevens en bestaande PDF’s blijven behouden. Geen terugzetten van veilige toegangsrechten.

Staging, de losse website en AI-ontwikkeling zijn niet betrokken.

## Publicatie

Voorbereid; live verificatie en definitieve commit worden na publicatie hieronder vastgelegd. De gevraagde screenshots worden vóór de push aan de owner getoond. Onderhoud is voor deze compatibele visuele wijziging niet nodig.

## Korte telefoontest

Voorbeelden en gevraagde screenshots: [voorbeeldmap](examples/invoice-layout-20260913/README.md). Alle inhoud daarin is vast synthetisch en is geen uitgegeven productie-invoice.

1. Open Administratie → Verkoopfacturen → een **nieuw concept**, controleer je echte bedrijfsgegevens en bekijk de witte A4.
2. Controleer het logo links, bedrijfsgegevens rechts, klantblok, tabel, IBAN, totalen en footer. Progressie €380 en €30 korting hoort €350 te tonen.
3. Tik **PDF vergroten**, zoom, verschuif en sluit. Controleer licht/donker en bereikbaarheid met het toetsenbord open.
4. Gebruik alleen een factuur die je werkelijk wilt uitgeven voor **Definitief opslaan en PDF downloaden**. Open ook een bestaande definitieve PDF en download deze opnieuw: die houdt haar oorspronkelijke layout en bedragen.
5. Bekijk het systeemdeelmenu zonder onbedoeld te verzenden. Geef daarna aan of de nieuwe factuurtemplate visueel is geaccepteerd.
