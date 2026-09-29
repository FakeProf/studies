/** Was stellt Neon Auth in der Datenbank bereit? Funktionen, Tabellen, Claims. */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((z) => z && !z.startsWith("#"))
    .map((z) => { const i = z.indexOf("="); return [z.slice(0, i), z.slice(i + 1)]; }),
);

const c = new Client({ connectionString: env.DATABASE_URL });
await c.connect();

const zeig = async (titel, sql) => {
  const r = await c.query(sql);
  console.log("\n=== " + titel + " ===");
  if (!r.rows.length) return console.log("  (nichts)");
  for (const z of r.rows) console.log("  " + Object.values(z).join("  |  "));
};

await zeig("Funktionen im Schema auth", `
  select p.proname, pg_get_function_result(p.oid) as gibt_zurueck
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'auth' order by p.proname`);

await zeig("Funktionen im Schema neon_auth", `
  select p.proname, pg_get_function_result(p.oid) as gibt_zurueck
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'neon_auth' order by p.proname`);

await zeig("Tabellen in auth / neon_auth", `
  select schemaname || '.' || tablename as tabelle
    from pg_tables where schemaname in ('auth','neon_auth') order by 1`);

await c.end();
