# APPFMZ reparatierapport

8 september 2026 · `Yourizorge/fitmetzorge` · branch `codex/fix-appfmz-storage-security`.
Basis: `846eb6ba63d28a182a30c058c7a4094cab6fb20d`. Productieproject: `hgoygcviutmynaihcvpd`.

## Read-only onderzoek

De oorspronkelijke werkmap was een lege Git-repository zonder remote/commits. De juiste repository is in `appfmz-live` gekloond; er waren geen lokale wijzigingen om over te nemen. Remote main kwam overeen met de opgegeven baseline. Er is geen stagingcode of stagingdatabase gebruikt.

`https://appfmz.nl/` laadt de root `index.html`, `styles.css`, `config.js`, `app.js` en de Supabase SDK via jsDelivr. De vier baselinebestanden zijn bytegelijk aan de live bestanden:

| Bestand | SHA-256 live en baseline |
|---|---|
| index.html | aa4437fd3b3c422f3bb8488f962d9247e608373c8c697589d1016ad1c9dc9256 |
| app.js | b41106be6ac257355bf3252849f8dabde26d8a1c1ea53b0f9a1f16792cb0c726 |
| styles.css | 3ad789cb86776737f127d9dcfb62e475f37b26af601f42be81828c839971f54d |
| config.js | c5dd5bc8a0741c2dd2571d6d0d169bbe49701f5cef1256093877fc96f15eea8e |

De standalone-HTML geeft HTTP 200 en bevat een aparte ingebedde app. Werkelijk bezoek is niet gemeten. De fix vervangt deze ingang door een verwijzing naar `index.html`.

Productie-inspectie bevestigde tabelbrede browserrechten op `profiles`, `coach_workspaces` en `client_invites`. Eigen profielmutaties controleerden alleen `id=auth.uid()`. Gekoppelde leden konden volledige workspaces lezen en wijzigen. `accept_client_invite()` controleerde geen gebruikte status/vervaldatum en kon bestaande koppelingen vervangen. Er waren geen eigen triggers op deze tabellen. De Edge Function `invite-client` versie 5 is read-only opgehaald als basis. Alleen beveiligingsdefinities zijn gelezen, geen klantrecords, secrets of inhoudelijke logs.

## Reparaties

### Opslagketen

- `saveStateToCloud()` verstuurt via `sync.js` gewijzigde onderdelen, geen volledige workspace. `fmz_save_changes` bepaalt de eigenaar uit de sessie en het beschermde profiel.
- Iedere wijziging draagt de oorspronkelijke waarde en een aanwezigheidsmarkering. PostgreSQL controleert deze onder een workspace-rijlock. Bij conflict wordt de hele transactie teruggedraaid (`40001`). Verschillende klanten/velden/weekobjecten kunnen onafhankelijk wijzigen. Een array, zoals een weektracker, voedingslog of trainingsschema, is een conflictgrens: geen stille automatische samenvoeging.
- Klanten worden via stabiele ID gevonden; lidplanlogs via oefening-/maaltijd-ID, niet via de positie in een gefilterde lijst.
- Alleen een bevestiging met het verwachte aantal deelwijzigingen geeft succes. Ontbrekende sessies, RPC-fouten en nul bevestigingen behouden invoer en tonen een fout. Verzoeken binnen één tabblad lopen na elkaar; tijdens opslag verder ingevoerde wijzigingen blijven openstaan.
- Rendering start geen opslag of factuuraanmaak meer. Mutatiehandelingen slaan expliciet op; lege weekobjecten die rendering aanmaakt tellen niet als wijziging.
- Een extra concrete opslagoorzaak was het uitlezen van dubbele trackerinputs in verborgen schermen. Oude verborgen waarden konden de zichtbare invoer vervangen. `collectTrackerDay()` leest nu uitsluitend het actieve scherm.
- De trainingsweergave had klikafhandeling maar geen opslagknop. De knop is toegevoegd.
- **Verversen** haalt de trainergegevens zonder opnieuw inloggen op, met behoud van selectie/week/scherm. Openstaande invoer blokkeert verversen. **Opslag** biedt opnieuw opslaan, exporteren en expliciet verwerpen.

### Autorisatie en uitnodigingen

Concrete migration: `supabase/migrations/20260908171653_appfmz_storage_security.sql`.

- Browserrollen hebben geen directe workspace-/uitnodigingstabelrechten. Profiel-SELECT blijft onder RLS; eigen UPDATE is beperkt tot `name`. Zelf trainer worden of een koppeling wijzigen kan niet.
- Bestaande trainers/profielen/koppelingen blijven staan. Nieuwe trainerbevoegdheden worden door de beheerder toegekend, nooit door wijzigbare `user_metadata.role`.
- Een lid ontvangt één eigen klant met toegestane doelen, gepubliceerde plannen, logs en noodzakelijke afspraakvelden. Andere klanten, conceptplannen, wachtwoorden, coachnotities en traineradministratie worden op de server uitgesloten.
- Geprivilegieerde functies staan in `fmz_private`, met lege vaste search path. Publieke wrappers zijn security invoker. Anonieme EXECUTE is ingetrokken. Alle ingangen controleren de actor en het bestaan van de JWT-sessie in `auth.sessions`. Het private schema mag niet aan exposed schemas worden toegevoegd.
- Acceptatie vereist een bevestigd e-mailadres uit `auth.users`, precies één ongebruikte geldige uitnodiging, een opgeslagen klant en geldige trainer. Bestaande profielen worden nooit opnieuw gekoppeld. Advisory lock op mailadres plus rijlock voorkomen conflicterende acceptaties.
- Oude uitnodigingen zonder `expires_at` vervallen zeven dagen na `created_at`; geen backfill van klantdata. De Edge Function roept eerst `fmz_prepare_invite` aan, dat de opgeslagen klant en bestaande/andere koppelingen controleert.
- `addClient()` houdt mail en succes tegen bij opslagfouten en behoudt het formulier. Ook opnieuw uitnodigen vereist bevestigde opslag. Bestaande accounts krijgen een aparte melding.

