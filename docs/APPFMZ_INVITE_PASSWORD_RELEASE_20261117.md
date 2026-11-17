# APPFMZ — eerst wachtwoord instellen na uitnodiging

## Oorzaak en correctie

De oude frontend laadde het profiel en de workspace voordat de uitnodigingspoort werd gezet. Een gelijktijdig SIGNED_IN-event kon ook hydration starten. Na herladen was het URL-type verdwenen en ontbrak een betrouwbare controle op een nog niet ingesteld wachtwoord. Bovendien won de belangrijke trainer-gridstijl van de CSS die de app tijdens aanmelden moest verbergen.

De nieuwe route controleert vóór het laden/koppelen van een profiel of het eigen geverifieerde Auth-account een wachtwoord heeft en, bij uitgenodigde accounts, of de sessie met een wachtwoord is geverifieerd. Een uitnodigingssessie krijgt eerst “Maak je wachtwoord aan”, ook wanneer GoTrue intern al een onbekend tijdelijk wachtwoord heeft gegenereerd. De registratiekeuze en appinhoud blijven dan verborgen. Bestaande wachtwoordlogins blijven normaal werken. Herladen en accountwisselen worden gecontroleerd; recovery blijft over herladen aan hetzelfde account gebonden.

Pas na een geldige Auth-updatebevestiging, succesvolle `signInWithPassword` voor hetzelfde account én een bevestigde serverstatus wordt de app geopend. Afgewezen opslag bewaart de invoer. Dubbele submits en late antwoorden kunnen de poort niet omzeilen. Ook bij `same_password` na een verloren updateantwoord wordt het ingevoerde wachtwoord via Auth gecontroleerd; alleen “er bestaat een wachtwoord” geldt niet als bevestiging van die invoer.

## Database en herstel

Toegepast: `20261117161135_appfmz_invitation_password_gate.sql` en de vooruitwerkende correctie `20261117162324_appfmz_invitation_password_proof.sql`. Eén nieuwe functie `public.fmz_password_status()`, zonder parameters, leest uitsluitend het account van `auth.uid()` en verlangt een bestaande bijbehorende `auth.sessions`-sessie. Uitgenodigde accounts vereisen bovendien de door Auth ondertekende AMR-methode `password`; gebruikersmetadata wordt hiervoor nooit vertrouwd. De respons bevat alleen `user_id` en `password_set`. Geen wachtwoord/hash, andere accounts of klantgegevens worden teruggegeven. Anoniem uitvoeren is verboden. De functie schrijft niets; bestaande tabellen, policies en wachtwoorden blijven intact.

