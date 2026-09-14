# Synthetisch voorbeeld van de nieuwe factuurlayout

Geen echte klant, factuuruitgifte of bankgegevens. Deze bestanden zijn rechtstreeks uit de lokale PDF-template gerenderd. `SYNTHETISCH-2026-0001` is uitsluitend een vaste voorbeeldtekst, geen gereserveerd factuurnummer.

- [Echte voorbeeld-PDF: Progressie €380 min €30 = €350](progressie-synthetisch.pdf)
- [Volledige A4](a4-volledig.png)
- [Bovenkant](bovenkant.png)
- [Factuurregeltabel](factuurregels.png)
- [IBAN en totalen](iban-totalen.png)
- [Footer](footer.png)
- [Mobiele PDF-preview: 390 px](mobiele-preview.png)
- [Concept met bereikbare acties: 320 px](concept-320px.png)

De volledige matrix is reproduceerbaar via `tests/invoice-layout.test.cjs`; de screenshots via `tests/invoice-layout-ui.test.cjs` en Poppler plus `tests/invoice-layout-content.py`. De fysieke owneracceptatie van de layout staat nog open.
