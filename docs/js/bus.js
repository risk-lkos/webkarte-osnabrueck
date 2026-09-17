/* Ereignisbus: auswahl, hover, variable, skala, stil, filter, basemap, ansicht, pins */
WK.bus = (() => {
  const handler = {};
  return {
    on(ereignis, fn) {
      (handler[ereignis] = handler[ereignis] || []).push(fn);
      return () => { handler[ereignis] = handler[ereignis].filter(f => f !== fn); };
    },
    emit(ereignis, ...args) {
      (handler[ereignis] || []).slice().forEach(fn => {
        try { fn(...args); } catch (e) { console.error('bus', ereignis, e); }
      });
    },
  };
})();
