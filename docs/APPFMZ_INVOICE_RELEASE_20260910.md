# APPFMZ — release Administratie, maandprijzen en privé-PDF

Scope: `Yourizorge/fitmetzorge`, `appfmz.nl`, productieproject `hgoygcviutmynaihcvpd`. Uitgangspunt: main `d5673a2e9383990b456b472b3d60b5d96a39ecc1`. De aanvullende opdracht van 10 september vervangt de eerdere factuurimplementatie door één geïntegreerde owneradministratie. De bestaande projectinstructies, publicatieplan, releaserapporten en owneracceptatie zijn gelezen. Geen AGENTS.md aangetroffen. De eerdere owneracceptatie blijft uitsluitend gelden voor de vorige autosave/fotorelease; deze administratierelease krijgt een eigen telefoontest.

## Uitgevoerde wijzigingen

| Pakket-ID (behouden) | Trainingen per maand | Maandbedrag | Per training |
| --- | ---: | ---: | ---: |
| pt-basis | 4 | €200 | €50 |
| pt-progressie | 8 | €380 | €47,50 |
| pt-transformatie | 12 | €480 | €40 |

`app.js` en beide hardcoded keuzes in `index.html` tonen de juiste bedragen. Pakketkeuze, klantoverzicht en pakketconcept tonen het maandbedrag. Oude labels blijven herkenbaar. Geen gemiddelde kalenderweken; Duo, online coaching, individuele bedragen en losse afspraaktarieven zijn niet herprijsd. Een losse afspraak krijgt geen maandbedrag of definitief factuurnummer.

Administratie heeft negen werkende schermen: Overzicht, Verkoopfacturen, Uitgaven en bonnen, Bank en kas, Privé, Bezittingen en schulden, Btw, Rapporten/export en Instellingen. De bestaande klanten, pakketkeuze en PDF-generator worden hergebruikt. Beide factuurschermen openen dezelfde, daadwerkelijk bewerkte concepteditor. De oude documentbrede veldselectie is verwijderd. De oude financiële workspace blijft een historische bron; nieuwe definitieve facturen worden alleen via het nieuwe gecontroleerde pad uitgegeven.

Concepten worden automatisch privé opgeslagen, zonder nummer of omzetboeking. Alleen **Definitief opslaan en PDF downloaden** geeft een factuur uit. Omschrijving, klantadres, leverdatum/omvang, hoeveelheid, datum, termijn, oorspronkelijk bedrag, korting en toelichting zijn vooraf bewerkbaar. Geld en btw worden op centen verwerkt; ongeldige of lege bedragen worden niet nul. Oudere bevestigingen markeren nieuwere invoer niet als opgeslagen. Conflicten blijven zichtbaar, behouden invoer en vereisen vergelijken met het vernieuwde serverconcept.

Definitieve factuurgegevens, opeenvolgende nummers en boekingen ontstaan transactioneel en idempotent. De daadwerkelijke PDF wordt privé gearchiveerd; opnieuw downloaden controleert grootte en SHA-256 en gebruikt dezelfde bytes. PDF-fouten of een verloren antwoord maken geen tweede factuur. Een mislukte overzichtsverversing na bevestigde opslag herhaalt uitsluitend het lezen. Definitieve facturen zijn onveranderlijk; correcties krijgen een gekoppelde creditfactuur. Openstaand, gedeeltelijk betaald, betaald, gecrediteerd en terug te betalen worden uit boekingen afgeleid.

PDF: geldige `%PDF-`-inhoud, `application/pdf`, `.pdf`, A4, ingebed bedrijfslogo, partijgegevens, nummer, dienst, korting, btw en eindtotaal. Geen afdrukdialoog, betaalde dienst of externe documentgenerator. pdf-lib 1.17.1 en fflate 0.8.2 zijn vastgezet en lokaal gebundeld, inclusief MIT-licenties.

## Boekhoudkundige werking

