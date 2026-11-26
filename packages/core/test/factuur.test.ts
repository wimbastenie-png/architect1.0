import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  aanneming, controleerFactuur, epcQr, factuurNaarPDF, factuurTotalen, gefactureerd, ibanGeldig, leesProject, nieuweVordering, nieuwMeerwerk,
  ogm, ogmGeldig, ogmVoor, stelFactuurOp, volgendNummer, zetMeerwerkStatus, type Project,
} from "../src/index.ts";

const prijzen = { "01": 50 }; // 41,40 m² × 50 = 2070
const firma = { naam: "Bouwbedrijf Voorbeeld bv", adres: "Werfstraat 1, 9000 Gent", btw: "BE0123.456.789", iban: "BE68 5390 0754 7034" };
const klant = { naam: "Familie Peeters", adres: "Kerkstraat 5, 9000 Gent" };

describe("factuur: OGM, IBAN, QR, nummering", () => {
  it("gestructureerde mededeling met controlegetal", () => {
    expect(ogm(1)).toBe("+++000/0000/00101+++");
    expect(ogm("0000000097")).toBe("+++000/0000/09797+++"); // rest 0 → 97
    expect(ogmGeldig(ogm(2026007))).toBe(true);
    expect(ogmGeldig("+++000/0000/00102+++")).toBe(false);
    expect(ogmGeldig(ogmVoor("2026-007"))).toBe(true);
  });
  it("IBAN-controle", () => {
    expect(ibanGeldig("BE68 5390 0754 7034")).toBe(true);
    expect(ibanGeldig("BE68 5390 0754 7035")).toBe(false);
    expect(ibanGeldig("geen")).toBe(false);
  });
  it("betaal-QR volgens EPC (versie 002)", () => {
    const q = epcQr({ naam: firma.naam, iban: firma.iban, bedrag: 1234.5, mededeling: "+++000/0000/00101+++" }).split("\n");
    expect(q.slice(0, 4)).toEqual(["BCD", "002", "1", "SCT"]);
    expect(q[6]).toBe("BE68539007547034");
    expect(q[7]).toBe("EUR1234.50");
    expect(q[10]).toBe("+++000/0000/00101+++");
    expect(() => epcQr({ naam: "x", iban: "BE00", bedrag: 1, mededeling: "" })).toThrow(/IBAN/);
  });
  it("doorlopende nummering per jaar, ook over toestellen heen", () => {
    expect(volgendNummer(appartement, 2026)).toBe("2026-001");
    const p = { ...appartement, facturen: [stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-004", datum: "2026-12-01", btw: "21", klant })] };
    expect(volgendNummer(p, 2026)).toBe("2026-005");
    expect(volgendNummer(p, 2026, 9)).toBe("2026-010");
    expect(volgendNummer(p, 2027)).toBe("2027-001");
  });
});

describe("factuur: voorschot, vordering, eind, credit", () => {
  it("voorschot wordt pro rata verrekend; eindfactuur sluit op de aanneming", () => {
    let p: Project = appartement;
    const r = nieuwMeerwerk(p, { omschrijving: "Extra stopcontact", soort: "meer", eenheid: "st", hoeveelheid: 2, prijs: 85 });
    p = zetMeerwerkStatus(r.project, r.id, "akkoord", { door: "Peeters" });
    const totaal = aanneming(p, prijzen);
    expect(totaal).toBe(2070 + 170);
    const v = stelFactuurOp(p, prijzen, { soort: "voorschot", nummer: "2026-001", datum: "2026-12-01", btw: "6", klant, voorschotPct: 30 });
    expect(factuurTotalen(v)).toEqual({ excl: 672, btw: 40.32, incl: 712.32 });
    expect(v.vervaldatum).toBe("2026-12-16");
    p = { ...p, facturen: [v] };
    // vorderingsstaat 1: 50 % van de vloer en het meerwerk volledig
    p = nieuweVordering(p, "2026-12-15");
    p = { ...p, vorderingen: p.vorderingen.map((x) => ({ ...x, procent: { "01": 50, MW1: 100 } })) };
    const f1 = stelFactuurOp(p, prijzen, { soort: "vordering", nummer: "2026-002", datum: "2026-12-20", btw: "6", klant, vorderingNr: 1 });
    expect(f1.regels[0]!.bedrag).toBe(1035 + 170);
    expect(f1.regels[1]!.bedrag).toBeCloseTo(-672 * 1205 / 2240, 2); // pro rata
    p = { ...p, facturen: [...p.facturen, f1] };
    expect(() => stelFactuurOp(p, prijzen, { soort: "vordering", nummer: "2026-003", datum: "2026-12-21", btw: "6", klant, vorderingNr: 1 })).toThrow(/al gefactureerd/);
    const eind = stelFactuurOp(p, prijzen, { soort: "eind", nummer: "2026-003", datum: "2027-01-10", btw: "6", klant });
    p = { ...p, facturen: [...p.facturen, eind] };
    // samen precies de aanneming, voorschot volledig verrekend
    expect(gefactureerd(p).totaal).toBeCloseTo(totaal, 2);
    expect(eind.regels.some((x) => x.verrekening)).toBe(true);
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });

  it("controle: verlegd vraagt btw-nummer van de klant, 6 % niet voor een firma", () => {
    const f = stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-001", datum: "2026-12-01", btw: "verlegd", klant });
    expect(controleerFactuur(f, firma)).toContain("Btw verlegd: het btw-nummer van de klant is verplicht.");
    expect(factuurTotalen(f).btw).toBe(0);
    const g = stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-001", datum: "2026-12-01", btw: "6", klant: { ...klant, btw: "BE0999.999.999" } });
    expect(controleerFactuur(g, firma).join(" ")).toMatch(/eindverbruiker/);
    expect(controleerFactuur(f, { naam: "" })).toEqual(expect.arrayContaining(["Firmanaam ontbreekt.", "IBAN ontbreekt of is ongeldig."]));
  });

  it("creditnota negatief; PDF met QR", async () => {
    const c = stelFactuurOp(appartement, prijzen, { soort: "credit", nummer: "2026-009", datum: "2026-12-01", btw: "21", klant, bedrag: 100, omschrijving: "Korting" });
    expect(factuurTotalen(c).incl).toBe(-121);
    const f = stelFactuurOp(appartement, prijzen, { soort: "voorschot", nummer: "2026-001", datum: "2026-12-01", btw: "6", klant });
    for (const x of [f, c]) {
      const pdf = await factuurNaarPDF(appartement, firma, x);
      expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    }
  });
});
