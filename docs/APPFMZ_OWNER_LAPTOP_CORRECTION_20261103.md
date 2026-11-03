# APPFMZ — gerichte correctie van de afgeschermde owner-laptoptest

Deze release is uitsluitend voor de geïsoleerde eigenaarstest. De gewone APPFMZ en bestaande klantgegevens worden niet uitgebreid of omgezet. Fysieke owneracceptatie is nog niet uitgevoerd. De gerichte technische toelating is geslaagd. De actuele publicatiebevestiging wordt aansluitend vastgelegd in de bronbranch, zonder gewone-appbestanden te vervangen.

## Wat is veranderd

- Dashboard met vier rustige kaarten: Vandaag, Snel starten, Overzicht en Komende agenda. De linker navigatie, ledenzoekbalk, officiële logo en themaschakelaar blijven. Geen volledige ledenlijst, geselecteerd profiel of individuele factuurherinneringen op het Dashboard.
- Nieuwe synthetische vierweekse overeenkomsten sluiten aan op één configureerbare cyclus. Het kostenoverzicht verklaart de gedeeltelijke eerste periode vóór ondertekening. De snapshot bewaart de gebruikte cyclusversie en berekening.
- Agenda toont per gezamenlijke cyclus precies **Facturen maken** en **Facturen versturen**. Deelnemers en bedragen worden actueel berekend, zonder afzonderlijke agenda-items per lid. Beide taken hebben een eigen voltooidstatus; een gemiste taak blijft achterstallig zichtbaar.
- Licht en donker werken in de testschermen en de buitenrand van de documentviewer. De handmatige keuze wordt lokaal per geverifieerde eigenaar bewaard en gaat vóór het systeemthema. De voorkeur wordt vóór het eerste testscherm toegepast. Opgeslagen PDF-bytes veranderen niet door een themawissel.
- Een gerichte testgids met veertien stappen vervangt de huidige route. Eerdere gidsvoortgang wordt behouden als vorige route. De gids staat standaard dicht om het Dashboard rustig te houden.

## Synthetische cyclus en rekenregel

Testbasis: **2 november 2026**, tijdzone **Europe/Amsterdam**. Eerste periode: 2 t/m 29 november; gezamenlijke factuurdatum: **30 november**. Vervolgdatums: **28 december 2026** en **25 januari 2027**. Dit is uitsluitend een voorbeeldanker; geen productiedatum is afgeleid of ingesteld.

Berekening: `normaal bedrag in centen × resterende kalenderdagen ÷ 28`. Alleen het eindbedrag wordt afgerond op centen, met half-up. Kalenderdagen worden onafhankelijk van uren en zomer-/wintertijd geteld. Een deelbedrag is geen korting.

| Start na cyclusbegin | Startdatum | Dagen | Eerste bedrag bij €380 | Factuurdatum |
|---|---|---:|---:|---|
| 0 dagen | 2 november | 28 | €380,00 | 30 november |
| 7 dagen | 9 november | 21 | €285,00 | 30 november |
| 14 dagen | 16 november | 14 | €190,00 | 30 november |
| 21 dagen | 23 november | 7 | €95,00 | 30 november |
| 27 dagen | 29 november | 1 | €13,57 | 30 november |
| 28 dagen | 30 november | 28 | €380,00 | 28 december |

De volgende volledige periode bedraagt €380. Trainingsaantallen, credits en afspraken worden niet naar rato aangepast. Een ongeldige startdatum of een start vóór de synthetische testbasis blokkeert ondertekening met een begrijpelijke melding; ingevoerde gegevens blijven staan. Na een beoordeelde overeenkomstsnapshot kan de configuratie niet stilzwijgend worden gewijzigd.

## Precies twee algemene taken

| Periode | Facturen maken | Facturen versturen |
|---|---|---|
| 2–29 november 2026 | 23 november 2026 | 30 november 2026 |
| 30 november–27 december 2026 | 21 december 2026 | 28 december 2026 |
| 28 december 2026–24 januari 2027 | 18 januari 2027 | 25 januari 2027 |

De taakidentiteit hangt aan cyclus en soort, niet aan een individueel lid. Een later toegevoegd lid verschijnt in de bestaande taak zonder een derde item of het heropenen van een voltooide taak. De link opent de bestaande handmatige Facturen-pagina. Bekijken, afronden en herladen maken geen factuur, factuurconcept, e-mail, betaling of betaaldstatus aan.

