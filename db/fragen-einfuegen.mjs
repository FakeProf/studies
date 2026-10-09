/**
 * Fügt neue Fragen in den Pool ein.
 *
 * Geprüft wird vorher alles, was später teuer wäre: doppelte Kennungen (der
 * Fortschritt hängt daran), fehlende Felder, ungültige Lösungsindizes,
 * unbekannte Module und Kategorien. Eingefügt wird am Ende des jeweiligen
 * Moduls, damit die Datei nach Modulen sortiert bleibt.
 *
 *   node db/fragen-einfuegen.mjs <datei.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

const POOL = new URL("../lernstand/daten/fragen.json", import.meta.url);
const quelle = process.argv[2];
if (!quelle) { console.error("Welche Datei?"); process.exit(1); }

const roh = JSON.parse(readFileSync(POOL, "utf8"));
const neu = JSON.parse(readFileSync(quelle, "utf8"));

const ids = new Set(roh.fragen.map((q) => q.id));
const module = new Set(roh.fragen.map((q) => q.modul));
const kategorien = new Set(roh.fragen.map((q) => q.kategorie));
const TYPEN = new Set(["mc", "flash", "match", "order"]);

const fehler = [];
for (const q of neu) {
  const wo = q.id ?? "(ohne id)";
  if (ids.has(q.id)) fehler.push(`${wo}: Kennung gibt es schon`);
  ids.add(q.id);
  for (const f of ["id", "modul", "woche", "kategorie", "typ", "lernziel", "frage", "erklaerung", "quelle"])
    if (q[f] === undefined) fehler.push(`${wo}: Feld ${f} fehlt`);
  if (!TYPEN.has(q.typ)) fehler.push(`${wo}: unbekannter Typ ${q.typ}`);
  if (!module.has(q.modul)) fehler.push(`${wo}: Modul ${q.modul} unbekannt`);
  if (!kategorien.has(q.kategorie)) fehler.push(`${wo}: Kategorie ${q.kategorie} unbekannt`);

  if (q.typ === "mc") {
    if (!Array.isArray(q.optionen) || q.optionen.length < 3) fehler.push(`${wo}: mindestens 3 Optionen`);
    if (new Set(q.optionen ?? []).size !== (q.optionen ?? []).length) fehler.push(`${wo}: doppelte Option`);
    if (!Array.isArray(q.loesung) || !q.loesung.length) fehler.push(`${wo}: loesung fehlt`);
    for (const i of q.loesung ?? [])
      if (!Number.isInteger(i) || i < 0 || i >= (q.optionen?.length ?? 0)) fehler.push(`${wo}: Lösungsindex ${i} ungültig`);
  }
  if (q.typ === "flash" && !q.antwort) fehler.push(`${wo}: antwort fehlt`);
  if (q.typ === "match") {
    if (!Array.isArray(q.paare) || q.paare.length < 3) fehler.push(`${wo}: mindestens 3 Paare`);
    for (const p of q.paare ?? []) if (!Array.isArray(p) || p.length !== 2) fehler.push(`${wo}: Paar braucht zwei Teile`);
  }
  if (q.typ === "order" && (!Array.isArray(q.items) || q.items.length < 3)) fehler.push(`${wo}: mindestens 3 Schritte`);
}
if (fehler.length) { console.error("NICHT eingefügt:\n  " + fehler.join("\n  ")); process.exit(1); }

// Hinter die letzte Frage desselben Moduls setzen.
for (const q of neu) {
  let letzte = -1;
  roh.fragen.forEach((x, i) => { if (x.modul === q.modul) letzte = i; });
  roh.fragen.splice(letzte + 1, 0, q);
}

roh.stand = new Date().toISOString().slice(0, 10);
writeFileSync(POOL, JSON.stringify(roh, null, 1) + "\n");

const proModul = {};
for (const q of neu) proModul[q.modul] = (proModul[q.modul] || 0) + 1;
console.log(`${neu.length} Fragen eingefügt (${Object.entries(proModul).map(([m, n]) => `${m} ${n}`).join(", ")}).`);
console.log(`Pool jetzt ${roh.fragen.length} Fragen.`);
