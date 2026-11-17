# APPFMZ — Benvitaal, kosteloze schematoegang

17 november 2026. Op verzoek van de eigenaar is Benvitaal toegevoegd aan Nieuw lid inschrijven. Dit is een kosteloze account-/profielroute, geen betaalde of ondertekende overeenkomst.

## Bediening

1. Nieuw lid inschrijven → Benvitaal kiezen.
2. Voornaam, achternaam en e-mailadres invullen → Benvitaal-lid opslaan.
3. Apart Accountuitnodiging versturen. Het lid stelt zelf een wachtwoord in via de bestaande beveiligde uitnodiging.
4. Profiel en schema openen; de trainer maakt en publiceert het schema via de bestaande bediening.

Benvitaal toont geen prijs. Er ontstaat geen betaalafspraak, factuur, betaalperiode, betaling, contract of financiële boeking. Opslaan verstuurt geen uitnodiging; daarvoor is de aparte bewuste actie vereist. Bestaande tarieven en afspraken blijven intact. Als later bewust een betaalafspraak wordt toegevoegd, krijgt die in het profiel voorrang boven het kosteloze label.

## Opslag en beveiliging

De bestaande `fmz_save_changes_once`-route bewaart het trainergebonden profiel; de bestaande serverindex maakt het vindbaar. Een onzekere opslagbevestiging bewaart de invoer en hergebruikt exact dezelfde aanvraag-ID en inhoud. Dubbel klikken wordt geblokkeerd. Trainer + genormaliseerd e-mailadres leveren een stabiel client-ID voor gelijktijdige Benvitaal-aanvragen. Een conflict overschrijft niets. Bestaande e-mailadressen leiden naar het bestaande profiel.

De browsercontrole vond dat alleen het bekijken van een nieuw profiel een lege weeknotitie toevoegde en daardoor ten onrechte een opslagindicatie activeerde. De renderer leest nu de bestaande notitie zonder nieuwe inhoud aan te maken. Werkelijke notitie-invoer behoudt de bestaande opslagroute. Het voltooide Benvitaal-formulier wordt expliciet verborgen; de gridstijl kan de verborgen toestand niet meer overrulen.

De bestaande `invite-client`/`fmz_prepare_invite`-keten controleert trainer, opgeslagen profiel en e-mailadres server-side. Geen wachtwoordkeuze door de trainer en geen nieuwe rolbevoegdheden. De nieuwe route verzamelt geen gezondheidsgegevens of handtekening; de bestaande privacy-/ondertekenpoort blijft gesloten. Niet-opgeslagen invoer is alleen tijdelijk in het tabblad beschikbaar.

Read-only productiecontrole: benodigde RPC's aanwezig; laatste migration `20261104164206`; `enrollment_released()` blijft false. Geen migration, SQL-write, Auth-, Edge- of Storage-aanpassing uitgevoerd. Geen echte klanten aangemaakt of e-mails verstuurd tijdens de tests.

## Bewijs en herstel

Vertrekpunt/herstelpunt: `d09d507ce7d7b310b3560d18fbc295836e6965ae`; backupbranch `backup/appfmz-pre-benvitaal-20261117`. Een frontendherstel verwijdert geen inmiddels aangemaakte profielen of accounts.

[Vijf bestaande regressietests](examples/benvitaal-20261117/regression-tests.txt) slagen: betaalperiodes, versievaste afspraken, ledenmodel/documenten en gesloten productie-inschrijfpoort. De aanvullende Benvitaal-browsercontroles en livecontrole worden hieronder vastgelegd.

Tests gebruiken uitsluitend fictieve personen met geïsoleerde SQL. De uitnodigingsrespons wordt onderschept; fysieke mailontvangst en iPhonebediening zijn niet bewezen door browseremulatie.

Definitieve toelating: **8 tests PASS**: 5 bestaande regressietests, [2 gerenderde Benvitaal-tests in Edge/WebKit](examples/benvitaal-20261117/test-results.txt) en [1 bestaande notitieregressie](examples/benvitaal-20261117/notes-regression.txt). Dubbele submit, verloren antwoord met identieke retry, e-mailduplicaat, herladen, geen onbedoelde openstaande wijzigingen, expliciete uitnodigingsactie, SQL-acceptatie van uitnodiging, uitsluitend eigen gepubliceerde schema en geweigerde toegang voor ander lid/trainer zijn gecontroleerd. Financiële snapshot en aantal contracten blijven exact gelijk.

Visueel gecontroleerd: [formulier op telefoonformaat](examples/benvitaal-20261117/free-form-390.png), [bevestigde opslag](examples/benvitaal-20261117/free-saved-390.png), [profiel op laptop](examples/benvitaal-20261117/free-profile-1440.png), [WebKit op telefoonformaat](examples/benvitaal-20261117/free-profile-webkit-390.png). Dit is browseremulatie met fictieve gegevens.

Production touched: uitsluitend APPFMZ-frontend na toelating. Staging touched: NO. Bedrijfswebsite touched: NO. JARVIS touched: NO.

## Publicatie bevestigd

Runtimecommit **5a9affaea90b26bb1ea54725c2d523c163c2e677** is fast-forward naar `main` gepubliceerd. GitHub Pages meldt `built` voor exact deze commit; de live index komt overeen. Herstelbranch `backup/appfmz-pre-benvitaal-20261117` staat op GitHub op het hierboven genoemde vertrekpunt.

- [55/55 livebestanden byte-identiek aan Git](examples/benvitaal-20261117/live-files.json).
- [Openbare Edge-smoketest PASS](examples/benvitaal-20261117/live-smoke.json): aanmeldscherm, installatiehulp, geen page errors of synthetische adapter. Test-, owner-test- en Edge-bronpaden geven publiek 404.
- Geen aangemelde productiewrites uitgevoerd; de volledige opslag-/rechtenketen is getest met de echte SQL in de geïsoleerde oefenomgeving. Hosted uitnodigingsmail en fysieke iPhone blijven afzonderlijke ownercontroles.
- Deze aansluitende bewijscommit wijzigt uitsluitend documentatie en bewijsbestanden; runtime is ongewijzigd.

Korte ownercontrole: ververs APPFMZ, kies Nieuw lid inschrijven → Benvitaal, sla naam/e-mail op en verstuur daarna bewust de accountuitnodiging. Open het profiel en publiceer het gewenste schema. Er hoort geen betaalafspraak of factuur te ontstaan.
