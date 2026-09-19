/* Hintergrundkarten (Raster-WMTS/WMS, freie Daten) fuer Haupt- und Detailkarte */
WK.basemaps = (() => {
  const S = { aktuell: {}, deckkraft: 1.0, verfuegbar: {} };
  function liste() { return (WK.daten.meta.basemaps || []); }
  function def(id) { return liste().find(b => b.id === id) || null; }
  function standard() { const b = liste().find(b => b.standard); return b ? b.id : (liste()[0] || {}).id; }

  // Die Hintergrundkarte gehoert ganz nach unten: direkt ueber den Kartenhintergrund, also vor die Ebene, die dort
  // gerade als naechste liegt. Frueher wurde sie vor das Kontextnetz gesetzt; dort sitzen aber auch die Overlays
  // (WMS, HQextrem, Raster), und eine spaeter gewaehlte Hintergrundkarte lag dann ueber ihnen.
  function unterste(map, vorId) {
    const folge = typeof map.getLayersOrder === 'function' ? map.getLayersOrder() : ((map.style && map.style._order) || []);
    const i = folge.indexOf('hintergrund');
    const ziel = folge.find((id, j) => j > i && id !== 'basemap');
    return ziel || vorId;
  }
  function setzen(map, id, vorId, schluessel) {
    schluessel = schluessel || 'haupt';
    const b = def(id);
    if (!b) return false;
    const layerId = 'basemap';
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    vorId = unterste(map, vorId);
    if (b.typ !== 'keiner' && !(navigator.onLine === false && !window.WK_INLINE_NUR)) {
      const srcId = 'bm_' + b.id;
      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'raster', tiles: b.tiles, tileSize: b.tileSize || 256, maxzoom: b.maxzoom || 18, attribution: b.attribution || '' });
      }
      map.addLayer({ id: layerId, type: 'raster', source: srcId, paint: { 'raster-opacity': S.deckkraft, 'raster-fade-duration': 0 } }, vorId);
    }
    S.aktuell[schluessel] = id;
    if (schluessel === 'haupt') WK.bus.emit('basemap', id);
    return true;
  }
  function deckkraft(map, wert) {
    S.deckkraft = Math.max(0, Math.min(1, +wert));
    if (map.getLayer('basemap')) map.setPaintProperty('basemap', 'raster-opacity', S.deckkraft);
  }
  function attribution(id) { const b = def(id); return b ? (b.attribution || '') : ''; }
  // Erreichbarkeit einer Kachel pruefen (nicht erreichbare Dienste im Menue ausgrauen)
  async function verfuegbarkeitPruefen() {
    const z = 10, x = 534, y = 336;   // Landkreis Osnabrueck
    const bboxes = { z, x, y };
    await Promise.all(liste().filter(b => b.typ !== 'keiner').map(async b => {
      let url = b.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y);
      if (url.includes('{bbox-epsg-3857}')) {
        const n = Math.pow(2, z), w = x / n * 40075016.686 - 20037508.343, e = (x + 1) / n * 40075016.686 - 20037508.343;
        const nn = 20037508.343 - y / n * 40075016.686, s = 20037508.343 - (y + 1) / n * 40075016.686;
        url = url.replace('{bbox-epsg-3857}', `${w},${s},${e},${nn}`);
      }
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(url, { mode: 'cors', signal: ctrl.signal }); clearTimeout(t);
        S.verfuegbar[b.id] = r.ok;
      } catch (e) { S.verfuegbar[b.id] = false; }
    }));
    WK.bus.emit('basemaps-geprueft', S.verfuegbar);
    return S.verfuegbar;
  }
  return { S, liste, def, standard, setzen, deckkraft, attribution, verfuegbarkeitPruefen,
           get aktuell() { return S.aktuell.haupt; } };
})();
