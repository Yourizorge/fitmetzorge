# Fit Met Zorge: bestaande productie-app

Deze repository is de app op **https://appfmz.nl**: `Yourizorge/fitmetzorge`, Supabase-productieproject `hgoygcviutmynaihcvpd`.

De root `index.html` laadt `styles.css`, `config.js`, `sync.js` en `app.js`. `CNAME` bevat `appfmz.nl`. Er is geen vereiste `trainer-client-app/` subdirectory. De oude standalone-HTML verwijst naar dezelfde rootapp.

## Reparatie beoordelen

Installeer Node 24 en pnpm, en voer in de repository uit:

```sh
pnpm install --frozen-lockfile
# Buiten Windows gebruikt de test Playwright Chromium:
pnpm exec playwright install chromium
pnpm test
pnpm preview
```

De preview draait op `http://127.0.0.1:8876`, met uitsluitend synthetische data in een tijdelijke lokale PostgreSQL-engine. Accounts: `trainer@example.test` (Trainer), `a@example.test` en `b@example.test` (Lid). Elk wachtwoord werkt in deze testpreview. Er worden geen echte accounts of mails aangemaakt. De data verdwijnt bij herstart. Op Windows gebruikt de browsertest geïnstalleerde Edge.

## Backend en publicatie

De vroegere verwijzing naar een ontbrekend `supabase/schema.sql` was onjuist. Deze reparatie bevat een concrete migration voor het bestaande productieschema en de opgehaalde/aangepaste Edge Function. Voer de migration niet uit tegen een leeg of ander project.

Lees eerst het [bugfixrapport](docs/APPFMZ_BUGFIX_REPORT.md) en de [publicatievolgorde met terugvalplan](docs/APPFMZ_DEPLOYMENT_PLAN.md). Database, Edge en frontend vormen één release. Na de reparatie verzorgen gecontroleerde RPC's de opslag en beperkte lidprojectie. Nieuwe trainerbevoegdheden worden door een beheerder toegekend; registratiekeuzes geven geen trainerrechten.

`config.js` bevat alleen publieke configuratie, nooit een service-role-key. De Edge Function gebruikt server-side secrets. De auth-redirect in deze app is `https://appfmz.nl`; verifieer de productie-allowlist bij deployment. `https://www.fitmetzorge.com` is hiervoor geen vervanging.

Een ontbrekende SDK/configuratie blokkeert online inloggen. Alleen expliciete localhost-demo kan lokaal werken. Privéworkspaces worden niet meer in localStorage bewaard. Exporteer niet-opgeslagen invoer voordat je het tabblad sluit.

Publicatie en productiedatabasewijzigingen zijn niet uitgevoerd en vereisen definitieve toestemming van de eigenaar.
