/**
 * Koppeling met boekhouding en groothandel, eerst via bestanden (geen API):
 * - e-factuur UBL 2.1 volgens Peppol BIS Billing 3.0 (te versturen via een Peppol-toegangspunt
 *   of in te lezen in het boekhoudpakket);
 * - klantenlijst en verkoopdagboek (CSV, puntkomma, voor Excel en boekhoudpakketten);
 * - bestellijst voor de groothandel (CSV) met je eigen artikelnummers per post.
 *
 * Niet gevalideerd door een officiële Peppol-validator in de app: laat de eerste
 * e-facturen nakijken (bv. door je toegangspunt of boekhouder).
 */
import { BTW_PCT, factuurTotalen, TEKST_6, TEKST_VERLEGD, type Factuur } from "./factuur.ts";
import { materiaallijst } from "./installaties.ts";
import { lastenboek } from "./lastenboek.ts";
import type { Project } from "./schema.ts";
import type { Firma } from "./werf.ts";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bedrag = (n: number) => n.toFixed(2);
const EUR = 'currencyID="EUR"';

/** "Werfstraat 1, 9000 Gent" → straat, postcode, gemeente (België). */
export function splitsAdres(adres = ""): { straat: string; postcode: string; gemeente: string } {
  const m = adres.match(/^(.*?)[,\s]+(?:B-)?(\d{4})\s+(.+)$/i);
  if (m) return { straat: m[1]!.replace(/,\s*$/, "").trim(), postcode: m[2]!, gemeente: m[3]!.trim() };
  return { straat: adres.trim(), postcode: "", gemeente: "" };
}

/** Btw-nummer → ondernemingsnummer (10 cijfers) en "BE0123456789". */
export function ondernemingsnummer(btw = ""): { kbo: string; btw: string } | null {
  const c = btw.replace(/[^0-9]/g, "");
  if (c.length < 9 || c.length > 10) return null;
  const kbo = c.padStart(10, "0");
  return { kbo, btw: `BE${kbo}` };
}

