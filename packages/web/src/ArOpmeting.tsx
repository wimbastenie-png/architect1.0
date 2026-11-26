/**
 * Opmeten met de camera via WebXR (Chrome op Android met ARCore).
 * De gebruiker richt het kruisje op de hoeken van de vloer en tikt.
 * Geen 3D-weergave nodig: het camerabeeld toont de browser zelf, het kruisje
 * en de knoppen staan in een DOM-overlay.
 *
 * Niet getest op een toestel in deze versie: zie README "Wat nog niet lukt".
 */
import {
  projectUitCamera,
  verdiepingNaarSVG,
  type Project,
  type Punt,
} from "@scanapp/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Veld } from "./ui.tsx";

// Minimale WebXR-typen (niet in de standaard TypeScript-bibliotheek).
/* eslint-disable @typescript-eslint/no-explicit-any */
type XRSessie = any;
const xr = (): any => (navigator as any).xr;

export async function arOndersteund(): Promise<boolean> {
  try {
    return Boolean(await xr()?.isSessionSupported?.("immersive-ar"));
  } catch {
    return false;
  }
}

/** Eén opgemeten ruimte: hoeken (mm) en eventueel de gemeten plafondhoogte. */
export interface GemetenKamer {
  punten: Punt[];
  hoogte?: number;
}

/** Testpunten voor de demo zonder camera (?ar-demo): een scheve, onnauwkeurige kamer van ±4,2 × 3,1 m en een berging ernaast. */
export const DEMO_PUNTEN: Punt[] = [
  { x: 0, y: 0 }, { x: 4180, y: 610 }, { x: 3740, y: 3690 }, { x: -470, y: 3050 },
];
const hoekDemo = Math.atan2(610, 4180);
const demoDraai = (x: number, y: number): Punt => ({ x: Math.round(x * Math.cos(hoekDemo) - y * Math.sin(hoekDemo)), y: Math.round(x * Math.sin(hoekDemo) + y * Math.cos(hoekDemo)) });
export const DEMO_KAMERS: GemetenKamer[] = [
  { punten: DEMO_PUNTEN, hoogte: 2610 },
  { punten: [demoDraai(4440, 20), demoDraai(6400, 0), demoDraai(6410, 2200), demoDraai(4430, 2210)], hoogte: 2380 },
];

/** Hoogte meten: plafond − vloer, alleen aannemelijk tussen 1,8 en 6 m. */
export function aannemelijkeHoogte(h: number): boolean {
  return h >= 1800 && h <= 6000;
}

