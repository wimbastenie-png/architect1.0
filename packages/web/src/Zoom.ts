/**
 * Inzoomen in het plan.
 * - knoppen: +, −, passend (alles in beeld)
 * - gsm: knijpen met twee vingers (zoomen rond het punt tussen de vingers)
 *   en met twee vingers schuiven (verplaatsen). Eén vinger blijft: vegen =
 *   pagina scrollen, ingedrukt houden = slepen (zie Slepen.ts).
 * - pc: Ctrl + muiswiel of knijpen op het touchpad, en het beeld verschuiven
 *   door op een lege plek of een ruimte te slepen.
 *
 * De zoom is een deel van het volledige tekenkader met dezelfde verhouding,
 * zodat de tekening op het scherm even groot blijft (geen verspringende pagina).
 */
import { tekenKader, type Verdieping } from "@scanapp/core";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

export const MAX_ZOOM = 20;
const STAP = 1.5; // per klik op + of −
const DREMPEL_MUIS = 4; // px voor verschuiven begint

type Kader = { minX: number; maxX: number; minY: number; maxY: number };
interface Zicht { z: number; cx: number; cy: number }

const klem = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Zicht binnen het volledige kader houden (niet verder dan de rand schuiven). */
function binnen(z: number, cx: number, cy: number, vol: Kader): Zicht {
  z = klem(z, 1, MAX_ZOOM);
  const w = (vol.maxX - vol.minX) / z, h = (vol.maxY - vol.minY) / z;
  return {
    z,
    cx: klem(cx, vol.minX + w / 2, vol.maxX - w / 2),
    cy: klem(cy, vol.minY + h / 2, vol.maxY - h / 2),
  };
}

