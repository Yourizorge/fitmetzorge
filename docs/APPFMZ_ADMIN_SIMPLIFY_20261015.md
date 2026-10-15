# APPFMZ — eenvoudige betalingen, administratie en cursus

> Vervolg: de bevestigde historische correcties en volledige gesproken cursus staan in [het gecombineerde releaserapport](APPFMZ_BANK_REPAIR_SPOKEN_COURSE_20261015.md). Onderstaande gegevens beschrijven de eerdere release.

Status: gepubliceerd en technisch geverifieerd op 15 oktober 2026. Live, geen onderhoud nodig. Owneracceptatie nog niet vastgelegd.

Basis: `64275478de3155410118e3464e40dfa747a19833`, gecontroleerd tegen remote main. Aparte werkboom `appfmz-admin-simple`, branch `codex/admin-simplify-payments-20261015`. Geen bestaande werkboomwijzigingen overgenomen/verwijderd. Alleen `Yourizorge/fitmetzorge`, `appfmz.nl`, bevestigd Supabase-project `hgoygcviutmynaihcvpd` (FitmetZorge, ACTIVE_HEALTHY). Geen AGENTS.md aangetroffen. De bestaande releaseplannen zijn historisch; deze opdracht geeft toestemming voor dit pakket, niet voor een replay van oude migrations.

## Inventaris vóór wijzigingen

- `fmz_accounting.records` bewaart concepten, onveranderlijke definitieve facturen, credits, bankmutaties en koppelingen. `journals`/`lines` vormen het bestaande grootboek; `receipts` bewaart idempotente serverantwoorden; `audit` bewaart handelingen.
- Definitief maken boekt debiteuren/omzet/btw. Een bankmutatie boekt bank/kas tegenover de tussenrekening. `allocate` boekt de tussenrekening naar debiteuren. Deze koppeling is de bestaande factuurbetaling. Er is geen reden om een tweede betalingstabel of tweede omzetboeking te introduceren.
- De owner moet nu eerst een bankmutatie maken en daarna koppelen. Het factuuroverzicht toont wel een afgeleid restant, maar geen eenvoudige betaalactie. Status wordt uit de debiteurenregels en credits berekend; dat blijft zo.
- `private` maakt al automatisch bank plus koppeling. CSV-import maakt bankmutaties en voorkomt gelijke bron-ID's. Eigen overboekingen koppelen twee bestaande bankmutaties zonder omzet. Deze routes blijven behouden.
- `reconcile` vergelijkt een ingevoerde afschriftstand met beginstand plus boekingen. Dit is een saldovergelijking; de app leest geen bankrekening uit. De bestaande term Afstemmen verbergt dit onderscheid.
- Btw gebruikt de bestaande bevestigde methode: factuurstelsel uit factuurdocumenten; kasstelsel uit bankgedateerde factuurkoppelingen met cumulatieve afronding. Credits, annuleringen, uitgaven, periodeafsluiting, privé en exports blijven afzonderlijke processen.
- `tutorial/content.js`, `model.js`, `course.js` bevatten 27 bestaande lessen/oefeningen. De sandbox heeft geen netwerk of sessietoegang; alleen lesvoortgang is persistent. De PDF komt uit dezelfde bron. Deze structuur en voortgang blijven behouden, met een vernieuwde beginnersroute en bijgewerkte overige teksten/oefeningen.

## Gerichte uitbreiding en herstelpad

Eén nieuwe lokale migration, met CLI aangemaakt: `20261015130925_appfmz_invoice_payments.sql`. Geen dataconversie. Nieuwe gecontroleerde RPC gebruikt dezelfde owner-/sessiecontrole, organisatie-lock, records, journaalposten, audit en idempotentiebewijzen. Eén actie maakt een bankontvangst plus factuurkoppeling, of gebruikt een expliciet gekozen bestaande ontvangst. Een versiecontrole omvat zowel de factuur als de reeds geboekte debiteurenregels; dubbele apparaten krijgen een conflict.

