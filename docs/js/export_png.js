/* Export-Dialog und Rasterexport (PNG/JPEG mit Hintergrund): Offscreen-Map mit pixelRatio, Komposition */
WK.exportPng = (() => {
  const U = WK.util;
  const S = { o: { format: 'png', faktor: 2, titel: '', buchstabe: '', legende: true, massstab: true, nordpfeil: true, kontext: true, schemaBeilegen: false, hintergrund: false, groesse: 'ansicht' } };

  function zoomFaktor(z) {
    const st = WK.config.breitenZoom;
    if (z <= st[0][0]) return st[0][1]; if (z >= st[st.length - 1][0]) return st[st.length - 1][1];
    for (let i = 0; i < st.length - 1; i++) { const [z0, f0] = st[i], [z1, f1] = st[i + 1]; if (z >= z0 && z <= z1) { const base = 1.6, t = (Math.pow(base, z - z0) - 1) / (Math.pow(base, z1 - z0) - 1); return f0 + (f1 - f0) * t; } }
    return 1;
  }
  function titelStandard() { const K = WK.karte; return K.preset ? K.preset.titel : (K.meta ? K.meta.label : ''); }
  function attributionText() {
    const K = WK.karte, m = WK.daten.meta, teile = [];
    const bm = WK.basemaps.def(WK.basemaps.aktuell); if (bm && bm.attribution) teile.push(bm.attribution);
    const key = K.preset && K.preset.impressum ? K.preset.impressum : null;
    teile.push(key && m.datenbasis[key] ? m.datenbasis[key] : 'Straßennetz © OpenStreetMap-Mitwirkende; Kennwerte: eigene Berechnung.');
    return teile.join('  ·  ');
  }
  function impressumZeile() { return `Autor: ${WK.daten.meta.autor}   ·   Erstellt: ${U.heute()}   ·   Farbschema: ${WK.stil.schema.name || WK.stil.schemaId}${WK.stil.geaendert ? ' (geändert)' : ''}   ·   Koordinatensystem: Web Mercator (EPSG:3857)`; }

  async function rendern(o) {
    const K = WK.karte, map = K.map, k = o.faktor;
    const cont = map.getContainer();
    let w = cont.clientWidth, h = cont.clientHeight;
    if (o.groesse === 'a4quer') { w = 1123; h = 794; } else if (o.groesse === '16zu9') { w = 1280; h = 720; } else if (o.groesse === 'quadrat') { w = 900; h = 900; }
    if (w * k > 8192 || h * k > 8192) throw new Error('Export zu groß (max. 8192 px je Seite); kleineren Faktor wählen');
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}px;height:${h}px;`;
    document.body.appendChild(div);
    const style = map.getStyle();
    if (!o.kontext) style.layers = style.layers.map(l => l.id === 'kontext_netz' ? Object.assign({}, l, { layout: Object.assign({}, l.layout || {}, { visibility: 'none' }) }) : l);
    const m2 = new maplibregl.Map({ container: div, style, center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
      pixelRatio: k, maxCanvasSize: [8192, 8192], canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true }, interactive: false, attributionControl: false, fadeDuration: 0 });
    try {
      await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Zeitüberschreitung beim Rendern')), 60000); m2.once('load', () => m2.once('idle', () => { clearTimeout(t); res(); })); });
      await new Promise(r => setTimeout(r, 250));
      const bild = m2.getCanvas();
      const fussH = 34 * k, titelH = o.titel ? 30 * k : 0;
      const c = document.createElement('canvas'); c.width = w * k; c.height = h * k + fussH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bild, 0, 0, w * k, h * k);
      // Titel
      if (o.titel) {
        ctx.font = `bold ${15 * k}px "DejaVu Sans", Arial, sans-serif`; ctx.textBaseline = 'top';
        const tw = ctx.measureText(o.titel).width + 16 * k;
        ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(10 * k, 10 * k, tw, titelH);
        ctx.fillStyle = '#1c1e21'; ctx.fillText(o.titel, 18 * k, 16 * k);
      }
      if (o.buchstabe) { ctx.font = `bold ${22 * k}px "DejaVu Sans", Arial, sans-serif`; ctx.fillStyle = '#1c1e21'; ctx.textBaseline = 'top'; ctx.fillText(o.buchstabe, 12 * k, (o.titel ? 48 : 12) * k); }
      // Legende
      if (o.legende) {
        const spec = WK.legende.aktuelleSpec();
        if (spec) {
          const kz = [{ farbe: WK.stil.kontext('umriss'), lw: 2, label: 'Landkreisgrenze' }];
          if (K.kontext !== 'keiner' && o.kontext) kz.push({ farbe: K.kontext === 'aktiv_dunkel' ? WK.stil.kontext('netz_dunkel') : WK.stil.kontext('grau'), lw: 3, label: K.kontextLabel });
          const breite = 230;
          const mess = document.createElement('canvas').getContext('2d');
          const dims = WK.legende.zeichnenCanvas(mess, spec, 0, 0, k, { breite, kontextZeilen: kz });
          WK.legende.zeichnenCanvas(ctx, spec, w * k - dims.breite - 12 * k, h * k - dims.hoehe - 12 * k, k, { breite, kontextZeilen: kz });
        }
      }
      // Massstab
      if (o.massstab) {
        const mpp = U.meterProPixel(map.getZoom(), map.getCenter().lat) / k;
        const zielPx = 0.22 * w * k; let laenge = U.nice(zielPx * mpp);
        while (laenge / mpp > 0.3 * w * k) laenge = U.nice(laenge * 0.5);
        const px = laenge / mpp, x0 = 14 * k, y0 = h * k - 22 * k;
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x0 - 6 * k, y0 - 18 * k, px + 12 * k, 30 * k);
        ctx.fillStyle = '#222'; ctx.fillRect(x0, y0, px, 4 * k);
        ctx.font = `${11 * k}px "DejaVu Sans", Arial, sans-serif`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
        ctx.fillText(laenge >= 1000 ? `${U.formatZahl(laenge / 1000, laenge % 1000 ? 1 : 0)} km` : `${laenge} m`, x0 + px / 2, y0 - 3 * k);
        ctx.textAlign = 'left';
      }
      // Nordpfeil (Web Mercator: Norden oben, Bearing beruecksichtigen)
      if (o.nordpfeil) {
        const cx = w * k - 30 * k, cy = (o.titel ? 60 : 30) * k + 12 * k, r = 16 * k, b = -map.getBearing() * Math.PI / 180;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(b);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, r + 8 * k, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, -r + 6 * k); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(-5 * k, -r + 9 * k); ctx.lineTo(5 * k, -r + 9 * k); ctx.closePath(); ctx.fill();
        ctx.font = `bold ${12 * k}px "DejaVu Sans", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('N', 0, -r - 2 * k - 12 * k);
        ctx.restore();
      }
      // Fusszeile
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h * k, w * k, fussH);
      ctx.fillStyle = '#333'; ctx.font = `${9.5 * k}px "DejaVu Sans", Arial, sans-serif`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText(kuerzen(ctx, attributionText(), w * k - 16 * k), 8 * k, h * k + 5 * k);
      ctx.fillText(kuerzen(ctx, impressumZeile(), w * k - 16 * k), 8 * k, h * k + 18 * k);
      return c;
    } finally { m2.remove(); div.remove(); }
  }
  function kuerzen(ctx, text, maxW) { if (ctx.measureText(text).width <= maxW) return text; while (text.length > 3 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; }
  function dateiname(ext, o) { const K = WK.karte; const basis = K.preset ? K.preset.id : (K.variable || 'karte'); return `webkarte_${basis}_${U.heuteKurz()}_z${K.map.getZoom().toFixed(1)}${o && o.faktor ? '_' + o.faktor + 'x' : ''}.${ext}`; }
  async function exportieren(o) {
    o = Object.assign({}, S.o, o || {});
    WK.ui.melden('Rendere Karte …', 60000);
    try {
      if (o.format === 'svg') { const svg = WK.exportSvg.aktuelleAnsicht(o); U.download(new Blob([svg], { type: 'image/svg+xml' }), dateiname('svg')); }
      else if (o.format === 'arbeitslayout') { const svg = await WK.layoutArbeit.svg(o); U.download(new Blob([svg], { type: 'image/svg+xml' }), `webkarte_arbeitslayout_${WK.karte.preset ? WK.karte.preset.id : WK.karte.variable}_${U.heuteKurz()}.svg`); }
      else {
        const c = await rendern(o);
        const typ = o.format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise(res => c.toBlob(res, typ, 0.92));
        U.download(blob, dateiname(o.format === 'jpeg' ? 'jpg' : 'png', o));
      }
      if (o.schemaBeilegen) { const sch = WK.stil.exportieren(); U.download(new Blob([JSON.stringify(sch, null, 1)], { type: 'application/json' }), `farbschema_${(sch.id || 'eigen').replace(/[^a-z0-9_]/gi, '_')}_${U.heuteKurz()}.json`); }
      WK.ui.melden('Export gespeichert (Download)');
    } catch (e) { console.error(e); WK.ui.melden('Export fehlgeschlagen: ' + e.message, 6000); }
  }
  function dialog() {
    const o = S.o; o.titel = o.titel || titelStandard();
    const box = U.el('div');
    const fmt = U.el('select', {}, U.el('option', { value: 'png' }, 'PNG (mit Hintergrundkarte)'), U.el('option', { value: 'jpeg' }, 'JPEG (mit Hintergrundkarte)'), U.el('option', { value: 'svg' }, 'SVG – aktuelle Ansicht (ohne Hintergrund, Web Mercator)'), U.el('option', { value: 'arbeitslayout' }, 'SVG – Arbeitslayout (UTM 32N, wie die Abbildungen der Arbeit)'));
    fmt.value = o.format;
    const faktor = U.el('select', {}, U.el('option', { value: 1 }, '1× (Bildschirm)'), U.el('option', { value: 2 }, '2×'), U.el('option', { value: 3 }, '3×'));
    faktor.value = o.faktor;
    const groesse = U.el('select', {}, U.el('option', { value: 'ansicht' }, 'wie Kartenfenster'), U.el('option', { value: 'a4quer' }, 'A4 quer (1123 × 794)'), U.el('option', { value: '16zu9' }, '16:9 (1280 × 720)'), U.el('option', { value: 'quadrat' }, 'quadratisch (900 × 900)'));
    groesse.value = o.groesse;
    const titel = U.el('input', { type: 'text', value: o.titel, style: { width: '100%' } });
    const buchstabe = U.el('input', { type: 'text', value: o.buchstabe, maxlength: 2, style: { width: '50px' }, placeholder: 'A' });
    const cbs = {};
    const cb = (key, label) => { const c = U.el('input', { type: 'checkbox', checked: !!o[key] }); cbs[key] = c; return U.el('label', {}, c, ' ' + label); };
    const zeilen = U.el('div', { class: 'spalten' },
      U.el('div', {}, U.el('div', { class: 'zeile' }, U.el('label', {}, 'Format'), fmt), U.el('div', { class: 'zeile', id: 'ex-raster' }, U.el('label', {}, 'Auflösung'), faktor, U.el('label', {}, 'Größe'), groesse), U.el('div', { class: 'zeile' }, U.el('label', {}, 'Titel'), titel), U.el('div', { class: 'zeile' }, U.el('label', {}, 'Panel-Buchstabe'), buchstabe)),
      U.el('div', {}, U.el('div', { class: 'zeile' }, cb('legende', 'Legende')), U.el('div', { class: 'zeile' }, cb('massstab', 'Maßstab')), U.el('div', { class: 'zeile' }, cb('nordpfeil', 'Nordpfeil')), U.el('div', { class: 'zeile' }, cb('kontext', 'Kontextnetz')), U.el('div', { class: 'zeile' }, cb('hintergrund', 'weißer Hintergrund im SVG')), U.el('div', { class: 'zeile' }, cb('schemaBeilegen', 'Farbschema als JSON beilegen'))));
    box.appendChild(zeilen);
    const hinweis = U.el('p', { class: 'klein' });
    const hinweisNeu = () => { const f = fmt.value; document.getElementById('ex-raster').hidden = !(f === 'png' || f === 'jpeg'); hinweis.textContent = f === 'arbeitslayout' ? 'Ausschnitt Landkreis ± 2 km, km-Gitter, Maßstab, Nordpfeil, Inset, Colorbar/Legende und Impressum wie abb_helfer.karte(); alle gefilterten Kanten der Variable (nicht nur der Ausschnitt). Raster-Overlays werden nicht ausgegeben.' : f === 'svg' ? 'Vektorgrafik des aktuellen Ausschnitts: Kanten als Pfade mit id="k<Kanten-id>", Legende, Maßstab, Nordpfeil; ohne Hintergrundkarte.' : `Rendert die Karte offscreen mit ${faktor.value}-facher Auflösung inklusive Hintergrundkarte, Legende, Maßstab, Nordpfeil und Attribution.`; };
    fmt.addEventListener('change', hinweisNeu); faktor.addEventListener('change', hinweisNeu); hinweisNeu();
    box.appendChild(hinweis);
    const vorschau = U.el('div', { class: 'vorschau', hidden: true });
    const btn = U.el('button', { class: 'aktiv', onclick: async () => {
      Object.assign(o, { format: fmt.value, faktor: +faktor.value, groesse: groesse.value, titel: titel.value, buchstabe: buchstabe.value });
      for (const [k, c] of Object.entries(cbs)) o[k] = c.checked;
      await exportieren(o);
    } }, 'Exportieren');
    const vorBtn = U.el('button', { onclick: async () => {
      Object.assign(o, { format: fmt.value, faktor: 1, groesse: groesse.value, titel: titel.value, buchstabe: buchstabe.value });
      for (const [k, c] of Object.entries(cbs)) o[k] = c.checked;
      vorschau.hidden = false; vorschau.innerHTML = '<span class="klein">Rendere Vorschau …</span>';
      try {
        if (fmt.value === 'svg') vorschau.innerHTML = WK.exportSvg.aktuelleAnsicht(o);
        else if (fmt.value === 'arbeitslayout') vorschau.innerHTML = await WK.layoutArbeit.svg(o);
        else { const c = await rendern(Object.assign({}, o, { faktor: 1 })); vorschau.innerHTML = ''; const img = new Image(); img.src = c.toDataURL('image/png'); vorschau.appendChild(img); }
        const svgEl = vorschau.querySelector('svg'); if (svgEl) { svgEl.removeAttribute('width'); svgEl.removeAttribute('height'); svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto'; }
      } catch (e) { vorschau.innerHTML = `<span class="fehler">${U.esc(e.message)}</span>`; }
    } }, 'Vorschau');
    box.appendChild(U.el('div', { class: 'zeile' }, btn, vorBtn));
    box.appendChild(vorschau);
    WK.ui.dialog('Export', box, { breit: true });
  }
  return { dialog, exportieren, rendern, zoomFaktor, attributionText, impressumZeile, titelStandard, get optionen() { return S.o; } };
})();
