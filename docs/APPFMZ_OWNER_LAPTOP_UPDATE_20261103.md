# APPFMZ — owner-laptoptest met nieuw logo, schemakopie, Documenten en herinneringen

Deze update is uitsluitend voor de afgeschermde owner-test. De gewone ledenapp en productiegegevens blijven ongewijzigd. Fysieke owneracceptatie is nog niet uitgevoerd.

## Officiële bron en vormgeving

De eigenaar leverde `Logo 02-11-2026.png` aan vanuit zijn lokale logomap. SHA-256: `f60fd1fd2d34c02cfae5a7cb833e2cfc32c4c1284e200880cb0f68a0d05b315a`. Het originele RGBA-bestand van 1774 × 887 pixels is byte-identiek opgenomen. Geen websitebron, AI, hertekenen, recoloring of afsnijden. Varianten schalen het volledige beeld proportioneel; appiconen krijgen transparante binnenruimte.

[Bron, bewerkingen en variant-hashes](../owner-test/brand/provenance.json). Centrale goudkleuren zijn rechtstreeks uit drie bronpixels genomen: `#dfa639`, `#f1bf4b`, `#bf8329`. Neutrale achtergrond `#080808`, kaarten `#141414`/`#202020`, tekst `#f7f7f5`, secundaire tekst `#b7b7b2` en veldrand `#73736b`. Neutrale en semantische kleuren zijn leesbaarheidskeuzes, geen verzonnen kleurmetingen uit het logo. [Contrastbewijs](examples/owner-laptop-update-20261103/brand-contrast.json).

Zeven gebundelde vectoriconen gebruiken dezelfde afmetingen en lijnsterkte. Logo en kleuren zijn toegepast in de testnavigatie, dashboard, instellingen, formulieren, kalender, profielen en nieuwe testovereenkomsten. De gewone favicon, geïnstalleerde PWA en bestaande opgeslagen PDF’s worden niet vervangen. Instellingen toont het appicoon- en faviconvoorbeeld.

## Functionele route

- **Schema builder → Schema van ander lid kopiëren:** bron zoeken, beschikbare inhoudsversie en volledig voorbeeld kiezen, ander doellid controleren en expliciet bevestigen. Daarna onafhankelijk concept bewerken en bewust opslaan. Alleen een vaste lijst structuurvelden wordt gekopieerd. Resultaten, gewichten, privégegevens en financiële gegevens gaan niet mee. Concepten en kopiehistorie blijven hervatbaar; een verloren bevestiging gebruikt dezelfde identiteit. Bestaande platte schema’s krijgen pas een aantoonbare inhoudssnapshot bij raadplegen; oudere versies worden niet verzonnen. In een lege teststaat maak en koppel je eerst bewust een oefening aan een fictief bronlid; de gids legt dit uit.
- **Ledenprofiel → Documenten:** metadata, Openen en Downloaden voor de daadwerkelijk opgeslagen PDF. MIME, omvang, PDF-inhoud en SHA-256 worden gecontroleerd. Opnieuw proberen bij ontbrekende/beschadigde download of pop-upblokkering maakt geen nieuwe overeenkomst. De bestandsnaam gebruikt de ondertekende snapshot. Profielwijziging en inactief zetten herschrijven de overeenkomst niet.
- **Agenda:** dag-, week-, maand- en lijstweergave van herinneringen zeven dagen vooraf en op de factuurdatum. Vier weken betekent exact 28 dagen; maandafspraken behouden kalendermaanden. Europe/Amsterdam, duo-hoofdcontractant en deelnemers, achterstallige taken en afzonderlijke voltooiing worden meegenomen. Nieuwe leden op een al afgeronde datum heropenen niet de oude afgehandelde leden. De link per lid opent de bestaande handmatige factuurkeuze. Een herinnering maakt geen factuur, concept, e-mail of betaling.
- **Ledenstatus:** effectieve datum, optionele reden/notitie en afzonderlijke bevestiging voor coaching, betaalafspraak en toekomstige herinneringen. Actief/inactief is geen gegevensverwijdering. Historie en open facturen blijven bestaan. Hervatten maakt geen gemiste facturen. Gezamenlijke duo-afspraken worden bij de hoofdcontractant beheerd. Zoekresultaten en filters tonen ook inactieve leden.

