# APPFMZ ledenroute en facturatieplanning — werkrapport

Status: **IN UITVOERING — NIET GEPUBLICEERD**. Dit is geen release-PASS of owneracceptatie.

Scope: `Yourizorge/fitmetzorge`, `appfmz.nl`, Supabase `hgoygcviutmynaihcvpd`. Uitgangscommit en read-only gecontroleerde remote main: `309cb0db3569f14ac54442c8daec678020ba149a`. Werkbranch: `codex/members-billing-20261026`.

## Voorrang 2 november: eerst owner-laptoptest

De gewone nieuwe productieroutes, drie migrations en nieuwe Edge-functies blijven UIT. Deze branch bewaart de voorbereide implementatie en tests; zij is geen volledige productierelease. Alleen het afzonderlijke owner-testpakket mag via een release vanaf309cb0 worden gepubliceerd. Cursusaanvullingen/video’s zijn voorlopige opnamen en nog niet vrijgegeven als actuele instructie. Zie APPFMZ_OWNER_LAPTOP_TEST_20261102.md.

## Nulmeting en behoud

Op 26 oktober 2026 is een nieuw versleuteld checkpoint buiten Git en OneDrive gemaakt. Twintig bestaande applicatietabellen zijn met hun constraints in een lokale database teruggezet en op rij-inhoud gecontroleerd. Vijf bestaande private bestanden zijn versleuteld bewaard, ontsleuteld en bytegewijs gecontroleerd. Auth- en Storage-metadata blijven uitsluitend in het private checkpoint. Er is niets over productie teruggezet.

[Gesaneerde nulmeting](examples/members-20261026/baseline.json) bevat Git-runtimehashes, checkpointidentiteit en herstelcontrole, zonder klantgegevens. De productiecatalogusfunctie komt overeen met de bestaande canonical migration na LF-normalisatie en verwijderen van buitenste witruimte. Alle twaalf bestaande migrations stonden lokaal en remote gelijk. Er is nog geen nieuwe migration toegepast.

Patrick, Debora en andere bestaande maandklanten worden niet omgezet. Bestaande overeenkomstversies, facturen, nummers, PDF's, betalingen en boekingen worden niet herschreven. De nieuwe inschrijfroute reserveert geen Auth-account tijdens conceptinvoer.

## Gecontroleerde bron en open beslissingen

