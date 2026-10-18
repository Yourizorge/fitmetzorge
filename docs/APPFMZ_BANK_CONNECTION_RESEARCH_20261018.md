# Afzonderlijk onderzoek: ING Zakelijk koppelen

Broncontrole 18 oktober 2026. Geen provideraccount, banktoegang, abonnement of betaalopdracht geactiveerd. Dit onderzoek staat los van de gepubliceerde administratiebediening.

| Mogelijkheid | Ondersteuning en kosten | Verversing |
|---|---|---|
| Enable Banking Accounts API | De eigen Nederlandse documentatie noemt ING en Mijn ING Zakelijk expliciet. Een beperkte koppeling met uitsluitend eigen toegestane rekeningen bestaat; algemeen productiegebruik vereist overeenkomst/KYB. De commerciële prijs is volumeafhankelijk met een maandminimum; een exact eenmalig of maandbedrag voor APPFMZ is niet openbaar vastgesteld. | Veel banken begrenzen achtergrondverzoeken tot vier per dag. Zes uur is een richtlijn bij die limiet, geen gegarandeerde realtime verwerking. |
| Tink Business Transactions | Zakelijke transacties zijn een Enterprise-product met persoonlijke offerte. Exact ING-rekeningtype, eenmalige kosten, maandminimum en prijs per rekening moeten vóór een keuze bevestigd worden. | Tink noemt maximaal vier achtergrondverversingen per dag; de daadwerkelijke beschikbaarheid blijft bankafhankelijk. |

Bronnen: [Enable Banking Nederland](https://enablebanking.com/docs/markets/nl/), [voorwaarden en technische FAQ](https://enablebanking.com/docs/faq/), [Accounts API](https://enablebanking.com/accounts-api/), [Tink prijzen](https://tink.com/pricing/), [Tink verversing](https://tink.com/account-aggregation/), [Tink zakelijke transacties](https://www.tink.com/products/business-transactions/).

Voor APPFMZ is Enable Banking een kandidaat voor een beperkte proef met de eigen ING Zakelijk-rekening. Dit is een technische inschatting, geen toezegging dat het specifieke rekeningtype gratis en zonder aanvullende voorwaarden werkt. Een providerkeuze, bevestigde kosten en bewuste banktoestemming blijven nodig. Er is geen offerte aangevraagd en niemand namens de owner benaderd.

## Gegevens, toestemming en intrekken

Een toekomstige koppeling zou alleen rekeninginformatie lezen: rekeningidentiteit, saldo, boekings-/valutadatum, bedrag, valuta, omschrijving, tegenpartij, status en beschikbare bronreferentie. Welke velden ING daadwerkelijk levert moet een gekozen proef aantonen. De toestemming loopt via de officiële bankomgeving; APPFMZ vraagt geen bankwachtwoord of bankcode. Enable Banking biedt een [overzicht om deeltoestemming in te trekken](https://enablebanking.com/data-sharing-consents/). Intrekken in APPFMZ moet tevens synchronisatie stoppen en de providersessie beëindigen; eerder verwerkte boekhoudhistorie blijft behouden.

## Voorgestelde verwerking — nog niet gebouwd of geactiveerd

1. Alleen definitief geboekte transacties aanbieden ter beoordeling. Een gereserveerd bedrag is nog geen definitieve ontvangst.
2. Bronreferenties opslaan per provider en rekening. Een stabiele boekingsreferentie verkiezen boven een wisselend technisch transactie-ID; ontbrekende of dubbele bronreferenties expliciet beoordelen. De [Enable Banking FAQ](https://enablebanking.com/docs/faq/) beschrijft deze uitzonderingen.
3. Overlappende importperiodes en herhaalde verzoeken idempotent afhandelen. Een CSV-bron of eerder handmatig vastgelegde ontvangst koppelen aan dezelfde bankmutatie, zonder extra geldboeking.
4. Factuurnummer, bedrag, datum en tegenpartij gebruiken voor een voorstel. Gelijk bedrag alleen is onvoldoende bewijs. Deelbetalingen, gezamenlijke betalingen en credit-/terugbetalingen apart controleren.
5. De owner controleert vóór definitieve koppeling. Geen automatische nieuwe omzet, btw-keuze of betaalstatus zonder passende bron. Btw-betalingen koppelen aan hun aangifteperiode.
6. Laatste succesvolle verversing, verlopen toestemming en fouten zichtbaar maken. Geen eindeloze retries en geen betaalinitiatie toevoegen.

Het voorgestelde ontwerp hergebruikt de bestaande bankbron-, koppel- en correctieroutes. Handmatige invoer en CSV blijven beschikbaar zolang geen bankkoppeling is gekozen.
