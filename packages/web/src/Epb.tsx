/**
 * Energie (EPC/EPB-inventaris): noordpijl, samenstelling per muur/vloer/dak,
 * ramen, beschermd volume, bewijsfoto's, invoerlijst per richting.
 */
import {
  EPB_DISCLAIMER, epbInventaris, GLAS, LAAG_MATERIALEN, muurGrens, muurOmschrijving, SCHRIJNWERK, uRaam, uWaarde,
  type Grens, type Opening, type Plaats, type Project, type Samenstelling, type Verdieping,
} from "@scanapp/core";
import { useMemo } from "react";
import { FotoVeld } from "./Fotos.tsx";
import { Veld } from "./ui.tsx";

export type EpbSelectie = { soort: "muur" | "opening" | "ruimte"; id: string } | null;

const GRENZEN: Array<[Grens, string]> = [["buiten", "buitenlucht"], ["grond", "grond"], ["onverwarmd", "onverwarmde ruimte"], ["buren", "buren (verwarmd)"], ["binnen", "binnen het beschermd volume"]];
const g = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "–" : x.toFixed(d).replace(".", ","));

export function EpbBalk({ noord, zetNoord }: { noord: number; zetNoord: (n: number) => void }) {
  return (
    <div className="installatie-balk">
      <div className="soorten" role="group" aria-label="Noordpijl">
        <span className="inline-veld">Noorden <input type="number" inputMode="numeric" aria-label="Noorden (graden)" value={noord} onChange={(e) => zetNoord(((Math.round(+e.target.value) % 360) + 360) % 360)} /> °</span>
        <button onClick={() => zetNoord((noord + 345) % 360)} aria-label="Noordpijl 15 graden naar links">↺ 15°</button>
        <button onClick={() => zetNoord((noord + 15) % 360)} aria-label="Noordpijl 15 graden naar rechts">↻ 15°</button>
      </div>
      <p className="hint-kort">Draai de noordpijl tot ze klopt met de werkelijkheid (kompas op de gsm). Tik een muur, raam of ruimte aan. Groen = ingevuld, oranje = nog in te vullen.</p>
    </div>
  );
}