Het samenhangende grootboek eist sluitende debet-/creditregels. Facturen boeken debiteuren/omzet/btw; betalingen vereffenen debiteuren zonder extra omzet. Uitgaven bewaren leverancier, bron, categorie, zakelijke/aftrekbare aandelen en expliciete btw-behandeling. Ontbrekend bewijs of onbekende btw geeft een controlepunt en geen automatische 21%-aftrek. Privé voorgeschoten kosten vormen een schuld aan privé; vergoeding boekt geen tweede kostenpost. Tegenboekingen bewaren de oorspronkelijke uitgave en eventuele leveranciers-/privéterugbetaling blijft herleidbaar.

Bank/kas ondersteunt handmatige mutaties, ING-CSV met kolomkoppeling en voorbeeld, originele importbestanden, herkenning van overlap, splitsingen, deelbetalingen en eigen overboekingen. Identieke transacties zonder unieke bankreferentie vragen expliciete beoordeling; ze worden niet stilzwijgend nogmaals geboekt. Beginsaldi blijven onbekend totdat de owner bedrag en datum bevestigt. Afstemming vergelijkt de opgegeven afschriftstand met de boekingen. De €0,20-privéstorting verhoogt bank/eigen vermogen zonder omzet of btw. Bankkosten zijn een afzonderlijke uitgave; privéopnames zijn geen kosten.

Bedrijfsmiddelen, schulden, expliciete restwaarde/afschrijvingsbedragen en traceerbare balanscorrecties zijn beschikbaar. Geen verzonnen fiscale afschrijvingstermijnen. Rapporten per maand/kwartaal/jaar onderscheiden resultaat, openstaande posten, bank/kas, privé, bezittingen, schulden en vermogen. Historische facturen worden niet opnieuw als omzet geboekt; de aansluiting blijft zichtbaar onbevestigd totdat de owner die vastlegt.

Btw-instellingen krijgen een ingangsdatum. Bestaande standaardwaarden zijn zichtbaar maar niet fiscaal bevestigd. Factuurstelsel volgt definitieve facturen; kasstelsel volgt de bankontvangst-/terugbetalingsdatum, met cumulatieve centafronding. Voorbelasting volgt de uitgave. Een latere bankkoppeling mag een afgesloten bronperiode niet wijzigen: eerst expliciet en met auditreden heropenen. Onvolledige btw-overzichten worden nooit als gereed voor aangifte gepresenteerd. Geen aangifte of inkomstenbelastingberekening.

De vereiste velden zijn gecontroleerd tegen de actuele [Belastingdienst-factuureisen](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/factuureisen). Bij [KOR](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/aangepaste_regels_facturen/u_maakt_gebruik_van_de_kleineondernemersregeling) wordt geen btw-bedrag vermeld. De [kasstelselregels](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/bereken_het_bedrag/hoe_berekent_u_het_btw_bedrag/kasstelsel/) ondersteunen het onderscheid tussen ontvangsten en inkoopfacturen. Technische tests vormen geen fiscale goedkeuring.

## Toegang, archief en herstel

Het opgegeven owneraccount is gecontroleerd op bevestigde Auth-e-mail en bestaand trainerprofiel. Eigenaarschap wordt administratief gekoppeld aan dat Auth-ID; een trainerrol of gebruikersmetadata verleent geen eigenaarschap. Alle acht financiële tabellen hebben RLS, geen directe gebruikersgrants en alleen gecontroleerde RPC-toegang. Elke RPC controleert de actuele echte sessie. De bucket `fmz-finance` is privé, maximaal 12 MB per origineel, met alleen owner-lees/invoegrechten; overschrijven en verwijderen zijn niet toegestaan via de gebruikers-API. Gewone accountverwijdering verwijdert het financiële archief niet door een cascade.

