# Lokale iPhone-fotodecoder

`heic-libheif-1.23.5.js` is de ongewijzigde WASM-bundel van libheif-js 1.23.5, LGPL-3.0, 2.044.206 bytes.

- SHA-256: `074b2b55ef3de477ba9f794ca381f3f0324c1cba8c91b4af07395f39c22d54cc`
- Upstream bron/buildscripts: https://github.com/catdad-experiments/libheif-js/tree/v1.23.5
- libheif bron: https://github.com/strukturag/libheif
- Distributiebron: https://cdn.jsdelivr.net/npm/libheif-js@1.23.5/libheif-wasm/libheif-bundle.js
- Licentie: [heic-LICENSE.txt](heic-LICENSE.txt)

De afzonderlijke bibliotheek kan worden vervangen door een compatibele eigen build. APPFMZ laadt deze uitsluitend vanaf het eigen domein in een tijdelijke Web Worker. Fotobytes gaan niet naar een externe decoder, CDN of AI-dienst. De decoder krijgt een tijdslimiet en pixel-/bestandsgroottelimiet. Niet-ondersteunde of beschadigde foto's geven een herstelbare fout; de bestaande profielfoto blijft behouden.
