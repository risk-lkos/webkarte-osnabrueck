/* Seitenleiste, Statusleiste, Dialoge, Tastatur, Meldungen */
WK.ui = (() => {
  const U = WK.util;
  const S = { seite: null, status: null, dialog: null, presetKnoepfe: new Map(), varKnoepfe: new Map(), meldung: null };

  function abschnitt(titel, offen, id) {
    const d = U.el('details', { class: 'abschnitt', open: offen ? true : false, id: id || null }, U.el('summary', {}, titel));
    const inhalt = U.el('div', { class: 'inhalt' });
    d.appendChild(inhalt);
    return { d, inhalt };
  }

  function init() {
    S.seite = document.getElementById('seite');
    S.status = document.getElementById('status');
    S.dialog = document.getElementById('dialog');
    const meta = WK.daten.meta;
    S.seite.innerHTML = '';

    // Presets
    const a1 = abschnitt('Karten der Arbeit', true, 'abs-presets');
    const liste = U.el('div', { class: 'liste' });
    for (const p of meta.presets) {
      const b = U.el('button', { title: p.titel, onclick: () => WK.karte.setPreset(p.id) },
        U.el('span', { class: 'farbe-punkt', style: { background: presetFarbe(p) } }),
        U.el('span', {}, `${p.kapitel ? p.kapitel + ' · ' : ''}${p.titel}`));
      S.presetKnoepfe.set(p.id, b); liste.appendChild(b);
    }
    a1.inhalt.appendChild(liste);
    S.seite.appendChild(a1.d);

    // Variablen nach Gruppen
    const a2 = abschnitt('Variablen nach Gefahr', true, 'abs-variablen');
    for (const g of meta.gruppen) {
      const vars = meta.variablen.filter(v => v.gruppe === g.id);
      if (!vars.length) continue;
      a2.inhalt.appendChild(U.el('div', { class: 'gruppe-kopf', title: g.text }, U.el('span', {}, g.label), U.el('span', { class: 'kurz' }, g.kurz)));
      const l = U.el('div', { class: 'liste' });
      for (const v of vars) {
        const b = U.el('button', { title: v.beschreibung || v.label, onclick: () => WK.karte.setVariable(v.id) },
          U.el('span', { class: 'balken', style: { background: v.typ === 'kategorial' ? 'repeating-linear-gradient(90deg,#999 0 6px,#ddd 6px 12px)' : WK.stil.rampe(v.rolle).css() } }),
          U.el('span', {}, v.label), U.el('span', { class: 'n' }, v.n_gueltig !== undefined ? U.formatZahl(v.n_gueltig, 0) : ''));
        S.varKnoepfe.set(v.id, b); l.appendChild(b);
      }
      a2.inhalt.appendChild(l);
    }
    S.seite.appendChild(a2.d);

    // Darstellung
    const a3 = abschnitt('Darstellung', true, 'abs-darstellung');
    const modusSel = U.el('select', { id: 'sel-modus' }, ...WK.klassifikation.MODI.map(m => U.el('option', { value: m.id }, m.label)));
    const kInput = U.el('input', { type: 'number', id: 'inp-klassen', min: 2, max: 12, value: 5, style: { width: '58px' }, title: 'Anzahl Klassen' });
    const vminInput = U.el('input', { type: 'number', id: 'inp-vmin', step: 'any', style: { width: '80px' } });
    const vmaxInput = U.el('input', { type: 'number', id: 'inp-vmax', step: 'any', style: { width: '80px' } });
    const festZeile = U.el('div', { class: 'zeile', id: 'zeile-fest' }, U.el('span', { class: 'klein' }, 'von'), vminInput, U.el('span', { class: 'klein' }, 'bis'), vmaxInput, U.el('button', { onclick: () => WK.karte.setModus('fest', { vmin: +vminInput.value, vmax: +vmaxInput.value }) }, 'setzen'));
    const klassenZeile = U.el('div', { class: 'zeile', id: 'zeile-klassen' }, U.el('label', { for: 'inp-klassen' }, 'Klassen'), kInput);
    modusSel.addEventListener('change', () => { const m = modusSel.value; festZeile.hidden = m !== 'fest'; klassenZeile.hidden = !(m === 'quantile' || m === 'gleich'); if (m !== 'fest') WK.karte.setModus(m, { k: +kInput.value }); else { const sk = WK.karte.skala || {}; vminInput.value = sk.vmin !== undefined ? +sk.vmin.toFixed(4) : 0; vmaxInput.value = sk.vmax !== undefined ? +sk.vmax.toFixed(4) : 1; } });
    kInput.addEventListener('change', () => WK.karte.setModus(modusSel.value, { k: +kInput.value }));
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'sel-modus' }, 'Skala'), modusSel));
    festZeile.hidden = true; klassenZeile.hidden = true;
    a3.inhalt.appendChild(festZeile); a3.inhalt.appendChild(klassenZeile);
    const gamma = U.el('input', { type: 'range', id: 'inp-gamma', min: 0.3, max: 2.5, step: 0.05, value: 1 });
    const gammaWert = U.el('span', { class: 'klein mono', id: 'gamma-wert' }, '1,00');
    gamma.addEventListener('input', () => { gammaWert.textContent = U.formatZahl(+gamma.value, 2); });
    gamma.addEventListener('change', () => { const r = (WK.karte.skala || {}).rolle || (WK.karte.meta || {}).rolle; if (r) WK.stil.aendern(['rollen', r, 'gamma'], +gamma.value); });
    a3.inhalt.appendChild(U.el('div', { class: 'zeile', title: 'Gamma < 1 spreizt niedrige Werte, > 1 hohe Werte (wirkt auf die Farbrolle der aktuellen Variable)' }, U.el('label', { for: 'inp-gamma' }, 'Gamma (Spreizung)'), gammaWert));
    a3.inhalt.appendChild(gamma);
    const breiteCb = U.el('input', { type: 'checkbox', id: 'cb-breite' });
    breiteCb.addEventListener('change', () => WK.karte.setModus(WK.karte.modus, { breiteNachWert: breiteCb.checked }));
    const labelsCb = U.el('input', { type: 'checkbox', id: 'cb-labels' });
    labelsCb.addEventListener('change', () => WK.karte.setLabels(labelsCb.checked));
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, breiteCb, ' Linienbreite nach Wert'), U.el('label', {}, labelsCb, ` Wert-Labels ab Zoom ${WK.config.karte.labelsAbZoom}`)));
    const kontextSel = U.el('select', { id: 'sel-kontext' }, U.el('option', { value: 'aktiv' }, 'aktive Kanten (grau)'), U.el('option', { value: 'gesamt' }, 'gesamtes Netz (grau)'), U.el('option', { value: 'aktiv_dunkel' }, 'aktive Kanten (dunkel)'), U.el('option', { value: 'keiner' }, 'kein Kontextnetz'));
    kontextSel.addEventListener('change', () => WK.karte.setKontext(kontextSel.value));
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'sel-kontext' }, 'Kontextnetz'), kontextSel));
    const schemaSel = U.el('select', { id: 'sel-schema' });
    for (const [id, sch] of Object.entries(WK.stil.schemata)) schemaSel.appendChild(U.el('option', { value: id }, sch.name || id));
    schemaSel.appendChild(U.el('option', { value: '__eigen', hidden: true }, 'eigenes Schema'));
    schemaSel.addEventListener('change', () => { if (schemaSel.value !== '__eigen') WK.stil.setSchema(schemaSel.value); });
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'sel-schema' }, 'Farbschema'), schemaSel, U.el('button', { onclick: () => WK.farben && WK.farben.oeffnen(), title: 'Farbeditor' }, '…')));
    S.seite.appendChild(a3.d);

    // Hintergrund
    const a4 = abschnitt('Hintergrundkarte', true, 'abs-basemap');
    const bmSel = U.el('select', { id: 'sel-basemap' }, ...WK.basemaps.liste().map(b => U.el('option', { value: b.id, title: b.attribution || '' }, b.label)));
    bmSel.addEventListener('change', () => WK.basemaps.setzen(WK.karte.map, bmSel.value, 'kontext_netz'));
    const bmOp = U.el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: 1, id: 'inp-bm-op' });
    bmOp.addEventListener('input', () => WK.basemaps.deckkraft(WK.karte.map, bmOp.value));
    a4.inhalt.appendChild(U.el('div', { class: 'zeile' }, bmSel));
    a4.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'inp-bm-op', class: 'klein' }, 'Deckkraft'), bmOp));
    a4.inhalt.appendChild(U.el('div', { class: 'klein', id: 'bm-attribution' }));
    S.seite.appendChild(a4.d);

    // Ebenen
    const a5 = abschnitt('Ebenen (Overlays)', false, 'abs-ebenen');
    a5.inhalt.id = 'ebenen-inhalt';
    S.seite.appendChild(a5.d);

    // Filter
    const a6 = abschnitt('Filter', false, 'abs-filter');
    a6.inhalt.id = 'filter-inhalt';
    S.seite.appendChild(a6.d);

    // Verteilung
    const a7 = abschnitt('Verteilung der Variable', false, 'abs-histogramm');
    a7.inhalt.id = 'histogramm-inhalt'; a7.inhalt.classList.add('histogramm');
    S.seite.appendChild(a7.d);

    // Werkzeuge
    const a8 = abschnitt('Werkzeuge', false, 'abs-werkzeuge');
    a8.inhalt.id = 'werkzeuge-inhalt';
    a8.inhalt.appendChild(U.el('div', { class: 'zeile' },
      U.el('button', { onclick: () => WK.karte.fitLK(), title: 'Ausschnitt Landkreis ± 2 km (Taste 0)' }, 'Landkreis'),
      U.el('button', { onclick: () => WK.karte.waehlen(null) }, 'Auswahl aufheben'),
      U.el('button', { id: 'btn-theme', onclick: () => themeWechseln() }, 'Dunkel/Hell')));
    S.seite.appendChild(a8.d);

    // Kopfknoepfe
    document.getElementById('btn-seite').addEventListener('click', () => { const app = document.getElementById('app'); if (window.innerWidth <= 900) app.classList.toggle('seite-offen'); else app.classList.toggle('ohne-seite'); setTimeout(() => WK.karte.map && WK.karte.map.resize(), 50); });
    document.getElementById('btn-farben').addEventListener('click', () => WK.farben && WK.farben.oeffnen());
    document.getElementById('btn-export').addEventListener('click', () => WK.exportPng && WK.exportPng.dialog());
    document.getElementById('btn-rangliste').addEventListener('click', () => WK.rangliste && WK.rangliste.oeffnen());
    document.getElementById('btn-hilfe').addEventListener('click', () => WK.hilfe && WK.hilfe.hilfe());
    document.getElementById('btn-ueber').addEventListener('click', () => WK.hilfe && WK.hilfe.ueber());
    document.getElementById('dialog-schliessen').addEventListener('click', dialogSchliessen);
    S.dialog.addEventListener('click', e => { if (e.target === S.dialog) dialogSchliessen(); });

    // Ereignisse
    WK.bus.on('variable', info => {
      for (const [id, b] of S.varKnoepfe) b.classList.toggle('aktiv', id === info.variable);
      for (const [id, b] of S.presetKnoepfe) b.classList.toggle('aktiv', !!(info.preset && info.preset.id === id));
      const sk = info.skala || {};
      const m = WK.karte.modus;
      if ([...modusSel.options].some(o => o.value === m)) modusSel.value = m;
      festZeile.hidden = m !== 'fest'; klassenZeile.hidden = !(m === 'quantile' || m === 'gleich');
      modusSel.disabled = !info.meta || info.meta.typ === 'kategorial';
      if (sk.vmin !== undefined) { vminInput.value = +(+sk.vmin).toFixed(4); vmaxInput.value = +(+sk.vmax).toFixed(4); }
      const rolle = sk.rolle || (info.meta || {}).rolle;
      const g = rolle ? (WK.stil.schema.rollen[rolle] || {}).gamma || 1 : 1;
      gamma.value = g; gammaWert.textContent = U.formatZahl(+g, 2);
      breiteCb.checked = !!sk.breiteNachWert;
      kontextSel.value = WK.karte.kontext;
      statusNeu();
    });
    WK.bus.on('stil', () => {
      const id = WK.stil.geaendert ? '__eigen' : WK.stil.schemaId;
      schemaSel.value = [...schemaSel.options].some(o => o.value === id) ? id : '__eigen';
      for (const [vid, b] of S.varKnoepfe) { const v = WK.daten.variable(vid); const bal = b.querySelector('.balken'); if (bal && v.typ !== 'kategorial') bal.style.background = WK.stil.rampe(v.rolle).css(); }
      for (const [pid, b] of S.presetKnoepfe) { const p = WK.daten.preset(pid); b.querySelector('.farbe-punkt').style.background = presetFarbe(p); }
    });
    WK.bus.on('basemap', id => { bmSel.value = id; document.getElementById('bm-attribution').textContent = WK.basemaps.attribution(id); });
    WK.bus.on('basemaps-geprueft', v => { for (const o of bmSel.options) { if (v[o.value] === false) { o.disabled = true; o.textContent = o.textContent.replace(/ \(nicht erreichbar\)$/, '') + ' (nicht erreichbar)'; } } });
    WK.bus.on('sichtbar', statusNeu);
    WK.bus.on('maus', ll => statusMaus(ll));
    WK.bus.on('zoom', statusNeu);
    schemaSel.value = WK.stil.geaendert ? '__eigen' : WK.stil.schemaId;
    tastatur();
    const t = U.ls(WK.config.speicher.theme); if (t === 'dunkel') document.documentElement.setAttribute('data-theme', 'dunkel');
  }
  function presetFarbe(p) {
    const rolle = (p.skala && p.skala.rolle) || (p.variable ? (WK.daten.variable(p.variable) || {}).rolle : null) || (p.raster ? 'heat' : p.overlay === 'gewaesser' ? 'coverage' : 'fluvial');
    if (p.variable === 'mhn_bf') return '#ff7f00';
    return WK.stil.rampe(rolle || 'pluvial').farbe(0.8);
  }
  function themeWechseln() {
    const dunkel = document.documentElement.getAttribute('data-theme') === 'dunkel';
    if (dunkel) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'dunkel');
    U.ls(WK.config.speicher.theme, dunkel ? 'hell' : 'dunkel');
  }
  let mausText = '';
  function statusMaus(ll) {
    if (!ll) return;
    let utm = '';
    try { const u = U.utm([ll.lng, ll.lat]); utm = ` · UTM 32N ${U.formatZahl(u[0], 0)} E / ${U.formatZahl(u[1], 0)} N`; } catch (e) { /* proj4 fehlt */ }
    mausText = `${ll.lat.toFixed(5)}°N ${ll.lng.toFixed(5)}°E${utm}`;
    statusNeu();
  }
  function statusNeu() {
    if (!S.status) return;
    const K = WK.karte, teile = [];
    if (K.map) teile.push(`Zoom ${K.map.getZoom().toFixed(1)}`);
    if (K.variable) teile.push(`${(K.meta || {}).label || K.variable}: ${U.formatZahl(K.S.sichtbar || 0, 0)} Kanten im Ausschnitt`);
    if (mausText) teile.push(mausText);
    if (WK.filter && WK.filter.aktiv()) teile.push('Filter aktiv');
    S.status.innerHTML = teile.map(t => `<span>${U.esc(t)}</span>`).join('');
  }
  // Dialoge
  function dialog(titel, inhalt, opts) {
    opts = opts || {};
    document.getElementById('dialog-titel').textContent = titel;
    const box = document.getElementById('dialog-inhalt');
    box.innerHTML = '';
    if (typeof inhalt === 'string') box.innerHTML = inhalt; else box.appendChild(inhalt);
    S.dialog.hidden = false;
    S.dialog.querySelector('.dialog-box').style.width = opts.breit ? 'min(1200px, 100%)' : 'min(960px, 100%)';
    return box;
  }
  function dialogSchliessen() { S.dialog.hidden = true; }
  function melden(text, ms) {
    if (!S.meldung) { S.meldung = U.el('div', { style: { position: 'fixed', left: '50%', bottom: '40px', transform: 'translateX(-50%)', background: 'rgba(28,30,33,.92)', color: '#fff', padding: '8px 14px', borderRadius: '8px', zIndex: 60, fontSize: '13px', boxShadow: 'var(--schatten)' } }); document.body.appendChild(S.meldung); }
    S.meldung.textContent = text; S.meldung.hidden = false;
    clearTimeout(S.meldung._t); S.meldung._t = setTimeout(() => { S.meldung.hidden = true; }, ms || 2200);
  }
  function tastatur() {
    const K = WK.karte;
    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const meta = WK.daten.meta;
      switch (e.key) {
        case 'Escape': if (!S.dialog.hidden) dialogSchliessen(); else K.waehlen(null); break;
        case 'f': case 'F': document.getElementById('suche').focus(); e.preventDefault(); break;
        case 'e': case 'E': if (WK.exportPng) WK.exportPng.dialog(); break;
        case 'c': case 'C': if (WK.farben) WK.farben.oeffnen(); break;
        case 'r': case 'R': if (WK.rangliste) WK.rangliste.oeffnen(); break;
        case 'd': case 'D': document.getElementById('app').classList.toggle('ohne-panel'); setTimeout(() => K.map && K.map.resize(), 50); break;
        case 'l': case 'L': document.getElementById('cb-labels').click(); break;
        case 'p': case 'P': if (WK.vergleich && K.auswahl !== null) WK.vergleich.anpinnen(K.auswahl); break;
        case '0': K.fitLK(); break;
        case '?': if (WK.hilfe) WK.hilfe.hilfe(); break;
        case 'ArrowRight': case 'ArrowLeft': {
          if (!K.variable) break;
          const vars = meta.variablen.map(v => v.id); let i = vars.indexOf(K.variable);
          i = (i + (e.key === 'ArrowRight' ? 1 : -1) + vars.length) % vars.length; K.setVariable(vars[i]); e.preventDefault(); break;
        }
        default: {
          const n = parseInt(e.key, 10);
          if (n >= 1 && n <= meta.gruppen.length) { const g = meta.gruppen[n - 1]; const v = meta.variablen.find(x => x.gruppe === g.id); if (v) K.setVariable(v.id); }
        }
      }
    });
  }
  return { init, dialog, dialogSchliessen, melden, statusNeu, themeWechseln, abschnitt };
})();
