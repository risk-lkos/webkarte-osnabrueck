/* Legende: DOM (Karte), Canvas (PNG-Export) und SVG (SVG-Export) aus einer Spezifikation von WK.stil.legendeSpec */
WK.legende = (() => {
  const U = WK.util;
  const S = { el: null, spec: null, marker: null, brush: null };

  function init() {
    S.el = document.getElementById('legende');
    WK.bus.on('variable', neu);
    WK.bus.on('stil', neu);
    WK.bus.on('ebenen', () => { const p = WK.karte.preset; if (p && (p.raster || p.overlay)) neu(); });
    WK.bus.on('kontext', neu);
    WK.bus.on('hover', h => marker(h ? h.wert : null));
    WK.bus.on('auswahl', () => {});
  }
  function aktuelleSpec() {
    const K = WK.karte, p = K.preset;
    if (!K.variable) {
      if (p && p.raster && WK.layers && WK.layers.rasterSpec) return WK.layers.rasterSpec(p.raster);
      if (p && p.overlay && WK.layers && WK.layers.overlaySpec) return WK.layers.overlaySpec(p);
      return null;
    }
    const opts = { lw: K.lwVorgabe };
    if (p) { opts.label = p.legende_label; opts.titel = p.legende_titel; opts.format = p.legende_format; }
    return WK.stil.legendeSpec(K.variable, K.skala, K.meta, opts);
  }
  function neu() {
    S.spec = aktuelleSpec();
    zeichnenDom(S.spec);
  }
  function zeichnenDom(spec) {
    const el = S.el; if (!el) return;
    el.innerHTML = '';
    if (!spec) { el.hidden = true; return; }
    el.hidden = false;
    const K = WK.karte;
    el.appendChild(U.el('div', { class: 'titel' }, spec.titel || spec.label || '', K.variable && WK.glossar ? WK.glossar.knopf({ variable: K.variable }) : null));
    if (spec.typ === 'kontinuierlich') {
      const wrap = U.el('div', { class: 'balken-wrap', style: { background: spec.css } });
      S.marker = U.el('div', { class: 'marker', hidden: true });
      wrap.appendChild(S.marker);
      S.brush = U.el('div', { class: 'brush', hidden: true });
      wrap.appendChild(S.brush);
      el.appendChild(wrap);
      const ticks = U.el('div', { class: 'ticks' });
      const span = (spec.vmax - spec.vmin) || 1e-9;
      const dez = span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3;
      for (const t of spec.ticks) { const x = (t - spec.vmin) / span * 100; if (x < -1 || x > 101) continue; ticks.appendChild(U.el('span', { style: { left: x + '%' } }, U.formatZahl(t, dez))); }
      el.appendChild(ticks);
      const fuss = [];
      if (spec.einheit) fuss.push(spec.einheit);
      if (K.skala && K.skala.quelle === 'p2_p100') fuss.push('Skala P2–P100 wie in der Arbeit');
      if (K.skala && K.skala.quelle === 'ausschnitt') fuss.push(`Skala an Ausschnitt angepasst (P2–P98, n = ${K.skala.n})`);
      if (K.skala && K.skala.quelle === 'fest') fuss.push('feste Skala');
      if (spec.gamma && spec.gamma !== 1) fuss.push(`Gamma ${spec.gamma}`);
      if (fuss.length) el.appendChild(U.el('div', { class: 'fuss' }, fuss.join(' · ')));
      brushAktivieren(wrap, spec);
    } else if (spec.typ === 'kategorial' || spec.typ === 'klassen') {
      const klassen = spec.typ === 'kategorial' ? spec.klassen.slice().reverse() : spec.klassen.slice().reverse();
      for (const k of klassen) {
        const wert = spec.typ === 'kategorial' ? k.wert : null;
        const zeile = U.el('div', { class: 'kat' + (wert !== null && K.kategorieAus(wert) ? ' aus' : ''), title: wert !== null ? 'Klick: Klasse aus-/einblenden' : '' },
          U.el('span', { class: 'linie', style: { borderTopColor: k.farbe, borderTopWidth: Math.max(1.5, Math.min(8, (k.lw || 1) * 2.2)) + 'px' } }),
          U.el('span', {}, k.label), k.n !== undefined ? U.el('span', { class: 'n' }, U.formatZahl(k.n, 0)) : null);
        if (wert !== null) zeile.addEventListener('click', () => { K.setKategorieAus(wert, !K.kategorieAus(wert)); });
        el.appendChild(zeile);
      }
      if (spec.einheit) el.appendChild(U.el('div', { class: 'fuss' }, spec.einheit));
    } else if (spec.typ === 'quintil') {
      el.appendChild(U.el('div', { class: 'fuss' }, spec.untertitel));
      const g = U.el('div', { class: 'quintil' });
      for (const q of spec.quintile.slice().reverse()) {
        g.appendChild(U.el('div', { class: 'verlauf', style: { background: `linear-gradient(to right, ${q.farben[0]}, ${q.farben[1]})` } }));
        g.appendChild(U.el('span', {}, `${q.kz} (${q.spanne}) – ${q.semantik}`));
        g.appendChild(U.el('span', { class: 'n' }, ''));
      }
      el.appendChild(g);
    } else if (spec.typ === 'einfarbig') {
      el.appendChild(U.el('div', { class: 'kat' }, U.el('span', { class: 'linie', style: { borderTopColor: spec.farbe, borderTopWidth: '3px' } }), U.el('span', {}, spec.label)));
    } else if (spec.typ === 'raster') {
      const wrap = U.el('div', { class: 'balken-wrap', style: { background: spec.css } });
      el.appendChild(wrap);
      const ticks = U.el('div', { class: 'ticks' });
      const span = (spec.vmax - spec.vmin) || 1;
      for (const t of spec.ticks) ticks.appendChild(U.el('span', { style: { left: ((t - spec.vmin) / span * 100) + '%' } }, U.formatZahl(t, 0)));
      el.appendChild(ticks);
      el.appendChild(U.el('div', { class: 'fuss' }, spec.fuss || ''));
    }
    const kontextZeile = kontextLegende();
    if (kontextZeile) el.appendChild(kontextZeile);
  }
  function kontextLegende() {
    const K = WK.karte, teile = [];
    teile.push(U.el('div', { class: 'kat' }, U.el('span', { class: 'linie', style: { borderTopColor: WK.stil.kontext('umriss'), borderTopWidth: '2px' } }), U.el('span', {}, 'Landkreisgrenze')));
    if (K.kontext !== 'keiner') teile.push(U.el('div', { class: 'kat' }, U.el('span', { class: 'linie', style: { borderTopColor: K.kontext === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau'), borderTopWidth: '3px' } }), U.el('span', {}, K.kontextLabel)));
    return U.el('div', { class: 'fuss', style: { marginTop: '6px' } }, ...teile);
  }
  function marker(wert) {
    if (!S.marker || !S.spec || S.spec.typ !== 'kontinuierlich') return;
    if (typeof wert !== 'number') { S.marker.hidden = true; return; }
    const x = Math.max(0, Math.min(1, (wert - S.spec.vmin) / ((S.spec.vmax - S.spec.vmin) || 1e-9)));
    S.marker.style.left = (x * 100) + '%'; S.marker.hidden = false;
  }
  // Brushing: Bereich auf dem Farbbalken ziehen -> Wertebereichsfilter
  function brushAktivieren(wrap, spec) {
    let start = null;
    const wertBei = ev => { const r = wrap.getBoundingClientRect(); const t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); return spec.vmin + t * (spec.vmax - spec.vmin); };
    wrap.addEventListener('mousedown', ev => { start = wertBei(ev); ev.preventDefault(); });
    window.addEventListener('mousemove', ev => {
      if (start === null) return;
      const w = wertBei(ev), lo = Math.min(start, w), hi = Math.max(start, w);
      S.brush.hidden = false;
      S.brush.style.left = ((lo - spec.vmin) / (spec.vmax - spec.vmin) * 100) + '%';
      S.brush.style.width = ((hi - lo) / (spec.vmax - spec.vmin) * 100) + '%';
    });
    window.addEventListener('mouseup', ev => {
      if (start === null) return;
      const w = wertBei(ev), lo = Math.min(start, w), hi = Math.max(start, w);
      start = null;
      if (Math.abs(hi - lo) < (spec.vmax - spec.vmin) * 0.01) { S.brush.hidden = true; if (WK.filter) WK.filter.setBereich(null); return; }
      if (WK.filter) WK.filter.setBereich([lo, hi]);
    });
  }
  // --- Canvas (PNG-Export) -------------------------------------------------------------
  function zeichnenCanvas(ctx, spec, x, y, k, opts) {
    opts = opts || {};
    const breite = (opts.breite || 220) * k, pad = 8 * k, zh = 15 * k;
    ctx.save();
    ctx.font = `${11 * k}px "DejaVu Sans", Arial, sans-serif`;
    let hoehe = pad * 2 + 16 * k;
    let zeilen = [];
    if (spec.typ === 'kontinuierlich' || spec.typ === 'raster') hoehe += 14 * k + 18 * k + (spec.einheit ? zh : 0);
    else if (spec.typ === 'kategorial' || spec.typ === 'klassen') hoehe += spec.klassen.length * zh;
    else if (spec.typ === 'quintil') hoehe += 5 * zh + zh;
    else if (spec.typ === 'einfarbig') hoehe += zh;
    hoehe += zh * (opts.kontextZeilen ? opts.kontextZeilen.length : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#b0b4ba'; ctx.lineWidth = 1 * k;
    ctx.beginPath(); ctx.rect(x, y, breite, hoehe); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1c1e21'; ctx.textBaseline = 'top';
    ctx.font = `bold ${11.5 * k}px "DejaVu Sans", Arial, sans-serif`;
    ctx.fillText(spec.titel || spec.label || '', x + pad, y + pad);
    ctx.font = `${11 * k}px "DejaVu Sans", Arial, sans-serif`;
    let cy = y + pad + 16 * k;
    const innen = breite - 2 * pad;
    if (spec.typ === 'kontinuierlich' || spec.typ === 'raster') {
      const g = ctx.createLinearGradient(x + pad, 0, x + pad + innen, 0);
      for (const [t, f] of spec.stops) g.addColorStop(t, f);
      ctx.fillStyle = g; ctx.fillRect(x + pad, cy, innen, 12 * k);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(x + pad, cy, innen, 12 * k);
      cy += 14 * k;
      ctx.fillStyle = '#1c1e21'; ctx.textAlign = 'center';
      const span = (spec.vmax - spec.vmin) || 1e-9, dez = span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3;
      for (const t of spec.ticks) { const tx = x + pad + (t - spec.vmin) / span * innen; if (tx < x + pad - 1 || tx > x + pad + innen + 1) continue; ctx.fillText(U.formatZahl(t, spec.typ === 'raster' ? 0 : dez), tx, cy); }
      ctx.textAlign = 'left'; cy += 18 * k;
      if (spec.einheit || spec.fuss) { ctx.fillStyle = '#5a5f66'; ctx.fillText(spec.fuss || spec.einheit, x + pad, cy); cy += zh; }
    } else if (spec.typ === 'kategorial' || spec.typ === 'klassen') {
      for (const kl of spec.klassen.slice().reverse()) {
        ctx.strokeStyle = kl.farbe; ctx.lineWidth = Math.max(1.5, Math.min(8, (kl.lw || 1) * 2.2)) * k;
        ctx.beginPath(); ctx.moveTo(x + pad, cy + 7 * k); ctx.lineTo(x + pad + 30 * k, cy + 7 * k); ctx.stroke();
        ctx.fillStyle = '#1c1e21'; ctx.fillText(kl.label + (kl.n !== undefined ? `  (n = ${U.formatZahl(kl.n, 0)})` : ''), x + pad + 38 * k, cy + 1 * k);
        cy += zh;
      }
    } else if (spec.typ === 'quintil') {
      ctx.fillStyle = '#5a5f66'; ctx.fillText(spec.untertitel, x + pad, cy); cy += zh;
      for (const q of spec.quintile.slice().reverse()) {
        const g = ctx.createLinearGradient(x + pad, 0, x + pad + 40 * k, 0); g.addColorStop(0, q.farben[0]); g.addColorStop(1, q.farben[1]);
        ctx.fillStyle = g; ctx.fillRect(x + pad, cy + 2 * k, 40 * k, 10 * k); ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5 * k; ctx.strokeRect(x + pad, cy + 2 * k, 40 * k, 10 * k);
        ctx.fillStyle = '#1c1e21'; ctx.fillText(`${q.kz} (${q.spanne}) – ${q.semantik}`, x + pad + 48 * k, cy + 1 * k);
        cy += zh;
      }
    } else if (spec.typ === 'einfarbig') {
      ctx.strokeStyle = spec.farbe; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(x + pad, cy + 7 * k); ctx.lineTo(x + pad + 30 * k, cy + 7 * k); ctx.stroke();
      ctx.fillStyle = '#1c1e21'; ctx.fillText(spec.label, x + pad + 38 * k, cy + 1 * k); cy += zh;
    }
    for (const z of (opts.kontextZeilen || [])) {
      ctx.strokeStyle = z.farbe; ctx.lineWidth = (z.lw || 2) * k; ctx.beginPath(); ctx.moveTo(x + pad, cy + 7 * k); ctx.lineTo(x + pad + 30 * k, cy + 7 * k); ctx.stroke();
      ctx.fillStyle = '#1c1e21'; ctx.fillText(z.label, x + pad + 38 * k, cy + 1 * k); cy += zh;
    }
    ctx.restore();
    return { breite, hoehe };
  }
  // --- SVG -------------------------------------------------------------------------------
  function zeichnenSvg(spec, x, y, opts) {
    opts = opts || {};
    const fs = opts.fontsize || 8, breite = opts.breite || 150, zh = fs * 1.6, pad = 5;
    const teile = [], id = 'lg' + Math.floor(Math.random() * 1e6);
    let cy = y + pad + fs * 1.4;
    teile.push(`<text x="${(x + pad).toFixed(1)}" y="${(y + pad + fs).toFixed(1)}" font-size="${fs + 0.5}" font-weight="bold">${U.esc(spec.titel || spec.label || '')}</text>`);
    let hoehe = pad * 2 + fs * 1.6;
    const innen = breite - 2 * pad;
    if (spec.typ === 'kontinuierlich' || spec.typ === 'raster') {
      teile.push(`<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">${spec.stops.map(s => `<stop offset="${(s[0] * 100).toFixed(2)}%" stop-color="${s[1]}"/>`).join('')}</linearGradient></defs>`);
      teile.push(`<rect x="${(x + pad).toFixed(1)}" y="${cy.toFixed(1)}" width="${innen}" height="${fs}" fill="url(#${id})" stroke="#888" stroke-width="0.3"/>`);
      cy += fs * 1.2;
      const span = (spec.vmax - spec.vmin) || 1e-9, dez = span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3;
      for (const t of spec.ticks) { const tx = x + pad + (t - spec.vmin) / span * innen; if (tx < x + pad - 1 || tx > x + pad + innen + 1) continue; teile.push(`<text x="${tx.toFixed(1)}" y="${(cy + fs).toFixed(1)}" font-size="${fs - 1}" text-anchor="middle">${U.formatZahl(t, spec.typ === 'raster' ? 0 : dez)}</text>`); }
      cy += fs * 1.6; hoehe += fs * 1.2 + fs * 1.6;
      if (spec.einheit || spec.fuss) { teile.push(`<text x="${(x + pad).toFixed(1)}" y="${(cy + fs).toFixed(1)}" font-size="${fs - 1}" fill="#5a5f66">${U.esc(spec.fuss || spec.einheit)}</text>`); cy += zh; hoehe += zh; }
    } else if (spec.typ === 'kategorial' || spec.typ === 'klassen') {
      for (const kl of spec.klassen.slice().reverse()) {
        teile.push(`<line x1="${(x + pad).toFixed(1)}" x2="${(x + pad + 22).toFixed(1)}" y1="${(cy + fs * 0.5).toFixed(1)}" y2="${(cy + fs * 0.5).toFixed(1)}" stroke="${kl.farbe}" stroke-width="${Math.max(1, (kl.lw || 1) * 1.6).toFixed(2)}"/>`);
        teile.push(`<text x="${(x + pad + 28).toFixed(1)}" y="${(cy + fs * 0.85).toFixed(1)}" font-size="${fs}">${U.esc(kl.label)}${kl.n !== undefined ? ` (n = ${U.formatZahl(kl.n, 0)})` : ''}</text>`);
        cy += zh; hoehe += zh;
      }
    } else if (spec.typ === 'quintil') {
      teile.push(`<text x="${(x + pad).toFixed(1)}" y="${(cy + fs * 0.85).toFixed(1)}" font-size="${fs - 1}" fill="#5a5f66">${U.esc(spec.untertitel)}</text>`); cy += zh; hoehe += zh;
      spec.quintile.slice().reverse().forEach((q, i) => {
        const gid = `${id}q${i}`;
        teile.push(`<defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="${q.farben[0]}"/><stop offset="100%" stop-color="${q.farben[1]}"/></linearGradient></defs>`);
        teile.push(`<rect x="${(x + pad).toFixed(1)}" y="${(cy + 1).toFixed(1)}" width="30" height="${fs}" fill="url(#${gid})" stroke="#888" stroke-width="0.4"/>`);
        teile.push(`<text x="${(x + pad + 36).toFixed(1)}" y="${(cy + fs * 0.85 + 1).toFixed(1)}" font-size="${fs}">${U.esc(`${q.kz} (${q.spanne}) – ${q.semantik}`)}</text>`);
        cy += zh; hoehe += zh;
      });
    } else if (spec.typ === 'einfarbig') {
      teile.push(`<line x1="${(x + pad).toFixed(1)}" x2="${(x + pad + 22).toFixed(1)}" y1="${(cy + fs * 0.5).toFixed(1)}" y2="${(cy + fs * 0.5).toFixed(1)}" stroke="${spec.farbe}" stroke-width="2"/>`);
      teile.push(`<text x="${(x + pad + 28).toFixed(1)}" y="${(cy + fs * 0.85).toFixed(1)}" font-size="${fs}">${U.esc(spec.label)}</text>`); cy += zh; hoehe += zh;
    }
    for (const z of (opts.kontextZeilen || [])) {
      teile.push(`<line x1="${(x + pad).toFixed(1)}" x2="${(x + pad + 22).toFixed(1)}" y1="${(cy + fs * 0.5).toFixed(1)}" y2="${(cy + fs * 0.5).toFixed(1)}" stroke="${z.farbe}" stroke-width="${z.lw || 1.5}"/>`);
      teile.push(`<text x="${(x + pad + 28).toFixed(1)}" y="${(cy + fs * 0.85).toFixed(1)}" font-size="${fs}">${U.esc(z.label)}</text>`); cy += zh; hoehe += zh;
    }
    const rahmen = opts.rahmen === false ? '' : `<rect x="${x}" y="${y}" width="${breite}" height="${hoehe.toFixed(1)}" fill="white" fill-opacity="0.85" stroke="none"/>`;
    return { svg: `<g font-family="DejaVu Sans, Arial, sans-serif" fill="#1c1e21">${rahmen}${teile.join('')}</g>`, breite, hoehe };
  }
  return { init, neu, zeichnenDom, zeichnenCanvas, zeichnenSvg, marker, aktuelleSpec, get spec() { return S.spec; } };
})();