De eerste hosted canary bewees dat alleen password presence onvoldoende was: [GoTrue maakt bij invite-verificatie zelf een tijdelijk wachtwoord](https://github.com/supabase/auth/blob/master/internal/api/verify.go). Daarom bleef de frontend ongepubliceerd tot de aanvullende geteste migration en credentialcontrole gereed waren. De eerste migration is niet herschreven of opnieuw uitgevoerd. [Ondertekende AMR-betekenis](https://supabase.com/docs/guides/auth/jwt-fields).

Herstelpunt/frontend: `7b8951c18f690168e8af2db7af3f7a8253eb758b`, branch `backup/appfmz-pre-invite-password-20261117`. De additieve statusfunctie kan bij frontendterugval veilig ongebruikt blijven; geen database-replay of gegevensherstel nodig. Read-only nulmeting van 23 bestaande tabellen is buiten Git opgeslagen. Reeds ingestelde wachtwoorden, klantkoppelingen, facturen, documenten en betalingen worden niet gewijzigd.

Elke dry-run vóór toepassing toonde uitsluitend de op dat moment bedoelde nieuwe migration. De 15 eerdere lokale en remote versies waren gelijk. Na beide wijzigingen zijn alle 17 versies gelijk en is de [finale dry-run leeg](examples/invite-password-20261117/final-dry-run.txt). [Migrationlijst](examples/invite-password-20261117/migration-list-after.txt). Geen wijziging aan `invite-client`, mailtemplates, Auth-instellingen, staging, JARVIS of bedrijfswebsite.

## Controles

Lokale SQL-test: eigen status true/false, account zonder profiel, geen argument voor ander account, anonieme toegang geweigerd, ingetrokken sessie geweigerd en auth.users ongewijzigd. Browser- en hosted bewijs worden hieronder toegevoegd na afronding.

De definitieve SQL-test weigert ook een provider-temporair wachtwoord met invite-AMR en accepteert wachtwoordbewijs na tokenvernieuwing. De laatste vier browser-/Benvitaaltests gebruiken diezelfde actuele SQL en zijn geslaagd.

[Echte hosted Auth- en PostgREST-controle PASS](examples/invite-password-20261117/hosted-auth.json): invite-verificatie zonder mail, tijdelijk wachtwoord niet toegelaten, wachtwoord-update, echte wachtwoordlogin, tokenrefresh en weigering na uitloggen. Beide canary-accounts (eerste ontdekking + definitieve hercontrole) zijn verwijderd na verificatie van hun eigen unieke marker; geen echte account- of profielmutaties. De [behoudsmeting van 23 bestaande tabellen](examples/invite-password-20261117/preservation.json) is volledig gelijk, inclusief Auth-users/identities, klanten, facturen, betaalafspraken, agenda en Storage-metadata. Er zijn geen mailtjes verstuurd. Fysieke iPhone/mailbediening is hiermee niet geclaimd.

Lokale toelating: 6 verschillende tests geslaagd (1 SQL, 2 uitnodiging/Edge/WebKit, 2 Benvitaal en 1 bestaande notitietest). [Definitieve uitnodigingscontroles](examples/invite-password-20261117/test-results.txt), [hercontrole inclusief notities](examples/invite-password-20261117/regression-recheck.txt). De eerste gecombineerde run had een timeout in de bestaande notitieconflictcontrole; de geïsoleerde hercontrole slaagde zonder wijziging aan notitiecode. [Eerste run bewaard](examples/invite-password-20261117/combined-first-run.txt). Geen fout als PASS weggeboekt.

De gerenderde tests controleren URL verwijderen, herladen, geen profile-/workspaceaanvraag vóór wachtwoord, geweigerde Auth-opslag met behouden invoer, ongeldige bevestiging, dubbel klikken, late Auth-events, `same_password`-herstel, accountwissel, recovery, ontbrekende statusservice en normale bestaande login. De [Edge](examples/invite-password-20261117/password-gate-edge-390.png)- en [WebKit](examples/invite-password-20261117/password-gate-webkit-390.png)-schermafbeeldingen tonen alleen het wachtwoordformulier. Dit zijn browseremulaties, geen fysieke iPhonecontrole.

De veiligheidsadviezen vóór de wijziging bevatten bestaande meldingen over afgeschermde tabellen zonder directe policies, pg_net in public en uitgeschakelde leaked-passwordbescherming. Deze instellingen zijn niet gewijzigd door deze gerichte reparatie. [Uitleg Supabase security linter](https://supabase.com/docs/guides/database/database-linter), [wachtwoordbeveiliging](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Gebruikte primaire documentatie: [Auth-events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [wachtwoord bijwerken](https://supabase.com/docs/reference/javascript/auth-updateuser), [link genereren zonder mailverzending](https://supabase.com/docs/reference/javascript/auth-admin-generatelink). Geen SDK-/CLI-upgrade.

## Bestaande uitnodiging

Als het lid de uitnodiging al heeft geaccepteerd en nog een sessie heeft: APPFMZ verversen. Zonder ingesteld wachtwoord verschijnt alsnog de wachtwoordstap. Bij een verlopen/verbruikte link zonder sessie: Wachtwoord vergeten gebruiken voor een nieuwe resetlink; geen tweede lid/account maken. Wachtwoorden worden niet namens het lid ingesteld of in rapporten opgenomen.
