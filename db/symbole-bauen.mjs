/**
 * Erzeugt die App-Symbole als PNG — ohne Bildbibliothek, direkt gezeichnet.
 *
 * Das Zeichen: abgerundetes Quadrat in Akzentgrün, darin drei Balken
 * abnehmender Länge. Das liest sich als Liste und braucht keine Schrift,
 * die hier ohnehin niemand rendern könnte.
 *
 *   node db/symbole-bauen.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const GRUEN = [0x13, 0x56, 0x4e];
const HELL  = [0xef, 0xf2, 0xf1];

/* ---------- PNG schreiben ---------- */
const tabelle = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = tabelle[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function block(typ, daten) {
  const kopf = Buffer.alloc(4);
  kopf.writeUInt32BE(daten.length);
  const koerper = Buffer.concat([Buffer.from(typ, "latin1"), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(koerper));
  return Buffer.concat([kopf, koerper, pruef]);
}
function png(breite, hoehe, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;      // 8 Bit je Kanal
  ihdr[9] = 6;      // RGBA
  const roh = Buffer.alloc(hoehe * (breite * 4 + 1));
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 4 + 1)] = 0;   // Filter "none"
    rgba.copy(roh, y * (breite * 4 + 1) + 1, y * breite * 4, (y + 1) * breite * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block("IHDR", ihdr),
    block("IDAT", deflateSync(roh, { level: 9 })),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- Zeichnen ---------- */
/** Deckung eines Pixels in einem abgerundeten Rechteck, 3×3 abgetastet. */
function rundRechteckDeckung(x, y, l, o, b, h, r) {
  let treffer = 0;
  for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
    const px = x + (sx + 0.5) / 3, py = y + (sy + 0.5) / 3;
    if (px < l || px > l + b || py < o || py > o + h) continue;
    const dx = Math.max(l + r - px, 0, px - (l + b - r));
    const dy = Math.max(o + r - py, 0, py - (o + h - r));
    if (dx * dx + dy * dy <= r * r) treffer++;
  }
  return treffer / 9;
}

function male(groesse, { rand = 0 } = {}) {
  const px = Buffer.alloc(groesse * groesse * 4);
  const feld = groesse - 2 * rand;                 // Flaeche des Zeichens
  const eck = feld * 0.22;
  // Drei Balken, mittig, abnehmende Laenge
  const bh = feld * 0.095, luecke = feld * 0.075;
  const gesamt = 3 * bh + 2 * luecke;
  const by0 = rand + (feld - gesamt) / 2;
  const bx0 = rand + feld * 0.2;
  const laengen = [feld * 0.6, feld * 0.46, feld * 0.3];

  for (let y = 0; y < groesse; y++) for (let x = 0; x < groesse; x++) {
    const i = (y * groesse + x) * 4;
    const grund = rundRechteckDeckung(x, y, rand, rand, feld, feld, eck);
    let r = GRUEN[0], g = GRUEN[1], b = GRUEN[2];
    for (let k = 0; k < 3; k++) {
      const by = by0 + k * (bh + luecke);
      const d = rundRechteckDeckung(x, y, bx0, by, laengen[k], bh, bh / 2);
      if (d > 0) {
        r = Math.round(r + (HELL[0] - r) * d);
        g = Math.round(g + (HELL[1] - g) * d);
        b = Math.round(b + (HELL[2] - b) * d);
      }
    }
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
    px[i + 3] = Math.round(grund * 255);
  }
  return png(groesse, groesse, px);
}

const ziel = new URL("../lernstand/symbole/", import.meta.url);
import { mkdirSync } from "node:fs";
mkdirSync(ziel, { recursive: true });

for (const n of [192, 512]) {
  writeFileSync(new URL(`symbol-${n}.png`, ziel), male(n));
  console.log(`symbol-${n}.png`);
}
// Maskierbar: Android schneidet bis zu 20% ringsum weg, also Luft lassen.
writeFileSync(new URL("symbol-512-maskierbar.png", ziel), male(512, { rand: 512 * 0.14 }));
console.log("symbol-512-maskierbar.png");
// iOS nimmt dieses Bild und rundet selbst — ohne Transparenz, sonst wird es schwarz.
writeFileSync(new URL("apple-touch-icon.png", ziel), male(180, { rand: 0 }));
console.log("apple-touch-icon.png");
