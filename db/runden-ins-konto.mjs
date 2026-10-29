/**
 * Holt Runden, die abgemeldet im offenen Stand gelandet sind, in ein Konto.
 * Die Originale bleiben, das Konto bekommt Kopien mit der Kennung "<id>-k" —
 * dieselbe, die die App beim Anmelden vergibt, damit nichts doppelt kommt.
 * Den Fortschritt je Frage trägt es ebenfalls nach: so oft, wie die Frage in
 * den kopierten Runden vorkommt.
 *
 *   node db/runden-ins-konto.mjs <benutzer_id> <von YYYY-MM-DD> <bis YYYY-MM-DD> [--schreiben]
 * Ohne --schreiben ist es ein Probelauf.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split(/\r?\n/).filter((z) => z && !z.startsWith("#"))
  .map((z) => { const i = z.indexOf("="); return [z.slice(0, i), z.slice(i + 1)]; }));

const [konto, von, bis] = process.argv.slice(2);
const schreiben = process.argv.includes("--schreiben");
if (!konto || !von || !bis) { console.error("Aufruf: <benutzer_id> <von> <bis> [--schreiben]"); process.exit(1); }

const c = new Client({ connectionString: env.DATABASE_URL });
await c.connect();
await c.query("begin");

const zeitraum = `ts >= extract(epoch from ($1::date)::timestamp at time zone 'Europe/Zurich')*1000
              and ts <  extract(epoch from ($2::date + 1)::timestamp at time zone 'Europe/Zurich')*1000`;
const runden = (await c.query(`select * from runden where benutzer_id='anonym' and ${zeitraum} order by ts`, [von, bis])).rows;
console.log(`${runden.length} Runden, ${runden.reduce((s, r) => s + r.total, 0)} Fragen`);

const neu = await c.query(`
  insert into runden (id, ts, scope, total, punkte, dauer, fragen, benutzer_id)
  select id || '-k', ts, scope, total, punkte, dauer, fragen, $3
    from runden where benutzer_id='anonym' and ${zeitraum}
  on conflict (id) do nothing`, [von, bis, konto]);
console.log(`Runden kopiert: ${neu.rowCount}`);

// Wie oft kam jede Frage in diesen Runden dran?
const anzahl = new Map();
for (const r of runden) for (const f of (r.fragen || [])) anzahl.set(f, (anzahl.get(f) || 0) + 1);

let eingefuegt = 0, ergaenzt = 0, uebersprungen = 0;
for (const [frage, n] of anzahl) {
  const offen = (await c.query(`select * from fortschritt where benutzer_id='anonym' and frage_id=$1`, [frage])).rows[0];
  if (!offen) { uebersprungen++; continue; }
  const score = Number(offen.letzter_score ?? 0);
  const punkte = Number(offen.versuche) === n ? Number(offen.punkte) : +(n * score).toFixed(2);
  const eigen = (await c.query(`select * from fortschritt where benutzer_id=$1 and frage_id=$2`, [konto, frage])).rows[0];
  if (!eigen) {
    await c.query(`insert into fortschritt (benutzer_id, frage_id, versuche, punkte, letzter_score, zuletzt)
                   values ($1,$2,$3,$4,$5,$6)`, [konto, frage, n, punkte, offen.letzter_score, offen.zuletzt]);
    eingefuegt++;
  } else if (new Date(eigen.zuletzt) < new Date(offen.zuletzt)) {
    await c.query(`update fortschritt set versuche=versuche+$3, punkte=punkte+$4, letzter_score=$5, zuletzt=$6
                   where benutzer_id=$1 and frage_id=$2`, [konto, frage, n, punkte, offen.letzter_score, offen.zuletzt]);
    ergaenzt++;
  } else uebersprungen++;
}
console.log(`Fortschritt: ${eingefuegt} neu, ${ergaenzt} ergänzt, ${uebersprungen} übersprungen`);

await c.query(schreiben ? "commit" : "rollback");
console.log(schreiben ? "Geschrieben." : "Probelauf — nichts geschrieben.");
await c.end();
