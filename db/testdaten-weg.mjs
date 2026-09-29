/**
 * Raeumt weg, was beim Erproben des Logins entstanden ist.
 *
 * Betroffen sind ausschliesslich Konten auf @lernstand.test und die von
 * ihnen erzeugten Zeilen. Echte Konten und echter Lernstand bleiben.
 *
 *   node db/testdaten-weg.mjs
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((z) => z && !z.startsWith("#"))
    .map((z) => { const i = z.indexOf("="); return [z.slice(0, i), z.slice(i + 1)]; }),
);

const c = new Client({ connectionString: env.DATABASE_URL });
await c.connect();
await c.query("begin");
try {
  const ids = `select id::text from neon_auth."user" where email like '%@lernstand.test'`;
  for (const t of ["fortschritt", "runden"]) {
    const r = await c.query(`delete from ${t} where benutzer_id in (${ids})`);
    console.log(`  ${t}: ${r.rowCount} Zeilen`);
  }
  for (const t of ['neon_auth.session', 'neon_auth.account']) {
    const r = await c.query(`delete from ${t} where "userId"::text in (${ids})`);
    console.log(`  ${t}: ${r.rowCount} Zeilen`);
  }
  const u = await c.query(`delete from neon_auth."user" where email like '%@lernstand.test'`);
  console.log(`  Konten: ${u.rowCount}`);
  await c.query("commit");
} catch (e) {
  await c.query("rollback");
  console.error("Fehlgeschlagen, nichts geaendert:", e.message);
  process.exit(1);
}

for (const t of ["fortschritt", "runden"]) {
  const r = await c.query(`select benutzer_id, count(*)::int n from ${t} group by 1 order by 2 desc`);
  console.log(`\n${t}: ` + (r.rows.length ? r.rows.map((z) => `${z.benutzer_id}=${z.n}`).join("  ") : "(leer)"));
}
const rest = await c.query(`select count(*)::int n from neon_auth."user"`);
console.log(`\nKonten insgesamt noch: ${rest.rows[0].n}`);
await c.end();
