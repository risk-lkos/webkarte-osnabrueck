/* Anleitung: gefuehrte Tour durch alle Bereiche der Karte. Startet beim ersten Besuch von selbst
   (wk.tour.gesehen) und jederzeit ueber den Knopf "Anleitung". Texte der Bereiche kommen aus data/glossar.json. */
WK.tour = (() => {
  const U = WK.util;
  const S = { aktiv: false, i: 0, schritte: [], sperre: null, loch: null, karte: null, merk: null, taste: null, groesse: null };
  const mobil = () => window.innerWidth <= 900;
  const el = id => document.getElementById(id);
  const B = key => { const b = ((WK.daten.glossar || {}).bedienung || {})[key]; return b ? b.kurz : ''; };

  function abschnittAuf(id) { const d = el(id); if (d && !d.open) d.open = true; return d; }
  function gruppeAuf(gid) {
    const t = document.querySelector(`.gruppe-toggle[data-gruppe="${gid}"]`); if (!t) return null;
    if (t.getAttribute('aria-expanded') !== 'true') { t.click(); S.merk.gruppenGeoeffnet.push(gid); }
    return t;
  }
  function kanteWaehlen() {
    const K = WK.karte; if (K.auswahl !== null && K.auswahl !== undefined) return;
    const v = K.variable; let best = null;
    for (const fe of WK.daten.features) { const w = v ? fe.properties[v] : fe.properties.importance_s; if (typeof w === 'number' && fe.properties.ref && (!best || w > best.w)) best = { w, id: fe.id }; }
    if (best) { K.waehlen(best.id, { quelle: 'tour' }); S.merk.kanteGewaehlt = true; }
  }

  function schritte() {
    const meta = WK.daten.meta, gl = (WK.daten.glossar || {}).gruppen || {};
    const gruppenListe = U.el('ul', {}, ...meta.gruppen.map(g => U.el('li', {}, U.el('strong', {}, g.label + ': '), (gl[g.id] || {}).kurz || '')));
    const heatKopf = () => { const t = gruppeAuf('heat'); if (!t) return [el('abs-variablen')]; const kopf = t.closest('.gruppe-kopf'); const aus = [kopf]; let n = kopf.nextElementSibling; while (n && !n.classList.contains('gruppe-kopf')) { aus.push(n); n = n.nextElementSibling; } return aus; };
    return [
      { titel: 'Willkommen', text: ['Diese Karte zeigt die Ergebnisse der Masterarbeit zur Multi-Hazard-Vulnerabilität des Straßennetzes im Landkreis Osnabrück. Jede der 72.238 Kanten trägt ihre berechneten Kennwerte: Netzbedeutung, Starkregen, Flusshochwasser, Hitze und deren Zusammentreffen.', 'Die Tour führt in etwa zwei Minuten durch alle Bereiche. Weiter geht es mit den Knöpfen oder den Pfeiltasten, Esc beendet sie. Du findest sie später jederzeit oben unter „Anleitung".'] },
      { ziel: () => el('karte'), titel: 'Die Karte', text: ['Jede farbige Linie ist eine Kante mit einem Wert der gerade gezeigten Variable. Graue Linien sind das Kontextnetz ohne Wert.', 'Überfahren zeigt Name, Wert und Rang. Ein Klick öffnet rechts alle Kennwerte der Kante. Zoomen mit dem Mausrad oder den Knöpfen oben links.'] },
      { ziel: () => abschnittAuf('abs-presets'), block: 'start', titel: 'Karten der Arbeit', text: [B('abs-presets'), B('arbeitsansicht')] },
      { ziel: () => abschnittAuf('abs-variablen'), block: 'start', titel: 'Variablen nach Gefahr', text: ['Hier liegen alle Kennwerte in sieben Gruppen. Ein Klick auf den Gruppennamen klappt die Variablen auf oder zu.', gruppenListe] },
      { ziel: () => { abschnittAuf('abs-variablen'); return heatKopf(); }, block: 'center', titel: 'Eine Gruppe im Detail', text: ['Jede Zeile ist eine Variable; ein Klick färbt das Netz danach ein. Der Balken zeigt die Farbskala, die Zahl die Kanten mit Wert. Ein oranger Punkt am Gruppennamen zeigt, wo die gerade gezeigte Variable liegt.', B('top25'), B('top_ebene'), 'Die ?-Knöpfe erklären jede Gruppe und jede Variable, oft mit dem Wortlaut aus dem Glossar der Arbeit.'] },
      { ziel: () => abschnittAuf('abs-darstellung'), block: 'start', titel: 'Darstellung', text: [B('abs-darstellung'), 'Liegen Werte so nah beieinander, dass die Farben kaum zu unterscheiden sind: Skala „an Kartenausschnitt anpassen" wählen, mit Gamma spreizen oder Wert-Labels einschalten.'] },
      { ziel: () => abschnittAuf('abs-basemap'), block: 'center', titel: 'Hintergrundkarte', text: [B('abs-basemap')] },
      { ziel: () => abschnittAuf('abs-ebenen'), block: 'center', titel: 'Ebenen', text: [B('abs-ebenen')] },
      { ziel: () => abschnittAuf('abs-filter'), block: 'start', titel: 'Filter', text: [B('abs-filter'), B('filter_topn')] },
      { ziel: () => abschnittAuf('abs-histogramm'), block: 'center', titel: 'Verteilung', text: [B('abs-histogramm')] },
      { ziel: () => [abschnittAuf('abs-favoriten'), abschnittAuf('abs-werkzeuge')], block: 'center', titel: 'Favoriten und Werkzeuge', text: [B('abs-favoriten'), B('abs-werkzeuge')] },
      { ziel: () => el('legende'), titel: 'Legende', text: [B('legende')] },
      { vorher: kanteWaehlen, ziel: () => el('kante-info'), titel: 'Kantendetails', text: [B('panel'), B('strassenzug'), B('pins')] },
      { vorher: kanteWaehlen, ziel: () => el('detailkarte-wrap'), titel: 'Detailkarte', text: [B('detailkarte')] },
      { ziel: () => document.querySelector('.kopf .suche'), titel: 'Suche', text: ['Findet Straßennamen, Straßennummern wie B 68, Gemeinden und Kanten-Nummern. Ein Treffer auf eine Straßennummer zoomt auf den ganzen Straßenzug und öffnet dessen Auswertung.'] },
      { ziel: () => document.querySelector('.kopf .knoepfe'), titel: 'Knöpfe oben', text: [U.el('ul', {}, U.el('li', {}, U.el('strong', {}, 'Farben: '), B('farbschema')), U.el('li', {}, U.el('strong', {}, 'Export: '), B('export')), U.el('li', {}, U.el('strong', {}, 'Rangliste: '), B('rangliste')), U.el('li', {}, U.el('strong', {}, 'Melden: '), B('melden')), U.el('li', {}, U.el('strong', {}, 'Anleitung, Hilfe, Über: '), 'diese Tour, Tastaturkürzel und Glossar, Datenquellen und Lizenzen.'))] },
      { titel: 'Fertig', text: ['Das war der Rundgang. Guter Start: eine „Karte der Arbeit" wählen, in eine Gegend zoomen und Kanten anklicken.', 'Wo immer ein ? steht, gibt es eine kurze Erklärung. Das ganze Glossar und die Tastaturkürzel stehen unter „Hilfe", die Tour unter „Anleitung".'] },
    ];
  }

  function dom() {
    S.sperre = U.el('div', { class: 'tour-sperre' });
    S.loch = U.el('div', { class: 'tour-loch', hidden: true });
    S.karte = U.el('div', { class: 'tour-karte', role: 'dialog', 'aria-label': 'Anleitung' });
    document.body.appendChild(S.sperre); document.body.appendChild(S.loch); document.body.appendChild(S.karte);
  }
  function start() {
    if (S.aktiv) return;
    if (WK.glossar) WK.glossar.schliessen();
    if (WK.ui && WK.ui.dialogSchliessen) WK.ui.dialogSchliessen();
    if (WK.rangliste && WK.rangliste.offen) WK.rangliste.schliessen();
    const app = el('app');
    S.merk = { abschnitte: [...document.querySelectorAll('details.abschnitt')].map(d => [d, d.open]), gruppenGeoeffnet: [], kanteGewaehlt: false,
               ohneSeite: app.classList.contains('ohne-seite'), ohnePanel: app.classList.contains('ohne-panel') };
    app.classList.remove('ohne-seite', 'ohne-panel');
    S.schritte = schritte(); S.aktiv = true; dom();
    S.taste = e => {
      if (!S.aktiv) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); beenden(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); weiter(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); zurueck(); }
      else if (e.key.length === 1) e.stopPropagation();     // Tastaturkuerzel der Karte ruhen waehrend der Tour
    };
    S.groesse = U.debounce(() => { if (S.aktiv) layout(); }, 120);
    document.addEventListener('keydown', S.taste, true);
    window.addEventListener('resize', S.groesse);
    setTimeout(() => WK.karte.map && WK.karte.map.resize(), 60);
    zeigen(0);
  }
  function weiter() { if (S.i >= S.schritte.length - 1) beenden(true); else zeigen(S.i + 1); }
  function zurueck() { if (S.i > 0) zeigen(S.i - 1); }
  function zeigen(i) {
    S.i = i; const st = S.schritte[i];
    try { if (st.vorher) st.vorher(); } catch (e) { console.warn('tour', e); }
    inhalt(st);
    layout();
    setTimeout(() => { if (S.aktiv && S.i === i) layout(); }, 140);     // nach Aufklappen und Scrollen erneut messen
  }
  function inhalt(st) {
    const k = S.karte, n = S.schritte.length; k.innerHTML = '';
    k.appendChild(U.el('div', { class: 'tour-kopf' }, U.el('span', { class: 'klein' }, `Anleitung · Schritt ${S.i + 1} von ${n}`), U.el('button', { class: 'tour-zu', title: 'Tour beenden (Esc)', onclick: () => beenden() }, '✕')));
    k.appendChild(U.el('h3', {}, st.titel));
    const body = U.el('div', { class: 'tour-text' });
    for (const t of st.text) { if (!t) continue; body.appendChild(typeof t === 'string' ? U.el('p', {}, t) : t); }
    k.appendChild(body);
    const punkte = U.el('div', { class: 'tour-punkte' }, ...S.schritte.map((_, j) => U.el('span', { class: j === S.i ? 'an' : '' })));
    k.appendChild(U.el('div', { class: 'tour-fuss' },
      S.i === 0 ? U.el('button', { onclick: () => beenden() }, 'Überspringen') : U.el('button', { onclick: zurueck }, '‹ Zurück'),
      punkte,
      U.el('button', { class: 'aktiv', onclick: weiter }, S.i === 0 ? 'Tour starten ›' : S.i === n - 1 ? 'Fertig' : 'Weiter ›')));
  }
  function ziele(st) {
    let z = []; try { z = st.ziel ? [].concat(st.ziel()).filter(Boolean) : []; } catch (e) { console.warn('tour', e); }
    return z;
  }
  function layout() {
    const st = S.schritte[S.i], z = ziele(st), app = el('app'), vw = window.innerWidth, vh = window.innerHeight;
    // schmale Bildschirme: die passende Schublade oeffnen
    const inSeite = z.length && z[0].closest && z[0].closest('#seite'), inPanel = z.length && z[0].closest && z[0].closest('#panel');
    if (mobil()) { app.classList.toggle('seite-offen', !!inSeite); app.classList.toggle('panel-offen', !!inPanel); }
    if (z.length) { try { z[0].scrollIntoView({ block: st.block || 'nearest' }); } catch (e) { /* leer */ } }
    let r = null;
    for (const e of z) { const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue; r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom }; }
    if (r) { r = { l: Math.max(4, r.l - 5), t: Math.max(4, r.t - 5), r: Math.min(vw - 4, r.r + 5), b: Math.min(vh - 4, r.b + 5) }; if (r.r - r.l < 8 || r.b - r.t < 8) r = null; }
    S.sperre.classList.toggle('dunkel', !r);
    S.loch.hidden = !r;
    if (r) Object.assign(S.loch.style, { left: r.l + 'px', top: r.t + 'px', width: (r.r - r.l) + 'px', height: (r.b - r.t) + 'px' });
    // Karte der Tour platzieren
    const k = S.karte; k.classList.remove('unten', 'oben'); k.style.left = ''; k.style.top = '';
    if (mobil()) { k.classList.add(r && (r.t + r.b) / 2 > vh / 2 ? 'oben' : 'unten'); return; }
    const w = k.offsetWidth, h = k.offsetHeight, m = 14;
    let x, y;
    if (!r) { x = (vw - w) / 2; y = (vh - h) / 2; }
    else if (r.r + m + w <= vw - 8) { x = r.r + m; y = r.t; }
    else if (r.l - m - w >= 8) { x = r.l - m - w; y = r.t; }
    else if (r.b + m + h <= vh - 8) { x = r.l; y = r.b + m; }
    else if (r.t - m - h >= 8) { x = r.l; y = r.t - m - h; }
    else { x = vw - w - 24; y = vh - h - 24; }                       // grosses Ziel (Karte): in die Ecke
    k.style.left = Math.round(Math.max(8, Math.min(vw - w - 8, x))) + 'px';
    k.style.top = Math.round(Math.max(8, Math.min(vh - h - 8, y))) + 'px';
  }
  function beenden(fertig) {
    if (!S.aktiv) return;
    S.aktiv = false;
    document.removeEventListener('keydown', S.taste, true);
    window.removeEventListener('resize', S.groesse);
    for (const e of [S.sperre, S.loch, S.karte]) if (e && e.parentNode) e.parentNode.removeChild(e);
    // Zustand von vor der Tour wiederherstellen
    const m = S.merk, app = el('app');
    for (const [d, offen] of m.abschnitte) d.open = offen;
    for (const gid of m.gruppenGeoeffnet) { const t = document.querySelector(`.gruppe-toggle[data-gruppe="${gid}"]`); if (t && t.getAttribute('aria-expanded') === 'true') t.click(); }
    if (m.kanteGewaehlt) WK.karte.waehlen(null);
    if (m.ohneSeite) app.classList.add('ohne-seite'); if (m.ohnePanel) app.classList.add('ohne-panel');
    if (mobil()) app.classList.remove('seite-offen', 'panel-offen');
    const seite = el('seite'); if (seite) seite.scrollTop = 0;
    setTimeout(() => WK.karte.map && WK.karte.map.resize(), 60);
    U.ls('wk.tour.gesehen', 1);
    if (WK.ui) WK.ui.melden(fertig ? 'Tour beendet. Du findest sie jederzeit oben unter „Anleitung".' : 'Tour geschlossen. Du findest sie jederzeit oben unter „Anleitung".', 3500);
  }
  // beim ersten Besuch von selbst starten
  function autostart() { if (!U.ls('wk.tour.gesehen')) setTimeout(() => { if (!S.aktiv) start(); }, 700); }
  return { start, beenden, weiter, zurueck, autostart, get aktiv() { return S.aktiv; }, get schritt() { return S.i; }, get anzahl() { return S.schritte.length; } };
})();
