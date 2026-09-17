/* Filter: Wertebereich (auch per Legenden-Brushing), Strassentyp, Gemeinde, Baulast, Flags */
WK.filter = (() => {
  const U = WK.util;
  const S = { bereich: null, bereichVariable: null, highway: new Set(), gemeinde: new Set(), baulast: new Set(),
              topDezil: false, mhn2: false, ohneBruecken: false, nurKreis: false, ui: {} };

  function init() {
    const wrap = document.getElementById('filter-inhalt');
    const meta = WK.daten.meta;
    // Wertebereich
    const lo = U.el('input', { type: 'number', step: 'any', style: { width: '78px' } }), hi = U.el('input', { type: 'number', step: 'any', style: { width: '78px' } });
    const setzen = U.el('button', { onclick: () => setBereich([+lo.value, +hi.value]) }, 'setzen');
    const weg = U.el('button', { onclick: () => setBereich(null) }, '✕');
    S.ui.lo = lo; S.ui.hi = hi;
    wrap.appendChild(U.el('div', { class: 'klein' }, 'Wertebereich der aktuellen Variable (oder Bereich in der Legende ziehen):'));
    wrap.appendChild(U.el('div', { class: 'zeile' }, lo, U.el('span', { class: 'klein' }, 'bis'), hi, setzen, weg));
    // Flags
    const flag = (key, label, title) => { const cb = U.el('input', { type: 'checkbox' }); cb.addEventListener('change', () => { S[key] = cb.checked; anwenden(); }); S.ui[key] = cb; return U.el('div', { class: 'zeile' }, U.el('label', { title: title || '' }, cb, ' ' + label)); };
    wrap.appendChild(flag('topDezil', 'nur oberstes Dezil (≥ P90 der Variable)', 'Spitzengruppe wie in der Arbeit'));
    wrap.appendChild(flag('mhn2', 'nur Mehrfachbelastung (mhn_bf ≥ 2)', '106 Kanten mit mindestens zwei Gefahren im obersten Dezil'));
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
    if (!b && p90 === null && !S.mhn2 && !S.ohneBruecken && !S.nurKreis && !S.highway.size && !S.gemeinde.size && !S.baulast.size) return null;
    return fe => {
      const p = fe.properties;
      if (b && !(p[v] >= b[0] && p[v] <= b[1])) return false;
      if (p90 !== null && !(p[v] >= p90)) return false;
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
  function anwenden(still) {
    WK.karte.setFilter(ausdruck());
    const st = document.getElementById('filter-status'); if (st) st.textContent = aktiv() ? 'Filter aktiv' : '';
    if (!still) WK.bus.emit('filter', zustand());
  }
  function zustand() {
    return { b: S.bereich, v: S.bereichVariable, hw: [...S.highway], gm: [...S.gemeinde], bl: [...S.baulast], top: S.topDezil, mhn2: S.mhn2, ob: S.ohneBruecken, kreis: S.nurKreis };
  }
  function setZustand(z) {
    if (!z) return;
    S.bereich = z.b || null; S.bereichVariable = z.v || null;
    S.highway = new Set(z.hw || []); S.gemeinde = new Set(z.gm || []); S.baulast = new Set(z.bl || []);
    S.topDezil = !!z.top; S.mhn2 = !!z.mhn2; S.ohneBruecken = !!z.ob; S.nurKreis = !!z.kreis;
    for (const k of ['topDezil', 'mhn2', 'ohneBruecken', 'nurKreis']) if (S.ui[k]) S.ui[k].checked = S[k];
    for (const k of ['highway', 'gemeinde', 'baulast']) if (S.ui[k]) for (const cb of S.ui[k].querySelectorAll('input')) cb.checked = S[k].has(cb.value);
    if (S.ui.lo) { S.ui.lo.value = S.bereich ? S.bereich[0] : ''; S.ui.hi.value = S.bereich ? S.bereich[1] : ''; }
    anwenden(true);
  }
  function zuruecksetzen() { setZustand({}); WK.bus.emit('filter', zustand()); }
  return { init, setBereich, ausdruck, praedikat, aktiv, anwenden, zustand, setZustand, zuruecksetzen };
})();
