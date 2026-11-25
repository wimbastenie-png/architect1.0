import { sparingenIn, sparingMaten, verwijderRuimte, verwijderSparing, voegSparingToe, wijzigSparing, oppervlakte, type Ruimte, type Sparing, type Verdieping } from "@scanapp/core";
import { useState } from "react";
import { Veld, getal } from "./ui.tsx";

type Wijzig = (f: (v: Verdieping) => Verdieping) => boolean;

export function RuimtePaneel({ ruimte, v, wijzig, sluit }: { ruimte: Ruimte; v: Verdieping; wijzig: Wijzig; sluit: () => void }) {
  const zetRuimte = (f: (r: Ruimte) => Ruimte) => wijzig((x) => ({ ...x, ruimtes: x.ruimtes.map((r) => (r.id === ruimte.id ? f(r) : r)) }));
  const sparingen = sparingenIn(ruimte, v);
  const [bewerkId, zetBewerkId] = useState<string | null>(null);
  const [sp, zetSp] = useState({ soort: "trapgat" as Sparing["soort"], x: "0", y: "0", breedte: "1000", lengte: "2800", open: false });
  const zet = (k: keyof typeof sp) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => zetSp({ ...sp, [k]: e.target.value });

  return (
    <section className="kaart">
      <div className="kaart-kop"><h2>Ruimte</h2><button onClick={sluit} aria-label="Sluiten">×</button></div>
      <Veld label="Naam">
        <input defaultValue={ruimte.naam} key={ruimte.id + ruimte.naam} onBlur={(e) => e.target.value.trim() && e.target.value !== ruimte.naam && zetRuimte((r) => ({ ...r, naam: e.target.value.trim() }))} />
      </Veld>
      <Veld label="Plafondhoogte (mm)">
        <input type="number" inputMode="numeric" defaultValue={ruimte.plafondhoogte} key={ruimte.id + ruimte.plafondhoogte} onBlur={(e) => { const h = Math.round(+e.target.value); if (h > 0 && h !== ruimte.plafondhoogte) zetRuimte((r) => ({ ...r, plafondhoogte: h })); }} />
      </Veld>
      <Veld label="Notities (werf)">
        <textarea rows={3} defaultValue={ruimte.notities ?? ""} key={ruimte.id + "-n"} placeholder="bv. vochtvlek hoek NO, 3 stopcontacten, klant wil parket"
          onBlur={(e) => { const t = e.target.value.trim(); if (t !== (ruimte.notities ?? "")) zetRuimte((r) => ({ ...r, notities: t || undefined })); }} />
      </Veld>

      <h3>Trapgat, vide of schacht</h3>
      {sparingen.length === 0 && <p className="uitleg">Geen sparingen in de vloer van deze ruimte.</p>}
      <ul className="openingen">
        {sparingen.map((s) => {
          const mt = sparingMaten(s, ruimte);
          if (bewerkId === s.id) return (
            <li key={s.id} className="bewerk">
              <form onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                const ok = wijzig((x) => wijzigSparing(x, s.id, {
                  soort: d.get("soort") as Sparing["soort"], x: +d.get("x")!, y: +d.get("y")!, breedte: +d.get("breedte")!, lengte: +d.get("lengte")!,
                }));
                if (ok) zetBewerkId(null);
              }}>
                <Veld label="Soort"><select name="soort" defaultValue={s.soort}><option value="trapgat">Trapgat</option><option value="vide">Vide</option><option value="schacht">Schacht</option></select></Veld>
                <div className="rij">
                  <Veld label="Van links"><input name="x" type="number" inputMode="numeric" min={0} defaultValue={mt.x} /></Veld>
                  <Veld label="Van onder"><input name="y" type="number" inputMode="numeric" min={0} defaultValue={mt.y} /></Veld>
                </div>
                <div className="rij">
                  <Veld label="Breedte"><input name="breedte" type="number" inputMode="numeric" min={1} defaultValue={mt.breedte} /></Veld>
                  <Veld label="Lengte"><input name="lengte" type="number" inputMode="numeric" min={1} defaultValue={mt.lengte} /></Veld>
                </div>
                <div className="acties"><button className="primair" type="submit">Opslaan</button><button type="button" onClick={() => zetBewerkId(null)}>Annuleren</button></div>
              </form>
            </li>
          );
          return (
            <li key={s.id}>
              <span>{s.soort} {mt.breedte} × {mt.lengte}, op {mt.x} van links en {mt.y} van onder ({getal(oppervlakte(s.contour) / 1e6)} m²)</span>
              <span className="knopjes">
                <button onClick={() => zetBewerkId(s.id)}>Wijzig</button>
                <button onClick={() => wijzig((x) => verwijderSparing(x, s.id))}>Verwijder</button>
              </span>
            </li>
          );
        })}
      </ul>
      {!sp.open ? (
        <button className="ruimte-erbij" onClick={() => zetSp({ ...sp, open: true })}>+ Sparing in de vloer</button>
      ) : (
        <form className="nieuwe-opening" onSubmit={(e) => {
          e.preventDefault();
          const ok = wijzig((x) => voegSparingToe(x, { ruimteId: ruimte.id, soort: sp.soort, x: +sp.x, y: +sp.y, breedte: +sp.breedte, lengte: +sp.lengte }));
          if (ok) zetSp({ ...sp, open: false });
        }}>
          <p className="uitleg">Rechthoek in de vloer, gemeten vanaf de linkse en de onderste binnenmuur (zoals op het plan). Wordt afgetrokken van deze vloer en van het plafond eronder.</p>
          <Veld label="Soort sparing">
            <select value={sp.soort} onChange={zet("soort")}>
              <option value="trapgat">Trapgat</option>
              <option value="vide">Vide</option>
              <option value="schacht">Schacht</option>
            </select>
          </Veld>
          <div className="rij">
            <Veld label="Van links (mm)"><input type="number" inputMode="numeric" min={0} value={sp.x} onChange={zet("x")} /></Veld>
            <Veld label="Van onder (mm)"><input type="number" inputMode="numeric" min={0} value={sp.y} onChange={zet("y")} /></Veld>
          </div>
          <div className="rij">
            <Veld label="Breedte (mm)"><input type="number" inputMode="numeric" min={1} value={sp.breedte} onChange={zet("breedte")} /></Veld>
            <Veld label="Lengte (mm)"><input type="number" inputMode="numeric" min={1} value={sp.lengte} onChange={zet("lengte")} /></Veld>
          </div>
          <div className="acties">
            <button className="primair" type="submit">Sparing toevoegen</button>
            <button type="button" onClick={() => zetSp({ ...sp, open: false })}>Annuleren</button>
          </div>
        </form>
      )}

      {v.ruimtes.length > 1 && (
        <button className="gevaar" onClick={() => {
          if (confirm(`Ruimte '${ruimte.naam}' verwijderen? Muren die alleen bij deze ruimte horen, verdwijnen mee. Je kan dit ongedaan maken.`))
            if (wijzig((x) => verwijderRuimte(x, ruimte.id))) sluit();
        }}>Ruimte verwijderen</button>
      )}
    </section>
  );
}
