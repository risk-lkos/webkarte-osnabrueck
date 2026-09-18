# -*- coding: utf-8 -*-
"""meta.json: Variablenkatalog, Spaltenkatalog, Presets, Basemaps, Attribution, Pruefsummen.

Farben und Linienbreiten stehen NICHT hier, sondern in den Farbschemata
(``farbschemata/*.json``). Jede Variable traegt nur ihre Farbrolle.
"""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd

from . import quellen as Q

H = Q.H

GRUPPEN = [
    {"id": "importance", "label": "Netzbedeutung", "kurz": "Link Importance",
     "rolle": "importance",
     "text": "Link Importance = mittlerer zusätzlicher Reiseaufwand (Sekunden) je relevantem Quelle-Ziel-Paar, "
             "wenn die Kante gesperrt wird; berechnet über 129 Gemeindeknoten auf dem vereinfachten Netz. "
             "Nur 4.212 Kanten im Landkreis sind ‚aktiv' (importance_s > 0)."},
    {"id": "pluvial", "label": "Starkregen", "kurz": "pluvial", "rolle": "pluvial",
     "text": "BKG-Hinweiskarte Starkregengefahren (100 mm/h, 1-m-Raster), entlang jeder Kante abgetastet. "
             "Gefährdungsstufen H1–H6 nach Tiefe × Fließgeschwindigkeit (Smith, Davey & Cox 2014); "
             "Verschneidungsindex vi_pct = Rangprodukt aus Link-Importance- und Gefahrenperzentil."},
    {"id": "fluvial", "label": "Flusshochwasser", "kurz": "fluvial", "rolle": "fluvial",
     "text": "Hochwassergefahrenkarten HQextrem (NLWKN, HWRM-RL) für Hase, Hunte und Große Aue; "
             "Kanten in Überflutungsflächen mit repräsentativer Tiefe. Brückenfreier Index vi_pct_fluvial "
             "als Rangprodukt (n = 138)."},
    {"id": "heat", "label": "Hitze", "kurz": "heat", "rolle": "heat",
     "text": "Landoberflächentemperatur aus Landsat 8/9 (90-Perzentil-Komposit) im 30-m-Puffer je Kante; "
             "thermischer Index vi_pct_heat = heat_pct × imp_pct über die aktiven Kanten. Oberfläche und "
             "Beschattung (Copernicus HRL) als Suszeptibilitätskontext."},
    {"id": "compound", "label": "Compound", "kurz": "compound", "rolle": "compound",
     "text": "Zusammentreffen zweier Gefahren auf derselben Kante: Starkregen × Flusshochwasser "
             "(vi_pct_compound) und Starkregen × Hitze (vi_pct_compound_heat), jeweils als Rangprodukt."},
    {"id": "profil", "label": "Belastungsprofil", "kurz": "Mehrfachbelastung", "rolle": "compound",
     "text": "Zahl der Gefahren, in denen eine Kante dem obersten Dezil angehört. mhn_bf = Fassung der "
             "Abbildung (brückenfrei, fluviale Spitzengruppe aus Layer 16); multi_hazard_n = Fassung des "
             "Multi-Hazard-Profils."},
    {"id": "kontext", "label": "Kanteneigenschaften", "kurz": "Kontext", "rolle": "importance",
     "text": "Straßentyp, Baulastträger, Gemeinde und Länge aus OpenStreetMap bzw. Zuordnung."},
]

