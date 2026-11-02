# APPFMZ communicatieontwerp — 26 oktober 2026

Status: lokale implementatie en synthetische verificatie. Dit document bewijst geen productie-uitrol, fysieke pushontvangst, SMTP-aflevering of mailboxsynchronisatie. Mail staat standaard uit. Er zijn geen klantmails of testpushes verstuurd.

## Hergebruik en beveiliging

De bestaande `agreement_versions` en factuurnummering blijven leidend. `planning_tick` maakt concepten; de communicatieplanning geeft geen factuurnummers uit en boekt geen omzet of ontvangst. Kalendermaandafspraken blijven kalendermaandafspraken. Bestaande VAPID-sleutels, private pushabonnementen en actieve sessies worden hergebruikt. Factuurmeldingen krijgen eigen owner-autorisatie; ze worden niet als klantafspraak vermomd.

Migration `20261026154918_appfmz_communication.sql` voegt een private outbox toe met RLS, owner-RPC's, unieke documentverzending, request-idempotentie, versiecontrole, goedkeuringshash, ontvangercontrole, audit en afgescheiden workerrechten. Een gewijzigde profielmail vereist nieuwe controle. Een mislukte e-mail verwijdert nooit de factuur of overeenkomst.

Een e-mailconcept kan vóór definitieve factuuruitgifte worden bewerkt. Definitief maken gebruikt expliciet de bestaande factuurroute en private PDF-opslag. Pas daarna wordt de definitieve mail bij de onveranderlijke documenthash gekoppeld. Voorlopige concepten kunnen niet worden verstuurd. Een dubbele klik of verloren antwoord hergebruikt hetzelfde verzoek; een nieuwe mailactie maakt geen nieuwe factuur.

## TransIP en onzekerheid

Transport: `smtp.transip.email:465` en `imap.transip.email:993`, met verplichte TLS-certificaatcontrole. Afzender en secret uitsluitend server-side. De goedgekeurde afzender moet overeenkomen met de workerconfiguratie. De server controleert PDF-magic, lengte en SHA-256 vóór verzending. SMTP-acceptatie wordt eerst duurzaam vastgelegd. IMAP zoekt de bestaande `\Sent`-map en hetzelfde Message-ID voordat de identieke MIME-inhoud wordt toegevoegd. Afzender, Message-ID, definitieve tekst, bijlagehash, SMTP-antwoord en MIME-hash blijven geregistreerd.

SMTP biedt geen precies-eenmaalgarantie. Een verbroken verbinding na DATA of een verlopen verzendlease zonder duurzaam geaccepteerd resultaat wordt `delivery_unknown`; geen automatische herverzending. Een ontbrekende kopie in Verzonden bewijst niet dat SMTP niets heeft afgeleverd. Een IMAP-fout na bevestigde SMTP-acceptatie herhaalt uitsluitend de archivering. Een later veranderd profieladres, gepauzeerde planning of factuurcorrectie verhindert die oorspronkelijke mailboxkopie niet; lease, goedkeuringshash, dezelfde mailboxafzender, PDF-hash en MIME-hash blijven vereist. De bestaande Outlook/TransIP-inrichting wordt niet gewijzigd.

Automatische factuurmail staat per lid standaard op handmatige goedkeuring. Alleen een expliciet goedgekeurde automatische regel kan een foutloos voorbereide, reeds definitieve factuur met bevestigde PDF plannen. Ondertekende overeenkomsten worden via een interne trigger pas na succesvolle finalisatie met gecontroleerde PDF klaargezet. De globale mailconfiguratie én `APPFMZ_MAIL_ENABLED` blijven uit tot de echte mailbox veilig gekoppeld en getest is.

## Meldingen

De nieuwe Cron-taak `appfmz-communication` krijgt een private releasepoort: `fmz_communication.config.scheduler_enabled` is standaard `false`. `dispatch()` stopt vóór `reminder_tick`, `planning_tick`, conceptaanmaak, meldingen en HTTP-verzoeken zolang die poort dicht is. Ook een rechtstreeks aangeroepen push-worker voert dan geen automatische planning uit. De bestaande agenda-Cron en agenda-functies worden niet gewijzigd. Expliciete ownerhandelingen en afgebakende synthetische canary-opdrachten blijven afzonderlijk testbaar.