export function useZoom(opties: { v: Verdieping; houder: RefObject<HTMLDivElement | null> }) {
  const vol = useMemo(() => tekenKader(opties.v), [opties.v]);
  const [zicht, zetZicht] = useState<Zicht | null>(null); // null = passend
  const laatst = useRef({ vol, zicht });
  laatst.current = { vol, zicht };

  // andere verdieping of ander project: terug naar passend
  useEffect(() => zetZicht(null), [opties.v.id]);

  const kader: Kader | undefined = useMemo(() => {
    if (!zicht) return undefined;
    const w = (vol.maxX - vol.minX) / zicht.z, h = (vol.maxY - vol.minY) / zicht.z;
    return { minX: zicht.cx - w / 2, maxX: zicht.cx + w / 2, minY: zicht.cy - h / 2, maxY: zicht.cy + h / 2 };
  }, [zicht, vol]);

  const huidig = (): Zicht => {
    const v0 = laatst.current.vol; // altijd het actuele kader (het plan kan intussen veranderd zijn)
    return laatst.current.zicht ?? { z: 1, cx: (v0.minX + v0.maxX) / 2, cy: (v0.minY + v0.maxY) / 2 };
  };
  const zet = (z: Zicht | null) => zetZicht(z && z.z <= 1.0001 ? null : z);

  /**
   * Zoom naar factor `z`, zodat het planpunt dat nu op schermpositie (sx, sy)
   * ligt, daar blijft liggen. Gebruikt de omzetting plan → scherm van de svg:
   * schermX = a·(x − minX) + e, schermY = a·(maxY − y) + f; bij dezelfde
   * verhouding blijven e en f gelijk, a schaalt mee met de zoom.
   */
  const zoomRond = (z: number, sx: number, sy: number, planpunt?: { x: number; y: number }) => {
    const svg = opties.houder.current?.querySelector("svg");
    const ctm = svg?.getScreenCTM();
    const nu = huidig();
    const v0 = laatst.current.vol;
    if (!svg || !ctm) return zet(binnen(z, nu.cx, nu.cy, v0));
    const minX = Number(svg.dataset.minX), maxY = Number(svg.dataset.maxY);
    const p = planpunt ?? { x: minX + (sx - ctm.e) / ctm.a, y: maxY - (sy - ctm.f) / ctm.a };
    const zn = klem(z, 1, MAX_ZOOM);
    const a = (ctm.a * zn) / nu.z;
    const nMinX = p.x - (sx - ctm.e) / a, nMaxY = p.y + (sy - ctm.f) / a;
    const w = (v0.maxX - v0.minX) / zn, h = (v0.maxY - v0.minY) / zn;
    zet(binnen(zn, nMinX + w / 2, nMaxY - h / 2, v0));
  };

  /** Knoppen: zoomen rond het midden van het beeld. */
  const knop = (richting: 1 | -1 | 0) => {
    if (richting === 0) return zet(null);
    const nu = huidig();
    zet(binnen(richting > 0 ? nu.z * STAP : nu.z / STAP, nu.cx, nu.cy, laatst.current.vol));
  };

  // ---------------------------------------------------------------- muis: beeld verschuiven
  const pan = useRef<{ x: number; y: number; zicht: Zicht; bezig: boolean } | null>(null);
  const negeer = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    negeer.current = false;
    if (e.pointerType === "touch" || e.button !== 0 || !laatst.current.zicht) return;
    // op muren, ramen en hoeken begint slepen (Slepen.ts), niet verschuiven
    if ((e.target as Element).closest("[data-raak], [data-hoek], polygon[data-muur], polygon[data-opening]")) return;
    pan.current = { x: e.clientX, y: e.clientY, zicht: laatst.current.zicht, bezig: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p || e.pointerType === "touch") return;
    if (!p.bezig) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DREMPEL_MUIS) return;
      p.bezig = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const a = opties.houder.current?.querySelector("svg")?.getScreenCTM()?.a;
    if (!a) return;
    zet(binnen(p.zicht.z, p.zicht.cx - (e.clientX - p.x) / a, p.zicht.cy + (e.clientY - p.y) / a, laatst.current.vol));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    if (p.bezig) negeer.current = true; // geen selectie-klik na verschuiven
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    pan.current = null;
  };

  // ---------------------------------------------------------------- gsm: knijpen; pc: Ctrl + wiel
  useEffect(() => {
    const houder = opties.houder.current;
    if (!houder) return;
    let knijp: { afstand: number; plan: { x: number; y: number }; z: number; doel: EventTarget | null } | null = null;
    const midden = (t: TouchList) => ({ x: (t[0]!.clientX + t[1]!.clientX) / 2, y: (t[0]!.clientY + t[1]!.clientY) / 2 });
    const afstand = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const svg = houder.querySelector("svg"), ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return;
      const m = midden(e.touches);
      // Elke zoomstap tekent het plan opnieuw: het element onder de vingers verdwijnt dan
      // uit de pagina, en mobiele browsers sturen de volgende bewegingen naar dat element
      // (niet meer naar het plan). Daarom luisteren we op dat element zelf.
      const doel = e.touches[0]!.target;
      knijp = {
        afstand: Math.max(1, afstand(e.touches)),
        plan: { x: Number(svg.dataset.minX) + (m.x - ctm.e) / ctm.a, y: Number(svg.dataset.maxY) - (m.y - ctm.f) / ctm.a },
        z: (laatst.current.zicht?.z ?? 1),
        doel,
      };
      if (doel && doel !== houder) {
        doel.addEventListener("touchmove", beweging as EventListener, { passive: false });
        doel.addEventListener("touchend", einde as EventListener);
        doel.addEventListener("touchcancel", einde as EventListener);
      }
    };
    const beweging = (e: TouchEvent) => {
      if (!knijp || e.touches.length !== 2 || (e as TouchEvent & { _zoom?: boolean })._zoom) return;
      (e as TouchEvent & { _zoom?: boolean })._zoom = true; // niet dubbel verwerken (doel + plan)
      if (e.cancelable) e.preventDefault(); // niet de hele pagina zoomen of scrollen
      const m = midden(e.touches);
      // hetzelfde planpunt onder het (verschoven) midden houden: zoomen én schuiven
      zoomRond(knijp.z * (afstand(e.touches) / knijp.afstand), m.x, m.y, knijp.plan);
    };
    const einde = (e: TouchEvent) => {
      if (e.touches.length >= 2 || !knijp) return;
      const d = knijp.doel;
      if (d && d !== houder) {
        d.removeEventListener("touchmove", beweging as EventListener);
        d.removeEventListener("touchend", einde as EventListener);
        d.removeEventListener("touchcancel", einde as EventListener);
      }
      knijp = null;
    };
    const wiel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // gewoon scrollen blijft scrollen; Ctrl + wiel of knijpen op het touchpad zoomt
      e.preventDefault();
      zoomRond(huidig().z * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    houder.addEventListener("touchstart", start, { passive: true });
    houder.addEventListener("touchmove", beweging, { passive: false });
    houder.addEventListener("touchend", einde);
    houder.addEventListener("touchcancel", einde);
    houder.addEventListener("wheel", wiel, { passive: false });
    return () => {
      houder.removeEventListener("touchstart", start);
      houder.removeEventListener("touchmove", beweging);
      houder.removeEventListener("touchend", einde);
      houder.removeEventListener("touchcancel", einde);
      houder.removeEventListener("wheel", wiel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opties.houder]);

  const klikNegeren = () => {
    const n = negeer.current;
    negeer.current = false;
    return n;
  };

  return {
    kader,
    factor: zicht?.z ?? 1,
    knop,
    klikNegeren,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
