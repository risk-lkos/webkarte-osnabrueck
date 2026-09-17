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
    const module = ['legende', 'panel', 'ui', 'layers', 'filter', 'suche', 'histogramm', 'rangliste', 'vergleich', 'farben', 'detail', 'exportPng', 'exportSvg', 'layoutArbeit', 'url', 'hilfe', 'favoriten'];
    WK.bus.on('karte-bereit', () => {
      for (const m of module) { if (WK[m] && typeof WK[m].init === 'function') { try { WK[m].init(map); } catch (e) { console.error('init', m, e); } } }
      const url = WK.url ? WK.url.lesen() : null;
      // ohne URL-Zustand: letzte Ansicht aus dem Browser-Speicher
      const letzte = !url ? (WK.util.ls(WK.config.speicher.ansicht) || null) : null;
      const basemap = (url && url.basemap) || (letzte && letzte.basemap) || WK.config.karte.startBasemap || WK.basemaps.standard();
      WK.basemaps.setzen(map, basemap, 'kontext_netz');
      // beim Start nur den Inhalt des Presets setzen, nicht die Arbeitsansicht (Hintergrund/Ausschnitt bleiben wie gespeichert)
      if (url && url.preset) WK.karte.setPreset(url.preset, { ohneAnsicht: true });
      else if (url && url.variable) WK.karte.setVariable(url.variable, { modus: url.modus });
      else if (letzte && letzte.preset && WK.daten.preset(letzte.preset)) WK.karte.setPreset(letzte.preset, { ohneAnsicht: true });
      else if (letzte && letzte.variable && WK.daten.variable(letzte.variable)) WK.karte.setVariable(letzte.variable);
      else WK.karte.setPreset(WK.config.karte.startPreset, { ohneAnsicht: true });
      if (WK.url) WK.url.anwenden(url);
      if (letzte && letzte.ansicht && !(url && url.ansicht)) WK.karte.ansicht(letzte.ansicht);
      const merken = WK.util.debounce(() => { const K = WK.karte; WK.util.ls(WK.config.speicher.ansicht, { preset: K.preset ? K.preset.id : null, variable: K.variable, basemap: WK.basemaps.aktuell, ansicht: K.zustand() }); }, 500);
      for (const ev of ['ansicht', 'variable', 'basemap']) WK.bus.on(ev, merken);
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
