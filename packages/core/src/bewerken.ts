/**
 * Bewerken van een bestaand plan: openingen wijzigen of verplaatsen,
 * een tussenmuur uitbreken (twee ruimtes → één), een ruimte verwijderen,
 * en sparingen (trapgat, vide, schacht) in de vloer.
 * Alle functies geven een nieuwe verdieping terug; bij een fout: Error met
 * een melding die je zo aan de gebruiker kunt tonen.
 */
import { RECHTDOOR, aansluitingen, muurLengte, oppervlakte, zwaartepunt } from "./geometrie.ts";
import type { Bron, Muur, Opening, Project, Punt, Ruimte, Sparing, Verdieping } from "./schema.ts";

// ---------------------------------------------------------------- openingen

export type OpeningWijziging = Partial<Pick<Opening, "soort" | "offset" | "breedte" | "hoogte" | "borstwering" | "muurId">>;

/**
 * Wijzigt een opening: maten, soort, plaats (`offset`, gemeten vanaf de
 * hartlijnstart van de muur) en eventueel een andere muur (`muurId`).
 * Controleert dat ze in de (nieuwe) muur past en niet overlapt.
 */
export function wijzigOpening(v: Verdieping, id: string, w: OpeningWijziging): Verdieping {
  const o = v.openingen.find((x) => x.id === id);
  if (!o) throw new Error(`Opening '${id}' bestaat niet.`);
  const m = v.muren.find((x) => x.id === (w.muurId ?? o.muurId));
  if (!m) throw new Error(`Muur '${w.muurId ?? o.muurId}' bestaat niet.`);
  const n: Opening = { ...o, ...w, bron: { methode: "manueel", nauwkeurigheidMm: 5 } };
  for (const k of ["offset", "breedte", "hoogte", "borstwering"] as const) n[k] = Math.round(n[k]);
  if (!(n.breedte > 0 && n.hoogte > 0) || n.offset < 0 || n.borstwering < 0) throw new Error("Maten van de opening moeten positief zijn.");
  const a = aansluitingen(m, v.muren);
  const L = muurLengte(m);
  if (n.offset < a.start - 0.5 || n.offset + n.breedte > L - a.eind + 0.5)
    throw new Error("De opening past niet binnen de muur (van hoek tot hoek).");
  if (n.borstwering + n.hoogte > m.hoogte) throw new Error("De opening is hoger dan de muur.");
  const botsing = v.openingen.find(
    (x) => x.id !== id && x.muurId === n.muurId && x.offset < n.offset + n.breedte && n.offset < x.offset + x.breedte,
  );
  if (botsing) throw new Error(`De opening overlapt met een andere ${botsing.soort} in deze muur.`);
  return { ...v, openingen: v.openingen.map((x) => (x.id === id ? n : x)) };
}

/**
 * Verplaatst een raam of deur naar een andere muur van dezelfde verdieping.
 * `afstandVanafA` = afstand van binnenhoek A van de nieuwe muur tot de
 * opening (zoals met de rolmeter gemeten); zonder: midden van de muur.
 */
export function verplaatsOpening(v: Verdieping, id: string, naarMuurId: string, afstandVanafA?: number): Verdieping {
  const o = v.openingen.find((x) => x.id === id);
  if (!o) throw new Error(`Opening '${id}' bestaat niet.`);
  const m = v.muren.find((x) => x.id === naarMuurId);
  if (!m) throw new Error(`Muur '${naarMuurId}' bestaat niet.`);
  const a = aansluitingen(m, v.muren);
  const binnen = muurLengte(m) - a.start - a.eind;
  if (o.breedte > binnen + 0.5) throw new Error(`Deze ${o.soort} (${o.breedte} mm) is breder dan de muur (${Math.round(binnen)} mm).`);
  const afstand = afstandVanafA ?? Math.round((binnen - o.breedte) / 2);
  return wijzigOpening(v, id, { muurId: naarMuurId, offset: Math.round(a.start + afstand) });
}

/** Afstand van binnenhoek A van haar muur tot de opening (zoals op de werf gemeten). */
export function afstandVanafA(v: Verdieping, o: Opening): number {
  const m = v.muren.find((x) => x.id === o.muurId);
  return m ? Math.round(o.offset - aansluitingen(m, v.muren).start) : o.offset;
}

/**
 * Leesbare naam van een muur, voor keuzelijsten: "Leefruimte — linkse muur",
 * "Tussenmuur Leefruimte / Slaapkamer", met de binnenmaat erbij.
 */
export function muurOmschrijving(v: Verdieping, muurId: string): string {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) return muurId;
  const binnen = Math.round(muurLengte(m) - aansluitingen(m, v.muren).start - aansluitingen(m, v.muren).eind);
  const buren = v.ruimtes.filter((r) => r.muurIds.includes(m.id));
  if (buren.length >= 2) return `Tussenmuur ${buren.map((r) => r.naam).join(" / ")} · ${binnen} mm`;
  const r = buren[0];
  if (!r) return `Losse muur · ${binnen} mm`;
  const mid = { x: (m.start.x + m.eind.x) / 2, y: (m.start.y + m.eind.y) / 2 };
  const z = zwaartepunt(r.contour);
  const dx = mid.x - z.x, dy = mid.y - z.y;
  const schuin = m.start.x !== m.eind.x && m.start.y !== m.eind.y;
  const kant = schuin ? "schuine" : m.start.x === m.eind.x ? (dx < 0 ? "linkse" : "rechtse") : dy < 0 ? "onderste" : "bovenste";
  return `${r.naam} — ${kant} muur · ${binnen} mm`;
}

/**
 * Dichtstbijzijnde muur bij een punt (bv. waar de vinger of muis is), met de
 * plaats langs die muur (`t`, vanaf de hartlijnstart). `null` als geen muur
 * dichter ligt dan `marge` mm van het muurvlak.
 */
export function muurBijPunt(v: Verdieping, p: Punt, marge = 400): { muurId: string; t: number; afstand: number } | null {
  let beste: { muurId: string; t: number; afstand: number } | null = null;
  for (const m of v.muren) {
    const L = muurLengte(m);
    const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
    const t = (p.x - m.start.x) * u.x + (p.y - m.start.y) * u.y;
    if (t < 0 || t > L) continue;
    const afstand = Math.abs((p.x - m.start.x) * -u.y + (p.y - m.start.y) * u.x) - m.dikte / 2;
    if (afstand > marge) continue;
    if (!beste || afstand < beste.afstand) beste = { muurId: m.id, t, afstand };
  }
  return beste;
}

