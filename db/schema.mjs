/**
 * Legt die Tabellen für den Lernstand an — dasselbe Schema, das auch die
 * Function beim ersten Aufruf sicherstellt. Idempotent: mehrfaches Ausführen
 * ändert nichts.
 *
 *   node functions/schema.mjs
 *
 * Liest DATABASE_URL aus .env; die Datei ist gitignoriert.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((z) => z && !z.startsWith("#"))
    .map((z) => {
      const i = z.indexOf("=");
      return [z.slice(0, i), z.slice(i + 1)];
    }),
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt in .env");
  process.exit(1);
}

const SCHEMA = `
  create table if not exists fortschritt (
    frage_id       text primary key,
    versuche       integer     not null default 0,
    punkte         real        not null default 0,
    letzter_score  real,
    zuletzt        timestamptz not null default now()
  );
  create table if not exists runden (
    id      text primary key,
    ts      bigint      not null,
    scope   text        not null,
    total   integer     not null,
    punkte  real        not null,
    dauer   integer     not null,
    fragen  jsonb,
    erfasst timestamptz not null default now()
  );
  create index if not exists runden_ts_idx on runden (ts desc);
`;

const client = new Client({ connectionString: env.DATABASE_URL });
await client.connect();

const v = await client.query("select version()");
console.log("Verbunden:", v.rows[0].version.split(",")[0]);

await client.query(SCHEMA);
console.log("Schema angewendet.");

const t = await client.query(`
  select table_name,
         (select count(*) from information_schema.columns c
           where c.table_name = t.table_name and c.table_schema = 'public') as spalten
    from information_schema.tables t
   where table_schema = 'public' and table_type = 'BASE TABLE'
   order by table_name
`);
console.log("\nTabellen:");
for (const z of t.rows) console.log(`  ${z.table_name}  (${z.spalten} Spalten)`);

const z = await client.query(
  `select (select count(*) from fortschritt) as fragen,
          (select count(*) from runden)      as runden`,
);
console.log(`\nInhalt: ${z.rows[0].fragen} Fragen, ${z.rows[0].runden} Runden`);

await client.end();
