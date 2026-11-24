import {
  aansluitingen,
  binnenLengte,
  controleerSamenhang,
  leesProject,
  meetstaat,
  meetstaatCSV,
  muurLengte,
  projectNaarPDF,
  rechthoekigProject,
  verdiepingNaarDXF,
  verdiepingNaarSVG,
  zetBinnenLengte,
  type Dragend,
  type Muur,
  type Opening,
  type Project,
  type Verdieping,
} from "@scanapp/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { appartement } from "../../core/examples/appartement.ts";

const OPSLAG = "architect1.0:project";
type Selectie = { soort: "muur" | "ruimte"; id: string } | null;
type Methode = "manueel" | "laser" | "gecorrigeerd";

function laadOpgeslagen(): Project | null {
  try {
    const ruw = localStorage.getItem(OPSLAG);
    if (!ruw) return null;
    const r = leesProject(JSON.parse(ruw));
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

function download(naam: string, inhoud: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([inhoud], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const bestandsnaam = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
const getal = (x: number) => x.toFixed(2).replace(".", ",");

export function App() {
  const [project, zetProject] = useState<Project | null>(laadOpgeslagen);
  const [geschiedenis, zetGeschiedenis] = useState<Project[]>([]);
  const [vi, zetVi] = useState(0);
  const [selectie, zetSelectie] = useState<Selectie>(null);
  const [melding, zetMelding] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (project) localStorage.setItem(OPSLAG, JSON.stringify(project));
    } catch {
      /* opslag niet beschikbaar: app werkt verder zonder */
    }
  }, [project]);

  const nieuwProject = (p: Project) => {
    if (project) zetGeschiedenis((g) => [...g.slice(-49), project]);
    zetProject(p);
    zetVi(0);
    zetSelectie(null);
  };

  const wijzigVerdieping = useCallback(
    (f: (v: Verdieping) => Verdieping) => {
      if (!project) return;
      try {
        const verdiepingen = project.verdiepingen.map((v, i) => (i === vi ? f(v) : v));
        zetGeschiedenis((g) => [...g.slice(-49), project]);
        zetProject({ ...project, verdiepingen, gewijzigd: new Date().toISOString() });
        zetMelding(null);
      } catch (e) {
        zetMelding(e instanceof Error ? e.message : String(e));
      }
    },
    [project, vi],
  );

  const ongedaan = useCallback(() => {
    const vorige = geschiedenis[geschiedenis.length - 1];
    if (!vorige) return;
    zetGeschiedenis((g) => g.slice(0, -1));
    zetProject(vorige);
  }, [geschiedenis]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        ongedaan();
      }
      if (e.key === "Escape") zetSelectie(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [ongedaan]);

  const openBestand = async (f: File) => {
    try {
      const r = leesProject(JSON.parse(await f.text()));
      if (!r.ok) return zetMelding(`Bestand niet geldig: ${r.fouten.slice(0, 3).map((x) => `${x.pad} ${x.melding}`).join("; ")}`);
      nieuwProject(r.project);
      zetMelding(null);
    } catch {
      zetMelding("Dit is geen geldig projectbestand (JSON).");
    }
  };

  return (
    <div className="app">
      <header className="kop">
        <div className="merk">
          <strong>architect1.0</strong>
          {project && <span className="projectnaam">{project.naam}</span>}
        </div>
        <nav className="knoppen">
          <button onClick={() => { zetProject(null); zetSelectie(null); }}>Nieuw</button>
          <label className="knop">
            Openen
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && openBestand(e.target.files[0])} />
          </label>
          <button onClick={ongedaan} disabled={!geschiedenis.length} title="Ctrl+Z">Ongedaan maken</button>
        </nav>
      </header>

      {melding && <div className="melding" role="alert">{melding}<button onClick={() => zetMelding(null)} aria-label="Sluiten">×</button></div>}

      {!project ? (
        <NieuwProject onMaak={nieuwProject} onVoorbeeld={() => nieuwProject(appartement)} />
      ) : (
        <Werkblad
          project={project}
          vi={vi}
          zetVi={(i) => { zetVi(i); zetSelectie(null); }}
          selectie={selectie}
          zetSelectie={zetSelectie}
          wijzig={wijzigVerdieping}
          wijzigProject={(p) => { zetGeschiedenis((g) => [...g.slice(-49), project]); zetProject(p); }}
          zetMelding={zetMelding}
        />
      )}
    </div>
  );
}