export function verwijderOpening(v: Verdieping, id: string): Verdieping {
  if (!v.openingen.some((x) => x.id === id)) throw new Error(`Opening '${id}' bestaat niet.`);
  return { ...v, openingen: v.openingen.filter((x) => x.id !== id) };
}

// ---------------------------------------------------------------- muur uitbreken

/**
 * Breekt een tussenmuur uit: de muur verdwijnt en de twee ruimtes aan
 * weerszijden worden één ruimte — ook als ze verschillend van vorm of
 * breedte zijn (bv. slaapkamer + smallere berging → L-vormige ruimte).
 * Werkt voor haakse plannen (muren evenwijdig aan de assen). Gesplitste
 * muurstukken die daarna recht doorlopen, worden terug één muur.
 *
 * LET OP: of de muur dragend is, kan de app niet vaststellen. Een dragende
 * muur wegnemen vraagt een stabiliteitsstudie (ingenieur) en meestal een
 * omgevingsvergunning. De webapp toont die waarschuwing vóór het uitbreken.
 */
export function breekMuurUit(v: Verdieping, muurId: string): Verdieping {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) throw new Error(`Muur '${muurId}' bestaat niet.`);
  const buren = v.ruimtes.filter((r) => r.muurIds.includes(muurId));
  if (buren.length !== 2) throw new Error("Alleen een muur tussen twee ruimtes kan uitgebroken worden (geen buitenmuur).");
  const [a, b] = buren as [Ruimte, Ruimte];
  const horizontaal = m.start.y === m.eind.y, verticaal = m.start.x === m.eind.x;
  // Schuine muur of niet-haakse ruimtes: contouren aan elkaar naaien over de doorgang.
  if ((!horizontaal && !verticaal) || ![a, b].every((r) => isHaaks(r.contour))) return samenvoegen(v, m, a, b, naaiSamen(a, b, m));

  // Langs de muur: welke stukken rand van a en b liggen tegen de muur? Daar komt een "brug" over de muurdikte.
  const as = horizontaal ? "y" : "x", langs = horizontaal ? "x" : "y";
  const midden = m.start[as];
  const randen = (r: Ruimte) => {
    const uit: Array<{ van: number; tot: number; op: number }> = [];
    r.contour.forEach((p, k) => {
      const q = r.contour[(k + 1) % r.contour.length]!;
      if (p[as] !== q[as] || Math.abs(Math.abs(p[as] - midden) - m.dikte / 2) > 1) return;
      uit.push({ van: Math.min(p[langs], q[langs]), tot: Math.max(p[langs], q[langs]), op: p[as] });
    });
    return uit;
  };
  const lo = Math.min(m.start[langs], m.eind[langs]), hi = Math.max(m.start[langs], m.eind[langs]);
  const bruggen: Punt[][] = [];
  for (const ra of randen(a)) for (const rb of randen(b)) {
    if (Math.sign(ra.op - midden) === Math.sign(rb.op - midden)) continue; // zelfde kant
    const van = Math.max(ra.van, rb.van, lo), tot = Math.min(ra.tot, rb.tot, hi);
    if (tot - van < 1) continue;
    const y1 = Math.min(ra.op, rb.op), y2 = Math.max(ra.op, rb.op);
    const P = (t: number, o: number): Punt => (horizontaal ? { x: t, y: o } : { x: o, y: t });
    bruggen.push([P(van, y1), P(tot, y1), P(tot, y2), P(van, y2)]);
  }
  if (!bruggen.length) throw new Error("De twee ruimtes liggen niet tegenover elkaar langs deze muur.");
  return samenvoegen(v, m, a, b, haakseVereniging([a.contour, b.contour, ...bruggen]));
}

function samenvoegen(v: Verdieping, m: Muur, a: Ruimte, b: Ruimte, contour: Punt[]): Verdieping {
  const muurId = m.id;
  const groot = oppervlakte(a.contour) >= oppervlakte(b.contour) ? a : b;
  const klein = groot === a ? b : a;
  const samen: Ruimte = {
    ...groot,
    naam: `${groot.naam} + ${klein.naam}`,
    contour,
    plafondhoogte: Math.min(a.plafondhoogte, b.plafondhoogte),
    muurIds: [...new Set([...a.muurIds, ...b.muurIds])].filter((id) => id !== muurId),
    notities: [a.notities, b.notities].filter(Boolean).join("\n") || undefined,
  };
  return voegMurenSamen({
    ...v,
    muren: v.muren.filter((x) => x.id !== muurId),
    openingen: v.openingen.filter((o) => o.muurId !== muurId),
    ruimtes: v.ruimtes.filter((r) => r !== klein).map((r) => (r === groot ? samen : r)),
  });
}

/**
 * Twee ruimtes aan weerszijden van een (eventueel schuine) muur samenvoegen:
 * rond A lopen tot aan de muur, oversteken naar B, rond B lopen, terug
 * oversteken en rond A verder. Vereist dat elke ruimte één rand tegen de muur
 * heeft en dat die randen tegenover elkaar liggen.
 */