Na gecontroleerde activering verwerkt alleen de nieuwe planning iedere minuut de toekomstige taken. De zeven-dagenmelding en dagmelding zijn duurzaam uniek per taak/soort. Datums gebruiken Europe/Amsterdam; zomer-/wintertijd veranderen de kalenderdatum niet. De owner moet afzonderlijk push inschakelen. Zonder push blijft het in-appoverzicht beschikbaar. Intrekking wordt vóór verzending opnieuw gecontroleerd. Push bevat geen naam, bedrag of mailadres, alleen de factuurperiode en willekeurige taak-ID.

## Nog te bewijzen vóór volledige productie-PASS

- Expliciet aangewezen eigen testadres en toegang tot de bevestigde mailbox; mailboxsecret door eigenaar rechtstreeks in Supabase Edge Function Secrets. Nooit in chat, Git of rapport; geen reset.
- Actuele TLS-connectie vanuit productie-Edge, mailboxauthenticatie en Sent-mapdetectie.
- Werkelijke SMTP-acceptatie, bijlagehash, Sent-kopie in TransIP én Outlook; eventuele providerlimieten.
- DNS-authenticatie via de werkelijke testmail. De read-only DNS-controle toont TransIP-DKIM, maar SPF bevat geen expliciete TransIP-include. Geen DNS gewijzigd en geen SPF-PASS geclaimd.
- Eén bewust ingeschakelde testpush op de geïnstalleerde iPhone. Browseremulatie geldt niet als fysieke ontvangst.

## Veilige ingebruikname door eigenaar en beheerder

De read-only productie-inventarisatie vond op 26 oktober geen nieuwe `APPFMZ_MAIL_*`-secrets. De bestaande agenda/VAPID-configuratie is niet gewijzigd. Bevestigd afzenderadres: `info@fitmetzorge.com`; een expliciet aangewezen eigen testadres blijft nodig.

De eigenaar voert het bestaande mailboxwachtwoord rechtstreeks in bij Supabase Dashboard → het APPFMZ-project → Edge Functions → Secrets, als `APPFMZ_MAILBOX_PASSWORD`. De geheime waarde wordt niet via chat, bestanden, Git of rapporten doorgegeven. Niet resetten: Outlook en TransIP blijven hun bestaande mailbox gebruiken. `APPFMZ_MAILBOX_ADDRESS` bevat het volledige bevestigde mailboxadres. TransIP documenteert hiervoor gewone mailboxauthenticatie; een beperkter appwachtwoord is niet bewezen.

De beheerder genereert een afzonderlijk worker-token en plaatst dezelfde geheime waarde veilig in Edge-secret `APPFMZ_MAIL_WORKER_TOKEN` en Vault-secret `appfmz_mail_worker_token`. Deze worker gebruikt gecontroleerde bearer-authenticatie en moet met platform-JWT-controle uit worden uitgerold, zoals de bestaande agenda-worker; de functie weigert zonder exact worker-token. Dit wijzigt geen JWT-instelling van `invite-client` of andere functies. `APPFMZ_MAIL_ENABLED` blijft `false` en de private databaseconfiguratie blijft `enabled=false` tot de gecontroleerde eigen-mailtest. Beide schakelaars moeten later bewust aan; alleen een secret aanmaken activeert geen verzending. De server-afzender, database-afzender en goedgekeurde berichtafzender moeten overeenkomen.

`APPFMZ_MAIL_SENT_FOLDER` is alleen nodig wanneer de server de bestaande map Verzonden niet met `\Sent` aanwijst. Eerst read-only mappen opvragen en de bestaande mapnaam kiezen; geen map hernoemen of aanmaken. De SMTP-adapter opent TLS 465 en de IMAP-adapter TLS 993 met de standaard certificaatcontrole van `Deno.connectTls`. Er is geen ongecodeerde fallback of gebruik van geblokkeerde poorten 25/587. De code en synthetische protocoltests bewijzen nog geen netwerkbereikbaarheid of authenticatie vanuit productie-Edge.

Controleer daarna uitsluitend met het aangewezen eigen testadres: SMTP-acceptatie, exacte PDF-bijlage, Message-ID, mailboxkopie en daadwerkelijke weergave in TransIP én Outlook. Lees de werkelijke Authentication-Results voor SPF/DKIM/DMARC. De bestaande DNS-instellingen worden niet ongericht vervangen. Schakel automatisch verzenden per lid pas in na de expliciete eigenaarinstelling; de standaard blijft handmatig.

