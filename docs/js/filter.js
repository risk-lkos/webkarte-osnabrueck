/* Filter: Wertebereich (auch per Legenden-Brushing), Top N (gesamt oder je Baulastebene), Strassentyp, Gemeinde, Baulast, Flags */
WK.filter = (() => {
  const U = WK.util;
  const S = { bereich: null, bereichVariable: null, highway: new Set(), gemeinde: new Set(), baulast: new Set(),
              topDezil: false, mhn2: false, ohneBruecken: false, nurKreis: false, topN: null, topBaulast: null, topCache: null, ui: {} };

  // Kanten der Top-N-Auswahl: die N hoechsten gueltigen Werte der Variablen (globaler Index), optional nur
  // innerhalb einer Baulastebene (Rangregel wie im AP7-Vermerk "Top-25 Hitzekanten je Baulastebene":
  // Listen nach dem globalen Index, je Ebene die hoechsten Werte). Bei Wertgleichheit entscheidet die
  // kleinere Kanten-id, damit es genau N Kanten bleiben.
  function topAuswahl(v) {
    if (!S.topN || !v) return null;
    const m = WK.daten.variable(v); if (!m || m.typ === 'kategorial') return null;
    const key = `${v}|${S.topN}|${S.topBaulast || ''}`;
    if (S.topCache && S.topCache.key === key) return S.topCache;
    const arr = [];
    for (const fe of WK.daten.features) {
      const p = fe.properties, w = p[v];
      if (typeof w !== 'number' || Number.isNaN(w) || (m.gt0 && !(w > 0))) continue;
      if (S.topBaulast && p.baulast !== S.topBaulast) continue;
      arr.push([w, fe.id]);
    }
    arr.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const ids = arr.slice(0, S.topN).map(x => x[1]);
    S.topCache = { key, ids, set: new Set(ids), kandidaten: arr.length };
    return S.topCache;
  }
  function ebeneLabel(id) { const e = (WK.config.baulastEbenen || []).find(x => x.id === id); return e ? e.label : id; }

  // Punktmarker fuer Top-N-Kanten: Kanten unter etwa 0,4 px Laenge fallen bei kleinem Zoom aus den Kacheln
  // (in der Landkreis-Ansicht alles unter rund 150 m). Der Marker am Kantenmittelpunkt haelt sie in der
  // Uebersicht sichtbar, traegt die Datenfarbe der Kante und blendet beim Hineinzoomen aus.
  const MARKER_MAX = 500;
  function mittelpunkt(co) { return co.length === 2 ? [(co[0][0] + co[1][0]) / 2, (co[0][1] + co[1][1]) / 2] : co[Math.floor(co.length / 2)]; }
  function markerAnlegen(map) {
    S.map = map;
    const aus = ['interpolate', ['linear'], ['zoom'], 12, 1, 14, 0];
    map.addSource('top_marker', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'top_marker', type: 'circle', source: 'top_marker', maxzoom: 14,
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 10, 5, 13, 6], 'circle-color': '#888888', 'circle-opacity': aus,
               'circle-stroke-color': WK.stil.kontext('umriss'), 'circle-stroke-width': 1, 'circle-stroke-opacity': aus } }, map.getLayer('pins') ? 'pins' : undefined);
  }
  function markerSetzen() {
    const map = S.map; if (!map || !map.getSource('top_marker')) return;
    const K = WK.karte, top = S.topMarker ? topAuswahl(K.variable) : null;
    let feats = [];
    if (top && top.ids.length <= MARKER_MAX) {
      const pr = K.praedikat();
      feats = top.ids.map(id => WK.daten.feature(id)).filter(fe => fe && pr(fe))
        .map(fe => ({ type: 'Feature', id: fe.id, properties: fe.properties, geometry: { type: 'Point', coordinates: mittelpunkt(fe.geometry.coordinates) } }));
    }
    S.markerAnzahl = feats.length;
    map.getSource('top_marker').setData({ type: 'FeatureCollection', features: feats });
    if (feats.length && K.variable && K.skala) {
      map.setPaintProperty('top_marker', 'circle-color', WK.stil.ausdruckFarbe(K.variable, K.skala, K.meta));
      // ueberlappende Marker (benachbarte Abschnitte derselben Strasse): der hoehere Wert liegt oben und ist anklickbar
      map.setLayoutProperty('top_marker', 'circle-sort-key', ['to-number', ['get', K.variable], 0]);
    }
    map.setPaintProperty('top_marker', 'circle-stroke-color', WK.stil.kontext('umriss'));
  }
  const markerNeu = U.debounce(markerSetzen, 40);

  function init(map) {
    const wrap = document.getElementById('filter-inhalt');
    const meta = WK.daten.meta;
    const gemerkt = U.ls('wk.topmarker'); S.topMarker = gemerkt === null || gemerkt === undefined ? true : !!gemerkt;
    if (map) { markerAnlegen(map); WK.bus.on('variable', markerNeu); WK.bus.on('stil', markerNeu); }
    // Wertebereich
    const lo = U.el('input', { type: 'number', step: 'any', style: { width: '78px' } }), hi = U.el('input', { type: 'number', step: 'any', style: { width: '78px' } });
    const setzen = U.el('button', { onclick: () => setBereich([+lo.value, +hi.value]) }, 'setzen');
    const weg = U.el('button', { onclick: () => setBereich(null) }, '✕');
    S.ui.lo = lo; S.ui.hi = hi;
    wrap.appendChild(U.el('div', { class: 'klein' }, 'Wertebereich der aktuellen Variable (oder Bereich in der Legende ziehen):'));
    wrap.appendChild(U.el('div', { class: 'zeile' }, lo, U.el('span', { class: 'klein' }, 'bis'), hi, setzen, weg, WK.glossar ? WK.glossar.knopf({ bedienung: 'filter_bereich' }) : null));
    // Flags
    const hk = key => (WK.glossar ? WK.glossar.knopf({ bedienung: key }) : null);
    const flag = (key, label, title, hilfe) => { const cb = U.el('input', { type: 'checkbox' }); cb.addEventListener('change', () => { S[key] = cb.checked; anwenden(); }); S.ui[key] = cb; return U.el('div', { class: 'zeile' }, U.el('label', { title: title || '' }, cb, ' ' + label), hilfe ? hk(hilfe) : null); };
    // Top N (gesamt oder innerhalb einer Baulastebene)
    const topCb = U.el('input', { type: 'checkbox' }), topInp = U.el('input', { type: 'number', min: 1, max: 5000, value: 25, style: { width: '70px' } });
    const topKl = U.el('select', { title: 'Rang über das ganze Netz oder nur unter den Straßen einer Baulastebene' },
      U.el('option', { value: '' }, 'im ganzen Netz'), ...(WK.config.baulastEbenen || []).map(e => U.el('option', { value: e.id }, 'unter: ' + e.label)));
    const topAnwenden = () => { S.topN = topCb.checked ? Math.max(1, +topInp.value || 25) : null; S.topBaulast = S.topN && topKl.value ? topKl.value : null; anwenden(); };
    topCb.addEventListener('change', topAnwenden); topInp.addEventListener('change', () => { if (topCb.checked) topAnwenden(); });
    topKl.addEventListener('change', () => { if (topKl.value) topCb.checked = true; if (topCb.checked) topAnwenden(); });
    S.ui.topCb = topCb; S.ui.topInp = topInp; S.ui.topKl = topKl;
    wrap.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { title: 'Nur die N Kanten mit den höchsten Werten der aktuellen Variable (wie die Top-25-Listen der Arbeit)' }, topCb, ' nur Top'), topInp, U.el('span', { class: 'klein' }, 'der Variable')));
    wrap.appendChild(U.el('div', { class: 'zeile' }, U.el('span', { class: 'klein' }, 'Rang'), topKl, hk('filter_topn')));
    const markerCb = U.el('input', { type: 'checkbox', checked: S.topMarker });
    markerCb.addEventListener('change', () => { S.topMarker = markerCb.checked; U.ls('wk.topmarker', S.topMarker); markerNeu(); });
    wrap.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { title: 'Kurze Kanten sind in der Übersicht kleiner als ein Pixel und würden verschwinden. Der Punkt am Kantenmittelpunkt trägt die Farbe der Kante und blendet ab Zoom 12 bis 14 aus.' }, markerCb, ' Top-Kanten in der Übersicht mit Punkt markieren')));
    wrap.appendChild(flag('topDezil', 'nur oberstes Dezil (≥ P90 der Variable)', 'Spitzengruppe wie in der Arbeit', 'filter_dezil'));
    wrap.appendChild(flag('mhn2', 'nur Mehrfachbelastung (mhn_bf ≥ 2)', '106 Kanten mit mindestens zwei Gefahren im obersten Dezil', 'filter_mhn'));
    wrap.appendChild(flag('ohneBruecken', 'Brücken und Tunnel ausblenden'));
    wrap.appendChild(flag('nurKreis', 'nur Kanten im Landkreis'));
    // Kategorien
    const katBlock = (key, label, werte) => {
      const d = U.el('details', {}, U.el('summary', { class: 'klein' }, label));
      const l = U.el('div', { class: 'liste' });
      for (const w of werte) {
        const cb = U.el('input', { type: 'checkbox', value: w });
        cb.addEventListener('change', () => { if (cb.checked) S[key].add(w); else S[key].delete(w); anwenden(); });
        l.appendChild(U.el('label', {}, cb, ' ' + w));
      }
      d.appendChild(l); S.ui[key] = l; return d;
    };
    const vHighway = (meta.variablen.find(v => v.id === 'highway') || {}).werte || [];
    const vGemeinde = ((meta.variablen.find(v => v.id === 'gemeinde') || {}).werte || []).slice().sort((a, b) => a.localeCompare(b, 'de'));
    const vBaulast = (meta.variablen.find(v => v.id === 'baulast') || {}).werte || [];
    wrap.appendChild(katBlock('baulast', 'Baulastträger (Auswahl = nur diese)', vBaulast));
    wrap.appendChild(katBlock('highway', 'Straßentyp (Auswahl = nur diese)', vHighway));
    wrap.appendChild(katBlock('gemeinde', 'Gemeinde (Auswahl = nur diese)', vGemeinde));
    wrap.appendChild(U.el('div', { class: 'zeile' }, U.el('button', { onclick: zuruecksetzen }, 'Filter zurücksetzen'), U.el('span', { class: 'klein', id: 'filter-status' }, '')));
    WK.bus.on('variable', info => { if (S.bereichVariable && info.variable !== S.bereichVariable) { S.bereich = null; S.bereichVariable = null; lo.value = ''; hi.value = ''; anwenden(true); } });
  }
  function setBereich(b) {
    S.bereich = b; S.bereichVariable = b ? WK.karte.variable : null;
    if (S.ui.lo) { S.ui.lo.value = b ? +b[0].toFixed(5) : ''; S.ui.hi.value = b ? +b[1].toFixed(5) : ''; }
    anwenden();
  }
  function ausdruck() {
    const v = WK.karte.variable, teile = [];
    if (S.bereich && v && S.bereichVariable === v) teile.push(['all', ['>=', ['to-number', ['get', v], 0], S.bereich[0]], ['<=', ['to-number', ['get', v], 0], S.bereich[1]]]);
    if (S.topDezil && v) { const m = WK.daten.variable(v); if (m && m.p90 !== undefined) teile.push(['>=', ['to-number', ['get', v], 0], m.p90]); }
    const top = topAuswahl(v); if (top) teile.push(['in', ['id'], ['literal', top.ids]]);
    if (S.mhn2) teile.push(['>=', ['to-number', ['get', 'mhn_bf'], 0], 2]);
    if (S.ohneBruecken) teile.push(['all', ['!', ['has', 'bruecke']], ['!', ['has', 'tunnel']]]);
    if (S.nurKreis) teile.push(['has', 'im_kreis']);
    for (const [key, sp] of [['highway', 'highway'], ['gemeinde', 'gemeinde'], ['baulast', 'baulast']]) if (S[key].size) teile.push(['in', ['get', sp], ['literal', [...S[key]]]]);
    if (!teile.length) return null;
    return teile.length === 1 ? teile[0] : ['all', ...teile];
  }
  function praedikat() {
    const v = WK.karte.variable, m = v ? WK.daten.variable(v) : null;
    const b = S.bereich && v && S.bereichVariable === v ? S.bereich : null;
    const p90 = S.topDezil && m ? m.p90 : null;
    const top = topAuswahl(v);
    if (!b && p90 === null && !top && !S.mhn2 && !S.ohneBruecken && !S.nurKreis && !S.highway.size && !S.gemeinde.size && !S.baulast.size) return null;
    return fe => {
      const p = fe.properties;
      if (b && !(p[v] >= b[0] && p[v] <= b[1])) return false;
      if (p90 !== null && !(p[v] >= p90)) return false;
      if (top && !top.set.has(fe.id)) return false;
      if (S.mhn2 && !(p.mhn_bf >= 2)) return false;
      if (S.ohneBruecken && (p.bruecke || p.tunnel)) return false;
      if (S.nurKreis && !p.im_kreis) return false;
      if (S.highway.size && !S.highway.has(p.highway)) return false;
      if (S.gemeinde.size && !S.gemeinde.has(p.gemeinde)) return false;
      if (S.baulast.size && !S.baulast.has(p.baulast)) return false;
      return true;
    };
  }
  function aktiv() { return !!praedikat(); }
  function statusText() {
    if (!aktiv()) return '';
    if (!S.topN) return 'Filter aktiv';
    return `Filter aktiv (Top ${S.topN}${S.topBaulast ? ' ' + ebeneLabel(S.topBaulast) : ''})`;
  }
  function anwenden(still) {
    WK.karte.setFilter(ausdruck());
    const st = document.getElementById('filter-status'); if (st) st.textContent = statusText();
    markerNeu();
    if (!still) WK.bus.emit('filter', zustand());
  }
  function uiTop() {
    if (!S.ui.topCb) return;
    S.ui.topCb.checked = !!S.topN; if (S.topN) S.ui.topInp.value = S.topN;
    S.ui.topKl.value = S.topBaulast || '';
  }
  // n = Anzahl (null = aus); baulast = optionale Baulastebene, innerhalb der gereiht wird
  function setTopN(n, baulast) {
    S.topN = n ? Math.max(1, +n) : null;
    S.topBaulast = S.topN && baulast ? baulast : null;
    uiTop();
    anwenden();
  }
  function zustand() {
    return { b: S.bereich, v: S.bereichVariable, hw: [...S.highway], gm: [...S.gemeinde], bl: [...S.baulast], top: S.topDezil, mhn2: S.mhn2, ob: S.ohneBruecken, kreis: S.nurKreis, top_n: S.topN, top_bl: S.topBaulast };
  }
  function setZustand(z) {
    if (!z) return;
    S.bereich = z.b || null; S.bereichVariable = z.v || null;
    S.highway = new Set(z.hw || []); S.gemeinde = new Set(z.gm || []); S.baulast = new Set(z.bl || []);
    S.topDezil = !!z.top; S.mhn2 = !!z.mhn2; S.ohneBruecken = !!z.ob; S.nurKreis = !!z.kreis; S.topN = z.top_n || null;
    S.topBaulast = (S.topN && z.top_bl) || null;
    uiTop();
    for (const k of ['topDezil', 'mhn2', 'ohneBruecken', 'nurKreis']) if (S.ui[k]) S.ui[k].checked = S[k];
    for (const k of ['highway', 'gemeinde', 'baulast']) if (S.ui[k]) for (const cb of S.ui[k].querySelectorAll('input')) cb.checked = S[k].has(cb.value);
    if (S.ui.lo) { S.ui.lo.value = S.bereich ? S.bereich[0] : ''; S.ui.hi.value = S.bereich ? S.bereich[1] : ''; }
    anwenden(true);
  }
  function zuruecksetzen() { setZustand({}); WK.bus.emit('filter', zustand()); }
  return { init, setBereich, setTopN, topAuswahl, ausdruck, praedikat, aktiv, anwenden, zustand, setZustand, zuruecksetzen,
           get topN() { return S.topN; }, get topBaulast() { return S.topBaulast; }, get markerAnzahl() { return S.markerAnzahl || 0; } };
})();
