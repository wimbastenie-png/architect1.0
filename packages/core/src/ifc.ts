/**
 * IFC-export (IFC4, STEP-formaat) — open BIM, om de opmeting in Revit,
 * ArchiCAD, Vectorworks, BricsCAD … te openen.
 *
 * Inhoud: project → terrein → gebouw → verdiepingen (op peil) met
 * - muren (IfcWall, extrusie van de muurvorm met verstekhoeken),
 * - openingen (IfcOpeningElement) die de muur doorboren, gevuld met IfcDoor / IfcWindow,
 * - ruimtes (IfcSpace) met naam, binnencontour en plafondhoogte,
 * - sparingen (trapgat, vide, schacht) als IfcSpace met objecttype.
 * Eenheden: millimeter. Eigenschappen: dragend, meetmethode (Pset_*Common + eigen pset).
 * GUID's zijn afgeleid van de ids in het project: opnieuw exporteren geeft dezelfde GUID's.
 */
import { muurLengte, muurVorm, richting } from "./geometrie.ts";
import type { Muur, Opening, Project, Punt, Verdieping } from "./schema.ts";

const GUID_TEKENS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

/** 128 bits uit een tekst (vier keer FNV-1a met een ander zaad). */
function hash128(s: string): number[] {
  const uit: number[] = [];
  for (let z = 0; z < 4; z++) {
    let h = (0x811c9dc5 ^ (z * 0x9e3779b9)) >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // naverwerking voor betere spreiding
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
    uit.push(h >>> 0);
  }
  return uit;
}

/** IFC-GUID (22 tekens, eigen base64) uit een vaste tekst. */
export function ifcGuid(sleutel: string): string {
  const w = hash128(sleutel);
  const bytes: number[] = [];
  for (const x of w) bytes.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  // 128 bits → 22 tekens: eerste teken 2 bits, daarna 21 × 6 bits
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let uit = GUID_TEKENS[parseInt(bits.slice(0, 2), 2)]!;
  for (let i = 2; i < 128; i += 6) uit += GUID_TEKENS[parseInt(bits.slice(i, i + 6), 2)]!;
  return uit;
}

/** STEP-tekst: apostrof verdubbelen, niet-ASCII als \X2\hhhh\X0\. */
function tekst(s: string | undefined): string {
  if (s === undefined) return "$";
  let uit = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "'") uit += "''";
    else if (ch === "\\") uit += "\\\\";
    else if (c >= 32 && c < 127) uit += ch;
    else if (c < 0x10000) uit += `\\X2\\${c.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
    else uit += `\\X4\\${c.toString(16).toUpperCase().padStart(8, "0")}\\X0\\`;
  }
  return `'${uit}'`;
}

const getal = (x: number) => {
  const r = Math.round(x * 1000) / 1000;
  const s = String(r);
  return s.includes(".") || s.includes("e") ? s : s + ".";
};

class Schrijver {
  regels: string[] = [];
  n = 0;
  zet(def: string): string {
    this.n++;
    this.regels.push(`#${this.n}=${def};`);
    return `#${this.n}`;
  }
}

export interface IfcOpties {
  /** Tijdstip in de kop (standaard: nu). Vast zetten voor herhaalbare uitvoer. */
  tijdstip?: string;
  /** Naam van de toepassing in de kop. */
  toepassing?: string;
}

