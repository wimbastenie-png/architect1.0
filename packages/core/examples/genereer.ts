/** Schrijft voorbeelduitvoer naar packages/core/uitvoer/: JSON, CSV, DXF en SVG. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { meetstaat, meetstaatCSV, verdiepingNaarDXF, verdiepingNaarSVG } from "../src/index.ts";
import { appartement } from "./appartement.ts";

const uit = join(dirname(fileURLToPath(import.meta.url)), "..", "uitvoer");
mkdirSync(uit, { recursive: true });
const v = appartement.verdiepingen[0]!;

writeFileSync(join(uit, "appartement.json"), JSON.stringify(appartement, null, 2));
writeFileSync(join(uit, "meetstaat.csv"), meetstaatCSV(meetstaat(appartement)));
writeFileSync(join(uit, "gelijkvloers.dxf"), verdiepingNaarDXF(v));
writeFileSync(join(uit, "gelijkvloers.svg"), verdiepingNaarSVG(v));
console.table(meetstaat(appartement));
console.log(`Bestanden geschreven naar ${uit}`);