# id, gruppe, datei, label, einheit, typ, rolle, gt0 (nur > 0 wie in der Arbeit), werte (kategorial), beschreibung
VARIABLEN = [
    ("imp_pct100", "importance", "attr_importance.json", "Link Importance (Perzentilrang 0–100)", "%", "quintil", "importance", False, None,
     "Perzentilrang von importance_s über die aktiven Kanten, in Quintilen Q1–Q5 wie in Abb. 5-1."),
    ("importance_s", "importance", "kanten.json", "Link Importance (Sekunden)", "s", "kontinuierlich", "importance", True, None,
     "Mittlerer zusätzlicher Reiseaufwand je relevantem OD-Paar bei Sperrung der Kante."),
    ("imp_pct", "importance", "attr_importance.json", "Link Importance (Perzentilrang 0–1)", "", "kontinuierlich", "importance", False, None,
     "Perzentilrang 0–1 (Eingang der Rangprodukte)."),
    ("klasse", "importance", "attr_importance.json", "Importance-Klasse", "", "kategorial", "importance", False,
     ["gering", "moderat", "hoch", "sehr hoch", "kritisch"], "Klassen nach importance_s: gering < 0,1 s, moderat < 0,5 s, hoch < 2 s, sehr hoch < 10 s, kritisch ≥ 10 s."),
    ("hazard_klasse", "pluvial", "kanten.json", "Starkregen-Gefährdungsstufe", "", "kategorial", "pluvial", False,
     ["H1", "H2", "H3", "H4", "H5", "H6", "querbauwerk"], "H1–H6 nach Tiefe × Geschwindigkeit; Querbauwerke (Brücken/Tunnel) gesondert; ohne Stufe = außerhalb des Abtastgebiets."),
    ("vi_pct", "pluvial", "attr_pluvial.json", "Starkregen-Verschneidungsindex", "", "kontinuierlich", "pluvial", True, None,
     "imp_pct_pluvial × dv_pct (Rangprodukt über die pluvial betroffenen aktiven Kanten), Perzentilrang 0–1; oberstes Dezil = Spitzengruppe."),
    ("vi_roh", "pluvial", "attr_pluvial.json", "Starkregen-Rohindex", "s·m²/s", "kontinuierlich", "pluvial", True, None,
     "importance_s × dv_max (unnormiert)."),
    ("dv_max", "pluvial", "attr_pluvial.json", "max. Tiefe × Geschwindigkeit", "m²/s", "kontinuierlich", "pluvial", True, None,
     "Größte Gefahrenkennzahl entlang der Kante (Grundlage der H-Stufen)."),
    ("tiefe_max_m", "pluvial", "attr_pluvial.json", "max. Wassertiefe", "m", "kontinuierlich", "pluvial", True, None,
     "Größte abgetastete Wassertiefe der Kante."),
    ("flut_anteil", "pluvial", "attr_pluvial.json", "überfluteter Längenanteil", "", "kontinuierlich", "pluvial", True, None,
     "Anteil nasser Stützpunkte an allen bewerteten Stützpunkten."),
    ("dv_stufe", "pluvial", "attr_pluvial.json", "dv-Stufe (kritische Kanten)", "", "kategorial", "pluvial", False, None,
     "Mechanismus-Prüfung der 128 kritischen Kanten (Layer 03)."),
    ("mechanismus_klar", "pluvial", "attr_pluvial.json", "Überflutungsmechanismus", "", "kategorial", "pluvial", False, None,
     "Durchlass, Senke oder unklar (Layer 03)."),
    ("robustheit", "pluvial", "attr_pluvial.json", "Robustheit (Anzahl Top-Listen)", "", "kategorial", "pluvial", False,
     ["0", "1", "2", "3", "4"], "In wie vielen der vier Rangvarianten die Kante unter den Top 25 liegt."),
    ("h_klasse_fl", "fluvial", "attr_fluvial.json", "HQextrem-Gefahrenstufe", "", "kategorial", "fluvial", False,
     ["H2", "H3", "H4", "H5", "H6"], "Gefahrenstufe aus der repräsentativen Wassertiefe der HQextrem-Fläche."),
    ("vi_pct_fluvial", "fluvial", "attr_fluvial.json", "Fluvialer Verschneidungsindex (brückenfrei)", "", "kontinuierlich", "fluvial", True, None,
     "imp_pct_nb × haz_pct_nb, n = 138 (Layer 14/16, Endprodukt der Arbeit)."),
    ("vi_pct_fluvial_voll", "fluvial", "attr_fluvial.json", "Fluvialer Index (mit Brücken)", "", "kontinuierlich", "fluvial", True, None,
     "Zwischenstand inkl. Brücken (Layer 09, n = 197)."),
    ("vi_roh_fluvial_nb", "fluvial", "attr_fluvial.json", "Fluvialer Rohindex", "", "kontinuierlich", "fluvial", True, None,
     "importance_s × h_num_fl (unnormiert, brückenfrei)."),
    ("tiefe_repr_fl", "fluvial", "attr_fluvial.json", "repräsentative Wassertiefe HQextrem", "m", "kontinuierlich", "fluvial", True, None,
     "Repräsentative Tiefe der Gefahrenfläche, in der die Kante liegt."),
    ("ufl_m", "fluvial", "attr_fluvial.json", "überflutete Länge", "m", "kontinuierlich", "fluvial", True, None,
     "Länge des Kantenabschnitts in der HQextrem-Fläche."),
    ("vi_band", "fluvial", "attr_fluvial.json", "Perzentilband (fluvial)", "", "kategorial", "fluvial", False,
     ["0", "1", "2", "3", "4"], "0 = < P75, 1 = P75–P90, 2 = P90–P95, 3 = P95–P99, 4 = ≥ P99."),
    ("fluvial_status", "fluvial", "attr_fluvial.json", "Fluvialer Status", "", "kategorial", "fluvial", False,
     ["Tiefe HQextrem", "nur Ausdehnung"], "Tiefe aus HQextrem-Gefahrenkarte vorhanden oder nur Überschwemmungsgebiet (UESG)."),
    ("betroffen_fl", "fluvial", "attr_fluvial.json", "Betroffenheit HQextrem", "", "kategorial", "fluvial", False,
     ["1"], "Kante liegt in einer HQextrem-Tiefenfläche (Layer 09, n = 1.423)."),
    ("lst_p90_mean", "heat", "attr_heat.json", "Oberflächentemperatur (LST P90)", "°C", "kontinuierlich", "heat", False, None,
     "Mittel des 90-Perzentil-Komposits (Landsat 8/9) im Kantenpuffer, alle Kanten."),
    ("heat_pct", "heat", "attr_heat.json", "Thermische Exposition (Perzentilrang)", "", "kontinuierlich", "heat", True, None,
     "Perzentilrang von lst_p90_mean über die aktiven Kanten (Abb. 5-4)."),
    ("vi_pct_heat", "heat", "attr_heat.json", "Thermischer Verschneidungsindex", "", "kontinuierlich", "heat", True, None,
     "heat_pct × imp_pct (Rangprodukt), Abb. 5-5."),
    ("vi_pct_heat_v2", "heat", "attr_heat.json", "Thermischer Index, Variante Material", "", "kontinuierlich", "heat", True, None,
     "Robustheitsvariante mit Oberflächenklasse."),
    ("vi_pct_heat_v3", "heat", "attr_heat.json", "Thermischer Index, Variante Schatten", "", "kontinuierlich", "heat", True, None,
     "Robustheitsvariante mit Beschattung."),
    ("vi_pct_heat_v4", "heat", "attr_heat.json", "Thermischer Index, Variante kombiniert", "", "kontinuierlich", "heat", True, None,
     "Robustheitsvariante Material + Schatten."),
    ("robust_n", "heat", "attr_heat.json", "Robustheit (Anzahl Varianten Top 25)", "", "kategorial", "heat", False,
     ["0", "1", "2", "3", "4"], "In wie vielen der vier Varianten die Kante unter den Top 25 liegt (23 Kanten in allen vier)."),
    ("tcd_mean", "heat", "attr_heat.json", "Baumkronendeckung", "%", "kontinuierlich", "coverage", False, None,
     "Copernicus HRL Tree Cover Density im Kantenpuffer."),
    ("imd_mean", "heat", "attr_heat.json", "Versiegelungsgrad", "%", "kontinuierlich", "importance", False, None,
     "Copernicus HRL Imperviousness Density im Kantenpuffer."),
    ("surface_class", "heat", "attr_heat.json", "Oberflächenklasse", "", "kategorial", "heat", False,
     ["asphalt", "concrete", "pflaster", "befestigt_unspez", "ungebunden", "sonstig"], "Aus OSM surface abgeleitet."),
    ("beschattung", "heat", "attr_heat.json", "Beschattung", "", "kategorial", "coverage", False,
     ["unbeschattet", "gering", "mittel", "hoch"], "Klassen aus der Baumkronendeckung."),
    ("vi_pct_compound", "compound", "attr_compound.json", "Compound-Index Starkregen × Flusshochwasser", "", "kontinuierlich", "compound", True, None,
     "Rangprodukt aus Starkregen-Index und fluvialer Gefahr (Layer 10, n = 119)."),
    ("vi_roh_compound", "compound", "attr_compound.json", "Compound-Rohindex Starkregen × Flusshochwasser", "", "kontinuierlich", "compound", True, None, ""),
    ("vi_pct_compound_heat", "compound", "attr_compound.json", "Compound-Index Starkregen × Hitze", "", "kontinuierlich", "compound", True, None,
     "Rangprodukt aus Starkregen- und Hitzeperzentil (n = 3.454)."),
    ("stark_pct", "compound", "attr_compound.json", "Starkregen-Perzentil (Compound fluvial)", "", "kontinuierlich", "pluvial", True, None, ""),
    ("hitze_pct", "compound", "attr_compound.json", "Hitze-Perzentil (Compound Hitze)", "", "kontinuierlich", "heat", True, None, ""),
    ("mhn_bf", "profil", "attr_profil.json", "Belastungsprofil (Abbildung, brückenfrei)", "", "kategorial", "compound", False,
     ["1", "2", "3"], "Zahl der Gefahren im obersten Dezil; Fassung der Abb. 5-8 (106 Kanten ≥ 2)."),
    ("multi_hazard_n", "profil", "attr_profil.json", "Belastungsprofil (Multi-Hazard-Profil)", "", "kategorial", "compound", False,
     ["1", "2", "3"], "Fassung des Layers multi_hazard_profil (103 Kanten ≥ 2)."),
    ("highway", "kontext", "kanten.json", "Straßentyp (OSM)", "", "kategorial", "importance", False, None, "OSM-Tag highway."),
    ("baulast", "kontext", "kanten.json", "Baulastträger", "", "kategorial", "importance", False,
     ["autobahn", "bundesstrasse", "landesstrasse", "kreisstrasse", "gemeindestrasse"], "Zuordnung nach ref/highway (AP7)."),
    ("gemeinde", "kontext", "kanten.json", "Gemeinde", "", "kategorial", "importance", False, None,
     "Gemeinde, in der der Kantenmittelpunkt liegt."),
    ("length_m", "kontext", "kanten.json", "Kantenlänge", "m", "kontinuierlich", "importance", False, None, ""),
]

