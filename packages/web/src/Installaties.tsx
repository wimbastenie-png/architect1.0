/**
 * Paneel "Installaties": soort kiezen en op het plan tikken; geselecteerd punt
 * aanpassen; kringen, eendraadschema, aandachtspunten en materiaallijst.
 */
import {
  aandachtspunten, eendraadschemaSVG, GAS_WAARSCHUWING, INSTALLATIE_DISCLAIMER, kringenVoorstel, materiaallijst,
  SOORTEN, soortDef, verwijderInstallatiepunt, wijzigInstallatiepunt,
  type Net, type Project, type Verdieping,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { Veld } from "./ui.tsx";

export const NETTEN: Array<{ net: Net; naam: string }> = [
  { net: "elektriciteit", naam: "Elektriciteit" },
  { net: "sanitair", naam: "Sanitair" },
  { net: "gas", naam: "Gas" },
];

export function InstallatiePaneel(props: {
  project: Project;
  v: Verdieping;
  net: Net;
  zetNet: (n: Net) => void;
  plaatsen: string | null;
  zetPlaatsen: (s: string | null) => void;
  geselecteerd: string | null;
  zetGeselecteerd: (id: string | null) => void;
  verplaatsen: boolean;
  zetVerplaatsen: (b: boolean) => void;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  exporteerPdf: () => void;
}) {
  const { project, v, net, plaatsen, geselecteerd } = props;
  const punt = v.installaties.find((x) => x.id === geselecteerd);
  const kringen = useMemo(() => kringenVoorstel(project), [project]);
  const ap = useMemo(() => aandachtspunten(project).filter((a) => a.net === net), [project, net]);
  const mat = useMemo(() => materiaallijst(project).filter((m) => m.net === net), [project, net]);
  const schema = useMemo(() => (net === "elektriciteit" && kringen.length ? eendraadschemaSVG(project) : ""), [project, net, kringen.length]);
  const [toonSchema, zetToonSchema] = useState(false);
  const metGas = net === "gas" || project.verdiepingen.some((x) => x.installaties.some((y) => y.net === "gas"));

  return (
    <section className="kaart installaties">
      <div className="kaart-kop"><h2>Installaties</h2></div>
      {metGas && <p className="gas-waarschuwing" role="alert"><strong>Gas.</strong> {GAS_WAARSCHUWING.replace(/^GAS: /, "")}</p>}
      <p className="uitleg">{INSTALLATIE_DISCLAIMER}</p>

      {punt ? (
        <div className="punt-bewerken">
          <h3>{soortDef(punt.soort)?.naam ?? punt.soort}</h3>
          <div className="rij">
            <Veld label="Hoogte boven vloer (mm)">
              <input type="number" inputMode="numeric" min={0} defaultValue={punt.hoogte} key={punt.id + punt.hoogte}
                onBlur={(e) => { const h = Math.round(+e.target.value); if (Number.isFinite(h) && h >= 0 && h !== punt.hoogte) props.wijzig((x) => wijzigInstallatiepunt(x, punt.id, { hoogte: h })); }} />
            </Veld>
            {punt.net === "elektriciteit" && punt.soort !== "verdeelbord" && (
              <Veld label="Vaste kring (leeg = automatisch)">
                <input defaultValue={punt.kring ?? ""} key={punt.id + (punt.kring ?? "")} placeholder="bv. K7"
                  onBlur={(e) => { const k = e.target.value.trim().toUpperCase(); if (k !== (punt.kring ?? "")) props.wijzig((x) => wijzigInstallatiepunt(x, punt.id, { kring: k })); }} />
              </Veld>
            )}
          </div>
          <Veld label="Opmerking">
            <input defaultValue={punt.opmerking ?? ""} key={punt.id + "o"} placeholder="bv. dubbel, IP44, op 1,20 m"
              onBlur={(e) => { const t = e.target.value.trim(); if (t !== (punt.opmerking ?? "")) props.wijzig((x) => wijzigInstallatiepunt(x, punt.id, { opmerking: t || undefined })); }} />
          </Veld>
          <div className="acties">
            <button className={props.verplaatsen ? "primair" : ""} onClick={() => props.zetVerplaatsen(!props.verplaatsen)}>{props.verplaatsen ? "Tik op de nieuwe plaats…" : "Verplaatsen"}</button>
            <button className="gevaar" onClick={() => { props.wijzig((x) => verwijderInstallatiepunt(x, punt.id)); props.zetGeselecteerd(null); }}>Verwijderen</button>
            <button onClick={() => props.zetGeselecteerd(null)}>Klaar</button>
          </div>
        </div>
      ) : (
        <p className="uitleg">Kies boven het plan wat je wil plaatsen en tik dan op het plan. Tik op een symbool om het aan te passen.</p>
      )}

      {net === "elektriciteit" && kringen.length > 0 && (
        <>
          <h3>Kringen (voorstel)</h3>
          <table className="tabel klein">
            <thead><tr><th>Kring</th><th>Omschrijving</th><th>Beveiliging</th><th>Kabel</th></tr></thead>
            <tbody>{kringen.map((k) => <tr key={k.code}><td>{k.code}</td><td>{k.omschrijving} <span className="zacht">({k.punten.length})</span></td><td>{k.differentieel} mA · C{k.automaat}</td><td>{String(k.kabel).replace(".", ",")} mm² · ±{String(k.kabelLengte).replace(".", ",")} m</td></tr>)}</tbody>
          </table>
          <button onClick={() => zetToonSchema(!toonSchema)}>{toonSchema ? "Eendraadschema verbergen" : "Eendraadschema tonen"}</button>
          {toonSchema && <div className="schema" dangerouslySetInnerHTML={{ __html: schema }} />}
        </>
      )}

      {ap.length > 0 && (
        <>
          <h3>Aandachtspunten</h3>
          <p className="uitleg">Geen keuring en geen oordeel "conform": na te kijken door een installateur of keurder.</p>
          <ul className="aandachtspunten">
            {ap.map((a, i) => (
              <li key={i} className={a.ernst === "let op" ? "let-op" : ""}>
                {a.puntId ? <button className="link" onClick={() => props.zetGeselecteerd(a.puntId!)}>{a.tekst}</button> : a.tekst}
              </li>
            ))}
          </ul>
        </>
      )}

      {mat.length > 0 && (
        <>
          <h3>Materiaallijst (schatting)</h3>
          <table className="tabel klein">
            <tbody>{mat.map((m, i) => <tr key={i}><td>{m.omschrijving}</td><td className="getal">{m.hoeveelheid} {m.eenheid}</td></tr>)}</tbody>
          </table>
        </>
      )}
      <div className="acties">
        <button className="primair" onClick={props.exporteerPdf}>Installaties (PDF)</button>
      </div>
    </section>
  );
}

/** Balk boven het plan: net en soort kiezen (dicht bij het plan, ook op de gsm). */
export function InstallatieBalk(props: { net: Net; zetNet: (n: Net) => void; plaatsen: string | null; zetPlaatsen: (s: string | null) => void }) {
  const { net, plaatsen } = props;
  return (
    <div className="installatie-balk">
      <div className="segment" role="tablist" aria-label="Net">
        {NETTEN.map((n) => (
          <button key={n.net} role="tab" aria-selected={net === n.net} className={net === n.net ? "actief" : ""} onClick={() => { props.zetNet(n.net); props.zetPlaatsen(null); }}>{n.naam}</button>
        ))}
      </div>
      <div className="soorten" role="toolbar" aria-label="Plaatsen">
        {SOORTEN.filter((x) => x.net === net).map((x) => (
          <button key={x.soort} className={plaatsen === x.soort ? "actief" : ""} aria-pressed={plaatsen === x.soort} onClick={() => props.zetPlaatsen(plaatsen === x.soort ? null : x.soort)}>
            <span className="code">{x.code}</span> {x.naam}
          </button>
        ))}
      </div>
      <p className="hint-kort">{plaatsen ? <>Tik op het plan om <strong>{soortDef(plaatsen)?.naam.toLowerCase()}</strong> te plaatsen (meermaals kan). Tik de knop opnieuw om te stoppen.</> : "Kies wat je wil plaatsen, of tik op een symbool in het plan."}</p>
    </div>
  );
}
