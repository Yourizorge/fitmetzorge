# APPFMZ — maandprijzen, factuurconcept en PDF

Scope: `Yourizorge/fitmetzorge`, `appfmz.nl`, productieproject `hgoygcviutmynaihcvpd`. Uitgangspunt: actuele main `d5673a2e9383990b456b472b3d60b5d96a39ecc1`. Projectinstructies, eerdere releaserapporten en owneracceptatie gelezen; geen AGENTS.md gevonden in de projectmap. De nieuwe, afgebakende toestemming van 10 september geldt voor deze factuuraanpassing; staging, losse website en AI-ontwikkeling blijven afzonderlijk.

## Prijzen en historische gegevens

| Bestaand pakket-ID | Trainingen per maand | Maandbedrag | Per training |
| --- | ---: | ---: | ---: |
| pt-basis | 4 | €200 | €50 |
| pt-progressie | 8 | €380 | €47,50 |
| pt-transformatie | 12 | €480 | €40 |

De definities in app.js en beide hardcoded keuzelijsten in index.html zijn gecorrigeerd. Pakketlabels in klantoverzichten tonen het totale maandbedrag. Bestaande IDs en oude labels blijven herkenbaar. Er is geen berekening met gemiddelde kalenderweken. Duo, online coaching, handmatige bedragen en afspraaktarieven zijn niet gewijzigd. Historische factuurbedragen worden niet opnieuw uit het pakket afgeleid. Een afspraak krijgt geen maandbedrag en maakt uitsluitend een ongenummerd concept, geen definitieve factuur.

## Bewerkbare concepten en opslag

Pakketconcept openen → controleren/bewerken → **Opslaan en PDF downloaden**. Een nieuw concept blijft buiten de gewone workspace-autosave, zonder factuurnummer, totdat de trainer expliciet bevestigt. Omschrijving, oorspronkelijke prijs inclusief btw, korting, kortingstoelichting, factuurdatum en betaaltermijn zijn vooraf bewerkbaar. De originele prijs, korting, btw en het te betalen bedrag staan in het actuele voorbeeld. Lege/ongeldige bedragen, negatieve korting en korting boven de oorspronkelijke prijs worden geweigerd. Geldbedragen worden als gehele centen verwerkt; de bestaande btw-instelling blijft behouden.

Beide bestaande factuurschermen gebruiken één concepteditor. Het oude data-save-invoice-pad leest niet meer documentbreed de eerste gelijknamige velden, maar de daadwerkelijk geopende editor. Het bestaande Facturen-scherm is ook bereikbaar gemaakt via de trainernavigatie. De huidige lidrechten blijven ongewijzigd.

Een expliciete bevestiging bewaart de definitieve factuur en nummerreeks in dezelfde bestaande atomische, idempotente opslagketen. De PDF wordt alleen gedownload nadat de overeenkomstige documentgegevens door de server zijn bevestigd. Dubbel klikken wordt tijdens opslag geblokkeerd; een verloren antwoord gebruikt dezelfde aanvraag-ID. Een conflict houdt het concept vast, overschrijft niet stilzwijgend en herhaalt niet automatisch. Na expliciet verwerpen/verversen kan het bewaarde concept opnieuw worden bevestigd. Een PDF-fout maakt geen nieuwe factuur of nieuw nummer; opnieuw downloaden blijft beschikbaar.

Onbevestigde concepten blijven alleen in het geheugen van de betreffende accountcontext/tab. Sluiten van de editor bewaart ze in dat tabblad; bij resterende concepten verschijnt een afsluitwaarschuwing. Er is geen belofte van herstel na tabbladsluiting. Bij sessieverlies sluit de editor en verdwijnt de inhoud uit het scherm.

## Echte PDF

De HTML-Blob is vervangen door PDF-inhoud met `%PDF-`, `application/pdf` en een `.pdf`-naam. pdf-lib 1.17.1 is vastgezet, inclusief lockfile en MIT-licentie; de browserbundel staat in de eigen repository onder vendor. De generator draait lokaal in de browser. Geen betaalde PDF-dienst, geen verzending van factuurinhoud naar een externe generator en geen afdrukdialoog.

