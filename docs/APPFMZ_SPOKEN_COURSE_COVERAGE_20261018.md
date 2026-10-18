# Dekkingslijst gesproken administratiecursus

Geïnventariseerd tegen APPFMZ `368cdb37` plus deze financiële en btw-uitbreiding. De opname gebruikt de echte gebouwde interface en de echte SQL-logica in een lokale PGlite-database. Alleen vaste fictieve gegevens, een oefenklok in april–oktober 2026, een aparte OEFEN-nummerreeks en ongeldige oefen-PDF's. Geen productieverbinding of echte verzending.

| Hoofdstuk | Huidige functies en controle |
|---|---|
| 1. Overzicht | Omzet, ontvangen, openstaand, te controleren; maand/kwartaal/jaar; doorklikken. Omzet, bankstand en betaling zijn verschillende bedragen. |
| 2. Instellingen en rekeningen | Bedrijfsgegevens, btw-instelling, rekening/kas toevoegen, gecontroleerde beginstand, onbekend versus nul, rekening verbergen. Geen fiscale instelling van de owner gewijzigd. |
| 3. Klant en betaalafspraak | Bestaand klantprofiel, pakket, maandprijs, individuele afspraak, kalendermaand/vier weken, ingangsdatum, facturatie inschakelen. Een agenda-afspraak factureert niets. |
| 4. Factuurconcept | Pakketconcept en vrije factuur, omschrijving, regels toevoegen/verwijderen, 8 × €47,50, €30 korting, €350 totaal, factuur-/vervaldatum, periode, concept bewaren/heropenen. |
| 5. Definitieve factuur | Expliciet definitief maken, nummer, onveranderlijk document, PDF openen/downloaden/opnieuw downloaden, Delen. Geen automatische e-mailservice; daadwerkelijke verzending in de gekozen externe app. |
| 6. Volledige betaling | Betaling registreren; werkelijk bedrag, datum, rekening/kas, omschrijving; serverbevestiging en resterend bedrag. |
| 7. Bank/Kas | Automatische bankmutatie en factuurkoppeling; boekingen/bijlagen, ontvangen-overzicht, geen tweede omzet/btw. |
| 8. Deelbetaling | €200 op €350, restant €150; daarna €150; geschiedenis en volledige betaling controleren. |
| 9. Bestaande ontvangst | Bestaande bankmutatie in de betaalactie selecteren; één ontvangst houden; niet nogmaals registreren. |
| 10. Fouten herstellen | Betaalregistratie corrigeren, reden en effect vóór bevestigen; volledige fictieve Bank/Kas-invoer tegenboeken; uitsluitend een verkeerde koppeling losmaken en de echte ontvangst opnieuw koppelen. |
| 11. Contant en uitgaven | Kasbetaling; zakelijke uitgave en bron/bon, btw/zakelijk gebruik; betalen of later koppelen; uitgave tegenboeken met historie. |
| 12. Open en te laat | Openstaande/te late filters, restant en betaling controleren, bestaande PDF gebruiken bij handmatige opvolging. Geen verzonnen herinneringsdienst. |
| 13. Annuleren, credit, terugbetaling | Onverzonden/onbetaalde factuur annuleren; concept verwijderen; credit met origineel en reden; credit-PDF; werkelijk terugbetaalde bankmutatie apart koppelen. Een credit verstuurt geen geld. |
| 14. Privé en eigen overboeking | Privéstorting, privéopname, uitgaand/inkomend eigen rekeningpaar koppelen; geen omzet of kosten verzinnen. |
| 15. Bankstand vergelijken | Rekening, afschriftdatum/saldo, verschil controleren, afstemmen; onbekend beginsaldo niet als nul behandelen. Bankafschrift komt buiten de app vandaan. |
| 16. CSV | Voorbeeldbestand, kolommen, voorbeeldcontrole, bevestigen, bron-ID/dubbele import, mogelijke handmatige dubbele ontvangst beoordelen/bron koppelen, ongekoppelde import terugdraaien. Geen live bankverbinding. |
| 17. Inkomsten, uitgaven, winst en btw | Nieuwe pagina’s; betaaldatum tegenover registratiedatum; herleidbare berekeningen en periodefilters; aangiftebedrag apart vastleggen; €20 + €53,76 betalen; verloren antwoord opnieuw proberen zonder dubbelboeking; koppeling herstellen en dezelfde bankmutatie hergebruiken; kwartaal 2 met €21 teruggaaf; jaarselectie zonder verzonnen aangiftesaldo. Werkelijk aangifte indienen en geld overmaken blijven buiten de app. |
| 18. Export en afsluiting | Bestaande PDF-rapporten, administratie-/CSV-/documentenexport, periode afsluiten en heropenen met reden. Export is niet hetzelfde als belastingaangifte. |
| 19. Leningen en middelen | Lening/schuld, aflossing versus rente; bedrijfsmiddel, aanschaf/afschrijvingen en controle. Alleen gebruiken als werkelijk relevant; fiscale grondslag afzonderlijk laten beoordelen. |
| 20. Historie en grenzen | Audit, originele bijlagen, bewaartermijnen, foutmeldingen en conflicten, opnieuw proberen/verversen, agenda los van facturatie; volgende veilige oefenstappen. |

