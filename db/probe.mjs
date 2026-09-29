/**
 * Beweist die Kette anonymer Zugang -> Data API -> Tabellen, bevor die App
 * darauf umgestellt wird. Schreibt eine Testzeile und raeumt sie wieder weg.
 */
import { createClient } from "@neondatabase/neon-js";

const AUTH = "https://ep-snowy-king-b12lj86r.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth";
const DATA = "https://ep-snowy-king-b12lj86r.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1";

const neon = createClient({
  auth: { url: AUTH, allowAnonymous: true },
  dataApi: { url: DATA },
});

console.log("1. Lesen aus fortschritt …");
const gelesen = await neon.from("fortschritt").select("*").limit(3);
console.log("   Fehler:", gelesen.error ? JSON.stringify(gelesen.error) : "keiner");
console.log("   Zeilen:", Array.isArray(gelesen.data) ? gelesen.data.length : gelesen.data);

console.log("\n2. Schreiben (Testzeile) …");
const geschrieben = await neon.from("fortschritt").insert({
  frage_id: "__probe__", versuche: 1, punkte: 1, letzter_score: 1,
});
console.log("   Fehler:", geschrieben.error ? JSON.stringify(geschrieben.error) : "keiner");

console.log("\n3. Wiederlesen …");
const nochmal = await neon.from("fortschritt").select("*").eq("frage_id", "__probe__");
console.log("   Fehler:", nochmal.error ? JSON.stringify(nochmal.error) : "keiner");
console.log("   Gefunden:", JSON.stringify(nochmal.data));

console.log("\n4. Aktualisieren (upsert-artig) …");
const aktualisiert = await neon.from("fortschritt")
  .update({ versuche: 2 }).eq("frage_id", "__probe__");
console.log("   Fehler:", aktualisiert.error ? JSON.stringify(aktualisiert.error) : "keiner");

console.log("\n5. Aufraeumen (delete ist bewusst nicht erlaubt) …");
const geloescht = await neon.from("fortschritt").delete().eq("frage_id", "__probe__");
console.log("   Fehler:", geloescht.error ? JSON.stringify(geloescht.error) : "keiner (unerwartet!)");