export function naaiSamen(a: Ruimte, b: Ruimte, m: Muur): Punt[] {
  const L = muurLengte(m);
  const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
  const n = { x: -u.y, y: u.x };
  const t = (p: Punt) => (p.x - m.start.x) * u.x + (p.y - m.start.y) * u.y;
  const d = (p: Punt) => (p.x - m.start.x) * n.x + (p.y - m.start.y) * n.y;
  const rand = (r: Ruimte) => {
    let beste: { i: number; lengte: number; kant: number } | null = null;
    r.contour.forEach((p, i) => {
      const q = r.contour[(i + 1) % r.contour.length]!;
      const op = (x: Punt) => Math.abs(Math.abs(d(x)) - m.dikte / 2) <= 2;
      if (!op(p) || !op(q) || Math.sign(d(p)) !== Math.sign(d(q))) return;
      const lengte = Math.abs(t(q) - t(p));
      if (!beste || lengte > beste.lengte) beste = { i, lengte, kant: Math.sign(d(p)) };
    });
    return beste as { i: number; lengte: number; kant: number } | null;
  };
  const ra = rand(a), rb = rand(b);
  if (!ra || !rb || ra.kant === rb.kant) throw new Error("De twee ruimtes liggen niet tegenover elkaar langs deze muur.");
  const A = a.contour, B = b.contour, na = A.length, nb = B.length;
  const a0 = A[ra.i]!, a1 = A[(ra.i + 1) % na]!, b0 = B[rb.i]!, b1 = B[(rb.i + 1) % nb]!;
  const t1 = Math.max(Math.min(t(a0), t(a1)), Math.min(t(b0), t(b1)), 0);
  const t2 = Math.min(Math.max(t(a0), t(a1)), Math.max(t(b0), t(b1)), L);
  if (t2 - t1 < 1) throw new Error("De twee ruimtes liggen niet tegenover elkaar langs deze muur.");
  const opRand = (p: Punt, q: Punt, tt: number): Punt => {
    const f = (tt - t(p)) / (t(q) - t(p));
    return { x: Math.round(p.x + (q.x - p.x) * f), y: Math.round(p.y + (q.y - p.y) * f) };
  };
  const vooruit = t(a1) > t(a0);
  const eerste = vooruit ? t1 : t2, tweede = vooruit ? t2 : t1;
  const pad: Punt[] = [opRand(a0, a1, eerste), opRand(b0, b1, eerste)];
  for (let k = 1; k <= nb; k++) pad.push(B[(rb.i + k) % nb]!); // van b1 rond tot b0
  pad.push(opRand(b0, b1, tweede), opRand(a0, a1, tweede));
  for (let k = 1; k <= na; k++) pad.push(A[(ra.i + k) % na]!); // van a1 rond tot a0
  // dubbele punten en punten op een rechte lijn weglaten (afronding: ±1 mm)
  let c = pad.filter((p, k) => { const q = pad[(k + 1) % pad.length]!; return Math.hypot(p.x - q.x, p.y - q.y) >= 1; });
  let veranderd = true;
  while (veranderd && c.length > 3) {
    veranderd = false;
    for (let k = 0; k < c.length; k++) {
      const p = c[(k - 1 + c.length) % c.length]!, q = c[k]!, r = c[(k + 1) % c.length]!;
      const lpr = Math.hypot(r.x - p.x, r.y - p.y);
      if (lpr > 0 && Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / lpr < 1) { c.splice(k, 1); veranderd = true; break; }
    }
  }
  const brug = oppervlakte([opRand(a0, a1, t1), opRand(a0, a1, t2), opRand(b0, b1, t2), opRand(b0, b1, t1)]);
  const verwacht = oppervlakte(A) + oppervlakte(B) + brug;
  if (zelfkruisend(c) || Math.abs(oppervlakte(c) - verwacht) > 0.002 * verwacht + 20000)
    throw new Error("Deze twee ruimtes kunnen niet tot één ruimte samengevoegd worden (vorm te ingewikkeld).");
  if (getekendOpp(c) < 0) c = c.reverse();
  return c;
}

function getekendOpp(c: Punt[]): number {
  let s = 0;
  for (let k = 0; k < c.length; k++) { const p = c[k]!, q = c[(k + 1) % c.length]!; s += p.x * q.y - q.x * p.y; }
  return s / 2;
}

function isHaaks(c: Punt[]): boolean {
  return c.every((p, k) => {
    const q = c[(k + 1) % c.length]!;
    return p.x === q.x || p.y === q.y;
  });
}

/**
 * Vereniging van haakse veelhoeken (randen evenwijdig aan de assen) tot één
 * veelhoek, tegen de klok in, zonder overbodige tussenpunten. Werkt met een
 * rooster over alle coördinaten: elk vakje is binnen of buiten, de rand
 * tussen binnen en buiten wordt gevolgd. Fout als het resultaat uit losse
 * stukken bestaat of een gat heeft.
 */
export function haakseVereniging(veelhoeken: Punt[][]): Punt[] {
  if (!veelhoeken.every(isHaaks)) throw new Error("Alleen haakse vormen kunnen samengevoegd worden.");
  const xs = [...new Set(veelhoeken.flat().map((p) => p.x))].sort((a, b) => a - b);
  const ys = [...new Set(veelhoeken.flat().map((p) => p.y))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1;
  const binnen: boolean[][] = [];
  for (let i = 0; i < nx; i++) {
    binnen.push([]);
    for (let j = 0; j < ny; j++) {
      const c = { x: (xs[i]! + xs[i + 1]!) / 2, y: (ys[j]! + ys[j + 1]!) / 2 };
      binnen[i]!.push(veelhoeken.some((v) => binnenVeelhoek(c, v)));
    }
  }
  const b = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && binnen[i]![j]!;
  // gerichte randen, binnenkant links
  const randen = new Map<string, Punt[]>();
  const sleutel = (p: Punt) => `${p.x},${p.y}`;
  const voeg = (p: Punt, q: Punt) => randen.set(sleutel(p), [...(randen.get(sleutel(p)) ?? []), q]);
  let aantal = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!b(i, j)) continue;
    const x0 = xs[i]!, x1 = xs[i + 1]!, y0 = ys[j]!, y1 = ys[j + 1]!;
    if (!b(i, j - 1)) { voeg({ x: x0, y: y0 }, { x: x1, y: y0 }); aantal++; }
    if (!b(i + 1, j)) { voeg({ x: x1, y: y0 }, { x: x1, y: y1 }); aantal++; }
    if (!b(i, j + 1)) { voeg({ x: x1, y: y1 }, { x: x0, y: y1 }); aantal++; }
    if (!b(i - 1, j)) { voeg({ x: x0, y: y1 }, { x: x0, y: y0 }); aantal++; }
  }
  if (!aantal) throw new Error("Lege vorm.");
  for (const lijst of randen.values()) if (lijst.length > 1) throw new Error("De samengevoegde ruimte raakt zichzelf in één punt; dat kan niet.");
  const start = [...randen.keys()][0]!;
  const pad: Punt[] = [];
  let huidig = start, stappen = 0;
  do {
    const [x, y] = huidig.split(",").map(Number) as [number, number];
    pad.push({ x, y });
    huidig = sleutel(randen.get(huidig)![0]!);
    stappen++;
  } while (huidig !== start && stappen <= aantal);
  if (stappen !== aantal) throw new Error("De samengevoegde ruimte bestaat uit losse stukken of heeft een gat.");
  // tussenpunten op een rechte lijn weglaten
  return pad.filter((p, k) => {
    const a = pad[(k - 1 + pad.length) % pad.length]!, c = pad[(k + 1) % pad.length]!;
    return !((a.x === p.x && p.x === c.x) || (a.y === p.y && p.y === c.y));
  });
}

// ---------------------------------------------------------------- muurstukken samenvoegen

const BETROUWBAARHEID: Bron["methode"][] = ["overgenomen", "gescand", "gecorrigeerd", "manueel", "laser"];

