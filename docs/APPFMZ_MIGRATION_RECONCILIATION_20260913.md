# APPFMZ projectbrede migration-identiteit — 13 september 2026

Scope: `Yourizorge/fitmetzorge`, productieproject `hgoygcviutmynaihcvpd`, `appfmz.nl`. Start-HEAD: `c0699b9a1afb01e10c2b6e6c208b19852b95edec`. Alleen Git-identiteiten, bijbehorende testpaden en documentatie worden gecorrigeerd. Geen productie-SQL, history repair, schemawijziging, SQL-replay, reset, datawijziging of betaalde dienst. Staging, marketingwebsite en AI vallen buiten de werkzaamheden.

## Bewijs per migration

Alle zes mappings zijn vóór enige Git-wijziging afzonderlijk bewezen. De volledige geregistreerde statementtekst uit `supabase_migrations.schema_migrations` is vergeleken met het lokale bestand én de Git-blob. Elke migration is in Git uitsluitend toegevoegd in de hieronder genoemde oorspronkelijke commit; de SQL-blob is daarna nooit gewijzigd.

De bronbestanden hebben op Windows CRLF of gemengde regeleinden; Git bewaart LF. Sommige productie-statements bewaren de oorspronkelijke CRLF, andere LF. Vergelijkingen zijn eerst met uitsluitend buitenste witruimte getrimd uitgevoerd, daarna expliciet met CRLF→LF waar nodig. Er is geen andere tekstnormalisatie gebruikt. Na LF en trim zijn alle zes volledige teksten gelijk. De Git-hernoemingen behouden de SQL-blobs volledig, inclusief commentaar en afsluitende newline: geen inhoudelijke wijziging en geen noodzakelijke normalisatie in Git.

Alle bestandsnamen hieronder staan onder `supabase/migrations/`.

| Oorspronkelijk bestand | Canonical bestand | Git-bytes, ongewijzigd | Status |
| --- | --- | ---: | --- |
| `20260908171653_appfmz_storage_security.sql` | `20260909103959_appfmz_storage_security.sql` | 16689 | Bewezen |
| `20260909112000_appfmz_conflict_response.sql` | `20260909151429_appfmz_conflict_response.sql` | 5066 | Bewezen |
| `20260909164637_appfmz_autosave_annotations.sql` | `20260909172334_appfmz_autosave_annotations.sql` | 8650 | Bewezen |
| `20260910145050_appfmz_owner_accounting.sql` | `20260910170351_appfmz_owner_accounting.sql` | 48367 | Bewezen |
| `20260910171432_appfmz_accounting_closed_bank_period.sql` | `20260910171555_appfmz_accounting_closed_bank_period.sql` | 1161 | Bewezen |
| `20260911084106_appfmz_owner_hotfix.sql` | `20260911094831_appfmz_owner_hotfix.sql` | 36334 | Bewezen |

### SHA-256 van de volledige Git-SQL vóór en na hernoemen

| Canonical versie | SHA-256 |
| --- | --- |
| `20260909103959` | `21d0f6ea93d656b0c4c3238c2630113179c24eaff31ec8e4c5c98f7438c8014c` |
| `20260909151429` | `44b57260741898817eda23f37ce28685a73bce8f23e334873b95328645f773fe` |
| `20260909172334` | `67d2f5967b25a3c0ecd2e7756ba0feda3eb3a5591348ddb0c7693fb5dccd4f80` |
| `20260910170351` | `3599c53aab5eeec0ee6ca9e5ed85ac23f11ecaeb9136a134d9f9608d84ac50f7` |
| `20260910171555` | `2b870f6de34c9ebf1b95de139a19b165016ffb0649c1384da74b7670a69367e9` |
| `20260911094831` | `c04dc3f8e67d2eb119b52fdd838cae879237e12dceeae136d1f5f80cfbbe193c` |

### SHA-256 van volledige SQL na uitsluitend LF/trim, lokaal én productie gelijk

| Canonical versie | SHA-256 |
| --- | --- |
| `20260909103959` | `312df7759ab0bad4909e275baf4a5d94fd3afc4990c405d8ae555e825832a4a0` |
| `20260909151429` | `85f16325fd534d933c5ab51ae5ff99182231d980a47e43892b47ca0191354eb1` |
| `20260909172334` | `aefd5ce2bf50f13e58e746fd65151a49d694d83c6ca14940c74384b5018214a7` |
| `20260910170351` | `15ec7bd1683518b87a2951a43110093a3d2c4401f5f910568b9ded4591aecd5c` |
| `20260910171555` | `11adef90d31a84e87fec41af86d16b338b5a5c23c8d747d252833e86e8034e9e` |
| `20260911094831` | `60e8569aea1f75e3258ad82c166c1a2e8d4072bc49a949a4b6469feaf5560b9d` |

[Het machineleesbare bewijsmanifest](APPFMZ_MIGRATION_IDENTITY_20260913.json) bevat daarnaast de exacte oorspronkelijke Windows-bestandsgroottes/-hashes, productie-statementgroottes/-hashes, oorspronkelijke Git-commits, migrationnamen en objectinventaris per migration. De oorspronkelijke commits zijn respectievelijk `d989c5b`, `5c45631`, `22f219f`, `fae1700`, `fae1700` en `c994840` (volledige IDs in het manifest).

## Actuele productieobjecten

De bestaande geïsoleerde lokale PostgreSQL-fixtures zijn gebruikt om het cumulatieve resultaat te vergelijken met read-only productiecatalogi. Er zijn geen synthetische accounts of gegevens in productie aangemaakt voor deze reconciliatie.

