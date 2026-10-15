# APPFMZ — betaalhistorie en controleerbaar Bank/Kas-herstel

Bron: `3db0806efc268179a3c805050db12427f5083b27`. Uitsluitend APPFMZ, project `hgoygcviutmynaihcvpd`. Staging, JARVIS en de website zijn niet gewijzigd. Publicatiebewijs wordt apart vastgelegd in `docs/examples/bank-repair/release.json`.

## Oorzaak van de ontbrekende betaalactie

De bestaande UI biedt alleen een nieuwe betaling aan wanneer de factuur een positief openstaand bedrag heeft. Een volledig gekoppelde factuur heeft daarom geen nieuwe betaalknop. Dat is correct tegen dubbele ontvangsten, maar de betaalhistorie en herstelroute waren onvoldoende herkenbaar. Het read-only onderzoek vond bovendien handmatige mutaties en beginstanden waarvoor de eenvoudige UI geen passende tegenboeking bood. De feitelijke historische bedragen, personen en identifiers blijven buiten dit publieke rapport.

## Opgeleverd

- De primaire actie heet **Betaling registreren**. Ook bij reeds betaalde facturen is **Betalingen bekijken / corrigeren** zichtbaar. De betaalhistorie verklaart waarom er geen nieuwe betaalactie is.
- **Alleen deze koppeling herstellen** houdt de bankontvangst beschikbaar. Een gesplitste verdeling wordt als volledige verdeling gepresenteerd; alle getroffen facturen staan in het voorstel.
- **Foutieve invoer herstellen** kan een onjuiste handmatige bankmutatie en haar factuurontvangstkoppelingen gezamenlijk tegenboeken. Het is geen terugbetaling. Geïmporteerd bankbewijs, eigen overboekingen en andere complexe verdelingen worden niet automatisch teruggedraaid.
- **Beginstand corrigeren** vraagt een gecontroleerd bedrag en bronperiode. De oude openingsboeking krijgt een tegenboeking; de nieuwe beginstand en oude historie blijven zichtbaar. Er wordt geen onbekende stand als nul ingevuld.
- Eerst een serverberekend voorstel, daarna een afzonderlijk aangevinkte bevestiging. De bevestiging bindt dezelfde invoer aan de actuele administratie. Een gewijzigde versie geeft een conflict. Een verloren antwoord kan alleen met dezelfde verzoekidentiteit worden gecontroleerd.
- Afgesloten perioden en reeds afgestemde rekeningen blokkeren deze eenvoudige herstelroute. Geen automatische heropening, historie-reset of wijziging van definitieve facturen/PDF's.
- Rekeningcodes onderscheiden rekeningen met gelijke namen. De bestaande betaalregistratie blijft één ontvangst plus één koppeling; geen tweede omzetboeking.

## Database en rechten

Nieuwe additieve migration: `20261015152613_appfmz_bank_repair.sql`. Alleen vijf nieuwe functies; geen dataconversie, vervanging van bestaande functies of wijziging van tabellen/policies. De CLI maakte eerst de kandidaat aan; vóór commit is de bestandsidentiteit afgestemd op de door de migrationtool geregistreerde versie. Geen history-repair.

Tien lokale en hosted migration-identiteiten komen overeen. De geregistreerde nieuwe SQL is byte-identiek aan de kandidaat. Een nieuwe native CLI-dry-run is vanuit deze omgeving niet uitgevoerd; er wordt geen lege dry-run geclaimd.

De publieke wrappers zijn security-invoker; de beperkte private API controleert de bestaande geverifieerde owner en actuele sessie via `owner_org()`. De interne planfunctie is niet rechtstreeks uitvoerbaar voor authenticated/anon. Nieuwe definerfuncties gebruiken een lege search_path. Een organisatie-lock serializeert bevestiging met bestaande financiële commands; verzoekbewijzen voorkomen dubbele toepassing.