/**
 * Voegt muurstukken die recht doorlopen terug samen tot één muur: waar
 * precies twee muren elkaar raken, in elkaars verlengde liggen, even dik en
 * hoog zijn en bij dezelfde ruimtes horen. Zo verdwijnen tussenmaten in de
 * maatketting op plaatsen waar geen muur meer aansluit. Ramen en deuren
 * houden hun plaats. De zwakste meetbron van de stukken blijft behouden.
 */
export function voegMurenSamen(v: Verdieping): Verdieping {
  let huidig = v;
  for (let ronde = 0; ronde < 1000; ronde++) {
    const volgende = eenSamenvoeging(huidig);
    if (!volgende) return huidig;
    huidig = volgende;
  }
  return huidig;
}

function eenSamenvoeging(v: Verdieping): Verdieping | null {
  const sleutel = (p: Punt) => `${p.x},${p.y}`;
  const raakt = new Map<string, Muur[]>();
  for (const m of v.muren) for (const p of [m.start, m.eind]) raakt.set(sleutel(p), [...(raakt.get(sleutel(p)) ?? []), m]);
  const ruimtesVan = (id: string) => v.ruimtes.filter((r) => r.muurIds.includes(id)).map((r) => r.id).sort().join("|");
  for (const [k, muren] of raakt) {
    if (muren.length !== 2) continue;
    const [a, b] = muren as [Muur, Muur];
    if (a.dikte !== b.dikte || a.hoogte !== b.hoogte || a.dragend !== b.dragend) continue;
    if (ruimtesVan(a.id) !== ruimtesVan(b.id)) continue;
    const La = muurLengte(a), Lb = muurLengte(b);
    const ua = { x: (a.eind.x - a.start.x) / La, y: (a.eind.y - a.start.y) / La };
    const ub = { x: (b.eind.x - b.start.x) / Lb, y: (b.eind.y - b.start.y) / Lb };
    if (Math.abs(ua.x * ub.y - ua.y * ub.x) > RECHTDOOR) continue;
    const p = sleutel(a.eind) === k ? a.eind : a.start;
    const verB = sleutel(b.start) === k ? b.eind : b.start;
    // Enkel samenvoegen als het verre uiteinde van b echt op de lijn van a ligt (± 1,5 mm,
    // afrondingsverschil). Een klein knikje (bv. na een hoekverplaatsing) blijft twee muren:
    // rechttrekken zou de vloer naast de muur laten liggen.
    if (Math.abs((verB.x - a.start.x) * ua.y - (verB.y - a.start.y) * ua.x) > 1.5) continue;
    // nieuwe muur in de richting van a
    const start = sleutel(a.eind) === k ? a.start : verB;
    const eind = sleutel(a.eind) === k ? verB : a.eind;
    if (sleutel(start) === sleutel(eind)) continue;
    void p;
    const proj = (q: Punt) => (q.x - start.x) * ua.x + (q.y - start.y) * ua.y;
    const zwakste = [a.bron, b.bron].sort((x, y) => BETROUWBAARHEID.indexOf(x.methode) - BETROUWBAARHEID.indexOf(y.methode))[0]!;
    const nieuw: Muur = { ...a, start, eind, bron: zwakste };
    const openingen = v.openingen.map((o) => {
      if (o.muurId !== a.id && o.muurId !== b.id) return o;
      const w = o.muurId === a.id ? a : b, uw = o.muurId === a.id ? ua : ub;
      const p1 = { x: w.start.x + uw.x * o.offset, y: w.start.y + uw.y * o.offset };
      const p2 = { x: w.start.x + uw.x * (o.offset + o.breedte), y: w.start.y + uw.y * (o.offset + o.breedte) };
      return { ...o, muurId: a.id, offset: Math.round(Math.min(proj(p1), proj(p2))) };
    });
    return {
      ...v,
      muren: v.muren.filter((x) => x.id !== b.id).map((x) => (x.id === a.id ? nieuw : x)),
      openingen,
      ruimtes: v.ruimtes.map((r) => (r.muurIds.includes(b.id) ? { ...r, muurIds: [...new Set(r.muurIds.map((id) => (id === b.id ? a.id : id)))] } : r)),
    };
  }
  return null;
}

// ---------------------------------------------------------------- muur verschuiven

/** Richting in woorden (plan van bovenaf): naar rechts, naar rechtsboven, naar boven, … */
export function richtingLabel(x: number, y: number): string {
  const namen = ["rechts", "rechtsboven", "boven", "linksboven", "links", "linksonder", "onder", "rechtsonder"];
  const sector = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
  return `naar ${namen[sector]}`;
}

/** De twee richtingen waarin een muur verschoven kan worden, met een leesbaar label. */
export function verschuifRichtingen(m: Muur): Array<{ teken: 1 | -1; label: string }> {
  const L = muurLengte(m);
  const n = { x: -(m.eind.y - m.start.y) / L, y: (m.eind.x - m.start.x) / L };
  return [
    { teken: 1, label: richtingLabel(n.x, n.y) },
    { teken: -1, label: richtingLabel(-n.x, -n.y) },
  ];
}

/**
 * Verschuift een muur haaks op zichzelf over `afstand` mm (positief = naar
 * links van de richting A→B; gebruik verschuifRichtingen voor labels).
 * Aansluitende muren rekken mee of worden korter, ruimtes passen zich aan,
 * ramen en deuren in aansluitende muren blijven op hun plaats. Bedoeld om de
 * opmeting te corrigeren (de muur staat elders dan gescand).
 */
