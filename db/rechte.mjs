/**
 * Gibt den Data-API-Rollen Zugriff auf die beiden Lernstand-Tabellen.
 *
 * Bewusst OHNE delete und truncate: ein Fremder mit gültigem Token kann den
 * Lernstand verfälschen, aber keine Zeilen wegräumen. Das ist die Folge der
 * Entscheidung, den Lernstand offen zu halten.
 *
 *   node functions/rechte.mjs
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

for (const rolle of ["anonymous", "authenticated"]) {
  await c.query(`grant usage on schema public to ${rolle}`);
  await c.query(`grant select, insert, update on public.fortschritt to ${rolle}`);
  await c.query(`grant select, insert, update on public.runden      to ${rolle}`);
  console.log(`Rechte vergeben an: ${rolle}`);
}

const r = await c.query(`
  select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as rechte
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('fortschritt','runden')
     and grantee in ('anonymous','authenticated')
   group by grantee, table_name order by grantee, table_name`);

console.log("\nStand:");
for (const z of r.rows) console.log(`  ${z.grantee.padEnd(14)} ${z.table_name.padEnd(12)} ${z.rechte}`);

await c.end();
