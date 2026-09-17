/* Hilfsfunktionen: Formatierung, DOM, Farben, Geometrie, Projektion */
WK.util = (() => {
  const formate = {};
  function formatZahl(v, dez) {
    if (v === null || v === undefined || Number.isNaN(v)) return '–';
    if (typeof v !== 'number') return String(v);
    if (dez === undefined || dez === null) dez = Math.abs(v) >= 100 ? 0 : (Math.abs(v) >= 1 ? 2 : 4);
    const k = 'd' + dez;
    if (!formate[k]) formate[k] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: dez, maximumFractionDigits: dez });
    return formate[k].format(v);
  }
  function formatKurz(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return '–';
    const a = Math.abs(v);
    if (a >= 1000) return formatZahl(v, 0);
    if (a >= 10) return formatZahl(v, 1);
    if (a >= 1) return formatZahl(v, 2);
    return formatZahl(v, 3);
  }
  function el(tag, attrs, ...kinder) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (v === false || v === null || v === undefined) continue;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const kind of kinder.flat()) {
      if (kind === null || kind === undefined || kind === false) continue;
      e.appendChild(typeof kind === 'string' || typeof kind === 'number' ? document.createTextNode(String(kind)) : kind);
    }
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function kopieren(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = el('textarea', { style: { position: 'fixed', opacity: 0 } }, text);
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    }
  }
  function heute() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; }
  function heuteKurz() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }

  // Farben
  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function lerpHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  function istHex(s) { return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s); }
  function kontrastText(hex) { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1c1e21' : '#ffffff'; }
  // CIE76-ΔE (grob, fuer die Kontrastpruefung)
  function lab(hex) {
    let [r, g, b] = hexRgb(hex).map(v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; });
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = (r * 0.2126 + g * 0.7152 + b * 0.0722), z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function deltaE(a, b) { const A = lab(a), B = lab(b); return Math.sqrt((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2); }

  // "nette" Tick-Werte
  function ticks(vmin, vmax, n) {
    if (!(vmax > vmin)) return [vmin];
    const roh = (vmax - vmin) / Math.max(1, n - 1);
    const p = Math.pow(10, Math.floor(Math.log10(roh)));
    const f = roh / p;
    const schritt = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
    const aus = [];
    for (let v = Math.ceil(vmin / schritt) * schritt; v <= vmax + 1e-9; v += schritt) aus.push(+v.toFixed(10));
    return aus;
  }
  function nice(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p; }
  function meterProPixel(zoom, lat) { return 40075016.686 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom + 8); }
  function quantil(sortiert, q) {
    if (!sortiert.length) return NaN;
    const pos = (sortiert.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sortiert[lo] + (sortiert[hi] - sortiert[lo]) * (pos - lo);
  }
  // Douglas-Peucker
  function rdp(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      let imax = -1, dmax = 0;
      for (let i = a + 1; i < b; i++) {
        let d;
        if (len2 === 0) d = Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
        else { const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2)); d = Math.hypot(pts[i][0] - (ax + t * dx), pts[i][1] - (ay + t * dy)); }
        if (d > dmax) { dmax = d; imax = i; }
      }
      if (dmax > tol && imax > 0) { keep[imax] = 1; stack.push([a, imax], [imax, b]); }
    }
    const aus = [];
    for (let i = 0; i < pts.length; i++) if (keep[i]) aus.push(pts[i]);
    return aus;
  }
  // Projektion EPSG:25832 (UTM 32N, ETRS89)
  let projOk = false;
  function utmInit() {
    if (projOk || typeof proj4 === 'undefined') return projOk;
    proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
    projOk = true; return true;
  }
  function utm(lonlat) { utmInit(); return proj4('EPSG:4326', 'EPSG:25832', lonlat); }
  function lonlat(xy) { utmInit(); return proj4('EPSG:25832', 'EPSG:4326', xy); }
  function haversine(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[1] - a[1]) * toR, dLon = (b[0] - a[0]) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bboxVon(coords) {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [x, y] of coords) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return [w, s, e, n];
  }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function lsLoeschen(k) { try { localStorage.removeItem(k); } catch (e) { /* leer */ } }
  return { formatZahl, formatKurz, el, esc, debounce, download, kopieren, heute, heuteKurz, hexRgb, rgbHex, lerpHex, istHex,
           kontrastText, deltaE, ticks, nice, meterProPixel, quantil, rdp, utm, lonlat, utmInit, haversine, bboxVon, ls, lsLoeschen };
})();
