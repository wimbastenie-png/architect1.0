# Testronde: de hele app overlopen

Eén volledige ronde door de app, in de volgorde waarin je ze op een echte opdracht gebruikt. Reken op vier sessies:

| Sessie | Waar | Duur | Wat |
| --- | --- | --- | --- |
| A | thuis, pc en gsm | ± 1 uur | installeren, plan, alle modi, PDF's |
| B | thuis, gsm en pc | ± 45 min | cloud, offline, laser, facturen |
| C | op een echte werf | 1 à 2 uur | opmeten, controlemetingen, werfdagboek |
| D | met vakmensen | per afspraak | nalezen wat een vakman moet aftekenen |

**Hoe:** vink af wat werkt (`[x]`). Werkt iets niet, schrijf dan kort op: **toestel**, **wat je deed**, **wat je zag** (liefst met een schermafdruk). Meer uitleg per onderdeel staat in [testlijst.md](testlijst.md) (de nummers tussen haakjes verwijzen daarnaar).

Overal geldt: de app bereidt voor, een bevoegde vakman controleert en tekent af. Nergens mag "conform" als oordeel staan. Zie je dat toch, meld het.

---

## Sessie A: plan en alle modi (pc en gsm)

**Starten**
- [ ] Open https://wimbastenie-png.github.io/architect1.0/ op de pc en op de gsm. Onderaan staat de versie; bij een nieuwe versie verschijnt een balk **Nieuwe versie**.
- [ ] Gsm: zet de app op je startscherm (Chrome ⋮ → **App installeren**; iPhone: Deel → **Zet op beginscherm**) en open ze via het icoon. (F1-2)
- [ ] De app opent snel. Een modus die je voor het eerst opent, toont heel even "Laden…". (F1-1)

**Plan (opmeten)**
- [ ] **Nieuw** → project uit binnenmaten (breedte, diepte, hoogte) → plan verschijnt met maten.
- [ ] Muur aantikken → binnenmaat wijzigen, raam en deur toevoegen (afstand vanaf hoek A, breedte, hoogte, borstwering).
- [ ] Buitenmuur → **Ruimte hiernaast toevoegen**. Een muur schuin zetten door de hoek te slepen (gsm: ingedrukt houden).
- [ ] Zoomen (knoppen, muiswiel, twee vingers) en verschuiven; **Ongedaan maken**.
- [ ] **+ Verdieping** (kopie) en een trapgat (ruimte → **Sparing in de vloer**).
- [ ] Meetstaat **Per ruimte** en **Lastenboek**: geef een paar eenheidsprijzen in.
- [ ] Exports: **PDF-plan** (meet één maat na op de afdruk op 100 %), **DXF (CAD)**, **Meetstaat (Excel)**, **Lastenboek (Excel)**, **IFC (BIM)** (4), **Projectbestand**, **Delen (link)**.

**Installaties** (5, 12, 16)
- [ ] Elektriciteit: verdeelbord, stopcontacten, lichtpunten, schakelaars → kringen en eendraadschema.
- [ ] Sanitair, gas (gele waarschuwing), ventilatie (systeem, debieten), verwarming (warmteverlies, radiatoren of vloerverwarming, warmtepomp, zonnepanelen).
- [ ] **Installaties (PDF)**: alle netten, met de waarschuwingen op elk blad.

**Ontwerp** (6, 15)
- [ ] Muur afbreken (geel), nieuwe muur (rood), raam dichtmaken, nieuwe opening.
- [ ] Bestaand / Nieuw / Verbouwing; doorsnede en gevels; dak, trap en terrein.
- [ ] **Ontwerp (PDF)** en **Vergunningsklare basis (PDF)** met legende en titelblok.
- [ ] Opmerking (pin) op het plan zetten.

**Liggers** (7, 14)
- [ ] Opening aantikken → **+ Nieuwe ligger** → lasten met hulp → profielvoorstel → **Rekennota (PDF)** met "Niet voor uitvoering" en aftekenvak.

**Inrichting** (9)
- [ ] Meubels plaatsen, draaien, verplaatsen; vloer- en wandmateriaal.
- [ ] **3D bekijken** (draaien, vogelvlucht, binnen), **Beeld (PNG)** en **3D-bestand (GLB)**.

**Energie** (11)
- [ ] Noordpijl, samenstelling van muren/vloer/dak, ramen (Ug, Uf), beschermd volume, bewijsfoto.
- [ ] **Invoerlijst (Excel)** en **EPB-inventaris (PDF)**: geen EPC-score, geen oordeel.

**Keuken** (13)
- [ ] Wand aantikken → precisiemeting → **Wand vullen** → kasten aanpassen → aansluitingen.
- [ ] **Wandaanzichten (PDF)**, **Kasten- en snijlijst (Excel)**, **Wandaanzicht (DXF)**.

**Werf** (17, F1-4 … F1-7)
- [ ] *Foto's en punten*: werffoto per ruimte, opvolgpunt afvinken.
- [ ] *Dagboek*: een dag invullen met foto → **Werfdagboek (PDF)**.
- [ ] *Meer- en minwerk*: voorstel → **Akkoord** (naam klant) → **Bon (PDF)**.
- [ ] *Vordering en offerte*: firmagegevens en logo, **Offerte (PDF)**, vorderingsstaat met de meerwerkpost MW1 → **Vorderingsstaat (PDF)**.

