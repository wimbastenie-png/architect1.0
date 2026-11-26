import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  bestelbaar, bestellijst, bestellijstCSV, controleerUBL, factuurNaarUBL, factuurTotalen, klantenCSV, nieuweVordering, ondernemingsnummer, splitsAdres, stelFactuurOp,
  verkoopCSV, type Project,
} from "../src/index.ts";

const prijzen = { "01": 50 };
const firma = { naam: "Bouwbedrijf Voorbeeld & Zonen bv", adres: "Werfstraat 1, 9000 Gent", btw: "BE0123.456.789", iban: "BE68 5390 0754 7034", email: "info@voorbeeld.be" };
const klant = { naam: "Immo Peeters nv", adres: "Kerkstraat 5, 2000 Antwerpen", btw: "BE 0999.888.777" };

/** Waarde(n) van een element (eenvoudig, zonder namespaces). */
const alle = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?: [^>]*)?>([^<]*)</${tag}>`, "g"))].map((m) => m[1]!);
const een = (xml: string, tag: string) => alle(xml, tag)[0];

function welgevormd(xml: string) {
  const d = mkdtempSync(join(tmpdir(), "ubl-")); const f = join(d, "f.xml"); writeFileSync(f, xml);
  try { execFileSync("xmllint", ["--noout", f]); } // gooit een fout als de XML niet klopt
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    // geen xmllint: eenvoudige controle dat elke tag gesloten wordt
    const stapel: string[] = [];
    for (const m of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
      if (m[3]) continue;
      if (m[1]) expect(stapel.pop()).toBe(m[2]); else stapel.push(m[2]!);
    }
    expect(stapel).toEqual([]);
  }
}

describe("boekhouding: adres en ondernemingsnummer", () => {
  it("adres splitsen", () => {
    expect(splitsAdres("Werfstraat 1, 9000 Gent")).toEqual({ straat: "Werfstraat 1", postcode: "9000", gemeente: "Gent" });
    expect(splitsAdres("Kerkstraat 5 bus 2 B-2000 Antwerpen")).toEqual({ straat: "Kerkstraat 5 bus 2", postcode: "2000", gemeente: "Antwerpen" });
    expect(splitsAdres("ergens").postcode).toBe("");
  });
  it("btw-nummer → KBO", () => {
    expect(ondernemingsnummer("BE0123.456.789")).toEqual({ kbo: "0123456789", btw: "BE0123456789" });
    expect(ondernemingsnummer("123456789")!.kbo).toBe("0123456789");
    expect(ondernemingsnummer("")).toBeNull();
  });
});

describe("e-factuur UBL (Peppol BIS 3.0)", () => {
  it("vorderingsfactuur met verrekening voorschot: welgevormd, totalen sluiten (BR-CO-10/13/15), prijzen niet negatief (BR-27)", () => {
    let p: Project = appartement;
    const v = stelFactuurOp(p, prijzen, { soort: "voorschot", nummer: "2026-001", datum: "2026-12-01", btw: "21", klant, voorschotPct: 30 });
    p = nieuweVordering({ ...p, facturen: [v] }, "2026-12-15");
    p = { ...p, vorderingen: p.vorderingen.map((x) => ({ ...x, procent: { "01": 50 } })) };
    const f = stelFactuurOp(p, prijzen, { soort: "vordering", nummer: "2026-002", datum: "2026-12-20", btw: "21", klant, vorderingNr: 1 });
    expect(controleerUBL(f, firma)).toEqual([]);
    const xml = factuurNaarUBL(p, firma, f);
    welgevormd(xml);
    expect(xml).toContain("<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"");
    expect(een(xml, "cbc:CustomizationID")).toBe("urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0");
    expect(een(xml, "cbc:InvoiceTypeCode")).toBe("380");
    expect(alle(xml, "cbc:EndpointID")).toEqual(["0123456789", "0999888777"]);
    expect(xml).toContain("Bouwbedrijf Voorbeeld &amp; Zonen bv");
    const t = factuurTotalen(f);
    const totaalLijnen = [...xml.matchAll(/<cac:InvoiceLine>.*?<cbc:LineExtensionAmount currencyID="EUR">([^<]*)</gs)].map((m) => +m[1]!);
    expect(totaalLijnen.reduce((s, x) => s + x, 0)).toBeCloseTo(t.excl, 2); // BR-CO-10
    expect(+xml.match(/<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">([^<]*)/)![1]!).toBeCloseTo(t.excl, 2);
    expect(+een(xml, "cbc:TaxInclusiveAmount")!).toBeCloseTo(t.incl, 2); // BR-CO-15
    expect(+een(xml, "cbc:TaxAmount")!).toBeCloseTo(t.btw, 2);
    expect(alle(xml, "cbc:PriceAmount").every((x) => +x >= 0)).toBe(true); // BR-27
    expect(alle(xml, "cbc:InvoicedQuantity")).toEqual(["1", "-1"]); // verrekening als -1 × positieve prijs
    expect(een(xml, "cbc:PaymentID")).toBe(f.mededeling);
    expect(een(xml, "cbc:Percent")).toBe("21");
  });

  it("btw verlegd: categorie AE, 0 %, met reden; voorschot = type 386", () => {
    const f = stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-003", datum: "2026-12-01", btw: "verlegd", klant });
    const xml = factuurNaarUBL(appartement, firma, f);
    welgevormd(xml);
    expect(een(xml, "cbc:InvoiceTypeCode")).toBe("386");
    expect(alle(xml, "cbc:ID")).toContain("AE");
    expect(een(xml, "cbc:TaxExemptionReasonCode")).toBe("VATEX-EU-AE");
    expect(+een(xml, "cbc:TaxAmount")!).toBe(0);
  });

  it("creditnota: CreditNote 381 met positieve bedragen", () => {
    const f = stelFactuurOp(appartement, prijzen, { soort: "credit", nummer: "2026-004", datum: "2026-12-01", btw: "21", klant, bedrag: 100, omschrijving: "Korting" });
    const xml = factuurNaarUBL(appartement, firma, f);
    welgevormd(xml);
    expect(xml).toContain("<CreditNote xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2\"");
    expect(een(xml, "cbc:CreditNoteTypeCode")).toBe("381");
    expect(+een(xml, "cbc:PayableAmount")!).toBe(121);
    expect(xml).not.toContain("<cbc:DueDate>");
  });

  it("particulier: geen Peppol, duidelijke uitleg", () => {
    const f = stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-005", datum: "2026-12-01", btw: "6", klant: { naam: "Familie Peeters", adres: "Kerkstraat 5, 9000 Gent" } });
    expect(controleerUBL(f, firma).join(" ")).toMatch(/particulier/);
  });
});

describe("boekhouding: CSV", () => {
  it("klanten en verkoopdagboek met puntkomma en komma", () => {
    const f = stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-001", datum: "2026-12-01", btw: "21", klant, voorschotPct: 30 });
    const p = { ...appartement, facturen: [f, { ...f, id: "x", nummer: "2026-002" }] };
    const k = klantenCSV([p]).replace("﻿", "").trim().split("\r\n");
    expect(k).toHaveLength(2); // kop + één klant (dubbel weggelaten)
    expect(k[1]).toBe("Immo Peeters nv;Kerkstraat 5;2000;Antwerpen;BE;BE0999888777;");
    const v = verkoopCSV([p]).replace("﻿", "").trim().split("\r\n");
    expect(v).toHaveLength(3);
    expect(v[1]).toContain(";621,00;130,41;751,41;21 %;");
  });
});

describe("groothandel: bestellijst", () => {
  it("alleen posten met artikelnummer; snijverlies en verpakking naar boven afgerond", () => {
    const b = bestelbaar(appartement);
    const vloer = b.find((x) => x.sleutel === "lb:01")!;
    expect(vloer.hoeveelheid).toBeCloseTo(41.4, 1);
    const r = bestellijst(appartement, { "lb:01": { nummer: "TEG-6060", omschrijving: "Tegel 60×60 (1,44 m²/doos)", perVerpakking: 1.44 } }, 10);
    expect(r).toHaveLength(1);
    expect(r[0]!.aantal).toBe(Math.ceil((41.4 * 1.1) / 1.44)); // 32 dozen
    const csv = bestellijstCSV(r, "Werf X").replace("﻿", "").split("\r\n");
    expect(csv[0]!.startsWith("Artikelnummer;Aantal;")).toBe(true);
    expect(csv[1]!.startsWith("TEG-6060;32;")).toBe(true);
  });
});
