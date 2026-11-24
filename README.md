# Scan-app

App die een ruimte scant met de gsm en er een bemaat plan, meetstaat en
exportbestanden (PDF/DXF/IFC) van maakt. Zie het plan in het document
"Scan-app: analyse en MVP-plan".

## Wat er nu is (stap 1: de kern)

`packages/core` — gedeelde rekenkern voor gsm-app, webversie en server:

| Bestand | Wat het doet |
| --- | --- |
| `src/schema.ts` | Projectformaat v0.1: verdiepingen, muren, openingen, ruimtes. Alles in hele mm; elke maat onthoudt hoe ze gemeten is (gescand / gecorrigeerd / laser / manueel). Validatie van structuur én samenhang. |
| `src/geometrie.ts` | Oppervlakte, omtrek, wandvlakken. Muurlengte aanpassen zoals in CAD: haakse muren schuiven mee, het plan blijft gesloten. |
| `src/meetstaat.ts` | Meetstaat per ruimte (vloer, volume, wand bruto/netto) en CSV voor Belgische Excel (`;` en decimale komma). |
| `src/dxf.ts` | DXF-export (R12, mm) met lagen MUREN, OPENINGEN, RUIMTES, MATEN, TEKST. Getest met ezdxf: 0 fouten. |
| `src/pdf.ts` | PDF-plannen: één blad per verdieping op vaste schaal (1:50, 1:100 of 1:200; A4 of A3, automatisch gekozen), met titelblok, schaalstok om de afdruk te controleren, legende van de meetbronnen en disclaimer. |
| `src/svg.ts` | Planvoorbeeld. Maatkleur toont de meetbron: oranje = gescand, blauw = gecorrigeerd, groen = laser. |
| `examples/` | Voorbeeldappartement; `npm run voorbeeld` schrijft JSON, CSV, DXF, SVG en PDF naar `packages/core/uitvoer/`. |

## Gebruiken

```bash
npm install
npm test            # 15 tests
npm run voorbeeld   # voorbeelduitvoer
```

## Bekende beperkingen van v0.1

- Wandoppervlak gebruikt de binnencontour × plafondhoogte; dagkanten (neggen) van ramen en deuren zitten er nog niet in.
- Muren meeschuiven werkt voor rechte, haakse plannen; schuine muren en bogen zijn nog niet getest.
- Maatlijnen alleen voor buitenmuren; binnenmaten staan als tekst in rechthoekige ruimtes.
- Nog geen IFC-export.
- PDF gebruikt de standaardletter Helvetica: tekens buiten West-Europese talen (bv. Pools, Grieks) worden nog niet ondersteund.

## Volgende stappen

1. Omzetting RoomPlan-uitvoer (`CapturedRoom` JSON) → dit projectformaat.
2. Expo-app met planweergave en maat aanpassen.
3. Eenvoudige IFC-export.
