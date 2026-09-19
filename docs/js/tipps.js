/* Tipps: Wer zum ersten Mal eine Variable oder Karte einer Gruppe anklickt, bekommt die passenden Ebenen als Option
   angeboten (z. B. zu Starkregen die WMS-Karten mit Ueberflutungstiefe und Fliessgeschwindigkeit).
   Texte und Aktionen sind Daten: data/glossar.json, Abschnitt "tipps" (Schluessel = Gruppen-id). */
WK.tipps = (() => {
  const U = WK.util;
  const S = { karte: null };
  const GESEHEN = 'wk.tipps.gesehen', AUS = 'wk.tipps.aus';
  const alle = () => (WK.daten.glossar || {}).tipps || {};
  const ebeneDa = id => !!(WK.layers && WK.layers.EBENEN.some(e => e.id === id));
  const ebeneAn = id => !!(WK.layers && WK.layers.an.includes(id));

  function gruppeVonPreset(p) {
    if (!p) return null;
    if (p.variable) { const v = WK.daten.variable(p.variable); return v ? v.gruppe : null; }
    if (p.overlay === 'hqextrem' || p.overlay === 'gewaesser') return 'fluvial';
    if (p.raster) return 'heat';
    return null;
  }
  function fuerPreset(p) { fuerGruppe(gruppeVonPreset(p)); }
  function fuerVariable(id) { const v = WK.daten.variable(id); fuerGruppe(v ? v.gruppe : null); }
  function fuerGruppe(gid) {
    const t = gid ? alle()[gid] : null; if (!t) return;
    if (U.ls(AUS) || (WK.tour && WK.tour.aktiv)) return;
    const gesehen = U.ls(GESEHEN) || [];
    if (gesehen.includes(gid)) return;
    const aktionen = (t.aktionen || []).filter(a => ebeneDa(a.ebene));
    if (aktionen.length && aktionen.every(a => ebeneAn(a.ebene))) return;      // alles schon eingeblendet
    gesehen.push(gid); U.ls(GESEHEN, gesehen);
    zeigen(t, aktionen);
  }
  function schliessen() { if (S.karte && S.karte.parentNode) S.karte.parentNode.removeChild(S.karte); S.karte = null; }
  function zeigen(t, aktionen) {
    schliessen();
    const knoepfe = U.el('div', { class: 'tipp-aktionen' });
    for (const a of aktionen) {
      const b = U.el('button', { class: ebeneAn(a.ebene) ? 'aktiv' : '', title: 'Ebene ein- oder ausblenden; sie steht auch links unter „Ebenen"' }, (ebeneAn(a.ebene) ? '✓ ' : '') + a.label);
      b.addEventListener('click', async () => {
        const an = !ebeneAn(a.ebene);
        await WK.layers.setzen(a.ebene, an);
        b.classList.toggle('aktiv', ebeneAn(a.ebene)); b.textContent = (ebeneAn(a.ebene) ? '✓ ' : '') + a.label;
        const abs = document.getElementById('abs-ebenen'); if (an && abs) abs.open = true;      // zeigen, wo die Ebene zu finden ist
      });
      knoepfe.appendChild(b);
    }
    const aus = U.el('input', { type: 'checkbox' });
    aus.addEventListener('change', () => U.ls(AUS, aus.checked ? 1 : null));
    S.karte = U.el('div', { class: 'tipp-karte', role: 'status' },
      U.el('div', { class: 'tipp-kopf' }, U.el('strong', {}, t.titel), U.el('button', { class: 'tipp-zu', title: 'Tipp schließen', onclick: schliessen }, '✕')),
      U.el('p', {}, t.text), knoepfe,
      U.el('div', { class: 'tipp-fuss' }, U.el('label', {}, aus, ' keine Tipps mehr zeigen'), U.el('button', { onclick: schliessen }, 'Verstanden')));
    (document.getElementById('mitte') || document.body).appendChild(S.karte);
  }
  function zuruecksetzen() { U.ls(GESEHEN, []); U.ls(AUS, null); if (WK.ui) WK.ui.melden('Tipps erscheinen wieder beim ersten Anklicken einer Gruppe'); }
  return { fuerGruppe, fuerPreset, fuerVariable, schliessen, zuruecksetzen, get offen() { return !!S.karte; } };
})();
