/** Rauchprobe: Registrieren, Anmelden, Sitzung lesen, Abmelden. */
import { createClient } from "@neondatabase/neon-js";

const AUTH = "https://ep-snowy-king-b12lj86r.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth";
const DATA = "https://ep-snowy-king-b12lj86r.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1";

const neon = createClient({
  auth: { url: AUTH, allowAnonymous: true },
  dataApi: { url: DATA },
});

const mail = `probe-${Date.now()}@lernstand.test`;
const pw = "Pr0be-" + Math.random().toString(36).slice(2, 10);

const zeig = (s, r) => {
  const fehler = r?.error ?? (r && r.data === undefined && r.message ? r : null);
  console.log(`${s}: ${fehler ? "FEHLER " + JSON.stringify(fehler).slice(0, 220) : "ok"}`);
  return !fehler;
};

console.log("Registrieren …");
const reg = await neon.auth.signUp.email({ email: mail, password: pw, name: "Probe" });
zeig("  signUp", reg);
console.log("  Antwort:", JSON.stringify(reg).slice(0, 300));

console.log("\nAnmelden …");
const an = await neon.auth.signIn.email({ email: mail, password: pw });
zeig("  signIn", an);

console.log("\nSitzung lesen …");
const s = await neon.auth.getSession();
console.log("  Sitzung:", JSON.stringify(s).slice(0, 320));

console.log("\nBenutzerkennung, wie sie in RLS ankaeme:");
const uid = s?.data?.user?.id ?? s?.data?.session?.userId ?? s?.user?.id ?? "(nicht gefunden)";
console.log("  ", uid);

console.log("\nAbmelden …");
const ab = await neon.auth.signOut();
console.log("  ", JSON.stringify(ab).slice(0, 160));
