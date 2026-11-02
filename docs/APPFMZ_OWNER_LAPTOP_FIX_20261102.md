# APPFMZ — samenhangende correctie afgeschermde owner-test

2 november 2026. Deze correctie vervangt uitsluitend de synthetische owner-laptoptest. De nieuwe ledenfunctionaliteit wordt niet voor echte leden vrijgegeven. Fysieke eigenaaracceptatie blijft de volgende stap.

## Scope en herkomst

- Opdrachtbasis main: `8f19bbe4a1f3243534f186283764625c3d3997d0`.
- Gewone livebasis: `309cb0db3569f14ac54442c8daec678020ba149a`.
- Ontwikkelbron en uitvoerbare tests: branch `codex/members-billing-20261026`; de release bevat alleen `owner-test/**`, controlecode en documentatie. De ontwikkelbranch wordt niet naar main samengevoegd.
- Bestaande herstelbranch `backup/appfmz-pre-member-onboarding-20261102` en tag `appfmz-live-before-member-onboarding-20261102` blijven naar de livebasis verwijzen. De branch is vergrendeld; admin enforcement aan, force-push en verwijderen uit.
- Geen productiemigration, SQL-replay, Edge-deployment, Auth-, Storage- of financiële schrijfactie. Geen echte inschrijving, overeenkomst, foto, factuur, e-mail of push. Staging, JARVIS en de bedrijfswebsite blijven buiten scope.

## Correcties

**Navigatie en profiel.** Een compacte verticale zijbalk met zeven onderdelen, permanente ledenzoekbalk en directe opening van het volledige profiel. De gids is een inklapbare overlay en reserveert geen profielbreedte. Tien profieltabbladen verdelen zich bij vergroting over regels. Dashboard wist de lidcontext. Leden heeft actief/inactief/conceptfilters. Routewisseling herstelt de scrollpositie; de vaste kop houdt rekening met de werkelijke bannerhoogte. Op smalle schermen zitten aanvullende topbalkacties onder Bediening; zoeken blijft bereikbaar.

**Inschrijving.** Drie individuele PT-kaarten en drie duo-kaarten komen uit de bestaande lokale catalogus. Duo toont totaal, prijs per persoon en per training per persoon. Twee nieuwe fictieve personen worden aan één gedeelde oefenovereenkomst gekoppeld; de hoofdcontractant tekent. Een reeds bestaande tweede persoon wordt als duplicaat geweigerd en niet stilzwijgend opnieuw aangemaakt. Gegevens blijven verticaal gegroepeerd. Aanvullende doelen kunnen worden opgeslagen en gewijzigd met auditregistratie.

**Kosten.** Geen korting, prorata, automatische factuur of mail in deze inschrijfroute. De kostenweergave benoemt de verwachte handmatige factuurdatum. Individueel Progressie: €380, acht trainingen, €47,50 per training. Duo Progressie: €500 totaal, €250 per persoon en €31,25 per training per persoon. De bestaande periode-eindregel blijft behouden; geen nieuwe bedrijfskeuze voor facturatie.

**PDF en Documenten.** Geldige PDF-bytes en een succesvolle download bleken onvoldoende bewijs dat het document ook zichtbaar opende. De opaque testiframe is nu gekoppeld aan een gecontroleerde PDF-hostbrug. De bestaande PDF.js-renderer toont de echte opgeslagen PDF in de dialoog en in een nieuw tabblad; downloaden blijft `application/pdf` met `.pdf`. Preview sluiten trekt de actieve document-URL niet te vroeg in. Pop-upblokkering heeft een zichtbare herstelactie. Sessiewissel/sluiten van de owner-test trekt de geheugen-URL’s in en sluit door de test geopende tabbladen. Bekijken/herdownloaden maakt geen nieuwe inschrijving. Documenten toont type, datum, status, versie en afzonderlijke bekijk-/downloadacties. De twee duo-profielen verwijzen naar dezelfde onveranderlijke PDF; onbevoegde andere leden krijgen geen toegang.

**Camera.** Foto maken blijft primair. De eigenaarhost vraagt cameratoestemming en levert alleen de bewust gekozen foto aan de lokale test. Geen camera in de opaque iframe, audio of video-opname. Sluiten, gebruiken en sessiewissel stoppen de tracks.

**Oefenmedia.** De test-CSP blokkeerde bestaande externe catalogus-GIF’s doordat alleen data- en Blob-afbeeldingen waren toegestaan. Alleen de exacte 60 bestaande GIF-adressen uit de gewone catalogus zijn toegevoegd aan `img-src`; `connect-src 'none'`, de opaque sandbox en camerabeperking blijven behouden. Geen nieuwe oefenafbeeldingen. Afbeeldingen sturen geen referrer. De drie bestaande mediacontainers zijn lokaal begrensd met `object-fit: contain`; foutafhandeling werkt zonder geblokkeerde inline JavaScript-handler. Een schema krijgt pas na zoeken, doelcontrole en bevestiging een lid; herhalen dupliceert niet.