Een definitieve factuur bewaart een documentmomentopname met bedrijfsgegevens, logo, klantgegevens, nummer, beschrijving, datum, betaaltermijn, korting, btw en centtotalen. Latere wijzigingen aan pakketten of instellingen veranderen een opnieuw gedownloade factuur niet. Bestaande facturen zonder momentopname gaan bij PDF voorbereiden eerst door de editor, met hun reeds opgeslagen bedrag en nummer.

De PDF gebruikt A4, tekst die over regels en zo nodig pagina's doorloopt, een ingebed logo en paginanummers. De drie synthetische voorbeeld-PDF's zijn geparseerd en de Progressie-PDF is gerenderd en visueel gecontroleerd: €380 oorspronkelijk, €30 korting, €289,26 exclusief btw, €60,74 btw en €350 te betalen. Mobiele editor gecontroleerd bij 390 pixels zonder horizontale overloop. Geen fysieke iPhone-/Androidtest door de agent.

## Tests en publicatie

Zeven lokale regressietests zijn geslaagd, achtereenvolgens uitgevoerd om lokale piekbelasting door meerdere browser-/PGlite-processen te vermijden. Dit omvat de bestaande autosave-, workout-, voedings-, foto-, privacy-, SQL- en Edge-controles plus de nieuwe factuurflow. Gerichte PDF-inhoudscontroles zijn geslaagd voor alle drie pakketten. De factuurtest controleert beide schermen, korting, dubbel klikken, herladen/uitloggen/inloggen, historische bedragen en prijsherkenning, verloren opslagantwoord, PDF-fout, conflict en herstel zonder extra facturen of nummers.

De productieproef gebruikt uitsluitend eigen gemarkeerde synthetische accounts, via een lokale kopie van de releasefrontend en de echte productie-Auth/PostgREST-route. Er worden geen echte facturen of e-mails verstuurd. De bestaande live app blijft tijdens deze compatibele frontendaanpassing beschikbaar. De productie-uitkomst, schoonmaak en live verificatie worden hieronder vastgelegd vóór oplevering.

**Productie-uitkomst:** de volledige factuurflow is geslaagd via echte Auth/PostgREST in 116 seconden, inclusief maandprijzen en oude labels, ongewijzigde overige tarieven, behoud van een historisch bedrag, geen maandbedrag/nummer op een losse afspraak, korting, beide schermen, opnieuw inloggen, herhaald downloaden, verloren antwoord en één conflict gevolgd door succesvol expliciet herstel. Een aanvullende echte proef liet na geslaagde opslag de PDF-generatie bewust falen; de zichtbare downloadretry leverde daarna `application/pdf` en hetzelfde factuurnummer, zonder extra factuur.

Alle drie eigen synthetische accounts en hun facturen zijn verwijderd. Voor en na: zeven profielen, twee oorspronkelijke workspaces; na afloop nul eigen testaccounts. De volledige workspace-digest was vóór en na exact `e516c84fd39d461432c47d4993881fcc`, inclusief bestaande facturen en klantinhoud. Geen wijziging aan bestaande klantgegevens. De actuele Supabase-changelog gaf geen relevante API-wijziging voor de gebruikte bestaande opslagketen.

Publicatie gebruikt de bestaande GitHub Pages-route, met nieuwe versieparameters voor app.js, invoices.js en styles.css. Na de push worden de live bestanden tegen de commit vergeleken en de mobiele login gecontroleerd. De definitieve commit en publicatiestatus worden in het opleverbericht vermeld.

Geen database-, RLS-, RPC- of Edge-wijziging is nodig. Herstelpad: de vorige frontendcommit terugzetten via dezelfde hosting, zonder klantdata, historische facturen of nieuwe documentmomentopnamen uit de database te verwijderen. Geen database-replay of herstel van oude onveilige rechten.

## Korte telefoontest

1. Kies Basis, Progressie of Transformatie en controleer €200, €380 of €480 per maand in pakketkeuze en klantoverzicht.
2. Open een Progressie-pakketconcept. Wijzig omschrijving, datum en betaaltermijn; vul €30 korting en eventueel een toelichting in. Controleer €350 te betalen.
3. Kies Opslaan en PDF downloaden. Open het PDF-bestand en controleer nummer, gegevens, korting, btw en eindtotaal.
4. Log opnieuw in. Download dezelfde factuur via Facturen opnieuw en controleer dat nummer en bedragen gelijk blijven. Controleer ook Concept openen / bewerken vanuit Administratie.
