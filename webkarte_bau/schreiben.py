# -*- coding: utf-8 -*-
"""Kompakte, deterministische JSON-Ausgabe (GeoJSON und Spaltentabellen).

Alle Dateien werden mit ``sort_keys`` und ohne Leerraum geschrieben, damit ein
zweiter Lauf mit gleichen Eingaben byteidentische Dateien liefert.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import shapely

from . import quellen as Q

_SEP = (",", ":")


def _zahl(x: float, dezimalen: int) -> str:
    s = f"{x:.{dezimalen}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def _json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=_SEP, sort_keys=True, allow_nan=False)


def _python(v):
    """numpy/pandas-Skalare in JSON-faehige Python-Werte, NaN -> None."""
    if v is None:
        return None
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(v, (np.str_, str)):
        return str(v)
    if v is pd.NA or v is pd.NaT:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def props_bereinigen(d: dict) -> dict:
    """Nulls, NaN und leere Strings entfernen, numpy-Typen umwandeln."""
    aus = {}
    for k, v in d.items():
        v = _python(v)
        if v is None or v == "":
            continue
        aus[k] = v
    return aus


def kanten_geojson(gdf4326, ids, props: list[dict], pfad: Path, dezimalen: int = Q.DEZIMALEN) -> int:
    """LineString-FeatureCollection mit numerischer Feature-id, zeilenweise geschrieben.

    ``gdf4326``: GeoSeries/GeoDataFrame in EPSG:4326 (bereits vereinfacht),
    ``ids``: Feature-ids in gleicher Reihenfolge, ``props``: bereinigte Dicts.
    Gibt die Anzahl geschriebener Features zurueck.
    """
    geoms = gdf4326.geometry.values if hasattr(gdf4326, "geometry") else gdf4326.values
    n = 0
    with open(pfad, "w", encoding="utf-8", newline="\n") as f:
        f.write('{"type":"FeatureCollection","features":[\n')
        for geom, fid, p in zip(geoms, ids, props):
            if geom.geom_type != "LineString":
                raise ValueError(f"Kante {fid}: Geometrie ist {geom.geom_type}, erwartet LineString")
            coords = ",".join(f"[{_zahl(x, dezimalen)},{_zahl(y, dezimalen)}]" for x, y in geom.coords)
            if n:
                f.write(",\n")
            f.write('{"type":"Feature","id":%d,"properties":%s,"geometry":{"type":"LineString","coordinates":[%s]}}'
                    % (int(fid), _json(p), coords))
            n += 1
        f.write("\n]}\n")
    return n


def geojson_allgemein(gdf4326, pfad: Path, spalten: list[str], dezimalen: int = Q.DEZIMALEN,
                      ids=None) -> int:
    """Beliebige Geometrien (Polygone, Linien, Punkte) als FeatureCollection."""
    n = 0
    with open(pfad, "w", encoding="utf-8", newline="\n") as f:
        f.write('{"type":"FeatureCollection","features":[\n')
        for i, (_, zeile) in enumerate(gdf4326.iterrows()):
            geom = zeile.geometry
            if geom is None or geom.is_empty:
                continue
            geom = shapely.transform(geom, lambda a: np.round(a, dezimalen))
            p = props_bereinigen({s: zeile[s] for s in spalten if s in gdf4326.columns})
            gj = shapely.to_geojson(geom)
            fid = "" if ids is None else '"id":%d,' % int(ids[i])
            if n:
                f.write(",\n")
            f.write('{"type":"Feature",%s"properties":%s,"geometry":%s}' % (fid, _json(p), gj))
            n += 1
        f.write("\n]}\n")
    return n


MAX_CODES = 64


def _spalte_kompakt(s: pd.Series, spalte: str, rundung: dict, ganzzahl: set, bool_spalten: set,
                    codes: dict) -> object:
    """Eine Spalte als dichte Liste oder als {"i": [...], "w": [...]} (Werte nur an den Indizes).

    Textspalten mit hoechstens MAX_CODES verschiedenen Werten werden als Codes gespeichert
    (Codetabelle in ``codes``), Wahrheitswerte als 1 (nur true), Zahlen gerundet.
    """
    n = len(s)
    if spalte in ganzzahl or pd.api.types.is_integer_dtype(s):
        werte = [None if pd.isna(v) else int(v) for v in s.tolist()]
    elif spalte in bool_spalten or pd.api.types.is_bool_dtype(s) or str(s.dtype) == "boolean":
        werte = [None if pd.isna(v) else (1 if bool(v) else None) for v in s.tolist()]
    elif spalte in rundung:
        nd = rundung[spalte]
        werte = [None if pd.isna(v) else round(float(v), nd) for v in s.tolist()]
    elif pd.api.types.is_float_dtype(s):
        werte = [None if pd.isna(v) else float(v) for v in s.tolist()]
    else:
        werte = [_python(v) for v in s.tolist()]
        werte = [None if w == "" else w for w in werte]
        einzigartig = sorted({w for w in werte if w is not None}, key=str)
        if 0 < len(einzigartig) <= MAX_CODES and all(isinstance(w, str) for w in einzigartig):
            index = {w: k for k, w in enumerate(einzigartig)}
            codes[spalte] = einzigartig
            werte = [None if w is None else index[w] for w in werte]
    belegt = sum(1 for w in werte if w is not None)
    if belegt == 0:
        return {"i": [], "w": []}
    if belegt < n * 0.5:
        idx = [k for k, w in enumerate(werte) if w is not None]
        vals = [werte[k] for k in idx]
        if all(v == vals[0] for v in vals):
            return {"i": idx, "w": vals[0]}
        return {"i": idx, "w": vals}
    return werte


def tabelle_kompakt(df: pd.DataFrame, rundung: dict | None = None, ganzzahl: set | None = None,
                    bool_spalten: set | None = None, ohne: tuple[str, ...] = ("id",)) -> dict:
    """{"format": "tabelle-kompakt-1", "n": N, "id": [...], "spalten": {...}, "codes": {...}}."""
    rundung = rundung or {}
    ganzzahl = ganzzahl or set()
    bool_spalten = bool_spalten or set()
    codes: dict = {}
    spalten = {}
    for spalte in df.columns:
        if spalte in ohne:
            continue
        spalten[spalte] = _spalte_kompakt(df[spalte], spalte, rundung, ganzzahl, bool_spalten, codes)
    aus = {"format": "tabelle-kompakt-1", "n": int(len(df)), "spalten": spalten, "codes": codes}
    if "id" in df.columns:
        aus["id"] = [int(v) for v in df["id"].tolist()]
    return aus


def kanten_kompakt(gdf4326, ids, props: pd.DataFrame, pfad: Path, dezimalen: int = Q.DEZIMALEN,
                   rundung: dict | None = None, ganzzahl: set | None = None,
                   bool_spalten: set | None = None) -> dict:
    """Kanten als kompakte Tabelle mit delta-kodierten Ganzzahl-Koordinaten.

    ``nk`` = Stuetzpunkte je Kante, ``xy`` = flache Liste: erster Punkt absolut
    (Grad * 10^dezimalen), weitere als Differenz zum Vorgaenger. Der Browser baut
    daraus GeoJSON-Features (WK.daten).
    """
    geoms = gdf4326.geometry.values if hasattr(gdf4326, "geometry") else gdf4326.values
    faktor = 10 ** dezimalen
    nk, xy = [], []
    for geom in geoms:
        if geom.geom_type != "LineString":
            raise ValueError(f"Geometrie ist {geom.geom_type}, erwartet LineString")
        px, py = 0, 0
        m = 0
        for k, (x, y) in enumerate(geom.coords):
            xi, yi = int(round(x * faktor)), int(round(y * faktor))
            if k == 0:
                xy.append(xi)
                xy.append(yi)
            else:
                xy.append(xi - px)
                xy.append(yi - py)
            px, py = xi, yi
            m += 1
        nk.append(m)
    t = tabelle_kompakt(props, rundung, ganzzahl, bool_spalten, ohne=())
    t["format"] = "kanten-kompakt-1"
    t["id"] = [int(v) for v in ids]
    t["dezimalen"] = dezimalen
    t["nk"] = nk
    t["xy"] = xy
    with open(pfad, "w", encoding="utf-8", newline="\n") as f:
        f.write(_json(t))
        f.write("\n")
    return {"features": len(nk), "stuetzpunkte": int(sum(nk))}


def tabelle_schreiben(df: pd.DataFrame, pfad: Path, rundung: dict | None = None,
                      ganzzahl: set | None = None, bool_spalten: set | None = None) -> int:
    t = tabelle_kompakt(df, rundung, ganzzahl, bool_spalten)
    with open(pfad, "w", encoding="utf-8", newline="\n") as f:
        f.write(_json(t))
        f.write("\n")
    return len(df)


def spalten_json(df: pd.DataFrame, pfad: Path, rundung: dict[str, int] | None = None,
                 ganzzahl: set[str] | None = None, bool_spalten: set[str] | None = None) -> int:
    """Spaltenformat ``{"id": [...], "spalte": [...]}``; null fuer fehlende Werte.

    ``df`` muss eine Spalte ``id`` tragen; Zeilenreihenfolge = Ausgabereihenfolge.
    """
    rundung = rundung or {}
    ganzzahl = ganzzahl or set()
    bool_spalten = bool_spalten or set()
    aus: dict[str, list] = {}
    for spalte in df.columns:
        s = df[spalte]
        if spalte == "id" or spalte in ganzzahl:
            werte = [None if pd.isna(v) else int(v) for v in s.tolist()]
        elif spalte in bool_spalten:
            werte = [None if pd.isna(v) else bool(v) for v in s.tolist()]
        elif spalte in rundung:
            nd = rundung[spalte]
            werte = [None if pd.isna(v) else round(float(v), nd) for v in s.tolist()]
        elif pd.api.types.is_float_dtype(s):
            werte = [None if pd.isna(v) else float(v) for v in s.tolist()]
        elif pd.api.types.is_integer_dtype(s):
            werte = [int(v) for v in s.tolist()]
        elif pd.api.types.is_bool_dtype(s):
            werte = [bool(v) for v in s.tolist()]
        else:
            werte = [_python(v) for v in s.tolist()]
            werte = [None if w == "" else w for w in werte]
        aus[spalte] = werte
    with open(pfad, "w", encoding="utf-8", newline="\n") as f:
        f.write(_json(aus))
        f.write("\n")
    return len(df)


def json_schreiben(obj, pfad: Path, lesbar: bool = False) -> None:
    with open(pfad, "w", encoding="utf-8", newline="\n") as f:
        if lesbar:
            json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True, allow_nan=False)
        else:
            f.write(_json(obj))
        f.write("\n")


def json_lesen(pfad: Path):
    with open(pfad, "r", encoding="utf-8") as f:
        return json.load(f)


def mb(pfad: Path) -> float:
    return round(pfad.stat().st_size / 1e6, 2)
