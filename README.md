# Web-Karte: Straßennetz Landkreis Osnabrück (Multi-Hazard-Vulnerabilität)

Interaktive Karte zur Masterarbeit. Sie zeigt dieselben Kennwerte wie die Abbildungen des
Ergebniskapitels, aber je Kante abrufbar: 72.238 Kanten des Analysenetzes mit Link Importance,
Starkregen (H-Stufen, Verschneidungsindex), Flusshochwasser (HQextrem), Hitze (LST, thermischer
Index), Compound-Indizes und Belastungsprofil. Alle Werte stammen unverändert aus den
Ergebnisdateien der Arbeitspakete; der Build liest nur.

## Ordner

| Pfad | Inhalt |
|---|---|
| `build_webkarte.py` + `webkarte_bau/` | Build: GeoPackages/TIFs → `docs/data/*` (Kanten kompakt, Attributtabellen, Kontextlayer, Raster-PNGs, `meta.json`, Farbschemata), Prüfsummen, Protokoll E20 |
| `fetch_vendor.py` | lädt MapLibre GL JS 5.24.0, proj4js 2.22.0, qrcodejs und Open-Sans-Glyphen nach `docs/vendor/` (gepinnt, SHA-256 in `VERSIONEN.json`) |
| `bundle_offline.py` | baut `dist/webkarte_offline.html` (eine Datei, läuft per Doppelklick ohne Server) |
| `docs/` | die Website (GitHub-Pages-Wurzel): `index.html`, `css/`, `js/` (klassische Skripte unter dem Namensraum `WK`), `data/`, `vendor/` |

## Build und Vorschau

```powershell
& "C:\Users\slidd\miniforge3\envs\ox\python.exe" webkarte\fetch_vendor.py          # einmalig
& "C:\Users\slidd\miniforge3\envs\ox\python.exe" webkarte\build_webkarte.py        # Daten erzeugen
& "C:\Users\slidd\miniforge3\envs\ox\python.exe" -m http.server 8765 --directory webkarte\docs --bind 127.0.0.1
```

Dann `http://127.0.0.1:8765/` öffnen. Optionen des Builds: `--protokoll` (schreibt
`ergaenzungen/protokolle/E20_webkarte_<datum>_v<N>.md` und eine Laufregister-Zeile; nur für den
Abgabestand), `--ohne-raster`, `--nur-farben` (nur Paletten und `farbschemata/arbeit.json` neu,
z. B. nach Änderungen an `abb_helfer.py`). Eigene Farbschemata werden nie überschrieben.

