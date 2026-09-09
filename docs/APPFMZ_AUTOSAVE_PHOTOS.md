# Automatisch opslaan en privé-fotoannotaties

Scope: Yourizorge/fitmetzorge, appfmz.nl, hgoygcviutmynaihcvpd. Uitgewerkt vanaf main 2f9c2c92e1fea1b1a4bf29a87ca5ebdcbf4e2c9a. Geen AGENTS.md in de projectmap of bovenliggende projectmap gevonden. Bestaande publicatie- en beveiligingsinstructies behouden. Staging en marketing blijven buiten scope.

## Gevonden oorzaken en herstel

- Dagelijkse voeding en stappen wijzigden niet consequent de geplande opslag; gewone veldwijzigingen worden nu synchroon aan het juiste klant-/weekobject gekoppeld en na 650 ms stilte opgeslagen. Selecties worden direct verwerkt. Geen volledige render op deze invoer- of opslagbevestigingen.
- `change`-handlers bouwden onder andere gewicht-, slaap- en trainingsvelden opnieuw op. De centrale invoerafhandeling voorkomt dit, houdt focus/cursor vast en bewaart tijdelijk onvolledige getallen als tekst. Er wordt niet naar nul geconverteerd. Een oudere bevestiging laat nieuwere wijzigingen als nog niet opgeslagen staan.
- Nieuwe voedingsopties kregen niet overal meteen een ID. Alle nieuwe opties hebben nu direct een vaste ID; een gerichte compatibiliteitsstap vult uitsluitend ontbrekende historische plan-ID’s aan. Voorcontrole productie: nul ontbrekende IDs, dus daar geen planinhoud gewijzigd.
- Na een verloren serverantwoord kon een correcte wijziging bij opnieuw proberen conflicteren. De bestaande gecontroleerde schrijfoperatie krijgt een idempotente wrapper met aanvraag-ID en serverreceipt. Dezelfde aanvraag geeft dezelfde bevestiging terug; gewijzigde payload met dezelfde ID wordt geweigerd. PT409 en atomair terugrollen blijven behouden.
- Schema’s aanmaken blijft een expliciete Toevoegen-actie en maakt een concept. Gepubliceerde workouts en voedingsopties worden pas via de publicatieknop zichtbaar. Gewone velden, trainingslogs, voedingshoeveelheden/status/notities en trackers slaan automatisch op. Snelle dubbele toevoeg-/verwijderacties worden afgevangen. Aanmaakformulieren houden hun onvolledige invoer per account/klant in tabbladgeheugen bij schermwissels.

## Foto’s en rechten

Bekijken en vervangen zijn afzonderlijke acties. De viewer toont de originele verhouding en browseroriëntatie, met zoomen en verschuiven. Tekenen, kleur, dikte, gum en undo/redo werken op een transparante vectorlaag. Het originele fotobestand wordt nooit overschilderd. Nieuwe privé-uploads behouden hun bytes; JPG, PNG, WebP en GIF tot 4 MB. Er worden geen foto’s naar externe beeld- of AI-diensten gestuurd en geen openbare fotolinks gemaakt.

De private annotatietabel bindt trainer, klant, week, dag, fotoslot en SHA-256 van de exacte bronfoto. Alleen de bevoegde trainer schrijft. Elke wijziging gebruikt versiecontrole en een aanvraag-ID. Concepten slaan automatisch op; Delen met lid kopieert de expliciete versie naar het gedeelde veld. Het lid leest uitsluitend die gedeelde laag. Een nieuwe bronfoto krijgt een nieuwe annotatie-identiteit. Het lid, andere klanten en niet-gekoppelde trainers kunnen niet schrijven; anderen kunnen ook niet lezen. Elke RPC controleert de actuele Auth-sessie. Tabellen blijven afgeschermd, met RLS en zonder directe gebruikersgrants.

Lokale onopgeslagen invoer en tekenconcepten blijven uitsluitend in het geheugen van hetzelfde tabblad en dezelfde accountcontext. Er is geen belofte van herstel na tabbladsluiting. Bij resterende invoer verschijnt een afsluitwaarschuwing; bij fouten blijft opnieuw proberen beschikbaar.

## Gerichte verificatie

Zes lokale tests slagen: bestaande browser/SQL/Edge/herhalingsregressies plus idempotentie-/annotatierechten en de volledige nieuwe gebruikersflows. De nieuwe browserflow controleert snel typen en focus, onvolledige numerieke invoer, weekwissel, oude bevestiging versus nieuwere invoer, verloren serverantwoord met dezelfde aanvraag-ID, workout aanmaken/bewerken/publiceren, voedingsopties en dagelijkse porties, herladen, trainerverversing, origineelbehoud, privéconcept versus gedeelde laag en mobiele tekenbediening. SQL-tests controleren andere klanten, niet-gekoppelde trainer, lid-write denial, bronfoto-/versieconflict en volledige terugdraaiing.

## Publicatie en herstel

Migration: `20260909164637_appfmz_autosave_annotations.sql`. Niet-destructieve toevoeging van private receipts/annotaties, RPC’s en uitsluitend ontbrekende plan-ID’s. De bestaande opslag- en conflict-migrations worden niet opnieuw uitgevoerd. Geen wijziging aan invite-client of de huidige privacygrenzen.

