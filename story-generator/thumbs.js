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
    lvlm:      { title: 'LVL Heren',  sub: 'Lotto Volley League Men', lvl: true },
    lvlw:      { title: 'LVL Dames',  sub: 'Lotto Volley League Women', lvl: true },
    lvlmail:   { title: 'LVL Mailheader', sub: 'Lotto Volley League · 1200×400', vis: 'mail' },
    lvlwatch:  { title: 'LVL Watch live', sub: 'Lotto Volley League · 1920×1080', vis: 'watch' },
    shlmail:   { title: 'SHL Schedule e-mailbanner', sub: 'Super Handball League · 1200 px breed', shlmail: true, comp: 'men' },
    potm:      { title: 'Player of the Month', sub: 'Super Handball League · overzicht, nominees en vote-story', potm: true, comp: 'men' },
  };
  const NAMES = { shl: 'SHL', shlw: 'SHLW', nextmen: 'Next heren', nextwomen: 'Next dames', lvlm: 'LVL heren', lvlw: 'LVL dames', lvlmail: 'LVL mailheader', lvlwatch: 'LVL watch live', potm: 'Player of the Month', shlmail: 'SHL schedule e-mail' };

  // ---------- Fonts (Clash is registered by script.js; the HandbalNL ones are loaded here) ----------
  const FONT_FILES = [
    ['TuskerGrotesk4', 'fonts/hnl/TuskerGrotesk-4700Bold.otf', '700'],
    ['MeticulaR', 'fonts/hnl/Meticula-Regular.ttf', '400'],
    ['MeticulaXB', 'fonts/hnl/Meticula-ExtraBold.ttf', '800'],
    ['Monologue', 'fonts/lvl/Monologue-Regular.woff2', '400'],   // Lotto Volley League
    ['ClashLight', 'fonts/ClashDisplay-Light.otf', '300'], ['ClashMed', 'fonts/ClashDisplay-Medium.otf', '500'],
    ['Archivo', 'fonts/lvl/Archivo-Regular.woff2', '400'],       // Lotto Volley League body font (as on lottovolleyleague.be)
    ['Archivo', 'fonts/lvl/Archivo-Bold.woff2', '700'],
  ];
  const fontsReady = Promise.all(FONT_FILES.map(([fam, url, w]) => new FontFace(fam, `url(${url})`, { weight: w }).load().then(f => document.fonts.add(f)).catch(() => {})))
    .then(() => Promise.all([document.fonts.load('700 40px ClashDisplay'), document.fonts.load('600 40px ClashDisplay')]).catch(() => {}));

  // ---------- SHL / SHLW club data (same codes and aliases as the editor) ----------
  const DEF = SETTINGS.DEF;
  const MEN = {
    dir: 'assets/teams', exportCode: DEF.menExportCode, clubs: DEF.men, kind: 'men',
    aliases: { SAB: ['bocholt'], IZE: ['izegem'], EUP: ['eupen'], HCS: ['sprimont'], BEV: ['bevo'], PEL: ['pelt'], BWH: ['hercules', 'whc'], DFS: ['arnhem'], HUP: ['hurry'], HCV: ['vise', 'visé'], HVA: ['aalsmeer', 'royalfloraholland'], HUB: ['hubo'], VOL: ['volendam'], TAC: ['tachos', 'mossel', 'witte ster'] },
    dateLocale: 'en',
  };
  const WOMEN = {
    dir: 'assets/women/teams', exportCode: DEF.womenExportCode, clubs: DEF.women, kind: 'women',
    aliases: { DSVD: ['dsvd', 'aqqo'], 'E&O': ['misker', 'oosting'], FOR: ['foreholte'], KWI: ['kwiek'], MHV: ['m.h.v'], PSV: ['hypotheekvisie', 'eindhoven'], QUI: ['quintus'], SEW: ['westfriesland'], 'V&L': ['geonius'], VEN: ['venlo', 'cabooter'], VOC: ['ruitenheer'], VOL: ['volendam'], VZV: ['juro'], WPK: ['westlandia'] },
    dateLocale: 'nl',
  };
  const DAYS = { en: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], nl: ['ZONDAG', 'MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'] };
  const MONTHS = { en: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'], nl: ['JANUARI', 'FEBRUARI', 'MAART', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AUGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DECEMBER'] };
  const MONTHS_NL_LOWER = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const DAYS_NL_LOWER = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const codeOf = (cfg, name) => { const n = norm(name); return Object.keys(cfg.aliases).find(c => cfg.aliases[c].some(a => n.includes(a))) || null; };
  const labelOf = (cfg, code) => SETTINGS.label(`${cfg.kind}:${code}`, (cfg.clubs.find(c => c[0] === code) || [0, code])[1]);
  function seasonDate(day, month) {
    const now = new Date(), start = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(month >= 8 ? start : start + 1, month - 1, day);
  }
  const fmtDate = (cfg, day, month) => { const d = seasonDate(day, month), l = cfg.dateLocale; return `${DAYS[l][d.getDay()]} ${day} ${MONTHS[l][month - 1]}`; };

  // ---------- Next (HandbalNL) club data ----------
  let nextClubs = [], nextById = {};
  const nextReady = fetch('assets/hnl/clubs.json').then(r => r.json()).then(l => { nextClubs = l; l.forEach(c => { nextById[c.id] = c; }); }).catch(() => {});
  const WOMEN_JPG = DEF.womenJpg;
  const NEXT_CODE = DEF.hnlCode;

  // ---------- Images ----------
  const imgs = new Map();
  const loadImg = (src) => (imgs.has(src) ? imgs.get(src) : (imgs.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })), imgs.get(src)));
  const scenes = {};
  const loadScene = (key) => scenes[key] || (scenes[key] = fetch(SCENES[key] + '/scene.json').then(r => r.json()));

  // ---------- Drawing helpers ----------
  function text(ctx, str, x, baseline, font, color, opt = {}) {
    ctx.save();
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    if (opt.ws != null) ctx.wordSpacing = opt.ws + 'px';   // extra space between words (Clash sets them tight)
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    let tx = x;
    ctx.textAlign = 'left';
    if (opt.center != null) { const m = ctx.measureText(str); tx = opt.center - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 + m.actualBoundingBoxLeft; }
    else if (opt.inkLeft != null) { const m = ctx.measureText(str); tx = opt.inkLeft + m.actualBoundingBoxLeft; }
    else if (opt.inkRight != null) { const m = ctx.measureText(str); tx = opt.inkRight - m.actualBoundingBoxRight; }
    if (opt.maxWidth) { const w = ctx.measureText(str).width; if (w > opt.maxWidth) { ctx.translate(tx, baseline); ctx.scale(opt.maxWidth / w, 1); ctx.translate(-tx, -baseline); } }
    ctx.fillText(str, tx, baseline);
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // crest of a team strip (the logo box at the left end of the 1200x200 strip)
  async function crest(ctx, cfg, code, x, y, w, h) {
    const over = SETTINGS.hasLogo(`${cfg.kind}:${code}`) ? await loadImg(SETTINGS.logo(`${cfg.kind}:${code}`, '')) : null;
    if (over) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.drawImage(over, x, y, w, h); return; }
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

  // ---------- Lotto Volley League (men and women): background + two round crests + date/time in Monologue ----------
  // Positions come from the PSD (LVL_thumbnails_workfile2026.psd): crests 401x401 at (53,309) and (634,309), the time text centred
  // on x 542 with its figures on y 960, the season in the top right (20% navy).
  const LVL = {
    lvlm: { bg: 'assets/lvl/bg_men.png', prefix: 'LVLM', tag: '[LVLM]', clubs: [['MEN', 'Decospan Volley Team Menen'], ['ROE', 'Knack Roeselare'], ['CGENT', 'Caruur Volley Gent'], ['ANT', 'SAB Diving Brabo Antwerp VT'], ['WAR', 'Waremme Volley'], ['MAA', 'VC Greenyard Maaseik'], ['GUI', 'VBC Guibertin'], ['AAL', 'Lindemans Aalst'], ['LEU', 'Golazo Haasrode Leuven'], ['ACH', 'Tectum Achel'], ['GEE', 'VC Geel']] },
    lvlw: { bg: 'assets/lvl/bg_women.png', prefix: 'LVLW', tag: '[LVLW]', clubs: [['NOO', 'Volley Noorderkempen'], ['DROE', 'Darta Bevo Roeselare'], ['ZOE', 'KwadrO Amigos Sint-Antonius Zoersel'], ['MIC', 'Vlavo Saturnus Michelbeke'], ['CHA', 'ES Charleroi Volley'], ['TCH', 'CapitalAtWork Tchalou Volley'], ['GEND', 'Damesvolley Dok Noord Gent'], ['BEV', 'Asterix AVO Beveren'], ['HEL', 'HVC Helchteren Oben ramen & deuren'], ['OUD', 'VC Oudegem'], ['SGW', 'Vamos Stekene - Sint-Gillis-Waas'], ['ANT', 'SAB Diving Brabo Antwerp VT']] },
  };
  const lvlName = (kind, code) => (LVL[kind].clubs.find(c => c[0] === code) || [0, code])[1];
  async function renderLvl(kind, d, ctx, photo) {
    await fontsReady;
    try { await document.fonts.load('400 160px Monologue'); } catch (e) { /* ignore */ }
    ctx.clearRect(0, 0, W, H);
    const bg = await loadImg(LVL[kind].bg); if (bg) ctx.drawImage(bg, 0, 0, W, H);
    const vorm = await loadImg('assets/lvl/vorm.png'); if (vorm) ctx.drawImage(vorm, 0, 0, W, H);   // the dark wave in the bottom right (layer "Vorm 1" of the PSD)
    if (d.season) text(ctx, d.season, 0, 226, '400 247px "Monologue"', '#012243', { inkRight: 1870, alpha: 0.16 });
    for (const [code, x] of [[d.home, 53], [d.away, 634]]) {
      const im = code ? await loadImg(`assets/lvl/teams/${code}.png`) : null;
      if (im) ctx.drawImage(im, x, 309, 401, 401);   // the crest files include their white circle
    }
    if (d.dt) text(ctx, d.dt, 0, 960, '400 160px "Monologue"', '#fff', { center: 542 });
    // the player (cut-out, background already removed) goes on top of everything: head near the top, centred in the right half, bleeding off the bottom
    if (photo && d.hasPhoto) {
      const pp = d.photoPos || { z: 1, x: 0, y: 0 }, ph = 1150 * pp.z, pw = ph * photo.naturalWidth / photo.naturalHeight;
      ctx.save(); ctx.shadowColor = 'rgba(0,15,45,0.5)'; ctx.shadowBlur = 48; ctx.shadowOffsetX = -10; ctx.shadowOffsetY = 14;
      ctx.drawImage(photo, 1400 + pp.x - pw / 2, 55 + pp.y, pw, ph); ctx.restore();
    }
  }
  // the weekly programme: a CSV with Naam,bg,LogoLinks,LogoRechts,TijdText (as made for the Photoshop data merge)
  const lvlSeasonOrder = (dt) => { const m = /(\d{1,2})\/(\d{1,2})/.exec(dt || ''); return m ? ((+m[2] + 4) % 12) * 100 + +m[1] : 9999; };
  const lvlRowFor = (r) => ({ left: String(r.LogoLinks || '').replace(/\.png$/i, ''), right: String(r.LogoRechts || '').replace(/\.png$/i, ''), dt: r.TijdText || '', women: /women/i.test(r.bg || '') || /^\[LVLW\]/.test(r.Naam || '') });
  function parseCsv(textIn) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < textIn.length; i++) {
      const ch = textIn[i];
      if (q) { if (ch === '"') { if (textIn[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && textIn[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(c => c !== '')) rows.push(row); row = []; } else cell += ch;
    }
    row.push(cell); if (row.some(c => c !== '')) rows.push(row);
    const head = (rows.shift() || []).map(h => h.trim());
    return rows.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }
  const decodeCsv = (buf) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); } };
  async function loadLvlRows(kind) {
    let rows = null;
    try { const r = await fetch('/api/item?key=' + enc('lvl:schedule'), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && j.data && Array.isArray(j.data.rows) && j.data.rows.length) rows = j.data.rows; } } catch (e) { /* offline */ }
    if (!rows) { try { rows = parseCsv(await (await fetch('assets/lvl/schedule.csv')).text()); } catch (e) { rows = []; } }
    const women = kind === 'lvlw';
    cur.lvlRows = rows.map(lvlRowFor).filter(r => r.women === women && r.left && r.right).sort((a, b) => lvlSeasonOrder(a.dt) - lvlSeasonOrder(b.dt) || a.dt.localeCompare(b.dt));
    cur.lvlAll = rows;
  }


  // ---------- Lotto Volley League: mail header + "Watch live" list ----------
  // Mail header: 1200x400 (a 600 px wide header at 2x), the title is editable and fits itself (one or two lines).
  // Watch live: the matches of one day as two crests with the date between them (900 px wide design, drawn at 2x).
  // brand colours and fonts as on lottovolleyleague.be: navy #07192F, yellow #FFDD00, red #EE3124, blue #028AED, Monologue + Archivo
  const VIS_LVL_NAVY = '#07192f', LVL_YELLOW = '#ffdd00', LVL_BLUE = '#028aed', WATCH_PANEL = '#eef5fd';
  // the thumbnails' own backgrounds: blue for the men (and mixed), purple for the women, running from bottom left to top right
  const lvlThumbGrad = (ctx, w, h, women) => { const g = ctx.createLinearGradient(0, h, w, 0); g.addColorStop(0, women ? '#a900be' : '#007ac8'); g.addColorStop(1, women ? '#c158ff' : '#1096d6'); return g; };
  // neutral light blue for a watch-live image with both men's and women's matches
  const lvlMixGrad = (ctx, w, h) => { const g = ctx.createLinearGradient(0, h, w, 0); g.addColorStop(0, '#2c9fdc'); g.addColorStop(1, '#6cc6f2'); return g; };
  const LVL_WAVE = '#012243';
    const lvlClubName = (code) => { const c = LVL.lvlm.clubs.concat(LVL.lvlw.clubs).find(x => x[0] === code); return c ? c[1] : code; };
  const lvlAllClubs = () => { const seen = {}; return LVL.lvlm.clubs.concat(LVL.lvlw.clubs).filter(c => (seen[c[0]] ? false : (seen[c[0]] = true))); };
  const dtParts = (dt) => { const m = /(\d{1,2})\/(\d{1,2})(?:\s*-\s*(\d{1,2}:\d{2}))?/.exec(dt || ''); return m ? { d: +m[1], m: +m[2], time: m[3] || '' } : null; };
  // English, as the visuals are for the English-speaking LVL audience: "SAT 24 OCT" (+ " - 20:30")
  const watchDateText = (dt, withTime) => { const q = dtParts(dt); if (!q) return dt || ''; const t = seasonDate(q.d, q.m); return `${DAYS.en[t.getDay()].slice(0, 3)} ${q.d} ${MONTHS.en[q.m - 1].slice(0, 3)}${withTime && q.time ? ' - ' + q.time : ''}`; };
  const watchKey = (r) => `${r.left}-${r.right}|${r.dt}`;
  // the matches shown on the image: the programme rows of the chosen day (and competition) minus the ones switched off, plus the added ones
  const dayKeyOf = (dt) => { const q = dtParts(dt); return q ? `${String(q.d).padStart(2, '0')}/${String(q.m).padStart(2, '0')}` : ''; };
  const dayDate = (k) => { const q = /(\d+)\/(\d+)/.exec(k || ''); return q ? seasonDate(+q[1], +q[2]) : null; };
  const compOk = (d, r) => d.comp === 'both' || (d.comp === 'women') === !!r.women;
  const progRows = () => (cur.lvlAll || []).map(lvlRowFor).filter(r => r.left && r.right);
  // every day that has matches (for the chosen competition), in calendar order
  const watchDays = (d) => { const set = {}; progRows().filter(r => compOk(d, r)).concat(d.extra || []).forEach(r => { const k = dayKeyOf(r.dt); if (k) set[k] = 1; }); return Object.keys(set).sort((x, y) => dayDate(x) - dayDate(y)); };
  // the days on the image: from the chosen first day, span days long (a week by default)
  const watchWindow = (d) => { const st = dayDate(d.day); if (!st) return []; const en = new Date(st.getTime() + ((d.span || 7) - 1) * 86400000 + 3600000); return watchDays(d).filter(k => { const t = dayDate(k); return t >= st && t <= en; }); };
  const watchDayRows = (d) => { const win = watchWindow(d); return progRows().filter(r => compOk(d, r) && win.includes(dayKeyOf(r.dt))); };
  const timeOf = (r) => (dtParts(r.dt) || {}).time || '';
  function watchMatches(d) {
    if (d.manual) return (d.list || []).filter(r => r.left && r.right);   // filled in by hand: exactly this list, in this order
    const win = watchWindow(d);
    const fromProg = watchDayRows(d).filter(r => !(d.off || []).includes(watchKey(r)));
    const extra = (d.extra || []).filter(r => win.includes(dayKeyOf(r.dt)));
    return fromProg.concat(extra).sort((x, y) => (dayDate(dayKeyOf(x.dt)) - dayDate(dayKeyOf(y.dt))) || timeOf(x).localeCompare(timeOf(y)) || (x.women - y.women));
  }
  // matches grouped per day (calendar order, the order inside a day is kept)
  function watchGroups(ms) {
    const g = {}, order = [];
    ms.forEach(r => { const k = dayKeyOf(r.dt) || ''; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(r); });
    order.sort((x, y) => ((dayDate(x) || 0) - (dayDate(y) || 0)));
    return order.map(k => ({ key: k, items: g[k] }));
  }
  function visSize(kind) { return KINDS[kind].vis === 'mail' ? [1200, 400] : [1920, 1080]; }
  // canvas size of a kind (Player of the Month: the story is 1080x1920, the rest 1080x1350)
  const kindSize = (kind, d) => KINDS[kind].shlmail ? [1200, shlMailLayout(d).H] : KINDS[kind].potm ? [1080, d && d.fmt === 'story' ? 1920 : 1350] : KINDS[kind].vis ? visSize(kind) : [W, H];
  // fits a title into a box: one line when it fits at a good size, else two lines at the best word break
  function fitLines(ctx, str, fontOf, maxW, maxSize, minSize) {
    const widthAt = (t, sz) => { ctx.font = fontOf(sz); return ctx.measureText(t).width; };
    const one = Math.min(maxSize, maxSize * maxW / Math.max(1, widthAt(str, maxSize)));
    if (one >= minSize || str.indexOf(' ') < 0) return { size: Math.max(one, 20), lines: [str] };
    const words = str.split(' '); let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const w = Math.max(widthAt(a, 100), widthAt(b, 100));
      if (!best || w < best.w) best = { w, lines: [a, b] };
    }
    return { size: Math.min(maxSize, 100 * maxW / best.w), lines: best.lines };
  }
  async function renderMail(d, ctx) {
    const W2 = 1200, H2 = 400;
    ctx.clearRect(0, 0, W2, H2);
    ctx.fillStyle = lvlThumbGrad(ctx, W2, H2, false); ctx.fillRect(0, 0, W2, H2);
    // yellow-to-blue circle, top left (cropped by the edge)
    const cx = 130, cy = -30, r = 200;
    let g = ctx.createLinearGradient(cx - r * 0.75, cy - r * 0.75, cx + r * 0.35, cy + r);
    g.addColorStop(0, LVL_YELLOW); g.addColorStop(0.55, '#9fcf86'); g.addColorStop(1, '#3aa8e8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // light-blue circle with the logo, bottom right
    ctx.fillStyle = '#0ac1f9'; ctx.beginPath(); ctx.arc(1215, 465, 262, 0, Math.PI * 2); ctx.fill();
    const logo = await loadImg('assets/lvl/logo.svg');
    if (logo) { const lh = 96, lw = lh * 72 / 49; ctx.drawImage(logo, 1200 - 38 - lw, 400 - 26 - lh, lw, lh); }
    // title (+ optional subtitle), centred in the free area left of the logo circle
    await document.fonts.load('400 120px "Monologue"').catch(() => {});
    const title = (d.title || '').toUpperCase().trim(), sub = (d.sub || '').trim();
    const area = { x: 600, w: 940 }, hasSub = !!sub;
    const f = fitLines(ctx, title, (sz) => `400 ${sz}px "Monologue"`, area.w, 118, 64);
    const lh2 = f.size * 0.98, capH = f.size * 0.74;
    const block = capH + (f.lines.length - 1) * lh2 + (hasSub ? 62 : 0);
    let y0 = 206 - block / 2 + capH + (f.lines.length > 1 ? 0 : 6);
    f.lines.forEach((ln, i) => text(ctx, ln, 0, y0 + i * lh2, `400 ${f.size}px "Monologue"`, '#fff', { center: area.x }));
    if (hasSub) { const sf = fitLines(ctx, sub, (sz) => `700 ${sz}px "Archivo"`, area.w, 34, 18); text(ctx, sub, 0, y0 + (f.lines.length - 1) * lh2 + 56, `700 ${sf.size}px "Archivo"`, '#fff', { center: area.x, alpha: 0.9 }); }
  }
  // Watch live, landscape 1920x1080 like the thumbnails: up to four matches in one column, more in two columns (filled column by column)
  async function renderWatch(d, ctx) {
    const W3 = 1920, H3 = 1080, women = d.comp === 'women';
    ctx.clearRect(0, 0, W3, H3);
    if (d.bgStyle === 'thumb') { ctx.fillStyle = lvlThumbGrad(ctx, W3, H3, women); ctx.fillRect(0, 0, W3, H3); }
    else {   // as the hero of lottovolleyleague.be: navy-blue at the top to light blue at the bottom, with its yellow circle bleeding off the bottom right
      const g = ctx.createLinearGradient(0, 0, 0, H3); g.addColorStop(0, '#05518c'); g.addColorStop(0.5, '#0f92ef'); g.addColorStop(1, '#59bdf8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W3, H3);
      ctx.fillStyle = '#ffdd00'; ctx.beginPath(); ctx.arc(1830, 1090, 360, 0, Math.PI * 2); ctx.fill();
    }
    await document.fonts.load('400 120px "Monologue"').catch(() => {});
    // the dark wave top left with the logo (as in the thumbnails), the title to the right
    ctx.fillStyle = LVL_WAVE; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(930, 0); ctx.bezierCurveTo(780, 130, 440, 240, 0, 262); ctx.closePath(); ctx.fill();
    const logo = await loadImg('assets/lvl/logo.svg');
    if (logo) { const lh = 150, lw = lh * 72 / 49; ctx.drawImage(logo, 100, 38, lw, lh); }
    const title = (d.title || '').toUpperCase().trim();
    if (title) {
      const f = fitLines(ctx, title, (sz) => `400 ${sz}px "Monologue"`, 760, 190, 100), cap = f.size * 0.74, lhh = f.size * 0.98, n = f.lines.length;
      const top = 112 - (cap + (n - 1) * lhh) / 2;
      f.lines.forEach((ln, i) => text(ctx, ln, 0, top + cap + i * lhh, `400 ${f.size}px "Monologue"`, '#fff', { inkRight: 1840 }));
    }
    const ms = watchMatches(d), groups = watchGroups(ms);
    if (groups.length > 1) { await renderWatchWeek(ctx, groups.slice(0, 4), d); return; }
    const total = ms.length, two = total > 4, perCol = two ? Math.ceil(total / 2) : total;
    const areaTop = 280, areaH = 770, pitch = Math.min(190, areaH / Math.max(perCol, 1)), dia = Math.min(150, pitch - 30), R = dia / 2;
    const startY = areaTop + (areaH - perCol * pitch) / 2;
    const colW = two ? 900 : 1100, centers = two ? [480, 1440] : [960];
    const k = dia / 150;   // text scales with the crest size
    // thin dividers between the matches (and between the two columns)
    ctx.fillStyle = d.markComp ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.3)';
    const lineHalf = Math.min(colW / 2 - (two ? 24 : 120) + 10, 2 * R + (two ? 190 : 235) * (dia / 150) + 36), rowsIn = (c) => two ? (c === 0 ? perCol : total - perCol) : total;
    centers.forEach((cxx, c) => { for (let r = 1; r < rowsIn(c); r++) ctx.fillRect(cxx - lineHalf, startY + r * pitch - 1, lineHalf * 2, 2); });
    if (two && !d.markComp) ctx.fillRect(959, startY + 12, 2, perCol * pitch - 24);
    for (let i = 0; i < total; i++) {
      const r = ms[i], col = two ? (i < perCol ? 0 : 1) : 0, row = two ? (i < perCol ? i : i - perCol) : i;
      const cx = centers[col], cy = startY + row * pitch + pitch / 2, half = d.markComp ? R + (two ? 118 : 170) * (dia / 150) : Math.min(colW / 2 - R - (two ? 24 : 120), R + (two ? 190 : 235) * (dia / 150)), padS = 0.3 * (pitch - 10), zone = padS + 96 * k;
      if (d.markComp) sexPlate(ctx, cx - half - R - 24 - zone, cy - pitch / 2 + 5, 2 * (half + R + 24 + zone), pitch - 10, r.women);
      for (const [code, cxx] of [[r.left, cx - half], [r.right, cx + half]]) {
        const im = await loadImg(`assets/lvl/teams/${code}.png`);
        ctx.save(); ctx.shadowColor = 'rgba(0,30,70,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cxx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (im) ctx.drawImage(im, cxx - R, cy - R, dia, dia);
      }
      const names = !!d.showNames, dtext = watchDateText(r.dt, !!d.showTime), mw = half * 2 - dia - 30;
      if (d.showAbbr && !names) {   // the club abbreviation next to each crest
        const af = `400 ${46 * k}px "Monologue"`, aw = Math.max(60, half - R - 24 - 150 * k);
        text(ctx, r.left, 0, cy + 17 * k, af, '#fff', { inkLeft: cx - half + R + 16, maxWidth: aw });
        text(ctx, r.right, 0, cy + 17 * k, af, '#fff', { inkRight: cx + half - R - 16, maxWidth: aw });
      }
      if (names) {
        text(ctx, dtext, 0, cy - 40 * k, `400 ${36 * k}px "Monologue"`, '#fff', { center: cx, maxWidth: mw });
        text(ctx, lvlClubName(r.left).toUpperCase(), 0, cy - 14 * k, `700 ${17 * k}px "Archivo"`, '#fff', { center: cx, maxWidth: mw });
        text(ctx, 'VS', 0, cy + 36 * k, `400 ${48 * k}px "Monologue"`, '#fff', { center: cx });
        text(ctx, lvlClubName(r.right).toUpperCase(), 0, cy + 66 * k, `700 ${17 * k}px "Archivo"`, '#fff', { center: cx, maxWidth: mw });
      } else {
        if (d.markComp) {   // MEN/WOMEN left, VS and the date in the middle, the time right
          const tmx = timeOf(r);
          text(ctx, r.women ? 'WOMEN' : 'MEN', 0, cy + 0.37 * 34 * k, `400 ${34 * k}px "Monologue"`, '#fff', { inkLeft: cx - half - R - 24 - zone + padS, alpha: 0.9, maxWidth: zone - padS - 8 });
          text(ctx, 'VS', 0, cy + 6 * k, `400 ${70 * k}px "Monologue"`, '#fff', { center: cx });
          text(ctx, watchDateText(r.dt, false), 0, cy + 52 * k, `400 ${two ? 36 * k : 42 * k}px "Monologue"`, '#fff', { center: cx, maxWidth: mw });
          if (d.showTime && tmx) text(ctx, tmx, 0, cy + 0.37 * 50 * k, `400 ${50 * k}px "Monologue"`, '#fff', { inkRight: cx + half + R + 24 + zone - padS, maxWidth: zone - padS - 8 });
        } else {
          text(ctx, 'VS', 0, cy + 6 * k, `400 ${76 * k}px "Monologue"`, '#fff', { center: cx });
          text(ctx, dtext, 0, cy + 54 * k, `400 ${two ? 38 * k : 44 * k}px "Monologue"`, '#fff', { center: cx, maxWidth: mw });
        }
      }
    }
  }
  // Watch live over several days (a week overview): one column per day with the date on top, the matches below it.
  // With the "MEN/WOMEN" option (d.markComp) every match gets a flat pill behind it (men navy, women purple, both colours from the site).
  // flat colours taken from the Lotto Volley League site: its navy (#07192F) for men, the purple end of its women gradient (#B00C9A) for women
  const SEX_FLAT = { MEN: '#07192f', WOMEN: '#b00c9a' };
  const sexPlate = (ctx, x, y, w, h, women) => { ctx.save(); ctx.fillStyle = SEX_FLAT[women ? 'WOMEN' : 'MEN']; roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore(); };   // fully rounded, like the pills on watch.lottovolleyleague.be
  async function renderWatchWeek(ctx, groups, d) {
    const nCol = groups.length, margin = 60, colW = (1920 - 2 * margin) / nCol, headBase = 352, rowsTop = 392, rowsBottom = 1050;
    const maxRows = Math.max.apply(null, groups.map(g => g.items.length));
    const pitch = Math.min(142, (rowsBottom - rowsTop) / maxRows), dia = pitch - 20, R = dia / 2, k = dia / 110;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let c = 1; c < nCol; c++) ctx.fillRect(margin + colW * c - 1, 300, 2, rowsBottom - 300);   // between the days
    for (let c = 0; c < nCol; c++) {
      const g = groups[c], cx = margin + colW * c + colW / 2, inner = colW - 56;
      // with the MEN/WOMEN plates: [MEN|WOMEN] (crest) VS (crest) [time]; the crests shrink when the column is narrow
      const hp = pitch - 8, pad = hp * 0.3;   // plate height and the inner padding that keeps the text clear of the round ends
      const Rc = d.markComp ? Math.min(R, Math.max(30, (inner / 2 - 10 - pad - 106 * 0.7) / 2)) : R, diaC = Rc * 2;
      const u = d.markComp ? Math.max(0.5, Math.min(Math.max(k, 0.75), (inner / 2 - 2 * Rc - 10 - pad) / 106)) : k;
      const half = d.markComp ? Rc + 40 * u : Math.min(inner / 2 - R, R + 66 * k + 8), rowHalf = d.markComp ? 2 * Rc + 106 * u + 10 + pad : half + R + 26;
      const dt = dayDate(g.key), label = dt ? `${DAYS.en[dt.getDay()]} ${dt.getDate()} ${MONTHS.en[dt.getMonth()]}` : '';
      text(ctx, label, 0, headBase, '400 54px "Monologue"', '#fff', { center: cx, maxWidth: inner });
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(cx - inner / 2, headBase + 18, inner, 3);
      for (let i = 0; i < g.items.length; i++) {
        const r = g.items[i], cy = rowsTop + i * pitch + pitch / 2;
        if (d.markComp) sexPlate(ctx, cx - rowHalf, cy - pitch / 2 + 4, rowHalf * 2, pitch - 8, r.women);
        else if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(cx - rowHalf, rowsTop + i * pitch - 1, rowHalf * 2, 2); }
        for (const [code, cxx] of [[r.left, cx - half], [r.right, cx + half]]) {
          const im = await loadImg(`assets/lvl/teams/${code}.png`);
          ctx.save(); ctx.shadowColor = 'rgba(0,30,70,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cxx, cy, Rc, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          if (im) ctx.drawImage(im, cxx - Rc, cy - Rc, diaC, diaC);
        }
        if (d.showAbbr && !d.markComp) {
          const af = `400 ${36 * k}px "Monologue"`, aw = Math.max(40, half - R - 10 - 52 * k);
          text(ctx, r.left, 0, cy + 13 * k, af, '#fff', { inkLeft: cx - half + R + 10, maxWidth: aw });
          text(ctx, r.right, 0, cy + 13 * k, af, '#fff', { inkRight: cx + half - R - 10, maxWidth: aw });
        }
        const tm = timeOf(r), tag = r.women ? 'WOMEN' : 'MEN', hasT = d.showTime && tm;
        if (d.markComp) {   // MEN/WOMEN on the left of the match, only VS in the middle, the time on the right
          text(ctx, tag, 0, cy + 0.37 * 27 * u, `400 ${27 * u}px "Monologue"`, '#fff', { inkLeft: cx - rowHalf + pad, alpha: 0.9 });
          text(ctx, 'VS', 0, cy + 0.37 * 56 * u, `400 ${56 * u}px "Monologue"`, '#fff', { center: cx });
          if (hasT) text(ctx, tm, 0, cy + 0.37 * 40 * u, `400 ${40 * u}px "Monologue"`, '#fff', { inkRight: cx + rowHalf - pad });
        } else if (hasT) {
          text(ctx, 'VS', 0, cy - 2 * k, `400 ${40 * k}px "Monologue"`, '#fff', { center: cx });
          text(ctx, tm, 0, cy + 38 * k, `400 ${44 * k}px "Monologue"`, '#fff', { center: cx });
        } else text(ctx, 'VS', 0, cy + 16 * k, `400 ${60 * k}px "Monologue"`, '#fff', { center: cx });
      }
    }
  }
  async function renderVis(kind, d, ctx) { await fontsReady; return KINDS[kind].vis === 'mail' ? renderMail(d, ctx) : renderWatch(d, ctx); }
  function visDefaults(kind) {
    if (KINDS[kind].vis === 'mail') return { title: 'Lotto Volley League update', sub: '' };
    return { title: 'Watch live', comp: 'both', day: '', off: [], extra: [], showTime: true, showNames: false, manual: false, list: [], span: 7, showAbbr: false, markComp: false, bgStyle: 'site' };
  }


  // ---------- Background removal (runs in the browser; MODNet portrait matting via transformers.js, Apache-2.0) ----------
  const bgEngines = {};
  let bgLib = null;
  async function bgLoad(kind, msg) {
    if (bgEngines[kind]) return bgEngines[kind];
    msg(kind === 'obj' ? 'Model laden (de eerste keer ± 45 MB, daarna uit de cache)…' : 'Model laden (de eerste keer ± 25 MB, daarna uit de cache)…');
    if (!bgLib) bgLib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6');
    const t = bgLib;
    if (kind === 'obj') bgEngines.obj = { t, seg: await t.pipeline('background-removal', 'onnx-community/ormbg-ONNX', { dtype: 'q8' }) };   // Apache-2.0: the person and what they hold (ball)
    else bgEngines.person = { t, model: await t.AutoModel.from_pretrained('Xenova/modnet', { dtype: 'fp32' }), processor: await t.AutoProcessor.from_pretrained('Xenova/modnet') };   // Apache-2.0: portrait matting
    return bgEngines[kind];
  }
  // mean filter (radius r) over a w x h float plane, via running sums
  function boxMean(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), cs = new Float64Array(Math.max(w, h) + 1);
    for (let y = 0; y < h; y++) {
      const o = y * w; cs[0] = 0; for (let x = 0; x < w; x++) cs[x + 1] = cs[x] + src[o + x];
      for (let x = 0; x < w; x++) { const lo = Math.max(0, x - r), hi = Math.min(w - 1, x + r); tmp[o + x] = (cs[hi + 1] - cs[lo]) / (hi - lo + 1); }
    }
    for (let x = 0; x < w; x++) {
      cs[0] = 0; for (let y = 0; y < h; y++) cs[y + 1] = cs[y] + tmp[y * w + x];
      for (let y = 0; y < h; y++) { const lo = Math.max(0, y - r), hi = Math.min(h - 1, y + r); out[y * w + x] = (cs[hi + 1] - cs[lo]) / (hi - lo + 1); }
    }
    return out;
  }
  // guided filter: snaps the soft mask p to the edges of the photo (guide I), so hair and outlines follow the picture
  function guidedFilter(I, p, w, h, r, eps) {
    const n = w * h, mI = boxMean(I, w, h, r), mp = boxMean(p, w, h, r), Ip = new Float32Array(n), II = new Float32Array(n);
    for (let i = 0; i < n; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
    const cIp = boxMean(Ip, w, h, r), cII = boxMean(II, w, h, r), A = new Float32Array(n), B = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = cII[i] - mI[i] * mI[i], c = cIp[i] - mI[i] * mp[i]; A[i] = c / (v + eps); B[i] = mp[i] - A[i] * mI[i]; }
    const mA = boxMean(A, w, h, r), mB = boxMean(B, w, h, r), q = new Float32Array(n);
    for (let i = 0; i < n; i++) q[i] = mA[i] * I[i] + mB[i];
    return q;
  }
  // keeps the person: every connected piece of the mask that is not tiny compared to the largest one
  function keepMain(alpha, w, h) {
    const lab = new Int32Array(w * h), sizes = [0], stack = new Int32Array(w * h);
    let next = 0;
    for (let i0 = 0; i0 < w * h; i0++) {
      if (alpha[i0] < 0.1 || lab[i0]) continue;
      next++; let sp = 0, cnt = 0; stack[sp++] = i0; lab[i0] = next;
      while (sp) {
        const i = stack[--sp]; cnt++; const x = i % w, y = (i / w) | 0;
        if (x > 0 && !lab[i - 1] && alpha[i - 1] >= 0.1) { lab[i - 1] = next; stack[sp++] = i - 1; }
        if (x < w - 1 && !lab[i + 1] && alpha[i + 1] >= 0.1) { lab[i + 1] = next; stack[sp++] = i + 1; }
        if (y > 0 && !lab[i - w] && alpha[i - w] >= 0.1) { lab[i - w] = next; stack[sp++] = i - w; }
        if (y < h - 1 && !lab[i + w] && alpha[i + w] >= 0.1) { lab[i + w] = next; stack[sp++] = i + w; }
      }
      sizes.push(cnt);
    }
    const big = Math.max.apply(null, sizes);
    for (let i = 0; i < w * h; i++) if (!lab[i] || sizes[lab[i]] < big * 0.04) alpha[i] = 0;
  }
  // image -> canvas with transparent background, trimmed to the person; keep = the photo already has a transparent background
  async function cutOut(img, keep, msg, kind) {
    const sc = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cv.width, cv.height);
    const px = cx.getImageData(0, 0, cv.width, cv.height), a = px.data;
    if (!keep) {
      const eng = await bgLoad(kind, msg), t = eng.t;
      msg('Achtergrond verwijderen…');
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      const w = cv.width, h = cv.height, n = w * h, raw = new Float32Array(n), guide = new Float32Array(n);
      if (kind === 'obj') {
        const url = URL.createObjectURL(blob);
        let r = (await eng.seg([url]))[0]; URL.revokeObjectURL(url);
        if (r.width !== w || r.height !== h) r = await r.resize(w, h);
        for (let i = 0; i < n; i++) raw[i] = r.data[i * 4 + 3] / 255;
      } else {
        const image = await t.RawImage.fromBlob(blob);
        const { pixel_values } = await eng.processor(image);
        const out = await eng.model({ input: pixel_values });
        const mask = await t.RawImage.fromTensor(out.output[0].mul(255).to('uint8')).resize(w, h);
        for (let i = 0; i < n; i++) raw[i] = mask.data[i] / 255;
      }
      for (let i = 0; i < n; i++) guide[i] = (0.299 * a[i * 4] + 0.587 * a[i * 4 + 1] + 0.114 * a[i * 4 + 2]) / 255;
      msg('Randen verfijnen…');
      // background colour = average of what the model calls background (used to take the yellow fringe out of the edge pixels)
      let br = 0, bgc = 0, bb = 0, bn = 0;
      for (let i = 0; i < n; i += 7) if (raw[i] < 0.02) { br += a[i * 4]; bgc += a[i * 4 + 1]; bb += a[i * 4 + 2]; bn++; }
      const q = guidedFilter(guide, raw, w, h, Math.max(4, Math.round(Math.max(w, h) / 220)), 2e-4);
      const al = new Float32Array(n);
      for (let i = 0; i < n; i++) { const v = Math.min(1, Math.max(0, (q[i] - 0.2) / 0.6)); al[i] = v * v * (3 - 2 * v); }
      keepMain(al, w, h);
      // pull the edge in by about two pixels: that is where the old background still shines through
      const er = boxMean(al, w, h, Math.max(2, Math.round(Math.max(w, h) / 700)));
      for (let i = 0; i < n; i++) { const e = Math.min(1, Math.max(0, (er[i] - 0.72) / 0.26)); if (e < al[i]) al[i] = e * e * (3 - 2 * e); }
      for (let i = 0; i < n; i++) {
        const v = al[i]; a[i * 4 + 3] = Math.round(v * 255);
        if (bn > 50 && v > 0 && v < 0.98) {   // edge pixel: remove the share of the old background colour
          const d = Math.max(v, 0.3);
          a[i * 4] = Math.min(255, Math.max(0, (a[i * 4] - (1 - v) * br / bn) / d));
          a[i * 4 + 1] = Math.min(255, Math.max(0, (a[i * 4 + 1] - (1 - v) * bgc / bn) / d));
          a[i * 4 + 2] = Math.min(255, Math.max(0, (a[i * 4 + 2] - (1 - v) * bb / bn) / d));
        }
      }
    }
    let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (a[(y * cv.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) throw new Error('geen persoon gevonden in de foto');
    cx.putImageData(px, 0, 0);
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }
  async function uploadPlayer(file, keep, kind) {
    const msgEl = () => $('thLvlBgMsg'), msg = (t) => { const el = msgEl(); if (el) el.textContent = t; };
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('afbeelding niet te lezen')); i.src = url; });
      const out = await cutOut(img, keep, msg, kind || 'obj'); URL.revokeObjectURL(url);
      const blob = await new Promise(res => out.toBlob(res, 'image/png'));
      const k = itemKey(); setSave('saving');
      const r = await fetch('/api/photo?key=' + enc(k), { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
      if (!r.ok) throw new Error('opslaan mislukt (HTTP ' + r.status + ')');
      cur.photo = await blobToImg(blob); cur.d.hasPhoto = true; cur.d.photoPos = { z: 1, x: 0, y: 0 };
      lastSaved = ''; flushSave(); buildControls(); scheduleRender();
      msg('✓ Achtergrond verwijderd. Sleep op de preview om de speler te verplaatsen.');
    } catch (err) { msg('Mislukt: ' + err.message); setSave('error'); }
  }


  // ---------- Player of the Month (SHL men): overview of four nominees, one post per nominee, a "vote now" story ----------
  const POTM_NAVY = '#1b1b38', POTM_PINK = '#e93b68', POTM_PANEL = '#232244';
  const POTM_FMTS = [['overview', 'Overzicht'], ['p0', 'Nominee 1'], ['p1', 'Nominee 2'], ['p2', 'Nominee 3'], ['p3', 'Nominee 4'], ['story', 'Vote-story']];
  function potmDefaults() {
    return { month: MONTHS.en[(new Date().getMonth() + 11) % 12], fmt: 'overview', players: [0, 1, 2, 3].map(() => ({ first: '', last: '', club: '', hasPhoto: false, z: 1, x: 0, y: 0 })) };
  }
  const potmName = (pl) => `${(pl.first || '').trim()} ${(pl.last || '').trim()}`.trim().toUpperCase();
  // font size at which `str` is exactly `w` wide (capped at `max`)
  const fitSize = (ctx, str, fam, w, max) => { ctx.font = `${fam.replace('{s}', '100')}`; const m = ctx.measureText(str).width; return Math.min(max || 999, 100 * w / Math.max(1, m)); };
  function potmPhoto(ctx, img, x, y, w, h, pos) {   // cover, centred and top-aligned, clipped to the box
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
    if (img) {
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (pos.z || 1), dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      ctx.drawImage(img, x + (w - dw) / 2 + (pos.x || 0), y + (pos.y || 0), dw, dh);
    }
    ctx.restore();
  }
  // an empty slot in the editor preview: a grey portrait silhouette instead of a bare white box (never in an export)
  function potmEmptyPhoto(ctx, x, y, w, h) {
    ctx.save(); ctx.fillStyle = '#eceef6'; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#d3d6e6'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.36, w * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.82, w * 0.46, h * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    text(ctx, 'FOTO', 0, y + h * 0.1, '800 ' + Math.max(16, w * 0.07) + 'px "Unbounded"', '#b4b8cf', { center: x + w / 2 });
  }
  async function renderPotm(d, ctx) {
    await fontsReady;
    await Promise.all(['700 40px ClashDisplay', '300 40px ClashLight', '500 40px ClashMed'].map(f => document.fonts.load(f).catch(() => {})));
    const fmt = d.fmt || 'overview', story = fmt === 'story', [CW, CH] = kindSize('potm', d), month = (d.month || '').toUpperCase().trim();
    const lines = await loadImg('assets/potm/lines.png'), banner = await loadImg('assets/potm/banner.png'), block = await loadImg('assets/potm/title-block.png'), foot = await loadImg('assets/footer-logo.png');
    ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = POTM_NAVY; ctx.fillRect(0, 0, CW, CH);
    if (lines) ctx.drawImage(lines, 0, CH - 1350);
    const footer = (x, y, w) => { if (foot) ctx.drawImage(foot, x, y, w, w * foot.naturalHeight / foot.naturalWidth); };
    if (fmt === 'overview') {
      if (block) ctx.drawImage(block, 0, 80);
      ctx.font = '700 42px "ClashDisplay"'; const nw = ctx.measureText('NOMINEES ').width;
      text(ctx, 'NOMINEES', 67, 336, '700 42px "ClashDisplay"', '#fff');
      text(ctx, month || (d._preview ? 'MAAND' : ''), 67 + nw + 16, 336, '700 42px "ClashDisplay"', POTM_NAVY, { maxWidth: 1000 - nw, alpha: month || !d._preview ? 1 : 0.35 });
      for (let i = 0; i < 4; i++) {
        const pl = d.players[i], x = 60 + 244 * i;
        const ph = cur.potmPhotos && cur.potmPhotos[i], pre = d._preview;
        if (!ph && pre) potmEmptyPhoto(ctx, x, 400, 228, 500); else potmPhoto(ctx, ph, x, 400, 228, 500, pl);
        ctx.fillStyle = POTM_PINK; ctx.fillRect(x, 900, 228, 5);
        ctx.fillStyle = POTM_PANEL; ctx.fillRect(x, 905, 228, 90);
        const hint = (v, t) => v ? [v.toUpperCase(), 1] : pre ? [t, 0.3] : ['', 1];
        const f1 = hint(pl.first, 'VOORNAAM'), f2 = hint(pl.last, 'ACHTERNAAM'), f3 = hint(pl.club, 'CLUB');
        text(ctx, f1[0], x + 14, 934, '500 18px "ClashMed"', '#fff', { maxWidth: 200, alpha: f1[1] });
        text(ctx, f2[0], x + 14, 957, '700 25px "ClashDisplay"', '#fff', { maxWidth: 200, alpha: f2[1], ws: 4 });
        text(ctx, f3[0], x + 14, 978, '700 14px "ClashDisplay"', POTM_PINK, { maxWidth: 200, alpha: f3[1], ws: 4 });
      }
      footer(60, 1161, 485);
    } else if (story) {
      if (banner) ctx.drawImage(banner, 0, 190);
      let sz = fitSize(ctx, 'VOTE NOW', '700 {s}px "ClashDisplay"', 650, 128);
      text(ctx, 'VOTE NOW', 0, 413, `700 ${sz}px "ClashDisplay"`, '#fff', { center: 540, ws: 18 });
      const sub = `WHO IS YOUR PLAYER OF ${month}?`;
      sz = fitSize(ctx, sub, '700 {s}px "ClashDisplay"', 650, 38);
      text(ctx, sub, 0, 461, `700 ${sz}px "ClashDisplay"`, '#fff', { center: 540, ws: 9 });
      footer(357, 1683, 365);
    } else {   // one nominee
      const i = parseInt(fmt.slice(1), 10) || 0, pl = d.players[i];
      if (banner) ctx.drawImage(banner, 0, 0);
      ctx.font = '700 26px "ClashDisplay"';
      text(ctx, `NOMINEE · ${month}`, 0, 66, '700 26px "ClashDisplay"', POTM_NAVY, { inkRight: 1020, maxWidth: 330, ws: 4 });
      if (!(cur.potmPhotos && cur.potmPhotos[i]) && d._preview) potmEmptyPhoto(ctx, 249, 160, 582, 748); else potmPhoto(ctx, cur.potmPhotos && cur.potmPhotos[i], 249, 160, 582, 748, pl);
      ctx.fillStyle = POTM_PINK; ctx.fillRect(249, 908, 582, 7);
      const nm = potmName(pl) || (d._preview ? 'NAAM NOMINEE' : '');
      if (nm) { ctx.save(); ctx.globalAlpha = potmName(pl) ? 1 : 0.3; const sz = fitSize(ctx, nm, '700 {s}px "ClashDisplay"', 800, 88); text(ctx, nm, 0, 1004, `700 ${sz}px "ClashDisplay"`, '#fff', { center: 540, ws: 8 }); ctx.restore(); }
      if (pl.club) { const sz = fitSize(ctx, pl.club.toUpperCase(), '700 {s}px "ClashDisplay"', 560, 36); text(ctx, pl.club.toUpperCase(), 0, 1053, `700 ${sz}px "ClashDisplay"`, POTM_PINK, { center: 540, ws: 6 }); }
      footer(298, 1163, 485);
    }
  }
  async function loadPotmPhotos() {
    cur.potmPhotos = [null, null, null, null];
    await Promise.all(cur.d.players.map(async (pl, i) => {
      if (!pl.hasPhoto) return;
      try { const r = await fetch('/api/photo?key=' + enc(`th:potm:s${cur.slot}:p${i}`), { cache: 'no-store' }); if (r.ok) cur.potmPhotos[i] = await blobToImg(await r.blob()); else pl.hasPhoto = false; } catch (e) { pl.hasPhoto = false; }
    }));
  }
  function uploadPotmPhoto(i, file) {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(im, 0, 0, c.width, c.height);
        c.toBlob((blob) => {
          setSave('saving');
          fetch('/api/photo?key=' + enc(`th:potm:s${cur.slot}:p${i}`), { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return blobToImg(blob); })
            .then(img => { cur.potmPhotos[i] = img; Object.assign(cur.d.players[i], { hasPhoto: true, z: 1, x: 0, y: 0 }); lastSaved = ''; flushSave(); buildControls(); scheduleRender(); })
            .catch(() => setSave('error'));
        }, 'image/jpeg', 0.92);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function potmControls() {
    const d = cur.d, clubs = MEN.clubs.map(([c]) => labelOf(MEN, c));
    const tabs = POTM_FMTS.map(([v, l]) => `<button type="button" class="mode-tab${d.fmt === v ? ' active' : ''}" data-f="${v}">${l}</button>`).join('');
    const pl = d.players.map((p, i) => `<details class="field"${d.fmt === 'p' + i || !p.last ? ' open' : ''}><summary><b>Nominee ${i + 1}</b> ${esc(potmName(p))}</summary>
      <div class="hnl-pair"><input type="text" class="potm-in" data-i="${i}" data-k="first" placeholder="Voornaam" value="${esc(p.first)}"><input type="text" class="potm-in" data-i="${i}" data-k="last" placeholder="Achternaam" value="${esc(p.last)}"></div>
      <input type="text" class="potm-in" data-i="${i}" data-k="club" list="potmClubs" placeholder="Club" value="${esc(p.club)}">
      <label class="photo-btn" for="potmPhoto${i}"><span class="photo-btn-text">${p.hasPhoto ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">een portretfoto, liefst met witte achtergrond</span></label>
      <input type="file" id="potmPhoto${i}" class="potm-file" data-i="${i}" accept="image/*" hidden>
      ${p.hasPhoto ? `<div class="field"><label>Zoom</label><input type="range" class="potm-pos" data-i="${i}" data-k="z" min="100" max="300" value="${Math.round(p.z * 100)}"></div>
      <div class="field"><label>Links - rechts</label><input type="range" class="potm-pos" data-i="${i}" data-k="x" min="-300" max="300" value="${Math.round(p.x)}"></div>
      <div class="field"><label>Omhoog - omlaag</label><input type="range" class="potm-pos" data-i="${i}" data-k="y" min="-400" max="200" value="${Math.round(p.y)}"></div>
      <button class="btn btn-link potm-del" data-i="${i}" type="button">✕ Verwijder foto</button>` : ''}</details>`).join('');
    return `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Maand en weergave</div>
      <div class="field"><label for="potmMonth">Maand</label><input type="text" id="potmMonth" value="${esc(d.month)}"></div>
      <div class="field"><label>Afbeelding</label><div class="mode-tabs mode-tabs-compact potm-tabs" id="potmFmt">${tabs}</div></div></div>
      <div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Nominees</div>${pl}
      <datalist id="potmClubs">${clubs.map(c => `<option value="${esc(c.toUpperCase())}"></option>`).join('')}</datalist>
      <p class="hint">De vote-story laat het midden leeg voor een poll-sticker.</p></div>`;
  }
  async function exportPotmAll() {
    const d = cur.d, files = [], slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const items = [['overview', 'overview']].concat([0, 1, 2, 3].filter(i => potmName(d.players[i])).map(i => ['p' + i, 'nominee-' + slug(d.players[i].last || d.players[i].first)])).concat([['story', 'vote-story']]);
    for (let n = 0; n < items.length; n++) {
      status(`Afbeelding ${n + 1} van ${items.length} maken…`);
      const blob = await blobFor(cur.kind, Object.assign({}, d, { fmt: items[n][0] }), exportFmt, false);
      files.push({ name: `SHL_POTM_${slug(d.month)}_${items[n][1]}.${EXT[exportFmt]}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    download(new Blob([makeZip(files)], { type: 'application/zip' }), `SHL_POTM_${slug(d.month)}.zip`);
    let saved = 0; for (const f of files) { if (await saveOnServer(new Blob([f.data], { type: MIME[exportFmt] }), f.name)) saved++; }
    status(`✓ ${files.length} afbeeldingen in de zip${saved ? ` · ${saved} ook op de server (/exports/)` : ''}`);
  }

  // ---------- SHL Schedule as an e-mail banner (1200 px wide = a 600 px mail at 2x, as high as the matches need) ----------
  // The look of the SHL schedule post: a player photo with the schedule on the right (SCHEDULE, a lime date bar, white match rows,
  // the logo). Without a photo it is the plain navy version. The matches come from the same programme as the SHL thumbnails.
  const SM_NAVY = '#1a1b38', SM_LIME = '#ccff33', SM_INK = '#1b2450';
  const shlMailDefaults = () => ({ dayKey: '', span: 3, title: 'SCHEDULE', sub: '', showTime: true, bg: 'photo', lay: 'wide', hasPhoto: false, cutout: false, z: 1, x: 0, y: 0 });
  // The rows are the ones of the SHL schedule post, drawn from the same team strips (assets/teams/<code>.png: the crest, the code and the
  // coloured lines, 600 px per side) on the same 880x148 row, scaled to the width of the banner.
  const SM_ROW_W = 880, SM_ROW_H = 148;
  async function drawShlRow(ctx, f, x, y, w, showTime) {
    const sc = w / SM_ROW_W, cy = SM_ROW_H / 2, [hi, ai] = await Promise.all([loadImg(`assets/teams/${f.hc}.png`), loadImg(`assets/teams/${f.ac}.png`)]);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = '#f9faff'; ctx.fillRect(0, 0, SM_ROW_W, SM_ROW_H);
    const strip = (img, side, x0, x1) => { if (!img) return; const k = (x1 - x0) / 600, dh = 200 * k; ctx.drawImage(img, side === 'left' ? 0 : 600, 0, 600, 200, x0, cy - dh / 2, x1 - x0, dh); };
    strip(hi, 'left', 15, 440); strip(ai, 'right', 440, 865);
    text(ctx, showTime ? (f.time || '') : 'VS', 0, cy + 17, '700 50px "ClashDisplay"', SM_INK, { center: 440 });
    ctx.restore();
  }
  function shlMailLayout(d) {
    const days = cur.days || [], i0 = Math.max(0, days.findIndex(x => String(x.key) === String(d.dayKey)));
    const st = days[i0] ? seasonDate(days[i0].day, days[i0].month) : null, en = st ? new Date(st.getTime() + ((d.span || 3) - 1) * 86400000 + 3600000) : null;
    const groups = days.filter(x => { if (!st) return false; const t = seasonDate(x.day, x.month); return t >= st && t <= en; }).map(x => ({ day: x, items: x.items.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')) }));
    const total = groups.reduce((n, g) => n + g.items.length, 0), stack = d.lay === 'stack', wide = d.lay !== 'stack' && d.lay !== 'side';
    // wide (default): player on the left, the schedule right of it in two columns: a real banner shape, about 1200 x 500
    const two = wide ? total >= 4 : stack && total >= 5, rw = wide ? (two ? 405 : 520) : stack ? (two ? 540 : 600) : 600;
    const sc = rw / SM_ROW_W, rh = SM_ROW_H * sc, pitch = rh + (wide ? 10 : stack ? 11 : 12), BAR = wide ? 40 : stack ? 48 : 53;
    const cols = two ? 2 : 1, gap = wide ? 20 : 30, blockW = cols * rw + (cols - 1) * gap;
    const x0 = wide ? 1170 - 830 + (830 - blockW) / 2 : stack ? (1200 - blockW) / 2 : 1160 - rw;   // side: right-aligned like the post
    let y = wide ? 128 : stack ? 560 : 170;
    const geo = groups.map((g, i) => { const top = y, rows = Math.ceil(g.items.length / cols); y += BAR + (wide ? 12 : 14) + (rows - 1) * pitch + rh + (i < groups.length - 1 ? (wide ? 16 : 22) : 0); return { top, rows }; });
    const logoW = wide ? 230 : stack ? 380 : 360, logoH = logoW * 174 / 707, logoY = wide ? 30 : y + (stack ? 46 : 54);
    return { groups, geo, rw, rh, pitch, BAR, cols, gap, x0, blockW, stack, wide, logoW, logoH, logoY, H: wide ? Math.max(380, Math.round(y + 34)) : Math.round(logoY + logoH + (stack ? 70 : 50)) };
  }
  async function renderShlMail(d, ctx) {
    await fontsReady; await Promise.all(['700 40px ClashDisplay', '500 40px ClashMed'].map(f => document.fonts.load(f).catch(() => {})));
    const L = shlMailLayout(d), W2 = 1200, H2 = L.H, foot = await loadImg('assets/footer-logo.png'), photo = d.bg !== 'plain' && d.hasPhoto ? cur.smPhoto : null;
    ctx.clearRect(0, 0, W2, H2); ctx.fillStyle = SM_NAVY; ctx.fillRect(0, 0, W2, H2);
    if (photo && d.cutout) {   // the player alone on the navy: stands left (side) or in the middle (stacked), bottom aligned
      const ph = (L.stack ? 600 : L.wide ? H2 * 1.02 : H2 * 0.94) * (d.z || 1), pw = ph * photo.naturalWidth / photo.naturalHeight, cxp = (L.stack ? 600 : L.wide ? 175 : 300) + (d.x || 0), by = (L.stack ? 500 : L.wide ? H2 + 8 : H2 + 10) + (d.y || 0);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.wide ? 380 : W2, L.stack ? 560 : H2); ctx.clip();
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = -8; ctx.shadowOffsetY = 12;
      ctx.drawImage(photo, cxp - pw / 2, by - ph, pw, ph); ctx.restore();
    } else if (photo) {
      ctx.save();
      const bandH = L.stack ? 520 : H2, bandW = L.wide ? 400 : W2; ctx.beginPath(); ctx.rect(0, 0, bandW, bandH); ctx.clip();
      // the photo fills the band's height and at least the left 60% (a portrait photo stays whole), aligned left
      const sc = Math.max((L.stack ? W2 : L.wide ? bandW : W2 * 0.6) / photo.naturalWidth, bandH / photo.naturalHeight) * (d.z || 1), dw = photo.naturalWidth * sc, dh = photo.naturalHeight * sc, maxShift = Math.max(0, dw - bandW);
      ctx.drawImage(photo, Math.max(-maxShift, Math.min(0, d.x || 0)), Math.min(0, Math.max(bandH - dh, (L.stack ? 0 : (bandH - dh) / 2) + (d.y || 0))), dw, dh);   // stacked: aligned to the top so the head stays in view
      if (L.stack) { const g = ctx.createLinearGradient(0, bandH * 0.55, 0, bandH); g.addColorStop(0, 'rgba(26,27,56,0)'); g.addColorStop(1, 'rgba(26,27,56,1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W2, bandH); }
      else if (L.wide) { const g = ctx.createLinearGradient(0, 0, bandW, 0); g.addColorStop(0, 'rgba(26,27,56,0)'); g.addColorStop(0.6, 'rgba(26,27,56,0.2)'); g.addColorStop(1, 'rgba(26,27,56,1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, bandW, H2); }
      else { const g = ctx.createLinearGradient(0, 0, W2, 0); g.addColorStop(0, 'rgba(26,27,56,0.05)'); g.addColorStop(0.42, 'rgba(26,27,56,0.2)'); g.addColorStop(0.62, 'rgba(26,27,56,0.8)'); g.addColorStop(1, 'rgba(26,27,56,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W2, H2); }
      ctx.restore();
    }
    const cx = L.stack ? 600 : L.wide ? L.x0 + L.blockW / 2 : L.x0 + L.rw / 2, title = (d.title || '').toUpperCase().trim();
    const first = L.groups[0] && L.groups[0].items[0], sub = (d.sub || '').trim() || (first && first.round ? `ROUND ${first.round}` : '');
    if (L.wide) {   // title and round on the left of the right-hand area, the logo on its right
      if (title) { const sz = fitSize(ctx, title, '700 {s}px "ClashDisplay"', 420, 66); text(ctx, title, L.x0, 80, `700 ${sz}px "ClashDisplay"`, '#fff', { maxWidth: 420 }); }
      if (sub) text(ctx, sub.toUpperCase(), L.x0 + 2, 112, '700 24px "ClashDisplay"', SM_LIME, { maxWidth: 420 });
    } else {
    if (title) { const sz = fitSize(ctx, title, '700 {s}px "ClashDisplay"', L.stack ? 560 : 500, 86); text(ctx, title, 0, L.stack ? 500 : 100, `700 ${sz}px "ClashDisplay"`, '#fff', { center: cx }); }
    if (sub) text(ctx, sub.toUpperCase(), 0, L.stack ? 548 : 142, '700 28px "ClashDisplay"', SM_LIME, { center: cx, maxWidth: 520 });
    }
    for (let gi = 0; gi < L.groups.length; gi++) {
      const g = L.groups[gi], top = L.geo[gi].top + (sub && !L.stack && !L.wide ? 6 : 0), barW = (L.stack || L.wide) ? L.blockW : Math.round(L.rw * 522 / 600);
      const bx = (L.stack || L.wide) ? L.x0 : cx - barW / 2, pal = gi % 2 ? ['#f47987', '#f1913d'] : ['#c7f23a', '#5fe39a'], bar = ctx.createLinearGradient(bx, 0, bx + barW, 0);
      bar.addColorStop(0, pal[0]); bar.addColorStop(1, pal[1]); ctx.fillStyle = bar; ctx.fillRect(bx, top, barW, L.BAR);
      text(ctx, fmtDate(MEN, g.day.day, g.day.month), 0, top + L.BAR / 2 + 10, `700 ${L.wide ? 22 : L.stack ? 25 : 28}px "ClashDisplay"`, '#14142b', { center: bx + barW / 2, maxWidth: barW - 24 });
      for (let i = 0; i < g.items.length; i++) {
        const col = L.cols === 2 ? i % 2 : 0, row = L.cols === 2 ? Math.floor(i / 2) : i;
        await drawShlRow(ctx, g.items[i], L.x0 + col * (L.rw + L.gap), top + L.BAR + 14 + row * L.pitch, L.rw, d.showTime);
      }
    }
    if (foot) { if (L.wide) ctx.drawImage(foot, 1170 - L.logoW, L.logoY, L.logoW, L.logoH); else ctx.drawImage(foot, (L.stack ? 600 : cx) - L.logoW / 2, L.logoY + (sub && !L.stack ? 6 : 0), L.logoW, L.logoH); }
  }
  async function loadShlMailPhoto() {
    cur.smPhoto = null;
    if (!cur.d.hasPhoto) return;
    try { const r = await fetch('/api/photo?key=' + enc(`th:shlmail:s${cur.slot}`), { cache: 'no-store' }); if (r.ok) cur.smPhoto = await blobToImg(await r.blob()); else cur.d.hasPhoto = false; } catch (e) { cur.d.hasPhoto = false; }
  }
  function uploadShlMailPhoto(file, remove) {
    const msg = (t) => { const el = $('smBgMsg'); if (el) el.textContent = t; };
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = async () => {
        try {
          let blob, type;
          if (remove) {   // the player alone (background removed in the browser), trimmed, as a PNG
            const out = await cutOut(im, false, msg, 'obj'); blob = await new Promise(res => out.toBlob(res, 'image/png')); type = 'image/png';
          } else {
            const sc = Math.min(1, 2200 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
            c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.92)); type = 'image/jpeg';
          }
          setSave('saving');
          const r = await fetch('/api/photo?key=' + enc(`th:shlmail:s${cur.slot}`), { method: 'PUT', headers: { 'Content-Type': type }, body: blob });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          cur.smPhoto = await blobToImg(blob); Object.assign(cur.d, { hasPhoto: true, cutout: !!remove, bg: 'photo', z: 1, x: 0, y: 0 });
          lastSaved = ''; flushSave(); buildControls(); scheduleRender();
        } catch (err) { msg('Mislukt: ' + err.message); setSave('error'); }
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function shlMailControls() {
    const d = cur.d, days = cur.days || [], L = shlMailLayout(d);
    const dayOpts = days.map(x => `<option value="${x.key}"${String(d.dayKey) === String(x.key) ? ' selected' : ''}>${esc(dayLabel(x))}</option>`).join('');
    return `<div class="panel-step"><div class="panel-step-title">Opmaak</div>
      <div class="mode-tabs mode-tabs-compact potm-tabs" id="smLay"><button type="button" class="mode-tab${d.lay !== 'stack' && d.lay !== 'side' ? ' active' : ''}" data-l="wide">Breed</button><button type="button" class="mode-tab${d.lay === 'side' ? ' active' : ''}" data-l="side">Als de post</button><button type="button" class="mode-tab${d.lay === 'stack' ? ' active' : ''}" data-l="stack">Langer</button></div>
      <p class="hint" style="margin-top:8px">Breed is een echte mailbanner (speler links, de wedstrijden in twee kolommen). Als de post is het ontwerp van de schedule-post. Langer zet de foto bovenaan en de lijst eronder.</p>
      <div class="panel-step-title" style="margin-top:14px">Achtergrond</div>
      <div class="mode-tabs mode-tabs-compact" id="smBg"><button type="button" class="mode-tab${d.bg !== 'plain' ? ' active' : ''}" data-b="photo">Met foto</button><button type="button" class="mode-tab${d.bg === 'plain' ? ' active' : ''}" data-b="plain">Effen navy</button></div>
      <label class="hnl-check" style="margin-top:10px"><input type="checkbox" id="smCut" ${window.SM_CUT === false ? '' : 'checked'}> Achtergrond van de foto verwijderen (voor een portret met witte of drukke achtergrond; alleen de speler blijft over)</label>
      <label class="photo-btn" for="smPhoto"><span class="photo-btn-text">${d.hasPhoto ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">${d.cutout ? 'nu: alleen de speler' : 'een speler- of sfeerfoto'} · het uitsnijden duurt een paar seconden</span></label>
      <input type="file" id="smPhoto" accept="image/*" hidden>
      <p class="hint" id="smBgMsg"></p>
      ${d.hasPhoto ? `<div class="field"><label>Zoom</label><input type="range" id="smZ" min="100" max="300" value="${Math.round((d.z || 1) * 100)}"></div>
      <div class="field"><label>Links - rechts</label><input type="range" id="smX" min="-600" max="600" value="${Math.round(d.x || 0)}"></div>
      <div class="field"><label>Omhoog - omlaag</label><input type="range" id="smY" min="-500" max="500" value="${Math.round(d.y || 0)}"></div>
      <button class="btn btn-link" id="smPhotoDel" type="button">✕ Verwijder foto</button>` : ''}</div>
      <div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Speeldagen</div>
      ${days.length ? `<div class="field"><label for="smDay">Eerste speeldag</label><select id="smDay">${dayOpts}</select></div>
      <div class="field"><label for="smSpan">Aantal dagen (alle speeldagen daarbinnen)</label><select id="smSpan">${[1, 2, 3, 4, 5, 7].map(n => `<option value="${n}"${(d.span || 3) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div>` : '<p class="hint">Het programma is niet beschikbaar.</p>'}
      <p class="hint">${L.groups.reduce((n, g) => n + g.items.length, 0)} wedstrijden op ${L.groups.length} speeldag(en), uit hetzelfde programma als de SHL-thumbnails.</p></div>
      <div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Tekst</div>
      <div class="field"><label for="smTitle">Titel</label><input type="text" id="smTitle" value="${esc(d.title)}"></div>
      <div class="field"><label for="smSub">Regel eronder (leeg = automatisch de speelronde)</label><input type="text" id="smSub" value="${esc(d.sub)}" placeholder="bijv. ROUND 13"></div>
      <label class="hnl-check"><input type="checkbox" id="smTime"${d.showTime ? ' checked' : ''}> Aanvangstijd tonen (anders VS)</label>
      <p class="hint">Export is 1200 px breed, voor een mail van 600 px (scherp op retina). De hoogte volgt het aantal wedstrijden.</p></div>`;
  }
  // ---------- Per-kind rendering ----------
  async function renderThumb(kind, d, ctx, photo) {
    await fontsReady; await nextReady; await SETTINGS.ready;
    if (KINDS[kind].shlmail) { await renderShlMail(d, ctx); return; }
    if (KINDS[kind].potm) { await renderPotm(d, ctx); return; }
    if (KINDS[kind].vis) { await renderVis(kind, d, ctx); return; }
    if (KINDS[kind].lvl) { await renderLvl(kind, d, ctx, photo); return; }
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
        const jid = WOMEN_JPG[code] || code; const lg = await loadImg(SETTINGS.logo('hnl:' + jid, `assets/hnl/clubs/${jid}.jpg`)); if (lg) c.drawImage(lg, ox + 18 + (273 - 232) / 2, oy + 19 + (272 - 232) / 2, 232, 232);
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
        const im = await loadImg(SETTINGS.logo('hnl:' + id, `assets/hnl/clubs/${id}.jpg`)); if (im) c.drawImage(im, x, 122, 229, 229);
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
    const [cw, ch] = kindSize(cur.kind, cur.d);
    const off = document.createElement('canvas'); off.width = cw; off.height = ch;
    await renderThumb(cur.kind, KINDS[cur.kind].potm ? Object.assign({}, cur.d, { _preview: true }) : cur.d, off.getContext('2d'), cur.photo);
    if (seq !== rendering) return;
    const cv = canvas(); cv.width = cw; cv.height = ch; cv.getContext('2d').drawImage(off, 0, 0);
    const apiEl = $('thApiUrl'); if (apiEl && API_KINDS.includes(cur.kind)) apiEl.textContent = apiExampleFor(cur.kind, cur.d);   // the API link follows the choices
    cv.classList.toggle('tall', ch > cw * 1.3);   // long watch-live lists: show the full image and scroll instead of shrinking it
  }
  const scheduleRender = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } };

  // persistence (Next kinds: per slot on the server; SHL/SHLW: last choices in localStorage)
  const enc = encodeURIComponent;
  let saveTimer = 0, lastSaved = '';
  const indicator = () => document.getElementById('thSave');
  const LABELS = { idle: '', loading: 'Laden…', pending: '● Wijzigingen nog niet opgeslagen', saving: 'Opslaan…', saved: '✓ Opgeslagen op de server', error: 'Opslaan mislukt — probeer opnieuw' };
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
    return { home, away, homeName: SETTINGS.name('hnl:' + home, (nextById[home] || {}).name || home), awayName: SETTINGS.name('hnl:' + away, (nextById[away] || {}).name || away), date: 'zaterdag 5 september', time: men ? '20:00' : '20:15' };
  }
  function lvlDefaults(kind) { const c = LVL[kind].clubs; return { home: c[0][0], away: c[1][0], dt: '', season: '2026/2027', fixture: '' }; }
  function shlDefaults() { return { hasPhoto: false, photoPos: { z: 1, x: 0, y: 0 }, home: '', away: '', date: '', time: '', title: SETTINGS.text('th.title', 'Livestream'), variant: 'live', label: SETTINGS.text('th.label', 'Regular season'), homeLabel: '', awayLabel: '', fixture: '' }; }

  const byDate = (a, b) => (((a.month + 4) % 12) * 100 + a.day) - (((b.month + 4) % 12) * 100 + b.day) || (a.time || '').localeCompare(b.time || '');
  // every fixture of the competition from the server's own store (played + upcoming), with our club codes
  async function fetchAllFixtures(kind) {
    const cfg = kind === 'shl' ? MEN : WOMEN;
    const r = await fetch('/api/schedule?comp=' + (kind === 'shl' ? 'men' : 'women'));
    const data = await r.json();
    return (data.fixtures || []).map(f => ({ ...f, hc: codeOf(cfg, f.home), ac: codeOf(cfg, f.away) })).filter(f => f.hc && f.ac && f.hc !== f.ac).sort(byDate);
  }
  async function loadFixtures(kind) {
    try {
      const fx = await fetchAllFixtures(kind);
      const upcoming = fx.filter(f => !f.played);
      cur.fixtures = upcoming.length ? upcoming : fx;
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
  const clubSelect = (id, cfg, v) => `<select id="${id}">${cfg.clubs.map(([c]) => `<option value="${esc(c)}"${c === v ? ' selected' : ''}>${esc(labelOf(cfg, c))}</option>`).join('')}</select>`;
  const nextSelect = (id, v) => `<select id="${id}">${nextClubs.map(c => `<option value="${esc(c.id)}"${c.id === v ? ' selected' : ''}>${esc(SETTINGS.label('hnl:' + c.id, c.label))}</option>`).join('')}</select>`;

  function visControls() {
    const d = cur.d, K = KINDS[cur.kind];
    if (K.vis === 'mail') {
      return `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Tekst</div>
        <div class="field"><label for="visTitle">Titel</label><input type="text" id="visTitle" value="${esc(d.title)}"></div>
        <div class="field"><label for="visSub">Ondertitel (optioneel)</label><input type="text" id="visSub" value="${esc(d.sub)}" placeholder="bijv. Speelronde 5"></div>
        <p class="hint">De titel past zichzelf aan: een korte titel staat groot op één regel, een lange wordt automatisch verkleind of over twee regels verdeeld. Export is 1200×400 px, voor een mail van 600 px breed (scherp op retina).</p></div>`;
    }
    const days = watchDays(d), rows = watchDayRows(d), off = d.off || [], winDays = d.manual ? [] : watchWindow(d);
    const clubOpts = (sel) => lvlAllClubs().map(([c, n]) => `<option value="${esc(c)}"${c === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const comps = [['both', 'Heren en dames'], ['men', 'Heren'], ['women', 'Dames']];
    const modeTabs = `<div class="field"><label>Bron</label><div class="mode-tabs mode-tabs-compact" id="visMode"><button type="button" class="mode-tab${d.manual ? '' : ' active'}" data-m="prog">Uit het programma</button><button type="button" class="mode-tab${d.manual ? ' active' : ''}" data-m="manual">Zelf invullen</button></div></div>`;
    const opmaak = `<div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Opmaak</div>
        <div class="field"><label for="visTitle">Titel</label><input type="text" id="visTitle" value="${esc(d.title)}"></div>
        <div class="field"><label for="visBg">Achtergrond</label><select id="visBg"><option value="site"${d.bgStyle !== 'thumb' ? ' selected' : ''}>Website (blauwverloop met gele cirkel)</option><option value="thumb"${d.bgStyle === 'thumb' ? ' selected' : ''}>Thumbnail (diagonaal verloop, paars bij alleen dames)</option></select></div>
        <label class="hnl-check"><input type="checkbox" id="visTime"${d.showTime ? ' checked' : ''}> Aanvangstijd bij de datum tonen</label>
        <label class="hnl-check"><input type="checkbox" id="visNames"${d.showNames ? ' checked' : ''}> Clubnamen tonen</label>
        <label class="hnl-check"><input type="checkbox" id="visMark"${d.markComp ? ' checked' : ''}> Balkje per wedstrijd met MEN of WOMEN (kleuren van de LVL-site: heren donkerblauw, dames paars)</label>
        <label class="hnl-check"><input type="checkbox" id="visAbbr"${d.showAbbr ? ' checked' : ''}> Afkorting van de club naast het logo (bijv. ROE, WAR)</label>
        <p class="hint">Standaard staan de datum en tijd tussen de logo's, zonder clubnamen: de clubs kennen mensen wel. De kleur volgt de thumbnails: blauw voor heren (en gemengd), paars voor alleen dames. Eén speeldag: een of twee kolommen met datum en tijd bij elke wedstrijd. Meer speeldagen (een weekoverzicht): één kolom per dag met de datum erboven, tot vier dagen; de clubnamen blijven dan weg.</p></div>`;
    if (d.manual) {
      const list = d.list || [];
      const sexSel = (i, w) => `<select class="vis-m" data-i="${i}" data-f="women"><option value="0"${w ? '' : ' selected'}>Heren</option><option value="1"${w ? ' selected' : ''}>Dames</option></select>`;
      return `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Wedstrijden</div>${modeTabs}
        ${list.length ? '' : '<p class="hint">Nog geen wedstrijden. Voeg ze hieronder toe, of neem de wedstrijden van een speeldag uit het programma over en pas ze daarna aan.</p>'}
        ${list.map((r, i) => `<div class="field vis-mrow" style="border:1px solid var(--line);border-radius:10px;padding:10px;display:grid;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center"><label style="margin:0">Wedstrijd ${i + 1}</label><span style="display:flex;gap:4px;align-items:center">
            <button type="button" class="btn btn-link vis-mmove" data-i="${i}" data-dir="-1"${i ? '' : ' disabled'} title="Omhoog">↑</button>
            <button type="button" class="btn btn-link vis-mmove" data-i="${i}" data-dir="1"${i < list.length - 1 ? '' : ' disabled'} title="Omlaag">↓</button>
            <button type="button" class="btn btn-link vis-mdel" data-i="${i}" title="Verwijderen">✕</button></span></div>
          <select class="vis-m" data-i="${i}" data-f="left">${clubOpts(r.left)}</select>
          <select class="vis-m" data-i="${i}" data-f="right">${clubOpts(r.right)}</select>
          <div style="display:grid;grid-template-columns:1fr auto;gap:6px"><input type="text" class="vis-m" data-i="${i}" data-f="dt" value="${esc(r.dt || '')}" placeholder="22/10 - 20:30">${sexSel(i, r.women)}</div>
        </div>`).join('')}
        <button class="btn btn-link" id="visMAdd" type="button">+ Wedstrijd toevoegen</button>
        ${rows.length ? `<button class="btn btn-link" id="visMCopy" type="button">Wedstrijden van speeldag ${esc(d.day)} overnemen</button>` : ''}
        <p class="hint">Datum en tijd vul je vrij in, bijv. "22/10 - 20:30". Alles wat je hier invult komt precies zo, in deze volgorde, op de afbeelding.</p></div>` + opmaak;
    }
    return `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Wedstrijden</div>${modeTabs}
      <div class="field"><label>Competitie</label><div class="mode-tabs mode-tabs-compact" id="visComp">${comps.map(([v, l]) => `<button type="button" class="mode-tab${d.comp === v ? ' active' : ''}" data-c="${v}">${l}</button>`).join('')}</div></div>
      ${days.length ? `<div class="field"><label for="visDay">Eerste speeldag</label><select id="visDay">${days.map(k => `<option value="${k}"${k === d.day ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="field"><label for="visSpan">Aantal dagen (7 = de hele week)</label><select id="visSpan">${[1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => `<option value="${n}"${(d.span || 7) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      ${winDays.length > 4 ? `<p class="hint" style="color:#ffb4a8">Dit zijn ${winDays.length} speeldagen: er passen er vier op de afbeelding. Kies minder dagen.</p>` : ''}` : '<p class="hint">Geen programma geladen: lees hieronder een CSV in of voeg zelf wedstrijden toe.</p>'}
      ${rows.length ? `<div class="field"><label>Op de afbeelding</label>${watchGroups(rows).map(g => `<div style="margin:8px 0 2px;font-weight:700;opacity:.8">${esc(g.key)}</div>` + g.items.map(r => `<label class="hnl-check"><input type="checkbox" class="vis-pick" data-k="${esc(watchKey(r))}"${off.includes(watchKey(r)) ? '' : ' checked'}> ${esc(lvlClubName(r.left))} – ${esc(lvlClubName(r.right))} <small>${esc(timeOf(r))}</small></label>`).join('')).join('')}</div>` : ''}
      ${(d.extra || []).filter(r => winDays.includes(dayKeyOf(r.dt))).map((r) => `<div class="field"><label>Zelf toegevoegd</label><div class="hnl-pair"><span>${esc(lvlClubName(r.left))} – ${esc(lvlClubName(r.right))} · ${esc(r.dt)}</span><button type="button" class="btn btn-link vis-xdel" data-i="${d.extra.indexOf(r)}">✕</button></div></div>`).join('')}
      <details class="field"><summary>Wedstrijd zelf toevoegen</summary>
        <div class="field"><label for="visXHome">Thuis</label><select id="visXHome">${clubOpts('')}</select></div>
        <div class="field"><label for="visXAway">Uit</label><select id="visXAway">${clubOpts(lvlAllClubs()[1][0])}</select></div>
        <div class="field"><label for="visXDt">Datum en tijd</label><input type="text" id="visXDt" value="${esc(d.day ? d.day + ' - 20:30' : '')}" placeholder="22/10 - 20:30"></div>
        <button class="btn btn-link" id="visAdd" type="button">+ Toevoegen</button></details>
      <label class="photo-btn" for="visCsv"><span class="photo-btn-text">Nieuw programma inlezen (CSV)</span><span class="photo-btn-sub">${(cur.lvlAll || []).length} wedstrijden geladen · kolommen: Naam, bg, LogoLinks, LogoRechts, TijdText</span></label>
      <input type="file" id="visCsv" accept=".csv,text/csv" hidden></div>
      ` + opmaak;
  }

  function buildControls() {
    const box = $('thControls'); if (!box || !cur.d) return;
    const d = cur.d, K = KINDS[cur.kind];
    let html = '';
    if (K.shlmail) {
      html += shlMailControls();
    } else if (K.potm) {
      html += potmControls();
    } else if (K.vis) {
      html += visControls();
    } else if (K.lvl) {
      const clubs = LVL[cur.kind].clubs, rows = cur.lvlRows || [];
      const sel = (id, v) => `<select id="${id}">${clubs.map(([c, n]) => `<option value="${esc(c)}"${c === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
      const mOpts = rows.map((r, i) => `<option value="${i}"${d.fixture === `${r.left}-${r.right}|${r.dt}` ? ' selected' : ''}>${esc(r.dt)} · ${esc(lvlName(cur.kind, r.left))} – ${esc(lvlName(cur.kind, r.right))}</option>`).join('');
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Wedstrijd</div>
        ${rows.length ? `<div class="field"><label for="thLvlMatch">Wedstrijd uit het programma</label><select id="thLvlMatch"><option value="">— zelf invullen —</option>${mOpts}</select></div>` : '<p class="hint">Geen programma geladen: kies hieronder zelf de clubs.</p>'}
        <div class="field"><label for="thLvlHome">Thuisclub</label>${sel('thLvlHome', d.home)}</div>
        <div class="field"><label for="thLvlAway">Uitclub</label>${sel('thLvlAway', d.away)}</div>
        <button class="btn btn-link" id="thLvlSwap" type="button">⇄ Thuis en uit omdraaien</button>
        <div class="field"><label for="thLvlDt">Datum en tijd</label><input type="text" id="thLvlDt" value="${esc(d.dt)}" placeholder="17/10 - 20:30"></div>
        <div class="field"><label for="thLvlSeason">Seizoen (grote tekst rechtsboven)</label><input type="text" id="thLvlSeason" value="${esc(d.season)}"></div></div>
        <div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Programma</div>
        <label class="photo-btn" id="thLvlDrop" for="thLvlCsv"><span class="photo-btn-text">Nieuw programma inlezen (CSV)</span><span class="photo-btn-sub">${rows.length} wedstrijden geladen · kolommen: Naam, bg, LogoLinks, LogoRechts, TijdText</span></label>
        <input type="file" id="thLvlCsv" accept=".csv,text/csv" hidden>
        <p class="hint">Een nieuwe CSV vervangt het programma voor heren én dames; de wedstrijden van deze competitie verschijnen in de lijst hierboven.</p></div>
        <div class="panel-step"><div class="panel-step-title"><span class="step-num">3</span> Speler (optioneel)</div>
        <label class="photo-btn" id="thLvlPhotoDrop" for="thLvlPhoto"><span class="photo-btn-text">${d.hasPhoto ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">de achtergrond wordt automatisch verwijderd · klik, of sleep hier een foto in</span></label>
        <input type="file" id="thLvlPhoto" accept="image/*" hidden>
        <div class="field"><label for="thLvlModel">Uitsnijden</label><select id="thLvlModel"><option value="obj">Speler en wat die vasthoudt (bal)</option><option value="person">Alleen de persoon (sneller)</option></select></div>
        <label class="hnl-check"><input type="checkbox" id="thLvlKeep"> De foto heeft al een transparante achtergrond (PNG): niet verwijderen</label>
        <p class="hint" id="thLvlBgMsg"></p>
        ${d.hasPhoto ? `<div class="field"><label for="thLvlZoom">Grootte</label><input type="range" id="thLvlZoom" min="50" max="400" value="${Math.round(d.photoPos.z * 100)}"></div>
        <button class="btn btn-link" id="thPhotoRemove" type="button">✕ Verwijder foto</button><p class="hint">Sleep op de preview om de speler te verschuiven, scroll op de preview om in of uit te zoomen.</p>` : ''}</div>`;
    } else if (K.next) {
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> Wedstrijd</div>
        <div class="field"><label for="thSlot">Opslagplek</label><select id="thSlot">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === cur.slot ? ' selected' : ''}>Slot ${i + 1}</option>`).join('')}</select></div>
        <div class="field"><label for="thHome">Thuisclub (logo)</label>${nextSelect('thHome', d.home)}</div>
        <div class="field"><label for="thHomeName">Naam thuis</label><input type="text" id="thHomeName" value="${esc(d.homeName)}"></div>
        <div class="field"><label for="thAway">Uitclub (logo)</label>${nextSelect('thAway', d.away)}</div>
        <div class="field"><label for="thAwayName">Naam uit</label><input type="text" id="thAwayName" value="${esc(d.awayName)}"></div>
        <div class="field"><label for="thDate">Datum</label><input type="text" id="thDate" value="${esc(d.date)}"></div>
        <div class="field"><label for="thTime">Aanvang</label><input type="text" id="thTime" value="${esc(d.time)}"></div>
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
        <div class="field"><label for="thTime">Aanvang</label><input type="text" id="thTime" value="${esc(d.time)}"></div></div>
        <div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Opmaak</div>
        ${cur.kind === 'shl' ? `<div class="field"><label>Type</label><div class="mode-tabs mode-tabs-compact" id="thVariant"><button type="button" class="mode-tab${d.variant === 'live' ? ' active' : ''}" data-v="live">Livestream</button><button type="button" class="mode-tab${d.variant === 'highlights' ? ' active' : ''}" data-v="highlights">Highlights</button></div></div>
        <div class="field"${d.variant === 'highlights' ? '' : ' hidden'} id="thLabelField"><label for="thLabel">Label in de balk (highlights)</label><input type="text" id="thLabel" value="${esc(d.label)}"></div>` : ''}
        <div class="field"${cur.kind === 'shl' && d.variant === 'highlights' ? ' hidden' : ''} id="thTitleField"><label for="thTitle">Titel onderin</label><input type="text" id="thTitle" value="${esc(d.title)}"></div>
        <label class="photo-btn" id="thPhotoDrop" for="thPhotoInput"><span class="photo-btn-text">${d.hasPhoto ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">klik, of sleep hier een afbeelding in · de foto verschijnt rechts</span></label>
        <input type="file" id="thPhotoInput" accept="image/*" hidden>
        ${d.hasPhoto ? `<div class="field"><label for="thZoom">Zoom</label><input type="range" id="thZoom" min="100" max="300" value="${Math.round(d.photoPos.z * 100)}"></div>
        <button class="btn btn-link" id="thPhotoRemove" type="button">✕ Verwijder foto</button><p class="hint">Sleep op de preview om de foto te verschuiven. Zoom in om hem ook naar links te kunnen schuiven.</p>
        <label class="hnl-check"><input type="checkbox" id="thZipPhoto"> Foto ook gebruiken in de zip van de hele speeldag</label>` : ''}</div>`;
    }
    html += `<div class="panel-step panel-step-last"><div class="panel-step-title"><span class="step-num">${K.shlmail ? 3 : K.potm ? 3 : K.vis ? (K.vis === 'mail' ? 2 : 3) : K.next ? 2 : K.lvl ? 4 : 3}</span> Exporteren</div>
      <div class="field"><label>Formaat</label><div class="mode-tabs mode-tabs-compact" id="thFormat"><button type="button" class="mode-tab active" data-f="jpeg">JPG</button><button type="button" class="mode-tab" data-f="webp">WebP</button><button type="button" class="mode-tab" data-f="png">PNG</button></div></div>
      <button class="btn btn-primary" id="thExport" type="button">Exporteer deze thumbnail</button>
      ${K.shlmail ? '' : K.potm ? '<button class="btn btn-link" id="thExportDay" type="button">Alles exporteren (zip met overzicht, nominees en story)</button>' : K.next || K.vis ? '' : K.lvl ? '<button class="btn btn-link" id="thExportDay" type="button">Alle wedstrijden uit het programma (zip)</button>' : '<button class="btn btn-link" id="thExportDay" type="button">Hele speeldag (zip)</button>'}
      <p class="save-status" id="thStatus" hidden></p></div>`;
    html += apiPanelHtml();
    box.innerHTML = html;
    bind();
  }

  let exportFmt = 'jpeg';
  function bind() {
    const d = cur.d;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    const set = (patch, rebuild) => { Object.assign(d, patch); scheduleRender(); scheduleSave(); if (rebuild) buildControls(); };
    on('thSlot', 'change', (e) => { flushSave().then(() => { cur.slot = parseInt(e.target.value, 10); loadItem(); }); });
    on('thHome', 'change', (e) => { if (KINDS[cur.kind].next) set({ home: e.target.value, homeName: SETTINGS.name('hnl:' + e.target.value, (nextById[e.target.value] || {}).name || e.target.value) }, true); else { const cfg = cur.kind === 'shl' ? MEN : WOMEN; set({ home: e.target.value, homeLabel: labelOf(cfg, e.target.value) }, true); } });
    on('thAway', 'change', (e) => { if (KINDS[cur.kind].next) set({ away: e.target.value, awayName: SETTINGS.name('hnl:' + e.target.value, (nextById[e.target.value] || {}).name || e.target.value) }, true); else { const cfg = cur.kind === 'shl' ? MEN : WOMEN; set({ away: e.target.value, awayLabel: labelOf(cfg, e.target.value) }, true); } });
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
    // Lotto Volley League
    const applyLvlRow = (r) => { Object.assign(d, { home: r.left, away: r.right, dt: r.dt, fixture: `${r.left}-${r.right}|${r.dt}` }); };
    on('thLvlMatch', 'change', (e) => { const r = (cur.lvlRows || [])[parseInt(e.target.value, 10)]; if (r) { applyLvlRow(r); scheduleRender(); scheduleSave(); buildControls(); } else set({ fixture: '' }); });
    on('thLvlHome', 'change', (e) => set({ home: e.target.value, fixture: '' }));
    on('thLvlAway', 'change', (e) => set({ away: e.target.value, fixture: '' }));
    on('thLvlSwap', 'click', () => set({ home: d.away, away: d.home, fixture: '' }, true));
    on('thLvlDt', 'input', (e) => set({ dt: e.target.value, fixture: '' }));
    on('thLvlSeason', 'input', (e) => set({ season: e.target.value }));
    on('thLvlCsv', 'change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const rows = parseCsv(decodeCsv(await f.arrayBuffer())).filter(r => r.LogoLinks && r.LogoRechts && r.TijdText);
        if (!rows.length) { status('Geen wedstrijden gevonden: controleer de kolommen (Naam, bg, LogoLinks, LogoRechts, TijdText)'); return; }
        const r = await fetch('/api/item?key=' + enc('lvl:schedule'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'lvl-schedule', v: 1, data: { rows, at: Date.now() } }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        await loadLvlRows(cur.kind);
        const first = cur.lvlRows[0]; if (first) applyLvlRow(first);
        buildControls(); scheduleRender(); scheduleSave();
        status(`✓ Programma ingelezen: ${rows.length} wedstrijden (${cur.lvlRows.length} voor deze competitie)`);
      } catch (err) { status('Inlezen mislukt: ' + err.message); }
    });
    // SHL Schedule e-mail banner
    document.querySelectorAll('#smLay [data-l]').forEach(b => b.addEventListener('click', () => set({ lay: b.dataset.l }, true)));
    document.querySelectorAll('#smBg [data-b]').forEach(b => b.addEventListener('click', () => set({ bg: b.dataset.b }, true)));
    on('smCut', 'change', (e) => { window.SM_CUT = e.target.checked; });
    on('smPhoto', 'change', (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadShlMailPhoto(f, !!($('smCut') && $('smCut').checked)); });
    on('smZ', 'input', (e) => set({ z: parseInt(e.target.value, 10) / 100 }));
    on('smX', 'input', (e) => set({ x: parseInt(e.target.value, 10) }));
    on('smY', 'input', (e) => set({ y: parseInt(e.target.value, 10) }));
    on('smPhotoDel', 'click', () => { fetch('/api/photo?key=' + enc(`th:shlmail:s${cur.slot}`), { method: 'DELETE' }).catch(() => {}); cur.smPhoto = null; Object.assign(cur.d, { hasPhoto: false, z: 1, x: 0, y: 0 }); scheduleSave(); buildControls(); scheduleRender(); });
    on('smDay', 'change', (e) => set({ dayKey: e.target.value }, true));
    on('smSpan', 'change', (e) => set({ span: parseInt(e.target.value, 10) }, true));
    on('smTitle', 'input', (e) => set({ title: e.target.value }));
    on('smSub', 'input', (e) => set({ sub: e.target.value }));
    on('smTime', 'change', (e) => set({ showTime: e.target.checked }));
    // Player of the Month
    on('potmMonth', 'input', (e) => set({ month: e.target.value }));
    document.querySelectorAll('#potmFmt [data-f]').forEach(b => b.addEventListener('click', () => set({ fmt: b.dataset.f }, true)));
    document.querySelectorAll('.potm-in').forEach(el => el.addEventListener('input', () => { d.players[+el.dataset.i][el.dataset.k] = el.value; scheduleRender(); scheduleSave(); }));
    document.querySelectorAll('.potm-file').forEach(el => el.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadPotmPhoto(+el.dataset.i, f); }));
    document.querySelectorAll('.potm-pos').forEach(el => el.addEventListener('input', () => { const p = d.players[+el.dataset.i], v = parseInt(el.value, 10); p[el.dataset.k] = el.dataset.k === 'z' ? v / 100 : v; scheduleRender(); scheduleSave(); }));
    document.querySelectorAll('.potm-del').forEach(el => el.addEventListener('click', () => { const i = +el.dataset.i; fetch('/api/photo?key=' + enc(`th:potm:s${cur.slot}:p${i}`), { method: 'DELETE' }).catch(() => {}); cur.potmPhotos[i] = null; Object.assign(d.players[i], { hasPhoto: false, z: 1, x: 0, y: 0 }); scheduleSave(); buildControls(); scheduleRender(); }));
    // Lotto Volley League visuals (mail header, watch live)
    on('visTitle', 'input', (e) => set({ title: e.target.value }));
    on('visSub', 'input', (e) => set({ sub: e.target.value }));
    document.querySelectorAll('#visComp [data-c]').forEach(b => b.addEventListener('click', () => set({ comp: b.dataset.c, off: [] }, true)));
    on('visDay', 'change', (e) => set({ day: e.target.value, off: [] }, true));
    on('visSpan', 'change', (e) => set({ span: parseInt(e.target.value, 10), off: [] }, true));
    document.querySelectorAll('.vis-pick').forEach(cb => cb.addEventListener('change', () => { const o = new Set(d.off || []); if (cb.checked) o.delete(cb.dataset.k); else o.add(cb.dataset.k); set({ off: Array.from(o) }); }));
    on('visTime', 'change', (e) => set({ showTime: e.target.checked }));
    // filling the watch-live list in by hand
    document.querySelectorAll('#visMode [data-m]').forEach(b => b.addEventListener('click', () => {
      const manual = b.dataset.m === 'manual';
      if (manual && !(d.list || []).length) d.list = watchMatches(Object.assign({}, d, { manual: false })).map(r => ({ left: r.left, right: r.right, dt: r.dt, women: !!r.women }));
      set({ manual }, true);
    }));
    document.querySelectorAll('.vis-m').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      const r = d.list[parseInt(el.dataset.i, 10)]; if (!r) return;
      r[el.dataset.f] = el.dataset.f === 'women' ? el.value === '1' : el.value;
      scheduleRender(); scheduleSave();
    }));
    document.querySelectorAll('.vis-mdel').forEach(b => b.addEventListener('click', () => { d.list.splice(parseInt(b.dataset.i, 10), 1); scheduleSave(); buildControls(); scheduleRender(); }));
    document.querySelectorAll('.vis-mmove').forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.i, 10), j = i + parseInt(b.dataset.dir, 10); if (j < 0 || j >= d.list.length) return;
      const t = d.list[i]; d.list[i] = d.list[j]; d.list[j] = t; scheduleSave(); buildControls(); scheduleRender();
    }));
    on('visMAdd', 'click', () => {
      const last = (d.list || [])[d.list.length - 1], clubs = lvlAllClubs();
      d.list = (d.list || []).concat([{ left: clubs[0][0], right: clubs[1][0], dt: last ? last.dt : (d.day ? d.day + ' - 20:30' : ''), women: last ? !!last.women : d.comp === 'women' }]);
      scheduleSave(); buildControls(); scheduleRender();
    });
    on('visMCopy', 'click', () => {
      d.list = watchMatches(Object.assign({}, d, { manual: false })).map(r => ({ left: r.left, right: r.right, dt: r.dt, women: !!r.women }));
      scheduleSave(); buildControls(); scheduleRender();
    });
    on('visNames', 'change', (e) => set({ showNames: e.target.checked }));
    on('visAbbr', 'change', (e) => set({ showAbbr: e.target.checked }));
    on('visMark', 'change', (e) => set({ markComp: e.target.checked }));
    on('visBg', 'change', (e) => set({ bgStyle: e.target.value }));
    on('visAdd', 'click', () => {
      const dt = ($('visXDt').value || '').trim(), home = $('visXHome').value, away = $('visXAway').value;
      if (!dtParts(dt) || home === away) { status('Vul een datum (22/10 - 20:30) in en kies twee verschillende clubs'); return; }
      d.extra = (d.extra || []).concat([{ left: home, right: away, dt, women: d.comp === 'women' }]); if (!watchWindow(d).includes(dayKeyOf(dt))) d.day = dayKeyOf(dt); scheduleSave(); buildControls(); scheduleRender();
    });
    document.querySelectorAll('.vis-xdel').forEach(b => b.addEventListener('click', () => { d.extra.splice(parseInt(b.dataset.i, 10), 1); scheduleSave(); buildControls(); scheduleRender(); }));
    on('visCsv', 'change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const rows = parseCsv(decodeCsv(await f.arrayBuffer())).filter(r => r.LogoLinks && r.LogoRechts && r.TijdText);
        if (!rows.length) { status('Geen wedstrijden gevonden: controleer de kolommen (Naam, bg, LogoLinks, LogoRechts, TijdText)'); return; }
        const r = await fetch('/api/item?key=' + enc('lvl:schedule'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'lvl-schedule', v: 1, data: { rows, at: Date.now() } }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        await loadLvlRows('lvlm');
        const days = watchDays(d); d.day = days[0] || ''; d.off = [];
        buildControls(); scheduleRender(); scheduleSave();
        status(`✓ Programma ingelezen: ${rows.length} wedstrijden`);
      } catch (err) { status('Inlezen mislukt: ' + err.message); }
    });
    on('thLvlPhoto', 'change', (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadPlayer(f, !!($('thLvlKeep') && $('thLvlKeep').checked), ($('thLvlModel') || {}).value); });
    const lvlDrop = $('thLvlPhotoDrop');
    if (lvlDrop) {
      ['dragenter', 'dragover'].forEach(ev => lvlDrop.addEventListener(ev, (e) => { e.preventDefault(); lvlDrop.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(ev => lvlDrop.addEventListener(ev, (e) => { e.preventDefault(); lvlDrop.classList.remove('drag-over'); }));
      lvlDrop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) uploadPlayer(f, !!($('thLvlKeep') && $('thLvlKeep').checked), ($('thLvlModel') || {}).value); });
    }
    on('thLvlZoom', 'input', (e) => { d.photoPos.z = parseInt(e.target.value, 10) / 100; scheduleRender(); scheduleSave(); });
    on('thApiCopy', 'click', () => { const el = $('thApiUrl'); if (el && navigator.clipboard) navigator.clipboard.writeText(el.textContent).then(() => { $('thApiCopy').textContent = '✓ Gekopieerd'; setTimeout(() => { const b = $('thApiCopy'); if (b) b.textContent = 'Kopieer link'; }, 1500); }).catch(() => {}); });
    on('thExport', 'click', exportOne);
    on('thExportDay', 'click', KINDS[cur.kind].potm ? exportPotmAll : KINDS[cur.kind].lvl ? exportLvlAll : exportDay);
  }

  // ---------- Export ----------
  const MIME = { jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
  const EXT = { jpeg: 'jpg', webp: 'webp', png: 'png' };
  const toBlob = (cv, fmt) => new Promise(res => cv.toBlob(res, MIME[fmt], 0.93));
  async function blobFor(kind, d, fmt, withPhoto = true) {
    const [cw, ch] = kindSize(kind, d);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    await renderThumb(kind, d, c.getContext('2d'), withPhoto ? cur.photo : null);
    return toBlob(c, fmt);
  }
  // YYYYMMDD from the date text ("zaterdag 5 september", "SATURDAY 05 SEPTEMBER", ...)
  function stampFromText(text) {
    const m = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)/.exec(text || '');
    if (!m) return null;
    const name = m[2].toLowerCase();
    let mi = MONTHS_NL_LOWER.indexOf(name); if (mi < 0) mi = MONTHS.en.findIndex(x => x.toLowerCase() === name);
    if (mi < 0) return null;
    return `${seasonDate(parseInt(m[1], 10), mi + 1).getFullYear()}${String(mi + 1).padStart(2, '0')}${String(m[1]).padStart(2, '0')}`;
  }
  // SHLW_20260905_FORE-VEL / SHL_20261114_BEV-HVA / NextMEN_20260905_ART-DWS / NextWomen_20260905_DAL-BFC
  function fileName(kind, d) {
    if (KINDS[kind].shlmail) { const dd = (cur.days || []).find(x => String(x.key) === String(d.dayKey)); return `SHL_schedule-mail_${dd ? seasonDate(dd.day, dd.month).getFullYear() + String(dd.month).padStart(2, '0') + String(dd.day).padStart(2, '0') : 'datum'}`; }
    if (KINDS[kind].potm) { const sl = (t) => String(t || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); const f = d.fmt === 'story' ? 'vote-story' : d.fmt === 'overview' ? 'overview' : 'nominee-' + sl(((d.players[+String(d.fmt).slice(1)] || {}).last) || d.fmt); return `SHL_POTM_${sl(d.month)}_${f}`; }
    if (KINDS[kind].vis === 'mail') return 'LVL_mailheader';
    if (KINDS[kind].vis === 'watch') { const day = d.manual ? dayKeyOf(((d.list || [])[0] || {}).dt) || 'eigen' : d.day || 'dag'; return `LVL_watchlive_${String(day).replace('/', '-')}`; }
    if (KINDS[kind].lvl) {
      const m = /(\d{1,2})\/(\d{1,2})/.exec(d.dt || ''), stamp = m ? `${seasonDate(+m[1], +m[2]).getFullYear()}${String(+m[2]).padStart(2, '0')}${String(+m[1]).padStart(2, '0')}` : 'datum';
      return `${LVL[kind].prefix}_${stamp}_${d.home}-${d.away}`;
    }
    let prefix, ca, cb;
    if (KINDS[kind].next) {
      const code = (id) => SETTINGS.code('hnl:' + id, NEXT_CODE[id] || String(id).toUpperCase());
      prefix = kind === 'nextmen' ? 'NextMEN' : 'NextWomen'; ca = code(d.home); cb = code(d.away);
    } else {
      const cfg = kind === 'shl' ? MEN : WOMEN, ec = (c) => SETTINGS.code(`${cfg.kind}:${c}`, cfg.exportCode[c] || c);
      prefix = kind === 'shl' ? 'SHL' : 'SHLW'; ca = ec(d.home); cb = ec(d.away);
    }
    // the date on the image wins (the user may have edited it), the picked fixture is the fallback
    const stamp = stampFromText(d.date) || (d.month ? `${seasonDate(d.day, d.month).getFullYear()}${String(d.month).padStart(2, '0')}${String(d.day).padStart(2, '0')}` : null) || 'datum';
    return `${prefix}_${stamp}_${ca}-${cb}`;
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const status = (t) => { const el = $('thStatus'); if (el) { el.textContent = t; el.hidden = !t; } };
  // Every export also goes to the server (/exports/<name>), so it can be fetched with a plain download (also by other tools).
  async function saveOnServer(blob, name) {
    try {
      const r = await fetch('/api/export?name=' + enc(name), { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { return null; }
  }
  async function exportOne() {
    flushSave();
    const blob = await blobFor(cur.kind, cur.d, exportFmt);
    const name = `${fileName(cur.kind, cur.d)}.${EXT[exportFmt]}`;
    download(blob, name);
    const saved = await saveOnServer(blob, name);
    status(saved ? `✓ Gedownload en op de server: ${saved.path}` : '✓ Gedownload (opslaan op de server mislukte)');
  }
  async function exportLvlAll() {
    const rows = cur.lvlRows || []; if (!rows.length) { status('Geen programma geladen'); return; }
    const files = [];
    for (let i = 0; i < rows.length; i++) {
      status(`Thumbnail ${i + 1} van ${rows.length} maken…`);
      const d = { ...cur.d, home: rows[i].left, away: rows[i].right, dt: rows[i].dt };
      const blob = await blobFor(cur.kind, d, exportFmt, false);
      files.push({ name: `${fileName(cur.kind, d)}.${EXT[exportFmt]}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    download(new Blob([makeZip(files)], { type: 'application/zip' }), `${LVL[cur.kind].prefix}_thumbnails.zip`);
    let saved = 0;
    for (const f of files) { if (await saveOnServer(new Blob([f.data], { type: MIME[exportFmt] }), f.name)) saved++; }
    status(`✓ ${files.length} thumbnails in de zip${saved ? ` · ${saved} ook op de server (/exports/)` : ''}`);
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
    const zipName = `${cur.kind === 'shl' ? 'SHL' : 'SHLW'}_thumbnails_${day.day}-${day.month}.zip`, zipBlob = new Blob([zip], { type: 'application/zip' });
    download(zipBlob, zipName);
    // the single images go to the server too, so each match has its own URL
    let saved = 0;
    for (const f of files) { if (await saveOnServer(new Blob([f.data], { type: MIME[exportFmt] }), f.name)) saved++; }
    status(`✓ ${files.length} thumbnails in de zip${saved ? ` · ${saved} ook op de server (/exports/)` : ''}`);
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
    await nextReady; await SETTINGS.ready;
    setSave('loading');
    let data = null; const k = itemKey();
    try { const r = await fetch('/api/item?key=' + enc(k), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && j.data) data = j.data; } } catch (e) { /* offline */ }
    if (k !== itemKey()) return;
    cur.d = Object.assign(K.shlmail ? shlMailDefaults() : K.potm ? potmDefaults() : K.vis ? visDefaults(kind) : K.lvl ? lvlDefaults(kind) : K.next ? nextDefaults(kind) : shlDefaults(), data || {});
    if (!cur.d.photoPos) cur.d.photoPos = { z: 1, x: 0, y: 0 };
    if (cur.d.hasPhoto && !K.vis && !K.shlmail) {
      try { const r = await fetch('/api/photo?key=' + enc(k), { cache: 'no-store' }); if (r.ok) cur.photo = await blobToImg(await r.blob()); else cur.d.hasPhoto = false; } catch (e) { cur.d.hasPhoto = false; }
    }
    if (K.shlmail) {
      await loadFixtures('shl');
      await loadShlMailPhoto();
      if (!cur.days.some(x => String(x.key) === String(cur.d.dayKey))) cur.d.dayKey = cur.days.length ? cur.days[0].key : '';
    } else if (K.potm) {
      if (!Array.isArray(cur.d.players) || cur.d.players.length !== 4) cur.d.players = potmDefaults().players;
      await loadPotmPhotos();
    } else if (K.vis) {
      if (K.vis === 'watch') {
        await loadLvlRows('lvlm');
        const days = watchDays(cur.d), today = new Date(), tOrder = ((today.getMonth() + 5) % 12) * 100 + today.getDate();
        if (!days.includes(cur.d.day)) cur.d.day = days.find(k => lvlSeasonOrder(k) >= tOrder) || days[days.length - 1] || '';
      }
    } else if (K.lvl) {
      await loadLvlRows(kind);
      // always start on the first match that has not been played yet; when the whole programme is over, keep what was saved
      // (or the last match of the programme when nothing was saved)
      const rows = cur.lvlRows || [], today = new Date(), tOrder = ((today.getMonth() + 5) % 12) * 100 + today.getDate();
      const next = rows.find(x => lvlSeasonOrder(x.dt) >= tOrder);
      const keep = rows.find(r => cur.d.fixture === `${r.left}-${r.right}|${r.dt}`);
      const r = next || (!keep && !cur.d.dt && rows.length ? rows[rows.length - 1] : null);
      if (r) Object.assign(cur.d, { home: r.left, away: r.right, dt: r.dt, fixture: `${r.left}-${r.right}|${r.dt}` });
    } else if (!K.next) {
      await loadFixtures(kind);
      // always start on the first upcoming matchday (a saved day only stays when there is nothing upcoming any more)
      const today = new Date();
      const dayOrder = (x) => ((x.month + 4) % 12) * 100 + x.day, tOrder = ((today.getMonth() + 5) % 12) * 100 + today.getDate();
      const day = cur.days.find(x => dayOrder(x) >= tOrder) || cur.days.find(x => String(x.key) === String(cur.d.dayKey)) || cur.days[0];
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
      if (KINDS[cur.kind].lvl) { scheduleRender(); return; }   // LVL: the cut-out moves freely
      const r = photoRect(cur.photo, p); p.x = r.x; p.y = r.y;   // keep the stored offset inside the limits so dragging doesn't feel sticky
      scheduleRender();
    });
    // LVL: scroll to zoom around the pointer
    cv.addEventListener('wheel', (e) => {
      if (!cur.d || !cur.d.hasPhoto || !cur.photo || !KINDS[cur.kind].lvl) return;
      e.preventDefault();
      const r = cv.getBoundingClientRect(), k = cv.width / r.width, mx = (e.clientX - r.left) * k, my = (e.clientY - r.top) * k;
      const p = cur.d.photoPos, z0 = p.z, z1 = Math.min(4, Math.max(0.5, z0 * Math.exp(-e.deltaY * 0.0015))), f = z1 / z0;
      const ar = cur.photo.naturalWidth / cur.photo.naturalHeight, pw0 = 1150 * z0 * ar, left0 = 1400 + p.x - pw0 / 2, top0 = 55 + p.y;
      const left1 = mx - (mx - left0) * f, top1 = my - (my - top0) * f, pw1 = pw0 * f;
      p.z = z1; p.x = left1 + pw1 / 2 - 1400; p.y = top1 - 55;
      const zs = $('thLvlZoom'); if (zs) zs.value = Math.round(z1 * 100);
      scheduleRender(); scheduleSave();
    }, { passive: false });
    const end = () => { if (!drag) return; drag = null; cv.style.cursor = ''; scheduleSave(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }


  // ---------- Headless API ----------
  // Used by the server (POST/GET /api/thumbnail renders with a real browser and calls this): the same drawing code as the
  // editor, driven by parameters instead of the UI. Returns the image as a data URL + the file name.
  const apiReady = Promise.all([fontsReady, nextReady, SETTINGS.ready]);
  const apiErr = (m) => new Error('ThumbAPI: ' + m);
  const parseDM = (v) => {   // "2026-10-17", "17-10", "17/10", "17-10-2026" -> { day, month }
    const t = String(v || '').trim(); if (!t) return null;
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (m) return { day: +m[3], month: +m[2] };
    m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?$/.exec(t); if (m) return { day: +m[1], month: +m[2] };
    return null;
  };
  // the single-match editor uses a few other codes for the same clubs (SPR for HCS, ...): accept them too
  const CODE_ALIAS = { men: { SPR: 'HCS' }, women: { ENO: 'E&O', FORE: 'FOR', FORV: 'VEN', VEL: 'V&L' } };
  const resolveCode = (cfg, v) => {
    let t = String(v || '').trim(); if (!t) return null;
    const al = (CODE_ALIAS[cfg.kind] || {})[t.toUpperCase()]; if (al) t = al;
    const hit = cfg.clubs.find(([c]) => c.toLowerCase() === t.toLowerCase()) || cfg.clubs.find(([c, n]) => norm(n) === norm(t));
    return hit ? hit[0] : codeOf(cfg, t);
  };
  const resolveNext = (men, v) => {
    const t = norm(String(v || '').trim()); if (!t) return null;
    const hit = nextClubs.find(c => norm(c.id) === t || norm(c.label || '') === t || norm(c.name || '') === t);
    return hit ? hit.id : null;
  };
    // ---------- API documentation (shown on the pages, and served by GET /api/thumbnail?help=1) ----------
  // One description of the thumbnail API, built from the live club lists, so it can never be out of date.
  const API_KINDS = ['shl', 'shlw', 'nextmen', 'nextwomen', 'lvlm', 'lvlw'];
  function thumbDocs() {
    const clubs = (cfg) => cfg.clubs.map(([c]) => ({ code: c, name: labelOf(cfg, c) }));
    const common = {
      format: 'webp (default), jpg or png',
      json: '1 = answer with JSON ({ url, path, name, bytes, format, data }) instead of the image itself',
    };
    const kinds = {
      shl: { title: 'SHL (Super Handball League, men) livestream or highlights thumbnail', size: '1920x1080',
        required: { home: 'home club: code or full club name (see clubs)', away: 'away club: code or full club name' },
        optional: { date: 'YYYY-MM-DD or DD-MM. Without it the date of the match in the programme is used', time: 'HH:MM, default: the time from the programme', title: 'text at the bottom, default "Livestream"', variant: '"highlights" for the highlights version', label: 'text in the bar (highlights only)' },
        clubs: clubs(MEN), example: '/api/thumbnail?kind=shl&home=SAB&away=VOL&date=2026-11-14&time=20:15&json=1' },
      shlw: { title: 'SHLW (Super Handball League Women) livestream thumbnail', size: '1920x1080',
        required: { home: 'home club: code or full club name', away: 'away club: code or full club name' },
        optional: { date: 'YYYY-MM-DD or DD-MM. Without it the date of the match in the programme is used', time: 'HH:MM', title: 'text at the bottom, default "Livestream"', homeLabel: 'caption under the home crest, default the club name', awayLabel: 'caption under the away crest' },
        clubs: clubs(WOMEN), example: '/api/thumbnail?kind=shlw&home=FOR&away=VEN&date=2026-11-14&time=19:00&json=1' },
      nextmen: { title: 'HandbalNL Next men thumbnail', size: '1920x1080',
        required: { home: 'home club: id or name (see clubs)', away: 'away club: id or name' },
        optional: { date: 'YYYY-MM-DD or DD-MM, written as "zaterdag 14 november"', dateText: 'own date text instead of date', time: 'HH:MM, default 20:00', homeName: 'name on the image, default the club name', awayName: 'name on the image' },
        clubs: nextClubs.map(c => ({ code: c.id, name: SETTINGS.label('hnl:' + c.id, c.label || c.name || c.id) })), example: '/api/thumbnail?kind=nextmen&home=artemis&away=dws&date=2026-11-14&time=20:00&json=1' },
      nextwomen: { title: 'HandbalNL Next women thumbnail', size: '1920x1080',
        required: { home: 'home club: id or name', away: 'away club: id or name' },
        optional: { date: 'YYYY-MM-DD or DD-MM', dateText: 'own date text', time: 'HH:MM, default 20:15', homeName: 'name on the image', awayName: 'name on the image' },
        clubs: nextClubs.map(c => ({ code: c.id, name: SETTINGS.label('hnl:' + c.id, c.label || c.name || c.id) })), example: '/api/thumbnail?kind=nextwomen&home=dalfsen&away=bfc&date=2026-11-14&time=20:15&json=1' },
      lvlm: { title: 'Lotto Volley League men thumbnail', size: '1920x1080',
        required: { home: 'home club: crest code or full club name', away: 'away club: crest code or full club name', 'dt  or  date + time': 'dt = "16/10 - 20:30", or date (YYYY-MM-DD or DD-MM) and time (HH:MM). Without them the match is looked up in the programme' },
        optional: { season: 'big text top right, default 2026/2027' },
        clubs: LVL.lvlm.clubs.map(([code, name]) => ({ code, name })), example: '/api/thumbnail?kind=lvlm&home=MEN&away=ROE&dt=16/10%20-%2020:30&json=1' },
      lvlw: { title: 'Lotto Volley League women thumbnail', size: '1920x1080',
        required: { home: 'home club: crest code or full club name', away: 'away club: crest code or full club name', 'dt  or  date + time': 'dt = "17/10 - 20:30", or date and time' },
        optional: { season: 'big text top right, default 2026/2027' },
        clubs: LVL.lvlw.clubs.map(([code, name]) => ({ code, name })), example: '/api/thumbnail?kind=lvlw&home=NOO&away=DROE&dt=17/10%20-%2020:30&json=1' },
    };
    return {
      name: 'ByTomorrow Graphics thumbnail API',
      for_ai: [
        'Call GET /api/thumbnail?kind=<kind>&home=<club>&away=<club>&... (a POST with a JSON body takes the same fields).',
        'kind is one of: ' + API_KINDS.join(', ') + '. Every kind has its own required and optional fields and its own club codes, listed below.',
        'Club fields accept the code (e.g. SAB) or the full club name. An unknown club gives HTTP 400 with the list of valid codes in the error.',
        'Without json=1 the answer is the image itself (Content-Type image/webp, image/jpeg or image/png). With json=1 you get a JSON with the image URL, which you can fetch or hand to the user.',
        'Every rendered image is also stored and can be fetched again at /exports/<name>.',
        'Rendering takes a few seconds. HTTP 429 means busy: wait a few seconds and retry.',
        'The Lotto Volley League mail header, Watch live and Player of the Month visuals have no API: they are made by hand in the editor.',
      ],
      common, kinds,
      page: '/api-docs',
    };
  }
  const apiBase = () => (location.origin || '') + '/api/thumbnail';
  function apiExampleFor(kind, d) {
    const q = [`kind=${kind}`, `home=${encodeURIComponent(d.home || '')}`, `away=${encodeURIComponent(d.away || '')}`];
    const K = KINDS[kind], dm = d.month && d.day ? `${seasonDate(d.day, d.month).getFullYear()}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : '';
    if (K.lvl) { if (d.dt) q.push('dt=' + encodeURIComponent(d.dt)); }
    else if (K.next) { const m = dm || ''; if (m) q.push('date=' + m); if (d.time) q.push('time=' + encodeURIComponent(d.time)); if (d.homeName) q.push('homeName=' + encodeURIComponent(d.homeName)); if (d.awayName) q.push('awayName=' + encodeURIComponent(d.awayName)); }
    else { if (dm) q.push('date=' + dm); if (d.time) q.push('time=' + encodeURIComponent(d.time)); if (kind === 'shl' && d.variant === 'highlights') q.push('variant=highlights'); if (d.title && d.title !== SETTINGS.text('th.title', 'Livestream')) q.push('title=' + encodeURIComponent(d.title)); }
    q.push('json=1');
    return apiBase() + '?' + q.join('&');
  }
  function apiPanelHtml() {
    const kind = cur.kind, K = KINDS[kind];
    if (!API_KINDS.includes(kind)) return `<div class="panel-step panel-step-last"><div class="panel-step-title">API voor AI</div><p class="hint">Voor deze afbeelding is geen API: hij wordt met de hand in de editor gemaakt. De thumbnails van SHL, SHLW, HandbalNL en Lotto Volley League hebben die wel (zie <a href="/api-docs">/api-docs</a>).</p></div>`;
    const doc = thumbDocs().kinds[kind], row = (o) => Object.keys(o).map(k => `<li><code>${esc(k)}</code>: ${esc(o[k])}</li>`).join('');
    const url = apiExampleFor(kind, cur.d || {});
    return `<div class="panel-step panel-step-last" id="thApiBox"><div class="panel-step-title">API voor AI en scripts</div>
      <p class="hint"><b>Deze thumbnail via de API:</b> ${esc(doc.title)}, ${esc(doc.size)}. Een AI of een script kan hem zonder de editor maken met de link hieronder (die past zich aan de keuzes op deze pagina aan).</p>
      <pre style="white-space:pre-wrap;word-break:break-all;font-size:12px;user-select:all" id="thApiUrl">${esc(url)}</pre>
      <p class="hint"><b>Verplicht:</b></p><ul class="hint">${row(doc.required)}</ul>
      <p class="hint"><b>Optioneel:</b></p><ul class="hint">${row(doc.optional)}<li><code>format</code>: ${esc(thumbDocs().common.format)}</li><li><code>json=1</code>: ${esc(thumbDocs().common.json)}</li></ul>
      <p class="hint"><b>Clubcodes (${doc.clubs.length}):</b> ${doc.clubs.map(c => `<code>${esc(c.code)}</code> ${esc(c.name)}`).join(' · ')}</p>
      <p class="hint">Voor AI: de volledige uitleg staat als JSON op <code>/api/thumbnail?help=1</code> en als pagina op <a href="/api-docs">/api-docs</a>. Het antwoord zonder <code>json=1</code> is het plaatje zelf; met <code>json=1</code> een JSON met de link naar het plaatje.</p>
      <button class="btn btn-link" id="thApiCopy" type="button">Kopieer link</button></div>`;
  }

  window.ThumbAPI = {
    ready: apiReady,
    async describe() { await apiReady; return thumbDocs(); },
    async render(p) {
      await apiReady;
      p = p || {};
      const kind = p.kind; if (!KINDS[kind]) throw apiErr('kind moet shl, shlw, nextmen, nextwomen, lvlm of lvlw zijn');
      let fmt = String(p.format || 'webp').toLowerCase(); if (fmt === 'jpg') fmt = 'jpeg';
      if (!MIME[fmt]) throw apiErr('format moet jpg, webp of png zijn');
      const K = KINDS[kind], dm = parseDM(p.date);
      if (p.date && !dm) throw apiErr('date: gebruik YYYY-MM-DD of DD-MM');
      let d;
      if (K.lvl) {
        const clubs = LVL[kind].clubs, find = (v) => { const t = String(v || '').trim().toLowerCase(); const h = clubs.find(([c, n]) => c.toLowerCase() === t || norm(n) === norm(t)); return h ? h[0] : null; };
        const home = find(p.home), away = find(p.away);
        if (!home || !away || home === away) throw apiErr(`onbekende club (home=${p.home}, away=${p.away}); codes: ${clubs.map(c => c[0]).join(', ')}`);
        await loadLvlRows(kind);
        const dmv = parseDM(p.date), dtText = p.dt || (dmv ? `${String(dmv.day).padStart(2, '0')}/${String(dmv.month).padStart(2, '0')}${p.time ? ' - ' + p.time : ''}` : '');
        const row = (cur.lvlRows || []).find(r => r.left === home && r.right === away && (!dtText || r.dt.startsWith(dtText.slice(0, 5))));
        d = lvlDefaults(kind); Object.assign(d, { home, away, dt: dtText || (row && row.dt) || '', season: p.season || d.season });
        if (!d.dt) throw apiErr(`geen wedstrijd ${home}-${away} in het programma; geef date (DD-MM of YYYY-MM-DD) en time mee, of dt="17/10 - 20:30"`);
        d.fixtureFound = !!row;
      } else if (K.next) {
        const home = resolveNext(K.men, p.home), away = resolveNext(K.men, p.away);
        if (!home || !away) throw apiErr(`onbekende club (home=${p.home}, away=${p.away}); beschikbaar: ${nextClubs.map(c => c.id).join(', ')}`);
        d = nextDefaults(kind);
        const dateText = dm ? (() => { const dt = seasonDate(dm.day, dm.month); return `${DAYS_NL_LOWER[dt.getDay()]} ${dm.day} ${MONTHS_NL_LOWER[dm.month - 1]}`; })() : (p.dateText || d.date);
        Object.assign(d, { home, away, homeName: p.homeName || SETTINGS.name('hnl:' + home, (nextById[home] || {}).name || home), awayName: p.awayName || SETTINGS.name('hnl:' + away, (nextById[away] || {}).name || away), date: dateText, time: p.time || d.time });
        if (dm) { d.day = dm.day; d.month = dm.month; }
      } else {
        const cfg = kind === 'shl' ? MEN : WOMEN;
        const home = resolveCode(cfg, p.home), away = resolveCode(cfg, p.away);
        if (!home || !away || home === away) throw apiErr(`onbekende club (home=${p.home}, away=${p.away}); codes: ${cfg.clubs.map(c => c[0]).join(', ')}`);
        const all = await fetchAllFixtures(kind);
        const same = all.filter(f => f.hc === home && f.ac === away && (!dm || (f.day === dm.day && f.month === dm.month)));
        const f = same.find(x => !x.played) || same[0] || null;
        const day = dm ? dm.day : (f && f.day), month = dm ? dm.month : (f && f.month);
        if (!day || !month) throw apiErr(`geen wedstrijd ${home}-${away} gevonden in het programma; geef date mee (YYYY-MM-DD)`);
        d = shlDefaults();
        Object.assign(d, { home, away, date: fmtDate(cfg, day, month), time: p.time || (f && f.time) || '', homeLabel: p.homeLabel || labelOf(cfg, home), awayLabel: p.awayLabel || labelOf(cfg, away), day, month, round: f && f.round || null });
        if (p.title != null && p.title !== '') d.title = p.title;
        if (p.label != null && p.label !== '') d.label = p.label;
        if (kind === 'shl' && p.variant === 'highlights') d.variant = 'highlights';
        d.fixtureFound = !!f;
      }
      const blob = await blobFor(kind, d, fmt, false);
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('lezen mislukt')); fr.readAsDataURL(blob); });
      return { dataUrl, fileName: `${fileName(kind, d)}.${EXT[fmt]}`, format: fmt, data: { home: d.home, away: d.away, date: d.date, time: d.time, dt: d.dt, round: d.round || null, fixtureFound: !!d.fixtureFound } };
    },
  };

  window.TH = {
    NAMES,
    open(kind) {
      cur.kind = kind; cur.slot = 1; cur.d = null; cur.days = []; cur.fixtures = [];
      $('thApp').dataset.kind = kind;   // the page takes the colour of the thumbnail (see style.css)
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
