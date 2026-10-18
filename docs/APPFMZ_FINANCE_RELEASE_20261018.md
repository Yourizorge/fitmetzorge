# APPFMZ — financiële administratie, btw en vernieuwde cursus

Scope: uitsluitend `Yourizorge/fitmetzorge`, `appfmz.nl` en Supabase `hgoygcviutmynaihcvpd`. Uitgangscommit `368cdb37f5e21bc09f0d99a09d51c7fd07c61e4b`. Branch `codex/finance-vat-course-20261018`.

Status vóór frontendpublicatie: implementatie, database, opname en lokale regressies gecontroleerd. Live verificatie en het uiteindelijke behoudsbewijs worden na publicatie aan ditzelfde rapport toegevoegd. De fysieke iPhoneacceptatie staat open.

## Aanleiding en read-only onderzoek

De twee door de owner aangewezen bestaande factuurbetalingen stonden al bevestigd in productie. Er is geen betaling of factuur opnieuw aangemaakt. De werkelijke betaaldatums lagen in september, terwijl het dashboard oktober selecteerde. Het tijdstip waarop een betaling is ingevoerd is een andere datum. De eerdere detailweergave maakte dat onderscheid onvoldoende duidelijk. De oorspronkelijke correcties blijven zichtbaar in de historie.

De standaard factuurfilter stond op alle facturen. Het probleem was dus geen bewezen verborgen openstaande-filter. De daadwerkelijk geladen vorige release is read-only gecontroleerd. De facturen waren volledig gekoppeld, met nul openstaand; hun originele PDF's waren aanwezig. Namen, echte bedragen, datums, record-ID's en het volledige privéonderzoek blijven buiten dit publieke Git-rapport. De owner krijgt de concrete uitkomst rechtstreeks in het eindbericht.

## Nieuwe bediening

- Facturen tonen totaal, ontvangen, openstaand, status, werkelijke betaaldatum, rekening, registratietijd en volledige betaal-/correctiehistorie. Direct doorklikken naar Bank/Kas en terug. Filters voor alle, open, gedeeltelijk betaald, betaald, te laat en gecorrigeerd. De bestaande betaalactie blijft zichtbaar waar een werkelijk openstaand bedrag bestaat.
- Overzicht onderscheidt facturen uit de gekozen periode, omzet/kosten/resultaat en werkelijke geldstromen. Recent ingevoerde betalingen staan ook buiten het gekozen betaaldatumbereik zichtbaar. Bedragen verwijzen naar bronnen. De gekozen maand, het kwartaal, jaar of aangepaste periode is expliciet.
- Inkomsten, Uitgaven en Winst hebben een eigen menuknop. Omzet wordt niet gelijkgesteld aan ontvangst. Kostenbronnen en betalingen blijven afzonderlijk. Gemengde bankmutaties worden als volledige bron verklaard, zonder ze nogmaals bij de factuurontvangsten op te tellen.
- Bank/Kas toont categorie, gekoppelde factuur/btw-periode, rekening, betaaldatum, beschikbaar bedrag, effecten en correctiehistorie. Filters voor omschrijving/klant/factuur, bedrag, datums, categorie, rekening, bank/kas en richting. Onbekende beginstand blijft onbekend.
- Btw maakt onderscheid tussen de actuele berekening, een expliciet vastgelegde werkelijke aangifte en daadwerkelijke betalingen/teruggaven. Een selectie die een aangifteperiode doorsnijdt of onvolledig dekt krijgt geen verzonnen openstaand aangiftesaldo.
- Btw-betaling of teruggaaf: datum, bedrag, rekening/kas, kenmerk en toelichting; eerst serverberekend effect, daarna expliciete bevestiging. Deelbetalingen, bestaande bankmutatie, verschilverklaring, koppeling herstellen en gecontroleerde tegenboeking zijn ondersteund. Een latere CSV-bron kan aan dezelfde btw-bankmutatie worden gehecht.

Bij een verloren antwoord blijft dezelfde aanvraag in tijdelijk tabbladgeheugen beschikbaar voor opnieuw proberen. Een PT409 vraagt verversen en opnieuw beoordelen; er is geen automatische overschrijflus. Sessiewissel ruimt privéconcepten op. Geen herstel na het sluiten van een tabblad beloofd.

