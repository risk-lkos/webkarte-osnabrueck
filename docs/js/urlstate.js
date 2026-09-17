/* URL-Zustand (Hash): Variable/Preset, Skala, Schema, Basemap, Ebenen, Filter, Auswahl, Ansicht; Permalink + QR */
WK.url = (() => {
  const U = WK.util;
  const S = { bereit: false, still: false };
  function lesen() {
    const h = location.hash.replace(/^#/, ''); if (!h) return null;
    const p = new URLSearchParams(h), z = {};
    if (p.get('p')) z.preset = p.get('p');
    if (p.get('v')) z.variable = p.get('v');
    if (p.get('m')) z.modus = p.get('m');
    if (p.get('s')) z.schema = p.get('s');
    if (p.get('b')) z.basemap = p.get('b');
    if (p.get('k')) z.kante = +p.get('k');
    if (p.get('c')) { const c = p.get('c').split(',').map(Number); if (c.length >= 3) z.ansicht = { lng: c[0], lat: c[1], zoom: c[2], bearing: c[3] || 0 }; }
    if (p.get('e')) z.ebenen = p.get('e').split(',').filter(Boolean);
    if (p.get('f')) { try { z.filter = JSON.parse(atob(p.get('f'))); } catch (e) { /* ignorieren */ } }
    if (p.get('x')) { try { z.stil = JSON.parse(atob(p.get('x'))); } catch (e) { /* ignorieren */ } }
    if (p.get('l')) z.labels = p.get('l') === '1';
    if (p.get('n')) z.kontext = p.get('n');
    if (p.get('pins')) z.pins = p.get('pins').split(',').map(Number).filter(n => !Number.isNaN(n));
    if (p.get('w')) z.breite = +p.get('w');
    return z;
  }
  function bauen(opts) {
    opts = opts || {};
    const K = WK.karte, p = new URLSearchParams();
    if (K.preset && K.preset.id) p.set('p', K.preset.id); else if (K.variable) p.set('v', K.variable);
    if (K.variable && K.modus && K.modus !== 'p2_p100' && !(K.preset && K.preset.id)) p.set('m', K.modus);
    if (WK.stil.schemaId !== 'arbeit' || WK.stil.geaendert) p.set('s', WK.stil.schemaId);
    if (WK.stil.geaendert && opts.mitStil !== false) { const diff = stilDiff(); if (diff) p.set('x', btoa(unescape(encodeURIComponent(JSON.stringify(diff))))); }
    if (WK.basemaps.aktuell && WK.basemaps.aktuell !== WK.config.karte.startBasemap) p.set('b', WK.basemaps.aktuell);
    const kante = opts.kante !== undefined ? opts.kante : K.auswahl;
    if (kante !== null && kante !== undefined) p.set('k', kante);
    if (K.map) { const z = K.zustand(); p.set('c', `${z.lng},${z.lat},${z.zoom}${z.bearing ? ',' + z.bearing : ''}`); }
    if (WK.layers) { const e = WK.layers.an.filter(x => x !== 'lk_grenze'); if (e.length) p.set('e', e.join(',')); }
    if (WK.filter && WK.filter.aktiv()) p.set('f', btoa(unescape(encodeURIComponent(JSON.stringify(WK.filter.zustand())))));
    if (K.labels) p.set('l', '1');
    if (K.kontext && K.kontext !== 'aktiv' && !(K.preset && K.preset.id)) p.set('n', K.kontext);
    if (WK.vergleich && WK.vergleich.ids.length) p.set('pins', WK.vergleich.ids.join(','));
    if (WK.stil.breitenFaktor !== 1) p.set('w', WK.stil.breitenFaktor);
    return p.toString();
  }
  function stilDiff() {
    // nur Rollen, Kategorien, Breiten, Kontext des aktiven Schemas (kompakt genug fuer die URL)
    const s = WK.stil.schema; return { rollen: s.rollen, kategorien: s.kategorien, breiten: s.breiten, kontext: s.kontext };
  }
  const schreiben = U.debounce(() => { if (!S.bereit || S.still) return; const h = bauen(); history.replaceState(null, '', h ? '#' + h : location.pathname); }, 300);
  function permalink(opts) { const h = bauen(opts); return location.origin + location.pathname + (h ? '#' + h : ''); }
  function init() {
    for (const ev of ['variable', 'ansicht', 'auswahl', 'basemap', 'filter', 'stil', 'ebenen', 'pins', 'kontext']) WK.bus.on(ev, schreiben);
    window.addEventListener('hashchange', () => { if (S.still) return; const z = lesen(); if (z) anwenden(z, true); });
  }
  function anwenden(z, ausHash) {
    S.still = true;
    try {
      if (z && z.schema && WK.stil.schemata[z.schema] && z.schema !== WK.stil.schemaId) WK.stil.setSchema(z.schema);
      if (z && z.stil) WK.stil.importieren(Object.assign({ id: z.schema || 'permalink' }, z.stil));
      if (ausHash) { if (z.preset) WK.karte.setPreset(z.preset, { ohneAnsicht: true }); else if (z.variable) WK.karte.setVariable(z.variable, { modus: z.modus }); if (z.basemap) WK.basemaps.setzen(WK.karte.map, z.basemap, 'kontext_netz'); }
      if (z && z.kontext) WK.karte.setKontext(z.kontext);
      if (z && z.breite && z.breite !== WK.stil.breitenFaktor) WK.stil.setBreitenFaktor(z.breite);
      if (z && z.labels) { WK.karte.setLabels(true); const cb = document.getElementById('cb-labels'); if (cb) cb.checked = true; }
      if (z && z.ebenen && WK.layers) for (const e of z.ebenen) WK.layers.setzen(e, true);
      if (z && z.filter && WK.filter) WK.filter.setZustand(z.filter);
      if (z && z.pins && WK.vergleich) for (const id of z.pins) WK.vergleich.anpinnen(id, true);
      if (z && z.ansicht) WK.karte.ansicht(z.ansicht);
      if (z && z.kante !== undefined && WK.daten.feature(z.kante)) { WK.karte.waehlen(z.kante, { quelle: 'url' }); if (!z.ansicht) WK.karte.fokus(z.kante, { duration: 0 }); }
    } finally { S.still = false; S.bereit = true; }
    schreiben();
  }
  function qrDom(url) {
    const d = U.el('div', { style: { display: 'inline-block', padding: '8px', background: '#fff' } });
    if (typeof QRCode !== 'undefined') { try { new QRCode(d, { text: url, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { d.textContent = 'QR nicht verfügbar'; } }
    else d.textContent = 'QR-Bibliothek fehlt';
    return d;
  }
  return { init, lesen, bauen, permalink, anwenden, qrDom, schreiben };
})();
