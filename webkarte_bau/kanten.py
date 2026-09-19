# -*- coding: utf-8 -*-
"""Kantennetz: Laden, Schluessel, Joins, Ableitungen und Ausgabetabellen.

Basis ist ``vi_heat`` (72.238 Kanten, Schluessel ``key`` = u|v|osmid). Layer
ohne ``key`` (04, 03, pluvial_shortlist) erhalten ihn wie in
``AP7_heat_verschneidung_v4.ipynb`` aus u, v und osmid. ``edge_id`` aus
Layer 04 wird die Feature-id der Web-Karte.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from . import quellen as Q

import geopandas as gpd   # noqa: E402  (nach quellen)
import pyogrio            # noqa: E402

H = Q.H
L = Q.LAYER

SPALTEN_04 = ["u", "v", "osmid", "edge_id", "length_m", "klasse", "tiefe_max_m_y", "d_at", "v_at",
              "v_max", "dv_max", "hazard_klasse", "flut_anteil", "loch_anteil", "ist_bruecke",
              "ist_tunnel", "querbauwerk", "bruecke_typ", "vi_roh", "imp_pct", "dv_pct",
              "vi_pct", "rang_pct"]
SPALTEN_12 = ["key", "betroffen_fl", "h_num_fl", "h_klasse_fl", "ufl_m", "tiefe_repr_fl",
              "querungspunkt", "usg_betroffen", "gewaesser_usg", "fluvial_status", "pruefbedarf"]
SPALTEN_14 = ["key", "imp_pct_nb", "haz_pct_nb", "vi_pct_fluvial", "vi_roh_fluvial_nb"]
SPALTEN_16 = ["key", "vi_pct_fluvial", "vi_band"]
SPALTEN_09 = ["key", "vi_pct_fluvial_voll"]
SPALTEN_10 = ["key", "stark_pct", "vi_pct_compound", "vi_roh_compound"]
SPALTEN_CH = ["key", "stark_pct", "hitze_pct", "vi_pct_compound_heat", "vi_roh_compound_heat"]
# Layer 03 (manuelle Pruefschicht der 128 kritischen Kanten) und die Spalte befund aus Layer 04 sind kein Ergebnis
# der Arbeit und werden nicht in die Karte uebernommen.
SPALTEN_PROFIL = ["key", "hoch_pluvial", "hoch_fluvial", "hoch_heat", "multi_hazard_n"]

FALLBEISPIELE = (("pluvial", "pluvial_shortlist"), ("fluvial", "fluvial_shortlist"),
                 ("heat", "heat_shortlist"))


def _tabelle(pfad: Path, layer: str, spalten: list[str] | None = None) -> pd.DataFrame:
    return pyogrio.read_dataframe(pfad, layer=layer, columns=spalten, read_geometry=False)


def schluessel(df: pd.DataFrame, osmid_spalte: str = "osmid") -> pd.Series:
    """u|v|osmid wie im Hitze-Notebook (osmid zeichenidentisch zu osmid_str)."""
    for s in ("u", "v", osmid_spalte):
        if df[s].isna().any():
            raise AssertionError(f"Schluesselspalte {s} enthaelt Nullwerte")
    return (df["u"].astype("int64").astype(str) + "|" + df["v"].astype("int64").astype(str)
            + "|" + df[osmid_spalte].astype(str))


def _bool(s: pd.Series) -> pd.Series:
    """bool/int/NA -> nullable boolean."""
    if pd.api.types.is_bool_dtype(s):
        return s.astype("boolean")
    return s.map(lambda v: pd.NA if pd.isna(v) else bool(int(v))).astype("boolean")


def laden(p: dict[str, Path]) -> tuple[gpd.GeoDataFrame, dict]:
    """Basisnetz mit allen Attributen; ``teile`` haelt die Nebentabellen fuer Pruefungen."""
    teile: dict = {}

    vh = gpd.read_file(p["vi_heat"], layer=L["vi_heat"])
    if vh.crs is None or vh.crs.to_epsg() != Q.CRS_ARBEIT:
        raise AssertionError(f"vi_heat liegt nicht in EPSG:{Q.CRS_ARBEIT}: {vh.crs}")
    if vh["key"].duplicated().any():
        raise AssertionError("key in vi_heat nicht eindeutig")
    key_kontrolle = schluessel(vh, "osmid_str")
    if not (key_kontrolle == vh["key"]).all():
        raise AssertionError("key in vi_heat entspricht nicht u|v|osmid_str")
    teile["n_basis"] = len(vh)

    h04 = _tabelle(p["wasser"], L["h04"], SPALTEN_04)
    h04["key"] = schluessel(h04)
    if h04["key"].duplicated().any() or h04["edge_id"].duplicated().any():
        raise AssertionError("Layer 04: key oder edge_id nicht eindeutig")
    if set(h04["key"]) != set(vh["key"]):
        raise AssertionError("Schluesselmengen von Layer 04 und vi_heat unterscheiden sich")
    # Spalten, die beide Layer tragen: identische entfallen (vi_heat gewinnt), abweichende
    # bleiben unter eigenem Namen. imp_pct ist in 04 ueber die pluviale Teilmenge gerangt
    # (Eingang von vi_pct), in vi_heat ueber alle aktiven Kanten (Eingang von vi_pct_heat).
    doppelt = [c for c in h04.columns if c in vh.columns and c not in ("key", "u", "v", "osmid")]
    a_idx = vh.set_index("key")
    b_idx = h04.set_index("key")
    wegfall, umbenennen = [], {}
    for c in doppelt:
        a = a_idx[c]
        b = b_idx[c].reindex(a.index)
        beide = a.notna() & b.notna()
        muster_gleich = bool((a.notna() == b.notna()).all())
        if pd.api.types.is_numeric_dtype(a) and pd.api.types.is_numeric_dtype(b):
            gleich = muster_gleich and bool(np.allclose(a[beide].astype(float), b[beide].astype(float), atol=1e-9))
        else:
            gleich = muster_gleich and bool((a[beide].astype(str) == b[beide].astype(str)).all())
        if gleich:
            wegfall.append(c)
        else:
            umbenennen[c] = "imp_pct_pluvial" if c == "imp_pct" else f"{c}_04"
    teile["doppelte_spalten_04"] = {"gleich": wegfall, "umbenannt": umbenennen}
    basis = vh.merge(h04.drop(columns=["u", "v", "osmid"] + wegfall).rename(columns=umbenennen),
                     on="key", how="left", validate="1:1")
    basis["edge_id"] = basis["edge_id"].astype("int64")
    teile["h04"] = h04

    mh = _tabelle(p["vi_heat"], L["profil"], SPALTEN_PROFIL)
    basis = basis.merge(mh, on="key", how="left", validate="1:1")
    for s in ("hoch_pluvial", "hoch_fluvial", "hoch_heat"):
        basis[s] = _bool(basis[s])
    basis["multi_hazard_n"] = basis["multi_hazard_n"].astype("int64")
    teile["profil"] = mh

    def _anhaengen(name: str, df: pd.DataFrame, umbenennen: dict | None = None) -> None:
        nonlocal basis
        if umbenennen:
            df = df.rename(columns=umbenennen)
        if df["key"].duplicated().any():
            raise AssertionError(f"{name}: key nicht eindeutig")
        treffer = int(basis["key"].isin(df["key"]).sum())
        if treffer != len(df):
            raise AssertionError(f"{name}: {treffer} von {len(df)} Schluesseln gefunden")
        doppelt = [c for c in df.columns if c != "key" and c in basis.columns]
        if doppelt:
            raise AssertionError(f"{name}: Spalten bereits vorhanden: {doppelt}")
        basis = basis.merge(df, on="key", how="left", validate="1:1")
        teile[name] = df

    _anhaengen("f12", _tabelle(p["wasser"], L["f12"], SPALTEN_12))
    _anhaengen("f14", _tabelle(p["wasser"], L["f14"], SPALTEN_14))
    f16 = _tabelle(p["wasser"], L["f16"], SPALTEN_16)
    teile["f16"] = f16
    _anhaengen("f16_band", f16[["key", "vi_band"]])
    _anhaengen("f09", _tabelle(p["wasser"], L["f09"], SPALTEN_09))
    _anhaengen("f10", _tabelle(p["wasser"], L["f10"], SPALTEN_10))

    ch_layer = pyogrio.list_layers(p["compound_heat"])[0][0]
    _anhaengen("compound_heat", _tabelle(p["compound_heat"], ch_layer, SPALTEN_CH),
               {"stark_pct": "stark_pct_h"})

    bl_teile = []
    for layer, _ in pyogrio.list_layers(p["baulast"]):
        df = _tabelle(p["baulast"], layer, ["key"])
        df["baulast"] = layer.replace("baulast_", "")
        bl_teile.append(df)
    bl = pd.concat(bl_teile, ignore_index=True)
    teile["baulast_anzahl"] = bl["baulast"].value_counts().to_dict()
    _anhaengen("baulast", bl)

    for s in ("betroffen_fl", "querungspunkt", "usg_betroffen", "pruefbedarf", "ist_bruecke",
              "ist_tunnel", "querbauwerk", "bridge_flag", "concrete_flag"):
        basis[s] = _bool(basis[s])

    basis = basis.sort_values("edge_id").reset_index(drop=True)
    if len(basis) != teile["n_basis"]:
        raise AssertionError("Zeilenzahl nach den Joins veraendert")
    return basis, teile


def fallbeispiele_laden(p: dict[str, Path], basis: pd.DataFrame) -> gpd.GeoDataFrame:
    """Shortlists der drei Gefahren mit Verweis auf die Feature-id."""
    key2id = dict(zip(basis["key"], basis["edge_id"]))
    teile = []
    for gefahr, layer in FALLBEISPIELE:
        g = gpd.read_file(p["fallbeispiele"], layer=layer).to_crs(Q.CRS_ARBEIT)
        if "key" not in g.columns:
            g["key"] = schluessel(g)
        g["gefahr"] = gefahr
        g["id"] = g["key"].map(key2id)
        if g["id"].isna().any():
            raise AssertionError(f"Fallbeispiele {layer}: Schluessel nicht im Netz gefunden")
        teile.append(g)
    fb = pd.concat(teile, ignore_index=True)
    fb["id"] = fb["id"].astype("int64")
    for s in ("is_medoid", "ist_repraesentant", "auto5", "ist_extrem", "im_band"):
        if s in fb.columns:
            fb[s] = _bool(fb[s])
    return gpd.GeoDataFrame(fb, geometry="geometry", crs=Q.CRS_ARBEIT)


def ableiten(basis: gpd.GeoDataFrame, teile: dict, p: dict[str, Path]) -> gpd.GeoDataFrame:
    """aktiv, imp_pct100, mhn_bf, Gemeinde, im_kreis."""
    basis["aktiv"] = basis["importance_s"] > 0
    basis["imp_pct100"] = np.nan
    aktiv = basis["aktiv"]
    basis.loc[aktiv, "imp_pct100"] = basis.loc[aktiv, "importance_s"].rank(pct=True) * 100.0

    # Belastungsprofil, brueckenfreie Fassung wie abbildung_ergebniskarten.ipynb (P29)
    f16 = teile["f16"]
    sub = f16[f16["vi_pct_fluvial"] > 0]
    k = max(1, round(len(sub) * Q.MHN_BF_ANTEIL))
    fluv_keys = set(sub.nlargest(k, "vi_pct_fluvial")["key"])
    basis["hoch_fluvial_bf"] = basis["key"].isin(fluv_keys)
    basis["mhn_bf"] = (basis["hoch_pluvial"].astype(int) + basis["hoch_heat"].astype(int)
                       + basis["hoch_fluvial_bf"].astype(int))
    teile["mhn_bf_k"] = int(k)
    teile["mhn_bf_n_basis"] = int(len(sub))

    # Gemeinde und Kreis: Kantenmittelpunkt within (Kriterium E01/E05)
    mitte = basis.geometry.interpolate(0.5, normalized=True)
    pts = gpd.GeoDataFrame({"zeile": np.arange(len(basis))}, geometry=mitte, crs=Q.CRS_ARBEIT)
    gem = gpd.read_file(p["gemeinden"]).to_crs(Q.CRS_ARBEIT)[["name", "geometry"]]
    if gem["name"].duplicated().any():
        raise AssertionError("Gemeindenamen nicht eindeutig")
    j = gpd.sjoin(pts, gem, how="left", predicate="within")
    j = j[~j.index.duplicated(keep="first")]
    basis["gemeinde"] = j["name"].reindex(pts.index).values
    lk = H.LK.geometry.union_all()
    basis["im_kreis"] = pts.geometry.within(lk).values
    teile["gemeinden"] = gem
    return basis


# ---------------------------------------------------------------------------
# Ausgabetabellen
# ---------------------------------------------------------------------------
RUNDUNG = {
    "importance_s": 4, "imp_pct": 6, "imp_pct100": 4,
    "tiefe_max_m": 3, "d_at": 3, "v_at": 3, "v_max": 3, "dv_max": 3, "flut_anteil": 3,
    "loch_anteil": 3, "imp_pct_pluvial": 6, "dv_pct": 6, "vi_pct": 6, "vi_roh": 4,
    "tiefe_repr_fl": 2, "ufl_m": 1, "imp_pct_nb": 6, "haz_pct_nb": 6, "vi_pct_fluvial": 6,
    "vi_roh_fluvial_nb": 4, "vi_pct_fluvial_voll": 6,
    "lst_p90_mean": 2, "tcd_mean": 1, "imd_mean": 1, "heat_pct": 6, "vi_pct_heat": 6,
    "vi_pct_heat_v2": 6, "vi_pct_heat_v3": 6, "vi_pct_heat_v4": 6,
    "stark_pct": 6, "vi_pct_compound": 6, "vi_roh_compound": 4, "stark_pct_h": 6,
    "hitze_pct": 6, "vi_pct_compound_heat": 6, "vi_roh_compound_heat": 4,
}
GANZZAHL = {"rang_pct", "h_num_fl", "vi_band", "robust_n", "multi_hazard_n",
            "mhn_bf", "length_m"}
BOOL = {"usg_betroffen", "pruefbedarf", "querungspunkt", "betroffen_fl", "concrete_flag",
        "hoch_pluvial", "hoch_fluvial", "hoch_heat", "hoch_fluvial_bf", "aktiv", "im_kreis",
        "bruecke", "tunnel"}

TABELLEN = {
    "attr_importance.json": ["imp_pct", "imp_pct100", "klasse"],
    "attr_pluvial.json": ["tiefe_max_m", "d_at", "v_at", "v_max", "dv_max", "flut_anteil",
                          "loch_anteil", "imp_pct_pluvial", "dv_pct", "vi_pct", "vi_roh", "rang_pct",
                          "bruecke_typ"],
    "attr_fluvial.json": ["fluvial_status", "usg_betroffen", "pruefbedarf", "querungspunkt",
                          "gewaesser_usg", "betroffen_fl", "h_klasse_fl", "h_num_fl",
                          "tiefe_repr_fl", "ufl_m", "imp_pct_nb", "haz_pct_nb", "vi_pct_fluvial",
                          "vi_roh_fluvial_nb", "vi_band", "vi_pct_fluvial_voll"],
    "attr_heat.json": ["lst_p90_mean", "tcd_mean", "imd_mean", "surface_class", "beschattung",
                       "concrete_flag", "heat_pct", "vi_pct_heat", "vi_pct_heat_v2",
                       "vi_pct_heat_v3", "vi_pct_heat_v4", "robust_n"],
    "attr_compound.json": ["stark_pct", "vi_pct_compound", "vi_roh_compound", "stark_pct_h",
                           "hitze_pct", "vi_pct_compound_heat", "vi_roh_compound_heat"],
    "attr_profil.json": ["hoch_pluvial", "hoch_fluvial", "hoch_heat", "multi_hazard_n",
                         "hoch_fluvial_bf", "mhn_bf"],
}


def _leer(s: pd.Series) -> pd.Series:
    """True, wo ein Wert als 'nicht vorhanden' gilt (NA, leerer String, 'keine')."""
    leer = s.isna()
    if s.dtype == object or pd.api.types.is_string_dtype(s):
        leer = leer | (s.astype("string").fillna("") == "")
    return leer


def tabellen(basis: gpd.GeoDataFrame) -> dict[str, pd.DataFrame]:
    """Spaltentabellen je Gruppe; Zeilenmenge je Tabelle fachlich festgelegt."""
    df = basis.copy()
    df["tiefe_max_m"] = df["tiefe_max_m_y"]
    df.loc[~df["aktiv"], "imp_pct"] = np.nan
    df.loc[~df["aktiv"], "klasse"] = pd.NA
    # robust_n nur, wo ein Hitze-Index existiert (sonst 0 = kein Wert)
    df.loc[df["vi_pct_heat"].isna(), "robust_n"] = np.nan
    hk = df["hazard_klasse"].astype("string").fillna("")
    zeilen = {
        "attr_importance.json": df["aktiv"],
        "attr_pluvial.json": (hk != "") & (hk != "keine_ueberflutung"),
        "attr_fluvial.json": df["fluvial_status"].notna() | df["betroffen_fl"].notna(),
        "attr_heat.json": df["lst_p90_mean"].notna(),
        "attr_compound.json": df["vi_pct_compound"].notna() | df["vi_pct_compound_heat"].notna(),
        "attr_profil.json": (df["multi_hazard_n"] >= 1) | (df["mhn_bf"] >= 1),
    }
    aus = {}
    for datei, spalten in TABELLEN.items():
        t = df.loc[zeilen[datei], ["edge_id"] + spalten].rename(columns={"edge_id": "id"})
        aus[datei] = t.reset_index(drop=True)
    return aus


KANTEN_SPALTEN = ["highway", "ref", "name", "baulast", "gemeinde", "length_m", "aktiv",
                  "importance_s", "im_kreis", "hazard_klasse", "bruecke", "tunnel"]


def kanten_props(basis: gpd.GeoDataFrame) -> pd.DataFrame:
    """Basisattribute je Feature als Tabelle (fehlend = NA)."""
    df = pd.DataFrame({
        "highway": basis["highway"].astype("string"),
        "ref": basis["ref"].astype("string").replace("", pd.NA),
        "name": basis["name"].astype("string").replace("", pd.NA),
        "baulast": basis["baulast"].astype("string"),
        "gemeinde": basis["gemeinde"].astype("string"),
        "length_m": basis["length_m"].round().astype("Int64"),
        "aktiv": basis["aktiv"].astype("boolean"),
        "importance_s": basis["importance_s"].where(basis["aktiv"], np.nan),
        "im_kreis": basis["im_kreis"].astype("boolean"),
        "hazard_klasse": basis["hazard_klasse"].astype("string").replace("keine_ueberflutung", pd.NA),
        "bruecke": (basis["ist_bruecke"].fillna(False) | basis["bridge_flag"].fillna(False)).astype("boolean"),
        "tunnel": basis["ist_tunnel"].fillna(False).astype("boolean"),
    })
    return df[KANTEN_SPALTEN]


def geometrie_web(basis: gpd.GeoDataFrame) -> gpd.GeoSeries:
    """simplify in UTM, dann WGS84."""
    g = basis.geometry.simplify(Q.SIMPLIFY_M, preserve_topology=True)
    return g.to_crs(Q.CRS_WEB)
