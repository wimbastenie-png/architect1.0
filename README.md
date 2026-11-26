# Scan-app

App die een ruimte scant met de gsm en er een bemaat plan, meetstaat en
exportbestanden (PDF/DXF/IFC) van maakt. Zie het plan in het document
"Scan-app: analyse en MVP-plan".

## Webapp (pc en gsm)

`packages/web` — werkt in elke browser, op pc en gsm, zonder installatie:

- Nieuw project uit binnenmaten (rolmeter of laser), of het voorbeeld openen.
- Muur aanklikken: binnenmaat aanpassen (haakse muren schuiven mee), meetmethode aanduiden, dragend of niet, ramen/deuren/doorgangen toevoegen.
- **Ruimte hiernaast toevoegen**: klik een buitenmuur, geef binnenbreedte, diepte en startpunt (vanaf hoek A). De muur wordt tussenmuur; is de nieuwe ruimte smaller, dan wordt de muur gesplitst en verhuizen ramen/deuren mee. Zo bouw je een verdieping kamer per kamer op.
- Ruimte aanklikken: naam en plafondhoogte.
- **Verdiepingen**: tabbladen per verdieping met peil; "+ Verdieping" als kopie van de indeling (muren en ruimtes, grijs = overgenomen tot nagemeten) of als nieuwe rechthoek; hernoemen, peil aanpassen, verwijderen.
- **Bewerken**: ramen/deuren wijzigen en verplaatsen, ook naar een andere muur (keuzelijst met leesbare muurnamen); **slepen** in het plan: een muur haaks verschuiven of een raam/deur naar een andere plaats of muur (stappen van 10 mm, live voorbeeld; op de gsm: ingedrukt houden tot de gsm trilt, dan slepen — gewoon vegen scrolt); **inzoomen** tot ×20 met knoppen (+, −, Passend), knijpen met twee vingers of Ctrl + muiswiel; ingezoomd verschuif je het beeld met één vinger (zoals een kaart) of met de muis op een lege plek; tussenmuur uitbreken (twee ruimtes van elke haakse vorm → één, bv. L-vorm, met waarschuwing over stabiliteit); muur verschuiven (positie corrigeren); **hoek verplaatsen** (hoek A/B slepen of dx/dy ingeven) om schuine muren te maken, met verstekhoeken en maatkettingen evenwijdig aan schuine gevels; ruimte verwijderen; muurstukken die recht doorlopen worden automatisch terug één muur; sparing in de vloer (trapgat, vide, schacht) toevoegen, verplaatsen, vergroten, afgetrokken van die vloer en van het plafond eronder; notities per ruimte en per project (op het lijstenblad van de PDF).
- **Installaties** (knop *Installaties* boven het plan): elektriciteit, sanitair en gas. Kies een symbool boven het plan en tik op het plan; tik een symbool aan om hoogte, vaste kring of opmerking te wijzigen, te verplaatsen of te verwijderen. De app stelt voor: kringen met differentieel (300/30 mA), automaat en kabeldoorsnede, een vereenvoudigd **eendraadschema**, leidingen voor koud en warm water, afvoer (diameter, helling 2 %, verval) en gas (geel, met afsluitkraan), een **materiaallijst** en **aandachtspunten** (bv. max. 8 stopcontacten per kring, stopcontact dicht bij douche of bad, lichtpunt zonder schakelaar, lange afvoer). Export **Installaties (PDF)**: planbladen per net, eendraadschema, kringen, leidingen, materiaal en aandachtspunten. De app vervangt de installateur en de keuring niet en geeft nooit een oordeel "conform". Bij gas staat de verplichte waarschuwing in de app en op elk PDF-blad (ook op het gewone plan).
- **Ontwerp** (knop *Ontwerp* boven het plan): verbouwing tekenen met de gangbare kleuren: bestaand zwart, **afbreken geel**, **nieuw rood**. Muur aantikken → bestaand of afbreken; ramen/deuren → bestaand, nieuwe opening of dichtmaken; **nieuwe muur** met twee tikken (sluit aan op het muurvlak, wordt haaks als hij bijna recht is). Weergave verbouwing, bestaand of nieuw. **Doorsneden** langs een snijlijn (over alle verdiepingen) en **gevelaanzichten** (vier zijden). Waarschuwingen bij afbraak of nieuwe openingen in (mogelijk) dragende muren: ingenieur en, meestal, vergunning met architect. Export **Ontwerp (PDF)**: per verdieping plan verbouwing en plan nieuwe toestand, doorsneden en gevels op schaal, aandachtspunten.
- **Liggers** (knop *Liggers*): **voordimensionering** van een stalen ligger boven een opening (IPE, HEA, HEB; S235/S355; 1 tot 3 profielen naast elkaar). Tik een raam, deur of muur aan en maak een ligger: dagmaat en muurdikte worden overgenomen. Lasten met hulp (muur erboven, vloer met gebruikslast, dak met sneeuw). Controles volgens EN 1990/EN 1993-1-1 met Belgische ANB-waarden: buiging (klasse 1-3), dwarskracht, kip (als de bovenflens niet gesteund is), doorbuiging (L/500), drukspanning op de oplegging, oplegreacties voor de fundering. **Rekennota (PDF)** met alle aannames, formules en een vak voor de aftekening door de ingenieur. **Niet voor uitvoering** zonder controle en aftekening door een ingenieur.
- **Inrichting** (knop *Inrichting*): meubels uit een catalogus (slapen, wonen, eten, keuken, badkamer, werken, berging) op het plan tikken, draaien, verplaatsen, maat en kleur aanpassen; vloer- en wandmateriaal per ruimte. Opmerkingen als een meubel in een muur steekt, buiten de ruimtes staat of minder dan 90 cm vrijlaat voor een deur. **3D bekijken**: muren met ramen en deuren, vloeren en wanden in hun materiaal, meubels, schaduwen; draaien en zoomen, vogelvlucht of binnenzicht, bestaande of nieuwe toestand, één of alle verdiepingen. **Beeld bewaren (PNG)** en **3D-bestand (GLB)** om in Blender, Twinmotion of Enscape fotorealistisch te renderen.
- **Energie (EPC/EPB-inventaris)** (knop *Energie*): noordpijl op het plan; per muur, vloer en dak de samenstelling in lagen met U-waarde (vereenvoudigd volgens NBN EN ISO 6946) of een ingegeven U-waarde met bron; per raam glas (Ug), schrijnwerk (Uf), zonwering; beschermd volume per ruimte; grenzen aan buiten, grond, onverwarmd of buren; **bewijsfoto's** met de camera van de gsm. Export: invoerlijst per richting in **Excel** en **PDF**, als voorbereiding op de officiële software. **Geen EPC-score, geen oordeel "conform"**: de energiedeskundige controleert en rekent.
- **Ventilatie** (vierde net bij *Installaties*): systeem A, B, C of D; functie per ruimte (afgeleid uit de naam, aan te passen); debieten volgens richtwaarden uit NBN D 50-001 (droge ruimtes toevoer, natte ruimtes afvoer); doorstroomopeningen; unit, ventielen en roosters op het plan; kanalen van de unit naar elk ventiel met diameter (luchtsnelheid ≤ 2,5 m/s); materiaallijst, aandachtspunten, lastenboekposten en ventilatieblad in de installatie-PDF. Na te kijken door de ventilatie-expert.
- **Keuken en maatwerk** (knop *Keuken*): wand kiezen in het plan; **precisiemeting** (lengte op 3 hoogtes, hoeken uit haaks, vloer, lood, meetbron); **wandaanzicht** met ramen, deuren, installatiepunten en extra aansluitingen (radiator, water, afvoer, gas, stopcontact); **keukenplanner** met onder-, boven- en hoge kasten in modules (30–90 cm), toestellen, passtukken, werkblad met naden en uitsparingen; **wand vullen** als voorstel; controle tegen ramen, radiatoren en aansluitingen; export **wandaanzichten (PDF op schaal)**, **kasten- en snijlijst (Excel)** en **DXF**.
- **Liggers uitgebreid**: puntlasten; **lasten uit het model** (muur boven de opening, muren en vloeren op de verdiepingen erboven, dak; aanname: vloeren dragen af op de muur); **doorgaande ligger** over 2 overspanningen (driemomentenvergelijking, patroonbelasting); **lijfstuik en lijfplooi** aan de steunpunten (EN 1993-1-5 §6); **oplegging** tegen een ingegeven metselwerksterkte f_d; **kolommen** met een eenvoudige knikcontrole (EN 1993-1-1 §6.3.1). Alles in de rekennota, met aftekenvak; niet voor uitvoering.
- **Vergunningsklare basis** (in *Ontwerp*): **dak** (plat, zadel- of lessenaarsdak, helling, overstek, materiaal) in doorsneden, gevels en 3D; **trap** met optrede/aantrede en comfortregel, in plan en doorsnede; **terrein**: perceel, maaiveld, inplantingsplan met afstanden tot de grenzen; **ruimtes van de nieuwe toestand** (samenvoegen bij afbraak, splitsen door een nieuwe muur) en de **meetstaat van de nieuwe toestand**; gegevens voor het titelblok (bouwheer, architect, kadaster, plan nr.) en **gevelmaterialen**; **opmerkingen** als pins op het plan (reizen mee via cloud en deellink). Export **Vergunningsklare basis (PDF)**. De architect controleert, vult aan en tekent.
- **Verwarming en energie** (net *Verwarming* bij Installaties): warmteverlies per ruimte, vereenvoudigd volgens NBN EN 12831, uit de U-waarden van *Energie* (of aangenomen, gemarkeerd); afgifte per ruimte (radiator met vermogen bij het gekozen regime, of vloerverwarming met W/m²); voorstel warmtepomp en buffervat; warmtepomp, buffervat, radiatoren en collector op het plan; **zonnepanelen** per dakvlak met kWp en indicatieve jaaropbrengst. Mee in de installatie-PDF en het lastenboek.
- **Werf** (knop *Werf*): **werffoto's** per ruimte met datum en bijschrift; **op te volgen** punten per ruimte; **werfdagboek** per dag (weer, verlet, ploeg, uren, werk, leveringen, bezoekers, problemen, foto's; PDF); **meer- en minwerken** met akkoord van de klant en een bon ter ondertekening (PDF), na akkoord mee in de vorderingsstaat; **vorderingsstaat** per lastenboekpost in % (cumulatief, staat afsluiten, PDF); **offerte-PDF** uit het lastenboek met eigen logo en firmagegevens (op het toestel bewaard), btw 6 % (met de voorwaarden) of 21 %, betalingsvoorwaarden, geldigheid en "voor akkoord". **Laser** (knop bovenaan): Leica DISTO en Bosch GLM via Web Bluetooth in Chrome op Android (zie `docs/lasers.md`); elke meting komt in het actieve maatveld. Op iPhone kan het niet (Safari heeft geen Web Bluetooth).
- **Offline en installeerbaar**: zet de app op je startscherm (Chrome: *App installeren*; iPhone: *Zet op beginscherm*). Na één bezoek werkt alles zonder netwerk. Staat het project in de cloud, dan wachten wijzigingen en foto's tot er weer netwerk is en gaan ze vanzelf mee.
- **Prijzen**: eenheidsprijs per post, onthouden op het toestel; raming met btw-tarief naar keuze (21/12/6/0 %); prijzen mee in Excel, kopie en PDF.
- **RoomPlan-scan openen** (iPhone/iPad Pro met LiDAR): een `CapturedRoom`-bestand (JSON) via **Openen** wordt een plan met binnencontour, muren, deuren, ramen en doorgangen; bij kleine afwijkingen (≤ 3°) haaks rechtgezet. Muurdikte 200 mm aangenomen (de scanner meet geen dikte). Eén ruimte per scan.
- **Opmeten met de camera** (Chrome op Android met ARCore, via WebXR): hoeken van de vloer aantikken → plan. **Plafond meten** (richten op het plafond), **Volgende ruimte** om de ruimte ernaast in dezelfde sessie op te meten (wordt tegen de gedeelde muur gezet), en **haaks maken waar het kan**: muren die minder dan 8° afwijken worden haaks, echt schuine muren blijven schuin. Op iPhone en pc niet beschikbaar. Demo zonder camera: `?ar-demo` achter het webadres.
- **Lastenboek-meetstaat**: posten per ruimte (vloer, plinten, pleister- en schilderwerk wanden/plafond, dagkanten, vensterbanken, buitenschrijnwerk, binnendeuren); "Kopiëren voor offerte" (plakken in offerte of Excel) en export naar Excel met kolommen eenheidsprijs en totaal. **Extra posten** uit Ontwerp, Liggers en Installaties: afbraak (muren in m² en m³, nieuwe openingen, puin in m³ en ton, containers, stutten), ruwbouw (metselwerk per dikte, lateien met lengte, stalen liggers, dichtmaken, chape) en installaties (punten, kabels, leidingen per diameter, toestellen), elk met eenheidsprijs, in Excel en PDF.
- Meetstaat live; export naar PDF, DXF, **IFC (BIM, IFC4)**, CSV (Excel) en projectbestand (JSON). Het IFC-bestand bevat verdiepingen op peil, muren (met verstek), ramen en deuren in hun opening, ruimtes en sparingen, met eigenschappen zoals dragend en meetmethode; te openen in Revit, ArchiCAD, BricsCAD, BIMcollab Zoom ….
- Ongedaan maken (ook Ctrl+Z) en automatisch bewaren in de browser.
- **Cloud** (knop in de kopbalk): aanmelden met een link per e-mail, projecten bewaren in de cloud (Supabase, EU-regio) en **vanzelf gelijk houden** tussen gsm en pc: na elke wijziging bewaren, bij het openen van de app de nieuwste versie ophalen; werkten twee toestellen tegelijk, dan kies je welke versie je houdt. **Delen** met klant, architect of ingenieur per e-mailadres (alleen bekijken of bewerken). Instellen: zie [docs/cloud-instellen.md](docs/cloud-instellen.md). Proberen zonder account: `?cloud-demo`.
- **Delen (link)**: één knop maakt een link met het hele project erin, om het van de gsm naar de desktop te brengen (of omgekeerd). Op de gsm opent het deelmenu (mail, WhatsApp …), op de pc wordt de link gekopieerd. Open je de link op het andere toestel, dan vraagt de app eerst of het huidige project daar vervangen mag worden (ongedaan maken kan). Geen live synchronisatie: na wijzigingen opnieuw delen. Privacy: het project zit achter het `#` in de link en wordt niet naar een server gestuurd, maar **wie de link heeft, kan het project openen** — deel hem dus enkel met wie het mag zien. Zeer grote projecten geven een lange link; lukt die niet, gebruik dan het projectbestand.

