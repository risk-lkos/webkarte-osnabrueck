/* Overlays: Gemeinden, Gewaesser, HQextrem-Flaechen, Raster (LST, heisse Tage), Fallbeispiele, Kreisgrenze */
WK.layers = (() => {
  const U = WK.util;
  const EBENEN = [
    { id: 'lk_grenze', label: 'Landkreisgrenze', typ: 'grenze' },
    { id: 'gemeinden', label: 'Gemeindegrenzen und -namen', typ: 'gemeinden', datei: 'gemeinden' },
    { id: 'gewaesser', label: 'Benannte Gewässer (Abdeckung)', typ: 'gewaesser', datei: 'gewaesser' },
    { id: 'hqextrem', label: 'HQextrem-Flächen nach Tiefenklasse', typ: 'hqextrem', datei: 'hqextrem' },
    { id: 'lst_p90', label: 'Oberflächentemperatur LST P90 (Raster)', typ: 'raster', raster: 'lst_p90' },
    { id: 'hot_days', label: 'Heiße Tage pro Jahr (Raster)', typ: 'raster', raster: 'hot_days' },
    { id: 'fallbeispiele', label: 'Fallbeispiele (Shortlists der Arbeit)', typ: 'fallbeispiele', datei: 'fallbeispiele' },
  ];
  const S = { an: new Set(['lk_grenze']), auto: new Set(), deckkraft: {}, geladen: {}, rasterMeta: {}, ui: {} };
  const FARBE_GEFAHR = { pluvial: '#08519c', fluvial: '#0868ac', heat: '#bd0026' };

  function init(map) {
    const wrap = document.getElementById('ebenen-inhalt');
    for (const e of EBENEN) {
      const cb = U.el('input', { type: 'checkbox', id: 'eb-' + e.id, checked: S.an.has(e.id) });
      const op = U.el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: e.typ === 'hqextrem' ? 0.7 : (e.typ === 'raster' ? 0.75 : 1), style: { width: '70px' }, title: 'Deckkraft' });
      S.deckkraft[e.id] = +op.value;
      cb.addEventListener('change', () => { S.auto.delete(e.id); setzen(e.id, cb.checked); });
      op.addEventListener('input', () => { S.deckkraft[e.id] = +op.value; deckkraft(e.id); });
      S.ui[e.id] = { cb, op };
      wrap.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'eb-' + e.id }, cb, ' ' + e.label), op));
    }
    WK.bus.on('stil', () => { for (const id of S.an) stil(id); });
  }
  function def(id) { return EBENEN.find(e => e.id === id); }
  async function setzen(id, an) {
    const map = WK.karte.map, e = def(id); if (!e) return;
    if (S.ui[id]) S.ui[id].cb.checked = !!an;
    if (!an) { S.an.delete(id); sichtbarkeit(id, false); WK.bus.emit('ebenen', [...S.an]); return; }
    S.an.add(id);
    try { await anlegen(e, map); } catch (err) { console.warn('Ebene', id, err); WK.ui.melden(`Ebene ${e.label} konnte nicht geladen werden`); S.an.delete(id); if (S.ui[id]) S.ui[id].cb.checked = false; return; }
    sichtbarkeit(id, true);
    stil(id);
    WK.bus.emit('ebenen', [...S.an]);
  }
  function layerIds(id) {
    const e = def(id);
    if (e.typ === 'grenze') return ['lk_grenze'];
    if (e.typ === 'gemeinden') return ['ov_gemeinden_linie', 'ov_gemeinden_label'];
    if (e.typ === 'gewaesser') return ['ov_gewaesser'];
    if (e.typ === 'hqextrem') return ['ov_hqextrem'];
    if (e.typ === 'raster') return ['ov_raster_' + e.raster];
    if (e.typ === 'fallbeispiele') return ['ov_fb_halo', 'ov_fb', 'ov_fb_label'];
    return [];
  }
  function sichtbarkeit(id, an) {
    const map = WK.karte.map;
    for (const l of layerIds(id)) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', an ? 'visible' : 'none');
  }
  function deckkraft(id) {
    const map = WK.karte.map, e = def(id), op = S.deckkraft[id];
    for (const l of layerIds(id)) {
      if (!map.getLayer(l)) continue;
      const typ = map.getLayer(l).type;
      if (typ === 'raster') map.setPaintProperty(l, 'raster-opacity', op);
      else if (typ === 'fill') map.setPaintProperty(l, 'fill-opacity', op);
      else if (typ === 'line') map.setPaintProperty(l, 'line-opacity', op);
      else if (typ === 'symbol') map.setPaintProperty(l, 'text-opacity', op);
    }
  }
  async function anlegen(e, map) {
    const vor = map.getLayer('kontext_netz') ? 'kontext_netz' : undefined;
    if (e.typ === 'grenze') return;   // von karte.js angelegt
    if (S.geladen[e.id]) return;
    if (e.typ === 'gemeinden') {
      const gj = await WK.daten.kontext('gemeinden');
      map.addSource('ov_gemeinden', { type: 'geojson', data: gj });
      map.addLayer({ id: 'ov_gemeinden_linie', type: 'line', source: 'ov_gemeinden', paint: { 'line-color': WK.stil.kontext('gemeinden'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 13, 1.4], 'line-dasharray': [3, 2] } }, vor);
      map.addLayer({ id: 'ov_gemeinden_label', type: 'symbol', source: 'ov_gemeinden', minzoom: 9, layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold'], 'text-size': 12, 'symbol-placement': 'point' }, paint: { 'text-color': '#444', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
    } else if (e.typ === 'gewaesser') {
      const gj = await WK.daten.kontext('gewaesser');
      map.addSource('ov_gewaesser', { type: 'geojson', data: gj });
      map.addLayer({ id: 'ov_gewaesser', type: 'line', source: 'ov_gewaesser', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': WK.stil.kontext('gewaesser'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, 3] } }, map.getLayer('wert_labels') ? 'wert_labels' : undefined);
      map.on('click', 'ov_gewaesser', ev => { const p = ev.features[0].properties; WK.ui.melden(`${p.name || 'Gewässer'} (${p.waterway || ''}): Abdeckung ${U.formatZahl(+p.cover_frac * 100, 0)} %`, 3500); });
    } else if (e.typ === 'hqextrem') {
      const gj = await WK.daten.kontext('hqextrem');
      map.addSource('ov_hqextrem', { type: 'geojson', data: gj });
      map.addLayer({ id: 'ov_hqextrem', type: 'fill', source: 'ov_hqextrem', paint: { 'fill-color': '#08589e', 'fill-opacity': S.deckkraft.hqextrem, 'fill-outline-color': 'rgba(0,0,0,0)' } }, vor);
      map.on('click', 'ov_hqextrem', ev => { const p = ev.features[0].properties; WK.ui.melden(`HQextrem ${p.RiverName || ''}: Klasse ${p.h_klasse}, repräsentative Tiefe ${U.formatZahl(+p.tiefe_repr_m, 1)} m`, 3500); });
    } else if (e.typ === 'raster') {
      const m = await WK.daten.raster(e.raster);
      S.rasterMeta[e.raster] = m;
      map.addSource('ov_raster_' + e.raster, { type: 'image', url: WK.daten.rasterBild(e.raster), coordinates: m.coordinates });
      map.addLayer({ id: 'ov_raster_' + e.raster, type: 'raster', source: 'ov_raster_' + e.raster, paint: { 'raster-opacity': S.deckkraft[e.id], 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, vor);
    } else if (e.typ === 'fallbeispiele') {
      const gj = await WK.daten.kontext('fallbeispiele');
      map.addSource('ov_fb', { type: 'geojson', data: gj });
      const farbe = ['match', ['get', 'gefahr'], 'pluvial', FARBE_GEFAHR.pluvial, 'fluvial', FARBE_GEFAHR.fluvial, 'heat', FARBE_GEFAHR.heat, '#333'];
      map.addLayer({ id: 'ov_fb_halo', type: 'line', source: 'ov_fb', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 12] } });
      map.addLayer({ id: 'ov_fb', type: 'line', source: 'ov_fb', layout: { 'line-cap': 'round' }, paint: { 'line-color': farbe, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 7] } });
      map.addLayer({ id: 'ov_fb_label', type: 'symbol', source: 'ov_fb', layout: { 'symbol-placement': 'point', 'text-field': ['concat', ['get', 'gefahr'], ' · ', ['get', 'gemeinde']], 'text-font': ['Open Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' }, paint: { 'text-color': farbe, 'text-halo-color': '#fff', 'text-halo-width': 1.6 } });
      map.on('click', 'ov_fb', ev => { const p = ev.features[0].properties; if (p.id !== undefined) WK.karte.waehlen(+p.id, { quelle: 'fallbeispiel' }); WK.ui.melden(`Fallbeispiel ${p.gefahr} · ${p.gemeinde || ''} · Cluster ${p.cluster} · Typizität ${U.formatZahl(+p.typizitaet, 2)}${p.is_medoid ? ' · Medoid' : ''}`, 4000); });
    }
    S.geladen[e.id] = true;
  }
  function stil(id) {
    const map = WK.karte.map, e = def(id); if (!e || !S.geladen[e.id] && e.typ !== 'grenze') return;
    if (e.typ === 'hqextrem' && map.getLayer('ov_hqextrem')) {
      const farben = WK.stil.kategorieFarben('h_klasse', ['H2', 'H3', 'H4', 'H5', 'H6']);
      const m = ['match', ['get', 'h_klasse']]; for (const [k, f] of Object.entries(farben)) m.push(k, f); m.push('#08589e');
      map.setPaintProperty('ov_hqextrem', 'fill-color', m);
    }
    if (e.typ === 'gewaesser' && map.getLayer('ov_gewaesser')) {
      const r = WK.stil.rampe('coverage'), ex = ['interpolate', ['linear'], ['coalesce', ['get', 'cover_frac'], 0.8]];
      for (const [t, f] of r.stops) ex.push(t, f);
      map.setPaintProperty('ov_gewaesser', 'line-color', ex);
    }
  }
  function presetOverlays(p) {
    for (const id of [...S.auto]) { S.auto.delete(id); setzen(id, false); }
    if (p.overlay) { S.auto.add(p.overlay); setzen(p.overlay, true); }
    if (p.raster) { S.auto.add(p.raster); setzen(p.raster, true); }
  }
  function rasterSpec(name) {
    const m = S.rasterMeta[name]; if (!m) return null;
    const r = WK.stil.rampe(m.rolle || 'heat');
    return { typ: 'raster', label: `${m.label} [${m.einheit}]`, vmin: m.vmin, vmax: m.vmax, stops: r.stops, css: r.css(), ticks: U.ticks(m.vmin, m.vmax, 5), fuss: `Farbskala P${m.perzentile[0]}–P${m.perzentile[1]} (${m.perzentile_bezug})`, einheit: m.einheit };
  }
  function overlaySpec(p) {
    if (p.overlay === 'hqextrem') {
      const werte = ['H2', 'H3', 'H4', 'H5', 'H6'], farben = WK.stil.kategorieFarben('h_klasse', werte);
      return { typ: 'kategorial', label: p.legende_titel || 'Tiefenklasse', titel: p.legende_titel || 'Tiefenklasse HQextrem', klassen: werte.map(w => ({ wert: w, label: w, farbe: farben[w], lw: 3 })), flaeche: true };
    }
    if (p.overlay === 'gewaesser') { const r = WK.stil.rampe('coverage'); return { typ: 'kontinuierlich', label: p.legende_label || 'abgedeckter Längenanteil', vmin: 0, vmax: 1, stops: r.stops, css: r.css(), ticks: [0, 0.25, 0.5, 0.75, 1], einheit: '' }; }
    return null;
  }
  return { EBENEN, S, init, setzen, deckkraft, presetOverlays, rasterSpec, overlaySpec, get an() { return [...S.an]; }, rasterMeta: name => S.rasterMeta[name] };
})();