### Nieuwe scheduler pas ná de releasecanary activeren

Laat `scheduler_enabled=false` tijdens migration, onderhoud en alle toelatingscontroles. Activeer uitsluitend nadat de geldende voorwaarden/privacy en eigenaarstoestemmingen zijn bevestigd, de synthetische productiecanary van de volledige keten is geslaagd, testgegevens gecontroleerd zijn opgeruimd en de nulmeting aantoont dat echte gegevens behouden zijn. Controleer vóór activering ook de bestaande overeenkomsten en aankomende perioden: activering mag vanaf dat moment echte concepten en in-apptaken voorbereiden. Mail en persoonlijke push hebben nog hun eigen afzonderlijke poorten.

De bevoegde beheerder controleert uitsluitend in het APPFMZ-productieproject de huidige waarde en voert daarna als bewuste laatste releasestap deze transactionele, niet-destructieve configuratiewijziging uit. Dit is documentatie, niet uitgevoerd:

```sql
begin;
select scheduler_enabled, enabled from fmz_communication.config where id=true for update;
update fmz_communication.config set scheduler_enabled=true where id=true and scheduler_enabled=false;
select scheduler_enabled, enabled from fmz_communication.config where id=true;
commit;
```

Leg de bevestigde waarde en het tijdstip vast in het releaserapport. Controleer daarna `cron.job` en de eerste taakuitkomst uitsluitend voor `jobname='appfmz-communication'`. Wijzig, herstart of vervang geen agenda-Cron. De veilige stoproute is `update fmz_communication.config set scheduler_enabled=false where id=true;`: deze stopt nieuwe automatische planningsrondes en dispatches, verwijdert niets en schakelt de bestaande agenda niet uit. Intrekken van individuele push- of mailtoestemming blijft een afzonderlijke handeling.

## Lokale controle

Dertien gerichte database- en transportproeven slagen: privacy, versieconflict, idempotentie, voorlopige e-mail vóór factuurnummer, goedkeurings- en ontvangerwijziging, gepauzeerde automatische planning, tijdzones, SMTP-onzekerheid, IMAP-herstel en een verloren databasebevestiging ná SMTP-acceptatie. De schedulerpoort is apart bewezen: uit betekent geen automatische taken, concepten, meldingen of HTTP; bewuste activering maakt idempotent alleen de verwachte concepten en taken, zonder definitieve nummers of boekingen. Bestaande agenda-functiedefinities blijven inhoudelijk gelijk. De SMTP/IMAP-protocolproef gebruikt uitsluitend lokale nepverbindingen, geen mailprovider.

De echte APPFMZ-schermen zijn daarnaast in Edge en WebKit getest met synthetische gegevens: verloren opslagantwoord en dezelfde aanvraag opnieuw opvragen, dubbel klikken op definitief maken, één factuur/PDF, herladen en opnieuw aanmelden, sluitwaarschuwing, 320/390/768/844/1440 pixels en vergrote tekst. Screenshots staan lokaal in `tests/artifacts/communications`. Dit zijn browserproeven, geen fysieke telefoon- of mailboxproeven. Twee aanvullende request-raceproeven bewijzen dat een oud succes- of foutantwoord na sluiten van een venster nooit de retry-identiteit van een nieuw venster wist. Totaal: zestien gerichte proeven. De MIME-datum wordt bij de eerste transportpoging vastgelegd en blijft bij archivering en herstel stabiel.

## Reproduceerbare cursusopname

`tests/record-planning-course.cjs` doorloopt de echte lokale app met een nieuwe geïsoleerde oefendatabase en één vaste fictieve onderneming. `tutorial/planning-spoken-script.json` bevat twaalf hoofdstukken en 24 Nederlandstalige scènes, 1.192 woorden. De opname gebruikt de echte planning, e-mailconcepten, definitieve oefenfactuur, private PDF en een volledig via de interface ondertekende fictieve overeenkomst. Transport blijft uit; er worden geen mailboxbeelden nagebouwd. De tekst beschrijft de ontbrekende fysieke telefoon- en mailboxcontroles uitdrukkelijk.

De gecontroleerde take `tests/artifacts/planning-20261026/take-1793034775639/capture.json` bevat 24 scènes en 265 echte schermframes, nul browserfouten, nul externe requests en identieke runtimehashes bij begin/einde. De bewijsregels tonen één synthetische overeenkomst en nul geaccepteerde mails. De factuur-PDF gebruikt een oefennummer en ongeldig-watermerk. Bij latere runtimewijzigingen moet deze recorder opnieuw draaien voor een opname van de uiteindelijke release. Dit is beeld- en scriptbewijs; hoorbare audio, montage, ondertitels en publicatie moeten afzonderlijk worden gecontroleerd.

