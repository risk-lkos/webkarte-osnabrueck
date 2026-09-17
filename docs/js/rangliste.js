/* Rangliste der aktuellen Variable (Top-N, sortierbar, Klick = Zoom) und Datenexport (CSV/GeoJSON) */
WK.rangliste = (() => {
  const U = WK.util;
  const S = { n: 25, nurAusschnitt: false, sort: null, richtung: -1 };
  const ZUSATZ = ['importance_s', 'hazard_klasse', 'vi_pct', 'vi_pct_fluvial', 'vi_pct_heat', 'mhn_bf'];

  function zeilen() {
    const K = WK.karte, v = K.variable; if (!v) return [];
    const praed = K.praedikat();
    const quelle = S.nurAusschnitt ? K.sichtbareIndizes().map(i => WK.daten.features[i]) : WK.daten.features.filter(praed);
    const m = K.meta || {};
    const arr = quelle.map(fe => ({ id: fe.id, p: fe.properties, wert: fe.properties[v] }));
    const key = S.sort || v;
    arr.sort((a, b) => {
      const x = key === v ? a.wert : a.p[key], y = key === v ? b.wert : b.p[key];
      if (x === undefined && y === undefined) return 0; if (x === undefined) return 1; if (y === undefined) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (y - x) * -S.richtung * -1;
      return String(x).localeCompare(String(y), 'de') * S.richtung * -1;
    });
    if (m.typ === 'kategorial' && !S.sort) arr.sort((a, b) => (b.p.importance_s || 0) - (a.p.importance_s || 0));
    return arr;
  }
  function oeffnen() {
    const K = WK.karte, v = K.variable;
    if (!v) { WK.ui.melden('Bitte zuerst eine Variable wählen'); return; }
    const m = K.meta || {}, sp = WK.daten.spalte(v) || {};
    const box = U.el('div');
    const nSel = U.el('select', {}, ...[25, 50, 100, 250, 1000].map(n => U.el('option', { value: n, selected: n === S.n }, `Top ${n}`)), U.el('option', { value: 0, selected: S.n === 0 }, 'alle'));
    nSel.addEventListener('change', () => { S.n = +nSel.value; tabelle(); });
    const cb = U.el('input', { type: 'checkbox', checked: S.nurAusschnitt });
    cb.addEventListener('change', () => { S.nurAusschnitt = cb.checked; tabelle(); });
    const kopf = U.el('div', { class: 'zeile' },
      U.el('strong', {}, m.label || v), nSel, U.el('label', {}, cb, ' nur Ausschnitt'),
      U.el('button', { onclick: () => csv() }, 'CSV (gefilterte Kanten)'),
      U.el('button', { onclick: () => geojson() }, 'GeoJSON (gefilterte Kanten)'),
      U.el('span', { class: 'klein', id: 'rang-info' }, ''));
    box.appendChild(kopf);
    const tabWrap = U.el('div'); box.appendChild(tabWrap);
    function tabelle() {
      const alle = zeilen(), z = S.n ? alle.slice(0, S.n) : alle;
      document.getElementById('rang-info').textContent = `${U.formatZahl(alle.length, 0)} Kanten${WK.filter && WK.filter.aktiv() ? ' (Filter aktiv)' : ''}`;
      const spalten = [['#', null], ['Kante', 'id'], ['Name / Nr.', 'name'], ['Gemeinde', 'gemeinde'], ['Typ', 'highway'], [m.label || v, v], ...ZUSATZ.filter(s => s !== v).map(s => [(WK.daten.spalte(s) || {}).label || s, s])];
      const t = U.el('table');
      const tr = U.el('tr');
      for (const [label, key] of spalten) { const th = U.el('th', { class: key && key !== 'name' && key !== 'gemeinde' && key !== 'highway' ? 'zahl' : '' }, label + (S.sort === key ? (S.richtung < 0 ? ' ▼' : ' ▲') : '')); if (key) th.addEventListener('click', () => { if (S.sort === key) S.richtung = -S.richtung; else { S.sort = key === v ? null : key; S.richtung = -1; } tabelle(); }); tr.appendChild(th); }
      t.appendChild(tr);
      z.forEach((r, i) => {
        const p = r.p, row = U.el('tr', { class: 'klick', onclick: () => { WK.karte.waehlen(r.id, { quelle: 'rangliste' }); WK.karte.fokus(r.id); } });
        row.appendChild(U.el('td', { class: 'zahl' }, String(i + 1)));
        row.appendChild(U.el('td', { class: 'zahl' }, String(r.id)));
        row.appendChild(U.el('td', {}, [p.ref, p.name].filter(Boolean).join(' · ')));
        row.appendChild(U.el('td', {}, p.gemeinde || ''));
        row.appendChild(U.el('td', {}, p.highway || ''));
        row.appendChild(U.el('td', { class: 'zahl' }, typeof r.wert === 'number' ? U.formatZahl(r.wert, sp.dezimalen === null || sp.dezimalen === undefined ? 4 : sp.dezimalen) : String(r.wert)));
        for (const s of ZUSATZ) { if (s === v) continue; const w = p[s]; const d = (WK.daten.spalte(s) || {}).dezimalen; row.appendChild(U.el('td', { class: 'zahl' }, w === undefined ? '' : (typeof w === 'number' ? U.formatZahl(w, d === null || d === undefined ? 3 : d) : String(w)))); }
        t.appendChild(row);
      });
      tabWrap.innerHTML = ''; tabWrap.appendChild(t);
    }
    tabelle();
    WK.ui.dialog('Rangliste', box, { breit: true });
  }
  function spaltenAlle() {
    const meta = WK.daten.meta, aus = ['id', 'name', 'ref', 'highway', 'baulast', 'gemeinde', 'length_m', 'aktiv', 'im_kreis', 'bruecke', 'tunnel'];
    for (const s of Object.keys(meta.spalten)) if (!aus.includes(s) && s !== 'u' && s !== 'v') aus.push(s);
    return aus;
  }
  function gefiltert() { const praed = WK.karte.praedikat(); return WK.daten.features.filter(praed); }
  function csv() {
    const fs = gefiltert(), sp = spaltenAlle();
    const z = [sp.join(';')];
    for (const fe of fs) z.push(sp.map(s => { const w = s === 'id' ? fe.id : fe.properties[s]; if (w === undefined || w === null) return ''; if (typeof w === 'number') return String(w).replace('.', ','); return '"' + String(w).replace(/"/g, '""') + '"'; }).join(';'));
    U.download(new Blob(['﻿' + z.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `webkarte_${WK.karte.variable}_${U.heuteKurz()}.csv`);
    WK.ui.melden(`${fs.length} Kanten als CSV exportiert`);
  }
  function geojson() {
    const fs = gefiltert();
    const fc = { type: 'FeatureCollection', name: `webkarte_${WK.karte.variable}`, features: fs.map(fe => ({ type: 'Feature', id: fe.id, properties: Object.assign({ id: fe.id }, fe.properties), geometry: fe.geometry })) };
    U.download(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), `webkarte_${WK.karte.variable}_${U.heuteKurz()}.geojson`);
    WK.ui.melden(`${fs.length} Kanten als GeoJSON exportiert`);
  }
  return { oeffnen, csv, geojson, zeilen };
})();
