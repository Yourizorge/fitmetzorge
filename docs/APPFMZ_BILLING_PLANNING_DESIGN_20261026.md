# Facturatieplanning — lokale implementatie

Status: lokale bouw en tests; dit document is geen productie- of mailbox-PASS. De gecombineerde release bepaalt toelating, uitrol en de uiteindelijke livecontrole.

## Bestaande keten behouden

De planning gebruikt `fmz_accounting.agreement_versions`, bestaande factuurrecords, `billing_period`, de periode-/overlaptrigger, de ownercontrole en de bestaande versie-/request-ID-beveiliging. Betalingen blijven berekend vanuit het grootboek. Voorbereiden maakt alleen een concept; geen factuurnummer, journaal, ontvangst of btw-boeking. Definitief maken en de originele PDF blijven de bestaande opslagroute gebruiken.

De historische afspraakversies blijven ongewijzigd. Kalendermaanden worden niet omgezet. De prospectieve catalogus leest de actieve `fmz_members.catalog_versions`; de eigenaar bevestigde voor nieuwe overeenkomsten Duo Progressie €500 en Duo Transformatie €660. Bestaande prijsafspraken blijven hun snapshot gebruiken.

## Nieuwe gegevens en API

Migration `20261026154917_appfmz_billing_planning.sql` voegt toe:

- `billing_plan_rules`: status, pauzedatums/einddatum, handmatige/automatische/uitgeschakelde verzending, versie, reden, actor en expliciete automatische toestemming.
- `billing_plan_tasks`: concrete serviceperiode, verzenddatum, overeenkomst- en bestaande factuurlink, status, versie, waarschuwing en reden.
- `billing_plan_reviews`: expliciete beoordeling van een bestaande factuur zonder bewezen serviceperiode; de bekeken factuurversie maakt een latere wijziging opnieuw controleplichtig.
- `billing_first_periods`: expliciet eerste bedrag/einddatum met reden; uitsluitend vóór planning, factuur en ondertekening. Geen automatische prorata.

Alle tabellen zijn privé, hebben RLS en geen directe anon/authenticated-toegang. Publieke security-invoker-wrappers delegeren naar private functies die de bestaande geverifieerde owner en actuele sessie controleren. De cronfunctie is niet rechtstreeks door leden of trainers uitvoerbaar. Zij gebruikt geen nagebootste JWT of gebruikerssessie.

`fmz_billing_planning_read()` leest de planning. `fmz_billing_planning_command(action,payload,request_id)` verwerkt expliciete wijzigingen en bewaart receipts/audit. `fmz_accounting.planning_tick(date,organization)` is de interne serverroute. De communicatiemigration roept deze aan vanuit de serverplanning en behandelt de push-/mailuitvoer afzonderlijk.

## Datums, eerste periode en bestaande documenten

Serviceperioden zijn DATE-waarden. Vandaag wordt in Europe/Amsterdam bepaald. Vier weken is altijd 28 dagen, ook rond zomer-/wintertijd. Standaard blijft de bestaande einddatum van de serviceperiode de factuur-/verzenddatum. Een expliciete planningsoverride herschrijft geen bestaande conceptvelden of definitief document.

De server maakt een horizon van 63 dagen zichtbaar en bereidt concepten vanaf zeven dagen vóór de datum. Historische eenmalige overeenkomsten worden niet achteraf automatisch gefactureerd. Bestaande eenmalige facturen kunnen expliciet aan een planningstaak worden gekoppeld.

Een oude factuur zonder vastgelegde serviceperiode blokkeert automatische extra facturatie voor dezelfde klant totdat de eigenaar haar beoordeelt. De factuurdatum wordt niet als bewijs van een serviceperiode gebruikt. De eigenaar kan de bestaande factuur aan de taak koppelen zonder het oude document te wijzigen, of met reden bevestigen dat zij bij een andere periode/prestatie hoort.

Een afwijkende eerste vierweekse periode kan expliciet worden verkort, waarna de volgende cyclus vanaf de daaropvolgende dag 28 dagen telt. Een kalendermaand behoudt haar maandgrens. De eerste prijs is een expliciet bedrag, geen gegokte deling. De gedeelde server- en browserperiodefunctie en de bestaande factuurkiezer gebruiken dezelfde uitzondering. Het instellen is geblokkeerd zodra er een planning, factuur of ondertekende overeenkomst bestaat. Nieuwe inschrijvingen gebruiken momenteel de standaardperiode; een afwijking moet deel worden van de ondertekende afspraak voordat deze route daarvoor mag worden gebruikt.

