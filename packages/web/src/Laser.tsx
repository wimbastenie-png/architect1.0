/**
 * Bluetooth-laserafstandsmeter via Web Bluetooth (Chrome op Android, en op
 * pc met Bluetooth). Eerst één merk: Leica DISTO met Bluetooth (BLE), met de
 * publiek beschreven service. Elke meting komt in het invulveld dat op dat
 * moment actief is (in mm).
 *
 * Werkt NIET op iPhone/iPad (Safari ondersteunt geen Web Bluetooth) en niet in Firefox.
 * Niet getest met een echt toestel: de UUID's komen uit publieke beschrijvingen.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const DISTO = {
  service: "3ab10100-f831-4395-b29d-570977d5bf94",
  afstand: "3ab10101-f831-4395-b29d-570977d5bf94",
};

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
  const [fout, zetFout] = useState<string | null>(null);
  const toestel = useRef<any>(null);

  const verbind = useCallback(async () => {
    if (!laserMogelijk()) return;
    zetFout(null);
    zetStatus("verbinden");
    try {
      const dev = await bt().requestDevice({ filters: [{ services: [DISTO.service] }, { namePrefix: "DISTO" }], optionalServices: [DISTO.service] });
      toestel.current = dev;
      dev.addEventListener?.("gattserverdisconnected", () => zetStatus("los"));
      const server = await dev.gatt.connect();
      const dienst = await server.getPrimaryService(DISTO.service);
      const kar = await dienst.getCharacteristic(DISTO.afstand);
      kar.addEventListener("characteristicvaluechanged", (e: any) => {
        const dv: DataView = e.target.value;
        const meter = dv.getFloat32(0, true);
        if (!Number.isFinite(meter) || meter <= 0) return;
        const mm = Math.round(meter * 1000);
        zetLaatste({ mm, ingevuld: vulActiefVeld(mm) });
      });
      await kar.startNotifications();
      zetStatus("verbonden");
    } catch (e) {
      const m = (e as Error).message ?? String(e);
      zetStatus(laserMogelijk() ? "los" : "niet-mogelijk");
      if (!/cancel|chooser/i.test(m)) { zetFout(`Verbinden lukt niet: ${m}`); zetStatus("fout"); }
    }
  }, []);

  const verbreek = useCallback(() => { try { toestel.current?.gatt?.disconnect(); } catch { /* al los */ } zetStatus("los"); }, []);
  useEffect(() => () => { try { toestel.current?.gatt?.disconnect(); } catch { /* */ } }, []);
  return { status, laatste, fout, verbind, verbreek };
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
            <p>Deze browser kan geen Bluetooth-toestellen koppelen. Gebruik <strong>Chrome op Android</strong> (of Chrome op een pc met Bluetooth). Op iPhone en iPad kan het niet: Safari ondersteunt Web Bluetooth niet.</p>
          ) : (
            <>
              <p>Leica DISTO met Bluetooth. Zet Bluetooth aan op de laser, tik op <strong>Verbinden</strong> en kies de laser. Tik daarna in een maatveld (bv. binnenmaat, lengte bij de vloer) en meet: de maat komt erin.</p>
              {laser.status === "verbonden"
                ? <button onClick={laser.verbreek}>Verbreken</button>
                : <button className="primair" onClick={() => void laser.verbind()} disabled={laser.status === "verbinden"}>{laser.status === "verbinden" ? "Verbinden…" : "Verbinden"}</button>}
              {laser.laatste && <p>Laatste meting: <strong>{laser.laatste.mm} mm</strong>{laser.laatste.ingevuld ? " — ingevuld" : " — tik eerst in een maatveld"}</p>}
              {laser.fout && <p className="melding" role="alert">{laser.fout}</p>}
              <p className="uitleg klein">Andere merken (Bosch, Stabila …) gebruiken een eigen protocol en worden nog niet ondersteund. Niet getest met een echt toestel.</p>
            </>
          )}
        </div>
      )}
    </span>
  );
}
