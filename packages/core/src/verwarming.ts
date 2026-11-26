/**
 * Verwarming en energie: warmteverlies per ruimte (vereenvoudigd volgens
 * NBN EN 12831), voorstel radiatoren of vloerverwarming, warmtepomp en
 * buffervat, zonnepanelen op het dak met een indicatieve opbrengst.
 *
 * VOORBEREIDING, na te kijken door de installateur (en de energiedeskundige).
 * De app geeft nooit een oordeel "conform".
 *
 * Methode (vereenvoudigd):
 * Φ = Φ_T + Φ_V
 * Φ_T = Σ A·(U + ΔU_kb)·f·(θ_int − θ_e); f = 1 buiten, 0,5 onverwarmd, 0,3 grond, 0 buren; ΔU_kb = 0,10 W/m²K (koudebruggen, forfaitair)
 * Φ_V = 0,34·V̇·(θ_int − θ_e); V̇ = max(0,5 h⁻¹·V, infiltratie 0,2 h⁻¹·V + toevoerdebiet ventilatie); systeem D: toevoer × (1 − 0,8) (warmteterugwinning)
 * U onbekend → aanname naar bouwperiode (ongeïsoleerd), duidelijk gemarkeerd.
 */
import { vloerNetto } from "./bewerken.ts";
import { dakVoet } from "./architect.ts";
import { kompas, muurGrens, uRaam, uWaarde, type Richting } from "./epb.ts";
import { muurLengte } from "./geometrie.ts";
import { verdiepingInToestand } from "./ontwerp.ts";
import { functieVan, systeemVan, ventilatieDebieten, type Functie } from "./ventilatie.ts";
import type { Grens, Muur, Project, Ruimte, Verdieping } from "./schema.ts";

export const VERWARMING_DISCLAIMER =
  "Warmteverlies vereenvoudigd volgens NBN EN 12831, ter voorbereiding. Vermogens, afgifte, warmtepomp en zonnepanelen na te kijken door de installateur. De app geeft nooit een oordeel 'conform'.";

export const BINNENTEMPERATUUR: Record<Functie, number> = {
  woonkamer: 20, keuken: 20, "open-keuken": 20, studeerkamer: 20, slaapkamer: 18, badkamer: 24, wc: 18, washok: 18, gang: 16, berging: 15, andere: 20,
};
const F: Record<Grens, number> = { buiten: 1, onverwarmd: 0.5, grond: 0.3, buren: 0, binnen: 0 };
const DU_KB = 0.1;
/** Aannames als de U-waarde niet ingevuld is (ongeïsoleerd, typisch vóór 1985). */
export const U_AANNAME = { muur: 1.5, raam: 2.9, deur: 3.0, vloer: 1.0, dak: 1.2 } as const;

export interface RuimteVerlies {
  verdieping: string;
  ruimte: Ruimte;
  functie: Functie;
  binnen: number;
  oppervlakte: number;
  volume: number;
  transmissie: number; // W
  ventilatie: number; // W
  totaal: number; // W
  perM2: number; // W/m²
  aannames: number; // aantal elementen met een aangenomen U-waarde
  afgifte: "radiator" | "vloer";
  /** Radiatorvermogen nominaal (ΔT50) dat nodig is bij het gekozen regime, incl. 15 % toeslag. */
  radiatorNominaal: number;
  opmerking?: string;
}

const LMTD = (aanvoer: number, retour: number, ruimte: number) => (aanvoer - retour) / Math.log((aanvoer - ruimte) / (retour - ruimte));

