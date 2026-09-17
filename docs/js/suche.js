/* Suche: Strassenname, Nummer (ref), Gemeinde, Kanten-id; Strassenzug hervorheben */
WK.suche = (() => {
  const U = WK.util;
  const S = { index: null, gemeinden: null, aktiv: -1, treffer: [] };
  function norm(s) { return String(s).toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function normRef(s) { return norm(s).replace(/\s+/g, ''); }

  function indexBauen() {
    const namen = new Map(), refs = new Map();
    for (const fe of WK.daten.features) {
      const p = fe.properties;
      if (p.name) { const k = norm(p.name) + '|' + (p.gemeinde || ''); let e = namen.get(k); if (!e) { e = { name: p.name, gemeinde: p.gemeinde || null, ids: [] }; namen.set(k, e); } e.ids.push(fe.id); }
      if (p.ref) { for (const r of String(p.ref).split(/[;,]/)) { if (!r.trim()) continue; const k = normRef(r); let e = refs.get(k); if (!e) { e = { ref: r.trim(), ids: [] }; refs.set(k, e); } e.ids.push(fe.id); } }
    }
    S.index = { namen: [...namen.values()], refs: [...refs.entries()].map(([k, v]) => Object.assign(v, { k })) };
    const gv = WK.daten.variable('gemeinde');
    S.gemeinden = (gv && gv.werte ? gv.werte : []).map(g => ({ name: g, k: norm(g) }));
  }
  function suchen(q) {
    if (!S.index) indexBauen();
    const nq = norm(q), rq = normRef(q), aus = [];
    if (!nq) return aus;
    const idM = q.match(/^#?\s*(\d{1,6})$/);
    if (idM && WK.daten.feature(+idM[1])) { const fe = WK.daten.feature(+idM[1]); aus.push({ art: 'Kante', label: `Kante ${fe.id}: ${[fe.properties.ref, fe.properties.name].filter(Boolean).join(' · ') || fe.properties.highway}`, ids: [fe.id] }); }
    for (const g of S.gemeinden) if (g.k.startsWith(nq) || g.k.includes(nq)) aus.push({ art: 'Gemeinde', label: g.name, gemeinde: g.name });
    let refTreffer = 0;
    for (const r of S.index.refs) if (r.k.startsWith(rq) || (rq.length >= 2 && r.k.includes(rq))) { aus.push({ art: 'Straßenzug', label: `${r.ref} (${r.ids.length} Kanten)`, ids: r.ids, ref: r.ref }); refTreffer++; }
    // Rueckfall: gleiche Nummer mit anderem Buchstaben (z. B. "L 214" gesucht, im Netz nur B 214 / K 214)
    const nummer = (rq.match(/^[a-z]{1,2}(\d{1,4})$/) || [])[1];
    if (!refTreffer && nummer) for (const r of S.index.refs) if (r.k.replace(/^[a-z]+/, '') === nummer) aus.push({ art: 'Straßenzug (gleiche Nummer)', label: `${r.ref} (${r.ids.length} Kanten) – keine „${q.trim().toUpperCase()}" im Netz`, ids: r.ids, ref: r.ref });
    const nm = S.index.namen.filter(n => norm(n.name).includes(nq)).sort((a, b) => (norm(a.name).startsWith(nq) ? 0 : 1) - (norm(b.name).startsWith(nq) ? 0 : 1) || a.name.localeCompare(b.name, 'de'));
    for (const n of nm.slice(0, 40)) aus.push({ art: 'Straße', label: `${n.name}${n.gemeinde ? ' · ' + n.gemeinde : ''} (${n.ids.length})`, ids: n.ids });
    return aus.slice(0, 14);
  }
  function bboxIds(ids) {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity; const b = WK.daten.S.bboxes;
    for (const id of ids) { const i = WK.daten.idx(id); if (i === undefined) continue; if (b[i * 4] < w) w = b[i * 4]; if (b[i * 4 + 1] < s) s = b[i * 4 + 1]; if (b[i * 4 + 2] > e) e = b[i * 4 + 2]; if (b[i * 4 + 3] > n) n = b[i * 4 + 3]; }
    return [w, s, e, n];
  }
  async function springen(t) {
    const map = WK.karte.map;
    if (t.gemeinde) {
      try {
        const gj = await WK.daten.kontext('gemeinden');
        const f = gj.features.find(x => x.properties.name === t.gemeinde);
        if (f) { const c = []; const walk = a => { if (typeof a[0] === 'number') c.push(a); else a.forEach(walk); }; walk(f.geometry.coordinates); const bb = U.bboxVon(c); map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 30, duration: 700 }); }
        if (WK.layers) WK.layers.setzen('gemeinden', true);
      } catch (e) { console.warn(e); }
      return;
    }
    if (t.ids && t.ids.length === 1) { WK.karte.waehlen(t.ids[0], { quelle: 'suche' }); WK.karte.fokus(t.ids[0]); return; }
    if (t.ids && t.ids.length) {
      const bb = bboxIds(t.ids);
      map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 60, duration: 700, maxZoom: 15 });
      WK.karte.nachbarnZeigen(t.ids);
      WK.ui.melden(`${t.ids.length} Kanten markiert: ${t.label}`, 3000);
    }
  }
  function strassenzug(ref) { if (!S.index) indexBauen(); const r = S.index.refs.find(x => x.k === normRef(ref)); if (r) springen({ ids: r.ids, label: `Straßenzug ${r.ref}` }); }
  function init() {
    const inp = document.getElementById('suche'), box = document.getElementById('suche-treffer');
    const zeigen = () => {
      const q = inp.value; S.treffer = q.length >= 1 ? suchen(q) : []; S.aktiv = -1;
      box.innerHTML = '';
      if (!S.treffer.length) { box.hidden = true; return; }
      S.treffer.forEach((t, i) => { const d = U.el('div', { onclick: () => { springen(t); box.hidden = true; inp.blur(); } }, U.el('span', { class: 'art' }, t.art), t.label); box.appendChild(d); });
      box.hidden = false;
    };
    inp.addEventListener('input', U.debounce(zeigen, 120));
    inp.addEventListener('focus', () => { if (inp.value) zeigen(); });
    inp.addEventListener('keydown', e => {
      const kinder = box.children;
      if (e.key === 'ArrowDown') { S.aktiv = Math.min(kinder.length - 1, S.aktiv + 1); [...kinder].forEach((k, i) => k.classList.toggle('aktiv', i === S.aktiv)); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { S.aktiv = Math.max(0, S.aktiv - 1); [...kinder].forEach((k, i) => k.classList.toggle('aktiv', i === S.aktiv)); e.preventDefault(); }
      else if (e.key === 'Enter') { const t = S.treffer[S.aktiv >= 0 ? S.aktiv : 0]; if (t) { springen(t); box.hidden = true; inp.blur(); } }
      else if (e.key === 'Escape') { box.hidden = true; inp.blur(); }
    });
    document.addEventListener('click', e => { if (!box.contains(e.target) && e.target !== inp) box.hidden = true; });
  }
  return { init, suchen, springen, strassenzug, norm };
})();
