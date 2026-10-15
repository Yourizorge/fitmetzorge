# APPFMZ — trainerweergave, oefenmedia en installatie

> Owneracceptatie vastgelegd op 15 oktober 2026: in de aangeleverde agenda-opdracht accepteert de owner de eerdere trainer-, oefenmedia- en PWA-release. Dit betreft runtimecommit `dda3a1f78599504a7351342684cbbaf4bece5e48`; deze acceptatie geldt niet vooraf voor de nieuwe agenda-/meldingenrelease.

Scope: uitsluitend `Yourizorge/fitmetzorge`, `https://appfmz.nl`. Baseline: `787b15065d347cfa39fa374b7d4999a70c08eaa8`. De openbare live `index.html`, `app.js` en `styles.css` waren vóór aanpassing byte-identiek aan deze hoofdbranch. Werkbranch: `codex/trainer-media-pwa-20261015`.

**Status: gepubliceerd en live gecontroleerd; onderhoud is uit.** Runtimecommit: [`dda3a1f78599504a7351342684cbbaf4bece5e48`](https://github.com/Yourizorge/fitmetzorge/commit/dda3a1f78599504a7351342684cbbaf4bece5e48). De daaropvolgende bewijs-/testdocumentatie wijzigt geen runtimebestanden. De huidige opdracht geeft toestemming voor deze frontendpublicatie. Het oude SQL-uitrolplan is historisch en wordt niet opnieuw uitgevoerd.

## Inventaris en behoud

Alle elf bestaande trainerbestemmingen blijven aanwezig: Dashboard, Agenda, Leden, Schema builder, Trainingslog, Voeding, Trackers, Administratie, Facturen, Financiën en Instellingen. De vijf ledenbestemmingen blijven Mijn dashboard, Training, Voeding, Trackers en Agenda. Alle navigatieknoppen zijn via de echte browser-UI bediend; de bestaande rolfiltering is intact.

| Scherm | Behouden bediening en informatie |
| --- | --- |
| Dashboard | KPI's, ledenfilter, ledenoverzicht, snelkoppelingen |
| Agenda | Kalender/weekkeuze, afspraaksoorten, planner, bestaande afspraakacties |
| Leden | Selectie, zoeken, toevoegen/uitnodigen, profiel/doelen, klantafspraak/betaalperiode |
| Schema builder | Week/dag, aanwezigheid, bibliotheek/filters, eigen oefening, toevoegen/verwijderen, sets/reps/gewicht/rust/tempo, opmerkingen, kopiëren, expliciet publiceren en afronden |
| Trainingslog | Zeven dagen, doelen en gedane waarden, aanwezigheid, weeknotities, oefenmedia |
| Voeding | Schema en maaltijden, kopiëren/publiceren, daginvoer en opmerkingen |
| Trackers | Stappen, gewicht, slaap, welzijn, water, voortgangsfoto's en bestaande private fotoviewer/annotaties |
| Administratie/facturen | Alle negen administratieve onderdelen, concepten, PDF's, boekingen, bank, btw, rapporten en instellingen |
| Financiën/instellingen | Bestaande overzichten, tarieven, afspraaksoorten en bedrijfsinstellingen |

`app.js`, `styles.css`, `sync.js`, `autosave.js`, `photos.js`, alle financiële JavaScriptbestanden, cursusbestanden, bestaande PDF's, configuratie, oorspronkelijke logo's en de volledige `supabase`-map blijven inhoudelijk ongewijzigd. Er is geen productie-DB-, Auth-, RLS-, Edge-, Storage- of auditactie uitgevoerd. Alle testaccounts en testrecords bestaan uitsluitend in de lokale synthetische preview. Geen factuur of e-mail verzonden. De bestaande lokale verwijdering van het handboek in de oorspronkelijke werkboom blijft ongemoeid.

**Specifieke inventarisbeperking:** deze actuele Git/live-versie bevat geen aparte rusttimer of onafhankelijke RIR/RPE-controls. Daarom is daarvan geen werkende bediening geclaimd of nieuwe implementatie toegevoegd. De bestaande rust- en tempovelden blijven behouden. Oefenafbeeldingen hebben hier geen bestaande vergrotingsactie; de afzonderlijke voortgangsfotoviewer met zoom, sluiten en annotaties is behouden en opnieuw getest.

## Oorzaak en frontendcorrectie

De trainerlog gaf `.training-log-photo` een vak van 84 × 84 pixels, maar begrensde het onderliggende `img` uitsluitend voor leden. Een synthetische bron van 400 × 2400 pixels werd bij de trainer op intrinsieke grootte geschilderd, boven tekst en andere kaarten. In het trainerschema gebruikte een latere CSS-regel `height:auto` voor de afbeelding, terwijl de omhulling maximaal 120 pixels hoog was: een afbeelding van 94 × 564 pixels werd zo in een vak van 96 × 120 pixels afgesneden.

`layout.css` begrenst nu alleen de drie bestaande oefenmediaklassen, inclusief het daadwerkelijke `img`: vaste gereserveerde vakken, `width/height:100%`, `object-fit:contain` en begrensde overflow. Het volledige beeld blijft zichtbaar; foto- en GIF-laden verandert de gereserveerde ruimte niet. Lange namen en actierijen mogen omslaan. Ontbrekende foto's blijven via de bestaande fallback zichtbaar. Er is geen algemene `img`-override.

De trainer gebruikt dezelfde kleuren, lettertypen, afgeronde kaarten en gouden selectie als de ledenomgeving. De brede weergave gebruikt een smallere zijbalk en de beschikbare inhoudsbreedte. Onder 901 pixels is er een ondermenu met de bestaande vorige/volgende-knoppen en alle leesbare menunamen. Lange administratieformulieren behouden navigatie in de paginastroom, zodat betaal-/categoriekeuzes niet onder de balk verdwijnen. `presentation.js` herstelt focus na de bestaande navigatierender en laat Escape het geopende menu sluiten.

De bovenbalk kan omslaan; Instellingen, weekkaartjes, formulieren en traineracties passen binnen hun kolom. Tabellen/kalenders met noodzakelijk veel kolommen behouden uitsluitend hun eigen scrollvak. De leden-training reserveert geen lege derde kolom meer voor de verborgen trainerbibliotheek. Er worden geen formulieren of gegevens tijdens typen opnieuw gerenderd door deze toevoegingen.

## PWA en origineel logo

De baseline had geen appmanifest, installatiecode of serviceworker. `manifest.webmanifest` gebruikt de bestaande root-URL als `id`, `start_url` en scope (`/`), naam **FitMetZorge** en `display:standalone`. Er is geen nieuwe URL-variant, opslagkey, sessiewissing of gedwongen herlaadactie. De oude standalone-HTML blijft naar dezelfde app verwijzen en verwijst naar hetzelfde manifest.

De gebruikte bron is exact het huidige login-/app-logo `fit-met-zorge-logo.png`, SHA-256 `940c6c9e66d73a642d67f453fc12e46e78f233e60432ea0ad426324af1493ecf`. Andere aangetroffen bestanden zijn een oude SVG en een eerdere uitgesneden PNG; die zijn niet als vervangend merkbeeld gebruikt. Het volledige originele PNG is alleen proportioneel verkleind op wit, zonder bijsnijden, uitrekken, hertekenen of AI. Exports: 192/512 pixels, afzonderlijke maskable-512, Apple-touch-180 en favicon-32. [Herkomst, maten en hashes](../assets/pwa/provenance.json). De pixelcontrole bewijst dat het zichtbare maskable-logo binnen de veilige centrale cirkel blijft.

**App installeren** staat op de loginpagina en in de aangemelde bovenbalk. Een beschikbaar `beforeinstallprompt` opent de echte browserprompt; een afgewezen of mislukte prompt claimt geen installatie. Alleen `appinstalled` bevestigt installatie. iPhone toont korte Safari/deelmenu-instructies. In een zelfstandig venster verdwijnt de knop. Een native modal kan met Sluiten en Escape dicht; navigatiefocus wordt behouden.

Er is bewust geen serviceworker of privé-cache toegevoegd. Installatie vereist volgens de actuele [MDN-installatievoorwaarden](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) geen serviceworker. Bestaande tijdelijke offline-invoer en conflictafhandeling blijven via de bestaande opslagcode werken; koud starten, opslaan en synchroniseren vereisen internet. Er wordt geen herstel na tabbladsluiting beloofd. [Manifestidentiteit](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id), [browserinstallatie](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt) en [maskable-veilige ruimte](https://web.dev/articles/maskable-icon) zijn gecontroleerd.

## Controles en screenshots

De tests gebruiken alleen vaste synthetische accounts, een lang schema van twaalf oefeningen, lange namen, hoge/brede afbeeldingen, een eigen tweeframes-GIF en een ontbrekende afbeelding. Externe testverzoeken worden geblokkeerd; de echte app-UI gebruikt een geïsoleerde PostgreSQL-preview.

- Bestaande suite: 31 regressietests. De eerste run gaf 30 PASS en één bedekte categoriekeuze door de nieuwe onderbalk. Na de beschreven navigatiecorrectie slaagde die volledige administratieproef opnieuw. Opslag, PT409, invoerbehoud, rollen/privacy, workouts, voeding, fotodelen, facturen/PDF's en alle 27 cursuslessen hebben een geslaagde uitvoering.
- Nieuwe Edge-proef: alle 16 bestemmingen op 320×740, 390×844, 768×1024, 844×390, 1024×768 en 1400×950. Echte navigatie, bereikbare publiceer/verwijder/kopieer/afrondacties, bounding boxes, volledige beelden, bewegende GIF-frames zonder kaartverschuiving, fallback, vergrote tekst, invoerfocus en een verkleinde toetsenbordviewport. [Interactiebewijs](examples/trainer-pwa-20261015/interaction-tests.json).
- WebKit 26.5 op Windows: beide rollen, telefoon/landschap/tablet/laptop en beide thema's, menu's, media, installatiehulp, autosave-focus, reload en afmelden. [WebKit-bewijs](examples/trainer-pwa-20261015/webkit-tests.json). Dit is engine-/browseremulatie, geen fysieke Safari- of iPhone-installatie.
- PWA: manifest zonder parser- of installatieblokkades in een vers normaal Edge-profiel; juiste icoonbestanden en maskable-pixels; prompt accepteren/afwijzen wordt niet verward met installatie; iPhone-hulp, gesimuleerd standalone-venster, rollen, herladen, afmelden/opnieuw aanmelden. Geen CacheStorage-inhoud of serviceworkerregistratie. [PWA-bewijs](examples/trainer-pwa-20261015/pwa-tests.json). De prompt-events en standalone-status zijn in de gedragstest gesimuleerd; de technische installatiegeschiktheid is apart via de browser gecontroleerd.

De laatste controle van de definitieve frontend is **4/4 PASS**: administratieve interacties, de complete Edge-layoutproef, PWA en WebKit. Ook de afzonderlijke laatste opslag-/workout-/voedings-/fotoproef is PASS. In totaal hebben [34 verschillende regressietests een geslaagde uitvoering](APPFMZ_TRAINER_PWA_TESTS_20261015.json). De visuele eindcontrole vond nog een oude mobiele `flex-direction:column` die breedtes als hoogte gebruikte; de bovenbalk is expliciet horizontaal met omslaan gemaakt en de compacte hoogte is aan de test toegevoegd. [Nulmeting](examples/trainer-pwa-20261015/before-audit.json) en [nameting](examples/trainer-pwa-20261015/after-audit.json) bewaren de gemeten afmetingen: 80 schermcombinaties, nul ongewenste horizontale overloop, nul browserfouten. Screenshots zijn uitsluitend synthetisch en gemaakt met browseremulatie:

| Scherm | Voor | Na |
| --- | --- | --- |
| Trainerdashboard telefoon | [Voor](examples/trainer-pwa-20261015/before-trainer-dashboard-390.png) | [Na](examples/trainer-pwa-20261015/after-trainer-dashboard-390.png) |
| Trainerdashboard laptop | [Voor](examples/trainer-pwa-20261015/before-trainer-dashboard-1400.png) | [Na](examples/trainer-pwa-20261015/after-trainer-dashboard-1400.png) |
| Trainerschema telefoon | [Voor](examples/trainer-pwa-20261015/before-trainer-training-390.png) | [Na](examples/trainer-pwa-20261015/after-trainer-training-390.png) |
| Trainerschema laptop | [Voor](examples/trainer-pwa-20261015/before-trainer-training-1400.png) | [Na](examples/trainer-pwa-20261015/after-trainer-training-1400.png) |
| Trainerlog telefoon | [Voor](examples/trainer-pwa-20261015/before-trainer-training-log-390.png) | [Na](examples/trainer-pwa-20261015/after-trainer-training-log-390.png) |
| Trainerlog laptop | [Voor](examples/trainer-pwa-20261015/before-trainer-training-log-1400.png) | [Na](examples/trainer-pwa-20261015/after-trainer-training-log-1400.png) |
| Ledentraining telefoon | [Voor](examples/trainer-pwa-20261015/before-member-training-390.png) | [Na](examples/trainer-pwa-20261015/after-member-training-390.png) |
| Ledentraining laptop | [Voor](examples/trainer-pwa-20261015/before-member-training-1400.png) | [Na](examples/trainer-pwa-20261015/after-member-training-1400.png) |

## Release- en herstelpad

Alleen frontend/assets/tests/documentatie gaan naar Git. Remote main wordt opnieuw gecontroleerd vóór een fast-forward push. Publicatie volgt via de bestaande GitHub Pages-inrichting; geen hosting-, domein- of databaseconfiguratie aanpassen. Daarna vergelijkt `tests/verify-trainer-pwa-assets.cjs` de openbare livebestanden byte voor byte met de commit en controleert het onveranderde kernbestanden. Live login/installatie/manifest worden opnieuw in de browser gelezen, zonder echte accountgegevens.

Deze frontend is compatibel met de bestaande backend; onderhoud is niet nodig. Geopende tabbladen worden niet gedwongen te verversen. Herstel is een gerichte Git-revert van uitsluitend deze frontendcommit en een normale Pages-publicatie; database en klantinhoud blijven staan. Staging, JARVIS/AI en de afzonderlijke website worden niet benaderd of aangepast.

## Uitgevoerde publicatie en live bewijs

De remote hoofdbranch was vlak vóór push nog exact de baseline. De geteste runtimecommit is eerst naar de aparte branch en vervolgens fast-forward naar `main` gepusht. [Pages-run 38714033096](https://github.com/Yourizorge/fitmetzorge/actions/runs/38714033096) voltooide succesvol op **15 oktober 2026, 09:36 UTC**.

[Alle 48 gecontroleerde openbare livebestanden](APPFMZ_TRAINER_PWA_ASSETS_20261015.json) zijn byte-identiek aan de runtimecommit. Ook MIME-types voor manifest en PNG's zijn gecontroleerd. Alle beschermde runtime-/SQL-/configuratiebestanden zijn gelijk aan de baseline. De verificatie gebruikt alleen openbare GET-verzoeken; er is geen databaseverbinding gebruikt.

De [live browserproef](APPFMZ_TRAINER_PWA_LIVE_20261015.json) slaagde: openbare login op vier formaten, echte `beforeinstallprompt` en aanroep van de browserinstallatieprompt, afzonderlijke fallback-uitleg, sluiten/Escape, manifest zonder parser- of installatieblokkades, Apple-metagegevens en de oude HTML-ingang naar dezelfde rootapp. Geen browserfouten, geen schrijfverzoeken, geen CacheStorage-inhoud en geen serviceworker. Er is geen installatiebevestiging gegeven en niet met echte accounts ingelogd. [Live login op telefoonformaat](examples/trainer-pwa-20261015/live-login-390.png).

De eerste live test verwachtte ten onrechte altijd het uitlegvenster: de browser bood al de echte installatieprompt aan. De testhulp is gecorrigeerd om die twee ondersteunde paden afzonderlijk te bewijzen; hiervoor was geen runtimecorrectie nodig. Er is geen technische releaseblocker. De resterende controle is de fysieke telefooninstallatie en bediening door de owner.

## Korte fysieke telefoontest voor de owner

1. Rond lopende invoer af en open `appfmz.nl` opnieuw. Kies **App installeren**. Op iPhone: Safari → **Deel → Zet op beginscherm** → zo nodig **Open als webapp** → **Voeg toe**. Android: bevestig de aangeboden browserinstallatie, of gebruik de installatieoptie in het browsermenu.
2. Open het FitMetZorge-icoon. Meld je aan, open als trainer het ondermenu en bezoek Schema builder en Trainingslog. Bekijk een bewegende oefening en controleer dat naam, velden en acties vrij blijven. Herhaal als lid en draai de telefoon.
3. Vul een gewone trainingsregistratie in, wacht op **Opgeslagen**, wissel kort naar een andere app en terug. Controleer na heropenen dat de waarde blijft staan. Test ook afmelden en je eigen rol na opnieuw aanmelden.

Controleer fysiek het icoon, zelfstandig venster, toetsenbord en schermranden. Er is geen fysieke telefoontest of owneracceptatie namens de owner geclaimd.