Bestaande synthetische maandafspraken en eigen vierweekse afspraken worden alleen in een overstapvoorbeeld getoond: huidige en voorgestelde perioden, drie toekomstige factuurdatums, eerste deelbedrag en de eventuele noodzaak van een contractwijziging. Er is geen omzettingsactie. Patrick, Debora en andere echte leden blijven onaangeraakt.

## Afbakening en resterende keuzes

De test blijft in een opaque iframe met `connect-src 'none'`, synthetische lokale PGlite-data en een afzonderlijk checkpoint. Alleen de bestaande beperkte hostbruggen voor lokale opslag, PDF en camera zijn beschikbaar. Themaopslag bevat uitsluitend een versie en `light`/`dark`, gekoppeld aan de reeds geverifieerde eigenaar; geen browservoorkeur wordt in de productieadministratie geschreven.

De exacte synthetische verwijderlijst omvat ook de testcyclusconfiguratie. Lokale testrecords en tijdelijke browserprofielen worden na geautomatiseerde controle opgeruimd. Gesaneerde screenshots, test-PDF's en bewijzen blijven als rapportbijlagen bestaan. Er worden geen productie-testaccounts of -bestanden gemaakt.

Vóór een afzonderlijke productieopdracht blijven drie zakelijke keuzes open:

1. De werkelijke gezamenlijke basisdatum en factuurgrens bevestigen.
2. Per bestaande overeenkomst besluiten óf en hoe een overstap contractueel wordt vastgelegd.
3. Bepalen hoeveel trainingen/credits bij een gebroken eerste periode horen; deze release verandert dat aantal niet.

Geen productiemigration, Edge-deployment, Auth-/Storage-write, echte agenda- of financiële mutatie. Staging touched: **NO**. Bedrijfswebsite touched: **NO**. JARVIS touched: **NO**.

## Controlebewijs

De gerichte modellen controleren alle 29 startposities van dag 0 t/m de volgende cyclusgrens, half-centafronding, jaarwisseling en zomer-/wintertijd. De lokale adaptertest controleert echte conceptbeoordeling, PDF-generatie, opslag/verificatie en afronding in de synthetische database. De nieuwe eerste periode bedraagt 19000 cent; de volgende volledige periode 38000 cent. Herhalen van afronding geeft dezelfde inschrijving. De bestaande financiële snapshot blijft gelijk, afgezien van de bewust aangemaakte ene synthetische overeenkomst. Er ontstaan geen facturen, e-mails of betalingen.

[Rekenbewijs](examples/owner-laptop-correction-20261103/billing-cycle-model.json), [adapter en verwijderlijst](examples/owner-laptop-correction-20261103/billing-cycle-adapter.json), [lokale regressies en historische PDF-bytevergelijking](examples/owner-laptop-correction-20261103/local-regression.json), [Dashboardmodel](examples/owner-laptop-correction-20261103/dashboard-model.json), [contrastpaletten](examples/owner-laptop-correction-20261103/theme-contrast.json), [logobron en merkcontrast](examples/owner-laptop-correction-20261103/brand-provenance-contrast.json).

Contrast wordt niet alleen op kleurcodes gecontroleerd: de browsercontrole meet ook gerenderde tekst, formulierwaarden, placeholders, gedeactiveerde knoppen, meldingen en PDF-viewerbediening. De oude vaste kleuren van actieve en inactieve trainingsdagen zijn in de owner-test gecorrigeerd. De normale-tekstdrempel is minimaal 4,5:1; logo-afbeeldingen en de onveranderlijke PDF-inhoud zijn geen thematische tekstkleuren.

Bij de behoudcontrole is ook een oude, nog niet definitieve inschrijfbeoordeling afgevangen: zonder cyclusversie in de snapshot moet de trainer opnieuw pakket, kosten en handtekening controleren. De adapter weigert directe afronding van zo'n oude beoordeling. Bestaande definitieve contracten blijven onveranderlijk en hun idempotente herhaling blijft geldig.

