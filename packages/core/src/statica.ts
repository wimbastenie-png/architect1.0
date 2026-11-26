/**
 * Statica van een ligger op 2 of 3 steunpunten (1 of 2 overspanningen):
 * gelijkmatig verdeelde last per overspanning en puntlasten.
 *
 * - Steunpuntsmoment bij 2 overspanningen met de driemomentenvergelijking
 *   (Clapeyron), uiteinden vrij opgelegd:
 *   2·M_B·(L1+L2) = −[q1·L1³/4 + q2·L2³/4 + Σ P·a·(L1²−a²)/L1 + Σ P·b·(L2²−b²)/L2]
 *   (a vanaf A in overspanning 1, b vanaf C in overspanning 2).
 * - Per overspanning: momentenlijn = vrij opgelegd + lineair verloop van de eindmomenten.
 * - Doorbuiging numeriek: y'' = −M/EI, y = 0 op beide steunpunten.
 * Eenheden: mm, N (kN/m = N/mm; kN × 1000 = N).
 */

export interface Puntlast { a: number; P: number } // a: mm vanaf het linkse steunpunt; P in kN

export interface Belasting { q: number[]; punten: Puntlast[] } // q in kN/m per overspanning

export interface Krachten {
  /** Grootste positieve (veld)moment en kleinste (steunpunt)moment, kNm. */
  Mmax: number;
  Mmin: number;
  /** Grootste dwarskracht, kN. */
  Vmax: number;
  /** Reacties per steunpunt, kN. */
  R: number[];
  /** Grootste doorbuiging per overspanning (mm), als EI gegeven is. */
  delta: number[];
}

export function los(spans: number[], b: Belasting, EI?: number): Krachten {
  if (spans.length < 1 || spans.length > 2) throw new Error("1 of 2 overspanningen.");
  const start = spans.map((_, i) => spans.slice(0, i).reduce((s, x) => s + x, 0));
  const P = (i: number) => b.punten.filter((p) => p.a >= start[i]! - 1e-9 && p.a <= start[i]! + spans[i]! + 1e-9 && !(i === 1 && Math.abs(p.a - start[1]!) < 1e-9)).map((p) => ({ a: p.a - start[i]!, P: p.P * 1000 }));
  // steunpuntsmoment
  let MB = 0;
  if (spans.length === 2) {
    const [L1, L2] = spans as [number, number];
    const q1 = b.q[0] ?? 0, q2 = b.q[1] ?? b.q[0] ?? 0;
    let t = (q1 * L1 ** 3) / 4 + (q2 * L2 ** 3) / 4;
    for (const p of P(0)) t += (p.P * p.a * (L1 ** 2 - p.a ** 2)) / L1;
    for (const p of P(1)) { const bb = L2 - p.a; t += (p.P * bb * (L2 ** 2 - bb ** 2)) / L2; }
    MB = -t / (2 * (L1 + L2));
  }
  const eind = (i: number): [number, number] => (spans.length === 1 ? [0, 0] : i === 0 ? [0, MB] : [MB, 0]);
  let Mmax = -Infinity, Mmin = Infinity, Vmax = 0;
  const Vlinks: number[] = [], Vrechts: number[] = [];
  const delta: number[] = [];
  spans.forEach((L, i) => {
    const q = b.q[i] ?? b.q[0] ?? 0;
    const pts = P(i);
    const R0 = (q * L) / 2 + pts.reduce((s, p) => s + (p.P * (L - p.a)) / L, 0);
    const [Ml, Mr] = eind(i);
    const M = (x: number) => R0 * x - (q * x * x) / 2 - pts.reduce((s, p) => s + (x > p.a ? p.P * (x - p.a) : 0), 0) + Ml * (1 - x / L) + (Mr * x) / L;
    const V = (x: number) => R0 - q * x - pts.reduce((s, p) => s + (x > p.a ? p.P : 0), 0) + (Mr - Ml) / L;
    const n = 400;
    const xs: number[] = [];
    for (let k = 0; k <= n; k++) xs.push((L * k) / n);
    for (const p of pts) xs.push(p.a); // pieken onder puntlasten
    for (const x of xs) { const m = M(x); Mmax = Math.max(Mmax, m); Mmin = Math.min(Mmin, m); }
    Vlinks.push(V(1e-6)); Vrechts.push(V(L - 1e-6));
    Vmax = Math.max(Vmax, Math.abs(V(1e-6)), Math.abs(V(L - 1e-6)), ...pts.map((p) => Math.max(Math.abs(V(p.a - 1e-6)), Math.abs(V(p.a + 1e-6)))));
    if (EI) {
      // dubbel integreren (trapezium), daarna lineair corrigeren tot y(L) = 0
      const h = L / n;
      let th = 0, y = 0, kVorig = -M(0) / EI, maxY = 0;
      const ys: number[] = [0];
      for (let k = 1; k <= n; k++) {
        const kNu = -M(k * h) / EI;
        const thNieuw = th + ((kVorig + kNu) / 2) * h;
        y += ((th + thNieuw) / 2) * h;
        th = thNieuw; kVorig = kNu;
        ys.push(y);
      }
      const yL = ys[n]!;
      for (let k = 0; k <= n; k++) maxY = Math.max(maxY, Math.abs(ys[k]! - (yL * k) / n));
      delta.push(maxY);
    }
  });
  const R = spans.length === 1 ? [Vlinks[0]!, -Vrechts[0]!] : [Vlinks[0]!, Vlinks[1]! - Vrechts[0]!, -Vrechts[1]!];
  return { Mmax: Mmax / 1e6, Mmin: Mmin / 1e6, Vmax: Vmax / 1000, R: R.map((x) => x / 1000), delta };
}
