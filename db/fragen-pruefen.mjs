/**
 * Misst zwei Mängel, die Multiple-Choice-Fragen wertlos machen.
 *
 * 1. Der Längen-Verräter. Ist die richtige Option regelmässig die längste und
 *    konkreteste, lässt sich die Frage ohne jedes Wissen lösen: man nimmt die
 *    ausführliche Antwort und schliesst die vagen aus. Bei vier Optionen wäre
 *    die Zufallserwartung 25 Prozent.
 *
 * 2. Der Quellenbezug im Fragetext. Wer gefragt wird, was auf einer bestimmten
 *    Seite eines bestimmten Dokuments steht, lernt die Quelle statt der Sache.
 *    Benannte Begriffe sind davon ausgenommen — die Prebisch-Singer-Hypothese
 *    heisst nun einmal so; gemeint sind Verweise auf das Dokument selbst.
 *
 *   node db/fragen-pruefen.mjs              alles
 *   node db/fragen-pruefen.mjs <datei.json> eine Liste von Fragen prüfen
 */
import { readFileSync } from "node:fs";

const pfad = process.argv[2];
const roh = JSON.parse(readFileSync(pfad ?? new URL("../lernstand/daten/fragen.json", import.meta.url), "utf8"));
const fragen = Array.isArray(roh) ? roh : roh.fragen;

/* ---------- 1. Längen-Verräter ---------- */
const einzel = fragen.filter((q) => q.typ === "mc" && q.optionen && q.loesung?.length === 1);
let laengste = 0, deutlich = 0;
const schlimm = [];
for (const q of einzel) {
  const L = q.optionen.map((o) => o.length);
  const r = L[q.loesung[0]];
  const f = L.filter((_, i) => i !== q.loesung[0]);
  if (r > Math.max(...f)) laengste++;
  const schnitt = f.reduce((a, b) => a + b, 0) / f.length;
  if (r > schnitt * 1.4) { deutlich++; schlimm.push({ id: q.id, r, schnitt: Math.round(schnitt) }); }
}

/* ---------- 2. Quellenbezug im Fragetext ---------- */
// Nur Verweise auf das Dokument, nicht auf benannte Konzepte.
const DOKUMENT = /\b(laut|gemäss|nach)\s+(dem\s+|der\s+|des\s+)?(Vorlesung|Skript|Folie|Text|Reading|Workbook|Compendio|Buch|Artikel|Kapitel|Lehrbuch|Modul)|Reading-?Text|Workbook|Compendio|\bKapitel\s*\d|\bSeite\s*\d|\bFolie\s*\d|\bLB\s*\d|im Text\b|des Textes\b|Modulleitfrage/i;
const quellenbezug = fragen.filter((q) => DOKUMENT.test(q.frage || ""));

/* ---------- Ausgabe ---------- */
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
console.log(`Geprüft: ${fragen.length} Fragen, davon ${einzel.length} Single-Choice\n`);

console.log("1. Längen-Verräter");
console.log(`   richtige Option ist die längste:        ${laengste}/${einzel.length}  (${pct(laengste, einzel.length)}%,  Zufall 25%)`);
console.log(`   richtige >40% länger als die falschen:  ${deutlich}/${einzel.length}  (${pct(deutlich, einzel.length)}%)`);
if (schlimm.length) {
  console.log("   auffälligste:");
  for (const s of schlimm.sort((a, b) => b.r / b.schnitt - a.r / a.schnitt).slice(0, 8))
    console.log(`     ${s.id.padEnd(20)} richtig ${s.r}, falsch im Schnitt ${s.schnitt}`);
}

console.log("\n2. Quellenbezug im Fragetext");
console.log(`   Fragen, die auf ein Dokument verweisen: ${quellenbezug.length}/${fragen.length}  (${pct(quellenbezug.length, fragen.length)}%)`);
for (const q of quellenbezug.slice(0, 8)) console.log(`     ${q.id.padEnd(20)} ${q.frage.slice(0, 80)}`);
if (quellenbezug.length > 8) console.log(`     … und ${quellenbezug.length - 8} weitere`);

const sauber = pct(laengste, einzel.length) <= 40 && quellenbezug.length === 0;
console.log(sauber ? "\nBeides im Rahmen.\n" : "\nDa ist noch Arbeit.\n");
