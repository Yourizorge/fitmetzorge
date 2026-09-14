# APPFMZ beginnerscursus en geïsoleerde oefenmodus

Owneracceptatie: **pending**. De owner moet deze cursus nog zelf volledig doorlopen. De bestaande factuurlay-out blijft eveneens pending visuele owneracceptatie; de factuurtemplate en eerdere PDF’s zijn niet aangepast.

## Scope en basis

Uitsluitend `Yourizorge/fitmetzorge`, branch `main`, `https://appfmz.nl`. Lokale en opgehaalde remote basis: `624eeedacfa045b7a3fb1a2251cf0f4a71ada1fd`. Er zijn geen nieuwere wijzigingen overschreven. Geen wijzigingen aan staging, AI of de losse website.

De owner heeft implementatie, tests, documentatie, commit, push en productiepublicatie van deze cursus toegestaan. De toevoeging gebruikt geen databasewijziging, migration, Edge-update of betaald product. Onderhoud is niet nodig: de bestaande opslagketen en rechten wijzigen niet.

## Wat de owner krijgt

- Administratie rechtsboven: **Uitleg & oefenen**. Alle negen administratieonderdelen hebben een **?** met korte uitleg, voorbeeld, leskoppeling en relevante officiële bronnen.
- Startkeuzes: beginnerscursus, los onderwerp en oefenen. Voortgang, hervatten, opnieuw beginnen en de PDF-handleiding zijn beschikbaar.
- 26 lessen plus een afrondingstoets met twaalf handelingen. Iedere les bevat de elf gevraagde onderdelen, een interactieve oefening en twee controlevragen. Overslaan levert geen voltooiingsvinkje op.
- Zoekbare begrippenlijst en vier lokale werklijsten: week, maand, kwartaal en jaar.
- Oefenbank, facturen, betaling en deelbetalingen, bonnen, privé, CSV met duplicaat, saldovergelijking, annulering, credits, btw en lokale PDF/ZIP-downloads.
- PDF-handleiding uit dezelfde `tutorial/content.js` en oefenbeschrijvingen in `tutorial/model.js`, met inhoudsopgave, screenshots, lessen, begrippen, checklists en officiële bronnen.

