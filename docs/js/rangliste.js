/* Rangliste der aktuellen Variable als Attributtabelle in der Seitenleiste (ersetzt das Menue, solange sie offen ist):
   scrollbar, sortierbar, Klick = Kante waehlen und hinspringen; Datenexport (CSV/GeoJSON) */
WK.rangliste = (() => {
  const U = WK.util;
  const S = { offen: false, n: 0, nurAusschnitt: false, sort: null, richtung: -1, breit: false, el: null, ui: {},
              zeilen: [], index: new Map(), gerendert: 0, tr: new Map(), gewaehlt: null, seiteWarZu: false };
  const BLOCK = 200;          // Zeilen je Nachladeschritt beim Scrollen
  const AUTO_MAX = 4000;      // bis zu dieser Position wird zur gewaehlten Kante nachgeladen und gescrollt
  const ZUSATZ = ['importance_s', 'hazard_klasse', 'vi_pct', 'vi_pct_fluvial', 'vi_pct_heat', 'mhn_bf'];
  const EBENE_KURZ = { autobahn: 'A', bundesstrasse: 'B', landesstrasse: 'L', kreisstrasse: 'K', gemeindestrasse: 'Gem.' };

  function nameVon(p) { return [p.ref, p.name].filter(Boolean).join(' · '); }
  function spalten() {
    const K = WK.karte, v = K.variable, m = K.meta || {};
    const zahl = s => { const d = (WK.daten.spalte(s) || {}).dezimalen; return w => (w === undefined || w === null ? '' : typeof w === 'number' ? U.formatZahl(w, d === null || d === undefined ? 3 : d) : String(w)); };
    const basis = [
      { key: '#', label: '#', zahl: true, wert: r => r.rang, text: r => String(r.rang), titel: 'Rang nach dem Wert der Variable innerhalb der gelisteten Kanten' },
      { key: 'name', label: 'Name / Nr.', wert: r => nameVon(r.p) || undefined, text: r => nameVon(r.p) || '(ohne Namen)', klasse: 'name' },
      { key: 'gemeinde', label: 'Gemeinde', wert: r => r.p.gemeinde, text: r => r.p.gemeinde || '', klasse: 'name' },
      { key: v, label: m.label || v, zahl: m.typ !== 'kategorial', wert: r => r.wert, text: r => zahl(v)(r.wert), farbe: true },
    ];
    if (!S.breit) return basis;
    return basis.concat([
      { key: 'id', label: 'Kante', zahl: true, wert: r => r.id, text: r => String(r.id) },
      { key: 'baulast', label: 'Ebene', wert: r => r.p.baulast, text: r => EBENE_KURZ[r.p.baulast] || r.p.baulast || '' },
      { key: 'highway', label: 'Typ', wert: r => r.p.highway, text: r => r.p.highway || '' },
      { key: 'length_m', label: 'Länge (m)', zahl: true, wert: r => r.p.length_m, text: r => (r.p.length_m === undefined ? '' : U.formatZahl(r.p.length_m, 0)) },
      ...ZUSATZ.filter(s => s !== v).map(s => ({ key: s, label: (WK.daten.spalte(s) || {}).label || s, zahl: true, wert: r => r.p[s], text: r => zahl(s)(r.p[s]) })),
    ]);
  }

  // gelistete Kanten: gueltiger Wert der Variable + aktive Filter, optional nur der Kartenausschnitt
  function zeilen() {
    const K = WK.karte, v = K.variable; if (!v) return [];
    const m = K.meta || {};
    const quelle = S.nurAusschnitt ? K.sichtbareIndizes().map(i => WK.daten.features[i]) : WK.daten.features.filter(K.praedikat());
    const arr = quelle.map(fe => ({ id: fe.id, p: fe.properties, wert: fe.properties[v] }));
    // Rang nach Wert (kategorial: nach Link Importance), unabhaengig von der gewaehlten Sortierung
    const num = m.typ !== 'kategorial';
    arr.sort((a, b) => (num ? (b.wert - a.wert) : ((b.p.importance_s || 0) - (a.p.importance_s || 0))) || a.id - b.id);
    arr.forEach((r, i) => { r.rang = i + 1; });
    if (S.sort && S.sort !== '#') {
      const sp = spalten().find(s => s.key === S.sort) || (S.sort === v ? { wert: r => r.wert } : { wert: r => r.p[S.sort] });
      arr.sort((a, b) => {
        const x = sp.wert(a), y = sp.wert(b);
        const xl = x === undefined || x === null || x === '', yl = y === undefined || y === null || y === '';
        if (xl || yl) return xl && yl ? a.rang - b.rang : xl ? 1 : -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de', { numeric: true });
        return c * S.richtung || a.rang - b.rang;
      });
    } else if (S.sort === '#' && S.richtung > 0) arr.reverse();
    return S.n ? arr.slice(0, S.n) : arr;
  }

  function init() {
    const el = S.el = document.getElementById('rangliste'); if (!el) return;
    const nSel = U.el('select', { title: 'Anzahl gelisteter Kanten' }, U.el('option', { value: 0 }, 'alle'), ...[25, 50, 100, 250, 1000].map(n => U.el('option', { value: n }, `Top ${n}`)));
    nSel.addEventListener('change', () => { S.n = +nSel.value; neu(); });
    const cb = U.el('input', { type: 'checkbox' });
    cb.addEventListener('change', () => { S.nurAusschnitt = cb.checked; neu(); });
    const breitBtn = U.el('button', { title: 'Mehr Spalten zeigen (Kante, Ebene, Typ, Länge, weitere Indizes) und die Liste verbreitern', onclick: () => { S.breit = !S.breit; breitBtn.classList.toggle('aktiv', S.breit); klassen(); neu(); } }, '⇔ Spalten');
    S.ui.titel = U.el('strong', {}, 'Rangliste');
    S.ui.info = U.el('div', { class: 'klein' }, '');
    const kopf = U.el('div', { class: 'rang-kopf' },
      U.el('div', { class: 'rang-titel' }, S.ui.titel,
        U.el('span', { class: 'rang-knoepfe' }, breitBtn, U.el('button', { class: 'rang-zu', title: 'Rangliste schließen und das Menü wieder zeigen (R)', onclick: () => schliessen() }, '✕ Schließen'))),
      U.el('div', { class: 'zeile' }, nSel, U.el('label', { title: 'Nur Kanten im aktuellen Kartenausschnitt listen' }, cb, ' nur Ausschnitt')),
      U.el('div', { class: 'zeile' }, U.el('button', { onclick: () => csv(), title: 'Alle gefilterten Kanten mit allen Spalten (Semikolon, Dezimalkomma)' }, 'CSV'), U.el('button', { onclick: () => geojson(), title: 'Alle gefilterten Kanten mit Geometrie' }, 'GeoJSON'), S.ui.info));
    S.ui.scroll = U.el('div', { class: 'rang-scroll', tabindex: 0 });
    S.ui.scroll.addEventListener('scroll', () => { const s = S.ui.scroll; if (s.scrollTop + s.clientHeight > s.scrollHeight - 400) mehr(); });
    S.ui.scroll.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault(); e.stopPropagation();
      if (!S.zeilen.length) return;
      const i = S.gewaehlt !== null && S.index.has(S.gewaehlt) ? S.index.get(S.gewaehlt) : -1;
      const j = Math.max(0, Math.min(S.zeilen.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      springen(S.zeilen[j].id);
    });
    el.appendChild(kopf); el.appendChild(S.ui.scroll);
    const neuD = U.debounce(() => { if (S.offen) neu(); }, 150);
    WK.bus.on('variable', neuD); WK.bus.on('filter', neuD); WK.bus.on('stil', neuD);
    WK.bus.on('ansicht', () => { if (S.offen && S.nurAusschnitt) neuD(); });
    WK.bus.on('auswahl', (id, opts) => markieren(id, !(opts && opts.quelle === 'rangliste')));
  }
  function klassen() {
    const app = document.getElementById('app');
    app.classList.toggle('rangliste-offen', S.offen);
    app.classList.toggle('rangliste-breit', S.offen && S.breit);
    setTimeout(() => WK.karte.map && WK.karte.map.resize(), 60);
  }
  function oeffnen() {
    if (!S.el) return;
    const app = document.getElementById('app');
    S.seiteWarZu = app.classList.contains('ohne-seite');
    app.classList.remove('ohne-seite'); if (window.innerWidth <= 900) app.classList.add('seite-offen');
    S.offen = true; S.el.hidden = false;
    const b = document.getElementById('btn-rangliste'); if (b) b.classList.add('aktiv');
    klassen(); neu();
  }
  function schliessen() {
    if (!S.el) return;
    S.offen = false; S.el.hidden = true;
    const app = document.getElementById('app');
    if (S.seiteWarZu) app.classList.add('ohne-seite');
    if (window.innerWidth <= 900) app.classList.remove('seite-offen');
    const b = document.getElementById('btn-rangliste'); if (b) b.classList.remove('aktiv');
    klassen();
  }
  function umschalten() { if (S.offen) schliessen(); else oeffnen(); }

  function neu() {
    const K = WK.karte, v = K.variable, m = K.meta || {};
    const sc = S.ui.scroll; sc.innerHTML = ''; S.tr = new Map(); S.gerendert = 0;
    S.ui.titel.textContent = v ? `Rangliste · ${m.label || v}` : 'Rangliste';
    if (!v) { S.zeilen = []; S.index = new Map(); S.ui.info.textContent = ''; sc.appendChild(U.el('p', { class: 'hinweis', style: { padding: '10px' } }, 'Diese Karte zeigt keine Kantenvariable. Bitte links im Menü eine Variable wählen (Rangliste schließen) oder ein anderes Preset.')); return; }
    S.zeilen = zeilen();
    S.index = new Map(S.zeilen.map((r, i) => [r.id, i]));
    const sp = S.spalten = spalten();
    const t = U.el('table'), kopf = U.el('tr');
    for (const s of sp) {
      const aktiv = (S.sort || '#') === s.key;
      const th = U.el('th', { class: s.zahl ? 'zahl' : '', title: s.titel || 'Klick sortiert nach dieser Spalte' }, s.label + (aktiv ? (S.richtung < 0 ? ' ▼' : ' ▲') : ''));
      th.addEventListener('click', () => {
        const key = s.key;
        if ((S.sort || '#') === key) S.richtung = -S.richtung;
        else { S.sort = key === '#' ? null : key; S.richtung = key === '#' ? -1 : (s.zahl ? -1 : 1); }
        if (!S.sort && S.richtung > 0) S.sort = '#';
        neu();
      });
      kopf.appendChild(th);
    }
    t.appendChild(U.el('thead', {}, kopf));
    S.ui.tbody = U.el('tbody'); t.appendChild(S.ui.tbody);
    sc.appendChild(t); sc.scrollTop = 0;
    mehr();
    markieren(K.auswahl, true);
  }
  function mehr(bis) {
    if (!S.ui.tbody) return;
    const K = WK.karte, v = K.variable, ende = Math.min(S.zeilen.length, Math.max(S.gerendert + BLOCK, bis || 0));
    const frag = document.createDocumentFragment();
    for (let i = S.gerendert; i < ende; i++) {
      const r = S.zeilen[i];
      const row = U.el('tr', { class: 'klick' + (r.id === S.gewaehlt ? ' gewaehlt' : '') });
      row.addEventListener('click', () => { S.ui.scroll.focus({ preventScroll: true }); springen(r.id); });
      for (const s of S.spalten) {
        const td = U.el('td', { class: (s.zahl ? 'zahl' : '') + (s.klasse ? ' ' + s.klasse : ''), title: s.klasse ? s.text(r) : null });
        if (s.farbe) { const f = WK.stil.farbe(v, r.wert, K.skala, K.meta); td.appendChild(U.el('span', { class: 'farbe-punkt', style: { background: f || 'transparent', marginRight: '5px', verticalAlign: '-1px' } })); }
        td.appendChild(document.createTextNode(s.text(r)));
        row.appendChild(td);
      }
      S.tr.set(r.id, row); frag.appendChild(row);
    }
    S.ui.tbody.appendChild(frag); S.gerendert = ende;
    const filterText = WK.filter && WK.filter.aktiv() ? ' · Filter aktiv' : '';
    S.ui.info.textContent = `${U.formatZahl(S.zeilen.length, 0)} Kanten${filterText}${S.gerendert < S.zeilen.length ? ` · ${U.formatZahl(S.gerendert, 0)} geladen, weiter beim Scrollen` : ''}`;
  }
  function springen(id) { WK.karte.waehlen(id, { quelle: 'rangliste' }); WK.karte.fokus(id); }
  function markieren(id, scrollen) {
    const alt = S.gewaehlt !== null ? S.tr.get(S.gewaehlt) : null; if (alt) alt.classList.remove('gewaehlt');
    S.gewaehlt = id === undefined ? null : id;
    if (!S.offen || S.gewaehlt === null || !S.index.has(S.gewaehlt)) return;
    const i = S.index.get(S.gewaehlt);
    if (i >= S.gerendert && i < AUTO_MAX) mehr(i + 20);
    const row = S.tr.get(S.gewaehlt); if (!row) return;
    row.classList.add('gewaehlt');
    if (scrollen) row.scrollIntoView({ block: 'nearest' }); else { const s = S.ui.scroll, o = row.offsetTop, h = row.offsetHeight; if (o < s.scrollTop + 30 || o + h > s.scrollTop + s.clientHeight) row.scrollIntoView({ block: 'nearest' }); }
  }

  function spaltenAlle() {
    const meta = WK.daten.meta, aus = ['id', 'name', 'ref', 'highway', 'baulast', 'gemeinde', 'length_m', 'aktiv', 'im_kreis', 'bruecke', 'tunnel'];
    for (const s of Object.keys(meta.spalten)) if (!aus.includes(s) && s !== 'u' && s !== 'v') aus.push(s);
    return aus;
  }
  function gefiltert() { const praed = WK.karte.praedikat(); return WK.daten.features.filter(praed); }
  function csv() {
    if (!WK.karte.variable) { WK.ui.melden('Bitte zuerst eine Variable wählen'); return; }
    const fs = gefiltert(), sp = spaltenAlle();
    const z = [sp.join(';')];
    for (const fe of fs) z.push(sp.map(s => { const w = s === 'id' ? fe.id : fe.properties[s]; if (w === undefined || w === null) return ''; if (typeof w === 'number') return String(w).replace('.', ','); return '"' + String(w).replace(/"/g, '""') + '"'; }).join(';'));
    U.download(new Blob(['﻿' + z.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `webkarte_${WK.karte.variable}_${U.heuteKurz()}.csv`);
    WK.ui.melden(`${fs.length} Kanten als CSV exportiert`);
  }
  function geojson() {
    if (!WK.karte.variable) { WK.ui.melden('Bitte zuerst eine Variable wählen'); return; }
    const fs = gefiltert();
    const fc = { type: 'FeatureCollection', name: `webkarte_${WK.karte.variable}`, features: fs.map(fe => ({ type: 'Feature', id: fe.id, properties: Object.assign({ id: fe.id }, fe.properties), geometry: fe.geometry })) };
    U.download(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), `webkarte_${WK.karte.variable}_${U.heuteKurz()}.geojson`);
    WK.ui.melden(`${fs.length} Kanten als GeoJSON exportiert`);
  }
  return { init, oeffnen, schliessen, umschalten, neu, csv, geojson, zeilen, get offen() { return S.offen; }, get anzahl() { return S.zeilen.length; }, get gerendert() { return S.gerendert; } };
})();
