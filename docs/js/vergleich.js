/* Vergleich: bis zu drei angepinnte Kanten nebeneinander */
WK.vergleich = (() => {
  const U = WK.util;
  const S = { ids: [] };
  function farben() { const f = WK.stil.kontext('pin'); return Array.isArray(f) ? f : ['#1b9e77', '#7570b3', '#e7298a']; }
  function anpinnen(id, still) {
    if (id === null || id === undefined || !WK.daten.feature(id)) return;
    const i = S.ids.indexOf(id);
    if (i >= 0) S.ids.splice(i, 1);
    else { if (S.ids.length >= 3) S.ids.shift(); S.ids.push(id); }
    WK.karte.pinsSetzen(S.ids, farben());
    if (!still) WK.bus.emit('pins', S.ids.slice());
    if (!still) WK.ui.melden(i >= 0 ? 'Pin entfernt' : `Kante ${id} angepinnt (${S.ids.length}/3)`);
  }
  function leeren() { S.ids = []; WK.karte.pinsSetzen([], []); WK.bus.emit('pins', []); }
  function pinsDom() {
    const d = U.el('div', { class: 'pins' });
    if (!S.ids.length) return d;
    const f = farben();
    S.ids.forEach((id, i) => {
      const fe = WK.daten.feature(id), p = fe.properties;
      d.appendChild(U.el('span', { class: 'pin', style: { borderColor: f[i] }, onclick: () => { WK.karte.waehlen(id); WK.karte.fokus(id); } },
        U.el('span', { class: 'farbe-punkt', style: { background: f[i] } }), `${[p.ref, p.name].filter(Boolean).join(' · ') || id}`,
        U.el('button', { class: 'icon', style: { padding: '0 4px', fontSize: '12px' }, onclick: e => { e.stopPropagation(); anpinnen(id); } }, '✕')));
    });
    d.appendChild(U.el('button', { onclick: oeffnen, style: { fontSize: '12px' } }, 'Vergleich öffnen'));
    return d;
  }
  function oeffnen() {
    if (!S.ids.length) { WK.ui.melden('Keine Kanten angepinnt (P)'); return; }
    const meta = WK.daten.meta, box = U.el('div'), f = farben();
    const fs = S.ids.map(id => WK.daten.feature(id));
    const t = U.el('table');
    const kopf = U.el('tr', {}, U.el('th', {}, 'Kennwert'));
    fs.forEach((fe, i) => kopf.appendChild(U.el('th', { style: { borderBottom: `3px solid ${f[i]}` } }, `${[fe.properties.ref, fe.properties.name].filter(Boolean).join(' · ') || 'Kante'} (${fe.id})`)));
    t.appendChild(kopf);
    for (const g of meta.gruppen) {
      const spalten = Object.entries(meta.spalten).filter(([sp, def]) => def.gruppe === g.id && fs.some(fe => fe.properties[sp] !== undefined));
      if (!spalten.length) continue;
      t.appendChild(U.el('tr', {}, U.el('th', { colspan: fs.length + 1, style: { background: 'var(--bg3)' } }, g.label)));
      for (const [sp, def] of spalten) {
        const tr = U.el('tr', {}, U.el('td', {}, def.label));
        const werte = fs.map(fe => fe.properties[sp]);
        const zahlen = werte.filter(w => typeof w === 'number');
        const max = zahlen.length > 1 ? Math.max(...zahlen) : null;
        werte.forEach(w => tr.appendChild(U.el('td', { class: 'zahl', style: { fontWeight: max !== null && w === max ? '700' : '400' } }, w === undefined ? '–' : WK.panel.wertText(sp, w))));
        t.appendChild(tr);
      }
    }
    box.appendChild(U.el('div', { class: 'zeile' }, U.el('button', { onclick: () => { leeren(); WK.ui.dialogSchliessen(); } }, 'Pins leeren'), U.el('span', { class: 'klein' }, 'Höchster Zahlenwert je Zeile fett.')));
    box.appendChild(t);
    WK.ui.dialog('Vergleich angepinnter Kanten', box, { breit: true });
  }
  return { anpinnen, leeren, pinsDom, oeffnen, get ids() { return S.ids; } };
})();
