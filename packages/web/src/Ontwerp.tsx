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
import { Veld } from "./ui.tsx";

export type OntwerpGereedschap = "kies" | "muur" | "snede";
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
        {g === "muur" && (
          <label className="inline-veld">dikte <input type="number" inputMode="numeric" min={50} step={10} value={props.dikte} onChange={(e) => props.zetDikte(e.target.value)} aria-label="Dikte nieuwe muur (mm)" /> mm</label>
        )}
      </div>
      <p className="hint-kort">
        {g === "muur" ? (props.eerstePunt ? "Tik het eindpunt van de nieuwe muur." : "Tik het beginpunt van de nieuwe muur (dicht bij een muur: sluit aan op het muurvlak; bijna recht: wordt haaks).")
          : g === "snede" ? (props.eerstePunt ? "Tik het tweede punt van de snijlijn." : "Tik twee punten: de snijlijn voor een doorsnede (over alle verdiepingen).")
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
      <div className="acties">
        <button className="primair" onClick={props.exporteerPdf}>Ontwerp (PDF)</button>
      </div>
    </section>
  );
}