- Alle **34 functies** hebben dezelfde volledige definitie na uitsluitend regeleindnormalisatie, dezelfde signatuur, security-definer/invoker, volatility, strictness, parallel-instelling en search_path. Het manifest vermeldt per functie de laatste migration die haar definitie bepaalt; eerdere versies die later bewust zijn vervangen zijn niet ten onrechte als actuele definitie behandeld.
- Beide private schemas, alle **10 toegevoegde tabellen**, **80 kolommen**, **36 constraints**, **20 bijbehorende indexes** en de identity-sequence komen overeen. Ook de twee specifiek toegevoegde publieke indexes, `expires_at`, bestaande publieke kolommen, RLS en relevante grants zijn gecontroleerd.
- Alle **vier policies** in de betrokken catalogus komen overeen, waaronder de twee private Storage-policies. De zeven ingetrokken oude policies ontbreken. Beide toegevoegde triggers zijn identiek.
- De bucket `fmz-finance` is privé en heeft dezelfde grens van 12.000.000 bytes.

Verklaarde testfixtureverschillen zijn afzonderlijk beoordeeld: productie PostgreSQL 17.6 versus de lokale catalogus met expliciete NOT NULL-constraintrecords (kolomnullability is gelijk); bestaande publieke foreign keys/indexes en Supabase Storage-platformobjecten zijn prerequisites, geen DDL uit deze zes migrations. De productie-default-ACL toont expliciet de bestaande `service_role`-grants voor public-tabellen en public-functies; deze zijn niet door de migrations ingetrokken en niet gewijzigd. Alle overige betrokken rechten zijn gelijk. Deze verschillen zijn niet met schemawijzigingen 'gerepareerd'.

## Gezamenlijke correctie en CLI-controle

Alle zes SQL-bestanden worden als **100%-identieke Git-hernoemingen** verwerkt. Acht paden in drie bestaande testbestanden zijn bijgewerkt. De historische releaserapporten bewaren hun oorspronkelijke namen en bevatten bovenaan een correctieverwijzing. Het oorspronkelijke deploymentplan verwijst naar het canonical pad en waarschuwt dat de reeds toegepaste stappen niet opnieuw mogen worden uitgevoerd. Geen runtime- of Edgebestand is gewijzigd.

Met Supabase CLI **2.117.0** en expliciet project-ID:

```sh
supabase migration list --linked --project-ref hgoygcviutmynaihcvpd
supabase db push --linked --project-ref hgoygcviutmynaihcvpd --dry-run --skip-vault
```

De [officiële CLI-documentatie](https://supabase.com/docs/reference/cli/supabase-db-push) en actuele CLI-hulp zijn gecontroleerd. `--skip-vault` voorkomt dat Vault-configuratie vooraf wordt bijgewerkt. Er zijn geen include-all-, seed-, role-, repair- of uitvoeringsopties gebruikt.

```text
LOCAL           REMOTE
20260909103959  20260909103959
20260909151429  20260909151429
20260909172334  20260909172334
20260910170351  20260910170351
20260910171555  20260910171555
20260911094831  20260911094831

{"upToDate":true,"dryRun":true,"migrations":[],"seeds":[],"roles":[],
 "message":"Remote database is up to date."}
```

Er zijn zes unieke migrations, zonder dubbele, local-only of remote-only versie. De nieuwe lokale regressie `tests/migration-identity.test.cjs` controleert de canonical namen, uniciteit, afwezigheid van oude paden en volledige goedgekeurde SQL-hashes.

## Afrondingsbewijs

- De volledige bestaande suite is lokaal uitgevoerd met `FMZ_LIVE_TESTS=0`: **16 tests geslaagd, 0 mislukt, 0 overgeslagen**, in 213,6 seconden. Dit omvat PostgreSQL/migrations, autosave/workouts/voeding/foto's, sessieprivacy, beide factuurschermen, echte PDF-generatie, boekhouding/conflicten en de mobiele/desktop-bedieningsmatrix. Uitnodigingsmails zijn onderschept. De nieuwe migration-identiteitstest is daarnaast afzonderlijk geslaagd: totaal **17/17**.
- De volledige read-only productiecatalogus is vóór en na de gezamenlijke correctie **identiek**, inclusief alle beschreven functies, tabellen, kolommen, policies, triggers, indexes en ACLs. Ook alle zes volledige historyrecords zijn exact gelijk gebleven.
- SHA-256 en rijtellingen van **17 tabellen** zijn vóór/na identiek: profielen, workspaces, invites, receipts en annotaties; alle acht financiële tabellen; Auth users/identities en Storage buckets/objects. Geen klantinhoud of private PDF is gewijzigd of opnieuw gepubliceerd. De opgeslagen PDF-hash en Storage-metadata zijn onveranderd; private PDF-bytes zijn voor deze identiteitscontrole niet opnieuw gedownload.
- Alle **19 live runtimebestanden** geven HTTP 200 en zijn byte-identiek aan `c99484071e8527db8819755e185b827532280afd`. Onderhoud blijft uit. Er zijn geen productieaccounts, uitnodigingen, mails, facturen, boekingen of tijdelijke productiefixtures aangemaakt.
- Een verse export uit de Git-index is geslaagd: dezelfde zes namen/hashes, zes gelijke lokale/remote versies, lege dry-run en geslaagde migration-identiteitstest. De volledig verse checkout vanaf de gepushte GitHub-commit wordt na publicatie hieronder vastgelegd.

Klantgegevens, Auth-, Storage- en financiële rijhashes blijven uitsluitend privé buiten Git. Het dossier buiten de repository bevat de volledige catalogi, history-statements, voor-/nahashes, lokale vergelijkingsscripts en CLI-/testlogs. Het publieke bewijsmanifest bevat uitsluitend migration- en objectmetadata.
