# APPFMZ productie-integratie — 11 november 2026

Deze release sluit de bestaande kandidaat aan op de normale APPFMZ-app. Geen nieuwe ontwerpcyclus; de kortere betalingstekst en het aandachtsoverzicht blijven uitgesteld. Staging, JARVIS en bedrijfswebsite: niet aangeraakt.

## Beschikbaar in de normale app

- Rustig Dashboard en donker/licht thema; alle 11 bestaande traineronderdelen blijven bereikbaar. Het mobiele menu sluit bij navigeren.
- Leden zoeken via de bevoegde serverroute; profiel, bestaande coaching, profielbewerking met versiecontrole/historie en private profielfoto-opslag.
- Factuurtaken in de gewone Agenda, met precies twee algemene taken per cyclus: **Facturen maken** en **Facturen versturen**. Afzonderlijk afvinken wordt duurzaam opgeslagen; afvinken maakt geen factuur, mail, betaling of bankboeking.
- 29 opeenvolgende vierwekencycli (58 taken), basis **30 oktober 2026**, Europe/Amsterdam; planning tot en met 2028 exporteerbaar als PDF/CSV.
- De bestaande factuurbewerker, korting, betalingen, Bank/Kas en archief-PDF's blijven behouden. De pakketfactuurkeuze gebruikt servervoorstellen en hervat hetzelfde concept na een verloren antwoord.

De cyclusconfiguratie is als nieuwe, onveranderlijke versie vastgelegd op uitdrukkelijke ownerinstructie. Geen bestaande overeenkomst is aan de centrale cyclus gekoppeld of omgerekend. Patrick en Debora behouden hun kalendermaandafspraak; Mariekes bestaande afspraak is niet herschreven. Er zijn geen automatische facturen, incasso's, mails of nieuwe pushmeldingen geactiveerd.

## Bewust geblokkeerd

- **Nieuwe ondertekening en definitieve inschrijving:** de definitieve privacyverklaring is nog niet goedgekeurd. De database blokkeert `review`, `reserve_agreement` en `finalize`, ook wanneer iemand de browser omzeilt. Concepten blijven beschikbaar, met een zichtbare waarschuwing.
- De voorbereide éénpaginaovereenkomst heeft echte PDF-inhoud, versiegebonden gegevens, origineel logo en volledige voorwaarden/privacytekst als ingebedde bijlage. Browser- en Edge-renderer zijn identiek. Dit is getest met fictieve gegevens; geen nieuwe echte overeenkomst is uitgegeven.
- Duurzame deelperiode-opslag ondersteunt €380 × 14/28 = **€190 en 4 trainingen**. Niet-gehele trainingsaantallen blokkeren afronding; er is geen afrondingsregel verzonnen. Door de ondertekenblokkade zijn nieuwe ondertekende centrale overeenkomsten nog niet normaal beschikbaar.

## Database, rechten en herstel

Uitsluitend deze drie nieuwe migrations zijn met CLI 2.117.0 `migration up --linked --project-ref hgoygcviutmynaihcvpd` toegepast, na een dry-run die exact deze drie aanwees:

| Migration | SHA-256 van toegepast lokaal bestand |
|---|---|
| `20261026154916_appfmz_members.sql` | `838da2412556791e1c34a0f07679b0650db5aa823a5256a7aaa0e103daf98e77` |
| `20261104163836_appfmz_central_billing_opt_in.sql` | `76fa39aa69dc31e7be74ae15d5ad3ca8dea5eb5f23e5461f5979dc8f94db11c0` |
| `20261104164206_appfmz_member_release_gate.sql` | `a99095253667e0e31f2384ee1e26745593ea1461bc4727453e97904d64416f55` |

Geen oude migration herhaald, geen `migration repair`, reset, data-omzetting of productiehistory-correctie. [Migrationlijst](examples/production-integration-20261104/migration-list-after.txt) heeft 15 gelijke lokale/remote versies; [dry-run](examples/production-integration-20261104/dry-run-after.txt) meldt up-to-date.

Nieuwe Edge-functie `member-assets` v1: JWT-verificatie **aan**. Bestaande `invite-client` v7 en `agenda-reminders` v1 ongewijzigd. Bucket `fmz-members` is privé. RLS staat aan, anon kan niet schrijven, authenticated kan niet buiten de publicatiepoort om finaliseren of zelf een bestand goedkeuren. Service-role staat uitsluitend server-side. Bestaande security-advisorwaarschuwingen (pg_net in public en leaked-password-protection uit) zijn niet door deze release veroorzaakt; de private RPC-tabellen houden bewust geen directe RLS-toegang.

