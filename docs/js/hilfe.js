/* Hilfe-Overlay und "Ueber diese Karte" (Methodik, Quellen, Lizenzen, Build-Stand, Pruefsummen) */
WK.hilfe = (() => {
  const U = WK.util;
  const KUERZEL = [
    ['F', 'Suche fokussieren'], ['E', 'Export-Dialog'], ['C', 'Farbeditor'], ['R', 'Rangliste anstelle des Menüs öffnen / schließen'], ['M', 'Fehler oder Feedback melden'], ['A', 'Anleitung (geführte Tour) starten'], ['D', 'Detailpanel ein-/ausblenden'],
    ['L', 'Wert-Labels ein/aus'], ['P', 'gewählte Kante anpinnen (Vergleich, bis zu 10)'], ['S', 'gewählte Kante als Favorit merken'], ['0', 'Ausschnitt Landkreis'], ['1–7', 'Gruppe wählen (erste Variable)'],
    ['← →', 'vorherige / nächste Variable'], ['Esc', 'Auswahl aufheben, Dialog schließen'], ['?', 'diese Hilfe'],
  ];
  function hilfe() {
    const box = U.el('div');
    box.appendChild(U.el('div', { class: 'zeile', style: { marginBottom: '8px' } },
      U.el('button', { class: 'aktiv', onclick: () => { WK.ui.dialogSchliessen(); if (WK.tour) WK.tour.start(); } }, 'Anleitung starten (geführte Tour)'),
      U.el('button', { onclick: () => { if (WK.glossar) WK.glossar.dialog(); } }, 'Glossar öffnen'),
      U.el('button', { onclick: () => ueber() }, 'Über diese Karte'),
      U.el('button', { title: 'Die Hinweise beim ersten Anklicken einer Gruppe (passende Ebenen einblenden) wieder einschalten', onclick: () => { if (WK.tipps) WK.tipps.zuruecksetzen(); } }, 'Tipps erneut zeigen')));
    box.appendChild(U.el('p', {}, 'Klicke auf eine Kante, um ihre Kennwerte zu sehen: zuerst die Kernwerte (zwei bis drei je Gruppe), über „Erweiterte Werte" unter der Detailkarte alle berechneten Größen. Beim Überfahren erscheinen Wert und Rang der aktuellen Variablen; der Marker auf der Legende zeigt die Position in der Skala. Ziehe einen Bereich auf dem Farbbalken der Legende, um nur Kanten in diesem Wertebereich zu zeigen (Brushing). Klicke in einer Klassenlegende auf eine Klasse, um sie aus- oder einzublenden.'));
    box.appendChild(U.el('p', {}, 'Die Presets „Karten der Arbeit" stellen die Abbildungen des Ergebniskapitels nach (Variable, Skala, Kontextnetz, Linienbreiten; mit gesetztem Häkchen auch weißer Hintergrund, Landkreis-Ausschnitt und Farbschema „Arbeit"). Der Regler „Linienstärke" zeichnet alle Kanten dicker, „Top 25" je Gefahr zeigt die 25 Kanten mit den höchsten Indexwerten, die Knöpfe A, B, L, K und Gem. darunter die Top 25 innerhalb einer Baulastebene (Autobahn, Bundes-, Landes-, Kreis-, Gemeindestraße; gereiht nach dem globalen Index wie in der Arbeit). In der Übersicht markiert zusätzlich ein Punkt in Kantenfarbe jede Top-Kante, weil kurze Kanten dort kleiner als ein Pixel wären (abschaltbar im Filter, blendet beim Hineinzoomen aus). Favoriten (☆, Taste S) merken Kanten dauerhaft im Browser. „Skala: an Kartenausschnitt anpassen" spreizt die Farben auf die sichtbaren Kanten, „Gamma" spreizt niedrige oder hohe Werte. Farbschemata und der Farbeditor (C) ändern Paletten, Klassenfarben, Breiten und Kontextfarben; das Schema „Arbeit" reproduziert die Abbildungen exakt.'));
    box.appendChild(U.el('p', {}, 'Export (E): PNG/JPEG mit Hintergrundkarte und Legende, SVG der aktuellen Ansicht ohne Hintergrund oder SVG im Arbeitslayout (UTM 32N, wie die Abbildungen der Arbeit). Rangliste (R): ersetzt das Menü durch eine scrollbare, sortierbare Tabelle aller Kanten der Variable; ein Klick auf eine Zeile springt zur Kante (Pfeiltasten blättern), „⇔ Spalten" zeigt weitere Kennwerte, CSV/GeoJSON exportiert die gefilterten Kanten, „✕ Schließen" holt das Menü zurück. Die Ansicht „Dezile" zeigt die Dezilstaffelung der Variable (Wertebereich, Mittel und Kantenzahl je Dezil; ein Klick filtert auf das Dezil). In den Kantendetails sind die Abzeichen anklickbar: „Rang" öffnet die Rangliste an der Stelle der Kante, „Perzentil" und „Dezil" die Dezilstaffelung. „Straßenzug" im Panel zoomt auf alle Kanten derselben Nummer und bietet Max, Min und Median der aktuellen Variable entlang des Zugs als Sprungziele. Melden (M): Fehler, Datenauffälligkeiten, Wünsche und Feedback als vorausgefülltes Ticket im GitHub-Repository. Link: der URL-Hash enthält Variable, Skala, Filter, Auswahl und Ansicht; „Link" im Panel kopiert einen Permalink zur Kante.'));
    const t = U.el('table', {}, U.el('tr', {}, U.el('th', {}, 'Taste'), U.el('th', {}, 'Wirkung')));
    for (const [k, w] of KUERZEL) t.appendChild(U.el('tr', {}, U.el('td', {}, U.el('kbd', {}, k)), U.el('td', {}, w)));
    box.appendChild(U.el('h4', {}, 'Tastaturkürzel')); box.appendChild(t);
    WK.ui.dialog('Hilfe', box);
  }
  function ueber() {
    const m = WK.daten.meta, box = U.el('div');
    box.appendChild(U.el('p', {}, `Interaktive Karte zur Masterarbeit „Klimaresiliente Verkehrsinfrastruktur: Eine Mixed-Methods-Analyse der Resilienz und Vulnerabilität von Straßeninfrastruktur im Raum Osnabrück" (${m.autor}). Sie zeigt dieselben Kennwerte wie die Abbildungen des Ergebniskapitels, aber je Kante abrufbar: ${U.formatZahl(m.build.n_kanten, 0)} Kanten des Straßennetzes, davon ${U.formatZahl(m.build.n_aktiv, 0)} aktive (importance_s > 0) und ${U.formatZahl(m.build.n_im_kreis, 0)} im Landkreis. Alle Werte stammen unverändert aus den Ergebnisdateien der Arbeit; Rundungen betreffen nur die Anzeige.`));
    box.appendChild(U.el('h4', {}, 'Kennwerte je Gefahr'));
    for (const g of m.gruppen) box.appendChild(U.el('p', {}, U.el('strong', {}, g.label + ': '), g.text));
    box.appendChild(U.el('h4', {}, 'Datenbasis und Attribution'));
    const ul = U.el('ul');
    for (const [k, v] of Object.entries(m.datenbasis)) ul.appendChild(U.el('li', {}, U.el('code', {}, k), ': ' + v));
    box.appendChild(ul);
    box.appendChild(U.el('h4', {}, 'Hintergrundkarten'));
    const ul2 = U.el('ul');
    for (const b of m.basemaps) if (b.typ !== 'keiner') ul2.appendChild(U.el('li', {}, `${b.label}: ${b.attribution} (${b.lizenz || ''})`));
    box.appendChild(ul2);
    box.appendChild(U.el('h4', {}, 'Build-Stand'));
    box.appendChild(U.el('p', { class: 'klein' }, `Erzeugt ${m.build.zeitpunkt} durch ${m.build.skript}; Geometrie vereinfacht (${m.build.simplify_m} m), Koordinaten mit ${m.build.dezimalen} Dezimalen; HQextrem-Flächen bereinigt (Teile < ${m.build.hqextrem_min_m2} m²). Farbschema aktuell: ${WK.stil.schema.name || WK.stil.schemaId}${WK.stil.geaendert ? ' (geändert)' : ''}. Bibliotheken: MapLibre GL JS ${typeof maplibregl !== 'undefined' ? maplibregl.version : '?'}, proj4js. Web-Karte Version ${WK.config.version}.`));
    const q = U.el('table', {}, U.el('tr', {}, U.el('th', {}, 'Quelle'), U.el('th', {}, 'Datei'), U.el('th', {}, 'Stand'), U.el('th', { class: 'zahl' }, 'MB')));
    for (const s of m.build.quellen) q.appendChild(U.el('tr', {}, U.el('td', {}, s.schluessel), U.el('td', {}, U.el('code', {}, s.datei)), U.el('td', {}, s.mtime), U.el('td', { class: 'zahl' }, String(s.mb))));
    box.appendChild(q);
    box.appendChild(U.el('h4', {}, 'Prüfsummen (Build gegen Protokolle der Arbeit)'));
    const pt = U.el('table', {}, U.el('tr', {}, U.el('th', {}, 'Größe'), U.el('th', {}, 'Wert')));
    for (const [k, v] of Object.entries(m.pruefsummen)) pt.appendChild(U.el('tr', {}, U.el('td', {}, k), U.el('td', {}, typeof v === 'object' ? Object.entries(v).map(([a, b]) => `${a}: ${U.formatZahl(b, 0)}`).join(' · ') : U.formatZahl(v, 0))));
    box.appendChild(pt);
    box.appendChild(U.el('p', { class: 'klein' }, 'Diese Seite ist nicht für Suchmaschinen indexiert (noindex). Straßennetz © OpenStreetMap-Mitwirkende (ODbL).'));
    WK.ui.dialog('Über diese Karte', box, { breit: true });
  }
  return { hilfe, ueber, KUERZEL };
})();
