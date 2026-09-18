/* Daten laden und dekodieren: kanten.json (kompakt), Attributtabellen, meta, Paletten, Schemata.
   Baut GeoJSON-Features mit Originalspaltennamen, Indizes (id, Endpunkte, Gitter) und Statistiken. */
WK.daten = (() => {
  const S = {
    meta: null, paletten: null, schemata: {}, features: [], byId: new Map(), index: new Map(),
    n: 0, bboxes: null, gitter: null, endpunkte: null, werteCache: new Map(), sortCache: new Map(),
    kontextCache: new Map(), rasterCache: new Map(), geladen: false,
  };
  const U = WK.util;

  async function ladeJson(pfad) {
    if (window.WK_INLINE && window.WK_INLINE[pfad] !== undefined) {
      const v = window.WK_INLINE[pfad];
      return typeof v === 'string' ? JSON.parse(v) : v;
    }
    const r = await fetch(pfad, { cache: 'default' });
    if (!r.ok) throw new Error(`${pfad}: HTTP ${r.status}`);
    return r.json();
  }

  // Tabelle im Kompaktformat -> {spalte: Array(n)}
  function entpacken(t) {
    const n = t.n, aus = {};
    for (const [spalte, sp] of Object.entries(t.spalten || {})) {
      let arr;
      if (Array.isArray(sp)) arr = sp;
      else {
        arr = new Array(n).fill(null);
        const skalar = !Array.isArray(sp.w);
        for (let k = 0; k < sp.i.length; k++) arr[sp.i[k]] = skalar ? sp.w : sp.w[k];
      }
      const codes = t.codes && t.codes[spalte];
      if (codes) arr = arr.map(v => (v === null || v === undefined) ? null : codes[v]);
      aus[spalte] = arr;
    }
    return aus;
  }

  function kantenBauen(k) {
    const props = entpacken(k), spalten = Object.keys(props);
    const f = Math.pow(10, k.dezimalen), n = k.n;
    const features = new Array(n), bboxes = new Float64Array(n * 4);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const m = k.nk[i], coords = new Array(m);
      let x = k.xy[p++], y = k.xy[p++];
      let w = x, e = x, s = y, no = y;
      coords[0] = [x / f, y / f];
      for (let j = 1; j < m; j++) {
        x += k.xy[p++]; y += k.xy[p++];
        if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > no) no = y;
        coords[j] = [x / f, y / f];
      }
      bboxes[i * 4] = w / f; bboxes[i * 4 + 1] = s / f; bboxes[i * 4 + 2] = e / f; bboxes[i * 4 + 3] = no / f;
      const properties = {};
      for (const sp of spalten) { const v = props[sp][i]; if (v !== null && v !== undefined) properties[sp] = v; }
      features[i] = { type: 'Feature', id: k.id[i], properties, geometry: { type: 'LineString', coordinates: coords } };
    }
    S.features = features; S.n = n; S.bboxes = bboxes;
    S.byId = new Map(); S.index = new Map();
    for (let i = 0; i < n; i++) { S.byId.set(k.id[i], features[i]); S.index.set(k.id[i], i); }
  }

  function attributeJoinen(t) {
    const cols = entpacken(t), spalten = Object.keys(cols);
    let treffer = 0;
    for (let r = 0; r < t.n; r++) {
      const fe = S.byId.get(t.id[r]);
      if (!fe) continue;
      treffer++;
      for (const sp of spalten) { const v = cols[sp][r]; if (v !== null && v !== undefined) fe.properties[sp] = v; }
    }
    return treffer;
  }

  // Gitterindex (0.02° Zellen) fuer Bereichsabfragen
  function gitterBauen() {
    const z = 0.02, g = new Map();
    const key = (cx, cy) => cx * 100000 + cy;
    for (let i = 0; i < S.n; i++) {
      const w = Math.floor(S.bboxes[i * 4] / z), s = Math.floor(S.bboxes[i * 4 + 1] / z);
      const e = Math.floor(S.bboxes[i * 4 + 2] / z), n = Math.floor(S.bboxes[i * 4 + 3] / z);
      for (let cx = w; cx <= e; cx++) for (let cy = s; cy <= n; cy++) {
        const k = key(cx, cy); let arr = g.get(k); if (!arr) { arr = []; g.set(k, arr); } arr.push(i);
      }
    }
    S.gitter = { z, g, key };
  }
  function imBereich(bbox, praedikat) {
    const [w, s, e, n] = bbox, { z, g, key } = S.gitter;
    const gesehen = new Set(), aus = [];
    for (let cx = Math.floor(w / z); cx <= Math.floor(e / z); cx++) for (let cy = Math.floor(s / z); cy <= Math.floor(n / z); cy++) {
      const arr = g.get(key(cx, cy)); if (!arr) continue;
      for (const i of arr) {
        if (gesehen.has(i)) continue; gesehen.add(i);
        const b = S.bboxes;
        if (b[i * 4] > e || b[i * 4 + 2] < w || b[i * 4 + 1] > n || b[i * 4 + 3] < s) continue;
        if (praedikat && !praedikat(S.features[i])) continue;
        aus.push(i);
      }
    }
    return aus;
  }
  function endpunkteBauen() {
    const m = new Map();
    const k = c => `${Math.round(c[0] * 1e5)}|${Math.round(c[1] * 1e5)}`;
    for (let i = 0; i < S.n; i++) {
      const c = S.features[i].geometry.coordinates;
      for (const pt of [c[0], c[c.length - 1]]) { const kk = k(pt); let arr = m.get(kk); if (!arr) { arr = []; m.set(kk, arr); } arr.push(i); }
    }
    S.endpunkte = { m, k };
  }
  function nachbarn(id) {
    const fe = S.byId.get(id); if (!fe || !S.endpunkte) return [];
    const c = fe.geometry.coordinates, aus = new Set();
    for (const pt of [c[0], c[c.length - 1]]) for (const i of (S.endpunkte.m.get(S.endpunkte.k(pt)) || [])) if (S.features[i].id !== id) aus.add(S.features[i].id);
    return [...aus];
  }

  // Werte einer Variablen als Float64Array (NaN = fehlt), gecacht
  function werte(variable) {
    if (S.werteCache.has(variable)) return S.werteCache.get(variable);
    const arr = new Float64Array(S.n);
    for (let i = 0; i < S.n; i++) { const v = S.features[i].properties[variable]; arr[i] = (typeof v === 'number') ? v : NaN; }
    S.werteCache.set(variable, arr);
    return arr;
  }
  function sortiert(variable, gt0) {
    const k = variable + (gt0 ? '>0' : '');
    if (S.sortCache.has(k)) return S.sortCache.get(k);
    const w = werte(variable), tmp = [];
    for (let i = 0; i < S.n; i++) if (!Number.isNaN(w[i]) && (!gt0 || w[i] > 0)) tmp.push(w[i]);
    const arr = Float64Array.from(tmp).sort();
    S.sortCache.set(k, arr); return arr;
  }
  // Rang (1 = hoechster Wert) und n innerhalb der gueltigen Werte
  function rang(variable, id, gt0) {
    const fe = S.byId.get(id); if (!fe) return null;
    const v = fe.properties[variable]; if (typeof v !== 'number') return null;
    const s = sortiert(variable, gt0);
    let lo = 0, hi = s.length;               // erste Position mit s[pos] > v
    while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid] > v) hi = mid; else lo = mid + 1; }
    return { rang: s.length - lo + 1, n: s.length, perzentil: s.length > 1 ? (lo - 1) / (s.length - 1) : 1 };
  }
  function statistik(variable, indizes, gt0) {
    const w = werte(variable), tmp = [];
    const quelle = indizes || null;
    const N = quelle ? quelle.length : S.n;
    for (let j = 0; j < N; j++) { const i = quelle ? quelle[j] : j; const v = w[i]; if (!Number.isNaN(v) && (!gt0 || v > 0)) tmp.push(v); }
    tmp.sort((a, b) => a - b);
    const q = p => U.quantil(tmp, p);
    return { n: tmp.length, min: tmp[0], max: tmp[tmp.length - 1], p2: q(0.02), p98: q(0.98), median: q(0.5), sortiert: tmp, quantil: q };
  }
  function variable(id) { return (S.meta.variablen || []).find(v => v.id === id) || null; }
  function preset(id) { return (S.meta.presets || []).find(p => p.id === id) || null; }
  function spalte(id) { return (S.meta.spalten || {})[id] || null; }
  function gruppe(id) { return (S.meta.gruppen || []).find(g => g.id === id) || null; }

  async function kontext(name) {
    if (S.kontextCache.has(name)) return S.kontextCache.get(name);
    const p = ladeJson(`${WK.config.pfade.kontext}${name}.json`);
    S.kontextCache.set(name, p);
    try { return await p; } catch (e) { S.kontextCache.delete(name); throw e; }
  }
  async function raster(name) {
    if (S.rasterCache.has(name)) return S.rasterCache.get(name);
    const p = ladeJson(`${WK.config.pfade.raster}${name}_3857.json`);
    S.rasterCache.set(name, p);
    return p;
  }
  function rasterBild(name) {
    if (window.WK_INLINE && window.WK_INLINE[`raster/${name}`]) return window.WK_INLINE[`raster/${name}`];
    return `${WK.config.pfade.raster}${name}_3857.png`;
  }

  async function laden(fortschritt) {
    const P = WK.config.pfade, melde = (t, p) => { if (fortschritt) fortschritt(t, p); };
    melde('Lade Katalog …', 3);
    S.meta = await ladeJson(P.meta);
    const schemaIds = (S.meta.stil && S.meta.stil.schemata) || ['arbeit'];
    melde('Lade Farben …', 8);
    const [paletten, ...schemata] = await Promise.all([ladeJson(P.paletten), ...schemaIds.map(id => ladeJson(`${P.schemata}${id}.json`).catch(e => { console.warn('Schema', id, e); return null; }))]);
    S.paletten = paletten;
    schemaIds.forEach((id, i) => { if (schemata[i]) S.schemata[id] = schemata[i]; });
    // Glossar fuer ?-Knoepfe und Anleitung; fehlt die Datei, laeuft die Karte ohne Erklaertexte
    S.glossar = P.glossar ? await ladeJson(P.glossar).catch(e => { console.warn('Glossar', e); return null; }) : null;
    melde('Lade Kantennetz (72.238 Kanten) …', 15);
    const k = await ladeJson(P.kanten);
    melde('Baue Geometrien …', 45);
    await new Promise(r => setTimeout(r, 0));
    kantenBauen(k);
    melde('Lade Kennwerte …', 55);
    const tabellen = await Promise.all(WK.config.attribute.map(d => ladeJson(`./data/${d}`)));
    let schritt = 55;
    for (const t of tabellen) { attributeJoinen(t); schritt += 5; melde('Verknüpfe Kennwerte …', schritt); }
    melde('Baue Indizes …', 90);
    await new Promise(r => setTimeout(r, 0));
    gitterBauen(); endpunkteBauen();
    S.geladen = true;
    melde('Fertig', 100);
    return S;
  }
  function featureCollection() { return { type: 'FeatureCollection', features: S.features }; }
  return {
    S, laden, entpacken, imBereich, nachbarn, werte, sortiert, rang, statistik, variable, preset, spalte, gruppe,
    kontext, raster, rasterBild, featureCollection,
    get meta() { return S.meta; }, get features() { return S.features; }, get anzahl() { return S.n; },
    get paletten() { return S.paletten; }, get schemata() { return S.schemata; }, get byId() { return S.byId; },
    get glossar() { return S.glossar; },
    feature(id) { return S.byId.get(id) || null; },
    idx(id) { return S.index.get(id); },
  };
})();
