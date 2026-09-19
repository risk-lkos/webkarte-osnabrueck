/* Rangliste der aktuellen Variable als Attributtabelle in der Seitenleiste (ersetzt das Menue, solange sie offen ist):
   scrollbar, sortierbar, Klick = Kante waehlen und hinspringen; zweite Ansicht "Dezile" (Dezilstaffelung);
   Datenexport (CSV/GeoJSON). Einstieg an beliebiger Stelle: geladen wird ein Fenster um die gesuchte Kante. */
WK.rangliste = (() => {
  const U = WK.util;
  const S = { offen: false, ansicht: 'liste', n: 0, nurAusschnitt: false, sort: null, richtung: -1, breit: false, el: null, ui: {},
              zeilen: [], index: new Map(), von: 0, gerendert: 0, tr: new Map(), gewaehlt: null, seiteWarZu: false, spalten: [] };
  const BLOCK = 200;          // Zeilen je Nachladeschritt
  const VORLAUF = 40;         // Zeilen vor der gesuchten Kante beim Einstieg mitten in der Liste
  const ZUSATZ = ['importance_s', 'hazard_klasse', 'vi_pct', 'vi_pct_fluvial', 'vi_pct_heat', 'mhn_bf'];
  const EBENE_KURZ = { autobahn: 'A', bundesstrasse: 'B', landesstrasse: 'L', kreisstrasse: 'K', gemeindestrasse: 'Gem.' };

  function nameVon(p) { return [p.ref, p.name].filter(Boolean).join(' · '); }
  function dez(s) { const d = (WK.daten.spalte(s) || {}).dezimalen; return d === null || d === undefined ? 3 : d; }
  function spalten() {
    const K = WK.karte, v = K.variable, m = K.meta || {};
    const zahl = s => w => (w === undefined || w === null ? '' : typeof w === 'number' ? U.formatZahl(w, dez(s)) : String(w));
    const basis = [
      { key: '#', label: '#', zahl: true, wert: r => r.rang, text: r => String(r.rang), titel: 'Rang nach dem Wert der Variable innerhalb der gelisteten Kanten' },
      { key: 'name', label: 'Name / Nr.', wert: r => nameVon(r.p) || undefined, text: r => nameVon(r.p) || '(ohne Namen)', klasse: 'name' },
      { key: 'gemeinde', label: 'Gemeinde', wert: r => r.p.gemeinde, text: r => r.p.gemeinde || '', klasse: 'name' },
      { key: v, label: m.label || v, zahl: m.typ !== 'kategorial', wert: r => r.wert, text: r => zahl(v)(r.wert), farbe: true },
    ];
    if (!S.breit) return basis;
    return basis.concat([
      { key: 'id', label: 'Kante', zahl: true, wert: r => r.id, text: r => String(r.id) },
      { key: 'baulast', label: 'Ebene', wert: r => r.p.baulast, text: r => EBENE_KURZ[r.p.baulast] || r.p.baulast || '' },
      { key: 'highway', label: 'Typ', wert: r => r.p.highway, text: r => r.p.highway || '' },
      { key: 'length_m', label: 'Länge (m)', zahl: true, wert: r => r.p.length_m, text: r => (r.p.length_m === undefined ? '' : U.formatZahl(r.p.length_m, 0)) },
      ...ZUSATZ.filter(s => s !== v).map(s => ({ key: s, label: (WK.daten.spalte(s) || {}).label || s, zahl: true, wert: r => r.p[s], text: r => zahl(s)(r.p[s]) })),
    ]);
  }

  // gelistete Kanten: gueltiger Wert der Variable + aktive Filter, optional nur der Kartenausschnitt
  function zeilen() {
    const K = WK.karte, v = K.variable; if (!v) return [];
    const m = K.meta || {};
    const quelle = S.nurAusschnitt ? K.sichtbareIndizes().map(i => WK.daten.features[i]) : WK.daten.features.filter(K.praedikat());
    const arr = quelle.map(fe => ({ id: fe.id, p: fe.properties, wert: fe.properties[v] }));
    // Rang nach Wert (kategorial: nach Link Importance), unabhaengig von der gewaehlten Sortierung
    const num = m.typ !== 'kategorial';
    arr.sort((a, b) => (num ? (b.wert - a.wert) : ((b.p.importance_s || 0) - (a.p.importance_s || 0))) || a.id - b.id);
    arr.forEach((r, i) => { r.rang = i + 1; });
    if (S.sort && S.sort !== '#') {
      const sp = spalten().find(s => s.key === S.sort) || (S.sort === v ? { wert: r => r.wert } : { wert: r => r.p[S.sort] });
      arr.sort((a, b) => {
        const x = sp.wert(a), y = sp.wert(b);
        const xl = x === undefined || x === null || x === '', yl = y === undefined || y === null || y === '';
        if (xl || yl) return xl && yl ? a.rang - b.rang : xl ? 1 : -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de', { numeric: true });
        return c * S.richtung || a.rang - b.rang;
      });
    } else if (S.sort === '#' && S.richtung > 0) arr.reverse();
    return S.n ? arr.slice(0, S.n) : arr;
  }

  // Dezilstaffelung ueber alle Kanten mit Wert, mit derselben Perzentilformel wie das Rang-Abzeichen im Panel
  // (WK.daten.rang): Perzentil = (Anzahl Werte <= v, minus 1) / (n - 1); oberstes Dezil = Perzentil >= 0,9.
  function dezilVon(perzentil) { return perzentil >= 0.9 ? 10 : Math.min(9, Math.floor(perzentil * 10 + 1e-9) + 1); }
  function dezile(v, gt0) {
    const s = WK.daten.sortiert(v, gt0), n = s.length;
    const D = Array.from({ length: 10 }, (_, i) => ({ d: i + 1, n: 0, min: Infinity, max: -Infinity, summe: 0 }));
    let j = 0;
    while (j < n) {
      let k = j; while (k + 1 < n && s[k + 1] === s[j]) k++;
      const e = D[dezilVon(n > 1 ? k / (n - 1) : 1) - 1], anz = k - j + 1;
      e.n += anz; e.summe += s[j] * anz; if (s[j] < e.min) e.min = s[j]; if (s[j] > e.max) e.max = s[j];
      j = k + 1;
    }
    return { n, dezile: D };
  }

  function init() {
    const el = S.el = document.getElementById('rangliste'); if (!el) return;
    const nSel = U.el('select', { title: 'Anzahl gelisteter Kanten' }, U.el('option', { value: 0 }, 'alle'), ...[25, 50, 100, 250, 1000].map(n => U.el('option', { value: n }, `Top ${n}`)));
    nSel.addEventListener('change', () => { S.n = +nSel.value; neu(); });
    const cb = U.el('input', { type: 'checkbox' });
    cb.addEventListener('change', () => { S.nurAusschnitt = cb.checked; neu(); });
    const breitBtn = U.el('button', { title: 'Mehr Spalten zeigen (Kante, Ebene, Typ, Länge, weitere Indizes) und die Liste verbreitern', onclick: () => { S.breit = !S.breit; breitBtn.classList.toggle('aktiv', S.breit); klassen(); neu(); } }, '⇔ Spalten');
    S.ui.breitBtn = breitBtn;
    S.ui.titel = U.el('strong', {}, 'Rangliste');
    S.ui.info = U.el('div', { class: 'klein' }, '');
    S.ui.tabListe = U.el('button', { title: 'Alle Kanten der Variable nach Rang', onclick: () => setAnsicht('liste') }, 'Rangliste');
    S.ui.tabDezile = U.el('button', { title: 'Dezilstaffelung: zehn gleich große Ranggruppen mit Wertebereich und Kantenzahl', onclick: () => setAnsicht('dezile') }, 'Dezile');
    S.ui.listeKopf = U.el('div', {},
      U.el('div', { class: 'zeile' }, nSel, U.el('label', { title: 'Nur Kanten im aktuellen Kartenausschnitt listen' }, cb, ' nur Ausschnitt')),
      U.el('div', { class: 'zeile' }, U.el('button', { onclick: () => csv(), title: 'Alle gefilterten Kanten mit allen Spalten (Semikolon, Dezimalkomma)' }, 'CSV'), U.el('button', { onclick: () => geojson(), title: 'Alle gefilterten Kanten mit Geometrie' }, 'GeoJSON')));
    const kopf = U.el('div', { class: 'rang-kopf' },
      U.el('div', { class: 'rang-titel' }, S.ui.titel,
        U.el('span', { class: 'rang-knoepfe' }, breitBtn, U.el('button', { class: 'rang-zu', title: 'Rangliste schließen und das Menü wieder zeigen (R)', onclick: () => schliessen() }, '✕ Schließen'))),
      U.el('div', { class: 'rang-tabs' }, S.ui.tabListe, S.ui.tabDezile, WK.glossar ? WK.glossar.knopf({ bedienung: 'dezile' }) : null),
      S.ui.listeKopf, S.ui.info);
    S.ui.scroll = U.el('div', { class: 'rang-scroll', tabindex: 0 });
    S.ui.scroll.addEventListener('scroll', () => { const s = S.ui.scroll; if (S.ansicht === 'liste' && s.scrollTop + s.clientHeight > s.scrollHeight - 400) mehr(); });
    S.ui.scroll.addEventListener('keydown', e => {
      if (S.ansicht !== 'liste' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault(); e.stopPropagation();
      if (!S.zeilen.length) return;
      const i = S.gewaehlt !== null && S.index.has(S.gewaehlt) ? S.index.get(S.gewaehlt) : -1;
      const j = Math.max(0, Math.min(S.zeilen.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      springen(S.zeilen[j].id);
    });
    el.appendChild(kopf); el.appendChild(S.ui.scroll);
    const neuD = U.debounce(() => { if (S.offen) neu(); }, 150);
    WK.bus.on('variable', neuD); WK.bus.on('filter', neuD); WK.bus.on('stil', neuD);
    WK.bus.on('ansicht', () => { if (S.offen && S.nurAusschnitt && S.ansicht === 'liste') neuD(); });
    WK.bus.on('auswahl', (id, opts) => { if (S.offen && S.ansicht === 'dezile') { S.gewaehlt = id === undefined ? null : id; neu(); } else markieren(id, !(opts && opts.quelle === 'rangliste')); });
  }
  function klassen() {
    const app = document.getElementById('app');
    app.classList.toggle('rangliste-offen', S.offen);
    app.classList.toggle('rangliste-breit', S.offen && S.breit && S.ansicht === 'liste');
    setTimeout(() => WK.karte.map && WK.karte.map.resize(), 60);
  }
  // opts: { ansicht: 'liste' | 'dezile', zuId: Kante, die in der Liste gezeigt werden soll }
  function oeffnen(opts) {
    if (!S.el) return;
    opts = opts || {};
    if (opts.ansicht) S.ansicht = opts.ansicht;
    if (!S.offen) {
      const app = document.getElementById('app');
      S.seiteWarZu = app.classList.contains('ohne-seite');
      app.classList.remove('ohne-seite'); if (window.innerWidth <= 900) app.classList.add('seite-offen');
      S.offen = true; S.el.hidden = false;
      const b = document.getElementById('btn-rangliste'); if (b) b.classList.add('aktiv');
    }
    klassen(); neu({ zuId: opts.zuId });
  }
  function schliessen() {
    if (!S.el) return;
    S.offen = false; S.el.hidden = true;
    const app = document.getElementById('app');
    if (S.seiteWarZu) app.classList.add('ohne-seite');
    if (window.innerWidth <= 900) app.classList.remove('seite-offen');
    const b = document.getElementById('btn-rangliste'); if (b) b.classList.remove('aktiv');
    klassen();
  }
  function umschalten() { if (S.offen) schliessen(); else oeffnen(); }
  function setAnsicht(a) { S.ansicht = a === 'dezile' ? 'dezile' : 'liste'; klassen(); neu(); }

  function neu(opts) {
    opts = opts || {};
    const K = WK.karte, v = K.variable, m = K.meta || {};
    const sc = S.ui.scroll; sc.innerHTML = ''; S.tr = new Map(); S.von = 0; S.gerendert = 0; S.ui.tbody = null;
    S.ui.tabListe.classList.toggle('aktiv', S.ansicht === 'liste'); S.ui.tabDezile.classList.toggle('aktiv', S.ansicht === 'dezile');
    S.ui.listeKopf.hidden = S.ansicht !== 'liste'; S.ui.breitBtn.hidden = S.ansicht !== 'liste';
    S.ui.titel.textContent = v ? `${S.ansicht === 'dezile' ? 'Dezile' : 'Rangliste'} · ${m.label || v}` : 'Rangliste';
    if (!v) { S.zeilen = []; S.index = new Map(); S.ui.info.textContent = ''; sc.appendChild(U.el('p', { class: 'hinweis', style: { padding: '10px' } }, 'Diese Karte zeigt keine Kantenvariable. Bitte links im Menü eine Variable wählen (Rangliste schließen) oder ein anderes Preset.')); return; }
    if (S.ansicht === 'dezile') { dezileZeichnen(); return; }
    S.zeilen = zeilen();
    S.index = new Map(S.zeilen.map((r, i) => [r.id, i]));
    const sp = S.spalten = spalten();
    const t = U.el('table'), kopf = U.el('tr');
    for (const s of sp) {
      const aktiv = (S.sort || '#') === s.key;
      const th = U.el('th', { class: s.zahl ? 'zahl' : '', title: s.titel || 'Klick sortiert nach dieser Spalte' }, s.label + (aktiv ? (S.richtung < 0 ? ' ▼' : ' ▲') : ''));
      th.addEventListener('click', () => {
        const key = s.key;
        if ((S.sort || '#') === key) S.richtung = -S.richtung;
        else { S.sort = key === '#' ? null : key; S.richtung = key === '#' ? -1 : (s.zahl ? -1 : 1); }
        if (!S.sort && S.richtung > 0) S.sort = '#';
        neu();
      });
      kopf.appendChild(th);
    }
    t.appendChild(U.el('thead', {}, kopf));
    S.ui.tbody = U.el('tbody'); t.appendChild(S.ui.tbody);
    sc.appendChild(t);
    // Einstieg: am Anfang oder in einem Fenster um die gesuchte bzw. gewaehlte Kante
    const ziel = opts.zuId !== undefined && opts.zuId !== null ? opts.zuId : K.auswahl;
    const zi = ziel !== null && ziel !== undefined && S.index.has(ziel) ? S.index.get(ziel) : -1;
    S.von = S.gerendert = zi >= BLOCK ? Math.max(0, zi - VORLAUF) : 0;
    if (S.von > 0) frueherZeile();
    mehr(zi >= 0 ? zi + 60 : 0);
    sc.scrollTop = 0;
    S.gewaehlt = null; markieren(K.auswahl, true);
    if (opts.zuId !== undefined && opts.zuId !== null && zi < 0) WK.ui.melden('Die Kante steht nicht in der Liste: kein Wert für diese Variable oder durch einen Filter ausgeblendet', 4000);
  }
  function zeileDom(r) {
    const K = WK.karte, v = K.variable;
    const row = U.el('tr', { class: 'klick' + (r.id === S.gewaehlt ? ' gewaehlt' : '') });
    row.addEventListener('click', () => { S.ui.scroll.focus({ preventScroll: true }); springen(r.id); });
    for (const s of S.spalten) {
      const td = U.el('td', { class: (s.zahl ? 'zahl' : '') + (s.klasse ? ' ' + s.klasse : ''), title: s.klasse ? s.text(r) : null });
      if (s.farbe) { const f = WK.stil.farbe(v, r.wert, K.skala, K.meta); td.appendChild(U.el('span', { class: 'farbe-punkt', style: { background: f || 'transparent', marginRight: '5px', verticalAlign: '-1px' } })); }
      td.appendChild(document.createTextNode(s.text(r)));
      row.appendChild(td);
    }
    S.tr.set(r.id, row);
    return row;
  }
  function infoNeu() {
    const filterText = WK.filter && WK.filter.aktiv() ? ' · Filter aktiv' : '';
    const teil = S.von > 0 || S.gerendert < S.zeilen.length ? ` · Zeilen ${U.formatZahl(S.von + 1, 0)} bis ${U.formatZahl(S.gerendert, 0)} geladen, weiter beim Scrollen` : '';
    S.ui.info.textContent = `${U.formatZahl(S.zeilen.length, 0)} Kanten${filterText}${teil}`;
  }
  function mehr(bis) {
    if (!S.ui.tbody) return;
    const ende = Math.min(S.zeilen.length, Math.max(S.gerendert + BLOCK, bis || 0));
    const frag = document.createDocumentFragment();
    for (let i = S.gerendert; i < ende; i++) frag.appendChild(zeileDom(S.zeilen[i]));
    S.ui.tbody.appendChild(frag); S.gerendert = ende;
    infoNeu();
  }
  function frueherZeile() {
    S.ui.frueher = U.el('tr', { class: 'rang-frueher' }, U.el('td', { colspan: S.spalten.length }, U.el('button', { onclick: () => frueher() }, `▴ ${BLOCK} Zeilen davor laden`)));
    S.ui.tbody.insertBefore(S.ui.frueher, S.ui.tbody.firstChild);
  }
  function frueher() {
    if (!S.ui.tbody || S.von <= 0) return;
    const sc = S.ui.scroll, hoeheVorher = sc.scrollHeight, neuVon = Math.max(0, S.von - BLOCK);
    const frag = document.createDocumentFragment();
    for (let i = neuVon; i < S.von; i++) frag.appendChild(zeileDom(S.zeilen[i]));
    S.ui.tbody.insertBefore(frag, S.ui.frueher.nextSibling);
    S.von = neuVon;
    if (S.von === 0) { S.ui.frueher.remove(); S.ui.frueher = null; }
    sc.scrollTop += sc.scrollHeight - hoeheVorher;       // Blickposition halten
    infoNeu();
  }
  function springen(id) { WK.karte.waehlen(id, { quelle: 'rangliste' }); WK.karte.fokus(id); }
  function markieren(id, scrollen) {
    const alt = S.gewaehlt !== null ? S.tr.get(S.gewaehlt) : null; if (alt) alt.classList.remove('gewaehlt');
    S.gewaehlt = id === undefined ? null : id;
    if (!S.offen || S.ansicht !== 'liste' || S.gewaehlt === null || !S.index.has(S.gewaehlt)) return;
    const i = S.index.get(S.gewaehlt);
    if (i < S.von || i >= S.gerendert) {
      if (!scrollen) return;
      if (i >= S.gerendert && i < S.gerendert + BLOCK) mehr(i + 20); else { neu({ zuId: S.gewaehlt }); return; }   // weit weg: Fenster neu um die Kante legen
    }
    const row = S.tr.get(S.gewaehlt); if (!row) return;
    row.classList.add('gewaehlt');
    const s = S.ui.scroll, o = row.offsetTop, h = row.offsetHeight;
    if (o < s.scrollTop + 34 || o + h > s.scrollTop + s.clientHeight) s.scrollTop = Math.max(0, o - Math.round(s.clientHeight * 0.35));
  }

  // --- Ansicht "Dezile" ---------------------------------------------------------------------------
  function dezileZeichnen() {
    const K = WK.karte, v = K.variable, m = K.meta || {}, sc = S.ui.scroll;
    if (m.typ === 'kategorial') { S.ui.info.textContent = ''; sc.appendChild(U.el('p', { class: 'hinweis', style: { padding: '10px' } }, `Dezile gibt es nur für Zahlenvariablen. ${m.label || v} ist eine Klassenvariable; die Klassen stehen in der Legende.`)); return; }
    const { n, dezile: D } = dezile(v, m.gt0), d = dez(v), f = w => U.formatZahl(w, d);
    const rg = K.auswahl !== null && K.auswahl !== undefined ? WK.daten.rang(v, K.auswahl, m.gt0) : null;
    const eigen = rg ? dezilVon(rg.perzentil) : null;
    const fb = WK.filter ? WK.filter.zustand() : {}, aktivB = fb.b && fb.v === v ? fb.b : null;
    S.ui.info.textContent = `${U.formatZahl(n, 0)} Kanten mit Wert, je Dezil rund ${U.formatZahl(n / 10, 0)} · unabhängig von Filtern`;
    const maxN = Math.max(...D.map(x => x.n), 1);
    const t = U.el('table', { class: 'dezil-tabelle' });
    t.appendChild(U.el('thead', {}, U.el('tr', {}, U.el('th', {}, 'Dezil'), U.el('th', { class: 'zahl' }, 'Wertebereich'), U.el('th', { class: 'zahl' }, 'Mittel'), U.el('th', { class: 'zahl' }, 'Kanten'))));
    const tb = U.el('tbody');
    for (const e of D.slice().reverse()) {
      if (!e.n) continue;
      const gefiltert = aktivB && Math.abs(aktivB[0] - e.min) < 1e-9 && Math.abs(aktivB[1] - e.max) < 1e-9;
      const verlauf = `linear-gradient(to right, ${WK.stil.farbe(v, e.min, K.skala, K.meta) || '#ccc'}, ${WK.stil.farbe(v, e.max, K.skala, K.meta) || '#ccc'})`;
      const row = U.el('tr', { class: 'klick' + (e.d === eigen ? ' gewaehlt' : '') + (gefiltert ? ' gefiltert' : ''), title: 'Klick: nur die Kanten dieses Dezils in Karte und Rangliste zeigen' },
        U.el('td', {}, U.el('span', { class: 'dezil-farbe', style: { background: verlauf } }), `${e.d}. Dezil`, e.d === 10 ? U.el('span', { class: 'badge top' }, 'oberstes') : null, e.d === eigen ? U.el('span', { class: 'badge' }, 'gewählte Kante') : null),
        U.el('td', { class: 'zahl' }, e.min === e.max ? f(e.min) : `${f(e.min)} bis ${f(e.max)}`),
        U.el('td', { class: 'zahl' }, f(e.summe / e.n)),
        U.el('td', { class: 'zahl', style: { background: `linear-gradient(to left, var(--bg3) ${(e.n / maxN * 100).toFixed(1)}%, transparent ${(e.n / maxN * 100).toFixed(1)}%)` } }, U.formatZahl(e.n, 0)));
      row.addEventListener('click', () => { if (WK.filter) WK.filter.setBereich([e.min, e.max]); S.ansicht = 'liste'; klassen(); neu(); WK.ui.melden(`${e.d}. Dezil: ${U.formatZahl(e.n, 0)} Kanten, Wertebereich als Filter gesetzt`, 3000); });
      tb.appendChild(row);
    }
    t.appendChild(tb); sc.appendChild(t);
    const fuss = U.el('div', { class: 'dezil-fuss' });
    if (rg) fuss.appendChild(U.el('p', {}, `Gewählte Kante: Rang ${U.formatZahl(rg.rang, 0)} von ${U.formatZahl(rg.n, 0)}, Perzentil ${U.formatZahl(rg.perzentil * 100, 1)} %, ${eigen}. Dezil.`));
    fuss.appendChild(U.el('p', { class: 'klein' }, 'Dezile teilen die Kanten mit Wert nach ihrem Rang in zehn gleich große Gruppen. Das oberste Dezil (ab dem 90. Perzentil) gilt in der Arbeit je Gefahr als Spitzengruppe. Gleiche Werte bleiben im selben Dezil, deshalb können die Gruppen leicht ungleich groß sein.'));
    if (aktivB) fuss.appendChild(U.el('button', { onclick: () => { WK.filter.setBereich(null); } }, 'Wertebereich-Filter aufheben'));
    sc.appendChild(fuss); sc.scrollTop = 0;
  }

  function spaltenAlle() {
    const meta = WK.daten.meta, aus = ['id', 'name', 'ref', 'highway', 'baulast', 'gemeinde', 'length_m', 'aktiv', 'im_kreis', 'bruecke', 'tunnel'];
    for (const s of Object.keys(meta.spalten)) if (!aus.includes(s) && s !== 'u' && s !== 'v') aus.push(s);
    return aus;
  }
  function gefiltert() { const praed = WK.karte.praedikat(); return WK.daten.features.filter(praed); }
  function csv() {
    if (!WK.karte.variable) { WK.ui.melden('Bitte zuerst eine Variable wählen'); return; }
    const fs = gefiltert(), sp = spaltenAlle();
    const z = [sp.join(';')];
    for (const fe of fs) z.push(sp.map(s => { const w = s === 'id' ? fe.id : fe.properties[s]; if (w === undefined || w === null) return ''; if (typeof w === 'number') return String(w).replace('.', ','); return '"' + String(w).replace(/"/g, '""') + '"'; }).join(';'));
    U.download(new Blob(['﻿' + z.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `webkarte_${WK.karte.variable}_${U.heuteKurz()}.csv`);
    WK.ui.melden(`${fs.length} Kanten als CSV exportiert`);
  }
  function geojson() {
    if (!WK.karte.variable) { WK.ui.melden('Bitte zuerst eine Variable wählen'); return; }
    const fs = gefiltert();
    const fc = { type: 'FeatureCollection', name: `webkarte_${WK.karte.variable}`, features: fs.map(fe => ({ type: 'Feature', id: fe.id, properties: Object.assign({ id: fe.id }, fe.properties), geometry: fe.geometry })) };
    U.download(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), `webkarte_${WK.karte.variable}_${U.heuteKurz()}.geojson`);
    WK.ui.melden(`${fs.length} Kanten als GeoJSON exportiert`);
  }
  return { init, oeffnen, schliessen, umschalten, setAnsicht, neu, csv, geojson, zeilen, dezile, dezilVon,
           get offen() { return S.offen; }, get ansicht() { return S.ansicht; }, get anzahl() { return S.zeilen.length; }, get gerendert() { return S.gerendert; }, get von() { return S.von; } };
})();
