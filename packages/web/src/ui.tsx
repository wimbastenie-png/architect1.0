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

export function download(naam: string, inhoud: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([inhoud], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const bestandsnaam = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