Verse versleutelde back-up buiten GitHub/OneDrive: 1.103.168 bytes; SHA-256 van de gecontroleerde inhoud `572dc87416dce8c4e2626c788c6c2d7cc28a5d98af4daf830d74d18441802070`. Zeven profielen, twee workspaces en negen uitnodigingen lokaal teruggezet en vergeleken. Ook de bestaande private functiedefinities zijn opgenomen. Volledig Auth-platformherstel is niet gerepeteerd.

Publicatie vindt onder tijdelijk onderhoud plaats, gevolgd door echte Auth/PostgREST-tests met eigen synthetische accounts. Na essentiële controles worden alleen die testaccounts en hun data verwijderd, live bestanden gecontroleerd en de app geopend. Bij fouten blijft onderhoud actief. De toevoegingen zijn compatibel met de voorgaande frontend: een terugval kan de vorige frontend herstellen zonder tabellen/rechten of klantdata terug te draaien. De oude onveilige toegangsrechten worden nooit hersteld.

## Telefoontest na vrijgave

Als lid: wijzig traininggewicht/notitie, voeding en een tracker; wacht op Opgeslagen, herlaad en log opnieuw in. Als trainer: ververs dezelfde klant/week, pas een schema aan en publiceer; controleer dat het lid de gepubliceerde versie ziet. Open een voortgangsfoto, teken en gum, sluit en heropen als trainer; deel daarna met het lid. Controleer dat het lid de gedeelde laag ziet en niet kan bewerken. Tik op Bekijken voor de viewer en afzonderlijk op Foto vervangen voor een nieuwe foto.

## Productieverificatie 9 september 2026

De migration is eenmaal transactioneel toegepast en geregistreerd als `20260909172334 / appfmz_autosave_annotations`; het beoordeelde bestand blijft `20260909164637_appfmz_autosave_annotations.sql`. Beide eerdere migrations zijn niet herhaald. `invite-client` is ongewijzigd; de bestaande JWT- en trainercontroles zijn opnieuw via de echte Edge-route gecontroleerd, zonder uitnodigingsmail.

De laatste featurecode is `607a846` en is onder onderhoud op productie getest. De echte Auth/PostgREST-browserflow slaagde in 32 seconden: debounce/focus, onvolledige invoer, datum-/weekbinding, oudere bevestiging, verloren antwoord met dezelfde aanvraag-ID, workout en maaltijd aanmaken/bewerken/publiceren, porties/notities, herladen en trainerverversing. De aanvullende flow controleert uitgevoerde sets/reps en expliciet Training afronden, terugvinden bij dezelfde klant/week/dag en verwijderen van de eigen testopties met behoud van de dagelijkse voedingsregistratie. Onvolledige aanmaakformulieren blijven concepten; alleen de expliciete publiceeractie maakt schema's zichtbaar voor het lid.

Afzonderlijke echte sessies bewezen herladen plus uitloggen/opnieuw inloggen, trainerinzage, accountwissel, geen toegang tot een andere klant en ingetrokken sessies. Een directe conflictbatch gaf één HTTP 409/PT409 in 115 ms en rolde volledig terug. De browser behield de conflicterende invoer, herhaalde niet automatisch en kon na expliciet verwerpen/verversen opnieuw opslaan. Een onderbroken netwerkantwoord gaf geen vals succes.

Foto's zijn getest met een synthetisch PNG-bestand: de exacte originele data-URL bleef gelijk. Trainerconcepten waren niet zichtbaar voor het lid; na Delen met lid was de gedeelde laag zichtbaar na herladen en via een nieuwe echte lid-sessie. De server weigerde schrijven door het lid, lezen door een andere klant of niet-gekoppelde trainer, een verkeerde bronfoto en een oude annotatieversie. Herhaling met dezelfde aanvraag-ID gaf dezelfde bevestiging. Het intrekken van de echte trainersessie tijdens tekenen sloot de viewer en verwijderde foto en workspace uit het scherm. Een schoon heropende viewer haalt de actuele gedeelde laag op; onopgeslagen trainerwerk blijft in de eigen tabbladcontext.

De viewer is met zoomen, verschuiven, tekenen, gum en undo/redo gecontroleerd op desktop en een mobiel venster van 390 pixels. De echte oefen-GIF veranderde van beeld en bleef compact: 112 pixels op desktop en 96 pixels mobiel. Een fysieke iPhone-/Androidtoetsenbordtest is niet uitgevoerd; daarvoor dient de korte telefoontest hierboven.

Na afloop zijn alleen de vier eigen synthetische accounts per testset verwijderd. Eindcontrole: nul synthetische Auth-accounts, nul testannotaties/receipts; de oorspronkelijke zeven profielen, twee workspaces en negen uitnodigingen zijn inhoudelijk gelijk aan de versleutelde back-up (tijdstempels op dezelfde tijdzone genormaliseerd). `tests/production-preservation.cjs` controleert dit zonder klantinhoud te loggen. Directe gebruikersgrants op de nieuwe private tabellen ontbreken. De security-advisor meldde alleen de bewuste RPC-only tabellen zonder RLS-policies en de reeds bestaande instelling voor gelekte-wachtwoordbescherming.

Na deze geslaagde controles wordt de normale rootapp teruggezet, de tijdelijke verificatie-ingang verwijderd en de release via de bestaande GitHub Pages-publicatie vrijgegeven. Het definitieve commit-ID en de live bestandsvergelijking staan in het opleverbericht. Er is geen betaald abonnement, compute-upgrade, staging- of marketingwijziging uitgevoerd.
