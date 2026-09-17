# -*- coding: utf-8 -*-
"""Pruefsummen gegen die Protokolle der Arbeit. Abweichungen brechen den Build ab."""

from __future__ import annotations

import pandas as pd

from . import quellen as Q

B = Q.B

ERWARTET = {
    "n_kanten": 72238,
    "n_aktiv": 4212,
    "hazard_klasse": {"H1": 22077, "H2": 3167, "H3": 925, "H4": 1555, "H5": 5665, "H6": 1093,
                      "keine_ueberflutung": 36996, "querbauwerk": 760},
    "klasse": {"inaktiv": 68014, "gering": 2195, "moderat": 1068, "hoch": 662, "sehr hoch": 285,
               "kritisch": 14},
    "n_vi_pct": 3455,
    "n_heat_pct": 4211,
    "n_vi_pct_heat": 4211,
    "multi_hazard_n": {0: 71556, 1: 578, 2: 103, 3: 1},
    "mhn_bf_ge2": 106,
    "mhn_bf_eq3": 1,
    "n_f12": 1819,
    "fluvial_status": {"Tiefe HQextrem": 1423, "nur Ausdehnung": 396},
    "n_f14": 1261,
    "n_vi_pct_fluvial": 138,
    "n_vi_pct_fluvial_voll": 197,
    "n_vi_pct_compound": 119,
    "n_compound_heat": 3454,
    "n_robust_4": 23,
    "n_bruecke": 743,
    "n_tunnel": 18,
    "n_querbauwerk": 760,
    "baulast": {"autobahn": 1624, "bundesstrasse": 6603, "landesstrasse": 17943,
                "kreisstrasse": 5684, "gemeindestrasse": 40384},
    "n_im_kreis": 26031,
    "n_gemeinden": 34,
    "n_gewaesser": 28,
    "n_hqextrem": 18,
}


def _vc(s: pd.Series) -> dict:
    return {k: int(v) for k, v in s.value_counts(dropna=True).items()}


def pruefen(basis, teile: dict, kontext_info: dict | None = None) -> list[dict]:
    """Liefert [{name, ist, soll, ok}] und wirft bei Abweichungen."""
    ist = {
        "n_kanten": int(len(basis)),
        "n_aktiv": int(basis["aktiv"].sum()),
        "hazard_klasse": _vc(basis["hazard_klasse"]),
        "klasse": _vc(basis["klasse"]),
        "n_vi_pct": int((basis["vi_pct"] > 0).sum()),
        "n_heat_pct": int(basis["heat_pct"].notna().sum()),
        "n_vi_pct_heat": int(basis["vi_pct_heat"].notna().sum()),
        "multi_hazard_n": {int(k): v for k, v in _vc(basis["multi_hazard_n"]).items()},
        "mhn_bf_ge2": int((basis["mhn_bf"] >= 2).sum()),
        "mhn_bf_eq3": int((basis["mhn_bf"] == 3).sum()),
        "n_f12": int(len(teile["f12"])),
        "fluvial_status": _vc(basis["fluvial_status"]),
        "n_f14": int(len(teile["f14"])),
        "n_vi_pct_fluvial": int((basis["vi_pct_fluvial"] > 0).sum()),
        "n_vi_pct_fluvial_voll": int(basis["vi_pct_fluvial_voll"].notna().sum()),
        "n_vi_pct_compound": int((basis["vi_pct_compound"] > 0).sum()),
        "n_compound_heat": int(basis["vi_pct_compound_heat"].notna().sum()),
        "n_robust_4": int((basis["robust_n"] == 4).sum()),
        "n_bruecke": int(basis["ist_bruecke"].fillna(False).sum()),
        "n_tunnel": int(basis["ist_tunnel"].fillna(False).sum()),
        "n_querbauwerk": int(basis["querbauwerk"].fillna(False).sum()),
        "baulast": _vc(basis["baulast"]),
        "n_im_kreis": int(basis["im_kreis"].sum()),
        "n_gemeinden": int(len(teile["gemeinden"])),
    }
    if kontext_info:
        ist["n_gewaesser"] = int(kontext_info.get("gewaesser", 0))
        # Rohlayer hat 18 Polygone; im Web-Ausschnitt (Landkreis +- 5 km) bleiben weniger
        ist["n_hqextrem"] = int(kontext_info.get("hqextrem_info", {}).get("polygone_roh", 0))
    ergebnisse, fehler = [], []
    for name, soll in ERWARTET.items():
        if name not in ist:
            continue
        wert = ist[name]
        ok = wert == soll
        ergebnisse.append({"name": name, "ist": wert, "soll": soll, "ok": ok})
        if not ok:
            fehler.append(f"{name}: ist {wert}, soll {soll}")
    if fehler:
        raise AssertionError("Pruefsummen weichen ab:\n  " + "\n  ".join(fehler))
    return ergebnisse


def tabelle(ergebnisse: list[dict]) -> str:
    zeilen = []
    for e in ergebnisse:
        if isinstance(e["soll"], dict):
            for k in e["soll"]:
                zeilen.append((f"{e['name']} = {k}", e["ist"].get(k, 0), e["soll"][k],
                               "ok" if e["ist"].get(k, 0) == e["soll"][k] else "ABWEICHUNG"))
        else:
            zeilen.append((e["name"], e["ist"], e["soll"], "ok" if e["ok"] else "ABWEICHUNG"))
    return B.tabelle(["Groesse", "Ist", "Soll", "Status"], zeilen)
