# Herstelpunt voor de besloten laptoptest

## Bewezen basis

Op 2 november 2026 is `309cb0db3569f14ac54442c8daec678020ba149a` zowel remote `main` als de laatste geslaagde GitHub Pages-build. Alle 88 onderzochte publieke runtimebestanden, assets, cursusbestanden en output-PDF's plus de rootalias komen byte voor byte overeen met de Git-blobs van die commit. De gewijzigde lokale werkbestanden zijn hiervoor niet als bron gebruikt. De nulmeting heeft 80.352.338 publieke bytes gecontroleerd; er zijn geen privé-PDF's gedownload.

Pages: `main`, publicatiemap `/`, legacy-build, domein `appfmz.nl`, HTTPS verplicht. De geauthenticeerde configuratie- en buildcontrole zijn HTTP 200; eerdere openbare HTTP 404-antwoorden blijven zichtbaar in het bewijs. Laatste build: 18 oktober 2026, commit hierboven. Run: https://github.com/Yourizorge/fitmetzorge/actions/runs/39115030390.

Productieproject `hgoygcviutmynaihcvpd` heeft twaalf migrations, exact gelijk aan de namen/versies in de herstelcommit, laatste `20261018073658_appfmz_vat_settlements.sql`. De nieuwe migrations 16/17/18 zijn niet toegepast. De vergelijking gebruikt de read-only Supabase-migration-API; dit is geen claim dat de CLI opnieuw is uitgevoerd.

Bewijsbestanden:

- `examples/owner-laptop-20261102/live-baseline.json`: hashes, bytegroottes, HTTP-statussen, broncommit, publicatie en configuratie zonder secrets.
- `examples/owner-laptop-20261102/source-baseline.json`: read-only remote HEAD, Pages-runs en migrationlijst.
- `examples/owner-laptop-20261102/data-aggregate-baseline.json`: nulmeting op 2026-11-02T14:00:58Z van twintig bestaande applicatietabellen, twee Auth-tabellen en twee Storage-metadatatabellen; uitsluitend aantallen en SHA-256-aggregaten.

De aggregaten zijn geen dump of herstelkopie en bewijzen niet de inhoud van privébestanden. De versleutelde herstelkopie van 26 oktober is historisch, niet een actuele back-up van 2 november. Er is geen klantinhoud geëxporteerd. Normaal gebruik kan na de meettijd legitiem wijzigingen veroorzaken; zo'n verschil moet worden onderzocht en mag niet blind worden teruggezet.

## Eerste eigenaarstest: geen productiemigration

De synthetische laptoptest hoort geen van de drie nieuwe migrations op productie nodig te hebben. Teststate, documenten, factuurconcepten en gesimuleerde verzending blijven aantoonbaar geïsoleerd. De bestaande productie-interface blijft actief. Alleen de geverifieerde eigenaar krijgt de nieuwe ingang. Gewone leden, andere trainers, echte e-mail, push en automatisch versturen blijven uit.

Voor het terugzetten van deze test: schakel de owner-testingang uit; publiceer zo nodig de bewezen herstelcommit opnieuw via de bestaande Pages-procedure. Geen database-down-migration, klantconversie of documentverwijdering. De hoofdagent heeft de hersteltag `appfmz-live-before-member-onboarding-20261102` en branch `backup/appfmz-pre-member-onboarding-20261102` vastgelegd. De annotated tag heeft object-SHA `eca9beea1577feb797f5188f17f46de3bfef4ee3` en peelt naar de herstelcommit. De branch wijst naar dezelfde commit. Alleen deze herstelbranch is daarna via de officiële GitHub-API vergrendeld: `lock_branch=true`, `enforce_admins=true`, `allow_force_pushes=false`, `allow_deletions=false`, `allow_fork_syncing=false`. PUT en onafhankelijke readback zijn beide HTTP 200; remote `main` bleef gelijk. Bewijs: `examples/owner-laptop-20261102/recovery-protection.json`. De herstelbranch blijft vergrendeld; een herstelpublicatie gebruikt de vastgelegde commit zonder deze branch te wijzigen. Zie [GitHub branch protection](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection).