**Herinneringen.** De teksten zijn “Over één week facturen maken” en “Vandaag facturen maken en versturen”. Detail toont periode en betrokken fictieve leden en opent de bestaande Facturen-pagina. Maand- en vierweekse afspraken blijven afzonderlijk; voltooid blijft na hervatten bewaard. Geen conceptfactuur, mail, verzending of boeking. De gids bevat de 25 gevraagde stappen, inclusief verwijderlijst en lokale cleanup.

## Controles en bewijs

De uitvoerbare tests staan in de ontwikkelbranch; de publicatieverifiers staan ook in de release. Bewijs wordt opgeslagen in [examples/owner-laptop-fix-20261102](examples/owner-laptop-fix-20261102/) en screenshots in [images/owner-laptop-fix-20261102](images/owner-laptop-fix-20261102/). De controles hieronder zijn afgerond vóór publicatie; live- en Git-bewijs wordt afzonderlijk vastgelegd.

Geen browseremulatie wordt als fysieke laptop-, camera-, telefoon- of eigenaaracceptatie aangeduid. Oude owner-testbrowsertests die de inmiddels expliciet verwijderde automatische factuur-/mailsimulatie verwachten, zijn geen acceptatiecriteria voor deze release. De productierenderer-mirrortest is geen PASS: de ontwikkelbron is bewust nog niet voor productie-Edge vrijgegeven.

De navigatie is in Edge 155 en Chrome 156 gecontroleerd. De native zoom gebruikt `chrome.tabs.setZoom` met `getZoom`-teruglezing: 100/125/150/200% op 1366×768 en 1920×1080, plus 1024×768, 390×844 en 844×390, samen 22 layoutgevallen. Screenshots zijn na stabilisatie van de browser en correctie van de achtergrond-scrollpositie genomen; onbruikbare tussentijdse schermafbeeldingen zijn geen eindbewijs.

De mediaregressie test de werkelijk bestaande Bench Press-GIF: 316.421 bytes, twaalf GIF-frames, SHA-256 `5d8f4c247630ccba9b8df09432d6174a96f8df3d3450164a6cabbde766de93a8`. Edge en Chrome tonen deze onder Schema builder en Training, ook bij 390×844 en na herladen. Het mediavak is 112×112 CSS-pixels, het beeld blijft met `contain` binnen het vak; geen horizontale pagina-overloop of referrer. Dit bewijst één representatieve bewegende bron door de echte schermketen; de verifier controleert daarnaast de volledige lijst van zestig catalogusadressen.

Native cameraondersteuning is op deze Windows-computer in beide browsers gecontroleerd met een 1280×720-stream die zonder opname is gestopt. De foto-/retake-/use-bediening gebruikt uitsluitend synthetisch beeld: Edge een canvasfixture, Chrome een virtueel camera-apparaat. Cameraweigering is afzonderlijk gecontroleerd. Dit is geen fysieke eigenaaracceptatie.

### Screenshots

1. [Dashboard, zijbalk en zoeken](images/owner-laptop-fix-20261102/chrome-dashboard-1366.png).
2. [Volledig ledenprofiel](images/owner-laptop-fix-20261102/chrome-profile-1366-zoom-100.png).
3. [Alle tabbladen op 125%](images/owner-laptop-fix-20261102/chrome-profile-1366-zoom-125.png).
4. [Individuele en duo-pakketten](examples/owner-laptop-fix-20261102/package-selected-chrome-duo.png).
5. [Documenten bij de duo-inschrijving](examples/owner-laptop-fix-20261102/documents-chrome-duo.png).
6. [Werkelijk gerenderde PDF](examples/owner-laptop-fix-20261102/pdf-open-chrome.png).
7. [Synthetische cameraweergave](examples/owner-laptop-fix-20261102/camera-preview.png).
8. [Training met bestaande animatie](images/owner-laptop-fix-20261102/chrome-training-animation.png).
9. [Herinneringen in Agenda](examples/owner-laptop-fix-20261102/reminders-agenda.png) en [periode met betrokken lid](examples/owner-laptop-fix-20261102/reminder-period-members.png).
10. [Alle tabbladen bij 200%](images/owner-laptop-fix-20261102/edge-profile-1366-zoom-200.png), [telefoonformaat](images/owner-laptop-fix-20261102/chrome-profile-390.png).

## Read-only onderzoek eerdere productieverschillen

Zie [historical-readonly-investigation.json](examples/owner-laptop-fix-20261102/historical-readonly-investigation.json). De logcontrole toont zeventien succesvolle POST-verzoeken naar `fmz_save_changes_once` vanuit `appfmz.nl`, tussen 16:08:36.517 en 16:10:16.803 UTC. De zeventien nieuwe ontvangstbewijzen en de workspace-update vallen direct bij die verzoeken. Rond 16:08:20 UTC zijn een refresh-tokenverzoek, `token_refreshed` en `token_revoked` geregistreerd, passend bij de Auth-update.

