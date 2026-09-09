# APPFMZ publicatie- en terugvalplan

**Voorbereid, niet gepubliceerd.** Repository `Yourizorge/fitmetzorge`; productieproject `hgoygcviutmynaihcvpd`; domein `appfmz.nl`. Geen stagingproject gebruiken.

## Beoordeling en toestemming

Bekijk branch `codex/fix-appfmz-storage-security`, het bugfixrapport, de migration, Edge Function en frontend als één release. Test met `pnpm test`; start de synthetische preview met `pnpm preview` op `http://127.0.0.1:8876`. Accounts: trainer@example.test (Trainer), a@example.test en b@example.test (Lid), elk wachtwoord. Data verdwijnt bij herstart.

De gebruiker heeft commits en push naar de fixbranch toegestaan. Samenvoegen naar main, live publiceren, Edge-deploy en productie-SQL wachten op definitieve toestemming voor deze concrete release.

## Vooraf

1. Controleer remote main-HEAD opnieuw. Bij nieuwe wijzigingen: behouden/integreren en relevante tests herhalen.
2. Controleer project-ID, actuele grants/RLS/functies/kolommen en Edge-versie tegen het rapport. `fmz_private` mag niet als API-schema zijn blootgesteld.
3. Laat de beheerder rechtmatige trainers bevestigen; rollen worden niet uit wijzigbare metadata afgeleid. Individuele klantrecords zijn in deze voorbereiding niet gelezen.
4. Plan een kort onderhoudsvenster. Laat openstaande invoer opslaan/exporteren en oude tabbladen sluiten. De oude frontend is niet compatibel met de aangescherpte workspace-toegang.
5. Maak een gecontroleerde databaseback-up met schema/functies/grants en herstelmogelijkheid. Bewaar klantdata/secrets buiten publieke GitHub. Leg huidige frontendcommit en Edge-versie vast.

## Volgorde na definitieve toestemming

1. Zet de app tijdelijk in onderhoud of voer het afgesproken onderhoudsvenster uit.
2. Voer `supabase/migrations/20260908171653_appfmz_storage_security.sql` transactioneel uit op **hgoygcviutmynaihcvpd**, via een beheerverbinding of correcte migration-tool. Niet ongericht `db push` gebruiken: de repository bevat niet de historische productiemigrations.
3. Controleer grants/RLS en RPC's. Anon mag geen RPC uitvoeren; authenticated mag geen ruwe workspace lezen/schrijven. Draai Supabase security advisors; publiceer geen klantinhoud.
4. Deploy `supabase/functions/invite-client/index.ts` met JWT-verificatie aan. De functie vereist de nieuwe `fmz_prepare_invite` RPC. Secrets blijven uitsluitend server-side.
5. Merge de beoordeelde branch naar main en publiceer via de bestaande apphosting. Neem `sync.js` mee; controleer de versieparameters in index.html. Behoud CNAME en het productieproject in config.js. Standalone verwijst naar dezelfde rootapp.
6. Controleer beide HTML-ingangen, login/sessieherstel en responses. Hef onderhoud op. Voer daarna met expliciet toegestane accounts de training-/voeding-/trackerketen en trainerverversing op twee apparaten uit. Geen echte uitnodigingen zonder opdracht.
7. Controleer dat lidresponses één eigen klant bevatten, zonder andere leden, conceptplannen of administratie. Test vreemde klant-ID, rolwijziging en verouderde schrijfwaarde: alle moeten worden geweigerd.
8. Controleer tokenrotatie/sessieverloop/accountwissel en de mobiele trainerweergave. Lokale tests bewijzen echte GoTrue/PostgREST/SMTP en fysieke concurrerende databaseconnecties niet.

## Terugval

- SQL-fouten rollen door BEGIN/COMMIT de migration geheel terug. Publiceer afhankelijke Edge/frontend dan niet.
- Bij problemen na SQL: houd onderhoud actief en behoud aangescherpte rechten. Zet niet alleen de oude frontend terug en geef leden geen brede workspace-toegang terug.
- Voorkeur: een kleine geteste correctie boven op de nieuwe RPC-interface. Als volledige terugval noodzakelijk is, herstel de vooraf vastgelegde schema-/functieback-up, Edge-versie en frontend als één gecoördineerde actie, uitsluitend na toestemming. Houd leden afgesloten totdat de bekende oude privacyfout opnieuw is afgevangen.
- Draai klantdata niet automatisch terug: dat kan nieuwe logs verliezen. De migration houdt profielen en JSON-workspaces in hetzelfde gegevensmodel.
- De aanvullende vervalkolom/indexes mogen blijven als ze herstel niet hinderen. Er is bewust geen destructieve down-migration die oude brede rechten automatisch herstelt.

Tijdens de voorbereiding is niets aan productie gewijzigd.
