# Cursusdekking facturatieplanning — opname en aanvullende speler

`tutorial/planning-lessons.js` bevat vijftien aanvullende Nederlandse stappen, steeds met wat/waarom/handeling/resultaat/controle. De ID's beginnen met `planning-20261026-`; de bestaande 27 lessen, beginnersroute en afgeronde voortgang blijven intact. Alleen vaste fictieve voorbeelden worden gebruikt.

| Onderdeel | Nieuwe les |
| --- | --- |
| Centrale planning, filters en statussen | overzicht |
| Maand en vier weken afzonderlijk | perioden |
| Automatisch concept controleren, korting | concept |
| Historische factuur herkennen, dubbel voorkomen | bestaand |
| Herberekening met voorstel, reden en conflict | herberekenen |
| Expliciete afwijkende eerste periode en grenzen | eerste-periode |
| PWA-toestemming, serverplanning, in-appalternatief | meldingen |
| E-mail bewerken, opslaan, preview | email |
| Test alleen naar aangewezen eigenaar | testmail |
| Definitief nummer/PDF, expliciet versturen | definitief |
| Geplande verzending en annuleren | inplannen |
| Handmatige veilige standaard, automatische toestemming | automatisch |
| APPFMZ, TransIP-webmail en Outlook controleren | verzonden |
| Time-out, herstel en mailboxkopie | herstel |
| Overeenkomst in Documenten en mailherstel | overeenkomst |

De tekst beschrijft de huidige lokale bediening en benoemt ontbrekende mailboxinrichting eerlijk. De aanvullende planningopname telt twaalf hoofdstukken. De vijftien tekstlessen verwijzen alleen naar inhoudelijk passende opgenomen hoofdstukken; historische-factuurcontrole, herberekenen en afwijkende eerste periode hebben geen eigen opgenomen demonstratie en krijgen geen verzonnen hoofdstuklink. `videoStatus:recorded-awaiting-media-verification` houdt opnamebewijs gescheiden van montage-, audio- en releasebewijs.

De bestaande gesproken administratierondleiding blijft beschikbaar. De aanvullende speler ondersteunt afzonderlijke planning- en ledenvideo’s, met behoud van de oorspronkelijke cursus en aparte videopositie per toevoeging. Een schermopname van een gesimuleerde SMTP-success mag nooit als echte mailbox-PASS worden gepresenteerd. Fysieke iPhone-push en het terugvinden van een testbericht in Outlook en TransIP-webmail vragen afzonderlijk eigenaarbewijs.

## Aanvullende geïsoleerde cursusbediening

De cursusstart opent nu `Releasevoorbeeld: facturatieplanning en e-mail oefenen`. `tutorial/planning-course.js` toont de vijftien lessen in leesmodus of met vaste voorbeeldvragen en een tijdelijke kortingberekening. Iedere stap heeft vijf uitlegonderdelen, vorige/volgende, overslaan, opnieuw proberen, uitleg opnieuw tonen en reset. Het permanente veiligheidsbericht en het watermerk blijven zichtbaar. De route bevat geen netwerk-, push-, mail-, upload-, factuur- of opslagcommando. Het bestaande sandbox-iframe en `connect-src 'none'` blijven intact.

De bestaande les-ID's, afgeronde lessen, taakvinkjes, beginnersroute en videopositie blijven ongewijzigd. Nieuwe oefenantwoorden leven alleen in het geheugen van het cursusvenster en worden bij sluiten gewist. De nieuwe route wordt expliciet als releasevoorbeeld gemarkeerd zolang de volledige publicatiecontrole ontbreekt. De tekst is géén claim dat deze nieuwe bediening al gesproken is opgenomen of dat een fysieke mailbox- of pushproef geslaagd is.

