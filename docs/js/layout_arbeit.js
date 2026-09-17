/* SVG-Arbeitslayout: Nachbau von abb_helfer.karte() + impressum() in UTM 32N (EPSG:25832),
   viewBox in pt wie matplotlib (figsize 9 x 10 in = 648 x 720 pt), Schriftgroessen/Linienbreiten 1:1 */
WK.layoutArbeit = (() => {
  const U = WK.util;
  const FIG = { w: 648, h: 720 };                      // 9 x 10 Zoll * 72 pt
  const SUB = { l: 0.125, r: 0.90, b: 0.11, t: 0.88 }; // matplotlib-Subplot-Standard
  const NUM = (v, nd) => v.toFixed(nd === undefined ? 1 : nd);

  function projektor(xlim, ylim, box) {
    const sx = x => box.x0 + (x - xlim[0]) / (xlim[1] - xlim[0]) * box.w;
    const sy = y => box.y0 + box.h - (y - ylim[0]) / (ylim[1] - ylim[0]) * box.h;
    return { sx, sy };
  }
  function utmKoords(coords) { return coords.map(c => U.utm(c)); }
  function linienPfad(coords4326, P, tolM, nd) {
    const pts = U.rdp(utmKoords(coords4326), tolM);
    return pts.map((p, i) => `${i ? 'L' : 'M'}${NUM(P.sx(p[0]), nd)} ${NUM(P.sy(p[1]), nd)}`).join('');
  }
  function polygonPfad(geom, P, tolM, nd) {
    const ringe = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach(r => ringe.push(r));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(r => ringe.push(r)));
    return ringe.map(r => { const pts = U.rdp(utmKoords(r), tolM); return pts.map((p, i) => `${i ? 'L' : 'M'}${NUM(P.sx(p[0]), nd)} ${NUM(P.sy(p[1]), nd)}`).join('') + 'Z'; }).join(' ');
  }
  function polygonPfadUtm(geom, P, tolM, nd) {
    const ringe = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach(r => ringe.push(r));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(r => ringe.push(r)));
    return ringe.map(r => { const pts = U.rdp(r, tolM); return pts.map((p, i) => `${i ? 'L' : 'M'}${NUM(P.sx(p[0]), nd)} ${NUM(P.sy(p[1]), nd)}`).join('') + 'Z'; }).join(' ');
  }
  function ticksKm(lim) {
    const span = (lim[1] - lim[0]) / 1000;
    const schritt = [1, 2, 5, 10, 20, 50].find(s => span / s <= 8) || 50;
    const aus = [];
    for (let v = Math.ceil(lim[0] / 1000 / schritt) * schritt; v <= lim[1] / 1000 + 1e-9; v += schritt) aus.push(v);
    return aus;
  }
  async function svg(o) {
    o = o || {};
    const K = WK.karte, meta = WK.daten.meta, R = meta.raum, p = K.preset;
    U.utmInit();
    const xlim = R.xlim, ylim = R.ylim, aspekt = (xlim[1] - xlim[0]) / (ylim[1] - ylim[0]);
    const spec = WK.legende.aktuelleSpec();
    const mitColorbar = spec && (spec.typ === 'kontinuierlich' || spec.typ === 'raster');
    // Achsenbereich
    const axL = SUB.l * FIG.w, axR = SUB.r * FIG.w, axT = (1 - SUB.t) * FIG.h, axB = (1 - SUB.b) * FIG.h;
    let availW = axR - axL, availH = axB - axT;
    if (mitColorbar) availW *= (1 - 0.043 - 0.02);
    const boxW = Math.min(availW, availH * aspekt), boxH = boxW / aspekt;
    const box = { x0: axL + (availW - boxW) / 2, y0: axT + (availH - boxH) / 2, w: boxW, h: boxH };
    const P = projektor(xlim, ylim, box);
    const t = [];
    t.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIG.w} ${FIG.h}" width="${FIG.w}pt" height="${FIG.h}pt" font-family="DejaVu Sans, Arial, sans-serif" fill="#1c1e21">`);
    t.push(`<title>${U.esc(o.titel || (p ? p.titel : (K.meta || {}).label || 'Karte'))}</title>`);
    if (o.hintergrund) t.push(`<rect x="0" y="0" width="${FIG.w}" height="${FIG.h}" fill="white"/>`);
    t.push(`<defs><clipPath id="ax"><rect x="${NUM(box.x0)}" y="${NUM(box.y0)}" width="${NUM(box.w)}" height="${NUM(box.h)}"/></clipPath></defs>`);
    // Gitter und Achsen
    const gitter = WK.stil.kontext('gitter') || '#c4c4c4';
    for (const km of ticksKm(xlim)) { const x = P.sx(km * 1000); t.push(`<line x1="${NUM(x)}" x2="${NUM(x)}" y1="${NUM(box.y0)}" y2="${NUM(box.y0 + box.h)}" stroke="${gitter}" stroke-width="0.4" stroke-opacity="0.7"/><line x1="${NUM(x)}" x2="${NUM(x)}" y1="${NUM(box.y0 + box.h)}" y2="${NUM(box.y0 + box.h + 2)}" stroke="#333" stroke-width="0.5"/><text x="${NUM(x)}" y="${NUM(box.y0 + box.h + 10)}" font-size="7" text-anchor="middle">${km}</text>`); }
    for (const km of ticksKm(ylim)) { const y = P.sy(km * 1000); t.push(`<line x1="${NUM(box.x0)}" x2="${NUM(box.x0 + box.w)}" y1="${NUM(y)}" y2="${NUM(y)}" stroke="${gitter}" stroke-width="0.4" stroke-opacity="0.7"/><line x1="${NUM(box.x0 - 2)}" x2="${NUM(box.x0)}" y1="${NUM(y)}" y2="${NUM(y)}" stroke="#333" stroke-width="0.5"/><text x="${NUM(box.x0 - 4)}" y="${NUM(y + 2.5)}" font-size="7" text-anchor="end">${km}</text>`); }
    t.push(`<text x="${NUM(box.x0 + box.w / 2)}" y="${NUM(box.y0 + box.h + 22)}" font-size="7" text-anchor="middle">Ostwert [km] · UTM 32N</text>`);
    t.push(`<text transform="translate(${NUM(box.x0 - 22)} ${NUM(box.y0 + box.h / 2)}) rotate(-90)" font-size="7" text-anchor="middle">Nordwert [km]</text>`);
    t.push('<g clip-path="url(#ax)">');
    // Overlays fuer Sonderpresets
    if (p && p.overlay === 'hqextrem') {
      const hq = await WK.daten.kontext('hqextrem'), farben = WK.stil.kategorieFarben('h_klasse', ['H2', 'H3', 'H4', 'H5', 'H6']);
      for (const f of hq.features) t.push(`<path d="${polygonPfad(f.geometry, P, 15, 1)}" fill="${farben[f.properties.h_klasse] || '#08589e'}" stroke="none"/>`);
    }
    // Kontextnetz
    const kontextModus = o.kontext === false ? 'keiner' : K.kontext;
    if (kontextModus !== 'keiner') {
      const lwK = (WK.stil.schema.breiten[K.S.kontextLw] || WK.stil.schema.breiten.kontext || 0.3) * (o.faktorAnwenden === false ? 1 : WK.stil.breitenFaktor);
      const farbe = kontextModus === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau');
      const teile = [];
      for (const fe of WK.daten.features) { if (kontextModus === 'gesamt' || fe.properties.aktiv) teile.push(linienPfad(fe.geometry.coordinates, P, 25, 0)); }
      t.push(`<path id="kontextnetz" d="${teile.join('')}" fill="none" stroke="${farbe}" stroke-width="${lwK}" stroke-linecap="round"/>`);
    }
    if (p && p.overlay === 'gewaesser') {
      const gw = await WK.daten.kontext('gewaesser'), r = WK.stil.rampe('coverage');
      for (const f of gw.features) { const cf = f.properties.cover_frac; t.push(`<path d="${linienPfad(f.geometry.coordinates, P, 10, 1)}" fill="none" stroke="${r.farbe(typeof cf === 'number' ? cf : 0.8)}" stroke-width="1.8" stroke-linecap="round"/>`); }
    }
    // Datenlayer (Linienstaerke-Faktor nur, wenn im Export-Dialog gewuenscht)
    let nDaten = 0;
    const ohneFaktor = o.faktorAnwenden === false;
    if (K.variable) {
      const praed = K.praedikat();
      t.push('<g id="daten" fill="none" stroke-linecap="round" stroke-linejoin="round">');
      if (K.skala.modus === 'kategorial') {
        const gruppen = new Map();
        for (const fe of WK.daten.features) { if (!praed(fe)) continue; const w = String(fe.properties[K.variable]); if (!gruppen.has(w)) gruppen.set(w, []); gruppen.get(w).push(fe); }
        const werte = (K.meta.werte || []).map(String);
        for (const w of [...werte, ...[...gruppen.keys()].filter(k => !werte.includes(k))]) {
          const fs = gruppen.get(w); if (!fs) continue;
          const farbe = WK.stil.farbe(K.variable, w, K.skala, K.meta), lw = WK.stil.breiteFuer(K.variable, w, K.skala, K.meta, K.lwVorgabe, ohneFaktor);
          t.push(`<path id="klasse_${U.esc(w).replace(/[^A-Za-z0-9_-]/g, '_')}" d="${fs.map(fe => linienPfad(fe.geometry.coordinates, P, 15, 1)).join('')}" stroke="${farbe}" stroke-width="${lw}"/>`);
          nDaten += fs.length;
        }
      } else {
        for (const fe of WK.daten.features) {
          if (!praed(fe)) continue;
          const wert = fe.properties[K.variable], farbe = WK.stil.farbe(K.variable, wert, K.skala, K.meta); if (!farbe) continue;
          const lw = WK.stil.breiteFuer(K.variable, wert, K.skala, K.meta, K.lwVorgabe, ohneFaktor);
          t.push(`<path id="k${fe.id}" d="${linienPfad(fe.geometry.coordinates, P, 15, 1)}" stroke="${farbe}" stroke-width="${lw}"/>`);
          nDaten++;
        }
      }
      t.push('</g>');
    }
    // Kreisgrenze
    const lk = await WK.daten.kontext('lk_grenze_25832');
    t.push(`<path id="landkreis" d="${lk.features.map(f => polygonPfadUtm(f.geometry, P, 10, 1)).join(' ')}" fill="none" stroke="${WK.stil.kontext('umriss')}" stroke-width="0.8"/>`);
    t.push('</g>');
    // Rahmen
    t.push(`<rect x="${NUM(box.x0)}" y="${NUM(box.y0)}" width="${NUM(box.w)}" height="${NUM(box.h)}" fill="none" stroke="#333" stroke-width="0.5"/>`);
    // Massstab (unten links)
    if (o.massstab !== false) {
      const breiteM = xlim[1] - xlim[0]; let km = 5; for (const k of [25, 20, 10, 5]) { if (k * 1000 <= 0.32 * breiteM) { km = k; break; } }
      const lenPx = km * 1000 / (xlim[1] - xlim[0]) * box.w, hPx = 0.006 * box.h;
      const x0 = box.x0 + 4 + 3.2, yBar = box.y0 + box.h - 4 - 3.2 - 10 - hPx;
      t.push(`<rect x="${NUM(x0 - 3.2)}" y="${NUM(yBar - 3.2)}" width="${NUM(lenPx + 6.4)}" height="${NUM(hPx + 4 + 10 + 3.2)}" fill="white" fill-opacity="0.85"/>`);
      t.push(`<rect x="${NUM(x0)}" y="${NUM(yBar)}" width="${NUM(lenPx)}" height="${NUM(Math.max(1, hPx))}" fill="#222222"/>`);
      t.push(`<text x="${NUM(x0 + lenPx / 2)}" y="${NUM(yBar + hPx + 4 + 7)}" font-size="8" text-anchor="middle" fill="#222222">${km} km</text>`);
    }
    // Nordpfeil (Gitternord)
    if (o.nordpfeil !== false) {
      const nx = box.x0 + 0.66 * box.w, yText = box.y0 + (1 - 0.865) * box.h, yTip = box.y0 + (1 - 0.955) * box.h;
      t.push(`<text x="${NUM(nx)}" y="${NUM(yText + 4)}" font-size="12" font-weight="bold" text-anchor="middle" fill="#222222">N</text>`);
      t.push(`<line x1="${NUM(nx)}" x2="${NUM(nx)}" y1="${NUM(yText - 8)}" y2="${NUM(yTip + 5)}" stroke="#222222" stroke-width="1.8"/><path d="M${NUM(nx)} ${NUM(yTip)} L${NUM(nx - 3.5)} ${NUM(yTip + 7)} L${NUM(nx + 3.5)} ${NUM(yTip + 7)} Z" fill="#222222"/>`);
    }
    // Rand-Legende (unten rechts)
    {
      const eintraege = [{ farbe: WK.stil.kontext('umriss'), lw: 1.0, label: 'Landkreisgrenze' }];
      if (kontextModus !== 'keiner') eintraege.push({ farbe: kontextModus === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau'), lw: 2.0, label: K.kontextLabel });
      const zh = 10, bw = 92, bh = eintraege.length * zh + 6, bx = box.x0 + box.w - 4 - bw, by = box.y0 + box.h - 4 - bh;
      t.push(`<rect x="${NUM(bx)}" y="${NUM(by)}" width="${bw}" height="${NUM(bh)}" fill="white" fill-opacity="0.85" stroke="#cccccc" stroke-width="0.4"/>`);
      eintraege.forEach((e, i) => { const y = by + 3 + i * zh + zh / 2; t.push(`<line x1="${NUM(bx + 5)}" x2="${NUM(bx + 21)}" y1="${NUM(y)}" y2="${NUM(y)}" stroke="${e.farbe}" stroke-width="${e.lw}"/><text x="${NUM(bx + 25)}" y="${NUM(y + 2.5)}" font-size="7">${U.esc(e.label)}</text>`); });
    }
    // Inset (oben rechts, 27 % x 27 %)
    if (o.inset !== false) {
      const iw = 0.27 * box.w, ih = 0.27 * box.h, ix = box.x0 + box.w - 3 - iw, iy = box.y0 + 3;
      const nds = await WK.daten.kontext('niedersachsen_25832');
      const nb = R.nds_bounds_25832;
      const na = (nb[2] - nb[0]) / (nb[3] - nb[1]);
      const iBoxW = Math.min(iw, ih * na), iBoxH = iBoxW / na;
      const ibox = { x0: ix + (iw - iBoxW) / 2, y0: iy + (ih - iBoxH) / 2, w: iBoxW, h: iBoxH };
      const IP = projektor([nb[0], nb[2]], [nb[1], nb[3]], ibox);
      t.push(`<rect x="${NUM(ix)}" y="${NUM(iy)}" width="${NUM(iw)}" height="${NUM(ih)}" fill="white" stroke="#333" stroke-width="0.5"/>`);
      t.push(`<path d="${nds.features.map(f => polygonPfadUtm(f.geometry, IP, 500, 1)).join(' ')}" fill="${WK.stil.kontext('inset_land') || '#ececec'}" stroke="${WK.stil.kontext('inset_rand') || '#8a8a8a'}" stroke-width="0.5"/>`);
      t.push(`<path d="${lk.features.map(f => polygonPfadUtm(f.geometry, IP, 200, 1)).join(' ')}" fill="${WK.stil.kontext('warm')}" stroke="none"/>`);
      t.push(`<text x="${NUM(ix + iw / 2)}" y="${NUM(iy - 2)}" font-size="6" text-anchor="middle">Lage in Niedersachsen</text>`);
    }
    // Titel und Buchstabe
    const titel = o.titel !== undefined && o.titel !== '' ? o.titel : (p ? p.titel : (K.meta || {}).label || '');
    if (titel) t.push(`<text x="${NUM(box.x0 + box.w / 2)}" y="${NUM(box.y0 - 6)}" font-size="11" text-anchor="middle">${U.esc(titel)}</text>`);
    if (o.buchstabe) t.push(`<text x="${NUM(box.x0 + 0.01 * box.w)}" y="${NUM(box.y0 + 0.01 * box.h + 13)}" font-size="15" font-weight="bold">${U.esc(o.buchstabe)}</text>`);
    // Colorbar / Legende rechts
    if (o.legende !== false && spec) {
      if (mitColorbar) {
        const cw = 0.043 * box.w, cx = box.x0 + box.w + 0.02 * box.w, cy = box.y0, ch = box.h, gid = 'cb';
        t.push(`<defs><linearGradient id="${gid}" x1="0" x2="0" y1="1" y2="0">${spec.stops.map(s => `<stop offset="${(s[0] * 100).toFixed(2)}%" stop-color="${s[1]}"/>`).join('')}</linearGradient></defs>`);
        t.push(`<rect x="${NUM(cx)}" y="${NUM(cy)}" width="${NUM(cw)}" height="${NUM(ch)}" fill="url(#${gid})" stroke="#333" stroke-width="0.5"/>`);
        const span = (spec.vmax - spec.vmin) || 1e-9, dez = span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3;
        for (const tk of spec.ticks) { const y = cy + ch - (tk - spec.vmin) / span * ch; if (y < cy - 0.5 || y > cy + ch + 0.5) continue; t.push(`<line x1="${NUM(cx + cw)}" x2="${NUM(cx + cw + 2.5)}" y1="${NUM(y)}" y2="${NUM(y)}" stroke="#333" stroke-width="0.5"/><text x="${NUM(cx + cw + 4)}" y="${NUM(y + 2.5)}" font-size="7">${U.formatZahl(tk, spec.typ === 'raster' ? 0 : dez)}</text>`); }
        t.push(`<text transform="translate(${NUM(cx + cw + 26)} ${NUM(cy + ch / 2)}) rotate(90)" font-size="8" text-anchor="middle">${U.esc(spec.label || '')}</text>`);
      } else if (spec.typ === 'kategorial' || spec.typ === 'klassen') {
        const lx = box.x0 + box.w + 0.02 * box.w + 2, kl = spec.klassen.slice().reverse(), zh = 12, ly = box.y0 + box.h / 2 - (kl.length * zh) / 2;
        if (spec.titel) t.push(`<text x="${NUM(lx)}" y="${NUM(ly - 6)}" font-size="9">${U.esc(spec.titel)}</text>`);
        kl.forEach((k, i) => { const y = ly + i * zh; t.push(`<rect x="${NUM(lx)}" y="${NUM(y)}" width="14" height="8" fill="${k.farbe}"/><text x="${NUM(lx + 19)}" y="${NUM(y + 7)}" font-size="8">${U.esc(k.label)}</text>`); });
      } else if (spec.typ === 'quintil') {
        const lx = box.x0 + box.w + 0.02 * box.w + 2, q = spec.quintile.slice().reverse(), zh = 16, ly = box.y0 + box.h / 2 - (q.length * zh) / 2 + 10;
        t.push(`<text x="${NUM(lx)}" y="${NUM(ly - 14)}" font-size="8.5">Link Importance (Quintile)</text><text x="${NUM(lx)}" y="${NUM(ly - 5)}" font-size="8.5">hell → kräftig = Rang in der Klasse</text>`);
        q.forEach((qi, i) => { const y = ly + i * zh, gid = `q${i}`; t.push(`<defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="${qi.farben[0]}"/><stop offset="100%" stop-color="${qi.farben[1]}"/></linearGradient></defs><rect x="${NUM(lx)}" y="${NUM(y)}" width="24" height="10" fill="url(#${gid})" stroke="#888888" stroke-width="0.4"/><text x="${NUM(lx + 29)}" y="${NUM(y + 8)}" font-size="8">${U.esc(`${qi.kz} (${qi.spanne}) – ${qi.semantik}`)}</text>`); });
      } else if (spec.typ === 'einfarbig') {
        const lx = box.x0 + box.w + 0.02 * box.w + 2, ly = box.y0 + box.h / 2;
        t.push(`<line x1="${NUM(lx)}" x2="${NUM(lx + 16)}" y1="${NUM(ly)}" y2="${NUM(ly)}" stroke="${spec.farbe}" stroke-width="2"/><text x="${NUM(lx + 20)}" y="${NUM(ly + 3)}" font-size="8">${U.esc(spec.label)}</text>`);
      }
    }
    // Impressum (fig.text(0.01, 0.008), 3 Zeilen, fontsize 6.5, linespacing 1.5)
    const key = p && p.impressum ? p.impressum : null;
    const datenbasis = key && meta.datenbasis[key] ? meta.datenbasis[key] : 'Straßennetz © OpenStreetMap-Mitwirkende; Kennwerte: eigene Berechnung.';
    const zeilen = [`Autor: ${meta.autor}   ·   Erstellt: ${U.heute()}   ·   Farbschema: ${WK.stil.schema.name || WK.stil.schemaId}${WK.stil.geaendert ? ' (geändert)' : ''}`, `Datenbasis: ${datenbasis}`, `Koordinatensystem: ${meta.crs_arbeit}`];
    const lh = 6.5 * 1.5, y0 = FIG.h - 0.008 * FIG.h;
    zeilen.forEach((z, i) => t.push(`<text x="${NUM(0.01 * FIG.w)}" y="${NUM(y0 - (zeilen.length - 1 - i) * lh)}" font-size="6.5" fill="#333333">${U.esc(z)}</text>`));
    t.push(`<!-- ${nDaten} Datenkanten; erzeugt von der Web-Karte (WK.layoutArbeit) -->`);
    t.push('</svg>');
    return t.join('\n');
  }
  return { svg, projektor, FIG, SUB };
})();
