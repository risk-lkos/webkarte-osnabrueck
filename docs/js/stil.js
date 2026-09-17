/* WK.stil – die einzige Farbquelle. Haelt das aktive Farbschema als Zustand und liefert
   Farben (JS), MapLibre-Ausdruecke und Legendenspezifikationen aus denselben Stops.
   Ein Schema (siehe farbschemata/arbeit.json) hat: rollen, kategorien, quintile, breiten,
   kontext, kein_wert, stufen_bereich. Fehlende Eintraege werden aus 'arbeit' ergaenzt. */
WK.stil = (() => {
  const U = WK.util;
  const S = { basis: null, schema: null, schemaId: 'arbeit', paletten: null, rampenCache: new Map(), geaendert: false, breitenFaktor: 1 };

  function tief(obj) { return JSON.parse(JSON.stringify(obj)); }
  function mischen(basis, teil) {
    const aus = tief(basis);
    if (!teil) return aus;
    for (const k of ['rollen', 'kategorien', 'breiten', 'kontext']) {
      if (teil[k]) aus[k] = Object.assign({}, aus[k] || {}, tief(teil[k]));
    }
    for (const k of ['quintile', 'kein_wert', 'stufen_bereich', 'name', 'id', 'beschreibung', 'version']) if (teil[k] !== undefined) aus[k] = tief(teil[k]);
    return aus;
  }
  function pruefen(schema) {
    const fehler = [];
    for (const [r, def] of Object.entries(schema.rollen || {})) {
      if (def.stops) {
        if (!Array.isArray(def.stops) || def.stops.length < 2) fehler.push(`Rolle ${r}: Stop-Liste braucht ≥ 2 Einträge`);
        else for (const st of def.stops) if (!(Array.isArray(st) && typeof st[0] === 'number' && U.istHex(st[1]))) fehler.push(`Rolle ${r}: Stop ${JSON.stringify(st)} ungültig`);
      } else {
        if (!S.paletten[def.palette]) fehler.push(`Rolle ${r}: Palette ${def.palette} unbekannt`);
        if (!(def.lo < def.hi)) fehler.push(`Rolle ${r}: lo muss kleiner als hi sein`);
      }
    }
    for (const [k, def] of Object.entries(schema.kategorien || {})) {
      if (def.farben) for (const [w, f] of Object.entries(def.farben)) if (!U.istHex(f)) fehler.push(`Kategorie ${k}/${w}: Farbe ${f} ungültig`);
      if (def.abgeleitet && !schema.rollen[def.abgeleitet]) fehler.push(`Kategorie ${k}: Rolle ${def.abgeleitet} fehlt`);
    }
    return fehler;
  }

  function init(paletten, schemata, standard) {
    S.paletten = paletten;
    S.schemata = schemata;
    S.basis = schemata.arbeit;
    if (!S.basis) throw new Error('Farbschema arbeit.json fehlt');
    S.breitenFaktor = Math.max(0.25, Math.min(6, +(U.ls('wk.breitenfaktor') || 1) || 1));
    const gespeichert = U.ls(WK.config.speicher.schema);
    if (gespeichert && gespeichert.schema) {
      S.schema = mischen(S.basis, gespeichert.schema); S.schemaId = gespeichert.id || 'eigen'; S.geaendert = !!gespeichert.geaendert;
      if (pruefen(S.schema).length) { S.schema = tief(S.basis); S.schemaId = 'arbeit'; S.geaendert = false; }
    } else {
      setSchema(standard || 'arbeit', true);
    }
  }
  function setSchema(id, still) {
    const teil = S.schemata[id];
    if (!teil) { console.warn('Schema unbekannt', id); return false; }
    S.schema = id === 'arbeit' ? tief(S.basis) : mischen(S.basis, teil);
    const fehler = pruefen(S.schema);
    if (fehler.length) { console.warn('Schema fehlerhaft, Rückfall auf arbeit', fehler); S.schema = tief(S.basis); S.schemaId = 'arbeit'; }
    else S.schemaId = id;
    S.geaendert = false;
    S.rampenCache.clear();
    merken();
    if (!still) WK.bus.emit('stil');
    return true;
  }
  function merken() { U.ls(WK.config.speicher.schema, { id: S.schemaId, geaendert: S.geaendert, schema: S.schema }); }
  function aendern(pfad, wert) {
    let o = S.schema;
    for (let i = 0; i < pfad.length - 1; i++) { if (o[pfad[i]] === undefined || o[pfad[i]] === null) o[pfad[i]] = {}; o = o[pfad[i]]; }
    o[pfad[pfad.length - 1]] = wert;
    S.geaendert = true; S.rampenCache.clear(); merken();
    WK.bus.emit('stil');
  }
  function importieren(obj) {
    const schema = mischen(S.basis, obj);
    const fehler = pruefen(schema);
    if (fehler.length) return fehler;
    S.schema = schema; S.schemaId = obj.id || 'import'; S.geaendert = true; S.rampenCache.clear(); merken();
    WK.bus.emit('stil'); return [];
  }
  function exportieren() { return Object.assign({}, S.schema, { id: S.schemaId, exportiert: new Date().toISOString() }); }
  function zuruecksetzen() { setSchema('arbeit'); }

  // --- Rampen ---------------------------------------------------------------
  function paletteFarbe(name, p) {
    const stops = S.paletten[name].stops, n = stops.length, x = Math.max(0, Math.min(1, p)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(x)), fr = x - i;
    return U.lerpHex(stops[i], stops[i + 1], fr);
  }
  function freieStops(stops, t) {
    for (let i = 0; i < stops.length - 1; i++) {
      if (t <= stops[i + 1][0] || i === stops.length - 2) {
        const span = stops[i + 1][0] - stops[i][0], fr = span <= 0 ? 0 : Math.max(0, Math.min(1, (t - stops[i][0]) / span));
        return U.lerpHex(stops[i][1], stops[i + 1][1], fr);
      }
    }
    return stops[stops.length - 1][1];
  }
  // Farbe der Rolle bei t in [0,1] – identisch zur Python-Rekonstruktion in stil.py
  function rolleFarbe(def, t) {
    t = Math.max(0, Math.min(1, t));
    const gamma = +def.gamma || 1;
    if (gamma !== 1) t = Math.pow(t, gamma);
    if (def.stops) return freieStops(def.stops, t);
    if (def.umkehren) t = 1 - t;
    const lo = +def.lo || 0, hi = def.hi === undefined ? 1 : +def.hi;
    return paletteFarbe(def.palette, lo + t * (hi - lo));
  }
  // Rampe = Stop-Liste in t-Raum [0,1] (fuer interpolate-Ausdruecke, CSS-Verlaeufe und SVG)
  function rampe(rolle) {
    const k = rolle;
    if (S.rampenCache.has(k)) return S.rampenCache.get(k);
    const def = S.schema.rollen[rolle] || S.basis.rollen[rolle] || S.basis.rollen.pluvial;
    const tPos = new Set([0, 1]);
    const N = 64;
    for (let i = 1; i < N; i++) tPos.add(i / N);
    if (!def.stops) {
      // Ankerpositionen der Palette exakt treffen (piecewise-linear)
      const n = S.paletten[def.palette].stops.length, lo = +def.lo || 0, hi = def.hi === undefined ? 1 : +def.hi, gamma = +def.gamma || 1;
      for (let i = 0; i < n; i++) {
        const p = i / (n - 1); if (p <= lo || p >= hi) continue;
        let t = (p - lo) / (hi - lo); if (def.umkehren) t = 1 - t;
        if (gamma !== 1) t = Math.pow(t, 1 / gamma);
        tPos.add(+t.toFixed(6));
      }
    } else for (const st of def.stops) { let t = st[0]; const gamma = +def.gamma || 1; if (gamma !== 1) t = Math.pow(t, 1 / gamma); tPos.add(+Math.max(0, Math.min(1, t)).toFixed(6)); }
    const ts = [...tPos].sort((a, b) => a - b);
    const stops = ts.map(t => [t, rolleFarbe(def, t)]);
    const r = {
      rolle, def, stops,
      farbe(t) { return freieStops(stops, Math.max(0, Math.min(1, t))); },
      css(richtung) { return `linear-gradient(${richtung || 'to right'}, ${stops.map(s => `${s[1]} ${(s[0] * 100).toFixed(2)}%`).join(', ')})`; },
    };
    S.rampenCache.set(k, r); return r;
  }
  // --- Kategorien ------------------------------------------------------------
  function kategorieFarben(spalte, werteListe) {
    const def = (S.schema.kategorien || {})[spalte];
    const aus = {};
    const bereich = S.schema.stufen_bereich || [0.2, 1.0];
    if (def && def.abgeleitet) {
      const r = rampe(def.abgeleitet), werte = def.werte || werteListe || [];
      const n = werte.length;
      werte.forEach((w, i) => { const t = n > 1 ? bereich[0] + i * (bereich[1] - bereich[0]) / (n - 1) : bereich[1]; aus[String(w)] = r.farbe(t); });
      Object.assign(aus, def.extra || {});
      Object.assign(aus, def.farben || {});
    } else if (def && def.farben) {
      Object.assign(aus, def.farben);
    }
    // unbekannte Werte: qualitative Palette in Reihenfolge der Werteliste
    const q = WK.config.qualitativ;
    let j = 0;
    for (const w of (werteListe || [])) { const k = String(w); if (!aus[k]) { aus[k] = q[j % q.length]; j++; } }
    return aus;
  }
  function kategorieBreiten(spalte, werteListe, standard) {
    const b = (S.schema.breiten || {})[spalte], aus = {};
    for (const w of (werteListe || [])) { const k = String(w); aus[k] = (b && typeof b === 'object' && b[k] !== undefined) ? b[k] : (typeof b === 'number' ? b : (standard || S.schema.breiten.standard || 1.0)); }
    return aus;
  }
  function breite(variable, vorgabe) {
    if (typeof vorgabe === 'number') return vorgabe;
    const b = (S.schema.breiten || {})[variable];
    if (typeof b === 'number') return b;
    return S.schema.breiten.standard || 1.4;
  }
  function kontext(k) { const c = (S.schema.kontext || {})[k]; return c !== undefined ? c : (S.basis.kontext || {})[k]; }
  function quintile() { return S.schema.quintile || S.basis.quintile; }

  // --- MapLibre-Ausdruecke ------------------------------------------------------
  function normAusdruck(variable, vmin, vmax) {
    const span = (vmax - vmin) || 1e-9;
    return ['max', 0, ['min', 1, ['/', ['-', ['to-number', ['get', variable]], vmin], span]]];
  }
  // skala: {modus, vmin, vmax, grenzen, rolle, klassenfarben, t, farbe}
  function ausdruckFarbe(variable, skala, meta) {
    const rolle = skala.rolle || (meta && meta.rolle) || 'pluvial';
    if (skala.modus === 'kategorial') {
      const farben = kategorieFarben(variable, (meta && meta.werte) || []);
      const aus = ['match', ['to-string', ['get', variable]]];
      for (const [w, f] of Object.entries(farben)) aus.push(w, f);
      aus.push(S.schema.kein_wert || 'rgba(0,0,0,0)');
      return aus;
    }
    if (skala.modus === 'einfarbig') return skala.farbe || rampe(rolle).farbe(skala.t === undefined ? 0.85 : skala.t);
    if (skala.modus === 'quintil') {
      const q = quintile(), aus = ['step', ['to-number', ['get', variable]]];
      const grenzen = [20, 40, 60, 80];
      q.forEach((qi, i) => {
        const lo = i * 20, hi = (i + 1) * 20;
        const expr = ['interpolate', ['linear'], ['to-number', ['get', variable]], lo, qi.farben[0], hi, qi.farben[1]];
        if (i === 0) aus.push(expr); else aus.push(grenzen[i - 1], expr);
      });
      return aus;
    }
    if (skala.modus === 'klassen') {
      const aus = ['step', ['to-number', ['get', variable]], skala.klassen[0].farbe];
      for (let i = 1; i < skala.klassen.length; i++) aus.push(skala.klassen[i].von, skala.klassen[i].farbe);
      return aus;
    }
    // kontinuierlich
    const r = rampe(rolle);
    const aus = ['interpolate', ['linear'], normAusdruck(variable, skala.vmin, skala.vmax)];
    for (const [t, f] of r.stops) aus.push(t, f);
    return aus;
  }
  function ausdruckBreiteBasis(variable, skala, meta, vorgabe) {
    if (skala.modus === 'kategorial') {
      const werte = (meta && meta.werte) || [], b = kategorieBreiten(variable, werte, vorgabe);
      const aus = ['match', ['to-string', ['get', variable]]];
      for (const [w, v] of Object.entries(b)) aus.push(w, v);
      aus.push(0.8);
      return aus;
    }
    if (skala.modus === 'quintil') {
      const q = quintile(), aus = ['step', ['to-number', ['get', variable]], q[0].lw];
      [20, 40, 60, 80].forEach((g, i) => aus.push(g, q[i + 1].lw));
      return aus;
    }
    const w = breite(variable, vorgabe);
    if (skala.breiteNachWert && skala.modus !== 'einfarbig') return ['interpolate', ['linear'], normAusdruck(variable, skala.vmin, skala.vmax), 0, w * 0.5, 1, w * 2.2];
    return w;
  }
  // globaler Linienstaerke-Faktor (Regler "Linienstaerke"), wirkt auf Daten, Kontext, Auswahl und Exporte
  function setBreitenFaktor(f) {
    S.breitenFaktor = Math.max(0.25, Math.min(6, +f || 1));
    U.ls('wk.breitenfaktor', S.breitenFaktor);
    WK.bus.emit('stil');
  }
  function mitZoom(W, hover) {
    // Der Linienstaerke-Faktor wird in die Zahlen der Zoomstufen gefaltet: ein zusaetzlich
    // verschachteltes ['*', faktor, W] liess MapLibre die Linienlayer nicht mehr zeichnen.
    const Wh = hover ? ['case', ['boolean', ['feature-state', 'hover'], false], ['*', 2, W], W] : W;
    const aus = ['interpolate', ['exponential', 1.6], ['zoom']];
    for (const [z, f] of WK.config.breitenZoom) { const ff = +(f * S.breitenFaktor).toFixed(4); aus.push(z, ff === 1 ? Wh : ['*', ff, Wh]); }
    return aus;
  }
  function ausdruckBreite(variable, skala, meta, vorgabe) { return mitZoom(ausdruckBreiteBasis(variable, skala, meta, vorgabe), true); }
  function kontextBreite(basis) { return mitZoom(basis, false); }

  // --- Farbe im JS (fuer Legende/Export) ----------------------------------------
  function farbe(variable, wert, skala, meta) {
    if (wert === null || wert === undefined) return null;
    const rolle = skala.rolle || (meta && meta.rolle) || 'pluvial';
    if (skala.modus === 'kategorial') return kategorieFarben(variable, (meta && meta.werte) || [])[String(wert)] || null;
    if (skala.modus === 'einfarbig') return skala.farbe || rampe(rolle).farbe(skala.t === undefined ? 0.85 : skala.t);
    if (typeof wert !== 'number') return null;
    if (skala.modus === 'quintil') { const q = quintile(); const i = Math.min(4, Math.max(0, Math.floor(wert / 20))); return U.lerpHex(q[i].farben[0], q[i].farben[1], Math.max(0, Math.min(1, (wert - i * 20) / 20))); }
    if (skala.modus === 'klassen') { let k = skala.klassen[0]; for (const kl of skala.klassen) if (wert >= kl.von) k = kl; return k.farbe; }
    const t = Math.max(0, Math.min(1, (wert - skala.vmin) / ((skala.vmax - skala.vmin) || 1e-9)));
    return rampe(rolle).farbe(t);
  }
  function breiteFuer(variable, wert, skala, meta, vorgabe, ohneFaktor) {
    const f = ohneFaktor ? 1 : S.breitenFaktor;
    if (skala.modus === 'kategorial') return (kategorieBreiten(variable, (meta && meta.werte) || [], vorgabe)[String(wert)] || 0.8) * f;
    if (skala.modus === 'quintil') { const q = quintile(); return q[Math.min(4, Math.max(0, Math.floor(wert / 20)))].lw * f; }
    const w = breite(variable, vorgabe);
    if (skala.breiteNachWert && typeof wert === 'number') { const t = Math.max(0, Math.min(1, (wert - skala.vmin) / ((skala.vmax - skala.vmin) || 1e-9))); return w * (0.5 + 1.7 * t) * f; }
    return w * f;
  }
  // Legendenspezifikation (DOM, Canvas und SVG zeichnen alle daraus)
  function legendeSpec(variable, skala, meta, opts) {
    opts = opts || {};
    const rolle = skala.rolle || (meta && meta.rolle) || 'pluvial';
    const label = opts.label || (meta ? meta.label : variable);
    if (skala.modus === 'kategorial') {
      const werte = (meta && meta.werte) || [], farben = kategorieFarben(variable, werte), breiten = kategorieBreiten(variable, werte, opts.lw);
      const anzahl = (meta && meta.anzahl) || {};
      const fmt = opts.format || null;
      return { typ: 'kategorial', label, titel: opts.titel || label,
        klassen: werte.map(w => ({ wert: String(w), label: fmt ? fmt.replace('{k}', w) : String(w), farbe: farben[String(w)], lw: breiten[String(w)], n: anzahl[String(w)] })) };
    }
    if (skala.modus === 'einfarbig') return { typ: 'einfarbig', label, farbe: farbe(variable, 1, skala, meta), lw: breite(variable, opts.lw) };
    if (skala.modus === 'quintil') return { typ: 'quintil', label, titel: 'Link Importance (Quintile)', untertitel: 'hell → kräftig = Rang in der Klasse', quintile: quintile().map(q => Object.assign({}, q)) };
    if (skala.modus === 'klassen') return { typ: 'klassen', label, klassen: skala.klassen.map(k => Object.assign({}, k)), einheit: meta ? meta.einheit : '' };
    const r = rampe(rolle);
    return { typ: 'kontinuierlich', label, vmin: skala.vmin, vmax: skala.vmax, stops: r.stops, css: r.css(), einheit: meta ? meta.einheit : '', gamma: r.def.gamma || 1, ticks: U.ticks(skala.vmin, skala.vmax, 5) };
  }
  return {
    S, init, setSchema, aendern, importieren, exportieren, zuruecksetzen, pruefen, rampe, rolleFarbe, paletteFarbe,
    kategorieFarben, kategorieBreiten, breite, breiteFuer, kontext, quintile, ausdruckFarbe, ausdruckBreite, ausdruckBreiteBasis,
    kontextBreite, mitZoom, farbe, legendeSpec, normAusdruck, setBreitenFaktor,
    get breitenFaktor() { return S.breitenFaktor; },
    get schema() { return S.schema; }, get schemaId() { return S.schemaId; }, get geaendert() { return S.geaendert; },
    get paletten() { return S.paletten; }, get schemata() { return S.schemata; },
  };
})();