Correcties voegen tegenboekingen en een reden toe. Een handmatig via de betaalactie gemaakte foutieve ontvangst kan worden tegengeboekt. Bij een bestaande/geïmporteerde ontvangst wordt uitsluitend de verkeerde factuurkoppeling tegengeboekt: de bankmutatie blijft beschikbaar. Er wordt geen daadwerkelijke terugbetaling verzonnen. Afgesloten bronperiodes blokkeren correctie tot expliciete, reeds bestaande heropening. Gemengde historische splitsingen worden niet op basis van aannames gewijzigd.

Bij latere CSV-import worden mogelijke overeenkomsten met een handmatig geregistreerde factuurbetaling ter beoordeling getoond. Expliciet bron koppelen verandert geen saldo of omzet. De oude importroute mag een dergelijke ontvangst niet stilzwijgend nogmaals boeken.

Vóór eventuele productie-uitrol: nieuw privé versleuteld checkpoint, gerichte object-/historycontrole, synthetische herstel- en regressieproeven, dry-run met precies deze migration. Bij fouten geen geschiedenisreparatie/reset of herstel over nieuwere gegevens; behoud veilige rechten en historische documenten. Eerst lokaal uitwerken en testen, daarna publicatie en beperkte echte synthetische ketencontrole met gerichte opruiming.

## Opgeleverd in de code