De testgids bevat 23 stappen. Bestaande gidsvoortgang wordt als eerdere route bewaard. Nieuwe testovereenkomsten bevatten het nieuwe logo in hun onveranderlijke snapshot; oudere testdocumenten houden hun oorspronkelijke bytes.

Bij integratie zijn ook concrete fouten hersteld: CSS maakte een verborgen doellidveld toch zichtbaar; het alleen bekijken van een nieuwe kopie maakte lege trainingsresultaten aan; een ontbrekende lokale push-opruimfunctie verstoorde een synthetische accountwissel; uitbreiding van een afgeronde herinneringsgroep kon oude deelnemers opnieuw openen. Deze correcties zijn gericht op de owner-test. De gewone `app.js` wordt niet vervangen.

Bij de gerenderde controle op 1366 × 768 en 200% browserzoom bleek de buitenste testbalk te hoog. Die wordt bij een smalle viewport nu één compacte rij, met volledige toegankelijke labels. Alle tien profieltabbladen blijven binnen het bereikbare werkvlak.

## Afbakening en bewijs

De eigenaar wordt door de bestaande host gecontroleerd. De test draait in een afgeschermd iframe zonder same-origin-toegang, met `connect-src 'none'`, lokale synthetische PGlite-data en een afzonderlijk hervatbaar checkpoint. Bestaande openbare oefen-GIF’s behouden hun begrensde beeldroute zonder referrer. Camera en PDF lopen via de al bestaande beperkte hostbruggen.

Er is geen productiemigration, SQL-write, Edge-deployment, Auth- of Storage-write uitgevoerd. Geen echte status, schema, herinnering, overeenkomst of financiële afspraak aangepast. Staging touched: NO. Bedrijfswebsite touched: NO. JARVIS touched: NO.

Read-only nulmeting: [baseline.json](examples/owner-laptop-update-20261103/baseline.json). Deze meet aantallen en inhoudshashes van 24 benoemde productietabellen en twaalf migrations, zonder klantregels in het rapport. Dit is een afgebakende nulmeting; geen reconstructie van eerdere, buiten deze opdracht ontstane verschillen.

De verwijdercontrole betreft uitsluitend de eigen geïsoleerde browserdatabase, checkpoints en tijdelijke testbrowserprofielen. Gedownloade synthetische PDF’s, screenshots en gesaneerde bewijzen blijven als controlebewijs in deze rapportage bewaard; er zijn geen productie-testaccounts of productie-testbestanden aangemaakt.

## Verificatie en publicatie

De lokale toelating slaagt: **23 unieke lokale tests**, **12 browserflows** en **22 native zoom-/layoutgevallen**, plus twee aanvullende beeldopnamen van logo en Dashboard zonder overlappende testgids. Edge 155.0.4283.62 en Chrome 156.0.8078.80 zijn geautomatiseerd op Windows gebruikt. [Volledige testmatrix](examples/owner-laptop-update-20261103/test-matrix-summary.json) en [exacte synthetische verwijderlijsten met opruimbewijs](examples/owner-laptop-update-20261103/cleanup-summary.json).

