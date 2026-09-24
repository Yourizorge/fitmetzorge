# APPFMZ — kalendermaand en vier weken

Status: getest en voorbereid voor gecontroleerde publicatie. Productie- en publicatiebewijs wordt na uitvoering hieronder toegevoegd. Scope: `Yourizorge/fitmetzorge`, `appfmz.nl`, Supabase `hgoygcviutmynaihcvpd`. Baseline `e42639fe840fddc61de50b77d3f7648cb1d538a2`.

## Gedrag

- Bestaande maandafspraken blijven kalendermaand. De owner heeft twee maandklanten expliciet bevestigd en de derde bestaande pakketkoppeling uitgesloten van pakketfacturen. De precieze gecontroleerde klantmapping blijft buiten Git.
- Nieuwe klantafspraken beginnen in de editor standaard op vier weken. De owner bevestigt pakket, bedrag, betaalperiode en ingangsdatum; typen maakt geen overeenkomst of factuur definitief.
- Basis €200, Progressie €380, Transformatie €480, online €200; bij beide cycli dezelfde bedragen inclusief btw. Duo €260/€520/€780 behoudt de bestaande pakketbetekenis, zonder vermenigvuldiging of verdeling per persoon. Losse training €55 en tienrittenkaart €520 zijn eenmalig.
- Kalendermaanden lopen van de eerste t/m de laatste dag, met factuurdatum standaard aan het eind. Vier weken is exact 28 dagen, aansluitend en zonder reset op 1 januari. De gebruikelijke toelichting noemt 13 betaalperiodes per jaar; de berekening gebruikt steeds 28 dagen, nooit 365/13 of gemiddelde kalenderweken.
- Een pakket- of cycluswijziging voegt een versie toe met expliciete ingangsdatum. Bestaande versies blijven staan. Bij terugkerende afspraken moet die datum aansluiten op een volledige oude periode; een kalendermaand begint op de eerste. Er wordt geen verkorte periode of ongegeven prorata-prijs verzonnen.
- Klanten en factuurschermen tonen pakket, bedrag, cyclus, ingangsdatum, serviceperiode, volgende factuurdatum en factuurstatus. Het oude pakketveld bij doelen is voor de owner vervangen door de expliciete afspraakeditor; doelen blijven automatisch opslaan.
- Pakketfacturen worden alleen op aanvraag als concept voorbereid. De server bepaalt de serviceperiode en gebruikt een unieke klant/periodecombinatie met de onveranderlijke afspraakversie in de factuur. Een herhaalde aanvraag retourneert hetzelfde concept of dezelfde definitieve factuur.
- Een oud concept of een oude factuur zonder serviceperiode blokkeert automatisch een extra periodeconcept. De owner kan bewust een bestaand concept koppelen; eigen invoer, bedrag en korting blijven behouden. Een oude definitieve factuur wordt nooit geconverteerd.
- De bestaande A4-opmaak blijft behouden. Nieuwe periodefacturen tonen cyclus en exacte datums. Bedragen, korting, btw en creditafronding blijven op centen werken. De definitieve PDF wordt privé gearchiveerd; later downloaden leest dezelfde bytes.

## Bestanden en databaseobjecten

Nieuw: `billing-periods.js` (datumregels/catalogus), `billing-ui.js` (ownereditor), gerichte tests en verificatiescripts. Aangepast: `app.js`, `index.html`, `accounting.js`, `invoice-editor.js`, `invoice-documents.js` en bestaande testfixtures. `sync.js`, `autosave.js`, `photos.js`, stijlen, Edge Functions en cursusbestanden blijven ongewijzigd.

Nieuwe migration: `supabase/migrations/20260924133305_appfmz_billing_periods.sql`.

- Toevoeging `fmz_accounting.agreement_versions`, constraints/index en RLS zonder directe toegang voor anon/authenticated.
- Interne functies voor catalogus, periode, metadata, gecontroleerde eenmalige registratie en factuurvalidatie. De factuurtrigger beschermt de gekoppelde periode en het definitieve document.
- Nieuwe owner-RPC `public.fmz_billing_command`, met bestaande geverifieerde owner-/sessiecontrole, transactionele serialisatie, receipts en PT409.
- De bestaande `snapshot()` krijgt alleen een extra `agreements`-veld. De oorspronkelijke opslag-, factuur-, boekings-, Auth- en Storagefuncties worden niet vervangen.
- Geen UPDATE/DELETE van bestaande klanten, financiële records of PDF's in de migration. Geen oude migration herhalen, `migration repair`, reset, seed of Vault-wijziging.

## Nulmeting en herstel

Vóór productie-aanpassing is een versleutelde volledige APPFMZ-checkpoint gemaakt buiten Git en OneDrive, inclusief financiële tabellen, schema-/functie-/rechteninventaris, Auth, embedded foto's en private Storage. De ciphertext/HMAC en de ene bestaande private PDF zijn teruggelezen en geverifieerd. De nulmeting bevat SHA-256-aggregaten voor 17 bestaande tabellen; klantinhoud en sleutels staan niet in dit rapport.