# Anzeige-Katalog fuer das Panel: Spalte -> (Label, Einheit, Dezimalen, Gruppe)
SPALTEN = {
    "name": ("Name", "", None, "kontext"), "ref": ("Referenz", "", None, "kontext"),
    "highway": ("Straßentyp", "", None, "kontext"), "baulast": ("Baulastträger", "", None, "kontext"),
    "gemeinde": ("Gemeinde", "", None, "kontext"), "length_m": ("Länge", "m", 0, "kontext"),
    "im_kreis": ("im Landkreis", "", None, "kontext"), "bruecke": ("Brücke", "", None, "kontext"),
    "tunnel": ("Tunnel", "", None, "kontext"), "bruecke_typ": ("Brückentyp", "", None, "kontext"),
    "u": ("OSM-Knoten u", "", None, "kontext"), "v": ("OSM-Knoten v", "", None, "kontext"),
    "aktiv": ("aktiv (importance_s > 0)", "", None, "importance"),
    "importance_s": ("Link Importance", "s", 4, "importance"), "imp_pct": ("Importance-Perzentil", "", 4, "importance"),
    "imp_pct100": ("Importance-Perzentilrang", "%", 1, "importance"), "klasse": ("Importance-Klasse", "", None, "importance"),
    "hazard_klasse": ("Gefährdungsstufe", "", None, "pluvial"), "tiefe_max_m": ("max. Wassertiefe", "m", 2, "pluvial"),
    "d_at": ("Tiefe am dv-Maximum", "m", 2, "pluvial"), "v_at": ("Geschwindigkeit am dv-Maximum", "m/s", 2, "pluvial"),
    "v_max": ("max. Fließgeschwindigkeit", "m/s", 2, "pluvial"), "dv_max": ("max. Tiefe × Geschwindigkeit", "m²/s", 3, "pluvial"),
    "flut_anteil": ("überfluteter Anteil", "", 3, "pluvial"), "loch_anteil": ("Anteil ohne Rasterwert", "", 3, "pluvial"),
    "imp_pct_pluvial": ("Importance-Perzentil (pluviale Bezugsmenge)", "", 4, "pluvial"),
    "dv_pct": ("Gefahren-Perzentil", "", 4, "pluvial"), "vi_pct": ("Starkregen-Index vi_pct", "", 4, "pluvial"),
    "vi_roh": ("Starkregen-Rohindex", "", 3, "pluvial"), "rang_pct": ("Rang (vi_pct)", "", 0, "pluvial"),
    "befund": ("Prüfbefund", "", None, "pluvial"), "dv_stufe": ("dv-Stufe", "", None, "pluvial"),
    "mechanismus_klar": ("Mechanismus", "", None, "pluvial"), "robustheit": ("Robustheit", "", 0, "pluvial"),
    "fluvial_status": ("Fluvialer Status", "", None, "fluvial"), "usg_betroffen": ("im Überschwemmungsgebiet", "", None, "fluvial"),
    "pruefbedarf": ("Prüfbedarf", "", None, "fluvial"), "querungspunkt": ("Gewässerquerung", "", None, "fluvial"),
    "gewaesser_usg": ("Gewässer (UESG)", "", None, "fluvial"), "betroffen_fl": ("in HQextrem-Fläche", "", None, "fluvial"),
    "h_klasse_fl": ("HQextrem-Stufe", "", None, "fluvial"), "h_num_fl": ("HQextrem-Stufe (numerisch)", "", 0, "fluvial"),
    "tiefe_repr_fl": ("repräsentative Tiefe", "m", 2, "fluvial"), "ufl_m": ("überflutete Länge", "m", 0, "fluvial"),
    "imp_pct_nb": ("Importance-Perzentil (fluvial)", "", 4, "fluvial"), "haz_pct_nb": ("Gefahren-Perzentil (fluvial)", "", 4, "fluvial"),
    "vi_pct_fluvial": ("Fluvialer Index (brückenfrei)", "", 4, "fluvial"), "vi_roh_fluvial_nb": ("Fluvialer Rohindex", "", 3, "fluvial"),
    "vi_band": ("Perzentilband", "", 0, "fluvial"), "vi_pct_fluvial_voll": ("Fluvialer Index (mit Brücken)", "", 4, "fluvial"),
    "lst_p90_mean": ("LST P90", "°C", 2, "heat"), "tcd_mean": ("Baumkronendeckung", "%", 1, "heat"),
    "imd_mean": ("Versiegelung", "%", 1, "heat"), "surface_class": ("Oberfläche", "", None, "heat"),
    "beschattung": ("Beschattung", "", None, "heat"), "concrete_flag": ("Beton", "", None, "heat"),
    "heat_pct": ("Thermische Exposition", "", 4, "heat"), "vi_pct_heat": ("Thermischer Index", "", 4, "heat"),
    "vi_pct_heat_v2": ("Index Variante Material", "", 4, "heat"), "vi_pct_heat_v3": ("Index Variante Schatten", "", 4, "heat"),
    "vi_pct_heat_v4": ("Index Variante kombiniert", "", 4, "heat"), "robust_n": ("Robustheit (Varianten)", "", 0, "heat"),
    "stark_pct": ("Starkregen-Perzentil", "", 4, "compound"), "vi_pct_compound": ("Compound Starkregen × Fluvial", "", 4, "compound"),
    "vi_roh_compound": ("Compound-Rohindex", "", 3, "compound"), "stark_pct_h": ("Starkregen-Perzentil (Hitze-Compound)", "", 4, "compound"),
    "hitze_pct": ("Hitze-Perzentil", "", 4, "compound"), "vi_pct_compound_heat": ("Compound Starkregen × Hitze", "", 4, "compound"),
    "vi_roh_compound_heat": ("Compound-Rohindex (Hitze)", "", 3, "compound"),
    "hoch_pluvial": ("oberstes Dezil Starkregen", "", None, "profil"), "hoch_fluvial": ("oberstes Dezil Flusshochwasser", "", None, "profil"),
    "hoch_heat": ("oberstes Dezil Hitze", "", None, "profil"), "multi_hazard_n": ("Gefahren im obersten Dezil (Profil)", "", 0, "profil"),
    "hoch_fluvial_bf": ("fluviale Spitzengruppe (brückenfrei)", "", None, "profil"), "mhn_bf": ("Gefahren im obersten Dezil (Abbildung)", "", 0, "profil"),
}

