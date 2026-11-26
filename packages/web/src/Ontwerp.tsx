/**
 * Ontwerp: verbouwing tekenen (bestaand / afbreken / nieuw), nieuwe muren,
 * nieuwe of dichtgemaakte openingen, doorsneden en gevelaanzichten.
 */
import {
  aanzicht, doorsnede, muurOmschrijving, muurToestand, ONTWERP_DISCLAIMER, ontwerpWaarschuwingen, openingToestand,
  tekeningNaarSVG, verwijderNieuweMuur, zetMuurToestand, zetOpeningToestand, ZIJDEN,
  type MuurToestand, type OpeningToestand, type Project, type Verdieping, type Zijde,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import {
  afstandenTotGrenzen, ARCHITECT_DISCLAIMER, controleerTrap, deelRuimtesIn, nokHoogte, perceelRechthoek,
} from "@scanapp/core";
import { Veld } from "./ui.tsx";

export type OntwerpGereedschap = "kies" | "muur" | "snede" | "trap" | "opmerking";
export type OntwerpWeergave = "verbouwing" | "bestaand" | "nieuw";

/** Balk boven het plan: gereedschap en weergave. */
export function OntwerpBalk(props: {
  gereedschap: OntwerpGereedschap; zetGereedschap: (g: OntwerpGereedschap) => void;
  weergave: OntwerpWeergave; zetWeergave: (w: OntwerpWeergave) => void;
  eerstePunt: boolean; dikte: string; zetDikte: (d: string) => void;
}) {
  const g = props.gereedschap;
  return (
    <div className="installatie-balk ontwerp-balk">
      <div className="segment" role="tablist" aria-label="Weergave ontwerp">
        {(["verbouwing", "bestaand", "nieuw"] as OntwerpWeergave[]).map((w) => (
          <button key={w} role="tab" aria-selected={props.weergave === w} className={props.weergave === w ? "actief" : ""} onClick={() => props.zetWeergave(w)}>
            {w === "verbouwing" ? "Verbouwing" : w === "bestaand" ? "Bestaand" : "Nieuw"}
          </button>
        ))}
      </div>
      <div className="soorten" role="toolbar" aria-label="Gereedschap">
        <button className={g === "kies" ? "actief" : ""} aria-pressed={g === "kies"} onClick={() => props.zetGereedschap("kies")}>Aanklikken</button>
        <button className={g === "muur" ? "actief" : ""} aria-pressed={g === "muur"} onClick={() => props.zetGereedschap(g === "muur" ? "kies" : "muur")}>Nieuwe muur</button>
        <button className={g === "snede" ? "actief" : ""} aria-pressed={g === "snede"} onClick={() => props.zetGereedschap(g === "snede" ? "kies" : "snede")}>Snijlijn doorsnede</button>
        <button className={g === "trap" ? "actief" : ""} aria-pressed={g === "trap"} onClick={() => props.zetGereedschap(g === "trap" ? "kies" : "trap")}>Trap</button>
        <button className={g === "opmerking" ? "actief" : ""} aria-pressed={g === "opmerking"} onClick={() => props.zetGereedschap(g === "opmerking" ? "kies" : "opmerking")}>Opmerking</button>
        {g === "muur" && (
          <label className="inline-veld">dikte <input type="number" inputMode="numeric" min={50} step={10} value={props.dikte} onChange={(e) => props.zetDikte(e.target.value)} aria-label="Dikte nieuwe muur (mm)" /> mm</label>
        )}
      </div>
      <p className="hint-kort">
        {g === "muur" ? (props.eerstePunt ? "Tik het eindpunt van de nieuwe muur." : "Tik het beginpunt van de nieuwe muur (dicht bij een muur: sluit aan op het muurvlak; bijna recht: wordt haaks).")
          : g === "snede" ? (props.eerstePunt ? "Tik het tweede punt van de snijlijn." : "Tik twee punten: de snijlijn voor een doorsnede (over alle verdiepingen).")
            : g === "trap" ? (props.eerstePunt ? "Tik in de looprichting naar boven." : "Tik waar de trap vertrekt (eerste trede), daarna in de looprichting.")
            : g === "opmerking" ? "Tik waar de opmerking moet komen."
            : "Tik een muur of raam/deur aan om te kiezen: bestaand, afbreken (geel) of nieuw (rood)."}
      </p>
    </div>
  );
}

const TOESTAND_NAAM: Record<MuurToestand, string> = { bestaand: "Bestaand", afbreken: "Afbreken", nieuw: "Nieuw" };
const OPENING_NAAM: Record<OpeningToestand, string> = { bestaand: "Bestaand", nieuw: "Nieuwe opening", dicht: "Dichtmaken" };

export function OntwerpPaneel(props: {
  project: Project;
  v: Verdieping;
  muurId: string | null;
  zetMuurId: (id: string | null) => void;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  wijzigProject: (p: Project) => void;
  nieuweOpening: (muurId: string) => void;
  exporteerPdf: () => void;
  exporteerVergunning: () => void;
  opmerking: string | null;
  zetOpmerking: (id: string | null) => void;
}) {
  const { project, v, muurId } = props;
  const m = muurId ? v.muren.find((x) => x.id === muurId) : undefined;
  const w = useMemo(() => ontwerpWaarschuwingen(project), [project]);
  const [zijde, zetZijde] = useState<Zijde>("voor");
  const [snede, zetSnede] = useState<string | null>(null);
  const gekozenSnede = project.doorsneden.find((d) => d.id === snede) ?? project.doorsneden[project.doorsneden.length - 1];
  const doorsnedeSvg = useMemo(() => (gekozenSnede ? tekeningNaarSVG(doorsnede(project, gekozenSnede.a, gekozenSnede.b, { naam: gekozenSnede.naam })) : ""), [project, gekozenSnede]);
  const aanzichtSvg = useMemo(() => tekeningNaarSVG(aanzicht(project, zijde, { toestand: "verbouwing" })), [project, zijde]);

  return (
    <section className="kaart ontwerp">
      <div className="kaart-kop"><h2>Ontwerp</h2></div>
      <p className="uitleg">{ONTWERP_DISCLAIMER}</p>
      {m ? (
        <div className="punt-bewerken">
          <h3>{muurOmschrijving(v, m.id).split(" · ")[0]}</h3>
          {muurToestand(m) === "nieuw" ? (
            <>
              <p className="uitleg">Nieuwe muur, {m.dikte} mm dik.</p>
              <div className="acties">
                <button className="gevaar" onClick={() => { props.wijzig((x) => verwijderNieuweMuur(x, m.id)); props.zetMuurId(null); }}>Nieuwe muur verwijderen</button>
              </div>
            </>
          ) : (
            <div className="segment" role="group" aria-label="Toestand muur">
              {(["bestaand", "afbreken"] as MuurToestand[]).map((t) => (
                <button key={t} className={muurToestand(m) === t ? "actief" : ""} aria-pressed={muurToestand(m) === t} onClick={() => props.wijzig((x) => zetMuurToestand(x, m.id, t))}>{TOESTAND_NAAM[t]}</button>
              ))}
            </div>
          )}
          {m.dragend !== "niet-dragend" && muurToestand(m) === "afbreken" && <p className="gas-waarschuwing">Deze muur is {m.dragend === "bevestigd" ? "dragend" : "mogelijk dragend"}: stabiliteitsstudie door een ingenieur nodig.</p>}
          {v.openingen.filter((o) => o.muurId === m.id).map((o) => (
            <div key={o.id} className="rij opening-toestand">
              <span>{o.soort} {o.breedte} × {o.hoogte}</span>
              <select value={openingToestand(o)} onChange={(e) => props.wijzig((x) => zetOpeningToestand(x, o.id, e.target.value as OpeningToestand))} aria-label={`Toestand ${o.soort} ${o.breedte}`}>
                {(["bestaand", "nieuw", "dicht"] as OpeningToestand[]).map((t) => <option key={t} value={t}>{OPENING_NAAM[t]}</option>)}
              </select>
            </div>
          ))}
          <div className="acties">
            <button onClick={() => props.nieuweOpening(m.id)}>Nieuwe opening in deze muur</button>
            <button onClick={() => props.zetMuurId(null)}>Klaar</button>
          </div>
        </div>
      ) : null}

      {w.length > 0 && (
        <>
          <h3>Aandachtspunten</h3>
          <ul className="aandachtspunten">{w.map((x, i) => <li key={i} className="let-op">{x.muurId ? <button className="link" onClick={() => props.zetMuurId(x.muurId!)}>{x.tekst}</button> : x.tekst}</li>)}</ul>
        </>
      )}

      <h3>Doorsneden</h3>
      {project.doorsneden.length === 0 ? <p className="uitleg">Nog geen snijlijn. Kies "Snijlijn doorsnede" boven het plan en tik twee punten.</p> : (
        <>
          <div className="soorten">
            {project.doorsneden.map((d) => (
              <span key={d.id} className="chip">
                <button className={gekozenSnede?.id === d.id ? "actief" : ""} onClick={() => zetSnede(d.id)}>{d.naam}</button>
                <button aria-label={`Doorsnede ${d.naam} verwijderen`} onClick={() => props.wijzigProject({ ...project, doorsneden: project.doorsneden.filter((x) => x.id !== d.id) })}>×</button>
              </span>
            ))}
          </div>
          {doorsnedeSvg && <div className="schema" dangerouslySetInnerHTML={{ __html: doorsnedeSvg }} />}
        </>
      )}

      <h3>Gevels</h3>
      <Veld label="Zijde">
        <select value={zijde} onChange={(e) => zetZijde(e.target.value as Zijde)}>
          {ZIJDEN.map((z) => <option key={z.zijde} value={z.zijde}>{z.naam}</option>)}
        </select>
      </Veld>
      <div className="schema" dangerouslySetInnerHTML={{ __html: aanzichtSvg }} />
      <p className="uitleg">Zonder dak, goot of buitenaanleg. Rood = nieuw, geel streepjes = af te breken.</p>
      <ArchitectSectie project={project} v={v} wijzig={props.wijzig} wijzigProject={props.wijzigProject} opmerking={props.opmerking} zetOpmerking={props.zetOpmerking} />
      <div className="acties">
        <button className="primair" onClick={props.exporteerPdf}>Ontwerp (PDF)</button>
        <button onClick={props.exporteerVergunning}>Vergunningsklare basis (PDF)</button>
      </div>
    </section>
  );
}

function ArchitectSectie({ project, v, wijzig, wijzigProject, opmerking, zetOpmerking }: {
  project: Project; v: Verdieping; wijzig: (f: (v: Verdieping) => Verdieping) => boolean; wijzigProject: (p: Project) => void;
  opmerking: string | null; zetOpmerking: (id: string | null) => void;
}) {
  const [perceel, zetPerceel] = useState({ breedte: "15000", diepte: "30000", voortuin: "6000", links: "2000" });
  const [meldingen, zetMeldingen] = useState<string[]>([]);
  const d = project.dak;
  const zetDak = (w: Partial<NonNullable<Project["dak"]>>) => wijzigProject({ ...project, dak: { soort: "zadel", helling: 35, nok: "x", overstek: 300, dikte: 300, ...d, ...w } });
  const afst = project.terrein ? afstandenTotGrenzen(project) : [];
  const vg = project.vergunning ?? {};
  const ops = project.opmerkingen.filter((o) => o.verdiepingId === v.id);
  return (
    <>
      <h3>Vergunningsklare basis</h3>
      <p className="uitleg">{ARCHITECT_DISCLAIMER}</p>
      <details>
        <summary>Dak {d ? `(${d.soort}${d.soort !== "plat" ? `, ${d.helling}°` : ""})` : "(geen)"}</summary>
        <div className="velden">
          <Veld label="Soort dak"><select value={d?.soort ?? ""} onChange={(e) => (e.target.value ? zetDak({ soort: e.target.value as "plat" | "zadel" | "lessenaar" }) : wijzigProject({ ...project, dak: undefined }))}><option value="">geen</option><option value="plat">plat</option><option value="zadel">zadeldak</option><option value="lessenaar">lessenaarsdak</option></select></Veld>
          {d && d.soort !== "plat" && <Veld label="Helling (°)"><input type="number" inputMode="numeric" min={1} max={75} value={d.helling} onChange={(e) => zetDak({ helling: Math.max(1, Math.min(75, +e.target.value || 1)) })} /></Veld>}
          {d && d.soort !== "plat" && <Veld label="Nok evenwijdig met"><select value={d.nok} onChange={(e) => zetDak({ nok: e.target.value as "x" | "y" })}><option value="x">voor- en achtergevel</option><option value="y">zijgevels</option></select></Veld>}
          {d && <Veld label="Overstek (mm)"><input type="number" inputMode="numeric" min={0} value={d.overstek} onChange={(e) => zetDak({ overstek: Math.max(0, Math.round(+e.target.value) || 0) })} /></Veld>}
          {d && <Veld label="Dakmateriaal"><input value={d.materiaal ?? ""} placeholder="bv. keramische pannen, EPDM" onChange={(e) => zetDak({ materiaal: e.target.value || undefined })} /></Veld>}
        </div>
        {d && <p className="uitleg">Nokhoogte: {((nokHoogte(project) ?? 0) / 1000).toFixed(2).replace(".", ",")} m t.o.v. ±0. Rechthoekige voetafdruk van de bovenste verdieping; zie doorsneden, gevels en 3D.</p>}
      </details>
      <details>
        <summary>Trappen op {v.naam} ({(v.trappen ?? []).length})</summary>
        {(v.trappen ?? []).map((t) => (
          <div key={t.id} className="punt-bewerken">
            <div className="velden">
              <Veld label="Treden (optreden)"><input type="number" min={2} max={30} value={t.treden} onChange={(e) => wijzig((x) => ({ ...x, trappen: x.trappen.map((y) => (y.id === t.id ? { ...y, treden: Math.max(2, Math.min(30, Math.round(+e.target.value) || 2)) } : y)) }))} /></Veld>
              <Veld label="Optrede (mm)"><input type="number" min={100} value={t.optrede} onChange={(e) => wijzig((x) => ({ ...x, trappen: x.trappen.map((y) => (y.id === t.id ? { ...y, optrede: Math.max(100, Math.round(+e.target.value) || 100) } : y)) }))} /></Veld>
              <Veld label="Aantrede (mm)"><input type="number" min={150} value={t.aantrede} onChange={(e) => wijzig((x) => ({ ...x, trappen: x.trappen.map((y) => (y.id === t.id ? { ...y, aantrede: Math.max(150, Math.round(+e.target.value) || 150) } : y)) }))} /></Veld>
              <Veld label="Breedte (mm)"><input type="number" min={500} value={t.breedte} onChange={(e) => wijzig((x) => ({ ...x, trappen: x.trappen.map((y) => (y.id === t.id ? { ...y, breedte: Math.max(500, Math.round(+e.target.value) || 500) } : y)) }))} /></Veld>
            </div>
            <ul className="aandachtspunten">{controleerTrap(project, v, t).map((o, i) => <li key={i} className={o.ernst === "let op" ? "let-op" : ""}>{o.tekst}</li>)}</ul>
            <button className="gevaar" onClick={() => wijzig((x) => ({ ...x, trappen: x.trappen.filter((y) => y.id !== t.id) }))}>Trap verwijderen</button>
          </div>
        ))}
        <p className="uitleg">Nieuwe trap: kies "Trap" boven het plan en tik twee punten.</p>
      </details>
      <details>
        <summary>Terrein en inplanting {project.terrein ? "" : "(niet ingevuld)"}</summary>
        <div className="velden">
          <Veld label="Perceel breedte (mm)"><input type="number" value={perceel.breedte} onChange={(e) => zetPerceel({ ...perceel, breedte: e.target.value })} /></Veld>
          <Veld label="Perceel diepte (mm)"><input type="number" value={perceel.diepte} onChange={(e) => zetPerceel({ ...perceel, diepte: e.target.value })} /></Veld>
          <Veld label="Voorgevel tot straat (mm)"><input type="number" value={perceel.voortuin} onChange={(e) => zetPerceel({ ...perceel, voortuin: e.target.value })} /></Veld>
          <Veld label="Linkergevel tot grens (mm)"><input type="number" value={perceel.links} onChange={(e) => zetPerceel({ ...perceel, links: e.target.value })} /></Veld>
        </div>
        <button onClick={() => wijzigProject({ ...project, terrein: { maaiveld: project.terrein?.maaiveld ?? 0, straat: project.terrein?.straat ?? project.adres?.straat, perceel: perceelRechthoek(project, +perceel.breedte || 10000, +perceel.diepte || 20000, +perceel.voortuin || 0, +perceel.links || 0) } })}>Perceel (rechthoek) instellen</button>
        {project.terrein && (
          <>
            <div className="velden">
              <Veld label="Maaiveld t.o.v. ±0 (mm)"><input type="number" value={project.terrein.maaiveld} onChange={(e) => wijzigProject({ ...project, terrein: { ...project.terrein!, maaiveld: Math.round(+e.target.value) || 0 } })} /></Veld>
              <Veld label="Straat"><input value={project.terrein.straat ?? ""} onChange={(e) => wijzigProject({ ...project, terrein: { ...project.terrein!, straat: e.target.value || undefined } })} /></Veld>
            </div>
            <p className="uitleg">Afstanden gebouw–grens: {afst.map((a, k) => `zijde ${k + 1}: ${(a / 1000).toFixed(2).replace(".", ",")} m`).join(" · ")}</p>
          </>
        )}
      </details>
      <details>
        <summary>Ruimtes nieuwe toestand {v.ruimtesNieuw ? `(${v.ruimtesNieuw.length} ruimtes)` : "(zelfde als bestaand)"}</summary>
        <p className="uitleg">Voegt ruimtes samen waar een muur afgebroken wordt en splitst een ruimte die een nieuwe muur van wand tot wand doorkruist. Daarna toont de meetstaat (keuze "nieuwe toestand") deze ruimtes.</p>
        <div className="acties">
          <button onClick={() => { const r = deelRuimtesIn(v); wijzig(() => r.verdieping); zetMeldingen(r.meldingen); }}>Ruimtes nieuwe toestand indelen</button>
          {v.ruimtesNieuw && <button onClick={() => wijzig((x) => ({ ...x, ruimtesNieuw: undefined }))}>Indeling wissen</button>}
        </div>
        {meldingen.length > 0 && <ul className="aandachtspunten">{meldingen.map((m) => <li key={m}>{m}</li>)}</ul>}
        {(v.ruimtesNieuw ?? []).map((r) => (
          <Veld key={r.id} label={`Naam (${(r.contour.length)} hoeken)`}>
            <input defaultValue={r.naam} key={r.id + r.naam} onBlur={(e) => e.target.value.trim() && wijzig((x) => ({ ...x, ruimtesNieuw: x.ruimtesNieuw?.map((y) => (y.id === r.id ? { ...y, naam: e.target.value.trim() } : y)) }))} />
          </Veld>
        ))}
      </details>
      <details>
        <summary>Gegevens vergunningsplan en gevelmaterialen</summary>
        <div className="velden">
          {(["bouwheer", "architect", "kadaster", "planNummer", "index"] as const).map((k) => (
            <Veld key={k} label={{ bouwheer: "Bouwheer", architect: "Architect", kadaster: "Kadaster (afdeling, sectie, perceel)", planNummer: "Plan nr.", index: "Index" }[k]}>
              <input value={vg[k] ?? ""} onChange={(e) => wijzigProject({ ...project, vergunning: { ...vg, [k]: e.target.value || undefined } })} />
            </Veld>
          ))}
          {ZIJDEN.map((z) => (
            <Veld key={z.zijde} label={`Gevelmateriaal ${z.naam.toLowerCase()}`}>
              <input value={project.gevelmaterialen?.[z.zijde] ?? ""} placeholder="bv. gevelsteen rood-bruin, crepi wit" onChange={(e) => wijzigProject({ ...project, gevelmaterialen: { ...project.gevelmaterialen, [z.zijde]: e.target.value } })} />
            </Veld>
          ))}
        </div>
      </details>
      <details open={ops.length > 0}>
        <summary>Opmerkingen op {v.naam} ({ops.length})</summary>
        <ol className="opmerkingen">
          {ops.map((o) => (
            <li key={o.id} className={o.id === opmerking ? "actief" : ""}>
              <button className="link" onClick={() => zetOpmerking(o.id)}>{o.tekst}</button> <span className="zacht">— {o.auteur ?? "?"}, {new Date(o.datum).toLocaleDateString("nl-BE")}</span>
              <label className="vinkje"><input type="checkbox" checked={!!o.opgelost} onChange={(e) => wijzigProject({ ...project, opmerkingen: project.opmerkingen.map((x) => (x.id === o.id ? { ...x, opgelost: e.target.checked } : x)) })} /> opgelost</label>
              <button aria-label="Opmerking verwijderen" onClick={() => wijzigProject({ ...project, opmerkingen: project.opmerkingen.filter((x) => x.id !== o.id) })}>×</button>
            </li>
          ))}
        </ol>
        <p className="uitleg">Opmerkingen zitten in het project: wie het project via de cloud of een deellink krijgt, ziet ze.</p>
      </details>
    </>
  );
}
