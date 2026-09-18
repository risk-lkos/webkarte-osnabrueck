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
  // Amtliche Gefahrenkarten als WMS-Ebenen. Die Bilder kommen direkt von den Diensten (beide mit CORS-Freigabe,
  // daher auch im PNG-Export); ohne Internet bleiben die Ebenen leer. abfrage = Gruppe der Punktabfrage bei Klick.
  wms: {
    dienste: {
      bkg: { url: 'https://sgx.geodatenzentrum.de/wms_starkregen', format: 'image/png', info: 'application/json',
             attribution: 'Hinweiskarte Starkregengefahren © BKG (2026) dl-de/by-2-0' },
      nlwkn: { url: 'https://www.umweltkarten-niedersachsen.de/arcgis/services/HWSchutz_wms/MapServer/WMSServer', format: 'image/png32', info: 'application/geo+json',
               attribution: 'Hochwassergefahrenkarten (HWRM-RL) © NLWKN' },
    },
    ebenen: [
      { id: 'wms_sr_tiefe_ext', dienst: 'bkg', layers: ['ni_tiefe_extrem'], label: 'Starkregen extrem (100 mm/h): Überflutungstiefe', abfrage: 'sr_extrem' },
      { id: 'wms_sr_geschw_ext', dienst: 'bkg', layers: ['ni_geschw_extrem'], label: 'Starkregen extrem (100 mm/h): Fließgeschwindigkeit', abfrage: 'sr_extrem' },
      { id: 'wms_sr_richtung_ext', dienst: 'bkg', layers: ['ni_fr_extrem'], label: 'Starkregen extrem: Fließrichtung (ab Zoom 16)', minzoom: 15.5, deckkraft: 1 },
      { id: 'wms_sr_tiefe_agw', dienst: 'bkg', layers: ['ni_tiefe_agw'], label: 'Starkregen außergewöhnlich (100-jährlich): Überflutungstiefe', abfrage: 'sr_agw' },
      { id: 'wms_sr_geschw_agw', dienst: 'bkg', layers: ['ni_geschw_agw'], label: 'Starkregen außergewöhnlich (100-jährlich): Fließgeschwindigkeit', abfrage: 'sr_agw' },
      { id: 'wms_hw_extrem', dienst: 'nlwkn', layers: ['Wassertiefen_Binnenland_HQextrem23372'], label: 'Flusshochwasser HQextrem: Wassertiefe', abfrage: 'hw' },
      { id: 'wms_hw_100', dienst: 'nlwkn', layers: ['Wassertiefen_Binnenland_HQ10035990'], label: 'Flusshochwasser HQ100: Wassertiefe', abfrage: 'hw' },
      { id: 'wms_hw_haeufig', dienst: 'nlwkn', layers: ['Wassertiefen_Binnenland_HQhäufig26814'], label: 'Flusshochwasser HQhäufig: Wassertiefe', abfrage: 'hw' },
      { id: 'wms_uesg', dienst: 'nlwkn', layers: ['Überschwemmungsgebiete_Verordnungsfläechen_Niedersachsen11182', 'vorläufig_gesicherte_Überschwemmungsgebiete_Niedersachsen45895'], label: 'Überschwemmungsgebiete (festgesetzt und vorläufig gesichert)', deckkraft: 0.6 },
    ],
    // Punktabfrage (GetFeatureInfo): je Gruppe eine Anfrage; BKG liefert Tiefe in cm und Geschwindigkeit in m/s,
    // NLWKN Klassencodes (1-5 bzw. 11-15 = Tiefenklassen, 21-25 = dieselben Klassen hinter Schutzanlagen).
    abfragen: {
      sr_extrem: { dienst: 'bkg', titel: 'Starkregen extrem (100 mm in 1 h)', layers: ['ni_tiefe_extrem', 'ni_geschw_extrem'] },
      sr_agw: { dienst: 'bkg', titel: 'Starkregen außergewöhnlich (100-jährlich)', layers: ['ni_tiefe_agw', 'ni_geschw_agw'] },
      hw: { dienst: 'nlwkn', titel: 'Flusshochwasser (Wassertiefe)', namen: ['HQextrem', 'HQ100', 'HQhäufig'], layers: ['Wassertiefen_Binnenland_HQextrem23372', 'Wassertiefen_Binnenland_HQ10035990', 'Wassertiefen_Binnenland_HQhäufig26814'] },
    },
    tiefenklassen: ['0 bis 0,5 m', 'über 0,5 bis 1 m', 'über 1 bis 2 m', 'über 2 bis 4 m', 'über 4 m'],
  },
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
