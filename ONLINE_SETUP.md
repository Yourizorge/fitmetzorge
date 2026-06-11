# Fit Met Zorge online zetten

Deze app kan lokaal als demo blijven draaien. Voor echte accounts, synchronisatie tussen telefoon/laptop/iPad en uitnodigingsmails gebruik je Supabase.

## 1. Supabase project maken

1. Maak een project aan op Supabase.
2. Ga naar `SQL Editor`.
3. Kopieer de inhoud van `supabase/schema.sql`.
4. Run de SQL. Dit maakt de tabellen, beveiliging en invite-koppeling aan.

## 2. App configureren

1. Open `trainer-client-app/config.js`.
2. Vul je projectgegevens in:

```js
window.FMZ_CONFIG = {
  SUPABASE_URL: "https://jouw-project.supabase.co",
  SUPABASE_ANON_KEY: "jouw-public-anon-key",
  INVITE_FUNCTION_NAME: "invite-client"
};
```

Je vindt deze waarden in Supabase bij `Project Settings` > `API`.

## 3. Uitnodigingsmail functie deployen

Installeer de Supabase CLI en log in:

```bash
supabase login
supabase link --project-ref jouw-project-ref
supabase functions deploy invite-client
```

Zet daarna de secrets:

```bash
supabase secrets set SITE_URL=https://jouw-github-naam.github.io/jouw-repository/
```

Supabase vult `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` normaal zelf voor Edge Functions.

## 4. GitHub Pages

1. Upload deze hele projectmap naar GitHub.
2. Zet GitHub Pages aan.
3. Kies als site-root de repository root. De root `index.html` stuurt automatisch door naar `trainer-client-app/`.
4. Open de GitHub Pages URL.

## 5. Werking

- Trainer registreert zichzelf in de app.
- Trainer voegt een lid toe via e-mail.
- De app slaat het lid op in de online workspace.
- De Edge Function stuurt de Supabase-uitnodigingsmail.
- Het lid registreert/logt in met hetzelfde e-mailadres.
- Trainer en lid zien op telefoon, laptop en iPad dezelfde gekoppelde data.

De optie `Inloggegevens onthouden` bewaart de sessie op dat apparaat. Staat deze uit, dan blijft de sessie alleen voor het huidige browservenster bewaard.

## 6. Wachtwoord reset en uitnodigingen testen

Zet in Supabase bij `Authentication` > `URL Configuration` deze URL bij de toegestane redirect URL's:

```text
https://www.fitmetzorge.com
```

Test wachtwoord vergeten:

1. Open de app.
2. Klik op `Wachtwoord vergeten?`.
3. Vul het e-mailadres van een bestaand account in.
4. Open de e-mail en klik op de resetlink.
5. De app opent `Maak/Nieuw wachtwoord instellen`.
6. Vul een nieuw wachtwoord in.
7. Log uit en log opnieuw in met e-mail en het nieuwe wachtwoord.

Test client-uitnodiging:

1. Log in als trainer.
2. Voeg een client toe via e-mail.
3. Open de uitnodigingsmail van die client.
4. De client krijgt automatisch `Maak je wachtwoord aan`.
5. Stel een wachtwoord in.
6. Log uit.
7. Log opnieuw in als `Lid` met hetzelfde e-mailadres en wachtwoord.
8. Controleer of de client nog steeds gekoppeld is aan de trainer en dezelfde plannen ziet.
