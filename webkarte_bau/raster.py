# -*- coding: utf-8 -*-
"""Raster-Overlays (LST-P90-Komposit, heisse Tage) als eingefaerbte PNGs in EPSG:3857."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from . import quellen as Q
from . import schreiben

import rasterio                                        # noqa: E402
from rasterio.warp import calculate_default_transform, reproject, Resampling  # noqa: E402
from rasterio.windows import from_bounds               # noqa: E402
from matplotlib.colors import Normalize                # noqa: E402
from PIL import Image                                   # noqa: E402
from pyproj import Transformer                          # noqa: E402

H = Q.H


def _clip_bounds() -> tuple[float, float, float, float]:
    minx, miny, maxx, maxy = H.LK.total_bounds
    r = Q.RASTER_RAND_M
    return (minx - r, miny - r, maxx + r, maxy + r)


def overlay(src_pfad: Path, name: str, rolle: str, aufloesung_m: float, *, label: str,
            einheit: str, pct: tuple[float, float] = (2, 98), perzentile_global: bool = True,
            attribution: str = "") -> dict:
    """Schreibt ``raster/<name>_3857.png`` + ``.json`` und gibt die Kennwerte zurueck."""
    Q.ordner_anlegen()
    cmap = H.CMAP[rolle]
    with rasterio.open(src_pfad) as src:
        if src.crs.to_epsg() != Q.CRS_ARBEIT:
            raise AssertionError(f"{src_pfad.name}: CRS {src.crs}, erwartet EPSG:{Q.CRS_ARBEIT}")
        if perzentile_global:
            voll = src.read(1, masked=True)
            vmin, vmax = [float(v) for v in np.percentile(voll.compressed(), pct)]
            del voll
        b = _clip_bounds()
        win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        arr = src.read(1, window=win, masked=True)
        src_transform = src.window_transform(win)
        if not perzentile_global:
            vmin, vmax = [float(v) for v in np.percentile(arr.compressed(), pct)]
        links, unten, rechts, oben = rasterio.windows.bounds(win, src.transform)
        transform, breite, hoehe = calculate_default_transform(
            src.crs, "EPSG:3857", arr.shape[1], arr.shape[0], links, unten, rechts, oben,
            resolution=aufloesung_m)
        ziel = np.full((hoehe, breite), np.nan, dtype="float32")
        reproject(source=arr.filled(np.nan).astype("float32"), destination=ziel,
                  src_transform=src_transform, src_crs=src.crs, src_nodata=np.nan,
                  dst_transform=transform, dst_crs="EPSG:3857", dst_nodata=np.nan,
                  resampling=Resampling.bilinear)
    # 8-Bit-Paletten-PNG: 255 Farbstufen der Rolle + Index 255 = transparent (NoData)
    norm = Normalize(vmin, vmax)
    maske = np.isnan(ziel)
    t = np.clip(norm(np.where(maske, vmin, ziel)), 0.0, 1.0)
    idx = np.where(maske, 255, np.round(np.asarray(t) * 254.0)).astype("uint8")
    palette = (cmap(np.linspace(0.0, 1.0, 255))[:, :3] * 255).round().astype("uint8")
    palette = np.vstack([palette, np.array([[0, 0, 0]], dtype="uint8")])
    bild = Image.fromarray(idx, "P")
    bild.putpalette(palette.flatten().tolist())
    png = Q.RASTER / f"{name}_3857.png"
    bild.save(png, optimize=True, transparency=255)

    w, n = transform.c, transform.f
    e = w + transform.a * breite
    s = n + transform.e * hoehe
    t = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    ecken = [t.transform(x, y) for x, y in ((w, n), (e, n), (e, s), (w, s))]
    meta = {
        "name": name, "label": label, "einheit": einheit, "rolle": rolle,
        "vmin": round(vmin, 2), "vmax": round(vmax, 2), "perzentile": list(pct),
        "perzentile_bezug": "gesamtes Raster" if perzentile_global else "Ausschnitt",
        "aufloesung_m": aufloesung_m, "breite_px": int(breite), "hoehe_px": int(hoehe),
        "coordinates": [[round(x, 6), round(y, 6)] for x, y in ecken],
        "quelle": src_pfad.name, "attribution": attribution, "datei": png.name,
    }
    schreiben.json_schreiben(meta, Q.RASTER / f"{name}_3857.json", lesbar=True)
    meta["mb"] = schreiben.mb(png)
    return meta


def alle(p: dict[str, Path]) -> dict:
    aus = {}
    aus["lst_p90"] = overlay(p["lst"], "lst_p90", "heat", Q.LST_AUFLOESUNG_M,
                             label="Landoberflächentemperatur, 90. Perzentil", einheit="°C",
                             attribution=H.DATENBASIS["lst"])
    aus["hot_days"] = overlay(p["hot_days"], "hot_days", "heat", Q.HOTDAYS_AUFLOESUNG_M,
                              label="Heiße Tage pro Jahr (2016–2025)", einheit="Tage",
                              perzentile_global=False,
                              attribution="Heiße Tage (Tmax ≥ 30 °C) 2016–2025, DWD-Rasterdaten; eigene Aggregation.")
    return aus