function NieuwProject({ onMaak, onVoorbeeld }: { onMaak: (p: Project) => void; onVoorbeeld: () => void }) {
  const [f, zetF] = useState({ naam: "", ruimteNaam: "Leefruimte", breedte: "", diepte: "", hoogte: "2600", dikte: "300", methode: "manueel" as "manueel" | "laser" });
  const zet = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => zetF({ ...f, [k]: e.target.value });
  const ok = f.naam.trim() && +f.breedte > 0 && +f.diepte > 0 && +f.hoogte > 0 && +f.dikte > 0;
  return (
    <main className="start">
      <section className="kaart">
        <h1>Nieuw project</h1>
        <p className="uitleg">Geef de binnenmaten in die je met rolmeter of laser gemeten hebt (in mm). Daarna klik je op een muur om maten aan te passen en ramen of deuren toe te voegen.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (ok) onMaak(rechthoekigProject({ naam: f.naam.trim(), ruimteNaam: f.ruimteNaam.trim() || "Ruimte 1", binnenBreedte: +f.breedte, binnenDiepte: +f.diepte, plafondhoogte: +f.hoogte, muurdikte: +f.dikte, methode: f.methode })); }}>
          <div className="velden">
            <Veld label="Projectnaam"><input value={f.naam} onChange={zet("naam")} placeholder="bv. Renovatie Kerkstraat 5" required /></Veld>
            <Veld label="Naam ruimte"><input value={f.ruimteNaam} onChange={zet("ruimteNaam")} /></Veld>
            <Veld label="Binnenbreedte (mm)"><input inputMode="numeric" type="number" min={1} value={f.breedte} onChange={zet("breedte")} placeholder="5800" required /></Veld>
            <Veld label="Binnendiepte (mm)"><input inputMode="numeric" type="number" min={1} value={f.diepte} onChange={zet("diepte")} placeholder="4500" required /></Veld>
            <Veld label="Plafondhoogte (mm)"><input inputMode="numeric" type="number" min={1} value={f.hoogte} onChange={zet("hoogte")} /></Veld>
            <Veld label="Muurdikte (mm)"><input inputMode="numeric" type="number" min={1} value={f.dikte} onChange={zet("dikte")} /></Veld>
            <Veld label="Gemeten met">
              <select value={f.methode} onChange={zet("methode")}>
                <option value="manueel">Rolmeter</option>
                <option value="laser">Laserafstandsmeter</option>
              </select>
            </Veld>
          </div>
          <div className="acties">
            <button className="primair" type="submit" disabled={!ok}>Plan maken</button>
            <button type="button" onClick={onVoorbeeld}>Voorbeeld openen</button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="veld"><span>{label}</span>{children}</label>;
}

interface WerkbladProps {
  project: Project;
  vi: number;
  zetVi: (i: number) => void;
  selectie: Selectie;
  zetSelectie: (s: Selectie) => void;
  wijzig: (f: (v: Verdieping) => Verdieping) => void;
  wijzigProject: (p: Project) => void;
  zetMelding: (s: string | null) => void;
}