export function warmteverlies(p: Project): RuimteVerlies[] {
  const w = p.verwarming ?? { buitentemperatuur: -7, afgifte: {}, regime: "45/35" as const, zonnepanelen: false };
  const te = w.buitentemperatuur;
  const sys = systeemVan(p);
  const deb = ventilatieDebieten(p);
  const verd = [...p.verdiepingen].sort((a, b) => a.peil - b.peil);
  const uit: RuimteVerlies[] = [];
  verd.forEach((v0, vi) => {
    const v = verdiepingInToestand(v0, "nieuw");
    const onder = verd[vi - 1], boven = verd[vi + 1];
    for (const r of v.ruimtes) {
      if (r.beschermd === false) continue;
      const f = functieVan(r), ti = BINNENTEMPERATUUR[f], dT = ti - te;
      const A = vloerNetto(r, v) / 1e6, V = A * (r.plafondhoogte / 1000);
      let HT = 0, aannames = 0;
      // wanden: randen van de ruimte die op een muur met een buitengrens liggen
      const c = r.contour;
      for (let k = 0; k < c.length; k++) {
        const a = c[k]!, b = c[(k + 1) % c.length]!, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const m = r.muurIds.map((id) => v.muren.find((x) => x.id === id)).find((x): x is Muur => !!x && afst(mid, x) <= x.dikte / 2 + 20);
        if (!m) continue;
        const grens = muurGrens(m, v);
        if (F[grens] === 0) continue;
        const lengte = Math.hypot(b.x - a.x, b.y - a.y) / 1000, h = r.plafondhoogte / 1000;
        let openingen = 0;
        for (const o of v.openingen.filter((x) => x.muurId === m.id)) {
          const Ao = (o.breedte * o.hoogte) / 1e6;
          // ligt de opening langs deze rand?
          const L = muurLengte(m), u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
          const om = { x: m.start.x + u.x * (o.offset + o.breedte / 2), y: m.start.y + u.y * (o.offset + o.breedte / 2) };
          const t = ((om.x - a.x) * (b.x - a.x) + (om.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1);
          if (t < -0.05 || t > 1.05) continue;
          openingen += Ao;
          let Uo = o.soort === "raam" ? uRaam(o) : o.epb?.uw ?? null;
          if (Uo === null) { Uo = o.soort === "raam" ? U_AANNAME.raam : U_AANNAME.deur; aannames++; }
          HT += Ao * (Uo + DU_KB) * F[grens];
        }
        let Um = uWaarde(m.epb, "muur").u;
        if (Um === null) { Um = U_AANNAME.muur; aannames++; }
        HT += Math.max(0, lengte * h - openingen) * (Um + DU_KB) * F[grens];
      }
      // vloer en plafond
      if (!onder || !onder.ruimtes.some((x) => x.beschermd !== false)) {
        const s = v0.epb?.vloer, g = s?.grens ?? (onder ? "onverwarmd" : "grond");
        let U = uWaarde(s, "vloer").u; if (U === null) { U = U_AANNAME.vloer; aannames++; }
        HT += A * (U + DU_KB) * F[g];
      }
      if (!boven || !boven.ruimtes.some((x) => x.beschermd !== false)) {
        const s = v0.epb?.plafond, g = s?.grens ?? (boven ? "onverwarmd" : "buiten");
        let U = uWaarde(s, "dak").u; if (U === null) { U = U_AANNAME.dak; aannames++; }
        HT += A * (U + DU_KB) * F[g];
      }
      const toevoer = deb.find((d) => d.ruimte.id === r.id)?.toevoer ?? 0;
      const Vdot = Math.max(0.5 * V, 0.2 * V + toevoer * (sys === "D" ? 0.2 : 1));
      const transmissie = HT * dT, ventilatie = 0.34 * Vdot * dT, totaal = transmissie + ventilatie;
      const afgifte = w.afgifte[r.id] ?? "radiator";
      const [aanv, ret] = w.regime.split("/").map(Number) as [number, number];
      const factor = (LMTD(aanv, ret, ti) / 50) ** 1.3;
      const rv: RuimteVerlies = { verdieping: v.naam, ruimte: r, functie: f, binnen: ti, oppervlakte: r2(A), volume: r2(V), transmissie: Math.round(transmissie), ventilatie: Math.round(ventilatie), totaal: Math.round(totaal), perM2: Math.round(totaal / Math.max(A, 0.1)), aannames, afgifte, radiatorNominaal: Math.round((totaal * 1.15) / factor) };
      if (afgifte === "vloer" && rv.perM2 > 80) rv.opmerking = `Vloerverwarming: ${rv.perM2} W/m² is veel (gangbaar ≤ 70 à 80 W/m² bij een comfortabele vloertemperatuur); bijverwarming of betere isolatie overwegen.`;
      if (afgifte === "radiator" && w.regime === "45/35") rv.opmerking = `Lage temperatuur 45/35: radiator van ${rv.radiatorNominaal} W nominaal (ΔT50), ± ${((1 / factor)).toFixed(1).replace(".", ",")} × groter dan bij 75/65.`;
      uit.push(rv);
    }
  });
  return uit;
}

function afst(q: { x: number; y: number }, m: Muur): number {
  const L = muurLengte(m) || 1, u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
  const t = Math.max(0, Math.min(L, (q.x - m.start.x) * u.x + (q.y - m.start.y) * u.y));
  return Math.hypot(q.x - (m.start.x + u.x * t), q.y - (m.start.y + u.y * t));
}
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface Opwekking { totaal: number; warmtepomp: number; buffervat: number; opmerkingen: string[] }

/** Warmtepomp: totaal warmteverlies + 10 % (sanitair warm water niet inbegrepen); buffervat ± 15 l/kW (vuistregel). */
export function opwekking(p: Project): Opwekking {
  const tot = warmteverlies(p).reduce((s, r) => s + r.totaal, 0);
  const wp = Math.ceil((tot * 1.1) / 500) * 0.5; // kW, per 0,5 kW
  const opm = [
    `Warmtepomp ± ${String(wp).replace(".", ",")} kW bij ${p.verwarming?.buitentemperatuur ?? -7} °C (warmteverlies ${(tot / 1000).toFixed(1).replace(".", ",")} kW + 10 %). Vermogen voor sanitair warm water en de werking bij lage buitentemperatuur (bivalent punt) bepaalt de installateur.`,
    `Buffervat ± ${Math.round(wp * 15)} l (vuistregel 10 à 20 l/kW; hangt af van de warmtepomp en de afgifte).`,
  ];
  return { totaal: tot, warmtepomp: wp, buffervat: Math.round(wp * 15), opmerkingen: opm };
}

// ---------------------------------------------------------------------------
// zonnepanelen

export const PANEEL = { breedte: 1134, hoogte: 1722, wattpiek: 420, rand: 500 };

export interface Dakvlak { naam: string; richting: Richting; azimut: number; helling: number; breedte: number; lengte: number; panelen: number; kWp: number; opbrengst: number }

/** Indicatieve jaaropbrengst (kWh/kWp) in België naar oriëntatie en helling (± 15 %; PVGIS voor een raming). */
export function specifiekeOpbrengst(azimut: number, helling: number): number {
  const afwijking = Math.min(180, Math.abs(((azimut - 180 + 540) % 360) - 180)); // 0 = zuid
  const orient = 1 - 0.35 * (1 - Math.cos((afwijking * Math.PI) / 180)) / 2 - (afwijking > 90 ? 0.1 * ((afwijking - 90) / 90) : 0);
  const hellingF = 1 - 0.0001 * (helling - 35) ** 2 * (afwijking < 90 ? 1 : 0.6);
  return Math.round(930 * Math.max(0.45, orient) * Math.max(0.75, hellingF));
}

export function zonnepanelen(p: Project): Dakvlak[] {
  const v = dakVoet(p), d = p.dak;
  if (!v || !d) return [];
  const o = d.overstek, B = v.x1 - v.x0 + 2 * o, D = v.y1 - v.y0 + 2 * o;
  const noord = p.noord ?? 0;
  const vlakken: Array<{ naam: string; normaal: { x: number; y: number }; breedte: number; lengte: number; helling: number }> = [];
  const cos = Math.cos((d.helling * Math.PI) / 180);
  if (d.soort === "plat") vlakken.push({ naam: "plat dak (panelen op 15°, zuid)", normaal: { x: 0, y: -1 }, breedte: B, lengte: D * 0.6, helling: 15 });
  else if (d.soort === "zadel") {
    if (d.nok === "x") { vlakken.push({ naam: "dakvlak voor", normaal: { x: 0, y: -1 }, breedte: B, lengte: D / 2 / cos, helling: d.helling }); vlakken.push({ naam: "dakvlak achter", normaal: { x: 0, y: 1 }, breedte: B, lengte: D / 2 / cos, helling: d.helling }); }
    else { vlakken.push({ naam: "dakvlak links", normaal: { x: -1, y: 0 }, breedte: D, lengte: B / 2 / cos, helling: d.helling }); vlakken.push({ naam: "dakvlak rechts", normaal: { x: 1, y: 0 }, breedte: D, lengte: B / 2 / cos, helling: d.helling }); }
  } else vlakken.push({ naam: "dakvlak", normaal: d.nok === "x" ? { x: 0, y: -1 } : { x: -1, y: 0 }, breedte: d.nok === "x" ? B : D, lengte: (d.nok === "x" ? D : B) / cos, helling: d.helling });
  return vlakken.map((x) => {
    // plat dak: panelen naar het zuiden ongeacht de gevel
    const k = d.soort === "plat" ? { richting: "Z" as Richting, graden: 180 } : kompas(x.normaal, noord);
    const kol = Math.max(0, Math.floor((x.breedte - 2 * PANEEL.rand) / PANEEL.breedte));
    const rij = Math.max(0, Math.floor((x.lengte - 2 * PANEEL.rand) / PANEEL.hoogte));
    const n = kol * rij;
    const kWp = r2((n * PANEEL.wattpiek) / 1000);
    return { naam: x.naam, richting: k.richting, azimut: k.graden, helling: x.helling, breedte: Math.round(x.breedte), lengte: Math.round(x.lengte), panelen: n, kWp, opbrengst: Math.round(kWp * specifiekeOpbrengst(k.graden, x.helling)) };
  });
}