De volledige Edge/Chrome-themacontrole draaide vóór deze laatste gerichte hervatbeveiliging. De stijlen, thema- en hostmodules zijn byte-identiek gebleven. Een exacte inverse patch reconstrueert het eerder geteste runtimebestand: [delta en hashes](examples/owner-laptop-correction-20261103/theme-runtime-delta.json). De gerichte inschrijfcontrole test de hervatbeveiliging op runtime `be9448c5…`. Daarna is uitsluitend één gidszin aangepast van de verstreken startdatum 2 november naar de volgende grens 30 november; alle applicatiescripts en stijlen bleven gelijk. [Exacte instructiedelta](examples/owner-laptop-correction-20261103/instruction-runtime-delta.json). Zo wordt een eerdere browserrun niet ten onrechte als run op de laatste hash gepresenteerd en wordt de brede themacontrole niet onnodig herhaald.

### Gevraagde schermbeelden

Alle onderstaande personen en bedragen zijn synthetisch. Dit zijn browseropnamen, geen fysieke laptop- of telefoontest.

| Controle | Screenshot |
|---|---|
| Dashboard donker | [Donker](images/owner-laptop-correction-20261103/edge-dashboard-dark-100.png) |
| Dashboard licht | [Licht](images/owner-laptop-correction-20261103/edge-dashboard-light-100.png) |
| Facturen maken | [Voorbereiding](images/owner-laptop-correction-20261103/edge-facturen-maken.png) |
| Facturen versturen | [Verzendtaak](images/owner-laptop-correction-20261103/edge-facturen-versturen.png) |
| Drie toekomstige cycli | [Cycli](images/owner-laptop-correction-20261103/edge-three-central-cycles.png) |
| Volledig vierwekenbedrag | [€380](examples/owner-laptop-correction-20261103/enrollment-full-cycle-edge.png) |
| Halverwege instromen | [€190](examples/owner-laptop-correction-20261103/enrollment-half-cycle-edge.png) |
| Kostenberekening | [Zichtbare formule](examples/owner-laptop-correction-20261103/enrollment-half-cycle-edge.png) |
| Ledenprofiel licht | [Profiel](images/owner-laptop-correction-20261103/edge-profile-light.png) |
| Facturenpagina licht | [Facturen](images/owner-laptop-correction-20261103/edge-invoice-light.png) |

## Korte fysieke laptoptest

Open als eigenaar [de afgeschermde test](https://appfmz.nl/?owner-test=1&retest=20261103-correction) zodra de publicatie hieronder is bevestigd. Controleer TESTMODUS, het rustige Dashboard en licht/donker. Kies Progressie met start 16 november 2026 en controleer €380 × 14 ÷ 28 = €190. Bekijk de twee agendataken en rond alleen Facturen maken af. Controleer dat Facturen versturen open blijft. Doorloop de overige gerichte gidsstappen en sluit af met de synthetische verwijderlijst. Browserautomatisering is geen fysieke laptoptest en geen owneracceptatie.

## Geslaagde technische toelating

**16 unieke lokale tests, vier browserflows en zestien native zoomgevallen** slagen. Edge 155.0.4283.62 en Chrome 156.0.8078.80; Windows-browserautomatisering. Daarbovenop zijn acht profiel-/facturencaptures genomen nadat schermanimaties volledig waren afgelopen. Minimaal gemeten tekstcontrast: **5,33:1**. De drie toekomstige cycli zijn binnen één opname zichtbaar gecontroleerd.

[Testmatrix](examples/owner-laptop-correction-20261103/test-matrix-summary.json), [cleanup met exacte verwijderlijsten](examples/owner-laptop-correction-20261103/cleanup-summary.json), [kalendercontrole](examples/owner-laptop-correction-20261103/dashboard-calendar-edge.json), [inschrijving en PDF](examples/owner-laptop-correction-20261103/billing-cycle-edge.json), [drie zichtbare cycli](examples/owner-laptop-correction-20261103/3cycles-capture.json), [nulmeting](examples/owner-laptop-correction-20261103/baseline.json).

Definitieve runtime SHA-256: `3ad658dc51c94d8b58585f9dece12c0855d46632c739ae896a42ef3bacae01bd`. Host SHA-256: `62aeff2907603c2b5a725c19585a20f3fafdda34dca5a8af4424e422d04379f5`.

De aansluitende live ontvangstbevestiging en remote HEAD zijn te vinden in [het actuele rapport op de bronbranch](https://github.com/Yourizorge/fitmetzorge/blob/codex/members-billing-20261026/docs/APPFMZ_OWNER_LAPTOP_CORRECTION_20261103.md). Deze bronbranch wordt niet naar main samengevoegd.