De eigenaar verwees naar de [officiële tarieven](https://fitmetzorge.com/tarieven.html) en [voorwaarden](https://fitmetzorge.com/voorwaarden.html). De bronpagina's zijn uitsluitend gelezen en als controlebewijs opgeslagen in [legal-source](examples/members-20261026/legal-source/voorwaarden.html). Bevestigd voor nieuwe overeenkomsten: 28 dagen, dertien perioden per jaar, inclusief btw, vier weken opzegtermijn, kosteloos afzeggen tot 24 uur vooraf, daarna de training in rekening brengen. De bestaande afspraken blijven onveranderd.

De eigenaar heeft op 26 oktober expliciet **€500 en €660 voor nieuwe Duo Progressie- en Transformatie-overeenkomsten** gekozen. De oude APPFMZ-broncatalogus bevatte €520 en €780. Nieuwe versiegebonden snapshots krijgen de bevestigde tarieven; oude prijsafspraken worden niet omgerekend.

De [privacy-pagina](https://fitmetzorge.com/privacy.html) zegt expliciet dat de volledige definitieve privacyverklaring nog moet worden toegevoegd. De later toegestuurde tekst betreft de algemene betaal-, opzeg- en afzegvoorwaarden. Een complete verklaring voor de gevraagde gezondheidsinformatie, handtekeningen en documenten is daarmee nog niet aangetoond. Definitieve ondertekening blijft geblokkeerd totdat de geldende privacyinformatie is aangeleverd en gecontroleerd. Synthetische tests gebruiken duidelijk gemarkeerde testteksten, nooit als geldende klantvoorwaarden.

## Lokale implementatie en toelating

Drie agents werken parallel met gescheiden bestanden aan leden, facturatieplanning en communicatie. De hoofdagent integreert gedeelde schermen, testpreview, nulmeting en releasecontrole. Nieuwe SQL staat uitsluitend in vooruitwerkende migrations, aangemaakt met de Supabase-CLI. Historische SQL wordt niet opnieuw uitgevoerd.

De volledige keten moet nog worden toegelaten: zoeken → concept → ondertekenen → serververificatie PDF → atomair lid/overeenkomst/betaalafspraak → profiel/documenten → foto/bewerken → facturatieplanning → gecontroleerde verzending. Lokale tests en browseremulatie zijn geen productie- of fysieke iPhone/mailbox-PASS.

Mailboxkoppeling: onderzoek wijst op TransIP SMTP/TLS 465 en IMAP/TLS 993. Geen nieuwe betaalde dienst. Mailboxgeheimen horen uitsluitend in serversecrets, nooit in chat, Git, browser of rapport. Automatisch verzenden staat standaard uit. SMTP-acceptatie en archivering in Verzonden zijn afzonderlijke toestanden. Een onzekere SMTP-uitkomst blokkeert automatische herverzending. Echte mailbox- en telefooncontrole zijn nog niet uitgevoerd.

Production touched: uitsluitend read-only checkpoint en statuscontrole tot nu toe. Staging touched: NO. Bedrijfswebsite touched: NO (alleen aangewezen openbare bron gelezen). JARVIS touched: NO.

## Aanvullende bewijsstand op 26 oktober

De eigenaar heeft de bedrijfsnaam **FitmetZorge** en zichzelf als privacycontact via **info@fitmetzorge.com** bevestigd. Zijn akkoord luidde voorwaardelijk: als de verklaring rechtsgeldig en goed is, vindt hij haar goed. Dit is niet als definitieve vaststelling verwerkt. Het [privacyconcept](../output/pdf/APPFMZ-privacyconcept-ter-beoordeling.pdf) bevat nog te beoordelen bewaartermijnen, afzonderlijke gezondheids-toestemming en technische uitvoeringsvoorwaarden. Er is geen actieve productiepolicy ingevoerd. De gecontroleerde Supabase-projectregio is `eu-west-1` (Ierland); dit is geen garantie dat alle leveranciersverwerking uitsluitend binnen de EU plaatsvindt.

De read-only CLI-dry-run (`supabase db push --linked --project-ref hgoygcviutmynaihcvpd --dry-run --skip-vault --agent no`, CLI 2.117.0) selecteerde uitsluitend:

- `20261026154916_appfmz_members.sql`
- `20261026154917_appfmz_billing_planning.sql`
- `20261026154918_appfmz_communication.sql`

Geen SQL is hierdoor uitgevoerd. De nieuwe communicatiescheduler heeft daarnaast een private releasepoort die standaard uit staat. Een dispatch vóór toelating maakt geen concepten, taken, reminders of HTTP-verzoeken. De bestaande agendafuncties en agendacron worden niet veranderd. Activering is pas een afzonderlijke stap na canary en overige releasevoorwaarden.

De brede bestaande regressierun omvatte 98 tests: 97 slaagden; één bestaande prijsverwachting gebruikte nog de oude Duo-bedragen €520/€780. Die verwachting is aangepast naar de expliciet toegestane nieuwe catalogusprijzen €500/€660. De volledige bijbehorende factuurflow is daarna opnieuw geslaagd. Dit wordt niet voorgesteld als één geheel foutloos uitgevoerde 98-test-run. Historische prijsafspraken worden afzonderlijk op behoud getest.

Aanvullende ledencontroles: 13 geslaagde tests over de laatste gerichte runs. De laatste correctie betrof een SQL-variabele/aliassamenloop bij het opruimen van een ongebruikt concept; de nieuwe browserproef slaagde na herstel. Getest zijn onder meer verloren antwoorden, nieuwere invoer tijdens opslag, dubbel navigeren, herladen/opnieuw aanmelden, conflicten, alle zeven inschrijfbare pakketten, rollen, private documenten, deterministische PDF, lokale HEIC-conversie, vervangen/verwijderen en hervatten van een afgebroken opruiming. Ondertekende documenten zijn tegen deze opruimroute beschermd.

Communicatie: 13 gerichte controles geslaagd, inclusief de schedulerpoort, afzonderlijk IMAP-herstel zonder tweede SMTP-verzending en bescherming tegen late antwoorden uit een oude dialoog. SMTP-, IMAP-, daadwerkelijke mailbox- en iPhone-pushproeven zijn nog niet geslaagd of uitgevoerd. De benodigde nieuwe mailboxsecrets ontbreken nog. Er zijn geen echte berichten verzonden. SPF/DMARC/DKIM-DNS is alleen gelezen; een DNS-record is geen bewijs van succesvolle aflevering.

De echte lokale interfaces zijn met Edge en WebKit bekeken op telefoon-, tablet- en laptopformaten, inclusief 200% tekstvergroting. Dit is browseremulatie, geen fysieke iPhone-PASS. De synthetische overeenkomst is visueel gecontroleerd: drie A4-pagina's, geen afgesneden bedrijfsblok, woordafbreking hersteld en oefenwatermerk op iedere pagina.

De bestaande gesproken administratiecursus blijft behouden. Twee aanvullende rondleidingen zijn in voorbereiding: twaalf hoofdstukken over leden en twaalf over planning/communicatie, ieder met 24 echte opgenomen scènes, Nederlandse spraak, ondertitels en transcript. De gekozen Colette-stem gebruikt de bestaande kosteloze Edge-voorleesdienst voor uitsluitend fictieve openbare tekst; dit is geen lokale stem. De definitieve montage-, afspeel- en hashcontroles worden apart vastgelegd voordat de video's als gereed worden aangemerkt.
