# Synthetische APPFMZ-voorbeelden

Deze bestanden bevatten uitsluitend testgegevens, geen echte klantfacturen of bedrijfsadministratie.

- `factuur-progressie.pdf`: €380 − €30 = €350, één A4.
- `factuur-twee-regels.pdf`: €400 − 10% = €360, één A4.
- `factuur-65-regels.pdf`: zes A4-pagina's; alle regels behouden.
- `administratieoverzicht.pdf` en `btw-overzicht.pdf`: leesbare rapporten uit de synthetische opslag-/exporttest, met betaalde/openstaande posten en controlepunten.
- De twee screenshots tonen de mobiele administratie in licht en donker.

De facturen zijn met `tests/documents.test.cjs` gegenereerd; de rapporten met `tests/report-examples.cjs` uit de gecontroleerde synthetische ZIP-export. Definitieve bestaande facturen van de owner worden door deze voorbeelden niet gewijzigd.
