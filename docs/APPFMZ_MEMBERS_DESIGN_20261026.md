# APPFMZ leden: ontwerp en lokale verificatie — 26 oktober 2026

Status: lokale implementatie; dit document is geen bewijs van productiepublicatie. De bestaande productieomgeving, Auth-accounts, financiële historie en Storage zijn door deze implementatiewerkstroom niet gewijzigd. Staging, bedrijfswebsite en JARVIS blijven buiten scope.

## Hergebruik en gegevensstroom

De bestaande `coach_workspaces.state.clients` blijft de bron voor leden en coaching. `profiles` blijft de bestaande geverifieerde Auth-koppeling. De migratie `20261026154916_appfmz_members.sql` voegt een private `fmz_members`-uitbreiding toe; geen tweede leden- of Auth-systeem. De zoekindex bevat alleen een verwijzing naar de oorspronkelijke client. De bestaande `fmz_accounting.agreement_versions` bewaart de nieuwe betaalafspraak. Er wordt bij inschrijven geen factuur, betaling, omzet of btw-boeking aangemaakt.

De route is: actief cataloguspakket → persoonsconcept → betalingsoverzicht → volledige voorwaarden en handtekening → gecontroleerde PDF → één transactionele afronding → bestaand ledenprofiel. Een concept maakt nog geen lid, account of overeenkomst. Een uitnodiging blijft een afzonderlijke, bestaande veilige handeling; de trainer kiest geen wachtwoord. Auth-aanmaak gebeurt niet tijdens de afronding en kan dus geen half gekoppeld account achterlaten.

Nieuwe terugkerende catalogusversies gebruiken vier weken; bestaande kalendermaandafspraken worden niet gewijzigd. De nieuw bevestigde duo-bedragen worden alleen in de nieuwe catalogusversie gebruikt. De historische SQL-catalogus en ondertekende afspraken blijven intact. Losse training en strippenkaart worden niet zonder expliciete inschrijfbaar-configuratie aangeboden.

## Tabellen en bescherming

- `directory`: lidnummer, eigenaartrainer, profielversie en fotoverwijzing; trigger houdt de index bij zonder bestaande clients te herschrijven. De trigram-arrayindex wordt werkelijk gebruikt naast de afgeschermde trainerselectie.
- `catalog_versions`: versiegebonden pakketsnapshot, prijs in centen, cyclus, sessies, prijsbasis en actieve/inschrijfbare status.
- `terms_versions`: volledige voorwaarden, privacytekst, samenvatting, bronbewijs, hash en verificatiestatus. Er wordt geen actieve productiepolicy verzonnen of in de migratie opgenomen.
- `drafts`: uitsluitend eigen trainerconcepten, versiecontrole, partieel ingevulde gegevens en eventueel handtekeningconcept. Geen persoonsgegevens in permanente browseropslag.
- `assets`: verwachte bytes/hash, exact private pad, type, status en document-snapshothash.
- `contracts`: onveranderlijk ondertekend snapshot, uniek overeenkomstnummer, bestaande betaalafspraakverwijzing en definitieve PDF-verwijzing.
- `events`: actor, tijd, reden waar van toepassing, oude en nieuwe gegevens. Intern trainernotitieveld wordt niet naar een lid geprojecteerd.
- `receipts`: aanvraag-ID plus payloadhash en antwoord voor herhaalbare opdrachten.

Alle tabellen hebben RLS zonder rechtstreekse browsertoegang. De bestaande actuele sessiecontrole geldt bij iedere RPC. De trainer krijgt uitsluitend de eigen clients; een lid uitsluitend het eigen profiel en document. De ledenprojectie gebruikt een expliciete lijst toegestane velden, geen zwarte lijst. Een toekomstige interne profielsleutel verschijnt daardoor niet automatisch bij het lid. Profielen van andere leden en private tabellen blijven onbereikbaar.

De definitieve afronding vergrendelt concept en workspace, controleert duplicaten, huidige catalogus- en voorwaardenversie, ondertekening en geverifieerde PDF, en schrijft lid, betaalafspraak, overeenkomst en audit in één transactie. Een herhaalde bevestiging retourneert dezelfde afgeronde inschrijving. Een gewijzigd concept/profiel geeft `PT409` en vereist opnieuw vergelijken.

## PDF, handtekening en foto's