## Plan per nog niet toegepaste migration

| Migration | Werkelijke impact | Niet-destructieve terugval bij een latere afzonderlijk goedgekeurde uitrol |
|---|---|---|
| `20261026154916_appfmz_members.sql` | Nieuwe leden-/concept-/overeenkomst-/consenttabellen, private bucket/policies en zoekindex; indexeert bestaande workspace-identiteiten in een aparte directory. Voegt tevens triggers toe op bestaande workspace en annotaties. | Nieuwe inschrijf-/profiel-/zoekroutes sluiten. Nieuwe definitieve overeenkomsten en bestanden behouden. Vooraf aantonen dat de oude workspace- en annotatieroutes blijven werken met de guards. Een frontendflag alleen schakelt databaseguards niet uit; daarom geen productie-uitrol zonder die compatibiliteitsproef. Geen nieuwe privacyguard verwijderen om oude onveilige toegang te herstellen. |
| `20261026154917_appfmz_billing_planning.sql` | Nieuwe planning-/eersteperiode-/kortingtabellen; vervangt daarnaast bestaande catalogus-, periode-, metadata-, command- en snapshotfuncties. | Planning uitschakelen; bestaande factuurafhandeling behouden. Oude frontend testen tegen de uitgebreide functies. Ondertekende nieuwe prijssnapshots, kortingen en eersteperioden blijven gelden. Geen oude SQL blind terugspelen: daarmee kunnen nieuwe geldige contractvoorwaarden verloren gaan. Eventuele noodzakelijke compatibiliteitscorrectie uitsluitend vooruitwerkend en na concrete beoordeling. |
| `20261026154918_appfmz_communication.sql` | Nieuwe outbox, bericht-/audit-/reminderstate en contracttrigger; maakt een cronjob die de standaard uitgeschakelde scheduler respecteert. | Eerst scheduler en transport uitschakelen. Alleen de eigen nieuwe dispatchjob stoppen indien nodig; bestaande agenda-reminders intact laten. Berichten/audit/bijlagen bewaren. Een onzekere SMTP-uitkomst niet opnieuw verzenden. Een later hervatte verzending vereist opnieuw actuele controle. Geen verwijdering van verzendhistorie of definitieve documenten. |

Deze migrations zijn uitbreidend, maar niet uitsluitend nieuwe ongebruikte tabellen: de genoemde bestaande functies en triggers zijn echte compatibiliteitsgrenzen. De aparte synthetische eigenaarstest voorkomt dat deze grenzen nu productie raken.

## Herhaalbare read-only controle

1. Vernieuw met de verbonden read-only GitHub- en Supabase-tools de remote `main`, laatste Pages-run en production migrationlijst in `source-baseline.json`.
2. Voer `node tests/verify-owner-test-baseline.cjs` uit. Dit leest vaste Git-blobs en publieke GET-antwoorden; nooit gewijzigde werkbestanden. De bestaande Git-aanmelding mag uitsluitend in procesgeheugen worden gebruikt voor de twee hosting-GETs.
3. Voor alleen vernieuwde hostingmetadata: `node tests/verify-owner-test-baseline.cjs --hosting-only`.
4. Voer `tests/owner-test-baseline-readonly.sql` uitsluitend read-only uit als een nieuwe databasis nodig is. Publiceer alleen de resulterende aggregaten; geen rijen, tokens, secrets of bankgegevens.
5. Vóór een herstelpublicatie: controleer actuele productieactiviteit en remote HEAD, werkende oude UI en behoud van sessies/onopgeslagen invoer. Publiceer de exacte bewezen frontendversie zonder schema- of gegevensreset; vergelijk daarna opnieuw alle openbare bestanden.

Een publieke HTTP-server kan niet bewijzen dat een willekeurig onbekend pad nergens bestaat. De controle dekt alle runtime-/asset-/outputpaden uit de bewezen Git-boom plus het actuele Pages-buildbewijs. Fysieke owneracceptatie en werking van de nieuwe geïsoleerde test zijn afzonderlijke controles.