`tests/billing-planning-course.test.cjs` is lokaal geslaagd in Edge en WebKit: alle vijftien stappen, lees-/oefenmodus, vijf onderdelen per stap, kortingvalidatie zonder focusverlies, reset, veilig sluiten, ongewijzigde bestaande voortgang en nul financiële/API-opdrachten. Formaten 320, 390, 844 en 1440 px en 200% tekst zijn gecontroleerd. Afbeeldingen: `tests/artifacts/billing-planning-course/`. Dit is browseremulatie, geen fysieke telefoonproef.

De aanvullende cursusproef plus bestaande `tutorial-isolation.test.cjs` zijn gezamenlijk 3/3 PASS (77,6 seconden). Bestaande tests verifiëren ook ongewijzigde lokale tabelhashes voor administratie, leden, Auth, Storage en audit, alsmede hervatten, toetsenbord en bestaande reset. Dit betreft uitsluitend de synthetische lokale database.

## Ledenopname en spelerintegratie

De ledenopname `tests/artifacts/members-20261026/take-1793034514435` bevat 24 scènes, 604 echte Edge-frames en 132,09 seconden ruwe schermbeweging. Dit is niet de uiteindelijke speelduur: montage verlengt echte beelden voor de gesproken uitleg. Runtimehashes waren bij start en einde gelijk, zonder pageerrors of externe aanvragen. De opname gebruikt FitMetZorge Oefenbedrijf, Noor Voorbeeld en uitdrukkelijk ongeldige synthetische voorwaarden. `member-proof.json` controleert één overeenkomst, geen facturen of uitnodigingsmails, behoud van de bestaande maandafspraak, ongewijzigde Auth-telling en byte-identieke PDF na profielwijziging.

`tutorial/spoken-player.js` accepteert gecontroleerde data, titel en media-prefix voor de bestaande administratieve rondleiding en de twee aanvullingen. De host bewaart uitsluitend toegestane voortgangvelden onder `video` (bestaand) en `videos.planning` / `videos.members` (nieuw). De bron van opdrachten blijft buiten de geïsoleerde cursus. Een ontbrekende aanvullende video toont een expliciete melding, geen stille vervanging. Beide URL-vormen werken: `?video=planning` en `?video=1&course=planning`, met optionele `chapter`.

De stemmetadata benoemt de kosteloze externe Edge-voorleesdienst met Nederlandse Colette-stem eerlijk; deze is geen lokale Windows-stem. Alleen het fictieve cursusscript is daarvoor bestemd. De module claimt pas afspeelbaarheid wanneer gegenereerde hoofdstukdata en echte MP4’s beschikbaar zijn. Fysieke iPhone-hoorbaarheid blijft apart te bevestigen.


## Aanvullende afspeelcontrole (voorlopige opname)

`tests/course-supplements.test.cjs` is PASS met de daadwerkelijke MP4/AAC-bestanden: planning 727,917 seconden, leden 778,5 seconden. Edge en WebKit spelen beide video's af, met twaalf hoofdstukken, Nederlandse cues, zoeken, pauzeren, volume en afspeelsnelheid. Edge rapporteert werkelijk gedecodeerde audiobytes; WebKit bewijst technisch afspelen maar geen fysieke hoorbaarheid. De afzonderlijke posities blijven na herladen behouden en de oude administratiepositie en lesvoortgang zijn bytegelijk. De ontbrekende-media-route blijft eerlijk. Bewijs: `tests/artifacts/course-supplements/browser.json`.

De bestaande cursusregressies zijn daarnaast 4/4 PASS (212,9 seconden): oorspronkelijke gesproken video, nieuwe planninglessen en geïsoleerde cursusbediening. Deze checks zijn browseremulatie. De opnamen gelden momenteel als voorlopig: na deze opname wordt de inschrijfroute uitgebreid met expliciete korting en eersteperiode. Vóór release moeten de zichtbare gewijzigde stappen opnieuw worden opgenomen en met het bijgewerkte script gemonteerd. Een playback-PASS is geen bewijs dat de opname al de laatste bediening toont.
