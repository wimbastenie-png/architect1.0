/**
 * Foto's (EPB-bewijs, werf): genomen met de camera van de gsm, verkleind tot
 * max. 1600 px (JPEG) en bewaard in deze browser (IndexedDB). Het project
 * bewaart alleen de verwijzing (id, datum, element).
 *
 * Let op: foto's gaan (nog) niet mee in een deellink, het projectbestand of de cloud.
 */
import { useEffect, useState } from "react";

const DB = "architect1.0-fotos", STORE = "fotos";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, nok) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nok(r.error);
  });
}

export async function bewaarFoto(id: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((ok, nok) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(blob, id); t.oncomplete = () => ok(); t.onerror = () => nok(t.error); });
}

export async function haalFoto(id: string): Promise<Blob | null> {
  const db = await open();
  return new Promise((ok) => { const r = db.transaction(STORE).objectStore(STORE).get(id); r.onsuccess = () => ok((r.result as Blob) ?? null); r.onerror = () => ok(null); });
}

export async function verwijderFoto(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((ok) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(id); t.oncomplete = () => ok(); t.onerror = () => ok(); });
}

/** Verkleinen tot max. 1600 px aan de lange kant, JPEG 0,75. */
export async function verklein(bestand: File, max = 1600): Promise<Blob> {
  try {
    const beeld = await createImageBitmap(bestand);
    const f = Math.min(1, max / Math.max(beeld.width, beeld.height));
    const c = document.createElement("canvas");
    c.width = Math.round(beeld.width * f); c.height = Math.round(beeld.height * f);
    c.getContext("2d")!.drawImage(beeld, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? bestand), "image/jpeg", 0.75));
  } catch {
    return bestand;
  }
}

export const nieuwFotoId = () => `foto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function Duim({ id, weg }: { id: string; weg?: () => void }) {
  const [url, zetUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null, actief = true;
    void haalFoto(id).then((b) => { if (b && actief) { u = URL.createObjectURL(b); zetUrl(u); } });
    return () => { actief = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return (
    <span className="duim">
      {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto" /></a> : <span className="duim-leeg">foto niet op dit toestel</span>}
      {weg && <button aria-label="Foto verwijderen" onClick={weg}>×</button>}
    </span>
  );
}

/** Foto's bij een element: duimnagels + knop "Foto nemen" (camera op de gsm, bestand op de pc). */
export function FotoVeld({ ids, voegToe, verwijder, label = "Foto nemen" }: { ids: string[]; voegToe: (id: string) => void; verwijder: (id: string) => void; label?: string }) {
  const [bezig, zetBezig] = useState(false);
  return (
    <div className="fotos">
      {ids.map((id) => <Duim key={id} id={id} weg={() => { void verwijderFoto(id); verwijder(id); }} />)}
      <label className="knop">
        {bezig ? "Bewaren…" : label}
        <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          zetBezig(true);
          try { const id = nieuwFotoId(); await bewaarFoto(id, await verklein(f)); voegToe(id); } finally { zetBezig(false); }
        }} />
      </label>
    </div>
  );
}
