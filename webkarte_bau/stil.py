# -*- coding: utf-8 -*-
"""Farben als Daten: Palettenbibliothek und Farbschemata.

``paletten.json`` sampelt matplotlib-Colormaps in 33 Stops. Ein Farbschema
beschreibt jede Rolle (pluvial, fluvial, heat, compound, importance, coverage)
als Palette + lo/hi wie ``abb_helfer._trunc`` oder als freie Stop-Liste,
dazu kategoriale Farbtabellen, Quintil-Rampen, Linienbreiten und
Kontextfarben. ``arbeit.json`` wird bei jedem Build aus ``abb_helfer``
abgeleitet und gegen die Original-Colormaps geprueft; die JavaScript-Seite
(``WK.stil``) rekonstruiert die Farben mit exakt derselben Rechnung
(linear in sRGB zwischen den Stops).
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from . import quellen as Q
from . import schreiben

H = Q.H
plt = H.plt
import matplotlib  # noqa: E402

PALETTEN_SEQ = ["Blues", "GnBu", "YlOrRd", "Purples", "Greys", "YlGn", "Oranges", "Reds",
                "BuPu", "PuRd", "YlGnBu", "OrRd", "Greens", "BuGn", "PuBu",
                "viridis", "cividis", "magma", "inferno", "plasma"]
PALETTEN_DIV = ["RdYlBu", "RdBu", "PuOr", "BrBG", "Spectral"]
N_STOPS = 33
EXAKTHEIT_MAX = 3.0   # zulaessige Kanalabweichung in 1/255 (LUT-Quantisierung, siehe schreiben_alle)

# Rollen der Arbeit (abb_helfer.CMAP): Basis-Colormap, lo, hi
ROLLEN_ARBEIT = {
    "pluvial":    ("Blues",   0.15, 1.00),
    "fluvial":    ("GnBu",    0.15, 1.00),
    "heat":       ("YlOrRd",  0.12, 1.00),
    "compound":   ("Purples", 0.15, 1.00),
    "importance": ("Greys",   0.25, 0.95),
    "coverage":   ("YlGn",    0.15, 1.00),
}

# Kategorien, die nicht aus einer Rolle abgeleitet werden (explizite Farben)
KATEGORIEN_EXPLIZIT = {
    "mhn_bf": {"1": H.RISIKO["hellorange"], "2": H.RISIKO["orange"], "3": H.RISIKO["rot"]},
    "multi_hazard_n": {"0": H.RISIKO["neutral"], "1": H.RISIKO["hellorange"],
                       "2": H.RISIKO["orange"], "3": H.RISIKO["rot"]},
    "klasse": {"inaktiv": "#c8c8c8", "gering": "#238b45", "moderat": "#e8c000",
               "hoch": "#e6550d", "sehr hoch": "#cb181d", "kritisch": "#6a51a3"},
    "baulast": {"autobahn": "#1f78b4", "bundesstrasse": "#e31a1c", "landesstrasse": "#ff7f00",
                "kreisstrasse": "#e8c000", "gemeindestrasse": "#9e9e9e"},
    "highway": {"motorway": "#1f78b4", "motorway_link": "#a6cee3", "trunk": "#e31a1c",
                "trunk_link": "#fb9a99", "primary": "#ff7f00", "primary_link": "#fdbf6f",
                "secondary": "#e8c000", "secondary_link": "#fff3b0", "tertiary": "#33a02c",
                "tertiary_link": "#b2df8a", "unclassified": "#6a3d9a", "residential": "#9e9e9e",
                "living_street": "#cab2d6", "road": "#000000"},
    "surface_class": {"asphalt": "#555555", "concrete": "#9ecae1", "pflaster": "#d95f02",
                      "befestigt_unspez": "#bdbdbd", "ungebunden": "#a6761d", "sonstig": "#e7298a"},
    "fluvial_status": {"Tiefe HQextrem": "#08589e", "nur Ausdehnung": "#7bccc4"},
    "betroffen_fl": {"1": "#08589e"},
}

# Kategorien, die wie stufenfarben(rolle, n) aus einer Rolle abgeleitet werden.
KATEGORIEN_ABGELEITET = {
    "hazard_klasse": {"abgeleitet": "pluvial", "werte": ["H1", "H2", "H3", "H4", "H5", "H6"],
                      "extra": {"querbauwerk": H.RISIKO["neutral"]}},
    "h_klasse_fl": {"abgeleitet": "fluvial", "werte": ["H2", "H3", "H4", "H5", "H6"]},
    "h_klasse": {"abgeleitet": "fluvial", "werte": ["H2", "H3", "H4", "H5", "H6"]},
    "beschattung": {"abgeleitet": "coverage", "werte": ["unbeschattet", "gering", "mittel", "hoch"]},
    "vi_band": {"abgeleitet": "fluvial", "werte": ["0", "1", "2", "3", "4"]},
    "robust_n": {"abgeleitet": "heat", "werte": ["0", "1", "2", "3", "4"]},
    "robustheit": {"abgeleitet": "pluvial", "werte": ["0", "1", "2", "3", "4"]},
}

# Linienbreiten je Variable (Zahlen der Abbildungsnotebooks) und je Kategorie
BREITEN = {
    "standard": 1.4,
    "kontext": 0.3,
    "kontext_importance": 0.4,
    "netz_dunkel": 0.5,
    "vi_pct": 1.6, "vi_roh": 1.6, "dv_max": 1.6, "tiefe_max_m": 1.6, "flut_anteil": 1.6,
    "heat_pct": 1.4, "vi_pct_heat": 1.4, "lst_p90_mean": 1.4,
    "vi_pct_heat_v2": 1.4, "vi_pct_heat_v3": 1.4, "vi_pct_heat_v4": 1.4,
    "vi_pct_fluvial": 1.8, "vi_pct_fluvial_voll": 1.8, "vi_roh_fluvial_nb": 1.8,
    "tiefe_repr_fl": 1.8, "ufl_m": 1.8, "betroffen_fl": 1.0,
    "vi_pct_compound": 2.0, "vi_roh_compound": 2.0, "vi_pct_compound_heat": 2.0,
    "stark_pct": 2.0, "hitze_pct": 2.0, "stark_pct_h": 2.0,
    "imp_pct100": 1.1, "importance_s": 1.1, "imp_pct": 1.1,
    "cover_frac": 1.8,
    "hazard_klasse": {"H1": 0.5, "H2": 0.62, "H3": 0.74, "H4": 0.86, "H5": 0.98, "H6": 1.1,
                      "querbauwerk": 0.8},
    "mhn_bf": {"1": 1.5, "2": 2.2, "3": 2.9},
    "multi_hazard_n": {"0": 0.3, "1": 1.5, "2": 2.2, "3": 2.9},
    "klasse": {"inaktiv": 0.3, "gering": 0.6, "moderat": 0.9, "hoch": 1.3, "sehr hoch": 1.8,
               "kritisch": 2.4},
}

KONTEXT = {
    "grau": H.GRAU, "umriss": H.UMRISS, "warm": H.WARM,
    "auswahl": H.WARM, "halo": "#ffffff", "hintergrund": "#ffffff",
    "gitter": "#c4c4c4", "netz_dunkel": "#222222", "gemeinden": "#8a8a8a",
    "gewaesser": "#1f78b4", "inset_land": "#ececec", "inset_rand": "#8a8a8a",
    "pin": ["#1b9e77", "#7570b3", "#e7298a"],
    "risiko": dict(H.RISIKO),
}


def hex_(rgba) -> str:
    return "#%02x%02x%02x" % tuple(int(round(float(c) * 255)) for c in rgba[:3])


def _rgb(hexfarbe: str):
    h = hexfarbe.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def paletten_json() -> dict:
    aus = {}
    for name in PALETTEN_SEQ + PALETTEN_DIV:
        cm = plt.get_cmap(name)
        aus[name] = {
            "typ": "divergierend" if name in PALETTEN_DIV else "sequenziell",
            "quelle": f"matplotlib {matplotlib.__version__}",
            "stops": [hex_(c) for c in cm(np.linspace(0.0, 1.0, N_STOPS))],
        }
    return aus


def rolle_farbe(paletten: dict, rolle: dict, t: float) -> np.ndarray:
    """JS-identische Rekonstruktion: t in [0,1] -> RGB (0..1)."""
    t = min(max(float(t), 0.0), 1.0)
    gamma = float(rolle.get("gamma", 1.0) or 1.0)
    if gamma != 1.0:
        t = t ** gamma
    if "stops" in rolle:
        stops = rolle["stops"]                     # [[pos, "#hex"], ...] sortiert
        pos = [s[0] for s in stops]
        for i in range(len(stops) - 1):
            if t <= pos[i + 1] or i == len(stops) - 2:
                span = pos[i + 1] - pos[i]
                frac = 0.0 if span <= 0 else (t - pos[i]) / span
                frac = min(max(frac, 0.0), 1.0)
                return _rgb(stops[i][1]) * (1 - frac) + _rgb(stops[i + 1][1]) * frac
        return _rgb(stops[-1][1])
    lo, hi = float(rolle.get("lo", 0.0)), float(rolle.get("hi", 1.0))
    if rolle.get("umkehren"):
        t = 1.0 - t
    p = lo + t * (hi - lo)
    stops = paletten[rolle["palette"]]["stops"]
    n = len(stops)
    x = p * (n - 1)
    i = int(math.floor(x))
    if i >= n - 1:
        return _rgb(stops[-1])
    if i < 0:
        return _rgb(stops[0])
    frac = x - i
    return _rgb(stops[i]) * (1 - frac) + _rgb(stops[i + 1]) * frac


def exaktheit(paletten: dict, rollen: dict) -> dict[str, float]:
    """Max. Kanalabweichung (in 1/255) der Rekonstruktion gegen abb_helfer.CMAP."""
    aus = {}
    for name, rolle in rollen.items():
        if name not in H.CMAP:
            continue
        cm = H.CMAP[name]
        worst = 0.0
        for t in np.linspace(0.0, 1.0, 256):
            soll = np.array(cm(float(t))[:3])
            ist = rolle_farbe(paletten, rolle, float(t))
            worst = max(worst, float(np.abs(soll - ist).max() * 255))
        aus[name] = round(worst, 3)
    return aus


def schema_arbeit() -> dict:
    rollen = {name: {"palette": pal, "lo": lo, "hi": hi, "umkehren": False, "gamma": 1.0}
              for name, (pal, lo, hi) in ROLLEN_ARBEIT.items()}
    kategorien = {}
    for k, v in KATEGORIEN_ABGELEITET.items():
        kategorien[k] = dict(v)
    for k, v in KATEGORIEN_EXPLIZIT.items():
        kategorien[k] = {"farben": dict(v)}
    quintile = [{"kz": kz, "spanne": sp, "semantik": sem,
                 "farben": [hex_(cm(0.0)), hex_(cm(1.0))], "lw": lw}
                for kz, sp, sem, cm, lw in H.IMP_QUINTILE]
    return {
        "name": "Arbeit (abb_helfer.py)",
        "id": "arbeit",
        "version": 1,
        "beschreibung": "Farben und Linienbreiten der Abbildungen der Arbeit, aus abb_helfer.py abgeleitet.",
        "rollen": rollen,
        "kategorien": kategorien,
        "quintile": quintile,
        "breiten": BREITEN,
        "kontext": KONTEXT,
        "kein_wert": "rgba(0,0,0,0)",
        "stufen_bereich": [0.20, 1.0],
    }


def _rolle(pal, lo=0.0, hi=1.0, gamma=1.0, umkehren=False):
    return {"palette": pal, "lo": lo, "hi": hi, "umkehren": umkehren, "gamma": gamma}


MITLIEFER = {
    "viridis": {
        "name": "Viridis-Familie", "id": "viridis", "version": 1, "basis": "arbeit",
        "beschreibung": "Wahrnehmungsgleichmaessige Paletten (viridis/inferno/plasma), farbfehlsichtigkeitsfreundlich.",
        "rollen": {"pluvial": _rolle("viridis"), "fluvial": _rolle("viridis", 0.0, 1.0, 1.0, True),
                   "heat": _rolle("inferno", 0.1, 0.95), "compound": _rolle("plasma", 0.0, 0.95),
                   "importance": _rolle("Greys", 0.25, 0.95), "coverage": _rolle("viridis")},
    },
    "cividis": {
        "name": "Cividis (Farbfehlsichtigkeit)", "id": "cividis", "version": 1, "basis": "arbeit",
        "beschreibung": "Cividis ist fuer Deuteranopie/Protanopie optimiert; alle Gefahren nutzen dieselbe Skala.",
        "rollen": {r: _rolle("cividis") for r in ["pluvial", "fluvial", "heat", "compound", "coverage"]}
        | {"importance": _rolle("Greys", 0.25, 0.95)},
    },
    "grau": {
        "name": "Graustufen (Druck)", "id": "grau", "version": 1, "basis": "arbeit",
        "beschreibung": "Alle Rollen als Grauskala fuer Schwarz-Weiss-Druck.",
        "rollen": {r: _rolle("Greys", 0.2, 1.0) for r in ROLLEN_ARBEIT},
    },
    "kontrast": {
        "name": "Kontrast (gespreizt)", "id": "kontrast", "version": 1, "basis": "arbeit",
        "beschreibung": "Paletten der Arbeit, staerker abgeschnitten und mit Gamma 0,7, damit niedrige Werte weiter auseinanderliegen.",
        "rollen": {name: _rolle(pal, max(lo, 0.35), hi, 0.7) for name, (pal, lo, hi) in ROLLEN_ARBEIT.items()},
    },
}


def schreiben_alle() -> dict:
    """Schreibt paletten.json, arbeit.json (immer) und Mitliefer-Schemata (nur wenn fehlend)."""
    Q.ordner_anlegen()
    paletten = paletten_json()
    schreiben.json_schreiben(paletten, Q.DATA / "paletten.json")
    arbeit = schema_arbeit()
    fehler = exaktheit(paletten, arbeit["rollen"])
    schlimmste = max(fehler.values())
    # matplotlib-Colormaps sind 256-stufige Lookup-Tabellen (Basis und truncierte Kopie);
    # die Quantisierung allein erzeugt bis zu ~2/255 Abweichung gegen die stetige Rekonstruktion.
    if schlimmste > EXAKTHEIT_MAX + 1e-6:
        raise AssertionError(f"Farbrekonstruktion weicht um {schlimmste:.3f}/255 ab: {fehler}")
    schreiben.json_schreiben(arbeit, Q.SCHEMATA / "arbeit.json", lesbar=True)
    angelegt = ["arbeit"]
    for sid, schema in MITLIEFER.items():
        ziel = Q.SCHEMATA / f"{sid}.json"
        if not ziel.exists():
            schreiben.json_schreiben(schema, ziel, lesbar=True)
            angelegt.append(sid)
    vorhanden = sorted(p.stem for p in Q.SCHEMATA.glob("*.json"))
    return {"exaktheit": fehler, "angelegt": angelegt, "schemata": vorhanden,
            "paletten": list(paletten.keys())}