Offline-Datei: `bundle_offline.py` → `dist/webkarte_offline.html` (ca. 16 MB). Ohne Internet
zeigt sie keinen Kartenhintergrund („weiß"), alles andere funktioniert.

## Deployment (GitHub Pages)

1. `git init` in diesem Ordner (nur dieser Ordner wird versioniert), Identität lokal setzen,
   `.gitignore` ist vorhanden (`dist/`, `__pycache__/`).
2. Auf github.com ein öffentliches Repository anlegen, `git remote add origin …`, `git push -u origin main`.
3. Settings → Pages → „Deploy from a branch", Branch `main`, Ordner `/docs`.
4. `docs/robots.txt` und `<meta name="robots" content="noindex">` halten die Seite aus Suchmaschinen.

## Bedienung in Kürze

Presets „Karten der Arbeit" stellen die Abbildungen nach; mit gesetztem Häkchen auch weißer
Hintergrund, Landkreis-Ausschnitt und Farbschema „Arbeit". Regler „Linienstärke" zeichnet alle
Kanten dicker (wirkt auch in Detailkarte und Exporten). Die Detailkarte zeichnet die gewählte Kante
breiter mit weißem Rand, aber in ihrer aktuellen Datenfarbe (ohne Wert grau), damit der Farbwert
ablesbar bleibt. „Top 25" neben jeder Gefahrengruppe zeigt
die 25 Kanten mit den höchsten Indexwerten (Filter „nur Top N"). Die Knöpfe A, B, L, K und Gem.
darunter zeigen die Top 25 innerhalb einer Baulastebene (Autobahn, Bundes-, Landes-, Kreis-,
Gemeindestraße), gereiht nach dem globalen Index wie im AP7-Vermerk der Arbeit; im Filter lässt
sich dazu „nur Top N" mit „unter: <Ebene>" frei kombinieren. Bei aktivem Top-N-Filter markiert in der Übersicht ein Punkt in
Kantenfarbe jede Top-Kante (kurze Kanten fallen bei kleinem Zoom aus den Kacheln; abschaltbar im
Filter, blendet zwischen Zoom 12 und 14 aus, erscheint auch im PNG-Export). Favoriten (☆ im Panel, Taste S)
und bis zu zehn Pins für den Vergleich (Taste P) bleiben im Browser gespeichert. Export (E),
Farben (C), Hilfe (?).

Die Variablengruppen im Menü sind einklappbar und starten eingeklappt; ein Punkt zeigt, in welcher
Gruppe die gezeigte Variable liegt. Die Rangliste (R) ersetzt das Menü durch eine scrollbare,
sortierbare Attributtabelle der aktuellen Variable: Klick auf eine Zeile springt zur Kante,
Pfeiltasten blättern, „⇔ Spalten" zeigt weitere Kennwerte, „✕ Schließen" (oben fixiert) holt das
Menü zurück; CSV und GeoJSON exportieren die gefilterten Kanten. „Straßenzug <Nr.>" im Panel zoomt
auf alle Kanten derselben Nummer und öffnet eine Auswertung mit Max, Min und Median der aktuellen
Variable als Sprungziele.

## Amtliche Gefahrenkarten (WMS)

Unter „Ebenen" lassen sich die Originalkarten einblenden, aus denen die Arbeit ihre
Gefahrengrößen ableitet; die Bilder kommen direkt von den Diensten (beide mit CORS-Freigabe,
daher auch im PNG-Export) und brauchen Internet:

- BKG, Hinweiskarte Starkregengefahren (`sgx.geodatenzentrum.de/wms_starkregen`, Layer `ni_*`):
  Überflutungstiefe, Fließgeschwindigkeit und Fließrichtung (nur Maßstab 1:500 bis 1:4.250, ab
  Zoom 16) für das extreme Ereignis (100 mm in 1 h, Szenario der Arbeit) und das außergewöhnliche
  Ereignis (100-jährlich nach KOSTRA);
- NLWKN, Dienst „Hochwasserschutz" (`umweltkarten-niedersachsen.de/.../HWSchutz_wms`): Wassertiefen
  Binnenland für HQextrem, HQ100 und HQhäufig sowie die festgesetzten und vorläufig gesicherten
  Überschwemmungsgebiete. Fließgeschwindigkeiten gibt es für Flusshochwasser nicht.

Ist eine dieser Ebenen an, fragt ein Klick in die Karte die Dienste am Punkt ab (GetFeatureInfo):
beim BKG Tiefe in cm und Geschwindigkeit in m/s (dazu ihr Produkt), beim NLWKN die Tiefenklasse.
Dessen Klassencodes sind 1 bis 5 (HQ100, HQhäufig) bzw. 11 bis 15 (HQextrem) für die fünf
Tiefenklassen der Legende und 21 bis 25 für dieselben Klassen hinter Schutzanlagen; geprüft an
Flächen, deren Klasse aus den HWRM-Daten der Arbeit bekannt ist (11, 12, 21, 22, 1, 2), die
übrigen folgen der Legendenreihenfolge. Dienste, Layer und Abfragegruppen stehen als Daten in
`docs/js/config.js` unter `wms`.

## Anleitung, Glossar und ?-Knöpfe

„Anleitung" (A) startet eine geführte Tour durch alle Bereiche; beim ersten Besuch startet sie
von selbst (Merker `wk.tour.gesehen` im Browser). Die ?-Knöpfe an Abschnitten, Gruppen, Variablen,
Bedienelementen, in der Legende und an jeder Zeile der Kantendetails öffnen eine Kurzerklärung mit
verwandten Begriffen; das ganze Glossar steht unter „Hilfe". Alle Texte liegen als Daten in
`docs/data/glossar.json`:

- `begriffe`: `kurz` (Erklärtext, von Hand gepflegt), `glossar` (fett gesetzter Begriff in
  `Glossar.md` der Arbeit), `lang` (dessen Wortlaut), `siehe` (verwandte Begriffe);
- `gruppen`, `variablen` (Variablen und Panel-Spalten; ohne eigenes `kurz` gilt die Beschreibung
  aus `meta.json`), `bedienung` (Abschnitte und Bedienelemente; auch die Texte der Tour).

`build_webkarte.py --glossar` liest den Wortlaut neu aus `Glossar.md` ein (Pfad in
`webkarte_bau/glossar.py`, Querverweise wie `[@tbl:…]` werden entfernt) und lässt alles andere
unangetastet; jeder volle Build tut dasselbe. Ist `Glossar.md` nicht erreichbar, bleibt der
zuletzt eingelesene Wortlaut stehen.

## Meldungen (GitHub-Issues)

„Melden" (M, auch im Panel je Kante) öffnet ein Formular für Fehler, Datenauffälligkeiten, Wünsche
und Feedback. Die Seite ist statisch und enthält kein Zugangstoken: sie öffnet das passende
Issue-Formular des Repositories (`.github/ISSUE_TEMPLATE/*.yml`, Labels `bug`, `enhancement`,
`question`) mit Titel, Beschreibung und Kartenzustand (Link zur Ansicht, Variable, gewählte Kante,
Datenstand, Browser) vorausgefüllt; abgeschickt wird auf GitHub mit dem Konto der meldenden Person.
Ohne Konto bleibt „Text kopieren"; ein E-Mail-Knopf erscheint, wenn in `docs/js/config.js` unter
`report.email` eine Adresse steht. Repository und öffentliche Adresse stehen ebenfalls dort.

## Farbschemata (austauschbare Farben)

Farben liegen nicht im Code, sondern in `docs/data/farbschemata/*.json`; `paletten.json` enthält
matplotlib-Colormaps als 33 Stops. `arbeit.json` wird bei jedem Build aus `abb_helfer.py`
abgeleitet und reproduziert die Abbildungen der Arbeit. Ein Schema hat:

- `rollen`: je Farbrolle (`pluvial`, `fluvial`, `heat`, `compound`, `importance`, `coverage`)
  entweder `{"palette": "Blues", "lo": 0.15, "hi": 1.0, "umkehren": false, "gamma": 1.0}`
  (wie `abb_helfer._trunc`) oder freie Stops `{"stops": [[0, "#…"], [1, "#…"]]}`;
- `kategorien`: je kategorialer Spalte explizite Farben `{"farben": {"H1": "#…"}}` oder
  `{"abgeleitet": "pluvial", "werte": ["H1", …], "extra": {"querbauwerk": "#c8c8c8"}}`
  (Stufen wie `stufenfarben`, linspace 0,20–1,0);
- `quintile` (Zweifarb-Rampen Q1–Q5 mit Linienbreiten), `breiten` (je Variable oder Kategorie),
  `kontext` (Kontextnetz, Kreisgrenze, Auswahl, Halo, Hintergrund, Gitter, Pins), `kein_wert`.

Fehlende Einträge werden aus `arbeit` ergänzt, fehlerhafte Dateien fallen auf `arbeit` zurück.
Der Farbeditor in der App (Taste `C`) schreibt dasselbe Format (Export/Import als JSON,
Speichern im Browser). Karte, Legende, Detailkarte und alle Exporte lesen ausschließlich aus
dem aktiven Schema (`WK.stil`).

## Datenformat

`kanten.json` (Format `kanten-kompakt-1`): Feature-id = `edge_id` aus Layer 04, Koordinaten als
Ganzzahlen (Grad × 10^5), erster Punkt absolut, weitere als Differenz; Attribute spaltenweise,
dünn besetzte Spalten als `{"i": [Indizes], "w": [Werte]}`, Textspalten mit ≤ 64 Werten als Codes.
`attr_<gruppe>.json` (Format `tabelle-kompakt-1`) ergänzen die Kennwerte je Gefahr; der Browser
verknüpft sie über die id (`WK.daten`). `kanten_keys.csv` verbindet id und Schlüssel `u|v|osmid`.

## Lizenzen

Straßennetz © OpenStreetMap-Mitwirkende (ODbL). Hintergrundkarten: TopPlusOpen © BKG
(dl-de/by-2-0), Luftbild DOP20 © LGLN (CC BY 4.0), Sentinel-2 cloudless by EOX (CC BY-NC-SA 4.0),
OpenStreetMap (ODbL), OpenTopoMap (CC BY-SA 3.0). WMS-Gefahrenkarten: Hinweiskarte
Starkregengefahren © BKG (Jahr des Datenbezugs) dl-de/by-2-0 (Quellenvermerk und Datenquellen laut
Dienst), Hochwassergefahrenkarten HWRM-RL © NLWKN. Gefahrendaten: BKG-Hinweiskarte Starkregen
(© GeoBasis-DE/BKG), Hochwassergefahrenkarten HWRM-RL (© NLWKN, dl-de/by-2.0), Landsat 8/9
(USGS/NASA), Copernicus HRL (© European Union). Bibliotheken: MapLibre GL JS (BSD-3), proj4js (MIT),
qrcodejs (MIT), Open Sans (OFL).