PRESETS = [
    {"id": "importance_grau", "titel": "Link Importance (Perzentilrang, Grauskala)", "variable": "imp_pct100",
     "skala": {"modus": "fest", "vmin": 0, "vmax": 100}, "legende": "colorbar",
     "legende_label": "Link Importance (Perzentilrang 0–100)", "kontext": "aktiv", "kontext_lw": "kontext_importance",
     "lw": 1.1, "impressum": "importance", "abbildung": "fluvial_link_importance", "kapitel": "5.1"},
    {"id": "importance_quintil", "titel": "Link Importance in Quintilen", "variable": "imp_pct100",
     "skala": {"modus": "quintil"}, "legende": "quintil", "kontext": "keiner",
     "impressum": "importance", "abbildung": "fluvial_link_importance_quintil", "fig": "fig:erg-importance", "kapitel": "5.1"},
    {"id": "pluvial_hstufen", "titel": "Starkregengefahr nach H-Stufe (pluvial, HQextrem-Analogon)", "variable": "hazard_klasse",
     "skala": {"modus": "kategorial"}, "legende": "kategorial", "legende_titel": "Gefährdungsstufe", "kontext": "keiner",
     "impressum": "pluvial_hst", "abbildung": "erg_pluvial_hstufen", "kapitel": "5.2"},
    {"id": "pluvial_index", "titel": "Verschneidungskarte von Link Importance und Starkregengefahr", "variable": "vi_pct",
     "skala": {"modus": "p2_p100"}, "legende": "colorbar", "legende_label": "vi_pct (Starkregen)", "kontext": "aktiv",
     "kontext_lw": "kontext", "lw": 1.6, "impressum": "pluvial_idx", "abbildung": "erg_pluvial_index", "fig": "fig:erg-pluvial-index", "kapitel": "5.2"},
    {"id": "fluvial_a", "titel": "Überflutungsfläche HQextrem nach Tiefenklassen", "variable": None, "overlay": "hqextrem",
     "overlay_variable": "h_klasse", "skala": {"modus": "kategorial"}, "legende": "kategorial", "legende_titel": "Tiefenklasse",
     "kontext": "keiner", "impressum": "fluvial", "abbildung": "fluvial_komposit", "panel": "A", "fig": "fig:erg-fluvial-komposit", "kapitel": "5.3"},
    {"id": "fluvial_b", "titel": "Betroffenheit auf dem Netz (HQextrem)", "variable": "betroffen_fl",
     "skala": {"modus": "einfarbig", "rolle": "fluvial", "t": 0.85, "nur": "true"}, "legende": "einfarbig",
     "legende_label": "Kante in HQextrem-Fläche", "kontext": "aktiv", "kontext_lw": "kontext", "lw": 1.0,
     "impressum": "fluvial", "abbildung": "fluvial_komposit", "panel": "B", "kapitel": "5.3"},
    {"id": "fluvial_c", "titel": "Brückenfreier fluvialer Verschneidungsindex", "variable": "vi_pct_fluvial",
     "skala": {"modus": "fest", "vmin": 0, "vmax": 1}, "legende": "colorbar", "legende_label": "vi_pct_fluvial",
     "kontext": "aktiv", "kontext_lw": "kontext", "lw": 1.8, "impressum": "fluvial", "abbildung": "fluvial_komposit", "panel": "C", "kapitel": "5.3"},
    {"id": "fluvial_d", "titel": "Zusammentreffen mit der Starkregen-Vulnerabilität (Compound)", "variable": "vi_pct_compound",
     "skala": {"modus": "fest", "vmin": 0, "vmax": 1}, "legende": "colorbar", "legende_label": "vi_pct_compound",
     "kontext": "aktiv", "kontext_lw": "kontext", "lw": 2.2, "impressum": "fluvial", "abbildung": "fluvial_komposit", "panel": "D", "kapitel": "5.3"},
    {"id": "gewaesser", "titel": "Abdeckung der benannten Gewässer", "variable": None, "overlay": "gewaesser",
     "overlay_variable": "cover_frac", "skala": {"modus": "fest", "vmin": 0, "vmax": 1, "rolle": "coverage"}, "legende": "colorbar",
     "legende_label": "abgedeckter Längenanteil", "kontext": "keiner", "lw": 1.8, "impressum": "gewaesser", "abbildung": "erg_gewaesser_abdeckung", "kapitel": "5.3"},
    {"id": "lst", "titel": "Landoberflächentemperatur (90. Perzentil) mit Netz", "variable": None, "raster": "lst_p90",
     "skala": {"modus": "raster"}, "legende": "colorbar", "legende_label": "LST [°C]", "kontext": "aktiv_dunkel",
     "kontext_lw": "netz_dunkel", "impressum": "lst", "abbildung": "erg_lst_komposit", "kapitel": "5.4"},
    {"id": "heat_exposition", "titel": "Thermische Exposition je Kante", "variable": "heat_pct",
     "skala": {"modus": "p2_p100"}, "legende": "colorbar", "legende_label": "heat_pct", "kontext": "aktiv", "kontext_lw": "kontext",
     "lw": 1.4, "impressum": "heat_exp", "abbildung": "erg_heat_exposition", "fig": "fig:erg-heat-exposition", "kapitel": "5.4"},
    {"id": "heat_index", "titel": "Thermischer Verschneidungsindex", "variable": "vi_pct_heat",
     "skala": {"modus": "p2_p100"}, "legende": "colorbar", "legende_label": "vi_pct_heat", "kontext": "aktiv", "kontext_lw": "kontext",
     "lw": 1.4, "impressum": "heat_idx", "abbildung": "erg_heat_index", "fig": "fig:erg-heat-index", "kapitel": "5.4"},
    {"id": "compound", "titel": "Compound-Index (Starkregen-Vulnerabilität × Flusshochwasser)", "variable": "vi_pct_compound",
     "skala": {"modus": "p2_p100"}, "legende": "colorbar", "legende_label": "vi_pct_compound", "kontext": "aktiv", "kontext_lw": "kontext",
     "lw": 2.0, "impressum": "compound", "abbildung": "erg_compound", "kapitel": "5.5"},
    {"id": "belastungsprofil", "titel": "Gefahrenübergreifendes Belastungsprofil", "variable": "mhn_bf",
     "skala": {"modus": "kategorial"}, "legende": "kategorial", "legende_format": "{k} Gefahr(en) im obersten Dezil",
     "kontext": "gesamt", "kontext_lw": "kontext", "kontext_label": "Straßennetz", "impressum": "belastung",
     "abbildung": "erg_belastungsprofil", "fig": "fig:erg-belastungsprofil", "kapitel": "5.5"},
]

