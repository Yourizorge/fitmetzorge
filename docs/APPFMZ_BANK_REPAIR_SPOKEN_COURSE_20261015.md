# APPFMZ — bevestigd Bank/Kas-herstel en volledige gesproken cursus

Uitsluitend `Yourizorge/fitmetzorge`, `appfmz.nl`, productieproject `hgoygcviutmynaihcvpd`. Begonnen vanaf `3db0806`; de ondertussen gepubliceerde wijzigingen tot `d8a64420d85a5aca129866d1ff827c2a185f65cf` zijn opgehaald en geïntegreerd. Hun betaalhistorie, rekeningcodes, expliciete correctiebevestiging, bestaande-ontvangstoefening, korte gesproken herstelvideo en platformonafhankelijke handleidinggenerator blijven behouden.

Status: **gepubliceerd en technisch gecontroleerd — PASS**. De door de owner bevestigde historische correctie is uitgevoerd; de oorspronkelijke facturen zijn behouden. De app is live zonder onderhoud. De fysieke iPhoneproef en owneracceptatie blijven afzonderlijk.

## Herstel en bediening

De owner heeft de vier afzonderlijk beschreven historische invoerfouten expliciet bevestigd. Alleen die twee beginstanden en twee handmatige bankmutaties zijn gecontroleerd hersteld, inclusief de twee factuurkoppelingen bij de foutieve ontvangst. Er is geen algemene reset uitgevoerd. De feitelijke personen, bedragen en record-ID's staan uitsluitend in het privéhersteloverzicht, niet in dit publieke rapport.

De twee beginstanden zijn teruggezet naar **onbekend**, niet naar een verondersteld nulsaldo. De originele facturen, nummers, PDF's, maandafspraken en documenten zijn behouden. Hun openstaande bedragen volgen opnieuw uit de gecorrigeerde koppelingen. Er zijn geen nieuwe facturen, factuurnummers, omzet- of btw-boekingen gemaakt om dit te herstellen. Een tegenboeking is geen daadwerkelijke bankbetaling of terugbetaling.

De bestaande betaalactie ontbrak bij de betrokken facturen doordat hun eerdere koppelingen ze administratief al volledig betaald maakten. De UI toont nu **Betaling registreren** bij een geschikt openstaand document en **Betalingen bekijken / corrigeren** bij de bestaande facturen. De historie verklaart dat een administratieve koppeling geen bevestiging door de bank is.

Bij een werkelijke betaling kiest de owner bedrag, werkelijke betaaldatum en rekening/kas. Eén bevestigde opdracht verwerkt ontvangst en factuurkoppeling. Een bestaande ontvangst kan worden geselecteerd zonder een tweede bankmutatie. De status volgt uit de boekingen; een vrijblijvende betaald/onbetaald-vink zonder ontvangstbewijs zou onjuiste financiële gegevens creëren en is niet toegevoegd.

**Corrigeren / Foutieve invoer herstellen** toont eerst een serverberekend effect op Bank/Kas en alle getroffen facturen. Daarna is een bewuste aangevinkte bevestiging nodig. Alleen een verkeerde koppeling herstellen houdt de echte ontvangst beschikbaar. Een geheel foutieve handmatige invoer krijgt tegenboekingen. De beginstand kan worden vervangen door een gecontroleerd afschriftsaldo of teruggezet naar onbekend. Geïmporteerde bankbronnen, complexe verdelingen, afgesloten perioden en afgestemde rekeningen worden niet blind gecorrigeerd.

Verloren antwoorden behouden dezelfde aanvraagidentiteit in tijdelijk tabbladgeheugen. Opnieuw proberen maakt geen tweede correctie. PT409 vereist verversen en opnieuw beoordelen; een nieuw voorstel vraagt opnieuw bevestiging. Sessiewissel ruimt de privéconcepten op. Geen herstel na tabbladsluiting beloofd.

## Herstelpunt, database en behoud

Vóór de aanvullende migration en historische correctie is een privé versleuteld herstelpunt buiten Git en OneDrive gemaakt. Ontsleuteling, inhoudshashes, de 20 applicatietabellen, oorspronkelijke constraints en drie originele private bestanden zijn gecontroleerd. Auth- en Storage-metadata zijn onderdeel van het versleutelde checkpoint. De functionele proeven en alle schermopnamen gebruiken afzonderlijke synthetische gegevens.

