/**
 * Versiecontrole: kijkt bij het openen en bij terugkeren naar de app of er
 * online een nieuwere versie staat (versie.json, zonder cache). Zo ja: een
 * balk met "Vernieuwen" die de pagina opnieuw laadt, voorbij de cache van de gsm.
 */
import { useEffect, useState } from "react";

declare const __VERSIE__: string;
export const VERSIE: string = typeof __VERSIE__ === "string" ? __VERSIE__ : "dev";

export function NieuweVersie() {
  const [nieuw, zetNieuw] = useState<string | null>(null);
  useEffect(() => {
    if (VERSIE === "dev") return;
    const kijk = async () => {
      try {
        const r = await fetch(`versie.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { versie } = (await r.json()) as { versie?: string };
        if (versie && versie !== VERSIE) zetNieuw(versie);
      } catch { /* offline */ }
    };
    void kijk();
    const zichtbaar = () => { if (document.visibilityState === "visible") void kijk(); };
    document.addEventListener("visibilitychange", zichtbaar);
    const iv = setInterval(kijk, 5 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", zichtbaar); clearInterval(iv); };
  }, []);
  if (!nieuw) return null;
  return (
    <div className="melding nieuwe-versie" role="status">
      <span>Er staat een nieuwe versie van de app klaar.</span>
      <button className="primair" onClick={() => {
        // ander adres = geen oude kopie uit de cache; je project blijft bewaard op dit toestel
        const u = new URL(window.location.href);
        u.searchParams.set("v", nieuw.replace(/\D/g, "").slice(-10));
        window.location.replace(u.toString());
      }}>Vernieuwen</button>
    </div>
  );
}
