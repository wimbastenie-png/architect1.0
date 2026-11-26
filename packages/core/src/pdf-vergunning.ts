/**
 * Vergunningsklare basis (PDF): inplantingsplan, plannen bestaande en nieuwe
 * toestand, doorsneden en gevels met materialen, legende, gegevens en
 * handtekeningvakken. De architect controleert, vult aan en tekent.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { afstandenTotGrenzen, ARCHITECT_DISCLAIMER, controleerTrap, inplantingsplan, nokHoogte, trapGeometrie } from "./architect.ts";
import { m2Tekst } from "./geometrie.ts";
import { vloerNetto } from "./bewerken.ts";
import { aanzicht, doorsnede, TOESTAND_KLEUR, verdiepingInToestand, ZIJDEN } from "./ontwerp.ts";
import { lijstBladen } from "./pdf-lijst.ts";
import { tekeningBlad } from "./pdf-ontwerp.ts";
import { kiesBlad, tekenBlad, type Fonts, type PdfOpties } from "./pdf.ts";
import type { Project } from "./schema.ts";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export async function vergunningNaarPDF(p: Project, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — vergunningsklare basis`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const vg = p.vergunning ?? {};
  const extraRegel = [vg.bouwheer && `Bouwheer: ${vg.bouwheer}`, vg.architect && `Architect: ${vg.architect}`, vg.kadaster && `Kadaster: ${vg.kadaster}`, vg.planNummer && `Plan ${vg.planNummer}${vg.index ? ` ${vg.index}` : ""}`].filter(Boolean).join(" · ") || "Bouwheer, architect en kadaster: in te vullen";
  const o = { ...opties, datum: opties.datum ?? new Date().toISOString().slice(0, 10), disclaimer: ARCHITECT_DISCLAIMER, extraRegel };
  const papier = kiesBlad(p.verdiepingen[0]!, opties).papier;
  const legende: Array<[ReturnType<typeof rgb>, string]> = [[hex(TOESTAND_KLEUR.bestaand), "Bestaand"], [hex("#eab308"), "Af te breken (geel)"], [hex(TOESTAND_KLEUR.nieuw), "Nieuw (rood)"], [hex("#3f6212"), "Perceel / maaiveld"]];
  const tb: Array<(blad: number, bladen: number) => void> = [];
  if (p.terrein) tb.push(tekeningBlad(doc, f, p, inplantingsplan(p), o, papier, "Inplantingsplan", [100, 200, 250, 500], legende));
  for (const v of [...p.verdiepingen].sort((a, b) => a.peil - b.peil)) {
    for (const [welke, titel] of [["bestaand", "Plan bestaande toestand"], ["nieuw", "Plan nieuwe toestand"]] as const) {
      const vv = verdiepingInToestand(v, welke);
      tb.push(tekenBlad(doc, f, p, vv, o, {
        titel: `${titel} — ${v.naam}`, legende,
        teken: ({ lijn }) => {
          for (const t of vv.trappen ?? []) {
            const g = trapGeometrie(t);
            for (let i = 0; i < 4; i++) lijn(g.omtrek[i]!, g.omtrek[(i + 1) % 4]!, hex("#292524"), 0.35);
            for (const [a, b] of g.treden.slice(1)) lijn(a, b, hex("#57534e"), 0.18);
            lijn(g.P(0, 0), g.P(g.loop, 0), hex("#292524"), 0.25);
          }
        },
      }));
    }
  }
  for (const d of p.doorsneden) tb.push(tekeningBlad(doc, f, p, doorsnede(p, d.a, d.b, { naam: d.naam, toestand: "verbouwing" }), o, papier, `Doorsnede ${d.naam}`, [50, 100, 200], legende));
  for (const z of ZIJDEN) tb.push(tekeningBlad(doc, f, p, aanzicht(p, z.zijde, { toestand: "nieuw" }), o, papier, `${z.naam} — nieuwe toestand`, [50, 100, 200], legende));

  const lijst = lijstBladen(doc, f, p, o, papier, "Gegevens, legende en handtekeningen", ["Status", "Vergunningsklare basis; de architect tekent."]);
  lijst.kop("Gegevens");
  lijst.tabel([{ kop: "", breedte: 50 }, { kop: "", breedte: 80 }], [
    ["Bouwheer", vg.bouwheer ?? "–"], ["Architect", vg.architect ?? "– (in te vullen)"], ["Kadaster", vg.kadaster ?? "–"],
    ["Adres bouwplaats", [p.adres?.straat, [p.adres?.postcode, p.adres?.gemeente].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"],
    ["Plan nr. / index", `${vg.planNummer ?? "–"} ${vg.index ?? ""}`],
    ["Nokhoogte (t.o.v. ±0)", nokHoogte(p) ? `${(nokHoogte(p)! / 1000).toFixed(2).replace(".", ",")} m` : "–"],
    ["Dak", p.dak ? `${p.dak.soort}${p.dak.soort !== "plat" ? `, ${p.dak.helling}°` : ""}${p.dak.materiaal ? `, ${p.dak.materiaal}` : ""}` : "–"],
    ["Maaiveld", p.terrein ? `${(p.terrein.maaiveld / 1000).toFixed(2).replace(".", ",")} m` : "–"],
  ]);
  if (p.terrein) {
    lijst.kop("Afstanden tot de perceelgrenzen");
    lijst.tabel([{ kop: "Grens", breedte: 30 }, { kop: "Afstand tot het gebouw (m)", breedte: 60, rechts: true }], afstandenTotGrenzen(p).map((a, k) => [`zijde ${k + 1}`, (a / 1000).toFixed(2).replace(".", ",")]));
  }
  lijst.kop("Gevelmaterialen");
  for (const z of ZIJDEN) lijst.alinea(`${z.naam}: ${p.gevelmaterialen?.[z.zijde] ?? "– (in te vullen)"}`);
  lijst.kop("Ruimtes nieuwe toestand");
  for (const v of p.verdiepingen) {
    const vv = verdiepingInToestand(v, "nieuw");
    lijst.tabel([{ kop: `${v.naam}`, breedte: 70 }, { kop: "Netto m²", breedte: 30, rechts: true }], vv.ruimtes.map((r) => [r.naam, m2Tekst(vloerNetto(r, vv))]));
  }
  const trappen = p.verdiepingen.flatMap((v) => (v.trappen ?? []).map((t) => ({ v, t })));
  if (trappen.length) {
    lijst.kop("Trappen");
    for (const { v, t } of trappen) for (const x of controleerTrap(p, v, t)) lijst.alinea(`${v.naam}: ${x.tekst}`, { kleur: x.ernst === "let op" ? rgb(0.6, 0.2, 0.05) : rgb(0.34, 0.33, 0.31) });
  }
  lijst.kop("Legende");
  lijst.alinea("Zwart: bestaand · geel (gestreept): af te breken · rood: nieuw · groen: perceel en maaiveld. Maten in mm, peilen in m t.o.v. ±0,00 (vloerpeil gelijkvloers).");
  lijst.kop("Handtekeningen");
  for (const w of ["Bouwheer", "Architect (naam, stempel, handtekening)"]) lijst.alinea(`${w}: ${"_".repeat(50)}\n\nDatum: ${"_".repeat(20)}`);
  lijst.alinea(ARCHITECT_DISCLAIMER, { vet: true });
  tb.push(...lijst.titelblokken);
  tb.forEach((t, i) => t(i + 1, tb.length));
  return doc.save();
}