De handtekening bestaat uit begrensde tekenpunten; er vindt geen biometrische analyse plaats. De PDF is een echte A4-PDF met het originele projectlogo, persoonsgegevens, exact pakket- en prijssnapshot, volledige voorwaarden en privacytekst, handtekening en tijdstip. Browser en Edge gebruiken dezelfde deterministische renderer. De Edge-functie haalt het server-snapshot op, genereert opnieuw de verwachte PDF en vergelijkt de werkelijke bytes/hash. Browsermetadata alleen kan een document niet vrijgeven.

`member-assets` gebruikt een server-side servicecredential, nooit een browsercredential. JWT-verificatie moet bij uitrol ingeschakeld blijven. De service-only bevestigings-RPC is niet uitvoerbaar door gewone gebruikers. Alle documenten en foto's staan in private bucket `fmz-members`; tijdelijke ondertekende links zijn kort geldig en worden alleen na autorisatie uitgegeven. Een gewone gebruiker mag geen bestaande bestanden overschrijven of rechtstreeks verwijderen.

Foto's worden lokaal gedecodeerd, begrensd en bijgesneden. HEIC gebruikt de lokaal gebundelde kosteloze `libheif-js`-worker; er gaat geen afbeelding naar een externe dienst. De upload is een JPEG. Servervalidatie controleert de daadwerkelijke inhoud, parserafmetingen, omvang en hash. Vervangen/verwijderen trekt de oude foto onmiddellijk in, waarna de beperkte Edge-route uitsluitend een ingetrokken profielfoto fysiek kan opruimen. Overeenkomstbestanden vallen niet onder deze verwijderroute. Bij een mislukte opruiming blijft een herhaalbare opruimactie zichtbaar, ook na herladen. Auditregels blijven bestaan.

Voor versleuteling bij opslag wordt vertrouwd op de bestaande Supabase-platformvoorziening, niet op een nieuw zelfontworpen cryptografisch systeem. Productiebewijs van de platformconfiguratie blijft onderdeel van de releasecontrole; de lokale test bewijst geen fysieke encryptie van productieopslag.

## UX en herstel

De ledenzoeker verwerkt gedeeltelijke namen, spaties, e-mail, genormaliseerde telefoonnummers en lidnummers. Resultaten hebben naam, initialen/foto, status en pakket. Pijltjestoetsen/Enter openen een profiel. Er zijn laad-, lege- en fouttoestanden. Resultaten zijn begrensd tot honderd; verder verfijnen is mogelijk.

Inschrijfconcepten slaan geldige opdrachten na ongeveer 650 ms op zonder tijdens typen het formulier opnieuw op te bouwen. Onvolledige velden blijven tekst. Een oudere serverbevestiging markeert nieuwere invoer niet als opgeslagen. Bij een verloren antwoord wordt dezelfde opdracht eerst hersteld, vervolgens wordt nieuwere invoer in volgorde opgeslagen. Sluiten met resterende onopgeslagen invoer waarschuwt. Een expliciet bevestigde serveropslag kan na herladen/hervatten worden teruggehaald; niet bevestigde browserinvoer heeft geen belofte van herstel na tabbladsluiting.

Het profiel verwijst naar bestaande training, voeding, voortgang, agenda en financiële functies. Het toont documenten, uitnodigingsstatus en wijzigingshistorie. Een profielwijziging verandert de oude ondertekende PDF niet. Ondersteunde persoonlijke wijzigingen hebben een vooraf zichtbaar oud/nieuw-overzicht; wijzigingen in het hoofddoel werken ook het bestaande coachingveld bij.

## Lokale tests en bewijs

- `tests/members-database.test.cjs`: concepten zonder half lid, rollen/privatetoegang, actieve voorwaarden verplicht, lege handtekening geblokkeerd, transactionele afronding en herhaling, alle zeven inschrijfbare pakketten, prijswijziging tijdens concept, bestaande maandafspraak onveranderd, duplicaataccount, profielconflict/audit, expliciete ledenprojectie, actual-session controle en Storage-grenzen.
- `tests/members-drafts.test.cjs`: verloren opslagantwoord, nieuwere invoer in volgorde, dubbel navigeren, herladen, opnieuw aanmelden en conflict met behoud van de eigen invoer.
- `tests/members-cleanup.test.cjs`: afgebroken verwijdering van ongebruikt concept, ingetrokken private toegang, herladen/herhalen, gecontroleerde Storage-verwijdering en geen half lid; definitieve documenten zijn apart in de databasetest beschermd.
- `tests/members-documents.test.cjs`: exact herhaalbare PDF-bytes, drie A4-pagina’s voor het korte oefenvoorbeeld, lange voorwaarden over meer pagina’s, duidelijke fout bij een niet ondersteund teken, afbeeldingsparser en twaalf lesstructuren.
- `tests/members-model.test.cjs`: normalisatie, exacte datums, invoervalidatie, handtekeninggrenzen en byte-identieke browser/Edge-renderers.
- `tests/members-ui.test.cjs`: echte gerenderde lokale APPFMZ-interface met alle drie nieuwe migraties, ondertekenen, gecontroleerde private PDF, volledige afronding, profielwijziging, zoeken/toetsenbord, opnieuw downloaden na herladen, 320/390/768/1400 pixel-layout. Edge en WebKit; geen fysieke iPhoneclaim.
- `tests/members-photos.test.cjs`: echte lokale HEIC-decode, uitsnede/zoom, private upload, vervangen en daadwerkelijk verwijderen van vorige foto, ongeldige JPEG geweigerd, nul externe fotonetwerkverzoeken. Edge en WebKit.

