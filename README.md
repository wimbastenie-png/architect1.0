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
- **Bewerken**: ramen/deuren wijzigen en verplaatsen, ook naar een andere muur (keuzelijst met leesbare muurnamen); **slepen** in het plan: een muur haaks verschuiven of een raam/deur naar een andere plaats of muur (stappen van 10 mm, live voorbeeld; op de gsm eerst de muur aantikken); tussenmuur uitbreken (twee ruimtes van elke haakse vorm → één, bv. L-vorm, met waarschuwing over stabiliteit); muur verschuiven (positie corrigeren); ruimte verwijderen; muurstukken die recht doorlopen worden automatisch terug één muur; sparing in de vloer (trapgat, vide, schacht) toevoegen, verplaatsen, vergroten, afgetrokken van die vloer en van het plafond eronder; notities per ruimte en per project (op het lijstenblad van de PDF).
- **Prijzen**: eenheidsprijs per post, onthouden op het toestel; raming met btw-tarief naar keuze (21/12/6/0 %); prijzen mee in Excel, kopie en PDF.
- **Opmeten met de camera** (Chrome op Android met ARCore, via WebXR): hoeken van de vloer aantikken → haaks maken → plan. Op iPhone en pc niet beschikbaar. Demo zonder camera: `?ar-demo` achter het webadres.
- **Lastenboek-meetstaat**: posten per ruimte (vloer, plinten, pleister- en schilderwerk wanden/plafond, dagkanten, vensterbanken, buitenschrijnwerk, binnendeuren); "Kopiëren voor offerte" (plakken in offerte of Excel) en export naar Excel met kolommen eenheidsprijs en totaal.
- Meetstaat live; export naar PDF, DXF, CSV (Excel) en projectbestand (JSON).
- Ongedaan maken (ook Ctrl+Z) en automatisch bewaren in de browser.

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
npm test            # 83 tests
npm run web         # webapp lokaal starten
npm run voorbeeld   # voorbeelduitvoer
```

## Bekende beperkingen van v0.1

- Wandoppervlak gebruikt de binnencontour × plafondhoogte; dagkanten (neggen) van ramen en deuren zitten er nog niet in.
- Muren meeschuiven werkt voor rechte, haakse plannen; schuine muren en bogen zijn nog niet getest.
- Maatkettingen alleen voor haakse gevels; schuine gevels krijgen één eigen maatlijn. Hulplijnen vertrekken aan het buitenste gevelvlak op die plaats; bij een insprong gaan ze niet tot in de inham.
- Lastenboek: eigen postindeling, niet de nummering van Standaardbestek 250. Dagkanten in lopende meter zonder diepte; plafond = vloer (geen schuine plafonds); geen trappen, gevels, daken of buitenwerk.
- Verdiepingen: geen controle dat muren boven elkaar staan; een kopie neemt geen ramen/deuren en sparingen over.
- Sparingen zijn rechthoekig en liggen volledig in één ruimte; een trapgat over twee ruimtes kan niet.
- Muur uitbreken en verschuiven: enkel bij haakse plannen (geen schuine muren). Een muur die recht doorloopt in een andere muur kan niet apart verschuiven (dat zou een knik geven). Slepen gaat in stappen van 10 mm; voor een exacte maat geef je de afstand in.
- Camera-opmeting: **niet getest op een echt toestel**; alleen de verwerking van de punten is getest (unit- en browsertests met testpunten). Hoogte wordt niet gemeten (zelf ingeven). Enkel haakse ruimtes; schuine muren worden geweigerd. Werkt niet op iPhone (Safari ondersteunt WebXR AR niet).
- Prijzen staan alleen op het toestel waarop je ze ingaf (geen account/synchronisatie).
- Ruimtes zijn rechthoekig en worden haaks tegen een bestaande muur gezet. Schuine muren, L-vormige ruimtes en een ruimte die tegen twee bestaande ruimtes tegelijk komt (bv. een hoek opvullen) kunnen nog niet.
- Bij een aanbouw tegen een gevel kunnen gevelmaten en maten van de aanbouw elkaar kruisen; maatlijnen worden nog niet automatisch in rijen geschikt.
- Nog geen IFC-export.
- PDF gebruikt de standaardletter Helvetica: tekens buiten West-Europese talen (bv. Pools, Grieks) worden nog niet ondersteund.

## Werftest

Zie [`docs/werftest.md`](docs/werftest.md): stappenplan en invulblad om de app op een echte woning te testen.

## Volgende stappen

1. Werftest uitvoeren met `docs/werftest.md` en de bevindingen verwerken.
2. Camera-opmeting testen op Android-toestellen en verfijnen (hoogte meten, schuine muren, meerdere ruimtes na elkaar).
3. Omzetting RoomPlan-uitvoer (iPhone/iPad Pro met LiDAR) → dit projectformaat; vraagt een echt scanbestand.
4. Eenvoudige IFC-export.
