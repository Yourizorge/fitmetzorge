# Productierelease 9 september 2026 — onderhoud actief

Scope: Yourizorge/fitmetzorge, appfmz.nl, Supabase hgoygcviutmynaihcvpd. Beoordeelde basis: d989c5b1155742290f7612daaa2a7bcdc07f1ccc. Staging en marketing zijn niet gewijzigd.

## Uitgevoerd

- Remote main was 846eb6ba63d28a182a30c058c7a4094cab6fb20d; geen nieuwere wijzigingen overschreven. Bestaande trainers behouden; gecontroleerd op bevestigde auth-e-mail, overeenkomstige profiel-e-mail, geldige workspace-eigenaar en dubbele klantkoppelingen. Dit is een technische controle, geen afzonderlijke identiteitsbevestiging door de beheerder.
- Versleutelde onafhankelijke back-up van appdata, auth-gebruikers/identiteiten en schema-, functie-, grant- en policydefinities buiten GitHub/OneDrive. AES-256-CBC met afzonderlijke HMAC-SHA256; integriteit en herstel van de drie app-tabellen lokaal gecontroleerd. Zeven profielen, twee workspaces en negen uitnodigingen zonder inhoudsverschillen hersteld. Volledig Auth-platformherstel is niet gerepeteerd. Managed PITR bleek niet ingeschakeld.
- Onderhoud stond aantoonbaar live vóór SQL. Laatste workspace-wijziging was vóór de back-up. Een statische onderhoudspagina kan reeds geopende oude tabbladen niet op afstand afsluiten; de pagina waarschuwt zulke tabbladen met onopgeslagen invoer open te houden en de invoer veilig te stellen.
- Uitsluitend de goedgekeurde 20260908171653_appfmz_storage_security.sql transactioneel toegepast via de migration-tool. Registratie: **20260909103959**, naam appfmz_storage_security. Geen db push, reset of historische replay.
- RLS actief op alle drie app-tabellen; authenticated heeft geen ruwe workspace lees-/schrijftoegang; anon geen workspace-RPC. fmz_private is niet via PostgREST blootgesteld (PGRST106).
- invite-client **versie 6 ACTIVE**, verify_jwt **true**. Gedeployde bron komt overeen met beoordeelde bron (afgezien van afsluitende witruimte). Edge bundelhash: 3f359af6703a3462398e753ee1d5860d46e01116c4cf6f0e98b73cd155ab3a00.
- Beoordeelde frontend inclusief sync.js geïntegreerd in main onder onderhoud; tijdelijke aparte HTML-ingang gebruikt voor echte ketentests. Deze testingang wordt verwijderd zolang de release geblokkeerd is.

## Echte productietests

Afzonderlijke GoTrue-accounts voor één synthetische trainer en twee synthetische leden, zonder uitnodigingsmails. Elke browser had een afzonderlijke context; de echte SDK, Auth, PostgREST en RPC werden gebruikt.

Geslaagd vóór de blokkade:

- Traininggewicht, voedingsnotitie/status, stappen en slaapuren opgeslagen; waarden behouden na herladen en uit-/inloggen.
- Trainer ziet dezelfde invoer en ontvangt een volgende wijziging na verversen.
- Lidprojectie bevat uitsluitend de eigen klant, zonder conceptplannen of privé-administratie. Andere klant kan geen ruwe workspace lezen, rol verhogen of vreemde klant wijzigen.
- Edge weigert anon en leden; traineraanroep voor een reeds gekoppeld synthetisch account retourneert alreadyRegistered zonder mailpad.
- Echte refresh-tokenvernieuwing geeft opnieuw toegang tot uitsluitend de eigen workspace.

**Niet als geslaagd beschouwd op productie:** conflictafhandeling, de aansluitende opslagfouttest, accountwissel, ingetrokken sessie en mobiele/desktop animatiecontrole. Lokale tests voor deze onderdelen zijn wel geslaagd; zij vervangen de echte ketentest niet. SMTP/verzending is bewust niet getest.

Alle eigen synthetische accounts, sessies en gekoppelde data zijn verwijderd. Controle daarna: zeven oorspronkelijke profielen, twee oorspronkelijke workspaces, negen uitnodigingen, nul eigen synthetische auth-accounts. Checksums van profielen en workspaces zijn exact gelijk aan vóór de migration. Klantgegevens en bestaande koppelingen zijn behouden.

## Blokkade en concrete correctie ter goedkeuring

Een verouderde schrijfwaarde gebruikt SQLSTATE 40001. De productieversie van PostgREST herhaalt deze fout, waardoor de opslagaanroep blijft hangen. Rechtstreekse PostgREST-aanvragen reproduceren dit ook; het ligt niet uitsluitend aan de browsertest. Dit is beschreven in [Supabase troubleshooting](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b) en [PostgREST issue 3673](https://github.com/PostgREST/postgrest/issues/3673).

Voorbereid, **niet toegepast op productie**:

1. `supabase/migrations/20260909112000_appfmz_conflict_response.sql`: vervangt uitsluitend fmz_private.save_changes door dezelfde functie met de drie toepassingsconflicten als **PT409** (HTTP 409), in één transactie. Geen wijziging aan klantdata, grants, RLS of koppelingen. De oorspronkelijke migration blijft ongewijzigd.
2. app.js herkent PT409 naast de bestaande 40001 als conflict en behoudt invoer. sync.js en Edge blijven ongewijzigd.
3. Regressietests eisen PT409 en bewijzen dat een eerdere geldige wijziging uit dezelfde conflicterende batch wordt teruggedraaid. Lokale browser-, SQL-, Edge- en herhalingstests slagen.

De verleende toestemming noemt uitsluitend de oorspronkelijke migration. Daarom vereist deze aanvullende SQL-correctie afzonderlijke toestemming. Na toestemming: verse gecontroleerde back-up, uitsluitend deze correctie transactioneel toepassen, gecorrigeerde frontend onder onderhoud testen met nieuwe eigen synthetische accounts, alle essentiële controles afronden, opruimen, live bestandsvergelijking en pas daarna onderhoud opheffen. Geen herstel van de oude onveilige toegangsrechten.

## Reproduceerbare hulpmiddelen

`tests/release-backup.cjs` maakt de versleutelde snapshotquery en verifieert het herstel. `tests/production-release.cjs` bevat setup/test/api/cleanup voor uitsluitend dit productieproject en bewaart credentials, manifest en resultaten buiten Git. Gebruik alleen met expliciete productieautorisatie en een privé `FMZ_BACKUP_DIR` met de benodigde beheercredentials. De productiecontroles zijn bewust geen onderdeel van het standaard testcommando. De test verwacht voor conflicten de nog goed te keuren PT409-correctie.

Security advisor: twee informatieve meldingen over RLS zonder policies op tabellen die uitsluitend via gecontroleerde RPC toegankelijk zijn; daarnaast bestaande waarschuwing [leaked password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Auth-configuratie is niet gewijzigd.

## Telefoontest na vrijgave

Open appfmz.nl opnieuw. Log als lid in, sla een trainingswaarde, voedingsnotitie en tracker op en wacht op Opgeslagen. Herlaad en controleer de waarden. Log daarna als trainer in en druk op Verversen. Controleer dezelfde klant/datum en de compacte oefeningsafbeelding. Tijdens onderhoud nog niet uitvoeren.