Online via GitHub Pages zodra dat aan staat (zie onder). Lokaal: `npm run web`.

### GitHub Pages aanzetten (één keer)

Repository → **Settings** → **Pages** → bij *Source* kies **GitHub Actions**.
Daarna publiceert elke wijziging op `main` de app op
`https://wimbastenie-png.github.io/architect1.0/`.

## De kern

`packages/core` — gedeelde rekenkern voor gsm-app, webversie en server:

| Bestand | Wat het doet |
| --- | --- |
| `src/schema.ts` | Projectformaat v0.1: verdiepingen, muren, openingen, ruimtes. Alles in hele mm; elke maat onthoudt hoe ze gemeten is (gescand / gecorrigeerd / laser / manueel). Validatie van structuur én samenhang. |
| `src/geometrie.ts` | Oppervlakte, omtrek, wandvlakken. Muurlengte aanpassen zoals in CAD: haakse muren schuiven mee, het plan blijft gesloten. |
| `src/maatvoering.ts` | Maatkettingen per zijde, buiten het hele gebouw: rij openingen (gevelstuk · raam · gevelstuk), rij gevelstukken, rij totaal. Gebruikt door PDF, DXF en scherm. |
| `src/openingen.ts` | Codes per opening (R1, D1, O1 …, over het hele project) en openingenlijst; labels op het plan, binnendeuren met breedte. |
| `src/lastenboek.ts` | Lastenboek-meetstaat per post en per ruimte, CSV (met formules, zonder taalgebonden functies) en tab-tekst om te plakken. |
| `src/verdiepingen.ts` | Verdieping toevoegen (kopie of rechthoek), hernoemen, peil, verwijderen. |
| `src/bewerken.ts` | Openingen wijzigen/verwijderen, muur uitbreken (haakse vereniging van ruimtes), muur verschuiven, muurstukken samenvoegen, ruimte verwijderen, sparingen toevoegen/wijzigen; netto vloer en plafond. |
| `src/prijzen.ts` | Eenheidsprijzen, raming excl./incl. btw, euro-notatie. |
| `src/hoekpunten.ts` | Aangetikte hoekpunten → haaks plan → muren en ruimte. |
| `src/uitbreiden.ts` | Ruimte tegen een bestaande muur zetten: muur splitsen, openingen verhuizen, gedeelde muren hergebruiken, overlap weigeren. |
| `src/sjablonen.ts` | Nieuw project uit binnenmaten (rechthoekige ruimte). |
| `src/meetstaat.ts` | Meetstaat per ruimte (vloer, volume, wand bruto/netto) en CSV voor Belgische Excel (`;` en decimale komma). |
| `src/dxf.ts` | DXF-export (R12, mm) met lagen MUREN, OPENINGEN, RUIMTES, MATEN, TEKST. Getest met ezdxf: 0 fouten. |
| `src/pdf.ts` | PDF-plannen: één blad per verdieping (titel met peil), hulplijnen en codes bij openingen, plus lijstenbladen (openingenlijst, meetstaat per post, detail per ruimte); op vaste schaal (1:50, 1:100 of 1:200; A4 of A3, automatisch gekozen), met titelblok, schaalstok om de afdruk te controleren, legende van de meetbronnen en disclaimer. |
| `src/svg.ts` | Planvoorbeeld. Maatkleur toont de meetbron: oranje = gescand, blauw = gecorrigeerd, groen = laser. |
| `examples/` | Voorbeeldappartement; `npm run voorbeeld` schrijft JSON, CSV, DXF, SVG en PDF naar `packages/core/uitvoer/`. |

