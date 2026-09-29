/**
 * Laesst die Datenbank die Benutzerkennung selbst eintragen.
 *
 * Hintergrund: Neons Data API haelt hinter dem Lastverteiler mehrere
 * PostgREST-Instanzen, von denen eine ihren Schema-Cache nicht erneuert hat.
 * Sie kennt die Spalte benutzer_id nicht und lehnt jeden Datensatz ab, der
 * sie nennt (PGRST204). Ein Browser bleibt fest auf einer Instanz und kann
 * dem nicht ausweichen.
 *
 * Steht die Kennung dagegen als DEFAULT in der Tabelle, muss die App sie gar
 * nicht mitschicken — und der Cache ist gleichgueltig. Sicherer ist es
 * ausserdem: die Kennung kommt aus dem geprueften Token statt aus dem Browser.
 *
 * Fuer die Rolle `anonymous` vergibt Neon Auth ebenfalls eine eigene Kennung.
 * Die wollen wir hier nicht: ohne Anmeldung teilen sich alle den offenen Stand
 * unter 'anonym', sonst waere der Fortschritt bei jeder neuen anonymen Sitzung
 * wieder weg. Deshalb entscheidet die Rolle, nicht die Kennung.
 *
 *   node db/kennung-per-default.mjs
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((z) => z && !z.startsWith("#"))
    .map((z) => { const i = z.indexOf("="); return [z.slice(0, i), z.slice(i + 1)]; }),
);

const VORGABE = `case when current_user = 'authenticated'
                      then coalesce(nullif(auth.user_id(), ''), 'anonym')
                      else 'anonym' end`;

const c = new Client({ connectionString: env.DATABASE_URL });
await c.connect();
await c.query("begin");
try {
  for (const t of ["fortschritt", "runden"]) {
    await c.query(`alter table ${t} alter column benutzer_id set default (${VORGABE})`);
  }
  await c.query("commit");
  console.log("Vorgabewert gesetzt.\n");
} catch (e) {
  await c.query("rollback");
  console.error("Fehlgeschlagen, nichts geaendert:", e.message);
  process.exit(1);
}

const r = await c.query(
  `select table_name, column_default from information_schema.columns
    where table_schema = 'public' and column_name = 'benutzer_id' order by table_name`,
);
for (const z of r.rows) console.log(`  ${z.table_name}: ${z.column_default.replace(/\s+/g, " ")}`);
await c.end();
