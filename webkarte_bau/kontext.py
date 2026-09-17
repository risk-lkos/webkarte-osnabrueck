# -*- coding: utf-8 -*-
"""Kontextgeometrien: Kreisgrenze, Gemeinden, Gewaesser, HQextrem, Niedersachsen, Fallbeispiele."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from . import quellen as Q
from . import schreiben

import geopandas as gpd   # noqa: E402
import shapely            # noqa: E402
from shapely.geometry import MultiPolygon, Polygon, box  # noqa: E402

H = Q.H
L = Q.LAYER


def _web(gdf: gpd.GeoDataFrame, toleranz: float) -> gpd.GeoDataFrame:
    g = gdf.to_crs(Q.CRS_ARBEIT).copy()
    g["geometry"] = g.geometry.simplify(toleranz, preserve_topology=True)
    return g.to_crs(Q.CRS_WEB)


def _bereinigen(geom, min_m2: float):
    """Teilpolygone und Loecher unter min_m2 entfernen."""
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    neu = []
    for poly in polys:
        if poly.is_empty or poly.area < min_m2:
            continue
        ringe = [r for r in poly.interiors if Polygon(r).area >= min_m2]
        neu.append(Polygon(poly.exterior, ringe))
    if not neu:
        return None
    return MultiPolygon(neu) if len(neu) > 1 else neu[0]


def hqextrem(p: dict[str, Path]) -> tuple[gpd.GeoDataFrame, dict]:
    g = gpd.read_file(p["wasser"], layer=L["f07"]).to_crs(Q.CRS_ARBEIT)
    polygone_roh = int(len(g))
    n_roh = int(shapely.get_num_coordinates(g.geometry.values).sum())
    flaeche_roh = float(g.geometry.area.sum())
    minx, miny, maxx, maxy = H.LK.total_bounds
    rahmen = box(minx - Q.RASTER_RAND_M, miny - Q.RASTER_RAND_M, maxx + Q.RASTER_RAND_M, maxy + Q.RASTER_RAND_M)
    g["geometry"] = g.geometry.intersection(rahmen)
    g["geometry"] = g.geometry.apply(lambda geom: _bereinigen(geom, Q.HQEXTREM_MIN_M2))
    g = g[g.geometry.notna()].copy()
    g["geometry"] = g.geometry.simplify(Q.HQEXTREM_SIMPLIFY_M, preserve_topology=True)
    g["geometry"] = g.geometry.make_valid()
    flaeche_neu = float(g.geometry.area.sum())
    n_neu = int(shapely.get_num_coordinates(g.geometry.values).sum())
    info = {"polygone_roh": polygone_roh, "polygone": int(len(g)),
            "stuetzpunkte_roh": n_roh, "stuetzpunkte": n_neu,
            "flaeche_km2_roh": round(flaeche_roh / 1e6, 2), "flaeche_km2": round(flaeche_neu / 1e6, 2),
            "flaechenanteil": round(flaeche_neu / flaeche_roh, 4) if flaeche_roh else None}
    return g.to_crs(Q.CRS_WEB), info


def schreiben_alle(p: dict[str, Path], fallbeispiele: gpd.GeoDataFrame) -> dict:
    Q.ordner_anlegen()
    info: dict = {}
    K = Q.KONTEXT

    lk = _web(H.LK, Q.KONTEXT_SIMPLIFY_M)
    info["lk_grenze"] = schreiben.geojson_allgemein(lk, K / "lk_grenze.json", [])

    gem = gpd.read_file(p["gemeinden"])
    gem = _web(gem, Q.KONTEXT_SIMPLIFY_M)
    gem = gem.rename(columns={"de:amtlicher_gemeindeschluessel": "ags"})
    info["gemeinden"] = schreiben.geojson_allgemein(gem, K / "gemeinden.json",
                                                    ["name", "ags", "flaechenanteil_im_kreis"])

    gw = gpd.read_file(p["wasser"], layer=L["f13"])
    gw = _web(gw, Q.KONTEXT_SIMPLIFY_M)
    info["gewaesser"] = schreiben.geojson_allgemein(gw, K / "gewaesser.json",
                                                    ["name", "waterway", "cover_frac", "flood_abgedeckt"])

    hq, hq_info = hqextrem(p)
    info["hqextrem"] = schreiben.geojson_allgemein(hq, K / "hqextrem.json",
                                                   ["RiverName", "h_klasse", "tiefe_repr_m", "tiefe_typ"])
    info["hqextrem_info"] = hq_info

    nds = gpd.read_file(p["niedersachsen"]).to_crs(Q.CRS_ARBEIT)
    nds["geometry"] = nds.geometry.simplify(Q.NDS_SIMPLIFY_M, preserve_topology=True)
    info["niedersachsen"] = schreiben.geojson_allgemein(nds.to_crs(Q.CRS_WEB), K / "niedersachsen.json", [])
    info["niedersachsen_25832"] = schreiben.geojson_allgemein(nds, K / "niedersachsen_25832.json", [],
                                                              dezimalen=0)
    lk_utm = H.LK.copy()
    lk_utm["geometry"] = lk_utm.geometry.simplify(Q.KONTEXT_SIMPLIFY_M, preserve_topology=True)
    info["lk_grenze_25832"] = schreiben.geojson_allgemein(lk_utm, K / "lk_grenze_25832.json", [],
                                                          dezimalen=0)
    info["nds_bounds_25832"] = [round(float(v)) for v in nds.total_bounds]

    fb = _web(fallbeispiele, Q.SIMPLIFY_M)
    spalten = ["id", "gefahr", "gemeinde", "cluster", "typizitaet", "is_medoid", "ist_repraesentant",
               "auto5", "ist_extrem", "name", "ref", "highway", "gewaesser"]
    info["fallbeispiele"] = schreiben.geojson_allgemein(fb, K / "fallbeispiele.json", spalten)
    return info
