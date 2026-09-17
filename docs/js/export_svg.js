/* SVG-Export der aktuellen Ansicht (Web Mercator, ohne Hintergrundkarte) */
WK.exportSvg = (() => {
  const U = WK.util;
  function pfad(coords, proj, tol, nd) {
    const pts = coords.map(c => { const p = proj(c); return [p.x, p.y]; });
    const red = tol ? U.rdp(pts, tol) : pts;
    return red.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(nd)} ${p[1].toFixed(nd)}`).join('');
  }
  function polyPfade(geom, proj, tol, nd) {
    const ringe = [];
    const walk = g => { if (g.type === 'Polygon') g.coordinates.forEach(r => ringe.push(r)); else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => ringe.push(r))); else if (g.type === 'LineString') ringe.push(g.coordinates); else if (g.type === 'MultiLineString') g.coordinates.forEach(r => ringe.push(r)); };
    walk(geom);
    return ringe.map(r => pfad(r, proj, tol, nd) + (geom.type.includes('Polygon') ? 'Z' : '')).join(' ');
  }
  function aktuelleAnsicht(o) {
    o = o || {};
    const K = WK.karte, map = K.map, w = map.getContainer().clientWidth, h = map.getContainer().clientHeight;
    const proj = c => map.project(c), nd = 1, tol = 0.25;
    const zf = WK.exportPng.zoomFaktor(map.getZoom());
    const teile = [];
    teile.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="DejaVu Sans, Arial, sans-serif">`);
    teile.push(`<title>${U.esc(o.titel || WK.exportPng.titelStandard())}</title>`);
    teile.push(`<defs><clipPath id="karte"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath></defs>`);
    if (o.hintergrund) teile.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${WK.stil.kontext('hintergrund')}"/>`);
    teile.push('<g clip-path="url(#karte)">');
    const bbox = K.bboxAnsicht();
    // Kontextnetz
    if (o.kontext !== false && K.kontext !== 'keiner') {
      const idx = WK.daten.imBereich(bbox, fe => K.kontext === 'gesamt' || fe.properties.aktiv);
      const lw = (WK.stil.schema.breiten[K.kontext === 'gesamt' ? 'kontext' : 'kontext'] || 0.3) * zf;
      const farbe = K.kontext === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau');
      teile.push(`<path id="kontextnetz" d="${idx.map(i => pfad(WK.daten.features[i].geometry.coordinates, proj, tol, nd)).join('')}" fill="none" stroke="${farbe}" stroke-width="${lw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    // Daten
    if (K.variable) {
      const idx = K.sichtbareIndizes();
      teile.push('<g id="daten" fill="none" stroke-linecap="round" stroke-linejoin="round">');
      for (const i of idx) {
        const fe = WK.daten.features[i], wert = fe.properties[K.variable];
        const farbe = WK.stil.farbe(K.variable, wert, K.skala, K.meta); if (!farbe) continue;
        const lw = WK.stil.breiteFuer(K.variable, wert, K.skala, K.meta, K.lwVorgabe) * zf;
        teile.push(`<path id="k${fe.id}" d="${pfad(fe.geometry.coordinates, proj, tol, nd)}" stroke="${farbe}" stroke-width="${lw.toFixed(2)}"><title>${U.esc([fe.properties.ref, fe.properties.name].filter(Boolean).join(' · '))}: ${U.esc(String(wert))}</title></path>`);
      }
      teile.push('</g>');
    }
    // Kreisgrenze
    const lk = WK.daten.S.kontextCache.get('lk_grenze');
    if (lk && lk.then === undefined) teile.push(`<path id="landkreis" d="${lk.features.map(f => polyPfade(f.geometry, proj, tol, nd)).join(' ')}" fill="none" stroke="${WK.stil.kontext('umriss')}" stroke-width="${(1.2 * Math.max(0.8, zf * 0.7)).toFixed(2)}"/>`);
    // Auswahl
    if (K.auswahl !== null) { const fe = WK.daten.feature(K.auswahl); if (fe) { const d = pfad(fe.geometry.coordinates, proj, 0, nd); teile.push(`<path d="${d}" fill="none" stroke="${WK.stil.kontext('halo')}" stroke-width="${(7 * zf).toFixed(2)}" stroke-linecap="round"/><path id="auswahl" d="${d}" fill="none" stroke="${WK.stil.kontext('auswahl')}" stroke-width="${(3 * zf).toFixed(2)}" stroke-linecap="round"/>`); } }
    teile.push('</g>');
    // Legende
    if (o.legende !== false) {
      const spec = WK.legende.aktuelleSpec();
      if (spec) {
        const kz = [{ farbe: WK.stil.kontext('umriss'), lw: 1.5, label: 'Landkreisgrenze' }];
        if (K.kontext !== 'keiner' && o.kontext !== false) kz.push({ farbe: K.kontext === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau'), lw: 2, label: K.kontextLabel });
        const probe = WK.legende.zeichnenSvg(spec, 0, 0, { fontsize: 10, breite: 210, kontextZeilen: kz });
        teile.push(WK.legende.zeichnenSvg(spec, w - probe.breite - 12, h - probe.hoehe - 12, { fontsize: 10, breite: 210, kontextZeilen: kz }).svg);
      }
    }
    // Massstab
    if (o.massstab !== false) {
      const mpp = U.meterProPixel(map.getZoom(), map.getCenter().lat);
      let laenge = U.nice(0.22 * w * mpp); while (laenge / mpp > 0.3 * w) laenge = U.nice(laenge * 0.5);
      const px = laenge / mpp, x0 = 14, y0 = h - 22;
      teile.push(`<rect x="${x0 - 6}" y="${y0 - 18}" width="${(px + 12).toFixed(1)}" height="30" fill="white" fill-opacity="0.85"/><rect x="${x0}" y="${y0}" width="${px.toFixed(1)}" height="4" fill="#222"/><text x="${(x0 + px / 2).toFixed(1)}" y="${y0 - 5}" font-size="11" text-anchor="middle" fill="#222">${laenge >= 1000 ? U.formatZahl(laenge / 1000, laenge % 1000 ? 1 : 0) + ' km' : laenge + ' m'}</text>`);
    }
    // Nordpfeil
    if (o.nordpfeil !== false) {
      const cx = w - 30, cy = 42, r = 16, b = -map.getBearing();
      teile.push(`<g transform="translate(${cx} ${cy}) rotate(${b})"><circle r="${r + 8}" fill="white" fill-opacity="0.85"/><line x1="0" y1="${r}" x2="0" y2="${-r + 6}" stroke="#222" stroke-width="1.8"/><path d="M0 ${-r} L-5 ${-r + 9} L5 ${-r + 9} Z" fill="#222"/><text y="${-r - 4}" font-size="12" font-weight="bold" text-anchor="middle" fill="#222">N</text></g>`);
    }
    if (o.titel) teile.push(`<text x="14" y="26" font-size="15" font-weight="bold" fill="#1c1e21">${U.esc(o.titel)}</text>`);
    teile.push(`<text x="8" y="${h - 4}" font-size="8" fill="#333">${U.esc(WK.exportPng.attributionText())} · ${U.esc(WK.exportPng.impressumZeile())}</text>`);
    teile.push('</svg>');
    return teile.join('\n');
  }
  return { aktuelleAnsicht, pfad, polyPfade };
})();
