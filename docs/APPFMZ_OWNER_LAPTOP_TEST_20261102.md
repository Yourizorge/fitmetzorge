# APPFMZ — afgeschermde eigenaarstest op laptop

Status: technische eigenaarstest en publicatiecontrole PASS. Alleen de afgeschermde synthetische eigenaarstest is gepubliceerd. Owneracceptatie is nog niet gegeven.

Testlink: https://appfmz.nl/?owner-test=1 — aanmelden met het bestaande eigenaaraccount. De ingebouwde begeleiding bevat dezelfde vijftien stappen hieronder. Gebruik uitsluitend de aangeboden fictieve gegevens en voorbeeldfoto.

De opdracht van 2 november gaat vóór de eerdere toestemming om de normale nieuwe routes vrij te geven. Eerst beoordeelt de eigenaar de volledige synthetische laptoproute. Een technische test is geen owner-GO.

## Bewezen livebasis en herstel

De bestaande livebasis is `309cb0db3569f14ac54442c8daec678020ba149a`. De 88 bekende publieke bestanden en de rootalias zijn byte-identiek, de Pages-release verwijst naar deze commit en de 12 productiemigrations komen overeen. Het bewijs en de beperkingen staan in `examples/owner-laptop-20261102/live-baseline.json`.

- Annotated tag: `appfmz-live-before-member-onboarding-20261102`.
- Herstelbranch: `backup/appfmz-pre-member-onboarding-20261102`.
- De branch is vergrendeld, inclusief beheerders; force-push en verwijderen zijn verboden. Readback staat in `examples/owner-laptop-20261102/recovery-protection.json`.
- De actuele nulmeting bevat aantallen en hashes van 24 tabellen, geen klantinhoud.
- Het herstelplan staat in [APPFMZ_OWNER_TEST_ROLLBACK_20261102.md](APPFMZ_OWNER_TEST_ROLLBACK_20261102.md). Dit is geen toestemming voor een databaseherstel of replay.

## Releasegrens

De eigenaarstest gebruikt een afzonderlijk `owner-test/`-pakket. De normale app blijft op de oude bediening; alleen de eigenaarlauncher wordt toegevoegd. De drie voorbereide migrations `20261026154916`, `20261026154917` en `20261026154918` worden hiervoor **niet** op productie toegepast. Ook de nieuwe Edge-functies worden niet gedeployed. De oude maandafspraken, facturen, documenten en bestaande agenda-push blijven hierdoor buiten de test.

| Onderdeel | Productie | Synthetische eigenaarstest |
|---|---|---|
| Eigenaarstest | Alleen serverbevestigde owner | Aan |
| Nieuwe ledenzoeker | Uit | Aan |
| Inschrijfstraat | Uit | Aan |
| Overeenkomst/handtekening | Uit | Aan, conceptvoorwaarden |
| Nieuw ledenprofiel | Uit | Aan |
| Facturatieplanning | Uit | Aan |
| Echte e-mail | Uit | Alleen simulatie |
| Nieuwe factuurpush | Uit | Alleen in-appsimulatie |
| Automatische factuurverzending | Uit | Uit |

## Isolatie

De launcher controleert de actuele gebruiker en gebruikt de bestaande server-side ownercontrole van `fmz_accounting_read`. De sandbox krijgt geen eigenaar-ID, toegangstoken, echte klantgegevens of productie-SDK.

De echte nieuw gebouwde interface draait in een iframe zonder `allow-same-origin`, met `connect-src 'none'`, een beperkte lokale adapter en PGlite. De database is uitsluitend uit synthetische fixtures gemaakt. Test-PDF's dragen een zichtbaar ongeldig-watermerk; de testfactuurnummers gebruiken `TEST-FMZ`.

Een checkpoint bevat de lokale testdatabase en testbestanden in één IndexedDB-record per owner, met een aparte `TEST-…`-run-ID. Pas na bevestigde browseropslag meldt de adapter succes. Dit is lokale opslag op deze browser, geen cloudsynchronisatie of gegarandeerd herstel na het wissen van browsergegevens. De voorwaarde is dat de eigenaar uitsluitend de aangeboden fictieve testgegevens gebruikt.

De reset toont een inventaris van de run. Een veranderd manifest wordt geweigerd. Daarna wordt precies dat ene checkpoint verwijderd, de lokale database gesloten, de bloblinks ingetrokken en de fictieve sessie gewist. De reguliere administratie staat nooit in deze testdatabase.

