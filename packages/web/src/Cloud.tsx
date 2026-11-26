/**
 * Accounts en cloudopslag: aanmelden, projecten bewaren en automatisch gelijk
 * houden tussen gsm en pc, delen met klant, architect of ingenieur.
 *
 * Gelijk houden: na elke wijziging (na 1,5 s rust) bewaren; bij terugkeren
 * naar de app en elke 30 s kijken of een ander toestel een nieuwere versie
 * bewaarde. Elke bewaring draagt de versie waarop je verder werkte: was er
 * intussen een nieuwere, dan meldt de app een conflict en kies je zelf.
 */
import { leesProject, type Project } from "@scanapp/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bewaarInstelling, controleerSleutel, controleerUrl, maakOpslag, vanBuitenIngesteld,
  type CloudOpslag, type CloudProject, type Lid, type Rol,
} from "./cloudOpslag.ts";
import { Veld } from "./ui.tsx";

const KOPPELING = "architect1.0:cloud-koppeling";
type Koppeling = Record<string, { versie: number; json: string; rol: Rol }>;
const leesKoppeling = (): Koppeling => { try { return JSON.parse(localStorage.getItem(KOPPELING) ?? "{}"); } catch { return {}; } };
const schrijfKoppeling = (k: Koppeling) => { try { localStorage.setItem(KOPPELING, JSON.stringify(k)); } catch { /* privévenster */ } };

export type CloudStatus =
  | { soort: "uit" } | { soort: "afgemeld" } | { soort: "los" } | { soort: "bezig" }
  | { soort: "gelijk"; versie: number; om: string } | { soort: "lezen" } | { soort: "fout"; tekst: string }
  | { soort: "conflict"; cloud: Project; versie: number; door?: string };

