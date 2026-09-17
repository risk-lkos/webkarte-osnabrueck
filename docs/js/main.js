/* Startsequenz: Daten -> Stil -> Karte -> Module -> URL-Zustand */
(async () => {
  const laden = document.getElementById('laden'), text = document.getElementById('laden-text'), prog = document.getElementById('laden-progress');
  const fortschritt = (t, p) => { text.textContent = t; prog.value = p; };
  try {
    const t0 = performance.now();
    await WK.daten.laden(fortschritt);
    const meta = WK.daten.meta;
    WK.stil.init(WK.daten.paletten, WK.daten.schemata, (meta.stil || {}).standard_schema || 'arbeit');
    WK.util.utmInit();
    const map = WK.karte.erzeugen('karte');
    const module = ['legende', 'panel', 'ui', 'layers', 'filter', 'suche', 'histogramm', 'rangliste', 'vergleich', 'farben', 'detail', 'exportPng', 'exportSvg', 'layoutArbeit', 'url', 'hilfe'];
    WK.bus.on('karte-bereit', () => {
      for (const m of module) { if (WK[m] && typeof WK[m].init === 'function') { try { WK[m].init(map); } catch (e) { console.error('init', m, e); } } }
      const url = WK.url ? WK.url.lesen() : null;
      const basemap = (url && url.basemap) || WK.config.karte.startBasemap || WK.basemaps.standard();
      WK.basemaps.setzen(map, basemap, 'kontext_netz');
      if (url && url.preset) WK.karte.setPreset(url.preset);
      else if (url && url.variable) WK.karte.setVariable(url.variable, { modus: url.modus });
      else WK.karte.setPreset(WK.config.karte.startPreset);
      if (WK.url) WK.url.anwenden(url);
      WK.basemaps.verfuegbarkeitPruefen();
      laden.hidden = true;
      console.info(`Web-Karte bereit: ${WK.daten.anzahl} Kanten in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    });
  } catch (e) {
    console.error(e);
    laden.classList.add('fehler');
    text.textContent = 'Fehler beim Laden: ' + (e && e.message ? e.message : e);
    prog.hidden = true;
  }
})();
