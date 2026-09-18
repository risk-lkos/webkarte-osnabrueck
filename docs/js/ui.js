/* Seitenleiste, Statusleiste, Dialoge, Tastatur, Meldungen */
WK.ui = (() => {
  const U = WK.util;
  const S = { seite: null, status: null, dialog: null, presetKnoepfe: new Map(), varKnoepfe: new Map(), meldung: null };

  function abschnitt(titel, offen, id) {
    // ?-Knopf mit der Erklaerung des Abschnitts (data/glossar.json, bedienung[id])
    const hilfe = id && WK.glossar ? WK.glossar.knopf({ bedienung: id }) : null;
    const d = U.el('details', { class: 'abschnitt', open: offen ? true : false, id: id || null }, U.el('summary', {}, U.el('span', { class: 'abs-titel' }, titel, hilfe)));
    const inhalt = U.el('div', { class: 'inhalt' });
    d.appendChild(inhalt);
    return { d, inhalt };
  }

  function init() {
    S.seite = document.getElementById('seite');
    S.status = document.getElementById('status');
    S.dialog = document.getElementById('dialog');
    const meta = WK.daten.meta;
    const hk = key => (WK.glossar ? WK.glossar.knopf({ bedienung: key }) : null);   // ?-Knopf zu einem Bedienelement
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
    const aaCb = U.el('input', { type: 'checkbox', checked: WK.karte.arbeitsansicht });
    aaCb.addEventListener('change', () => WK.karte.setArbeitsansicht(aaCb.checked));
    a1.inhalt.appendChild(U.el('div', { class: 'zeile klein', title: 'Beim Klick auf eine Karte der Arbeit: weißer Hintergrund, Landkreis-Ausschnitt, Farbschema „Arbeit", Filter und Labels aus' }, U.el('label', {}, aaCb, ' Preset stellt die Ansicht der Arbeit her (Hintergrund, Ausschnitt, Farben, Filter)'), hk('arbeitsansicht')));
    S.seite.appendChild(a1.d);

    // Variablen nach Gruppen
    const a2 = abschnitt('Variablen nach Gefahr', true, 'abs-variablen');
    // Anzahl gueltiger Werte je Top-Variable und Baulastebene (fuer die Knoepfe "Top 25 je Ebene")
    const topVars = [...new Set(Object.values(WK.config.topVariable))].map(id => ({ id, m: WK.daten.variable(id) })).filter(x => x.m);
    const ebenenZahl = {};
    for (const fe of WK.daten.features) {
      const p = fe.properties; if (!p.baulast) continue;
      for (const tv of topVars) { const w = p[tv.id]; if (typeof w === 'number' && (!tv.m.gt0 || w > 0)) { const k = tv.id + '|' + p.baulast; ebenenZahl[k] = (ebenenZahl[k] || 0) + 1; } }
    }
    const ebenenKnoepfe = [];
    // Variablengruppen sind einklappbar und starten eingeklappt (kompaktes Menue); der Zustand bleibt im Browser gespeichert
    const gruppenOffen = new Set(U.ls('wk.gruppen.offen') || []), gruppenUi = [];
    for (const g of meta.gruppen) {
      const vars = meta.variablen.filter(v => v.gruppe === g.id);
      if (!vars.length) continue;
      const topVar = WK.config.topVariable[g.id];
      const pfeil = U.el('span', { class: 'pfeil' }, '▸'), punkt = U.el('span', { class: 'aktiv-punkt', title: 'enthält die aktuell gezeigte Variable', hidden: true });
      const toggle = U.el('button', { class: 'gruppe-toggle', 'data-gruppe': g.id, 'aria-expanded': 'false', title: g.text + ' (Klick klappt die Variablen auf oder zu)' }, pfeil, U.el('span', {}, g.label), U.el('span', { class: 'anzahl' }, `(${vars.length})`), punkt);
      a2.inhalt.appendChild(U.el('div', { class: 'gruppe-kopf' }, toggle, WK.glossar ? WK.glossar.knopf({ gruppe: g.id }) : null,
        topVar && WK.daten.variable(topVar) ? U.el('button', { style: { padding: '1px 7px', fontSize: '11px' }, title: `Die 25 Kanten mit den höchsten Werten von ${WK.daten.variable(topVar).label} (Top-25-Liste dieser Gefahr)`, onclick: () => { WK.karte.setVariable(topVar); if (WK.filter) WK.filter.setTopN(25); melden(`Top 25 ${g.label}: ${WK.daten.variable(topVar).label}`); } }, 'Top 25') : U.el('span', { class: 'kurz' }, g.kurz)));
      if (topVar && WK.daten.variable(topVar)) {
        // Top 25 je Baulastebene: Rang innerhalb der Ebene nach dem globalen Index (Rangregel des AP7-Vermerks)
        const vl = WK.daten.variable(topVar).label;
        const zeile = U.el('div', { class: 'top-ebenen' }, U.el('span', { class: 'klein', title: 'Top 25 innerhalb einer Baulastebene: die 25 höchsten Werte des Index unter den Straßen dieser Ebene. Das sind meist nicht die Spitzenwerte des ganzen Netzes, sondern die Spitzen der jeweiligen Zuständigkeit.' }, 'je Ebene'));
        for (const e of WK.config.baulastEbenen) {
          const n = ebenenZahl[topVar + '|' + e.id] || 0;
          const b = U.el('button', { disabled: !n,
            title: n ? `Top 25 der ${e.plural}: die ${Math.min(25, n)} höchsten Werte von ${vl} unter ${U.formatZahl(n, 0)} Kanten dieser Ebene mit Wert` : `Keine ${e.plural} mit Wert für ${vl}`,
            onclick: () => { WK.karte.setVariable(topVar); if (WK.filter) WK.filter.setTopN(25, e.id); melden(`Top 25 ${e.plural} · ${g.label}: ${vl} (Liste mit Taste R)`); } }, e.kurz);
          ebenenKnoepfe.push({ b, variable: topVar, ebene: e.id });
          zeile.appendChild(b);
        }
        const hkE = hk('top_ebene'); if (hkE) zeile.insertBefore(hkE, zeile.children[1] || null);
        a2.inhalt.appendChild(zeile);
      }
      const l = U.el('div', { class: 'liste gruppe-inhalt' });
      const setOffen = an => { l.hidden = !an; pfeil.textContent = an ? '▾' : '▸'; toggle.setAttribute('aria-expanded', an ? 'true' : 'false'); };
      setOffen(gruppenOffen.has(g.id));
      toggle.addEventListener('click', () => { const an = l.hidden; setOffen(an); if (an) gruppenOffen.add(g.id); else gruppenOffen.delete(g.id); U.ls('wk.gruppen.offen', [...gruppenOffen]); });
      gruppenUi.push({ punkt, ids: new Set(vars.map(x => x.id)) });
      for (const v of vars) {
        const b = U.el('button', { title: v.beschreibung || v.label, onclick: () => WK.karte.setVariable(v.id) },
          U.el('span', { class: 'balken', style: { background: v.typ === 'kategorial' ? 'repeating-linear-gradient(90deg,#999 0 6px,#ddd 6px 12px)' : WK.stil.rampe(v.rolle).css() } }),
          U.el('span', {}, v.label), U.el('span', { class: 'n' }, v.n_gueltig !== undefined ? U.formatZahl(v.n_gueltig, 0) : ''));
        S.varKnoepfe.set(v.id, b);
        const hv = WK.glossar ? WK.glossar.knopf({ variable: v.id }) : null;
        l.appendChild(hv ? U.el('div', { class: 'var-zeile' }, b, hv) : b);
      }
      a2.inhalt.appendChild(l);
    }
    // aktiven Ebenen-Knopf hervorheben (Top N je Baulastebene auf der Top-Variable dieser Gruppe)
    const ebenenMarkieren = () => { const F = WK.filter; for (const k of ebenenKnoepfe) k.b.classList.toggle('aktiv', !!(F && F.topN && F.topBaulast === k.ebene && WK.karte.variable === k.variable)); };
    for (const ev of ['filter', 'variable', 'sichtbar']) WK.bus.on(ev, ebenenMarkieren);
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
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'sel-modus' }, 'Skala'), modusSel, hk('skala')));
    festZeile.hidden = true; klassenZeile.hidden = true;
    a3.inhalt.appendChild(festZeile); a3.inhalt.appendChild(klassenZeile);
    const gamma = U.el('input', { type: 'range', id: 'inp-gamma', min: 0.3, max: 2.5, step: 0.05, value: 1 });
    const gammaWert = U.el('span', { class: 'klein mono', id: 'gamma-wert' }, '1,00');
    gamma.addEventListener('input', () => { gammaWert.textContent = U.formatZahl(+gamma.value, 2); });
    gamma.addEventListener('change', () => { const r = (WK.karte.skala || {}).rolle || (WK.karte.meta || {}).rolle; if (r) WK.stil.aendern(['rollen', r, 'gamma'], +gamma.value); });
    a3.inhalt.appendChild(U.el('div', { class: 'zeile', title: 'Gamma < 1 spreizt niedrige Werte, > 1 hohe Werte (wirkt auf die Farbrolle der aktuellen Variable)' }, U.el('label', { for: 'inp-gamma' }, 'Gamma (Spreizung)'), gammaWert, hk('gamma')));
    a3.inhalt.appendChild(gamma);
    const breiteF = U.el('input', { type: 'range', id: 'inp-breite', min: 0.5, max: 4, step: 0.25, value: WK.stil.breitenFaktor });
    const breiteFWert = U.el('span', { class: 'klein mono', id: 'breite-wert' }, '× ' + U.formatZahl(WK.stil.breitenFaktor, 2));
    const breiteFSetzen = U.debounce(() => WK.stil.setBreitenFaktor(+breiteF.value), 120);
    breiteF.addEventListener('input', () => { breiteFWert.textContent = '× ' + U.formatZahl(+breiteF.value, 2); breiteFSetzen(); });
    a3.inhalt.appendChild(U.el('div', { class: 'zeile', title: 'Alle Kanten dicker oder dünner zeichnen (wirkt auch auf Detailkarte und Exporte)' }, U.el('label', { for: 'inp-breite' }, 'Linienstärke'), breiteFWert, hk('linienstaerke')));
    a3.inhalt.appendChild(breiteF);
    const breiteCb = U.el('input', { type: 'checkbox', id: 'cb-breite' });
    breiteCb.addEventListener('change', () => WK.karte.setModus(WK.karte.modus, { breiteNachWert: breiteCb.checked }));
    const labelsCb = U.el('input', { type: 'checkbox', id: 'cb-labels' });
    labelsCb.addEventListener('change', () => WK.karte.setLabels(labelsCb.checked));
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', {}, breiteCb, ' Linienbreite nach Wert'), U.el('label', {}, labelsCb, ` Wert-Labels ab Zoom ${WK.config.karte.labelsAbZoom}`)));
    const kontextSel = U.el('select', { id: 'sel-kontext' }, U.el('option', { value: 'aktiv' }, 'aktive Kanten (grau)'), U.el('option', { value: 'gesamt' }, 'gesamtes Netz (grau)'), U.el('option', { value: 'aktiv_dunkel' }, 'aktive Kanten (dunkel)'), U.el('option', { value: 'keiner' }, 'kein Kontextnetz'));
    kontextSel.addEventListener('change', () => WK.karte.setKontext(kontextSel.value));
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'sel-kontext' }, 'Kontextnetz'), kontextSel, hk('kontextnetz')));
    const schemaSel = U.el('select', { id: 'sel-schema' });
    for (const [id, sch] of Object.entries(WK.stil.schemata)) schemaSel.appendChild(U.el('option', { value: id }, sch.name || id));
    schemaSel.appendChild(U.el('option', { value: '__eigen', hidden: true }, 'eigenes Schema'));
    schemaSel.addEventListener('change', () => { if (schemaSel.value !== '__eigen') WK.stil.setSchema(schemaSel.value); });
    a3.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('label', { for: 'sel-schema' }, 'Farbschema'), schemaSel, U.el('button', { onclick: () => WK.farben && WK.farben.oeffnen(), title: 'Farbeditor' }, '…'), hk('farbschema')));
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
    // Messwerkzeug
    const messBtn = U.el('button', { title: 'Punkte in der Karte anklicken; Distanz erscheint hier', onclick: () => WK.karte.messen() }, 'Messen');
    const messInfo = U.el('span', { class: 'klein mono' }, '');
    const messWeg = U.el('button', { onclick: () => WK.karte.messLeeren() }, '✕');
    WK.bus.on('mess', m => { messBtn.classList.toggle('aktiv', m.an); messInfo.textContent = m.laenge ? (m.laenge >= 1000 ? U.formatZahl(m.laenge / 1000, 2) + ' km' : U.formatZahl(m.laenge, 0) + ' m') : (m.an ? 'Punkte klicken …' : ''); });
    a8.inhalt.appendChild(U.el('div', { class: 'zeile' }, messBtn, messInfo, messWeg));
    // Lesezeichen (benannte Ansichten im Browser)
    const lzName = U.el('input', { type: 'text', placeholder: 'Lesezeichen-Name', style: { width: '150px' } });
    const lzListe = U.el('div', { class: 'liste' });
    const lzNeu = () => {
      lzListe.innerHTML = '';
      const lz = U.ls(WK.config.speicher.lesezeichen) || [];
      for (const [i, e] of lz.entries()) lzListe.appendChild(U.el('button', { onclick: () => { location.hash = e.hash; }, title: 'Ansicht laden' }, U.el('span', {}, e.name), U.el('span', { class: 'n', onclick: ev => { ev.stopPropagation(); lz.splice(i, 1); U.ls(WK.config.speicher.lesezeichen, lz); lzNeu(); } }, '✕')));
    };
    const lzBtn = U.el('button', { onclick: () => { const n = lzName.value.trim() || `Ansicht ${new Date().toLocaleTimeString('de-DE')}`; const lz = U.ls(WK.config.speicher.lesezeichen) || []; lz.push({ name: n, hash: WK.url ? WK.url.bauen() : location.hash.slice(1) }); U.ls(WK.config.speicher.lesezeichen, lz); lzName.value = ''; lzNeu(); melden(`Lesezeichen „${n}" gespeichert`); } }, 'Lesezeichen setzen');
    a8.inhalt.appendChild(U.el('div', { class: 'zeile' }, lzName, lzBtn));
    a8.inhalt.appendChild(lzListe); lzNeu();
    a8.inhalt.appendChild(U.el('div', { class: 'zeile' }, U.el('button', { onclick: async () => { if (WK.url) { const ok = await U.kopieren(WK.url.permalink()); melden(ok ? 'Permalink kopiert' : 'Kopieren fehlgeschlagen'); } } }, 'Permalink kopieren'), U.el('button', { onclick: () => { if (WK.url) dialog('QR-Code zum Permalink', U.el('div', {}, WK.url.qrDom(WK.url.permalink()), U.el('p', { class: 'klein mono', style: { wordBreak: 'break-all' } }, WK.url.permalink()))); } }, 'QR-Code')));
    S.seite.appendChild(a8.d);

    // Kopfknoepfe
    document.getElementById('btn-seite').addEventListener('click', () => { const app = document.getElementById('app'); if (window.innerWidth <= 900) app.classList.toggle('seite-offen'); else app.classList.toggle('ohne-seite'); setTimeout(() => WK.karte.map && WK.karte.map.resize(), 50); });
    document.getElementById('btn-farben').addEventListener('click', () => WK.farben && WK.farben.oeffnen());
    document.getElementById('btn-export').addEventListener('click', () => WK.exportPng && WK.exportPng.dialog());
    document.getElementById('btn-rangliste').addEventListener('click', () => WK.rangliste && WK.rangliste.umschalten());
    document.getElementById('btn-melden').addEventListener('click', () => WK.report && WK.report.oeffnen());
    document.getElementById('btn-tour').addEventListener('click', () => WK.tour && WK.tour.start());
    document.getElementById('btn-hilfe').addEventListener('click', () => WK.hilfe && WK.hilfe.hilfe());
    document.getElementById('btn-ueber').addEventListener('click', () => WK.hilfe && WK.hilfe.ueber());
    document.getElementById('dialog-schliessen').addEventListener('click', dialogSchliessen);
    S.dialog.addEventListener('click', e => { if (e.target === S.dialog) dialogSchliessen(); });

    // Ereignisse
    WK.bus.on('variable', info => {
      for (const [id, b] of S.varKnoepfe) b.classList.toggle('aktiv', id === info.variable);
      for (const gu of gruppenUi) gu.punkt.hidden = !gu.ids.has(info.variable);
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
      if (+breiteF.value !== WK.stil.breitenFaktor) { breiteF.value = WK.stil.breitenFaktor; breiteFWert.textContent = '× ' + U.formatZahl(WK.stil.breitenFaktor, 2); }
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
        case 'r': case 'R': if (WK.rangliste) WK.rangliste.umschalten(); break;
        case 'm': case 'M': if (WK.report) WK.report.oeffnen(); break;
        case 'a': case 'A': if (WK.tour) WK.tour.start(); break;
        case 'd': case 'D': document.getElementById('app').classList.toggle('ohne-panel'); setTimeout(() => K.map && K.map.resize(), 50); break;
        case 'l': case 'L': document.getElementById('cb-labels').click(); break;
        case 'p': case 'P': if (WK.vergleich && K.auswahl !== null) WK.vergleich.anpinnen(K.auswahl); break;
        case 's': case 'S': if (WK.favoriten && K.auswahl !== null) { WK.favoriten.toggle(K.auswahl); WK.panel.zeigen(K.auswahl, true); } break;
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
