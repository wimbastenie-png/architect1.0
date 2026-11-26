/**
 * Cloudopslag van projecten. Twee uitvoeringen met dezelfde vorm:
 * - SupabaseOpslag: echte opslag (Supabase, EU-regio), aanmelden met een link per e-mail.
 * - DemoOpslag: alles in deze browser (localStorage), om te proberen en te testen (?cloud-demo).
 *
 * Instellingen: VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY bij het bouwen, of
 * ingegeven in de app. Alleen de publieke sleutel (anon / publishable) is toegelaten:
 * de beveiliging zit in de databaseregels (Row Level Security). Een geheime
 * sleutel (service_role / sb_secret_) wordt geweigerd.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "@scanapp/core";

export type Rol = "eigenaar" | "bewerken" | "lezen";
export interface CloudProject { id: string; naam: string; versie: number; gewijzigd: string; gewijzigdDoor?: string; rol: Rol }
export interface Lid { email: string; rol: "lezen" | "bewerken" }

export interface CloudOpslag {
  soort: "supabase" | "demo";
  gebruiker(): Promise<{ email: string } | null>;
  /** Stuurt een aanmeldlink per e-mail (demo: meteen aangemeld). */
  meldAan(email: string): Promise<"link-verstuurd" | "aangemeld">;
  meldAf(): Promise<void>;
  opAanmelding(cb: () => void): () => void;
  lijst(): Promise<CloudProject[]>;
  haal(id: string): Promise<{ data: unknown; versie: number; gewijzigdDoor?: string } | null>;
  /** Bewaart; versie = de versie waarop je verder werkte (0 = nieuw). Geeft de nieuwe versie, of null bij een conflict. */
  bewaar(p: Project, versie: number): Promise<number | null>;
  verwijder(id: string): Promise<void>;
  leden(id: string): Promise<Lid[]>;
  deel(id: string, email: string, rol: Lid["rol"]): Promise<void>;
  stopDelen(id: string, email: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// instellingen

export interface CloudInstelling { url: string; sleutel: string }
const INSTELLING = "architect1.0:supabase";

/** Controle van de sleutel: alleen publiek (anon / publishable). */
export function controleerSleutel(sleutel: string): string | null {
  const s = sleutel.trim();
  if (!s) return "Geef de publieke sleutel (anon key of publishable key) in.";
  if (s.startsWith("sb_secret_")) return "Dit is een GEHEIME sleutel. Gebruik die nooit in de app. Neem de publishable key (sb_publishable_…) of de anon key.";
  if (s.startsWith("sb_publishable_")) return null;
  const delen = s.split(".");
  if (delen.length === 3) {
    try {
      const inhoud = JSON.parse(atob(delen[1]!.replace(/-/g, "+").replace(/_/g, "/")));
      if (inhoud.role === "service_role") return "Dit is de service_role-sleutel (geheim). Gebruik die nooit in de app. Neem de anon key.";
      if (inhoud.role === "anon") return null;
    } catch { /* geen JWT */ }
  }
  return "Dit lijkt geen publieke Supabase-sleutel (anon of sb_publishable_…).";
}

export function controleerUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return "Het adres moet met https:// beginnen.";
    return null;
  } catch {
    return "Geef het projectadres in, bv. https://abcd1234.supabase.co";
  }
}

export function leesInstelling(): CloudInstelling | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) return { url: env.VITE_SUPABASE_URL, sleutel: env.VITE_SUPABASE_ANON_KEY };
  try {
    const r = JSON.parse(localStorage.getItem(INSTELLING) ?? "null");
    if (r && typeof r.url === "string" && typeof r.sleutel === "string" && !controleerUrl(r.url) && !controleerSleutel(r.sleutel)) return r;
  } catch { /* leeg */ }
  return null;
}

export function bewaarInstelling(i: CloudInstelling | null) {
  try {
    if (i) localStorage.setItem(INSTELLING, JSON.stringify({ url: i.url.trim().replace(/\/$/, ""), sleutel: i.sleutel.trim() }));
    else localStorage.removeItem(INSTELLING);
  } catch { /* privévenster */ }
}

export const vanBuitenIngesteld = () => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
};

// ---------------------------------------------------------------------------
// Supabase

