/**
 * Bluetooth-laserafstandsmeters: de protocollen (alleen gegevens en het lezen
 * van de berichten; het verbinden gebeurt in de webapp met Web Bluetooth).
 *
 * Bronnen: publieke beschrijvingen en open-source projecten van gebruikers. Geen
 * officiële documentatie van de fabrikant, en niet getest met een echt toestel.
 * Een laser kan na een update van de fabrikant anders werken.
 */

export type LaserMerk = "leica" | "bosch";

export interface LaserProtocol {
  merk: LaserMerk;
  naam: string;
  /** toestellen, zoals ze in de Bluetooth-keuze verschijnen */
  modellen: string;
  service: string;
  meting: string;
  /** naamvoorvoegsels om het toestel te vinden */
  namen: string[];
  /** bericht om automatisch doorsturen aan te zetten (null = niet nodig) */
  start: number[] | null;
}

export const LASERS: LaserProtocol[] = [
  {
    merk: "leica", naam: "Leica DISTO", modellen: "DISTO D110, D1, D2, D510, D810, X3, X4, S910 (met Bluetooth Smart)",
    service: "3ab10100-f831-4395-b29d-570977d5bf94", meting: "3ab10101-f831-4395-b29d-570977d5bf94", namen: ["DISTO"], start: null,
  },
  {
    merk: "bosch", naam: "Bosch GLM", modellen: "GLM 50 C, GLM 100 C, GLM 120 C, PLR 30 C/40 C/50 C",
    service: "02a6c0d0-0451-4000-b000-fb3210111989", meting: "02a6c0d1-0451-4000-b000-fb3210111989", namen: ["GLM", "PLR", "Bosch"],
    // "autosync" aan: elke meting wordt doorgestuurd
    start: [0xc0, 0x55, 0x02, 0x01, 0x00, 0x1a],
  },
];

/** Een geldige afstand in meter (5 cm tot 250 m), anders null. */
const geldig = (m: number) => (Number.isFinite(m) && m >= 0.05 && m <= 250 ? m : null);

/** Leica DISTO: 4 bytes, getal met komma (float32, little-endian), in meter. */
export function leesLeica(d: DataView): number | null {
  if (d.byteLength < 4) return null;
  return geldig(d.getFloat32(0, true));
}

/**
 * Bosch GLM (Bluetooth LE): bericht C0 55 10 06 …; de afstand staat in byte 7–10
 * (float32, little-endian), in meter. Andere berichten (bevestigingen, status) negeren.
 */
export function leesBosch(d: DataView): number | null {
  if (d.byteLength < 11) return null;
  if (d.getUint8(0) !== 0xc0 || d.getUint8(1) !== 0x55 || d.getUint8(2) !== 0x10 || d.getUint8(3) !== 0x06) return null;
  return geldig(d.getFloat32(7, true));
}

export function leesMeting(merk: LaserMerk, d: DataView): number | null {
  return merk === "leica" ? leesLeica(d) : leesBosch(d);
}

/** Meter → mm, afgerond. */
export const naarMm = (m: number) => Math.round(m * 1000);

/** Merken die (nog) niet via de browser kunnen, met de reden. */
export const NIET_IN_BROWSER: { merk: string; uitleg: string }[] = [
  {
    merk: "Hilti (PD-C, PD-CS, PD-E)",
    uitleg: "Hilti publiceert het Bluetooth-protocol niet; de meters werken met de eigen Hilti-app. Om ze te koppelen is een eigen gsm-app nodig (iOS en Android) met toestemming of een ontwikkelaarspakket van Hilti. Tot dan: lees de maat af en typ ze in.",
  },
  {
    merk: "Stabila, Makita, DeWalt en andere",
    uitleg: "Eigen protocol, niet publiek beschreven. Kan later worden toegevoegd als de fabrikant de beschrijving geeft of een toestel beschikbaar is om te testen.",
  },
  {
    merk: "iPhone en iPad",
    uitleg: "Safari ondersteunt geen Web Bluetooth. Mogelijke uitweg: de gratis browser 'Bluefy' (App Store) ondersteunt Web Bluetooth; niet getest. Een eigen iOS-app (fase 6) lost dit volledig op.",
  },
];