export function verschuifMuur(v: Verdieping, muurId: string, afstand: number, methode: "gecorrigeerd" | "manueel" | "laser" = "gecorrigeerd"): Verdieping {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) throw new Error(`Muur '${muurId}' bestaat niet.`);
  const d = Math.round(afstand);
  if (!d) return v;
  const L = muurLengte(m);
  const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
  const n = { x: -u.y, y: u.x };
  const dx = Math.round(n.x * d), dy = Math.round(n.y * d);
  const zelfde = (p: Punt, q: Punt) => p.x === q.x && p.y === q.y;
  for (const p of [m.start, m.eind]) {
    const rechtdoor = v.muren.some((w) => w.id !== m.id && (zelfde(w.start, p) || zelfde(w.eind, p)) &&
      Math.abs(((w.eind.x - w.start.x) * u.y - (w.eind.y - w.start.y) * u.x) / muurLengte(w)) < RECHTDOOR);
    if (rechtdoor) throw new Error("Deze muur loopt recht door in een andere muur. Verschuiven zou een knik geven; pas de maten van de ruimte aan.");
  }
  // Nieuwe uiteinden: de verschoven hartlijn snijden met de hartlijn van de aansluitende
  // muur, zodat die muur langer of korter wordt maar zijn richting houdt (ook schuin).
  const as = { p: { x: m.start.x + n.x * d, y: m.start.y + n.y * d }, d: u };
  const nieuwPunt = (p: Punt): Punt => {
    for (const w of v.muren) {
      if (w.id === m.id || !(zelfde(w.start, p) || zelfde(w.eind, p))) continue;
      const Lw = muurLengte(w);
      const dw = { x: (w.eind.x - w.start.x) / Lw, y: (w.eind.y - w.start.y) / Lw };
      const k = as.d.x * dw.y - as.d.y * dw.x;
      if (Math.abs(k) < RECHTDOOR) continue;
      // Bijna evenwijdig (< ± 10°): het snijpunt zou ver weg liggen en de muur
      // absurd lang maken (bv. bij een heel kort muurstukje). Weigeren.
      if (Math.abs(k) < 0.17)
        throw new Error("Een aansluitende muur loopt bijna in het verlengde van deze muur (minder dan 10°). Verschuiven kan hier niet; pas de hoek of de maten aan.");
      const t = ((w.start.x - as.p.x) * dw.y - (w.start.y - as.p.y) * dw.x) / k;
      return { x: Math.round(as.p.x + as.d.x * t), y: Math.round(as.p.y + as.d.y * t) };
    }
    return { x: p.x + dx, y: p.y + dy }; // vrij uiteinde
  };
  const naarS = nieuwPunt(m.start), naarE = nieuwPunt(m.eind);
  const schuif = (p: Punt): Punt => (zelfde(p, m.start) ? naarS : zelfde(p, m.eind) ? naarE : p);
  const bron: Bron = { methode, ...(methode === "laser" ? { nauwkeurigheidMm: 2 } : {}) };

  const muren = v.muren.map((w) => {
    if (w.id === m.id) return { ...w, start: schuif(w.start), eind: schuif(w.eind), bron };
    const s = schuif(w.start), e = schuif(w.eind);
    return s === w.start && e === w.eind ? w : { ...w, start: s, eind: e, bron };
  });
  const nieuw = new Map(muren.map((w) => [w.id, w]));
  // openingen in aansluitende muren op dezelfde plaats houden
  const openingen = v.openingen.map((o) => {
    const oud = v.muren.find((w) => w.id === o.muurId)!, w = nieuw.get(o.muurId)!;
    if (o.muurId === m.id || zelfde(oud.start, w.start)) return o;
    const Lo = muurLengte(oud), Lw = muurLengte(w);
    const uo = { x: (oud.eind.x - oud.start.x) / Lo, y: (oud.eind.y - oud.start.y) / Lo };
    const uw = { x: (w.eind.x - w.start.x) / Lw, y: (w.eind.y - w.start.y) / Lw };
    const p = { x: oud.start.x + uo.x * o.offset, y: oud.start.y + uo.y * o.offset };
    return { ...o, offset: Math.round((p.x - w.start.x) * uw.x + (p.y - w.start.y) * uw.y) };
  });
  // ruimtecontouren: hoekpunten op de vlakken van de gewijzigde muren opnieuw berekenen
  const gewijzigd = new Set(muren.filter((w, k) => w !== v.muren[k]).map((w) => w.id));
  const ruimtes = herberekenContouren(v, muren, gewijzigd);
  const uit: Verdieping = houdOpeningenInMuur({ ...v, muren, openingen, ruimtes }, "verschuiven");

  // controles
  for (const w of muren) {
    if (muurLengte(w) < 1) throw new Error("Zo ver verschuiven laat een muur verdwijnen.");
    if (w.id !== m.id && w !== v.muren.find((x) => x.id === w.id) && muurLengte(w) - aansluitingen(w, muren).start - aansluitingen(w, muren).eind <= 0)
      throw new Error("Zo ver verschuiven maakt een aansluitende muur te kort.");
  }
  for (const r of ruimtes) {
    const oud = v.ruimtes.find((x) => x.id === r.id)!;
    if (Math.sign(getekend(r.contour)) !== Math.sign(getekend(oud.contour)) || oppervlakte(r.contour) < 1)
      throw new Error(`Zo ver verschuiven gaat door ruimte '${r.naam}'.`);
  }

  for (const s of v.sparingen ?? []) {
    if (!ruimtes.some((r) => s.contour.every((p) => binnenVeelhoek({ x: p.x + Math.sign(zwaartepunt(s.contour).x - p.x), y: p.y + Math.sign(zwaartepunt(s.contour).y - p.y) }, r.contour))))
      throw new Error(`Na het verschuiven valt een ${s.soort} buiten zijn ruimte.`);
  }
  return uit;
}

// ---------------------------------------------------------------- hoek verplaatsen

/**
 * Verplaatst een hoek: het punt waar twee muren samenkomen (of een vrij
 * muureinde) gaat naar `naar`. Zo maak je schuine muren, bv. van een
 * rechthoek een trapezium. Binnenhoeken van ruimtes worden opnieuw berekend
 * als snijpunt van de muurvlakken waarop ze lagen; ramen en deuren houden
 * hun afstand tot het vaste uiteinde van hun muur.
 * Niet bij een punt waar drie of meer muren samenkomen (dat zou een
 * doorlopende muur knikken): gebruik daar "muur verschuiven".
 */
