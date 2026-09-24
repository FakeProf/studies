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