De herhaalde read-only controle vóór onze migration vond twee nieuw toegevoegde, lege Supabase-platformkolommen op `storage.buckets`: `lifecycle_configuration` en `lifecycle_configuration_generation`. Het volledige oude veldenset is afzonderlijk gehasht en exact gelijk aan de checkpoint. Alle 16 andere tabellen en alle bestaande functies bleven exact gelijk. [Het platformbewijs](APPFMZ_BILLING_STORAGE_PLATFORM_20260924.json) bewaart beide hashes; deze platformtoevoeging wordt niet ten onrechte als een APPFMZ-schemawijziging of als dataverlies gerapporteerd.

Herstel is uitsluitend met een synthetische export uitgevoerd in een geïsoleerde database: 3 afspraakversies, 18 records, 12 journaalposten, 30 regels, 38 auditregels en 5 originele bestanden exact hersteld; journaal in balans en ownerlezing geslaagd. Er zijn geen echte klantgegevens in een testdatabase hersteld.

Terugval: bij een migrationfout rolt de transactie terug en wordt de frontend niet gepubliceerd. Na een geslaagde toevoeging kunnen de nieuwe tabellen/versies veilig blijven staan; herstel zo nodig de vorige frontend vanuit de baseline en stop het aanmaken van pakketfacturen tot controle. Bestaande factuur/PDF-opslag blijft bruikbaar. Geen historie terugzetten, tabellen verwijderen of rechten versoepelen. De privé-checkpoint is beschikbaar voor gerichte reconstructie indien ooit nodig.

## Tests

De volledige regressieset omvat 31 tests, waaronder opslag, privacy, workouts, voeding, foto's, factuurcenten, financiële correcties, mobiele controls en alle 27 cursuslessen. De eerste volledige ronde had 29 PASS en twee tests die nog de oude factuurknopvolgorde gebruikten; beide zijn bijgewerkt en slagen in de gerichte herhaling. De aanvullende test voor het expliciet koppelen van een oud concept is daarna afzonderlijk geslaagd, inclusief invullen van nog ontbrekende verplichte factuurvelden.

Nieuwe controles: maandlengtes 28/29/30/31, 28 opeenvolgende vierwekencycli over jaargrenzen, expliciete versies, maand/four-weeks-keuze, uitsluiting, behouden oud concept, korting en btw, deel-/restcredit, annulering, dubbele aanvraag, verloren antwoord met dezelfde request-ID, PT409 zonder herhaallus, re-login, byte-identieke private PDF en mobiel/desktop. Browsercontrole op 320/390/768/1400px en beide bestaande thema's; verborgen native selecties en A4-vergroten worden echt bediend.

De nieuwe A4-voorbeelden zijn gerenderd en visueel gecontroleerd. Productie-API- en livebrowserresultaten worden na uitvoering toegevoegd; deze voorbereiding claimt die nog niet.

Vaste synthetische voorbeelden: [vier weken](examples/billing-20260924/vier-weken.pdf), [kalendermaand](examples/billing-20260924/kalendermaand.pdf), [mobiele afspraakeditor](examples/billing-20260924/afspraak-mobiel.png). De laatste browserherhaling na het vastzetten van de serviceperiode is eveneens PASS. Er staan geen echte klantgegevens in deze voorbeelden.

## Publicatiebewijs

Nog in uitvoering. Alleen de nieuwe migration mag pending zijn. Na toepassing moeten alle zeven lokale/productieversies gelijk zijn en moet `db push --dry-run --skip-vault` leeg zijn. Productie wordt getest met vier nieuw aangemaakte synthetische accounts, zonder e-mail. Alleen hun eigen tijdelijke administratie, PDF's en Authaccounts worden opgeruimd.

## Korte telefoontest

1. Open APPFMZ opnieuw en ga bij een maandklant naar **Klantafspraak / betaalperiode**: controleer kalendermaand, bestaand bedrag en de serviceperiode. De uitgesloten klant mag geen pakketvoorstel krijgen.
2. Open bij Verkoop een pakketconcept voor de gewenste maand; controleer de periode, korting en A4-preview. Bij een oud concept zonder periode eerst bewust dat concept kiezen. Sla alleen definitief op als je de echte factuur wilt uitgeven.
3. Bij de volgende nieuwe klant: controleer de standaard **Vier weken**, kies de ingangsdatum en bevestig de samenvatting. Controleer dat de PDF exact 28 dagen toont.
4. Open een bestaande definitieve PDF na uitloggen/inloggen opnieuw. Owneracceptatie volgt pas na jouw fysieke controle.

Website, staging en AI-ontwikkeling vallen buiten deze release en worden niet gewijzigd.