## Primaire bronnen

- [TransIP SMTP/IMAP-instellingen](https://www.transip.nl/knowledgebase/309-algemene-instellingen-voor-mijn-e-mailadres): TLS 465/993; normale mailboxauthenticatie. Scoped appwachtwoorden/OAuth zijn niet aangetoond.
- [TransIP verzendlimiet](https://transip.nl/knowledgebase/464-geen-e-mail-meer-versturen-ontvangen): standaard 200 ontvangers per dag. APPFMZ begrenst eigen pogingen conservatief; Outlook/webmail delen de providerquota.
- [Supabase Edge-beperkingen](https://supabase.com/docs/guides/functions/limits): uitgaand 25/587 geblokkeerd; 465 vereist echte connectiviteitscontrole.
- [Supabase secrets](https://supabase.com/docs/guides/functions/secrets) en [serverplanning](https://supabase.com/docs/guides/functions/schedule-functions).
- [RFC 5321](https://www.rfc-editor.org/info/rfc5321/): SMTP-time-outs kunnen dubbele verzending veroorzaken.
- [RFC 6154](https://www.rfc-editor.org/info/rfc6154/): bestaande IMAP Sent-map identificeren.
- [WebKit iPhone-PWA-push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/): geïnstalleerde webapp en bewuste toestemming vereist.

## Read-only privacy-inventaris van de werkelijke inrichting

Deze inventaris is op 26 oktober 2026 alleen gelezen. Zij verandert geen privacybeleid, bewaartermijn, providercontract, database of instelling. Technische waarnemingen zijn geen juridische conformiteitsverklaring.

### Aangetoonde feiten

- Het APPFMZ-productieproject rapporteert `eu-west-1` (Ierland), `ACTIVE_HEALTHY` en PostgreSQL 17.6.1.127. Supabase beschrijft database, Auth, Storage-objecten en projectback-ups als regiogebonden. Dit bewijst geen uitsluitend Europese verwerking: account-, support-, telemetrie- en CDN-verwerking kunnen anders verlopen. Zie [projectregio's](https://supabase.com/docs/guides/platform/regions) en de [actuele data-residency-uitleg](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq).
- De publieke APPFMZ-HEAD-respons is HTTP 200 met `Server: GitHub.com`, een GitHub-request-ID en `Cache-Control: max-age=600`. Samen met de bestaande Pages-releasehistorie en `CNAME` bevestigt dit GitHub Pages als frontendhosting. De [GitHub-privacyverklaring](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) beschrijft onder meer technische gebruiksgegevens en internationale verwerking; de specifieke accountovereenkomst is niet ingezien.
- `index.html` laadt Supabase JS 2.116.0 vanaf jsDelivr. `app.js` verwijst daarnaast naar oefenmedia van fitnessprogramer.com. Daardoor bestaan externe browserverzoeken naast Supabase en TransIP; het is onjuist uitsluitend die twee verwerkers te noemen. Het actuele jsDelivr-beleid is [hier gepubliceerd](https://www.jsdelivr.com/terms/privacy-policy), maar de beleidsinhoud kon in deze controle niet volledig worden uitgelezen. Over media-aanbieder en CDN zijn geen contract- of bewaartermijnclaims gedaan.
- Bestaande sessieopslag gebruikt localStorage bij onthouden, anders sessionStorage. De nieuwe communicatieconcepten worden server-side bewaard; niet-bevestigde tekst blijft tijdelijk in geheugen. De huidige productie-UI-snapshot schrijft geen klantenlijst, maar een bestaande migratieroute kan oude lokale conceptgegevens voor herstel in geheugen lezen. Daarom wordt niet beweerd dat historisch nooit persoonsgegevens lokaal voorkwamen.
- De serviceworker voegt geen algemene cache voor privé-API-antwoorden toe. De nieuwe pushontvangstregistratie bewaart alleen willekeurige delivery-ID's met vervaltijd in IndexedDB. Opruiming gebeurt bij nieuwe ontvangst; een vervaltijd is geen bewijs van directe fysieke verwijdering op dat moment.
- Overeenkomstbestanden gebruiken de private bucket `fmz-members`; de interface vraagt een tijdelijke downloadlink van 60 seconden. Er is geen publieke document-URL. De nieuwe Edge-broncode bevat geen eigen logging van mailinhoud of credentials. Dat sluit automatische platformlogs niet uit; zie [Supabase platformlogs](https://supabase.com/docs/guides/platform/manage-your-usage/logs).
- Het controlepunt van 26 oktober is lokaal met Windows DPAPI beschermd, buiten Git en OneDrive. Het openbare bewijsbestand `docs/examples/members-20261026/baseline.json` bevat de gesaneerde nulmeting en herstelverificatie van twintig bestaande app-tabellen en vijf private bestanden. Er is geen automatische vervaldatum of geografisch gescheiden back-updienst bewezen. [Supabase-back-ups](https://supabase.com/docs/guides/platform/backups) omvatten niet de bytes van Storage-objecten; een databaseback-up alleen bewijst dus geen volledig documentherstel.
- Bestaande financiële documenten hebben bewaarklasse-/datumvelden. Deze velden bewijzen geen automatische verwijdering. Ongebruikte inschrijfconceptbestanden hebben een begrensde, herhaalbare opruimroute; definitieve overeenkomsten niet. Voor algemene contracten, mailtekst, audit, coachingdata en platformlogs is geen nieuwe automatische bewaartermijn ingevoerd. Eventuele voorgestelde termijnen in het privacyconcept zijn nog beleidskeuzes, geen bestaande implementatie.

### Niet aangetoond en niet aangenomen

Het actuele Supabase-abonnement, daadwerkelijke providerback-ups en hun retentie, platformlogretentie/logdrains, contractacceptatie, supporttoegang, mailboxopslagland en -retentie, Outlook-lokale opslag, werkelijke Sent-mapverwerking en de uiteindelijke bewaartermijn van het lokale herstelpunt zijn niet vastgesteld. De productie-inventaris vond nog geen nieuwe mailboxcredentials; SMTP/IMAP en fysieke mailboxsynchronisatie blijven afzonderlijke toelatingscontroles.

De [actuele Supabase-DPA](https://supabase.com/legal/customer-resources/data-processing-addendum) beschrijft haar relatie met de dienstverleningsovereenkomst; een los oud ondertekend document is niet zonder meer de juiste acceptatietoets. Het voor dit account geldende bewijs blijft te controleren. TransIP beschrijft het bekijken/aanvaarden van de verwerkersovereenkomst via [Mijn Account](https://www.transip.nl/knowledgebase/946-verwerkersovereenkomsten-bij-transip). De [TransIP-privacyverklaring](https://www.transip.nl/legal-and-security/privacy-policy/) geeft algemene verwerking van technische gegevens, maar bewijst geen accountspecifieke mailboxretentie. Geen van deze ontbrekende bewijsstukken is door een aanname vervangen.

## Volledigheidsreview punten 18–28 — 26 oktober, vóór publicatie

Dit is een broncodereview, geen nieuwe productie-PASS. Openstaande codepunten worden onderscheiden van configuratie en fysieke eigenaarstests. Het algemene releaseoverzicht blijft leidend bij latere correcties.

| Punt | Lokaal aanwezig | Nog geen volledige bewijsclaim |
| --- | --- | --- |
| 18 Planning en telefoon | Afzonderlijke maand-/vierweekse perioden, handmatige datums, pauze/einde, serverplanning met releasepoort, unieke zeven-dagen-/dagtaken, owner-only push en in-appalternatief. Intrekking en actieve sessie worden bij claim én vlak vóór transport gecontroleerd. | Productie-Cron blijft uit tot toelating; echte iPhone-PWA-push, tikroute en intrekken op toestel nog niet fysiek bewezen. Een al onderweg zijnde push kan niet achteraf uit het providernetwerk worden teruggehaald. |
| 19 Concepten | Bestaande versiegebonden afspraken, één periodieke bronidentiteit, concept zonder factuurnummer/boekingen, expliciete definitieve uitgifte, bestaande betalingen blijven aan hun factuur. Herberekening heeft voor/na, reden, actor en totaal. | Kortings-/eersteperiode-uitbreiding wordt afzonderlijk door de leden-/planningagent getest. Een betaling van een vorige periode is geen korting op een nieuwe periode. Gewone bestaande conceptbewerking kent niet voor ieder veld een verplichte reden. |
| 20 E-mailconcept | Bewerkbaar vóór definitieve uitgifte; bewaren, voorbeeld, eigen testadres, expliciet factuur/PDF vastleggen, goedkeuren, nu/plannen/annuleren, handmatig als standaard. | Een voorlopig e-mailconcept ontstaat bij openen; de scheduler maakt automatisch mail bij een definitieve factuur met PDF. Volledige automatische uitgifte van een nieuw factuurconcept is niet gebouwd. De standaardmail toont inmiddels expliciete periode, betaaltermijn en betaal-/contactgegevens uit het definitieve factuurdocument. Een ontbrekend rekeningnummer wordt niet verzonnen. |
| 21 Mailbox | Lokale TLS465/993-adapters, vaste afzender, serversecrets, begrensd verzenden en identieke IMAP-Sent-kopie; bestaande mailbox blijft bestaan. | Credentials, echt aangewezen testadres, TLS/authenticatie vanuit productie, SPF/DKIM/DMARC-berichtbewijs en zichtbaarheid in Outlook/TransIP ontbreken. DNS is niet gewijzigd. |
| 22 Bewijs en fouten | Definitieve tekst, ontvanger, afzender, documenthash, SMTP-respons, MIME-hash, actor/goedkeuring en pogingen; onzekere SMTP-uitkomst wordt vastgezet. Geaccepteerde mail herhaalt bij IMAP-fout alleen archivering. | De UI toont nog geen volledige auditdetailviewer. De bij review gevonden onzekere-uitkomst- en pogingbudgetgaten zijn inmiddels met de hieronder beschreven ownerroute hersteld en getest. |
| 23 Documenten | Definitieve overeenkomst in trainer- en ledenprofiel, versies en status, private toegang, tijdelijke download en onveranderlijke PDF. | Fysieke account-/toestelcontrole en productiecanary blijven onderdeel van de nog niet uitgevoerde release. Bewaarbeleid is niet door dit onderdeel vastgesteld. |
| 24 Overeenkomstmail | Interne trigger na definitieve inschrijving en gecontroleerde PDF; unieke outbox, eigen documentstatus, mailfout maakt inschrijving niet ongedaan. | Mail blijft globaal uit. De standaardtekst gebruikt inmiddels de vastgelegde bedrijfscontactgegevens (met geverifieerde mailconfiguratie als e-mailfallback) en de ondertekende betaal-/kortingssnapshot. Onzekere uitkomsten vereisen de bewijsroute van punt 22; ze worden nooit blind herhaald. |
| 25 Eigenaarsplanning | Statussen, lid/pakket/periode/cyclus/mail-/betaalfilters, selectiecontrole, waarschuwing en afzonderlijke actie per factuur. | De bulkroute is een selectie met individuele acties. Er is nog geen volledige batchfinalisatie, batchgoedkeuring en batchverzending met gezamenlijk resultatenoverzicht zoals letterlijk gevraagd. |
| 26 Aanvullende tests | Geïsoleerde echte SQL- en Edge/WebKit-UI-proeven, versieconflict, verloren antwoord, SMTP-onzekerheid, IMAP-herstel, tijdzones, intrekking/rolgrenzen, één factuur en private PDF. | Synthetische adapters bewijzen geen provideraflevering, fysieke mailbox, iPhone-ontvangst of productieherstart. Nieuwe functionaliteit vereist nieuwe volledige regressie en canary vóór publicatie. |
| 27 Uitleg/video | Twaalf hoofdstukken en 24 echte lokale schermscènes met alleen fictieve gegevens; duidelijke uitleg van ontbrekende mailbox-/telefooncontrole. | Beeldmontage, hoorbare audio, ondertitels, uiteindelijke runtime-overeenkomst en publicatie worden door het hoofdtask afzonderlijk bewezen. Opnames vóór nieuwe runtimecorrecties zijn niet automatisch definitief. |
| 28 Eindrapport | Dit ontwerp scheidt techniek, configuratie en fysieke tests; automatische verzending blijft uit en bestaande afspraken worden niet geconverteerd. | Geen live- of fysieke PASS rapporteren zolang bovenstaande toelatingspunten en functionele gaten nog openstaan. |

Bij deze review zijn twee concrete fouten gevonden en gericht hersteld: het voorbeeld van een reeds verzonden mail gebruikt nu de opgeslagen tekst ondanks uitgeschakelde invoervelden; automatische voorbereiding weigert nu ook een gewijzigd profieladres dat al vóór goedkeuring afwijkt van de onveranderlijke factuurontvanger. Die tweede situatie blijft als concept met een waarschuwing staan totdat de eigenaar opnieuw handmatig controleert. De bestaande na-goedkeuringcontrole blijft daarnaast gelden. De bijbehorende SQL- en echte Edge/WebKit-regressies zijn geslaagd.


### Aanvullend gecontroleerd herstel van een verzenduitkomst

`delivery_unknown` heeft nu een owner-only herstelvenster. Het vraagt exact Message-ID, expliciete bewijsbron, referentie, inhoudelijke toelichting, reden en bevestiging. Alleen een providerlog/supportbevestiging of het oorspronkelijke ontvangen bericht met headers kan acceptatie onderbouwen. Bewezen niet-acceptatie vereist providerbewijs; ontbreken in Verzonden of niet-zien door een ontvanger is uitdrukkelijk onvoldoende. Deze route registreert een owner-verificatie en verzint geen SMTP-250-antwoord.

Geaccepteerd betekent uitsluitend de oorspronkelijke mailboxkopie herstellen; de SMTP-adapter wordt niet aangeroepen. Aantoonbaar niet verstuurd brengt de mail terug naar concept met verplichte nieuwe handmatige controle. `manual_review_required` voorkomt dat een bestaande automatische klantinstelling dit omzeilt. Een aparte, gemotiveerde owneractie kan één tot drie extra pogingen toestaan, zonder de pogingteller te wissen of de dagelijkse limiet te verhogen. Ook dat geeft bij een nog niet verstuurde mail geen nieuwe verzendgoedkeuring. Versieconflicten en request-idempotentie gelden op beide herstelacties.

Bewijs: de gerichte SQL-proef controleert ontbrekend/verkeerd bewijs, onbevoegde gebruiker, exact Message-ID, verloren antwoord, audit, nul SMTP na bewezen acceptatie, fresh approval na niet-acceptatie, automatisch-rule-blokkade en dagquota. Alle twaalf SQL-/transportproeven en twee raceproeven slagen. De echte Edge/WebKit-interfaceproef slaagt met het opgeslagen read-only voorbeeld en beide herstelvensters; bewijsbestanden staan onder `tests/artifacts/communications`. De eerste browserpoging kon Edge niet binnen de Windows-sandbox starten; de expliciet toegestane lokale proef buiten die sandbox slaagde. Externe requests bleven geblokkeerd. Dit betreft geen echte provider-, mailbox- of telefoontest.


### Afgeronde templatecorrectie — 2 november 2026

De factuurmail noemt de expliciete vastgelegde periode; zonder periode vermeldt zij de prestatiedatum in plaats van een periode te verzinnen. Betaaltermijn, rekeninghouder, rekeningnummer en contactgegevens komen uit de definitieve factuursnapshot. Creditfacturen vragen geen nieuwe betaling. Voorlopige placeholders worden bij definitief maken ingevuld uit precies dat document; bewaarde handmatige tekst blijft behouden.

De overeenkomstmail gebruikt `snapshot.payment`: basisbedrag, korting met reden en aantal perioden, afwijkende eerste periode en bruto/netto eerste betaling, volgende periode en het dan toepasselijke bedrag. Een aflopende korting wordt niet verlengd. Bij oude overeenkomsten zonder payment-snapshot blijft de bestaande pakket-/maandprijs de bron. Contactgegevens komen uit de ondertekende company-snapshot; alleen een ontbrekend e-mailadres kan op de geverifieerde afzenderconfiguratie terugvallen.

Gerichte controle: `node --test --test-name-pattern="mail templates|preliminary email" tests/communications.test.cjs` — 2/2 PASS, 11,2 seconden, bewijs `tests/artifacts/communications-templates-latest.txt`. Gecontroleerd: exacte centen, geen oude pakketprijs, geen weggelaten korting, juiste kortingseinde, historische kalendermaand, geen verzonnen IBAN, correcte voorlopige promotie, onveranderlijke bron na gewijzigde bedrijfssettings/profiel. De eerder geslaagde brede suites zijn hiervoor niet opnieuw uitgevoerd. Geen productie, verzending of nieuwe opname. Communicatie-runtime is na deze correctie bevroren; root voert de integratie en uiteindelijke releasecontrole uit.