BASEMAPS = [
    {"id": "topplus_grau", "label": "TopPlusOpen grau (BKG)", "typ": "raster",
     "tiles": ["https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png"],
     "tileSize": 256, "maxzoom": 18, "attribution": "Kartendarstellung: © BKG 2026, dl-de/by-2-0", "lizenz": "dl-de/by-2-0",
     "standard": True},
    {"id": "topplus", "label": "TopPlusOpen (BKG)", "typ": "raster",
     "tiles": ["https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png"],
     "tileSize": 256, "maxzoom": 18, "attribution": "Kartendarstellung: © BKG 2026, dl-de/by-2-0", "lizenz": "dl-de/by-2-0"},
    {"id": "dop20", "label": "Luftbild DOP20 (LGLN)", "typ": "raster",
     "tiles": ["https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ni_dop20&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg"],
     "tileSize": 256, "maxzoom": 20, "attribution": "Luftbild: © LGLN, dl-de/by-2-0 / CC BY 4.0", "lizenz": "CC BY 4.0",
     "hinweis": "nur Niedersachsen"},
    {"id": "sentinel2", "label": "Satellit Sentinel-2 (EOX)", "typ": "raster",
     "tiles": ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg"],
     "tileSize": 256, "maxzoom": 14, "attribution": "Sentinel-2 cloudless 2023 by EOX IT Services GmbH (contains modified Copernicus Sentinel data), CC BY-NC-SA 4.0",
     "lizenz": "CC BY-NC-SA 4.0"},
    {"id": "osm", "label": "OpenStreetMap", "typ": "raster",
     "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], "tileSize": 256, "maxzoom": 19,
     "attribution": "© OpenStreetMap-Mitwirkende, ODbL", "lizenz": "ODbL"},
    {"id": "opentopomap", "label": "OpenTopoMap", "typ": "raster",
     "tiles": ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "https://b.tile.opentopomap.org/{z}/{x}/{y}.png"],
     "tileSize": 256, "maxzoom": 17, "attribution": "© OpenStreetMap-Mitwirkende, SRTM | Kartendarstellung: © OpenTopoMap (CC-BY-SA)",
     "lizenz": "CC BY-SA 3.0"},
    {"id": "keiner", "label": "Kein Hintergrund (weiß)", "typ": "keiner", "attribution": ""},
]


