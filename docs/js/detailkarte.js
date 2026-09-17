/* Detailkarte: zweite MapLibre-Instanz im Panel (Umkreis-Teilmenge), folgt der Auswahl, Pop-out */
WK.detail = (() => {
  const U = WK.util;
  const S = { map: null, bereit: false, folgen: true, id: null, wrap: null, container: null, basemap: null, fenster: null, geparkt: null, ids: [] };

  function init() {
    S.wrap = document.getElementById('detailkarte-wrap');
    S.container = document.getElementById('detailkarte');
    const bmSel = document.getElementById('detail-basemap');
    for (const b of WK.basemaps.liste()) bmSel.appendChild(U.el('option', { value: b.id }, b.label));
    S.basemap = WK.basemaps.def('dop20') ? 'dop20' : WK.basemaps.standard();
    bmSel.value = S.basemap;
    bmSel.addEventListener('change', () => { S.basemap = bmSel.value; if (S.bereit) WK.basemaps.setzen(S.map, S.basemap, 'd_kontext', 'detail'); });
    document.getElementById('detail-folgen').addEventListener('change', e => { S.folgen = e.target.checked; if (S.folgen && S.id !== null) folgen(S.id); });
    document.getElementById('btn-detail-popout').addEventListener('click', () => popOut());
    erzeugen();
    WK.bus.on('auswahl', id => { if (id !== null && id !== undefined) folgen(id); });
    WK.bus.on('variable', stilNeu);
    WK.bus.on('stil', stilNeu);
    WK.bus.on('filter', stilNeu);
    WK.bus.on('basemaps-geprueft', v => { if (v[S.basemap] === false) { S.basemap = WK.basemaps.standard(); bmSel.value = S.basemap; if (S.bereit) WK.basemaps.setzen(S.map, S.basemap, 'd_kontext', 'detail'); } });
    if (window.ResizeObserver) new ResizeObserver(() => { if (S.map) S.map.resize(); }).observe(S.container);
  }
  function erzeugen() {
    const meta = WK.daten.meta, c = meta.raum.lk_bounds_4326;
    const map = new maplibregl.Map({
      container: S.container,
      style: { version: 8, glyphs: WK.config.pfade.glyphs, sources: {}, layers: [{ id: 'hintergrund', type: 'background', paint: { 'background-color': WK.stil.kontext('hintergrund') } }] },
      center: [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2], zoom: 11, minZoom: 9, maxZoom: 20,
      attributionControl: { compact: true }, canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true }, fadeDuration: 0,
    });
    S.map = map; S.bereit = false;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
    map.on('load', () => {
      const rund = { 'line-cap': 'round', 'line-join': 'round' };
      map.addSource('detail_kanten', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'd_kontext', type: 'line', source: 'detail_kanten', layout: rund, paint: { 'line-color': WK.stil.kontext('grau'), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 3, 19, 6] } });
      map.addLayer({ id: 'd_daten', type: 'line', source: 'detail_kanten', layout: rund, filter: ['==', ['id'], -1], paint: { 'line-color': '#000', 'line-width': 2 } });
      map.addLayer({ id: 'd_auswahl_halo', type: 'line', source: 'detail_kanten', layout: rund, filter: ['==', ['id'], -1], paint: { 'line-color': WK.stil.kontext('halo'), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 8, 17, 14], 'line-opacity': 0.9 } });
      map.addLayer({ id: 'd_auswahl', type: 'line', source: 'detail_kanten', layout: rund, filter: ['==', ['id'], -1], paint: { 'line-color': WK.stil.kontext('auswahl'), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 7] } });
      map.addLayer({ id: 'd_labels', type: 'symbol', source: 'detail_kanten', minzoom: 13, filter: ['==', ['id'], -1],
        layout: { 'symbol-placement': 'line-center', 'text-field': '', 'text-size': 12, 'text-font': ['Open Sans Bold'], 'text-allow-overlap': false },
        paint: { 'text-color': '#1c1e21', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } });
      WK.basemaps.setzen(map, S.basemap, 'd_kontext', 'detail');
      map.on('click', e => {
        const fs = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['d_daten', 'd_kontext'] });
        if (fs.length) { const f = fs.find(x => x.layer.id === 'd_daten') || fs[0]; S.folgenPause = true; WK.karte.waehlen(f.id, { quelle: 'detail' }); }
      });
      map.on('mousemove', e => {
        const fs = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ['d_daten', 'd_kontext'] });
        map.getCanvas().style.cursor = fs.length ? 'pointer' : '';
      });
      S.bereit = true;
      if (S.id !== null) folgen(S.id);
    });
  }
  function teilmenge(id) {
    const fe = WK.daten.feature(id); if (!fe) return;
    const c = fe.geometry.coordinates, mid = c[Math.floor(c.length / 2)];
    const km = WK.config.karte.detailUmkreisKm, dlat = km / 111, dlon = km / (111 * Math.cos(mid[1] * Math.PI / 180));
    const idx = WK.daten.imBereich([mid[0] - dlon, mid[1] - dlat, mid[0] + dlon, mid[1] + dlat]);
    S.ids = idx;
    S.map.getSource('detail_kanten').setData({ type: 'FeatureCollection', features: idx.map(i => WK.daten.features[i]) });
  }
  function folgen(id) {
    S.id = id;
    if (!S.bereit) return;
    teilmenge(id);
    stilNeu();
    const f = ['==', ['id'], id];
    S.map.setFilter('d_auswahl_halo', f); S.map.setFilter('d_auswahl', f);
    if (S.folgen && !S.folgenPause) {
      const i = WK.daten.idx(id), b = WK.daten.S.bboxes;
      S.map.fitBounds([[b[i * 4], b[i * 4 + 1]], [b[i * 4 + 2], b[i * 4 + 3]]], { padding: 50, maxZoom: WK.config.karte.detailZoom, duration: 500 });
    }
    S.folgenPause = false;
  }
  function stilNeu() {
    if (!S.bereit) return;
    const K = WK.karte, map = S.map;
    map.setPaintProperty('hintergrund', 'background-color', WK.stil.kontext('hintergrund'));
    map.setPaintProperty('d_kontext', 'line-color', WK.stil.kontext('grau'));
    map.setPaintProperty('d_auswahl', 'line-color', WK.stil.kontext('auswahl'));
    if (!K.variable) { map.setFilter('d_daten', ['==', ['id'], -1]); map.setFilter('d_labels', ['==', ['id'], -1]); return; }
    map.setFilter('d_daten', K.basisFilter());
    map.setPaintProperty('d_daten', 'line-color', WK.stil.ausdruckFarbe(K.variable, K.skala, K.meta));
    const W = WK.stil.ausdruckBreiteBasis(K.variable, K.skala, K.meta, K.lwVorgabe);
    map.setPaintProperty('d_daten', 'line-width', ['interpolate', ['exponential', 1.5], ['zoom'], 11, ['*', 1.2, W], 15, ['*', 3.5, W], 19, ['*', 9, W]]);
    map.setFilter('d_labels', K.basisFilter());
    map.setLayoutProperty('d_labels', 'text-field', map.getLayoutProperty ? (WK.karte.map.getLayoutProperty('wert_labels', 'text-field') || '') : '');
    map.setLayoutProperty('d_labels', 'visibility', 'visible');
  }
  // --- Pop-out ---------------------------------------------------------------------------
  function stylesheetsKopieren(doc) {
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) { const n = doc.createElement('link'); n.rel = 'stylesheet'; n.href = l.href; doc.head.appendChild(n); }
    const s = doc.createElement('style'); s.textContent = 'html,body{margin:0;height:100%;background:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:13px}.detailkarte-wrap{height:100%;display:flex;flex-direction:column}.detailkarte{flex:1;min-height:0;resize:none}.detailkarte-leiste{display:flex;gap:10px;align-items:center;padding:5px 8px}'; doc.head.appendChild(s);
    if (document.documentElement.getAttribute('data-theme')) doc.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme'));
  }
  async function popOut() {
    if (S.fenster) { zurueckdocken(); return; }
    let win = null;
    try {
      if (window.documentPictureInPicture && window.documentPictureInPicture.requestWindow) {
        win = await window.documentPictureInPicture.requestWindow({ width: 560, height: 560 });
      }
    } catch (e) { console.warn('Document-PiP nicht möglich', e); win = null; }
    if (!win) {
      win = window.open('', 'wk-detailkarte', 'width=560,height=600,resizable=yes');
      if (!win) { WK.ui.melden('Pop-out blockiert (Popup-Blocker). Bitte Popups für diese Seite erlauben.', 4000); return; }
      win.document.write('<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Detailkarte</title></head><body></body></html>');
      win.document.close();
    }
    stylesheetsKopieren(win.document);
    S.geparkt = U.el('div', { id: 'detail-platzhalter', class: 'hinweis', style: { padding: '10px' } }, 'Detailkarte läuft in einem eigenen Fenster. ');
    S.geparkt.appendChild(U.el('button', { onclick: () => zurueckdocken() }, 'zurückholen'));
    S.wrap.parentNode.insertBefore(S.geparkt, S.wrap);
    if (S.map) { S.map.remove(); S.map = null; S.bereit = false; }
    win.document.body.appendChild(S.wrap);
    S.fenster = win;
    win.addEventListener('pagehide', () => zurueckdocken(true));
    win.addEventListener('beforeunload', () => zurueckdocken(true));
    erzeugen();
    document.getElementById('btn-detail-popout').classList.add('aktiv');
  }
  function zurueckdocken(vomFenster) {
    if (!S.fenster) return;
    const win = S.fenster; S.fenster = null;
    if (S.map) { try { S.map.remove(); } catch (e) { /* leer */ } S.map = null; S.bereit = false; }
    if (S.geparkt && S.geparkt.parentNode) { S.geparkt.parentNode.insertBefore(S.wrap, S.geparkt); S.geparkt.remove(); S.geparkt = null; }
    else document.getElementById('panel').insertBefore(S.wrap, document.getElementById('kante-info'));
    if (!vomFenster) { try { win.close(); } catch (e) { /* leer */ } }
    erzeugen();
    document.getElementById('btn-detail-popout').classList.remove('aktiv');
  }
  return { init, folgen, stilNeu, popOut, zurueckdocken, get map() { return S.map; }, get id() { return S.id; }, get ids() { return S.ids; } };
})();
