/**
 * Deellink: het hele project in een link, zonder server of account.
 * Het project gaat gecomprimeerd (deflate) en base64url-gecodeerd in het deel
 * van de link achter '#'. Dat deel stuurt een browser nooit naar de server:
 * GitHub Pages (of wie de pagina ook levert) ziet het plan dus niet.
 * Iedereen mét de link kan het project wel openen.
 */
import { leesProject, type Project, type Validatiefout } from "./schema.ts";

export const DEEL_PREFIX = "p=";
/** Boven deze lengte (tekens) kunnen sommige berichtenapps of mailprogramma's de link inkorten. */
export const LANGE_LINK = 8000;

async function stroom(data: Uint8Array, s: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const uit = new Blob([data]).stream().pipeThrough(s);
  return new Uint8Array(await new Response(uit).arrayBuffer());
}

function naarBase64url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function vanBase64url(t: string): Uint8Array {
  const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (t.length % 4)) % 4));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

/** Project → korte code voor in een link (gecomprimeerd). */
export async function projectNaarCode(p: Project): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p));
  return naarBase64url(await stroom(json, new CompressionStream("deflate-raw")));
}

/** Code uit een link → project, met dezelfde controles als bij het openen van een bestand. */
export async function codeNaarProject(code: string): Promise<{ ok: true; project: Project } | { ok: false; fouten: Validatiefout[] }> {
  try {
    const json = new TextDecoder().decode(await stroom(vanBase64url(code), new DecompressionStream("deflate-raw")));
    return leesProject(JSON.parse(json));
  } catch {
    return { ok: false, fouten: [{ pad: "", melding: "De link is onvolledig of beschadigd." }] };
  }
}

/** Haalt de code uit een volledig adres of een hash ('#p=…'); null als er geen projectcode in staat. */
export function codeUitLink(adres: string): string | null {
  const hash = adres.includes("#") ? adres.slice(adres.indexOf("#") + 1) : adres;
  return hash.startsWith(DEEL_PREFIX) ? hash.slice(DEEL_PREFIX.length) : null;
}