## Gebruiken

```bash
npm install
npm test            # 96 tests
npm run web         # webapp lokaal starten
npm run e2e         # browsertests (pc + gsm) met Playwright
npm run voorbeeld   # voorbeelduitvoer
```

## Bekende beperkingen van v0.1

- Wandoppervlak gebruikt de binnencontour × plafondhoogte; dagkanten (neggen) van ramen en deuren zitten er nog niet in.
- Muren meeschuiven werkt voor rechte, haakse plannen; schuine muren en bogen zijn nog niet getest.
- Maatkettingen alleen voor haakse gevels; schuine gevels krijgen één eigen maatlijn. Hulplijnen vertrekken aan het buitenste gevelvlak op die plaats; bij een insprong gaan ze niet tot in de inham.
- Lastenboek: eigen postindeling, niet de nummering van Standaardbestek 250. Dagkanten in lopende meter zonder diepte; plafond = vloer (geen schuine plafonds); geen trappen, gevels, daken of buitenwerk.
- Verdiepingen: geen controle dat muren boven elkaar staan; een kopie neemt geen ramen/deuren en sparingen over.
- Sparingen zijn rechthoekig en liggen volledig in één ruimte; een trapgat over twee ruimtes kan niet.
- Schuine muren: een hoek verplaatsen kan niet waar drie of meer muren samenkomen (dat zou een doorlopende muur knikken). Ook niet als het een knik zou maken in een muur op een plaats waar de ruimte geen hoek heeft (bv. een muur die gesplitst is door een ruimte aan de andere kant). Zeer korte muurstukjes (korter dan twee keer de muurdikte), die ontstaan als een aangrenzende ruimte vlak bij een hoek begint, volgen niet altijd correct. Vloeren die hun muren niet raken (bv. uit een vorige versie) worden bij het openen automatisch rechtgezet; lukt dat niet, dan meldt de app het en kan je **Vloeren rechtzetten** in het controleblok gebruiken. Uitbreken bij schuine muren vraagt dat elke ruimte één rand tegen de muur heeft. Verstek onder ±10° wordt niet getekend (te spitse hoek). De camera-opmeting maakt nog altijd een haaks plan. Een muur die recht doorloopt in een andere muur kan niet apart verschuiven (dat zou een knik geven). Slepen gaat in stappen van 10 mm; voor een exacte maat geef je de afstand in.
- RoomPlan: alleen getest met kunstmatige scans in hetzelfde formaat; **nog niet met een echt scanbestand**. Je hebt een iOS-app nodig die de scan als JSON bewaart (een eigen iOS-app is er nog niet). Meubels in de scan worden niet overgenomen.
- Camera-opmeting: **niet getest op een echt toestel**; alleen de verwerking van de punten is getest (unit- en browsertests met testpunten). Plafondhoogte meten lukt alleen als het toestel het plafond als vlak herkent (anders zelf ingeven). Een volgende ruimte moet rechthoekig zijn en tegen een buitenmuur van een vorige ruimte liggen; andere vormen voeg je toe met "Ruimte hiernaast toevoegen". Werkt niet op iPhone (Safari ondersteunt WebXR AR niet).
- Installaties: leidingen zijn een schets (haaks van bron naar toestel, niet langs muren of door gaten); kabellengtes zijn schattingen. Het eendraadschema gebruikt eigen, vereenvoudigde symbolen, niet de officiële. Aandachtspunten zijn een beperkte lijst; de regels (AREI, NBN) zijn na te kijken door een installateur of keurder.
- Ontwerp: schetsontwerp, geen vergunningsplan. Doorsneden tonen alleen wat de snijlijn raakt (niets erachter); gevels zonder dak, goot of buitenaanleg. Nieuwe muren delen ruimtes nog niet op (meetstaat en lastenboek blijven op de bestaande ruimtes). Een nieuwe opening komt in het midden van de muur; de maten pas je aan via *Plan*.
- Liggers: max. 2 overspanningen; kip bij doorgaande liggers vereenvoudigd; lastendaling neemt aan dat vloeren op de muur afdragen. Niet gecontroleerd: wringing, brand, verbindingen, samenwerking van profielen naast elkaar, stempeling, draagkracht van het metselwerk en de fundering. Nog niet nagekeken door een ingenieur.
- PDF: Griekse letters en tekens buiten de standaardletter worden uitgeschreven (bv. "gamma") of als "?" getoond.
- Cloud: werkt pas als er een Supabase-project is ingesteld (zie docs/cloud-instellen.md). Getest met een nagebootste server en de databaseregels op een lokale PostgreSQL, nog niet tegen een echt Supabase-project. Gelijk houden is niet live (bij openen van de app en elke 30 s); geen samenvoegen van gelijktijdige wijzigingen, je kiest een van beide versies.
- Inrichting en 3D: schetsbeelden, geen fotorealistische render in de app (daarvoor het GLB-bestand). Meubels zijn eenvoudige blokken. Een muur heeft binnen en buiten dezelfde kleur. Geen plafonds, daken of trappen in 3D. Meubels slepen kan niet (verplaatsen met tikken of pijltjes).
- Energie: oppervlaktes op buitenlengte en netto vloer (de EPB-software gebruikt eigen meetregels); U-waarde zonder koudebruggen of grondcorrectie; λ, Ug en Uf zijn richtwaarden. Foto's gaan mee in de cloud (als het project in de cloud staat), niet in een deellink of projectbestand.
- Ventilatie: richtwaarden, geen drukverliesberekening of inregeling; kanalen haaks van de unit naar elk ventiel (geen gezamenlijk hoofdkanaal of verdeelkast); geen ventilatieverslag.
- Keuken: rechte wanden, geen hoekkasten of eilanden in de planner; vereenvoudigde kastopbouw (18 mm plaat); geen beslag of prijzen. Een wand verwijst naar de rand van een ruimte: wijzigt de ruimte, controleer dan de wand.
- Vergunningsbasis: het dak gebruikt een rechthoekige voetafdruk van de bovenste verdieping (geen L-vormige daken, dakkapellen of schilddaken); alleen rechte trappen; perceel als rechthoek (of zelf ingegeven punten via het projectbestand); herindeling werkt voor eenvoudige vormen. Geen stedenbouwkundige toetsing.
- Verwarming: geen opwarmtoeslag, geen buurruimtes met een andere temperatuur, sanitair warm water niet in het warmtepompvermogen; zonnepanelen zonder schaduw of dakopeningen.
- Werf: werffoto's gaan mee in de cloud, niet in een deellink; geen facturatie of boekhouding. Laser: Leica DISTO en Bosch GLM (BLE), niet getest met een echt toestel; Hilti en andere merken vragen een eigen app (`docs/lasers.md`).
- Prijzen staan alleen op het toestel waarop je ze ingaf en gaan niet mee in een deellink. Gsm en desktop lopen nog niet vanzelf gelijk: de deellink is een kopie van dat moment (echte synchronisatie: stap 8 van de roadmap).
- Ruimtes zijn rechthoekig en worden haaks tegen een bestaande muur gezet. Schuine muren, L-vormige ruimtes en een ruimte die tegen twee bestaande ruimtes tegelijk komt (bv. een hoek opvullen) kunnen nog niet.
- Bij een aanbouw tegen een gevel kunnen gevelmaten en maten van de aanbouw elkaar kruisen; maatlijnen worden nog niet automatisch in rijen geschikt.
- IFC: gecontroleerd met IfcOpenShell (geldig IFC4, geometrie aanmaakbaar), nog niet geopend in Revit of ArchiCAD. Geen vloerplaten, daken of trappen; ramen en deuren zijn eenvoudige blokken zonder kader of draairichting.
- PDF gebruikt de standaardletter Helvetica: tekens buiten West-Europese talen (bv. Pools, Grieks) worden als "?" getoond.