export function verplaatsHoek(v: Verdieping, punt: Punt, naar: Punt, methode: "gecorrigeerd" | "manueel" | "laser" = "gecorrigeerd"): Verdieping {
  const zelfde = (p: Punt, q: Punt) => p.x === q.x && p.y === q.y;
  const doel = { x: Math.round(naar.x), y: Math.round(naar.y) };
  if (zelfde(punt, doel)) return v;
  const betrokken = v.muren.filter((m) => zelfde(m.start, punt) || zelfde(m.eind, punt));
  if (!betrokken.length) throw new Error("Hier ligt geen hoek van een muur.");
  if (betrokken.length > 2) throw new Error("Hier komen meer dan twee muren samen. Verschuif de muur in de plaats van de hoek.");
  if (v.muren.some((m) => !betrokken.includes(m) && (zelfde(m.start, doel) || zelfde(m.eind, doel))))
    throw new Error("Op die plaats ligt al een andere hoek.");
  // Een muur die aan de overkant recht doorloopt in een ander stuk (gesplitst door een
  // aangrenzende ruimte), krijgt daar een knik. Een ruimte zonder hoekpunt op die plaats
  // kan die knik niet volgen: weigeren in plaats van een vloer te maken die de muur niet raakt.
  for (const w of betrokken) {
    const q = zelfde(w.start, punt) ? w.eind : w.start;
    const Lw = muurLengte(w);
    const uw = { x: (w.eind.x - w.start.x) / Lw, y: (w.eind.y - w.start.y) / Lw };
    const loopt = v.muren.some((x) => x !== w && (zelfde(x.start, q) || zelfde(x.eind, q)) &&
      Math.abs(((x.eind.x - x.start.x) * uw.y - (x.eind.y - x.start.y) * uw.x) / muurLengte(x)) < RECHTDOOR);
    if (!loopt) continue;
    // De ruimte kan de knik enkel volgen als er aan háár kant een muur aansluit op het
    // knikpunt (zoals een tussenmuur): dan heeft ze daar een hoek.
    const nw = { x: -uw.y, y: uw.x };
    const zijMuren = v.muren.filter((x) => x !== w && (zelfde(x.start, q) || zelfde(x.eind, q)) &&
      Math.abs(((x.eind.x - x.start.x) * uw.y - (x.eind.y - x.start.y) * uw.x) / muurLengte(x)) >= RECHTDOOR);
    for (const r of v.ruimtes.filter((x) => x.muurIds.includes(w.id))) {
      const z = zwaartepunt(r.contour);
      const kantRuimte = Math.sign((z.x - w.start.x) * nw.x + (z.y - w.start.y) * nw.y);
      const heeftHoek = zijMuren.some((x) => {
        const o = zelfde(x.start, q) ? x.eind : x.start;
        return Math.sign((o.x - q.x) * nw.x + (o.y - q.y) * nw.y) === kantRuimte;
      });
      if (!heeftHoek)
        throw new Error(`Deze hoek verplaatsen zou een knik maken in de muur van '${r.naam}', op een plaats waar die ruimte geen hoek heeft. Verschuif de muur in de plaats, of verplaats eerst de aangrenzende ruimte.`);
    }
  }
  const bron: Bron = { methode, ...(methode === "laser" ? { nauwkeurigheidMm: 2 } : {}) };
  const muren = v.muren.map((m) => {
    if (!betrokken.includes(m)) return m;
    return { ...m, start: zelfde(m.start, punt) ? doel : m.start, eind: zelfde(m.eind, punt) ? doel : m.eind, bron };
  });
  for (const m of muren) if (muurLengte(m) < 1) throw new Error("Zo ver verplaatsen laat een muur verdwijnen.");
  const nieuw = new Map(muren.map((m) => [m.id, m]));

  const ruimtes = herberekenContouren(v, muren, new Set(betrokken.map((m) => m.id)));
  // openingen: afstand tot het vaste uiteinde behouden
  const openingen = v.openingen.map((o) => {
    const oud = v.muren.find((m) => m.id === o.muurId)!;
    if (!betrokken.includes(oud) || !zelfde(oud.start, punt)) return o;
    const verschil = muurLengte(nieuw.get(o.muurId)!) - muurLengte(oud);
    return { ...o, offset: Math.round(o.offset + verschil) };
  });
  const uit: Verdieping = houdOpeningenInMuur({ ...v, muren, ruimtes, openingen }, "verplaatsen");

  // controles
  for (const r of ruimtes) {
    const oud = v.ruimtes.find((x) => x.id === r.id)!;
    if (Math.sign(getekend(r.contour)) !== Math.sign(getekend(oud.contour)) || oppervlakte(r.contour) < 1)
      throw new Error(`Zo ver verplaatsen klapt ruimte '${r.naam}' om.`);
    if (zelfkruisend(r.contour)) throw new Error(`Zo ver verplaatsen laat ruimte '${r.naam}' zichzelf kruisen.`);
  }

  for (const s of v.sparingen ?? []) {
    const z = zwaartepunt(s.contour);
    if (!ruimtes.some((r) => s.contour.every((p) => binnenVeelhoek({ x: p.x + Math.sign(z.x - p.x), y: p.y + Math.sign(z.y - p.y) }, r.contour))))
      throw new Error(`Na het verplaatsen valt een ${s.soort} buiten zijn ruimte.`);
  }
  return uit;
}

/**
 * Hoekpunten van ruimtes opnieuw berekenen nadat muren verplaatst zijn.
 * Elk hoekpunt lag op één of meer muurvlakken (muur + kant, gezocht met
 * ±2 mm marge: hoekpunten zijn op hele mm afgerond, wat bij schuine muren
 * tot ±0,7 mm afwijking geeft). Ligt het op een vlak van een gewijzigde
 * muur, dan wordt het het snijpunt van diezelfde vlakken in de nieuwe stand.
 * Zo glijdt een binnenhoek langs een schuine muur in plaats van er los van
 * te raken.
 */