export class SupabaseOpslag implements CloudOpslag {
  soort = "supabase" as const;
  /** supabase-js wordt pas geladen als de cloud gebruikt wordt (kleinere start van de app). */
  private klant: Promise<SupabaseClient>;
  constructor(i: CloudInstelling) {
    this.klant = import("@supabase/supabase-js").then(({ createClient }) => createClient(i.url, i.sleutel, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  }
  async gebruiker() {
    const { data } = await (await this.klant).auth.getSession();
    const e = data.session?.user?.email;
    return e ? { email: e } : null;
  }
  async meldAan(email: string) {
    const terug = `${window.location.origin}${window.location.pathname}`;
    const { error } = await (await this.klant).auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: terug } });
    if (error) throw new Error(`Aanmelden lukt niet: ${error.message}`);
    return "link-verstuurd" as const;
  }
  async meldAf() { await (await this.klant).auth.signOut(); }
  opAanmelding(cb: () => void) {
    let stop = () => {};
    let weg = false;
    void this.klant.then((k) => { if (weg) return; const { data } = k.auth.onAuthStateChange(() => cb()); stop = () => data.subscription.unsubscribe(); });
    return () => { weg = true; stop(); };
  }
  async lijst(): Promise<CloudProject[]> {
    const ik = (await this.gebruiker())?.email.toLowerCase();
    const { data: sessie } = await (await this.klant).auth.getSession();
    const uid = sessie.session?.user?.id;
    const { data, error } = await (await this.klant).from("projecten").select("id, naam, versie, gewijzigd, gewijzigd_door, eigenaar, project_leden(email, rol)").order("gewijzigd", { ascending: false });
    if (error) throw new Error(`Lijst ophalen lukt niet: ${error.message}`);
    return (data ?? []).map((r: Record<string, unknown>) => {
      const leden = (r.project_leden as Lid[] | null) ?? [];
      const mijn = leden.find((l) => l.email.toLowerCase() === ik);
      return { id: r.id as string, naam: r.naam as string, versie: r.versie as number, gewijzigd: r.gewijzigd as string, gewijzigdDoor: (r.gewijzigd_door as string) ?? undefined, rol: r.eigenaar === uid ? "eigenaar" : (mijn?.rol ?? "lezen") };
    });
  }
  async haal(id: string) {
    const { data, error } = await (await this.klant).from("projecten").select("data, versie, gewijzigd_door").eq("id", id).maybeSingle();
    if (error) throw new Error(`Ophalen lukt niet: ${error.message}`);
    return data ? { data: data.data, versie: data.versie as number, gewijzigdDoor: (data.gewijzigd_door as string) ?? undefined } : null;
  }
  async bewaar(p: Project, versie: number) {
    const { data, error } = await (await this.klant).rpc("bewaar_project", { p_id: p.id, p_naam: p.naam, p_data: p, p_versie: versie });
    if (error) throw new Error(`Bewaren lukt niet: ${error.message}`);
    return typeof data === "number" ? data : null;
  }
  async verwijder(id: string) {
    const { error } = await (await this.klant).from("projecten").delete().eq("id", id);
    if (error) throw new Error(`Verwijderen lukt niet: ${error.message}`);
  }
  async leden(id: string) {
    const { data, error } = await (await this.klant).from("project_leden").select("email, rol").eq("project_id", id);
    if (error) throw new Error(error.message);
    return (data ?? []) as Lid[];
  }
  async deel(id: string, email: string, rol: Lid["rol"]) {
    const { error } = await (await this.klant).from("project_leden").upsert({ project_id: id, email: email.trim().toLowerCase(), rol });
    if (error) throw new Error(`Delen lukt niet: ${error.message}`);
  }
  async stopDelen(id: string, email: string) {
    const { error } = await (await this.klant).from("project_leden").delete().eq("project_id", id).eq("email", email);
    if (error) throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Demo: dezelfde regels, in deze browser (één gebruiker; twee tabbladen = twee toestellen)

const DEMO = "architect1.0:cloud-demo";
interface DemoData { aangemeld: string | null; projecten: Record<string, { naam: string; data: unknown; versie: number; gewijzigd: string; gewijzigdDoor?: string; leden: Lid[] }> }

export class DemoOpslag implements CloudOpslag {
  soort = "demo" as const;
  private lees(): DemoData {
    try { return JSON.parse(localStorage.getItem(DEMO) ?? "") as DemoData; } catch { return { aangemeld: null, projecten: {} }; }
  }
  private schrijf(d: DemoData) { localStorage.setItem(DEMO, JSON.stringify(d)); window.dispatchEvent(new Event("architect-cloud-demo")); }
  async gebruiker() { const a = this.lees().aangemeld; return a ? { email: a } : null; }
  async meldAan(email: string) { const d = this.lees(); d.aangemeld = email.trim().toLowerCase(); this.schrijf(d); return "aangemeld" as const; }
  async meldAf() { const d = this.lees(); d.aangemeld = null; this.schrijf(d); }
  opAanmelding(cb: () => void) {
    const f = () => cb();
    window.addEventListener("architect-cloud-demo", f);
    window.addEventListener("storage", f);
    return () => { window.removeEventListener("architect-cloud-demo", f); window.removeEventListener("storage", f); };
  }
  async lijst() {
    return Object.entries(this.lees().projecten).map(([id, x]) => ({ id, naam: x.naam, versie: x.versie, gewijzigd: x.gewijzigd, gewijzigdDoor: x.gewijzigdDoor, rol: "eigenaar" as const }))
      .sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));
  }
  async haal(id: string) { const x = this.lees().projecten[id]; return x ? { data: x.data, versie: x.versie, gewijzigdDoor: x.gewijzigdDoor } : null; }
  async bewaar(p: Project, versie: number) {
    const d = this.lees();
    const x = d.projecten[p.id];
    if (versie === 0 ? !!x : !x || x.versie !== versie) return null;
    const nieuw = versie + 1;
    d.projecten[p.id] = { naam: p.naam, data: p, versie: nieuw, gewijzigd: new Date().toISOString(), gewijzigdDoor: d.aangemeld ?? undefined, leden: x?.leden ?? [] };
    this.schrijf(d);
    return nieuw;
  }
  async verwijder(id: string) { const d = this.lees(); delete d.projecten[id]; this.schrijf(d); }
  async leden(id: string) { return this.lees().projecten[id]?.leden ?? []; }
  async deel(id: string, email: string, rol: Lid["rol"]) { const d = this.lees(); const x = d.projecten[id]; if (!x) throw new Error("Project niet gevonden."); x.leden = [...x.leden.filter((l) => l.email !== email.trim().toLowerCase()), { email: email.trim().toLowerCase(), rol }]; this.schrijf(d); }
  async stopDelen(id: string, email: string) { const d = this.lees(); const x = d.projecten[id]; if (x) x.leden = x.leden.filter((l) => l.email !== email); this.schrijf(d); }
}

export function maakOpslag(): CloudOpslag | null {
  if (new URLSearchParams(window.location.search).has("cloud-demo")) return new DemoOpslag();
  const i = leesInstelling();
  return i ? new SupabaseOpslag(i) : null;
}
