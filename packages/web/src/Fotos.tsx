/**
 * Foto's (EPB-bewijs, werf): genomen met de camera van de gsm, verkleind tot
 * max. 1600 px (JPEG) en bewaard in deze browser (IndexedDB). Het project
 * bewaart alleen de verwijzing (id, datum, element).
 *
 * Cloud: staat het project in de cloud, dan gaan de foto's mee (ook later: wat
 * offline genomen werd, gaat mee zodra er weer netwerk is). Een ander toestel
 * haalt een foto op als die er nog niet staat.
 * Let op: foto's gaan niet mee in een deellink of het projectbestand.
 */
import { useEffect, useState } from "react";

const DB = "architect1.0-fotos", STORE = "fotos", VERSTUURD = "verstuurd";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, nok) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      if (!r.result.objectStoreNames.contains(VERSTUURD)) r.result.createObjectStore(VERSTUURD);
    };
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

// ---------------------------------------------------------------------------
// foto's en de cloud

export interface FotoCloud {
  projectId: string;
  /** foto-id's van het project (enkel die worden verstuurd) */
  ids: string[];
  magSchrijven: boolean;
  stuur(id: string, blob: Blob): Promise<void>;
  haal(id: string): Promise<Blob | null>;
  wis(id: string): Promise<void>;
}
let fotoCloud: FotoCloud | null = null;
let bezigMet: Promise<number> | null = null;
const luisteraars = new Set<() => void>();

async function isVerstuurd(sleutel: string): Promise<boolean> {
  const db = await open();
  return new Promise((ok) => { const r = db.transaction(VERSTUURD).objectStore(VERSTUURD).get(sleutel); r.onsuccess = () => ok(!!r.result); r.onerror = () => ok(false); });
}
async function markeer(sleutel: string): Promise<void> {
  const db = await open();
  await new Promise<void>((ok) => { const t = db.transaction(VERSTUURD, "readwrite"); t.objectStore(VERSTUURD).put(1, sleutel); t.oncomplete = () => ok(); t.onerror = () => ok(); });
}

/** Door de cloud gezet: wie is er gekoppeld (of null). Stuurt meteen wat nog wacht. */
export function zetFotoCloud(f: FotoCloud | null) {
  fotoCloud = f;
  luisteraars.forEach((l) => l());
  if (f) void stuurWachtendeFotos();
}

/** Foto's van dit toestel die nog niet in de cloud staan. */
export async function wachtendeFotos(): Promise<string[]> {
  const f = fotoCloud;
  if (!f || !f.magSchrijven) return [];
  const uit: string[] = [];
  for (const id of f.ids) if (!(await isVerstuurd(`${f.projectId}/${id}`)) && (await haalFoto(id))) uit.push(id);
  return uit;
}

/** Stuurt de wachtende foto's door. Geeft het aantal dat nog wacht (0 = alles verstuurd). */
export function stuurWachtendeFotos(): Promise<number> {
  if (bezigMet) return bezigMet;
  bezigMet = (async () => {
    const f = fotoCloud;
    if (!f) return 0;
    let wacht = 0;
    for (const id of await wachtendeFotos()) {
      const b = await haalFoto(id);
      if (!b) continue;
      try { await f.stuur(id, b); await markeer(`${f.projectId}/${id}`); } catch { wacht++; }
    }
    return wacht;
  })().finally(() => { bezigMet = null; luisteraars.forEach((l) => l()); });
  return bezigMet;
}

/** Aantal foto's dat nog naar de cloud moet (voor de status). */
export function useWachtendeFotos(): number {
  const [n, zetN] = useState(0);
  useEffect(() => {
    let weg = false;
    const kijk = () => { void wachtendeFotos().then((x) => { if (!weg) zetN(x.length); }).catch(() => {}); };
    kijk(); luisteraars.add(kijk);
    return () => { weg = true; luisteraars.delete(kijk); };
  }, []);
  return n;
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
    void (async () => {
      let b = await haalFoto(id);
      // niet op dit toestel: uit de cloud halen (en bewaren voor offline)
      if (!b && fotoCloud) { try { b = await fotoCloud.haal(id); if (b) { await bewaarFoto(id, b); await markeer(`${fotoCloud.projectId}/${id}`); } } catch { /* offline */ } }
      if (b && actief) { u = URL.createObjectURL(b); zetUrl(u); }
    })();
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
      {ids.map((id) => <Duim key={id} id={id} weg={() => { void verwijderFoto(id); if (fotoCloud?.magSchrijven) void fotoCloud.wis(id).catch(() => {}); verwijder(id); }} />)}
      <label className="knop">
        {bezig ? "Bewaren…" : label}
        <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          zetBezig(true);
          try { const id = nieuwFotoId(); await bewaarFoto(id, await verklein(f)); voegToe(id); } finally { zetBezig(false); }
          // doorsturen gebeurt door de cloud zodra het project (met de nieuwe foto) bewaard is
        }} />
      </label>
    </div>
  );
}
