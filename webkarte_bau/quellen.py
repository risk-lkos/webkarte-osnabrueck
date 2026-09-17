# -*- coding: utf-8 -*-
"""Pfade, Umgebung und Quellenregister fuer den Web-Karten-Build.

Die Importreihenfolge ist entscheidend: ``e_basis`` setzt GDAL_DATA und
PROJ_LIB, ``abb_helfer`` den DLL-Suchpfad und das Agg-Backend. Erst danach
duerfen geopandas und rasterio importiert werden. Dieses Modul erledigt das
einmal fuer alle Teilmodule des Pakets; jedes Teilmodul importiert zuerst
``from . import quellen``.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

HIER = Path(__file__).resolve().parent          # webkarte/webkarte_bau
WEBKARTE = HIER.parent                            # webkarte
WURZEL = WEBKARTE.parent                          # Masterarbeit_JupyterLab
ERG = WURZEL / "ergaenzungen"
if str(ERG) not in sys.path:
    sys.path.insert(0, str(ERG))

import e_basis as B      # noqa: E402  setzt GDAL_DATA / PROJ_LIB, haengt hitze/ an sys.path
import abb_helfer as H   # noqa: E402  DLL-Pfad, Agg, Palette, Landkreisgrenze
import ap_io             # noqa: E402  Versionsschema <basis>_<JJJJMMTT>_v<N>

DOCS = WEBKARTE / "docs"
DATA = DOCS / "data"
KONTEXT = DATA / "kontext"
RASTER = DATA / "raster"
SCHEMATA = DATA / "farbschemata"
DIST = WEBKARTE / "dist"

CRS_ARBEIT = 25832
CRS_WEB = 4326

# Vereinfachung und Rundung (Parameter des Laufs, landen im Protokoll)
SIMPLIFY_M = 5.0
DEZIMALEN = 5
HQEXTREM_MIN_M2 = 2000.0
HQEXTREM_SIMPLIFY_M = 15.0
KONTEXT_SIMPLIFY_M = 10.0
NDS_SIMPLIFY_M = 500.0
RASTER_RAND_M = 5000.0
LST_AUFLOESUNG_M = 100.0
HOTDAYS_AUFLOESUNG_M = 250.0
MHN_BF_ANTEIL = 0.10

LAYER = {
    "vi_heat": "vi_heat",
    "profil": "multi_hazard_profil",
    "h04": "04_hazard_h_schema_vollnetz",
    "f03": "03_kritisch_dv_final",
    "f07": "07_hqextrem_flaeche",
    "f09": "09_fluvial_hqextrem",
    "f10": "10_fluvial_compound_starkregen",
    "f12": "12_fluvial_gesamt",
    "f13": "13_gewaesser_abdeckung",
    "f14": "14_fluvial_ohne_bruecken",
    "f16": "16_fluvial_pct_band",
}


def _hoechste_version(ordner: Path, muster: str) -> Path:
    kandidaten = sorted(ordner.glob(muster))
    if not kandidaten:
        raise FileNotFoundError(f"Kein Treffer fuer {muster} in {ordner}")
    return kandidaten[-1]


def pfade() -> dict[str, Path]:
    """Alle Eingangsdateien, jeweils in der juengsten Fassung."""
    return {
        "vi_heat": B.vi_heat_pfad(),
        "wasser": B.WASSER_GPKG,
        "compound_heat": ap_io.neuester_pfad(B.H_ERGEBNISSE, "compound_starkregen_hitze", ".gpkg"),
        "baulast": ap_io.neuester_pfad(B.H_ERGEBNISSE, "AP7_baulast", ".gpkg"),
        "lk": B.LK_GRENZE,
        "gemeinden": ap_io.neuester_pfad(B.GEODATEN, "gemeinden_lk_os", ".gpkg"),
        "niedersachsen": B.GEODATEN / "niedersachsen.gpkg",
        "fallbeispiele": _hoechste_version(WURZEL / "ergebnisse_fallbeispiele",
                                           "fallbeispiele_kandidaten_v*.gpkg"),
        "lst": ap_io.neuester_pfad(B.H_ZWISCHEN, "lst_komposit_p90_25832", ".tif"),
        "hot_days": B.H_ZWISCHEN / "hot_days_2016_2025_25832.tif",
    }


def quellen_register(p: dict[str, Path]) -> list[dict]:
    """Dateiname, Aenderungszeit und Groesse je Quelle (fuer meta.json und Protokoll)."""
    aus = []
    for schluessel, pfad in p.items():
        st = pfad.stat()
        aus.append({
            "schluessel": schluessel,
            "datei": pfad.name,
            "ordner": str(pfad.parent.relative_to(WURZEL)) if pfad.is_relative_to(WURZEL) else str(pfad.parent),
            "mtime": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
            "mb": round(st.st_size / 1e6, 1),
        })
    return aus


def ordner_anlegen() -> None:
    for d in (DATA, KONTEXT, RASTER, SCHEMATA):
        d.mkdir(parents=True, exist_ok=True)
