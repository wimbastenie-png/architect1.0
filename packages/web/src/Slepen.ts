/**
 * Slepen in het plan met vinger of muis:
 * - een muur: haaks verschuiven (stappen van 10 mm), via verschuifMuur
 * - een raam of deur: langs haar muur of naar een andere muur (klikt vast op
 *   de dichtstbijzijnde muur), via wijzigOpening
 *
 * Met de muis kan je meteen slepen. Met de vinger moet de muur eerst
 * aangetikt (geselecteerd) zijn: anders zou je niet meer over het plan
 * kunnen scrollen. Tijdens het slepen tonen we een voorbeeld; pas bij het
 * loslaten wordt het één stap in de geschiedenis (ongedaan maken).
 */
import { aansluitingen, richtingLabel, verplaatsHoek, muurBijPunt, muurLengte, muurOmschrijving, verschuifMuur, verschuifRichtingen, wijzigOpening, type Punt, type Verdieping } from "@scanapp/core";
import { useRef, useState } from "react";

const STAP = 10; // mm
const DREMPEL = 4; // px voor we het als slepen beschouwen

interface Sleep {
  soort: "muur" | "opening" | "hoek";
  /** bij een hoek: het hoekpunt in plan-mm */
  hoek?: Punt;
  id: string;
  start: Punt; // plan-mm
  scherm: { x: number; y: number };
  bewogen: boolean;
  geldig: Verdieping | null; // laatste geldige voorbeeld
  doelMuur?: string;
}

/** Schermpositie → plan-mm, met de coördinaten die verdiepingNaarSVG op de svg zet. */
export function naarPlan(houder: Element, clientX: number, clientY: number): Punt | null {
  const svg = houder.querySelector("svg");
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x + Number(svg.dataset.minX ?? 0), y: Number(svg.dataset.maxY ?? 0) - p.y };
}

const rond = (x: number) => Math.round(x / STAP) * STAP;

export type Kader = { minX: number; maxX: number; minY: number; maxY: number };

/** Het tekenkader van de huidige svg (plan-mm), om het tijdens het slepen vast te houden. */
function leesKader(houder: Element): Kader | null {
  const d = houder.querySelector("svg")?.dataset;
  if (!d?.minX || !d.maxX || !d.minY || !d.maxY) return null;
  return { minX: +d.minX, maxX: +d.maxX, minY: +d.minY, maxY: +d.maxY };
}

