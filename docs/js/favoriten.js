/* Favoriten: gemerkte Kanten (Stern im Panel, Taste S), Liste in der Seitenleiste, eigener Kartenlayer, CSV */
WK.favoriten = (() => {
  const U = WK.util;
  const S = { ids: [], liste: null, info: null };

  function filterAusdruck() { return S.ids.length ? ['in', ['id'], ['literal', S.ids]] : ['==', ['id'], -1]; }
  function farbe() { return WK.stil.kontext('favorit') || '#f2b701'; }

  function init(map) {
    S.ids = (U.ls(WK.config.speicher.favoriten) || []).filter(id => WK.daten.feature(id));
    if (!map.getLayer('favoriten')) {
      map.addLayer({ id: 'favoriten', type: 'line', source: 'kanten', layout: { 'line-cap': 'round', 'line-join': 'round' }, filter: filterAusdruck(),
        paint: { 'line-color': farbe(), 'line-width': WK.stil.mitZoom(5), 'line-opacity': 0.8 } }, 'auswahl_halo');
    }
    const a = WK.ui.abschnitt('Favoriten', true, 'abs-favoriten');
    a.inhalt.appendChild(U.el('div', { class: 'klein' }, 'Kanten über ☆ im Detailpanel oder mit Taste S merken; die Liste bleibt im Browser gespeichert.'));
    S.liste = U.el('div', { class: 'liste' });
    a.inhalt.appendChild(S.liste);
    S.info = U.el('span', { class: 'klein' });
    a.inhalt.appendChild(U.el('div', { class: 'zeile' },
      U.el('button', { onclick: alleZeigen, title: 'Kartenausschnitt auf alle Favoriten' }, 'alle zeigen'),
      U.el('button', { onclick: alleAnpinnen, title: 'Favoriten für den Vergleich anpinnen (max. 10)' }, 'anpinnen'),
      U.el('button', { onclick: csv }, 'CSV'),
      U.el('button', { onclick: () => { if (S.ids.length && window.confirm('Alle Favoriten löschen?')) { S.ids = []; speichern(); } } }, 'leeren'),
      S.info));
    const werk = document.getElementById('abs-werkzeuge');
    if (werk) werk.parentNode.insertBefore(a.d, werk); else document.getElementById('seite').appendChild(a.d);
    render();
    WK.bus.on('stil', () => { if (map.getLayer('favoriten')) { map.setPaintProperty('favoriten', 'line-color', farbe()); map.setPaintProperty('favoriten', 'line-width', WK.stil.mitZoom(5)); } });
    WK.bus.on('variable', render);
  }
  function speichern() {
    U.ls(WK.config.speicher.favoriten, S.ids);
    if (WK.karte.map.getLayer('favoriten')) WK.karte.map.setFilter('favoriten', filterAusdruck());
    render();
    WK.bus.emit('favoriten', S.ids.slice());
  }
  function ist(id) { return S.ids.includes(id); }
  function toggle(id) {
    if (id === null || id === undefined || !WK.daten.feature(id)) return;
    const i = S.ids.indexOf(id);
    if (i >= 0) S.ids.splice(i, 1); else S.ids.push(id);
    speichern();
    WK.ui.melden(i >= 0 ? 'Favorit entfernt' : `Favorit gemerkt (${S.ids.length})`);
  }
  function render() {
    if (!S.liste) return;
    S.liste.innerHTML = '';
    const v = WK.karte.variable, sp = v ? (WK.daten.spalte(v) || {}) : {};
    for (const id of S.ids) {
      const fe = WK.daten.feature(id); if (!fe) continue;
      const p = fe.properties, name = [p.ref, p.name].filter(Boolean).join(' · ') || `Kante ${id}`;
      const wert = v && p[v] !== undefined ? (typeof p[v] === 'number' ? U.formatZahl(p[v], sp.dezimalen === null || sp.dezimalen === undefined ? 3 : sp.dezimalen) : String(p[v])) : '';
      S.liste.appendChild(U.el('button', { title: `${name}${p.gemeinde ? ' · ' + p.gemeinde : ''}`, onclick: () => { WK.karte.waehlen(id, { quelle: 'favorit' }); WK.karte.fokus(id); } },
        U.el('span', { class: 'farbe-punkt', style: { background: farbe() } }), U.el('span', {}, name), U.el('span', { class: 'n' }, wert),
        U.el('span', { class: 'n', title: 'entfernen', onclick: e => { e.stopPropagation(); toggle(id); } }, '✕')));
    }
    S.info.textContent = S.ids.length ? `${S.ids.length} Favoriten` : 'noch keine Favoriten';
  }
  function alleZeigen() {
    if (!S.ids.length) return;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity; const b = WK.daten.S.bboxes;
    for (const id of S.ids) { const i = WK.daten.idx(id); if (i === undefined) continue; if (b[i * 4] < w) w = b[i * 4]; if (b[i * 4 + 1] < s) s = b[i * 4 + 1]; if (b[i * 4 + 2] > e) e = b[i * 4 + 2]; if (b[i * 4 + 3] > n) n = b[i * 4 + 3]; }
    WK.karte.map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 700, maxZoom: 15 });
  }
  function alleAnpinnen() { if (!WK.vergleich) return; WK.vergleich.leeren(); for (const id of S.ids.slice(0, WK.vergleich.MAX)) WK.vergleich.anpinnen(id, true); WK.bus.emit('pins', WK.vergleich.ids.slice()); WK.ui.melden(`${WK.vergleich.ids.length} Favoriten angepinnt`); }
  function csv() {
    if (!S.ids.length) { WK.ui.melden('Keine Favoriten'); return; }
    const meta = WK.daten.meta, spalten = ['id', 'name', 'ref', 'highway', 'baulast', 'gemeinde', 'length_m', ...Object.keys(meta.spalten).filter(s => !['name', 'ref', 'highway', 'baulast', 'gemeinde', 'length_m', 'u', 'v'].includes(s))];
    const z = [spalten.join(';')];
    for (const id of S.ids) { const fe = WK.daten.feature(id); if (!fe) continue; z.push(spalten.map(s => { const w = s === 'id' ? id : fe.properties[s]; if (w === undefined || w === null) return ''; if (typeof w === 'number') return String(w).replace('.', ','); return '"' + String(w).replace(/"/g, '""') + '"'; }).join(';')); }
    U.download(new Blob(['﻿' + z.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `webkarte_favoriten_${U.heuteKurz()}.csv`);
  }
  return { init, toggle, ist, alleZeigen, csv, get ids() { return S.ids; } };
})();
