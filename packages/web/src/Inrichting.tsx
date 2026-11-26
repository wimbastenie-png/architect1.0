/**
 * Inrichting: meubels kiezen en op het plan tikken, draaien, verplaatsen,
 * materialen per ruimte, opmerkingen, en de 3D-weergave.
 */
import {
  controleerInrichting, MATERIALEN, MEUBELS, meubelDef, verwijderMeubel, wijzigMeubel, zetAfwerking,
  type Verdieping,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { Veld } from "./ui.tsx";

const GROEPEN = [...new Set(MEUBELS.map((m) => m.groep))];

export function InrichtingBalk({ plaatsen, zetPlaatsen }: { plaatsen: string | null; zetPlaatsen: (s: string | null) => void }) {
  const [groep, zetGroep] = useState(GROEPEN[0]!);
  return (
    <div className="installatie-balk">
      <div className="soorten" role="tablist" aria-label="Groep meubels">
        {GROEPEN.map((g) => <button key={g} role="tab" aria-selected={groep === g} className={groep === g ? "actief" : ""} onClick={() => zetGroep(g)}>{g}</button>)}
      </div>
      <div className="soorten" role="toolbar" aria-label="Meubels">
        {MEUBELS.filter((m) => m.groep === groep).map((m) => (
          <button key={m.soort} className={plaatsen === m.soort ? "actief" : ""} aria-pressed={plaatsen === m.soort} onClick={() => zetPlaatsen(plaatsen === m.soort ? null : m.soort)}>{m.naam}</button>
        ))}
      </div>
      <p className="hint-kort">{plaatsen ? <>Tik op het plan om <strong>{meubelDef(plaatsen)?.naam.toLowerCase()}</strong> te plaatsen (meermaals kan).</> : "Kies een meubel en tik op het plan, of tik een meubel of ruimte aan."}</p>
    </div>
  );
}

export function InrichtingPaneel(props: {
  v: Verdieping;
  meubelId: string | null;
  zetMeubelId: (id: string | null) => void;
  ruimteId: string | null;
  verplaatsen: boolean;
  zetVerplaatsen: (b: boolean) => void;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  open3D: () => void;
}) {
  const { v, meubelId } = props;
  const m = v.meubels.find((x) => x.id === meubelId);
  const r = v.ruimtes.find((x) => x.id === props.ruimteId) ?? null;
  const opm = useMemo(() => controleerInrichting(v), [v]);
  const schuif = (dx: number, dy: number) => m && props.wijzig((x) => wijzigMeubel(x, m.id, { positie: { x: m.positie.x + dx, y: m.positie.y + dy } }));

  return (
    <section className="kaart inrichting">
      <div className="kaart-kop"><h2>Inrichting</h2></div>
      <div className="acties"><button className="primair" onClick={props.open3D}>3D bekijken</button></div>
      {m ? (
        <div className="punt-bewerken">
          <h3>{meubelDef(m.soort)?.naam ?? m.soort}</h3>
          <div className="acties">
            <button onClick={() => props.wijzig((x) => wijzigMeubel(x, m.id, { hoek: m.hoek + 90 }))} aria-label="Draai 90 graden">Draai 90°</button>
            <button onClick={() => props.wijzig((x) => wijzigMeubel(x, m.id, { hoek: m.hoek - 15 }))} aria-label="Draai 15 graden">↻ 15°</button>
            <button className={props.verplaatsen ? "primair" : ""} onClick={() => props.zetVerplaatsen(!props.verplaatsen)}>{props.verplaatsen ? "Tik op de nieuwe plaats…" : "Verplaatsen"}</button>
          </div>
          <div className="pijlen" role="group" aria-label="Schuiven per 10 cm">
            <button onClick={() => schuif(0, 100)} aria-label="Omhoog">↑</button>
            <button onClick={() => schuif(-100, 0)} aria-label="Links">←</button>
            <button onClick={() => schuif(100, 0)} aria-label="Rechts">→</button>
            <button onClick={() => schuif(0, -100)} aria-label="Omlaag">↓</button>
          </div>
          <div className="rij">
            <Veld label="Breedte (mm)"><input type="number" inputMode="numeric" min={100} defaultValue={m.breedte} key={m.id + "b" + m.breedte} onBlur={(e) => { const x = Math.round(+e.target.value); if (x >= 100 && x !== m.breedte) props.wijzig((y) => wijzigMeubel(y, m.id, { breedte: x })); }} /></Veld>
            <Veld label="Diepte (mm)"><input type="number" inputMode="numeric" min={100} defaultValue={m.diepte} key={m.id + "d" + m.diepte} onBlur={(e) => { const x = Math.round(+e.target.value); if (x >= 100 && x !== m.diepte) props.wijzig((y) => wijzigMeubel(y, m.id, { diepte: x })); }} /></Veld>
            <Veld label="Kleur"><input type="color" value={m.kleur ?? meubelDef(m.soort)?.kleur ?? "#a8a29e"} onChange={(e) => props.wijzig((y) => wijzigMeubel(y, m.id, { kleur: e.target.value }))} /></Veld>
          </div>
          <div className="acties">
            <button className="gevaar" onClick={() => { props.wijzig((x) => verwijderMeubel(x, m.id)); props.zetMeubelId(null); }}>Verwijderen</button>
            <button onClick={() => props.zetMeubelId(null)}>Klaar</button>
          </div>
        </div>
      ) : r ? (
        <div className="punt-bewerken">
          <h3>Materialen {r.naam}</h3>
          <Veld label="Vloer">
            <select value={r.afwerking?.vloer ?? ""} onChange={(e) => props.wijzig((x) => zetAfwerking(x, r.id, { vloer: e.target.value || undefined }))}>
              <option value="">— niet gekozen —</option>
              {MATERIALEN.filter((x) => x.soort === "vloer").map((x) => <option key={x.sleutel} value={x.sleutel}>{x.naam}</option>)}
            </select>
          </Veld>
          <Veld label="Wanden">
            <select value={r.afwerking?.wand ?? ""} onChange={(e) => props.wijzig((x) => zetAfwerking(x, r.id, { wand: e.target.value || undefined }))}>
              <option value="">— niet gekozen —</option>
              {MATERIALEN.filter((x) => x.soort === "wand").map((x) => <option key={x.sleutel} value={x.sleutel}>{x.naam}</option>)}
            </select>
          </Veld>
          <p className="uitleg">Wandkleur geldt in 3D voor de muren van deze ruimte (een tussenmuur krijgt de kleur van één van beide ruimtes).</p>
        </div>
      ) : <p className="uitleg">Tik een meubel aan om het te draaien, verplaatsen of verwijderen; tik een lege plek in een ruimte voor vloer- en wandmateriaal.</p>}
      {opm.length > 0 && (
        <>
          <h3>Opmerkingen</h3>
          <ul className="aandachtspunten">{opm.map((o, i) => <li key={i} className="let-op">{o.meubelId ? <button className="link" onClick={() => props.zetMeubelId(o.meubelId!)}>{o.tekst}</button> : o.tekst}</li>)}</ul>
        </>
      )}
    </section>
  );
}
