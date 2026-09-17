# -*- coding: utf-8 -*-
"""Offline-Bundle: docs/ -> dist/webkarte_offline.html (eine Datei, laeuft per Doppelklick ohne Server).

Vendor-Bibliotheken, CSS, alle JS-Module, Daten (JSON), Raster-PNGs und Glyphen werden
eingebettet. Die Seite erkennt ``window.WK_INLINE`` und liest Daten daraus statt per fetch;
Glyphen kommen ueber ein MapLibre-Protokoll ``bundle://`` aus Base64.

    & "C:\\Users\\slidd\\miniforge3\\envs\\ox\\python.exe" webkarte\\bundle_offline.py
"""

from __future__ import annotations

import base64
import json
import re
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
DOCS = HIER / "docs"
DIST = HIER / "dist"
ZIEL = DIST / "webkarte_offline.html"

SHIM = """<script>
(function () {
  if (!window.WK_INLINE || !window.maplibregl) return;
  window.WK_OFFLINE_BUNDLE = true;
  maplibregl.addProtocol('bundle', async function (params) {
    var key = decodeURIComponent(params.url.replace('bundle://', ''));
    var b64 = WK_INLINE.bin[key];
    if (!b64) throw new Error('Bundle: ' + key + ' fehlt');
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return { data: arr.buffer };
  });
  WK.config.pfade.glyphs = 'bundle://glyphs/{fontstack}/{range}.pbf';
  if (!navigator.onLine) WK.config.karte.startBasemap = 'keiner';
})();
</script>"""


def _js_sicher(text: str) -> str:
    """Inhalt fuer <script>-Einbettung: schliessende Tags entschaerfen."""
    return text.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def _json_sicher(text: str) -> str:
    return text.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def main() -> int:
    DIST.mkdir(exist_ok=True)
    html = (DOCS / "index.html").read_text(encoding="utf-8")

    # CSS inline
    def css_ersetzen(m):
        pfad = DOCS / m.group(1).lstrip("./")
        return "<style>\n" + pfad.read_text(encoding="utf-8") + "\n</style>"
    html = re.sub(r'<link rel="stylesheet" href="\./([^"]+)">', css_ersetzen, html)

    # Daten einbetten
    inline: dict[str, object] = {}
    for pfad in sorted((DOCS / "data").glob("*.json")):
        inline[f"./data/{pfad.name}"] = json.loads(pfad.read_text(encoding="utf-8"))
    for pfad in sorted((DOCS / "data" / "farbschemata").glob("*.json")):
        inline[f"./data/farbschemata/{pfad.name}"] = json.loads(pfad.read_text(encoding="utf-8"))
    for pfad in sorted((DOCS / "data" / "kontext").glob("*.json")):
        inline[f"./data/kontext/{pfad.name}"] = json.loads(pfad.read_text(encoding="utf-8"))
    for pfad in sorted((DOCS / "data" / "raster").glob("*.json")):
        inline[f"./data/raster/{pfad.name}"] = json.loads(pfad.read_text(encoding="utf-8"))
    for pfad in sorted((DOCS / "data" / "raster").glob("*.png")):
        name = pfad.name.replace("_3857.png", "")
        inline[f"raster/{name}"] = "data:image/png;base64," + base64.b64encode(pfad.read_bytes()).decode("ascii")
    bin_: dict[str, str] = {}
    for pfad in sorted((DOCS / "vendor" / "glyphs").rglob("*.pbf")):
        rel = pfad.relative_to(DOCS / "vendor").as_posix()   # glyphs/Open Sans Regular/0-255.pbf
        bin_[rel] = base64.b64encode(pfad.read_bytes()).decode("ascii")
    inline["bin"] = bin_
    daten_js = "<script>window.WK_INLINE = " + _json_sicher(json.dumps(inline, ensure_ascii=False, separators=(",", ":"))) + ";</script>"

    # Skripte inline; Shim nach config.js
    def js_ersetzen(m):
        rel = m.group(1)
        pfad = DOCS / rel.lstrip("./")
        inhalt = _js_sicher(pfad.read_text(encoding="utf-8"))
        aus = f"<script>\n{inhalt}\n</script>"
        if rel.endswith("js/config.js"):
            aus += "\n" + SHIM
        return aus
    html = re.sub(r'<script src="(\./[^"]+)"></script>', js_ersetzen, html)
    # Daten vor dem ersten Skript einfuegen
    html = html.replace("<script>", daten_js + "\n<script>", 1)
    html = html.replace("<title>", "<title>[offline] ", 1)
    ZIEL.write_text(html, encoding="utf-8")
    print(f"geschrieben: {ZIEL} ({ZIEL.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
