/**
 * Lernstand-Sync — Neon Function
 *
 * Haelt den Lernfortschritt geraeteuebergreifend. Die App auf GitHub Pages ist
 * statisch und oeffentlich, deshalb darf hier kein Verbindungsstring landen:
 * der Browser spricht nur mit dieser Function, die Datenbank sieht er nie.
 *
 * Zugang ueber ein Geraetetoken im Authorization-Header. Kein Login, weil das
 * Quiz nur von einer Person genutzt wird.
 *
 * Routen
 *   GET  /progress  -> { stats, runs, serverZeit }
 *   PUT  /progress  -> nimmt { stats, runs } entgegen und fuehrt serverseitig zusammen
 *   GET  /health    -> ohne Token erreichbar, fuer einen schnellen Lebenszeichen-Test
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Pool } from "pg";
import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@neon/functions";
import config from "../neon";

// Innerhalb einer Function nimmt parseEnv den Slug: liefert die Branch-Secrets
// plus die in neon.ts deklarierten Function-Variablen unter `function`.
const env = parseEnv(config, "sync");
const LERNSTAND_TOKEN = env.function.LERNSTAND_TOKEN;

// Modul-Ebene: der Pool ueberlebt einzelne Requests auf derselben Isolate.
const pool = new Pool({ connectionString: env.postgres.databaseUrl, max: 5 });
attachDatabasePool(pool);

/** Legt die Tabellen an, falls sie fehlen — laeuft genau einmal pro Isolate. */
let schemaBereit: Promise<void> | null = null;
function schema(): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await pool.query(`
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
      `);
    })().catch((e) => {
      schemaBereit = null; // beim naechsten Aufruf neu versuchen
      throw e;
    });
  }
  return schemaBereit;
}

const app = new Hono();

app.use("*", cors({
  origin: (o) => o ?? "*",
  allowMethods: ["GET", "PUT", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

app.get("/health", (c) => c.json({ ok: true, dienst: "lernstand-sync" }));

/** Ab hier ist das Geraetetoken Pflicht. */
app.use("/progress", async (c, next) => {
  const kopf = c.req.header("Authorization") ?? "";
  const token = kopf.startsWith("Bearer ") ? kopf.slice(7) : "";
  if (!zeitgleich(token, LERNSTAND_TOKEN)) {
    return c.json({ fehler: "Ungültiges oder fehlendes Gerätetoken." }, 401);
  }
  await next();
});

app.get("/progress", async (c) => {
  await schema();
  const [f, r] = await Promise.all([
    pool.query(`select frage_id, versuche, punkte, letzter_score,
                       extract(epoch from zuletzt) * 1000 as zuletzt
                  from fortschritt`),
    pool.query(`select id, ts, scope, total, punkte, dauer, fragen
                  from runden order by ts asc limit 200`),
  ]);

  const stats: Record<string, unknown> = {};
  for (const z of f.rows) {
    stats[z.frage_id] = {
      v: z.versuche,
      p: Number(z.punkte),
      t: Math.round(Number(z.zuletzt)),
      ok: z.letzter_score === null ? 0 : Number(z.letzter_score),
    };
  }
  const runs = r.rows.map((z) => ({
    id: z.id, ts: Number(z.ts), scope: z.scope,
    total: z.total, punkte: Number(z.punkte), dauer: z.dauer,
    fragen: z.fragen ?? [],
  }));

  return c.json({ stats, runs, serverZeit: Date.now() });
});

app.put("/progress", async (c) => {
  await schema();

  let koerper: { stats?: Record<string, any>; runs?: any[] };
  try {
    koerper = await c.req.json();
  } catch {
    return c.json({ fehler: "Body ist kein gültiges JSON." }, 400);
  }
  const stats = koerper.stats ?? {};
  const runs = Array.isArray(koerper.runs) ? koerper.runs : [];

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Zusammenfuehren statt ueberschreiben: pro Frage gewinnt der Stand mit mehr
    // Versuchen. Sonst wuerde ein altes Handy den neueren PC-Stand platt machen.
    for (const [id, e] of Object.entries(stats)) {
      if (!e || typeof e !== "object") continue;
      await client.query(
        `insert into fortschritt (frage_id, versuche, punkte, letzter_score, zuletzt)
         values ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
         on conflict (frage_id) do update set
           versuche      = greatest(fortschritt.versuche, excluded.versuche),
           punkte        = case when excluded.versuche >= fortschritt.versuche
                                then excluded.punkte else fortschritt.punkte end,
           letzter_score = case when excluded.zuletzt >= fortschritt.zuletzt
                                then excluded.letzter_score else fortschritt.letzter_score end,
           zuletzt       = greatest(fortschritt.zuletzt, excluded.zuletzt)`,
        [id, zahl(e.v), zahl(e.p), zahl(e.ok), zahl(e.t) || Date.now()],
      );
    }

    // Runden sind unveraenderlich — eine bereits bekannte id wird nicht angefasst.
    for (const r of runs) {
      if (!r || typeof r.id !== "string") continue;
      await client.query(
        `insert into runden (id, ts, scope, total, punkte, dauer, fragen)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do nothing`,
        [r.id, zahl(r.ts), String(r.scope ?? ""), zahl(r.total),
         zahl(r.punkte), zahl(r.dauer), JSON.stringify(r.fragen ?? [])],
      );
    }

    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  const zahlen = await pool.query(
    `select (select count(*) from fortschritt) as fragen,
            (select count(*) from runden)      as runden`,
  );
  return c.json({
    ok: true,
    fragen: Number(zahlen.rows[0].fragen),
    runden: Number(zahlen.rows[0].runden),
  });
});

app.onError((e, c) => {
  console.error("sync:", e);
  return c.json({ fehler: "Interner Fehler in der Sync-Function." }, 500);
});

/** Vergleich ohne frueh abzubrechen, damit die Laufzeit nichts ueber das Token verraet. */
function zeitgleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function zahl(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default app;