- **Betaald ontvangen** opent bedrag, werkelijke datum, rekening/kas en omschrijving met een begrijpelijke samenvatting. Eén bevestiging gebruikt de bestaande bank-/factuurkoppeling. Betalingen en het restant zijn vanuit facturen en Bank/Kas bereikbaar.
- Verloren antwoorden houden de exacte aanvraag tijdelijk vast. Opnieuw proberen gebruikt dezelfde identiteit; bij een stale versie volgt één PT409 en een expliciete vergelijking. Succes volgt pas na serverbevestiging. Accountwissel ruimt de privéformulieren op. Er wordt geen herstel na tabsluiting beloofd.
- Deelbetalingen, contant geld, bestaande ontvangsten, correcties met reden/historie en bronkoppeling bij latere CSV-import. Een eventuele extra ontvangst met dezelfde rekening/datum/bedrag vereist een bewuste toelichting. Onjuiste CSV-rekeningen bieden geen bronkoppelactie.
- Bank/Kas benoemt de administratieve stand en de bron; **Bankstand vergelijken** is een vergelijking met het eigen afschrift, geen bankkoppeling en geen factuurbetaling. Geïmporteerde bedragen worden niet als automatisch bankbevestigd voorgesteld.
- Vijf hoofdroutes, donker/goud en een leesbare lichte variant; periodegebonden tellers met doorklikken. Alle negen administratieonderdelen en bestaande credit-, annulerings-, PDF-, CSV-, privé-, uitgaven-, lening-, activum-, btw- en exportacties blijven bereikbaar.
- De nieuwe hoofdroute heeft 12 stappen. Alle 27 bestaande lessen, oefeningen, begrippen en werklijsten zijn bijgewerkt; bestaande voortgang blijft behouden. Alleen de volledige, afzonderlijke cursusreset wist voortgang. De gewone oefenreset herstelt uitsluitend de voorbeelden.
- De sandbox gebruikt dezelfde betaalvelden en validatieregels. Pariteit met het SQL-grootboek is getest. Opaque origin, geen netwerktoegang, geen echte nummerreeks, geen financiële opslag buiten tijdelijk browsergeheugen. Alleen voortgang/taakvinkjes passeren de beperkte hostinterface.
- [PDF-handleiding, 90 A4-pagina's](../output/pdf/APPFMZ-boekhouden-voor-beginners.pdf), uit dezelfde cursusbronnen; alle pagina's gerenderd en visueel gecontroleerd, gewijzigde voorpagina's en betaalstap opnieuw bekeken. Broncontrole Belastingdienst: 15 oktober 2026. De precieze knoppen binnen een ingelogde ING-omgeving zijn niet gecontroleerd; dat is in de handleiding vermeld. Bestaande btw-instellingen zijn niet gewijzigd.
- [Echte MP4-opname](../tutorial/media/betalingen.mp4), ongeveer 49 seconden, H.264, Nederlandse ingebakken ondertitels plus [VTT](../tutorial/media/betalingen-nl.vtt) en [acht hoofdstukken](../tutorial/media/betalingen-chapters.json). Werkelijke klikken in de gebouwde synthetische oefenomgeving; lokaal gecodeerd, geen verzonnen schermen of betaalde dienst. Afspelen, pauzeren, herhalen en hoofdstukken getest in Edge en WebKit/iPhone-emulatie. Geen ingesproken audio.

## Beeldbewijs

Uitsluitend synthetische gegevens; browseremulatie, geen fysieke telefoontest:

| Scherm | Voor | Na |
| --- | --- | --- |
| Overzicht laptop | [voor](images/admin-simple/before-overview-laptop.png) | [na](images/admin-simple/after-overview-laptop.png) |
| Overzicht telefoon | [voor](images/admin-simple/before-overview-phone.png) | [na](images/admin-simple/after-overview-phone.png) |
| Facturen laptop | [voor](images/admin-simple/before-sales-laptop.png) | [na](images/admin-simple/after-sales-laptop.png) |
| Facturen telefoon | [voor](images/admin-simple/before-sales-phone.png) | [na](images/admin-simple/after-sales-phone.png) |
| Bank/Kas laptop | [voor](images/admin-simple/before-bank-laptop.png) | [na](images/admin-simple/after-bank-laptop.png) |
| Bank/Kas telefoon | [voor](images/admin-simple/before-bank-phone.png) | [na](images/admin-simple/after-bank-phone.png) |

[Betaalvenster laptop](images/admin-simple/after-payment-laptop.png), [telefoon](images/admin-simple/after-payment-phone.png), [video op iPhone-emulatie](images/admin-simple/video-iphone.png).

## Herstel en behoud

Vers checkpoint van 15 oktober 2026 buiten Git en OneDrive, versleuteld met gecontroleerde authenticatie en SHA-256. Bevat 20 applicatietabellen, Auth-users/identities, Storage-metadata, objectdefinities/rechten en drie oorspronkelijke privébestanden. Ontsleuteling en originele bytes gecontroleerd; geen echte klantinhoud in de testdatabase geladen. De volledige schemaketen en herstel-/betaalflows draaien lokaal met synthetische gegevens. [Checkpointbewijs](examples/admin-simple/checkpoint.json).

Voor de uitrol zijn 24 tabelhashes en bestaande functie-/policy-/rechtendefinities vastgelegd. Na gerichte opruiming zijn deze opnieuw vergeleken en volledig gelijk gebleven. De migration voegt uitsluitend vier functies en één guardtrigger toe; geen bestaande financiële rij of definitief document wordt geconverteerd. De bestaande frontend blijft hiermee compatibel. Terugval is het gecontroleerd terugzetten van de frontend naar de baseline; de veilige additieve API kan aanwezig blijven. Geen history-repair, SQL-replay of herstel over nieuwere klantinvoer.

## Laatste releasecontrole

[Alle 51 regressieonderdelen hebben definitief PASS-bewijs](examples/admin-simple/regressions.json). De volledige ronde had 49 PASS en twee onjuiste testaannames; na gerichte correcties slaagden de betaal-/boekhoud-/PWA-controles en de trainerlayout. Er is geen productiefout verborgen door een test weg te laten. De bestaande 27 lessen en 61 oefenhandelingen zijn ook volledig in de browser doorlopen.

Productie: uitsluitend `20261015130925_appfmz_invoice_payments.sql` transactioneel toegepast. SHA-256 `b1753191c35f547d2e48cfac83930c6410ba77504b74e19ab9ce23028d84f5e8`. [Alle negen migrationidentiteiten gelijk](examples/admin-simple/migration-list.json); [dry-run up-to-date, migrations/seeds/roles leeg](examples/admin-simple/migration-dry-run.json). Geen bestaande migration opnieuw uitgevoerd.

[Echte PostgREST/Auth-proef](examples/admin-simple/production-api.json): drie verse eigen testaccounts, €200 + €150, verschillende datums, bank/kas, gelijktijdige identieke requests, verloren-antwoordherhaling, correctie, bestaande ontvangst koppelen, geen extra omzet/btw, herinloggen en sessie-intrekking PASS. Stale versie gaf één PT409/HTTP409 in 104 ms; volledige transactie bleef ongewijzigd. Lid, andere trainer en anonieme gebruiker geweigerd. Geen e-mail of push.

Runtimecommit: [e676eb1018f8053dee81bf81ac33b1e3fa445764](https://github.com/Yourizorge/fitmetzorge/commit/e676eb1018f8053dee81bf81ac33b1e3fa445764), fast-forward gepubliceerd naar main na controle van de actuele hoofdbranch. [GitHub Pages-run 38754077354](https://github.com/Yourizorge/fitmetzorge/actions/runs/38754077354) SUCCESS. [Alle 66 live bestanden](examples/admin-simple/live-assets.json) exact gelijk aan Git, inclusief MP4, PDF, cursus, manifest en iconen. De oude brede tutorial-tekstregel in Git vereiste een expliciete binaire MP4-uitzondering; vóór productie zijn de speelbare videobytes exact opnieuw geïndexeerd en geverifieerd.

[Live browserbewijs](examples/admin-simple/live-browser.json): echte nieuwe betaalactie op appfmz.nl, herladen en opnieuw aanmelden bewaren dezelfde betaalde factuur; cursus opent; 390/1440px gecontroleerd. Alleen synthetische accounts. [Live telefoonbeeld](images/admin-simple/live-payment-390.png), [live laptopbeeld](images/admin-simple/live-payment-1440.png). Geen fysieke iPhoneproef geclaimd. Een hoofdletterverschil in de cursus-watermerkassertie is in het releasescript hersteld; hercontrole gebruikte de al bestaande betaling zonder nieuwe boeking.

[Behoudsbewijs](examples/admin-simple/data-preservation.json): alle 24 oorspronkelijke tabellen exact dezelfde aantallen en SHA-256, alle 55 bestaande functies en hun rechten gelijk, policies/table grants gelijk, drie oorspronkelijke private bestanden byte-identiek. Dit omvat financiële historie, nummerreeks, betalingsafspraken, memberdata/fotoannotaties, Auth en agenda/meldingen. Alleen de drie eigen gemarkeerde accounts en hun testadministratie zijn verwijderd. Er is geen echte klant benaderd, geen echte factuur verstuurd, geen email/push verstuurd en geen echte eigenaarfactuur genummerd.

De oorspronkelijke app-/autosave-/foto-/factuur-PDF-/billing-/agenda-/PWA-/Edge-runtime bleef gelijk; uitsluitend de bedoelde administratie-/cursusbestanden en hun inclusies zijn gewijzigd. De website, staging en AI zijn niet aangepast. Geen bekende technische blocker. Laatste documentatiecommit bevat alleen bewijs en een herhaalbare livecontrole; de releaseblobs blijven gelijk. Dit rapport is geen owneracceptatie.

## Korte eigenaarstest en backlog

Open op je iPhone **Administratie → Uitleg & oefenen**. Bekijk de korte video. Open daarna de oefening Betaling registreren, registreer €200 op de oefenfactuur van €350 en bekijk het restant €150 en Bank/Kas. Beoordeel vooral of de knoppen, uitleg en bedragen begrijpelijk zijn. Dit raakt je echte administratie niet en duurt ongeveer drie minuten.

Nog aan de owner: deze korte fysieke gebruiksbeoordeling en acceptatie. Technische foutenpaden worden door de releasecontroles afgedekt. Fysieke installatie/pushontvangst uit de afzonderlijke eerdere agenda-/PWA-release blijft een afzonderlijk acceptatiepunt. Geen nieuwe bankkoppeling, fiscale bedrijfskeuze, automatische verzending of AI-/stagingwerk toegevoegd.
