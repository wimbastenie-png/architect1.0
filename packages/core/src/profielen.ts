/**
 * Gewalste stalen profielen (Europese reeksen IPE, HEA, HEB) — afmetingen in
 * mm, oppervlakte in cm², traagheidsmoment in cm⁴, weerstandsmomenten in cm³,
 * gewicht in kg/m. Waarden zoals in de gangbare profieltabellen (EN 10365,
 * ArcelorMittal). Iz, It en Iw worden uit de afmetingen berekend (zie liggers.ts).
 */
export interface Profiel {
  naam: string;
  reeks: "IPE" | "HEA" | "HEB";
  h: number; b: number; tw: number; tf: number; r: number;
  A: number; G: number; Iy: number; Wel: number; Wpl: number;
}

const rij = (reeks: Profiel["reeks"], nr: number, h: number, b: number, tw: number, tf: number, r: number, A: number, G: number, Iy: number, Wel: number, Wpl: number): Profiel =>
  ({ naam: `${reeks} ${nr}`, reeks, h, b, tw, tf, r, A, G, Iy, Wel, Wpl });

export const PROFIELEN: Profiel[] = [
  rij("IPE", 100, 100, 55, 4.1, 5.7, 7, 10.3, 8.1, 171, 34.2, 39.4),
  rij("IPE", 120, 120, 64, 4.4, 6.3, 7, 13.2, 10.4, 318, 53.0, 60.7),
  rij("IPE", 140, 140, 73, 4.7, 6.9, 7, 16.4, 12.9, 541, 77.3, 88.3),
  rij("IPE", 160, 160, 82, 5.0, 7.4, 9, 20.1, 15.8, 869, 109, 124),
  rij("IPE", 180, 180, 91, 5.3, 8.0, 9, 23.9, 18.8, 1317, 146, 166),
  rij("IPE", 200, 200, 100, 5.6, 8.5, 12, 28.5, 22.4, 1943, 194, 221),
  rij("IPE", 220, 220, 110, 5.9, 9.2, 12, 33.4, 26.2, 2772, 252, 285),
  rij("IPE", 240, 240, 120, 6.2, 9.8, 15, 39.1, 30.7, 3892, 324, 367),
  rij("IPE", 270, 270, 135, 6.6, 10.2, 15, 45.9, 36.1, 5790, 429, 484),
  rij("IPE", 300, 300, 150, 7.1, 10.7, 15, 53.8, 42.2, 8356, 557, 628),
  rij("IPE", 330, 330, 160, 7.5, 11.5, 18, 62.6, 49.1, 11770, 713, 804),
  rij("IPE", 360, 360, 170, 8.0, 12.7, 18, 72.7, 57.1, 16270, 904, 1019),
  rij("IPE", 400, 400, 180, 8.6, 13.5, 21, 84.5, 66.3, 23130, 1156, 1307),
  rij("HEA", 100, 96, 100, 5, 8, 12, 21.2, 16.7, 349, 72.8, 83.0),
  rij("HEA", 120, 114, 120, 5, 8, 12, 25.3, 19.9, 606, 106, 119),
  rij("HEA", 140, 133, 140, 5.5, 8.5, 12, 31.4, 24.7, 1033, 155, 173),
  rij("HEA", 160, 152, 160, 6, 9, 15, 38.8, 30.4, 1673, 220, 245),
  rij("HEA", 180, 171, 180, 6, 9.5, 15, 45.3, 35.5, 2510, 294, 325),
  rij("HEA", 200, 190, 200, 6.5, 10, 18, 53.8, 42.3, 3692, 389, 430),
  rij("HEA", 220, 210, 220, 7, 11, 18, 64.3, 50.5, 5410, 515, 568),
  rij("HEA", 240, 230, 240, 7.5, 12, 21, 76.8, 60.3, 7763, 675, 745),
  rij("HEA", 260, 250, 260, 7.5, 12.5, 24, 86.8, 68.2, 10450, 836, 920),
  rij("HEA", 280, 270, 280, 8, 13, 24, 97.3, 76.4, 13670, 1013, 1112),
  rij("HEA", 300, 290, 300, 8.5, 14, 27, 112.5, 88.3, 18260, 1260, 1383),
  rij("HEB", 100, 100, 100, 6, 10, 12, 26.0, 20.4, 450, 89.9, 104),
  rij("HEB", 120, 120, 120, 6.5, 11, 12, 34.0, 26.7, 864, 144, 165),
  rij("HEB", 140, 140, 140, 7, 12, 12, 43.0, 33.7, 1509, 216, 246),
  rij("HEB", 160, 160, 160, 8, 13, 15, 54.3, 42.6, 2492, 311, 354),
  rij("HEB", 180, 180, 180, 8.5, 14, 15, 65.3, 51.2, 3831, 426, 482),
  rij("HEB", 200, 200, 200, 9, 15, 18, 78.1, 61.3, 5696, 570, 642),
  rij("HEB", 220, 220, 220, 9.5, 16, 18, 91.0, 71.5, 8091, 736, 828),
  rij("HEB", 240, 240, 240, 10, 17, 21, 106, 83.2, 11260, 938, 1053),
  rij("HEB", 260, 260, 260, 10, 17.5, 24, 118.4, 93.0, 14920, 1148, 1283),
  rij("HEB", 280, 280, 280, 10.5, 18, 24, 131.4, 103, 19270, 1376, 1534),
  rij("HEB", 300, 300, 300, 11, 19, 27, 149.1, 117, 25170, 1678, 1869),
];

/** Doorsnedegrootheden uit de afmetingen (mm-eenheden), inclusief afrondingen waar eenvoudig. */
export function berekendeGrootheden(p: Profiel) {
  const { h, b, tw, tf, r } = p;
  const hw = h - 2 * tf;
  const hoek = (4 - Math.PI) * r * r; // 4 afrondingen samen
  const A = 2 * b * tf + hw * tw + hoek; // mm²
  // Iy: flenzen + lijf + afrondingen (zwaartepunt afronding ≈ op afstand hw/2 − 0,2234 r)
  const Iy = (b * h ** 3 - (b - tw) * hw ** 3) / 12 + hoek * (hw / 2 - 0.2234 * r) ** 2;
  const Iz = (2 * tf * b ** 3 + hw * tw ** 3) / 12; // mm⁴ (zonder afrondingen: veilig)
  const It = (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3; // mm⁴ (zonder afrondingen: veilig)
  const Iw = (Iz * (h - tf) ** 2) / 4; // mm⁶
  const Av = Math.max(A - 2 * b * tf + (tw + 2 * r) * tf, hw * tw); // mm², η = 1
  return { A, Iy, Iz, It, Iw, Av, hw };
}