Screenshots en gegenereerde oefen-PDF's staan lokaal onder `tests/artifacts/members/`; ze bevatten uitsluitend fictieve personen. Oefendocumenten dragen op iedere pagina `OEFENOVEREENKOMST - NIET GELDIG`. De echte productievoorwaarden hebben geen testvlag. De testfixtures mogen nooit productiepolicy worden.

De communicatie-uitbreiding registreert na een echte, geverifieerde overeenkomst één overeenkomstmailtaak. Dit bewijst lokaal geen SMTP-configuratie, mailboxontvangst of kopie in Outlook/TransIP. De communicatie-agent beheert die afzonderlijke verificatie.

## Expliciete open grenzen vóór een volledige release-PASS

1. De officiële privacybron is nog een placeholder. Er is een eigenaar-reviewconcept, geen goedgekeurde geldende policy. Definitief inschrijven blijft daarom fail-closed. Een synthetische testpolicy is geen oplossing voor productie.
2. Optionele gezondheidsgegevens vragen afzonderlijke expliciete toestemming en goedgekeurde intrekkings-/bewaarregels. Die moeten aansluiten op de uiteindelijke privacytekst vóór nieuwe gegevensverzameling. Een marketingvinkje of algemene contractbevestiging is daarvoor niet voldoende.
3. Deze route ondersteunt alleen volwassenen; ouderlijke toestemming en minderjarigeninschrijving zijn niet geïmplementeerd.
4. E-mailadres wijzigen vereist controle van de bestaande Auth-koppeling en is bewust niet via een gewone profielwijziging beschikbaar. De trainer kan geen wachtwoord instellen.
5. Een afwijkende eerste periode en een tijdelijke korting worden vóór ondertekening expliciet vastgelegd. De eerste periode heeft een bruto bedrag, reden/berekening, einddatum en netto bedrag na korting. De korting geldt voor de eerste N concrete betaalperiodes, inclusief de eerste, daarna keert de catalogusprijs terug. Een kalendermaand behoudt de maandgrens. De vaste catalogusprijs blijft ongewijzigd; migration17 koppelt de betaalafwijkingen atomair aan de nieuwe overeenkomst. Een latere contractwijziging mag de ondertekende PDF niet vervangen; daarvoor blijft een aanvullende ondertekende overeenkomst nodig.
6. Ongebruikte conceptgegevens en niet definitief gekoppelde concept-PDF’s hebben een begrensde opruimroute: eerst intrekken, daarna private Storage-verwijdering en serverbevestiging. Een afgebroken opruiming verschijnt na herladen opnieuw. Conceptgegevens in eerdere idempotentie-antwoorden worden geredigeerd; aanvraaghash en minimale audit blijven behouden. Voltooide overeenkomsten en verwijzingen vanuit contracten worden expliciet geweigerd.
7. Productie-uitrol, volledige behoudsmeting, canary, fysieke iPhone-/PWA-installatie, mailbox- en pushontvangst zijn afzonderlijke controles van de hoofdrelease. Deze lokale implementatie rapporteert die niet als PASS.

De twaalf aanvullende lessen staan in `tutorial/members-lessons.js`. Bestaande les-ID's en voortgang blijven bestaan. Gesproken opname, montage, fysieke hoorbaarheid en publicatie moeten apart worden bewezen.

## Aanvullende volledigheidscontrole en gezondheids-gate

