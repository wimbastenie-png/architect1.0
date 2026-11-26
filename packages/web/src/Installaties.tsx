/**
 * Paneel "Installaties": soort kiezen en op het plan tikken; geselecteerd punt
 * aanpassen; kringen, eendraadschema, aandachtspunten en materiaallijst.
 */
import {
  opwekking, U_AANNAME, VERWARMING_DISCLAIMER, warmteverlies, zonnepanelen,
  FUNCTIES, SYSTEMEN, systeemVan, ventilatieAandachtspunten, ventilatieDebieten, ventilatieMateriaal, VENTILATIE_DISCLAIMER,
  type Functie, type Systeem,
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
  { net: "ventilatie", naam: "Ventilatie" },
  { net: "verwarming", naam: "Verwarming" },
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
  wijzigProject: (p: Project) => void;
}) {
  const { project, v, net, plaatsen, geselecteerd } = props;
  const punt = v.installaties.find((x) => x.id === geselecteerd);
  const kringen = useMemo(() => kringenVoorstel(project), [project]);
  const ap = useMemo(() => (net === "ventilatie" ? ventilatieAandachtspunten(project).map((a) => ({ ...a, net, puntId: undefined as string | undefined })) : aandachtspunten(project).filter((a) => a.net === net)), [project, net]);
  const mat = useMemo(() => (net === "ventilatie" ? ventilatieMateriaal(project) : materiaallijst(project).filter((m) => m.net === net)), [project, net]);
  const deb = useMemo(() => (net === "ventilatie" ? ventilatieDebieten(project).filter((d) => d.verdieping === v.naam) : []), [project, net, v.naam]);
  const schema = useMemo(() => (net === "elektriciteit" && kringen.length ? eendraadschemaSVG(project) : ""), [project, net, kringen.length]);
  const [toonSchema, zetToonSchema] = useState(false);
  const metGas = net === "gas" || project.verdiepingen.some((x) => x.installaties.some((y) => y.net === "gas"));

  return (
    <section className="kaart installaties">
      <div className="kaart-kop"><h2>Installaties</h2></div>
      {metGas && <p className="gas-waarschuwing" role="alert"><strong>Gas.</strong> {GAS_WAARSCHUWING.replace(/^GAS: /, "")}</p>}
      <p className="uitleg">{net === "ventilatie" ? VENTILATIE_DISCLAIMER : INSTALLATIE_DISCLAIMER}</p>
      {net === "verwarming" && <VerwarmingSectie project={project} wijzigProject={props.wijzigProject} />}
      {net === "ventilatie" && (
        <>
          <Veld label="Systeem">
            <select value={systeemVan(project)} onChange={(e) => props.wijzigProject({ ...project, ventilatie: { systeem: e.target.value as Systeem } })}>
              {SYSTEMEN.map((x) => <option key={x.systeem} value={x.systeem}>{x.naam}</option>)}
            </select>
          </Veld>
          <h3>Debieten {v.naam}</h3>
          <table className="tabel klein">
            <thead><tr><th>Ruimte</th><th>Functie</th><th className="getal">Toevoer</th><th className="getal">Afvoer</th></tr></thead>
            <tbody>{deb.map((d) => (
              <tr key={d.ruimte.id}>
                <td>{d.ruimte.naam} <span className="zacht">{String(d.oppervlakte).replace(".", ",")} m²</span></td>
                <td>
                  <select aria-label={`Functie ${d.ruimte.naam}`} value={d.functie} onChange={(e) => props.wijzig((x) => ({ ...x, ruimtes: x.ruimtes.map((r) => (r.id === d.ruimte.id ? { ...r, functie: e.target.value as Functie } : r)) }))}>
                    {FUNCTIES.map((f) => <option key={f.functie} value={f.functie}>{f.naam}</option>)}
                  </select>
                </td>
                <td className="getal">{d.toevoer ? `${d.toevoer} m³/h` : "–"}</td>
                <td className="getal">{d.afvoer ? `${d.afvoer} m³/h` : "–"}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}

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

function VerwarmingSectie({ project, wijzigProject }: { project: Project; wijzigProject: (p: Project) => void }) {
  const w = project.verwarming ?? { buitentemperatuur: -7, afgifte: {}, regime: "45/35" as const, zonnepanelen: false };
  const zet = (x: Partial<typeof w>) => wijzigProject({ ...project, verwarming: { ...w, ...x } });
  const verlies = useMemo(() => warmteverlies(project), [project]);
  const op = useMemo(() => opwekking(project), [project]);
  const pv = useMemo(() => zonnepanelen(project), [project]);
  const aannames = verlies.some((r) => r.aannames > 0);
  return (
    <>
      <p className="gas-waarschuwing" role="note">{VERWARMING_DISCLAIMER}</p>
      <div className="velden">
        <Veld label="Ontwerpbuitentemperatuur (°C)"><input type="number" value={w.buitentemperatuur} onChange={(e) => zet({ buitentemperatuur: +e.target.value })} /></Veld>
        <Veld label="Temperatuurregime"><select value={w.regime} onChange={(e) => zet({ regime: e.target.value as typeof w.regime })}><option value="45/35">45/35 (warmtepomp)</option><option value="55/45">55/45</option><option value="75/65">75/65 (ketel)</option></select></Veld>
      </div>
      <h3>Warmteverlies per ruimte</h3>
      <table className="tabel klein">
        <thead><tr><th>Ruimte</th><th className="getal">θ</th><th className="getal">Φ (W)</th><th className="getal">W/m²</th><th>Afgifte</th><th className="getal">Radiator ΔT50</th></tr></thead>
        <tbody>{verlies.map((r) => (
          <tr key={r.ruimte.id} title={r.opmerking}>
            <td>{r.ruimte.naam}{r.aannames ? " *" : ""} <span className="zacht">{r.verdieping}</span></td>
            <td className="getal">{r.binnen}°</td>
            <td className="getal">{r.totaal}</td>
            <td className="getal">{r.perM2}</td>
            <td><select aria-label={`Afgifte ${r.ruimte.naam}`} value={r.afgifte} onChange={(e) => zet({ afgifte: { ...w.afgifte, [r.ruimte.id]: e.target.value as "radiator" | "vloer" } })}><option value="radiator">radiator</option><option value="vloer">vloer</option></select></td>
            <td className="getal">{r.afgifte === "radiator" ? `${r.radiatorNominaal} W` : "–"}</td>
          </tr>
        ))}</tbody>
      </table>
      {aannames && <p className="uitleg">* U-waarde niet ingevuld (bij Energie): aangenomen ongeïsoleerd (muur {String(U_AANNAME.muur).replace(".", ",")}, raam {String(U_AANNAME.raam).replace(".", ",")}, vloer {String(U_AANNAME.vloer).replace(".", ",")}, dak {String(U_AANNAME.dak).replace(".", ",")} W/m²K). Vul de samenstelling in voor een betere raming.</p>}
      {verlies.filter((r) => r.opmerking).map((r) => <p key={r.ruimte.id} className="uitleg">{r.ruimte.naam}: {r.opmerking}</p>)}
      <h3>Warmtepomp en buffervat</h3>
      <p>Totaal warmteverlies: <strong>{(op.totaal / 1000).toFixed(1).replace(".", ",")} kW</strong></p>
      <ul className="aandachtspunten">{op.opmerkingen.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="uitleg">Plaats de warmtepomp (binnen- en buitendeel), het buffervat en de radiatoren of collector op het plan met de knoppen hierboven.</p>
      <h3>Zonnepanelen</h3>
      {pv.length ? (
        <table className="tabel klein">
          <thead><tr><th>Dakvlak</th><th>Richting</th><th className="getal">Panelen</th><th className="getal">kWp</th><th className="getal">kWh/jaar</th></tr></thead>
          <tbody>{pv.map((x) => <tr key={x.naam}><td>{x.naam} <span className="zacht">{x.helling}°</span></td><td>{x.richting}</td><td className="getal">{x.panelen}</td><td className="getal">{String(x.kWp).replace(".", ",")}</td><td className="getal">± {x.opbrengst}</td></tr>)}</tbody>
        </table>
      ) : <p className="uitleg">Stel eerst een dak in (Ontwerp → Dak).</p>}
      <p className="uitleg klein">Panelen 1134 × 1722 mm (420 Wp), 50 cm rand. Opbrengst indicatief (± 15 %) voor België; voor een raming: PVGIS. Schaduw, dakvensters en schoorstenen niet meegerekend.</p>
    </>
  );
}