export function useCloud(project: Project | null, vervang: (p: Project, bericht: string) => void) {
  const [instellingVersie, zetInstellingVersie] = useState(0);
  const opslag = useMemo<CloudOpslag | null>(() => maakOpslag(), [instellingVersie]);
  const [gebruiker, zetGebruiker] = useState<{ email: string } | null>(null);
  const [koppeling, zetKoppelingState] = useState<Koppeling>(leesKoppeling);
  const [status, zetStatus] = useState<CloudStatus>({ soort: "uit" });
  const zetKoppeling = (k: Koppeling) => { schrijfKoppeling(k); zetKoppelingState(k); };
  const ref = useRef({ project, koppeling, gebruiker, status });
  ref.current = { project, koppeling, gebruiker, status };

  useEffect(() => {
    if (!opslag) { zetGebruiker(null); return; }
    let weg = false;
    const kijk = () => { opslag.gebruiker().then((g) => { if (!weg) zetGebruiker(g); }).catch(() => {}); };
    kijk();
    const stop = opslag.opAanmelding(kijk);
    return () => { weg = true; stop(); };
  }, [opslag]);

  const k = project ? koppeling[project.id] : undefined;
  // status afleiden als er niets bijzonders loopt
  useEffect(() => {
    if (status.soort === "conflict" || status.soort === "bezig" || status.soort === "fout") return;
    if (!opslag) zetStatus({ soort: "uit" });
    else if (!gebruiker) zetStatus({ soort: "afgemeld" });
    else if (!k) zetStatus({ soort: "los" });
    else if (k.rol === "lezen") zetStatus({ soort: "lezen" });
    else if (status.soort !== "gelijk") zetStatus({ soort: "gelijk", versie: k.versie, om: "" });
  }, [opslag, gebruiker, k?.versie, k?.rol, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bewaar = useCallback(async (p: Project, versie: number) => {
    if (!opslag) return;
    zetStatus({ soort: "bezig" });
    try {
      const json = JSON.stringify(p);
      const n = await opslag.bewaar(p, versie);
      if (n === null) {
        const c = await opslag.haal(p.id);
        const r = c ? leesProject(c.data) : null;
        if (c && r?.ok) zetStatus({ soort: "conflict", cloud: r.project, versie: c.versie, door: c.gewijzigdDoor });
        else zetStatus({ soort: "fout", tekst: "Bewaren geweigerd: je mag dit project niet (meer) bewerken." });
        return;
      }
      const kk = ref.current.koppeling;
      zetKoppeling({ ...kk, [p.id]: { versie: n, json, rol: kk[p.id]?.rol ?? "eigenaar" } });
      zetStatus({ soort: "gelijk", versie: n, om: new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }) });
    } catch (e) {
      zetStatus({ soort: "fout", tekst: (e as Error).message || "Geen verbinding met de cloud. Je werk staat veilig op dit toestel; de app probeert later opnieuw." });
    }
  }, [opslag]);

  // automatisch bewaren na een wijziging
  useEffect(() => {
    if (!opslag || !gebruiker || !project || !k || k.rol === "lezen") return;
    if (status.soort === "conflict" || status.soort === "bezig") return;
    const json = JSON.stringify(project);
    if (json === k.json) return;
    const t = setTimeout(() => { void bewaar(project, k.versie); }, 1500);
    return () => clearTimeout(t);
  }, [project, opslag, gebruiker, k, status.soort, bewaar]);

  // nieuwere versie van een ander toestel ophalen
  const haalNieuwere = useCallback(async () => {
    const { project: p, koppeling: kk, gebruiker: g, status: st } = ref.current;
    if (!opslag || !g || !p || !kk[p.id] || st.soort === "conflict" || st.soort === "bezig") return;
    try {
      const c = await opslag.haal(p.id);
      if (!c || c.versie <= kk[p.id]!.versie) return;
      const r = leesProject(c.data);
      if (!r.ok) return;
      const lokaalGewijzigd = JSON.stringify(p) !== kk[p.id]!.json;
      if (lokaalGewijzigd) { zetStatus({ soort: "conflict", cloud: r.project, versie: c.versie, door: c.gewijzigdDoor }); return; }
      zetKoppeling({ ...kk, [p.id]: { ...kk[p.id]!, versie: c.versie, json: JSON.stringify(r.project) } });
      vervang(r.project, `Bijgewerkt met de nieuwste versie uit de cloud${c.gewijzigdDoor ? ` (bewaard door ${c.gewijzigdDoor})` : ""}.`);
      zetStatus({ soort: "gelijk", versie: c.versie, om: "" });
    } catch { /* offline: later opnieuw */ }
  }, [opslag, vervang]);

  useEffect(() => {
    const zichtbaar = () => { if (document.visibilityState === "visible") void haalNieuwere(); };
    window.addEventListener("focus", zichtbaar);
    document.addEventListener("visibilitychange", zichtbaar);
    const iv = setInterval(() => { if (document.visibilityState === "visible") void haalNieuwere(); }, 30000);
    void haalNieuwere();
    return () => { window.removeEventListener("focus", zichtbaar); document.removeEventListener("visibilitychange", zichtbaar); clearInterval(iv); };
  }, [haalNieuwere, gebruiker, project?.id]);

  return {
    opslag, gebruiker, status, gekoppeld: !!k,
    herlaadInstelling: () => zetInstellingVersie((x) => x + 1),
    koppel: async () => { if (project) await bewaar(project, 0); },
    open: async (id: string, rol: Rol) => {
      if (!opslag) return;
      const c = await opslag.haal(id);
      const r = c ? leesProject(c.data) : null;
      if (!c || !r?.ok) throw new Error("Dit project kan niet geopend worden.");
      zetKoppeling({ ...ref.current.koppeling, [id]: { versie: c.versie, json: JSON.stringify(r.project), rol } });
      vervang(r.project, `Project '${r.project.naam}' geopend uit de cloud.`);
      zetStatus(rol === "lezen" ? { soort: "lezen" } : { soort: "gelijk", versie: c.versie, om: "" });
    },
    kiesMijne: async () => { if (status.soort === "conflict" && project) await bewaar(project, status.versie); },
    kiesCloud: () => {
      if (status.soort !== "conflict") return;
      zetKoppeling({ ...koppeling, [status.cloud.id]: { versie: status.versie, json: JSON.stringify(status.cloud), rol: koppeling[status.cloud.id]?.rol ?? "eigenaar" } });
      vervang(status.cloud, "Cloudversie geopend. Je vorige versie zit in Ongedaan maken.");
      zetStatus({ soort: "gelijk", versie: status.versie, om: "" });
    },
    ontkoppel: (id: string) => { const kk = { ...koppeling }; delete kk[id]; zetKoppeling(kk); },
  };
}

export type CloudApi = ReturnType<typeof useCloud>;