export function ArOpmeting({ onKamers, onStop }: { onKamers: (k: GemetenKamer[]) => void; onStop: () => void }) {
  const overlay = useRef<HTMLDivElement>(null);
  const sessie = useRef<XRSessie | null>(null);
  const huidig = useRef<(Punt & { z: number }) | null>(null);
  const [actief, zetActief] = useState(false);
  const [punten, zetPunten] = useState<Punt[]>([]);
  const [vloerZ, zetVloerZ] = useState<number[]>([]); // hoogte (wereld) van elk hoekpunt
  const [kamers, zetKamers] = useState<GemetenKamer[]>([]);
  const [hoogte, zetHoogte] = useState<number | undefined>(undefined);
  const [modus, zetModus] = useState<"hoeken" | "plafond">("hoeken");
  const [richt, zetRicht] = useState<(Punt & { z: number }) | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const st = useRef({ punten, vloerZ, kamers, hoogte, modus });
  st.current = { punten, vloerZ, kamers, hoogte, modus };

  useEffect(() => () => { void sessie.current?.end?.().catch(() => {}); }, []);

  const vloerHoogte = () => {
    const z = st.current.vloerZ;
    return z.length ? z.reduce((s, x) => s + x, 0) / z.length : null;
  };

  const tik = () => {
    const p = huidig.current;
    if (!p) return;
    if (st.current.modus === "plafond") {
      const v = vloerHoogte();
      if (v === null) return;
      const h = Math.round((p.z - v) / 10) * 10;
      if (aannemelijkeHoogte(h)) { zetHoogte(h); zetModus("hoeken"); }
      return;
    }
    zetPunten((x) => [...x, { x: Math.round(p.x), y: Math.round(p.y) }]);
    zetVloerZ((x) => [...x, p.z]);
  };

  const start = async () => {
    zetFout(null);
    try {
      const s: XRSessie = await xr().requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "plane-detection"],
        domOverlay: { root: overlay.current },
      });
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl", { xrCompatible: true }) as WebGLRenderingContext;
      const XRWebGLLayer = (window as any).XRWebGLLayer;
      await s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      const ruimte = await s.requestReferenceSpace("local");
      const kijker = await s.requestReferenceSpace("viewer");
      // vlakken (vloer én plafond); punten als terugval
      const bron = await s.requestHitTestSource({ space: kijker, entityTypes: ["plane", "point"] }).catch(() => s.requestHitTestSource({ space: kijker }));
      let laatsteUpdate = 0;
      const frame = (t: number, f: any) => {
        s.requestAnimationFrame(frame);
        const raak = f.getHitTestResults(bron)[0]?.getPose(ruimte);
        // x naar rechts, −z naar voren → plan-x, plan-y (mm); y = hoogte
        huidig.current = raak ? { x: raak.transform.position.x * 1000, y: -raak.transform.position.z * 1000, z: raak.transform.position.y * 1000 } : null;
        if (t - laatsteUpdate > 120) { laatsteUpdate = t; zetRicht(huidig.current); }
        gl.bindFramebuffer(gl.FRAMEBUFFER, s.renderState.baseLayer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      };
      s.requestAnimationFrame(frame);
      // tik op het scherm (buiten de knoppen) = hoek zetten / hoogte vastleggen
      s.addEventListener("select", tik);
      s.addEventListener("end", () => { bron.cancel?.(); sessie.current = null; zetActief(false); });
      sessie.current = s;
      zetActief(true);
    } catch (e) {
      zetFout(`De camera-opmeting kon niet starten (${e instanceof Error ? e.message : String(e)}). Gebruik Chrome op een Android-toestel met ARCore.`);
    }
  };

  // knoppen in de overlay mogen geen extra hoekpunt zetten
  useEffect(() => {
    const el = overlay.current;
    const stop = (e: Event) => e.preventDefault();
    el?.addEventListener("beforexrselect", stop);
    return () => el?.removeEventListener("beforexrselect", stop);
  }, []);

  const volgende = () => {
    if (st.current.punten.length < 3) return;
    zetKamers((k) => [...k, { punten: st.current.punten, hoogte: st.current.hoogte }]);
    zetPunten([]);
    zetVloerZ([]);
    zetHoogte(undefined);
  };

  const klaar = async () => {
    const { punten: p, kamers: k, hoogte: h } = st.current;
    await sessie.current?.end?.().catch(() => {});
    onKamers(p.length >= 3 ? [...k, { punten: p, hoogte: h }] : k);
  };

  const vorige = punten[punten.length - 1];
  const afstand = vorige && richt ? Math.hypot(richt.x - vorige.x, richt.y - vorige.y) : null;
  const vh = vloerHoogte();
  const live = modus === "plafond" && richt && vh !== null ? Math.round((richt.z - vh) / 10) * 10 : null;
  const nr = kamers.length + 1;

  return (
    <section className="kaart">
      <h2>Opmeten met de camera</h2>
      <p className="uitleg">
        Richt het kruisje op een <strong>hoek van de vloer</strong> en tik op het scherm. Ga rond de ruimte, hoek per hoek.
        Daarna kan je de <strong>plafondhoogte</strong> meten (richt op het plafond) en met <strong>Volgende ruimte</strong> de ruimte ernaast opmeten,
        zonder de camera te stoppen. Tik op <strong>Klaar</strong> als alles gemeten is.
        Beweeg de gsm eerst rustig over de vloer tot hij de vloer herkent. De nauwkeurigheid hangt af van toestel en licht (schatting: enkele centimeters);
        meet belangrijke maten na met rolmeter of laser.
      </p>
      {fout && <p className="melding" role="alert">{fout}</p>}
      <div className="acties">
        <button className="primair" onClick={start} disabled={actief}>Camera starten</button>
        <button onClick={onStop}>Annuleren</button>
      </div>
      {/* overlay over het camerabeeld (alleen zichtbaar tijdens de AR-sessie) */}
      <div ref={overlay} className={`ar-overlay ${actief ? "aan" : ""}`}>
        <div className="ar-kruis" aria-hidden="true" />
        <div className="ar-status">
          {modus === "plafond"
            ? (live === null ? "Richt op het plafond (lukt het niet: vul de hoogte later in)" : `Plafond: ${(live / 1000).toFixed(2).replace(".", ",")} m${aannemelijkeHoogte(live) ? " · tik om vast te leggen" : " · onwaarschijnlijk, richt op het plafond"}`)
            : richt ? `Ruimte ${nr} · hoek ${punten.length + 1}` : "Zoek de vloer: beweeg de gsm rustig"}
          {modus === "hoeken" && afstand !== null && <> · {Math.round(afstand / 10)} cm van vorige</>}
          {hoogte && modus === "hoeken" && <> · hoogte {(hoogte / 1000).toFixed(2).replace(".", ",")} m</>}
        </div>
        <div className="ar-knoppen">
          {modus === "hoeken" ? (
            <>
              <button onClick={() => { zetPunten((x) => x.slice(0, -1)); zetVloerZ((x) => x.slice(0, -1)); }} disabled={!punten.length}>Ongedaan</button>
              <button onClick={tik} disabled={!richt}>Hoek zetten</button>
              <button onClick={() => zetModus("plafond")} disabled={!punten.length}>Plafond meten</button>
              <button onClick={volgende} disabled={punten.length < 3}>Volgende ruimte</button>
            </>
          ) : (
            <>
              <button onClick={tik} disabled={live === null || !aannemelijkeHoogte(live)}>Hoogte vastleggen</button>
              <button onClick={() => zetModus("hoeken")}>Terug</button>
            </>
          )}
          <button className="primair" onClick={klaar} disabled={punten.length < 3 && !kamers.length}>Klaar ({kamers.length + (punten.length >= 3 ? 1 : 0)})</button>
          <button onClick={() => { void sessie.current?.end?.(); onStop(); }}>Stop</button>
        </div>
      </div>
    </section>
  );
}

