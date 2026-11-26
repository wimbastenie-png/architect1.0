/**
 * Werf: werffoto's per ruimte, opvolgpunten, werfdagboek, meer- en minwerken,
 * vorderingsstaat en offerte.
 */
import {
  BTW6_VOORWAARDEN, bewaarDag, dagboekTotalen, dagVan, meerwerkBedrag, meerwerkTotalen, nieuweVordering, nieuwMeerwerk, offerteRegels, STANDAARD_BETALING,
  vorderingsstaat, WEER, zetMeerwerkStatus, euro,
  type DagboekDag, type Firma, type Meerwerk, type OfferteInvoer, type Prijzen, type Project, type Verdieping,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { FotoVeld, verklein } from "./Fotos.tsx";
import { leesOpslag, schrijfOpslag, Veld } from "./ui.tsx";

const FIRMA = "architect1.0:firma";
const leesFirma = (x: unknown): Firma => (x && typeof x === "object" && typeof (x as Firma).naam === "string" ? (x as Firma) : { naam: "" });

export function WerfPaneel(props: {
  project: Project; v: Verdieping; ruimteId: string | null; zetRuimteId: (id: string | null) => void;
  wijzigProject: (p: Project) => void; prijzen: Prijzen;
  exporteer: (soort: "offerte" | "vordering" | "meerwerk" | "dagboek", data: { firma: Firma; offerte?: OfferteInvoer; nr?: number; btw?: 6 | 21; id?: string }) => void;
}) {
  const [tab, zetTab] = useState<"fotos" | "dagboek" | "meerwerk" | "geld">("fotos");
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
        {([["fotos", "Foto's en punten"], ["dagboek", "Dagboek"], ["meerwerk", "Meer- en minwerk"], ["geld", "Vordering en offerte"]] as const).map(([k, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "actief" : ""} onClick={() => zetTab(k)}>{n}</button>
        ))}
      </div>
      {tab === "dagboek" && <Dagboek project={project} wijzigProject={props.wijzigProject} exporteer={() => props.exporteer("dagboek", { firma })} />}
      {tab === "meerwerk" && <Meerwerken project={project} wijzigProject={props.wijzigProject} exporteer={(id) => props.exporteer("meerwerk", { firma, id, btw: off.btwPct })} />}
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
          {(["naam", "adres", "btw", "iban", "telefoon", "email"] as const).map((k) => (
            <Veld key={k} label={{ naam: "Firmanaam", adres: "Adres", btw: "Btw-nummer", iban: "IBAN", telefoon: "Telefoon", email: "E-mail" }[k]}>
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