export function statusTekst(s: CloudStatus): string {
  switch (s.soort) {
    case "uit": return "Cloud";
    case "afgemeld": return "Cloud: niet aangemeld";
    case "los": return "Cloud: niet bewaard";
    case "bezig": return "Cloud: bewaren…";
    case "gelijk": return `Cloud: bewaard${s.om ? ` ${s.om}` : ""}`;
    case "lezen": return "Cloud: alleen lezen";
    case "fout": return "Cloud: probleem";
    case "conflict": return "Cloud: conflict";
  }
}

export function ConflictBalk({ cloud }: { cloud: CloudApi }) {
  const s = cloud.status;
  if (s.soort !== "conflict") return null;
  return (
    <div className="melding conflict" role="alert">
      <span>Dit project werd intussen ook op een ander toestel gewijzigd{s.door ? ` (door ${s.door})` : ""}. Welke versie wil je houden?</span>
      <span className="acties">
        <button onClick={() => void cloud.kiesMijne()}>Mijn versie (op dit toestel)</button>
        <button onClick={cloud.kiesCloud}>Versie uit de cloud</button>
      </span>
    </div>
  );
}

export function CloudPaneel({ cloud, project, sluit, meld }: { cloud: CloudApi; project: Project | null; sluit: () => void; meld: (s: string | null) => void }) {
  const { opslag, gebruiker, status } = cloud;
  const [email, zetEmail] = useState("");
  const [verstuurd, zetVerstuurd] = useState(false);
  const [lijst, zetLijst] = useState<CloudProject[] | null>(null);
  const [leden, zetLeden] = useState<Lid[]>([]);
  const [deelEmail, zetDeelEmail] = useState("");
  const [deelRol, zetDeelRol] = useState<Lid["rol"]>("lezen");
  const [inst, zetInst] = useState({ url: "", sleutel: "" });
  const [instFout, zetInstFout] = useState<string | null>(null);

  const herlaad = useCallback(async () => {
    if (!opslag || !gebruiker) return;
    try {
      zetLijst(await opslag.lijst());
      if (project && cloud.gekoppeld) zetLeden(await opslag.leden(project.id));
    } catch (e) { meld((e as Error).message); }
  }, [opslag, gebruiker, project?.id, cloud.gekoppeld]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void herlaad(); }, [herlaad, status.soort]);

  const eigen = lijst?.find((x) => x.id === project?.id);

  return (
    <div className="dialoog-achtergrond" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) sluit(); }}>
      <section className="kaart dialoog cloud" role="dialog" aria-modal="true" aria-label="Cloud">
        <div className="kaart-kop"><h2>Cloud: gsm en pc gelijk houden</h2><button onClick={sluit} aria-label="Sluiten">×</button></div>
        {!opslag ? (
          <>
            <p className="uitleg">De cloud is nog niet ingesteld. Daarvoor is een (gratis) Supabase-project nodig in de EU-regio; zie <em>docs/cloud-instellen.md</em>. Tot dan kan je een project doorgeven met <strong>Delen (link)</strong>.</p>
            {!vanBuitenIngesteld() && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const f = controleerUrl(inst.url) ?? controleerSleutel(inst.sleutel);
                zetInstFout(f);
                if (!f) { bewaarInstelling(inst); cloud.herlaadInstelling(); }
              }}>
                <Veld label="Supabase-projectadres"><input value={inst.url} onChange={(e) => zetInst({ ...inst, url: e.target.value })} placeholder="https://abcd1234.supabase.co" /></Veld>
                <Veld label="Publieke sleutel (anon / publishable — NOOIT de geheime)"><input value={inst.sleutel} onChange={(e) => zetInst({ ...inst, sleutel: e.target.value })} placeholder="sb_publishable_… of eyJ…" /></Veld>
                {instFout && <p className="melding" role="alert">{instFout}</p>}
                <div className="acties"><button className="primair" type="submit">Instellen</button><a className="knop" href="?cloud-demo">Demo proberen (zonder account)</a></div>
              </form>
            )}
          </>
        ) : !gebruiker ? (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try { const r = await opslag.meldAan(email); zetVerstuurd(r === "link-verstuurd"); meld(null); } catch (err) { meld((err as Error).message); }
          }}>
            {opslag.soort === "demo" && <p className="uitleg"><strong>Demo:</strong> alles blijft in deze browser. Open een tweede tabblad met ?cloud-demo om een tweede toestel na te bootsen.</p>}
            <Veld label="E-mailadres"><input type="email" required value={email} onChange={(e) => zetEmail(e.target.value)} autoComplete="email" /></Veld>
            <div className="acties"><button className="primair" type="submit">{opslag.soort === "demo" ? "Aanmelden" : "Stuur aanmeldlink"}</button></div>
            {verstuurd && <p className="bevestiging" role="status">Kijk in je mailbox en open de link op dit toestel. Doe hetzelfde op je ander toestel.</p>}
            <p className="uitleg">Geen wachtwoord: je krijgt een link per e-mail.</p>
          </form>
        ) : (
          <>
            <p>Aangemeld als <strong>{gebruiker.email}</strong> <button onClick={() => void opslag.meldAf()}>Afmelden</button></p>
            {project && (
              <>
                <h3>Dit project: {project.naam}</h3>
                {!cloud.gekoppeld ? (
                  <>
                    <p className="uitleg">Bewaar het in de cloud: daarna blijft het vanzelf gelijk op al je toestellen waar je aangemeld bent.</p>
                    <button className="primair" onClick={() => void cloud.koppel()}>Bewaren in de cloud</button>
                  </>
                ) : (
                  <p className="uitleg">{statusTekst(status)}{status.soort === "gelijk" ? ` (versie ${status.versie})` : ""}. Wijzigingen gaan vanzelf naar de cloud; andere toestellen halen ze op als je de app opent.</p>
                )}
                {status.soort === "fout" && <p className="melding" role="alert">{status.tekst}</p>}
                {cloud.gekoppeld && eigen?.rol === "eigenaar" && (
                  <>
                    <h3>Delen met klant, architect of ingenieur</h3>
                    <div className="rij">
                      <Veld label="E-mailadres"><input type="email" value={deelEmail} onChange={(e) => zetDeelEmail(e.target.value)} /></Veld>
                      <Veld label="Mag">
                        <select value={deelRol} onChange={(e) => zetDeelRol(e.target.value as Lid["rol"])}><option value="lezen">alleen bekijken</option><option value="bewerken">bewerken</option></select>
                      </Veld>
                    </div>
                    <button onClick={async () => { if (!deelEmail.includes("@")) return meld("Geef een geldig e-mailadres."); try { await opslag.deel(project.id, deelEmail, deelRol); zetDeelEmail(""); await herlaad(); } catch (e) { meld((e as Error).message); } }}>Delen</button>
                    {leden.length > 0 && <ul className="leden">{leden.map((l) => <li key={l.email}>{l.email} — {l.rol === "lezen" ? "bekijken" : "bewerken"} <button aria-label={`Stop delen met ${l.email}`} onClick={async () => { await opslag.stopDelen(project.id, l.email); await herlaad(); }}>×</button></li>)}</ul>}
                    <p className="uitleg">Wie je uitnodigt, meldt zich aan met dat e-mailadres en ziet het project in de lijst hieronder.</p>
                  </>
                )}
              </>
            )}
            <h3>Mijn projecten in de cloud</h3>
            {lijst === null ? <p className="uitleg">Laden…</p> : lijst.length === 0 ? <p className="uitleg">Nog geen projecten.</p> : (
              <ul className="cloud-lijst">
                {lijst.map((x) => (
                  <li key={x.id}>
                    <span><strong>{x.naam}</strong> <span className="zacht">· {new Date(x.gewijzigd).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })}{x.rol !== "eigenaar" ? ` · gedeeld (${x.rol === "lezen" ? "bekijken" : "bewerken"})` : ""}</span></span>
                    <span>
                      {x.id === project?.id ? <span className="zacht">open</span> : <button onClick={async () => {
                        if (project && !window.confirm(`Project '${x.naam}' openen? Je huidige project blijft in Ongedaan maken${cloud.gekoppeld ? " en in de cloud" : ""}.`)) return;
                        try { await cloud.open(x.id, x.rol); sluit(); } catch (e) { meld((e as Error).message); }
                      }}>Openen</button>}
                      {x.rol === "eigenaar" && <button className="gevaar" aria-label={`${x.naam} verwijderen uit de cloud`} onClick={async () => {
                        if (!window.confirm(`'${x.naam}' verwijderen uit de cloud? Op dit toestel blijft het staan.`)) return;
                        await opslag.verwijder(x.id); cloud.ontkoppel(x.id); await herlaad();
                      }}>×</button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="uitleg klein">Privacy: projecten staan bij Supabase op servers in de EU (regio gekozen bij het aanmaken). Een opmeting van een woning bevat persoonsgegevens (GDPR): deel alleen met wie het mag zien.</p>
      </section>
    </div>
  );
}
