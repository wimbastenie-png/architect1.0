import { euro, raming, type Lastenboek, type Prijzen } from "@scanapp/core";
import { getal } from "./ui.tsx";

export const BTW_TARIEVEN = [21, 12, 6, 0];

export function LastenboekWeergave({ lb, prijzen, zetPrijs, btw, zetBtw, kopieer }: {
  lb: Lastenboek;
  prijzen: Prijzen;
  zetPrijs: (code: string, prijs: number | undefined) => void;
  btw: number;
  zetBtw: (b: number) => void;
  kopieer: () => void;
}) {
  const r = raming(lb, prijzen, btw);
  return (
    <>
      <div className="tabel-wrap">
        <table className="lastenboek">
          <thead><tr><th>Post</th><th>Hoev.</th><th>€/eenh.</th><th>Bedrag</th></tr></thead>
          <tbody>
            {r.regels.map((t) => (
              <tr key={t.code}>
                <td>{t.code} {t.omschrijving}</td>
                <td>{t.eenheid === "st" ? t.hoeveelheid : getal(t.hoeveelheid)} {t.eenheid}</td>
                <td>
                  <input className="prijs" type="number" inputMode="decimal" min={0} step="0.01" aria-label={`Prijs ${t.omschrijving}`}
                    defaultValue={prijzen[t.code] ?? ""} key={t.code + (prijzen[t.code] ?? "")}
                    onBlur={(e) => { const w = e.target.value.trim(); zetPrijs(t.code, w === "" ? undefined : Math.max(0, +w.replace(",", "."))); }} />
                </td>
                <td>{t.bedrag === undefined ? "–" : euro(t.bedrag)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>Totaal excl. btw</td><td>{euro(r.exclBtw)}</td></tr>
            <tr>
              <td colSpan={3}>
                Btw{" "}
                <select aria-label="Btw-tarief" value={btw} onChange={(e) => zetBtw(+e.target.value)}>
                  {BTW_TARIEVEN.map((b) => <option key={b} value={b}>{b} %</option>)}
                </select>
              </td>
              <td>{euro(r.btw)}</td>
            </tr>
            <tr><td colSpan={3}>Totaal incl. btw</td><td>{euro(r.inclBtw)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="acties"><button onClick={kopieer}>Kopiëren voor offerte</button></div>
      <p className="uitleg klein">
        Prijzen worden op dit toestel onthouden voor al je projecten. Kies zelf het juiste btw-tarief: de voorwaarden voor 6 % hangen af van de woning en de werken.
        Hoeveelheden ter indicatie; eigen postindeling (niet Standaardbestek 250).
      </p>
    </>
  );
}
