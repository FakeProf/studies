/**
 * Prüft, ob Neon Auth Anmeldungen von einer Adresse annimmt.
 *
 * Neon Auth lässt nur Herkünfte zu, die in der Konsole unter
 * Auth → Configuration → Domains eingetragen sind. Fehlt eine, antwortet der
 * Dienst mit 403 INVALID_ORIGIN — in der App erscheint dann «Diese Adresse
 * ist bei Neon Auth nicht freigegeben», unabhängig davon, ob Name und
 * Passwort stimmen.
 *
 * Geprüft wird mit einem echten Registrierungsversuch auf eine
 * Wegwerfadresse; das angelegte Konto wird anschliessend wieder entfernt.
 *
 *   node db/herkunft-pruefen.mjs https://example.netlify.app [weitere …]
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const AUTH = "https://ep-snowy-king-b12lj86r.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth";

const adressen = process.argv.slice(2);
if (!adressen.length) { console.error("Welche Adresse(n)?"); process.exit(1); }

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((z) => z && !z.startsWith("#"))
    .map((z) => { const i = z.indexOf("="); return [z.slice(0, i), z.slice(i + 1)]; }),
);

/* Was steht überhaupt auf der Liste? */
const pg = new Client({ connectionString: env.DATABASE_URL });
await pg.connect();
const konfig = await pg.query("select trusted_origins, allow_localhost from neon_auth.project_config");
console.log("Eingetragen:", JSON.stringify(konfig.rows[0].trusted_origins));
console.log("localhost:  ", konfig.rows[0].allow_localhost, "\n");

let alleOk = true;
for (const adresse of adressen) {
  const mail = `herkunft-${Date.now()}@lernstand.test`;
  const kopf = { "content-type": "application/json", origin: adresse.replace(/\/$/, "") };
  let zeile;
  try {
    const r = await fetch(AUTH + "/sign-up/email", {
      method: "POST", headers: kopf,
      body: JSON.stringify({ email: mail, password: "Pr0be-herkunft1", name: "Herkunft" }),
    });
    zeile = r.ok ? "angenommen" : `abgelehnt (${r.status} ${((await r.json()).code) ?? ""})`;
    if (!r.ok) alleOk = false;
  } catch (e) {
    zeile = "Fehler: " + e.message.slice(0, 60); alleOk = false;
  }
  console.log(`${adresse.padEnd(42)} ${zeile}`);
}

/* Die Probekonten wieder abräumen. */
const wen = `select id::text from neon_auth."user" where email like 'herkunft-%@lernstand.test'`;
await pg.query("begin");
for (const t of ["fortschritt", "runden"]) await pg.query(`delete from ${t} where benutzer_id in (${wen})`);
for (const t of ['neon_auth.session', 'neon_auth.account']) await pg.query(`delete from ${t} where "userId"::text in (${wen})`);
const weg = await pg.query(`delete from neon_auth."user" where email like 'herkunft-%@lernstand.test'`);
await pg.query("commit");
await pg.end();
console.log(`\n${weg.rowCount} Probekonto(s) wieder entfernt.`);
process.exit(alleOk ? 0 : 1);