export function herberekenContouren(v: Verdieping, muren: Muur[], gewijzigd: Set<string>): Ruimte[] {
  // buiten: hoe ver (mm) het hoekpunt voorbij de uiteinden van de muur ligt (0 = binnen de lengte)
  type Vlak = { muur: Muur; kant: 1 | -1; buiten: number };
  const nieuw = new Map(muren.map((m) => [m.id, m]));
  // enkel de vlakken van de muren die deze ruimte begrenzen: een hoekpunt van de
  // slaapkamer mag niet verschuiven omdat een muur van de leefruimte ernaast draait
  const vlakkenDoor = (q: Punt, eigen: Set<string>): Vlak[] => {
    const uit: Vlak[] = [];
    for (const m of v.muren) {
      if (!eigen.has(m.id)) continue;
      const L = muurLengte(m);
      const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
      const n = { x: -u.y, y: u.x };
      const t = (q.x - m.start.x) * u.x + (q.y - m.start.y) * u.y;
      const d = (q.x - m.start.x) * n.x + (q.y - m.start.y) * n.y;
      if (t < -m.dikte * 2 || t > L + m.dikte * 2) continue;
      if (Math.abs(Math.abs(d) - m.dikte / 2) <= 2) uit.push({ muur: m, kant: d > 0 ? 1 : -1, buiten: Math.max(0, -t, t - L) });
    }
    // Voorrang aan vlakken waar het hoekpunt binnen de lengte van de muur ligt: bij een
    // knik in een gevel ligt een hoekpunt ook vlak bij het verlengde van het andere stuk.
    return uit.sort((a, b) => a.buiten - b.buiten);
  };
  const lijn = (vl: Vlak) => {
    const m = nieuw.get(vl.muur.id) ?? vl.muur;
    const L = muurLengte(m);
    const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
    const n = { x: -u.y, y: u.x };
    return { p: { x: m.start.x + n.x * vl.kant * (m.dikte / 2), y: m.start.y + n.y * vl.kant * (m.dikte / 2) }, d: u, muur: m };
  };
  // Snijpunt van twee vlakken. Een vloerhoek ligt altijd bij een muuraansluiting: het
  // snijpunt telt enkel als het binnen twee muurdiktes (gedeeld door de sinus van de hoek)
  // van een uiteinde van een van beide muren ligt. Twee stukken die bijna recht doorlopen (afronding) snijden elkaar ver
  // weg en vormen dus geen hoek; een echte, ondiepe knik (enkele graden) wel.
  const snij = (a: ReturnType<typeof lijn>, b: ReturnType<typeof lijn>): Punt | null => {
    const k = a.d.x * b.d.y - a.d.y * b.d.x;
    if (Math.abs(k) < 0.005) return null;
    const t = ((b.p.x - a.p.x) * b.d.y - (b.p.y - a.p.y) * b.d.x) / k;
    const x = { x: a.p.x + a.d.x * t, y: a.p.y + a.d.y * t };
    // bij een spitse hoek ligt het snijpunt verder van het uiteinde (± dikte / sin(hoek))
    const grens = (2 * Math.max(a.muur.dikte, b.muur.dikte)) / Math.max(Math.abs(k), 0.05);
    const bij = [a.muur.start, a.muur.eind, b.muur.start, b.muur.eind].some((e) => Math.hypot(e.x - x.x, e.y - x.y) <= grens);
    return bij ? x : null;
  };
  return v.ruimtes.map((r) => ({
    ...r,
    contour: r.contour.map((q) => {
      const vl = vlakkenDoor(q, new Set(r.muurIds));
      const geraakt = vl.filter((x) => gewijzigd.has(x.muur.id));
      if (!geraakt.length) return q;
      for (const a of geraakt) for (const b of vl) {
        if (a === b) continue;
        const p = snij(lijn(a), lijn(b));
        if (p) return { x: Math.round(p.x), y: Math.round(p.y) };
      }
      // enkel op één gewijzigd vlak: loodrecht op de nieuwe stand projecteren
      const l = lijn(geraakt[0]!);
      const t = (q.x - l.p.x) * l.d.x + (q.y - l.p.y) * l.d.y;
      return { x: Math.round(l.p.x + l.d.x * t), y: Math.round(l.p.y + l.d.y * t) };
    }),
  }));
}

const LIDWOORD: Record<Opening["soort"], string> = { raam: "het raam", deur: "de deur", doorgang: "de doorgang" };

/**
 * Ramen en deuren in hun muur houden na het wijzigen van muren: past een
 * opening niet meer, dan schuift ze zo weinig mogelijk op tot ze weer tussen
 * de binnenhoeken past. Enkel als de muur te kort is (of de opening zou
 * overlappen met een andere), volgt een duidelijke melding.
 */
export function houdOpeningenInMuur(v: Verdieping, werkwoord: string): Verdieping {
  const openingen = v.openingen.map((o) => {
    const w = v.muren.find((m) => m.id === o.muurId);
    if (!w) return o;
    const a = aansluitingen(w, v.muren);
    const min = a.start, max = muurLengte(w) - a.eind - o.breedte;
    if (o.offset >= min - 0.5 && o.offset <= max + 0.5) return o;
    if (max < min - 0.5) {
      const naam = muurOmschrijving(v, w.id).split(" · ")[0];
      throw new Error(`Na het ${werkwoord} is de muur te kort voor ${LIDWOORD[o.soort]} van ${o.breedte} mm (${naam}: nog ${Math.max(0, Math.round(max + o.breedte - min))} mm). Maak ${LIDWOORD[o.soort]} smaller of sleep minder ver.`);
    }
    return { ...o, offset: Math.round(Math.min(Math.max(o.offset, min), max)) };
  });
  for (const o of openingen) {
    const botsing = openingen.find((x) => x !== o && x.muurId === o.muurId && x.offset < o.offset + o.breedte && o.offset < x.offset + x.breedte);
    if (botsing) {
      const naam = muurOmschrijving(v, o.muurId).split(" · ")[0];
      throw new Error(`Na het ${werkwoord} zouden ${LIDWOORD[o.soort]} en ${LIDWOORD[botsing.soort]} in ${naam} overlappen. Verplaats er eerst een.`);
    }
  }
  return { ...v, openingen };
}

/** Kruisen twee niet-aangrenzende randen van de veelhoek elkaar? */
export function zelfkruisend(c: Punt[]): boolean {
  const n = c.length;
  const kruist = (a: Punt, b: Punt, p: Punt, q: Punt) => {
    const o = (x: Punt, y: Punt, z: Punt) => Math.sign((y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x));
    return o(a, b, p) * o(a, b, q) < 0 && o(p, q, a) * o(p, q, b) < 0;
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (kruist(c[i]!, c[(i + 1) % n]!, c[j]!, c[(j + 1) % n]!)) return true;
  }
  return false;
}

