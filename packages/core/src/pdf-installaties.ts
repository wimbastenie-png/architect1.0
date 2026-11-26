/**
 * PDF met de installaties: per verdieping en per net een planblad met
 * symbolen en leidingen, daarna het eendraadschema (voorstel), de kringen,
 * de materiaallijst en de aandachtspunten. Is er gas, dan staat de verplichte
 * gaswaarschuwing op ELK blad.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type RGB } from "pdf-lib";
import {
  aandachtspunten, kringenVoorstel, GAS_WAARSCHUWING, INSTALLATIE_DISCLAIMER, leidingen, materiaallijst, soortDef,
  type Kring, type LeidingSoort, type Net,
} from "./installaties.ts";
import { lijstBladen } from "./pdf-lijst.ts";
import { systeemVan, VENT_KLEUR, ventilatieAandachtspunten, ventilatieDebieten, ventilatieKanalen, ventilatieMateriaal, VENTILATIE_DISCLAIMER } from "./ventilatie.ts";
import { kiesBlad, pdfTekst, PT, tekenBlad, type Fonts, type PdfOpties } from "./pdf.ts";
import type { InstallatiePunt, Project, Punt } from "./schema.ts";

const hex = (k: string): RGB => { const h = k.length === 4 ? `#${k[1]}${k[1]}${k[2]}${k[2]}${k[3]}${k[3]}` : k; return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255); };
const KLEUR: Record<LeidingSoort | "elektriciteit" | "sanitairPunt", RGB> = {
  koud: hex("#2563eb"), warm: hex("#dc2626"), afvoer: hex("#78716c"), gas: hex("#ca8a04"), elektriciteit: hex("#7c3aed"), sanitairPunt: hex("#0369a1"),
};
const WIT = rgb(1, 1, 1), ZWART = rgb(0.16, 0.15, 0.14), GRIJS = rgb(0.34, 0.33, 0.31);

const NAAM: Record<Net, string> = { elektriciteit: "Elektriciteit", sanitair: "Sanitair", gas: "Gas", ventilatie: "Ventilatie" };

export async function installatiesNaarPDF(p: Project, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — installaties (voorstel)`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  const metGas = p.verdiepingen.some((v) => v.installaties.some((x) => x.net === "gas"));
  const disclaimer = metGas ? `${GAS_WAARSCHUWING} ${INSTALLATIE_DISCLAIMER}` : INSTALLATIE_DISCLAIMER;
  const o = { ...opties, datum, disclaimer };
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];
  const kringcode = new Map<string, string>();
  const kringen = kringenVoorstel(p);
  for (const k of kringen) for (const x of k.punten) kringcode.set(x.punt.id, k.code);
  const ld = leidingen(p);

  const kanalen = ventilatieKanalen(p);
  for (const net of ["elektriciteit", "sanitair", "gas", "ventilatie"] as Net[]) {
    for (const v of p.verdiepingen) {
      const punten = v.installaties.filter((x) => x.net === net);
      if (!punten.length) continue;
      const legende: Array<[RGB, string]> = net === "elektriciteit"
        ? [[KLEUR.elektriciteit, "Punten met kringcode (K1 …)"], [ZWART, "Symbolen: zie lijst"]]
        : net === "sanitair"
          ? [[KLEUR.koud, "Koud water"], [KLEUR.warm, "Warm water"], [KLEUR.afvoer, `Afvoer (helling, zie lijst)`]]
          : net === "ventilatie"
            ? [[hex(VENT_KLEUR.toevoer), "Toevoerkanaal"], [hex(VENT_KLEUR.afvoer), "Afvoerkanaal"], [ZWART, `Systeem ${systeemVan(p)}`]]
            : [[KLEUR.gas, "Gasleiding (geel)"], [hex("#713f12"), "Afsluitkraan"]];
      titelblokken.push(tekenBlad(doc, f, p, v, o, {
        titel: `Installaties ${NAAM[net].toLowerCase()} (voorstel) — ${v.naam}`,
        disclaimer,
        legende,
        teken: ({ page, naar, schaal, lijn }) => {
          for (const l of ld) {
            if (l.verdiepingId !== v.id || (net === "gas") !== (l.soort === "gas") || net === "elektriciteit") continue;
            const verschuif = l.soort === "warm" ? 0.8 * schaal : l.soort === "koud" ? -0.8 * schaal : 0;
            for (let i = 1; i < l.pad.length; i++) {
              const a = { x: l.pad[i - 1]!.x + verschuif, y: l.pad[i - 1]!.y + verschuif }, b = { x: l.pad[i]!.x + verschuif, y: l.pad[i]!.y + verschuif };
              if (l.soort === "afvoer") streep(a, b, schaal, (x, y) => lijn(x, y, KLEUR.afvoer, 0.5));
              else lijn(a, b, KLEUR[l.soort], 0.35);
            }
            if (l.soort === "gas") kraan(page, naar, l.pad, schaal);
          }
          if (net === "ventilatie") for (const k of kanalen) {
            if (k.verdiepingId !== v.id) continue;
            for (let i = 1; i < k.pad.length; i++) lijn(k.pad[i - 1]!, k.pad[i]!, hex(VENT_KLEUR[k.soort]), 0.9);
          }
          for (const x of punten) symbool(page, f, naar(x.positie), x, kringcode.get(x.id));
        },
      }));
    }
  }

  const papier = kiesBlad(p.verdiepingen[0]!, opties).papier;
  const lijst = lijstBladen(doc, f, p, o, papier, "Installaties — schema en lijsten (voorstel)", ["Status", "Voorstel ter voorbereiding; na te kijken door installateur of keurder."]);
  if (kringen.length) {
    const blad = lijst.heelBlad("Eendraadschema elektriciteit (voorstel, vereenvoudigd)");
    tekenEendraadschema(blad.page, f, kringen, blad);
    lijst.kop("Kringen elektriciteit (voorstel)");
    lijst.tabel(
      [{ kop: "Kring", breedte: 12 }, { kop: "Omschrijving", breedte: 52 }, { kop: "Diff.", breedte: 14 }, { kop: "Autom.", breedte: 14 }, { kop: "Kabel", breedte: 16 }, { kop: "± m", breedte: 12, rechts: true }, { kop: "Punten", breedte: 14, rechts: true }],
      kringen.map((k) => [k.code, k.omschrijving, `${k.differentieel} mA`, `C ${k.automaat} A`, `3G${String(k.kabel).replace(".", ",")}`, String(k.kabelLengte).replace(".", ","), String(k.punten.length)]),
    );
  }
  const afv = ld.filter((l) => l.soort === "afvoer" || l.soort === "gas");
  if (ld.length) {
    lijst.kop("Leidingen (schets: haaks van bron naar toestel)");
    const naam = (id: string) => { for (const v of p.verdiepingen) { const x = v.installaties.find((y) => y.id === id); if (x) return soortDef(x.soort)?.naam ?? x.soort; } return id; };
    lijst.tabel(
      [{ kop: "Net", breedte: 14 }, { kop: "Naar", breedte: 44 }, { kop: "Ø mm", breedte: 12, rechts: true }, { kop: "Lengte m", breedte: 16, rechts: true }, { kop: "Helling", breedte: 16, rechts: true }, { kop: "Verval cm", breedte: 18, rechts: true }],
      ld.map((l) => [l.soort, naam(l.naar), String(l.diameter), (l.lengte / 1000).toFixed(1).replace(".", ","), l.helling ? `${l.helling} %` : "–", l.hoogteverschil !== undefined ? String(Math.round(l.hoogteverschil / 10)) : "–"]),
    );
    void afv;
  }
  const deb = ventilatieDebieten(p).filter((d) => d.toevoer || d.afvoer);
  if (p.verdiepingen.some((v) => v.installaties.some((x) => x.net === "ventilatie")) || p.ventilatie) {
    lijst.kop(`Ventilatie: debieten (systeem ${systeemVan(p)}, richtwaarden NBN D 50-001)`);
    lijst.tabel([{ kop: "Ruimte", breedte: 44 }, { kop: "Functie", breedte: 24 }, { kop: "m²", breedte: 14, rechts: true }, { kop: "Toevoer m³/h", breedte: 20, rechts: true }, { kop: "Afvoer m³/h", breedte: 20, rechts: true }, { kop: "Doorstr. cm²", breedte: 18, rechts: true }],
      deb.map((d) => [`${d.ruimte.naam} (${d.verdieping})`, d.functie, String(d.oppervlakte).replace(".", ","), d.toevoer ? String(d.toevoer) : "–", d.afvoer ? String(d.afvoer) : "–", String(d.doorstroom)]));
    if (kanalen.length) lijst.tabel([{ kop: "Kanaal", breedte: 24 }, { kop: "Debiet m³/h", breedte: 24, rechts: true }, { kop: "Ø mm", breedte: 18, rechts: true }, { kop: "Lengte m", breedte: 20, rechts: true }],
      kanalen.map((k) => [k.soort, String(k.debiet), String(k.diameter), (k.lengte / 1000).toFixed(1).replace(".", ",")]));
    for (const a of ventilatieAandachtspunten(p)) lijst.alinea(`${a.ernst === "let op" ? "LET OP" : "Info"} · Ventilatie: ${a.tekst}`, { kleur: a.ernst === "let op" ? rgb(0.6, 0.2, 0.05) : GRIJS });
    lijst.alinea(VENTILATIE_DISCLAIMER, { vet: true });
  }
  const mat = [...materiaallijst(p), ...ventilatieMateriaal(p).map((m) => ({ ...m, net: "ventilatie" as const }))];
  if (mat.length) {
    lijst.kop("Materiaallijst (schatting, na te meten)");
    lijst.tabel(
      [{ kop: "Net", breedte: 22 }, { kop: "Omschrijving", breedte: 86 }, { kop: "Eenh.", breedte: 12 }, { kop: "Hoev.", breedte: 14, rechts: true }],
      mat.map((m) => [NAAM[m.net], m.omschrijving, m.eenheid, String(m.hoeveelheid)]),
    );
  }
  const ap = aandachtspunten(p);
  if (ap.length) {
    lijst.kop("Aandachtspunten — geen keuring, na te kijken door installateur of keurder");
    for (const a of ap) lijst.alinea(`${a.ernst === "let op" ? "LET OP" : "Info"} · ${NAAM[a.net]}: ${a.tekst}`, { vet: a.ernst === "let op" && a.net === "gas", kleur: a.ernst === "let op" ? rgb(0.6, 0.2, 0.05) : GRIJS });
  }
  lijst.kop("Symbolen");
  const gebruikt = [...new Set(p.verdiepingen.flatMap((v) => v.installaties.map((x) => x.soort)))];
  for (const s of gebruikt) { const d = soortDef(s); if (d) lijst.alinea(`${d.code} — ${d.naam} (${NAAM[d.net]}, standaard ${d.hoogte} mm boven de vloer)`); }
  titelblokken.push(...lijst.titelblokken);
  titelblokken.forEach((t, i) => t(i + 1, titelblokken.length));
  return doc.save();
}

/** Zelfde indeling als in de app. */
function tekenEendraadschema(page: PDFPage, f: Fonts, kringen: Kring[], vak: { x: number; y: number; b: number; h: number }) {
  const mm = (q: number) => q * PT;
  const top = vak.y + vak.h;
  const rijen = kringen.length + 4;
  const rijH = Math.min(12, (vak.h - 30) / rijen);
  const tekst = (s: string, x: number, y: number, size = 8, vet = false, kleur = ZWART) => page.drawText(pdfTekst(s), { x: mm(x), y: mm(y), size, font: vet ? f.vet : f.gewoon, color: kleur });
  const lijn = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: mm(x1), y: mm(y1) }, end: { x: mm(x2), y: mm(y2) }, thickness: mm(0.3), color: ZWART });
  const doos = (x: number, y: number, b: number, h: number, vul = WIT, rand = ZWART) => page.drawRectangle({ x: mm(x), y: mm(y), width: mm(b), height: mm(h), color: vul, borderColor: rand, borderWidth: mm(0.3) });
  tekst("Eendraadschema (voorstel, vereenvoudigd)", vak.x, top - 4, 12, true);
  tekst("Niet het officiële schema volgens het AREI: de installateur tekent dat en laat het keuren.", vak.x, top - 9, 8, false, GRIJS);
  const x0 = vak.x + 4, rail = x0 + 20;
  let y = top - 20;
  doos(x0, y - 8, 40, 8);
  tekst("Teller + hoofdschakelaar", x0 + 2, y - 5.2, 7);
  y -= 8;
  for (const mA of [300, 30] as const) {
    const ks = kringen.filter((k) => k.differentieel === mA);
    if (!ks.length) continue;
    lijn(rail, y, rail, y - 4);
    y -= 4;
    doos(rail - 12, y - 7, 24, 7, rgb(0.93, 0.91, 0.99), KLEUR.elektriciteit);
    tekst(`Diff. ${mA} mA`, rail - 10, y - 4.8, 7, true, hex("#5b21b6"));
    y -= 7;
    const eerste = y - rijH / 2;
    for (const [i, k] of ks.entries()) {
      const yk = eerste - i * rijH;
      lijn(rail, y, rail, yk);
      lijn(rail, yk, rail + 12, yk);
      doos(rail + 12, yk - 3, 16, 6);
      tekst(`C ${k.automaat} A`, rail + 13.5, yk - 1.2, 7, true);
      lijn(rail + 28, yk, rail + 36, yk);
      tekst(`${k.code}  ${k.omschrijving}`, rail + 38, yk + 0.6, 8, true);
      const punten = k.punten.map((x) => `${soortDef(x.punt.soort)?.code ?? x.punt.soort}${x.ruimte ? ` (${x.ruimte})` : ""}`).join(", ");
      const s = `3G${String(k.kabel).replace(".", ",")} mm² · ± ${String(k.kabelLengte).replace(".", ",")} m · ${k.punten.length} punten: ${punten}`;
      tekst(s.length > 150 ? s.slice(0, 148) + "…" : s, rail + 38, yk - 3, 6.5, false, GRIJS);
    }
    y = eerste - (ks.length - 1) * rijH - 4;
  }
}

