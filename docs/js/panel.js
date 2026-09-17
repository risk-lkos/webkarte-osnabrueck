/* Detail-Panel: Kennwerte der gewaehlten Kante nach Gruppen, Rang/Dezil-Badges, Kopieren, Nachbarn, Pins */
WK.panel = (() => {
  const U = WK.util;
  const S = { el: null, titel: null, id: null };
  const BOOL_SPALTEN = new Set(['aktiv', 'im_kreis', 'bruecke', 'tunnel', 'usg_betroffen', 'pruefbedarf', 'querungspunkt', 'betroffen_fl',
                               'concrete_flag', 'hoch_pluvial', 'hoch_fluvial', 'hoch_heat', 'hoch_fluvial_bf']);

  function init() {
    S.el = document.getElementById('kante-info');
    S.titel = document.getElementById('panel-titel');
    WK.bus.on('auswahl', id => zeigen(id));
    WK.bus.on('variable', () => { if (S.id !== null) zeigen(S.id, true); });
    WK.bus.on('pins', () => { if (S.id !== null) zeigen(S.id, true); });
    document.getElementById('btn-detail-schliessen').addEventListener('click', () => WK.karte.waehlen(null));
    document.getElementById('btn-detail-kopieren').addEventListener('click', () => kopieren());
    document.getElementById('btn-detail-link').addEventListener('click', async () => { if (WK.url && S.id !== null) { const ok = await U.kopieren(WK.url.permalink({ kante: S.id })); WK.ui.melden(ok ? 'Link zur Kante kopiert' : 'Kopieren fehlgeschlagen'); } });
    document.getElementById('btn-detail-pin').addEventListener('click', () => { if (WK.vergleich && S.id !== null) WK.vergleich.anpinnen(S.id); });
    document.getElementById('btn-detail-zoom').addEventListener('click', () => { if (S.id !== null) WK.karte.fokus(S.id); });
  }
  function wertText(spalte, v) {
    const sp = WK.daten.spalte(spalte) || {};
    if (BOOL_SPALTEN.has(spalte)) return v ? 'ja' : 'nein';
    if (typeof v === 'number') return U.formatZahl(v, sp.dezimalen === null || sp.dezimalen === undefined ? undefined : sp.dezimalen) + (sp.einheit ? ' ' + sp.einheit : '');
    return String(v);
  }
  function zeigen(id, still) {
    S.id = id;
    const el = S.el;
    const app = document.getElementById('app');
    if (id === null || id === undefined) {
      S.titel.textContent = 'Keine Kante gewählt';
      el.innerHTML = '<p class="hinweis">Klicke auf eine Kante in der Karte, um ihre Kennwerte zu sehen. Beim Überfahren erscheint der Wert der aktuellen Variablen.</p>';
      WK.karte.nachbarnZeigen([]);
      return;
    }
    const fe = WK.daten.feature(id); if (!fe) return;
    const p = fe.properties, meta = WK.daten.meta;
    const name = [p.ref, p.name].filter(Boolean).join(' · ') || 'Kante ohne Namen';
    S.titel.textContent = name;
    app.classList.add('panel-offen');
    el.innerHTML = '';
    const kopf = U.el('div', { class: 'kopfzeile' },
      U.el('span', { class: 'klein' }, `${p.highway || ''}${p.baulast ? ' · ' + p.baulast : ''}${p.gemeinde ? ' · ' + p.gemeinde : ' · außerhalb des Landkreises'}`),
      U.el('span', { class: 'klein' }, `Kante ${id} · Länge ${U.formatZahl(p.length_m, 0)} m${p.aktiv ? ' · aktiv' : ' · nicht aktiv (importance_s = 0)'}`));
    el.appendChild(kopf);
    // Badges fuer die aktuelle Variable
    const v = WK.karte.variable, m = WK.karte.meta;
    if (v && p[v] !== undefined) {
      const badges = U.el('div', { class: 'aktionen' });
      if (typeof p[v] === 'number') {
        const rg = WK.daten.rang(v, id, m && m.gt0);
        if (rg) {
          badges.appendChild(U.el('span', { class: 'badge' + (rg.perzentil >= 0.9 ? ' top' : '') }, `Rang ${U.formatZahl(rg.rang, 0)} von ${U.formatZahl(rg.n, 0)}`));
          badges.appendChild(U.el('span', { class: 'badge' }, `Perzentil ${U.formatZahl(rg.perzentil * 100, 1)} %`));
          if (rg.perzentil >= 0.9) badges.appendChild(U.el('span', { class: 'badge top' }, 'oberstes Dezil'));
        }
      }
      el.appendChild(badges);
    }
    const aktionen = U.el('div', { class: 'aktionen' },
      WK.favoriten ? U.el('button', { class: WK.favoriten.ist(id) ? 'aktiv' : '', title: 'Favorit merken / entfernen (S)', onclick: () => { WK.favoriten.toggle(id); zeigen(id, true); } }, WK.favoriten.ist(id) ? '★ Favorit' : '☆ Favorit') : null,
      U.el('button', { onclick: () => WK.karte.fokus(id) }, 'Zoom'),
      U.el('button', { onclick: () => { const n = WK.daten.nachbarn(id); WK.karte.nachbarnZeigen(n); WK.ui.melden(`${n.length} Nachbarkanten markiert`); } }, 'Nachbarn'),
      p.ref ? U.el('button', { onclick: () => { if (WK.suche) WK.suche.strassenzug(p.ref); } }, `Straßenzug ${p.ref}`) : null,
      U.el('button', { onclick: () => { if (WK.karte.map) { WK.karte.map.setFilter('nachbarn', ['==', ['id'], -1]); } } }, 'Markierung weg'));
    el.appendChild(aktionen);
    // Gruppen
    for (const g of meta.gruppen) {
      const zeilen = Object.entries(meta.spalten).filter(([sp, def]) => def.gruppe === g.id && p[sp] !== undefined && sp !== 'name' && sp !== 'ref');
      if (!zeilen.length) continue;
      el.appendChild(U.el('h4', {}, U.el('span', { class: 'farbe-punkt', style: { background: WK.stil.rampe(g.rolle || 'pluvial').farbe(0.8) } }), g.label));
      const tab = U.el('table');
      for (const [sp, def] of zeilen) {
        const tr = U.el('tr', { class: sp === v ? 'hervor' : '' }, U.el('td', { title: sp }, def.label), U.el('td', { class: 'wert' }, wertText(sp, p[sp])));
        tab.appendChild(tr);
      }
      el.appendChild(tab);
    }
    if (WK.vergleich) el.appendChild(WK.vergleich.pinsDom());
    if (!still && WK.detail) WK.detail.folgen(id);
  }
  function markdown(id) {
    const fe = WK.daten.feature(id); if (!fe) return '';
    const p = fe.properties, meta = WK.daten.meta;
    const zeilen = [`| Kennwert | Wert |`, `|---|---|`];
    zeilen.push(`| Kante | ${id} (${[p.ref, p.name].filter(Boolean).join(' · ')}) |`);
    for (const g of meta.gruppen) for (const [sp, def] of Object.entries(meta.spalten)) if (def.gruppe === g.id && p[sp] !== undefined) zeilen.push(`| ${def.label} (${sp}) | ${wertText(sp, p[sp])} |`);
    return zeilen.join('\n');
  }
  async function kopieren() {
    if (S.id === null) return;
    const ok = await U.kopieren(markdown(S.id));
    WK.ui.melden(ok ? 'Kennwerte als Markdown-Tabelle kopiert' : 'Kopieren fehlgeschlagen');
  }
  return { init, zeigen, markdown, wertText, get id() { return S.id; } };
})();