De nieuwe profielroute controleert verplichte adresvelden, een geldige volwassen geboortedatum, hoofdtelefoon en optioneel noodnummer ook server-side. Veldfouten hebben gekoppelde `aria-describedby` en `aria-invalid`. Het handtekeningvak ondersteunt werkelijk tekenen met het toetsenbord: spatie schakelt de pen, pijltjes bewegen/tekenen, Escape zet de pen uit. Een getypte naam is geen vervanging voor de getekende handtekening. Zoekresultaten tonen leesbare pakketten en een verfijnmelding bij honderd resultaten. Het profiel toont de volgende periode en opent uitsluitend de bestaande facturen van het geselecteerde lid.

`consent_policies` en `consent_events` zijn afzonderlijke private registraties met beleidsversie/hash, actor, betrokkene, tijdstip en grant/withdraw-gebeurtenis. Er wordt geen actieve policy of juridische tekst ingevoegd. Een contractbevestiging of marketingcheckbox verleent geen gezondheidstoestemming. Alleen een gekoppeld ingelogd lid kan een actieve purposeversie bevestigen; een trainer kan een intrekking registreren maar niet namens het lid een grant toevoegen. De eigenaar heeft vrijwillige afzonderlijke toestemming en intrekking via `info@fitmetzorge.com` gekozen. Dit is geen goedkeuring van de volledige privacytekst of bewaartermijnen.

Inschrijfconcepten bewaren geen nieuwe gezondheidsgegevens. Na succesvolle inschrijving activeert het lid zijn eigen account; in Mijn profiel staat de volledige actieve purpose/privacyversie met een afzonderlijke, niet vooraf aangevinkte keuze. Zonder actieve goedgekeurde policy wordt geen toestemmingsknop aangeboden. De trainer kan daarna gezondheidsgegevens toevoegen wanneer de individuele grant geldig is. De contactactie voor intrekking opent alleen een e-mailconcept, zonder automatisch iets te versturen. Na ontvangst kan de trainer de intrekking expliciet vastleggen; nieuwe gezondheidsregistratie wordt dan server-side geblokkeerd. Een eerder ontvangen succesvolle grantopdracht opnieuw proberen kan de latere intrekking niet ongedaan maken.

Voor nieuwe via deze release ondertekende leden controleert de server `injuries`, voeding/logs, gewicht/metingen, slaap, welzijn, stappen, water en hun weekvarianten, inclusief daarin opgeslagen voortgangsfoto's. Zowel directe workspacewijzigingen als de normale opslag-RPC lopen door dezelfde trigger. Ook nieuwe teken-/deelwijzigingen bij voortgangsfoto's vallen onder de guard. Lege normalisatie en ongewijzigde oude waarden blijven mogelijk. Bestaande leden worden niet automatisch als nieuwe managed leden aangemerkt, geblokkeerd of herschreven; bestaande toestemming wordt niet verondersteld. De guard classificeert geen willekeurige vrije tekst: gebruik algemene notities niet voor medische informatie.

**Activering blijft TODO vóór nieuwe gezondheidsverzameling:** eigenaar keurt exacte privacytekst en afzonderlijke vrijwillige doelen goed; gekozen scope moet overeenkomen met de bovenstaande technische guards; de goedgekeurde versie/hash wordt gecontroleerd geactiveerd. Profilefoto versus voortgangsfoto, marketing en andere afzonderlijke doeleinden moeten op het definitieve beleid aansluiten. De retentie-/verwijderroute en behandeling van vrije tekst, private links, auditkopieën, backups en bewaarplichten blijven apart uit te werken: verzin geen termijn en verwijder geen historische dossiers. Geen publicatieclaim dat deze juridische/retentieroute al volledig actief is.

Aanvulling 2 november: uitsluitend de ontbrekende consentproeven toegevoegd. `members-consent.test.cjs` controleert echte lokale SQL-rollen, oude-dossierbehoud, nieuwe managed-member-bypasses, eigen grant en intrekking. `members-consent-ui.test.cjs` controleert de daadwerkelijke lokale Edge-bediening van een afzonderlijke eigen keuze en het door de trainer vastleggen van een ontvangen intrekking. Geen productie-, mailbox- of fysieke telefoonclaim.

Gerichte extra tests: `members-completeness.test.cjs` voor verplichte profielvelden, centberekeningen, inactieve/actieve consent, intrekking, rolgrenzen en workspace-bypass; `members-payment-ui.test.cjs` voor echte kortings-/eersteperiode-inschrijving, toetsenbordhandtekening, PDF, billing-tabellen en foutrelaties. Aanvullende screenshotbestanden krijgen `viewport-` als naam en gebruiken uitsluitend synthetische gegevens.
