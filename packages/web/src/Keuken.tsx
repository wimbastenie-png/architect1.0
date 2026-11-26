/**
 * Keuken en maatwerk: wand kiezen, precisiemeting, wandaanzicht met kasten,
 * wand vullen, aansluitingen, controle en export (PDF, Excel, DXF).
 */
import {
  controleerKeuken, KEUKEN_DISCLAIMER, MODULES, naamKast, tekeningNaarSVG, vulWand, wandAanzicht, wandenVan, zoekWand,
  type Kast, type KastFunctie, type KastSoort, type Maatwerk, type Project, type Verdieping,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { Veld } from "./ui.tsx";

const FUNCTIES: KastFunctie[] = ["kast", "lades", "spoelbak", "kookplaat", "vaatwas", "oven", "koelkast", "dampkap", "vulstuk"];
const AANSLUITINGEN = ["radiator", "koud", "warm", "afvoer", "gas", "stopcontact", "dampkap-afvoer"] as const;

export function KeukenPaneel(props: {
  project: Project; v: Verdieping; ruimteId: string | null; rand: number | null; zetRand: (r: number | null) => void;
  wijzigProject: (p: Project) => void; exporteer: (soort: "keuken-pdf" | "keuken-csv" | "keuken-dxf", w?: Maatwerk) => void;
}) {
  const { project, v, ruimteId, rand } = props;
  const r = v.ruimtes.find((x) => x.id === ruimteId);
  const [kastSel, zetKastSel] = useState<string | null>(null);
  const [nieuw, zetNieuw] = useState<{ soort: KastSoort; functie: KastFunctie; breedte: number }>({ soort: "onder", functie: "kast", breedte: 600 });
  const [aans, zetAans] = useState<{ soort: (typeof AANSLUITINGEN)[number]; x: string; hoogte: string }>({ soort: "stopcontact", x: "0", hoogte: "1100" });
  const bestaand = project.maatwerk.find((w) => w.ruimteId === ruimteId && w.rand === rand);
  const w: Maatwerk | null = ruimteId && rand !== null ? bestaand ?? { id: `mw-${ruimteId}-${rand}`, ruimteId, rand, meting: { methode: "laser" }, kasten: [], aansluitingen: [] } : null;
  const zet = (n: Maatwerk) => props.wijzigProject({ ...project, maatwerk: bestaand ? project.maatwerk.map((x) => (x.id === n.id ? n : x)) : [...project.maatwerk, n] });
  const aanzicht = useMemo(() => (w ? tekeningNaarSVG(wandAanzicht(project, w, { geselecteerd: kastSel ?? undefined })) : ""), [project, w, kastSel]);
  const opm = useMemo(() => (w && bestaand ? controleerKeuken(project, w) : []), [project, w, bestaand]);
  const wand = w ? zoekWand(project, w) : null;
  const k = w?.kasten.find((x) => x.id === kastSel);
  const zetKast = (n: Kast) => w && zet({ ...w, kasten: w.kasten.map((x) => (x.id === n.id ? n : x)) });
  const meting = (veld: keyof Maatwerk["meting"]) => (e: React.ChangeEvent<HTMLInputElement>) => w && zet({ ...w, meting: { ...w.meting, [veld]: e.target.value === "" ? undefined : +e.target.value } });

  if (!r) return (
    <section className="kaart keuken"><div className="kaart-kop"><h2>Keuken en maatwerk</h2></div>
      <p className="uitleg">Tik in het plan dicht bij de wand waar de keuken of de kast komt. {KEUKEN_DISCLAIMER}</p>
      {project.maatwerk.length > 0 && <div className="acties"><button onClick={() => props.exporteer("keuken-pdf")}>Alle wandaanzichten (PDF)</button></div>}
    </section>
  );
  return (
    <section className="kaart keuken">
      <div className="kaart-kop"><h2>{r.naam}: wand {rand === null ? "–" : rand + 1}</h2></div>
      <div className="soorten" role="group" aria-label="Wanden">
        {wandenVan(v, r).map((x) => <button key={x.rand} className={x.rand === rand ? "actief" : ""} onClick={() => { props.zetRand(x.rand); zetKastSel(null); }}>W{x.rand + 1} · {x.lengte}</button>)}
      </div>
      {w && wand && (
        <>
          <h3>Precisiemeting (laser)</h3>
          <div className="rij">
            <Veld label="Lengte bij de vloer"><input type="number" inputMode="numeric" value={w.meting.onder ?? ""} placeholder={String(wand.lengte)} onChange={meting("onder")} /></Veld>
            <Veld label="Lengte midden (± 900)"><input type="number" inputMode="numeric" value={w.meting.midden ?? ""} placeholder={String(wand.lengte)} onChange={meting("midden")} /></Veld>
            <Veld label="Lengte bij het plafond"><input type="number" inputMode="numeric" value={w.meting.boven ?? ""} placeholder={String(wand.lengte)} onChange={meting("boven")} /></Veld>
          </div>
          <div className="rij">
            <Veld label="Hoek links (° uit haaks)"><input type="number" inputMode="decimal" step="0.1" value={w.meting.hoekLinks ?? ""} onChange={meting("hoekLinks")} /></Veld>
            <Veld label="Hoek rechts (° uit haaks)"><input type="number" inputMode="decimal" step="0.1" value={w.meting.hoekRechts ?? ""} onChange={meting("hoekRechts")} /></Veld>
            <Veld label="Vloer: verschil (mm)"><input type="number" inputMode="numeric" value={w.meting.vloerVerschil ?? ""} onChange={meting("vloerVerschil")} /></Veld>
            <Veld label="Muur uit het lood (mm)"><input type="number" inputMode="numeric" value={w.meting.lood ?? ""} onChange={meting("lood")} /></Veld>
          </div>
          <h3>Wandaanzicht</h3>
          <div className="schema aanzicht" onClick={(e) => { const el = (e.target as Element).closest("[data-kast]"); zetKastSel(el ? el.getAttribute("data-kast") : null); }} dangerouslySetInnerHTML={{ __html: aanzicht }} />
          <div className="acties">
            <button onClick={() => { if (w.kasten.length && !window.confirm("De kasten op deze wand vervangen door een voorstel?")) return; zet(vulWand(w, wand)); }}>Wand vullen (voorstel)</button>
          </div>
          {k ? (
            <div className="punt-bewerken">
              <h3>{naamKast(k)}</h3>
              <div className="pijlen" role="group" aria-label="Kast schuiven">
                <button onClick={() => zetKast({ ...k, x: Math.max(0, k.x - 100) })} aria-label="100 mm naar links">⇇</button>
                <button onClick={() => zetKast({ ...k, x: Math.max(0, k.x - 10) })} aria-label="10 mm naar links">←</button>
                <button onClick={() => zetKast({ ...k, x: k.x + 10 })} aria-label="10 mm naar rechts">→</button>
                <button onClick={() => zetKast({ ...k, x: k.x + 100 })} aria-label="100 mm naar rechts">⇉</button>
              </div>
              <div className="rij">
                <Veld label="Breedte"><input type="number" inputMode="numeric" min={30} value={k.breedte} onChange={(e) => zetKast({ ...k, breedte: Math.max(30, Math.round(+e.target.value) || 30) })} /></Veld>
                <Veld label="Functie"><select value={k.functie} onChange={(e) => zetKast({ ...k, functie: e.target.value as KastFunctie })}>{FUNCTIES.map((f) => <option key={f}>{f}</option>)}</select></Veld>
                <Veld label="Positie vanaf links"><input type="number" inputMode="numeric" min={0} value={k.x} onChange={(e) => zetKast({ ...k, x: Math.max(0, Math.round(+e.target.value) || 0) })} /></Veld>
              </div>
              <div className="acties"><button className="gevaar" onClick={() => { zet({ ...w, kasten: w.kasten.filter((x) => x.id !== k.id) }); zetKastSel(null); }}>Verwijderen</button><button onClick={() => zetKastSel(null)}>Klaar</button></div>
            </div>
          ) : (
            <div className="rij">
              <Veld label="Soort"><select value={nieuw.soort} onChange={(e) => zetNieuw({ ...nieuw, soort: e.target.value as KastSoort })}><option value="onder">onderkast</option><option value="boven">bovenkast</option><option value="hoog">hoge kast</option></select></Veld>
              <Veld label="Functie"><select value={nieuw.functie} onChange={(e) => zetNieuw({ ...nieuw, functie: e.target.value as KastFunctie })}>{FUNCTIES.map((f) => <option key={f}>{f}</option>)}</select></Veld>
              <Veld label="Module"><select value={nieuw.breedte} onChange={(e) => zetNieuw({ ...nieuw, breedte: +e.target.value })}>{MODULES.map((m) => <option key={m} value={m}>{m}</option>)}</select></Veld>
              <button onClick={() => {
                const rij = w.kasten.filter((x) => (nieuw.soort === "boven" ? x.soort === "boven" : x.soort !== "boven"));
                const x = rij.length ? Math.max(...rij.map((y) => y.x + y.breedte)) : 0;
                const id = `k-${Date.now().toString(36)}`;
                zet({ ...w, kasten: [...w.kasten, { id, soort: nieuw.soort, functie: nieuw.functie, x, breedte: nieuw.breedte }] });
                zetKastSel(id);
              }}>+ Kast</button>
            </div>
          )}
          <h3>Aansluitingen (niet op het plan)</h3>
          <div className="rij">
            <Veld label="Soort"><select value={aans.soort} onChange={(e) => zetAans({ ...aans, soort: e.target.value as (typeof AANSLUITINGEN)[number] })}>{AANSLUITINGEN.map((a) => <option key={a}>{a}</option>)}</select></Veld>
            <Veld label="Vanaf links (mm)"><input type="number" inputMode="numeric" value={aans.x} onChange={(e) => zetAans({ ...aans, x: e.target.value })} /></Veld>
            <Veld label="Hoogte (mm)"><input type="number" inputMode="numeric" value={aans.hoogte} onChange={(e) => zetAans({ ...aans, hoogte: e.target.value })} /></Veld>
            <button onClick={() => zet({ ...w, aansluitingen: [...w.aansluitingen, { soort: aans.soort, x: Math.max(0, +aans.x || 0), hoogte: Math.max(0, +aans.hoogte || 0) }] })}>+ Aansluiting</button>
          </div>
          {w.aansluitingen.length > 0 && <ul className="leden">{w.aansluitingen.map((a, i) => <li key={i}>{a.soort} op {a.x} mm, hoogte {a.hoogte} <button aria-label="Aansluiting verwijderen" onClick={() => zet({ ...w, aansluitingen: w.aansluitingen.filter((_, j) => j !== i) })}>×</button></li>)}</ul>}
          {opm.length > 0 && (<><h3>Opmerkingen</h3><ul className="aandachtspunten">{opm.map((o, i) => <li key={i} className={o.ernst === "let op" ? "let-op" : ""}>{o.kastId ? <button className="link" onClick={() => zetKastSel(o.kastId!)}>{o.tekst}</button> : o.tekst}</li>)}</ul></>)}
          <div className="acties">
            <button className="primair" onClick={() => props.exporteer("keuken-pdf")}>Wandaanzichten (PDF)</button>
            <button onClick={() => props.exporteer("keuken-csv", w)}>Kasten- en snijlijst (Excel)</button>
            <button onClick={() => props.exporteer("keuken-dxf", w)}>Wandaanzicht (DXF)</button>
          </div>
          <p className="uitleg klein">{KEUKEN_DISCLAIMER}</p>
        </>
      )}
    </section>
  );
}