## Berekeningen en boekingen

Alle geldbedragen zijn gehele centen. Ontvangsten gebruiken de werkelijke bank-/betaaldatum; registratietijden worden afzonderlijk in Europe/Amsterdam getoond. De factuurgroep op het dashboard gebruikt factuurdatums met betaalstand tot het periode-einde. Btw volgt de bestaande bevestigde methode per document; kasstelsel gebruikt cumulatieve centafronding. De oefeninstelling 21%/factuurstelsel is geen keuze voor de owner.

Winst = geboekte omzet exclusief btw − zakelijke kosten zonder aftrekbare btw. Niet-aftrekbare btw kan wel tot kosten behoren. Privéstorting/opname, eigen overboeking, leningaflossing en btw-afdracht worden niet als omzet of gewone kosten geboekt.

Een nieuwe btw-betaling maakt één bankuitgave met de bestaande tussenrekening, gevolgd door een koppeling aan rekening 1850 (belastingbetalingen). Een teruggave heeft het tegengestelde teken. De btw-berekening, omzet, kosten en winst veranderen hierdoor niet. Een vastgelegde aangifte maakt geen geldboeking. Een afwijkend werkelijk aangiftebedrag vraagt een toelichting; APPFMZ verzint geen kostenboeking voor het verschil. Het indienen van aangifte en werkelijk overmaken gebeuren buiten APPFMZ.

## Database, rechten en herstelpad

Uitsluitend `20261018073658_appfmz_vat_settlements.sql` is transactioneel toegepast. SHA-256 `51254833ccb1085661b7c145a370616ff61dda39166b553985fa6159d5a6a53f`.

Deze voegt twee recordsoorten, zeven functies, één beveiligende banktrigger en de bijbehorende RPC-grants toe. Geen oorspronkelijke rijen herschreven, geen Auth/Edge-wijziging, geen historische replay of migration repair. De btw-tussenrekening ontstaat pas wanneer de bevoegde owner een toekomstige btw-betaling bevestigt. De bestaande geverifieerde owner- en actuele sessiecontrole blijft leidend. Publieke wrappers zijn security invoker; private helpers zijn voor gewone gebruikers niet rechtstreeks uitvoerbaar. RLS blijft ingeschakeld.

[Schema-identiteit](examples/finance-20261018/schema-identity.json): productie-functiebody's, constraint, trigger en applicatierechten komen overeen met de lokale SQL-tests. De bestaande Supabase-default voor de al bevoegde `service_role` is apart verklaard; deze was niet aanwezig in de lokale fixture. [Migrationlijst](examples/finance-20261018/migration-list.txt) en [dry-run](examples/finance-20261018/dry-run.txt): twaalf canonical versies, productie up-to-date.

Vóór toepassing is een nieuw versleuteld checkpoint buiten Git/OneDrive gemaakt. Alle applicatierijen en oorspronkelijke constraints zijn lokaal teruggezet en vergeleken; drie originele private bestanden zijn versleuteld opgeslagen, ontsleuteld en geverifieerd. Auth- en Storage-metadata zitten in het private checkpoint. Er is niets over productie teruggezet.

Terugval: vorige frontend terugzetten als de nieuwe interface niet werkt; de aanvullende API blijft compatibel. Geen oude onveilige rechten herstellen en geen checkpoint over nieuwere invoer terugzetten. Een bevestigde echte boeking vereist de gewone gecontroleerde correctieroute met historie.

## Cursus, handleiding en video

De 27 bestaande les-ID's en 12 beginnersstappen blijven behouden. Toegevoegd: twaalf veilige financiële oefeningen met dezelfde schermen en betaalvensters, vaste fictieve gegevens en tijdelijk geheugen in de bestaande sandbox. Geen productie-API of uploads vanuit de oefening. Voortgang blijft behouden.

De handleiding is uit dezelfde inhoudsbestanden opgebouwd tot 106 A4-pagina's, inclusief begrippen, werklijsten, hoofdstuklinks en de nieuwe btw-route. Alle pagina's gerenderd; gewijzigde pagina's visueel gecontroleerd. Fiscale uitleg is getoetst aan actuele primaire Belastingdienst-bronnen in de lessen en achterin de handleiding, waaronder factuurstelsel, kosten, voorbelasting en afronding. Geen bedrijfsinstellingen gewijzigd.

