/* Skalenmodi: p2_p100 (wie in der Arbeit), fest, quantile, gleich, ausschnitt, quintil, kategorial, einfarbig */
WK.klassifikation = (() => {
  const U = WK.util;
  const MODI = [
    { id: 'p2_p100', label: 'wie in der Arbeit (P2–P100)' },
    { id: 'fest', label: 'feste Grenzen' },
    { id: 'quantile', label: 'Quantile (gleich viele Kanten je Klasse)' },
    { id: 'gleich', label: 'gleiche Intervalle' },
    { id: 'ausschnitt', label: 'an Kartenausschnitt anpassen (P2–P98 sichtbar)' },
  ];
  function klassenLabel(von, bis, dez) { return `${U.formatZahl(von, dez)} – ${U.formatZahl(bis, dez)}`; }
  function dezimalenFuer(span) { return span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3; }

  function skala(variable, modus, opts) {
    opts = opts || {};
    const meta = WK.daten.variable(variable) || { typ: 'kontinuierlich', gt0: false };
    const rolle = opts.rolle || meta.rolle || 'pluvial';
    const basis = { modus, rolle, breiteNachWert: !!opts.breiteNachWert, variable };
    if (meta.typ === 'kategorial' || modus === 'kategorial') return Object.assign(basis, { modus: 'kategorial' });
    if (modus === 'einfarbig') return Object.assign(basis, { modus: 'einfarbig', t: opts.t, farbe: opts.farbe });
    if (meta.typ === 'quintil' && (modus === 'quintil' || !modus)) return Object.assign(basis, { modus: 'quintil', vmin: 0, vmax: 100 });
    if (modus === 'fest') {
      const vmin = opts.vmin !== undefined ? +opts.vmin : 0, vmax = opts.vmax !== undefined ? +opts.vmax : 1;
      return Object.assign(basis, { modus: 'kontinuierlich', quelle: 'fest', vmin, vmax: vmax > vmin ? vmax : vmin + 1e-9 });
    }
    if (modus === 'quantile' || modus === 'gleich') {
      const k = Math.max(2, Math.min(12, +opts.k || 5));
      const st = WK.daten.statistik(variable, opts.indizes || null, meta.gt0);
      if (!st.n) return Object.assign(basis, { modus: 'kontinuierlich', vmin: 0, vmax: 1 });
      const r = WK.stil.rampe(rolle), grenzen = [];
      for (let i = 0; i <= k; i++) grenzen.push(modus === 'quantile' ? st.quantil(i / k) : st.min + (st.max - st.min) * i / k);
      const dez = dezimalenFuer(st.max - st.min);
      const klassen = [];
      for (let i = 0; i < k; i++) klassen.push({ von: grenzen[i], bis: grenzen[i + 1], farbe: r.farbe((i + 0.5) / k), label: klassenLabel(grenzen[i], grenzen[i + 1], dez), lw: WK.stil.breite(variable, opts.lw) });
      return Object.assign(basis, { modus: 'klassen', quelle: modus, k, klassen, vmin: st.min, vmax: st.max });
    }
    if (modus === 'ausschnitt') {
      const st = WK.daten.statistik(variable, opts.indizes || null, meta.gt0);
      if (st.n >= 2 && st.p98 > st.p2) return Object.assign(basis, { modus: 'kontinuierlich', quelle: 'ausschnitt', vmin: st.p2, vmax: st.p98, n: st.n });
    }
    // Standard: P2–P100 der gueltigen Werte (Perzentilzuschnitt wie abb_helfer.choro)
    const sd = meta.skala_default;
    if (sd && sd.vmin !== undefined && sd.vmax !== undefined && sd.vmax > sd.vmin) return Object.assign(basis, { modus: 'kontinuierlich', quelle: 'p2_p100', vmin: sd.vmin, vmax: sd.vmax });
    const st = WK.daten.statistik(variable, null, meta.gt0);
    const vmin = st.n ? st.p2 : 0, vmax = st.n ? st.max : 1;
    return Object.assign(basis, { modus: 'kontinuierlich', quelle: 'p2_p100', vmin, vmax: vmax > vmin ? vmax : vmin + 1e-9 });
  }
  return { MODI, skala };
})();
