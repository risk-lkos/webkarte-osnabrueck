/* Glossar und ?-Knoepfe: Kurzerklaerungen aus data/glossar.json (Wortlaut der Arbeit als "lang"),
   Popover neben dem Knopf, Glossar-Dialog. Texte sind Daten, nicht Code. */
WK.glossar = (() => {
  const U = WK.util;
  const S = { pop: null, anker: null, verlauf: [], spec: null, gebunden: false };
  const D = () => WK.daten.glossar || { begriffe: {}, gruppen: {}, variablen: {}, bedienung: {} };

  // spec: { begriff } | { variable } (Variable oder Panel-Spalte) | { gruppe } | { bedienung }
  function eintrag(spec) {
    const d = D();
    if (!spec) return null;
    if (spec.begriff) {
      const b = (d.begriffe || {})[spec.begriff]; if (!b) return null;
      return { titel: b.titel, kurz: b.kurz, lang: b.lang, begriffe: b.siehe || [], art: b.lang ? 'Begriff aus dem Glossar der Arbeit' : 'Begriff' };
    }
    if (spec.gruppe) {
      const g = WK.daten.gruppe ? WK.daten.gruppe(spec.gruppe) : null, e = (d.gruppen || {})[spec.gruppe] || {};
      if (!g && !e.kurz) return null;
      return { titel: g ? g.label : spec.gruppe, kurz: e.kurz || '', detail: g ? g.text : '', detailTitel: 'Datengrundlage und Methode', begriffe: e.begriffe || [], art: 'Gruppe' };
    }
    if (spec.variable) {
      const id = spec.variable, v = WK.daten.variable(id), sp = WK.daten.spalte(id) || {}, e = (d.variablen || {})[id] || {};
      const kurz = e.kurz || (v && v.beschreibung) || '';
      if (!kurz && !(e.begriffe || []).length) return null;
      const fakten = [];
      if (e.kurz && v && v.beschreibung) fakten.push(`Berechnung: ${v.beschreibung}`);     // eigener Kurztext: Formel der Arbeit als Zusatz
      const einheit = (v && v.einheit) || sp.einheit; if (einheit) fakten.push(`Einheit ${einheit}`);
      if (v && v.n_gueltig !== undefined) fakten.push(`${U.formatZahl(v.n_gueltig, 0)} Kanten mit Wert`);
      fakten.push(`Spalte ${id}`);
      return { titel: (v && v.label) || sp.label || id, kurz, fakten, begriffe: e.begriffe || [], art: v ? 'Variable' : 'Kennwert' };
    }
    if (spec.bedienung) {
      const b = (d.bedienung || {})[spec.bedienung]; if (!b) return null;
      return { titel: b.titel, kurz: b.kurz, begriffe: b.begriffe || [], art: 'Bedienung' };
    }
    return null;
  }

  function popAnlegen() {
    if (S.pop) return;
    S.pop = U.el('div', { class: 'glossar-pop', role: 'dialog', 'aria-label': 'Erklärung', hidden: true });
    document.body.appendChild(S.pop);
    if (S.gebunden) return; S.gebunden = true;
    document.addEventListener('mousedown', e => { if (S.pop.hidden) return; if (S.pop.contains(e.target) || (e.target.closest && e.target.closest('.hilfe-knopf'))) return; schliessen(); }, true);
    document.addEventListener('keydown', e => { if (!S.pop.hidden && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); schliessen(); } }, true);
    document.addEventListener('scroll', e => { if (!S.pop.hidden && !(e.target && S.pop.contains(e.target))) schliessen(); }, true);
    window.addEventListener('resize', () => schliessen());
  }
  function schliessen() { if (S.pop) S.pop.hidden = true; if (S.anker) S.anker.classList.remove('aktiv'); S.anker = null; S.spec = null; }

  function zeigen(anker, spec, ausVerlauf) {
    const e = eintrag(spec); if (!e) return;
    popAnlegen();
    if (S.anker && S.anker !== anker) S.anker.classList.remove('aktiv');
    if (!ausVerlauf && S.spec && S.anker === anker) S.verlauf.push(S.spec);
    S.anker = anker; S.spec = spec; anker.classList.add('aktiv');
    const p = S.pop; p.innerHTML = '';
    p.appendChild(U.el('div', { class: 'gp-kopf' },
      S.verlauf.length ? U.el('button', { class: 'gp-zurueck', title: 'zurück', onclick: () => { const s = S.verlauf.pop(); zeigen(anker, s, true); } }, '‹') : null,
      U.el('strong', {}, e.titel), U.el('button', { class: 'gp-zu', title: 'Schließen (Esc)', onclick: schliessen }, '✕')));
    if (e.kurz) p.appendChild(U.el('p', {}, e.kurz));
    if (e.fakten && e.fakten.length) p.appendChild(U.el('p', { class: 'klein' }, e.fakten.join(' · ')));
    if (e.detail) p.appendChild(U.el('details', {}, U.el('summary', {}, e.detailTitel || 'Mehr'), U.el('p', {}, e.detail)));
    if (e.lang) p.appendChild(U.el('details', {}, U.el('summary', {}, 'Wortlaut im Glossar der Arbeit'), U.el('p', {}, e.lang)));
    const chips = (e.begriffe || []).filter(k => (D().begriffe || {})[k]);
    if (chips.length) p.appendChild(U.el('div', { class: 'gp-chips' }, U.el('span', { class: 'klein' }, 'Begriffe:'), ...chips.map(k => U.el('button', { onclick: () => zeigen(anker, { begriff: k }) }, D().begriffe[k].titel))));
    p.appendChild(U.el('div', { class: 'gp-fuss' }, U.el('span', { class: 'klein' }, e.art || ''), U.el('button', { class: 'gp-link', onclick: () => { schliessen(); dialog(); } }, 'ganzes Glossar')));
    p.hidden = false;
    platzieren(anker);
  }
  function platzieren(anker) {
    const p = S.pop, r = anker.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    p.style.left = '0px'; p.style.top = '0px';
    const w = p.offsetWidth, h = p.offsetHeight;
    // Knopf in der rechten Bildschirmhaelfte (Panel): Erklaerung links davon, damit die Werte lesbar bleiben
    const rechts = r.right + 10, links = r.left - w - 10, rechtsZuerst = (r.left + r.right) / 2 < vw / 2;
    let x = rechtsZuerst ? rechts : links;
    if (x + w > vw - 8 || x < 8) x = rechtsZuerst ? links : rechts;
    if (x + w > vw - 8 || x < 8) x = Math.max(8, Math.min(vw - w - 8, r.left));
    let y = r.top - 8; if (x < r.right && x + w > r.left) y = r.bottom + 8;        // ueber/unter dem Knopf, wenn seitlich kein Platz war
    if (y + h > vh - 8) y = Math.max(8, vh - h - 8);
    p.style.left = Math.round(x) + 'px'; p.style.top = Math.round(Math.max(8, y)) + 'px';
  }

  // ?-Knopf; gibt null zurueck, wenn es zu spec keine Erklaerung gibt
  function knopf(spec, opts) {
    if (!eintrag(spec)) return null;
    const b = U.el('button', { class: 'hilfe-knopf' + (opts && opts.klasse ? ' ' + opts.klasse : ''), type: 'button', title: 'Was bedeutet das?', 'aria-label': 'Erklärung anzeigen' }, '?');
    b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (S.pop && !S.pop.hidden && S.anker === b) { schliessen(); return; }
      S.verlauf = []; S.spec = null; zeigen(b, spec);
    });
    return b;
  }

  // Glossar-Dialog: alle Begriffe alphabetisch, mit Suche
  function dialog() {
    const d = D(), box = U.el('div', { class: 'glossar-liste' });
    const inp = U.el('input', { type: 'search', placeholder: 'Begriff suchen …', style: { width: '100%', marginBottom: '10px' } });
    const liste = U.el('div');
    const alle = Object.entries(d.begriffe || {}).map(([k, b]) => ({ k, b })).sort((a, b) => a.b.titel.localeCompare(b.b.titel, 'de'));
    const norm = s => String(s).toLowerCase();
    const zeichnen = () => {
      const qy = norm(inp.value.trim()); liste.innerHTML = '';
      const treffer = alle.filter(x => !qy || norm(x.b.titel).includes(qy) || norm(x.b.kurz || '').includes(qy) || norm(x.b.lang || '').includes(qy));
      for (const { b } of treffer) liste.appendChild(U.el('div', { class: 'gl-eintrag' }, U.el('strong', {}, b.titel), U.el('p', {}, b.kurz || ''), b.lang ? U.el('details', {}, U.el('summary', {}, 'Wortlaut im Glossar der Arbeit'), U.el('p', {}, b.lang)) : null));
      if (!treffer.length) liste.appendChild(U.el('p', { class: 'hinweis' }, 'Kein Begriff gefunden.'));
    };
    inp.addEventListener('input', zeichnen);
    box.appendChild(U.el('p', { class: 'hinweis', style: { marginTop: 0 } }, 'Kurzerklärungen zu den Begriffen der Karte. Wo vorhanden, steht darunter der Wortlaut aus dem Glossar der Masterarbeit. Dieselben Texte erscheinen über die ?-Knöpfe in Menü, Legende und Kantendetails.'));
    box.appendChild(inp); box.appendChild(liste); zeichnen();
    WK.ui.dialog('Glossar', box);
    setTimeout(() => inp.focus(), 50);
  }
  return { knopf, zeigen, schliessen, dialog, eintrag, get offen() { return !!(S.pop && !S.pop.hidden); } };
})();
