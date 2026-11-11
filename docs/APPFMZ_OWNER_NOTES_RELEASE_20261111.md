# APPFMZ — ownercorrecties, notities en nieuw PWA-logo

11 november 2026. Publicatie toegestaan door de eigenaar: notities herstellen, PWA-logo vervangen en overige beoordeelde correcties actief maken. De voorgestelde rustigere profielindeling wacht afzonderlijk op goedkeuring.

## Normaal bruikbare wijzigingen

- Zeven hoofdroutes: Dashboard, Agenda, Schema builder, Leden, Administratie, Facturen, Instellingen. Bestaande onderdelen blijven via deze routes en het ledenprofiel bereikbaar.
- Een volledig ledenprofiel met tabbladen; Schema builder vereist bewust een bevoegd lid kiezen. De eerder getoonde profielindeling blijft behouden. Een nieuw compacter overzicht wordt nog niet geactiveerd.
- Een rustiger ledenstartscherm met Training, Voeding, Voortgang/check-in en komende afspraken; afgeronde afspraken tellen niet als komende afspraak.
- Actuele factuurrestanten en achterstand gebruiken alle bevestigde betalingen, ook na de gekozen rapportmaand. Historische omzet, btw en rekeningstanden blijven periodegebonden. Geen boeking gewijzigd.
- In **Leden → profiel → Notities** rechtstreeks een meerregelige notitie toevoegen; na bevestiging direct zichtbaar en na herladen/inloggen behouden. Bestaande interne notities blijven staan. Leden en onbevoegde trainers kunnen deze informatie niet lezen of wijzigen.
- Het originele logo van 2 november voor Android/PWA, Apple-touch en installatiehulp. Nieuwe URL's onderscheiden de iconen van de vorige versie. Manifest-ID, startadres en scope blijven `/`; geen session/storage-wipe, API-cache of geforceerde update.

## Opslag en beveiliging

De bestaande `fmz_save_changes_once` slaat uitsluitend het verschil in `profile.trainerNote` op. Dit ondersteunt oudere profielen zonder fictieve verplichte persoonsgegevens aan te vullen. Server-side rechten, PT409, idempotente request-ID en bestaande profielaudit blijven in gebruik. Bij verloren antwoord herhaalt de knop dezelfde opdracht. Bij conflict blijft de invoer staan en moet de trainer eerst de actuele notities ophalen. State/baseline worden alleen voor het bevestigde veld bijgewerkt. Een laat antwoord na accountwissel wordt niet aan het nieuwe account getoond.

De bestaande grens van 4.000 tekens voor het totale trainerNote-veld blijft gelden. Bij overschrijding wordt niets afgekapt of overschreven; de invoer blijft zichtbaar. Geen nieuwe gezondheidsinformatie in algemene notities.

Geen migration, Auth-, RLS-, Edge- of productiegegevenswijziging uitgevoerd voor deze release. Bestaande financiële bestanden en overeenkomsten worden niet gegenereerd of vervangen. Geen automatische facturen, e-mails, incasso's of nieuwe meldingen. Bestaande maandafspraken en de gesloten privacy/inschrijfpoort blijven ongewijzigd.

## Bewijs

- [12 gerichte releasecontroles PASS](examples/owner-notes-20261111/release-tests.txt): actuele betaalstanden, financiële modellen, navigatie, bestaande opslag en PWA.
- `tests/member-notes.test.cjs`: aanvullende uitgebreide PASS op de werkelijke lokale app en geïsoleerde SQL-migrations: incompleet profiel, bestaande notities, dubbele klik, verloren antwoord, PT409, audit, herladen, aanmelden, sessie/accountwissel, andere trainer/member geweigerd en 390px.
- [PWA Edge/WebKit](examples/owner-notes-20261111/pwa.json): manifestidentiteit, juiste Apple/manifest/iconpaden, PNG-afmetingen en hashes, volledige logo binnen maskable-safezone, installatiehulp. Fysieke iPhone-iconverversing niet bewezen.
- De voorafgaande kandidaat heeft tevens de gerenderde trainer-/ledencontroles en 90 WebKit-schermchecks doorlopen; [vorig bewijs](examples/owner-correction-20261111/webkit-tests.json). Browseremulatie is geen fysieke telefoontest.
- [Notities laptop](images/owner-notes-20261111/member-notes-1440.png), [notities telefoon](images/owner-notes-20261111/member-notes-390.png). Uitsluitend fictieve gegevens.
- [Icoonbron en SHA-256](../assets/pwa/official-20261102-provenance.json). Originele bron ongewijzigd, volledig proportioneel geschaald op donkere achtergrond.

## Afzonderlijk voorstel — niet actief

[Voorbeeldbeeld laptop](images/owner-notes-20261111/profile-proposal-1440.png) en [telefoon](images/owner-notes-20261111/profile-proposal-390.png): compacte kop, drie overzichtskaarten, gegevens per tab en uitklapbare contactgegevens. Klikbaar lokaal via `http://127.0.0.1:8896/tests/profile-proposal.html`. Geen backend, geen opslag, alleen fictieve gegevens. De map `tests` is uitgesloten van GitHub Pages. Goedkeuring van deze indeling staat nog open.

## Herstel en publicatie

Gecontroleerde voorafgaande main: `e9463c8eb73b5ddef0760c2facf71da9af9de2ca`. Nieuw Git-herstelpunt: `backup/appfmz-pre-owner-notes-20261111` op die commit. Oudere herstelpunten en versleutelde databaseback-up blijven behouden. Bij een frontendprobleem kan de vorige runtime terug; geen bestaande klantgegevens terugzetten of rechten veranderen.

Release via een fast-forward van de geteste branch naar main, gevolgd door GitHub Pages-buildcontrole, vergelijking van alle gewijzigde runtimebestanden met Git-blobs en openbare live-smoketest. Definitieve commit en resultaten worden na de daadwerkelijke controle vastgelegd. Productietests in deze release wijzigen geen echte leden of financiële gegevens.

Staging touched: NO. Bedrijfswebsite touched: NO. JARVIS touched: NO.

Ownercontrole: (1) Notitie bij een lid toevoegen en profiel heropenen; (2) actuele betaalstand controleren; (3) APPFMZ op iPhone openen en het nieuwe icoon controleren. Geen nieuwe factuur of betaling nodig voor deze controle.
