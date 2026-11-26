/**
 * Slepen in het plan met vinger of muis:
 * - een muur: haaks verschuiven (stappen van 10 mm), via verschuifMuur
 * - een raam of deur: langs haar muur of naar een andere muur (klikt vast op
 *   de dichtstbijzijnde muur), via wijzigOpening
 * - hoek A/B van de geselecteerde muur: vrij verplaatsen, via verplaatsHoek
 *
 * Muis: meteen slepen.
 * Vinger: ingedrukt houden (± 0,4 s) tot de gsm trilt, dan slepen. Gewoon
 * vegen blijft de pagina scrollen. Vanaf het trillen blokkeren we het
 * scrollen met preventDefault op touchmove (aanraakgebeurtenissen, niet
 * passief) — dat werkt in elke mobiele browser, ook waar `touch-action` op
 * svg-elementen genegeerd wordt.
 *
 * Tijdens het slepen blijft de tekening onder de vinger staan (anders raken
 * mobiele browsers het aanraakpunt kwijt); het voorbeeld komt in een aparte
 * laag erboven. Hoogstens één herberekening per beeldverversing. Pas bij het
 * loslaten wordt het één stap in de geschiedenis (ongedaan maken).
 */
import { aansluitingen, muurBijPunt, muurLengte, muurOmschrijving, richtingLabel, verplaatsHoek, verschuifMuur, verschuifRichtingen, wijzigOpening, type Punt, type Verdieping } from "@scanapp/core";
import { useEffect, useRef, useState, type RefObject } from "react";

const STAP = 10; // mm
const DREMPEL_MUIS = 4; // px voor we het als slepen beschouwen
export const INGEDRUKT_MS = 400; // vinger: zo lang stil houden om te slepen
const TOLERANTIE_VINGER = 10; // px: meer bewegen vóór het trillen = scrollen

export type Kader = { minX: number; maxX: number; minY: number; maxY: number };

interface Sleep {
  soort: "muur" | "opening" | "hoek";
  id: string;
  muurId?: string;
  hoek?: Punt; // bij een hoek: het hoekpunt in plan-mm
  start: Punt; // plan-mm
  scherm: { x: number; y: number };
  actief: boolean; // slepen is begonnen (muis voorbij de drempel, vinger na het trillen)
  geldig: Verdieping | null; // laatste geldige voorbeeld
  doelMuur?: string;
  timer?: ReturnType<typeof setTimeout>;
}

/** Schermpositie → plan-mm, met de coördinaten die verdiepingNaarSVG op de svg zet. */
export function naarPlan(houder: Element, clientX: number, clientY: number): Punt | null {
  const svg = houder.querySelector("svg");
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x + Number(svg.dataset.minX ?? 0), y: Number(svg.dataset.maxY ?? 0) - p.y };
}

function leesKader(houder: Element): Kader | undefined {
  const d = houder.querySelector("svg")?.dataset;
  if (!d?.minX || !d.maxX || !d.minY || !d.maxY) return undefined;
  return { minX: +d.minX, maxX: +d.maxX, minY: +d.minY, maxY: +d.maxY };
}

const rond = (x: number) => Math.round(x / STAP) * STAP;

