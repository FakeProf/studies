/** Einmalige Bestandsaufnahme: Rollen, Schemas und Rechte in der Datenbank. */
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
  if (!r.rows.length) { console.log("  (nichts)"); return; }
  for (const z of r.rows) console.log("  " + Object.values(z).join("  |  "));
};

await zeig("Rollen", `select rolname, rolcanlogin from pg_roles
                       where rolname not like 'pg\\_%' order by rolname`);
await zeig("Schemas", `select nspname from pg_namespace
                        where nspname not like 'pg\\_%' and nspname <> 'information_schema'
                        order by nspname`);
await zeig("Tabellen in public", `select tablename from pg_tables
                                   where schemaname='public' order by tablename`);
await zeig("Rechte auf unseren Tabellen", `
  select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as rechte
    from information_schema.role_table_grants
   where table_schema='public' and table_name in ('fortschritt','runden')
   group by grantee, table_name order by grantee, table_name`);
await zeig("Row Level Security aktiv?", `select relname, relrowsecurity
                                          from pg_class
                                          where relname in ('fortschritt','runden')`);

await c.end();