export function useSlepen(opties: {
  v: Verdieping;
  geselecteerdeMuur?: string;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  kiesMuur: (id: string) => void;
}) {
  const sleep = useRef<Sleep | null>(null);
  const negeer = useRef(false);
  const [voorbeeld, zetVoorbeeld] = useState<Verdieping | null>(null);
  const [info, zetInfo] = useState<{ tekst: string; fout: boolean } | null>(null);
  const [actieveOpening, zetActieveOpening] = useState<string | undefined>();
  // Vast kader tijdens het slepen: anders zoomt de tekening uit als het plan
  // groeit, en loopt het gesleepte punt weg onder de vinger.
  const [kader, zetKader] = useState<Kader | undefined>();

  const stop = () => {
    sleep.current = null;
    zetKader(undefined);
    zetVoorbeeld(null);
    zetInfo(null);
    zetActieveOpening(undefined);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Elke echte klik begint met een pointerdown: een achtergebleven "negeer"
    // (de browser stuurde na het vorige slepen geen klik) mag hem niet opslokken.
    negeer.current = false;
    if (e.button !== 0) return;
    const hoekEl = (e.target as Element).closest("[data-hoek]");
    if (hoekEl) {
      const [hx, hy] = hoekEl.getAttribute("data-hoek")!.split(",").map(Number) as [number, number];
      const start = naarPlan(e.currentTarget, e.clientX, e.clientY);
      if (!start) return;
      sleep.current = { soort: "hoek", id: "", hoek: { x: hx, y: hy }, start, scherm: { x: e.clientX, y: e.clientY }, bewogen: false, geldig: null };
      return;
    }
    const el = (e.target as Element).closest("[data-raak], polygon[data-opening], polygon[data-muur]");
    if (!el) return;
    const openingId = el.getAttribute("data-opening");
    const muurId = el.getAttribute("data-muur")!;
    // vinger/pen: enkel slepen als de muur al geselecteerd is (anders scrollen)
    if (e.pointerType !== "mouse" && muurId !== opties.geselecteerdeMuur) return;
    const start = naarPlan(e.currentTarget, e.clientX, e.clientY);
    if (!start) return;
    sleep.current = {
      soort: openingId ? "opening" : "muur", id: openingId ?? muurId, start,
      scherm: { x: e.clientX, y: e.clientY }, bewogen: false, geldig: null,
    };
    // Nog geen pointer capture: anders stuurt de browser de klik naar het hele
    // plan i.p.v. naar de muur, en werkt een gewone klik (selecteren) niet meer.
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sleep.current;
    if (!s) return;
    if (!s.bewogen && Math.hypot(e.clientX - s.scherm.x, e.clientY - s.scherm.y) < DREMPEL) return;
    if (!s.bewogen) {
      e.currentTarget.setPointerCapture(e.pointerId); // vanaf nu echt slepen
      zetKader(leesKader(e.currentTarget) ?? undefined);
    }
    s.bewogen = true;
    const p = naarPlan(e.currentTarget, e.clientX, e.clientY);
    if (!p) return;
    const v = opties.v;
    try {
      if (s.soort === "hoek") {
        const dx = rond(p.x - s.start.x), dy = rond(p.y - s.start.y);
        s.geldig = dx || dy ? verplaatsHoek(v, s.hoek!, { x: s.hoek!.x + dx, y: s.hoek!.y + dy }) : null;
        zetVoorbeeld(s.geldig);
        const delen = [dx ? `${Math.abs(dx)} mm ${richtingLabel(Math.sign(dx), 0)}` : "", dy ? `${Math.abs(dy)} mm ${richtingLabel(0, Math.sign(dy))}` : ""].filter(Boolean);
        zetInfo({ tekst: delen.length ? `Hoek ${delen.join(", ")}` : "Sleep de hoek", fout: false });
      } else if (s.soort === "muur") {
        const m = v.muren.find((x) => x.id === s.id)!;
        const L = muurLengte(m);
        const n = { x: -(m.eind.y - m.start.y) / L, y: (m.eind.x - m.start.x) / L };
        const d = rond((p.x - s.start.x) * n.x + (p.y - s.start.y) * n.y);
        const richting = verschuifRichtingen(m).find((r) => r.teken === (d >= 0 ? 1 : -1))!;
        s.geldig = d === 0 ? null : verschuifMuur(v, s.id, d);
        zetVoorbeeld(s.geldig);
        zetInfo({ tekst: d === 0 ? "Sleep haaks op de muur" : `Muur ${Math.abs(d)} mm ${richting.label}`, fout: false });
      } else {
        const o = v.openingen.find((x) => x.id === s.id)!;
        zetActieveOpening(o.id);
        const w = muurBijPunt(v, p, 600);
        if (!w) {
          zetInfo({ tekst: "Sleep naar een muur", fout: true });
          return;
        }
        const m = v.muren.find((x) => x.id === w.muurId)!;
        const a = aansluitingen(m, v.muren);
        const binnen = muurLengte(m) - a.start - a.eind;
        const afstand = Math.max(0, Math.min(rond(w.t - a.start - o.breedte / 2), Math.floor(binnen - o.breedte)));
        s.geldig = wijzigOpening(v, o.id, { muurId: m.id, offset: Math.round(a.start + afstand) });
        s.doelMuur = m.id;
        zetVoorbeeld(s.geldig);
        zetInfo({ tekst: `${o.soort} → ${muurOmschrijving(v, m.id).split(" · ")[0]}: ${afstand} mm van hoek A`, fout: false });
      }
    } catch (fout) {
      // ongeldige plaats: vorige geldige stand blijft staan, reden tonen
      zetInfo({ tekst: (fout as Error).message, fout: true });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sleep.current;
    if (!s) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (s.bewogen) {
      negeer.current = true; // de klik die na het loslaten volgt, niet als selectie behandelen
      const eind = s.geldig;
      if (eind && opties.wijzig(() => eind) && s.soort === "opening" && s.doelMuur) opties.kiesMuur(s.doelMuur);
    }
    stop();
  };

  /** Geeft true als de volgende klik bij een sleepbeweging hoorde en genegeerd moet worden. */
  const klikNegeren = () => {
    const n = negeer.current;
    negeer.current = false;
    return n;
  };

  return {
    voorbeeld,
    kader,
    info,
    actieveOpening,
    klikNegeren,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: stop },
  };
}