def _stat(vals: np.ndarray) -> dict:
    vals = vals[np.isfinite(vals)]
    if vals.size == 0:
        return {"n_gueltig": 0}
    perz = np.percentile(vals, np.arange(0, 101))
    hist, kanten = np.histogram(vals, bins=40)
    return {
        "n_gueltig": int(vals.size),
        "min": float(vals.min()), "max": float(vals.max()),
        "mittel": float(vals.mean()), "median": float(np.median(vals)),
        "p2": float(perz[2]), "p90": float(perz[90]), "p95": float(perz[95]), "p99": float(perz[99]),
        "perzentile": [round(float(v), 6) for v in perz],
        "histogramm": {"grenzen": [round(float(v), 6) for v in kanten], "anzahl": [int(v) for v in hist]},
        "skala_default": {"modus": "p2_p100", "vmin": round(float(perz[2]), 6), "vmax": round(float(perz[100]), 6)},
    }


def variablen_katalog(basis: pd.DataFrame, tabellen: dict[str, pd.DataFrame]) -> list[dict]:
    aus = []
    for (vid, gruppe, datei, label, einheit, typ, rolle, gt0, werte, text) in VARIABLEN:
        if datei == "kanten.json":
            quelle = basis
            spalte = {"tiefe_max_m": "tiefe_max_m_y"}.get(vid, vid)
        else:
            quelle = tabellen[datei]
            spalte = vid
        s = quelle[spalte]
        eintrag = {"id": vid, "gruppe": gruppe, "datei": datei, "label": label, "einheit": einheit,
                   "typ": typ, "rolle": rolle, "gt0": bool(gt0), "beschreibung": text}
        if typ == "kategorial":
            if vid in ("mhn_bf", "multi_hazard_n"):
                s = s[s > 0]
            if vid == "hazard_klasse":
                s = s[s.astype("string") != "keine_ueberflutung"]   # wird nicht ausgespielt (nicht abgetastet)
            vc = s.dropna()
            if pd.api.types.is_bool_dtype(vc) or str(vc.dtype) == "boolean":
                # Wahrheitswerte werden als 1 ausgespielt (nur true); false = Wert fehlt
                vc = vc[vc.astype(bool)].map(lambda _: "1")
            vc = vc.astype(str)
            if vid in ("robustheit", "robust_n", "vi_band", "mhn_bf", "multi_hazard_n", "h_num_fl"):
                vc = vc.str.replace(r"\.0$", "", regex=True)
            anzahl = {k: int(v) for k, v in vc.value_counts().items()}
            if werte is None:
                werte = sorted(anzahl.keys(), key=lambda k: (-anzahl[k], k))
            eintrag["werte"] = [w for w in werte if w in anzahl] + [w for w in anzahl if w not in werte]
            eintrag["anzahl"] = anzahl
            eintrag["n_gueltig"] = int(sum(anzahl.values()))
        else:
            vals = pd.to_numeric(s, errors="coerce").to_numpy(dtype="float64")
            if gt0:
                vals = vals[vals > 0]
            eintrag.update(_stat(vals))
            if vid == "imp_pct100":
                eintrag["skala_default"] = {"modus": "quintil"}
        aus.append(eintrag)
    return aus


