# APPFMZ — agenda, maandtelling en optionele meldingen

Scope: uitsluitend `Yourizorge/fitmetzorge`, `appfmz.nl`, productieproject `hgoygcviutmynaihcvpd`. Baseline `ac497672f9c5d2877cd283c856c9467a89c02e44`. Werkbranch `codex/agenda-reminders-20261015`.

**Status: PASS — gepubliceerd op appfmz.nl en live gecontroleerd.** Definitieve runtimecommit `42d42eb7c22c23493473b600e02d2455e56d8dae`; [geslaagde publicatie](https://github.com/Yourizorge/fitmetzorge/actions/runs/38727708099). De afrondende documentatiecommit wijzigt geen runtimebestanden. Eerste implementatiecommit `c0a2fcbbed7f20785ab2f3c488add1af0ba66377`. De owner heeft deze agenda-/meldingenrelease opgedragen, inclusief noodzakelijke minimale additieve backendvoorzieningen. Er is geen betaalde dienst geactiveerd. De eerdere trainer-/PWA-release is door de owner geaccepteerd; dat staat afzonderlijk in het bijbehorende rapport. Fysieke iPhone-pushontvangst en owneracceptatie van deze agenda-uitbreiding staan nog open.

## Inventaris en wijzigingen

De bestaande agenda bewaarde concrete afspraken in `coach_workspaces.state.clients[].appointments`. De oude tabel gebruikte wisselende tijdrijen zonder evenredige tijdschaal, verborg verstreken afspraken uit de week en maakte bij plannen/wijzigen een administratieregel aan. Verwijderen kon een gekoppelde administratieregel verwijderen. De oude browsermelding werkte alleen in de geopende browser en bevatte een klantnaam.

De nieuwe dag-, week-, maand- en lijstweergave gebruiken dezelfde afspraken. Plannen, bewerken, herhalen, bekijken, annuleren en afspraaksoorten beheren blijven bereikbaar. De dag/weektijdlijn gebruikt werkelijke starttijd en duur; overlappende afspraken staan naast elkaar. Op kleine telefoons is week een leesbare lijst; maanddagen openen de betreffende dag. Appbediening opent de bestaande zoek-, klant-, sessie- en installatieknoppen. Geen slepen: de toegankelijke editor biedt dezelfde planning via expliciete bevestiging.

Agendahandelingen schrijven uitsluitend afspraakvelden en de afgeleide meldingenwachtrij. Geen prijs, pakket, betaalcyclus, factuurnummer, boeking of auditregel wordt gekozen/aangemaakt/veranderd. Bestaande financiële velden op oude afspraken blijven bewaard; de financiële bediening blijft in de bestaande administratie. De nieuwe agenda-RPC weigert financiële velden. Historische facturen/PDF’s blijven ongewijzigd.

Bij ieder klantprofiel staat **Afspraken deze maand**, met vorige/volgende kalendermaand en aanklikbare aantallen. Alleen `attended`/`completed` telt als geweest. Een verstreken afspraak zonder bewijs is **Aanwezigheid onbekend**. Geannuleerd/niet verschenen zijn apart. Nieuwe duoafspraken delen een concrete occurrence-ID maar bewaren aanwezigheid per deelnemer. Herhaling maakt maximaal 12 concrete afspraken met stabiele identiteit. Verplaatsen telt in de nieuwe afspraakmaand, onafhankelijk van maand- of vierwekenfacturatie.

De read-only productie-inventaris vond 18 bestaande afspraken, zonder ontbrekende ID/datum of dubbele identiteit: 14 `planned`, vier zonder status. Er wordt geen aanwezigheid terugwerkend ingevuld. Onbekende oude privénotities blijven trainer-only; nieuwe gedeelde notities krijgen een afzonderlijk veld.

## Opslag, rechten en meldingen

`20261015102946_appfmz_agenda_reminders.sql` voegt het private schema `fmz_agenda` toe: idempotente verzoeken, eigen voorkeuren, duurzame berichten, pushabonnementen en afleveringen. Alle tabellen hebben RLS en geen directe anon/authenticated-toegang. De agenda blijft in de bestaande workspace. Bestaande functies en beveiligingsgrenzen worden niet vervangen.

De nieuwe RPC’s gebruiken de bestaande gecontroleerde profiel-/sessieautoriteit. Alleen de trainer van de workspace kan wijzigen; een lid ontvangt alleen de eigen afspraakprojectie, zonder namen/statussen van andere deelnemers. Aanwezigheid, detailacties en berichtlinks worden server-side gecontroleerd. Een oude versie geeft één `PT409`/HTTP409; geen automatische conflictretry. Herhalen na een verloren antwoord gebruikt dezelfde request-ID. Concepten staan alleen in tabgeheugen, zijn aan het account gebonden en verdwijnen bij tabsluiting. Uitloggen schermt de UI af; niet-opgeslagen concepten worden niet aan een volgend account getoond.

Cron verwerkt iedere minuut de duurzame wachtrij. Edge wordt alleen aangeroepen wanneer pushafleveringen klaarstaan. Wijzigingen/annuleringen en actuele rechten worden vóór verzending gecontroleerd. Een lease, unieke aflevering, maximaal vier pogingen, Web Push Topic, een stabiele notification-tag en een lokale ontvangstlijst met alleen willekeurige ID’s beperken dubbele afleveringen bij herstarts en netwerkherhaling. Verlopen abonnementen (404/410) worden opgeruimd. Er komt geen historische inhaalronde.

Meldingen staan standaard zonder push en zonder voorafherinnering. Trainer en lid kiezen hun eigen voorkeur. Alleen **Meldingen inschakelen** vraagt browsertoestemming. Weigering/ontbrekende ondersteuning laat het in-appoverzicht werken. Push bevat uitsluitend algemene tekst; de link opent na inloggen de nog toegestane afspraak. De serviceworker heeft geen fetch-handler/cache, `skipWaiting` of automatische reload. Bestaande PWA-identiteit `/`, iconen en instellingen blijven gelijk. Lokale ontvangst-ID’s bevatten geen agenda-, klant- of sessiegegevens en verlopen na de geldigheid van de melding.

De Edgefunctie gebruikt een afzonderlijke cron-bearersleutel; een gewone gebruiker-JWT geeft geen verzendrecht. Platform-JWT-verificatie voor deze nieuwe machinefunctie staat uit wegens deze expliciete eigen controle. `invite-client` blijft ongewijzigd met JWT-verificatie aan. VAPID-privésleutel en cron-token blijven uitsluitend server-side/Vault en in de private back-upmap.

Tijdzone: **Europe/Amsterdam**. Niet-bestaande tijden bij de zomertijdsprong worden geweigerd. De dubbel voorkomende herfsttijd gebruikt de standaardtijd (de tweede 02:30). Kalendermaanden volgen de lokale afspraakdatum, niet de aanmaakdatum of toestelzone.

## Controlebewijs

- Volledige bestaande regressieronde: 38/38 PASS (34 bestaande plus vier toen aanwezige agenda-tests).
- Aanvullende definitieve kernronde: 6/6 PASS, inclusief versleuteling/decryptie, workerbeveiliging, idempotentie, duo, maandgrenzen, PT409/rollback, verplaatsen/annuleren, DST, sessie-intrekking, geen backlog en synthetisch herstel.
- Gerenderde agenda: Edge op 320/390/768/844/1400px; alle vier weergaven. WebKit/iPhone en Android-emulatie: beide rollen op dezelfde vijf breedtes, liggend, grotere tekst, Escape/focus en push toestaan/weigeren/uitschakelen. Geen fysieke telefoon- of pushontvangst geclaimd. Push-API’s zijn in de browsergedragstest gecontroleerd gesimuleerd.
- [Browsermetingen](examples/agenda-20261015/browser-checks.json), [mobiele/browsermetingen](examples/agenda-20261015/mobile-browser-checks.json).
- Synthetische opslagproef: typen geeft geen afspraak; verbindingsverlies bewaart het formulier; expliciet opnieuw proberen maakt één afspraak; refresh/herladen bewaart dezelfde waarden; aanwezigheidsaantallen openen de juiste afspraken; leden zien geen andere deelnemer.
- Definitieve gerichte ronde na de laatste presentatie-/privacyaanpassingen: 5/5 PASS (push/worker, beide agenda-browserproeven en bestaande browseropslag-/rol-/sessieregressie).
- [Echte PostgREST/Auth/Cron-proef](examples/agenda-20261015/production-api-checks.json): vier nieuwe synthetische accounts, concurrente identieke aanvragen maken één afspraak; duo en aanwezigheid per deelnemer; andere trainer en leden kunnen niet wijzigen; correctie/verplaatsing/annulering behouden financiële sentinel; herinloggen bewaart gegevens; ingetrokken sessie geweigerd. Stale revision geeft één `PT409`/HTTP409 in 131 ms en laat de volledige workspace ongewijzigd. De werkelijke achtergrond-Cron heeft de in-appberichten aangemaakt. Geen e-mail of pushabonnement gebruikt.
- [Live Edgeproef](examples/agenda-20261015/production-worker-checks.json): zonder eigen bearer HTTP401, met cron-bearer HTTP200; nul afleveringen geclaimd/verzonden. Dit bewijst de functiebeveiliging, nog geen fysieke pushontvangst.
- [Echte geplande herinnering](examples/agenda-20261015/production-reminder-checks.json): synthetische afspraak met 15 minuten voorafherinnering. De server-Cron maakte deze zichtbaar om 11:26:05 UTC, met due-time 11:26:00 UTC. Geen browser-timer of handmatige tick gebruikt; geen pushabonnement of klantmelding.
- [Gepubliceerde bestanden](APPFMZ_AGENDA_ASSETS_20261015.json): 53 live bestanden exact vergeleken met Git. Beschermde runtimebestanden, administratie, facturen, PDF’s, autosave, media en iconen blijven byte-identiek aan de baseline.
- [Live browsercontrole](examples/agenda-20261015/live-browser-checks.json): aangemeld als eigen synthetische trainer en lid, op telefoon-/laptopformaat. Geen horizontale overflow, herladen bewaart gegevens, ledenprojectie blijft privé, maandkaarten zichtbaar, uitloggen leegt agenda; geen JavaScript-fouten. Dit is Edge-emulatie, geen fysieke iPhoneproef.

Een extra regressie reproduceerde na de eerste publicatie een randgeval: een voorkeurenopslag verwijderde de waarschuwing van een nog niet opgeslagen afspraakconcept. Het herstel houdt die conceptstatus apart. Een onbevestigd verzoek krijgt bovendien een zichtbare herhaalknop die dezelfde request-ID en payload gebruikt, ook na sluiten van het venster. Een netwerkproef laat het oorspronkelijke serverantwoord bewust verloren gaan en controleert herstel zonder een tweede opdrachtidentiteit. Open concepten en onbevestigde verzoeken blijven alleen voor hetzelfde account in tabgeheugen bereikbaar.

Na dit herstel: 5/5 gerichte tests PASS (nieuwe concept-/antwoordverliesregressie, beide agenda-browserproeven, beide push-/workerproeven). De nieuwe regressie faalde vóór de correctie en slaagt erna. Hiervoor is geen aanvullende databasewijziging gedaan.

De definitieve runtime is daarna opnieuw live gecontroleerd: alle 53 bestanden gelijk aan commit `42d42eb7c22c23493473b600e02d2455e56d8dae`, beide rollen op 390/1400px zonder fouten. Live screenshots met uitsluitend eigen synthetische gegevens: [trainer telefoon](examples/agenda-20261015/live-trainer-390.png), [trainer laptop](examples/agenda-20261015/live-trainer-1400.png), [lid telefoon](examples/agenda-20261015/live-member-390.png), [lid laptop](examples/agenda-20261015/live-member-1400.png).

## Productiebackend

Uitsluitend migration `20261015102946_appfmz_agenda_reminders.sql` is transactioneel toegepast; SHA-256 `b94baebec70b3e9e127ead68c1c2d58861bfaa1bde3e9be3571abf7b29439e55`. Alle acht lokale/remote versies zijn gelijk. `db push --dry-run --skip-vault` meldt `upToDate:true`, met lege migrations/seeds/roles. De zeven bestaande migrations zijn niet opnieuw uitgevoerd.

`agenda-reminders` is ACTIVE versie 1. De eigen cron-bearer en VAPID-sleutels zijn ingesteld; push is technisch beschikbaar, maar staat per gebruiker uit totdat die bewust inschakelt. Cron `appfmz-agenda-reminders` draait iedere minuut; de gecontroleerde runs zijn geslaagd. `invite-client` blijft ACTIVE versie 7, JWT-verificatie aan, bestaand deploytijdstip en source ongewijzigd.

Definitief reproduceerbaar bewijs: [migrationlijst](examples/agenda-20261015/migration-list.json), [lege dry-run](examples/agenda-20261015/migration-dry-run.json), [RLS/Cron/opruimstatus](examples/agenda-20261015/production-status.json). De zes nieuwe private tabellen hebben RLS; anon kan de read-RPC niet uitvoeren, gewone gebruikers kunnen de worker niet uitvoeren of de berichtentabel direct lezen.

De security-advisor heeft geen ERROR gevonden. RLS-zonder-policy is bij de private tabellen bewust deny-by-default: alleen gecontroleerde RPC’s hebben toegang. Er staan WARN-meldingen voor de standaardregistratie van de niet-verplaatsbare `pg_net`-extensie in public ([uitleg](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)) en de bestaande uitgeschakelde leaked-password protection ([uitleg](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Deze release wijzigt geen Auth-instellingen of abonnement; `net` is geen nieuw publiek API-schema.

| Weergave | Voor | Na |
|---|---|---|
| Trainer telefoon | [Voor](examples/agenda-20261015/before-trainer-390.png) | [Na](examples/agenda-20261015/after-trainer-390.png) |
| Trainer laptop | [Voor](examples/agenda-20261015/before-trainer-1400.png) | [Na](examples/agenda-20261015/after-trainer-1400.png) |
| Lid telefoon | [Voor](examples/agenda-20261015/before-member-390.png) | [Na](examples/agenda-20261015/after-member-390.png) |
| Lid laptop | [Voor](examples/agenda-20261015/before-member-1400.png) | [Na](examples/agenda-20261015/after-member-1400.png) |

## Herstel en publicatievolgorde

Een nieuw versleuteld checkpoint is gemaakt buiten Git/OneDrive, met alle 14 applicatietabellen, Auth, schemafuncties/rechten/constraints en drie private Storage-bestanden. Ciphertext, HMAC, plaintext-hash en de teruggelezen bestanden zijn geverifieerd. Echte klantgegevens zijn niet voor tests teruggezet. De restoreproef gebruikt uitsluitend vaste synthetische profielen, afspraken, verzoeken en berichten.

De dry-run vóór toepassing noemt uitsluitend de bovenstaande nieuwe migration, met lege seed-/roleslijsten. Geen oude migration uitvoeren, geen repair/reset. Na de transactionele toevoeging volgen privésleutels, uitsluitend `agenda-reminders`, eigen synthetische PostgREST/Auth-proeven, Cron-controle, gegevensbehoud, frontendpublicatie en bytevergelijking. Geen automatische klantpush tijdens tests.

Deze volgorde is uitgevoerd. De vier eigen testaccounts zijn op marker/e-mailadres gecontroleerd en uitsluitend hun afspraken, voorkeuren, berichten, verzoeken, profielen en Auth-accounts zijn verwijderd. [Gegevensbehoud](examples/agenda-20261015/data-preservation.json) vergelijkt het moment direct vóór de migration met na opruimen: alle 18 bestaande tabellen exact dezelfde aantallen en inhoudshashes, alle 41 oorspronkelijke functies dezelfde definitiehash, alle drie private Storage-bestanden byte-identiek aan het versleutelde checkpoint. Dit omvat bestaande memberdata, afspraken, financiële afspraken, facturen, boekingen, audit, Auth en PDF’s. Staging, website en JARVIS/AI zijn niet gewijzigd. APPFMZ blijft beschikbaar; geen onderhoudsscherm actief.

Terugval: bij een SQL-fout rolt de transactie terug. Na een geslaagde toevoeging blijven tabellen en bestaande gegevens staan. Zet bij een workerprobleem `fmz_agenda.config.enabled=false` en de specifieke Cronjob uit; in-app agenda/administratie blijven bruikbaar. Bij een agenda-RPC-probleem geen schrijfknoppen vrijgeven, invoer behouden en gerichte correctie uitvoeren. Geen oude onveilige rechten herstellen, geen historie overschrijven en geen oude frontend met automatische agenda-financemutaties opnieuw vrijgeven.

## Nog fysiek te bevestigen

De owner heeft de geïnstalleerde APPFMZ op zijn eigen **iPhone** gekozen. Technische/browserresultaten bewijzen nog geen ontvangst op dat toestel.

1. Open FitMetZorge vanaf het beginscherm. Bekijk Agenda in Dag/Week/Maand/Lijst en open een bestaande afspraak.
2. Bekijk bij een lid **Afspraken deze maand**, wissel maand en tik een aantal open. Registreer uitsluitend werkelijke aanwezigheid; dit maakt geen financiële handeling.
3. Ga naar **Agenda → Meldingen → Meldingen inschakelen**, sta meldingen toe en tik **Testmelding op mijn toestel**. Zet de app op de achtergrond en wacht ongeveer één minuut. Controleer dat de tekst geen klantgegevens bevat.
4. Tik de testmelding aan: die opent na eventuele login het berichtenoverzicht. Een echte afspraakmelding opent de betreffende toegestane afspraak. Controleer vervolgens een gekozen voorafherinnering bij een eigen toekomstige afspraak; de trainer kiest zijn eigen herinnering, het lid apart de zijne.

Geen bestaande klant heeft een testpush of e-mail gekregen. De sender-autorisatie, versleuteling, providerfoutafhandeling en serverwachtrij zijn technisch getest; de Apple-provideraflevering en zichtbare ontvangst op de fysieke iPhone worden pas als geslaagd aangemerkt na deze ownerproef.

Technische bronnen: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Web Push library](https://github.com/web-push-libs/web-push). Changelog gecontroleerd; de aangekondigde verwijdering van oude TLS-ciphers vereist geen wijziging voor de geteste moderne browsers.
