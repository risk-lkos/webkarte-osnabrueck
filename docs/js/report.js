/* Melden: Fehler, Datenauffaelligkeiten, Wuensche und Feedback als vorausgefuelltes GitHub-Issue.
   Die Seite ist statisch und enthaelt bewusst kein Zugangstoken: sie oeffnet das Issue-Formular des Repositories
   mit Titel, Beschreibung und Kartenzustand; abgeschickt wird dort mit dem GitHub-Konto der meldenden Person.
   Ohne Konto: Text kopieren (oder E-Mail, falls WK.config.report.email gesetzt ist). */
WK.report = (() => {
  const U = WK.util;
  const S = { art: 'fehler', titel: '', text: '', mitKontext: true, kante: null };
  const ARTEN = [
    { id: 'fehler', label: 'Fehler in der Karte', vorlage: 'fehler.yml', labels: ['bug'], praefix: 'Fehler', hilfe: 'Was ist passiert, was hättest du erwartet? Schritte zum Nachstellen helfen.' },
    { id: 'daten', label: 'Auffälligkeit in den Daten', vorlage: 'daten.yml', labels: ['bug'], praefix: 'Daten', hilfe: 'Welche Kante oder welcher Wert wirkt falsch, und warum? Am besten vorher die Kante anklicken.' },
    { id: 'wunsch', label: 'Verbesserung oder Wunsch', vorlage: 'wunsch.yml', labels: ['enhancement'], praefix: 'Wunsch', hilfe: 'Was fehlt oder ginge besser, und wofür würdest du es nutzen?' },
    { id: 'feedback', label: 'Anmerkung, Frage, Feedback', vorlage: 'feedback.yml', labels: ['question'], praefix: 'Feedback', hilfe: 'Alles andere: Verständnisfragen, Lob, Kritik, Hinweise zur Darstellung.' },
  ];
  const MAX_TEXT = 5000;   // Laengengrenze fuer den Text in der URL (GitHub nimmt rund 8.000 Zeichen an)

  function cfg() { return WK.config.report || {}; }
  function kontext() {
    const K = WK.karte, m = K.meta || {}, z = [];
    const hash = WK.url ? WK.url.bauen({ mitStil: false, kante: S.kante !== null ? S.kante : undefined }) : '';
    const basis = cfg().seite || (location.origin + location.pathname);
    z.push(`- Link: ${basis}${hash ? '#' + hash : ''}`);
    z.push(`- Karte: ${K.preset && K.preset.id ? 'Preset „' + (K.preset.titel || K.preset.id) + '"' : 'kein Preset'}${K.variable ? ` · Variable ${m.label || K.variable} (${K.variable}) · Skala ${K.modus}` : ' · keine Kantenvariable'}`);
    const kid = S.kante !== null ? S.kante : K.auswahl;
    if (kid !== null && kid !== undefined && WK.daten.feature(kid)) {
      const p = WK.daten.feature(kid).properties, w = K.variable ? p[K.variable] : undefined;
      z.push(`- Kante: ${kid} · ${[p.ref, p.name].filter(Boolean).join(' · ') || 'ohne Namen'} · ${p.highway || ''}${p.baulast ? ' · ' + p.baulast : ''}${p.gemeinde ? ' · ' + p.gemeinde : ''}${w !== undefined ? ` · ${K.variable} = ${w}` : ''}`);
    } else z.push('- Kante: keine gewählt');
    if (WK.filter && WK.filter.aktiv()) z.push(`- Filter: ${JSON.stringify(WK.filter.zustand())}`);
    if (WK.stil) z.push(`- Farbschema: ${WK.stil.schemaId}${WK.stil.geaendert ? ' (geändert)' : ''} · Linienstärke × ${WK.stil.breitenFaktor}`);
    const b = (WK.daten.meta || {}).build || {};
    z.push(`- Datenstand: ${b.zeitpunkt || 'unbekannt'}${window.WK_INLINE ? ' · Offline-Datei' : ''}`);
    z.push(`- Browser: ${navigator.userAgent} · Fenster ${window.innerWidth}×${window.innerHeight}`);
    return z.join('\n');
  }
  function art() { return ARTEN.find(a => a.id === S.art) || ARTEN[0]; }
  function titel() { const t = S.titel.trim() || S.text.trim().split(/\r?\n/)[0].slice(0, 70); return `[${art().praefix}] ${t}`; }
  function textGekuerzt() { const t = S.text.trim(); return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '\n\n(gekürzt: bitte den restlichen Text hier einfügen)' : t; }
  function alsText() { return `${titel()}\n\n${S.text.trim()}${S.mitKontext ? '\n\nKartenzustand:\n' + kontext() : ''}`; }
  function githubUrl() {
    const a = art(), p = new URLSearchParams();
    p.set('template', a.vorlage); p.set('title', titel()); p.set('labels', a.labels.join(','));
    p.set('beschreibung', textGekuerzt());
    if (S.mitKontext) p.set('kontext', kontext());
    return `https://github.com/${cfg().repo}/issues/new?${p.toString()}`;
  }

  function oeffnen(opts) {
    opts = opts || {};
    S.kante = opts.kante !== undefined && opts.kante !== null ? opts.kante : (WK.karte.auswahl !== undefined ? WK.karte.auswahl : null);
    if (opts.art) S.art = opts.art; else if (opts.kante !== undefined && opts.kante !== null) S.art = 'daten';
    const box = U.el('div', { class: 'report' });
    const repo = cfg().repo;
    box.appendChild(U.el('p', { class: 'hinweis', style: { marginTop: 0 } }, 'Meldungen landen als Ticket (Issue) im GitHub-Repository der Karte und werden dort abgearbeitet. Die Karte füllt das Formular vor; abgeschickt wird auf GitHub mit deinem GitHub-Konto. Ohne Konto: Text kopieren und auf anderem Weg schicken.'));
    // Art
    box.appendChild(U.el('label', {}, 'Worum geht es?'));
    const arten = U.el('div', { class: 'arten' }), hilfe = U.el('div', { class: 'klein', style: { marginTop: '4px' } });
    const artNeu = () => { for (const b of arten.children) b.classList.toggle('aktiv', b.dataset.art === S.art); hilfe.textContent = art().hilfe; };
    for (const a of ARTEN) arten.appendChild(U.el('button', { 'data-art': a.id, onclick: () => { S.art = a.id; artNeu(); vorschauNeu(); } }, a.label));
    box.appendChild(arten); box.appendChild(hilfe);
    // Titel + Text
    const tInp = U.el('input', { type: 'text', maxlength: 120, placeholder: 'Kurzer Titel (optional, sonst wird die erste Zeile genommen)', value: S.titel });
    const txt = U.el('textarea', { placeholder: 'Beschreibung …' }); txt.value = S.text;
    tInp.addEventListener('input', () => { S.titel = tInp.value; });
    txt.addEventListener('input', () => { S.text = txt.value; zaehler.textContent = S.text.length > MAX_TEXT ? `${S.text.length} Zeichen: für den GitHub-Link wird nach ${MAX_TEXT} gekürzt, „Text kopieren" nimmt alles` : ''; });
    const zaehler = U.el('div', { class: 'klein' }, '');
    box.appendChild(U.el('label', {}, 'Titel')); box.appendChild(tInp);
    box.appendChild(U.el('label', {}, 'Beschreibung')); box.appendChild(txt); box.appendChild(zaehler);
    // Kontext
    const kCb = U.el('input', { type: 'checkbox', checked: S.mitKontext });
    const vorschau = U.el('div', { class: 'kontext' });
    const vorschauNeu = () => { vorschau.hidden = !S.mitKontext; vorschau.textContent = kontext(); };
    kCb.addEventListener('change', () => { S.mitKontext = kCb.checked; vorschauNeu(); });
    box.appendChild(U.el('div', { class: 'zeile', style: { marginTop: '10px' } }, U.el('label', { title: 'Hilft beim Nachstellen. Angehängt wird genau der Text im Kasten darunter, nichts sonst.' }, kCb, ' Kartenzustand anhängen (Link zur Ansicht, Variable, gewählte Kante, Datenstand, Browser)')));
    box.appendChild(vorschau);
    // Aktionen
    const senden = U.el('button', { class: 'aktiv', title: repo ? `Öffnet github.com/${repo} in einem neuen Tab` : 'Kein Repository konfiguriert', disabled: !repo, onclick: () => {
      if (!S.text.trim()) { WK.ui.melden('Bitte eine kurze Beschreibung eintragen'); txt.focus(); return; }
      window.open(githubUrl(), '_blank', 'noopener');
      WK.ui.melden('GitHub öffnet sich in einem neuen Tab: dort prüfen und „Create" bzw. „Submit new issue" klicken', 6000);
    } }, 'Auf GitHub melden');
    const kopieren = U.el('button', { onclick: async () => { if (!S.text.trim()) { WK.ui.melden('Bitte eine kurze Beschreibung eintragen'); txt.focus(); return; } const ok = await U.kopieren(alsText()); WK.ui.melden(ok ? 'Meldung als Text kopiert' : 'Kopieren fehlgeschlagen'); } }, 'Text kopieren');
    const zeile = U.el('div', { class: 'zeile', style: { marginTop: '12px' } }, senden, kopieren);
    if (cfg().email) zeile.appendChild(U.el('button', { onclick: () => { if (!S.text.trim()) { WK.ui.melden('Bitte eine kurze Beschreibung eintragen'); return; } location.href = `mailto:${cfg().email}?subject=${encodeURIComponent(titel())}&body=${encodeURIComponent(alsText().slice(0, 1800))}`; } }, 'Per E-Mail'));
    zeile.appendChild(U.el('button', { onclick: () => { S.titel = ''; S.text = ''; tInp.value = ''; txt.value = ''; zaehler.textContent = ''; } }, 'Leeren'));
    box.appendChild(zeile);
    if (repo) box.appendChild(U.el('p', { class: 'klein' }, 'Offene und erledigte Meldungen: ', U.el('a', { href: `https://github.com/${repo}/issues`, target: '_blank', rel: 'noopener' }, `github.com/${repo}/issues`)));
    artNeu(); vorschauNeu();
    WK.ui.dialog('Fehler, Auffälligkeit oder Feedback melden', box);
    setTimeout(() => txt.focus(), 50);
  }
  return { oeffnen, githubUrl, kontext, alsText, ARTEN, get zustand() { return S; } };
})();
