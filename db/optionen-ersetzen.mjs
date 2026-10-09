/**
 * Ersetzt einzelne Antwortoptionen und Fragetexte im Pool.
 *
 * Die Flickdatei ist JSON:
 *
 *   { "VHRE-W1-01": { "optionen": { "1": "…", "2": "…" } },
 *     "VHRE-W2-12": { "frage": "…" } }
 *
 * Geprüft wird vorher, was später teuer wäre: Die richtige Option darf nie
 * überschrieben werden — sonst stimmt der gespeicherte Fortschritt nicht mehr
 * mit dem überein, was die Frage prüft. Kennungen bleiben unangetastet.
 *
 *   node db/optionen-ersetzen.mjs <flickdatei.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

const POOL = new URL("../lernstand/daten/fragen.json", import.meta.url);
const flickPfad = process.argv[2];
if (!flickPfad) { console.error("Flickdatei fehlt."); process.exit(1); }

const roh = JSON.parse(readFileSync(POOL, "utf8"));
const flick = JSON.parse(readFileSync(flickPfad, "utf8"));
const nachId = new Map(roh.fragen.map((q) => [q.id, q]));

const fehler = [];
for (const [id, aenderung] of Object.entries(flick)) {
  const q = nachId.get(id);
  if (!q) { fehler.push(`${id}: gibt es nicht`); continue; }
  for (const [i, text] of Object.entries(aenderung.optionen ?? {})) {
    const k = Number(i);
    if (!Number.isInteger(k) || k < 0 || k >= q.optionen.length) fehler.push(`${id}: Index ${i} ungültig`);
    else if (q.loesung.includes(k)) fehler.push(`${id}: Index ${k} ist die RICHTIGE Option`);
    // Nur gegen Leeres absichern. Kurze Optionen sind legitim: bei
    // Grammatikfragen ist "is working" die vollständige Antwort.
    else if (typeof text !== "string" || text.trim().length < 2) fehler.push(`${id}: Option ${k} ist leer`);
  }
  if (aenderung.loesungstext && !q.loesung.includes(0) && false) { /* Platzhalter */ }
}
if (fehler.length) { console.error("Nichts geändert:\n  " + fehler.join("\n  ")); process.exit(1); }

let optionen = 0, fragen = 0, richtige = 0;
for (const [id, aenderung] of Object.entries(flick)) {
  const q = nachId.get(id);
  if (aenderung.frage) { q.frage = aenderung.frage; fragen++; }
  for (const [i, text] of Object.entries(aenderung.optionen ?? {})) { q.optionen[Number(i)] = text; optionen++; }
  // Die richtige Option darf gekürzt werden, aber nur über ein eigenes Feld,
  // damit es nie aus Versehen passiert.
  if (aenderung.richtig) { q.optionen[q.loesung[0]] = aenderung.richtig; richtige++; }
  if (aenderung.erklaerung) q.erklaerung = aenderung.erklaerung;
  // Karteikarten haben keine Optionen — bei ihnen ändert sich nur der Fragetext.
  if (q.optionen && new Set(q.optionen).size !== q.optionen.length) {
    console.error(`${id}: doppelte Option entstanden`); process.exit(1);
  }
}

roh.stand = new Date().toISOString().slice(0, 10);
writeFileSync(POOL, JSON.stringify(roh, null, 1) + "\n");
console.log(`${optionen} Optionen, ${richtige} richtige Optionen und ${fragen} Fragetexte angepasst.`);
