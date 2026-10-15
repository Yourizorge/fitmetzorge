# Bankkoppeling — apart onderzoek, niet geactiveerd

Controle 15 oktober 2026. De handmatige betaal- en herstelroute werkt onafhankelijk van een toekomstige koppeling. Er is geen leverancier benaderd, contract gestart, banktoegang gevraagd of betaalde functie geactiveerd.

| Optie | ING-ondersteuning | Kosten | Verversing |
|---|---|---|---|
| Enable Banking | ING Nederland en Mijn ING Zakelijk staan in de officiële Nederlandse documentatie. De septemberupdate vermeldt de nieuwe ING API v4. | Eigen expliciet gekoppelde rekeningen kunnen onder de beperkte toegang gratis worden gebruikt. Algemene productie vereist contract/KYB; volumeprijs met maandminimum op offerte, geen openbaar eurobedrag bevestigd. | Veel banken beperken achtergrondopvraging tot vier keer per dag. Dat is geen gegarandeerde directe melding na iedere betaling. |
| Tink | De officiële changelog noemt ING Nederland. De beschikbaarheid van het precieze zakelijke rekeningtype moet vóór keuze worden bevestigd. | Offerte; geen vast openbaar eurobedrag op de prijspagina. | Account aggregation noemt maximaal vier achtergrondverversingen per dag. |

Bronnen: [Enable Banking Nederland](https://enablebanking.com/docs/markets/nl/), [ING API-update](https://enablebanking.com/blog/2026/06/10/changelog-september-2026), [eigen rekeningen](https://enablebanking.com/accounts-api/), [voorwaarden, prijzen en limieten](https://enablebanking.com/docs/faq/), [Tink verbindingen](https://docs.tink.com/changelog), [Tink prijzen](https://tink.com/pricing/), [Tink verversing](https://www.tink.com/account-aggregation/).

Mijn technische voorkeur voor een eventuele kleine proef is Enable Banking met uitsluitend de eigen ING-rekening, mits de beperkte gratis gebruiksvorm voor deze owneradministratie schriftelijk/toepasselijk bevestigd wordt. Dit is een voorstel, geen activatie of toezegging dat alle productiekosten nul zijn. De eigenaar kiest eerst provider, gebruiksvorm en voorwaarden. Ook een gratis verbinding vereist bewuste banktoestemming.

## Voorkomen van dubbele verwerking

Een latere implementatie moet bron en factuurbetaling scheiden. Alleen definitief geboekte banktransacties importeren; voorlopige transacties nog niet als betaling registreren. Bewaar per eigenaar/rekening een stabiele bankreferentie met een unieke serverbeperking, plus bron en importhistorie. Bij Enable Banking is `entry_reference` de bedoelde matchreferentie; `transaction_id` kan veranderen. Ontbrekende of dubbelzinnige referenties vereisen beoordeling. [Technische uitleg](https://enablebanking.com/docs/faq/#what-is-the-difference-between-entry-reference-and-transaction-id-transaction-properties).

Een al handmatig geregistreerde ontvangst of CSV-regel krijgt een bronkoppeling, geen tweede boeking. Bedrag/datum/tegenrekening/omschrijving zijn aanwijzingen, geen sluitend bewijs van identiteit. Een betaling van meerdere facturen moet per verdeling gecontroleerd worden. Overlappende importvensters, retries, hernieuwde banktoestemming, pending→booked, deelbetalingen en terugboekingen moeten apart worden getest. Omzet en factuur-btw worden niet nogmaals geboekt door de bankimport.

Deze inrichting is nog niet gebouwd of getest met een echte ING-verbinding. Bankbeschikbaarheid, zakelijke rekeningdekking, historie en eventuele kosten moeten bij de gekozen proef opnieuw worden geverifieerd. Bankwachtwoorden/codes worden nooit in APPFMZ ingevoerd; toestemming verloopt bij de bank/provider.