## Werftest

Zie [`docs/werftest.md`](docs/werftest.md): stappenplan en invulblad om de app op een echte woning te testen.

## Browsertests

`packages/web/e2e/` bevat Playwright-tests die de webapp in een echte browser bedienen: project maken, maten wijzigen, ramen, ruimtes toevoegen en uitbreken, trapgat, lastenboek (klembord en Excel), verdiepingen, en slepen met muis en vinger. Twee profielen: **pc** (Chrome 1280 × 900) en **gsm** (Pixel 7, aanraking). Ze draaien bij elke pull request op GitHub; publiceren gebeurt pas als ze slagen. Bij een fout staat het rapport met schermafdrukken onder *Actions → run → Artifacts → playwright-rapport*.

## Roadmap

De MVP staat online. Alle stappen hieronder zijn **gebouwd en automatisch getest**; wat nog op een echte werf, een echt toestel of door een vakman getest moet worden, staat in [docs/testlijst.md](docs/testlijst.md). Overal geldt: de app bereidt voor, een bevoegde vakman controleert en tekent af.

| Stap | Inhoud | Status | Wie controleert of tekent af |
| --- | --- | --- | --- |
| 1. Werftest | Een echte woning opmeten met `docs/werftest.md` en de bevindingen verwerken | Klaar om uit te voeren (jij) | – |
| 2. Camera-opmeting verfijnen | Plafondhoogte meten, schuine muren behouden, meerdere ruimtes na elkaar | Gebouwd; testen op Android | – |
| 3. RoomPlan-omzetting | Scan van iPhone/iPad Pro met LiDAR → projectformaat | Gebouwd; wacht op een echt scanbestand | – |
| 4. IFC-export (open BIM) | Verdiepingen, muren, ramen, deuren, ruimtes als IFC4 | Gebouwd; openen in BIM-software | Architect of ingenieur gebruikt ze als vertrekpunt |
| 5. Installaties | Elektriciteit, sanitair en gas op het plan, kringen, eendraadschema, leidingen, materiaallijst, aandachtspunten | Gebouwd; nalezen door een vakman | Installateur; keuring waar verplicht. De app vervangt die niet |
| 6. Ontwerp | Verbouwing (afbreken geel, nieuw rood), nieuwe toestand, doorsneden en gevels | Gebouwd | Architect waar de wet dat vraagt |
| 7. Voordimensionering stalen liggers | Rekennota met alle aannames, ter controle en aftekening. Fundering buiten bereik | Gebouwd; nakijken door een ingenieur | Ingenieur tekent af |
| 8. Accounts en cloudopslag | Gsm en pc gelijk houden, delen met klant, architect en ingenieur (Supabase, EU) | Gebouwd; Supabase-project aanmaken (`docs/cloud-instellen.md`) | – |
| 9. Inrichting en renders | Meubels, materialen, 3D, beeld (PNG) en model (GLB) voor fotorealistische renders | Gebouwd | – |
| 10. Lastenboek uitbreiden | Afbraak (m², m³, puin, containers, stutten), ruwbouw (metselwerk, lateien, dichtmaken, chape) en installatieposten, met prijzen in Excel en PDF | Gebouwd; nakijken door een aannemer | Aannemer |
| 11. EPC/EPB-inventaris | Noordpijl, samenstelling en U-waarden van muren, vloeren en daken, ramen (Ug, Uf, zonwering), beschermd volume, bewijsfoto's; invoerlijst per richting als voorbereiding op de officiële software. Geen EPC-score | Gebouwd; nakijken door een energiedeskundige | Energiedeskundige (EPC-certificateur, EPB-verslaggever) |
| 12. Ventilatie | Vierde net: systeem A/B/C/D, toevoer- en afvoerpunten, debieten volgens NBN D 50-001, doorstroomopeningen, unit en kanalen, materiaallijst en PDF | Gebouwd; nakijken door een ventilatie-expert | Ventilatie-expert |
| 13. Keuken en maatwerk | Precisiemeting per wand, wandaanzichten met aansluitingen, keukenplanner (modules, werkblad, passtukken), controle tegen installatiepunten, PDF, snij- en kastenlijst, DXF | Gebouwd; nakijken door een keukenbouwer | Keukenbouwer, meubelmaker |
| 14. Liggers en stabiliteit uitbreiden | Puntlasten, lastendaling over verdiepingen, doorgaande liggers, lijfplooi en lijfstuik, oplegblok tegen metselwerksterkte, kolommen | Gebouwd; nakijken door een ingenieur | Ingenieur tekent af |
| 15. Architect: vergunningsklare basis | Daken, trap met comfortregel, terrein en inplantingsplan, ruimtes herindelen en meetstaat nieuwe toestand, legende en titelblok als vergunningsplan, opmerkingen (pins) voor wie meekijkt | Gebouwd; nakijken door een architect | Architect |
| 16. Verwarming en energie | Warmteverlies per ruimte (vereenvoudigd volgens EN 12831), radiatoren of vloerverwarming, warmtepomp en buffervat, zonnepanelen met indicatieve opbrengst | Gebouwd; nakijken door een installateur | Installateur (verwarming), energiedeskundige |
| 17. Werfopvolging en offerte | Offerte-PDF met eigen logo en btw 6/21 %, werffoto's, opvolgpunten per ruimte, vorderingsstaat, Bluetooth-laserafstandsmeter | Gebouwd; nakijken door een aannemer | Aannemer |

