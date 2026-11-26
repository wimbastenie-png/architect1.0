/**
 * Facturen (België): voorschot-, vorderings-, eind- en creditnota's, doorlopende
 * nummering, gestructureerde mededeling (OGM), betaal-QR (EPC/SEPA) en de
 * btw-regimes 21 %, 6 % (renovatie) en verlegd (medecontractant).
 *
 * De app bereidt de factuur voor; de aannemer en zijn boekhouder controleren
 * bedragen, btw-regime en vermeldingen. Geen fiscaal advies.
 */
import type { Project } from "./schema.ts";
import { meerwerkTotalen, offerteRegels, vorderingsstaat } from "./werf.ts";
import type { Prijzen } from "./prijzen.ts";

export type Factuur = Project["facturen"][number];
export type BtwRegime = Factuur["btw"];
const c2 = (x: number) => Math.round(x * 100) / 100;

export const BTW_PCT: Record<BtwRegime, number> = { "21": 21, "6": 6, verlegd: 0 };
export const BTW_NAAM: Record<BtwRegime, string> = { "21": "21 %", "6": "6 % (renovatie woning ouder dan 10 jaar)", verlegd: "verlegd (medecontractant)" };

/** Verplichte vermelding bij 6 % (sinds 2016 op de factuur i.p.v. een attest). Na te kijken door de boekhouder. */
export const TEKST_6 =
  "Btw-tarief: Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming heeft plaatsgevonden in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur met betrekking tot die werken, (2) de woning, na uitvoering van die werken, uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt en (3) de werken worden verstrekt en gefactureerd aan een eindverbruiker. Wanneer minstens één van die voorwaarden niet is voldaan, zal het normale btw-tarief van 21 pct. van toepassing zijn en is de afnemer ten aanzien van die voorwaarden aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten.";
/** Vermelding bij verlegging van heffing (werk in onroerende staat voor een btw-plichtige medecontractant). */
export const TEKST_VERLEGD = "Verlegging van heffing. Btw te voldoen door de medecontractant, artikel 20 van het KB nr. 1.";

export const FACTUUR_SOORT: Record<Factuur["soort"], string> = { voorschot: "Voorschotfactuur", vordering: "Factuur", eind: "Eindfactuur", credit: "Creditnota" };

// ---------------------------------------------------------------------------
// gestructureerde mededeling en IBAN

/** Gestructureerde mededeling +++123/4567/89012+++ uit 10 cijfers (controle = rest bij deling door 97, 0 → 97). */
export function ogm(basis: number | string): string {
  const b = String(basis).replace(/\D/g, "").slice(-10).padStart(10, "0");
  const r = Number(BigInt(b) % 97n) || 97;
  const c = b + String(r).padStart(2, "0");
  return `+++${c.slice(0, 3)}/${c.slice(3, 7)}/${c.slice(7)}+++`;
}
export function ogmGeldig(s: string): boolean {
  const c = s.replace(/\D/g, "");
  if (c.length !== 12) return false;
  return (Number(BigInt(c.slice(0, 10)) % 97n) || 97) === +c.slice(10);
}
/** OGM voor een factuurnummer "2026-007": jaar + nummer, aangevuld tot 10 cijfers. */
export const ogmVoor = (nummer: string) => ogm(nummer.replace(/\D/g, "").padEnd(10, "0").slice(0, 10));

export function ibanGeldig(iban: string): boolean {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const omgezet = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (l) => String(l.charCodeAt(0) - 55));
  return BigInt(omgezet) % 97n === 1n;
}

/** Inhoud van de betaal-QR (EPC069-12, versie 002, SEPA-overschrijving). */
export function epcQr(o: { naam: string; iban: string; bic?: string; bedrag: number; mededeling: string }): string {
  if (!ibanGeldig(o.iban)) throw new Error("IBAN ongeldig: controleer het rekeningnummer in de firmagegevens.");
  if (!(o.bedrag > 0) || o.bedrag > 999999999.99) throw new Error("Geen te betalen bedrag voor de betaal-QR.");
  return ["BCD", "002", "1", "SCT", (o.bic ?? "").trim(), o.naam.trim().slice(0, 70), o.iban.replace(/\s/g, "").toUpperCase(), `EUR${o.bedrag.toFixed(2)}`, "", "", o.mededeling.slice(0, 140)].join("\n");
}

// ---------------------------------------------------------------------------
// nummering en bedragen

/** Volgend factuurnummer "JJJJ-NNN": doorlopend per jaar, na het hoogste nummer in dit project én op dit toestel. */
export function volgendNummer(p: Project, jaar: number, laatsteOpToestel = 0): string {
  const inProject = p.facturen.map((f) => f.nummer.match(/^(\d{4})-(\d+)$/)).filter((m): m is RegExpMatchArray => !!m && +m[1]! === jaar).map((m) => +m[2]!);
  const n = Math.max(laatsteOpToestel, 0, ...inProject) + 1;
  return `${jaar}-${String(n).padStart(3, "0")}`;
}

export function factuurTotalen(f: Pick<Factuur, "regels" | "btw">) {
  const excl = c2(f.regels.reduce((s, r) => s + r.bedrag, 0));
  const btw = c2((excl * BTW_PCT[f.btw]) / 100);
  return { excl, btw, incl: c2(excl + btw) };
}

/** Totaal van de aanneming: offerte (posten met prijs) + saldo meer- en minwerken met akkoord. */
export function aanneming(p: Project, prijzen: Prijzen) {
  return c2(offerteRegels(p, prijzen).excl + meerwerkTotalen(p).saldo);
}