Bewaargrondslag volgt documentsoort en einde actualiteitswaarde, niet uploadtijd: doorgaans zeven jaar, onroerende zaken/OSS tien jaar. Onbekend startmoment betekent blijven bewaren; geen automatische verwijdering. Zie de [Belastingdienst-bewaarregels](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/). Audit bevat actor, tijdstip en gegevens van elke mutatie, correctie, sluiting/heropening en export.

Een ZIP-export bevat leesbaar HTML, CSV op centen, volledige JSON/audit/instellingen, originele PDF's/bonnen/imports en bestandsindex met hashes en bronkoppelingen. CSV beschermt tekst tegen formule-uitvoering. Een afzonderlijke lokale PGlite-database herstelde de volledige synthetische export: 18 records, 12 journaalposten, 30 regels, 32 auditregels en vijf originele bestanden. Alle bestandshashes bleven gelijk; iedere boeking sloot; owner-lezen werkte na herstel.

Vóór de migration is buiten GitHub een versleuteld productieherstelpunt gemaakt en geverifieerd: `2026-09-10T16:46:17Z`, inhouds-SHA-256 `86bd13ef724a6fe881c3d6844f3e24e72443c5587799df5f2112220564dc55db`. Zeven profielen, twee workspaces, tien uitnodigingen, 44 schrijfbevestigingen en één fotoannotatie zijn geïsoleerd teruggelezen met gecontroleerde constraints. Auth-gegevens zijn versleuteld inbegrepen. Klantfoto's zitten in de bestaande workspace; vóór deze uitbreiding bestonden geen Storage-objecten. Sleutels/back-ups staan buiten GitHub.

Beschikbare back-upvoorziening: gecontroleerde releaseherstelpunten en volledige downloadbare archiefexport. Er is geen automatische onafhankelijke off-site back-up van nieuwe Storage-bijlagen ingericht of geclaimd. De owner bewaart regelmatig de volledige ZIP op een tweede veilige locatie. Geen betaald abonnement of compute-upgrade.

## Database en gecontroleerde uitrol

| Lokale migration | Productieregistratie | Status |
| --- | --- | --- |
| `20260910145050_appfmz_owner_accounting.sql` | `20260910170351` / `appfmz_owner_accounting` | Transactioneel toegepast |
| `20260910171432_appfmz_accounting_closed_bank_period.sql` | `20260910171555` / `appfmz_accounting_closed_bank_period` | Transactioneel toegepast |

Geen ongerichte db push, reset, historische replay of Edge-wijziging. De bestaande `invite-client` en JWT-verificatie zijn intact. Tijdens voorbereiding blijft de bestaande app beschikbaar; het nieuwe eigenaarschap voor de echte owner wordt pas bij de geverifieerde frontend geactiveerd. Een oud gecachet scherm kan daarna geen oude factuurreeks voortzetten: het serverantwoord vraagt om APPFMZ te vernieuwen, zonder invoer stilzwijgend te overschrijven. Coachingopslag blijft werken.

Herstelpad: behoud database, privéarchief, RPC's en veilige rechten. Bij een frontendprobleem blijft de administratie afgeschermd; publiceer een gecontroleerde frontendcorrectie via dezelfde Pages-route. Zet geen oude financiële schrijfroute open en verwijder geen nieuwe boekingen. Een archiefherstel wordt eerst in isolatie gecontroleerd; geen productierestore over nieuwere klantgegevens. Staging, marketingwebsite en AI-ontwikkeling zijn niet gewijzigd.

## Testbewijs

Elf lokale tests slagen, achtereenvolgens uitgevoerd: oorspronkelijke opslag/security/Edge, workout-/voedingsflows, fotoannotaties, mobiele bediening, plus nieuwe administratie/PDF/CSV/btw/conflictcontroles. Gerichte regressies controleren beide factuurschermen, geen uitgifte tijdens typen, 200/380/480, korting, onvolledige invoer, focus, vertraagde bevestiging, verloren antwoord, één conflict en expliciet herstel, PDF-retry, sessieverlies en bevestigde boeking gevolgd door mislukte overzichtsverversing.

