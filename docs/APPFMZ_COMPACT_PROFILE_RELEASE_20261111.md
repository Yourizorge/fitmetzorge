# APPFMZ — goedgekeurd compact ledenprofiel

11 november 2026. De eigenaar keurde het afzonderlijke klikbare profielvoorstel expliciet goed: “indeling is goed nu mag alles online”. Deze release integreert die indeling in de bestaande normale traineromgeving.

## Wat verandert

- Compacte kop met foto/initialen, naam, lidstatus, lidnummer en bestaande pakketprijs/betaalfrequentie. Directe acties: Notitie toevoegen en Profiel bewerken.
- Overzicht met drie kaarten: volgende geplande afspraak, begeleidingsdoel/trainingsdagen en actuele openstaande/ontvangen bedragen. Uitsluitend gegevens van het bevoegde geselecteerde lid; geen fictieve voorbeeldwaarden of nieuwe boekingen.
- Contactgegevens zijn uitklapbaar. Volledige persoonsgegevens, fotoacties, accountuitnodiging en pakket-/periodegegevens blijven onder Gegevens bereikbaar. De bestaande Coaching, Training, Voeding, Trackers, Agenda, Financiën, Documenten, Notities en Historie blijven beschikbaar.
- Bestaande profielbewerking, notitieopslag, focus, waarschuwing bij niet-opgeslagen invoer en privacygrenzen blijven in gebruik. Het eigen profielvenster voor leden is ongewijzigd.
- Bij later laden van Agenda/Administratie worden alleen de kaartteksten bijgewerkt; invoervelden en focus worden niet opnieuw opgebouwd. Ontbrekende financiële/agenda-informatie wordt niet als een bewezen nulstand gepresenteerd.

De goedgekeurde mockup blijft alleen onder `tests` als ontwerpbron. Productie gebruikt echte bestaande opslag en rechten. Geen nieuwe inschrijf-, privacy-, mail- of facturatiepoort geactiveerd. Geen migraties, Auth/Edge/Storage-wijzigingen of mutaties van echte klantgegevens, financiële boekingen of documenten.

## Controles en herstel

[5 kern-/notitietests PASS](examples/compact-profile-20261111/core-tests.txt): bestaande notitieopslag, idempotente retry, PT409, herladen/aanmelden, account- en rolgrenzen plus presentatiecontroles. De aanvullende gerenderde Edge/WebKit-profiel- en navigatiecontroles worden hieronder na afronding vastgelegd.

Vertrekpunt en herstelbranch `backup/appfmz-pre-compact-profile-20261111`: `9d80fbf3f669a847799e2c4c371ca21f1cf9a9ca`. Herstel beperkt zich tot de frontend; bestaande data en toegangsrechten blijven behouden.

Staging touched: NO. Bedrijfswebsite touched: NO. JARVIS touched: NO. Fysieke telefooncontrole niet uitgevoerd.

## Gerenderde controle

De aanvullende compacte-profieltest gebruikt de werkelijke app, geïsoleerde SQL en uitsluitend fictieve personen. Een factuur van €125 met €50 ontvangen verschijnt als €75 openstaand; het bekijken van het profiel en annuleren van bewerkingen laat de financiële snapshot exact gelijk. Volgende afspraak en begeleidingsdoel komen uit dezelfde fictieve opgeslagen administratie.

Edge en WebKit: donker/licht, 320/390/768/1440 px, toetsenbordtabs, vergrote profieltekst, conceptbescherming, herladen en het ongewijzigde eigen ledenprofiel. Daarnaast blijft de bestaande owner-navigation-regressie groen: schema builder, coaching-autosave, alle tabbladen, ledenscheiding en financiële routes.

[Browsertranscript](examples/compact-profile-20261111/browser-tests.txt), [laptop donker](images/compact-profile-20261111/edge-dark-1440.png), [telefoon licht](images/compact-profile-20261111/webkit-light-390.png). Dit zijn browseremulaties; geen fysieke telefoontest.

Definitieve toelating: 7 verschillende gerichte tests PASS (5 kern/notities + compact profiel + bestaande navigatie). [Controlemanifest met runtimehashes](examples/compact-profile-20261111/browser-acceptance.json).

## Publicatie bevestigd

Runtimecommit **88ff58de6ae500f443e1cf8a6a6e1553ccdc30cf** is fast-forward gepubliceerd op APPFMZ-main. GitHub Pages meldt `built` voor exact deze commit; de live index is gelijk aan Git.

- [55/55 livebestanden byte-identiek aan Git](examples/compact-profile-20261111/live-files.json), inclusief de nieuwe profielrenderer, CSS en scriptverwijzingen.
- [Openbare Edge-smoketest PASS](examples/compact-profile-20261111/live-smoke.json): productieaanmeldscherm, werkende installatiehulp, juist PWA-icoon en geen page errors. Geen echte klantgegevens gebruikt of aangemelde productiewrites uitgevoerd. De volledige aangemelde profielketen is hierboven met geïsoleerde synthetische SQL bewezen.
- Lokale voorstel/testserver/owner-test en serverbronpad geven publiek **404**. Eerste controles met een extra cache-query kregen HTTP503; de daadwerkelijke canonieke paden zijn daarna gecontroleerd en geven alle 404.
- `backup/appfmz-pre-compact-profile-20261111` is op GitHub behouden op **9d80fbf3f669a847799e2c4c371ca21f1cf9a9ca**.
- De aansluitende bewijscommit wijzigt alleen documentatie, het read-only verificatiescript en bewijsbestanden. Runtime blijft gelijk aan deze geverifieerde release.

Korte ownercontrole: open op appfmz.nl een lid, bekijk de drie overzichtskaarten en gebruik Notitie toevoegen of Gegevens. Dezelfde indeling werkt op de telefoon; fysieke bediening blijft door de eigenaar te bevestigen.