function SamenstellingEditor({ s, plaats, zet, standaardGrens }: { s: Samenstelling | undefined; plaats: Plaats; zet: (s: Samenstelling) => void; standaardGrens: Grens }) {
  const huidig: Samenstelling = s ?? { lagen: [], fotos: [] };
  const u = uWaarde(huidig, plaats);
  return (
    <div className="samenstelling">
      <Veld label="Grenst aan">
        <select value={huidig.grens ?? standaardGrens} onChange={(e) => zet({ ...huidig, grens: e.target.value as Grens })}>
          {GRENZEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </Veld>
      <p className="uitleg">Lagen van binnen naar buiten. λ is een richtwaarde; vervang ze door de waarde van de fiche als je die kent.</p>
      <table className="tabel klein lasten">
        <thead><tr><th>Laag</th><th>mm</th><th>λ / R</th><th /></tr></thead>
        <tbody>
          {huidig.lagen.map((l, i) => (
            <tr key={i}>
              <td>
                <select aria-label={`Laag ${i + 1}`} value={l.materiaal} onChange={(e) => { const m = LAAG_MATERIALEN.find((x) => x.naam === e.target.value)!; zet({ ...huidig, lagen: huidig.lagen.map((y, j) => (j === i ? { materiaal: m.naam, dikte: y.dikte, lambda: m.lambda, r: m.r } : y)) }); }}>
                  {LAAG_MATERIALEN.map((m) => <option key={m.naam}>{m.naam}</option>)}
                </select>
              </td>
              <td><input type="number" inputMode="numeric" min={1} aria-label={`Dikte laag ${i + 1} (mm)`} value={l.dikte} onChange={(e) => zet({ ...huidig, lagen: huidig.lagen.map((y, j) => (j === i ? { ...y, dikte: Math.max(1, Math.round(+e.target.value) || 1) } : y)) })} /></td>
              <td>{l.r !== undefined ? `R ${g(l.r)}` : <input type="number" inputMode="decimal" step="0.001" min={0.001} aria-label={`Lambda laag ${i + 1}`} value={l.lambda ?? ""} onChange={(e) => zet({ ...huidig, lagen: huidig.lagen.map((y, j) => (j === i ? { ...y, lambda: Math.max(0.001, +e.target.value || 0.001) } : y)) })} />}</td>
              <td><button aria-label={`Laag ${i + 1} verwijderen`} onClick={() => zet({ ...huidig, lagen: huidig.lagen.filter((_, j) => j !== i) })}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => zet({ ...huidig, lagen: [...huidig.lagen, { materiaal: LAAG_MATERIALEN[3]!.naam, dikte: 140, lambda: LAAG_MATERIALEN[3]!.lambda }] })}>+ Laag</button>
      <div className="rij">
        <Veld label="U-waarde zelf ingeven (W/m²K)">
          <input type="number" inputMode="decimal" step="0.01" min={0.01} value={huidig.uIngegeven ?? ""} placeholder="leeg = berekend" onChange={(e) => zet({ ...huidig, uIngegeven: e.target.value === "" ? undefined : Math.max(0.01, +e.target.value) })} />
        </Veld>
        <Veld label="Bron">
          <input value={huidig.bron ?? ""} placeholder="bv. vaststelling, factuur, fiche" onChange={(e) => zet({ ...huidig, bron: e.target.value || undefined })} />
        </Veld>
      </div>
      <p className="u-waarde">U = <strong>{g(u.u, 3)}</strong> W/m²K <span className="zacht">({u.herkomst})</span></p>
      <FotoVeld ids={huidig.fotos} voegToe={(id) => zet({ ...huidig, fotos: [...huidig.fotos, id] })} verwijder={(id) => zet({ ...huidig, fotos: huidig.fotos.filter((x) => x !== id) })} label="Bewijsfoto nemen" />
    </div>
  );
}

function RaamEditor({ o, zet }: { o: Opening; zet: (e: NonNullable<Opening["epb"]>) => void }) {
  const e = o.epb ?? { fotos: [] };
  return (
    <div className="samenstelling">
      <div className="rij">
        <Veld label="Glas">
          <select value={e.glas ?? ""} onChange={(x) => { const gl = GLAS.find((y) => y.naam === x.target.value); zet({ ...e, glas: gl?.naam, ug: gl?.ug ?? e.ug }); }}>
            <option value="">— kies —</option>{GLAS.map((x) => <option key={x.naam}>{x.naam}</option>)}
          </select>
        </Veld>
        <Veld label="Ug (W/m²K)"><input type="number" inputMode="decimal" step="0.1" min={0.1} value={e.ug ?? ""} onChange={(x) => zet({ ...e, ug: x.target.value === "" ? undefined : +x.target.value })} /></Veld>
      </div>
      <div className="rij">
        <Veld label="Schrijnwerk">
          <select value={e.schrijnwerk ?? ""} onChange={(x) => { const s = SCHRIJNWERK.find((y) => y.naam === x.target.value); zet({ ...e, schrijnwerk: s?.naam, uf: s?.uf ?? e.uf }); }}>
            <option value="">— kies —</option>{SCHRIJNWERK.map((x) => <option key={x.naam}>{x.naam}</option>)}
          </select>
        </Veld>
        <Veld label="Uf (W/m²K)"><input type="number" inputMode="decimal" step="0.1" min={0.1} value={e.uf ?? ""} onChange={(x) => zet({ ...e, uf: x.target.value === "" ? undefined : +x.target.value })} /></Veld>
      </div>
      <div className="rij">
        <Veld label="Zonwering">
          <select value={e.zonwering ?? "geen"} onChange={(x) => zet({ ...e, zonwering: x.target.value as NonNullable<Opening["epb"]>["zonwering"] })}>
            {["geen", "binnen", "screen", "rolluik", "buitenjaloezie", "overstek"].map((z) => <option key={z}>{z}</option>)}
          </select>
        </Veld>
        <Veld label="Uw zelf ingeven"><input type="number" inputMode="decimal" step="0.1" min={0.1} value={e.uw ?? ""} placeholder="leeg = berekend" onChange={(x) => zet({ ...e, uw: x.target.value === "" ? undefined : +x.target.value })} /></Veld>
      </div>
      <Veld label="Bron"><input value={e.bron ?? ""} placeholder="bv. stempel in de spouw, factuur" onChange={(x) => zet({ ...e, bron: x.target.value || undefined })} /></Veld>
      <p className="u-waarde">Uw ≈ <strong>{g(uRaam({ ...o, epb: e }))}</strong> W/m²K <span className="zacht">(0,7·Ug + 0,3·Uf, zonder randverlies)</span></p>
      <FotoVeld ids={e.fotos} voegToe={(id) => zet({ ...e, fotos: [...e.fotos, id] })} verwijder={(id) => zet({ ...e, fotos: e.fotos.filter((x) => x !== id) })} label="Bewijsfoto nemen" />
    </div>
  );
}

export function EpbPaneel(props: {
  project: Project; v: Verdieping; sel: EpbSelectie; zetSel: (s: EpbSelectie) => void;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  exporteer: (soort: "epb-pdf" | "epb-csv") => void;
}) {
  const { project, v, sel } = props;
  const inv = useMemo(() => epbInventaris(project), [project]);
  const m = sel?.soort === "muur" ? v.muren.find((x) => x.id === sel.id) : undefined;
  const o = sel?.soort === "opening" ? v.openingen.find((x) => x.id === sel.id) : undefined;
  const r = sel?.soort === "ruimte" ? v.ruimtes.find((x) => x.id === sel.id) : undefined;
  return (
    <section className="kaart epb">
      <div className="kaart-kop"><h2>Energie (EPC/EPB)</h2>{sel && <button onClick={() => props.zetSel(null)} aria-label="Sluiten">×</button>}</div>
      <p className="gas-waarschuwing" role="note">{EPB_DISCLAIMER}</p>
      {m && (
        <>
          <h3>{muurOmschrijving(v, m.id).split(" · ")[0]}</h3>
          <SamenstellingEditor s={m.epb} plaats="muur" standaardGrens={muurGrens(m, v)} zet={(s) => props.wijzig((x) => ({ ...x, muren: x.muren.map((y) => (y.id === m.id ? { ...y, epb: s } : y)) }))} />
        </>
      )}
      {o && (
        <>
          <h3>{o.soort === "raam" ? "Raam" : o.soort === "deur" ? "Deur" : "Doorgang"} {o.breedte} × {o.hoogte}</h3>
          <RaamEditor o={o} zet={(e) => props.wijzig((x) => ({ ...x, openingen: x.openingen.map((y) => (y.id === o.id ? { ...y, epb: e } : y)) }))} />
        </>
      )}
      {r && (
        <>
          <h3>{r.naam}</h3>
          <label className="vinkje"><input type="checkbox" checked={r.beschermd !== false} onChange={(e) => props.wijzig((x) => ({ ...x, ruimtes: x.ruimtes.map((y) => (y.id === r.id ? { ...y, beschermd: e.target.checked ? undefined : false } : y)) }))} /> Binnen het beschermd volume (verwarmd)</label>
          <h3>Vloer van {v.naam}</h3>
          <SamenstellingEditor s={v.epb?.vloer} plaats="vloer" standaardGrens={project.verdiepingen.some((x) => x.peil < v.peil) ? "onverwarmd" : "grond"} zet={(s) => props.wijzig((x) => ({ ...x, epb: { ...x.epb, vloer: s } }))} />
          <h3>Plafond / dak van {v.naam}</h3>
          <SamenstellingEditor s={v.epb?.plafond} plaats="dak" standaardGrens={project.verdiepingen.some((x) => x.peil > v.peil) ? "onverwarmd" : "buiten"} zet={(s) => props.wijzig((x) => ({ ...x, epb: { ...x.epb, plafond: s } }))} />
        </>
      )}
      {!sel && (
        <>
          <h3>Invoerlijst</h3>
          <p>Beschermd volume: <strong>{g(inv.volume)} m³</strong> · vloer <strong>{g(inv.vloeroppervlakte)} m²</strong> (netto)</p>
          <table className="tabel klein">
            <thead><tr><th>Richting</th><th className="getal">Muren m²</th><th className="getal">Ramen m²</th><th className="getal">Deuren m²</th></tr></thead>
            <tbody>{inv.perRichting.map((x) => <tr key={x.richting}><td>{x.richting}</td><td className="getal">{g(x.muren)}</td><td className="getal">{g(x.ramen)}</td><td className="getal">{g(x.deuren)}</td></tr>)}</tbody>
          </table>
          {inv.ontbrekend.length > 0 && (
            <>
              <h3>Nog in te vullen ({inv.ontbrekend.length})</h3>
              <ul className="aandachtspunten">{inv.ontbrekend.slice(0, 12).map((x) => <li key={x} className="let-op">{x}</li>)}</ul>
            </>
          )}
        </>
      )}
      <div className="acties">
        <button className="primair" onClick={() => props.exporteer("epb-pdf")}>EPB-inventaris (PDF)</button>
        <button onClick={() => props.exporteer("epb-csv")}>Invoerlijst (Excel)</button>
      </div>
      <p className="uitleg klein">Foto's blijven op dit toestel (nog niet in de deellink, het projectbestand of de cloud).</p>
    </section>
  );
}
