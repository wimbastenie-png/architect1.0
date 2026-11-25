/** Kleine gedeelde onderdelen van de webapp. */
export function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="veld"><span>{label}</span>{children}</label>;
}

export const getal = (x: number) => x.toFixed(2).replace(".", ",");

/** Lezen/schrijven in de browseropslag; mag nooit de app laten crashen (privévenster, geblokkeerd). */
export function leesOpslag<T>(sleutel: string, lees: (x: unknown) => T, standaard: T): T {
  try {
    const ruw = localStorage.getItem(sleutel);
    return ruw ? lees(JSON.parse(ruw)) : standaard;
  } catch {
    return standaard;
  }
}
export function schrijfOpslag(sleutel: string, waarde: unknown) {
  try {
    localStorage.setItem(sleutel, JSON.stringify(waarde));
  } catch {
    /* opslag niet beschikbaar: werkt verder zonder onthouden */
  }
}
