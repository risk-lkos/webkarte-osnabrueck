# -*- coding: utf-8 -*-
"""Build der Web-Karte: Ergebnisdateien der Arbeit -> docs/data/*.

Aufruf (immer als Skriptdatei, nie als -c-Argument):

    & "C:\\Users\\slidd\\miniforge3\\envs\\ox\\python.exe" webkarte\\build_webkarte.py [--protokoll] [--ohne-raster] [--nur-farben]

--protokoll    schreibt ergaenzungen/protokolle/E20_webkarte_<datum>_v<N>.md und eine Zeile
               ins Laufregister (fuer den Abgabestand; Entwicklungslaeufe ohne Flag).
--ohne-raster  ueberspringt die Raster-Overlays (schneller Entwicklungslauf).
--nur-farben   erzeugt nur paletten.json und farbschemata/arbeit.json neu (z. B. nach
               Aenderungen an abb_helfer.py); eigene Schemata bleiben unangetastet.
--glossar      liest nur den Wortlaut der Begriffe aus Glossar.md der Arbeit nach
               docs/data/glossar.json ein (Feld lang); die Kurztexte bleiben unangetastet.

Gelesen wird ausschliesslich; die Ergebnisdateien der Arbeitspakete werden nicht veraendert.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

HIER = Path(__file__).resolve().parent
if str(HIER) not in sys.path:
    sys.path.insert(0, str(HIER))

from webkarte_bau import quellen as Q          # noqa: E402  (setzt Umgebung, laedt abb_helfer)
from webkarte_bau import kanten, kontext, raster, stil, meta, schreiben, pruefen, glossar  # noqa: E402

KANTEN_MAX_MB = 8.0
GESAMT_MAX_MB = 16.0


def _log(t0: float, text: str) -> None:
    print(f"[{time.time() - t0:6.1f} s] {text}", flush=True)


def _groessen() -> dict[str, float]:
    aus = {}
    for pfad in sorted(Q.DATA.glob("*.json")):
        aus[pfad.name] = schreiben.mb(pfad)
    for pfad in sorted(Q.KONTEXT.glob("*.json")):
        aus[f"kontext/{pfad.name}"] = schreiben.mb(pfad)
    for pfad in sorted(Q.RASTER.glob("*")):
        aus[f"raster/{pfad.name}"] = schreiben.mb(pfad)
    for pfad in sorted(Q.SCHEMATA.glob("*.json")):
        aus[f"farbschemata/{pfad.name}"] = schreiben.mb(pfad)
    return aus


def _protokoll(m: dict, ergebnisse: list[dict], p: dict, groessen: dict, stil_info: dict,
               kontext_info: dict) -> Path:
    B = Q.B
    var_zeilen = []
    for v in m["variablen"]:
        if v["typ"] == "kategorial":
            var_zeilen.append((v["id"], v["gruppe"], v["typ"], v.get("n_gueltig", ""), "", "", ", ".join(v.get("werte", []))[:60]))
        else:
            sk = v.get("skala_default", {})
            var_zeilen.append((v["id"], v["gruppe"], v["typ"], v.get("n_gueltig", ""),
                               sk.get("vmin", ""), sk.get("vmax", ""), v["einheit"]))
    dateien = [(k, f"{v:.2f}") for k, v in groessen.items()]
    hq = kontext_info.get("hqextrem_info", {})
    abschnitte = [
        ("Ablauf",
         "Basis ist der Layer `vi_heat` (72.238 Kanten, Schluessel `key` = u|v|osmid). Layer 04 wird ueber den "
         "gleich gebauten Schluessel 1:1 angebunden (`edge_id` = Feature-id), alle weiteren Layer ueber `key`. "
         f"Geometrien: simplify({Q.SIMPLIFY_M:g} m) in EPSG:25832, danach EPSG:4326 mit {Q.DEZIMALEN} Dezimalen. "
         "Attribute liegen in spaltenorientierten Tabellen je Gruppe (nur Zeilen mit Werten), Basisattribute "
         "in `kanten.json`. Gemeinde und Kreiszugehoerigkeit ueber den Kantenmittelpunkt (within), wie E01/E05. "
         f"Belastungsprofil der Abbildung (mhn_bf): k = {m['build']['mhn_bf']['k']} Top-Kanten aus Layer 16 "
         f"(n = {m['build']['mhn_bf']['n_basis']})."),
        ("Pruefsummen", pruefen.tabelle(ergebnisse)),
        ("Variablenkatalog", B.tabelle(["Variable", "Gruppe", "Typ", "n", "vmin (P2)", "vmax (P100)", "Einheit/Werte"], var_zeilen)),
        ("Dateien (MB)", B.tabelle(["Datei", "MB"], dateien)),
        ("Abweichungen und Vereinfachungen",
         f"- HQextrem-Flaechen: Teilpolygone und Loecher unter {Q.HQEXTREM_MIN_M2:g} m² entfernt, simplify({Q.HQEXTREM_SIMPLIFY_M:g} m); "
         f"Flaeche {hq.get('flaeche_km2', '?')} von {hq.get('flaeche_km2_roh', '?')} km² "
         f"(Anteil {hq.get('flaechenanteil', '?')}), Stuetzpunkte {hq.get('stuetzpunkte', '?')} von {hq.get('stuetzpunkte_roh', '?')}.\n"
         "- `hazard_klasse` = keine_ueberflutung wird nicht ausgespielt (Kante ausserhalb des Abtastgebiets).\n"
         "- importance_s = 0 wird nicht ausgespielt; das Flag `aktiv` kennzeichnet die 4.212 aktiven Kanten.\n"
         "- Perzentilraenge mit 6, Rohindizes mit 4, Messgroessen mit 2–3 Dezimalen gerundet.\n"
         "- Raster-Overlays: Ausschnitt Landkreis ± 5 km, Warp nach EPSG:3857, Farbskala P2–P98 wie in der Arbeit."),
        ("Farbschemata",
         "`paletten.json` sampelt matplotlib-Colormaps in 33 Stops; `farbschemata/arbeit.json` beschreibt die "
         "Rollen der Arbeit als Palette + lo/hi. Max. Abweichung der Rekonstruktion gegen abb_helfer.CMAP "
         f"(in 1/255): {stil_info['exaktheit']}. Vorhandene Schemata: {', '.join(stil_info['schemata'])}."),
        ("Basemaps und Lizenzen",
         "\n".join(f"- {b['label']}: {b.get('attribution', '')} ({b.get('lizenz', '')})" for b in m["basemaps"] if b["typ"] != "keiner")),
        ("Lesart",
         "Die Web-Karte zeigt dieselben Kennwerte wie die Abbildungen des Ergebniskapitels, aber je Kante abrufbar. "
         "Alle Werte stammen unveraendert aus den Ergebnisdateien; Rundungen betreffen nur die Anzeige. "
         "Farben sind austauschbar (Farbschemata), die Fassung `arbeit` reproduziert die Abbildungen."),
    ]
    quellen = [pf for pf in p.values()]
    pfad = B.protokoll_schreiben("E20_webkarte", "Web-Karte: Datenexport und Pruefsummen",
                                 abschnitte, quellen=quellen, skript="build_webkarte.py")
    Q.ap_io.register(B.PROTOKOLLE, ap="E20", notebook="build_webkarte.py",
                     eingaben=quellen,
                     ausgaben=[Q.DATA / "kanten.json", Q.DATA / "meta.json", pfad],
                     parameter={"simplify_m": Q.SIMPLIFY_M, "dezimalen": Q.DEZIMALEN,
                                "hqextrem_min_m2": Q.HQEXTREM_MIN_M2, "mhn_bf_k": m["build"]["mhn_bf"]["k"]})
    return pfad


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Build der Web-Karte")
    ap.add_argument("--nur-farben", action="store_true")
    ap.add_argument("--ohne-raster", action="store_true")
    ap.add_argument("--protokoll", action="store_true")
    ap.add_argument("--glossar", action="store_true",
                    help="nur den Wortlaut aus Glossar.md der Arbeit nach docs/data/glossar.json einlesen")
    args = ap.parse_args(argv)
    t0 = time.time()
    Q.ordner_anlegen()

    g_info = glossar.einlesen()
    _log(t0, f"Glossar: {g_info['uebernommen']} Begriffe aus Glossar.md uebernommen"
             + (f", nicht gefunden: {g_info['fehlend']}" if g_info["fehlend"] else "")
             + ("" if g_info["vorhanden"] else " (Glossar.md nicht erreichbar, Wortlaut bleibt wie er ist)"))
    if args.glossar:
        return 0

    stil_info = stil.schreiben_alle()
    _log(t0, f"Farben: Paletten {len(stil_info['paletten'])}, Schemata {stil_info['schemata']}, "
             f"Exaktheit (1/255): {stil_info['exaktheit']}")
    if args.nur_farben:
        return 0

    p = Q.pfade()
    for k, v in p.items():
        print(f"    {k:14s} {v}")
    basis, teile = kanten.laden(p)
    _log(t0, f"Basis geladen und gejoint: {len(basis)} Kanten, {len(basis.columns)} Spalten")
    basis = kanten.ableiten(basis, teile, p)
    mhn_info = {"k": teile["mhn_bf_k"], "n_basis": teile["mhn_bf_n_basis"], "anteil": Q.MHN_BF_ANTEIL}
    _log(t0, f"Ableitungen: aktiv {int(basis['aktiv'].sum())}, im Kreis {int(basis['im_kreis'].sum())}, "
             f"mhn_bf>=2 {int((basis['mhn_bf'] >= 2).sum())}")

    fb = kanten.fallbeispiele_laden(p, basis)
    kontext_info = kontext.schreiben_alle(p, fb)
    _log(t0, f"Kontextlayer: {kontext_info}")

    ergebnisse = pruefen.pruefen(basis, teile, kontext_info)
    _log(t0, f"Pruefsummen: {len(ergebnisse)} Groessen ok")

    tab = kanten.tabellen(basis)
    props = kanten.kanten_props(basis)
    geom = kanten.geometrie_web(basis)
    k_info = schreiben.kanten_kompakt(geom, basis["edge_id"].tolist(), props, Q.DATA / "kanten.json",
                                      rundung=kanten.RUNDUNG, ganzzahl=kanten.GANZZAHL,
                                      bool_spalten=kanten.BOOL)
    _log(t0, f"kanten.json: {k_info['features']} Kanten, {k_info['stuetzpunkte']} Stuetzpunkte, "
             f"{schreiben.mb(Q.DATA / 'kanten.json')} MB")
    for datei, df in tab.items():
        schreiben.tabelle_schreiben(df, Q.DATA / datei, kanten.RUNDUNG, kanten.GANZZAHL, kanten.BOOL)
        _log(t0, f"{datei}: {len(df)} Zeilen, {schreiben.mb(Q.DATA / datei)} MB")
    with open(Q.DATA / "kanten_keys.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "key", "u", "v"])
        for z in basis[["edge_id", "key", "u", "v"]].itertuples(index=False):
            w.writerow([int(z.edge_id), z.key, int(z.u), int(z.v)])

    raster_info = {} if args.ohne_raster else raster.alle(p)
    if raster_info:
        _log(t0, "Raster: " + ", ".join(f"{k} {v['breite_px']}x{v['hoehe_px']} px, {v['mb']} MB" for k, v in raster_info.items()))

    groessen = _groessen()
    kanten_mb = groessen["kanten.json"]
    daten_mb = sum(v for k, v in groessen.items() if k == "kanten.json" or k.startswith("attr_"))
    if kanten_mb > KANTEN_MAX_MB or daten_mb > GESAMT_MAX_MB:
        raise AssertionError(f"Dateigrenze verletzt: kanten.json {kanten_mb} MB (max {KANTEN_MAX_MB}), "
                             f"Kanten+Attribute {daten_mb:.1f} MB (max {GESAMT_MAX_MB})")

    m = meta.bauen(basis, tab, p, ergebnisse, groessen, Q.quellen_register(p), kontext_info,
                   raster_info, stil_info, mhn_info)
    schreiben.json_schreiben(m, Q.DATA / "meta.json", lesbar=True)
    _log(t0, f"meta.json: {len(m['variablen'])} Variablen, {len(m['presets'])} Presets, "
             f"Daten gesamt {daten_mb:.1f} MB (kanten.json {kanten_mb} MB)")

    if args.protokoll:
        pfad = _protokoll(m, ergebnisse, p, groessen, stil_info, kontext_info)
        _log(t0, f"Protokoll: {pfad}")
    _log(t0, "fertig")
    return 0


if __name__ == "__main__":
    sys.exit(main())