## Onderdelen die bewust apart blijven

- Banktoegang, het downloaden binnen een ingelogde bankomgeving, daadwerkelijk betalen/terugbetalen en daadwerkelijk e-mailen/WhatsApp-delen worden niet uitgevoerd. De opname toont de beschikbare APPFMZ-knop en legt de externe vervolgstap uit.
- Historische import-/legacy-PDF's blijven bereikbaar via bestaande detail- en downloadacties. Er worden geen echte historische klantdocumenten opgenomen. Hetzelfde bewaren, bekijken en exporteren wordt met oefenbestanden getoond.
- Beginstand vervangen of terugzetten naar onbekend gebruikt dezelfde herstelpreview als hoofdstuk 10; de nieuwe handleiding beschrijft de afzonderlijke beginstandactie. Geen bankstand wordt geraden.
- Rechtenbeheer, aanmelden, workouts, voeding, foto's, agenda en push zijn geen administratieve cursusonderdelen. De agenda wordt alleen uitgelegd als planning/aanwezigheid zonder financiële boeking.
- Alle 27 bestaande lessen en 61 oefenhandelingen blijven beschikbaar. De 12 beginnersstappen verwijzen naar de relevante videohoofdstukken; bestaande voortgang blijft behouden.

## Bronnen en publicatiebewijs

De actuele primaire Belastingdienst-bronnen zijn op 18 oktober 2026 gecontroleerd en staan per onderwerp in `tutorial/content.js` en achterin de handleiding. De cursus schrijft geen algemeen btw-tarief of stelsel voor aan de onderneming. De opname gebruikt uitsluitend het uitdrukkelijk fictieve bedrijf met 21% en factuurstelsel.

De precieze hoofdstuktijden, transcript en controles worden bij de montage vastgelegd in [montage.json](examples/spoken-course/montage.json), [browserbewijs](examples/spoken-course/browser.json) en het gecombineerde [releaserapport](APPFMZ_FINANCE_RELEASE_20261018.md).

## Vernieuwd op 18 oktober

119 echte synthetische schermscènes. De 12 aanvullende financiële oefeningen gebruiken dezelfde nieuwe UI met tijdelijk geïsoleerde voorbeeldstate. De volledige video bevat naast de €350-factuur een open €75-factuur; daarom toont die Q3 €73,76 btw. De afzonderlijke financiële oefenronde heeft één €350-factuur en €4,20 voorbelasting; daar is het saldo €56,54. De voorbeelden worden uitdrukkelijk onderscheiden.

De bestaande 27 les-ID’s en 12 beginner-ID’s zijn behouden. Toegevoegd: afspeelpositie per videoversie, volume, dempen en volledig scherm waar ondersteund. De actuele UI toont uitsluitend de nieuwe volledige video; de oude korte video’s zijn niet meer gekoppeld. Fysieke iPhonehoorbaarheid en installatie blijven door de owner te bevestigen.
