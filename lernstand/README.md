# Lernstand HS2026

Prüfungstrainer über den Semesterstoff Betriebsökonomie (OST, HS2026) — 278 Fragen aus eigenen Zusammenfassungen, nach Lernzielen ausgewertet.

## Struktur

```
studies/
├── index.html          ← Weiterleitung auf lernstand/
├── .nojekyll           ← schaltet den Jekyll-Build von GitHub Pages ab
├── .gitignore
└── lernstand/
    ├── index.html      ← die komplette App: HTML, CSS und JS in einer Datei
    ├── README.md       ← diese Datei
    └── daten/
        └── fragen.json ← der Fragenpool, wird beim Laden per fetch() geholt
```

Keine Build-Schritte, kein npm, keine Abhängigkeiten ausser zwei Schriftarten von Google Fonts.
Die App ist eine statische Seite — was im Ordner liegt, ist auch das, was ausgeliefert wird.

## GitHub Pages

Dieser Ordner liegt im Repository [FakeProf/studies](https://github.com/FakeProf/studies) und wird unter **https://fakeprof.github.io/studies/lernstand/** ausgeliefert.

Einmalig zu aktivieren: **Settings → Pages**, Quelle `Deploy from a branch`, Branch `main`, Ordner `/ (root)`. Nach ein bis zwei Minuten ist die Seite erreichbar.

Änderungen gehen den normalen Weg:

```bash
git add lernstand
git commit -m "Fragen für Woche 3 ergänzt"
git push
```

> **Wichtig:** GitHub Pages ist im kostenlosen Tarif immer öffentlich erreichbar — auch aus einem privaten Repository. Damit ist `daten/fragen.json` für jeden lesbar, der die Adresse kennt. Der Inhalt ist aus Vorlesungsfolien und Pflichtliteratur verdichtet.

## Datenbank

**Es wird keine gebraucht.** Die App speichert den Lernstand im `localStorage` des Browsers, unter dem Schlüssel `lernstand.v1`:

```js
{ stats: { "<fragen-id>": { v: Versuche, p: Punkte, t: Zeitstempel, ok: letzterScore } },
  runs:  [ { id, ts, scope, total, punkte, dauer, fragen: [...] } ] }
```

Zusätzlich sucht die App beim Start nach `window.claude.use("db")`. Diese Schnittstelle gibt es nur innerhalb eines claude.ai-Artefakts; auf GitHub Pages ist sie schlicht nicht vorhanden, der Aufruf ergibt `null` und die App läuft ohne weiteres mit `localStorage` weiter. Der Punkt links oben bleibt dann grau und zeigt `lokal`.

Was das bedeutet:

| | localStorage |
|---|---|
| Kosten und Aufwand | keine |
| Läuft offline | ja, nach dem ersten Laden |
| Laptop und Handy synchron | **nein** — jedes Gerät zählt für sich |
| Beim Löschen der Browserdaten | weg |

Für den Umzug zwischen Geräten gibt es im Dashboard unten **„Fortschritt sichern oder auf ein anderes Gerät übertragen"**: einmal kopieren, auf dem anderen Gerät einspielen. Beim Einspielen wird zusammengeführt, nicht überschrieben — pro Frage gewinnt der Stand mit mehr Versuchen.

Erst wenn echte Synchronisierung ohne manuellen Schritt nötig wird, lohnt eine Datenbank. Dann reicht ein Dienst mit kostenlosem Kontingent und Client-SDK (etwa Supabase oder Firebase); nötig wären dort eine Tabelle für `stats` und eine für `runs` sowie ein Login, damit die Daten einem Konto zugeordnet sind.

## Fragen ergänzen oder korrigieren

`daten/fragen.json` ist eine Datei mit einem Objekt pro Frage:

```json
{
  "id": "OGPM-W1-01",
  "modul": "OGPM",
  "woche": 1,
  "teilgebiet": "Politik",
  "kategorie": "vorlesung",
  "typ": "mc",
  "lernziel": "System und Aufgaben des integrierten GPM erläutern",
  "frage": "…",
  "optionen": ["…"],
  "loesung": [0],
  "erklaerung": "…",
  "quelle": "OGPM LB1 - Einführung in das Geschäftsprozessmanagement"
}
```

Je nach `typ` kommen andere Felder dazu:

| `typ` | Zusätzliche Felder |
|---|---|
| `mc` | `optionen` (Array) und `loesung` (Array von Indizes — mehrere Einträge ergeben eine Mehrfachauswahl) |
| `flash` | `antwort` |
| `order` | `items` — bereits **in der richtigen Reihenfolge**, die App mischt selbst |
| `match` | `paare` — Array von Zweier-Arrays `[links, rechts]` |

`kategorie` ist eines von `vorlesung`, `literatur`, `uebung`, `richtlinie`, `organisation`, `vorlage`. `teilgebiet` ist optional und wird nur bei GENE genutzt. `kern` ist `true` bei den 149 Fragen, die der Filter **Nur Kernstoff** durchlässt.

> **Bestehende `id` niemals ändern.** Der gespeicherte Fortschritt hängt daran — eine neue ID bedeutet, dass die Frage als nie geübt gilt.

Beim Ergänzen ausserdem die vorhandenen `lernziel`-Texte **wörtlich** wiederverwenden. Die Auswertung gruppiert über diesen String; ein Tippfehler erzeugt ein zweites, leeres Lernziel.

### Was `kern` bedeutet

Der Filter **Nur Kernstoff** lässt die 149 Fragen durch, ohne die eine Standardfrage zum jeweiligen Lernziel nicht zu beantworten wäre: Definitionen, Prüfschemata, Abgrenzungen. Draussen bleiben Jahreszahlen, Namens- und Anbieterlisten, Biografien, illustrierende Einzelzahlen und alles Organisatorische.

| Modul | Kern | Gesamt |
|---|---:|---:|
| OGPM | 25 | 52 |
| GENE | 39 | 85 |
| SYMG | 51 | 84 |
| VHRE | 20 | 30 |
| WSA1 | 14 | 27 |
| **Total** | **149** | **278** |

VHRE liegt am höchsten, weil dort fast alles Prüfschema ist. Jedes der 44 Lernziele behält mindestens eine Kernfrage — nachzurechnen mit:

```bash
node -e '
const d=JSON.parse(require("fs").readFileSync("daten/fragen.json","utf8")).fragen;
const alle=new Set(d.filter(q=>q.kategorie!=="organisation").map(q=>q.modul+"|"+q.lernziel));
const mitKern=new Set(d.filter(q=>q.kern).map(q=>q.modul+"|"+q.lernziel));
console.log([...alle].filter(z=>!mitKern.has(z)));'
```

Die Einstufung ist ein Urteil, keine Vorgabe der Dozierenden. Einzelne Fragen lassen sich umhängen, indem `kern` in `daten/fragen.json` auf `true` oder `false` gesetzt wird.

## Lokal ausprobieren

Die Datei direkt im Browser zu öffnen funktioniert **nicht** — der `fetch()` auf `daten/fragen.json` wird bei `file://` vom Browser blockiert. Es braucht einen kleinen Server:

```bash
npx serve .
```

## Konten und Lernstand

Ohne Anmeldung läuft alles unter der Kennung `anonym` — ein offener Stand, den
jede und jeder sehen und ändern kann. Wer sich mit Name, E-Mail und Passwort
anmeldet, bekommt einen eigenen: Row Level Security in der Datenbank lässt
Angemeldete ausschliesslich an ihre eigenen Zeilen.

Wem eine Zeile gehört, entscheidet die Datenbank, nicht die App. `benutzer_id`
hat als Vorgabewert

```sql
case when current_user = 'authenticated'
     then coalesce(nullif(auth.user_id(), ''), 'anonym')
     else 'anonym' end
```

Die App schickt die Kennung deshalb absichtlich **nicht** mit. Das ist zum einen
sicherer — sie stammt aus dem geprüften Token statt aus dem Browser —, zum
anderen nötig: siehe unten.

Nachprüfen lässt sich die Trennung mit

```bash
node db/trennung-probe.mjs
```

Das Skript legt zwei Konten an, lässt jedes schreiben, versucht Fremdzugriffe
und räumt sich danach selbst auf.

### Zwei Stolpersteine bei Neon

**Der Schema-Cache der Data API.** Hinter dem Lastverteiler stehen mehrere
PostgREST-Instanzen. Nach einer Schema-Änderung erneuern nicht alle ihren
Cache; die alten lehnen jeden Datensatz ab, der eine neue Spalte nennt
(`PGRST204: column … does not exist`), obwohl die Spalte existiert — ein
`select` darauf geht durch, weil PostgREST den unverändert an Postgres
weiterreicht. Ein Browser bleibt über seine offene Verbindung fest auf einer
Instanz und kann dem nicht ausweichen; Wiederholen hilft ihm nicht.

Weder `notify pgrst, 'reload schema'` noch das Trennen der
`authenticator`-Verbindungen noch eine Ruhepause haben die alten Instanzen
aufgeweckt. Deshalb nennt die App neue Spalten gar nicht erst und überlässt sie
dem Vorgabewert — in der URL (`on_conflict`) prüft PostgREST sie nicht.

**Erlaubte Herkunft.** Neon Auth nimmt Anmeldungen nur von Adressen auf seiner
Liste an und antwortet sonst mit `403 INVALID_ORIGIN`. `localhost` steht von
Haus aus drauf, `https://fakeprof.github.io` ist unter **Console → Auth →
Configuration → Domains** eingetragen. Die Liste liegt in
`neon_auth.project_config.trusted_origins`; kommt eine weitere Adresse dazu,
gehört sie ebenfalls dorthin — mit `https://`, ohne Schrägstrich am Ende.

## Auf dem Handy

Die Seite hatte weder Doctype noch Viewport-Angabe. Ohne
`<meta name="viewport">` rendert ein Handy jede Seite in rund 980 px Breite und
skaliert sie herunter — alles wird winzig, und keine Media Query greift. Das
war die eigentliche Ursache; der Rest sind Nachbesserungen:

- **Prüfen-Leiste unten fest.** Bei vier langen Antworten lag der Knopf unter
  dem Falz. `position:sticky` hilft dort nicht, weil der Fuss das letzte
  Element ist und keinen Scrollweg hat. Die Leiste ist deshalb `fixed`; wie
  viel Freiraum darunter nötig ist, misst `qfootFreiraum()` und schreibt es
  nach `--qfoot-h`, denn die Höhe hängt vom Hinweistext ab (65 px oder 95 px,
  je nach Fragetyp).
- **16 px in allen Eingabefeldern** unter 560 px Breite. iOS zoomt beim
  Antippen in jedes Feld hinein, dessen Schrift kleiner ist.
- **Tippflächen mindestens 40 px.** Filter-Chips waren 31 px hoch.
- **Safe-Area-Ränder**, weil `viewport-fit=cover` die Seite unter die
  Kamera-Aussparung reichen lässt.

Nachgemessen bei 320, 375, 768 px, im Querformat (812×375) und am Desktop:
kein horizontaler Überlauf, keine Tippfläche unter 40 px, kein Feld unter
16 px. Ein Durchlauf über alle vier Fragetypen zeigte, dass die feste Leiste
nichts verdeckt.

## Vorlagen und gemerkte Einstellung

Jede Lerneinheit mit denselben Filtern neu zusammenzuklicken kostet Zeit, die
zum Lernen fehlt. Zwei Dinge nehmen das ab:

- **Vorlagen.** Ein Klick setzt die Einstellung *und* startet die Runde. Drei
  sind fest eingebaut — Kernstoff quer, Wo es klemmt, Noch nie geübt —, eigene
  legt „Aktuelle Auswahl sichern“ an. Jede zeigt, wie viele Fragen sie bringt.
- **Die zuletzt benutzte Einstellung** überlebt das Schliessen des Tabs.
  `filterSetzen()` verwirft dabei alles, was der Fragenpool nicht mehr hergibt,
  damit eine alte Einstellung nach einer Poolände­rung nicht ins Leere zeigt.

Beides liegt bewusst nur im Browser (`lernstand.vorlagen.v1`,
`lernstand.filter.v1`) und wandert nicht zwischen Geräten: es sind Gewohnheiten
dieses Geräts, kein Lernstand. Eine eigene Tabelle dafür wäre ausserdem
riskant, solange eine PostgREST-Instanz ihren Schema-Cache nicht erneuert —
neue Tabellen kennt sie nicht.

## Anmeldung mit Name statt E-Mail

Neon Auth kennt nur Anmeldung per E-Mail. Das Formular verlangt trotzdem nur
Name und Passwort: `nameSchluessel()` bildet daraus eine feste, nie
zustellbare Adresse `<name>@lernstand.local`, die allein als Schlüssel dient.

```
"Jan"  "jan"  "  Jan  "  →  jan
"Jan B."  "jan-b"        →  jan-b
"Jörg Müller"            →  jorg-muller
```

**Die Ableitung darf sich nie ändern** — sonst findet niemand sein Konto
wieder. Gross- und Kleinschreibung, Leerzeichen und Umlaute sind absichtlich
gleichwertig.

Der Preis: ohne echte Adresse gibt es **kein Zurücksetzen eines vergessenen
Passworts**, und Namen sind leicht zu erraten, das Passwort trägt die ganze
Last. Entschärft wird das dadurch, dass der Fortschritt zusätzlich im Browser
liegt und sich exportieren lässt — verloren wäre das Konto, nicht der
Lernstand.

## Aufbau der Oberfläche

Früher stand die vollständige Filterwand auf der Startseite; bis zur ersten
Frage waren es fünf Klicks. Jetzt gibt es vier Seiten:

| Seite | Inhalt |
|---|---|
| Übersicht | fast nur die Module, dazu eigene Vorlagen und der Verlauf |
| Modulseite | fertige Runden (Gemischt, Nur Kernstoff, Wo es klemmt, Noch nie geübt), nach Woche, alle Lernziele |
| Konto | Anmeldung, Sync-Zustand, Sicherung |
| Filterblatt | die vollständige Zusammenstellung, hinter dem Knopf **Filter** |

Von der Übersicht bis in eine Runde sind es zwei Tipps: Modul, dann die
gewünschte Runde. Jeder dieser Knöpfe zeigt, wie viele Fragen er bringt, und
bleibt aus, wenn es keine gibt.

Der Titel oben links führt immer zurück zur Übersicht — auch mitten in einer
Runde. Die Runde geht dabei nicht verloren: die Übersicht bietet sie als
**Runde fortsetzen** wieder an. Rechts oben führt ein Knopf zum Konto; er
zeigt zugleich den Sync-Zustand.

## Als App auf dem Startbildschirm

`manifest.webmanifest` und `sw.js` machen die Seite installierbar — auf dem
Handy läuft sie dann ohne Browserleiste. Die Symbole entstehen aus
`db/symbole-bauen.mjs`, das PNGs ohne Bildbibliothek direkt zeichnet.

Der Service Worker hält sich an zwei Regeln:

1. **Nur eigene Dateien.** Alles Fremde — Schriften, das Neon-SDK, vor allem
   die Datenbank — geht unberührt ins Netz. Eine zwischengespeicherte Antwort
   der Data API wäre ein falscher Lernstand, den niemand mehr loswird.
2. **Erst Netz, dann Ablage.** Die App ist eine einzige HTML-Datei; gewänne
   der Cache, liefe nach einem Push noch tagelang die alte Fassung. Offline
   springt die Ablage ein, online nie.

Bei einer neuen Fassung `VERSION` in `sw.js` hochzählen.
