# Third-party code in the isolated test package

PGlite 0.5.8: see PGLITE-LICENSE.txt. The WASM database runs solely in this browser sandbox.

The unchanged libheif-js 1.23.5 decoder is embedded in runtime.json (runtime.heic), followed by the APPFMZ worker adapter. LGPL-3.0 text: heic-LICENSE.txt. Upstream source and build instructions: https://github.com/catdad-experiments/libheif-js/tree/v1.23.5 and https://github.com/strukturag/libheif. Original distribution: https://cdn.jsdelivr.net/npm/libheif-js@1.23.5/libheif-wasm/libheif-bundle.js, SHA-256 074b2b55ef3de477ba9f794ca381f3f0324c1cba8c91b4af07395f39c22d54cc. This package can be rebuilt with a compatible replacement decoder. Photos never go to this upstream server.

Other embedded libraries reuse the existing APPFMZ PDF-Lib, PDF.js and fflate distributions and notices in vendor/ and tutorial/vendor/. No external service is called by the child sandbox.
