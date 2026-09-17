/* Farbeditor: Schema waehlen/speichern/exportieren, Rollen (Palette, lo/hi, umkehren, gamma, freie Stops),
   Kategoriefarben, Breiten, Kontextfarben, Farbfehlsichtigkeits-Simulation, Kontrastpruefung */
WK.farben = (() => {
  const U = WK.util;
  const ROLLEN = [['pluvial', 'Starkregen'], ['fluvial', 'Flusshochwasser'], ['heat', 'Hitze'], ['compound', 'Compound'], ['importance', 'Link Importance'], ['coverage', 'Abdeckung / Beschattung']];
  const CVD = {
    keine: null,
    protanopie: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deuteranopie: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
    tritanopie: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
  };
  const S = { cvd: 'keine', eigene: {} };

  function init() {
    S.eigene = U.ls('wk.schemata.eigen') || {};
    for (const [id, sch] of Object.entries(S.eigene)) if (!WK.stil.schemata[id]) WK.stil.schemata[id] = sch;
    // SVG-Filter fuer die Simulation
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0');
    svg.innerHTML = Object.entries(CVD).filter(([k, m]) => m).map(([k, m]) => `<filter id="cvd-${k}"><feColorMatrix type="matrix" values="${m[0]} ${m[1]} ${m[2]} 0 0 ${m[3]} ${m[4]} ${m[5]} 0 0 ${m[6]} ${m[7]} ${m[8]} 0 0 0 0 0 1 0"/></filter>`).join('');
    document.body.appendChild(svg);
  }
  function cvdSetzen(art) {
    S.cvd = art;
    const f = art && art !== 'keine' ? `url(#cvd-${art})` : '';
    for (const sel of ['#karte', '#legende', '#detailkarte', '#histogramm-inhalt']) { const e = document.querySelector(sel); if (e) e.style.filter = f; }
  }
  function balken(rolle) { return U.el('div', { class: 'vorschau-balken', style: { background: WK.stil.rampe(rolle).css() } }); }

  function oeffnen() {
    const box = U.el('div', { class: 'farbeditor' });
    const s = WK.stil.schema;
    // --- Schema ---
    const sel = U.el('select');
    for (const [id, sch] of Object.entries(WK.stil.schemata)) sel.appendChild(U.el('option', { value: id, selected: id === WK.stil.schemaId && !WK.stil.geaendert }, sch.name || id));
    sel.addEventListener('change', () => { WK.stil.setSchema(sel.value); neu(); });
    const name = U.el('input', { type: 'text', placeholder: 'Name für eigenes Schema', style: { width: '200px' } });
    const speichern = U.el('button', { onclick: () => {
      const n = name.value.trim(); if (!n) { WK.ui.melden('Bitte einen Namen eingeben'); return; }
      const id = 'eigen_' + n.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const sch = Object.assign({}, WK.stil.exportieren(), { id, name: n, basis: 'arbeit' });
      S.eigene[id] = sch; U.ls('wk.schemata.eigen', S.eigene); WK.stil.schemata[id] = sch; WK.stil.S.schemaId = id; WK.stil.S.geaendert = false;
      WK.bus.emit('stil'); WK.ui.melden(`Schema „${n}" gespeichert`); neu();
    } }, 'speichern');
    const exportieren = U.el('button', { onclick: () => { const sch = WK.stil.exportieren(); U.download(new Blob([JSON.stringify(sch, null, 1)], { type: 'application/json' }), `farbschema_${(sch.id || 'eigen').replace(/[^a-z0-9_]/gi, '_')}_${U.heuteKurz()}.json`); } }, 'als JSON exportieren');
    const datei = U.el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    datei.addEventListener('change', async () => {
      const f = datei.files[0]; if (!f) return;
      try { const obj = JSON.parse(await f.text()); const fehler = WK.stil.importieren(obj); if (fehler.length) WK.ui.melden('Schema ungültig: ' + fehler[0], 5000); else { WK.ui.melden('Schema importiert'); neu(); } } catch (e) { WK.ui.melden('JSON nicht lesbar'); }
    });
    const importieren = U.el('button', { onclick: () => datei.click() }, 'JSON importieren');
    const reset = U.el('button', { onclick: () => { WK.stil.zuruecksetzen(); neu(); } }, 'Zurücksetzen auf „Arbeit"');
    const status = U.el('span', { class: 'klein' });
    const fs1 = U.el('fieldset', {}, U.el('legend', {}, 'Farbschema'), U.el('div', { class: 'zeile' }, sel, reset, exportieren, importieren, datei), U.el('div', { class: 'zeile' }, name, speichern, status));
    box.appendChild(fs1);
    // --- Rollen ---
    const fs2 = U.el('fieldset', {}, U.el('legend', {}, 'Farbrollen (Palette · Bereich lo/hi · umkehren · Gamma)'));
    fs2.appendChild(U.el('div', { class: 'rolle klein' }, U.el('span', {}, 'Rolle'), U.el('span', {}, 'Palette'), U.el('span', {}, 'lo'), U.el('span', {}, 'hi'), U.el('span', {}, 'umkehren'), U.el('span', {}, 'Gamma')));
    const rollenBalken = {};
    for (const [rolle, label] of ROLLEN) {
      const def = s.rollen[rolle] || {};
      const pal = U.el('select', { title: 'Palette (aus matplotlib gesampelt)' });
      for (const p of Object.keys(WK.stil.paletten)) pal.appendChild(U.el('option', { value: p, selected: p === def.palette }, p));
      pal.appendChild(U.el('option', { value: '__frei', selected: !!def.stops }, 'freie Stops …'));
      const lo = U.el('input', { type: 'number', min: 0, max: 1, step: 0.01, value: def.lo === undefined ? 0 : def.lo });
      const hi = U.el('input', { type: 'number', min: 0, max: 1, step: 0.01, value: def.hi === undefined ? 1 : def.hi });
      const um = U.el('input', { type: 'checkbox', checked: !!def.umkehren });
      const ga = U.el('input', { type: 'number', min: 0.2, max: 3, step: 0.05, value: def.gamma || 1 });
      const vor = balken(rolle); rollenBalken[rolle] = vor;
      const stopsWrap = U.el('div', { class: 'stops', hidden: !def.stops });
      const stopsNeu = () => {
        stopsWrap.innerHTML = '';
        const stops = (WK.stil.schema.rollen[rolle] || {}).stops || [[0, WK.stil.rampe(rolle).farbe(0)], [1, WK.stil.rampe(rolle).farbe(1)]];
        stops.forEach((st, i) => {
          const pos = U.el('input', { type: 'number', min: 0, max: 1, step: 0.01, value: st[0] }), col = U.el('input', { type: 'color', value: st[1] });
          const upd = () => { const neu = stops.map((x, j) => j === i ? [+pos.value, col.value] : x).sort((a, b) => a[0] - b[0]); WK.stil.aendern(['rollen', rolle], { stops: neu, gamma: +ga.value || 1 }); vor.style.background = WK.stil.rampe(rolle).css(); };
          pos.addEventListener('change', upd); col.addEventListener('input', upd);
          stopsWrap.appendChild(U.el('span', { class: 'stop' }, pos, col, U.el('button', { class: 'icon', style: { fontSize: '12px' }, onclick: () => { if (stops.length <= 2) return; const neu = stops.filter((_, j) => j !== i); WK.stil.aendern(['rollen', rolle], { stops: neu, gamma: +ga.value || 1 }); stopsNeu(); vor.style.background = WK.stil.rampe(rolle).css(); } }, '✕')));
        });
        stopsWrap.appendChild(U.el('button', { onclick: () => { const neu = stops.concat([[0.5, WK.stil.rampe(rolle).farbe(0.5)]]).sort((a, b) => a[0] - b[0]); WK.stil.aendern(['rollen', rolle], { stops: neu, gamma: +ga.value || 1 }); stopsNeu(); vor.style.background = WK.stil.rampe(rolle).css(); } }, '+ Stop'));
      };
      const anwenden = () => {
        if (pal.value === '__frei') { stopsWrap.hidden = false; if (!(WK.stil.schema.rollen[rolle] || {}).stops) { const r = WK.stil.rampe(rolle); WK.stil.aendern(['rollen', rolle], { stops: [[0, r.farbe(0)], [0.5, r.farbe(0.5)], [1, r.farbe(1)]], gamma: +ga.value || 1 }); } stopsNeu(); }
        else { stopsWrap.hidden = true; WK.stil.aendern(['rollen', rolle], { palette: pal.value, lo: Math.min(+lo.value, +hi.value - 0.01), hi: +hi.value, umkehren: um.checked, gamma: +ga.value || 1 }); }
        vor.style.background = WK.stil.rampe(rolle).css();
        kontrast();
      };
      for (const e of [pal, lo, hi, um, ga]) e.addEventListener('change', anwenden);
      fs2.appendChild(U.el('div', { class: 'rolle' }, U.el('span', { title: rolle }, label), vor, lo, hi, um, ga));
      fs2.appendChild(U.el('div', { class: 'rolle' }, U.el('span', {}, ''), pal, U.el('span', { class: 'klein', style: { gridColumn: 'span 4' } }, stopsWrap)));
      if (def.stops) stopsNeu();
    }
    box.appendChild(fs2);
    // --- Kategorien ---
    const fs3 = U.el('fieldset', {}, U.el('legend', {}, 'Klassenfarben und Linienbreiten'));
    const katVars = WK.daten.meta.variablen.filter(v => v.typ === 'kategorial');
    const katSel = U.el('select');
    const aktuell = WK.karte.meta && WK.karte.meta.typ === 'kategorial' ? WK.karte.variable : katVars[0].id;
    for (const v of katVars) katSel.appendChild(U.el('option', { value: v.id, selected: v.id === aktuell }, v.label));
    const katWrap = U.el('div');
    const katNeu = () => {
      katWrap.innerHTML = '';
      const v = WK.daten.variable(katSel.value), def = (WK.stil.schema.kategorien || {})[v.id] || {};
      const abl = U.el('input', { type: 'checkbox', checked: !!def.abgeleitet });
      const rolleSel = U.el('select'); for (const [r, l] of ROLLEN) rolleSel.appendChild(U.el('option', { value: r, selected: r === (def.abgeleitet || v.rolle) }, l));
      const ablAnwenden = () => { if (abl.checked) WK.stil.aendern(['kategorien', v.id], { abgeleitet: rolleSel.value, werte: v.werte, extra: def.extra || {} }); else { WK.stil.aendern(['kategorien', v.id], { farben: WK.stil.kategorieFarben(v.id, v.werte) }); } katNeu(); };
      abl.addEventListener('change', ablAnwenden); rolleSel.addEventListener('change', () => { if (abl.checked) ablAnwenden(); });
      katWrap.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, abl, ' aus Farbrolle ableiten (Stufen wie in der Arbeit): '), rolleSel));
      const farben = WK.stil.kategorieFarben(v.id, v.werte), breiten = WK.stil.kategorieBreiten(v.id, v.werte);
      const liste = U.el('div', { class: 'katliste' });
      for (const w of v.werte) {
        const col = U.el('input', { type: 'color', value: farben[String(w)] || '#999999', disabled: !!def.abgeleitet && !(def.extra || {})[String(w)] });
        col.addEventListener('input', () => { const d = (WK.stil.schema.kategorien || {})[v.id] || {}; if (d.abgeleitet) { WK.stil.aendern(['kategorien', v.id, 'extra', String(w)], col.value); } else { WK.stil.aendern(['kategorien', v.id, 'farben', String(w)], col.value); } kontrast(); });
        const br = U.el('input', { type: 'number', min: 0.1, max: 8, step: 0.1, value: breiten[String(w)], style: { width: '56px' }, title: 'Linienbreite' });
        br.addEventListener('change', () => { const b = WK.stil.schema.breiten[v.id]; const neu = typeof b === 'object' && b ? Object.assign({}, b) : {}; neu[String(w)] = +br.value; WK.stil.aendern(['breiten', v.id], neu); });
        liste.appendChild(U.el('label', {}, col, U.el('span', {}, String(w)), br));
      }
      katWrap.appendChild(liste);
    };
    katSel.addEventListener('change', katNeu);
    fs3.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, 'Kategoriale Variable: '), katSel));
    fs3.appendChild(katWrap); katNeu();
    // Breiten kontinuierlich
    const kv = WK.karte.variable && WK.karte.meta && WK.karte.meta.typ !== 'kategorial' ? WK.karte.variable : null;
    if (kv) {
      const br = U.el('input', { type: 'number', min: 0.1, max: 8, step: 0.1, value: WK.stil.breite(kv), style: { width: '60px' } });
      br.addEventListener('change', () => WK.stil.aendern(['breiten', kv], +br.value));
      fs3.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, `Linienbreite ${WK.karte.meta.label}: `), br, U.el('span', { class: 'klein' }, '(Basisbreite in pt wie in der Arbeit; Zoomfaktor kommt dazu)')));
    }
    const brK = U.el('input', { type: 'number', min: 0.1, max: 4, step: 0.1, value: WK.stil.schema.breiten.kontext, style: { width: '60px' } });
    brK.addEventListener('change', () => { WK.stil.aendern(['breiten', 'kontext'], +brK.value); });
    fs3.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, 'Linienbreite Kontextnetz: '), brK));
    box.appendChild(fs3);
    // --- Kontext ---
    const fs4 = U.el('fieldset', {}, U.el('legend', {}, 'Kontextfarben'));
    const kl = U.el('div', { class: 'katliste' });
    for (const [k, label] of [['grau', 'Kontextnetz'], ['umriss', 'Landkreisgrenze'], ['auswahl', 'Auswahl'], ['halo', 'Halo der Auswahl'], ['hintergrund', 'Hintergrund (ohne Basemap)'], ['gitter', 'Gitter (Arbeitslayout)'], ['netz_dunkel', 'Netz dunkel (LST-Karte)'], ['gemeinden', 'Gemeindegrenzen'], ['gewaesser', 'Gewässer'], ['favorit', 'Favoriten']]) {
      const col = U.el('input', { type: 'color', value: WK.stil.kontext(k) || '#000000' });
      col.addEventListener('input', () => WK.stil.aendern(['kontext', k], col.value));
      kl.appendChild(U.el('label', {}, col, U.el('span', {}, label)));
    }
    fs4.appendChild(kl); box.appendChild(fs4);
    // --- Simulation / Kontrast ---
    const fs5 = U.el('fieldset', {}, U.el('legend', {}, 'Farbfehlsichtigkeit prüfen'));
    const cvdSel = U.el('select', {}, ...Object.keys(CVD).map(k => U.el('option', { value: k, selected: k === S.cvd }, k === 'keine' ? 'keine Simulation' : k.charAt(0).toUpperCase() + k.slice(1))));
    cvdSel.addEventListener('change', () => cvdSetzen(cvdSel.value));
    const kontrastBox = U.el('div', { class: 'klein' });
    function kontrast() {
      const K = WK.karte, v = K.variable; kontrastBox.innerHTML = '';
      if (!v || !K.skala) return;
      const spec = WK.stil.legendeSpec(v, K.skala, K.meta);
      const warn = [];
      if (spec.typ === 'kategorial' || spec.typ === 'klassen') {
        const kl = spec.klassen;
        for (let i = 1; i < kl.length; i++) { const d = U.deltaE(kl[i - 1].farbe, kl[i].farbe); if (d < 12) warn.push(`${kl[i - 1].label} ↔ ${kl[i].label}: ΔE ${d.toFixed(1)} (schwer unterscheidbar)`); }
      } else if (spec.typ === 'kontinuierlich') {
        const r = WK.stil.rampe(spec.stops ? (K.skala.rolle || K.meta.rolle) : 'pluvial');
        let min = 999, at = 0;
        for (let t = 0; t < 1; t += 0.1) { const d = U.deltaE(r.farbe(t), r.farbe(t + 0.1)); if (d < min) { min = d; at = t; } }
        if (min < 6) warn.push(`Farbverlauf zwischen ${Math.round(at * 100)} % und ${Math.round((at + 0.1) * 100)} % der Skala kaum unterscheidbar (ΔE ${min.toFixed(1)})`);
      }
      kontrastBox.appendChild(U.el('div', {}, warn.length ? U.el('span', { class: 'fehler' }, 'Kontrastprüfung: ') : 'Kontrastprüfung: ausreichende Unterschiede (ΔE ≥ 12 je Klassengrenze).'));
      for (const w of warn) kontrastBox.appendChild(U.el('div', { class: 'fehler' }, '• ' + w));
    }
    fs5.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, 'Simulation (Karte, Legende, Detailkarte): '), cvdSel));
    fs5.appendChild(kontrastBox); box.appendChild(fs5);
    kontrast();
    const neu = () => { WK.ui.dialogSchliessen(); oeffnen(); };
    WK.ui.dialog('Farben', box, { breit: true });
  }
  return { init, oeffnen, cvdSetzen, CVD };
})();
