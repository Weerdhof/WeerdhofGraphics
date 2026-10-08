// Settings: default names, texts and logo overrides, stored on the server (/api/settings, /api/logo).
// The editors (hnl.js, thumbs.js) read their defaults from here; the settings page (SETUI) edits them.
(() => {
  'use strict';

  // ---------- Built-in defaults (what the settings page can override) ----------
  const DEF = {
    men: [['BEV', 'Bevo HC'], ['BWH', 'Hercules'], ['DFS', 'DFS Arnhem'], ['EUP', 'KTSV Eupen'], ['HCS', 'Sprimont'], ['HCV', 'Visé BM'], ['HUB', 'HUBO'], ['HUP', 'Hurry-Up'], ['HVA', 'Aalsmeer'], ['IZE', 'Izegem'], ['PEL', 'Pelt'], ['SAB', 'Bocholt'], ['TAC', 'Tachos'], ['VOL', 'Volendam']],
    menExportCode: { HCS: 'SPR' },
    women: [['DSVD', 'DSVD'], ['E&O', 'Oosting/E&O'], ['FOR', 'HV Foreholte'], ['KWI', 'Zwartwoud/Kwiek'], ['MHV', "M.H.V. '81"], ['PSV', 'Hypotheekvisie/PSV'], ['QUI', 'Drive in Units/Quintus'], ['SEW', 'Westfriesland/SEW'], ['V&L', 'Geonius/V&L'], ['VEN', 'Cabooter/Fortes Venlo'], ['VOC', 'Ruitenheer/VOC'], ['VOL', 'Garage Kil/Volendam'], ['VZV', 'Juro Unirek/VZV'], ['WPK', 'Westlandia']],
    womenExportCode: { 'E&O': 'ENO', FOR: 'FORE', VEN: 'FORV', 'V&L': 'VEL' },
    womenJpg: { DSVD: 'dsvd', 'E&O': 'e-o', FOR: 'foreholte', KWI: 'kwiek-r', MHV: 'mhv', PSV: 'psv-handbal', QUI: 'quintus', SEW: 'sew', 'V&L': 'vlug-en-lenig', VEN: 'fortes-venlo', VOC: 'voc', VOL: 'volendam', VZV: 'vzv', WPK: 'westlandia' },
    hnlCode: { artemis: 'ART', bfc: 'BFC', bevo: 'BEV', 'dfs-arnhem': 'DFS', dsvd: 'DSVD', dws: 'DWS', dalfsen: 'DAL', dynamico: 'DYN', 'e-o': 'OEO', foreholte: 'FORE', 'fortes-venlo': 'VEN', fortissimo: 'FTS', 'handbal-aalsmeer': 'HVA', hellas: 'HEL', hercules: 'BWH', houten: 'HOU', 'hurry-up': 'HUP', 'kwiek-r': 'KWI', mhv: 'MHV', 'psv-handbal': 'PSV', quintus: 'QUI', 'rotterdam-handbal': 'ROT', sew: 'SEW', tachos: 'TAC', us: 'USH', unitas: 'UNI', velo: 'VEL', voc: 'VOC', vvw: 'VVW', vzv: 'VZV', 'vlug-en-lenig': 'VEL', volendam: 'VOL', westlandia: 'WPK', zap: 'ZAP', zvbb21: 'ZVB' },
    texts: [
      ['th.title', 'Thumbnails SHL/SHLW — titel onderin', 'Livestream'],
      ['th.label', 'Thumbnails SHL — label in de highlights-balk', 'Regular season'],
      ['hnl.label.nextmen', 'HandbalNL Next heren — competitietekst', 'Next Handball League Men'],
      ['hnl.label.nextwomen', 'HandbalNL Next dames — competitietekst', 'Next Handball League Women'],
      ['hnl.announce.l1', 'HandbalNL aankondiging — kop regel 1', 'MIS NIETS VAN DE'],
      ['hnl.announce.l2', 'HandbalNL aankondiging — kop regel 2', 'NEXT HANDBALL LEAGUE'],
      ['hnl.announce.b1', 'HandbalNL aankondiging — balk woord 1', 'LIVE'],
      ['hnl.announce.b2', 'HandbalNL aankondiging — balk tussentekst', 'TE ZIEN VIA'],
      ['hnl.announce.b3', 'HandbalNL aankondiging — balk slot', 'HANDBALNL.TV'],
    ],
  };

  // ---------- Store ----------
  let data = { clubs: {}, texts: {} };
  const listeners = new Set();
  const ready = fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(d => { data = { clubs: (d && d.clubs) || {}, texts: (d && d.texts) || {} }; }).catch(() => {});
  let saveTimer = 0, state = 'idle';
  const emit = (what) => listeners.forEach(fn => { try { fn(what); } catch (e) { /* ignore */ } });
  const club = (key) => data.clubs[key] || {};
  const ensure = (key) => (data.clubs[key] || (data.clubs[key] = {}));
  const clean = (key) => { const c = data.clubs[key]; if (c && !Object.keys(c).length) delete data.clubs[key]; };

  function setState(s) { state = s; emit('state'); }
  function scheduleSave() {
    setState('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }
  function save() {
    clearTimeout(saveTimer); saveTimer = 0; setState('saving');
    return fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); setState('saved'); })
      .catch(() => setState('error'));
  }

  const api = {
    DEF, ready,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get state() { return state; },
    get data() { return data; },
    label: (key, def) => club(key).label || def,
    name: (key, def) => club(key).name || def,
    code: (key, def) => club(key).code || def,
    hasLogo: (key) => !!club(key).logo,
    // the logo override (cache-busted by its upload time) or the built-in file
    logo: (key, fallback) => (club(key).logo ? `/api/logo?id=${encodeURIComponent(key)}&v=${club(key).logo}` : fallback),
    text: (key, def) => (data.texts[key] != null && data.texts[key] !== '' ? data.texts[key] : def),
    setClub(key, field, value) {
      const c = ensure(key);
      if (value === '' || value == null) delete c[field]; else c[field] = value;
      clean(key); scheduleSave(); emit('change');
    },
    setText(key, value) {
      if (value === '' || value == null) delete data.texts[key]; else data.texts[key] = value;
      scheduleSave(); emit('change');
    },
    resetClub(key) { delete data.clubs[key]; fetch('/api/logo?id=' + encodeURIComponent(key), { method: 'DELETE' }).catch(() => {}); scheduleSave(); emit('change'); },
    // any image -> centred on a white square, 800px JPEG (like the built-in club logos)
    uploadLogo(key, file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
          const im = new Image();
          im.onload = () => {
            const c = document.createElement('canvas'); c.width = c.height = 800;
            const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 800);
            const s = Math.min(720 / im.naturalWidth, 720 / im.naturalHeight);
            x.drawImage(im, (800 - im.naturalWidth * s) / 2, (800 - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
            c.toBlob((blob) => {
              fetch('/api/logo?id=' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); ensure(key).logo = Date.now(); scheduleSave(); emit('change'); resolve(); })
                .catch(reject);
            }, 'image/jpeg', 0.92);
          };
          im.onerror = reject; im.src = fr.result;
        };
        fr.onerror = reject; fr.readAsDataURL(file);
      });
    },
    removeLogo(key) {
      return fetch('/api/logo?id=' + encodeURIComponent(key), { method: 'DELETE' }).then(() => { const c = club(key); delete c.logo; clean(key); scheduleSave(); emit('change'); });
    },
    save,
  };
  window.SETTINGS = api;
})();
