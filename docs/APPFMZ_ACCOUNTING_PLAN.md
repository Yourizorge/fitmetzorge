# APPFMZ — uitvoering volledige owneradministratie

De aanvulling op 10 september 2026 vervangt het bewerken van definitieve facturen door onveranderlijke facturen met gekoppelde credit/correctie. De geteste prijs-/PDF-basis staat op `codex/package-invoice-pdf` (`c7c4af7`), nog niet op main. Nieuwe publicatie volgt pas na de gecombineerde controles. Geen staging, marketing, AI-ontwikkeling, betaalde dienst, betalingen of echte factuurverzending.

## Toegang en bewaring

De door de owner opgegeven login is gecontroleerd in het productieproject: bestaand trainerprofiel, bevestigde Auth-e-mail. Het organisatie-eigenaarschap wordt een afzonderlijke serverregistratie op het geverifieerde Auth-ID; de trainerrol geeft op zichzelf geen administratierechten. Alle records, mutaties en bestanden worden aan de organisatie gebonden. Alleen gecontroleerde RPC's en private bestandsregels geven toegang. Bestaande klant-/trainerkoppelingen blijven behouden.

Financiële data krijgt een afgeschermd schema, met RLS, ingetrokken directe gebruikersgrants en controle van de actuele sessie. De organisatie/het financiële archief gebruikt geen verwijdercascade vanaf het gewone account. Definitieve brondocumenten, journaalregels en auditinformatie blijven behouden; correcties worden toegevoegd. Private originele bestanden krijgen een vaste identiteit, hash en bronkoppeling en kunnen niet worden overschreven via de gebruikers-API.

## Eén geïntegreerde administratie

Administratie krijgt schermen voor overzicht, verkoopfacturen, uitgaven, bank/kas, privé, bezittingen/schulden, btw, rapportage/export en instellingen. De bestaande klanten, pakketprijzen en factuurconcept/PDF-generator worden hergebruikt. Historische administratie blijft beschikbaar ter controle; er komen geen automatische dubbele openings- of omzetboekingen.

Het grootboek boekt op gehele centen en eist sluitende debet-/creditregels. Facturen boeken omzet en vorderingen; ontvangen betalingen vereffenen vorderingen. Uitgaven en hun betalingen blijven afzonderlijke gebeurtenissen. Privévoorschotten boeken een schuld aan privé; vergoeding is geen tweede kostenpost. Privéstortingen en -opnames lopen via eigen vermogen, zonder omzet/btw. Ongekoppelde bankmutaties gebruiken een tussenrekening en blijven zichtbaar.

Nummering, definitief maken en journaalposten worden server-side in één transactie afgehandeld, met aanvraag-ID's en versiecontroles. Na finalisatie wordt de daadwerkelijke PDF privé gearchiveerd; bij een fout wordt voor dezelfde factuur opnieuw gegenereerd/geüpload. Correcties krijgen een eigen, gekoppelde nummering. Deelbetalingen, splitsingen en terugbetalingen zijn herleidbaar.

CSV-import biedt kolomkoppeling en voorbeeld vóór import, bewaart de originele bron en voorkomt herhaling bij overlappende exports. Zonder unieke bankreferentie worden mogelijk identieke transacties als controlepunt getoond; er wordt niet verondersteld dat elke identieke betaling dezelfde gebeurtenis is. Beginsaldi zijn onbekend tot expliciete invoer. Afstemming vergelijkt de ingevoerde eindstand met beginstand en mutaties.

## Fiscale instellingen en controle

Bestaande bedrijfsinstellingen worden zichtbaar voorgesteld, niet automatisch bevestigd. De owner controleert juridische bedrijfsgegevens, btw/KOR, aangifteperiode, btw-methode en ingangsdatum. De boekhouding maakt onderscheid tussen resultaat en liquide middelen. Bedrijfsmiddelen, schulden en expliciete afschrijving/correctie worden ondersteund zonder fiscale termijnen te verzinnen.

Factuurcontrole baseert zich op de actuele [Belastingdienst-factuureisen](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/factuureisen): identificatie en adressen van partijen, toepasselijke registratienummers, unieke opeenvolgende nummering, uitreikdatum, omvang en levering van de dienst en de juiste bedragen/btw. Ontbrekende gegevens blokkeren definitief maken. Bij [KOR](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/facturen_maken/factuureisen/aangepaste_regels_facturen/u_maakt_gebruik_van_de_kleineondernemersregeling) wordt geen btw vermeld; de vrijstelling wordt herkenbaar gemaakt. Bij [kasstelsel](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/bereken_het_bedrag/hoe_berekent_u_het_btw_bedrag/kasstelsel/) volgt de omzetbelasting de ontvangsten, terwijl voorbelasting niet simpelweg aan de betaaldatum wordt gekoppeld.

Uitgaven hebben expliciete btw-behandeling en zakelijke/aftrekbare aandelen. Onbekende behandeling of ontbrekend bewijs is zichtbaar; geen standaard automatische aftrek van 21%. Btw-overzichten blijven voorbereidend en tonen onderliggende posten en ontbrekende informatie. Technische tests zijn geen fiscale goedkeuring.

Volgens de [Belastingdienst-bewaarregels](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/) gelden verschillende categorieën en startmomenten: basisgegevens doorgaans zeven jaar, onroerende zaken en OSS tien jaar; de periode begint na het vervallen van de actualiteitswaarde. Er komt daarom geen algemene verwijderregel vanaf upload. Onbekende eindactualiteit betekent blijven bewaren. Periodeafsluiting en heropening blijven traceerbaar.

## Bewijs vóór publicatie

Synthetische ketens omvatten factuur/korting/PDF, deelbetaling/restant, bankafstemming, uitgaven/btw/privévoorschot, €0,20 privéstorting, herhaalde import, credit/correctie, gelijktijdigheid, export en geïsoleerd herstel inclusief bestanden. Autorisatietests gebruiken een lid en een niet-ownertrainer. De eerdere workout-, voedings-, foto- en autosaveregressies blijven onderdeel van de controle. Voor migratie/publicatie wordt het herstelpunt gecontroleerd; ontbrekende back-upvoorzieningen worden expliciet gerapporteerd.
