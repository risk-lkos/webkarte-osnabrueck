/* Detail-Panel: Kennwerte der gewaehlten Kante nach Gruppen, Rang/Dezil-Badges, Kopieren, Nachbarn, Pins */
WK.panel = (() => {
  const U = WK.util;
  const S = { el: null, titel: null, id: null, zug: null };   // zug: { ref, ids, set } = geoeffnete Strassenzug-Auswertung
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
  // --- Strassenzug-Auswertung: Max/Min/Median der aktuellen Variable entlang aller Kanten mit derselben Nummer ---
  function zugSetzen(z) {
    S.zug = z && z.ids && z.ids.length ? { ref: z.ref, ids: z.ids, set: new Set(z.ids) } : null;
    if (S.zug) document.getElementById('app').classList.add('panel-offen');
    zeigen(S.id, true);
  }
  function zugWerte() {
    const K = WK.karte, v = K.variable, m = K.meta || {}, aus = [];
    if (!S.zug || !v || m.typ === 'kategorial') return aus;
    for (const id of S.zug.ids) { const fe = WK.daten.feature(id), w = fe && fe.properties[v]; if (typeof w === 'number' && !Number.isNaN(w) && (!m.gt0 || w > 0)) aus.push([w, id]); }
    return aus.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  }
  function zugBox() {
    const z = S.zug, K = WK.karte, v = K.variable, m = K.meta || {}, werte = zugWerte();
    const hin = id => { K.waehlen(id, { quelle: 'zug' }); K.fokus(id); };
    const box = U.el('div', { class: 'zug-box' });
    box.appendChild(U.el('div', { class: 'zug-kopf' },
      U.el('span', {}, U.el('strong', {}, `Straßenzug ${z.ref}`), U.el('span', { class: 'klein' }, ` · ${U.formatZahl(z.ids.length, 0)} Kanten${werte.length ? `, ${U.formatZahl(werte.length, 0)} mit Wert` : ''}`)),
      U.el('button', { title: 'Auswertung schließen und Markierung des Straßenzugs entfernen', onclick: () => { S.zug = null; K.nachbarnZeigen([]); zeigen(S.id, true); } }, '✕')));
    const kn = U.el('div', { class: 'zug-knoepfe' });
    if (werte.length) {
      const sp = WK.daten.spalte(v) || {}, d = sp.dezimalen === null || sp.dezimalen === undefined ? 3 : sp.dezimalen, f = w => U.formatZahl(w, d);
      const max = werte[0], min = werte[werte.length - 1], med = werte[Math.floor(werte.length / 2)];
      const mittel = werte.reduce((s, x) => s + x[0], 0) / werte.length;
      const knopf = (label, e, titel) => U.el('button', { class: e[1] === S.id ? 'aktiv' : '', title: titel, onclick: () => hin(e[1]) }, label + ' ', U.el('span', { class: 'mono' }, f(e[0])), ' →');
      box.appendChild(U.el('div', { class: 'klein', style: { marginTop: '3px' } }, `${m.label || v} · Mittel der Kanten ${f(mittel)}`));
      kn.appendChild(knopf('Max', max, 'Zur Kante mit dem höchsten Wert in diesem Straßenzug springen'));
      kn.appendChild(knopf('Min', min, 'Zur Kante mit dem niedrigsten Wert in diesem Straßenzug springen'));
      kn.appendChild(knopf('Median', med, 'Zur Kante mit dem mittleren Wert (Median) in diesem Straßenzug springen'));
      const i = S.id === null ? -1 : werte.findIndex(x => x[1] === S.id);
      if (i >= 0) {
        kn.appendChild(U.el('button', { disabled: i === 0, title: 'Zur Kante mit dem nächsthöheren Wert im Straßenzug', onclick: () => hin(werte[i - 1][1]) }, '▲ höher'));
        kn.appendChild(U.el('button', { disabled: i === werte.length - 1, title: 'Zur Kante mit dem nächstniedrigeren Wert im Straßenzug', onclick: () => hin(werte[i + 1][1]) }, '▼ niedriger'));
        box.appendChild(U.el('div', { class: 'klein' }, `Gewählte Kante: Rang ${i + 1} von ${werte.length} im Straßenzug`));
      }
    } else box.appendChild(U.el('div', { class: 'klein', style: { marginTop: '3px' } }, !v ? 'Keine Kantenvariable gewählt: Max und Min gibt es, sobald eine Variable gezeigt wird.' : m.typ === 'kategorial' ? `Max und Min gibt es nur für Zahlenvariablen (aktuell: ${m.label || v}).` : `Keine Kante dieses Straßenzugs hat einen Wert für ${m.label || v}.`));
    kn.appendChild(U.el('button', { title: 'Karte auf den ganzen Straßenzug zoomen', onclick: () => { if (WK.suche) WK.suche.springen({ ids: z.ids, label: `Straßenzug ${z.ref}`, ref: z.ref }); } }, 'ganzer Zug'));
    box.appendChild(kn);
    return box;
  }

  function zeigen(id, still) {
    S.id = id;
    const el = S.el;
    const app = document.getElementById('app');
    // gewaehlte Kante liegt ausserhalb des geoeffneten Strassenzugs: Auswertung schliessen
    if (S.zug && id !== null && id !== undefined && !S.zug.set.has(id)) S.zug = null;
    if (id === null || id === undefined) {
      S.titel.textContent = S.zug ? `Straßenzug ${S.zug.ref}` : 'Keine Kante gewählt';
      el.innerHTML = '<p class="hinweis">Klicke auf eine Kante in der Karte, um ihre Kennwerte zu sehen. Beim Überfahren erscheint der Wert der aktuellen Variablen.</p>';
      if (S.zug) { el.insertBefore(zugBox(), el.firstChild); WK.karte.nachbarnZeigen(S.zug.ids); } else WK.karte.nachbarnZeigen([]);
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
      ...(p.ref ? String(p.ref).split(/[;,]/).map(r => r.trim()).filter(Boolean).map(r => U.el('button', { class: S.zug && WK.suche && WK.suche.norm(S.zug.ref) === WK.suche.norm(r) ? 'aktiv' : '', title: `Auf alle Kanten der ${r} zoomen und Max/Min der aktuellen Variable entlang des Straßenzugs zeigen`, onclick: () => { if (WK.suche) WK.suche.strassenzug(r); } }, `Straßenzug ${r}`)) : []),
      U.el('button', { onclick: () => { S.zug = null; WK.karte.nachbarnZeigen([]); zeigen(id, true); } }, 'Markierung weg'),
      WK.report ? U.el('button', { title: 'Fehler oder Auffälligkeit zu dieser Kante melden (M)', onclick: () => WK.report.oeffnen({ kante: id }) }, 'Melden') : null);
    el.appendChild(aktionen);
    if (S.zug) { el.appendChild(zugBox()); WK.karte.nachbarnZeigen(S.zug.ids); }
    // Gruppen
    for (const g of meta.gruppen) {
      const zeilen = Object.entries(meta.spalten).filter(([sp, def]) => def.gruppe === g.id && p[sp] !== undefined && sp !== 'name' && sp !== 'ref');
      if (!zeilen.length) continue;
      el.appendChild(U.el('h4', {}, U.el('span', { class: 'farbe-punkt', style: { background: WK.stil.rampe(g.rolle || 'pluvial').farbe(0.8) } }), g.label, WK.glossar ? WK.glossar.knopf({ gruppe: g.id }) : null));
      const tab = U.el('table');
      for (const [sp, def] of zeilen) {
        const tr = U.el('tr', { class: sp === v ? 'hervor' : '' }, U.el('td', { title: sp }, def.label, WK.glossar ? WK.glossar.knopf({ variable: sp }, { klasse: 'dezent' }) : null), U.el('td', { class: 'wert' }, wertText(sp, p[sp])));
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
  return { init, zeigen, zugSetzen, markdown, wertText, get id() { return S.id; }, get zug() { return S.zug; } };
})();
