/**
 * Stellt die Tabellen von "ein gemeinsamer Lernstand" auf "einer pro Person" um.
 *
 * Bestehende Zeilen bekommen benutzer_id = 'anonym' und bleiben damit genau
 * das, was sie waren: der offene Stand für alle, die nicht angemeldet sind.
 * Angemeldete sehen über Row Level Security ausschliesslich ihre eigenen Zeilen.
 *
 *   node db/benutzer-migration.mjs
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
  // 1. Benutzerspalte
  await c.query(`alter table fortschritt add column if not exists benutzer_id text not null default 'anonym'`);
  await c.query(`alter table runden      add column if not exists benutzer_id text not null default 'anonym'`);

  // 2. Primärschlüssel: dieselbe Frage darf pro Person einmal vorkommen
  await c.query(`alter table fortschritt drop constraint if exists fortschritt_pkey`);
  await c.query(`alter table fortschritt add primary key (benutzer_id, frage_id)`);
  await c.query(`create index if not exists runden_benutzer_idx on runden (benutzer_id, ts desc)`);

  // 3. Row Level Security einschalten
  await c.query(`alter table fortschritt enable row level security`);
  await c.query(`alter table runden      enable row level security`);

  // 4. Regeln: anonym sieht nur den gemeinsamen Stand, Angemeldete nur ihren eigenen
  for (const [tabelle, kurz] of [["fortschritt", "f"], ["runden", "r"]]) {
    await c.query(`drop policy if exists anon_${kurz}  on ${tabelle}`);
    await c.query(`drop policy if exists eigen_${kurz} on ${tabelle}`);
    await c.query(`
      create policy anon_${kurz} on ${tabelle} for all to anonymous
        using (benutzer_id = 'anonym') with check (benutzer_id = 'anonym')`);
    await c.query(`
      create policy eigen_${kurz} on ${tabelle} for all to authenticated
        using (benutzer_id = auth.user_id()) with check (benutzer_id = auth.user_id())`);
  }

  // 5. Rechte. Angemeldete dürfen zusätzlich löschen — durch RLS nur eigene Zeilen.
  await c.query(`grant select, insert, update         on fortschritt, runden to anonymous`);
  await c.query(`grant select, insert, update, delete on fortschritt, runden to authenticated`);

  await c.query("commit");
  console.log("Migration angewendet.\n");
} catch (e) {
  await c.query("rollback");
  console.error("Fehlgeschlagen, nichts geändert:", e.message);
  process.exit(1);
}

const zeig = async (t, sql) => {
  const r = await c.query(sql);
  console.log("=== " + t + " ===");
  for (const z of r.rows) console.log("  " + Object.values(z).join("  |  "));
  console.log();
};
await zeig("Spalten", `select table_name, column_name from information_schema.columns
                        where table_schema='public' and column_name='benutzer_id' order by table_name`);
await zeig("Regeln", `select tablename, policyname, roles::text from pg_policies
                       where schemaname='public' order by tablename, policyname`);
await zeig("RLS aktiv", `select relname, relrowsecurity from pg_class
                          where relname in ('fortschritt','runden')`);

await c.end();
