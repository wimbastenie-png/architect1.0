/**
 * Bluetooth-laserafstandsmeter via Web Bluetooth (Chrome op Android, en op
 * pc met Bluetooth): Leica DISTO en Bosch GLM (Bluetooth LE). De protocollen
 * staan in de kern (laser.ts). Elke meting komt in het invulveld dat op dat
 * moment actief is (in mm).
 *
 * Werkt NIET op iPhone/iPad (Safari ondersteunt geen Web Bluetooth) en niet in Firefox.
 * Niet getest met een echt toestel: de gegevens komen uit publieke beschrijvingen.
 */
import { LASERS, leesMeting, naarMm, NIET_IN_BROWSER, type LaserProtocol } from "@scanapp/core";
import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const bt = (): any => (navigator as any).bluetooth;
export const laserMogelijk = () => typeof navigator !== "undefined" && !!bt();

/** Waarde in het actieve invulveld zetten zoals een gebruiker zou typen (React ziet de wijziging). */
export function vulActiefVeld(mm: number): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement) || (el.type !== "number" && el.type !== "text")) return false;
  const zet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  zet?.call(el, String(mm));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export type LaserStatus = "niet-mogelijk" | "los" | "verbinden" | "verbonden" | "fout";

export function useLaser() {
  const [status, zetStatus] = useState<LaserStatus>(laserMogelijk() ? "los" : "niet-mogelijk");
  const [laatste, zetLaatste] = useState<{ mm: number; ingevuld: boolean } | null>(null);
  const [merk, zetMerk] = useState<LaserProtocol | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const toestel = useRef<any>(null);

  const verbind = useCallback(async () => {
    if (!laserMogelijk()) return;
    zetFout(null);
    zetStatus("verbinden");
    try {
      const dev = await bt().requestDevice({
        filters: [...LASERS.map((l) => ({ services: [l.service] })), ...LASERS.flatMap((l) => l.namen.map((n) => ({ namePrefix: n })))],
        optionalServices: LASERS.map((l) => l.service),
      });
      toestel.current = dev;
      dev.addEventListener?.("gattserverdisconnected", () => zetStatus("los"));
      const server = await dev.gatt.connect();
      // welk merk? de eerste dienst die het toestel heeft
      let gevonden: { p: LaserProtocol; dienst: any } | null = null;
      for (const p of LASERS) {
        try { gevonden = { p, dienst: await server.getPrimaryService(p.service) }; break; } catch { /* ander merk */ }
      }
      if (!gevonden) throw new Error("Dit toestel is geen ondersteunde laser (Leica DISTO of Bosch GLM).");
      const { p } = gevonden;
      const kar = await gevonden.dienst.getCharacteristic(p.meting);
      kar.addEventListener("characteristicvaluechanged", (e: any) => {
        const meter = leesMeting(p.merk, e.target.value as DataView);
        if (meter === null) return;
        const mm = naarMm(meter);
        zetLaatste({ mm, ingevuld: vulActiefVeld(mm) });
      });
      await kar.startNotifications();
      if (p.start) await kar.writeValue(new Uint8Array(p.start));
      zetMerk(p);
      zetStatus("verbonden");
    } catch (e) {
      const m = (e as Error).message ?? String(e);
      zetStatus(laserMogelijk() ? "los" : "niet-mogelijk");
      if (!/cancel|chooser/i.test(m)) { zetFout(`Verbinden lukt niet: ${m}`); zetStatus("fout"); }
    }
  }, []);

  const verbreek = useCallback(() => { try { toestel.current?.gatt?.disconnect(); } catch { /* al los */ } zetStatus("los"); }, []);
  useEffect(() => () => { try { toestel.current?.gatt?.disconnect(); } catch { /* */ } }, []);
  return { status, laatste, fout, merk, verbind, verbreek };
}

export function LaserKnop({ laser }: { laser: ReturnType<typeof useLaser> }) {
  const [open, zetOpen] = useState(false);
  return (
    <span className="laser">
      <button className={laser.status === "verbonden" ? "verbonden" : ""} onClick={() => zetOpen(!open)} aria-expanded={open}>
        {laser.status === "verbonden" ? `Laser ✓${laser.laatste ? ` ${laser.laatste.mm} mm` : ""}` : "Laser"}
      </button>
      {open && (
        <div className="laser-paneel" role="dialog" aria-label="Laserafstandsmeter">
          {laser.status === "niet-mogelijk" ? (
            <><p>Deze browser kan geen Bluetooth-toestellen koppelen. Gebruik <strong>Chrome op Android</strong> (of Chrome op een pc met Bluetooth). Op iPhone en iPad kan het niet: Safari ondersteunt Web Bluetooth niet.</p>
            <ul className="klein">{NIET_IN_BROWSER.map((x) => <li key={x.merk}><strong>{x.merk}</strong>: {x.uitleg}</li>)}</ul>
            </>
          ) : (
            <>
              <p>Zet Bluetooth aan op de laser, tik op <strong>Verbinden</strong> en kies de laser. Tik daarna in een maatveld (bv. binnenmaat, lengte bij de vloer) en meet: de maat komt erin.</p>
              <ul className="klein">{LASERS.map((l) => <li key={l.merk}><strong>{l.naam}</strong>: {l.modellen}</li>)}</ul>
              {laser.merk && laser.status === "verbonden" && <p>Verbonden met een <strong>{laser.merk.naam}</strong>.</p>}
              {laser.status === "verbonden"
                ? <button onClick={laser.verbreek}>Verbreken</button>
                : <button className="primair" onClick={() => void laser.verbind()} disabled={laser.status === "verbinden"}>{laser.status === "verbinden" ? "Verbinden…" : "Verbinden"}</button>}
              {laser.laatste && <p>Laatste meting: <strong>{laser.laatste.mm} mm</strong>{laser.laatste.ingevuld ? " — ingevuld" : " — tik eerst in een maatveld"}</p>}
              {laser.fout && <p className="melding" role="alert">{laser.fout}</p>}
              <details className="klein"><summary>Andere merken en iPhone</summary>
                <ul>{NIET_IN_BROWSER.map((x) => <li key={x.merk}><strong>{x.merk}</strong>: {x.uitleg}</li>)}</ul>
              </details>
              <p className="uitleg klein">Niet getest met een echt toestel: de gegevens komen uit publieke beschrijvingen. Controleer de eerste metingen met een rolmeter.</p>
            </>
          )}
        </div>
      )}
    </span>
  );
}
