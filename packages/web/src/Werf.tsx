/**
 * Werf: werffoto's per ruimte, opvolgpunten, werfdagboek, meer- en minwerken,
 * vorderingsstaat en offerte.
 */
import {
  bestelbaar, bestellijst, bestellijstCSV, controleerUBL, factuurNaarUBL, klantenCSV, verkoopCSV, type Artikels,
  aanneming, BTW_NAAM, controleerFactuur, FACTUUR_SOORT, factuurTotalen, gefactureerd, stelFactuurOp, volgendNummer,
  BTW6_VOORWAARDEN, bewaarDag, dagboekTotalen, dagVan, meerwerkBedrag, meerwerkTotalen, nieuweVordering, nieuwMeerwerk, offerteRegels, STANDAARD_BETALING,
  vorderingsstaat, WEER, zetMeerwerkStatus, euro,
  type BtwRegime, type DagboekDag, type Factuur, type Firma, type Meerwerk, type OfferteInvoer, type Prijzen, type Project, type Verdieping,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { FotoVeld, verklein } from "./Fotos.tsx";
import { bestandsnaam, download, leesOpslag, schrijfOpslag, Veld } from "./ui.tsx";

const FIRMA = "architect1.0:firma";
const leesFirma = (x: unknown): Firma => (x && typeof x === "object" && typeof (x as Firma).naam === "string" ? (x as Firma) : { naam: "" });

export function WerfPaneel(props: {
  project: Project; v: Verdieping; ruimteId: string | null; zetRuimteId: (id: string | null) => void;
  wijzigProject: (p: Project) => void; prijzen: Prijzen;
  exporteer: (soort: "offerte" | "vordering" | "meerwerk" | "dagboek" | "factuur", data: { firma: Firma; offerte?: OfferteInvoer; nr?: number; btw?: 6 | 21; id?: string }) => void;
}) {
  const [tab, zetTab] = useState<"fotos" | "dagboek" | "meerwerk" | "geld" | "facturen" | "export">("fotos");
  const { project, v, ruimteId } = props;
  const r = v.ruimtes.find((x) => x.id === ruimteId);
  const [punt, zetPunt] = useState("");
  const [firma, zetFirmaState] = useState<Firma>(() => leesOpslag(FIRMA, leesFirma, { naam: "" }));
  const zetFirma = (f: Firma) => { zetFirmaState(f); schrijfOpslag(FIRMA, f); };
  const [off, zetOff] = useState<OfferteInvoer>(() => ({
    nummer: `${new Date().getFullYear()}-${String(project.vorderingen.length + 1).padStart(3, "0")}`, datum: new Date().toISOString().slice(0, 10),
    klant: project.vergunning?.bouwheer ?? "", klantAdres: [project.adres?.straat, project.adres?.postcode, project.adres?.gemeente].filter(Boolean).join(" "),
    btwPct: 21, geldigheidDagen: 30, betaling: STANDAARD_BETALING,
  }));
  const fotos = project.fotos.filter((f) => f.soort === "werf" && (!ruimteId || f.ruimteId === ruimteId));
  const punten = project.opvolging.filter((x) => !ruimteId || x.ruimteId === ruimteId);
  const open = project.vorderingen.find((x) => !x.afgesloten) ?? project.vorderingen[project.vorderingen.length - 1];
  const regels = useMemo(() => offerteRegels(project, props.prijzen), [project, props.prijzen]);
  const staat = useMemo(() => (open ? vorderingsstaat(project, props.prijzen, open.nr) : null), [project, props.prijzen, open]);
  const naamRuimte = (id?: string) => project.verdiepingen.flatMap((x) => x.ruimtes).find((x) => x.id === id)?.naam ?? "algemeen";

  return (
    <section className="kaart werf">
      <div className="kaart-kop"><h2>Werf{r ? `: ${r.naam}` : ""}</h2>{r && <button onClick={() => props.zetRuimteId(null)} aria-label="Alle ruimtes">×</button>}</div>
      <div className="soorten" role="tablist" aria-label="Werf">
        {([["fotos", "Foto's en punten"], ["dagboek", "Dagboek"], ["meerwerk", "Meer- en minwerk"], ["geld", "Vordering en offerte"], ["facturen", "Facturen"], ["export", "Boekhouding en groothandel"]] as const).map(([k, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "actief" : ""} onClick={() => zetTab(k)}>{n}</button>
        ))}
      </div>
      {tab === "dagboek" && <Dagboek project={project} wijzigProject={props.wijzigProject} exporteer={() => props.exporteer("dagboek", { firma })} />}
      {tab === "meerwerk" && <Meerwerken project={project} wijzigProject={props.wijzigProject} exporteer={(id) => props.exporteer("meerwerk", { firma, id, btw: off.btwPct })} />}
      {tab === "facturen" && <Facturen project={project} prijzen={props.prijzen} firma={firma} wijzigProject={props.wijzigProject} exporteer={(id) => props.exporteer("factuur", { firma, id })}
        standaardKlant={{ naam: off.klant, adres: off.klantAdres }} />}
      {tab === "export" && <Export project={project} />}
      {tab === "fotos" && (<>
      <p className="uitleg">Tik een ruimte aan in het plan om foto's en punten per ruimte te zien; zonder keuze zie je alles.</p>

      <h3>Werffoto's {r ? `(${r.naam})` : "(alle ruimtes)"}</h3>
      <FotoVeld ids={fotos.map((f) => f.id)} label="Werffoto nemen"
        voegToe={(id) => props.wijzigProject({ ...project, fotos: [...project.fotos, { id, soort: "werf", datum: new Date().toISOString(), ruimteId: ruimteId ?? undefined }] })}
        verwijder={(id) => props.wijzigProject({ ...project, fotos: project.fotos.filter((f) => f.id !== id) })} />
      {fotos.length > 0 && <ul className="leden">{fotos.map((f) => <li key={f.id}><span>{new Date(f.datum).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })} · {naamRuimte(f.ruimteId)}</span>
        <input aria-label="Bijschrift" placeholder="bijschrift" defaultValue={f.bijschrift ?? ""} onBlur={(e) => props.wijzigProject({ ...project, fotos: project.fotos.map((x) => (x.id === f.id ? { ...x, bijschrift: e.target.value || undefined } : x)) })} /></li>)}</ul>}

      <h3>Op te volgen {r ? `(${r.naam})` : ""}</h3>
      <div className="rij">
        <Veld label="Nieuw punt"><input value={punt} onChange={(e) => zetPunt(e.target.value)} placeholder="bv. stopcontact verplaatsen, tegels bestellen" /></Veld>
        <button onClick={() => { if (!punt.trim()) return; props.wijzigProject({ ...project, opvolging: [...project.opvolging, { id: `ov-${Date.now().toString(36)}`, ruimteId: ruimteId ?? undefined, tekst: punt.trim(), status: "open", datum: new Date().toISOString() }] }); zetPunt(""); }}>+ Punt</button>
      </div>
      <ul className="opvolging">
        {punten.map((x) => (
          <li key={x.id} className={x.status === "klaar" ? "klaar" : ""}>
            <label className="vinkje"><input type="checkbox" checked={x.status === "klaar"} onChange={(e) => props.wijzigProject({ ...project, opvolging: project.opvolging.map((y) => (y.id === x.id ? { ...y, status: e.target.checked ? "klaar" : "open" } : y)) })} /> {x.tekst}</label>
            <span className="zacht"> {naamRuimte(x.ruimteId)} · {new Date(x.datum).toLocaleDateString("nl-BE")}</span>
            <button aria-label="Punt verwijderen" onClick={() => props.wijzigProject({ ...project, opvolging: project.opvolging.filter((y) => y.id !== x.id) })}>×</button>
          </li>
        ))}
      </ul>

      </>)}
      {tab === "geld" && (<>
      <h3>Vorderingsstaat {open ? `${open.nr}${open.afgesloten ? " (afgesloten)" : ""}` : ""}</h3>
      {regels.regels.length === 0 ? <p className="uitleg">Geef eerst eenheidsprijzen in het lastenboek (Plan → Meetstaat → Lastenboek).</p> : !open ? (
        <button onClick={() => props.wijzigProject(nieuweVordering(project))}>Eerste vorderingsstaat beginnen</button>
      ) : (
        <>
          <table className="tabel klein">
            <thead><tr><th>Post</th><th className="getal">Bedrag</th><th className="getal">Vorig</th><th className="getal">Nu %</th><th className="getal">Deze staat</th></tr></thead>
            <tbody>{staat!.regels.map((x) => (
              <tr key={x.code}>
                <td>{x.code} {x.omschrijving}</td>
                <td className="getal">{euro(x.bedrag)}</td>
                <td className="getal">{Math.round(x.vorigProcent)} %</td>
                <td className="getal"><input className="prijs" type="number" inputMode="numeric" min={0} max={100} aria-label={`Percentage ${x.omschrijving}`} disabled={open.afgesloten} value={x.procent} onChange={(e) => props.wijzigProject({ ...project, vorderingen: project.vorderingen.map((y) => (y.nr === open.nr ? { ...y, procent: { ...y.procent, [x.code]: Math.max(0, Math.min(100, +e.target.value || 0)) } } : y)) })} /></td>
                <td className="getal">{euro(x.dezeStaat)}</td>
              </tr>
            ))}</tbody>
          </table>
          <p>Uitgevoerd: <strong>{euro(staat!.totaalUitgevoerd)}</strong> · deze staat: <strong>{euro(staat!.dezeStaat)}</strong> excl. btw</p>
          <div className="acties">
            <button className="primair" onClick={() => props.exporteer("vordering", { firma, nr: open.nr, btw: off.btwPct })}>Vorderingsstaat (PDF)</button>
            <button onClick={() => { if (window.confirm(`Staat ${open.nr} afsluiten en staat ${open.nr + 1} beginnen?`)) props.wijzigProject(nieuweVordering(project)); }}>Afsluiten en nieuwe staat</button>
          </div>
        </>
      )}

      <h3>Offerte</h3>
      <details>
        <summary>Firmagegevens en logo (op dit toestel bewaard)</summary>
        <div className="velden">
          {(["naam", "adres", "btw", "iban", "bic", "telefoon", "email"] as const).map((k) => (
            <Veld key={k} label={{ naam: "Firmanaam", adres: "Adres", btw: "Btw-nummer", iban: "IBAN", bic: "BIC", telefoon: "Telefoon", email: "E-mail" }[k]}>
              <input value={firma[k] ?? ""} onChange={(e) => zetFirma({ ...firma, [k]: e.target.value || (k === "naam" ? "" : undefined) })} />
            </Veld>
          ))}
        </div>
        <label className="knop">
          {firma.logo ? "Ander logo" : "Logo kiezen (PNG of JPEG)"}
          <input type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const blob = await verklein(f, 600);
            const reader = new FileReader();
            reader.onload = () => zetFirma({ ...firma, logo: String(reader.result) });
            reader.readAsDataURL(blob.type === "image/png" || blob.type === "image/jpeg" ? blob : f);
          }} />
        </label>
        {firma.logo && <img src={firma.logo} alt="Logo" className="logo-voorbeeld" />}
      </details>
      <div className="velden">
        <Veld label="Offertenummer"><input value={off.nummer} onChange={(e) => zetOff({ ...off, nummer: e.target.value })} /></Veld>
        <Veld label="Klant"><input value={off.klant} onChange={(e) => zetOff({ ...off, klant: e.target.value })} /></Veld>
        <Veld label="Adres klant"><input value={off.klantAdres ?? ""} onChange={(e) => zetOff({ ...off, klantAdres: e.target.value })} /></Veld>
        <Veld label="Btw"><select value={off.btwPct} onChange={(e) => zetOff({ ...off, btwPct: +e.target.value as 6 | 21 })}><option value={21}>21 %</option><option value={6}>6 % (renovatie, onder voorwaarden)</option></select></Veld>
        <Veld label="Geldig (dagen)"><input type="number" min={1} value={off.geldigheidDagen} onChange={(e) => zetOff({ ...off, geldigheidDagen: Math.max(1, +e.target.value || 30) })} /></Veld>
        <Veld label="Betalingsvoorwaarden"><input value={off.betaling} onChange={(e) => zetOff({ ...off, betaling: e.target.value })} /></Veld>
      </div>
      {off.btwPct === 6 && <p className="uitleg">{BTW6_VOORWAARDEN}</p>}
      <p>{regels.regels.length} posten met een prijs · totaal excl. btw <strong>{euro(regels.excl)}</strong>{regels.zonderPrijs.length ? ` · ${regels.zonderPrijs.length} posten zonder prijs (niet in de offerte)` : ""}</p>
      <div className="acties">
        <button className="primair" disabled={!firma.naam || !regels.regels.length} onClick={() => props.exporteer("offerte", { firma, offerte: off })}>Offerte (PDF)</button>
      </div>
      {!firma.naam && <p className="uitleg">Vul eerst de firmanaam in.</p>}
      </>)}
    </section>
  );
}

