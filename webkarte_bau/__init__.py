# -*- coding: utf-8 -*-
"""Build-Paket der Web-Karte.

Die Module lesen ausschliesslich die Ergebnisdateien der Arbeitspakete und
schreiben nach ``webkarte/docs/data``. Einstieg ist ``build_webkarte.py``
im Ordner darueber. Reihenfolge der Importe beachten: ``quellen`` zuerst,
weil es e_basis/abb_helfer laedt und damit GDAL_DATA, PROJ_LIB und den
DLL-Suchpfad setzt, bevor geopandas oder rasterio importiert werden.
"""