function Werkblad({ project, vi, zetVi, selectie, zetSelectie, wijzig, wijzigProject, zetMelding }: WerkbladProps) {
  const v = project.verdiepingen[vi] ?? project.verdiepingen[0]!;
  const svg = useMemo(
    () => verdiepingNaarSVG(v, { interactief: true, geselecteerd: selectie?.soort === "muur" ? selectie.id : undefined }),
    [v, selectie],
  );
  const rijen = useMemo(() => meetstaat(project), [project]);
  const fouten = useMemo(() => controleerSamenhang(project), [project]);
  const muur = selectie?.soort === "muur" ? v.muren.find((m) => m.id === selectie.id) : undefined;
  const ruimte = selectie?.soort === "ruimte" ? v.ruimtes.find((r) => r.id === selectie.id) : undefined;
  const naam = bestandsnaam(project.naam);

  const klik = (e: React.MouseEvent) => {
    const el = (e.target as Element).closest("[data-muur],[data-ruimte]");
    if (!el) return zetSelectie(null);
    const m = el.getAttribute("data-muur");
    zetSelectie(m ? { soort: "muur", id: m } : { soort: "ruimte", id: el.getAttribute("data-ruimte")! });
  };

  const exporteer = async (soort: "pdf" | "dxf" | "csv" | "json") => {
    try {
      if (soort === "pdf") download(`${naam}.pdf`, await projectNaarPDF(project) as BlobPart, "application/pdf");
      if (soort === "dxf") download(`${naam}-${bestandsnaam(v.naam)}.dxf`, verdiepingNaarDXF(v), "application/dxf");
      if (soort === "csv") download(`${naam}-meetstaat.csv`, meetstaatCSV(rijen), "text/csv;charset=utf-8");
      if (soort === "json") download(`${naam}.json`, JSON.stringify(project, null, 2), "application/json");
    } catch (e) {
      zetMelding(`Export mislukt: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <main className="werkblad">
      <section className="plan-kolom">
        {project.verdiepingen.length > 1 && (
          <div className="tabs">
            {project.verdiepingen.map((x, i) => (
              <button key={x.id} className={i === vi ? "actief" : ""} onClick={() => zetVi(i)}>{x.naam}</button>
            ))}
          </div>
        )}
        <div className="plan" onClick={klik} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="hint">Klik op een muur of maat om ze aan te passen, of op een ruimte om naam en hoogte te wijzigen. Maatkleur: <span className="k-scan">gescand</span> · <span className="k-corr">ingegeven</span> · <span className="k-laser">laser</span>.</p>
        <div className="export">
          <button className="primair" onClick={() => exporteer("pdf")}>PDF-plan</button>
          <button onClick={() => exporteer("dxf")}>DXF (CAD)</button>
          <button onClick={() => exporteer("csv")}>Meetstaat (Excel)</button>
          <button onClick={() => exporteer("json")}>Projectbestand</button>
        </div>
        {fouten.length > 0 && (
          <div className="fouten"><strong>Controle:</strong><ul>{fouten.map((f, i) => <li key={i}>{f.melding}</li>)}</ul></div>
        )}
      </section>

      <aside className="paneel">
        {muur ? (
          <MuurPaneel key={muur.id} muur={muur} v={v} wijzig={wijzig} sluit={() => zetSelectie(null)} meld={zetMelding} />
        ) : ruimte ? (
          <section className="kaart">
            <h2>Ruimte</h2>
            <Veld label="Naam">
              <input defaultValue={ruimte.naam} key={ruimte.id + ruimte.naam} onBlur={(e) => e.target.value.trim() && e.target.value !== ruimte.naam && wijzig((x) => ({ ...x, ruimtes: x.ruimtes.map((r) => (r.id === ruimte.id ? { ...r, naam: e.target.value.trim() } : r)) }))} />
            </Veld>
            <Veld label="Plafondhoogte (mm)">
              <input type="number" inputMode="numeric" defaultValue={ruimte.plafondhoogte} key={ruimte.id + ruimte.plafondhoogte} onBlur={(e) => { const h = Math.round(+e.target.value); if (h > 0 && h !== ruimte.plafondhoogte) wijzig((x) => ({ ...x, ruimtes: x.ruimtes.map((r) => (r.id === ruimte.id ? { ...r, plafondhoogte: h } : r)) })); }} />
            </Veld>
            <button onClick={() => zetSelectie(null)}>Sluiten</button>
          </section>
        ) : (
          <section className="kaart">
            <h2>Project</h2>
            <Veld label="Projectnaam">
              <input defaultValue={project.naam} key={project.naam} onBlur={(e) => e.target.value.trim() && e.target.value !== project.naam && wijzigProject({ ...project, naam: e.target.value.trim() })} />
            </Veld>
            <p className="uitleg">Selecteer een muur in het plan om de binnenmaat te wijzigen of een raam of deur toe te voegen.</p>
          </section>
        )}

        <section className="kaart">
          <h2>Meetstaat</h2>
          <div className="tabel-wrap">
            <table>
              <thead><tr><th>Ruimte</th><th>Vloer m²</th><th>Wand netto m²</th><th>Volume m³</th></tr></thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.verdieping + r.ruimte}><td>{r.ruimte}</td><td>{getal(r.vloerM2)}</td><td>{getal(r.wandNettoM2)}</td><td>{getal(r.volumeM3)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td>Totaal</td><td>{getal(rijen.reduce((s, r) => s + r.vloerM2, 0))}</td><td>{getal(rijen.reduce((s, r) => s + r.wandNettoM2, 0))}</td><td>{getal(rijen.reduce((s, r) => s + r.volumeM3, 0))}</td></tr></tfoot>
            </table>
          </div>
        </section>
        <p className="disclaimer">Opmeting ter indicatie. Maten te verifiëren ter plaatse. Geen bouwplan voor een vergunning en geen stabiliteitsstudie.</p>
      </aside>
    </main>
  );
}

const STANDAARD: Record<Opening["soort"], { breedte: number; hoogte: number; borstwering: number }> = {
  deur: { breedte: 930, hoogte: 2115, borstwering: 0 },
  raam: { breedte: 1200, hoogte: 1400, borstwering: 900 },
  doorgang: { breedte: 900, hoogte: 2115, borstwering: 0 },
};

function MuurPaneel({ muur, v, wijzig, sluit, meld }: { muur: Muur; v: Verdieping; wijzig: (f: (v: Verdieping) => Verdieping) => void; sluit: () => void; meld: (s: string | null) => void }) {
  const binnen = Math.round(binnenLengte(muur, v.muren));
  const aans = aansluitingen(muur, v.muren);
  const [maat, zetMaat] = useState(String(binnen));
  const [methode, zetMethode] = useState<Methode>("manueel");
  const [vast, zetVast] = useState<"start" | "eind">("start");
  const openingen = v.openingen.filter((o) => o.muurId === muur.id).sort((a, b) => a.offset - b.offset);
  const [nieuw, zetNieuw] = useState({ soort: "raam" as Opening["soort"], afstand: "", ...strings(STANDAARD.raam) });

  useEffect(() => zetMaat(String(binnen)), [binnen]);

  const pasToe = () => {
    const w = Math.round(+maat);
    if (!(w > 0)) return;
    wijzig((x) => zetBinnenLengte(x, muur.id, w, vast, methode));
  };

  const voegToe = () => {
    const afstand = Math.round(+nieuw.afstand), breedte = Math.round(+nieuw.breedte);
    const hoogte = Math.round(+nieuw.hoogte), borstwering = Math.round(+nieuw.borstwering || 0);
    if (!(afstand >= 0 && breedte > 0 && hoogte > 0)) return;
    if (afstand + breedte > binnen) throw new Error("De opening past niet in deze muur.");
    if (borstwering + hoogte > muur.hoogte) throw new Error("De opening is hoger dan de muur.");
    const o: Opening = {
      id: `o-${Date.now().toString(36)}`,
      muurId: muur.id,
      soort: nieuw.soort,
      offset: afstand + Math.round(aans.start), // binnenhoek A → hartlijnstart
      breedte,
      hoogte,
      borstwering,
      bron: { methode: "manueel", nauwkeurigheidMm: 5 },
    };
    wijzig((x) => ({ ...x, openingen: [...x.openingen, o] }));
    zetNieuw({ ...nieuw, afstand: "" });
  };

  return (
    <section className="kaart">
      <div className="kaart-kop"><h2>Muur</h2><button onClick={sluit} aria-label="Sluiten">×</button></div>
      <p className="uitleg">Hartlijn {Math.round(muurLengte(muur))} mm · dikte {muur.dikte} mm · gemeten: {muur.bron.methode}</p>
      <form onSubmit={(e) => { e.preventDefault(); pasToe(); }}>
        <Veld label="Binnenmaat (mm), van hoek tot hoek">
          <input type="number" inputMode="numeric" min={1} value={maat} onChange={(e) => zetMaat(e.target.value)} />
        </Veld>
        <div className="rij">
          <Veld label="Gemeten met">
            <select value={methode} onChange={(e) => zetMethode(e.target.value as Methode)}>
              <option value="manueel">Rolmeter</option>
              <option value="laser">Laser</option>
              <option value="gecorrigeerd">Correctie</option>
            </select>
          </Veld>
          <Veld label="Blijft staan">
            <select value={vast} onChange={(e) => zetVast(e.target.value as "start" | "eind")}>
              <option value="start">Hoek A</option>
              <option value="eind">Hoek B</option>
            </select>
          </Veld>
        </div>
        <button className="primair" type="submit" disabled={!(Math.round(+maat) > 0)}>Maat toepassen</button>
      </form>

      <Veld label="Dragend?">
        <select value={muur.dragend} onChange={(e) => wijzig((x) => ({ ...x, muren: x.muren.map((m) => (m.id === muur.id ? { ...m, dragend: e.target.value as Dragend } : m)) }))}>
          <option value="onbekend">Onbekend</option>
          <option value="vermoeden">Vermoedelijk dragend</option>
          <option value="niet-dragend">Niet dragend</option>
          <option value="bevestigd">Dragend (bevestigd door professional)</option>
        </select>
      </Veld>

      <h3>Ramen en deuren</h3>
      {openingen.length === 0 && <p className="uitleg">Nog geen openingen in deze muur.</p>}
      <ul className="openingen">
        {openingen.map((o) => (
          <li key={o.id}>
            <span>{o.soort} {o.breedte} × {o.hoogte}{o.borstwering ? `, borstwering ${o.borstwering}` : ""} — op {Math.round(o.offset - aans.start)} mm van A</span>
            <button onClick={() => wijzig((x) => ({ ...x, openingen: x.openingen.filter((y) => y.id !== o.id) }))} aria-label="Verwijderen">Verwijder</button>
          </li>
        ))}
      </ul>
      <form className="nieuwe-opening" onSubmit={(e) => { e.preventDefault(); try { voegToe(); } catch (err) { meld((err as Error).message); } }}>
        <div className="rij">
          <Veld label="Soort">
            <select value={nieuw.soort} onChange={(e) => { const s = e.target.value as Opening["soort"]; zetNieuw({ ...nieuw, soort: s, ...strings(STANDAARD[s]) }); }}>
              <option value="raam">Raam</option>
              <option value="deur">Deur</option>
              <option value="doorgang">Doorgang</option>
            </select>
          </Veld>
          <Veld label="Afstand vanaf hoek A"><input type="number" inputMode="numeric" min={0} value={nieuw.afstand} onChange={(e) => zetNieuw({ ...nieuw, afstand: e.target.value })} required /></Veld>
        </div>
        <div className="rij">
          <Veld label="Breedte"><input type="number" inputMode="numeric" min={1} value={nieuw.breedte} onChange={(e) => zetNieuw({ ...nieuw, breedte: e.target.value })} /></Veld>
          <Veld label="Hoogte"><input type="number" inputMode="numeric" min={1} value={nieuw.hoogte} onChange={(e) => zetNieuw({ ...nieuw, hoogte: e.target.value })} /></Veld>
          <Veld label="Borstwering"><input type="number" inputMode="numeric" min={0} value={nieuw.borstwering} onChange={(e) => zetNieuw({ ...nieuw, borstwering: e.target.value })} /></Veld>
        </div>
        <button type="submit">Opening toevoegen</button>
      </form>
    </section>
  );
}

function strings(o: { breedte: number; hoogte: number; borstwering: number }) {
  return { breedte: String(o.breedte), hoogte: String(o.hoogte), borstwering: String(o.borstwering) };
}
