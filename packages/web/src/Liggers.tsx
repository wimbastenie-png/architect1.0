/**
 * Voordimensionering stalen liggers: invoer, lasten met hulpjes, resultaat en rekennota.
 */
import {
  GEBRUIK_WONING, LIGGER_DISCLAIMER, muurLast, nieuweLigger, rekenLigger, SNEEUW, vloerLast, VLOERTYPES, VOLUMEGEWICHT,
  type Last, type LiggerInvoer, type Project,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { Veld } from "./ui.tsx";

const g2 = (x: number, d = 2) => x.toFixed(d).replace(".", ",");

export function LiggerPaneel(props: {
  project: Project;
  wijzigProject: (p: Project) => void;
  /** Voorstel uit het plan (aangeklikte opening of muur). */
  voorstel: { dagmaat: number; dikte: number; muurId?: string; tekst: string } | null;
  exporteerPdf: (l: LiggerInvoer[]) => void;
}) {
  const { project } = props;
  const [actief, zetActief] = useState<string | null>(project.liggers[0]?.id ?? null);
  const l = project.liggers.find((x) => x.id === actief) ?? null;
  const zet = (n: LiggerInvoer) => props.wijzigProject({ ...project, liggers: project.liggers.map((x) => (x.id === n.id ? n : x)) });
  const nieuw = () => {
    const v = props.voorstel;
    const id = `l-${Date.now().toString(36)}`;
    const n = { ...nieuweLigger(id, v?.dagmaat ?? 2000, v?.dikte ?? 300), naam: `Ligger ${project.liggers.length + 1}`, muurId: v?.muurId };
    props.wijzigProject({ ...project, liggers: [...project.liggers, n] });
    zetActief(id);
  };
  const r = useMemo(() => (l ? rekenLigger(l) : null), [l]);

  return (
    <section className="kaart liggers">
      <div className="kaart-kop"><h2>Stalen liggers</h2></div>
      <p className="gas-waarschuwing" role="note"><strong>Voordimensionering.</strong> {LIGGER_DISCLAIMER.replace(/^VOORDIMENSIONERING — /, "")}</p>
      <div className="soorten">
        {project.liggers.map((x) => <button key={x.id} className={x.id === actief ? "actief" : ""} onClick={() => zetActief(x.id)}>{x.naam}</button>)}
        <button onClick={nieuw}>+ Nieuwe ligger{props.voorstel ? ` (${props.voorstel.tekst})` : ""}</button>
      </div>
      {!props.voorstel && <p className="uitleg">Tip: tik eerst in het plan een raam, deur of muur aan: dan neemt de nieuwe ligger de breedte en muurdikte over.</p>}
      {l && r && (
        <>
          <div className="velden">
            <Veld label="Naam"><input value={l.naam} onChange={(e) => zet({ ...l, naam: e.target.value })} /></Veld>
            <Veld label="Dagmaat opening (mm)"><input type="number" inputMode="numeric" min={100} value={l.dagmaat} onChange={(e) => zet({ ...l, dagmaat: Math.max(100, Math.round(+e.target.value) || 100) })} /></Veld>
            <Veld label="Opleglengte per kant (mm)"><input type="number" inputMode="numeric" min={50} value={l.oplegging} onChange={(e) => zet({ ...l, oplegging: Math.max(50, Math.round(+e.target.value) || 50) })} /></Veld>
            <Veld label="Staal">
              <select value={l.staal} onChange={(e) => zet({ ...l, staal: e.target.value as LiggerInvoer["staal"] })}><option>S235</option><option>S355</option></select>
            </Veld>
            <Veld label="Profielen naast elkaar">
              <select value={l.aantal} onChange={(e) => zet({ ...l, aantal: +e.target.value })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </Veld>
            <Veld label="Doorbuiging max.">
              <select value={l.doorbuiging} onChange={(e) => zet({ ...l, doorbuiging: +e.target.value })}><option value={500}>L/500 (draagt metselwerk)</option><option value={300}>L/300</option></select>
            </Veld>
          </div>
          <label className="vinkje"><input type="checkbox" checked={l.kipVerhinderd} onChange={(e) => zet({ ...l, kipVerhinderd: e.target.checked })} /> Kip verhinderd (bovenflens gesteund door metselwerk of vloer — door de ingenieur te bevestigen)</label>

          <h3>Lasten op de ligger (karakteristiek, kN/m)</h3>
          <table className="tabel klein lasten">
            <tbody>
              {l.lasten.map((x, i) => (
                <tr key={i}>
                  <td><input value={x.omschrijving} aria-label="Omschrijving last" onChange={(e) => zet({ ...l, lasten: l.lasten.map((y, j) => (j === i ? { ...y, omschrijving: e.target.value } : y)) })} /></td>
                  <td><select value={x.soort} aria-label="Soort last" onChange={(e) => zet({ ...l, lasten: l.lasten.map((y, j) => (j === i ? { ...y, soort: e.target.value as Last["soort"] } : y)) })}><option value="G">G permanent</option><option value="Q">Q gebruik</option><option value="S">S sneeuw</option></select></td>
                  <td><input type="number" inputMode="decimal" step="0.1" min={0} value={x.waarde} aria-label="Waarde kN/m" onChange={(e) => zet({ ...l, lasten: l.lasten.map((y, j) => (j === i ? { ...y, waarde: Math.max(0, +e.target.value || 0) } : y)) })} /></td>
                  <td><button aria-label="Last verwijderen" onClick={() => zet({ ...l, lasten: l.lasten.filter((_, j) => j !== i) })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <LastHulp voegToe={(xs) => zet({ ...l, lasten: [...l.lasten, ...xs] })} dikte={props.voorstel?.dikte ?? 300} />

          <h3>Resultaat</h3>
          {r.keuze ? (
            <div className="ligger-keuze">
              <div className="groot">{l.aantal > 1 ? `${l.aantal} × ` : ""}{r.keuze.profiel.naam} <span className="zacht">{l.staal}</span></div>
              <div className="zacht">L = {r.L} mm · q<sub>d</sub> = {g2(r.qd)} kN/m ({r.combinatie}) · q<sub>k</sub> = {g2(r.qk)} kN/m</div>
              <table className="tabel klein">
                <thead><tr><th>Controle</th><th className="getal">Ed</th><th className="getal">Rd</th><th>Benutting</th></tr></thead>
                <tbody>{r.keuze.controles.map((c) => (
                  <tr key={c.naam}><td>{c.naam}</td><td className="getal">{g2(c.ed)} {c.eenheid}</td><td className="getal">{g2(c.rd)} {c.eenheid}</td>
                    <td><div className="uc"><div style={{ width: `${Math.min(100, c.uc * 100)}%` }} className={c.uc > 1 ? "te-hoog" : c.uc > 0.9 ? "krap" : ""} /></div> {Math.round(c.uc * 100)} %</td></tr>
                ))}</tbody>
              </table>
              <p className="uitleg">Alternatieven: {Object.values(r.perReeks).filter((x) => x && x.profiel.naam !== r.keuze!.profiel.naam).map((x) => `${x!.profiel.naam} (${Math.round(x!.ucMax * 100)} %)`).join(", ") || "–"}</p>
            </div>
          ) : <p className="melding" role="alert">Geen enkel profiel uit de tabel voldoet.</p>}
          <p className="uitleg">Oplegreactie per kant: G<sub>k</sub> {g2(r.reactie.gk)} kN, Q<sub>k</sub> {g2(r.reactie.qk)} kN, R<sub>d</sub> {g2(r.reactie.ed)} kN. {r.opleg.advies}</p>
          {r.waarschuwingen.length > 0 && <ul className="aandachtspunten">{r.waarschuwingen.map((w) => <li key={w} className="let-op">{w}</li>)}</ul>}
          <div className="acties">
            <button className="primair" onClick={() => props.exporteerPdf(project.liggers)}>Rekennota (PDF)</button>
            <button className="gevaar" onClick={() => { props.wijzigProject({ ...project, liggers: project.liggers.filter((x) => x.id !== l.id) }); zetActief(null); }}>Ligger verwijderen</button>
          </div>
        </>
      )}
    </section>
  );
}

function LastHulp({ voegToe, dikte }: { voegToe: (l: Last[]) => void; dikte: number }) {
  const [soort, zetSoort] = useState<"muur" | "vloer" | "dak">("muur");
  const [m, zetM] = useState({ hoogte: "2500", dikte: String(dikte), mat: "0" });
  const [v, zetV] = useState({ type: "0", breedte: "2000", gebruik: true });
  const [d, zetD] = useState({ type: "4", breedte: "2000" });
  return (
    <details className="last-hulp">
      <summary>Last toevoegen met hulp</summary>
      <div className="segment">
        {(["muur", "vloer", "dak"] as const).map((x) => <button key={x} className={soort === x ? "actief" : ""} onClick={() => zetSoort(x)}>{x === "muur" ? "Muur erboven" : x === "vloer" ? "Vloer" : "Dak"}</button>)}
      </div>
      {soort === "muur" && (
        <div className="velden">
          <Veld label="Hoogte muur boven ligger (mm)"><input type="number" value={m.hoogte} onChange={(e) => zetM({ ...m, hoogte: e.target.value })} /></Veld>
          <Veld label="Dikte (mm)"><input type="number" value={m.dikte} onChange={(e) => zetM({ ...m, dikte: e.target.value })} /></Veld>
          <Veld label="Materiaal"><select value={m.mat} onChange={(e) => zetM({ ...m, mat: e.target.value })}>{VOLUMEGEWICHT.map((x, i) => <option key={x.naam} value={i}>{x.naam} ({x.gamma} kN/m³)</option>)}</select></Veld>
          <button onClick={() => { const x = VOLUMEGEWICHT[+m.mat]!; voegToe([{ omschrijving: `Muur erboven: ${g2(+m.hoogte / 1000)} m × ${m.dikte} mm ${x.naam.toLowerCase()} (${x.gamma} kN/m³)`, soort: "G", waarde: muurLast(+m.hoogte, +m.dikte, x.gamma) }]); }}>Toevoegen</button>
        </div>
      )}
      {soort === "vloer" && (
        <div className="velden">
          <Veld label="Vloer"><select value={v.type} onChange={(e) => zetV({ ...v, type: e.target.value })}>{VLOERTYPES.slice(0, 3).map((x, i) => <option key={x.naam} value={i}>{x.naam} ({g2(x.g, 1)} kN/m²)</option>)}</select></Veld>
          <Veld label="Invloedsbreedte (mm) — halve overspanning van de vloer"><input type="number" value={v.breedte} onChange={(e) => zetV({ ...v, breedte: e.target.value })} /></Veld>
          <label className="vinkje"><input type="checkbox" checked={v.gebruik} onChange={(e) => zetV({ ...v, gebruik: e.target.checked })} /> Gebruikslast woning {g2(GEBRUIK_WONING, 1)} kN/m²</label>
          <button onClick={() => { const x = VLOERTYPES[+v.type]!; const b = +v.breedte; voegToe([{ omschrijving: `${x.naam}, invloed ${g2(b / 1000)} m`, soort: "G", waarde: vloerLast(b, x.g) }, ...(v.gebruik ? [{ omschrijving: `Gebruik woning ${g2(GEBRUIK_WONING, 1)} kN/m² × ${g2(b / 1000)} m`, soort: "Q" as const, waarde: vloerLast(b, GEBRUIK_WONING) }] : [])]); }}>Toevoegen</button>
        </div>
      )}
      {soort === "dak" && (
        <div className="velden">
          <Veld label="Dak"><select value={d.type} onChange={(e) => zetD({ ...d, type: e.target.value })}>{VLOERTYPES.map((x, i) => i >= 3 ? <option key={x.naam} value={i}>{x.naam} ({g2(x.g, 1)} kN/m²)</option> : null)}</select></Veld>
          <Veld label="Invloedsbreedte (mm)"><input type="number" value={d.breedte} onChange={(e) => zetD({ ...d, breedte: e.target.value })} /></Veld>
          <button onClick={() => { const x = VLOERTYPES[+d.type]!; const b = +d.breedte; voegToe([{ omschrijving: `${x.naam}, invloed ${g2(b / 1000)} m`, soort: "G", waarde: vloerLast(b, x.g) }, { omschrijving: `Sneeuw ${g2(SNEEUW, 1)} kN/m² × ${g2(b / 1000)} m`, soort: "S", waarde: vloerLast(b, SNEEUW) }]); }}>Toevoegen</button>
        </div>
      )}
      <p className="uitleg">Richtwaarden; na te kijken door de ingenieur (bv. sneeuw hoger in de Ardennen, scheidingswanden, dakhelling).</p>
    </details>
  );
}