Herberekening biedt een gecontroleerd voorstel met subtotaal, korting, btw, totaal, versie en voorstelhash. De expliciete korting en extra regels blijven behouden. Een reden is verplicht. Een andere gebruiker of gewijzigde bron veroorzaakt PT409, zonder automatische overschrijving. Een creditfactuur geldt niet als ontvangen betaling.

## Schermen en bediening

`billing-planning-model.js`, `billing-planning-ui.js` en `billing-planning.css` zijn afgebakende frontendmodules. De parentintegratie voegt de pagina toe aan Administratie, verstrekt de bestaande invoice-/mailhooks en wist de module bij afmelden.

Filters: lid, pakket, betaalcyclus, serviceperiode, werkstatus, verzendstatus en betaalstatus. Een selectie toont de verschillen en waarschuwingen en laat ieder item afzonderlijk controleren. Definitief maken en verzendgoedkeuring verlopen via de bestaande factuur- en communicatievensters; dit is geen ongecontroleerde alles-of-niets-bulkboeking.

## Testbewijs en grenzen

`tests/billing-planning.test.cjs` controleert kalender-/28-dagenregels, zomer-/wintertijd, owner-/leden-/anonrechten, idempotentie, PT409, maandbehoud, geen nummer-/boekingswijziging, pauze/hervatten, handmatige datums, first-periodprijs in beide voorbereidingsroutes, blokkade bij ondertekend contract, herberekening en afzonderlijke eenmalige facturen.

`tests/billing-planning-ui.test.cjs` bedient echte lokale schermen met synthetische data in Edge en WebKit: filters, wijziging, verloren serverantwoord met dezelfde aanvraag-ID, pauze/hervatten, herladen en opnieuw aanmelden. Formaten 320, 390, 768, 844 en 1440 px, plus 200% tekstcontrole. Screenshots staan onder `tests/artifacts/billing-planning/`; dit is browseremulatie, geen fysieke telefoonproef. Een aanvullende foutproef vond en herstelde een retryprobleem. Een 200%-ronde vond een te breed gedeeld paginakopje; de gedeelde layout is gecorrigeerd. De volledige laatste browserhertest slaagt: één test met beide engines, 32,9 seconden. De model-/databaseronde slaagt met twee tests. Dit zijn drie geslaagde testgevallen met meerdere flowasserties, geen verzonnen telling van losse handelingen.

Geen productiegegevens, Auth, Storage of financiële historie zijn door deze subtaak gewijzigd. Productiemigration/dry-run, canary, behoudbewijs, werkelijke mailkoppeling, fysieke push en mailboxcontrole worden uitsluitend in het gecombineerde releaserapport als bewezen gemeld wanneer zij echt uitgevoerd zijn.

Aanvullende gerichte catalogusreproductie: een geïsoleerde database maakt vóór migrations16/17 twee oude duoafspraken met 52000/78000 cent. Na toepassing van de lokale uitbreidingen gebruiken nieuwe versies 50000/66000 cent uit de actieve leden-catalogus. De volledige historische afspraakrijen blijven gelijk. Deze test is geslaagd; een vermeende tweede catalogusbron bleek al door migration17 regels4–6 vervangen en vereiste geen nieuwe SQL-wijziging.


## Korting en ondertekende eersteperiode

De inschrijfroute kan vóór ondertekening een vaste korting voor de eerste N concrete perioden (1–130) en een expliciete eerste bruto-periodeprijs vastleggen. De catalogus-/afspraakprijs blijft intact. `billing_agreement_discounts` bewaart bedrag, duur, reden en actor; `billing_first_periods` bewaart eerste einddatum en bruto bedrag. De niet-publieke `fmz_members.attach_payment`-hook legt beide atomair vast tijdens afronding. Ondertekende, geplande of al gefactureerde afspraken kunnen niet via deze hook worden gewijzigd.

Een afwijkende eerste vierweekse periode duurt maximaal 28 dagen; de volgende periode begint de dag daarna en duurt 28 dagen. Kalendermaanden behouden hun maandultimo. De afwijkende eersteperiode telt als de eerste kortingsperiode. Er is geen verzonnen pro-rata-berekening. De handmatige en servervoorbereide concepten gebruiken dezelfde bruto-, kortings- en nettoprijs en bewaren de reden. Geen betaling, omzet of btw wordt door voorbereiding geboekt.

De gerichte synthetische DB-proef is geslaagd: eerste 14 dagen €190,01 minus €30,01 geeft €160,00; tweede 28 dagen €349,99; derde periode €380,00 wanneer de korting is verlopen. Een kalendermaandkorting vervalt exact na de afgesproken maand. RLS weigert directe ledentoegang; dubbele voorbereiding vindt dezelfde factuur terug; catalogussnapshot en journaaltelling blijven gelijk. De volledige inschrijfketen wordt aanvullend door de ledenproeven gecontroleerd.