Begin via [de cursus](https://appfmz.nl/tutorial.html), of binnen Administratie. De [handleiding](https://appfmz.nl/output/pdf/APPFMZ-boekhouden-voor-beginners.pdf) bevat dezelfde uitleg.

## Technische scheiding

De oefeningen draaien in een iframe met uitsluitend `sandbox="allow-scripts allow-downloads"`. Zonder `allow-same-origin` krijgt dit document een opaque origin en geen toegang tot ouder-DOM, sessie, cookies of localStorage. `allow-forms`, popups en topnavigatie zijn niet toegestaan. Oefenknoppen verwerken formulieren via lokale JavaScript-handlers; zij verzenden geen formulier.

De iframe-CSP blokkeert verbindingen (`connect-src 'none'`), workers, onderliggende frames, objecten en form actions. De cursus laadt geen Supabase SDK, configuratie, hoofdapp, synchronisatiecode of boekhoudcontroller. De bestaande pure reken-/PDF-code heeft geen credentials of mutatie-interface. PDF.js draait met de bestaande lokale parser in een loopback worker; daarvoor zijn reproduceerbare classic-script-wrappers toegevoegd. De bestaande upstreambestanden blijven ongewijzigd.

De parent-bridge valideert de iframe-bron, opaque origin en een willekeurige kanaalnonce. Alleen begrensde lesnummers en checklist-ID’s mogen naar `fmz-course-progress-v1`. Vrije tekst, bedragen, bankgegevens, documenten, antwoorden en oefengebeurtenissen worden niet persistent opgeslagen. Andere berichten voor commands, uploads, e-mail of navigatie worden genegeerd. Bronlinks komen uitsluitend uit een vaste lijst. De handleiding heeft een vast publiek downloadpad.

Sluiten verwijdert het iframe en de tijdelijke state. De bestaande account-/sessielock sluit ook een geopend cursusvenster. Er is geen kopieerroute naar de echte administratie. Bij hervatten begint een oefening opnieuw; alleen lesvoortgang en taakvinkjes kunnen blijven bestaan. Bij geblokkeerde lokale opslag verschijnt een melding zonder herstelbelofte.

Alle oefen-PDF’s hebben op iedere pagina **OEFENFACTUUR — NIET GELDIG**. PDF’s en ZIP worden als lokale Blobs gegenereerd, zonder private Storage. De originele oefenfactuur en eventuele credit zijn afzonderlijke documenten. Opnieuw downloaden gebruikt dezelfde vastgelegde PDF-bytes binnen de oefensessie.

Het bestand kiezen accepteert alleen de exacte vaste synthetische CSV. Afwijkende bestanden worden geweigerd, niet verstuurd of geïmporteerd; het bestandsveld wordt leeggemaakt. Het vaste bestand bevat vijf unieke bron-ID’s en één herhaling. Dezelfde bron-ID’s worden ook gebruikt voor eerder handmatig verwerkte oefenbetalingen, zodat de toets geen dubbele ontvangst maakt.

## Inhoudelijke uitgangspunten

Officiële inhoudscontrole: **14 september 2026**. De bronnen en datum staan bij relevante lessen en in de handleiding. Iedere fiscale bronsectie meldt: **Dit is algemene uitleg en geen persoonlijk fiscaal advies.**

Bronnen: Belastingdienst over administratie, factuureisen, bewaring, privébewegingen, btw-stelsels, voorbelasting, aangiftetijdvak, nihil-aangifte, indiening, zakelijke kosten, bedrijfsmiddelen en inkomstenbelasting. ING: actuele formatenpagina met puntkommagescheiden CSV voor Mijn ING Zakelijk; algemene downloadroute en aparte boekhoudkoppeling. De volledige gecontroleerde links staan in `tutorial/content.js`. De ING-route vermeldt dat knoppen kunnen veranderen en vraagt nooit bankinloggegevens in APPFMZ.

De cursus kiest geen btw-instelling voor de owner. **21% en factuurstelsel zijn uitsluitend een vooraf gekozen fictieve rekensituatie**. De echte bevestigde instelling blijft ongewijzigd. Een btw-overzicht is voorbereiding; aangifte indienen en betalen zijn aparte handelingen buiten APPFMZ.

De uitleg is afgestemd op werkelijk aanwezige schermen. Er zijn bijvoorbeeld geen aparte huidige instelvelden voor handelsnaam, BIC, rekeninghouder, nummerreeks of boekjaar. De cursus licht deze begrippen toe zonder te suggereren dat die instellingen in de echte app kunnen worden aangepast. APPFMZ vraagt bij een openingssaldo de eerste transactiedag; het saldo hoort bij het einde van de vorige dag.

Rekencontroles: maandpakketten €200/€380/€480; Progressie €380 − €30 = €350. Opening €0,20 plus vijf unieke transacties resulteert in €216,21. Het bewust ontbrekende bedrag veroorzaakt €9,99 verschil; na gericht herstel is het verschil €0. Een credit van €100 op de betaalde €350-factuur laat €100 terug te betalen zien zonder een bankterugbetaling te verzinnen. De centenverdeling volgt de bestaande cumulatieve afronding op het tarief, zonder oorspronkelijke factuurdata te wijzigen.

## Reproduceerbare tests

Alle tests gebruiken lokale synthetische fixtures. Geen echte uitnodigingen, facturen, bankbestanden of klantgegevens worden tijdens de oefentests gebruikt.

```powershell
$env:FMZ_LIVE_TESTS='0'
$env:FMZ_SKIP_CONTROL_MATRIX='0'
node --test --test-concurrency=1 'tests/*.test.cjs'
node tests/build-tutorial-pdfjs.cjs
node tests/build-tutorial-handbook.cjs
```

`build-tutorial-handbook.cjs` gebruikt de schermbeelden die `tutorial-isolation.test.cjs` genereert, ReportLab en de in het script beschreven Python-runtime. De PDF wordt met Poppler gerenderd en visueel gecontroleerd. Bron- en uitvoerhashes staan in `tutorial/handbook-manifest.json`; de parserwrappers hebben een eigen manifest en Apache-licentie.

De nieuwe tests omvatten alle lessen en oefenstappen, verkeerde invoer, herstel, quizzen, vooruit/terug, overslaan, reset, hervatten, focus en onvolledige bedragen, checklistvinkjes, helpiconen, lokale-opslagfout, PDF-fout en opnieuw proberen, identieke herdownload, synthetische CSV en duplicaten, credits, ZIP en handleiding. Schermformaten: 320×700, 390×844, 768×1024 en 1400×1000, telkens licht/donker. Dit zijn browsertests en viewportemulatie, geen vervanging voor de fysieke telefoontest van de owner.

De isolatietest probeert oudertoegang, cookies, localStorage, boekhoudcommands, fetch-upload en vervalste bridgeberichten. Alle financiële, member-, Auth-, Storage- en audittabellen van de lokale fixture worden vóór/na gehasht. Geen verschil, geen RPC tijdens hulp/oefenen en geen Storage-Blob mag ontstaan. Er wordt ook gecontroleerd dat een accountlock het iframe verwijdert.

## Productiecontrole en herstelpad

Read-only productieproject: `hgoygcviutmynaihcvpd`. `supabase migration list --linked --project-ref hgoygcviutmynaihcvpd` toont zes gelijke local/remote versies. `supabase db push --linked --project-ref hgoygcviutmynaihcvpd --dry-run --skip-vault` meldt up-to-date met lege migrations, seeds en roles. Er wordt geen migration toegepast en geen history aangepast.

Een vergelijking vóór/na publicatie gebruikt uitsluitend geaggregeerde hashes van 17 relevante tabellen en een catalogushash van functies, policies, schema’s, tabellen, kolommen, rechten, constraints, indexes en triggers. De private bewijsbestanden blijven buiten Git. Geen klantinhoud of secrets worden naar GitHub gebracht.

De bestaande runtime blijft identiek behalve `index.html` (laden van cursushulp) en `accounting.js` (knoppen en sluiten bij sessielock). `app.js`, `sync.js`, factuurtemplate, bestaande PDF-code, database- en Edge-bestanden blijven inhoudelijk ongewijzigd. `verify-tutorial-assets.cjs` vergelijkt de gepushte Git-bytes met publieke live GET-responses, inclusief de PDF-MIME.

Bij een frontendregressie kan uitsluitend de toevoeging van de cursus en zijn entrypoints worden teruggedraaid naar de bovenstaande basis. Er is geen dataterugzetting, SQL-replay of herstel van oude rechten nodig. Productiegegevens zijn geen onderdeel van deze release.

## Korte telefoontest voor de owner

1. Open Administratie → **Uitleg & oefenen** → **Beginnerscursus starten**.
2. Probeer les 1, geef bewust een fout antwoord, verbeter het en rond oefening plus vragen af.
3. Sluit en hervat. Controleer dat je voortgang terugkomt en dat de voorbeeldbedragen opnieuw beginnen.
4. Probeer een factuurvoorbeeld, de PDF-zoom/download en de CSV-oefening. Kijk ook naar Begrippen en Mijn boekhoudtaken.
5. Ga terug naar je echte administratie en controleer dat daar je bestaande gegevens staan. Doorloop daarna rustig de overige lessen en de afrondingstoets.

De cursus blijft **pending owneracceptatie** totdat de owner hem zelf volledig heeft doorlopen.

## Definitieve verificatie

- Volledige lokale regressieronde: **28 tests geslaagd, 0 mislukt, 0 overgeslagen**. Dit omvat alle bestaande regressies en de nieuwe cursuscontroles.
- Na de laatste presentatiedetails: gerichte hercontrole **5 tests geslaagd**, inclusief opnieuw alle 27 lessen / **61 oefenhandelingen** en afzonderlijke credit-PDF’s.
- Handleiding: **75 A4-pagina’s**, alle gerenderde pagina’s visueel beoordeeld, tekst binnen paginagrenzen en 65 PDF-hyperlinks. Alle oefen-PDF’s en de PDF’s in de ZIP hebben het watermerk op iedere pagina.
- De lokale isolatietest bewijst ongewijzigde fixturetabellen, nul mutatie-RPC’s, nul Storage-uploads en vernietiging van de oefencontext bij accountlock. Alle negen helpdialogen zijn ook op smalle schermen gecontroleerd.
- Productiemigrationlijst: zes gelijke local/remote versies. Dry-run met `--skip-vault`: up-to-date, lege migrations, seeds en roles.

Publicatiecommit en livebewijs worden toegevoegd zodra de geautoriseerde push en controles op appfmz.nl zijn voltooid. Owneracceptatie blijft pending.

Schermbeelden van de hoofdroutes: [start](examples/tutorial/home-1400-light.png), [lessen](examples/tutorial/topics-1400-light.png), [mobiel oefenen](examples/tutorial/exercise-390-light.png), [begrippen](examples/tutorial/glossary-1400-light.png), [taken](examples/tutorial/tasks-1400-light.png), [donker op telefoon](examples/tutorial/home-390-dark.png) en [hulp in Administratie](examples/tutorial/administration-help-mobile.png).
