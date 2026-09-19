/* Tipps: Wer zum ersten Mal eine Variable oder Karte einer Gruppe anklickt, bekommt die passenden Ebenen als Option
   angeboten (z. B. zu Starkregen die WMS-Karten mit Ueberflutungstiefe und Fliessgeschwindigkeit).
   Texte und Aktionen sind Daten: data/glossar.json, Abschnitt "tipps" (Schluessel = Gruppen-id).

   Herkunft der Ebenen: Eine ueber den Tipp eingeblendete Ebene gehoert zu dieser Gefahr (S.vonTipp: Ebene -> Gruppe).
   Sie bleibt, solange man innerhalb der Gruppe bleibt, und wird ausgeblendet, sobald eine andere Gruppe gewaehlt wird,
   damit sich die Gefahrenkarten nicht ueberlagern. Von Hand unter "Ebenen" geschaltete Ebenen sind davon unberuehrt;
   wer eine Tipp-Ebene dort aus- und wieder einschaltet, macht sie dauerhaft. */
WK.tipps = (() => {
  const U = WK.util;
  const S = { karte: null, karteGruppe: null, vonTipp: new Map(), gruppe: undefined };
  const GESEHEN = 'wk.tipps.gesehen', AUS = 'wk.tipps.aus';
  const alle = () => (WK.daten.glossar || {}).tipps || {};
  const ebene = id => (WK.layers ? WK.layers.EBENEN.find(e => e.id === id) : null);
  const ebeneDa = id => !!ebene(id);
  const ebeneAn = id => !!(WK.layers && WK.layers.an.includes(id));

  function gruppeVonPreset(p) {
    if (!p) return null;
    if (p.variable) { const v = WK.daten.variable(p.variable); return v ? v.gruppe : null; }
    if (p.overlay === 'hqextrem' || p.overlay === 'gewaesser') return 'fluvial';
    if (p.raster) return 'heat';
    return null;
  }
  function gruppeVonInfo(info) { return info && info.meta && info.meta.gruppe ? info.meta.gruppe : gruppeVonPreset(info && info.preset); }

  function init() {
    // jede Aenderung der gezeigten Variable oder Karte, egal ob per Klick, Tastatur oder Link
    WK.bus.on('variable', info => gruppenwechsel(gruppeVonInfo(info)));
    // von Hand ausgeblendet: die Ebene gilt nicht mehr als Tipp-Ebene
    WK.bus.on('ebenen', an => { for (const id of [...S.vonTipp.keys()]) if (!an.includes(id)) S.vonTipp.delete(id); });
  }
  function gruppenwechsel(g) {
    if (S.gruppe === undefined) { S.gruppe = g; return; }        // Startzustand merken
    if (g === S.gruppe) return;                                  // innerhalb der Gefahr: alles bleibt
    S.gruppe = g;
    if (S.karte && S.karteGruppe !== g) schliessen();            // der offene Tipp gehoerte zur vorigen Gefahr
    const weg = [...S.vonTipp.entries()].filter(([id, gr]) => gr !== g && ebeneAn(id)).map(([id]) => id);
    if (!weg.length) return;
    for (const id of weg) { S.vonTipp.delete(id); WK.layers.setzen(id, false); }
    if (WK.ui) WK.ui.melden(`${weg.length === 1 ? 'Ebene' : 'Ebenen'} der vorigen Gefahr ausgeblendet: ${weg.map(id => (ebene(id) || {}).label || id).join(', ')}`, 4500);
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
    zeigen(gid, t, aktionen);
  }
  function schliessen() { if (S.karte && S.karte.parentNode) S.karte.parentNode.removeChild(S.karte); S.karte = null; S.karteGruppe = null; }
  function zeigen(gid, t, aktionen) {
    schliessen();
    const knoepfe = U.el('div', { class: 'tipp-aktionen' });
    for (const a of aktionen) {
      const b = U.el('button', { class: ebeneAn(a.ebene) ? 'aktiv' : '', title: 'Ebene ein- oder ausblenden; sie steht auch links unter „Ebenen"' }, (ebeneAn(a.ebene) ? '✓ ' : '') + a.label);
      b.addEventListener('click', async () => {
        const an = !ebeneAn(a.ebene);
        if (!an) S.vonTipp.delete(a.ebene);
        await WK.layers.setzen(a.ebene, an);
        if (an && ebeneAn(a.ebene)) S.vonTipp.set(a.ebene, gid);                 // Herkunft merken: gehoert zu dieser Gefahr
        b.classList.toggle('aktiv', ebeneAn(a.ebene)); b.textContent = (ebeneAn(a.ebene) ? '✓ ' : '') + a.label;
        const abs = document.getElementById('abs-ebenen'); if (an && abs) abs.open = true;      // zeigen, wo die Ebene zu finden ist
      });
      knoepfe.appendChild(b);
    }
    const aus = U.el('input', { type: 'checkbox' });
    aus.addEventListener('change', () => U.ls(AUS, aus.checked ? 1 : null));
    S.karteGruppe = gid;
    S.karte = U.el('div', { class: 'tipp-karte', role: 'status' },
      U.el('div', { class: 'tipp-kopf' }, U.el('strong', {}, t.titel), U.el('button', { class: 'tipp-zu', title: 'Tipp schließen', onclick: schliessen }, '✕')),
      U.el('p', {}, t.text), knoepfe,
      U.el('p', { class: 'klein', style: { margin: '8px 0 0' } }, 'Hier eingeblendete Ebenen bleiben, solange du bei dieser Gefahr bleibst, und verschwinden beim Wechsel zu einer anderen. Dauerhaft schaltest du Ebenen links unter „Ebenen".'),
      U.el('div', { class: 'tipp-fuss' }, U.el('label', {}, aus, ' keine Tipps mehr zeigen'), U.el('button', { onclick: schliessen }, 'Verstanden')));
    (document.getElementById('mitte') || document.body).appendChild(S.karte);
  }
  function zuruecksetzen() { U.ls(GESEHEN, []); U.ls(AUS, null); if (WK.ui) WK.ui.melden('Tipps erscheinen wieder beim ersten Anklicken einer Gruppe'); }
  return { init, fuerGruppe, fuerPreset, fuerVariable, schliessen, zuruecksetzen, get offen() { return !!S.karte; }, get vonTipp() { return new Map(S.vonTipp); }, get gruppe() { return S.gruppe; } };
})();