`20261015152613_appfmz_bank_repair.sql` was bij het eerste onderzoek reeds geregistreerd in productie. De SQL is toen read-only teruggevonden en inhoudelijk vergeleken; later bevestigde de nieuwe remote HEAD de bijbehorende Git-herkomst. Deze migration is **niet opnieuw uitgevoerd**. De geregistreerde SQL-SHA-256 is `ba85fe0707fd91503bc8adce6931eff35333e2b834dbe284129cd54e1479892c`.

Uitsluitend de voorbereide en geteste aanvulling `20261015154448_appfmz_unknown_opening_repair.sql` is via een vooraf gecontroleerde CLI-uitrol toegepast. Deze wijzigt twee bestaande herstelfuncties zodat een expliciet afgekeurde beginstand onbekend mag worden; geen dataconversie, nieuwe tabel of verruiming van rechten. De twee functiebody's zijn exact gelijk aan productie: [identiteitsbewijs](examples/bank-repair/function-identity.json). Alle elf lokale en remote migrationversies zijn gelijk; de expliciete `db push --dry-run --skip-vault` meldt up-to-date. Geen replay, repair of reset.

De goedgekeurde historische correcties zijn in één guarded transactie uitgevoerd via de gecontroleerde herstelroute, met vaste request-ID's en controle van de oorspronkelijke rijen en versies. De transactie controleerde bovendien dat de originele factuurdocumenten, instellingen en nummerreeks exact gelijk bleven en beide getroffen facturen het verwachte restant kregen. Bij afwijking zou de hele transactie zijn teruggerold.

[Behoudsbewijs](examples/bank-repair/approved-preservation.json): zes correctieregels, zes journaalposten, twaalf regels, vier auditregels en vier verzoekbewijzen toegevoegd; negentien overige tabelhashes gelijk. De oorspronkelijke regels en redenen blijven bewaard. Functies, policies en rechten zijn door deze historische correctie niet veranderd. De drie oorspronkelijke private bestanden zijn daarna opnieuw read-only opgehaald en byte-identiek bevonden. Geen bestaande memberdata, foto, afspraak, klantprofiel, betaalafspraak of PDF verwijderd.