export function projectNaarIFC(p: Project, opties: IfcOpties = {}): string {
  const w = new Schrijver();
  const tijd = opties.tijdstip ?? new Date().toISOString().slice(0, 19);
  const app = opties.toepassing ?? "architect1.0";
  const lijst = (xs: string[]) => `(${xs.join(",")})`;
  const pt = (x: number, y: number, z?: number) => w.zet(z === undefined ? `IFCCARTESIANPOINT((${getal(x)},${getal(y)}))` : `IFCCARTESIANPOINT((${getal(x)},${getal(y)},${getal(z)}))`);
  const dir = (x: number, y: number, z: number) => w.zet(`IFCDIRECTION((${getal(x)},${getal(y)},${getal(z)}))`);

  // eigenaar en geschiedenis
  const persoon = w.zet(`IFCPERSON($,$,'',$,$,$,$,$)`);
  const org = w.zet(`IFCORGANIZATION($,${tekst(app)},$,$,$)`);
  const po = w.zet(`IFCPERSONANDORGANIZATION(${persoon},${org},$)`);
  const toep = w.zet(`IFCAPPLICATION(${org},'0.1',${tekst(app)},${tekst(app)})`);
  const sec = Math.floor(new Date(tijd + "Z").getTime() / 1000) || 0;
  const eigen = w.zet(`IFCOWNERHISTORY(${po},${toep},$,.NOCHANGE.,$,$,$,${sec})`);

  // eenheden en context
  const lengte = w.zet(`IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)`);
  const opp = w.zet(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const vol = w.zet(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const hoek = w.zet(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const eenheden = w.zet(`IFCUNITASSIGNMENT(${lijst([lengte, opp, vol, hoek])})`);
  const oorsprong = pt(0, 0, 0);
  const zAs = dir(0, 0, 1), xAs = dir(1, 0, 0);
  const wereld = w.zet(`IFCAXIS2PLACEMENT3D(${oorsprong},${zAs},${xAs})`);
  const noord = w.zet(`IFCDIRECTION((0.,1.))`);
  const ctx = w.zet(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wereld},${noord})`);
  const body = w.zet(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);

  const plaats = (relatief: string | null, x = 0, y = 0, z = 0) => {
    const a = w.zet(`IFCAXIS2PLACEMENT3D(${pt(x, y, z)},$,$)`);
    return w.zet(`IFCLOCALPLACEMENT(${relatief ?? "$"},${a})`);
  };
  /** Extrusie van een gesloten veelhoek (plan, mm) vanaf hoogte z0 over dz. */
  const extrusie = (contour: Punt[], z0: number, dz: number) => {
    const punten = contour.map((q) => pt(q.x, q.y));
    const lijn = w.zet(`IFCPOLYLINE(${lijst([...punten, punten[0]!])})`);
    const profiel = w.zet(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${lijn})`);
    const pos = w.zet(`IFCAXIS2PLACEMENT3D(${pt(0, 0, z0)},$,$)`);
    const solid = w.zet(`IFCEXTRUDEDAREASOLID(${profiel},${pos},${zAs},${getal(dz)})`);
    const rep = w.zet(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${solid}))`);
    return w.zet(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
  };
  const enkel = (naam: string, waarde: string) => w.zet(`IFCPROPERTYSINGLEVALUE(${tekst(naam)},$,${waarde},$)`);
  const pset = (sleutel: string, naam: string, props: string[], objecten: string[]) => {
    if (!props.length || !objecten.length) return;
    const ps = w.zet(`IFCPROPERTYSET('${ifcGuid(sleutel)}',${eigen},${tekst(naam)},$,${lijst(props)})`);
    w.zet(`IFCRELDEFINESBYPROPERTIES('${ifcGuid(sleutel + "/rel")}',${eigen},$,$,${lijst(objecten)},${ps})`);
  };
  const lbl = (s: string) => `IFCLABEL(${tekst(s)})`;
  const bool = (b: boolean) => `IFCBOOLEAN(${b ? ".T." : ".F."})`;
  const len = (x: number) => `IFCLENGTHMEASURE(${getal(x)})`;

  const project = w.zet(`IFCPROJECT('${ifcGuid(p.id)}',${eigen},${tekst(p.naam)},${tekst(p.notities)},$,$,$,(${ctx}),${eenheden})`);
  const sitePl = plaats(null);
  const site = w.zet(`IFCSITE('${ifcGuid(p.id + "/site")}',${eigen},'Terrein',$,$,${sitePl},$,$,.ELEMENT.,$,$,$,$,$)`);
  const gebPl = plaats(sitePl);
  const adres = p.adres ? w.zet(`IFCPOSTALADDRESS($,$,$,$,${p.adres.straat ? `(${tekst(p.adres.straat)})` : "$"},$,${tekst(p.adres.gemeente)},$,${tekst(p.adres.postcode)},'België')`) : "$";
  const gebouw = w.zet(`IFCBUILDING('${ifcGuid(p.id + "/gebouw")}',${eigen},${tekst(p.naam)},$,$,${gebPl},$,$,.ELEMENT.,$,$,${adres})`);
  w.zet(`IFCRELAGGREGATES('${ifcGuid(p.id + "/agg1")}',${eigen},$,$,${project},(${site}))`);
  w.zet(`IFCRELAGGREGATES('${ifcGuid(p.id + "/agg2")}',${eigen},$,$,${site},(${gebouw}))`);

  const verdiepingen: string[] = [];
  const alleMuren: Array<{ e: string; m: Muur }> = [];
  for (const v of p.verdiepingen) {
    const vPl = plaats(gebPl, 0, 0, v.peil);
    const vId = w.zet(`IFCBUILDINGSTOREY('${ifcGuid(v.id)}',${eigen},${tekst(v.naam)},$,$,${vPl},$,$,.ELEMENT.,${getal(v.peil)})`);
    verdiepingen.push(vId);
    const bevat: string[] = [];
    const ruimtes: string[] = [];
    const muurEnt = new Map<string, string>();
    for (const m of v.muren) {
      const vorm = muurVorm(m, v.muren);
      const e = w.zet(`IFCWALL('${ifcGuid(v.id + "/" + m.id)}',${eigen},${tekst("Muur " + m.id)},$,$,${plaats(vPl)},${extrusie(vorm, 0, m.hoogte)},$,.STANDARD.)`);
      muurEnt.set(m.id, e);
      bevat.push(e);
      alleMuren.push({ e, m });
      pset(v.id + "/" + m.id + "/pset", "Pset_WallCommon", [
        enkel("LoadBearing", bool(m.dragend === "bevestigd" || m.dragend === "vermoeden")),
        enkel("IsExternal", bool(isBuitenmuur(m, v))),
        enkel("Reference", lbl(m.id)),
      ], [e]);
      pset(v.id + "/" + m.id + "/opm", "architect1.0_Opmeting", [
        enkel("Meetmethode", lbl(m.bron.methode)),
        enkel("Dragend", lbl(m.dragend)),
        enkel("Dikte", len(m.dikte)),
      ], [e]);
    }
    for (const o of v.openingen) {
      const m = v.muren.find((x) => x.id === o.muurId);
      const mE = muurEnt.get(o.muurId);
      if (!m || !mE) continue;
      const blok = (marge: number, diepte: number) => openingRechthoek(m, o, marge, diepte);
      const sleutel = v.id + "/" + o.id;
      const opening = w.zet(`IFCOPENINGELEMENT('${ifcGuid(sleutel + "/gat")}',${eigen},${tekst("Opening " + o.id)},$,$,${plaats(vPl)},${extrusie(blok(0, m.dikte + 20), o.borstwering, o.hoogte)},$,.OPENING.)`);
      w.zet(`IFCRELVOIDSELEMENT('${ifcGuid(sleutel + "/void")}',${eigen},$,$,${mE},${opening})`);
      if (o.soort === "doorgang") continue;
      const vulling = extrusie(blok(0, Math.min(70, m.dikte)), o.borstwering, o.hoogte);
      const naam = `${o.soort === "deur" ? "Deur" : "Raam"} ${o.breedte} × ${o.hoogte}`;
      const el = o.soort === "deur"
        ? w.zet(`IFCDOOR('${ifcGuid(sleutel)}',${eigen},${tekst(naam)},$,$,${plaats(vPl)},${vulling},$,${getal(o.hoogte)},${getal(o.breedte)},.DOOR.,$,$)`)
        : w.zet(`IFCWINDOW('${ifcGuid(sleutel)}',${eigen},${tekst(naam)},$,$,${plaats(vPl)},${vulling},$,${getal(o.hoogte)},${getal(o.breedte)},.WINDOW.,$,$)`);
      w.zet(`IFCRELFILLSELEMENT('${ifcGuid(sleutel + "/fill")}',${eigen},$,$,${opening},${el})`);
      bevat.push(el);
      pset(sleutel + "/pset", o.soort === "deur" ? "Pset_DoorCommon" : "Pset_WindowCommon", [
        enkel("Reference", lbl(o.id)),
        enkel("IsExternal", bool(isBuitenmuur(m, v))),
      ], [el]);
      if (o.borstwering > 0) pset(sleutel + "/opm", "architect1.0_Opmeting", [enkel("Borstwering", len(o.borstwering)), enkel("Meetmethode", lbl(o.bron.methode))], [el]);
    }
    for (const r of v.ruimtes) {
      const e = w.zet(`IFCSPACE('${ifcGuid(v.id + "/" + r.id)}',${eigen},${tekst(r.naam)},${tekst(r.notities)},$,${plaats(vPl)},${extrusie(r.contour, 0, r.plafondhoogte)},${tekst(r.naam)},.ELEMENT.,.SPACE.,$)`);
      ruimtes.push(e);
      pset(v.id + "/" + r.id + "/pset", "Pset_SpaceCommon", [enkel("Reference", lbl(r.id))], [e]);
      pset(v.id + "/" + r.id + "/opm", "architect1.0_Opmeting", [enkel("Plafondhoogte", len(r.plafondhoogte)), enkel("Meetmethode", lbl(r.bron.methode))], [e]);
    }
    for (const s of v.sparingen) {
      const e = w.zet(`IFCSPACE('${ifcGuid(v.id + "/" + s.id)}',${eigen},${tekst(s.soort[0]!.toUpperCase() + s.soort.slice(1))},$,${tekst(s.soort)},${plaats(vPl)},${extrusie(s.contour, -200, 200)},$,.ELEMENT.,.USERDEFINED.,$)`);
      ruimtes.push(e);
    }
    if (bevat.length) w.zet(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid(v.id + "/bevat")}',${eigen},$,$,${lijst(bevat)},${vId})`);
    if (ruimtes.length) w.zet(`IFCRELAGGREGATES('${ifcGuid(v.id + "/ruimtes")}',${eigen},$,$,${vId},${lijst(ruimtes)})`);
  }
  w.zet(`IFCRELAGGREGATES('${ifcGuid(p.id + "/agg3")}',${eigen},$,$,${gebouw},${lijst(verdiepingen)})`);
  void alleMuren;

  const kop = [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME(${tekst(p.naam + ".ifc")},'${tijd}',(''),(${tekst(app)}),${tekst(app)},${tekst(app)},'');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
  ];
  return [...kop, ...w.regels, "ENDSEC;", "END-ISO-10303-21;", ""].join("\n");
}

/** Rechthoek in het plan voor een opening: langs de muur van offset tot offset+breedte, dwars `diepte`. */
function openingRechthoek(m: Muur, o: Opening, marge: number, diepte: number): Punt[] {
  const u = richting(m), n = { x: -u.y, y: u.x };
  const a = o.offset - marge, b = o.offset + o.breedte + marge, h = diepte / 2;
  const q = (t: number, s: number) => ({ x: m.start.x + u.x * t + n.x * s, y: m.start.y + u.y * t + n.y * s });
  return [q(a, -h), q(b, -h), q(b, h), q(a, h)];
}

/** Buitenmuur = muur die maar aan één ruimte grenst. */
function isBuitenmuur(m: Muur, v: Verdieping): boolean {
  return v.ruimtes.filter((r) => r.muurIds.includes(m.id)).length < 2 && muurLengte(m) > 0;
}