### Sessies, cache, tekst en functies

- Lokale loginstatus vervangt geen Supabase-authenticatie. Ontbrekende SDK/configuratie blokkeert inloggen, zonder demo-fallback. Demo is alleen expliciet op localhost mogelijk.
- Bij sessie-einde worden UI, state, formulieren, privé-uitvoer en opslagtijders opgeruimd. Asynchrone resultaten zijn aan een sessiegeneratie gekoppeld.
- Privéworkspaces worden niet meer in localStorage geschreven. Openstaande invoer blijft in tabbladgeheugen voor de oorspronkelijke gebruiker en kan na inloggen met hetzelfde account worden hersteld. Uitloggen/sluiten met openstaande invoer waarschuwt. Exporteer vóór het sluiten: herstel over een gesloten tabblad heen is niet geïmplementeerd.
- Een oude lokale workspace wordt tijdelijk in geheugen gehouden, nooit automatisch geïmporteerd. Export kan na authenticatie met het oorspronkelijke e-mailadres; bij leden wordt de export beperkt tot hun eigen schrijfscope. De oude diskcache wordt verwijderd zodat een volgend account deze niet inlaadt.
- Namen, doelen, notities en relevante attribuutwaarden worden ge-escaped. Ongeldige datums worden niet als ruwe HTML weergegeven. De afbeelding-fallback bevat geen geïnterpoleerde JavaScript-string meer.
- Caloriedoelen volgen de gepubliceerde oefeningen op de huidige weekdag, inclusief weekendtraining; anders geldt rust. `nextAppointment()` vergelijkt datum én tijd.
- Herhaling maakt maximaal twaalf afspraken, met correcte maandultimo en stabiele reeks-ID's. Vervolgafspraken krijgen geen automatische facturen/kosten. Oude opgeslagen herhalingskeuzes hebben een expliciete eenmalige actie. Opslagretry maakt geen tweede reeks.
- Traineranimaties meten 112 px desktop / 96 px mobiel, met behoud van verhouding. Mobiele invoervelden gebruiken de kaartbreedte onder het voorbeeld.
- De browser-SDK is vastgezet op de live aangetroffen versie `2.116.0`.

## Testbewijs

Laatste volledige run op 8 september 2026: `node --test tests/*.test.cjs` — **4 geslaagd, 0 gefaald, 0 overgeslagen**, 46,1 seconden. `node --check app.js`, `node --check sync.js` en `git diff --check` zijn geslaagd. Main-HEAD is daarna read-only opnieuw bevestigd op `846eb6ba63d28a182a30c058c7a4094cab6fb20d`.

`pnpm install --frozen-lockfile`, eventueel `pnpm exec playwright install chromium`, daarna `pnpm test`. Node 24 is getest. Windows gebruikt Edge; andere platforms Chromium. Iedere databaseproef maakt een verse PGlite/PostgreSQL-engine en past de echte migration toe op het gereconstrueerde schema met synthetische accounts.

| Controle | Bewijs |
|---|---|
| Training opslaan, refresh en opnieuw inloggen | Browser + lokale PostgreSQL-RPC; synthetische auth |
| Voeding, stappen en slaap via invoervelden | Browser + lokale database |
| Trainer ziet juiste klant/week en ververst | Afzonderlijk tabblad + lokale database |
| Andere klant/anon geweigerd; geen eigen rol-/koppelingwijziging | SQL onder authenticated/anon |
| Twee verouderde snapshots/apparaten | Database-CAS plus twee lidtabbladen; conflict behoudt invoer en onafhankelijke wijzigingen |
| Nul bevestigingen en opslagfouten | Onderschepte browser-RPC's; invoer en foutmelding gecontroleerd |
| Sessieverloop en accountwissel | Browser-auth-events plus verwijderde lokale auth.sessions-rij |
| Notities als tekst | HTML-payload opgeslagen/weergegeven; geen scriptuitvoering |
| Geen uitnodiging na opslagfout | Browser-intercept telt nul mailverzoeken |
| Edge mailafhandeling | Echte handler met SDK-stub, alle mailaanroepen onderschept |
| Reeksen en maandultimo | Gerichte functietests |
| Compacte voorbeelden | Browser op 1400/390 px, breedtemetingen en screenshots |

Screenshots worden opnieuw opgebouwd in `tests/artifacts/` (buiten Git, uitsluitend synthetisch). De beoordeelde [mobiele screenshot](screenshots/trainer-mobile.png) en [desktop screenshot](screenshots/trainer-desktop.png) zijn als testbewijs opgenomen. De preview is lokaal en schrijft nooit naar Supabase-productie.

Niet live uitgevoerd: klantlogin, writes, mails, accountaanmaak, Edge-deploy, migration of productie-multidevicetest. PGlite controleert PostgreSQL-logica, RLS en transacties; GoTrue, PostgREST, SMTP en fysieke gelijktijdigheid van twee databaseconnecties zijn niet bewezen. De deployment-smoketest moet die platformgrenzen na toestemming controleren. Externe GIF-beschikbaarheid is geen testvoorwaarde; de fallback is gecontroleerd.

## Implementatiebronnen

[Supabase database functions](https://supabase.com/docs/guides/database/functions), [private security-definer helpers](https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw), [Supabase changelog](https://supabase.com/changelog). Recente wijzigingen in logs/Realtime/self-hosting raken deze RPC-aanpak niet.
