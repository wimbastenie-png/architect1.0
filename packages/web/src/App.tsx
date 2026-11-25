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
  hernoemVerdieping,
  lastenboek,
  lastenboekCSV,
  lastenboekTSV,
  openingLabels,
  peilTekst,
  verwijderVerdieping,
  voegRuimteToe,
  voegVerdiepingToe,
  volgendPeil,
  zetPeil,
  zetBinnenLengte,
  breekMuurUit,
  verschuifMuur,
  verschuifRichtingen,
  muurOmschrijving,
  leesPrijzen,
  verwijderOpening,
  wijzigOpening,
  type Dragend,
  type Prijzen,
  type Muur,
  type Opening,
  type Project,
  type Verdieping,
} from "@scanapp/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { appartement } from "../../core/examples/appartement.ts";
import { ArOpmeting, ArResultaat, DEMO_PUNTEN, arOndersteund } from "./ArOpmeting.tsx";
import { LastenboekWeergave } from "./Lastenboek.tsx";
import { RuimtePaneel } from "./RuimtePaneel.tsx";
import { useSlepen } from "./Slepen.ts";
import { Veld, getal, leesOpslag, schrijfOpslag } from "./ui.tsx";

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
const PRIJZEN = "architect1.0:prijzen";
const BTW = "architect1.0:btw";

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
    (f: (v: Verdieping) => Verdieping): boolean => {
      if (!project) return false;
      try {
        const verdiepingen = project.verdiepingen.map((v, i) => (i === vi ? f(v) : v));
        zetGeschiedenis((g) => [...g.slice(-49), project]);
        zetProject({ ...project, verdiepingen, gewijzigd: new Date().toISOString() });
        zetMelding(null);
        return true;
      } catch (e) {
        zetMelding(e instanceof Error ? e.message : String(e));
        return false;
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
  const demo = typeof location !== "undefined" && new URLSearchParams(location.search).has("ar-demo");
  const [ar, zetAr] = useState<boolean | null>(null);
  const [stap, zetStap] = useState<"formulier" | "camera" | "resultaat">("formulier");
  const [punten, zetPunten] = useState<{ x: number; y: number }[]>([]);
  useEffect(() => { void arOndersteund().then(zetAr); }, []);
  if (stap === "camera") return <main className="start"><ArOpmeting onPunten={(p) => { zetPunten(p); zetStap("resultaat"); }} onStop={() => zetStap("formulier")} /></main>;
  if (stap === "resultaat") return <main className="start"><ArResultaat punten={punten} onMaak={onMaak} onOpnieuw={() => zetStap(demo ? "formulier" : "camera")} /></main>;
  return (
    <main className="start">
      <section className="kaart">
        <h1>Opmeten met de camera</h1>
        {ar ? (
          <>
            <p className="uitleg">Tik de hoeken van de vloer aan met je gsm-camera. Je krijgt meteen een plan dat je daarna met rolmeter of laser kan nameten.</p>
            <button className="primair" onClick={() => zetStap("camera")}>Camera-opmeting starten</button>
          </>
        ) : (
          <p className="uitleg">
            {ar === null ? "Controleren of dit toestel AR ondersteunt…" : "Niet beschikbaar op dit toestel. Werkt in Chrome op Android-toestellen met ARCore (niet op iPhone of pc). Je kan hieronder de maten ook ingeven."}
          </p>
        )}
        {demo && <div className="acties"><button onClick={() => { zetPunten(DEMO_PUNTEN); zetStap("resultaat"); }}>AR-demo met testpunten</button></div>}
      </section>
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


interface WerkbladProps {
  project: Project;
  vi: number;
  zetVi: (i: number) => void;
  selectie: Selectie;
  zetSelectie: (s: Selectie) => void;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  wijzigProject: (p: Project) => void;
  zetMelding: (s: string | null) => void;
}

function Werkblad({ project, vi, zetVi, selectie, zetSelectie, wijzig, wijzigProject, zetMelding }: WerkbladProps) {
  const v = project.verdiepingen[vi] ?? project.verdiepingen[0]!;
  const labels = useMemo(() => openingLabels(project), [project]);
  const slepen = useSlepen({
    v,
    geselecteerdeMuur: selectie?.soort === "muur" ? selectie.id : undefined,
    wijzig,
    kiesMuur: (id) => zetSelectie({ soort: "muur", id }),
  });
  const toon = slepen.voorbeeld ?? v;
  const svg = useMemo(
    () => verdiepingNaarSVG(toon, { interactief: true, labels, opening: slepen.actieveOpening, geselecteerd: selectie?.soort === "muur" ? selectie.id : undefined }),
    [toon, selectie, labels, slepen.actieveOpening],
  );
  const lb = useMemo(() => lastenboek(project), [project]);
  const [prijzen, zetPrijzen] = useState<Prijzen>(() => leesOpslag(PRIJZEN, leesPrijzen, {}));
  const [btw, zetBtw] = useState<number>(() => leesOpslag(BTW, (x) => (typeof x === "number" && [0, 6, 12, 21].includes(x) ? x : 21), 21));
  const zetPrijs = (code: string, prijs: number | undefined) => {
    const n = { ...prijzen };
    if (prijs === undefined || !Number.isFinite(prijs)) delete n[code]; else n[code] = Math.round(prijs * 100) / 100;
    zetPrijzen(n);
    schrijfOpslag(PRIJZEN, n);
  };
  const [nieuweVerdieping, zetNieuweVerdieping] = useState(false);
  const [weergave, zetWeergave] = useState<"ruimtes" | "lastenboek">("ruimtes");
  const meerdere = project.verdiepingen.length > 1;
  const pasProjectAan = (f: () => Project) => {
    try {
      const nieuw = f();
      wijzigProject(nieuw);
      // op dezelfde verdieping blijven (volgorde kan veranderen door het peil)
      zetVi(Math.max(0, nieuw.verdiepingen.findIndex((x) => x.id === v.id)));
      zetMelding(null);
      return true;
    } catch (e) {
      zetMelding(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(lastenboekTSV(lb, prijzen));
      zetMelding(null);
      alertKort("Lastenboek gekopieerd: plak het in je offerte of in Excel.");
    } catch {
      zetMelding("Kopiëren lukt niet in deze browser. Gebruik de knop 'Lastenboek (Excel)'.");
    }
  };
  const [kort, alertKort] = useState<string | null>(null);
  useEffect(() => { if (!kort) return; const t = setTimeout(() => alertKort(null), 3000); return () => clearTimeout(t); }, [kort]);
  const rijen = useMemo(() => meetstaat(project), [project]);
  const fouten = useMemo(() => controleerSamenhang(project), [project]);
  const muur = selectie?.soort === "muur" ? v.muren.find((m) => m.id === selectie.id) : undefined;
  const ruimte = selectie?.soort === "ruimte" ? v.ruimtes.find((r) => r.id === selectie.id) : undefined;
  const naam = bestandsnaam(project.naam);

  const klik = (e: React.MouseEvent) => {
    if (slepen.klikNegeren()) return;
    const el = (e.target as Element).closest("[data-muur],[data-ruimte]");
    if (!el) return zetSelectie(null);
    const m = el.getAttribute("data-muur");
    zetSelectie(m ? { soort: "muur", id: m } : { soort: "ruimte", id: el.getAttribute("data-ruimte")! });
  };

  const exporteer = async (soort: "pdf" | "dxf" | "csv" | "lastenboek" | "json") => {
    try {
      if (soort === "pdf") download(`${naam}.pdf`, await projectNaarPDF(project, { prijzen, btwPct: btw }) as BlobPart, "application/pdf");
      if (soort === "dxf") download(`${naam}-${bestandsnaam(v.naam)}.dxf`, verdiepingNaarDXF(v, { labels }), "application/dxf");
      if (soort === "lastenboek") download(`${naam}-lastenboek.csv`, lastenboekCSV(lb, project.naam, prijzen, btw), "text/csv;charset=utf-8");
      if (soort === "csv") download(`${naam}-meetstaat.csv`, meetstaatCSV(rijen), "text/csv;charset=utf-8");
      if (soort === "json") download(`${naam}.json`, JSON.stringify(project, null, 2), "application/json");
    } catch (e) {
      zetMelding(`Export mislukt: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <main className="werkblad">
      <section className="plan-kolom">
        <div className="tabs">
          {[...project.verdiepingen.map((x, i) => ({ x, i }))].reverse().map(({ x, i }) => (
            <button key={x.id} className={i === vi ? "actief" : ""} onClick={() => { zetVi(i); zetNieuweVerdieping(false); }} title={`peil ${peilTekst(x.peil)}`}>
              {x.naam} <span className="peil">{peilTekst(x.peil)}</span>
            </button>
          ))}
          <button className="tab-nieuw" onClick={() => { zetNieuweVerdieping(true); zetSelectie(null); }}>+ Verdieping</button>
        </div>
        <div className="plan-houder">
          <div className="plan" onClick={klik} {...slepen.handlers} dangerouslySetInnerHTML={{ __html: svg }} />
          {slepen.info && <div className={`sleep-info${slepen.info.fout ? " fout" : ""}`} role="status">{slepen.info.tekst}</div>}
        </div>
        <p className="hint">Klik op een muur of maat om ze aan te passen, of op een ruimte om naam en hoogte te wijzigen. <strong>Slepen:</strong> een muur haaks verschuiven, of een raam of deur naar een andere plaats of muur (op de gsm: tik de muur eerst aan). Maatkleur: <span className="k-scan">gescand</span> · <span className="k-corr">ingegeven</span> · <span className="k-laser">laser</span> · <span className="legende-overgenomen">overgenomen</span>. Codes R/D/O verwijzen naar de openingenlijst in de PDF.</p>
        <div className="export">
          <button className="primair" onClick={() => exporteer("pdf")}>PDF-plan</button>
          <button onClick={() => exporteer("dxf")}>DXF (CAD)</button>
          <button onClick={() => exporteer("csv")}>Meetstaat (Excel)</button>
          <button onClick={() => exporteer("lastenboek")}>Lastenboek (Excel)</button>
          <button onClick={() => exporteer("json")}>Projectbestand</button>
        </div>
        {fouten.length > 0 && (
          <div className="fouten"><strong>Controle:</strong><ul>{fouten.map((f, i) => <li key={i}>{f.melding}</li>)}</ul></div>
        )}
      </section>

      <aside className="paneel">
        {kort && <div className="bevestiging" role="status">{kort}</div>}
        {nieuweVerdieping ? (
          <NieuweVerdieping
            project={project}
            huidige={v}
            annuleer={() => zetNieuweVerdieping(false)}
            maak={(i) => {
              try {
                const r = voegVerdiepingToe(project, i);
                wijzigProject(r.project);
                zetVi(r.project.verdiepingen.findIndex((x) => x.id === r.verdiepingId)); // naar de nieuwe verdieping
                zetNieuweVerdieping(false);
                zetMelding(null);
              } catch (e) {
                zetMelding(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        ) : muur ? (
          <MuurPaneel key={muur.id} muur={muur} v={v} wijzig={wijzig} sluit={() => zetSelectie(null)} meld={zetMelding} kiesMuur={(id) => zetSelectie({ soort: "muur", id })} />
        ) : ruimte ? (
          <RuimtePaneel key={ruimte.id} ruimte={ruimte} v={v} wijzig={wijzig} sluit={() => zetSelectie(null)} />
        ) : (
          <section className="kaart">
            <h2>Project</h2>
            <Veld label="Projectnaam">
              <input defaultValue={project.naam} key={project.naam} onBlur={(e) => e.target.value.trim() && e.target.value !== project.naam && wijzigProject({ ...project, naam: e.target.value.trim() })} />
            </Veld>
            <p className="uitleg">Selecteer een muur in het plan om de binnenmaat te wijzigen of een raam of deur toe te voegen, of een ruimte voor notities en een trapgat.</p>
            <Veld label="Notities project (werf)">
              <textarea rows={3} defaultValue={project.notities ?? ""} key={project.id + "-n"} placeholder="bv. sleutel bij buren, parkeren achteraan, asbestattest gevraagd"
                onBlur={(e) => { const t = e.target.value.trim(); if (t !== (project.notities ?? "")) wijzigProject({ ...project, notities: t || undefined }); }} />
            </Veld>
            <h3>Verdieping</h3>
            <div className="rij">
              <Veld label="Naam verdieping">
                <input defaultValue={v.naam} key={v.id + v.naam} onBlur={(e) => e.target.value.trim() && e.target.value !== v.naam && pasProjectAan(() => hernoemVerdieping(project, v.id, e.target.value))} />
              </Veld>
              <Veld label="Vloerpeil (mm)">
                <input type="number" inputMode="numeric" defaultValue={v.peil} key={v.id + v.peil} onBlur={(e) => { const x = Math.round(+e.target.value); if (Number.isFinite(x) && x !== v.peil) pasProjectAan(() => zetPeil(project, v.id, x)); }} />
              </Veld>
            </div>
            {meerdere && (
              <button className="gevaar" onClick={() => { if (confirm(`Verdieping '${v.naam}' verwijderen? Dit kan je ongedaan maken met 'Ongedaan maken'.`)) { pasProjectAan(() => verwijderVerdieping(project, v.id)); zetVi(0); } }}>
                Verdieping verwijderen
              </button>
            )}
          </section>
        )}

        <section className="kaart">
          <div className="kaart-kop">
            <h2>Meetstaat</h2>
            <div className="schakelaar" role="tablist">
              <button role="tab" aria-selected={weergave === "ruimtes"} className={weergave === "ruimtes" ? "actief" : ""} onClick={() => zetWeergave("ruimtes")}>Per ruimte</button>
              <button role="tab" aria-selected={weergave === "lastenboek"} className={weergave === "lastenboek" ? "actief" : ""} onClick={() => zetWeergave("lastenboek")}>Lastenboek</button>
            </div>
          </div>
          {weergave === "lastenboek" ? (
            <LastenboekWeergave lb={lb} prijzen={prijzen} zetPrijs={zetPrijs} btw={btw} zetBtw={(b) => { zetBtw(b); schrijfOpslag(BTW, b); }} kopieer={kopieer} />
          ) : (
          <div className="tabel-wrap">
            <table>
              <thead><tr><th>Ruimte</th><th>Vloer m²</th><th>Wand netto m²</th><th>Volume m³</th></tr></thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.verdieping + r.ruimte}><td>{meerdere ? `${r.ruimte} (${r.verdieping})` : r.ruimte}</td><td>{getal(r.vloerM2)}</td><td>{getal(r.wandNettoM2)}</td><td>{getal(r.volumeM3)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td>Totaal</td><td>{getal(rijen.reduce((s, r) => s + r.vloerM2, 0))}</td><td>{getal(rijen.reduce((s, r) => s + r.wandNettoM2, 0))}</td><td>{getal(rijen.reduce((s, r) => s + r.volumeM3, 0))}</td></tr></tfoot>
            </table>
          </div>
          )}
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

function MuurPaneel({ muur, v, wijzig, sluit, meld, kiesMuur }: { muur: Muur; v: Verdieping; wijzig: (f: (v: Verdieping) => Verdieping) => boolean; sluit: () => void; meld: (s: string | null) => void; kiesMuur: (id: string) => void }) {
  const binnen = Math.round(binnenLengte(muur, v.muren));
  const [bewerkId, zetBewerkId] = useState<string | null>(null);
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

      <PositieCorrigeren muur={muur} wijzig={wijzig} />

      <h3>Ramen en deuren</h3>
      {openingen.length === 0 && <p className="uitleg">Nog geen openingen in deze muur.</p>}
      <ul className="openingen">
        {openingen.map((o) => bewerkId === o.id ? (
          <li key={o.id} className="bewerk">
            <form onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const naar = String(d.get("muur"));
              const ok = wijzig((x) => {
                const doel = x.muren.find((w) => w.id === naar)!;
                return wijzigOpening(x, o.id, {
                  muurId: naar, offset: +d.get("afstand")! + Math.round(aansluitingen(doel, x.muren).start),
                  breedte: +d.get("breedte")!, hoogte: +d.get("hoogte")!, borstwering: +d.get("borstwering")!,
                });
              });
              if (ok) { zetBewerkId(null); if (naar !== muur.id) kiesMuur(naar); }
            }}>
              <Veld label="Muur">
                <select name="muur" defaultValue={muur.id}>
                  {v.muren.map((w) => ({ id: w.id, naam: muurOmschrijving(v, w.id) })).sort((a, b) => a.naam.localeCompare(b.naam, "nl")).map((w) => (
                    <option key={w.id} value={w.id}>{w.id === muur.id ? `${w.naam} (huidige)` : w.naam}</option>
                  ))}
                </select>
              </Veld>
              <div className="rij">
                <Veld label={`${o.soort}: van hoek A`}><input name="afstand" type="number" inputMode="numeric" min={0} defaultValue={Math.round(o.offset - aans.start)} /></Veld>
                <Veld label="Breedte"><input name="breedte" type="number" inputMode="numeric" min={1} defaultValue={o.breedte} /></Veld>
              </div>
              <div className="rij">
                <Veld label="Hoogte"><input name="hoogte" type="number" inputMode="numeric" min={1} defaultValue={o.hoogte} /></Veld>
                <Veld label="Borstwering"><input name="borstwering" type="number" inputMode="numeric" min={0} defaultValue={o.borstwering} /></Veld>
              </div>
              <div className="acties"><button className="primair" type="submit">Opslaan</button><button type="button" onClick={() => zetBewerkId(null)}>Annuleren</button></div>
            </form>
          </li>
        ) : (
          <li key={o.id}>
            <span>{o.soort} {o.breedte} × {o.hoogte}{o.borstwering ? `, borstwering ${o.borstwering}` : ""} — op {Math.round(o.offset - aans.start)} mm van A</span>
            <span className="knopjes">
              <button onClick={() => zetBewerkId(o.id)}>Wijzig</button>
              <button onClick={() => wijzig((x) => verwijderOpening(x, o.id))} aria-label="Verwijderen">Verwijder</button>
            </span>
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

      {v.ruimtes.filter((r) => r.muurIds.includes(muur.id)).length < 2 ? (
        <RuimteErnaast muur={muur} v={v} binnen={binnen} wijzig={wijzig} klaar={sluit} />
      ) : (
        <>
          <h3>Muur uitbreken</h3>
          <p className="uitleg">De twee ruimtes worden één ruimte, ook als ze niet even breed zijn (bv. een L-vorm). Ramen en deuren in deze muur verdwijnen. Muurstukken die daarna recht doorlopen, worden terug één muur.</p>
          <button className="gevaar" onClick={() => {
            const waarschuwing = muur.dragend === "niet-dragend"
              ? "Deze muur is aangeduid als niet-dragend. Toch uitbreken?"
              : `LET OP: deze muur is ${muur.dragend === "bevestigd" ? "DRAGEND" : muur.dragend === "vermoeden" ? "vermoedelijk dragend" : "mogelijk dragend (onbekend)"}.\n\nEen dragende muur wegnemen vraagt een stabiliteitsstudie door een ingenieur (stalen ligger, kolommen, tijdelijke stutten) en meestal een omgevingsvergunning met architect. Dit plan is enkel een voorstel.\n\nToch uitbreken in het plan?`;
            if (confirm(waarschuwing) && wijzig((x) => breekMuurUit(x, muur.id))) sluit();
          }}>Muur uitbreken</button>
        </>
      )}
    </section>
  );
}

function RuimteErnaast({ muur, v, binnen, wijzig, klaar }: { muur: Muur; v: Verdieping; binnen: number; wijzig: (f: (v: Verdieping) => Verdieping) => boolean; klaar: () => void }) {
  const buur = v.ruimtes.find((r) => r.muurIds.includes(muur.id));
  const [open, zetOpen] = useState(false);
  const [f, zetF] = useState({
    naam: "", breedte: String(binnen), diepte: "", afstand: "0",
    dikte: String(muur.dikte), hoogte: String(buur?.plafondhoogte ?? 2600), methode: "manueel" as "manueel" | "laser",
  });
  const zet = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => zetF({ ...f, [k]: e.target.value });
  if (!open) return <button className="ruimte-erbij" onClick={() => zetOpen(true)}>+ Ruimte hiernaast toevoegen</button>;
  return (
    <form className="nieuwe-ruimte" onSubmit={(e) => {
      e.preventDefault();
      const ok = wijzig((x) => voegRuimteToe(x, {
        muurId: muur.id, naam: f.naam, breedte: +f.breedte, diepte: +f.diepte, afstandVanafA: +f.afstand || 0,
        muurdikte: +f.dikte, plafondhoogte: +f.hoogte, methode: f.methode,
      }));
      if (ok) klaar();
    }}>
      <h3>Ruimte hiernaast toevoegen</h3>
      <p className="uitleg">Deze muur wordt de tussenmuur. Binnenmaten van de nieuwe ruimte in mm.</p>
      <Veld label="Naam nieuwe ruimte"><input value={f.naam} onChange={zet("naam")} placeholder="bv. Keuken" required /></Veld>
      <div className="rij">
        <Veld label="Breedte langs deze muur"><input type="number" inputMode="numeric" min={1} value={f.breedte} onChange={zet("breedte")} required /></Veld>
        <Veld label="Diepte"><input type="number" inputMode="numeric" min={1} value={f.diepte} onChange={zet("diepte")} required /></Veld>
      </div>
      <div className="rij">
        <Veld label="Begint op (mm van hoek A)"><input type="number" inputMode="numeric" min={0} value={f.afstand} onChange={zet("afstand")} /></Veld>
        <Veld label="Dikte nieuwe muren"><input type="number" inputMode="numeric" min={1} value={f.dikte} onChange={zet("dikte")} /></Veld>
      </div>
      <div className="rij">
        <Veld label="Plafondhoogte nieuwe ruimte"><input type="number" inputMode="numeric" min={1} value={f.hoogte} onChange={zet("hoogte")} /></Veld>
        <Veld label="Gemeten met (nieuwe ruimte)">
          <select value={f.methode} onChange={zet("methode")}>
            <option value="manueel">Rolmeter</option>
            <option value="laser">Laser</option>
          </select>
        </Veld>
      </div>
      <div className="acties">
        <button className="primair" type="submit">Ruimte toevoegen</button>
        <button type="button" onClick={() => zetOpen(false)}>Annuleren</button>
      </div>
    </form>
  );
}

function strings(o: { breedte: number; hoogte: number; borstwering: number }) {
  return { breedte: String(o.breedte), hoogte: String(o.hoogte), borstwering: String(o.borstwering) };
}

function NieuweVerdieping({ project, huidige, maak, annuleer }: {
  project: Project;
  huidige: Verdieping;
  maak: (i: Parameters<typeof voegVerdiepingToe>[1]) => void;
  annuleer: () => void;
}) {
  const bovenste = [...project.verdiepingen].sort((a, b) => b.peil - a.peil)[0]!;
  const [f, zetF] = useState({
    naam: project.verdiepingen.length === 1 ? "Eerste verdieping" : `Verdieping ${project.verdiepingen.length}`,
    modus: "kopie" as "kopie" | "rechthoek",
    peil: String(volgendPeil(bovenste)),
    breedte: "", diepte: "", hoogte: "2600", dikte: "300",
  });
  const zet = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => zetF({ ...f, [k]: e.target.value });
  return (
    <section className="kaart">
      <div className="kaart-kop"><h2>Nieuwe verdieping</h2><button onClick={annuleer} aria-label="Sluiten">×</button></div>
      <form onSubmit={(e) => {
        e.preventDefault();
        const peil = Math.round(+f.peil);
        if (f.modus === "kopie") maak({ modus: "kopie", naam: f.naam, vanId: huidige.id, peil });
        else maak({ modus: "rechthoek", naam: f.naam, peil, binnenBreedte: +f.breedte, binnenDiepte: +f.diepte, plafondhoogte: +f.hoogte, muurdikte: +f.dikte });
      }}>
        <Veld label="Naam van de verdieping"><input value={f.naam} onChange={zet("naam")} required /></Veld>
        <Veld label="Starten met">
          <select value={f.modus} onChange={zet("modus")}>
            <option value="kopie">Kopie van de indeling van '{huidige.naam}'</option>
            <option value="rechthoek">Nieuwe rechthoekige ruimte</option>
          </select>
        </Veld>
        <Veld label="Vloerpeil (mm boven ±0)"><input type="number" inputMode="numeric" value={f.peil} onChange={zet("peil")} required /></Veld>
        {f.modus === "kopie" ? (
          <p className="uitleg">Muren en ruimtes worden overgenomen (grijs: nog niet gemeten), zonder ramen en deuren. Meet ze na en pas ze aan per muur.</p>
        ) : (
          <>
            <div className="rij">
              <Veld label="Binnenbreedte"><input type="number" inputMode="numeric" min={1} value={f.breedte} onChange={zet("breedte")} required /></Veld>
              <Veld label="Binnendiepte"><input type="number" inputMode="numeric" min={1} value={f.diepte} onChange={zet("diepte")} required /></Veld>
            </div>
            <div className="rij">
              <Veld label="Plafondhoogte"><input type="number" inputMode="numeric" min={1} value={f.hoogte} onChange={zet("hoogte")} /></Veld>
              <Veld label="Muurdikte"><input type="number" inputMode="numeric" min={1} value={f.dikte} onChange={zet("dikte")} /></Veld>
            </div>
          </>
        )}
        <div className="acties">
          <button className="primair" type="submit">Verdieping maken</button>
          <button type="button" onClick={annuleer}>Annuleren</button>
        </div>
      </form>
    </section>
  );
}

function PositieCorrigeren({ muur, wijzig }: { muur: Muur; wijzig: (f: (v: Verdieping) => Verdieping) => boolean }) {
  const [afstand, zetAfstand] = useState("");
  const [methode, zetMethode] = useState<"gecorrigeerd" | "manueel" | "laser">("gecorrigeerd");
  const richtingen = verschuifRichtingen(muur);
  const mm = Math.round(+afstand);
  return (
    <div className="positie">
      <h3>Positie corrigeren</h3>
      <p className="uitleg">Staat de muur in werkelijkheid elders dan op het plan? Verschuif ze. Aansluitende muren en ruimtes passen zich aan; ramen in andere muren blijven op hun plaats.</p>
      <div className="rij">
        <Veld label="Verschuiven over (mm)"><input type="number" inputMode="numeric" min={1} value={afstand} onChange={(e) => zetAfstand(e.target.value)} placeholder="bv. 50" /></Veld>
        <Veld label="Meetwijze verschuiving">
          <select value={methode} onChange={(e) => zetMethode(e.target.value as typeof methode)}>
            <option value="gecorrigeerd">Correctie</option>
            <option value="manueel">Rolmeter</option>
            <option value="laser">Laser</option>
          </select>
        </Veld>
      </div>
      <div className="acties">
        {richtingen.map((r) => (
          <button key={r.teken} type="button" disabled={!(mm > 0)} onClick={() => { if (wijzig((x) => verschuifMuur(x, muur.id, mm * r.teken, methode))) zetAfstand(""); }}>
            Verschuif {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
