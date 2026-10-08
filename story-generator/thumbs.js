// Thumbnails (1920x1080): SHL, SHLW, Next heren, Next dames. The templates come from the PSDs
// (assets/th/<scene>/scene.json + PNGs); dates, times, names and logos are drawn on top.
(() => {
  'use strict';
  const W = 1920, H = 1080;
  const SCENES = { shl: 'assets/th/shl', shlw: 'assets/th/shlw', nextmen: 'assets/th/nextmen', nextwomen: 'assets/th/nextdames' };
  const KINDS = {
    shl:       { title: 'SHL',        sub: 'Super Handball League', comp: 'men' },
    shlw:      { title: 'SHLW',       sub: 'Super Handball League Women', comp: 'women' },
    nextmen:   { title: 'Next heren', sub: 'HandbalNL', next: true, men: true },
    nextwomen: { title: 'Next dames', sub: 'HandbalNL', next: true, men: false },
  };
  const NAMES = { shl: 'SHL', shlw: 'SHLW', nextmen: 'Next heren', nextwomen: 'Next dames' };

  // ---------- Fonts (Clash is registered by script.js; the HandbalNL ones are loaded here) ----------
  const FONT_FILES = [
    ['TuskerGrotesk4', 'fonts/hnl/TuskerGrotesk-4700Bold.otf', '700'],
    ['MeticulaR', 'fonts/hnl/Meticula-Regular.ttf', '400'],
    ['MeticulaXB', 'fonts/hnl/Meticula-ExtraBold.ttf', '800'],
  ];
  const fontsReady = Promise.all(FONT_FILES.map(([fam, url, w]) => new FontFace(fam, `url(${url})`, { weight: w }).load().then(f => document.fonts.add(f)).catch(() => {})))
    .then(() => Promise.all([document.fonts.load('700 40px ClashDisplay'), document.fonts.load('600 40px ClashDisplay')]).catch(() => {}));

  // ---------- SHL / SHLW club data (same codes and aliases as the editor) ----------
  const MEN = {
    dir: 'assets/teams', exportCode: { HCS: 'SPR' },
    clubs: [['BEV', 'Bevo HC'], ['BWH', 'Hercules'], ['DFS', 'DFS Arnhem'], ['EUP', 'KTSV Eupen'], ['HCS', 'Sprimont'], ['HCV', 'Visé BM'], ['HUB', 'HUBO'], ['HUP', 'Hurry-Up'], ['HVA', 'Aalsmeer'], ['IZE', 'Izegem'], ['PEL', 'Pelt'], ['SAB', 'Bocholt'], ['TAC', 'Tachos'], ['VOL', 'Volendam']],
    aliases: { SAB: ['bocholt'], IZE: ['izegem'], EUP: ['eupen'], HCS: ['sprimont'], BEV: ['bevo'], PEL: ['pelt'], BWH: ['hercules', 'whc'], DFS: ['arnhem'], HUP: ['hurry'], HCV: ['vise', 'visé'], HVA: ['aalsmeer', 'royalfloraholland'], HUB: ['hubo'], VOL: ['volendam'], TAC: ['tachos', 'mossel', 'witte ster'] },
    dateLocale: 'en', datePattern: (wd, d, m) => `${wd} ${d} ${m}`,
  };
  const WOMEN = {
    dir: 'assets/women/teams', exportCode: { 'E&O': 'ENO', FOR: 'FORE', VEN: 'FORV', 'V&L': 'VEL' },
    clubs: [['DSVD', 'DSVD'], ['E&O', 'Oosting/E&O'], ['FOR', 'HV Foreholte'], ['KWI', 'Zwartwoud/Kwiek'], ['MHV', "M.H.V. '81"], ['PSV', 'Hypotheekvisie/PSV'], ['QUI', 'Drive in Units/Quintus'], ['SEW', 'Westfriesland/SEW'], ['V&L', 'Geonius/V&L'], ['VEN', 'Cabooter/Fortes Venlo'], ['VOC', 'Ruitenheer/VOC'], ['VOL', 'Garage Kil/Volendam'], ['VZV', 'Juro Unirek/VZV'], ['WPK', 'Westlandia']],
    aliases: { DSVD: ['dsvd', 'aqqo'], 'E&O': ['misker', 'oosting'], FOR: ['foreholte'], KWI: ['kwiek'], MHV: ['m.h.v'], PSV: ['hypotheekvisie', 'eindhoven'], QUI: ['quintus'], SEW: ['westfriesland'], 'V&L': ['geonius'], VEN: ['venlo', 'cabooter'], VOC: ['ruitenheer'], VOL: ['volendam'], VZV: ['juro'], WPK: ['westlandia'] },
    dateLocale: 'nl', datePattern: (wd, d, m) => `${wd} ${d} ${m}`,
  };
  const DAYS = { en: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], nl: ['ZONDAG', 'MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'] };
  const MONTHS = { en: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'], nl: ['JANUARI', 'FEBRUARI', 'MAART', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AUGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DECEMBER'] };
  const MONTHS_NL_LOWER = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const DAYS_NL_LOWER = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const codeOf = (cfg, name) => { const n = norm(name); return Object.keys(cfg.aliases).find(c => cfg.aliases[c].some(a => n.includes(a))) || null; };
  const labelOf = (cfg, code) => (cfg.clubs.find(c => c[0] === code) || [0, code])[1];
  function seasonDate(day, month) {
    const now = new Date(), start = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(month >= 8 ? start : start + 1, month - 1, day);
  }
  const fmtDate = (cfg, day, month) => { const d = seasonDate(day, month), l = cfg.dateLocale; return `${DAYS[l][d.getDay()]} ${day} ${MONTHS[l][month - 1]}`; };

  // ---------- Next (HandbalNL) club data ----------
  let nextClubs = [], nextById = {};
  const nextReady = fetch('assets/hnl/clubs.json').then(r => r.json()).then(l => { nextClubs = l; l.forEach(c => { nextById[c.id] = c; }); }).catch(() => {});
  const WOMEN_JPG = { DSVD: 'dsvd', 'E&O': 'e-o', FOR: 'foreholte', KWI: 'kwiek-r', MHV: 'mhv', PSV: 'psv-handbal', QUI: 'quintus', SEW: 'sew', 'V&L': 'vlug-en-lenig', VEN: 'fortes-venlo', VOC: 'voc', VOL: 'volendam', VZV: 'vzv', WPK: 'westlandia' };
  const NEXT_CODE = { artemis: 'ART', bfc: 'BFC', bevo: 'BEV', 'dfs-arnhem': 'DFS', dsvd: 'DSVD', dws: 'DWS', dalfsen: 'DAL', dynamico: 'DYN', 'e-o': 'OEO', foreholte: 'FORE', 'fortes-venlo': 'VEN', fortissimo: 'FTS', 'handbal-aalsmeer': 'HVA', hellas: 'HEL', hercules: 'BWH', houten: 'HOU', 'hurry-up': 'HUP', 'kwiek-r': 'KWI', mhv: 'MHV', 'psv-handbal': 'PSV', quintus: 'QUI', 'rotterdam-handbal': 'ROT', sew: 'SEW', tachos: 'TAC', us: 'USH', unitas: 'UNI', velo: 'VEL', voc: 'VOC', vvw: 'VVW', vzv: 'VZV', 'vlug-en-lenig': 'VEL', volendam: 'VOL', westlandia: 'WPK', zap: 'ZAP', zvbb21: 'ZVB' };

  // ---------- Images ----------
  const imgs = new Map();
  const loadImg = (src) => (imgs.has(src) ? imgs.get(src) : (imgs.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })), imgs.get(src)));
  const scenes = {};
  const loadScene = (key) => scenes[key] || (scenes[key] = fetch(SCENES[key] + '/scene.json').then(r => r.json()));

  // ---------- Drawing helpers ----------
  function text(ctx, str, x, baseline, font, color, opt = {}) {
    ctx.save();
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    let tx = x;
    ctx.textAlign = 'left';
    if (opt.center != null) { const m = ctx.measureText(str); tx = opt.center - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 + m.actualBoundingBoxLeft; }
    else if (opt.inkLeft != null) { const m = ctx.measureText(str); tx = opt.inkLeft + m.actualBoundingBoxLeft; }
    if (opt.maxWidth) { const w = ctx.measureText(str).width; if (w > opt.maxWidth) { ctx.translate(tx, baseline); ctx.scale(opt.maxWidth / w, 1); ctx.translate(-tx, -baseline); } }
    ctx.fillText(str, tx, baseline);
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // crest of a team strip (the logo box at the left end of the 1200x200 strip)
  async function crest(ctx, cfg, code, x, y, w, h) {
    const im = await loadImg(`${cfg.dir}/${code}.png`);
    if (!im) return;
    ctx.drawImage(im, 0, 19, 158, 159, x, y, w, h);
  }

  // the photo behind the template (the template's gradient mask fades it in from the right)
  // Photo placement: starts "cover", the user can drag it freely. Vertically it must keep covering the canvas;
  // horizontally it may slide as long as it still covers the right-hand 65% (the template fades the left side out).
  function photoRect(img, pos) {
    const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight), s = cover * pos.z;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const left = Math.min(0.35 * W, Math.max(W - dw, (W - dw) / 2 + pos.x));
    const top = Math.min(0, Math.max(H - dh, (H - dh) / 2 + pos.y));
    return { left, top, dw, dh, x: left - (W - dw) / 2, y: top - (H - dh) / 2 };
  }
  function drawPhoto(ctx, img, pos) {
    const r = photoRect(img, pos);
    ctx.drawImage(img, r.left, r.top, r.dw, r.dh);
  }

  // ---------- Per-kind rendering ----------
  async function renderThumb(kind, d, ctx, photo) {
    await fontsReady; await nextReady;
    const scene = await loadScene(kind);
    ctx.clearRect(0, 0, W, H);
    ThumbScene.base = SCENES[kind];
    const K = KINDS[kind];
    const dyn = {};
    let groups;
    if (K.comp) dyn.BGphoto = async (c) => { if (photo && d.hasPhoto) drawPhoto(c, photo, d.photoPos || { z: 1, x: 0, y: 0 }); };
    if (kind === 'shl') {
      const cfg = MEN;
      const hl = d.variant === 'highlights';
      groups = { 'OVERLAY-samenvatting': hl };
      dyn.DATUM = async (c) => { if (!hl) text(c, (d.date || '').toUpperCase(), 0, 370, '700 40.32px "ClashDisplay"', '#000', { center: 410 }); };
      dyn['REGULAR SEASON'] = async (c) => { text(c, (d.label || '').toUpperCase(), 0, 370, '700 40.32px "ClashDisplay"', '#000', { center: 410 }); };
      dyn.TIJD = async (c) => {
        const g = c.createLinearGradient(115, 0, 702, 0); g.addColorStop(0.7346, 'rgb(202,255,28)'); g.addColorStop(1, 'rgb(138,255,0)');
        text(c, d.time || '', 0, 837, '600 114.97px "ClashDisplay"', g, { center: 410.5 });
      };
      dyn.TITEL = async (c) => { text(c, (d.title || '').toUpperCase(), 0, 1046, '700 97.14px "ClashDisplay"', '#fff', { inkLeft: 71, alpha: 0.149 }); };
      dyn.LINKS = async (c) => { await crest(c, cfg, d.home, 68, 403, 328, 328); };
      dyn.RECHTS = async (c) => { await crest(c, cfg, d.away, 417, 403, 328, 328); };
    } else if (kind === 'shlw') {
      const cfg = WOMEN;
      dyn.DATUM = async (c) => { text(c, (d.date || '').toUpperCase(), 0, 370, '700 40.32px "ClashDisplay"', '#000', { center: 408.5 }); };
      dyn.TIJD = async (c) => { text(c, d.time || '', 0, 904, '600 114.97px "ClashDisplay"', 'rgb(248,248,255)', { center: 407.5 }); };
      dyn.TITEL = async (c) => { text(c, (d.title || '').toUpperCase(), 0, 1047, '700 97.14px "ClashDisplay"', '#fff', { inkLeft: 47, alpha: 0.149 }); };
      const cardAt = async (c, ox, code, caption) => {
        const oy = 436;
        c.save(); c.fillStyle = 'rgba(250,251,255,0.70)'; roundRect(c, ox + 18, oy + 200, 273, 136, 28); c.fill(); c.restore();
        c.save(); c.shadowColor = 'rgba(30,26,14,0.28)'; c.shadowBlur = 22; c.shadowOffsetY = 6; c.fillStyle = '#fff'; roundRect(c, ox + 18, oy + 19, 273, 272, 28); c.fill(); c.restore();
        c.save(); roundRect(c, ox + 18, oy + 19, 273, 272, 28); c.clip();
        const lg = await loadImg(`assets/hnl/clubs/${WOMEN_JPG[code] || code}.jpg`); if (lg) c.drawImage(lg, ox + 18 + (273 - 232) / 2, oy + 19 + (272 - 232) / 2, 232, 232);
        c.restore();
        text(c, (caption || '').toUpperCase(), 0, oy + 318, '700 16px "ClashDisplay"', '#000', { center: ox + 155 });
      };
      dyn.LOGOlinks = async (c) => { await cardAt(c, 68, d.home, d.homeLabel); };
      dyn.LOGOrechts = async (c) => { await cardAt(c, 432, d.away, d.awayLabel); };
    } else {
      const men = K.men;
      const col = men ? 'rgb(247,222,218)' : 'rgb(240,231,253)';
      const logo = async (c, x, id) => {
        c.fillStyle = '#fff'; c.fillRect(x, 122, 229, 229);
        const im = await loadImg(`assets/hnl/clubs/${id}.jpg`); if (im) c.drawImage(im, x, 122, 229, 229);
      };
      dyn.LOGOTHUIS = async (c) => logo(c, 62, d.home);
      dyn.LOGOUIT = async (c) => logo(c, 432, d.away);
      dyn.CLUBTHUIS = async (c) => { text(c, (d.homeName || '').toUpperCase(), 61.16, 519, '700 81.02px "TuskerGrotesk4"', col, { maxWidth: 1060 - 61 }); };
      dyn.CLUBUIT = async (c) => { text(c, (d.awayName || '').toUpperCase(), 61.16, 620, '700 81.02px "TuskerGrotesk4"', col, { maxWidth: 1060 - 61 }); };
      dyn.DATUM = async (c) => { text(c, d.date || '', 61.16, 852, '400 53px "MeticulaR"', col); };
      dyn.TIJD = async (c) => { text(c, d.time || '', 61.16, 1004, '800 175px "MeticulaXB"', col); };
    }
    await ThumbScene.renderScene(ctx, scene, SCENES[kind], { dynamic: dyn, groups });
  }

  // ---------- State ----------
  const cur = { kind: null, d: null, fixtures: [], days: [], slot: 1, loaded: false, photo: null };
  const canvas = () => document.getElementById('thCanvas');
  let rendering = 0, renderQueued = false;
  async function render() {
    renderQueued = false;
    if (!cur.kind || !cur.d) return;
    const seq = ++rendering;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    await renderThumb(cur.kind, cur.d, off.getContext('2d'), cur.photo);
    if (seq !== rendering) return;
    const cv = canvas(); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(off, 0, 0);
  }
  const scheduleRender = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } };

  // persistence (Next kinds: per slot on the server; SHL/SHLW: last choices in localStorage)
  const enc = encodeURIComponent;
  let saveTimer = 0, lastSaved = '';
  const indicator = () => document.getElementById('thSave');
  const LABELS = { idle: '', loading: 'Laden…', pending: '● Wijzigingen nog niet opgeslagen', saving: 'Opslaan…', saved: '✓ Opgeslagen op de server', error: '⚠ Opslaan mislukt — probeer opnieuw' };
  function setSave(s) { const el = indicator(); if (el) { el.dataset.state = s; el.textContent = LABELS[s] || ''; } }
  const itemKey = () => `th:${cur.kind}:s${cur.slot}`;
  const snap = () => JSON.stringify({ kind: cur.kind, v: 1, data: cur.d });
  function scheduleSave() {
    if (!cur.loaded) return;
    if (snap() === lastSaved) return;
    setSave('pending'); clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 800);
  }
  function flushSave() {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!cur.loaded || !cur.kind) return Promise.resolve();
    const json = snap(); if (json === lastSaved) return Promise.resolve();
    const k = itemKey(); lastSaved = json; setSave('saving');
    return fetch('/api/item?key=' + enc(k), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); if (k === itemKey()) setSave('saved'); })
      .catch(() => { lastSaved = ''; setSave('error'); });
  }
  window.addEventListener('pagehide', () => { if (cur.loaded && KINDS[cur.kind] && snap() !== lastSaved) fetch('/api/item?key=' + enc(itemKey()), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: snap(), keepalive: true }); });

  // ---------- Defaults + schedule ----------
  function nextDefaults(kind) {
    const men = KINDS[kind].men;
    const home = men ? 'artemis' : 'dalfsen', away = men ? 'dws' : 'bfc';
    return { home, away, homeName: (nextById[home] || {}).name || home, awayName: (nextById[away] || {}).name || away, date: 'zaterdag 5 september', time: men ? '20:00' : '20:15' };
  }
  function shlDefaults() { return { hasPhoto: false, photoPos: { z: 1, x: 0, y: 0 }, home: '', away: '', date: '', time: '', title: 'Livestream', variant: 'live', label: 'Regular season', homeLabel: '', awayLabel: '', fixture: '' }; }

  async function loadFixtures(kind) {
    const cfg = kind === 'shl' ? MEN : WOMEN;
    try {
      const r = await fetch('/api/schedule?comp=' + (kind === 'shl' ? 'men' : 'women'));
      const data = await r.json();
      const fx = (data.fixtures || []).map(f => ({ ...f, hc: codeOf(cfg, f.home), ac: codeOf(cfg, f.away) })).filter(f => f.hc && f.ac && f.hc !== f.ac);
      const upcoming = fx.filter(f => !f.played);
      cur.fixtures = (upcoming.length ? upcoming : fx).sort((a, b) => (((a.month + 4) % 12) * 100 + a.day) - (((b.month + 4) % 12) * 100 + b.day) || (a.time || '').localeCompare(b.time || ''));
    } catch (e) { cur.fixtures = []; }
    const map = new Map();
    cur.fixtures.forEach(f => { const k = f.month * 100 + f.day; if (!map.has(k)) map.set(k, { key: k, day: f.day, month: f.month, items: [] }); map.get(k).items.push(f); });
    cur.days = [...map.values()];
  }
  const dayLabel = (day) => { const d = seasonDate(day.day, day.month); return `${DAYS_NL_LOWER[d.getDay()].slice(0, 2)} ${day.day} ${MONTHS_NL_LOWER[day.month - 1].slice(0, 3)} · ${day.items.length} wedstrijd${day.items.length === 1 ? '' : 'en'}`; };
  function pickFixture(f) {
    const cfg = cur.kind === 'shl' ? MEN : WOMEN;
    Object.assign(cur.d, { fixture: `${f.month * 100 + f.day}|${f.hc}-${f.ac}`, home: f.hc, away: f.ac, date: fmtDate(cfg, f.day, f.month), time: f.time || cur.d.time || '', homeLabel: labelOf(cfg, f.hc), awayLabel: labelOf(cfg, f.ac), round: f.round || null, day: f.day, month: f.month });
  }

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clubSelect = (id, cfg, v) => `<select id="${id}">${cfg.clubs.map(([c, l]) => `<option value="${esc(c)}"${c === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const nextSelect = (id, v) => `<select id="${id}">${nextClubs.map(c => `<option value="${esc(c.id)}"${c.id === v ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select>`;

  function buildControls() {
    const box = $('thControls'); if (!box || !cur.d) return;
    const d = cur.d, K = KINDS[cur.kind];
    let html = '';
    if (K.next) {
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Wedstrijd</div>
        <div class="field"><label for="thSlot">Opslagplek</label><select id="thSlot">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === cur.slot ? ' selected' : ''}>Slot ${i + 1}</option>`).join('')}</select></div>
        <div class="field"><label for="thHome">Thuisclub (logo)</label>${nextSelect('thHome', d.home)}</div>
        <div class="field"><label for="thHomeName">Naam thuis</label><input type="text" id="thHomeName" value="${esc(d.homeName)}"></div>
        <div class="field"><label for="thAway">Uitclub (logo)</label>${nextSelect('thAway', d.away)}</div>
        <div class="field"><label for="thAwayName">Naam uit</label><input type="text" id="thAwayName" value="${esc(d.awayName)}"></div>
        <div class="field"><label for="thDate">Datum</label><input type="text" id="thDate" value="${esc(d.date)}"></div>
        <div class="field"><label for="thTime">Aftrap</label><input type="text" id="thTime" value="${esc(d.time)}"></div>
        <button class="btn btn-link" id="thSwap" type="button">⇄ Thuis en uit omdraaien</button></div>`;
    } else {
      const cfg = cur.kind === 'shl' ? MEN : WOMEN;
      const dayOpts = cur.days.map(x => `<option value="${x.key}"${String(d.dayKey) === String(x.key) ? ' selected' : ''}>${esc(dayLabel(x))}</option>`).join('');
      const day = cur.days.find(x => String(x.key) === String(d.dayKey)) || cur.days[0];
      const mOpts = (day ? day.items : []).map(f => { const v = `${f.month * 100 + f.day}|${f.hc}-${f.ac}`; return `<option value="${esc(v)}"${v === d.fixture ? ' selected' : ''}>${esc(labelOf(cfg, f.hc))} – ${esc(labelOf(cfg, f.ac))}${f.time ? ' · ' + esc(f.time) : ''}</option>`; }).join('');
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Wedstrijd</div>
        ${cur.days.length ? `<div class="field"><label for="thDay">Speeldag (van de site)</label><select id="thDay">${dayOpts}</select></div>
        <div class="field"><label for="thMatch">Wedstrijd</label><select id="thMatch">${mOpts}</select></div>` : '<p class="hint">Programma niet beschikbaar — vul hieronder zelf in.</p>'}
        <div class="field"><label for="thHome">Thuisclub</label>${clubSelect('thHome', cfg, d.home)}</div>
        <div class="field"><label for="thAway">Uitclub</label>${clubSelect('thAway', cfg, d.away)}</div>
        ${cur.kind === 'shlw' ? `<div class="field"><label>Onderschrift bij de logo's</label><div class="hnl-pair"><input type="text" id="thHomeLabel" value="${esc(d.homeLabel)}"><input type="text" id="thAwayLabel" value="${esc(d.awayLabel)}"></div></div>` : ''}
        <div class="field"><label for="thDate">Datumtekst</label><input type="text" id="thDate" value="${esc(d.date)}"></div>
        <div class="field"><label for="thTime">Aftrap</label><input type="text" id="thTime" value="${esc(d.time)}"></div></div>
        <div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Opmaak</div>
        ${cur.kind === 'shl' ? `<div class="field"><label>Type</label><div class="mode-tabs mode-tabs-compact" id="thVariant"><button type="button" class="mode-tab${d.variant === 'live' ? ' active' : ''}" data-v="live">Livestream</button><button type="button" class="mode-tab${d.variant === 'highlights' ? ' active' : ''}" data-v="highlights">Highlights</button></div></div>
        <div class="field"${d.variant === 'highlights' ? '' : ' hidden'} id="thLabelField"><label for="thLabel">Label in de balk (highlights)</label><input type="text" id="thLabel" value="${esc(d.label)}"></div>` : ''}
        <div class="field"${cur.kind === 'shl' && d.variant === 'highlights' ? ' hidden' : ''} id="thTitleField"><label for="thTitle">Titel onderin</label><input type="text" id="thTitle" value="${esc(d.title)}"></div>
        <label class="photo-btn" id="thPhotoDrop" for="thPhotoInput"><span class="photo-btn-icon">📷</span><span class="photo-btn-text">${d.hasPhoto ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">klik, of sleep hier een afbeelding in · de foto verschijnt rechts</span></label>
        <input type="file" id="thPhotoInput" accept="image/*" hidden>
        ${d.hasPhoto ? `<div class="field"><label for="thZoom">Zoom</label><input type="range" id="thZoom" min="100" max="300" value="${Math.round(d.photoPos.z * 100)}"></div>
        <button class="btn btn-link" id="thPhotoRemove" type="button">✕ Verwijder foto</button><p class="hint">Sleep op de preview om de foto te verschuiven. Zoom in om hem ook naar links te kunnen schuiven.</p>
        <label class="hnl-check"><input type="checkbox" id="thZipPhoto"> Foto ook gebruiken in de zip van de hele speeldag</label>` : ''}</div>`;
    }
    html += `<div class="panel-step panel-step-last"><div class="panel-step-title"><span class="step-num">${K.next ? 2 : 3}</span> Exporteren</div>
      <div class="field"><label>Formaat</label><div class="mode-tabs mode-tabs-compact" id="thFormat"><button type="button" class="mode-tab active" data-f="jpeg">JPG</button><button type="button" class="mode-tab" data-f="webp">WebP</button><button type="button" class="mode-tab" data-f="png">PNG</button></div></div>
      <button class="btn btn-primary" id="thExport" type="button">⬇ Exporteer deze thumbnail</button>
      ${K.next ? '' : '<button class="btn btn-link" id="thExportDay" type="button">⬇ Hele speeldag (zip)</button>'}
      <p class="save-status" id="thStatus" hidden></p></div>`;
    box.innerHTML = html;
    bind();
  }

  let exportFmt = 'jpeg';
  function bind() {
    const d = cur.d;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    const set = (patch, rebuild) => { Object.assign(d, patch); scheduleRender(); scheduleSave(); if (rebuild) buildControls(); };
    on('thSlot', 'change', (e) => { flushSave().then(() => { cur.slot = parseInt(e.target.value, 10); loadItem(); }); });
    on('thHome', 'change', (e) => { if (KINDS[cur.kind].next) set({ home: e.target.value, homeName: (nextById[e.target.value] || {}).name || e.target.value }, true); else { const cfg = cur.kind === 'shl' ? MEN : WOMEN; set({ home: e.target.value, homeLabel: labelOf(cfg, e.target.value) }, true); } });
    on('thAway', 'change', (e) => { if (KINDS[cur.kind].next) set({ away: e.target.value, awayName: (nextById[e.target.value] || {}).name || e.target.value }, true); else { const cfg = cur.kind === 'shl' ? MEN : WOMEN; set({ away: e.target.value, awayLabel: labelOf(cfg, e.target.value) }, true); } });
    on('thHomeName', 'input', (e) => set({ homeName: e.target.value }));
    on('thAwayName', 'input', (e) => set({ awayName: e.target.value }));
    on('thHomeLabel', 'input', (e) => set({ homeLabel: e.target.value }));
    on('thAwayLabel', 'input', (e) => set({ awayLabel: e.target.value }));
    on('thDate', 'input', (e) => set({ date: e.target.value }));
    on('thTime', 'input', (e) => set({ time: e.target.value }));
    on('thTitle', 'input', (e) => set({ title: e.target.value }));
    on('thLabel', 'input', (e) => set({ label: e.target.value }));
    on('thSwap', 'click', () => set({ home: d.away, away: d.home, homeName: d.awayName, awayName: d.homeName }, true));
    on('thDay', 'change', (e) => { const day = cur.days.find(x => String(x.key) === e.target.value); if (day) { d.dayKey = day.key; pickFixture(day.items[0]); scheduleRender(); scheduleSave(); buildControls(); } });
    on('thMatch', 'change', (e) => { const day = cur.days.find(x => String(x.key) === String(d.dayKey)); const f = day && day.items.find(x => `${x.month * 100 + x.day}|${x.hc}-${x.ac}` === e.target.value); if (f) { pickFixture(f); scheduleRender(); scheduleSave(); buildControls(); } });
    document.querySelectorAll('#thVariant [data-v]').forEach(b => b.addEventListener('click', () => set({ variant: b.dataset.v }, true)));
    document.querySelectorAll('#thFormat [data-f]').forEach(b => { b.classList.toggle('active', b.dataset.f === exportFmt); b.addEventListener('click', () => { exportFmt = b.dataset.f; document.querySelectorAll('#thFormat [data-f]').forEach(x => x.classList.toggle('active', x === b)); }); });
    on('thPhotoInput', 'change', (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadPhoto(f); });
    on('thPhotoRemove', 'click', removePhoto);
    on('thZoom', 'input', (e) => { d.photoPos.z = parseInt(e.target.value, 10) / 100; if (cur.photo) { const r = photoRect(cur.photo, d.photoPos); d.photoPos.x = r.x; d.photoPos.y = r.y; } scheduleRender(); scheduleSave(); });
    const drop = $('thPhotoDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag-over'); }));
      drop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) uploadPhoto(f); });
    }
    on('thExport', 'click', exportOne);
    on('thExportDay', 'click', exportDay);
  }

  // ---------- Export ----------
  const MIME = { jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
  const EXT = { jpeg: 'jpg', webp: 'webp', png: 'png' };
  const toBlob = (cv, fmt) => new Promise(res => cv.toBlob(res, MIME[fmt], 0.93));
  async function blobFor(kind, d, fmt, withPhoto = true) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    await renderThumb(kind, d, c.getContext('2d'), withPhoto ? cur.photo : null);
    return toBlob(c, fmt);
  }
  function fileName(kind, d) {
    if (KINDS[kind].next) {
      const code = (id) => NEXT_CODE[id] || String(id).toUpperCase();
      const dm = /(\d+)\s+(\w+)/.exec(d.date || ''); const mi = dm ? MONTHS_NL_LOWER.indexOf(dm[2].toLowerCase()) : -1;
      const y = mi >= 0 ? seasonDate(1, mi + 1).getFullYear() : new Date().getFullYear();
      const stamp = dm && mi >= 0 ? `${y}${String(mi + 1).padStart(2, '0')}${String(dm[1]).padStart(2, '0')}` : 'datum';
      return `${kind === 'nextmen' ? 'NextMEN' : 'NextWomen'}_${stamp}_${code(d.home)}-${code(d.away)}`;
    }
    const cfg = kind === 'shl' ? MEN : WOMEN;
    const ec = (c) => cfg.exportCode[c] || c;
    if (kind === 'shl' && d.round) return `r${d.round}_${ec(d.home)}-${ec(d.away)}`;
    const y = d.month ? seasonDate(d.day, d.month).getFullYear() : new Date().getFullYear();
    const stamp = d.month ? `${y}${String(d.month).padStart(2, '0')}${String(d.day).padStart(2, '0')}` : 'datum';
    return `${kind === 'shl' ? 'SHL' : 'SHLW'}_${stamp}_${ec(d.home)}-${ec(d.away)}`;
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const status = (t) => { const el = $('thStatus'); if (el) { el.textContent = t; el.hidden = !t; } };
  async function exportOne() {
    flushSave();
    const blob = await blobFor(cur.kind, cur.d, exportFmt);
    download(blob, `${fileName(cur.kind, cur.d)}.${EXT[exportFmt]}`);
  }
  async function exportDay() {
    const day = cur.days.find(x => String(x.key) === String(cur.d.dayKey)) || cur.days[0];
    if (!day) return;
    const files = [];
    for (let i = 0; i < day.items.length; i++) {
      status(`Thumbnail ${i + 1} van ${day.items.length} maken…`);
      const d = { ...cur.d }; const saved = cur.d; cur.d = d; pickFixture(day.items[i]); cur.d = saved;
      const blob = await blobFor(cur.kind, d, exportFmt, !!($('thZipPhoto') && $('thZipPhoto').checked));
      files.push({ name: `${fileName(cur.kind, d)}.${EXT[exportFmt]}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const zip = makeZip(files);
    download(new Blob([zip], { type: 'application/zip' }), `${cur.kind === 'shl' ? 'SHL' : 'SHLW'}_thumbnails_${day.day}-${day.month}.zip`);
    status(`✓ ${files.length} thumbnails in de zip`);
  }

  // minimal store-only zip writer
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function makeZip(files) {
    const enc8 = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    files.forEach(f => {
      const name = enc8.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    });
    const csize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
  }

  // ---------- Loading an item ----------
  const blobToImg = (blob) => new Promise(res => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });
  async function loadItem() {
    cur.loaded = false; lastSaved = ''; cur.photo = null;
    const kind = cur.kind, K = KINDS[kind];
    await nextReady;
    setSave('loading');
    let data = null; const k = itemKey();
    try { const r = await fetch('/api/item?key=' + enc(k), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && j.data) data = j.data; } } catch (e) { /* offline */ }
    if (k !== itemKey()) return;
    cur.d = Object.assign(K.next ? nextDefaults(kind) : shlDefaults(), data || {});
    if (!cur.d.photoPos) cur.d.photoPos = { z: 1, x: 0, y: 0 };
    if (cur.d.hasPhoto) {
      try { const r = await fetch('/api/photo?key=' + enc(k), { cache: 'no-store' }); if (r.ok) cur.photo = await blobToImg(await r.blob()); else cur.d.hasPhoto = false; } catch (e) { cur.d.hasPhoto = false; }
    }
    if (!K.next) {
      await loadFixtures(kind);
      // default: the first upcoming matchday (or keep the saved one when it still exists)
      const today = new Date();
      const dayOrder = (x) => ((x.month + 4) % 12) * 100 + x.day, tOrder = ((today.getMonth() + 5) % 12) * 100 + today.getDate();
      const day = cur.days.find(x => String(x.key) === String(cur.d.dayKey)) || cur.days.find(x => dayOrder(x) >= tOrder) || cur.days[0];
      if (day) { cur.d.dayKey = day.key; const f = day.items.find(x => `${x.month * 100 + x.day}|${x.hc}-${x.ac}` === cur.d.fixture) || day.items[0]; const keepTime = cur.d.fixture === `${f.month * 100 + f.day}|${f.hc}-${f.ac}`; const t0 = cur.d.time; pickFixture(f); if (keepTime && t0) cur.d.time = t0; }
      else if (!cur.d.home) { const cfg = kind === 'shl' ? MEN : WOMEN; cur.d.home = cfg.clubs[0][0]; cur.d.away = cfg.clubs[1][0]; }
    }
    if (k !== itemKey()) return;
    lastSaved = data ? snap() : ''; setSave(data ? 'saved' : 'idle');
    cur.loaded = true;
    buildControls();
    scheduleRender();
  }

  // photo: downscale to 2200px JPEG and keep it on the server for this item
  function uploadPhoto(file) {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, 2200 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.toBlob((blob) => {
          const k = itemKey(); setSave('saving');
          fetch('/api/photo?key=' + enc(k), { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return blobToImg(blob); })
            .then(img => { cur.photo = img; cur.d.hasPhoto = true; cur.d.photoPos = { z: 1, x: 0, y: 0 }; lastSaved = ''; flushSave(); buildControls(); scheduleRender(); })
            .catch(() => setSave('error'));
        }, 'image/jpeg', 0.92);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function removePhoto() {
    fetch('/api/photo?key=' + enc(itemKey()), { method: 'DELETE' }).catch(() => {});
    cur.photo = null; cur.d.hasPhoto = false; scheduleSave(); buildControls(); scheduleRender();
  }
  function bindCanvasDrag() {
    const cv = canvas(); if (!cv || cv._bound) return; cv._bound = true;
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      if (!cur.d || !cur.d.hasPhoto) return;
      const r = cv.getBoundingClientRect(); const k = cv.width / r.width;
      drag = { x: e.clientX, y: e.clientY, k, ox: cur.d.photoPos.x, oy: cur.d.photoPos.y };
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag || !cur.photo) return;
      const p = cur.d.photoPos; p.x = drag.ox + (e.clientX - drag.x) * drag.k; p.y = drag.oy + (e.clientY - drag.y) * drag.k;
      const r = photoRect(cur.photo, p); p.x = r.x; p.y = r.y;   // keep the stored offset inside the limits so dragging doesn't feel sticky
      scheduleRender();
    });
    const end = () => { if (!drag) return; drag = null; cv.style.cursor = ''; scheduleSave(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  window.TH = {
    NAMES,
    open(kind) {
      cur.kind = kind; cur.slot = 1; cur.d = null; cur.days = []; cur.fixtures = [];
      $('thTitle2').textContent = KINDS[kind].title;
      $('thSub').textContent = KINDS[kind].sub;
      $('thControls').innerHTML = '';
      bindCanvasDrag();
      loadItem();
    },
    close() { return flushSave(); },
    get state() { return cur; },
  };
})();