De [security-advisor](examples/bank-repair/migration-security.json) heeft geen nieuwe melding: bestaande deny-by-default-tabellen zonder directe policies, [pg_net in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) en [uitgeschakelde leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Geen ongevraagde Auth- of infrastructuurwijziging.

## Volledige gesproken cursus

[Kijklink](https://appfmz.nl/tutorial.html?video=1), ook via **Administratie → Uitleg & oefenen → Gesproken videocursus bekijken**. Eén complete rondleiding, twintig afzonderlijk afspeelbare hoofdstukken, 104 daadwerkelijk opgenomen scènes. De [dekkingslijst](APPFMZ_SPOKEN_COURSE_COVERAGE_20261015.md) koppelt ieder administratieonderdeel aan een hoofdstuk of een expliciete externe grens.

De cursus gebruikt FitMetZorge Oefenbedrijf, Noor Voorbeeld en Sam Oefen. De echte gebouwde interface werkt voor de opname tegen een geïsoleerde lokale SQL-administratie. Alleen de oefenklok, OEFEN-nummerreeks, banner en ongeldige PDF-watermerken wijken af. Cursoraccenten tonen daadwerkelijke klikken. Echte opnamebeelden worden rustig verdeeld over de gesproken uitleg en het laatste beeld blijft staan om bedragen te lezen; geen verzonnen schermen of opname van klantgegevens.

De Nederlandse stem `nl_NL-ronnie-medium` is kosteloos lokaal met Piper gegenereerd en als AAC in de MP4 opgenomen. Geen externe spraak-/AI-dienst of kosten. [Piper-documentatie](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md), [stemmodelkaart](https://huggingface.co/rhasspy/piper-voices/raw/main/nl/nl_NL/ronnie/medium/MODEL_CARD).

De speler ondersteunt pauze, tien seconden terug, herhalen, hoofdstukken, volledige rondleiding, snelheid, ondertitels en vergroten/verschuiven. Het Nederlandse transcript staat per hoofdstuk en is downloadbaar. De 12 beginnersstappen verwijzen naar de juiste hoofdstukken; de 27 verdiepende lessen en bestaande voortgang blijven behouden. De handleiding is uit dezelfde bronnen vernieuwd naar 92 A4-pagina's, met hoofdstuklinks en de herstelroute. Alle pagina's zijn gerenderd; de gewijzigde pagina's zijn visueel gecontroleerd.

Fiscale uitleg is op 15 oktober 2026 gecontroleerd aan primaire Belastingdienst-bronnen, gekoppeld per les en achterin de handleiding. 21% en factuurstelsel zijn alleen de fictieve voorbeeldinstellingen; er is niets aan de fiscale keuzes van de owner veranderd. De app doet geen belastingaangifte, bankoverschrijving, daadwerkelijke terugbetaling of automatische verzending. Agenda en aanwezigheid maken geen financiële boeking.

## Hoofdstukken en speelduur

De volledige film duurt **49 minuten en 44 seconden** (2.983,833 s), met 449 Nederlandse ondertitelregels en 104 opgenomen scènes.

| Nr. | Start | Hoofdstuk |
|---|---|---|
| 1 | 0:00 | [Welkom en het administratieoverzicht](https://appfmz.nl/tutorial.html?video=1&chapter=1) |
| 2 | 2:36 | [Bedrijfsgegevens, rekeningen en beginstand](https://appfmz.nl/tutorial.html?video=1&chapter=2) |
| 3 | 5:00 | [Klant, pakket en maand of vier weken](https://appfmz.nl/tutorial.html?video=1&chapter=3) |
| 4 | 7:30 | [Factuurconcept, trainingsregels en korting](https://appfmz.nl/tutorial.html?video=1&chapter=4) |
| 5 | 9:58 | [Definitief maken, PDF en bewust delen](https://appfmz.nl/tutorial.html?video=1&chapter=5) |
| 6 | 12:27 | [Een volledige betaling registreren](https://appfmz.nl/tutorial.html?video=1&chapter=6) |
| 7 | 14:47 | [Bank/Kas en het boekingsspoor controleren](https://appfmz.nl/tutorial.html?video=1&chapter=7) |
| 8 | 16:46 | [Deelbetaling: €200 en daarna €150](https://appfmz.nl/tutorial.html?video=1&chapter=8) |
| 9 | 18:54 | [Een bestaande bankontvangst koppelen](https://appfmz.nl/tutorial.html?video=1&chapter=9) |
| 10 | 21:10 | [Een betaalfout corrigeren met historie](https://appfmz.nl/tutorial.html?video=1&chapter=10) |
| 11 | 26:14 | [Contant ontvangen en zakelijke uitgaven](https://appfmz.nl/tutorial.html?video=1&chapter=11) |
| 12 | 28:38 | [Openstaande en te late facturen](https://appfmz.nl/tutorial.html?video=1&chapter=12) |
| 13 | 30:23 | [Annuleren, credit en echte terugbetaling](https://appfmz.nl/tutorial.html?video=1&chapter=13) |
| 14 | 32:36 | [Privégeld en eigen overboekingen](https://appfmz.nl/tutorial.html?video=1&chapter=14) |
| 15 | 34:48 | [Bankstand vergelijken met een afschrift](https://appfmz.nl/tutorial.html?video=1&chapter=15) |
| 16 | 36:33 | [CSV-import en mogelijke duplicaten](https://appfmz.nl/tutorial.html?video=1&chapter=16) |
| 17 | 39:23 | [Omzet, ontvangsten, kosten en btw](https://appfmz.nl/tutorial.html?video=1&chapter=17) |
| 18 | 41:58 | [Exporteren en een periode afsluiten](https://appfmz.nl/tutorial.html?video=1&chapter=18) |
| 19 | 44:18 | [Leningen en bedrijfsmiddelen](https://appfmz.nl/tutorial.html?video=1&chapter=19) |
| 20 | 46:40 | [Historie, bewijs, grenzen en zelfstandig verder](https://appfmz.nl/tutorial.html?video=1&chapter=20) |

## Controlebewijs

- [Echte Auth/PostgREST-proef](examples/bank-repair/production-api.json): eigen synthetische accounts, gelijktijdige dubbele aanvraag, verloren antwoord, één correctie, ongewijzigde factuur, alleen koppeling herstellen, geen tweede omzet/btw, onbekende beginstand, opnieuw inloggen; lid en andere trainer geweigerd. Conflict: één PT409/HTTP409 in 129 ms met volledige rollback.
- SQL-pariteit tussen de veilige oefenmodus en de echte financiële functies; alle twaalf beginnersstappen, bestaande voortgang en nul financiële/API-opdrachten vanuit de sandbox gecontroleerd.
- Gerenderde herstel- en betaalflows op 320/390/768/844/1440px, met expliciete preview en bevestiging, verloren antwoord, herhaling, herladen en opnieuw aanmelden. Alleen synthetische beelden: [telefoon](images/bank-repair/combined-preview-390.png), [laptop](images/bank-repair/combined-preview-1440.png).
- [Videomontage en controles per scène](examples/spoken-course/montage.json), [native browsercontrole](examples/spoken-course/browser.json). Edge en WebKit emuleren telefoon/laptop; dit is geen fysieke iPhoneproef. Definitieve mediabytes en productiecontroles staan hieronder.

[Regressiebewijs](examples/spoken-course/regressions.json): 63 onderdelen in de brede ronde, 62 direct PASS. Een dubbele beginstandselector na de integratie is hersteld; de volledige betreffende boekhoudflow slaagde opnieuw. De aparte definitieve media-/handleidingronde had 3 PASS. Daarmee hebben 64 unieke testonderdelen een geslaagd eindresultaat, zonder skips. Dit omvat alle bestaande regressies, de geërfde Bank/Kas-tests en de nieuwe herstel-/oefencontroles.

[Definitieve mediacontrole](examples/spoken-course/media-verification.json): 68.004.871 bytes, H.264 + AAC mono/48 kHz, volledige audiotrack gedecodeerd; gemiddelde −18,8 dB, piek −1,4 dB. Geen stil videobestand. SHA-256 `a04795d6172356c4133f5f6e5a90388e3332d1e830a8599d8287cbbf3b8cbfb8`. Edge decodeerde de AAC-track; Edge en WebKit speelden dezelfde MP4, hoofdstuksprongen, pauze, terugspoelen, snelheid en ondertitels af. Licht/donker-contrast en zichtbaarheid onder de vaste cursusnavigatie gecontroleerd. Ook de gepubliceerde cursus heeft deze browsercontroles doorlopen. De fysieke iPhoneacceptatie volgt afzonderlijk.

## Definitieve publicatie en behoudscontrole

Runtimecommit: [`cd5870ee23ec414890a0bfc730580d331f931523`](https://github.com/Yourizorge/fitmetzorge/commit/cd5870ee23ec414890a0bfc730580d331f931523), normaal gepusht naar `codex/admin-spoken-course-20261015` en met fast-forward naar `main`. [GitHub Pages-uitrol 38774876562](https://github.com/Yourizorge/fitmetzorge/actions/runs/38774876562) is succesvol afgerond.

- [Live bestandsbewijs](examples/spoken-course/live-assets.json): alle 80 gecontroleerde bestanden byte-identiek aan de runtimecommit, inclusief MP4, manifest, ondertitels, transcript, handleiding en cursusbestanden. De beschermde trainings-, voedings-, foto-, factuur/PDF-, agenda-, PWA- en Edge-runtime bleef byte-identiek aan `d8a64420`. Geen wijziging aan staging, AI of bedrijfswebsite.
- [Live betaal-/herstelproef](examples/bank-repair/live-browser.json): daadwerkelijk aanmelden op appfmz.nl met uitsluitend eigen gemarkeerde testaccounts, zichtbare betaalactie, bestaande ontvangst koppelen zonder tweede bankmutatie, geen tweede omzet/btw, herladen en opnieuw aanmelden. De correctiepreview schrijft niets; na expliciete bevestiging blijft de originele factuur en de echte bronontvangst behouden. Gerenderd op 390 en 1440 pixels: [telefoonemulatie](images/bank-repair/live-repair-390.png), [laptop](images/bank-repair/live-repair-1440.png).
- [Live mediaproef](examples/spoken-course/live-browser.json): de gepubliceerde MP4 speelt in Edge en WebKit. AAC-decodering in Edge bewezen, geluid niet gedempt, juiste speelduur, twintig hoofdstukken, ondertitels, pauze, terugspoelen, snelheid en bestaande cursusvoortgang gecontroleerd. [Edge](images/spoken-course/player-live-edge-laptop.png) en [WebKit/iPhone-emulatie](images/spoken-course/player-live-webkit-iphone-emulation.png). Geen fysieke Safari-/iPhonehoorbaarheid geclaimd.
- De drie eigen testaccounts en hun geïsoleerde administratie zijn na deze proeven verwijderd via de vooraf gecontroleerde marker-beveiligde transactie en Auth-route. Geen originele financiële historie of documenten verwijderd, geen e-mails verstuurd.
- [Eindbewijs gegevensbehoud](examples/bank-repair/final-preservation.json): vergelijking met het oorspronkelijke versleutelde checkpoint vóór de testaccounts. Negentien van 24 tabellen zijn volledig gelijk. In de vijf financiële tabellen zijn uitsluitend de vier goedgekeurde correcties aanwezig: acht bestaande regels aangepast volgens die opdrachten, zes correctieregels, zes exacte tegenjournaalposten, twaalf tegenregels, vier auditregels en vier verzoekbewijzen. Alle oorspronkelijke journaalregels en audit-/verzoekhistorie bleven gelijk; originele factuurdocumenten, betaalafspraken, Auth-rijen en drie private bestanden zijn exact behouden. Functies, policies en grants zijn gelijk aan direct na de goedgekeurde reparatie.
- De eerste eindcontrole gebruikte een tussenopname waarin de eigen testaccounts nog stonden. De verificatie is daarom aangescherpt naar de oorspronkelijke versleutelde rijen en exact toegestane correcties; er is geen productieherstel of aanvullende datamutatie uitgevoerd om een vergelijking passend te maken. De CLI-arraystructuur wordt expliciet gevalideerd.
- Migrationlijst opnieuw gecontroleerd: elf lokale en remote versies gelijk; `db push --dry-run --skip-vault` opnieuw **Remote database is up to date**. Geen tweede toepassing van SQL.

De vervolgcommit voegt uitsluitend dit rapport, het gesaneerde live controlebewijs en het aangescherpte read-only controlescript toe. Alle gepubliceerde runtime- en mediabestanden blijven daarbij ongewijzigd.

## Afzonderlijk bankonderzoek en terugval

[ING/provideronderzoek](APPFMZ_BANKKOPPELING_ONDERZOEK_20261015.md) vult het eerdere onderzoek aan. Geen banktoegang, abonnement of betaalde koppeling geactiveerd. Exacte commerciële voorwaarden en dekking van het rekeningtype vereisen een afzonderlijke ownerkeuze; dit blokkeert de huidige herstelbediening niet.

Bij een frontendprobleem kan de nieuwe cursus/herstelingang worden teruggezet naar de gecontroleerde vorige frontend. De veilige aanvullende API blijft compatibel. Geen oude brede rechten herstellen, geen SQL terugspelen en geen databaseback-up over nieuwere invoer zetten. Een reeds bevestigde correctie blijft als historie bestaan; een nieuwe correctie vraagt een nieuw actueel voorstel.

## Korte telefoontest na publicatie

Open de bestaande facturen, controleer het restant en de knop **Betaling registreren**. Registreer alleen werkelijk ontvangen geld met de echte datum en rekening; selecteer een bestaande ontvangst als die er al staat. Probeer eerst in **Uitleg & oefenen** een deelbetaling en foutcorrectie. Start gesproken hoofdstuk 10 en bevestig op de eigen iPhone dat stem, beeld, ondertitels, pauze en hoofdstukken begrijpelijk werken. Dit rapport legt geen fysieke owneracceptatie vast.