## Sessie B: cloud, offline, laser en facturen

**Cloud** (8)
- [ ] Supabase ingesteld volgens [cloud-instellen.md](cloud-instellen.md), **ook stap 3** (`0002_fotos.sql`).
- [ ] Gsm: aanmelden (link in de mail op de gsm openen) → **Bewaren in de cloud**. Pc: aanmelden → project **Openen**.
- [ ] Wijziging op de gsm verschijnt op de pc (bij openen of binnen 30 s). Een werffoto van de gsm verschijnt op de pc.
- [ ] **Delen** met een tweede e-mailadres (alleen bekijken): die persoon kan niet bewaren.

**Offline** (F1-2)
- [ ] Vliegtuigmodus aan → app openen via het icoon → alle modi en een PDF werken.
- [ ] Iets wijzigen en een foto nemen → knop **Offline: wijzigingen wachten** → vliegtuigmodus uit → **Cloud: bewaard**, en op de pc staat alles.

**Laser** (F1-3)
- [ ] Chrome op Android → **Laser** → **Verbinden** met je Leica DISTO of Bosch GLM → in een maatveld tikken en meten: de maat komt erin.
- [ ] Controleer 3 metingen met de rolmeter.

**Facturen en boekhouding** (F1-5, F1-6)
- [ ] Firmagegevens met IBAN en btw-nummer. *Facturen*: voorschotfactuur (6 %) → controleer bedrag, vermelding 6 % en vervaldatum.
- [ ] **Scan de betaal-QR** met je bankapp: bedrag, rekening en mededeling juist? (niet betalen)
- [ ] Factuur bij een vorderingsstaat (voorschot pro rata verrekend), eindfactuur, creditnota, **betaald** aanvinken.
- [ ] Factuur voor een firma → **E-factuur (UBL)** → in je boekhoudpakket inlezen of laten valideren.
- [ ] *Boekhouding en groothandel*: klantenlijst en verkoopdagboek (CSV) in Excel; bestellijst met je artikelnummers → opladen in de webshop van je groothandel.

## Sessie C: op een echte werf

- [ ] Een echte woning opmeten volgens [werftest.md](werftest.md): met de laser, en op Android ook met de camera (2). Noteer wat traag of onhandig is.
- [ ] *Werf → Controlemetingen*: kies de opmeetmethode en meet **minstens 10 maten** na (muren, plafondhoogtes, ramen en deuren, een diagonaal) → **Nauwkeurigheidsrapport (PDF)**. (F1-7)
- [ ] Herhaal voor een tweede methode (bv. camera tegenover laser) en vergelijk de rapporten.
- [ ] Werfdagboek van die dag invullen op de gsm, met foto's.
- [ ] Hoe was het werken op de gsm in de zon, met handschoenen, met één hand?

## Sessie D: nalezen door vakmensen

Laat elk van hen één PDF van een geval dat ze kennen nalezen en noteer hun opmerkingen.

- [ ] **Ingenieur**: rekennota liggers en kolommen (7, 14).
- [ ] **Architect**: ontwerp- en vergunningsplan, IFC in hun software (4, 6, 15).
- [ ] **Installateur of keurder**: installaties-PDF, eendraadschema, ventilatie, verwarming (5, 12, 16).
- [ ] **Energiedeskundige**: EPB-invoerlijst (11).
- [ ] **Keukenbouwer**: wandaanzichten en snijlijst (13).
- [ ] **Boekhouder**: facturen (6 %, verlegd, nummering), e-factuur, CSV's (F1-5, F1-6).
- [ ] **Jij als aannemer**: lastenboek, offerte, vorderingsstaat, dagboek, meerwerkbon (10, 17, F1-4).

---

## Wat jij moet regelen (fase 1)

| Wat | Waarom | Status |
| --- | --- | --- |
| Supabase-project (EU) + de twee repo-variabelen, en `0002_fotos.sql` uitvoeren | Cloud, gsm en pc gelijk, foto's in de cloud | ☐ |
| Je lasers om te testen (Leica DISTO, Bosch GLM 50 C/100 C) | De protocollen zijn niet getest met een echt toestel | ☐ |
| Naam van je **boekhoudpakket** en je **groothandel** | Dan stem ik de CSV-kolommen af, of bouw ik een rechtstreekse koppeling | ☐ |
| Je **boekhouder** de factuurteksten laten nakijken (6 %, verlegd, nummering) | Fiscale vermeldingen | ☐ |
| Een contract met een **Peppol-toegangspunt** (of via je boekhoudpakket) | E-facturen echt versturen, en de eerste laten valideren | ☐ |
| **Partners**: ingenieur, architect, installateur/keurder, energiedeskundige | Controleren en aftekenen | ☐ |
| **Juridisch**: algemene voorwaarden, privacyverklaring, verwerkersovereenkomst met Supabase, verzekering beroepsaansprakelijkheid | Vóór je de app aan klanten geeft | ☐ |

## Wat je terugstuurt

Per sessie: wat werkt, wat niet (toestel, wat je deed, wat je zag, schermafdruk), en wat je het eerst verbeterd wil zien. Daarna overlopen we alles en verbeter ik het, vóór we aan fase 2 (BIM-kern en exports) beginnen.