De nieuwe volledige film vervangt de oude video in de huidige cursusinterface: twintig hoofdstukken, 119 werkelijk opgenomen synthetische scènes. De [dekkingslijst](APPFMZ_SPOKEN_COURSE_COVERAGE_20261018.md) verantwoordt ieder onderdeel en de externe grenzen. [Kijklink](https://appfmz.nl/tutorial.html?video=1), ook via Administratie → Uitleg & oefenen.

Stem: Nederlandse Microsoft Colette (`nl-NL-ColetteNeural`, −4% tempo), via de kosteloze bestaande Edge-voorleesdienst met `edge-tts` 7.3.1. Dit is een online gegenereerde stem, geen lokale Piper-stem. Alleen het openbare fictieve script is doorgestuurd. Geen account, betaald abonnement, banktoegang of nieuwe AI-kosten; kosten €0. De audio wordt in de MP4 ingebakken als AAC/48 kHz en genormaliseerd. [Techniek](https://github.com/rany2/edge-tts).

De speler biedt Nederlandse ondertitels, transcript, hoofdstukken, pauze, terugspoelen, snelheid, zichtbaar volume, dempen, volledig scherm waar ondersteund en hervatten per videoversie op dit apparaat. De aparte fiscale oefenronde en de volledige film gebruiken verklaarde, verschillende voorbeeldbronnen; de bedragen worden niet vermengd.

## Controlebewijs

[Echte PostgREST-proef](examples/finance-20261018/production-api.json): drie afzonderlijke gemarkeerde testaccounts; €200 + €150 en bestaande ontvangst; gelijktijdige/dubbele aanvraag; btw €20 + €40 met expliciet verklaard aangifteverschil; teruggave; volledige rollback bij HTTP409/PT409; koppeling herstellen; geen extra omzet/btw/winst; opnieuw aanmelden; lid, andere trainer en ingetrokken sessie geweigerd. Eén conflictantwoord in 85 ms.

Lokale regressies en browserproeven omvatten onder meer 320/390/768/844/1440 px, Edge en WebKit, vergroten van tekst, herladen, sessies, privacy, gesloten perioden, CSV-bronbehoud en correcties. Dit is browseremulatie op Windows, geen fysieke iPhone/Safari-installatie. De oorspronkelijke btw- en betaalinstellingen zijn niet afgeleid uit aannames.

De security-advisor geeft dezelfde bestaande meldingen: deny-by-default-tabellen zonder directe policies, `pg_net` in public en uitgeschakelde leaked-password protection. Geen nieuwe melding door de btw-route en geen ongevraagde infrastructuurwijziging. [Database-linter](https://supabase.com/docs/guides/database/database-linter), [wachtwoordbeveiliging](https://supabase.com/docs/guides/auth/password-security).

## Afzonderlijk bankonderzoek

[ING Zakelijk / provideronderzoek](APPFMZ_BANK_CONNECTION_RESEARCH_20261018.md) vergelijkt Enable Banking en Tink, kostenonzekerheid, synchronisatie, bron-ID's, toestemming en intrekken. Geen koppeling of abonnement geactiveerd. Een toekomstige bankkeuze blijft afzonderlijk.

## Korte fysieke telefoontest

Open de bestaande betaalde facturen en controleer bedrag, werkelijke betaaldatum, rekening en Bank/Kas-link zonder opnieuw te boeken. Bekijk september en oktober naast elkaar. Probeer de btw-deelbetaling en teruggave uitsluitend in Uitleg & oefenen. Speel hoofdstuk 17 af, test geluid/ondertitels/volume, sluit de cursus en hervat. Bevestig daarna de leesbaarheid en hoorbaarheid in de geïnstalleerde iPhone-app.

## Definitieve cursusbestanden en hoofdstukken

Speelduur: **54 minuten en 17 seconden** (3256,667 s). MP4: H.264/yuv420p, AAC mono 48 kHz, Nederlandse ondertitels en faststart. Grootte 73892420 bytes; SHA-256 `ca941e7b67897ca5036436ada3e33a9e45b709becb5d8ac4be2406bb3d9c5b0e`. De volledige audiotrack is gedecodeerd en op hoorbaar signaal gecontroleerd; zie [media-controle](examples/spoken-course/media-verification.json).

| Vanaf | Hoofdstuk |
|---|---|
| 00:00 | 1. Welkom en het administratieoverzicht |
| 02:37 | 2. Bedrijfsgegevens, rekeningen en beginstand |
| 04:52 | 3. Klant, pakket en maand of vier weken |
| 07:11 | 4. Factuurconcept, trainingsregels en korting |
| 09:33 | 5. Definitief maken, PDF en bewust delen |
| 11:55 | 6. Een volledige betaling registreren |
| 14:14 | 7. Bank/Kas en het boekingsspoor controleren |
| 16:05 | 8. Deelbetaling: €200 en daarna €150 |
| 18:07 | 9. Een bestaande bankontvangst koppelen |
| 20:14 | 10. Een betaalfout corrigeren met historie |
| 25:00 | 11. Contant ontvangen en zakelijke uitgaven |
| 27:15 | 12. Openstaande en te late facturen |
| 28:55 | 13. Annuleren, credit en echte terugbetaling |
| 31:03 | 14. Privégeld en eigen overboekingen |
| 33:06 | 15. Bankstand vergelijken met een afschrift |
| 34:45 | 16. CSV-import en mogelijke duplicaten |
| 37:26 | 17. Inkomsten, uitgaven, winst en volledige btw-verwerking |
| 47:00 | 18. Exporteren en een periode afsluiten |
| 49:08 | 19. Leningen en bedrijfsmiddelen |
| 51:22 | 20. Historie, bewijs, grenzen en zelfstandig verder |

[Opname-identiteit](examples/finance-20261018/capture.json): alle 119 scènes uit de definitieve interface, zonder externe aanvragen. Alleen het cursus-startdocument is daarna van CRLF naar LF genormaliseerd; de inhoud is gelijk. De oudere korte MP4’s en bijbehorende losse ondertitels zijn uit de huidige publicatie verwijderd.

## Screenshots en regressies

Uitsluitend synthetische gegevens; alle apparaten hieronder zijn browseremulatie.

- [Financieel overzicht — telefoon](images/finance-20261018/overview-390.png) en [laptop](images/finance-20261018/overview-1440.png).
- [Btw — telefoon](images/finance-20261018/vat-390.png) en [laptop](images/finance-20261018/vat-1440.png).
- [Veilig oefenen — telefoon](images/finance-20261018/practice-vat-mobile.png).
- [Cursusspeler — Edge](images/spoken-course/player-edge-laptop.png) en [WebKit](images/spoken-course/player-webkit-iphone-emulation.png).

[Regressieoverzicht](examples/finance-20261018/regressions.json): de brede reeks bevatte 68 controles, waarvan 67 direct slaagden. Eén test verwees nog naar de verwijderde korte video; de bijgewerkte test en drie gerelateerde herstel-/PDF-controles slagen. De eerdere cursusverwachting van negen overzichtspunten is bijgewerkt naar twaalf; alle 27 lessen en oefeningen zijn opnieuw doorlopen. De geïsoleerde cursus-, privacy-, financiële en mobiele hertests slagen. Een Windows-sandboxfout bij het starten van Edge is met dezelfde tests buiten die sandbox opgelost. Geen applicatiefout als geslaagde test gepresenteerd.

[Herstelproef vóór wijziging](examples/finance-20261018/backup-restore.json), [beveiligingscontrole](examples/finance-20261018/security.json) en [volledige gewijzigde bestandenlijst](examples/finance-20261018/changed-files.txt).

De definitieve Edge/WebKit-mediatest slaagt op de nieuwe MP4, inclusief gedecodeerde AAC, 523 ondertitelcues, hoofdstukken, snelheid, terugspoelen, volume, behouden lesvoortgang en hervatten. Daarbij is een echte WebKit-race hersteld: metadata kon beschikbaar zijn voordat doorspoelen mogelijk was. De speler wacht nu op de beschikbare seekrange en bewaart de opgeslagen positie totdat hervatten is gelukt. Een tijdelijke nulpositie wist de voortgang niet meer. [Browserbewijs](examples/spoken-course/browser.json).