Geteste broncode, tests en bewijzen: [`d8350786e7c5e7bc6e996aa5d22795755ddc31e9`](https://github.com/Yourizorge/fitmetzorge/commit/d8350786e7c5e7bc6e996aa5d22795755ddc31e9), gepusht naar `codex/members-billing-20261026`. Deze bronbranch wordt **niet** naar main samengevoegd. De publicatie bevat uitsluitend het owner-testpakket, dit rapport, gesaneerde bewijzen en de read-only releaseverifier.

De camera-, sessie-, accountwissel- en animatiecontroles slagen op het definitieve pakket. De camera gebruikte een synthetisch browserapparaat; dit bewijst geen werking van de fysieke laptopcamera. Alle beeldopnamen bevatten fictieve gegevens. De releaseassemblage slaagt tegenover de bestaande gewone-appbaseline: [controle](examples/owner-laptop-update-20261103/release-assembly-preflight.json).

Owner-testrelease [`ff28c1d82adfc7de42927fb04d2d7e68279ec48c`](https://github.com/Yourizorge/fitmetzorge/commit/ff28c1d82adfc7de42927fb04d2d7e68279ec48c) is atomair gepusht naar `main` en `codex/owner-laptop-test-20261102`. Tegenover de direct voorafgaande main `018caab368aff244b1b95c2f70474fe98486790e` veranderden **nul gewone-appbestanden en nul database-/Edge-bestanden**. [Gewijzigde-bestandenlijst](examples/owner-laptop-update-20261103/release-change-inventory.json) en [Git-blobcontrole](examples/owner-laptop-update-20261103/release-assembly-commit.json).

Read-only productienameting van 3 november 2026 12:01 UTC: alle 24 tabel-aantallen en SHA-256-inhoudshashes zijn exact gelijk aan de nulmeting; alle twaalf migrations zijn gelijk. [Voor-/navergelijking](examples/owner-laptop-update-20261103/production-after.json). Het bestaande herstelpunt en de bescherming daarvan zijn intact: [herstelcontrole](examples/owner-laptop-update-20261103/recovery-after.json).

**Gepubliceerd en technisch geverifieerd:** GitHub Pages meldt `built` voor `ff28c1d…` op het bestaande domein appfmz.nl, vanaf main. Alle **127 gecontroleerde publieke bestanden** (88 bestaande appbestanden en 39 owner-testbestanden), plus de root-startpagina, zijn byte-identiek aan de releasecommit. De Git-assemblage controleert 449 bestaande baselinebestanden en 123 pakketvoorwaarden. [Hostingbewijs](examples/owner-laptop-update-20261103/release-hosting.json), [volledige live bytevergelijking](examples/owner-laptop-update-20261103/release-live-verification.json), [anonieme Edge-controle](examples/owner-laptop-update-20261103/live-browser-smoke.json). Anoniem is de testknop verborgen en wordt geen testiframe geopend; er zijn geen paginafouten of schrijfverzoeken.

De aansluitende rapportcommit bevat uitsluitend documentatie/bewijs en verandert geen runtimebestand. De definitieve remote HEAD wordt bij oplevering vermeld. De gewone geïnstalleerde app behoudt haar bestaande icoon en werking. De nieuwe huisstijl en functies zijn alleen vrijgegeven in de geautoriseerde owner-test. Fysieke camera, laptopbediening, telefooninstallatie en inhoudelijke owneracceptatie zijn niet als PASS aangemerkt.

Definitieve remote HEAD van `main` én `codex/owner-laptop-test-20261102`: **`985b3d37f65b119bb82d479c8b0c3077f47d3d16`**. GitHub Pages meldt deze exacte commit als `built`. Na de documentatiepublicatie zijn startpagina, host, manifest en runtime opnieuw byte-identiek gecontroleerd. [Definitief publicatiebewijs](examples/owner-laptop-update-20261103/publication-receipt.json). Deze laatste ontvangstbevestiging is in de bronbranch vastgelegd om geen nieuwe runtime- of herpublicatiecyclus te veroorzaken.

### Herleidbaarheid van de testpakketten

Het definitieve runtimebestand heeft SHA-256 `ae02e0f19f93bab64217412126df8063f76487bfbfda38560b77810742300c64`. De documentroutes waren eerder volledig getest op `ee78c3df…`; kalender en status op `5b99c1b9…`. De exacte eerdere pakketten zijn uit het definitieve pakket reproduceerbaar met de vastgelegde inverse patches. Alle ingebedde applicatiescripts zijn identiek; voor kalender/status zijn ook de database-adapter, kalender, statusbediening en gidsfuncties identiek. Latere verschillen betreffen expliciet de afzonderlijk geteste kopiebediening, vormgeving en lokale opruimbewijzen. Dit is geen claim dat die eerdere browserruns op de laatste hash draaiden.

Bewijs: [documentdelta](examples/owner-laptop-update-20261103/document-runtime-delta.json), [kalenderdelta](examples/owner-laptop-update-20261103/calendar-runtime-delta.json). In de bronbranch controleert `node tests/owner-update-runtime-delta.cjs` respectievelijk dezelfde opdracht met `--calendar` de exacte reconstructie. De laatste layout-, camera-, host- en mediatests leggen bovendien de afzonderlijke hosthash vast.

### Screenshots en synthetische bestanden

| Gevraagde controle | Bewijs |
|---|---|
| Dashboard en zeven navigatie-iconen | [Dashboard](images/owner-laptop-update-20261103/edge-dashboard-1366.png) |
| Volledig logo op licht/donker, appicoon en faviconvoorbeeld | [Logovarianten](images/owner-laptop-update-20261103/edge-logo-light-dark.png) |
| Ledenprofiel, 100% en 200% echte browserzoom | [100%](images/owner-laptop-update-20261103/edge-profile-1366-zoom-100.png), [200%](images/owner-laptop-update-20261103/edge-profile-1366-zoom-200.png) |
| Telefoonformaat, browseremulatie | [390 px](images/owner-laptop-update-20261103/edge-profile-390.png) |
| Schema: bron, voorbeeld, bevestiging, concept en opgeslagen kopie | [Bron](images/owner-laptop-update-20261103/edge-schema-source.png), [voorbeeld](images/owner-laptop-update-20261103/edge-schema-preview.png), [bevestiging](images/owner-laptop-update-20261103/edge-schema-confirmation.png), [concept](images/owner-laptop-update-20261103/edge-schema-independent-draft.png), [opgeslagen](images/owner-laptop-update-20261103/chrome-schema-saved.png) |
| Documententab, geopende en gedownloade PDF | [Documenten](examples/owner-laptop-update-20261103/documents-msedge.png), [PDF-weergave](examples/owner-laptop-update-20261103/document-preview-msedge.png), [werkelijk gedownloade PDF](examples/owner-laptop-update-20261103/document-msedge-original.pdf) |
| Zeven dagen vooraf, factuurdag en drie toekomstige perioden | [Vooraf](images/owner-laptop-update-20261103/edge-calendar-preparation.png), [factuurdag](images/owner-laptop-update-20261103/edge-calendar-invoice-day.png), [perioden](images/owner-laptop-update-20261103/edge-calendar-three-periods.png) |
| Actief, inactief, hervatten en filters | [Actief](images/owner-laptop-update-20261103/edge-member-active.png), [inactief](images/owner-laptop-update-20261103/edge-member-inactive.png), [hervat](images/owner-laptop-update-20261103/edge-member-reactivated.png), [filter](images/owner-laptop-update-20261103/edge-members-inactive-filter.png) |

Alle personen, overeenkomsten, handtekeningen en bedragen in dit beeldmateriaal zijn synthetisch. De PDF’s zijn echte browserdownloads; opnieuw downloaden na profielwijziging, inactief maken, herladen en opnieuw aanmelden leverde per browser exact dezelfde bytes op. Een browseremulatie is geen fysieke telefoontest.

## Fysieke eigenaarstest

Open na geverifieerde publicatie als eigenaar [de laptoptest](https://appfmz.nl/?owner-test=1&retest=20261103-update). Controleer TESTMODUS en volg de gids: nieuw logo, schemakopie, PDF, drie toekomstige perioden en inactief/actief met afzonderlijke hervatkeuzes. Sluit af met de getoonde synthetische verwijderlijst. Browserautomatisering bewijst geen fysieke laptop- of telefoontest en is geen inhoudelijke owneracceptatie.