function getekend(c: Punt[]): number {
  let s = 0;
  for (let k = 0; k < c.length; k++) {
    const a = c[k]!, b = c[(k + 1) % c.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

// ---------------------------------------------------------------- ruimte verwijderen

/**
 * Verwijdert een ruimte, met de muren die alleen bij deze ruimte horen en de
 * openingen en sparingen daarin. Gedeelde muren blijven staan (ze worden
 * buitenmuur van de buurruimte).
 */
export function verwijderRuimte(v: Verdieping, ruimteId: string): Verdieping {
  const r = v.ruimtes.find((x) => x.id === ruimteId);
  if (!r) throw new Error(`Ruimte '${ruimteId}' bestaat niet.`);
  if (v.ruimtes.length <= 1) throw new Error("Dit is de laatste ruimte van de verdieping. Verwijder dan de verdieping.");
  const gebruik = new Map<string, number>();
  for (const x of v.ruimtes) for (const id of x.muurIds) gebruik.set(id, (gebruik.get(id) ?? 0) + 1);
  const weg = new Set(r.muurIds.filter((id) => (gebruik.get(id) ?? 0) <= 1));
  return voegMurenSamen({
    ...v,
    muren: v.muren.filter((m) => !weg.has(m.id)),
    openingen: v.openingen.filter((o) => !weg.has(o.muurId)),
    ruimtes: v.ruimtes.filter((x) => x.id !== ruimteId),
    sparingen: (v.sparingen ?? []).filter((s) => !binnenVeelhoek(zwaartepunt(s.contour), r.contour)),
  });
}

// ---------------------------------------------------------------- sparingen

export interface NieuweSparing {
  ruimteId: string;
  soort: Sparing["soort"];
  /** Afstand van de linkse binnenmuur (kleinste x) van de ruimte, mm. */
  x: number;
  /** Afstand van de onderste binnenmuur (kleinste y) van de ruimte, mm. */
  y: number;
  breedte: number;
  lengte: number;
  methode?: "manueel" | "laser";
}

export function voegSparingToe(v: Verdieping, i: NieuweSparing): Verdieping {
  const r = v.ruimtes.find((x) => x.id === i.ruimteId);
  if (!r) throw new Error(`Ruimte '${i.ruimteId}' bestaat niet.`);
  const B = Math.round(i.breedte), L = Math.round(i.lengte);
  if (!(B > 0 && L > 0) || i.x < 0 || i.y < 0) throw new Error("Maten van de sparing moeten positief zijn.");
  const x0 = Math.min(...r.contour.map((p) => p.x)) + Math.round(i.x);
  const y0 = Math.min(...r.contour.map((p) => p.y)) + Math.round(i.y);
  const contour: Punt[] = [{ x: x0, y: y0 }, { x: x0 + B, y: y0 }, { x: x0 + B, y: y0 + L }, { x: x0, y: y0 + L }];
  const z = zwaartepunt(contour);
  // hoeken 1 mm naar binnen getrokken: een sparing tegen de muur is toegelaten
  const binnen = contour.every((p) => binnenVeelhoek({ x: p.x + Math.sign(z.x - p.x), y: p.y + Math.sign(z.y - p.y) }, r.contour));
  if (!binnen) throw new Error(`${lidwoord(i.soort)} ${i.soort} valt (deels) buiten '${r.naam}'.`);
  for (const s of v.sparingen ?? []) {
    if (contour.some((p) => binnenVeelhoek({ x: p.x + Math.sign(z.x - p.x), y: p.y + Math.sign(z.y - p.y) }, s.contour)) || binnenVeelhoek(zwaartepunt(s.contour), contour))
      throw new Error("Deze sparing overlapt met een bestaande sparing.");
  }
  const ids = new Set((v.sparingen ?? []).map((s) => s.id));
  let k = 1;
  while (ids.has(`s-${k}@${v.id}`)) k++;
  const bron: Bron = { methode: i.methode ?? "manueel", nauwkeurigheidMm: i.methode === "laser" ? 2 : 5 };
  return { ...v, sparingen: [...(v.sparingen ?? []), { id: `s-${k}@${v.id}`, soort: i.soort, contour, bron }] };
}

/** Maten van een sparing t.o.v. haar ruimte (zoals bij toevoegen): van links, van onder, breedte, lengte. */
export function sparingMaten(s: Sparing, r: Ruimte): { x: number; y: number; breedte: number; lengte: number } {
  const xs = s.contour.map((p) => p.x), ys = s.contour.map((p) => p.y);
  return {
    x: Math.min(...xs) - Math.min(...r.contour.map((p) => p.x)),
    y: Math.min(...ys) - Math.min(...r.contour.map((p) => p.y)),
    breedte: Math.max(...xs) - Math.min(...xs),
    lengte: Math.max(...ys) - Math.min(...ys),
  };
}

/** Verplaatst of vergroot een sparing (zelfde controles als bij toevoegen); het id blijft. */
export function wijzigSparing(v: Verdieping, id: string, i: Omit<NieuweSparing, "ruimteId">): Verdieping {
  const s = (v.sparingen ?? []).find((x) => x.id === id);
  if (!s) throw new Error(`Sparing '${id}' bestaat niet.`);
  const r = v.ruimtes.find((x) => binnenVeelhoek(zwaartepunt(s.contour), x.contour));
  if (!r) throw new Error("Deze sparing ligt in geen enkele ruimte.");
  const zonder = verwijderSparing(v, id);
  const met = voegSparingToe(zonder, { ...i, ruimteId: r.id });
  const nieuw = met.sparingen!.find((x) => !zonder.sparingen!.some((y) => y.id === x.id))!;
  return { ...met, sparingen: met.sparingen!.map((x) => (x === nieuw ? { ...x, id } : x)) };
}

/** Bepaald lidwoord: "het trapgat", "de vide", "de schacht". */
function lidwoord(soort: Sparing["soort"]): string {
  return soort === "trapgat" ? "Het" : "De";
}

export function verwijderSparing(v: Verdieping, id: string): Verdieping {
  return { ...v, sparingen: (v.sparingen ?? []).filter((s) => s.id !== id) };
}

/** Sparingen in de vloer van deze ruimte (zwaartepunt binnen de ruimte). */
export function sparingenIn(r: Ruimte, v: Verdieping): Sparing[] {
  return (v.sparingen ?? []).filter((s) => binnenVeelhoek(zwaartepunt(s.contour), r.contour));
}

/** Netto vloeroppervlak in mm²: ruimte min sparingen in haar vloer. */
export function vloerNetto(r: Ruimte, v: Verdieping): number {
  return Math.max(0, oppervlakte(r.contour) - sparingenIn(r, v).reduce((s, x) => s + oppervlakte(x.contour), 0));
}

/**
 * Netto plafondoppervlak in mm²: ruimte min sparingen in de vloer van de
 * verdieping er direct boven (hoogste peil hoger dan dit peil … het eerste daarboven).
 */
export function plafondNetto(r: Ruimte, v: Verdieping, p: Pick<Project, "verdiepingen">): number {
  const boven = [...p.verdiepingen].filter((x) => x.peil > v.peil).sort((a, b) => a.peil - b.peil)[0];
  const aftrek = (boven?.sparingen ?? [])
    .filter((s) => binnenVeelhoek(zwaartepunt(s.contour), r.contour))
    .reduce((s, x) => s + oppervlakte(x.contour), 0);
  return Math.max(0, oppervlakte(r.contour) - aftrek);
}

export function binnenVeelhoek(p: Punt, c: Punt[]): boolean {
  let in_ = false;
  for (let k = 0, j = c.length - 1; k < c.length; j = k++) {
    const a = c[k]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
}