const vandaag = () => new Date().toISOString().slice(0, 10);

function Dagboek({ project, wijzigProject, exporteer }: { project: Project; wijzigProject: (p: Project) => void; exporteer: () => void }) {
  const [datum, zetDatum] = useState(vandaag);
  const dag = dagVan(project, datum);
  const bestaat = project.dagboek.some((d) => d.datum === datum);
  const zet = (n: Partial<DagboekDag>) => wijzigProject(bewaarDag(project, { ...dag, ...n }));
  const tekst = (k: "ploeg" | "werk" | "leveringen" | "bezoekers" | "problemen") => ({
    defaultValue: (dag[k] as string | undefined) ?? "", key: `${datum}-${k}-${bestaat}`,
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { const v = e.target.value.trim(); if (v !== ((dag[k] as string | undefined) ?? "")) zet({ [k]: k === "werk" ? v : v || undefined }); },
  });
  const t = dagboekTotalen(project);
  return (
    <>
      <h3>Werfdagboek</h3>
      <div className="rij">
        <Veld label="Datum"><input type="date" value={datum} onChange={(e) => e.target.value && zetDatum(e.target.value)} /></Veld>
        <Veld label="Weer"><select value={dag.weer ?? ""} onChange={(e) => zet({ weer: (e.target.value || undefined) as DagboekDag["weer"] })}><option value="">–</option>{Object.entries(WEER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Veld>
        <Veld label="Temperatuur (°C)"><input type="number" inputMode="decimal" defaultValue={dag.temperatuur ?? ""} key={`${datum}-t-${bestaat}`} onBlur={(e) => zet({ temperatuur: e.target.value === "" ? undefined : +e.target.value })} /></Veld>
      </div>
      <label className="vinkje"><input type="checkbox" checked={!!dag.verlet} onChange={(e) => zet({ verlet: e.target.checked || undefined })} /> Verlet (werf kon niet doorgaan)</label>
      <div className="rij">
        <Veld label="Ploeg (wie)"><input {...tekst("ploeg")} placeholder="bv. Jan, Piet, onderaannemer elektriciteit" /></Veld>
        <Veld label="Uren (samen)"><input type="number" inputMode="decimal" min={0} defaultValue={dag.uren ?? ""} key={`${datum}-u-${bestaat}`} onBlur={(e) => zet({ uren: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })} /></Veld>
      </div>
      <Veld label="Uitgevoerd werk"><textarea rows={3} {...tekst("werk")} placeholder="bv. afbraak keuken, sleuven elektriciteit leefruimte" /></Veld>
      <Veld label="Leveringen"><input {...tekst("leveringen")} placeholder="bv. 2 paletten snelbouw, container 10 m³" /></Veld>
      <Veld label="Bezoekers"><input {...tekst("bezoekers")} placeholder="bv. architect, klant, keuring" /></Veld>
      <Veld label="Problemen en afspraken"><textarea rows={2} {...tekst("problemen")} /></Veld>
      <h3>Foto's van deze dag</h3>
      <FotoVeld ids={dag.fotoIds} label="Foto nemen"
        voegToe={(id) => wijzigProject(bewaarDag({ ...project, fotos: [...project.fotos, { id, soort: "werf", datum: new Date().toISOString(), bijschrift: `dagboek ${datum}` }] }, { ...dag, fotoIds: [...dag.fotoIds, id] }))}
        verwijder={(id) => wijzigProject(bewaarDag({ ...project, fotos: project.fotos.filter((f) => f.id !== id) }, { ...dag, fotoIds: dag.fotoIds.filter((x) => x !== id) }))} />
      <p className="uitleg">{t.dagen} dagen ingevuld · {t.werkdagen} werkdagen · {t.verlet} verlet · {t.uren} uren</p>
      {project.dagboek.length > 0 && (
        <ul className="leden">{[...project.dagboek].reverse().slice(0, 14).map((d) => (
          <li key={d.id}><button className="link" onClick={() => zetDatum(d.datum)}>{d.datum.split("-").reverse().join("/")}</button> {d.verlet ? "verlet" : d.werk.slice(0, 60)}</li>
        ))}</ul>
      )}
      <div className="acties"><button className="primair" disabled={!project.dagboek.length} onClick={exporteer}>Werfdagboek (PDF)</button></div>
    </>
  );
}

const STATUS: Record<Meerwerk["status"], string> = { voorgesteld: "voorgesteld", akkoord: "akkoord klant", geweigerd: "geweigerd" };

function Meerwerken({ project, wijzigProject, exporteer }: { project: Project; wijzigProject: (p: Project) => void; exporteer: (id: string) => void }) {
  const [n, zetN] = useState({ omschrijving: "", soort: "meer" as Meerwerk["soort"], eenheid: "st", hoeveelheid: "1", prijs: "" });
  const [fout, zetFout] = useState<string | null>(null);
  const t = meerwerkTotalen(project);
  const doe = (f: () => Project) => { try { wijzigProject(f()); zetFout(null); } catch (e) { zetFout((e as Error).message); } };
  return (
    <>
      <h3>Meer- en minwerken</h3>
      <p className="uitleg">Een meer- of minwerk wordt eerst voorgesteld. Pas na akkoord van de klant komt het in de vorderingsstaat (post MW1, MW2 …). Laat de bon ondertekenen: het akkoord in de app vervangt de handtekening niet.</p>
      <div className="velden">
        <Veld label="Omschrijving"><input value={n.omschrijving} onChange={(e) => zetN({ ...n, omschrijving: e.target.value })} placeholder="bv. extra stopcontact keuken" /></Veld>
        <Veld label="Soort"><select value={n.soort} onChange={(e) => zetN({ ...n, soort: e.target.value as Meerwerk["soort"] })}><option value="meer">meerwerk (+)</option><option value="min">minwerk (−)</option></select></Veld>
        <Veld label="Eenheid"><input value={n.eenheid} onChange={(e) => zetN({ ...n, eenheid: e.target.value })} /></Veld>
        <Veld label="Hoeveelheid"><input type="number" inputMode="decimal" min={0} value={n.hoeveelheid} onChange={(e) => zetN({ ...n, hoeveelheid: e.target.value })} /></Veld>
        <Veld label="Eenheidsprijs (€ excl. btw)"><input type="number" inputMode="decimal" min={0} value={n.prijs} onChange={(e) => zetN({ ...n, prijs: e.target.value })} /></Veld>
      </div>
      <button onClick={() => doe(() => { const r = nieuwMeerwerk(project, { omschrijving: n.omschrijving, soort: n.soort, eenheid: n.eenheid || "st", hoeveelheid: Math.max(0, +n.hoeveelheid || 0), prijs: Math.max(0, +n.prijs || 0) }); zetN({ ...n, omschrijving: "", prijs: "" }); return r.project; })}>+ Voorstel</button>
      {fout && <p className="melding" role="alert">{fout}</p>}
      {project.meerwerken.length > 0 && (
        <table className="tabel klein">
          <thead><tr><th>Nr</th><th>Omschrijving</th><th className="getal">Bedrag</th><th>Status</th><th></th></tr></thead>
          <tbody>{project.meerwerken.map((m) => (
            <tr key={m.id} className={m.status === "geweigerd" ? "zacht" : ""}>
              <td>MW{m.nr}</td>
              <td>{m.soort === "min" ? "− " : "+ "}{m.omschrijving}<br /><span className="zacht">{m.hoeveelheid} {m.eenheid} × {euro(m.prijs)}</span></td>
              <td className="getal">{euro(meerwerkBedrag(m))}</td>
              <td>{STATUS[m.status]}{m.akkoordDoor ? ` (${m.akkoordDoor})` : ""}</td>
              <td className="acties">
                {m.status !== "akkoord" && <button onClick={() => { const wie = window.prompt("Naam van de klant die akkoord gaf:", project.vergunning?.bouwheer ?? ""); if (wie !== null) doe(() => zetMeerwerkStatus(project, m.id, "akkoord", { door: wie })); }}>Akkoord</button>}
                {m.status !== "geweigerd" && <button onClick={() => { const r = window.prompt("Geweigerd. Reden (mag leeg):", ""); if (r !== null) doe(() => zetMeerwerkStatus(project, m.id, "geweigerd", { reden: r || undefined })); }}>Geweigerd</button>}
                <button onClick={() => exporteer(m.id)}>Bon (PDF)</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <p>Akkoord: meer <strong>{euro(t.meer)}</strong> · min <strong>{euro(t.min)}</strong> · saldo <strong>{euro(t.saldo)}</strong> excl. btw{t.open ? ` · ${t.open} voorstel(len) wachten op de klant (${euro(t.voorgesteld)})` : ""}</p>
    </>
  );
}

const TELLER = "architect1.0:factuurteller";
const leesTeller = (jaar: number) => { try { return (JSON.parse(localStorage.getItem(TELLER) ?? "{}") as Record<string, number>)[jaar] ?? 0; } catch { return 0; } };
const zetTeller = (nummer: string) => {
  const m = nummer.match(/^(\d{4})-(\d+)$/); if (!m) return;
  try { const t = JSON.parse(localStorage.getItem(TELLER) ?? "{}") as Record<string, number>; t[m[1]!] = Math.max(t[m[1]!] ?? 0, +m[2]!); localStorage.setItem(TELLER, JSON.stringify(t)); } catch { /* privévenster */ }
};

function Facturen({ project, prijzen, firma, wijzigProject, exporteer, standaardKlant }: {
  project: Project; prijzen: Prijzen; firma: Firma; wijzigProject: (p: Project) => void; exporteer: (id: string) => void; standaardKlant: { naam: string; adres?: string };
}) {
  const jaar = new Date().getFullYear();
  const [soort, zetSoort] = useState<Factuur["soort"]>("voorschot");
  const [btw, zetBtw] = useState<BtwRegime>(() => project.facturen[project.facturen.length - 1]?.btw ?? "21");
  const [datum, zetDatum] = useState(vandaag);
  const [nummer, zetNummer] = useState(() => volgendNummer(project, jaar, leesTeller(jaar)));
  const [klant, zetKlant] = useState<Factuur["klant"]>(() => project.facturen[project.facturen.length - 1]?.klant ?? { naam: standaardKlant.naam, adres: standaardKlant.adres });
  const [pct, zetPct] = useState("30");
  const [termijn, zetTermijn] = useState("15");
  const vorderingenZonder = project.vorderingen.filter((v) => !project.facturen.some((f) => f.soort === "vordering" && f.vorderingNr === v.nr));
  const [vnr, zetVnr] = useState<number | undefined>(vorderingenZonder[0]?.nr);
  const [credit, zetCredit] = useState({ bedrag: "", omschrijving: "" });
  const [problemen, zetProblemen] = useState<string[]>([]);
  const totaal = aanneming(project, prijzen), al = gefactureerd(project);
  const open = project.facturen.filter((f) => !f.betaald && f.soort !== "credit").reduce((s, f) => s + factuurTotalen(f).incl, 0);

  const maak = () => {
    try {
      const f = stelFactuurOp(project, prijzen, { soort, nummer: nummer.trim(), datum, btw, klant, betaaltermijn: Math.max(0, +termijn || 0), voorschotPct: +pct, vorderingNr: vnr, bedrag: +credit.bedrag, omschrijving: credit.omschrijving });
      if (project.facturen.some((x) => x.nummer === f.nummer)) throw new Error(`Factuurnummer ${f.nummer} bestaat al.`);
      const pr = controleerFactuur(f, firma);
      zetProblemen(pr);
      if (pr.length) return;
      wijzigProject({ ...project, facturen: [...project.facturen, f] });
      zetTeller(f.nummer);
      zetNummer(volgendNummer({ ...project, facturen: [...project.facturen, f] }, jaar, leesTeller(jaar)));
    } catch (e) { zetProblemen([(e as Error).message]); }
  };
  const laatste = [...project.facturen].sort((a, b) => b.nummer.localeCompare(a.nummer))[0];

  return (
    <>
      <h3>Facturen</h3>
      <p className="uitleg">Aanneming {euro(totaal)} · gefactureerd {euro(al.totaal)} · nog te factureren {euro(totaal - al.totaal)} (excl. btw) · openstaand {euro(open)} (incl. btw)</p>
      <div className="velden">
        <Veld label="Soort"><select value={soort} onChange={(e) => zetSoort(e.target.value as Factuur["soort"])}>{Object.entries(FACTUUR_SOORT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Veld>
        <Veld label="Factuurnummer"><input value={nummer} onChange={(e) => zetNummer(e.target.value)} /></Veld>
        <Veld label="Factuurdatum"><input type="date" value={datum} onChange={(e) => e.target.value && zetDatum(e.target.value)} /></Veld>
        <Veld label="Betaaltermijn (dagen)"><input type="number" min={0} value={termijn} onChange={(e) => zetTermijn(e.target.value)} /></Veld>
        <Veld label="Btw-regime"><select value={btw} onChange={(e) => zetBtw(e.target.value as BtwRegime)}>{(["21", "6", "verlegd"] as const).map((k) => <option key={k} value={k}>{BTW_NAAM[k]}</option>)}</select></Veld>
        {soort === "voorschot" && <Veld label="Voorschot (%)"><input type="number" min={0} max={100} value={pct} onChange={(e) => zetPct(e.target.value)} /></Veld>}
        {soort === "vordering" && <Veld label="Vorderingsstaat"><select value={vnr ?? ""} onChange={(e) => zetVnr(e.target.value ? +e.target.value : undefined)}><option value="">–</option>{vorderingenZonder.map((v) => <option key={v.nr} value={v.nr}>staat {v.nr} ({v.datum.split("-").reverse().join("/")})</option>)}</select></Veld>}
        {soort === "credit" && <><Veld label="Bedrag creditnota (excl. btw)"><input type="number" min={0} value={credit.bedrag} onChange={(e) => zetCredit({ ...credit, bedrag: e.target.value })} /></Veld>
          <Veld label="Reden creditnota"><input value={credit.omschrijving} onChange={(e) => zetCredit({ ...credit, omschrijving: e.target.value })} /></Veld></>}
        <Veld label="Klant (naam)"><input value={klant.naam} onChange={(e) => zetKlant({ ...klant, naam: e.target.value })} /></Veld>
        <Veld label="Klant (adres)"><input value={klant.adres ?? ""} onChange={(e) => zetKlant({ ...klant, adres: e.target.value || undefined })} /></Veld>
        <Veld label="Klant (btw-nummer, firma)"><input value={klant.btw ?? ""} onChange={(e) => zetKlant({ ...klant, btw: e.target.value || undefined })} placeholder="leeg voor een particulier" /></Veld>
      </div>
      <button className="primair" onClick={maak}>Factuur opmaken</button>
      {problemen.length > 0 && <ul className="aandachtspunten" role="alert">{problemen.map((x) => <li key={x} className="let-op">{x}</li>)}</ul>}
      {btw === "6" && <p className="uitleg klein">Op de factuur komt de wettelijke vermelding voor 6 % (de klant bevestigt de voorwaarden door niet te betwisten binnen één maand). Laat dit nakijken door je boekhouder.</p>}
      {btw === "verlegd" && <p className="uitleg klein">Verlegd: werk in onroerende staat voor een btw-plichtige klant die periodieke aangiften indient. Het btw-nummer van de klant is verplicht.</p>}
      {project.facturen.length > 0 && (
        <table className="tabel klein">
          <thead><tr><th>Nr</th><th>Soort</th><th>Datum</th><th className="getal">Incl. btw</th><th>Betaald</th><th></th></tr></thead>
          <tbody>{[...project.facturen].sort((a, b) => a.nummer.localeCompare(b.nummer)).map((f) => (
            <tr key={f.id}>
              <td>{f.nummer}</td><td>{FACTUUR_SOORT[f.soort]}</td><td>{f.datum.split("-").reverse().join("/")}</td>
              <td className="getal">{euro(factuurTotalen(f).incl)}</td>
              <td><input type="checkbox" aria-label={`Factuur ${f.nummer} betaald`} checked={f.betaald} onChange={(e) => wijzigProject({ ...project, facturen: project.facturen.map((x) => (x.id === f.id ? { ...x, betaald: e.target.checked, betaaldOp: e.target.checked ? vandaag() : undefined } : x)) })} /></td>
              <td className="acties">
                <button onClick={() => exporteer(f.id)}>PDF</button>
                <button onClick={() => { const pr = controleerUBL(f, firma); zetProblemen(pr); if (!pr.length) download(`${bestandsnaam(project.naam)}-${f.soort === "credit" ? "creditnota" : "factuur"}-${bestandsnaam(f.nummer)}.xml`, factuurNaarUBL(project, firma, f), "application/xml"); }}>E-factuur (UBL)</button>
                {f.id === laatste?.id && <button className="gevaar" onClick={() => { if (window.confirm(`Factuur ${f.nummer} verwijderen? Doe dit alleen als ze nog niet verstuurd is; anders maak je een creditnota.`)) wijzigProject({ ...project, facturen: project.facturen.filter((x) => x.id !== f.id) }); }}>Verwijderen</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <p className="uitleg klein">Nummering: doorlopend per jaar (2026-001, 2026-002 …), ook over je projecten heen op dit toestel. Factureer je vanaf meerdere toestellen, controleer dan het nummer. De app geeft geen fiscaal advies: laat btw-regime en vermeldingen nakijken door je boekhouder.</p>
    </>
  );
}

const ARTIKELS = "architect1.0:artikels";
const leesArtikels = (x: unknown): Artikels => (x && typeof x === "object" ? (x as Artikels) : {});

function Export({ project }: { project: Project }) {
  const [artikels, zetArtikelsState] = useState<Artikels>(() => leesOpslag(ARTIKELS, leesArtikels, {}));
  const zetArtikels = (a: Artikels) => { zetArtikelsState(a); schrijfOpslag(ARTIKELS, a); };
  const [verlies, zetVerlies] = useState("5");
  const items = useMemo(() => bestelbaar(project), [project]);
  const regels = bestellijst(project, artikels, +verlies || 0);
  const naam = bestandsnaam(project.naam);
  const zet = (sleutel: string, veld: "nummer" | "perVerpakking", waarde: string) => {
    const a = { ...(artikels[sleutel] ?? { nummer: "" }) };
    if (veld === "nummer") a.nummer = waarde.trim(); else a.perVerpakking = waarde === "" ? undefined : Math.max(0, +waarde || 0);
    const n = { ...artikels };
    if (!a.nummer && !a.perVerpakking) delete n[sleutel]; else n[sleutel] = a;
    zetArtikels(n);
  };
  return (
    <>
      <h3>Boekhouding</h3>
      <p className="uitleg">Lees deze bestanden in je boekhoudpakket in (de meeste pakketten aanvaarden een CSV met puntkomma). Een e-factuur (UBL, Peppol) maak je per factuur in het tabblad <strong>Facturen</strong>.</p>
      <div className="acties">
        <button disabled={!project.facturen.length} onClick={() => download(`${naam}-klanten.csv`, klantenCSV([project]), "text/csv;charset=utf-8")}>Klantenlijst (CSV)</button>
        <button disabled={!project.facturen.length} onClick={() => download(`${naam}-verkoopdagboek.csv`, verkoopCSV([project]), "text/csv;charset=utf-8")}>Verkoopdagboek (CSV)</button>
      </div>
      {!project.facturen.length && <p className="uitleg klein">Nog geen facturen in dit project.</p>}

      <h3>Groothandel: bestellijst</h3>
      <p className="uitleg">Geef bij elke post je eigen artikelnummer bij de groothandel en hoeveel er in één verpakking zit (bv. 1,44 m² per doos tegels). De nummers blijven op dit toestel bewaard voor al je projecten. De bestellijst rekent snijverlies mee en rondt af naar hele verpakkingen.</p>
      <Veld label="Snijverlies (%)"><input type="number" min={0} max={50} value={verlies} onChange={(e) => zetVerlies(e.target.value)} /></Veld>
      <div className="tabel-wrap">
        <table className="tabel klein">
          <thead><tr><th>Post</th><th className="getal">Nodig</th><th>Artikelnummer</th><th className="getal">Per verpakking</th><th className="getal">Bestellen</th></tr></thead>
          <tbody>{items.map((b) => {
            const r = regels.find((x) => x.sleutel === b.sleutel);
            return (
              <tr key={b.sleutel}>
                <td>{b.omschrijving}</td>
                <td className="getal">{Math.round(b.hoeveelheid * 100) / 100} {b.eenheid}</td>
                <td><input aria-label={`Artikelnummer ${b.omschrijving}`} defaultValue={artikels[b.sleutel]?.nummer ?? ""} onBlur={(e) => zet(b.sleutel, "nummer", e.target.value)} /></td>
                <td className="getal"><input className="prijs" type="number" min={0} step="any" aria-label={`Per verpakking ${b.omschrijving}`} defaultValue={artikels[b.sleutel]?.perVerpakking ?? ""} onBlur={(e) => zet(b.sleutel, "perVerpakking", e.target.value)} /></td>
                <td className="getal">{r ? r.aantal : "–"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="acties"><button className="primair" disabled={!regels.length} onClick={() => download(`${naam}-bestellijst.csv`, bestellijstCSV(regels, project.naam), "text/csv;charset=utf-8")}>Bestellijst (CSV, {regels.length} artikels)</button></div>
      <p className="uitleg klein">Controleer hoeveelheden en verpakkingen vóór je bestelt. De groothandel bepaalt prijzen en beschikbaarheid.</p>
    </>
  );
}
