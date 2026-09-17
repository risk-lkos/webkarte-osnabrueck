/* Hauptkarte: Sources, Layer, Variable/Skala/Filter, Hover, Auswahl, Labels */
WK.karte = (() => {
  const U = WK.util;
  const S = {
    map: null, bereit: false, variable: null, meta: null, skala: null, preset: null, lwVorgabe: null,
    kontext: 'aktiv', kontextLw: 'kontext', kontextLabel: 'Straßennetz (aktiv)', filter: null, ausgeblendet: new Set(),
    auswahl: null, hover: null, labels: false, sichtbar: null, tooltip: null, modus: 'p2_p100', modusOpts: {},
    mess: { an: false, punkte: [] },
    arbeitsansicht: (() => { const v = U.ls('wk.arbeitsansicht'); return v === null || v === undefined ? true : !!v; })(),
  };
  const LAYER_DATEN = ['daten', 'kontext_netz'];

  function erzeugen(container) {
    const meta = WK.daten.meta;
    const map = new maplibregl.Map({
      container,
      style: { version: 8, glyphs: WK.config.pfade.glyphs, sources: {}, layers: [
        { id: 'hintergrund', type: 'background', paint: { 'background-color': WK.stil.kontext('hintergrund') } }] },
      bounds: meta.raum.start_bounds_4326, fitBoundsOptions: { padding: 10 },
      minZoom: WK.config.karte.minZoom, maxZoom: WK.config.karte.maxZoom,
      attributionControl: { compact: false, customAttribution: 'Netz © OpenStreetMap-Mitwirkende · Kennwerte: eigene Berechnung' },
      canvasContextAttributes: { preserveDrawingBuffer: false, antialias: true },
      fadeDuration: 0,
    });
    S.map = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: 'metric' }), 'bottom-left');
    S.tooltip = document.getElementById('tooltip');
    map.on('load', () => {
      quellenAnlegen(); layerAnlegen(); ereignisse();
      S.bereit = true;
      WK.bus.emit('karte-bereit', map);
    });
    return map;
  }

  function quellenAnlegen() {
    S.map.addSource('kanten', { type: 'geojson', data: WK.daten.featureCollection(), tolerance: 0.4, buffer: 64, maxzoom: 16 });
    WK.daten.kontext('lk_grenze').then(gj => {
      if (!S.map.getSource('lk_grenze')) {
        S.map.addSource('lk_grenze', { type: 'geojson', data: gj });
        S.map.addLayer({ id: 'lk_grenze', type: 'line', source: 'lk_grenze', paint: { 'line-color': WK.stil.kontext('umriss'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.0, 12, 1.6, 15, 2.4] } }, 'wert_labels');
      }
    }).catch(e => console.warn('lk_grenze', e));
  }

  function layerAnlegen() {
    const map = S.map, rund = { 'line-cap': 'round', 'line-join': 'round' };
    map.addLayer({ id: 'kontext_netz', type: 'line', source: 'kanten', layout: rund, filter: ['has', 'aktiv'],
      paint: { 'line-color': WK.stil.kontext('grau'), 'line-width': WK.stil.kontextBreite(WK.stil.schema.breiten.kontext || 0.3) } });
    map.addLayer({ id: 'daten', type: 'line', source: 'kanten', layout: rund, filter: ['==', ['id'], -1],
      paint: { 'line-color': '#000', 'line-width': 1 } });
    map.addLayer({ id: 'pins', type: 'line', source: 'kanten', layout: rund, filter: ['==', ['id'], -1],
      paint: { 'line-color': '#1b9e77', 'line-width': WK.stil.mitZoom(3.2), 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'auswahl_halo', type: 'line', source: 'kanten', layout: rund, filter: ['==', ['id'], -1],
      paint: { 'line-color': WK.stil.kontext('halo'), 'line-width': WK.stil.mitZoom(7), 'line-opacity': 0.9 } });
    map.addLayer({ id: 'auswahl', type: 'line', source: 'kanten', layout: rund, filter: ['==', ['id'], -1],
      paint: { 'line-color': WK.stil.kontext('auswahl'), 'line-width': WK.stil.mitZoom(3) } });
    map.addLayer({ id: 'nachbarn', type: 'line', source: 'kanten', layout: rund, filter: ['==', ['id'], -1],
      paint: { 'line-color': WK.stil.kontext('warm'), 'line-width': WK.stil.mitZoom(2.2), 'line-opacity': 0.7, 'line-dasharray': [1, 1.2] } });
    map.addLayer({ id: 'wert_labels', type: 'symbol', source: 'kanten', minzoom: WK.config.karte.labelsAbZoom, filter: ['==', ['id'], -1],
      layout: { 'symbol-placement': 'line-center', 'text-field': '', 'text-size': 11, 'text-font': ['Open Sans Regular'], 'visibility': 'none', 'text-allow-overlap': false, 'text-padding': 4 },
      paint: { 'text-color': '#1c1e21', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
  }

  // --- Variable / Skala / Filter -------------------------------------------------
  function basisFilter() {
    const v = S.variable, m = S.meta || {};
    if (!v) return ['==', ['id'], -1];
    const teile = [];
    if (m.typ === 'kategorial') teile.push(['has', v]);
    else if (m.gt0) teile.push(['>', ['to-number', ['get', v], 0], 0]);
    else teile.push(['has', v]);
    if (S.ausgeblendet.size) teile.push(['!', ['in', ['to-string', ['get', v]], ['literal', [...S.ausgeblendet]]]]);
    if (S.filter) teile.push(S.filter);
    return teile.length === 1 ? teile[0] : ['all', ...teile];
  }
  function anwenden() {
    if (!S.bereit || !S.variable) return;
    const map = S.map, v = S.variable, m = S.meta;
    map.setFilter('daten', basisFilter());
    map.setPaintProperty('daten', 'line-color', WK.stil.ausdruckFarbe(v, S.skala, m));
    map.setPaintProperty('daten', 'line-width', WK.stil.ausdruckBreite(v, S.skala, m, S.lwVorgabe));
    const dez = (WK.daten.spalte(v) || {}).dezimalen;
    const d = dez === null || dez === undefined ? (m && m.typ === 'kategorial' ? 0 : 3) : dez;
    const feld = m && m.typ === 'kategorial' ? ['to-string', ['get', v]] : ['number-format', ['get', v], { locale: 'de-DE', 'min-fraction-digits': d, 'max-fraction-digits': d }];
    map.setLayoutProperty('wert_labels', 'text-field', feld);
    map.setFilter('wert_labels', basisFilter());
    map.setLayoutProperty('wert_labels', 'visibility', S.labels ? 'visible' : 'none');
    WK.bus.emit('variable', { variable: v, meta: m, skala: S.skala, preset: S.preset, lw: S.lwVorgabe });
    sichtbarZaehlen();
  }
  function setVariable(variable, opts) {
    opts = opts || {};
    const meta = WK.daten.variable(variable);
    if (!meta) { console.warn('Variable unbekannt', variable); return; }
    S.variable = variable; S.meta = meta;
    S.preset = opts.preset || null;
    S.lwVorgabe = opts.lw !== undefined ? opts.lw : null;
    S.ausgeblendet = new Set();
    if (opts.modus) S.modus = opts.modus;
    else if (meta.typ === 'kategorial') S.modus = 'kategorial';
    else if (meta.typ === 'quintil' && !opts.preset) S.modus = 'quintil';
    else if (S.modus === 'kategorial' || S.modus === 'quintil' || S.modus === 'einfarbig') S.modus = 'p2_p100';
    S.modusOpts = Object.assign({}, opts.modusOpts || {});
    if (opts.kontext) setKontext(opts.kontext, opts.kontextLw, opts.kontextLabel, true);
    skalaNeu();
  }
  function skalaNeu() {
    const o = Object.assign({}, S.modusOpts, { lw: S.lwVorgabe });
    if (S.modus === 'ausschnitt') o.indizes = sichtbareIndizes();
    S.skala = WK.klassifikation.skala(S.variable, S.modus, o);
    anwenden();
  }
  function setModus(modus, opts) { S.modus = modus; S.modusOpts = Object.assign({}, S.modusOpts, opts || {}); skalaNeu(); }
  function setFilter(ausdruck) { S.filter = ausdruck || null; anwenden(); }
  function setKategorieAus(wert, aus) { const k = String(wert); if (aus) S.ausgeblendet.add(k); else S.ausgeblendet.delete(k); anwenden(); }
  function kategorieAus(wert) { return S.ausgeblendet.has(String(wert)); }
  function setLabels(an) { S.labels = !!an; if (S.bereit) S.map.setLayoutProperty('wert_labels', 'visibility', S.labels ? 'visible' : 'none'); }
  function setKontext(modus, lwKey, label, still) {
    S.kontext = modus || 'aktiv'; S.kontextLw = lwKey || (modus === 'gesamt' ? 'kontext' : 'kontext'); S.kontextLabel = label || (modus === 'gesamt' ? 'Straßennetz' : 'Straßennetz (aktiv)');
    if (!S.bereit) return;
    const map = S.map;
    const br = WK.stil.schema.breiten[S.kontextLw]; const lw = typeof br === 'number' ? br : 0.3;
    if (S.kontext === 'keiner') map.setLayoutProperty('kontext_netz', 'visibility', 'none');
    else {
      map.setLayoutProperty('kontext_netz', 'visibility', 'visible');
      map.setFilter('kontext_netz', S.kontext === 'gesamt' ? null : ['has', 'aktiv']);
      map.setPaintProperty('kontext_netz', 'line-color', S.kontext === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau'));
      map.setPaintProperty('kontext_netz', 'line-width', WK.stil.kontextBreite(lw));
    }
    if (!still) WK.bus.emit('kontext', S.kontext);
  }
  function stilNeu() {
    if (!S.bereit) return;
    const map = S.map;
    map.setPaintProperty('hintergrund', 'background-color', WK.stil.kontext('hintergrund'));
    map.setPaintProperty('auswahl', 'line-color', WK.stil.kontext('auswahl'));
    map.setPaintProperty('auswahl_halo', 'line-color', WK.stil.kontext('halo'));
    if (map.getLayer('lk_grenze')) map.setPaintProperty('lk_grenze', 'line-color', WK.stil.kontext('umriss'));
    setKontext(S.kontext, S.kontextLw, S.kontextLabel, true);
    if (S.variable) skalaNeu();
  }

  // --- Preset ----------------------------------------------------------------------
  function setArbeitsansicht(an) { S.arbeitsansicht = !!an; U.ls('wk.arbeitsansicht', S.arbeitsansicht); }
  function setPreset(id, opts) {
    opts = opts || {};
    const p = WK.daten.preset(id);
    if (!p) return;
    const ansicht = S.arbeitsansicht && !opts.ohneAnsicht;
    if (ansicht) {
      // Einstellungen der Abbildung uebernehmen: kein Hintergrund, Farbschema der Arbeit, Filter und Labels aus, Landkreis-Ausschnitt
      if (WK.filter && WK.filter.aktiv()) WK.filter.setZustand({});
      if (S.labels) { setLabels(false); const cb = document.getElementById('cb-labels'); if (cb) cb.checked = false; }
      if (WK.stil.schemaId !== 'arbeit' || WK.stil.geaendert) WK.stil.setSchema('arbeit');
      if (S.bereit && WK.basemaps.aktuell !== 'keiner') WK.basemaps.setzen(S.map, 'keiner', 'kontext_netz');
    }
    const sk = p.skala || {};
    let modus = sk.modus || 'p2_p100', modusOpts = {};
    if (modus === 'fest') modusOpts = { vmin: sk.vmin, vmax: sk.vmax };
    if (modus === 'einfarbig') modusOpts = { t: sk.t, rolle: sk.rolle };
    if (sk.rolle) modusOpts.rolle = sk.rolle;
    const kontextLw = p.kontext_lw || 'kontext';
    if (p.variable) {
      setVariable(p.variable, { preset: p, lw: p.lw, modus, modusOpts, kontext: p.kontext || 'aktiv', kontextLw, kontextLabel: p.kontext_label });
      if (WK.layers) WK.layers.presetOverlays(p);
    } else if (WK.layers) {
      // Presets ohne Kantenvariable (Flaechen, Gewaesser, Raster)
      S.variable = null; S.meta = null; S.preset = p; S.skala = { modus: 'keine' };
      S.map.setFilter('daten', ['==', ['id'], -1]);
      setKontext(p.kontext || 'keiner', kontextLw, p.kontext_label, true);
      WK.layers.presetOverlays(p);
      WK.bus.emit('variable', { variable: null, meta: null, skala: S.skala, preset: p });
    }
    if (ansicht && S.bereit) fitLK();
    WK.bus.emit('preset', p);
  }

  // --- Interaktion --------------------------------------------------------------------
  function treffer(point, r) {
    r = r || 4;
    const bb = [[point.x - r, point.y - r], [point.x + r, point.y + r]];
    const fs = S.map.queryRenderedFeatures(bb, { layers: LAYER_DATEN.filter(l => S.map.getLayer(l)) });
    if (!fs.length) return null;
    const daten = fs.find(f => f.layer.id === 'daten');
    return daten || fs[0];
  }
  function tooltipZeigen(f, e) {
    const t = S.tooltip; if (!t) return;
    const fe = WK.daten.feature(f.id); if (!fe) return;
    const p = fe.properties, v = S.variable;
    const name = [p.ref, p.name].filter(Boolean).join(' · ') || (p.highway || 'Kante');
    let wert = '';
    if (v && p[v] !== undefined) {
      const sp = WK.daten.spalte(v) || {}; const m = S.meta || {};
      const w = typeof p[v] === 'number' ? U.formatZahl(p[v], sp.dezimalen === null || sp.dezimalen === undefined ? 3 : sp.dezimalen) : String(p[v]);
      wert = `<div><span class="wert">${U.esc(w)}</span> ${U.esc(m.einheit || '')} <span class="klein">${U.esc(m.label || v)}</span></div>`;
      const rg = typeof p[v] === 'number' ? WK.daten.rang(v, f.id, m.gt0) : null;
      if (rg) wert += `<div class="klein">Rang ${rg.rang} von ${rg.n}</div>`;
    } else if (v) wert = `<div class="klein">kein Wert für ${U.esc((S.meta || {}).label || v)}</div>`;
    t.innerHTML = `<div>${U.esc(name)}</div>${wert}`;
    t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight, cont = S.map.getContainer().getBoundingClientRect();
    let x = e.point.x + 14, y = e.point.y + 14;
    if (x + w > cont.width - 8) x = e.point.x - w - 10;
    if (y + h > cont.height - 30) y = e.point.y - h - 10;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function tooltipWeg() { if (S.tooltip) S.tooltip.hidden = true; }
  function hoverSetzen(id) {
    if (S.hover === id) return;
    if (S.hover !== null && S.hover !== undefined) S.map.removeFeatureState({ source: 'kanten', id: S.hover }, 'hover');
    S.hover = id;
    if (id !== null && id !== undefined) S.map.setFeatureState({ source: 'kanten', id }, { hover: true });
    S.map.getCanvas().style.cursor = id !== null && id !== undefined ? 'pointer' : '';
    const fe = id !== null && id !== undefined ? WK.daten.feature(id) : null;
    WK.bus.emit('hover', fe ? { id, wert: S.variable ? fe.properties[S.variable] : undefined } : null);
  }
  function ereignisse() {
    const map = S.map;
    let raf = null, letztes = null;
    map.on('mousemove', e => {
      letztes = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const f = treffer(letztes.point, 3);
        if (f) { hoverSetzen(f.id); tooltipZeigen(f, letztes); } else { hoverSetzen(null); tooltipWeg(); }
        WK.bus.emit('maus', letztes.lngLat);
      });
    });
    map.on('mouseout', () => { hoverSetzen(null); tooltipWeg(); });
    map.on('click', e => {
      if (S.mess.an) { messPunkt([e.lngLat.lng, e.lngLat.lat]); return; }
      const f = treffer(e.point, 6);
      waehlen(f ? f.id : null, { quelle: 'klick' });
    });
    map.on('moveend', () => { WK.bus.emit('ansicht', zustand()); sichtbarZaehlen(); if (S.modus === 'ausschnitt') skalaNeu(); });
    map.on('zoomend', () => WK.bus.emit('zoom', map.getZoom()));
    map.on('error', e => { if (e && e.error && /tile|Tile|404|403/.test(String(e.error.message || e.error))) return; console.warn('MapLibre', e && e.error); });
    WK.bus.on('stil', stilNeu);
  }
  function waehlen(id, opts) {
    opts = opts || {};
    if (id !== null && id !== undefined && !WK.daten.feature(id)) id = null;
    S.auswahl = id;
    const f = ['==', ['id'], id === null || id === undefined ? -1 : id];
    S.map.setFilter('auswahl_halo', f); S.map.setFilter('auswahl', f);
    S.map.setFilter('nachbarn', ['==', ['id'], -1]);
    WK.bus.emit('auswahl', id, opts);
  }
  function nachbarnZeigen(ids) { S.map.setFilter('nachbarn', ids && ids.length ? ['in', ['id'], ['literal', ids]] : ['==', ['id'], -1]); }
  function pinsSetzen(ids, farben) {
    if (!ids || !ids.length) { S.map.setFilter('pins', ['==', ['id'], -1]); return; }
    S.map.setFilter('pins', ['in', ['id'], ['literal', ids]]);
    const m = ['match', ['id']]; ids.forEach((id, i) => m.push(id, farben[i % farben.length])); m.push('#1b9e77');
    S.map.setPaintProperty('pins', 'line-color', m);
  }
  function fokus(id, opts) {
    opts = opts || {};
    const i = WK.daten.idx(id); if (i === undefined) return;
    const b = WK.daten.S.bboxes;
    const bb = [[b[i * 4], b[i * 4 + 1]], [b[i * 4 + 2], b[i * 4 + 3]]];
    S.map.fitBounds(bb, { padding: opts.padding || 120, maxZoom: opts.maxZoom || 16, duration: opts.duration === undefined ? 600 : opts.duration });
  }
  function fitLK() { S.map.fitBounds(WK.daten.meta.raum.start_bounds_4326, { padding: 10, duration: 500 }); }
  // --- Messwerkzeug (Haversine-Distanz entlang geklickter Punkte) -------------------------
  function messen(an) {
    S.mess.an = an === undefined ? !S.mess.an : !!an;
    if (!S.map.getSource('mess')) {
      S.map.addSource('mess', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      S.map.addLayer({ id: 'mess_linie', type: 'line', source: 'mess', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#e7298a', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      S.map.addLayer({ id: 'mess_punkte', type: 'circle', source: 'mess', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 4.5, 'circle-color': '#e7298a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    }
    if (!S.mess.an) S.map.getCanvas().style.cursor = '';
    else S.map.getCanvas().style.cursor = 'crosshair';
    WK.bus.emit('mess', { an: S.mess.an, laenge: messLaenge() });
  }
  function messLaenge() { let l = 0; for (let i = 1; i < S.mess.punkte.length; i++) l += U.haversine(S.mess.punkte[i - 1], S.mess.punkte[i]); return l; }
  function messPunkt(ll) {
    S.mess.punkte.push(ll);
    const fs = S.mess.punkte.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
    if (S.mess.punkte.length > 1) fs.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: S.mess.punkte } });
    S.map.getSource('mess').setData({ type: 'FeatureCollection', features: fs });
    WK.bus.emit('mess', { an: true, laenge: messLaenge(), n: S.mess.punkte.length });
  }
  function messLeeren() { S.mess.punkte = []; if (S.map.getSource('mess')) S.map.getSource('mess').setData({ type: 'FeatureCollection', features: [] }); WK.bus.emit('mess', { an: S.mess.an, laenge: 0, n: 0 }); }
  function zustand() { const c = S.map.getCenter(); return { lng: +c.lng.toFixed(5), lat: +c.lat.toFixed(5), zoom: +S.map.getZoom().toFixed(2), bearing: +S.map.getBearing().toFixed(1), pitch: +S.map.getPitch().toFixed(1) }; }
  function ansicht(z) { if (!z) return; S.map.jumpTo({ center: [z.lng, z.lat], zoom: z.zoom, bearing: z.bearing || 0, pitch: z.pitch || 0 }); }
  function bboxAnsicht() { const b = S.map.getBounds(); return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; }
  function praedikat() {
    const v = S.variable, m = S.meta || {}, aus = S.ausgeblendet, uf = WK.filter ? WK.filter.praedikat() : null;
    return fe => {
      if (!v) return false;
      const w = fe.properties[v];
      if (w === undefined || w === null) return false;
      if (m.typ !== 'kategorial' && m.gt0 && !(w > 0)) return false;
      if (aus.size && aus.has(String(w))) return false;
      if (uf && !uf(fe)) return false;
      return true;
    };
  }
  function sichtbareIndizes() { return WK.daten.imBereich(bboxAnsicht(), praedikat()); }
  const sichtbarZaehlen = U.debounce(() => { if (!S.bereit) return; S.sichtbar = S.variable ? sichtbareIndizes().length : 0; WK.bus.emit('sichtbar', S.sichtbar); }, 150);

  return {
    S, erzeugen, setVariable, setModus, setFilter, setKategorieAus, kategorieAus, setLabels, setKontext, setPreset, waehlen,
    nachbarnZeigen, pinsSetzen, fokus, fitLK, zustand, ansicht, bboxAnsicht, praedikat, sichtbareIndizes, skalaNeu, anwenden, basisFilter,
    messen, messLeeren, get messAn() { return S.mess.an; },
    setArbeitsansicht, get arbeitsansicht() { return S.arbeitsansicht; },
    get map() { return S.map; }, get variable() { return S.variable; }, get meta() { return S.meta; }, get skala() { return S.skala; },
    get preset() { return S.preset; }, get auswahl() { return S.auswahl; }, get modus() { return S.modus; }, get kontext() { return S.kontext; },
    get kontextLabel() { return S.kontextLabel; }, get lwVorgabe() { return S.lwVorgabe; }, get bereit() { return S.bereit; }, get labels() { return S.labels; },
  };
})();