De security-advisor meldde geen ERROR. De bestaande meldingen over private deny-by-default-tabellen, pg_net in public en leaked-password protection zijn niet door deze release gewijzigd. Zie [pg_net-lint](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) en [wachtwoordbeveiliging](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verificatie, met beperkingen

- 25 geselecteerde kern-, security-, betalings-, herstel-, overeenkomst- en cursuscontroles PASS. Daaronder echte gerenderde Chromium-schermen voor preview, aparte bevestiging, twee gekoppelde facturen, verlies van een serverantwoord, herhalen zonder duplicaat, herladen, opnieuw inloggen en 320/390/844/1440px.
- Aanvullende SQL-pariteitscontrole voor een reeds aanwezige oefenontvangst PASS; geen tweede bankmutatie. De twaalf beginnersstappen en behoud van eerdere voortgang zijn aanvullend gecontroleerd. Testwachttijden voor asynchrone cursusberichten zijn expliciet gemaakt, zonder uitkomsten te versoepelen.
- Echte hosted PostgreSQL 17.6-proef met een tijdelijk synthetisch ownerprofiel, sessie en administratie: twee facturen op één ontvangst, voorstel, tegenboeking, idempotentie, ongewijzigde facturen, nieuwe beginstand en beperkte rechten PASS. De volledige transactie is teruggedraaid. Dit is geen nieuwe echte passwordlogin-/PostgREST-ownerproef.
- De eerste hosted testfixture miste een verplicht fictief btw-identificatienummer en is volledig teruggedraaid. De fixture is gecorrigeerd; de nieuwe proef slaagde. Geen echte factuur of klant werd gebruikt.
- Een anoniem echt HTTP-verzoek aan de preview-API gaf HTTP401 / 42501, zonder financiële gegevens.
- Acht vóór/na-hashes zijn gelijk: records, journals, lines, files-metadata, accounts, organizations, agreement_versions en coach_workspaces. Geen historische correctie is toegepast. De testaccounts en testorganisatie zijn na rollback afwezig. Geen bestaande Storage-objecten zijn geschreven; geen nieuwe bytevergelijking van de daadwerkelijke private objectinhoud geclaimd.
- Native Edge kan in deze container niet starten door een geblokkeerde Unix-socket. De gerenderde proeven gebruiken een echte Chromium Headless Shell 141 met de bestaande Playwright-driver. Geen fysieke iPhone-PASS.
- Twee bredere PDF-previewcontroles zijn hier niet geslaagd. De hoofdpreview-timeout is op de ongewijzigde broncommit gereproduceerd. De PDF-download-/bestandcontroles slagen. Dit is niet als een groene volledige 51-delige regressieronde gepresenteerd.

## Lessen en gesproken herstelhoofdstuk

De beginnersuitleg beschrijft betaalhistorie, bestaande ontvangsten, aparte correctiebevestiging en beginstandherstel. Stap 6 heeft een afzonderlijke fictieve oefenronde om een bestaande ontvangst te koppelen. Geen netwerk of echte administratie in de oefening; voortgang blijft behouden.

De handleiding is opnieuw uit dezelfde cursusbronnen gegenereerd: 91 A4-pagina's, versie 2.1.0. Alle pagina's zijn gerenderd; overzichten en de gewijzigde herstelpagina zijn visueel gecontroleerd. De generator ondersteunt nu ook expliciete lokale Python- en fontpaden buiten Windows.

Nieuw: [Bank/Kas-herstel met gesproken uitleg](https://appfmz.nl/tutorial/media/bank-kas-herstel.mp4), 118 seconden, negen hoofdstukken, Nederlandse lokale computerstem, ingebakken ondertitels, [VTT](https://appfmz.nl/tutorial/media/bank-kas-herstel-nl.vtt) en [transcript](https://appfmz.nl/tutorial/media/bank-kas-herstel-transcript.txt). Werkelijke interacties in de geïsoleerde APPFMZ-ownerinterface met fictieve gegevens. Geen AI-gegenereerde nepschermen, externe spraakdienst of kosten. H.264/yuv420p en AAC-audio plus niet-stil audiosignaal zijn met FFmpeg gecontroleerd.

Deze video is het aanvullende herstelhoofdstuk; hij vervangt niet de afzonderlijk gevraagde volledige gesproken rondleiding door alle administratiemodules. Die brede videoreeks is hiermee niet als voltooid verklaard. Hoorbaarheid en bediening op een echte iPhone blijven ownerreview. De headless Chromium-engine bevat geen native H.264/AAC-decoder; de speler toont daarom een expliciete codecbeperking in het testbewijs, geen fictieve playback-PASS.

## Bestaande historische gegevens: wachten op feitelijke bevestiging

Er is geen algemene reset uitgevoerd en geen bestaande factuur betaald/onbetaald gemaakt. De concrete bestaande mutaties zijn alleen in de privégespreksomgeving besproken. De owner moet aangeven welke regels onjuist zijn en welke bedragen, rekeningen en datums het bankafschrift daadwerkelijk toont. Alleen daarna volgt een exact herstelvoorstel; geen aannames op basis van gelijke bedragen of omschrijvingen.

## Terugval

Bij een probleem met de nieuwe bediening: alleen de nieuwe herstelknoppen/ingang sluiten. De additieve API en historische gegevens kunnen blijven bestaan. Geen oude ontvangen bedragen overschrijven, geen brede database-restore en geen oude onveilige rechten herstellen. Een reeds opgeslagen correctie blijft in de historie; een verdere correctie vereist opnieuw een actueel voorstel.

[Bankkoppelingonderzoek](APPFMZ_BANK_CONNECTION_RESEARCH_20261015.md). Er is geen banktoegang, betaalde overeenkomst, klantmail of push geactiveerd.
