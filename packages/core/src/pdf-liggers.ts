/**
 * Rekennota voordimensionering stalen liggers: invoer, aannames, lasten,
 * combinatie, controles van het gekozen profiel, alternatieven, oplegreacties
 * (vertrekpunt voor de fundering) en een vak voor de aftekening door de ingenieur.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FY, LIGGER_DISCLAIMER, PSI0, rekenKolom, rekenLigger, type LiggerInvoer } from "./liggers.ts";
import { lijstBladen } from "./pdf-lijst.ts";
import type { Fonts, PdfOpties } from "./pdf.ts";
import type { Project } from "./schema.ts";

const g2 = (x: number, d = 2) => x.toFixed(d).replace(".", ",");
const ROOD = rgb(0.6, 0.1, 0.05);

export async function rekennotaNaarPDF(p: Project, liggers: LiggerInvoer[] = p.liggers, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — rekennota liggers (voordimensionering)`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  const o = { ...opties, datum, disclaimer: LIGGER_DISCLAIMER };
  const lijst = lijstBladen(doc, f, p, o, "A4", "Rekennota stalen liggers — voordimensionering", ["Status", "Voordimensionering. Geldig na controle en aftekening door een ingenieur."]);

  lijst.kop("VOORDIMENSIONERING — NIET VOOR UITVOERING");
  lijst.alinea(LIGGER_DISCLAIMER, { vet: true, kleur: ROOD });
  lijst.kop("Methode en aannames");
  for (const t of [
    "Model: vrij opgelegde ligger, gelijkmatig verdeelde last. Overspanning L = dagmaat + opleglengte (hart opleggingen).",
    "NBN EN 1990 + ANB: uiterste grenstoestand 1,35·G + 1,5·Q_leidend + 1,5·ψ0·Q_overige (vgl. 6.10); ψ0 = " + `${g2(PSI0.Q, 1)} (woning, cat. A), ${g2(PSI0.S, 1)} (sneeuw).`,
    "NBN EN 1993-1-1 + ANB: γM0 = γM1 = 1,0. Doorsnedeklasse volgens tabel 5.2 (klasse 1-2: Wpl, klasse 3: Wel). Dwarskracht met Av (η = 1). Kip: algemene methode (6.3.2.2), Mcr met C1 = 1,127, C2 = 0,454, last op de bovenflens; It en Iw zonder afrondingen (veilig).",
    "Doorbuiging: karakteristieke combinatie, gekozen grens L/500 voor liggers die metselwerk dragen (geen normwaarde; door de ingenieur te bevestigen).",
    "Lasten: karakteristiek, door de gebruiker ingegeven; muurlast zonder boogwerking (veilige kant). Eigengewicht van het profiel wordt toegevoegd.",
    "Lijfplooi en lijfstuik aan de steunpunten: NBN EN 1993-1-5 §6 (zonder verstijvers, s_s = opleglengte). Doorgaande ligger: driemomentenvergelijking, patroonbelasting van de variabele lasten per overspanning. Doorbuiging numeriek uit de momentenlijn.",
    "Niet gecontroleerd: wringing, brandweerstand, verbindingen, samenwerking van profielen naast elkaar, stempeling tijdens de werken, draagkracht van het metselwerk en de fundering.",
  ]) lijst.alinea(`• ${t}`);

  for (const l of liggers) {
    const r = rekenLigger(l);
    lijst.kop(`${l.naam}: dagmaat ${l.dagmaat} mm, ${l.aantal > 1 ? `${l.aantal} profielen naast elkaar, ` : ""}${l.staal}`);
    lijst.tabel([{ kop: "Gegeven", breedte: 70 }, { kop: "Waarde", breedte: 62 }], [
      ["Schema", r.spans.length === 2 ? `doorgaande ligger, 2 overspanningen: ${r.spans.join(" + ")} mm` : `vrij opgelegd, L = ${r.L} mm (${l.dagmaat} + ${l.oplegging})`],
      ["Opleglengte per kant", `${l.oplegging} mm`],
      ["Staalkwaliteit, f_y", `${l.staal}, ${FY[l.staal]} N/mm²`],
      ["Kip", l.kipVerhinderd ? "verhinderd (aanname, te bevestigen)" : "niet verhinderd: gecontroleerd"],
      ["Doorbuigingsgrens", `L/${l.doorbuiging} = ${g2(r.L / l.doorbuiging, 1)} mm`],
    ]);
    lijst.tabel([{ kop: "Last (karakteristiek)", breedte: 100 }, { kop: "Soort", breedte: 12 }, { kop: "kN/m", breedte: 20, rechts: true }], [
      ...l.lasten.map((x) => [x.omschrijving, x.soort, g2(x.waarde)]),
      ...(r.keuze ? [[`Eigengewicht ${l.aantal > 1 ? `${l.aantal} × ` : ""}${r.keuze.profiel.naam}`, "G", g2((l.aantal * r.keuze.profiel.G * 9.81) / 1000)]] : []),
    ]);
    if (l.puntlasten?.length) lijst.tabel([{ kop: "Puntlast (karakteristiek)", breedte: 82 }, { kop: "Soort", breedte: 12 }, { kop: "kN", breedte: 18, rechts: true }, { kop: "a (mm)", breedte: 20, rechts: true }],
      l.puntlasten.map((x) => [x.omschrijving, x.soort, g2(x.waarde), String(x.a)]));
    if (l.metselwerkFd) lijst.alinea(`Metselwerksterkte onder de oplegging (ingegeven): f_d = ${g2(l.metselwerkFd)} N/mm².`);
    lijst.alinea(`Combinatie (UGT): ${r.combinatie} → q_d = ${g2(r.qd)} kN/m.  Karakteristiek (BGT): q_k = ${g2(r.qk)} kN/m.  G totaal = ${g2(r.gk)} kN/m.`);
    if (r.keuze) {
      const k = r.keuze;
      lijst.alinea(`Voorstel: ${l.aantal > 1 ? `${l.aantal} × ` : ""}${k.profiel.naam} ${l.staal} (klasse ${k.klasse}, ${g2(k.profiel.G, 1)} kg/m per profiel)`, { vet: true });
      lijst.tabel([{ kop: "Controle", breedte: 22 }, { kop: "Ed", breedte: 18, rechts: true }, { kop: "Rd", breedte: 18, rechts: true }, { kop: "", breedte: 10 }, { kop: "UC", breedte: 12, rechts: true }, { kop: "OK", breedte: 10 }, { kop: "", breedte: 42 }],
        k.controles.map((c) => [c.naam, g2(c.ed), g2(c.rd), c.eenheid, g2(c.uc), c.ok ? "ja" : "NEE", ""]));
      for (const c of k.controles) lijst.alinea(`${c.naam}: ${c.uitleg}`, { grootte: 6.8 });
      const alt = Object.values(r.perReeks).filter((x) => x && x.profiel.naam !== k.profiel.naam);
      if (alt.length) lijst.alinea(`Alternatieven (lichtste per reeks): ${alt.map((x) => `${x!.profiel.naam} (UC ${g2(x!.ucMax)})`).join(", ")}.`);
    } else {
      lijst.alinea("Geen profiel uit de tabel voldoet.", { vet: true, kleur: ROOD });
    }
    lijst.kop(`${l.naam}: oplegreacties`);
    lijst.alinea("Vertrekpunt voor de ingenieur; fundering en metselwerk vallen buiten deze berekening.");
    lijst.tabel([{ kop: "Per oplegging", breedte: 80 }, { kop: "kN", breedte: 20, rechts: true }], [
      ["Permanent G_k (incl. eigengewicht)", g2(r.reactie.gk)],
      ["Variabel Q_k (som)", g2(r.reactie.qk)],
      ["Rekenwaarde R_d (UGT), eindsteunpunt", g2(r.reactie.ed)],
      ...(r.reacties.length === 3 ? [["Rekenwaarde R_d (UGT), tussensteun", g2(r.reacties[1]!)]] : []),
    ]);
    lijst.alinea(r.opleg.advies);
    for (const w of r.waarschuwingen) lijst.alinea(`LET OP: ${w}`, { kleur: ROOD });
  }

  for (const k of p.kolommen) {
    const r = rekenKolom(k, p);
    lijst.kop(`Kolom ${k.naam}: kniklengte ${k.lengte} mm, ${k.staal}`);
    lijst.alinea(`N_Ed = 1,35·G_k + 1,5·Q_k = ${g2(r.NEd)} kN${k.liggerId ? " (incl. reactie van de ligger)" : ""}.`);
    if (r.keuze) {
      lijst.alinea(`Voorstel: ${r.keuze.profiel.naam} ${k.staal} — N_b,Rd = ${g2(r.keuze.NbRd)} kN, UC ${g2(r.keuze.uc)}; ${r.keuze.uitleg}.`, { vet: true });
    } else lijst.alinea("Geen profiel uit de tabel voldoet.", { vet: true, kleur: ROOD });
    lijst.alinea("Knik volgens NBN EN 1993-1-1 §6.3.1 (tabel 6.2: gewalste I/H; y-as kromme a/b, z-as kromme b/c), I_z zonder afrondingen (veilig).", { grootte: 6.8 });
    for (const w of r.waarschuwingen) lijst.alinea(`LET OP: ${w}`, { kleur: ROOD });
  }

  lijst.kop("Controle en aftekening door de ingenieur");
  lijst.alinea("Ik heb deze voordimensionering nagekeken en (met de opmerkingen hieronder) goedgekeurd voor uitvoering.");
  for (const r of ["Naam ingenieur:", "Erkenning / bureau:", "Datum:", "Handtekening:", "Opmerkingen:", "", ""]) lijst.alinea(`${r} ${"_".repeat(Math.max(10, 60 - r.length))}`, { grootte: 8 });

  lijst.titelblokken.forEach((t, i) => t(i + 1, lijst.titelblokken.length));
  return doc.save();
}
