/* Verteilung der aktuellen Variable (Canvas) mit Marker der Auswahl; Klick auf Balken = Filterbereich */
WK.histogramm = (() => {
  const U = WK.util;
  const S = { canvas: null, ctx: null, bins: null, ausschnitt: false, hover: null, info: null };
  function init() {
    const wrap = document.getElementById('histogramm-inhalt');
    S.canvas = U.el('canvas', { width: 300, height: 110, title: 'Klick auf einen Balken setzt den Wertebereichsfilter' });
    S.ctx = S.canvas.getContext('2d');
    const cb = U.el('input', { type: 'checkbox' });
    cb.addEventListener('change', () => { S.ausschnitt = cb.checked; zeichnen(); });
    S.info = U.el('div', { class: 'klein' });
    wrap.appendChild(S.canvas);
    wrap.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, cb, ' nur Kanten im Ausschnitt'), S.info));
    S.canvas.addEventListener('click', e => {
      if (!S.bins || !S.bins.grenzen) return;
      const r = S.canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S.canvas.width;
      const i = S.bins.balken.findIndex(b => x >= b.x && x <= b.x + b.w);
      if (i >= 0 && WK.filter && S.bins.grenzen) WK.filter.setBereich([S.bins.grenzen[i], S.bins.grenzen[i + 1]]);
    });
    WK.bus.on('variable', zeichnen); WK.bus.on('stil', zeichnen); WK.bus.on('auswahl', zeichnen);
    WK.bus.on('ansicht', () => { if (S.ausschnitt) zeichnen(); });
    WK.bus.on('hover', h => { S.hover = h ? h.wert : null; markerZeichnen(); });
    if (window.ResizeObserver) new ResizeObserver(() => { S.canvas.width = Math.max(200, Math.floor(S.canvas.clientWidth)); zeichnen(); }).observe(wrap);
  }
  function daten() {
    const K = WK.karte, v = K.variable, m = K.meta; if (!v || !m) return null;
    if (m.typ === 'kategorial') {
      const werte = m.werte || [], anzahl = {};
      if (S.ausschnitt) { for (const i of K.sichtbareIndizes()) { const w = String(WK.daten.features[i].properties[v]); anzahl[w] = (anzahl[w] || 0) + 1; } }
      else Object.assign(anzahl, m.anzahl || {});
      const farben = WK.stil.kategorieFarben(v, werte);
      return { typ: 'kategorial', labels: werte, anzahl: werte.map(w => anzahl[String(w)] || 0), farben: werte.map(w => farben[String(w)]) };
    }
    let grenzen, anzahl;
    if (S.ausschnitt) {
      const st = WK.daten.statistik(v, K.sichtbareIndizes(), m.gt0);
      if (!st.n) return null;
      const k = 30, lo = st.min, hi = st.max || lo + 1;
      grenzen = Array.from({ length: k + 1 }, (_, i) => lo + (hi - lo) * i / k);
      anzahl = new Array(k).fill(0);
      for (const x of st.sortiert) { let i = Math.min(k - 1, Math.floor((x - lo) / ((hi - lo) || 1) * k)); anzahl[i]++; }
    } else if (m.histogramm) { grenzen = m.histogramm.grenzen; anzahl = m.histogramm.anzahl; }
    else return null;
    return { typ: 'kontinuierlich', grenzen, anzahl };
  }
  function zeichnen() {
    const ctx = S.ctx; if (!ctx) return;
    const W = S.canvas.width, H = S.canvas.height, K = WK.karte;
    ctx.clearRect(0, 0, W, H);
    const d = daten(); S.bins = null;
    if (!d) { S.info.textContent = ''; return; }
    const padL = 6, padR = 6, padB = 16, padT = 6, innenW = W - padL - padR, innenH = H - padT - padB;
    const max = Math.max(1, ...d.anzahl);
    const balken = [];
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg') || '#1c1e21';
    ctx.font = '10px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = fg; ctx.textAlign = 'center';
    if (d.typ === 'kategorial') {
      const n = d.labels.length, bw = innenW / n;
      d.labels.forEach((l, i) => {
        const h = d.anzahl[i] / max * innenH, x = padL + i * bw + 1, y = padT + innenH - h;
        ctx.fillStyle = d.farben[i] || '#999'; ctx.fillRect(x, y, bw - 2, h);
        balken.push({ x, w: bw - 2 });
        ctx.fillStyle = fg; ctx.fillText(String(l).slice(0, 8), x + bw / 2 - 1, H - 4);
      });
      S.info.textContent = `${U.formatZahl(d.anzahl.reduce((a, b) => a + b, 0), 0)} Kanten`;
    } else {
      const n = d.anzahl.length, bw = innenW / n, sk = K.skala, m = K.meta;
      for (let i = 0; i < n; i++) {
        const mitte = (d.grenzen[i] + d.grenzen[i + 1]) / 2;
        const h = Math.sqrt(d.anzahl[i] / max) * innenH, x = padL + i * bw, y = padT + innenH - h;
        ctx.fillStyle = WK.stil.farbe(K.variable, mitte, sk, m) || '#999'; ctx.fillRect(x, y, Math.max(1, bw - 0.5), h);
        balken.push({ x, w: bw });
      }
      ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.fillText(U.formatKurz(d.grenzen[0]), padL, H - 4);
      ctx.textAlign = 'right'; ctx.fillText(U.formatKurz(d.grenzen[n]), W - padR, H - 4);
      ctx.textAlign = 'center'; ctx.fillText('Höhe ∝ √Anzahl', W / 2, H - 4);
      S.info.textContent = `${U.formatZahl(d.anzahl.reduce((a, b) => a + b, 0), 0)} Kanten · ${U.formatKurz(d.grenzen[0])} bis ${U.formatKurz(d.grenzen[n])}`;
    }
    S.bins = { balken, grenzen: d.typ === 'kontinuierlich' ? d.grenzen : null, padL, innenW, padT, innenH };
    markerZeichnen(true);
  }
  function markerZeichnen(ohneNeu) {
    if (!S.bins || !S.bins.grenzen) return;
    if (!ohneNeu) { zeichnen(); return; }
    const ctx = S.ctx, K = WK.karte, g = S.bins.grenzen, lo = g[0], hi = g[g.length - 1];
    const zeichneMarker = (wert, farbe, breite) => {
      if (typeof wert !== 'number') return;
      const x = S.bins.padL + (wert - lo) / ((hi - lo) || 1) * S.bins.innenW;
      ctx.strokeStyle = farbe; ctx.lineWidth = breite; ctx.beginPath(); ctx.moveTo(x, S.bins.padT); ctx.lineTo(x, S.bins.padT + S.bins.innenH); ctx.stroke();
    };
    if (K.auswahl !== null && K.variable) { const fe = WK.daten.feature(K.auswahl); if (fe) zeichneMarker(fe.properties[K.variable], WK.stil.kontext('auswahl'), 2); }
    zeichneMarker(S.hover, '#000', 1);
  }
  return { init, zeichnen };
})();