Extra Git-herstelpunt: `backup/appfmz-pre-integration-20261111` op **985b3d37f65b119bb82d479c8b0c3077f47d3d16**. Oudere herstelpunten behouden. Versleutelde back-up buiten Git/OneDrive: `C:\Users\Fitme\.codex\backups\appfmz-production-20261111`. [Herstelcontrole](examples/production-integration-20261104/restore-verification.json): 20 applicatietabellen, Auth-inhoud en 7 private bestanden; decryptie/rijen/constraints en bestanden geverifieerd. [Directe vergelijking na migrations](examples/production-integration-20261104/data-preservation-after-migrations.json): alle 23 gecontroleerde bestaande tabellen identiek, inclusief Auth-identiteiten en Storage-metadata.

Bij een frontendprobleem kan het exacte vorige frontendherstelpunt terug; de additieve tabellen en gesloten privacypoort blijven staan. Geen klantdata terugzetten over nieuwere invoer, geen toegangsrechten verruimen. Nieuwe documenten worden nooit teruggegenereerd over bestaande PDF's.

## Controlebewijs

- Native PostgreSQL 18 + PostgREST 16.5 over echt lokaal HTTP: rechten, sessie-intrekking, één HTTP409/PT409, herhaalde aanvraag, duurzame taken en gesloten ondertekenroute. Dit gebruikt geïsoleerde synthetische Auth-tabellen, geen hosted GoTrue.
- Aparte native gelijktijdigheidstest: autosave naast profiel/fotohandelingen geeft voorspelbare PT409 in plaats van deadlock; geen extra fotoreservering. Workspace wordt consequent vóór directory vergrendeld.
- Echte productiecanary met drie tijdelijke fictieve accounts: **GoTrue, PostgREST, private Storage en Edge-bestandsverificatie geslaagd**. Zoeken, profielhistorie, herhaalde aanvraag, andere klant geweigerd, opnieuw aanmelden, 58 taken en sessie-intrekking getest. Geen mails, uitnodigingen, push of echte klantwijzigingen. [Canarybewijs](examples/production-integration-20261104/canary-results.json).
- Bestaande factuurflow: beide bewerkschermen, onvolledige invoer, korting, vertraagde bevestiging, verloren antwoord, conflict, PDF-herstel en sessiegrens PASS. Betalingen/deelbetalingen, bestaande ontvangst koppelen en correcties PASS. Historische migration-identiteit PASS.
- Edge: geïntegreerde presentatie, alle 11 routes, normaal ledenprofiel, Agenda, conceptkeuze en PDF-weergave PASS. WebKit: **90 schermchecks** voor trainer/lid, 320–1400 px, portret/landschap en beide thema's PASS. Browseremulatie, geen fysieke iPhone-PASS.
- [Presentatiebewijs](examples/production-integration-20261104/presentation-browser.json), [HTTP-bewijs](examples/production-integration-20261104/native-http.json), [centrale planning](examples/production-integration-20261104/central-billing-evidence.json).
- Screenshots: [donker telefoon](images/production-integration-20261104/dashboard-dark-390.png), [licht laptop](images/production-integration-20261104/dashboard-light-1440.png), [Agenda telefoon](examples/production-integration-20261104/central-agenda-mobile.png), [éénpagina-PDF](examples/production-integration-20261104/agreement-onepage-synthetic.pdf). Uitsluitend fictieve gegevens.

## Reproduceerbaarheid en publicatie

Normale runtime importeert geen OwnerTest-adapter. GitHub Pages bouwt vanaf `main` en sluit `owner-test`, `tests`, serverbronnen en ontwikkeldependencies uit via `_config.yml`. De bestaande veilige oefencursus onder `tutorial` blijft behouden.

Tests: `pnpm install --frozen-lockfile`, bestaande Playwright Edge/WebKit-browsers en `node --test --test-concurrency=1 tests/<testnaam>.test.cjs`. Native tests vereisen een eigen lege PostgreSQL 18-cluster op 127.0.0.1:55439 (lokale postgres-testgebruiker) en de officiële PostgREST 16.5 executable onder `tests/artifacts/production-infra/postgrest/postgrest.exe`, met PostgreSQL-bin in PATH. Windows-releasezip SHA-256 `17f595b0d8dd37473d0231417dea07c5ac9f791282ff5b017fae51ff29e5de2f`; testdriver `pg` is vastgezet op 8.16.3. Nooit dit fixture-harnas tegen productie richten. Operationele canary vereist afzonderlijke private credentials/map en is geen onderdeel van de browserbuild.

Frontendpublicatie en definitieve canary-opruiming/live-bestandsvergelijking worden hieronder vastgelegd nadat zij werkelijk zijn uitgevoerd.
