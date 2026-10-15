# APPFMZ — onderzoek bankkoppeling, 15 oktober 2026

Geen provideraccount aangemaakt, contactbericht verstuurd, abonnement gesloten of echte banktoegang geactiveerd. Dit onderzoek blokkeert het herstel van Bank/Kas niet.

| Route | Wat de primaire bron bevestigt | Wat voor APPFMZ nog openstaat |
| --- | --- | --- |
| ING boekhoudkoppeling | ING beschrijft automatische gegevensuitwisseling met ondersteunde boekhoudpakketten | APPFMZ is daarmee niet automatisch een ondersteund pakket; actuele aansluitvoorwaarden, kosten en partneracceptatie zijn nog niet bevestigd |
| Enable Banking | Rekeninginformatie onder eigen AISP-autorisatie is mogelijk; productie vereist contract en bedrijfscontrole. De prijs is per gekoppelde rekening; een concreet bedrag is niet gepubliceerd in de geraadpleegde informatie | Exacte ING Nederland-zakelijke dekking voor deze rekening en productvorm, offerte, eventuele minimumbedragen, privacyvoorwaarden en onboarding |
| Tink Business Transactions | Zakelijke transactiegegevens zijn een afzonderlijk Enterprise-product. Nieuwe klanten krijgen persoonlijke prijsinformatie | Exacte ING-rekeningdekking, contract, offerte en geschiktheid voor één zakelijke rekening |
| Bestaande CSV-import | Werkt al binnen APPFMZ, met bronherkenning en expliciete koppeling aan bestaande ontvangsten | Handmatige download/import blijft nodig; dit is geen live koppeling |

## Verversing

Een bankkoppeling is niet vanzelf een continue livestream. Enable Banking beschrijft dat veel banken achtergrondtoegang beperken tot vier keer per dag; de werkelijke bank en toestemming zijn bepalend. Voorgrondverversing en opnieuw autoriseren moeten correct worden ondersteund. Niet beloven dat elke storting onmiddellijk zichtbaar is.

## Voorgestelde veilige inrichting — eigen ontwerp, nog niet gebouwd

Begin uitsluitend met rekeninginformatie: geen betaalopdrachten. Autorisatie vindt bij provider/bank plaats; APPFMZ vraagt geen bankwachtwoord. Geheimen blijven server-side, met eigenaarscontrole en intrekking.

Bewaar provider, rekening, boekingsstatus, stabiele transactie-ID en pagineringscursor. Een pending transactie telt nog niet als definitief ontvangen. Herhaalde imports en bankcorrecties mogen geen tweede ontvangst opleveren.

Gebruik bij voorkeur een stabiele bankidentiteit. Datum/bedrag/omschrijving alleen zijn een controlemogelijkheid, geen sluitend bewijs. Een al handmatig geboekte ontvangst krijgt na expliciete beoordeling de bankbron gekoppeld; geen extra bedrag. Uitgaven vragen nog steeds een zakelijke categorie en eventueel een bon. Een eigen overboeking of btw-afdracht is niet automatisch een gewone bedrijfskost.

Eerst nodig: bevestiging van zakelijke rekeningondersteuning en een concrete offerte. Daarna één review van provider, kosten en toegang. Geen inschrijving of banktoestemming vooraf.

## Primaire bronnen

- [ING: koppeling boekhoudpakket](https://www.ing.nl/zakelijk/digitaal-bankieren/eenvoudig-boekhouden/koppeling-boekhoudpakket)
- [DNB: PSD2 en toestemming](https://www.dnb.nl/innovatie-in-betalen-en-bankieren/veilig-betalen-en-innoveren-in-het-tijdperk-van-ai/wat-u-moet-weten-over-psd2/)
- [Enable Banking: dekking, voorwaarden, verversing en prijsmodel](https://enablebanking.com/knowledge-base)
- [Enable Banking: autorisatie en transactie-API](https://enablebanking.com/docs/api/reference/)
- [Tink: prijsvoorwaarden en Enterprise-producten](https://tink.com/pricing/)
- [Tink: Business Transactions](https://www.tink.com/products/business-transactions/)