## Laptoproute — maximaal vijftien stappen

1. Meld je aan als eigenaar en kies **Nieuwe ledeninschrijving testen**. Controleer **TESTMODUS**.
2. Zoek Noor of Sam op naam, e-mail, telefoon en lidnummer en open een profiel.
3. Start een nieuwe inschrijving en vergelijk de zeven pakketkaarten.
4. Kies Progressie en vul uitsluitend de aangeboden fictieve persoonsgegevens in.
5. Bewaar het concept, sluit de test en hervat het na verversen. Ga een stap terug en vooruit.
6. Controleer €380 per vier weken, de datums, dertien periodes en eventuele testkorting.
7. Open de volledige voorwaarden en privacytekst; die moeten duidelijk **CONCEPT — NIET VOOR ECHTE LEDEN** zijn.
8. Teken met muis of touchpad, wis en teken opnieuw. Controleer het voorbeeld en rond de testinschrijving af.
9. Open en download de testovereenkomst onder Documenten; controleer het watermerk en testnummer.
10. Voeg de fictieve voorbeeldfoto toe, vervang/verwijder deze, wijzig een profielveld en bekijk de historie.
11. Bereid het testfactuurconcept voor en controleer periode, bedrag, korting en btw.
12. Open het e-mailconcept, pas de tekst aan, bewaar en controleer de PDF-bijlage.
13. Simuleer een mislukte verzending en daarna herstel; bekijk **Verzonden — simulatie**. Er gaat geen echte mail uit.
14. Simuleer de melding zeven dagen vooraf en op de factuurdatum; controleer de juiste periode.
15. Bekijk de verwijderlijst, verwijder uitsluitend de testgegevens en keer terug naar de bestaande app. Meld welke stappen goed of niet goed gingen.

## Technisch controlebewijs

Negen gerichte geslaagde testgevallen over de vastgelegde runs; zie [test-evidence.json](examples/owner-laptop-20261102/test-evidence.json). Dit is geen claim dat de volledige nieuwe productierelease is toegelaten.

- Edge: volledige route met toets- en muishandtekening, foto, offline profielwijziging, browserherstart, PDF, factuur/e-mail en reset.
- Chrome for Testing156.0.8078.80: kernroute en echte browserzoom via tabs.setZoom/getZoom op100/125/150/200%; afzonderlijk390×844,844×390,768×1024 en1366×768. Geen fysieke laptop- of touchpadacceptatie.
- Onbevoegde accounts geweigerd; tweede testtab geblokkeerd; dezelfde run/concept na volledig sluiten/heropenen van browserproces; accountwissel sluit test.
- Mailfout/herstel geeft één gesimuleerd verzonden bericht. Beide herinneringen zijn lokale simulaties, geen echte push.
- Reset verwijdert het exacte browsercheckpoint, sluit de lokale database en wist de fictieve sessie; een nieuwe run bevat het gemaakte testlid niet. Geen productieaccount of productiebestand is ooit aangemaakt.
- De nieuwe lokale planning leverde aanvankelijk geen canonieke factuurregels. Dit is gecorrigeerd in de nog niet uitgerolde migration en bewezen met direct definitief maken zonder eerst typen. Testinstellingen en de lokale nummergenerator zijn expliciet synthetisch.
- PDF-inhoud en gerenderde A4 zijn gecontroleerd: overeenkomstwatermerk, factuurwatermerk en TEST-FMZ-nummer. De 21% in de oefenonderneming is fictief en wijzigt geen bedrijfsinstelling.

[Screenshot laptopprofiel](images/owner-laptop-20261102/laptop-member-profile.png) · [Factuurconcept](images/owner-laptop-20261102/laptop-invoice-concept.png) · [200% echte Chromezoom](images/owner-laptop-20261102/chrome-native-zoom-200.png) · [Mobiele browseremulatie](images/owner-laptop-20261102/chrome-responsive-390.png).

## Nog nodig vóór echte vrijgave