/** Wat er al gefactureerd is (excl. btw), per soort; creditnota's tellen negatief. */
export function gefactureerd(p: Project, behalve?: string) {
  const fs = p.facturen.filter((f) => f.id !== behalve);
  const som = (s: Factuur["soort"]) => c2(fs.filter((f) => f.soort === s).reduce((t, f) => t + factuurTotalen(f).excl, 0));
  return { voorschot: som("voorschot"), vordering: som("vordering"), eind: som("eind"), credit: som("credit"), totaal: c2(fs.reduce((t, f) => t + factuurTotalen(f).excl, 0)) };
}

export interface NieuweFactuur { soort: Factuur["soort"]; nummer: string; datum: string; btw: BtwRegime; klant: Factuur["klant"]; betaaltermijn?: number; voorschotPct?: number; vorderingNr?: number; omschrijving?: string; bedrag?: number }

/** Regels voorstellen volgens de soort. Het voorschot wordt pro rata verrekend in de vorderingsfacturen en volledig in de eindfactuur. */
export function stelFactuurOp(p: Project, prijzen: Prijzen, n: NieuweFactuur): Factuur {
  const totaal = aanneming(p, prijzen);
  const al = gefactureerd(p);
  const regels: Factuur["regels"] = [];
  const voorschotOpen = c2(al.voorschot - verrekendVoorschot(p));
  if (n.soort === "voorschot") {
    const pct = Math.max(0, Math.min(100, n.voorschotPct ?? 30));
    if (!(totaal > 0)) throw new Error("Geen offertebedrag: geef eerst prijzen in het lastenboek.");
    regels.push({ omschrijving: `Voorschot ${pct} % op de aanneming van ${totaal.toFixed(2).replace(".", ",")} EUR excl. btw`, bedrag: c2((totaal * pct) / 100) });
  } else if (n.soort === "vordering") {
    const v = p.vorderingen.find((x) => x.nr === n.vorderingNr);
    if (!v) throw new Error("Kies een vorderingsstaat.");
    if (p.facturen.some((f) => f.soort === "vordering" && f.vorderingNr === v.nr)) throw new Error(`Vorderingsstaat ${v.nr} is al gefactureerd.`);
    const s = vorderingsstaat(p, prijzen, v.nr);
    regels.push({ omschrijving: `Vorderingsstaat ${v.nr} van ${v.datum.split("-").reverse().join("/")}: uitgevoerde werken`, bedrag: s.dezeStaat });
    if (voorschotOpen > 0 && totaal > 0) {
      const verr = c2(Math.min(voorschotOpen, (al.voorschot * s.dezeStaat) / totaal));
      if (verr > 0) regels.push({ omschrijving: "Verrekening voorschot (pro rata)", bedrag: -verr, verrekening: true });
    }
  } else if (n.soort === "eind") {
    // nog niet gefactureerde werken = aanneming − (al gefactureerd netto − nog open voorschot)
    const rest = c2(totaal - al.totaal + voorschotOpen);
    regels.push({ omschrijving: "Saldo van de aanneming (offerte en meer- en minwerken met akkoord), na de vorige facturen", bedrag: rest });
    if (voorschotOpen > 0) regels.push({ omschrijving: "Verrekening resterend voorschot", bedrag: -voorschotOpen, verrekening: true });
  } else {
    if (!(n.bedrag && n.bedrag > 0)) throw new Error("Geef het bedrag van de creditnota (excl. btw).");
    regels.push({ omschrijving: n.omschrijving?.trim() || "Creditnota", bedrag: -c2(n.bedrag) });
  }
  const datum = n.datum;
  const verval = new Date(`${datum}T12:00:00Z`); verval.setUTCDate(verval.getUTCDate() + (n.betaaltermijn ?? 15));
  return {
    id: `fa-${n.nummer}-${Math.random().toString(36).slice(2, 6)}`, nummer: n.nummer, soort: n.soort, datum, vervaldatum: verval.toISOString().slice(0, 10),
    btw: n.btw, klant: n.klant, regels, mededeling: ogmVoor(n.nummer), vorderingNr: n.soort === "vordering" ? n.vorderingNr : undefined, betaald: false,
  };
}

/** Voorschot dat al verrekend werd in vorderings- of eindfacturen (positief getal). */
export function verrekendVoorschot(p: Project) {
  return c2(-p.facturen.flatMap((f) => f.regels.filter((r) => r.verrekening)).reduce((s, r) => s + r.bedrag, 0));
}

/** Controle vóór het opmaken: geeft de problemen (lege lijst = klaar om te versturen). */
export function controleerFactuur(f: Factuur, firma: { naam: string; adres?: string; btw?: string; iban?: string }): string[] {
  const uit: string[] = [];
  if (!firma.naam.trim()) uit.push("Firmanaam ontbreekt.");
  if (!firma.adres?.trim()) uit.push("Adres van de firma ontbreekt.");
  if (!firma.btw?.trim()) uit.push("Btw-nummer van de firma ontbreekt.");
  if (!firma.iban || !ibanGeldig(firma.iban)) uit.push("IBAN ontbreekt of is ongeldig.");
  if (!f.klant.naam.trim()) uit.push("Naam van de klant ontbreekt.");
  if (!f.klant.adres?.trim()) uit.push("Adres van de klant ontbreekt.");
  if (f.btw === "verlegd" && !f.klant.btw?.trim()) uit.push("Btw verlegd: het btw-nummer van de klant is verplicht.");
  if (f.btw === "6" && f.klant.btw?.trim()) uit.push("6 % geldt alleen voor een eindverbruiker (particulier); de klant heeft een btw-nummer. Laat dit nakijken.");
  if (!f.regels.length) uit.push("Geen regels.");
  if (f.soort !== "credit" && factuurTotalen(f).excl <= 0) uit.push("Het bedrag is nul of negatief.");
  return uit;
}