Echte productie-Auth/PostgREST/Storage, uitsluitend eigen synthetische accounts zonder uitnodigingsmail: volledige browserflow geslaagd in 43 seconden, inclusief factuur → korting → privé-PDF → deelbetaling → restant → afstemming → bon/VAT/privévoorschot → opnieuw inloggen → exact dezelfde PDF → export. Alle originele bestanden zijn op hashes gecontroleerd en geïsoleerd hersteld. De eerste proef vond een te vroeg klikbare sluitknop tijdens de laatste verversing; dit is opgelost en de volledige proef is herhaald.

Afzonderlijke echte API-controles: leden en niet-ownertrainer geweigerd, PDF-overschrijving geweigerd, ingetrokken sessie geweigerd, gelijktijdig definitief maken levert één nummer en één journaalpost. Een PT409/HTTP 409 kwam terug in 111–132 ms. Een verouderd concept en een koppeling naar een afgesloten bankperiode laten de gehele transactie ongewijzigd. De blokkade van oude factuuruitgifte rolt ook een eerdere geldige klantwijziging in dezelfde batch terug.

PDF's zijn geparseerd en A4/tekst/logo/bedragen gecontroleerd; de gerenderde Progressie-PDF toont €380 − €30 = €350, €289,26 netto en €60,74 btw. Mobiele schermen zijn op 390 pixels gecontroleerd en visueel geïnspecteerd. Geen fysieke telefoontest door de agent.

Security-advisor: uitsluitend INFO voor de bewust alleen via RPC toegankelijke RLS-tabellen zonder policies, plus de reeds bestaande waarschuwing over gelekte-wachtwoordbescherming. Geen rechten verruimd. [Uitleg RPC-only/RLS-melding](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [bestaande Auth-instelling](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Eenmalig door de owner

Controleer Administratie-instellingen: juridische bedrijfsnaam/volledig adres, KVK/btw-ID indien van toepassing, btw/KOR-status, methode, aangifteperiode en ingangsdatum. Bevestig eigen rekening/beginsaldo en leg de historische aansluiting vast. Ontbrekende gegevens worden niet verzonnen; definitief factureren blokkeert bij ontbrekende verplichte velden. Bestaande facturen zonder een bewaarde documentmomentopname blijven historische brongegevens; ze krijgen geen achteraf verzonnen PDF of nieuwe bedragen.

## Korte dagelijkse handleiding en telefoontest

1. Open Administratie en controleer eerst Instellingen en de rekening/beginstand.
2. Open bij Verkoopfacturen een pakketconcept. Progressie: €380; €30 korting geeft €350. Controleer klantadres, dienst, datum en termijn voordat je definitief opslaat. Open de gedownloade PDF.
3. Voeg bij Uitgaven de originele bon/foto/PDF toe en kies expliciet btw-behandeling, zakelijk aandeel en eventuele privébetaling.
4. Importeer je ING-CSV, controleer kolommen/tekens en koppel betalingen aan factuur, bon of privé. Gebruik splitsen voor deelbetalingen. Stem de eindstand af.
5. Log opnieuw in; download dezelfde factuur opnieuw. Controleer Rapporten/Btw en open een bronbestand. Download regelmatig de volledige ZIP en bewaar die veilig apart.

Gebruik bij de telefoontest een concept zolang je geen echte factuur wilt uitgeven. De knop Definitief opslaan is een echte boekingshandeling; er wordt geen e-mail verstuurd.

## Definitieve publicatiecontrole

Nog in uitvoering: commit/push, live bestandsvergelijking, activering van de geverifieerde owner en verwijdering van uitsluitend de eigen synthetische testgegevens. Deze sectie wordt na de controles bijgewerkt; de bovenstaande tests betekenen nog geen claim dat deze frontend al live is.