Daarmee zijn echte opslag- en sessieverversingsactiviteiten aangetoond; er wordt geen persoon of specifieke bedieningshandeling aan toegeschreven. Zonder de oude workspace-veldinhoud blijft volledig historisch veldbehoud onbewezen. Dit rapport vervangt de eerdere onzekerheid over het bestaan van die verzoeken, niet de beperking van de oude veldvergelijking. Er is niets teruggezet of gecorrigeerd in productie. De nieuwe nulmeting van deze correctie is afzonderlijk vastgelegd in [baseline.json](examples/owner-laptop-fix-20261102/baseline.json).

## Resterende grenzen

- Privacy blijft concept. Vrijwillige gezondheidsinformatie blijft daarom geblokkeerd; een oefencheckbox is geen geldige toestemming voor echte gezondheidsgegevens. Bestaande dossiers worden niet gewijzigd.
- Duo ondersteunt hier twee nieuwe fictieve deelnemers met één tekenende hoofdcontractant. Een bestaande tweede persoon koppelen is geen vrijgegeven route.
- Publieke bestaande oefen-GIF’s vragen internet en blijven afhankelijk van hun bestaande bron; bij onbeschikbaarheid verschijnt de bestaande fallback.
- Testgegevens blijven lokaal. De verwijderlijst wist alleen de betreffende synthetische testrun; niets wordt automatisch overgezet naar echte administratie.
- Fysieke laptopbediening, camera en inhoudelijke acceptatie blijven door de eigenaar te controleren.

## Eigenaarstest

Na de geverifieerde publicatie: open als eigenaar [de afgeschermde laptoptest](https://appfmz.nl/?owner-test=1&retest=20261102-fix). Controleer TESTMODUS en volg de 25 stappen. Besteed extra aandacht aan de verticale navigatie, alle profieltabbladen, duo, PDF openen/downloaden, camera en bewegende oefenmedia. Controleer ten slotte beide herinneringen en voer de getoonde lokale verwijderlijst uit.

## Testresultaten bij publicatie

| Controle | Resultaat |
| --- | --- |
| Gerichte lokale regressies | 10 unieke tests PASS; negen direct, camerabrug na correctie van een testselector. Geen camera-runtimewijziging voor die hertest. |
| Individuele inschrijving | Edge en Chrome PASS; definitieve guard-versie opnieuw volledig in Chrome inclusief sessieverloop, opnieuw aanmelden en identieke PDF. |
| Duo-inschrijving | Edge en Chrome PASS; twee profielen, één overeenkomst/PDF, geen factuur of mail. |
| PDF openen/downloaden/herstel | Edge en Chrome PASS; vier echte PDF-pagina’s gerenderd, downloadhash gelijk, blokkering en ongeldige PDF gecontroleerd. |
| Navigatie en layout | Edge en Chrome PASS; 22 layoutgevallen en zeven routes, tien tabs, toetsenbord en expliciete schemakoppeling. |
| Oefenmedia | Edge en Chrome PASS; bestaande bewegende GIF, laptop en telefoonformaat, beide trainingsroutes, herladen. |
| Herinneringen | Edge en Chrome PASS; beide intervallen, betrokken leden, voltooid hervatten; financiële snapshot ongewijzigd. |
| Camera | Native stream Edge/Chrome; synthetische opnamebediening beide browsers; volledige Chrome-brug met sessieverloop, heraanmelding en cleanup PASS. |
| Afgeschermde host | Edge PASS; lid en andere trainer geweigerd, tweede tab geblokkeerd, procesherstart behoudt concept, afmelden verwijdert test. |

De brede browsermatrix gebruikte runtime-SHA-256 `f5ece19ab7d37aefc8748c01727357e1186c461a6bdd32343ebd62887ad85e0b`. De definitieve runtime is `df9df7bc6282bfccd404f3ee1d51e13b553ad7ae1fcd03f7f69349278d47e95e` (30.246.855 bytes). Het enige latere runtimeverschil respecteert een geweigerde navigatie bij niet-opgeslagen invoer. [guard-delta.json](examples/owner-laptop-fix-20261102/guard-delta.json) bewijst dat terugdraaien van uitsluitend die guard en bronhash exact de eerdere runtimehash oplevert. De guard, complete inschrijfketen en cameraketen zijn daarna op de definitieve runtime getest.

[cleanup-summary.json](examples/owner-laptop-fix-20261102/cleanup-summary.json) bevat per afzonderlijke testrun de exacte synthetische identifiers, aantallen en bronhashes en het bijbehorende cleanupbewijs. [test-matrix-summary.json](examples/owner-laptop-fix-20261102/test-matrix-summary.json) indexeert de bewijzen; dit is geen verzonnen optelsom van assertions. In-memory unitdatabases zijn gesloten; voor de blijvende browsertest is het uitsluitend daarvoor gemaakte tijdelijke browserprofiel verwijderd. Geen productie-testaccount of productie-testbestand aangemaakt.

## Publicatiebewijs

De geteste owner-test wordt afzonderlijk naar main gepubliceerd. Definitieve Git-, hosting-, live-byte- en productiehashcontroles volgen in deze sectie na de publicatie. Gewone APPFMZ-runtimebestanden blijven gelijk aan de opdrachtbasis; de bestaande launcher-invoeging uit de vorige release blijft behouden.
