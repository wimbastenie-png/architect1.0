# Testlijst: wat jij zelf moet testen

Alle stappen van de roadmap zijn gebouwd en automatisch getest: 153 unit-tests, 49 browsertests op pc en gsm, plus de databaseregels op PostgreSQL. Wat een computer niet kan nagaan, staat hieronder: een echte werf, een echte gsm, echte software van architecten, en het oordeel van een vakman.

**Hoe:** werk per blok. Vink af wat werkt (`[x]`). Schrijf bij wat niet werkt kort op wat je deed, wat je zag en op welk toestel. Een schermafdruk helpt. Daarna overlopen we alles en verbeter ik het.

**Volgorde van mergen:** de PR's bouwen op elkaar verder. Merge ze in deze volgorde, dan staat alles online:

| Volgorde | PR | Stap |
| --- | --- | --- |
| 1 | [#15](https://github.com/wimbastenie-png/architect1.0/pull/15) | IFC-export |
| 2 | [#16](https://github.com/wimbastenie-png/architect1.0/pull/16) | RoomPlan-omzetting |
| 3 | [#17](https://github.com/wimbastenie-png/architect1.0/pull/17) | Camera-opmeting verfijnen |
| 4 | [#18](https://github.com/wimbastenie-png/architect1.0/pull/18) | Installaties |
| 5 | [#19](https://github.com/wimbastenie-png/architect1.0/pull/19) | Ontwerp |
| 6 | [#20](https://github.com/wimbastenie-png/architect1.0/pull/20) | Liggers |
| 7 | [#21](https://github.com/wimbastenie-png/architect1.0/pull/21) | Cloud |
| 8 | [#22](https://github.com/wimbastenie-png/architect1.0/pull/22) | Inrichting en 3D |
| 9 | deze PR | Roadmap en testlijst |

Daarna: https://wimbastenie-png.github.io/architect1.0/ (op de gsm de pagina vernieuwen; lukt dat niet, het tabblad sluiten en opnieuw openen).

---

## 0. Algemeen (5 min, gsm én pc)

- [ ] De app opent; je laatste project staat er nog.
- [ ] Bovenaan het plan staan de knoppen **Plan · Installaties · Ontwerp · Liggers · Inrichting**. Wisselen gaat vlot.
- [ ] In **Plan** werkt alles zoals vroeger: muur aanklikken, slepen (ingedrukt houden op de gsm), zoomen, ongedaan maken.

## 1. Werftest (stap 1, 1 à 2 uur)

- [ ] Een echte woning opmeten volgens [werftest.md](werftest.md). Vul het invulblad in met minstens 5 maten (werkelijk tegenover app).
- [ ] Noteer wat traag, onduidelijk of onhandig was op de werf.

## 2. Camera-opmeting (stap 2, Android met ARCore)

- [ ] **Nieuw** → **Opmeten met de camera** start de camera.
- [ ] Hoeken van één ruimte aantikken; de afstand tot de vorige hoek klopt ongeveer met de rolmeter.
- [ ] **Plafond meten**: richt op het plafond. Verschijnt er een hoogte? Klopt ze (± 5 cm)? Of zegt de app "richt op het plafond" zonder resultaat?
- [ ] **Volgende ruimte**: meet de kamer ernaast in dezelfde sessie. Na **Klaar** staan beide ruimtes tegen dezelfde tussenmuur.
- [ ] Een kamer met een **echt schuine muur**: blijft ze schuin ("haaks maken waar het kan")?
- [ ] Zonder gsm met ARCore: open de app met `?ar-demo` achter het adres en tik **AR-demo met testpunten** (twee ruimtes).

## 3. RoomPlan (stap 3, alleen met een iPhone/iPad Pro met LiDAR)

- [ ] Kan pas getest worden met een echt scanbestand (`CapturedRoom` als JSON) van een iOS-app. Heb je toegang tot zo'n toestel, stuur me dan een scanbestand; dan test ik de omzetting.

## 4. IFC-export (stap 4)

- [ ] **IFC (BIM)** downloaden.
- [ ] Openen in een gratis viewer (bv. BIMcollab Zoom, Open IFC Viewer of usBIM.viewer+). Zie je verdiepingen, muren, ramen, deuren en ruimtes op de juiste plaats?
- [ ] Liefst: laat een architect of ingenieur het openen in Revit, ArchiCAD of BricsCAD. Is het bruikbaar als vertrekpunt?

## 5. Installaties (stap 5)

- [ ] **Installaties** → **Elektriciteit**: kies een symbool boven het plan en tik in het plan. Plaats een verdeelbord, ± 10 stopcontacten, lichtpunten en schakelaars. Lukt dat ook op de gsm?
- [ ] Een symbool aantikken → hoogte, vaste kring, opmerking, **Verplaatsen**, **Verwijderen**.
- [ ] De lijst **Kringen** en het **eendraadschema** zijn logisch (max. 8 stopcontacten per kring, badkamer op 30 mA, kookplaat apart).
- [ ] **Sanitair**: watermeter, boiler, afvoer, wc, douche, wastafel. Zie je de leidingen (blauw, rood, grijs gestreept) en de aandachtspunten (verval van de afvoer)?
- [ ] **Gas**: gasmeter en ketel. De gele waarschuwing staat in de app.
- [ ] **Installaties (PDF)**: planbladen per net, eendraadschema, kringen, leidingen, materiaallijst, aandachtspunten. De gaswaarschuwing staat op **elk** blad.
- [ ] **Vakman:** laat een installateur of keurder de aandachtspunten, het eendraadschema en de materiaallijst nalezen. Wat klopt niet, wat ontbreekt?

## 6. Ontwerp (stap 6)

- [ ] **Ontwerp** → muur aantikken → **Afbreken** (wordt geel, gestreept). Bij een (mogelijk) dragende muur: waarschuwing over de ingenieur.
- [ ] **Nieuwe muur**: tik begin- en eindpunt dicht bij twee muren → rode muur die netjes aansluit.
- [ ] Een raam **dichtmaken** (rood) en een **nieuwe opening** in een muur (geel).
- [ ] Weergave **Bestaand / Nieuw / Verbouwing** wisselen.
- [ ] **Snijlijn doorsnede**: tik twee punten over het plan → doorsnede A-A in het paneel.
- [ ] **Gevels**: vier zijden bekijken.
- [ ] **Ontwerp (PDF)**: plan verbouwing en nieuwe toestand, doorsnede en gevels op schaal, aandachtspunten. Meet een maat na op de afdruk (100 %).

## 7. Liggers (stap 7, samen met een ingenieur)

- [ ] **Liggers** → een raam of deur aantikken → **+ Nieuwe ligger** neemt breedte en muurdikte over.
- [ ] **Last toevoegen met hulp**: muur erboven, vloer, dak. Het voorstel (bv. 2 × IPE …) verandert mee.
- [ ] **Rekennota (PDF)** downloaden: "Niet voor uitvoering" staat op elk blad, met het aftekenvak.
- [ ] **Ingenieur:** laat een rekennota van een geval dat je kent nakijken. Klopt het profiel? Welke aannames ontbreken of zijn fout? Wil die ingenieur partner worden?

## 8. Cloud (stap 8)

Proberen zonder account:
- [ ] Open de app met `?cloud-demo` → **Cloud** → aanmelden met een willekeurig e-mailadres → **Bewaren in de cloud** → de knop toont "Cloud: bewaard".

Echt instellen (± 20 min, volg [cloud-instellen.md](cloud-instellen.md)):
- [ ] Supabase-account en project in een **EU-regio** (Frankfurt).
- [ ] De SQL uitvoeren, Site URL en redirect URL instellen.
- [ ] In GitHub de variabelen `SUPABASE_URL` en `SUPABASE_ANON_KEY` invullen (alleen de **publieke** sleutel). Daarna een nieuwe publicatie (een merge, of de workflow opnieuw starten).
- [ ] Op de gsm: aanmelden (link in de mail **op de gsm** openen) → project → **Bewaren in de cloud**.
- [ ] Op de pc: aanmelden → **Cloud** → project **Openen**.
- [ ] Iets wijzigen op de gsm → de pc toont het na het openen van de app (of binnen 30 s).
- [ ] Beide toestellen tegelijk iets wijzigen zonder internet → daarna kies je in de balk welke versie je houdt.
- [ ] **Delen** met een tweede e-mailadres ("alleen bekijken") → die persoon ziet het project maar kan niet bewaren.

## 9. Inrichting en 3D (stap 9)

- [ ] **Inrichting** → groep → meubel → tik in het plan. Draaien, pijltjes, **Verplaatsen**, maat en kleur, verwijderen.
- [ ] Een lege plek in een ruimte aantikken → vloer en wanden kiezen.
- [ ] Een meubel tegen of in een muur, of voor een deur → opmerking.
- [ ] **3D bekijken**: draaien en zoomen met de vingers en met de muis. **Vogelvlucht** en **Binnen**. Werkt het vlot op jouw gsm, of hapert het?
- [ ] **Beeld bewaren (PNG)** en **3D-bestand (GLB)**. Het GLB-bestand openen in bv. Blender (gratis) of de Windows 3D-viewer.

## 10. Regelen (geen test, wel nodig vóór je de app aan klanten geeft)

- [ ] **Partners:** een ingenieur (stabiliteit, liggers), een architect (vergunningen, ontwerp) en een installateur of keurder (elektriciteit, sanitair, gas), om te controleren en af te tekenen.
- [ ] **Juridisch:** algemene voorwaarden, een privacyverklaring en de verwerkersovereenkomst (DPA) met Supabase (opmetingen van woningen zijn persoonsgegevens, GDPR), en een verzekering beroepsaansprakelijkheid.

---

### Wat je terugstuurt

Per blok: wat werkt, en wat niet (met toestel, wat je deed, wat je zag, schermafdruk). Zeg ook wat je het eerst verbeterd wil zien.

---

## Stap 10–17 (per vakgebied)

Bij elke stap komt hieronder een blok bij, zodra de pull request klaar is. De volgorde van mergen staat telkens in de pull request.

## 10. Lastenboek uitbreiden (aannemer)

- [ ] **Ontwerp**: breek een muur af en teken een nieuwe muur. Ga naar **Plan** → **Meetstaat** → **Lastenboek**.
- [ ] De groepen **Afwerking**, **Afbraak** en **Ruwbouw** verschijnen. Controleer:
  - af te breken m² en m³;
  - puin in m³ (los) en ton;
  - containers;
  - stutten;
  - metselwerk per dikte;
  - lateien met lengte;
  - dichtmaken;
  - chape.
- [ ] Met installatiepunten: groepen **Elektriciteit**, **Sanitair** en **Gas**. Een prijs die je ingeeft, blijft na het verplaatsen van een punt bij dezelfde post.
- [ ] Een prijs ingeven → bedrag en totaal kloppen.
- [ ] **Lastenboek (Excel)** en **PDF-plan**: de nieuwe posten en de aannames (puin × 1,4; 1,8 t/m³; containers 10 m³; stutten ± 1 per meter) staan erin.
- [ ] Onderaan de app en op elk PDF-blad: "De app bereidt voor; een bevoegde vakman controleert en tekent af."
- [ ] **Aannemer:** kloppen de aannames (losheid, gewicht, containergrootte, stutten, latei-oplegging)? Welke posten mis je?

## 11. EPC/EPB-inventaris (energiedeskundige)

- [ ] **Energie**: draai de noordpijl tot ze klopt (kompas van de gsm). De richtingen in de lijst (N, O, Z, W …) kloppen met de werkelijkheid.
- [ ] Tik een buitenmuur aan → lagen van binnen naar buiten (bv. pleister, baksteen, isolatie, luchtlaag, gevelsteen). Komt de U-waarde in de buurt van wat je verwacht? Of geef een gekende U-waarde in met bron.
- [ ] Tik een raam aan → glas, schrijnwerk en zonwering. Uw verschijnt.
- [ ] **Bewijsfoto** nemen met de gsm bij een muur en een raam. De foto blijft na het herladen van de app.
- [ ] Tik een ruimte aan → binnen of buiten het beschermd volume; vloer en plafond/dak invullen (grens: grond, onverwarmd, buiten).
- [ ] De lijst "Nog in te vullen" wordt korter naarmate je invult; muren worden groen.
- [ ] **EPB-inventaris (PDF)** en **Invoerlijst (Excel)**: oppervlaktes per richting, U-waarden, volume, bron, aantal foto's. Er staat nergens een EPC-score.
- [ ] **Energiedeskundige:** is de invoerlijst bruikbaar voor de officiële software? Welke meetregels moeten anders (buitenafmetingen)? Kloppen de richtwaarden voor λ, Ug en Uf?

## 12. Ventilatie (ventilatie-expert)

- [ ] **Installaties** → **Ventilatie** → kies het systeem (A, B, C of D).
- [ ] De tabel **Debieten** toont per ruimte de functie (uit de naam afgeleid). Pas een functie aan (bv. slaapkamer → badkamer): het debiet past zich aan.
- [ ] Plaats de **ventilatie-unit**, **toevoerventielen** (droge ruimtes) en **afvoerventielen** (natte ruimtes); bij systeem C **roosters** (RTO) in de droge ruimtes.
- [ ] De kanalen verschijnen op het plan met diameter (Ø). De aandachtspunten tonen wat nog ontbreekt en de doorstroomopeningen.
- [ ] **Installaties (PDF)**: ventilatieblad met kanalen, debietentabel, kanalen, materiaallijst en aandachtspunten.
- [ ] **Lastenboek**: groep **Ventilatie** (unit, ventielen, kanalen per diameter, bochten, doorvoeren, geluiddempers).
- [ ] **Ventilatie-expert:** kloppen de debieten (NBN D 50-001), de doorstroomopeningen, de kanaaldiameters (luchtsnelheid)? Wat moet erbij voor het ventilatieverslag?

## 13. Keuken en maatwerk (keukenbouwer, meubelmaker)

- [ ] **Keuken**: tik in het plan dicht bij een wand. De wand wordt rood (W1, W2 …) en het wandaanzicht verschijnt met ramen, deuren en installatiepunten.
- [ ] **Precisiemeting** met de laser: de lengte op 3 hoogtes, de hoeken uit haaks, het verschil in de vloer en de muur uit het lood. Bij verschillen verschijnt een opmerking (plannen met de kleinste maat).
- [ ] **Wand vullen**:
  - onder- en bovenkasten in modules, met een hoge kast;
  - een passtuk tot de gemeten breedte;
  - het werkblad met naad en uitsparingen.
- [ ] Een kast aantikken → schuiven, breedte, functie, verwijderen. **+ Kast** voegt een kast toe aan het einde.
- [ ] **Aansluitingen** toevoegen (radiator, water, afvoer, gas, stopcontact). De opmerkingen verwijzen ernaar:
  - een spoelbak zonder afvoer;
  - een kookplaat zonder kring of gas;
  - een kast voor een raam of radiator.
- [ ] **Wandaanzichten (PDF)** op schaal (meet een maat na op de afdruk), **Kasten- en snijlijst (Excel)**, **Wandaanzicht (DXF)** (openen in je CAD-programma).
- [ ] **Keukenbouwer:**
  - Klopt de vereenvoudigde kastopbouw?
  - Kloppen de standaardmaten (plint 100, kast 720, werkblad 38/620, bovenkast op 1450)?
  - Is de werkbladlengte van max. 3 m juist?
  - Wat heb je nodig voor je eigen software?

## 14. Liggers en stabiliteit uitbreiden (ingenieur)

- [ ] Maak een project met 2 verdiepingen. **Liggers** → tik een opening aan → **+ Nieuwe ligger** → **Lasten uit het model**:
  - de muur boven de opening;
  - de muren erboven;
  - de vloeren en het dak met hun invloedsbreedte.

  Kloppen de aannames (vloer draagt af op deze muur)?
- [ ] **+ Puntlast**: een balk die op de ligger rust (kN en afstand vanaf links). Het voorstel past zich aan.
- [ ] **Tweede overspanning**: een doorgaande ligger over een tussensteun. De reactie op de tussensteun verschijnt.
- [ ] **Metselwerk f_d** ingeven: de controle "Oplegging metselwerk" en het advies voor een oplegblok verschijnen.
- [ ] De controles **Lijf (oplegging)** en, bij een doorgaande ligger, **Lijf (tussensteun)** verschijnen (lijfstuik/lijfplooi).
- [ ] **+ Kolom**: kniklengte, belasting of de reactie van een ligger → voorstel HEA/HEB.
- [ ] **Rekennota (PDF)**:
  - schema;
  - puntlasten;
  - reacties per steunpunt;
  - kolommen;
  - "niet voor uitvoering" en het aftekenvak.
- [ ] **Ingenieur:**
  - Klopt de patroonbelasting bij een doorgaande ligger?
  - Klopt lijfstuik/lijfplooi volgens EN 1993-1-5?
  - Zijn de knikkrommen juist?
  - Is de lastendaling uit het model bruikbaar?

## 15. Architect: vergunningsklare basis

- [ ] **Ontwerp → Dak**: plat, zadeldak of lessenaarsdak, met helling, nokrichting, overstek en materiaal. De nokhoogte verschijnt; het dak staat in de doorsneden, de gevels en in **3D** (Inrichting → 3D bekijken).
- [ ] **Trap**: kies "Trap" boven het plan en tik twee punten (vertrek, looprichting). Kijk na:
  - de treden en de pijl op het plan;
  - de comfortregel (2·o + a);
  - de melding als er geen trapgat boven de trap is;
  - de trap in een doorsnede langs de trap.
- [ ] **Terrein en inplanting**: perceel als rechthoek (breedte, diepte, afstand tot de straat en tot de linkergrens), maaiveld, straat → afstanden tot de grenzen.
- [ ] **Ruimtes nieuwe toestand**:
  - breek een tussenmuur af en/of teken een nieuwe muur van wand tot wand → **Ruimtes nieuwe toestand indelen** → namen aanpassen;
  - in de meetstaat **Nieuwe toestand** kiezen.
- [ ] **Gegevens vergunningsplan**: bouwheer, architect, kadaster, plan nr., gevelmaterialen per zijde.
- [ ] **Opmerking**: kies "Opmerking" en tik in het plan. De pin blijft zichtbaar in Plan en Ontwerp en reist mee via de cloud of de deellink. Probeer met een tweede toestel.
- [ ] **Vergunningsklare basis (PDF)**:
  - inplantingsplan;
  - plannen bestaand en nieuw per verdieping;
  - doorsneden en gevels met dak, maaiveld en materialen;
  - lijst met gegevens, afstanden, ruimtes, trappen, legende en handtekeningvakken.
- [ ] **Architect:**
  - Is dit een bruikbare basis voor het vergunningsdossier?
  - Wat ontbreekt er in titelblok, legende, maatvoering of de stedenbouwkundige gegevens?

## 16. Verwarming en energie (installateur)

- [ ] **Installaties → Verwarming**:
  - kies de ontwerpbuitentemperatuur (bv. −7 °C, kouder in de Ardennen) en het regime (45/35 warmtepomp, 75/65 ketel);
  - het warmteverlies per ruimte verschijnt (W en W/m²).
- [ ] Ruimtes met een sterretje (*) gebruiken een aangenomen U-waarde. Vul bij **Energie** de samenstelling in: het verlies wordt nauwkeuriger.
- [ ] Per ruimte **radiator** of **vloer**: het radiatorvermogen (ΔT50) bij het gekozen regime, en een opmerking als vloerverwarming te weinig vermogen geeft.
- [ ] **Warmtepomp** en **buffervat**: het voorgestelde vermogen. Plaats de warmtepomp (binnen/buiten), het buffervat, radiatoren of de collector op het plan.
- [ ] **Zonnepanelen** (stel eerst een dak in bij Ontwerp): aantal panelen per dakvlak, richting, kWp en indicatieve opbrengst. Vergelijk met PVGIS.
- [ ] **Installaties (PDF)**: tabel warmteverlies, warmtepomp, buffervat, zonnepanelen, methode.
- [ ] **Installateur:**
  - Kloppen de binnentemperaturen en de temperatuurcorrecties?
  - Klopt de ventilatie-aanname?
  - Is de warmtepompraming (+10 %, zonder sanitair warm water) en de buffervuistregel juist?

## 17. Werfopvolging en offerte (aannemer)

- [ ] **Werf**: tik een ruimte aan → **Werffoto nemen** (camera van de gsm). De foto krijgt datum en ruimte; voeg een bijschrift toe.
- [ ] **Op te volgen**: punten per ruimte toevoegen en afvinken.
- [ ] **Vorderingsstaat**:
  - geef eerst prijzen in het lastenboek;
  - **Eerste vorderingsstaat beginnen** → percentage per post → bedrag van deze staat;
  - **Afsluiten en nieuwe staat**: de vorige percentages blijven staan;
  - **Vorderingsstaat (PDF)**.
- [ ] **Offerte**: firmagegevens en **logo** (blijven op dit toestel), klant, btw 21 % of 6 % (met de voorwaarden voor 6 %), geldigheid, betalingsvoorwaarden → **Offerte (PDF)**. Controleer de opmaak en de totalen.
- [ ] **Laser**: knop **Laser** bovenaan → **Verbinden** met een Leica DISTO (Chrome op Android). Tik in een maatveld en meet: de maat komt erin. Werkt het met jouw laser? Op iPhone kan het niet; de app legt uit waarom.
- [ ] **Aannemer:**
  - Is de offerte zo bruikbaar voor je klanten?
  - Wat ontbreekt er (algemene voorwaarden, voorschotfactuur, meerwerken)?
  - Klopt de tekst over 6 % (laten nakijken door je boekhouder)?

## F1-1. Sneller laden

- [ ] Open de app op de gsm (4G, niet op wifi): verschijnt het plan sneller dan vroeger?
- [ ] Tik elke modus één keer aan (Installaties, Ontwerp, Liggers, Inrichting, Energie, Keuken, Werf): even "Laden…" is normaal, daarna moet alles werken zoals vroeger.
- [ ] Maak één PDF per modus (de eerste keer duurt het een tel langer, de PDF-maker wordt dan geladen).
- [ ] Knop **Cloud** en knop **3D** openen nog.

## F1-2. Offline werken

- [ ] **Eén keer** (in Supabase): voer `supabase/migrations/0002_fotos.sql` uit in de SQL Editor (zie docs/cloud-instellen.md, stap 3).
- [ ] **Installeren**: open de app in Chrome op Android → menu ⋮ → **App installeren** (of "Toevoegen aan startscherm"). Op iPhone: Safari → Deel → **Zet op beginscherm**. Het icoon verschijnt op je startscherm.
- [ ] **Zonder netwerk**: open de app één keer met netwerk, zet daarna de vliegtuigmodus aan en open de app opnieuw. Je ziet "Offline: de app werkt gewoon verder". Tik elke modus aan en maak een PDF.
- [ ] **Wachtende wijzigingen** (project in de cloud): in vliegtuigmodus iets wijzigen → knop bovenaan wordt **Offline: wijzigingen wachten**. Vliegtuigmodus uit → binnen enkele seconden **Cloud: bewaard**. Open het project op de pc: de wijziging staat erin.
- [ ] **Foto's in de cloud**: neem een werffoto op de gsm (mag offline). Zodra er netwerk is, gaat ze mee. Open het project op de pc: de foto verschijnt (ook na een tel wachten).
- [ ] Sluit de app terwijl er wijzigingen wachten en open ze later met netwerk: de wijzigingen gaan alsnog mee.
- [ ] Eerste keer openen zonder netwerk (nooit eerder geopend): de app kan niet starten; dat is normaal. Een modus die niet geladen raakt, toont een melding met **Opnieuw laden** i.p.v. een leeg scherm.

## F1-3. Bluetooth-lasers

- [ ] **Leica DISTO** (Chrome op Android): knop **Laser** → **Verbinden** → kies de DISTO. Je ziet "Verbonden met een Leica DISTO". Tik in een maatveld en meet: de maat komt erin (in mm).
- [ ] **Bosch GLM 50 C / 100 C**: zelfde werkwijze. Je ziet "Verbonden met een Bosch GLM". Komt elke meting door? Ook na 5 metingen na elkaar?
- [ ] Controleer 3 metingen per laser met een rolmeter: verschil?
- [ ] Laser uitzetten en weer aanzetten: knop wordt weer **Laser**; opnieuw verbinden lukt.
- [ ] **Hilti** of een ander merk: de app legt uit waarom het (nog) niet kan (knop Laser → "Andere merken en iPhone").
- [ ] Noteer merk, model en wat er misloopt: zo kan ik het protocol bijsturen.

## F1-4. Werfdagboek en meer- en minwerken

- [ ] **Werf → Dagboek**: kies een datum, vul weer, ploeg, uren, uitgevoerd werk, leveringen, bezoekers en problemen in. Neem een foto. Ga naar een andere dag en terug: alles staat er nog.
- [ ] Vink **Verlet** aan bij een dag zonder werk (vorst, regen): de teller "verlet" telt mee.
- [ ] **Werfdagboek (PDF)**: alle dagen met hun foto's (max. 4 per dag). Is dit bruikbaar voor jou, je klant of bij een geschil over termijnen?
- [ ] **Werf → Meer- en minwerk**: voorstel maken (meerwerk +, minwerk −). **Akkoord** vraagt de naam van de klant. **Geweigerd** vraagt een reden.
- [ ] **Bon (PDF)**: omschrijving, bedrag, btw en handtekeningvakken voor klant en aannemer. Laat de klant de bon tekenen; het akkoord in de app is geen handtekening.
- [ ] **Vordering en offerte**: het akkoord meerwerk staat als post **MW1** in de vorderingsstaat; vul een percentage in en controleer het bedrag. Een minwerk telt negatief.
- [ ] Na het afsluiten van een vorderingsstaat kan je een akkoord niet meer terugdraaien (maak dan een minwerk).
- [ ] **Aannemer:** ontbreken er velden in het dagboek (bv. materieel, onderaannemers, veiligheid)? Moet de bon andere tekst hebben?

## F1-5. Facturen

- [ ] **Werf → Vordering en offerte → Firmagegevens**: vul naam, adres, btw-nummer, IBAN (en eventueel BIC) in.
- [ ] **Werf → Facturen**: zonder gegevens toont **Factuur opmaken** wat er ontbreekt.
- [ ] **Voorschotfactuur** 30 % (6 % btw): controleer bedrag, btw, de vermelding voor 6 % en de vervaldatum.
- [ ] **Betaal-QR**: open de PDF op de pc en scan de QR met je bankapp (KBC, Belfius, BNP, ING, Argenta …). Staan bedrag, rekening en mededeling juist ingevuld? **Niet echt betalen.**
- [ ] **Factuur bij een vorderingsstaat**: het voorschot wordt pro rata verrekend (regel "Verrekening voorschot").
- [ ] **Eindfactuur**: samen met de vorige facturen precies het bedrag van de aanneming (offerte + meerwerken met akkoord); het rest-voorschot wordt verrekend.
- [ ] **Btw verlegd**: vraagt het btw-nummer van de klant; op de factuur staat "Verlegging van heffing".
- [ ] **Creditnota**: bedrag en reden; telt negatief.
- [ ] **Nummering**: 2026-001, 2026-002 … ook als je in een ander project factureert (op hetzelfde toestel). Alleen de laatste factuur kan je verwijderen.
- [ ] **Boekhouder:** kloppen de vermeldingen (6 %, verlegd), de nummering en de opbouw voorschot/vordering/eind? Ontbreekt er iets (bv. KBO-nummer, RPR, algemene voorwaarden)?