function partij(rol: "AccountingSupplierParty" | "AccountingCustomerParty", naam: string, adres: string | undefined, btw: string | undefined, email?: string) {
  const a = splitsAdres(adres);
  const o = ondernemingsnummer(btw);
  return `<cac:${rol}><cac:Party>${o ? `<cbc:EndpointID schemeID="0208">${o.kbo}</cbc:EndpointID>` : ""}`
    + `<cac:PartyName><cbc:Name>${x(naam)}</cbc:Name></cac:PartyName>`
    + `<cac:PostalAddress>${a.straat ? `<cbc:StreetName>${x(a.straat)}</cbc:StreetName>` : ""}${a.gemeente ? `<cbc:CityName>${x(a.gemeente)}</cbc:CityName>` : ""}${a.postcode ? `<cbc:PostalZone>${a.postcode}</cbc:PostalZone>` : ""}<cac:Country><cbc:IdentificationCode>BE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`
    + (o ? `<cac:PartyTaxScheme><cbc:CompanyID>${o.btw}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : "")
    + `<cac:PartyLegalEntity><cbc:RegistrationName>${x(naam)}</cbc:RegistrationName>${o ? `<cbc:CompanyID schemeID="0208">${o.kbo}</cbc:CompanyID>` : ""}</cac:PartyLegalEntity>`
    + (email ? `<cac:Contact><cbc:ElectronicMail>${x(email)}</cbc:ElectronicMail></cac:Contact>` : "")
    + `</cac:Party></cac:${rol}>`;
}

function categorie(f: Factuur, tag: "TaxCategory" | "ClassifiedTaxCategory") {
  const verlegd = f.btw === "verlegd";
  return `<cac:${tag}><cbc:ID>${verlegd ? "AE" : "S"}</cbc:ID><cbc:Percent>${BTW_PCT[f.btw]}</cbc:Percent>`
    + (verlegd && tag === "TaxCategory" ? `<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>${x(TEKST_VERLEGD)}</cbc:TaxExemptionReason>` : "")
    + `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:${tag}>`;
}

/** Problemen die een e-factuur via Peppol tegenhouden (lege lijst = klaar). */
export function controleerUBL(f: Factuur, firma: Firma): string[] {
  const uit: string[] = [];
  if (!ondernemingsnummer(firma.btw)) uit.push("Btw-nummer van je firma ontbreekt of is ongeldig.");
  if (!ondernemingsnummer(f.klant.btw)) uit.push("De klant heeft geen btw-nummer: een e-factuur via Peppol is voor bedrijven. Voor een particulier volstaat de PDF.");
  if (!splitsAdres(firma.adres).postcode) uit.push("Adres van je firma: schrijf het als 'Straat 1, 9000 Gemeente'.");
  if (!splitsAdres(f.klant.adres).postcode) uit.push("Adres van de klant: schrijf het als 'Straat 1, 9000 Gemeente'.");
  return uit;
}

/** E-factuur (of creditnota) als UBL 2.1, Peppol BIS Billing 3.0. */
export function factuurNaarUBL(p: Project, firma: Firma, f: Factuur): string {
  const credit = f.soort === "credit";
  const doc = credit ? "CreditNote" : "Invoice";
  const t = factuurTotalen(f);
  const teken = credit ? -1 : 1; // een creditnota heeft positieve bedragen
  const notas = [f.btw === "6" ? TEKST_6 : "", f.btw === "verlegd" ? TEKST_VERLEGD : "", `Werf: ${p.naam}`].filter(Boolean);
  const lijnen = f.regels.map((r, i) => {
    const b = r.bedrag * teken;
    return `<cac:${doc}Line><cbc:ID>${i + 1}</cbc:ID><cbc:${credit ? "CreditedQuantity" : "InvoicedQuantity"} unitCode="C62">${b < 0 ? "-1" : "1"}</cbc:${credit ? "CreditedQuantity" : "InvoicedQuantity"}>`
      + `<cbc:LineExtensionAmount ${EUR}>${bedrag(b)}</cbc:LineExtensionAmount>`
      + `<cac:Item><cbc:Name>${x(r.omschrijving.slice(0, 200))}</cbc:Name>${categorie(f, "ClassifiedTaxCategory")}</cac:Item>`
      + `<cac:Price><cbc:PriceAmount ${EUR}>${bedrag(Math.abs(b))}</cbc:PriceAmount></cac:Price></cac:${doc}Line>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${doc} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${doc}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`
    + `<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>`
    + `<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>`
    + `<cbc:ID>${x(f.nummer)}</cbc:ID><cbc:IssueDate>${f.datum}</cbc:IssueDate>`
    + (credit ? "" : `<cbc:DueDate>${f.vervaldatum}</cbc:DueDate>`)
    + `<cbc:${doc}TypeCode>${credit ? 381 : f.soort === "voorschot" ? 386 : 380}</cbc:${doc}TypeCode>`
    + notas.map((n) => `<cbc:Note>${x(n)}</cbc:Note>`).join("")
    + `<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cbc:BuyerReference>${x(p.naam.slice(0, 50))}</cbc:BuyerReference>`
    + partij("AccountingSupplierParty", firma.naam, firma.adres, firma.btw, firma.email)
    + partij("AccountingCustomerParty", f.klant.naam, f.klant.adres, f.klant.btw, f.klant.email)
    + (credit ? "" : `<cac:PaymentMeans><cbc:PaymentMeansCode name="Credit transfer">30</cbc:PaymentMeansCode><cbc:PaymentID>${x(f.mededeling)}</cbc:PaymentID>`
      + (firma.iban ? `<cac:PayeeFinancialAccount><cbc:ID>${firma.iban.replace(/\s/g, "")}</cbc:ID><cbc:Name>${x(firma.naam)}</cbc:Name>${firma.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${x(firma.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount>` : "")
      + `</cac:PaymentMeans>`)
    + `<cac:TaxTotal><cbc:TaxAmount ${EUR}>${bedrag(t.btw * teken)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount ${EUR}>${bedrag(t.excl * teken)}</cbc:TaxableAmount><cbc:TaxAmount ${EUR}>${bedrag(t.btw * teken)}</cbc:TaxAmount>${categorie(f, "TaxCategory")}</cac:TaxSubtotal></cac:TaxTotal>`
    + `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount ${EUR}>${bedrag(t.excl * teken)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount ${EUR}>${bedrag(t.excl * teken)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount ${EUR}>${bedrag(t.incl * teken)}</cbc:TaxInclusiveAmount><cbc:PayableAmount ${EUR}>${bedrag(t.incl * teken)}</cbc:PayableAmount></cac:LegalMonetaryTotal>`
    + lijnen.join("")
    + `</${doc}>`;
  return xml;
}

// ---------------------------------------------------------------------------
// CSV voor boekhouding

const csv = (s: string | number | undefined) => { const t = s === undefined ? "" : String(s); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const komma = (n: number) => n.toFixed(2).replace(".", ",");
const BOM = "﻿";

/** Klantenlijst (uniek per naam + btw-nummer) uit de facturen van een of meer projecten. */
export function klantenCSV(projecten: Project[]): string {
  const gezien = new Map<string, Factuur["klant"]>();
  for (const p of projecten) for (const f of p.facturen) gezien.set(`${f.klant.naam.toLowerCase()}|${f.klant.btw ?? ""}`, f.klant);
  const r = [["Naam", "Straat", "Postcode", "Gemeente", "Land", "Btw-nummer", "E-mail"].join(";")];
  for (const k of gezien.values()) { const a = splitsAdres(k.adres); r.push([csv(k.naam), csv(a.straat), a.postcode, csv(a.gemeente), "BE", ondernemingsnummer(k.btw)?.btw ?? "", csv(k.email)].join(";")); }
  return BOM + r.join("\r\n") + "\r\n";
}

/** Verkoopdagboek: één regel per factuur (bedragen met komma, creditnota's negatief). */
export function verkoopCSV(projecten: Project[]): string {
  const r = [["Nummer", "Soort", "Datum", "Vervaldatum", "Klant", "Btw-nummer klant", "Excl. btw", "Btw", "Incl. btw", "Btw-regime", "Mededeling", "Betaald", "Werf"].join(";")];
  const alle = projecten.flatMap((p) => p.facturen.map((f) => ({ p, f }))).sort((a, b) => a.f.nummer.localeCompare(b.f.nummer));
  for (const { p, f } of alle) {
    const t = factuurTotalen(f);
    r.push([csv(f.nummer), f.soort, f.datum, f.vervaldatum, csv(f.klant.naam), ondernemingsnummer(f.klant.btw)?.btw ?? "", komma(t.excl), komma(t.btw), komma(t.incl), f.btw === "verlegd" ? "verlegd" : `${f.btw} %`, f.mededeling, f.betaald ? "ja" : "nee", csv(p.naam)].join(";"));
  }
  return BOM + r.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// groothandel

/** Eigen artikel per post: artikelnummer bij je groothandel en hoeveel er in één verpakking zit. */
export interface Artikel { nummer: string; omschrijving?: string; perVerpakking?: number }
export type Artikels = Record<string, Artikel>;

export interface BestelRegel { sleutel: string; post: string; omschrijving: string; eenheid: string; hoeveelheid: number; artikel?: Artikel; aantal: number }

/** Alles wat besteld kan worden: lastenboekposten en de materiaallijst van de installaties. */
export function bestelbaar(p: Project): Array<{ sleutel: string; post: string; omschrijving: string; eenheid: string; hoeveelheid: number }> {
  const lb = lastenboek(p).totalen.filter((t) => t.hoeveelheid > 0).map((t) => ({ sleutel: `lb:${t.code}`, post: t.code, omschrijving: t.omschrijving, eenheid: t.eenheid, hoeveelheid: t.hoeveelheid }));
  const inst = materiaallijst(p).map((m) => ({ sleutel: `${m.net}:${m.omschrijving}`, post: m.net, omschrijving: m.omschrijving, eenheid: m.eenheid, hoeveelheid: m.hoeveelheid }));
  return [...lb, ...inst];
}

/** Bestellijst: hoeveelheid × (1 + snijverlies %), afgerond naar boven op hele verpakkingen. Alleen posten met een artikelnummer. */
export function bestellijst(p: Project, artikels: Artikels, verliesPct = 0): BestelRegel[] {
  return bestelbaar(p).map((b) => {
    const a = artikels[b.sleutel];
    const nodig = b.hoeveelheid * (1 + Math.max(0, verliesPct) / 100);
    const per = a?.perVerpakking && a.perVerpakking > 0 ? a.perVerpakking : 1;
    return { ...b, artikel: a, aantal: Math.ceil(nodig / per - 1e-9) };
  }).filter((r) => r.artikel?.nummer);
}

/** CSV voor de webshop van de groothandel: eerst artikelnummer en aantal (zo lezen de meeste webshops een bestelling in). */
export function bestellijstCSV(regels: BestelRegel[], projectnaam: string): string {
  const r = [["Artikelnummer", "Aantal", "Omschrijving", "Nodig", "Eenheid", "Per verpakking", "Post", "Werf"].join(";")];
  for (const x of regels) r.push([csv(x.artikel!.nummer), x.aantal, csv(x.artikel!.omschrijving || x.omschrijving), komma(x.hoeveelheid), x.eenheid, x.artikel!.perVerpakking ?? 1, csv(x.post), csv(projectnaam)].join(";"));
  return BOM + r.join("\r\n") + "\r\n";
}