export function useSlepen(opties: {
  v: Verdieping;
  geselecteerdeMuur?: string;
  wijzig: (f: (v: Verdieping) => Verdieping) => boolean;
  kiesMuur: (id: string) => void;
  houder: RefObject<HTMLDivElement | null>;
  /** Slepen van muren en openingen uitschakelen (bv. in de modus installaties). */
  uit?: boolean;
}) {
  const laatst = useRef(opties);
  laatst.current = opties;
  const sleep = useRef<Sleep | null>(null);
  const negeer = useRef(false);
  const beeld = useRef<number | null>(null);
  const [voorbeeld, zetVoorbeeld] = useState<Verdieping | null>(null);
  const [info, zetInfoState] = useState<{ tekst: string; fout: boolean } | null>(null);
  const laatsteInfo = useRef<{ tekst: string; fout: boolean } | null>(null);
  const naTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zetInfo = (i: { tekst: string; fout: boolean } | null) => {
    laatsteInfo.current = i;
    if (naTimer.current) { clearTimeout(naTimer.current); naTimer.current = null; }
    zetInfoState(i);
  };
  const [actieveOpening, zetActieveOpening] = useState<string | undefined>();
  const [kader, zetKader] = useState<Kader | undefined>();
  const [sleepMuur, zetSleepMuur] = useState<string | undefined>();

  const stop = () => {
    if (sleep.current?.timer) clearTimeout(sleep.current.timer);
    if (beeld.current !== null) cancelAnimationFrame(beeld.current);
    beeld.current = null;
    sleep.current = null;
    laatstePunt.current = null;
    zetVoorbeeld(null);
    zetInfo(null);
    zetActieveOpening(undefined);
    zetKader(undefined);
    zetSleepMuur(undefined);
  };

  /** Wat ligt er onder het aanraakpunt? Hoek (enkel bij de geselecteerde muur), opening of muur. */
  const begin = (doel: EventTarget | null, x: number, y: number): Sleep | null => {
    const houder = laatst.current.houder.current;
    if (laatst.current.uit || !houder || !(doel instanceof Element)) return null;
    const start = naarPlan(houder, x, y);
    if (!start) return null;
    const hoekEl = doel.closest("[data-hoek]");
    if (hoekEl) {
      const [hx, hy] = hoekEl.getAttribute("data-hoek")!.split(",").map(Number) as [number, number];
      return { soort: "hoek", id: "", muurId: laatst.current.geselecteerdeMuur, hoek: { x: hx, y: hy }, start, scherm: { x, y }, actief: false, geldig: null };
    }
    const el = doel.closest("[data-raak], polygon[data-opening], polygon[data-muur]");
    if (!el) return null;
    const openingId = el.getAttribute("data-opening");
    const muurId = el.getAttribute("data-muur")!;
    return { soort: openingId ? "opening" : "muur", id: openingId ?? muurId, muurId, start, scherm: { x, y }, actief: false, geldig: null };
  };

  const activeer = (s: Sleep) => {
    s.actief = true;
    const houder = laatst.current.houder.current;
    if (houder) zetKader(leesKader(houder));
    zetSleepMuur(s.muurId);
    if (s.soort === "opening") zetActieveOpening(s.id);
  };

  const laatstePunt = useRef<{ x: number; y: number } | null>(null);

  /** Voorbeeld berekenen voor de vinger/muis op (x, y) — hoogstens één keer per beeld. */
  const beweeg = (x: number, y: number) => {
    laatstePunt.current = { x, y };
    if (beeld.current !== null) return; // er staat al een berekening klaar; die neemt het laatste punt
    beeld.current = requestAnimationFrame(() => {
      beeld.current = null;
      if (laatstePunt.current) bereken(laatstePunt.current.x, laatstePunt.current.y);
    });
  };

  /**
   * Bij het loslaten: een nog wachtende berekening meteen uitvoeren, zodat de
   * plaats waar je loslaat telt (en niet de vorige beeldverversing).
   */
  const spoel = () => {
    if (beeld.current === null) return;
    cancelAnimationFrame(beeld.current);
    beeld.current = null;
    if (laatstePunt.current) bereken(laatstePunt.current.x, laatstePunt.current.y);
  };

  const bereken = (x: number, y: number) => {
    {
      const s = sleep.current, houder = laatst.current.houder.current;
      if (!s || !s.actief || !houder) return;
      const p = naarPlan(houder, x, y);
      if (!p) return;
      const v = laatst.current.v;
      try {
        if (s.soort === "hoek") {
          const dx = rond(p.x - s.start.x), dy = rond(p.y - s.start.y);
          s.geldig = dx || dy ? verplaatsHoek(v, s.hoek!, { x: s.hoek!.x + dx, y: s.hoek!.y + dy }) : null;
          zetVoorbeeld(s.geldig);
          const delen = [dx ? `${Math.abs(dx)} mm ${richtingLabel(Math.sign(dx), 0)}` : "", dy ? `${Math.abs(dy)} mm ${richtingLabel(0, Math.sign(dy))}` : ""].filter(Boolean);
          zetInfo({ tekst: delen.length ? `Hoek ${delen.join(", ")}` : "Sleep de hoek", fout: false });
        } else if (s.soort === "muur") {
          const m = v.muren.find((w) => w.id === s.id)!;
          const L = muurLengte(m);
          const n = { x: -(m.eind.y - m.start.y) / L, y: (m.eind.x - m.start.x) / L };
          const d = rond((p.x - s.start.x) * n.x + (p.y - s.start.y) * n.y);
          const richting = verschuifRichtingen(m).find((r) => r.teken === (d >= 0 ? 1 : -1))!;
          s.geldig = d === 0 ? null : verschuifMuur(v, s.id, d);
          zetVoorbeeld(s.geldig);
          zetInfo({ tekst: d === 0 ? "Sleep haaks op de muur" : `Muur ${Math.abs(d)} mm ${richting.label}`, fout: false });
        } else {
          const o = v.openingen.find((w) => w.id === s.id)!;
          const w = muurBijPunt(v, p, 600);
          if (!w) {
            zetInfo({ tekst: "Sleep naar een muur", fout: true });
            return;
          }
          const m = v.muren.find((x2) => x2.id === w.muurId)!;
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
    }
  };

  /** Loslaten: het laatste geldige voorbeeld wordt één stap in de geschiedenis. */
  const einde = () => {
    const s = sleep.current;
    if (!s) return;
    spoel(); // de plaats van het loslaten telt
    // Een foutmelding nog 5 s laten staan na het loslaten, zodat ze rustig te lezen is.
    const fout = laatsteInfo.current?.fout ? laatsteInfo.current : null;
    if (fout) queueMicrotask(() => {
      zetInfoState(fout);
      naTimer.current = setTimeout(() => { zetInfoState(null); naTimer.current = null; }, 5000);
    });
    if (s.actief) {
      negeer.current = true; // de klik die na het loslaten volgt, niet als selectie behandelen
      const eind = s.geldig;
      const { wijzig, kiesMuur } = laatst.current;
      if (eind && wijzig(() => eind)) {
        if (s.soort === "opening" && s.doelMuur) kiesMuur(s.doelMuur);
        else if (s.soort === "muur") kiesMuur(s.id);
      } else if (s.soort !== "hoek" && s.muurId) kiesMuur(s.muurId); // ingedrukt gehouden zonder slepen: selecteren
    }
    stop();
  };

  // ---------------------------------------------------------------- muis (en pen)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    negeer.current = false; // elke echte klik begint met pointerdown
    if (e.pointerType === "touch" || e.button !== 0) return;
    const s = begin(e.target, e.clientX, e.clientY);
    if (s) sleep.current = s;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sleep.current;
    if (!s || e.pointerType === "touch") return;
    if (!s.actief) {
      if (Math.hypot(e.clientX - s.scherm.x, e.clientY - s.scherm.y) < DREMPEL_MUIS) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      activeer(s);
    }
    beweeg(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || !sleep.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (sleep.current.actief) einde();
    else stop();
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") stop();
  };

  // ---------------------------------------------------------------- vinger: ingedrukt houden
  useEffect(() => {
    const houder = opties.houder.current;
    if (!houder) return;
    const start = (e: TouchEvent) => {
      negeer.current = false;
      if (e.touches.length !== 1) { stop(); return; } // twee vingers = zoomen: niet slepen
      const t = e.touches[0]!;
      const s = begin(e.target, t.clientX, t.clientY);
      if (!s) return;
      sleep.current = s;
      s.timer = setTimeout(() => {
        if (sleep.current !== s) return;
        activeer(s);
        try { navigator.vibrate?.(15); } catch { /* niet elke browser */ }
        zetInfo({ tekst: s.soort === "hoek" ? "Sleep de hoek" : s.soort === "muur" ? "Sleep haaks op de muur" : "Sleep naar een plaats of muur", fout: false });
      }, INGEDRUKT_MS);
    };
    const beweging = (e: TouchEvent) => {
      const s = sleep.current;
      if (!s) return;
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) { stop(); return; }
      if (!s.actief) {
        // vóór het trillen bewogen: dit is scrollen, laat de browser doen
        if (Math.hypot(t.clientX - s.scherm.x, t.clientY - s.scherm.y) > TOLERANTIE_VINGER) stop();
        return;
      }
      if (e.cancelable) e.preventDefault(); // niet scrollen tijdens het slepen
      beweeg(t.clientX, t.clientY);
    };
    const los = (e: TouchEvent) => {
      const s = sleep.current;
      if (!s) return;
      if (s.actief) {
        if (e.cancelable) e.preventDefault(); // geen klik/contextmenu na het slepen
        einde();
      } else stop();
    };
    const geenMenu = (e: Event) => { if (sleep.current) e.preventDefault(); }; // lang drukken: geen contextmenu
    houder.addEventListener("touchstart", start, { passive: true });
    houder.addEventListener("touchmove", beweging, { passive: false });
    houder.addEventListener("touchend", los, { passive: false });
    houder.addEventListener("touchcancel", stop);
    houder.addEventListener("contextmenu", geenMenu);
    return () => {
      houder.removeEventListener("touchstart", start);
      houder.removeEventListener("touchmove", beweging);
      houder.removeEventListener("touchend", los);
      houder.removeEventListener("touchcancel", stop);
      houder.removeEventListener("contextmenu", geenMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opties.houder]);

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
    /** muur die tijdens het slepen gemarkeerd wordt in het voorbeeld */
    sleepMuur,
    klikNegeren,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
