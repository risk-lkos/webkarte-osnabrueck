/* Web-Karte Straßennetz Landkreis Osnabrück – Konfiguration (Namensraum WK) */
window.WK = window.WK || {};

WK.config = {
  version: '0.1',
  pfade: {
    meta: './data/meta.json',
    kanten: './data/kanten.json',
    paletten: './data/paletten.json',
    glossar: './data/glossar.json',
    schemata: './data/farbschemata/',
    kontext: './data/kontext/',
    raster: './data/raster/',
    glyphs: './vendor/glyphs/{fontstack}/{range}.pbf',
  },
  attribute: ['attr_importance.json', 'attr_pluvial.json', 'attr_fluvial.json', 'attr_heat.json',
              'attr_compound.json', 'attr_profil.json'],
  karte: {
    minZoom: 6,
    maxZoom: 19,
    labelsAbZoom: 13,
    startPreset: 'heat_index',
    startBasemap: 'topplus_grau',
    detailZoom: 16.5,
    detailUmkreisKm: 1.5,
  },
  // Zoomfaktoren fuer Linienbreiten (Basisbreite aus dem Farbschema mal Faktor)
  breitenZoom: [[7, 0.5], [11, 1.0], [14, 2.2], [17, 5.0]],
  qualitativ: ['#1f78b4', '#e31a1c', '#33a02c', '#ff7f00', '#6a3d9a', '#b15928', '#a6cee3', '#fb9a99',
               '#b2df8a', '#fdbf6f', '#cab2d6', '#ffff99', '#1b9e77', '#d95f02', '#7570b3', '#e7298a',
               '#66a61e', '#e6ab02', '#a6761d', '#666666', '#8dd3c7', '#bebada', '#fb8072', '#80b1d3',
               '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f', '#4daf4a',
               '#984ea3', '#999999'],
  speicher: { schema: 'wk.schema', ansicht: 'wk.ansicht', lesezeichen: 'wk.lesezeichen', theme: 'wk.theme', favoriten: 'wk.favoriten' },
  // Hauptindex je Gruppe fuer die "Top 25"-Auswahl (wie die Top-25-Listen der Arbeit)
  topVariable: { importance: 'imp_pct100', pluvial: 'vi_pct', fluvial: 'vi_pct_fluvial', heat: 'vi_pct_heat', compound: 'vi_pct_compound' },
  // Meldefunktion: Issues im GitHub-Repository (kein Token in der Seite; die meldende Person schickt auf GitHub ab).
  // seite = oeffentliche Adresse fuer den Link im Ticket; email = optionaler Rueckweg ohne GitHub-Konto (leer = aus)
  report: { repo: 'risk-lkos/webkarte-osnabrueck', seite: 'https://risk-lkos.github.io/webkarte-osnabrueck/', email: '' },
  // Baulastebenen fuer "Top 25 je Ebene" (Klassen aus AP7_baulast, Attribut baulast). Rangregel wie im
  // AP7-Vermerk: globaler Index, je Ebene die hoechsten Werte.
  baulastEbenen: [
    { id: 'autobahn', kurz: 'A', label: 'Autobahn', plural: 'Autobahnen' },
    { id: 'bundesstrasse', kurz: 'B', label: 'Bundesstraße', plural: 'Bundesstraßen' },
    { id: 'landesstrasse', kurz: 'L', label: 'Landesstraße', plural: 'Landesstraßen' },
    { id: 'kreisstrasse', kurz: 'K', label: 'Kreisstraße', plural: 'Kreisstraßen' },
    { id: 'gemeindestrasse', kurz: 'Gem.', label: 'Gemeindestraße', plural: 'Gemeindestraßen' },
  ],
};
