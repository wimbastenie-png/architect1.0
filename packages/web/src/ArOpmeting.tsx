/**
 * Opmeten met de camera via WebXR (Chrome op Android met ARCore).
 * De gebruiker richt het kruisje op de hoeken van de vloer en tikt.
 * Geen 3D-weergave nodig: het camerabeeld toont de browser zelf, het kruisje
 * en de knoppen staan in een DOM-overlay.
 *
 * Niet getest op een toestel in deze versie: zie README "Wat nog niet lukt".
 */
import {
  haaksMaken,
  projectUitHoekpunten,
  verdiepingNaarSVG,
  verdiepingUitHoekpunten,
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

/** Testpunten voor de demo zonder camera (?ar-demo): een scheve, onnauwkeurige kamer van ±4,2 × 3,1 m. */
export const DEMO_PUNTEN: Punt[] = [
  { x: 0, y: 0 }, { x: 4180, y: 610 }, { x: 3740, y: 3690 }, { x: -470, y: 3050 },
];

export function ArOpmeting({ onPunten, onStop }: { onPunten: (p: Punt[]) => void; onStop: () => void }) {
  const overlay = useRef<HTMLDivElement>(null);
  const sessie = useRef<XRSessie | null>(null);
  const huidig = useRef<Punt | null>(null);
  const [actief, zetActief] = useState(false);
  const [punten, zetPunten] = useState<Punt[]>([]);
  const [richt, zetRicht] = useState<Punt | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const puntenRef = useRef<Punt[]>([]);
  puntenRef.current = punten;

  useEffect(() => () => { void sessie.current?.end?.().catch(() => {}); }, []);

  const voegToe = () => {
    const p = huidig.current;
    if (p) zetPunten((x) => [...x, { x: Math.round(p.x), y: Math.round(p.y) }]);
  };

  const start = async () => {
    zetFout(null);
    try {
      const s: XRSessie = await xr().requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlay.current },
      });
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl", { xrCompatible: true }) as WebGLRenderingContext;
      const XRWebGLLayer = (window as any).XRWebGLLayer;
      await s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      const ruimte = await s.requestReferenceSpace("local");
      const kijker = await s.requestReferenceSpace("viewer");
      const bron = await s.requestHitTestSource({ space: kijker });
      let laatsteUpdate = 0;
      const frame = (t: number, f: any) => {
        s.requestAnimationFrame(frame);
        const raak = f.getHitTestResults(bron)[0]?.getPose(ruimte);
        // x naar rechts, −z naar voren → plan-x, plan-y (mm)
        huidig.current = raak ? { x: raak.transform.position.x * 1000, y: -raak.transform.position.z * 1000 } : null;
        if (t - laatsteUpdate > 120) { laatsteUpdate = t; zetRicht(huidig.current); }
        gl.bindFramebuffer(gl.FRAMEBUFFER, s.renderState.baseLayer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      };
      s.requestAnimationFrame(frame);
      // tik op het scherm (buiten de knoppen) = hoek zetten
      s.addEventListener("select", voegToe);
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

  const klaar = async () => {
    const p = puntenRef.current;
    await sessie.current?.end?.().catch(() => {});
    onPunten(p);
  };

  const vorige = punten[punten.length - 1];
  const afstand = vorige && richt ? Math.hypot(richt.x - vorige.x, richt.y - vorige.y) : null;

  return (
    <section className="kaart">
      <h2>Opmeten met de camera</h2>
      <p className="uitleg">
        Richt het kruisje op een <strong>hoek van de vloer</strong> en tik op het scherm. Ga rond de ruimte, hoek per hoek, en tik op <strong>Klaar</strong>.
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
          {richt ? `Hoek ${punten.length + 1}` : "Zoek de vloer: beweeg de gsm rustig"}
          {afstand !== null && <> · {Math.round(afstand / 10)} cm van vorige</>}
        </div>
        <div className="ar-knoppen">
          <button onClick={() => zetPunten((x) => x.slice(0, -1))} disabled={!punten.length}>Ongedaan</button>
          <button onClick={voegToe} disabled={!richt}>Hoek zetten</button>
          <button className="primair" onClick={klaar} disabled={punten.length < 3}>Klaar ({punten.length})</button>
          <button onClick={() => { void sessie.current?.end?.(); onStop(); }}>Stop</button>
        </div>
      </div>
    </section>
  );
}

export function ArResultaat({ punten, onMaak, onOpnieuw }: { punten: Punt[]; onMaak: (p: Project) => void; onOpnieuw: () => void }) {
  const [f, zetF] = useState({ naam: "", ruimteNaam: "Ruimte 1", dikte: "200", hoogte: "2600", haaks: true });
  const zet = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => zetF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const verwerkt = useMemo(() => {
    try {
      return { punten: f.haaks ? haaksMaken(punten).punten : punten, fout: null as string | null };
    } catch (e) {
      return { punten: null, fout: (e as Error).message };
    }
  }, [punten, f.haaks]);
  const opties = { naam: f.naam.trim() || "Opmeting camera", ruimteNaam: f.ruimteNaam.trim() || "Ruimte 1", muurdikte: +f.dikte || 200, plafondhoogte: +f.hoogte || 2600, toestel: "camera (WebXR)" };
  const svg = useMemo(() => {
    if (!verwerkt.punten) return "";
    try { return verdiepingNaarSVG(verdiepingUitHoekpunten(verwerkt.punten, opties)); } catch { return ""; }
  }, [verwerkt, opties.muurdikte, opties.plafondhoogte]);

  return (
    <section className="kaart">
      <h2>Resultaat camera-opmeting</h2>
      <p className="uitleg">{punten.length} hoeken aangetikt. Controleer het plan, vul de hoogte in (meet die met rolmeter of laser) en maak het project. Maten zijn oranje (gescand) tot je ze nameet.</p>
      {verwerkt.fout && <p className="melding" role="alert">{verwerkt.fout}</p>}
      {svg && <div className="plan klein" dangerouslySetInnerHTML={{ __html: svg }} />}
      <label className="vinkje"><input type="checkbox" checked={f.haaks} onChange={zet("haaks")} /> Haaks maken (aanbevolen)</label>
      <div className="velden">
        <Veld label="Projectnaam"><input value={f.naam} onChange={zet("naam")} placeholder="bv. Keuken Kerkstraat 5" /></Veld>
        <Veld label="Naam ruimte"><input value={f.ruimteNaam} onChange={zet("ruimteNaam")} /></Veld>
        <Veld label="Muurdikte (mm)"><input type="number" inputMode="numeric" min={1} value={f.dikte} onChange={zet("dikte")} /></Veld>
        <Veld label="Plafondhoogte (mm)"><input type="number" inputMode="numeric" min={1} value={f.hoogte} onChange={zet("hoogte")} /></Veld>
      </div>
      <div className="acties">
        <button className="primair" disabled={!verwerkt.punten} onClick={() => verwerkt.punten && onMaak(projectUitHoekpunten(verwerkt.punten, opties))}>Plan maken</button>
        <button onClick={onOpnieuw}>Opnieuw opmeten</button>
      </div>
    </section>
  );
}
