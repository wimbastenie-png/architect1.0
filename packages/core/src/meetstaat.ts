/** Meetstaat: hoeveelheden per ruimte, zoals een aannemer ze voor een offerte nodig heeft. */
import { omtrek, oppervlakte, ruimteWandVlak } from "./geometrie.ts";
import type { MeetMethode, Project } from "./schema.ts";

export interface MeetstaatRij {
  verdieping: string;
  ruimte: string;
  vloerM2: number;
  omtrekM: number;
  plafondhoogteM: number;
  volumeM3: number;
  wandBrutoM2: number;
  wandNettoM2: number;
  /** Zwakste meetmethode van de ruimte: zegt hoe betrouwbaar de rij is. */
  bron: MeetMethode;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const BETROUWBAARHEID: MeetMethode[] = ["gescand", "gecorrigeerd", "manueel", "laser"];

export function meetstaat(p: Project): MeetstaatRij[] {
  const rijen: MeetstaatRij[] = [];
  for (const v of p.verdiepingen) {
    for (const r of v.ruimtes) {
      const vloer = oppervlakte(r.contour) / 1e6;
      const wand = ruimteWandVlak(r, v);
      const methodes = [r.bron.methode, ...v.muren.filter((m) => r.muurIds.includes(m.id)).map((m) => m.bron.methode)];
      const zwakste = methodes.reduce((a, b) => (BETROUWBAARHEID.indexOf(a) <= BETROUWBAARHEID.indexOf(b) ? a : b));
      rijen.push({
        verdieping: v.naam,
        ruimte: r.naam,
        vloerM2: r2(vloer),
        omtrekM: r2(omtrek(r.contour) / 1000),
        plafondhoogteM: r2(r.plafondhoogte / 1000),
        volumeM3: r2((vloer * r.plafondhoogte) / 1000),
        wandBrutoM2: r2(wand.bruto / 1e6),
        wandNettoM2: r2(wand.netto / 1e6),
        bron: zwakste,
      });
    }
  }
  return rijen;
}

/** CSV voor Excel met Belgische instellingen: `;` als scheidingsteken, `,` als decimaalteken. */
export function meetstaatCSV(rijen: MeetstaatRij[]): string {
  const kop = [
    "Verdieping",
    "Ruimte",
    "Vloer (m²)",
    "Omtrek (m)",
    "Plafondhoogte (m)",
    "Volume (m³)",
    "Wand bruto (m²)",
    "Wand netto (m²)",
    "Meetbron",
  ];
  const getal = (x: number) => x.toFixed(2).replace(".", ",");
  const tekst = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const regels = rijen.map((r) =>
    [
      tekst(r.verdieping),
      tekst(r.ruimte),
      getal(r.vloerM2),
      getal(r.omtrekM),
      getal(r.plafondhoogteM),
      getal(r.volumeM3),
      getal(r.wandBrutoM2),
      getal(r.wandNettoM2),
      r.bron,
    ].join(";"),
  );
  const tot = rijen.reduce((s, r) => s + r.vloerM2, 0);
  regels.push(["Totaal", "", getal(tot), "", "", "", "", "", ""].join(";"));
  // BOM zodat Excel de m²/m³-tekens als UTF-8 leest.
  return "﻿" + [kop.join(";"), ...regels].join("\r\n") + "\r\n";
}
