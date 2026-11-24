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
| `src/uitbreiden.ts` | Ruimte tegen een bestaande muur zetten: muur splitsen, openingen verhuizen, gedeelde muren hergebruiken, overlap weigeren. |
| `src/sjablonen.ts` | Nieuw project uit binnenmaten (rechthoekige ruimte). |
| `src/meetstaat.ts` | Meetstaat per ruimte (vloer, volume, wand bruto/netto) en CSV voor Belgische Excel (`;` en decimale komma). |
| `src/dxf.ts` | DXF-export (R12, mm) met lagen MUREN, OPENINGEN, RUIMTES, MATEN, TEKST. Getest met ezdxf: 0 fouten. |
| `src/pdf.ts` | PDF-plannen: één blad per verdieping op vaste schaal (1:50, 1:100 of 1:200; A4 of A3, automatisch gekozen), met titelblok, schaalstok om de afdruk te controleren, legende van de meetbronnen en disclaimer. |
| `src/svg.ts` | Planvoorbeeld. Maatkleur toont de meetbron: oranje = gescand, blauw = gecorrigeerd, groen = laser. |
| `examples/` | Voorbeeldappartement; `npm run voorbeeld` schrijft JSON, CSV, DXF, SVG en PDF naar `packages/core/uitvoer/`. |

## Gebruiken

```bash
npm install
npm test            # 30 tests
npm run web         # webapp lokaal starten
npm run voorbeeld   # voorbeelduitvoer
```

## Bekende beperkingen van v0.1

- Wandoppervlak gebruikt de binnencontour × plafondhoogte; dagkanten (neggen) van ramen en deuren zitten er nog niet in.
- Muren meeschuiven werkt voor rechte, haakse plannen; schuine muren en bogen zijn nog niet getest.
- Maatlijnen tonen buitenmaten (tot de hartlijn van een aansluitende tussenmuur); binnenmaten staan als tekst in rechthoekige ruimtes. Nog geen maatketting voor openingen.
- Ruimtes zijn rechthoekig en worden haaks tegen een bestaande muur gezet. Schuine muren, L-vormige ruimtes en een ruimte die tegen twee bestaande ruimtes tegelijk komt (bv. een hoek opvullen) kunnen nog niet.
- Bij een aanbouw tegen een gevel kunnen gevelmaten en maten van de aanbouw elkaar kruisen; maatlijnen worden nog niet automatisch in rijen geschikt.
- Nog geen IFC-export.
- PDF gebruikt de standaardletter Helvetica: tekens buiten West-Europese talen (bv. Pools, Grieks) worden nog niet ondersteund.

## Volgende stappen

1. Maatketting op rijen (gevelmaten buiten de aanbouwen) en maten van ramen/deuren.
2. Android: begeleid opmeten met ARCore (hoeken aantikken) → dit projectformaat.
3. Omzetting RoomPlan-uitvoer (iPhone/iPad Pro met LiDAR) → dit projectformaat; vraagt een echt scanbestand.
4. Eenvoudige IFC-export.