### Fase 1: wereldklasse voor de aannemer

| PR | Inhoud | Status | Wat jij regelt of test |
| --- | --- | --- | --- |
| F1-1. Sneller laden | De app laadt eerst alleen het plan (159 kB i.p.v. 402 kB, gezipt). PDF-maker, cloud, 3D en de modi Installaties, Ontwerp, Liggers, Inrichting, Energie, Keuken en Werf laden pas als je ze opent | Gebouwd | Op de gsm: opent de app sneller? Werkt elke modus en elke PDF nog? |
| F1-2. Offline werken | Installeerbaar op het startscherm; na één bezoek werkt de hele app zonder netwerk (alle modi en PDF's); wijzigingen en foto's wachten en gaan vanzelf naar de cloud zodra er weer netwerk is; foto's in de cloud en op elk toestel | Gebouwd | `supabase/migrations/0002_fotos.sql` uitvoeren in Supabase; op de werf testen zonder bereik |
| F1-3. Bluetooth-lasers | Leica DISTO en Bosch GLM via Web Bluetooth (Chrome op Android); uitleg voor Hilti, andere merken en iPhone in de app en in `docs/lasers.md` | Gebouwd; niet getest met een echt toestel | Je lasers om te testen (DISTO, Bosch GLM 50 C/100 C) |
| F1-4. Werfdagboek, meer- en minwerken | Dagboek per werfdag (weer, temperatuur, verlet, ploeg, uren, werk, leveringen, bezoekers, problemen, foto's) met PDF; meer- en minwerken: voorstel → akkoord of geweigerd, bon ter ondertekening (PDF), na akkoord als post MW1, MW2 … in de vorderingsstaat | Gebouwd; nakijken door een aannemer | Aannemer: zijn dit de juiste velden? Bon laten nalezen |
| F1-5. Facturen | Voorschot, vordering, eindfactuur; nummering, gestructureerde mededeling, betaal-QR, btw 21/6 % en verlegd | Gepland | Boekhouder: teksten en btw nakijken |
| F1-6. Boekhouding en groothandel | E-factuur (UBL, Peppol BIS 3.0), klantenlijst, bestellijst voor de groothandel | Gepland | Naam van je boekhoudpakket en groothandel; Peppol-toegangspunt |
| F1-7. Werftestprotocol | Controlemetingen tegenover het plan, nauwkeurigheidsrapport per project (PDF) | Gepland | Een echte werf om te meten |

**Daarna**: fase 2 (BIM-kern en exports), fase 3 (samenwerken en ondertekenen), fase 4 (regels en rekenkernen per discipline), fase 5 (renders, AR, AI), fase 6 (eigen apps, talen, beveiliging).

### Installaties in detail

**Elektriciteit**

- Punten op het plan: stopcontacten, schakelaars, lichtpunten en verdeelbord, met legende.
- Automatisch eendraadschema met kringen, differentiëlen, automaten en kabeldoorsnedes.
- Basiscontroles volgens het AREI, als aandachtspunten om na te kijken door een installateur of keurder.
- Materiaallijst.
- De app vervangt de installateur en de keuring niet.

**Sanitair**

- Toestellen op het plan, en leidingen voor koud water, warm water en afvoer, met diameter, materiaal, hoogte en helling.
- Leidingschema en materiaallijst.
- Basiscontroles als aandachtspunten, na te kijken door een installateur.
- De app vervangt de installateur niet.

**Gas**

- Toestellen en een gele gasleiding met kranen op het plan.
- Verplichte waarschuwing voor de ontwerper, in de app én op elk PDF-blad: een bevoegde installateur moet de installatie ontwerpen en uitvoeren, en een keuring is verplicht vóór ingebruikname (NBN D 51-003, na te kijken).
- Geen oordeel "conform": de app geeft enkel aandachtspunten.
- De app vervangt de bevoegde installateur en de keuring niet.

### Niet vergeten

- **Partners zoeken**, één per vakgebied om mee te lezen, te controleren en af te tekenen:
  - **Aannemer**: lastenboek, offerte, werfopvolging (stap 10, 17).
  - **Architect**: ontwerp, vergunningsplannen (stap 6, 15).
  - **Ingenieur**: liggers en stabiliteit (stap 7, 14).
  - **EPC/EPB-verslaggever**: energie-inventaris, warmteverlies (stap 11, 16).
  - **Ventilatie-expert**: ventilatie (stap 12).
  - **Keukenbouwer**: keuken en maatwerk (stap 13).
  - **Installateur/keurder**: elektriciteit, sanitair, gas, verwarming (stap 5, 16).
- **Altijd:** de app geeft nooit een oordeel "conform". Ze bereidt voor; een bevoegde vakman controleert en tekent af. Dat staat in de app en in elke PDF.
- **Juridische punten:** algemene voorwaarden, privacy (scans van woningen zijn persoonsgegevens onder de GDPR) en verzekering (beroepsaansprakelijkheid).