- Expliciet owner-GO na deze laptoptest.
- Definitieve privacytekst en bewaarbeleid, inclusief de reeds gekozen afzonderlijke vrijwillige gezondheidstoestemming.
- Bevestiging van de getoonde pakket-, voorwaarden- en factuurregels.
- Later een veilige server-side mailboxkoppeling en aangewezen testontvanger; geen wachtwoord via chat.
- Technische toelating van de nieuwe productiemigrations en volledige productieketen, met een nieuwe actuele back-up.

Telefoon, fysieke push, Outlook/TransIP en natuurlijke hoorbaarheid op iPhone zijn afzonderlijke latere controles. Geen browseremulatie wordt als die fysieke controles gerapporteerd.

Owner laptop test: GO voor de synthetische laptoptest; liveverificatie geslaagd. Geen toestemming voor normale productieroutes.

New member flow live for members: NO.

Real emails enabled: NO.

Automatic invoice sending enabled: NO.

Existing data preserved: YES — geen productiedata gewijzigd; alle 24 gecontroleerde tabellen hebben na publicatie exact dezelfde aantallen en inhoudshashes als de nulmeting, inclusief Auth, Storagemetadata, bestaande financiële gegevens en agenda.

Rollback point verified: YES.

Staging touched: NO. JARVIS touched: NO. Business website touched: NO.

## Reproduceerbare bron en releasegrens

Voorbereide broncode/tests: `61ff747dfe755a932fa43cb116681e428568a251` op `codex/members-billing-20261026`. Deze werkbranch is niet main en niet de gepubliceerde normale app. De release is apart vanaf309cb0 samengesteld. Gebruik voor browsertests die voorbereidingscommit met bestaande npm-dependencies; de releasebranch bevat de zelfdragende owner-testbundel en een verifier zonder extra dependencies.

`node tests/verify-owner-test-release.cjs --root . --commit HEAD` controleert de byte-identieke bestaande bestanden en de ene launcher-insertie. Met `--live` worden tevens de gepubliceerde bytes gecontroleerd. Geen database- of hostingmutaties door deze verifier.

## Publicatiebewijs

Runtimecommit: `2604d4ea28402817301be754437e3c271cd755c4`, gepusht naar `main` en `codex/owner-laptop-test-20261102`. De daaropvolgende bewijscommit verandert uitsluitend documentatie en read-only controlehulpmiddelen; runtime blijft byte-identiek aan deze commit.

- GitHub Pages bevestigde `built` voor deze commit om 15:07:41 UTC; HTTPS en `appfmz.nl` behouden. Zie [release-hosting.json](examples/owner-laptop-20261102/release-hosting.json).
- Alle 105 publieke bestanden (88 bestaande plus 17 owner-testbestanden) en de rootalias komen byte voor byte overeen met Git. Zie [release-live-verification.json](examples/owner-laptop-20261102/release-live-verification.json).
- Alle 449 bestaande Git-bestanden gecontroleerd. Alleen `index.html` kreeg de 42-byte launcher-insertie en `.gitattributes` twee regels voor exacte owner-testbytes. De andere bestaande bestanden zijn byte-identiek.
- Geen migration, Edge-, Auth-, RLS- of Storagewijziging uitgevoerd. De twaalf geregistreerde productiemigrations zijn ongewijzigd. Zie [postrelease-data.json](examples/owner-laptop-20261102/postrelease-data.json).
- Alle 24 gecontroleerde productietabellen hebben identieke aantallen en SHA-256 vóór en na publicatie; geen klantinhoud in het rapport. Zie [postrelease-data-comparison.json](examples/owner-laptop-20261102/postrelease-data-comparison.json). Dit vergelijkt Storagemetadata; private documentbytes zijn niet opnieuw gedownload.
- Anonieme Edge-controle op de echte livepagina: HTTP200, launcher geladen maar verborgen, geen testiframe, geen paginafouten of schrijfverzoeken. Zie [live-browser-smoke.json](examples/owner-laptop-20261102/live-browser-smoke.json).
- De volledige geauthenticeerde route is met geïsoleerde fictieve accounts gecontroleerd; jouw fysieke laptopacceptatie blijft de volgende stap. Geen echte mailbox- of telefoon-PASS geclaimd.

De automatische goedkeuringscontrole blokkeerde aanvankelijk de push wegens vermeende normale vrijgave vóór owner-GO. Na aanvullende bewijscontrole van de expliciete toestemming in §11.1 en de beperkte diff werd dezelfde push toegestaan. Geen alternatieve publicatieroute gebruikt.