def bauen(basis, tabellen, p, ergebnisse, groessen, quellen, kontext_info, raster_info, stil_info,
          mhn_info: dict) -> dict:
    minx, miny, maxx, maxy = [float(v) for v in H.LK.total_bounds]
    lk4326 = H.LK.to_crs(Q.CRS_WEB).total_bounds
    import geopandas as gpd  # noqa: E402
    from shapely.geometry import box  # noqa: E402
    start = gpd.GeoSeries([box(H.XLIM[0], H.YLIM[0], H.XLIM[1], H.YLIM[1])], crs=Q.CRS_ARBEIT).to_crs(Q.CRS_WEB).total_bounds
    spalten = {k: {"label": v[0], "einheit": v[1], "dezimalen": v[2], "gruppe": v[3]} for k, v in SPALTEN.items()}
    return {
        "build": {
            "zeitpunkt": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "skript": "build_webkarte.py",
            "quellen": quellen,
            "n_kanten": int(len(basis)), "n_aktiv": int(basis["aktiv"].sum()),
            "n_im_kreis": int(basis["im_kreis"].sum()),
            "simplify_m": Q.SIMPLIFY_M, "dezimalen": Q.DEZIMALEN,
            "hqextrem_min_m2": Q.HQEXTREM_MIN_M2, "hqextrem_simplify_m": Q.HQEXTREM_SIMPLIFY_M,
            "mhn_bf": mhn_info,
            "dateien_mb": groessen,
            "kontext": kontext_info,
            "raster": raster_info,
            "stil": stil_info,
        },
        "raum": {
            "lk_bounds_25832": [round(minx), round(miny), round(maxx), round(maxy)],
            "lk_bounds_4326": [round(float(v), 6) for v in lk4326],
            "xlim": [round(float(H.XLIM[0])), round(float(H.XLIM[1]))],
            "ylim": [round(float(H.YLIM[0])), round(float(H.YLIM[1]))],
            "rand_m": H.RAND,
            "start_bounds_4326": [round(float(v), 6) for v in start],
            "nds_bounds_25832": kontext_info.get("nds_bounds_25832"),
        },
        "stil": {"standard_schema": "arbeit", "schemata": stil_info.get("schemata", ["arbeit"])},
        "gruppen": GRUPPEN,
        "variablen": variablen_katalog(basis, tabellen),
        "spalten": spalten,
        "presets": PRESETS,
        "basemaps": BASEMAPS,
        "datenbasis": dict(H.DATENBASIS),
        "autor": H.AUTOR,
        "crs_arbeit": "EPSG:25832 (UTM 32N)",
        "pruefsummen": {e["name"]: e["ist"] for e in ergebnisse},
    }
