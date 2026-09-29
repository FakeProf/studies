/**
 * Beweist, dass zwei Konten sich nicht gegenseitig sehen.
 *
 * Der SDK lebt vom Browser: er legt die Sitzung in einem Cookie ab und tauscht
 * sie gegen ein JWT, das die Data API dann als Rolle "authenticated" liest.
 * In Node gibt es weder Cookie-Speicher noch Origin-Header, deshalb bauen wir
 * beides hier von Hand nach und sprechen PostgREST direkt an. Geprueft wird
 * damit genau das, was auch im Browser passiert: die RLS-Regeln.
 *
 *   node db/trennung-probe.mjs
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const AUTH = "https://ep-snowy-king-b12lj86r.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth";
const DATA = "https://ep-snowy-king-b12lj86r.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1";
const FRAGE = "__probe__";
const HERKUNFT = "http://localhost:8765";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).filter((z) => z && !z.startsWith("#"))
    .map((z) => { const i = z.indexOf("="); return [z.slice(0, i), z.slice(i + 1)]; }),
);

/** Eine Sitzung: eigener Cookie-Topf, eigenes JWT. */
function sitzung() {
  const kekse = new Map();
  const ruf = async (pfad, koerper) => {
    const r = await fetch(AUTH + pfad, {
      method: koerper ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        origin: HERKUNFT,
        ...(kekse.size ? { cookie: [...kekse].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      ...(koerper ? { body: JSON.stringify(koerper) } : {}),
    });
    for (const z of r.headers.getSetCookie?.() ?? []) {
      const [k, v] = z.split(";")[0].split("=");
      kekse.set(k, v);
    }
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok) throw new Error(`${pfad}: HTTP ${r.status} ${t.slice(0, 200)}`);
    return j;
  };
  return { ruf };
}

/** Registriert, meldet an und liefert JWT samt Benutzerkennung. */
async function konto(name) {
  const s = sitzung();
  const mail = `${name.toLowerCase()}-${Date.now()}@lernstand.test`;
  const pw = "Pr0be-" + Math.random().toString(36).slice(2, 12);
  await s.ruf("/sign-up/email", { email: mail, password: pw, name });
  const an = await s.ruf("/sign-in/email", { email: mail, password: pw });
  const jwt = await s.ruf("/token");
  return { name, id: an.user.id, jwt: jwt.token ?? jwt.jwt ?? jwt.access_token };
}

/**
 * Anonymes JWT, so wie es die App ohne Anmeldung benutzt. Wie der SDK das
 * besorgt, ist sein Geheimnis — wir fangen einfach den Header ab, den er
 * an die Data API schickt.
 */
async function anonym() {
  const { createClient } = await import("@neondatabase/neon-js");
  let jwt = null;
  const echt = globalThis.fetch;
  globalThis.fetch = (u, o = {}) => {
    const h = new Headers(o.headers ?? {});
    const auth = h.get("authorization");
    if (auth && String(u).includes("apirest")) jwt = auth.replace(/^Bearer /, "");
    return echt(u, o);
  };
  const n = createClient({ auth: { url: AUTH, allowAnonymous: true }, dataApi: { url: DATA } });
  await n.from("fortschritt").select("frage_id").limit(1);
  globalThis.fetch = echt;
  if (!jwt) throw new Error("kein anonymes Token abgefangen");
  return { name: "anonym", id: "anonym", jwt };
}

/** Ein Aufruf an die Data API im Namen von k. */
async function api(k, pfad, init = {}) {
  const r = await fetch(DATA + pfad, {
    ...init,
    headers: {
      authorization: "Bearer " + k.jwt,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { ok: r.ok, status: r.status, body: j, roh: t };
}

/**
 * PGRST204 heisst nur, dass diese PostgREST-Instanz die Spalte noch nicht
 * kennt — das sagt nichts ueber die Zugriffsregeln. Also noch einmal fragen,
 * bis eine Instanz mit frischem Cache antwortet. Geprueft werden sollen die
 * Regeln, nicht der Cache.
 */
async function schreib(k, zeile){
  let r;
  for (let i = 0; i < 12; i++) {
    r = await api(k, "/fortschritt?on_conflict=benutzer_id,frage_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(zeile),
    });
    if (r.ok || r.body?.code !== "PGRST204") return r;
    await new Promise((f) => setTimeout(f, 250));
  }
  return r;
}

const ergebnis = [];
const pruefe = (was, gut, zusatz = "") =>
  ergebnis.push(`${gut ? "ok  " : "FEHL"}  ${was}${zusatz ? "  — " + zusatz : ""}`);

const a = await konto("ProbeA");
const b = await konto("ProbeB");
const an = await anonym();

// Welche Rolle sieht die Datenbank wirklich?
const rolle = (k) => { try {
  return JSON.parse(Buffer.from(k.jwt.split(".")[1], "base64url").toString()).role ?? "(keine)";
} catch { return "(kein JWT)"; } };
console.log(`Rollen laut JWT:  A=${rolle(a)}  B=${rolle(b)}  anonym=${rolle(an)}\n`);

// --- Schreiben ---------------------------------------------------------
for (const [k, punkte] of [[a, 11], [b, 22], [an, 99]]) {
  const r = await schreib(k, {
    benutzer_id: k.id, frage_id: FRAGE, versuche: 1, punkte, zuletzt: new Date().toISOString(),
  });
  pruefe(`${k.name} schreibt eigene Zeile`, r.ok, r.ok ? "" : r.roh.slice(0, 120));
}

// --- Lesen: jeder sieht nur sich selbst --------------------------------
for (const [k, punkte] of [[a, 11], [b, 22], [an, 99]]) {
  const r = await api(k, `/fortschritt?frage_id=eq.${FRAGE}&select=benutzer_id,punkte`);
  const z = r.body ?? [];
  pruefe(`${k.name} sieht genau die eigene Zeile`,
         z.length === 1 && z[0].benutzer_id === k.id && Number(z[0].punkte) === punkte,
         JSON.stringify(z).slice(0, 140));
}

// --- Fremde Zeilen sind unerreichbar -----------------------------------
const lesen = await api(a, `/fortschritt?benutzer_id=eq.${b.id}&select=*`);
pruefe("A liest B nicht", (lesen.body ?? []).length === 0, JSON.stringify(lesen.body).slice(0, 100));

const schreibenAB = await schreib(a, {
  benutzer_id: b.id, frage_id: "__einbruch__", versuche: 1, punkte: 0, zuletzt: new Date().toISOString(),
});
pruefe("A schreibt nicht auf B", !schreibenAB.ok, schreibenAB.ok ? "DURCHGEKOMMEN" : "HTTP " + schreibenAB.status);

const schreibenAnonA = await schreib(an, {
  benutzer_id: a.id, frage_id: "__einbruch__", versuche: 1, punkte: 0, zuletzt: new Date().toISOString(),
});
pruefe("anonym schreibt nicht auf A", !schreibenAnonA.ok,
       schreibenAnonA.ok ? "DURCHGEKOMMEN" : "HTTP " + schreibenAnonA.status);

// --- Gegenprobe direkt in der Datenbank --------------------------------
const pg = new Client({ connectionString: env.DATABASE_URL });
await pg.connect();
const wirklich = await pg.query(
  `select benutzer_id, punkte from fortschritt where frage_id = $1 order by punkte`, [FRAGE],
);
console.log("Was wirklich in der Tabelle steht:");
for (const z of wirklich.rows) console.log(`  ${z.benutzer_id}  →  ${z.punkte}`);
pruefe("drei getrennte Zeilen in der Datenbank", wirklich.rows.length === 3, `${wirklich.rows.length} Zeilen`);

const weg = await pg.query(`delete from fortschritt where frage_id like '\\_\\_%'`);
const wegR = await pg.query(`delete from runden where id like '\\_\\_%'`);
console.log(`\nAufgeraeumt: ${weg.rowCount} Fortschrittszeilen, ${wegR.rowCount} Runden.`);
await pg.end();

console.log("\n" + ergebnis.join("\n"));
const dicht = !ergebnis.some((z) => z.startsWith("FEHL"));
console.log(dicht ? "\n=> Trennung haelt.\n" : "\n=> NICHT dicht.\n");
process.exit(dicht ? 0 : 1);