export function ArResultaat({ kamers, onMaak, onOpnieuw }: { kamers: GemetenKamer[]; onMaak: (p: Project) => void; onOpnieuw: () => void }) {
  const [f, zetF] = useState({ naam: "", dikte: "200", haaks: true });
  const [per, zetPer] = useState(() => kamers.map((k, i) => ({ naam: `Ruimte ${i + 1}`, hoogte: String(k.hoogte ?? 2600) })));
  const zet = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => zetF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const resultaat = useMemo(() => {
    try {
      const r = projectUitCamera(
        kamers.map((k, i) => ({ naam: per[i]!.naam.trim() || `Ruimte ${i + 1}`, punten: k.punten, plafondhoogte: +per[i]!.hoogte || 2600 })),
        { naam: f.naam.trim() || "Opmeting camera", muurdikte: +f.dikte || 200, tolerantie: f.haaks ? 8 : 0, toestel: "camera (WebXR)" },
      );
      return { ...r, fout: null as string | null };
    } catch (e) {
      return { project: null, meldingen: [] as string[], fout: (e as Error).message };
    }
  }, [kamers, per, f]);
  const svg = useMemo(() => (resultaat.project ? verdiepingNaarSVG(resultaat.project.verdiepingen[0]!) : ""), [resultaat]);

  return (
    <section className="kaart">
      <h2>Resultaat camera-opmeting</h2>
      <p className="uitleg">{kamers.length === 1 ? "1 ruimte" : `${kamers.length} ruimtes`} opgemeten ({kamers.map((k) => k.punten.length).join(" + ")} hoeken). Controleer het plan, vul hoogtes aan en maak het project. Maten zijn oranje (gescand) tot je ze nameet.</p>
      {resultaat.fout && <p className="melding" role="alert">{resultaat.fout}</p>}
      {svg && <div className="plan klein" dangerouslySetInnerHTML={{ __html: svg }} />}
      {resultaat.meldingen.length > 0 && <ul className="uitleg ar-meldingen">{resultaat.meldingen.map((m) => <li key={m}>{m}</li>)}</ul>}
      <label className="vinkje"><input type="checkbox" checked={f.haaks} onChange={zet("haaks")} /> Haaks maken waar het kan (muren die minder dan 8° afwijken; echt schuine muren blijven schuin)</label>
      <div className="velden">
        <Veld label="Projectnaam"><input value={f.naam} onChange={zet("naam")} placeholder="bv. Keuken Kerkstraat 5" /></Veld>
        <Veld label="Muurdikte (mm)"><input type="number" inputMode="numeric" min={1} value={f.dikte} onChange={zet("dikte")} /></Veld>
      </div>
      {per.map((r, i) => (
        <div className="velden" key={i}>
          <Veld label={`Naam ruimte ${i + 1}`}><input value={r.naam} onChange={(e) => zetPer(per.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)))} /></Veld>
          <Veld label={`Plafondhoogte ruimte ${i + 1} (mm)${kamers[i]!.hoogte ? " · gemeten" : ""}`}><input type="number" inputMode="numeric" min={1} value={r.hoogte} onChange={(e) => zetPer(per.map((x, j) => (j === i ? { ...x, hoogte: e.target.value } : x)))} /></Veld>
        </div>
      ))}
      <div className="acties">
        <button className="primair" disabled={!resultaat.project} onClick={() => resultaat.project && onMaak(resultaat.project)}>Plan maken</button>
        <button onClick={onOpnieuw}>Opnieuw opmeten</button>
      </div>
    </section>
  );
}
