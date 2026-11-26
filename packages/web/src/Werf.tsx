/**
 * Werf: werffoto's per ruimte, opvolgpunten, vorderingsstaat en offerte.
 */
import {
  BTW6_VOORWAARDEN, nieuweVordering, offerteRegels, STANDAARD_BETALING, vorderingsstaat, euro,
  type Firma, type OfferteInvoer, type Prijzen, type Project, type Verdieping,
} from "@scanapp/core";
import { useMemo, useState } from "react";
import { FotoVeld, verklein } from "./Fotos.tsx";
import { leesOpslag, schrijfOpslag, Veld } from "./ui.tsx";

const FIRMA = "architect1.0:firma";
const leesFirma = (x: unknown): Firma => (x && typeof x === "object" && typeof (x as Firma).naam === "string" ? (x as Firma) : { naam: "" });

export function WerfPaneel(props: {
  project: Project; v: Verdieping; ruimteId: string | null; zetRuimteId: (id: string | null) => void;
  wijzigProject: (p: Project) => void; prijzen: Prijzen;
  exporteer: (soort: "offerte" | "vordering", data: { firma: Firma; offerte?: OfferteInvoer; nr?: number; btw?: 6 | 21 }) => void;
}) {
  const { project, v, ruimteId } = props;
  const r = v.ruimtes.find((x) => x.id === ruimteId);
  const [punt, zetPunt] = useState("");
  const [firma, zetFirmaState] = useState<Firma>(() => leesOpslag(FIRMA, leesFirma, { naam: "" }));
  const zetFirma = (f: Firma) => { zetFirmaState(f); schrijfOpslag(FIRMA, f); };
  const [off, zetOff] = useState<OfferteInvoer>(() => ({
    nummer: `${new Date().getFullYear()}-${String(project.vorderingen.length + 1).padStart(3, "0")}`, datum: new Date().toISOString().slice(0, 10),
    klant: project.vergunning?.bouwheer ?? "", klantAdres: [project.adres?.straat, project.adres?.postcode, project.adres?.gemeente].filter(Boolean).join(" "),
    btwPct: 21, geldigheidDagen: 30, betaling: STANDAARD_BETALING,
  }));
  const fotos = project.fotos.filter((f) => f.soort === "werf" && (!ruimteId || f.ruimteId === ruimteId));
  const punten = project.opvolging.filter((x) => !ruimteId || x.ruimteId === ruimteId);
  const open = project.vorderingen.find((x) => !x.afgesloten) ?? project.vorderingen[project.vorderingen.length - 1];
  const regels = useMemo(() => offerteRegels(project, props.prijzen), [project, props.prijzen]);
  const staat = useMemo(() => (open ? vorderingsstaat(project, props.prijzen, open.nr) : null), [project, props.prijzen, open]);
  const naamRuimte = (id?: string) => project.verdiepingen.flatMap((x) => x.ruimtes).find((x) => x.id === id)?.naam ?? "algemeen";

  return (
    <section className="kaart werf">
      <div className="kaart-kop"><h2>Werf{r ? `: ${r.naam}` : ""}</h2>{r && <button onClick={() => props.zetRuimteId(null)} aria-label="Alle ruimtes">×</button>}</div>
      <p className="uitleg">Tik een ruimte aan in het plan om foto's en punten per ruimte te zien; zonder keuze zie je alles.</p>

      <h3>Werffoto's {r ? `(${r.naam})` : "(alle ruimtes)"}</h3>
      <FotoVeld ids={fotos.map((f) => f.id)} label="Werffoto nemen"
        voegToe={(id) => props.wijzigProject({ ...project, fotos: [...project.fotos, { id, soort: "werf", datum: new Date().toISOString(), ruimteId: ruimteId ?? undefined }] })}
        verwijder={(id) => props.wijzigProject({ ...project, fotos: project.fotos.filter((f) => f.id !== id) })} />
      {fotos.length > 0 && <ul className="leden">{fotos.map((f) => <li key={f.id}><span>{new Date(f.datum).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })} · {naamRuimte(f.ruimteId)}</span>
        <input aria-label="Bijschrift" placeholder="bijschrift" defaultValue={f.bijschrift ?? ""} onBlur={(e) => props.wijzigProject({ ...project, fotos: project.fotos.map((x) => (x.id === f.id ? { ...x, bijschrift: e.target.value || undefined } : x)) })} /></li>)}</ul>}

      <h3>Op te volgen {r ? `(${r.naam})` : ""}</h3>
      <div className="rij">
        <Veld label="Nieuw punt"><input value={punt} onChange={(e) => zetPunt(e.target.value)} placeholder="bv. stopcontact verplaatsen, tegels bestellen" /></Veld>
        <button onClick={() => { if (!punt.trim()) return; props.wijzigProject({ ...project, opvolging: [...project.opvolging, { id: `ov-${Date.now().toString(36)}`, ruimteId: ruimteId ?? undefined, tekst: punt.trim(), status: "open", datum: new Date().toISOString() }] }); zetPunt(""); }}>+ Punt</button>
      </div>
      <ul className="opvolging">
        {punten.map((x) => (
          <li key={x.id} className={x.status === "klaar" ? "klaar" : ""}>
            <label className="vinkje"><input type="checkbox" checked={x.status === "klaar"} onChange={(e) => props.wijzigProject({ ...project, opvolging: project.opvolging.map((y) => (y.id === x.id ? { ...y, status: e.target.checked ? "klaar" : "open" } : y)) })} /> {x.tekst}</label>
            <span className="zacht"> {naamRuimte(x.ruimteId)} · {new Date(x.datum).toLocaleDateString("nl-BE")}</span>
            <button aria-label="Punt verwijderen" onClick={() => props.wijzigProject({ ...project, opvolging: project.opvolging.filter((y) => y.id !== x.id) })}>×</button>
          </li>
        ))}
      </ul>

      <h3>Vorderingsstaat {open ? `${open.nr}${open.afgesloten ? " (afgesloten)" : ""}` : ""}</h3>
      {regels.regels.length === 0 ? <p className="uitleg">Geef eerst eenheidsprijzen in het lastenboek (Plan → Meetstaat → Lastenboek).</p> : !open ? (
        <button onClick={() => props.wijzigProject(nieuweVordering(project))}>Eerste vorderingsstaat beginnen</button>
      ) : (
        <>
          <table className="tabel klein">
            <thead><tr><th>Post</th><th className="getal">Bedrag</th><th className="getal">Vorig</th><th className="getal">Nu %</th><th className="getal">Deze staat</th></tr></thead>
            <tbody>{staat!.regels.map((x) => (
              <tr key={x.code}>
                <td>{x.code} {x.omschrijving}</td>
                <td className="getal">{euro(x.bedrag)}</td>
                <td className="getal">{Math.round(x.vorigProcent)} %</td>
                <td className="getal"><input className="prijs" type="number" inputMode="numeric" min={0} max={100} aria-label={`Percentage ${x.omschrijving}`} disabled={open.afgesloten} value={x.procent} onChange={(e) => props.wijzigProject({ ...project, vorderingen: project.vorderingen.map((y) => (y.nr === open.nr ? { ...y, procent: { ...y.procent, [x.code]: Math.max(0, Math.min(100, +e.target.value || 0)) } } : y)) })} /></td>
                <td className="getal">{euro(x.dezeStaat)}</td>
              </tr>
            ))}</tbody>
          </table>
          <p>Uitgevoerd: <strong>{euro(staat!.totaalUitgevoerd)}</strong> · deze staat: <strong>{euro(staat!.dezeStaat)}</strong> excl. btw</p>
          <div className="acties">
            <button className="primair" onClick={() => props.exporteer("vordering", { firma, nr: open.nr, btw: off.btwPct })}>Vorderingsstaat (PDF)</button>
            <button onClick={() => { if (window.confirm(`Staat ${open.nr} afsluiten en staat ${open.nr + 1} beginnen?`)) props.wijzigProject(nieuweVordering(project)); }}>Afsluiten en nieuwe staat</button>
          </div>
        </>
      )}

      <h3>Offerte</h3>
      <details>
        <summary>Firmagegevens en logo (op dit toestel bewaard)</summary>
        <div className="velden">
          {(["naam", "adres", "btw", "iban", "telefoon", "email"] as const).map((k) => (
            <Veld key={k} label={{ naam: "Firmanaam", adres: "Adres", btw: "Btw-nummer", iban: "IBAN", telefoon: "Telefoon", email: "E-mail" }[k]}>
              <input value={firma[k] ?? ""} onChange={(e) => zetFirma({ ...firma, [k]: e.target.value || (k === "naam" ? "" : undefined) })} />
            </Veld>
          ))}
        </div>
        <label className="knop">
          {firma.logo ? "Ander logo" : "Logo kiezen (PNG of JPEG)"}
          <input type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const blob = await verklein(f, 600);
            const reader = new FileReader();
            reader.onload = () => zetFirma({ ...firma, logo: String(reader.result) });
            reader.readAsDataURL(blob.type === "image/png" || blob.type === "image/jpeg" ? blob : f);
          }} />
        </label>
        {firma.logo && <img src={firma.logo} alt="Logo" className="logo-voorbeeld" />}
      </details>
      <div className="velden">
        <Veld label="Offertenummer"><input value={off.nummer} onChange={(e) => zetOff({ ...off, nummer: e.target.value })} /></Veld>
        <Veld label="Klant"><input value={off.klant} onChange={(e) => zetOff({ ...off, klant: e.target.value })} /></Veld>
        <Veld label="Adres klant"><input value={off.klantAdres ?? ""} onChange={(e) => zetOff({ ...off, klantAdres: e.target.value })} /></Veld>
        <Veld label="Btw"><select value={off.btwPct} onChange={(e) => zetOff({ ...off, btwPct: +e.target.value as 6 | 21 })}><option value={21}>21 %</option><option value={6}>6 % (renovatie, onder voorwaarden)</option></select></Veld>
        <Veld label="Geldig (dagen)"><input type="number" min={1} value={off.geldigheidDagen} onChange={(e) => zetOff({ ...off, geldigheidDagen: Math.max(1, +e.target.value || 30) })} /></Veld>
        <Veld label="Betalingsvoorwaarden"><input value={off.betaling} onChange={(e) => zetOff({ ...off, betaling: e.target.value })} /></Veld>
      </div>
      {off.btwPct === 6 && <p className="uitleg">{BTW6_VOORWAARDEN}</p>}
      <p>{regels.regels.length} posten met een prijs · totaal excl. btw <strong>{euro(regels.excl)}</strong>{regels.zonderPrijs.length ? ` · ${regels.zonderPrijs.length} posten zonder prijs (niet in de offerte)` : ""}</p>
      <div className="acties">
        <button className="primair" disabled={!firma.naam || !regels.regels.length} onClick={() => props.exporteer("offerte", { firma, offerte: off })}>Offerte (PDF)</button>
      </div>
      {!firma.naam && <p className="uitleg">Vul eerst de firmanaam in.</p>}
    </section>
  );
}
