# -*- coding: utf-8 -*-
"""Glossar der Arbeit -> ``docs/data/glossar.json``.

Die Kurztexte der ?-Knoepfe (``kurz``) werden in ``glossar.json`` von Hand gepflegt. Fuer Begriffe mit dem
Schluessel ``glossar`` (= fett gesetzter Begriff in ``Glossar.md`` der Arbeit) liest dieses Modul den Wortlaut
der Arbeit als ``lang`` ein. Alles andere in der Datei bleibt unangetastet. Fehlt ``Glossar.md`` (anderer
Rechner), bleibt der zuletzt eingelesene Wortlaut stehen.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

GLOSSAR_MD = Path(r"C:\Obsidian\MyAwesomeLife\6_Full_Notes_Zettelkasten_Atomic_Notes\0_Masterarbeit"
                  r"\Verzeichnisse\Glossar.md")
GLOSSAR_JSON = Path(__file__).resolve().parents[1] / "docs" / "data" / "glossar.json"


def _bereinigen(text: str) -> str:
    text = re.sub(r"\s*\(\[@[^\]]+\]\)", "", text)     # pandoc-crossref-Verweise wie ([@tbl:...])
    text = re.sub(r"\s*\[@[^\]]+\]", "", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)          # Kursivsetzung
    return re.sub(r"\s+", " ", text).strip()


def lesen(pfad: Path = GLOSSAR_MD) -> dict[str, str]:
    """Begriff (fette Zeile) -> bereinigter Erklaertext (Absatz darunter)."""
    eintraege: dict[str, str] = {}
    titel, zeilen = None, []
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\*\*(.+?)\*\*\s*$", zeile.strip())
        if m:
            if titel is not None:
                eintraege[titel] = _bereinigen(" ".join(zeilen))
            titel, zeilen = m.group(1).strip(), []
        elif titel is not None:
            zeilen.append(zeile.strip())
    if titel is not None:
        eintraege[titel] = _bereinigen(" ".join(zeilen))
    return eintraege


def einlesen(pfad_md: Path = GLOSSAR_MD, pfad_json: Path = GLOSSAR_JSON) -> dict:
    """Aktualisiert ``lang`` in glossar.json; gibt eine kleine Statistik zurueck."""
    daten = json.loads(pfad_json.read_text(encoding="utf-8"))
    info = {"quelle": str(pfad_md), "vorhanden": pfad_md.exists(), "uebernommen": 0, "fehlend": [], "leer": []}
    if not pfad_md.exists():
        return info
    glossar = lesen(pfad_md)
    for key, b in daten.get("begriffe", {}).items():
        name = b.get("glossar")
        if not name:
            continue
        if name not in glossar:
            info["fehlend"].append(f"{key} -> {name}")
            continue
        if not glossar[name]:
            info["leer"].append(name)
            continue
        b["lang"] = glossar[name]
        info["uebernommen"] += 1
    info["begriffe_glossar_md"] = len(glossar)
    pfad_json.write_text(json.dumps(daten, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return info
