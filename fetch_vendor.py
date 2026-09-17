# -*- coding: utf-8 -*-
"""Laedt die JavaScript-Bibliotheken und Glyphen einmalig nach docs/vendor/.

Versionen sind gepinnt; VERSIONEN.json haelt Quelle, Groesse und SHA-256 fest.
Die Seite laeuft damit ohne CDN, auch offline und im Offline-Bundle.

    & "C:\\Users\\slidd\\miniforge3\\envs\\ox\\python.exe" webkarte\\fetch_vendor.py [--maplibre 6.10.0] [--proj4 2.22.0]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

HIER = Path(__file__).resolve().parent
VENDOR = HIER / "docs" / "vendor"
GLYPHS = VENDOR / "glyphs"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) webkarte-fetch-vendor/1.0"

FONTS = ["Open Sans Regular", "Open Sans Bold"]
RANGES = ["0-255", "256-511"]


def _laden(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _versionen(paket: str) -> list[str]:
    """Verfuegbare Versionen laut jsDelivr (nur zur Fehlersuche)."""
    try:
        daten = json.loads(_laden(f"https://data.jsdelivr.com/v1/package/npm/{paket}").decode("utf-8"))
        return daten.get("versions", [])[:15]
    except Exception:
        return []


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    # 5.x ist die letzte Reihe mit klassischem UMD-Build und eingebettetem Worker;
    # 6.x liefert nur noch ES-Module mit separatem Worker, das laeuft nicht unter file://.
    ap.add_argument("--maplibre", default="5.24.0")
    ap.add_argument("--proj4", default="2.22.0")
    ap.add_argument("--qrcode", default="1.0.0")
    ap.add_argument("--ohne-glyphen", action="store_true")
    args = ap.parse_args(argv)

    dateien = {
        "maplibre-gl.js": f"https://cdn.jsdelivr.net/npm/maplibre-gl@{args.maplibre}/dist/maplibre-gl.js",
        "maplibre-gl.css": f"https://cdn.jsdelivr.net/npm/maplibre-gl@{args.maplibre}/dist/maplibre-gl.css",
        "proj4.js": f"https://cdn.jsdelivr.net/npm/proj4@{args.proj4}/dist/proj4.js",
        "qrcode.min.js": f"https://cdn.jsdelivr.net/npm/qrcodejs@{args.qrcode}/qrcode.min.js",
    }
    if not args.ohne_glyphen:
        for font in FONTS:
            for rng in RANGES:
                dateien[f"glyphs/{font}/{rng}.pbf"] = (
                    f"https://fonts.openmaptiles.org/{font.replace(' ', '%20')}/{rng}.pbf")

    VENDOR.mkdir(parents=True, exist_ok=True)
    register = {"zeitpunkt": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "versionen": {"maplibre-gl": args.maplibre, "proj4": args.proj4, "qrcodejs": args.qrcode,
                              "glyphs": "fonts.openmaptiles.org (Open Sans, OFL)"},
                "dateien": {}}
    fehler = 0
    for rel, url in dateien.items():
        ziel = VENDOR / rel
        ziel.parent.mkdir(parents=True, exist_ok=True)
        try:
            daten = _laden(url)
        except Exception as e:  # noqa: BLE001
            fehler += 1
            print(f"FEHLER {rel}: {e}")
            paket = url.split("/npm/")[1].split("@")[0] if "/npm/" in url else None
            if paket:
                print(f"   verfuegbare Versionen {paket}: {_versionen(paket)}")
            continue
        ziel.write_bytes(daten)
        sha = hashlib.sha256(daten).hexdigest()
        register["dateien"][rel] = {"quelle": url, "bytes": len(daten), "sha256": sha}
        print(f"{rel:40s} {len(daten)/1024:8.1f} kB  {sha[:12]}  <- {url}")
    (VENDOR / "VERSIONEN.json").write_text(json.dumps(register, indent=1, ensure_ascii=False) + "\n",
                                           encoding="utf-8")
    print("VERSIONEN.json geschrieben,", "Fehler:", fehler)
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