function streep(a: Punt, b: Punt, schaal: number, teken: (a: Punt, b: Punt) => void) {
  const L = Math.hypot(b.x - a.x, b.y - a.y), stap = 3 * schaal;
  for (let d = 0; d < L; d += stap) {
    const d2 = Math.min(L, d + 2 * schaal);
    teken({ x: a.x + ((b.x - a.x) * d) / L, y: a.y + ((b.y - a.y) * d) / L }, { x: a.x + ((b.x - a.x) * d2) / L, y: a.y + ((b.y - a.y) * d2) / L });
  }
}

function kraan(page: PDFPage, naar: (q: Punt) => { x: number; y: number }, pad: Punt[], schaal: number) {
  const e = pad[pad.length - 1]!, v = pad[Math.max(0, pad.length - 2)]!;
  const L = Math.hypot(e.x - v.x, e.y - v.y) || 1;
  const u = { x: (e.x - v.x) / L, y: (e.y - v.y) / L }, n = { x: -u.y, y: u.x };
  const k = { x: e.x - u.x * 4 * schaal, y: e.y - u.y * 4 * schaal }, s = 1.2 * schaal;
  const P = (a: number, b: number) => naar({ x: k.x + u.x * a + n.x * b, y: k.y + u.y * a + n.y * b });
  const pts = [P(-s, -s), P(-s, s), P(s, -s), P(s, s)];
  const d = pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(2)},${(-q.y).toFixed(2)}`).join(" ") + " Z";
  page.drawSvgPath(d, { x: 0, y: 0, color: KLEUR.gas, borderColor: hex("#713f12"), borderWidth: 0.4 });
}

function symbool(page: PDFPage, f: Fonts, c: { x: number; y: number }, x: InstallatiePunt, kring?: string) {
  const d = soortDef(x.soort);
  const r = 1.6 * PT; // 1,6 mm op papier
  const kleur = x.net === "elektriciteit" ? KLEUR.elektriciteit : x.net === "gas" ? KLEUR.gas : KLEUR.sanitairPunt;
  const dik = 0.3 * PT;
  const lijn = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: c.x + x1, y: c.y + y1 }, end: { x: c.x + x2, y: c.y + y2 }, thickness: dik, color: kleur });
  switch (d?.kring) {
    case "licht":
      page.drawCircle({ x: c.x, y: c.y, size: r, color: WIT, borderColor: kleur, borderWidth: dik });
      lijn(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7); lijn(-r * 0.7, r * 0.7, r * 0.7, -r * 0.7);
      break;
    case "stop": {
      // halve cirkel met steel
      const pts: string[] = [];
      for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); pts.push(`${i ? "L" : "M"}${(c.x + r * Math.cos(a)).toFixed(2)},${(-(c.y + r * Math.sin(a))).toFixed(2)}`); }
      page.drawSvgPath(pts.join(" ") + " Z", { x: 0, y: 0, color: WIT, borderColor: kleur, borderWidth: dik });
      lijn(0, 0, 0, -r * 0.9);
      if (x.soort === "stopcontact-dubbel") page.drawText("2", { x: c.x - 1.3, y: c.y + 0.3, size: 5, font: f.vet, color: kleur });
      break;
    }
    case "schakelaar":
      page.drawCircle({ x: c.x, y: c.y, size: r * 0.6, color: WIT, borderColor: kleur, borderWidth: dik });
      lijn(r * 0.4, r * 0.4, r * 1.2, r * 1.2);
      break;
    case "bord":
      page.drawRectangle({ x: c.x - r * 1.2, y: c.y - r * 0.7, width: r * 2.4, height: r * 1.4, color: WIT, borderColor: kleur, borderWidth: dik });
      page.drawRectangle({ x: c.x - r * 1.2, y: c.y - r * 0.7, width: r * 1.2, height: r * 1.4, color: kleur });
      break;
    default: {
      const code = d?.code ?? "?";
      const size = 5;
      const w = Math.max(2 * r, f.vet.widthOfTextAtSize(code, size) + r * 0.8);
      page.drawRectangle({ x: c.x - w / 2, y: c.y - r * 0.75, width: w, height: r * 1.5, color: x.net === "gas" ? rgb(1, 0.98, 0.76) : WIT, borderColor: kleur, borderWidth: dik });
      page.drawText(code, { x: c.x - f.vet.widthOfTextAtSize(code, size) / 2, y: c.y - size * 0.36, size, font: f.vet, color: kleur });
    }
  }
  if (kring) page.drawText(kring, { x: c.x + r * 1.15, y: c.y - r * 1.5, size: 5, font: f.gewoon, color: kleur });
}
