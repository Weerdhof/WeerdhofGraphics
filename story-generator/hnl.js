// HandbalNL assets: Aankondiging, Next heren, Next dames (Story 1080x1920 / Post 1080x1350).
// Geometry, fonts, sizes and colours are taken from MATCHtemplatesHNLnext.psd.
(() => {
  'use strict';

  // ---------- Layout constants (canvas px; P = top of the bottom panel) ----------
  const FORMATS = {
    post:  { w: 1080, h: 1350, P: 1020, photoH: { next: 1020, announce: 839 } },
    story: { w: 1080, h: 1920, P: 1270, photoH: { next: 1270, announce: 1089 } },
  };
  const C = {
    navy: '#011856', navyLines: '#011145', lilac: '#c993fc', red: '#c42303', orange: '#ff7429',
    creamMen: '#fae5e1', subMen: '#f8e3e0', lightWomen: '#f4ecfd', white: '#ffffff',
  };
  const KINDS = {
    nextmen:   { title: 'Next heren', men: true,  label: 'Next Handball League Men' },
    nextwomen: { title: 'Next dames', men: false, label: 'Next Handball League Women' },
    announce:  { title: 'Aankondiging' },
  };
  const SLOTS = 12;
  const PHOTO_MAX = 2200;

  // fonts (canvas uses these family names)
  const FONT_FILES = [
    ['TuskerGrotesk3', 'fonts/hnl/TuskerGrotesk-3700Bold.otf', '700'],
    ['TuskerGrotesk5', 'fonts/hnl/TuskerGrotesk-5700Bold.otf', '700'],
    ['TuskerGrotesk6', 'fonts/hnl/TuskerGrotesk-6700Bold.otf', '700'],
    ['Meticula', 'fonts/hnl/Meticula-Bold.ttf', '700'],
  ];
  let fontsReady = false;
  Promise.all(FONT_FILES.map(([fam, url, w]) => new FontFace(fam, `url(${url})`, { weight: w }).load().then(f => document.fonts.add(f))))
    .then(() => { fontsReady = true; scheduleRender(); }).catch(() => { fontsReady = true; scheduleRender(); });

  // ---------- Resources ----------
  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    imgCache.set(src, p);
    return p;
  }
  let clubs = [], clubsById = {}, pathsData = null;
  const pathCache = {};
  const resources = Promise.all([
    fetch('assets/hnl/clubs.json').then(r => r.json()).then(list => { clubs = list; list.forEach(c => { clubsById[c.id] = c; }); }),
    fetch('assets/hnl/paths.json').then(r => r.json()).then(d => { pathsData = d; }),
  ]).catch(() => {});
  const getPath = (key) => (pathCache[key] || (pathCache[key] = new Path2D(pathsData[key].d)));
  const tinted = new Map();
  function tintedImg(img, color) {
    const k = img.src + color;
    if (tinted.has(k)) return tinted.get(k);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tinted.set(k, c); return c;
  }

  // ---------- State ----------
  const cur = { kind: null, slot: 1, format: 'post', data: null, photo: null, loaded: false };
  let renderTimer = 0, saveTimer = 0, lastSaved = '', itemKey = '';

  const LS_NAMES = 'hnl-club-names', LS_LABELS = 'hnl-slot-labels';
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const clubName = (id) => (lsGet(LS_NAMES)[id]) || SETTINGS.name('hnl:' + id, (clubsById[id] && clubsById[id].name) || id);
  const clubLabel = (id, def) => SETTINGS.label('hnl:' + id, def);

  function defaults(kind) {
    const photoPos = () => ({ post: { z: 1, x: 0, y: 0 }, story: { z: 1, x: 0, y: 0 } });
    if (kind === 'announce') {
      const T = (k, d) => SETTINGS.text('hnl.announce.' + k, d);
      return { l1: T('l1', 'MIS NIETS VAN DE'), l2: T('l2', 'NEXT HANDBALL LEAGUE'), l1w: '6', l2w: '5', b1: T('b1', 'LIVE'), b2: T('b2', 'TE ZIEN VIA'), b3: T('b3', 'HANDBALNL.TV'), decor: true, hasPhoto: false, photoPos: photoPos(), format: 'post' };
    }
    const men = KINDS[kind].men;
    const home = men ? 'houten' : 'vzv', away = men ? 'bfc' : 'kwiek-r';
    return { home, away, homeName: clubName(home), awayName: clubName(away), time: men ? '19:00' : '20:30', dateISO: '', date: 'Zaterdag 05 september',
      label: SETTINGS.text('hnl.label.' + kind, KINDS[kind].label), decor: true, hasPhoto: false, photoPos: photoPos(), format: 'post' };
  }

  // ---------- Drawing ----------
  const SHADOW = { a: 0.8, blur: 26, ox: -3, oy: 5.2 };   // fitted against the PSD exports (Photoshop: 61%, 60deg, 6px, size 35)
  const fontOf = (fam, px) => `700 ${px}px "${fam}"`;

  function drawText(ctx, text, x, baseline, fam, px, color, opt = {}) {
    ctx.save();
    ctx.font = fontOf(fam, px);
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    if (opt.shadow) {
      const sh = SHADOW;
      ctx.shadowColor = `rgba(0,0,0,${sh.a})`;
      ctx.shadowBlur = sh.blur;
      ctx.shadowOffsetX = sh.ox; ctx.shadowOffsetY = sh.oy;
    }
    let drawX = x;
    if (opt.inkRight != null) { const m = ctx.measureText(text); drawX = opt.inkRight - m.actualBoundingBoxRight; }
    else if (opt.inkLeft != null) { const m = ctx.measureText(text); drawX = opt.inkLeft + m.actualBoundingBoxLeft; }
    ctx.fillText(text, drawX, baseline);
    ctx.restore();
    return ctx.measureText ? null : null;
  }
  function widthOf(ctx, text, fam, px) { ctx.save(); ctx.font = fontOf(fam, px); const w = ctx.measureText(text).width; ctx.restore(); return w; }

  // the photo, scaled to cover the rect, then zoomed/offset by the user's position
  function drawPhoto(ctx, img, rx, ry, rw, rh, pos) {
    const cover = Math.max(rw / img.naturalWidth, rh / img.naturalHeight);
    const s = cover * pos.z;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const maxX = Math.max(0, (dw - rw) / 2), maxY = Math.max(0, (dh - rh) / 2);
    const ox = Math.max(-maxX, Math.min(maxX, pos.x)), oy = Math.max(-maxY, Math.min(maxY, pos.y));
    ctx.save();
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    ctx.drawImage(img, rx + (rw - dw) / 2 + ox, ry + (rh - dh) / 2 + oy, dw, dh);
    ctx.restore();
    return { maxX, maxY };
  }

  async function drawNext(ctx, f, fkey, d, kind) {
    const men = KINDS[kind].men;
    const { w, h, P } = f;
    ctx.fillStyle = men ? C.red : C.lilac;
    ctx.fillRect(0, 0, w, h);
    if (cur.photo && d.hasPhoto) drawPhoto(ctx, cur.photo, 0, 0, w, P, d.photoPos[fkey]);
    if (d.decor && pathsData) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, P); ctx.clip();
      ctx.fillStyle = men ? C.orange : C.navyLines;
      ctx.fill(getPath(men ? `men_swoosh_${fkey}` : `women_lines_${fkey}`));
      ctx.restore();
    }
    ctx.fillStyle = men ? C.red : C.navy;
    ctx.fillRect(0, P, w, h - P);

    const textCol = men ? C.creamMen : C.lightWomen;
    const subCol = men ? C.subMen : C.lightWomen;
    // team names (Tusker 3, 87.87px) + small "VS"
    let nameSize = 87.87;
    const n1 = (d.homeName || '').toUpperCase(), n2 = (d.awayName || '').toUpperCase();
    const maxW = 1080 - 69 - 40;
    const vsGap = men ? 17 : 28;
    const w1 = widthOf(ctx, n1, 'TuskerGrotesk3', nameSize) + vsGap + widthOf(ctx, 'VS', 'TuskerGrotesk6', 36);
    const w2 = widthOf(ctx, n2, 'TuskerGrotesk3', nameSize);
    nameSize = nameSize * Math.min(1, maxW / Math.max(w1, w2));
    const vsPx = 36 * nameSize / 87.87;
    drawText(ctx, n1, 69, P - 147, 'TuskerGrotesk3', nameSize, textCol, { shadow: true });
    const n1w = widthOf(ctx, n1, 'TuskerGrotesk3', nameSize);
    drawText(ctx, 'VS', 69 + n1w + vsGap, P - 147, 'TuskerGrotesk6', vsPx, textCol, { shadow: true });
    drawText(ctx, n2, 69, P - 46, 'TuskerGrotesk3', nameSize, textCol, { shadow: true });

    // logos: white squares with the club logos, "VS" between them
    const logos = await Promise.all([loadImg(SETTINGS.logo('hnl:' + d.home, `assets/hnl/clubs/${d.home}.jpg`)), loadImg(SETTINGS.logo('hnl:' + d.away, `assets/hnl/clubs/${d.away}.jpg`))]);
    [[68, logos[0]], [294, logos[1]]].forEach(([x, im]) => {
      ctx.fillStyle = C.white; ctx.fillRect(x, P + 63, 172, 172);
      if (im) ctx.drawImage(im, x, P + 63, 172, 172);
    });
    drawText(ctx, 'VS', 253, P + 172, 'TuskerGrotesk3', 36, textCol);
    // time, label, date
    drawText(ctx, (d.time || '').toUpperCase(), 0, P + 231, 'TuskerGrotesk6', 176.96, men ? C.creamMen : C.lilac, { inkRight: 1030 });
    drawText(ctx, d.label || '', 0, P + 297, 'Meticula', 30, subCol, { inkLeft: men ? 75 : 71 });
    drawText(ctx, d.date || '', 0, P + 297, 'Meticula', 30, subCol, { inkRight: 1020 });
    // HandbalNL logo: top-left on the post, bottom-centre on the story
    const logo = await loadImg('assets/hnl/logo-next.png');
    if (logo) {
      const lc = tintedImg(logo, textCol);
      if (fkey === 'post') ctx.drawImage(lc, 72, 95, 359, 98); else ctx.drawImage(lc, 315, 1630, 433, 117);
    }
  }

  async function drawAnnounce(ctx, f, fkey, d) {
    const { w, h } = f;
    const photoH = f.photoH.announce;
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, w, h);
    if (cur.photo && d.hasPhoto) drawPhoto(ctx, cur.photo, 0, 0, w, photoH, d.photoPos[fkey]);
    ctx.fillStyle = C.navy; ctx.fillRect(0, photoH, w, h - photoH);
    if (d.decor && pathsData) { ctx.fillStyle = C.lilac; ctx.fill(getPath(`open_lines_${fkey}`)); }
    // lilac banner
    const bannerTop = fkey === 'post' ? 1229 : 1390, bannerH = fkey === 'post' ? 121 : 122;
    const baseline = fkey === 'post' ? 1317 : 1474;
    const sz = 57.0;
    const parts = [[(d.b1 || '').toUpperCase() + ' ', 'TuskerGrotesk6'], [(d.b2 || '').toUpperCase() + ' ', 'TuskerGrotesk3'], [(d.b3 || '').toUpperCase(), 'TuskerGrotesk5']];
    let x = 75; const xs = [];
    parts.forEach(([t, fam]) => { xs.push(x); x += widthOf(ctx, t, fam, sz); });
    const bannerW = fkey === 'post' ? w : Math.max(747, x + 55);
    ctx.fillStyle = C.lilac; ctx.fillRect(0, bannerTop, bannerW, bannerH);
    parts.forEach(([t, fam], i) => drawText(ctx, t, xs[i], baseline, fam, sz, C.navy));
    // headline
    const hb = fkey === 'post' ? 990 : 1240;
    const fit = (t, fam) => Math.min(87.87, 87.87 * (1080 - 75 - 40) / Math.max(1, widthOf(ctx, t, fam, 87.87)));   // shrink a line only when it would run off the canvas
    const l1 = (d.l1 || '').toUpperCase(), l2 = (d.l2 || '').toUpperCase();
    const f1 = 'TuskerGrotesk' + (d.l1w || '6'), f2 = 'TuskerGrotesk' + (d.l2w || '5');
    drawText(ctx, l1, 75, hb, f1, fit(l1, f1), C.lightWomen);
    drawText(ctx, l2, 75, hb + 105.4, f2, fit(l2, f2), C.lightWomen);
    // logo on the photo
    const logo = await loadImg('assets/hnl/logo-plain.png');
    if (logo) ctx.drawImage(tintedImg(logo, C.lightWomen), 77, fkey === 'post' ? 720 : 976, 354, 89);
  }

  const canvas = () => document.getElementById('hnlCanvas');
  let drawSeq = 0;
  async function render() {
    renderTimer = 0;
    if (!cur.kind || !cur.data) return;
    await resources; await SETTINGS.ready;
    const seq = ++drawSeq;
    const fkey = cur.data.format, f = FORMATS[fkey];
    const cv = canvas();
    // draw into an offscreen canvas first so async image loads never leave a half-drawn frame
    const off = document.createElement('canvas'); off.width = f.w; off.height = f.h;
    const ctx = off.getContext('2d');
    if (cur.kind === 'announce') await drawAnnounce(ctx, f, fkey, cur.data); else await drawNext(ctx, f, fkey, cur.data, cur.kind);
    if (seq !== drawSeq) return;
    cv.width = f.w; cv.height = f.h;
    cv.getContext('2d').drawImage(off, 0, 0);
  }
  function scheduleRender() { if (!renderTimer) renderTimer = requestAnimationFrame(render); }

  // ---------- Persistence (same endpoints as the SHL items) ----------
  const keyOf = () => `hnl:${cur.kind}:s${cur.slot}`;
  const indicator = () => document.getElementById('hnlSave');
  const SAVE_LABELS = { idle: '', loading: 'Laden…', pending: '● Wijzigingen nog niet opgeslagen', saving: 'Opslaan…', saved: '✓ Opgeslagen op de server', error: '⚠ Opslaan mislukt — probeer opnieuw' };
  function setSave(state) { const el = indicator(); if (!el) return; el.dataset.state = state; el.textContent = SAVE_LABELS[state] || ''; }
  const enc = (k) => encodeURIComponent(k);

  function snapshot() { return JSON.stringify({ kind: cur.kind, v: 1, data: cur.data }); }
  function scheduleSave() {
    if (!cur.loaded) return;
    if (snapshot() === lastSaved) return;
    setSave('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 800);
  }
  function flushSave() {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!cur.loaded || !cur.kind) return Promise.resolve();
    const json = snapshot();
    if (json === lastSaved) return Promise.resolve();
    const k = keyOf();
    lastSaved = json;
    setSave('saving');
    return fetch('/api/item?key=' + enc(k), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); if (k === keyOf()) setSave('saved'); })
      .catch(() => { lastSaved = ''; setSave('error'); });
  }
  window.addEventListener('pagehide', () => { if (cur.loaded && snapshot() !== lastSaved) fetch('/api/item?key=' + enc(keyOf()), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: snapshot(), keepalive: true }); });

  async function loadItem() {
    cur.loaded = false; cur.data = null; cur.photo = null; lastSaved = '';
    await SETTINGS.ready;
    setSave('loading');
    const k = keyOf();
    let data = null;
    try {
      const r = await fetch('/api/item?key=' + enc(k), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && j.data) data = j.data; }
    } catch (e) { /* offline: start fresh */ }
    if (k !== keyOf()) return;   // user already switched slot
    const base = defaults(cur.kind);
    cur.data = Object.assign(base, data || {});
    cur.data.photoPos = Object.assign(base.photoPos, (data && data.photoPos) || {});
    if (cur.data.hasPhoto) {
      try {
        const r = await fetch('/api/photo?key=' + enc(k), { cache: 'no-store' });
        if (r.ok) { const blob = await r.blob(); cur.photo = await blobToImg(blob); } else { cur.data.hasPhoto = false; }
      } catch (e) { cur.data.hasPhoto = false; }
    }
    if (k !== keyOf()) return;
    cur.loaded = true;
    lastSaved = data ? snapshot() : '';
    setSave(data ? 'saved' : 'idle');
    buildControls();
    scheduleRender();
  }
  const blobToImg = (blob) => new Promise(res => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });

  // photo upload: downscale to 2200px JPEG, keep it on the server for this slot
  function uploadPhoto(file) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const s = Math.min(1, PHOTO_MAX / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          c.toBlob((blob) => {
            const k = keyOf();
            setSave('saving');
            fetch('/api/photo?key=' + enc(k), { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
              .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return blobToImg(blob); })
              .then(img => {
                cur.photo = img; cur.data.hasPhoto = true;
                cur.data.photoPos = { post: { z: 1, x: 0, y: 0 }, story: { z: 1, x: 0, y: 0 } };
                lastSaved = ''; flushSave(); buildControls(); scheduleRender(); resolve();
              })
              .catch(() => { setSave('error'); resolve(); });
          }, 'image/jpeg', 0.92);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function removePhoto() {
    fetch('/api/photo?key=' + enc(keyOf()), { method: 'DELETE' }).catch(() => {});
    cur.photo = null; cur.data.hasPhoto = false; scheduleSave(); buildControls(); scheduleRender();
  }

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const fmtDateNl = (iso) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${DAYS[dt.getDay()]} ${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`; };

  function slotLabel(n) {
    const l = lsGet(LS_LABELS)[`${cur.kind}:${n}`];
    return `Slot ${n}${l ? ' · ' + l : ''}`;
  }
  function updateSlotLabel() {
    const d = cur.data; if (!d || cur.kind === 'announce') return;
    const map = lsGet(LS_LABELS); map[`${cur.kind}:${cur.slot}`] = `${clubLabel(d.home, (clubsById[d.home] || {}).label || d.home)} – ${clubLabel(d.away, (clubsById[d.away] || {}).label || d.away)}`; lsSet(LS_LABELS, map);
    const opt = document.querySelector(`#hnlSlot option[value="${cur.slot}"]`); if (opt) opt.textContent = slotLabel(cur.slot);
  }

  function clubSelect(id, value) {
    return `<select id="${id}">${clubs.map(c => `<option value="${esc(c.id)}"${c.id === value ? ' selected' : ''}>${esc(clubLabel(c.id, c.label))}</option>`).join('')}</select>`;
  }

  const widthSelect = (id, v) => `<select id="${id}">${[['3', 'Smal'], ['5', 'Normaal'], ['6', 'Breed']].map(([k, l]) => `<option value="${k}"${String(v) === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

  function buildControls() {
    const box = $('hnlControls'); if (!box || !cur.data) return;
    const d = cur.data, isNext = cur.kind !== 'announce';
    let html = `<div class="panel-step"><div class="panel-step-title"><span class="step-num">1</span> ${isNext ? 'Wedstrijd' : 'Tekst'}</div>`;
    html += `<div class="field"><label for="hnlSlot">Opslagplek</label><select id="hnlSlot">${Array.from({ length: SLOTS }, (_, i) => `<option value="${i + 1}"${i + 1 === cur.slot ? ' selected' : ''}>${esc(slotLabel(i + 1))}</option>`).join('')}</select></div>`;
    if (isNext) {
      html += `<div class="field"><label for="hnlHome">Thuisclub (logo)</label>${clubSelect('hnlHome', d.home)}</div>
        <div class="field"><label for="hnlHomeName">Naam thuis (zoals op de visual)</label><input type="text" id="hnlHomeName" value="${esc(d.homeName)}"></div>
        <div class="field"><label for="hnlAway">Uitclub (logo)</label>${clubSelect('hnlAway', d.away)}</div>
        <div class="field"><label for="hnlAwayName">Naam uit</label><input type="text" id="hnlAwayName" value="${esc(d.awayName)}"></div>
        <div class="field"><label for="hnlTime">Aftrap</label><input type="text" id="hnlTime" value="${esc(d.time)}" placeholder="19:00"></div>
        <div class="field"><label for="hnlDateISO">Datum</label><input type="date" id="hnlDateISO" value="${esc(d.dateISO)}"></div>
        <div class="field"><label for="hnlDate">Datumtekst (aanpasbaar)</label><input type="text" id="hnlDate" value="${esc(d.date)}"></div>
        <div class="field"><label for="hnlLabel">Competitietekst</label><input type="text" id="hnlLabel" value="${esc(d.label)}"></div>
        <button class="btn btn-link" id="hnlSwap" type="button">⇄ Thuis en uit omdraaien</button>`;
    } else {
      html += `<div class="field"><label for="hnlL1">Kop, regel 1</label><input type="text" id="hnlL1" value="${esc(d.l1)}"></div>
        <div class="field"><label for="hnlL2">Kop, regel 2</label><input type="text" id="hnlL2" value="${esc(d.l2)}"></div>
        <div class="field"><label>Letterbreedte regel 1 / regel 2</label><div class="hnl-pair">${widthSelect('hnlL1w', d.l1w)}${widthSelect('hnlL2w', d.l2w)}</div></div>
        <div class="field"><label>Balk</label>
          <div class="hnl-triple"><input type="text" id="hnlB1" value="${esc(d.b1)}" aria-label="Woord 1"><input type="text" id="hnlB2" value="${esc(d.b2)}" aria-label="Tussentekst"><input type="text" id="hnlB3" value="${esc(d.b3)}" aria-label="Slot"></div></div>`;
    }
    html += `</div><div class="panel-step"><div class="panel-step-title"><span class="step-num">2</span> Opmaak</div>
      <div class="field"><label>Formaat</label><div class="mode-tabs mode-tabs-compact" id="hnlFormat"><button type="button" class="mode-tab${d.format === 'post' ? ' active' : ''}" data-f="post">Post 1080×1350</button><button type="button" class="mode-tab${d.format === 'story' ? ' active' : ''}" data-f="story">Story 1080×1920</button></div></div>
      <label class="photo-btn" id="hnlPhotoDrop" for="hnlPhotoInput"><span class="photo-btn-icon">📷</span><span class="photo-btn-text">${d.hasPhoto ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">klik, of sleep hier een afbeelding in${isNext ? ' · zonder foto krijg je het kleurvlak' : ''}</span></label>
      <input type="file" id="hnlPhotoInput" accept="image/*" hidden>`;
    if (d.hasPhoto) {
      html += `<div class="field"><label for="hnlZoom">Zoom</label><input type="range" id="hnlZoom" min="100" max="300" value="${Math.round(d.photoPos[d.format].z * 100)}"></div>
        <button class="btn btn-link" id="hnlPhotoRemove" type="button">✕ Verwijder foto</button><p class="hint">Sleep op de preview om de foto te verschuiven.</p>`;
    }
    html += `<label class="hnl-check"><input type="checkbox" id="hnlDecor"${d.decor ? ' checked' : ''}> ${cur.kind === 'nextmen' ? 'Swoosh' : 'Lijnen'} tonen</label></div>
      <div class="panel-step panel-step-last"><div class="panel-step-title"><span class="step-num">3</span> Exporteren</div>
      <button class="btn btn-primary" id="hnlExport" type="button">⬇ Exporteer als PNG</button></div>`;
    box.innerHTML = html;
    bindControls();
  }

  function bindControls() {
    const d = cur.data;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    const set = (patch, rebuild) => { Object.assign(d, patch); scheduleRender(); scheduleSave(); updateSlotLabel(); if (rebuild) buildControls(); };
    on('hnlSlot', 'change', (e) => { flushSave().then(() => { cur.slot = parseInt(e.target.value, 10); loadItem(); }); });
    on('hnlHome', 'change', (e) => { set({ home: e.target.value, homeName: clubName(e.target.value) }, true); });
    on('hnlAway', 'change', (e) => { set({ away: e.target.value, awayName: clubName(e.target.value) }, true); });
    const rememberName = (clubId, name) => { const m = lsGet(LS_NAMES); m[clubId] = name; lsSet(LS_NAMES, m); };
    on('hnlHomeName', 'input', (e) => { set({ homeName: e.target.value }); rememberName(d.home, e.target.value); });
    on('hnlAwayName', 'input', (e) => { set({ awayName: e.target.value }); rememberName(d.away, e.target.value); });
    on('hnlTime', 'input', (e) => set({ time: e.target.value }));
    on('hnlDateISO', 'change', (e) => { if (e.target.value) set({ dateISO: e.target.value, date: fmtDateNl(e.target.value) }, true); });
    on('hnlDate', 'input', (e) => set({ date: e.target.value }));
    on('hnlLabel', 'input', (e) => set({ label: e.target.value }));
    on('hnlSwap', 'click', () => set({ home: d.away, away: d.home, homeName: d.awayName, awayName: d.homeName }, true));
    on('hnlL1', 'input', (e) => set({ l1: e.target.value }));
    on('hnlL2', 'input', (e) => set({ l2: e.target.value }));
    on('hnlL1w', 'change', (e) => set({ l1w: e.target.value }));
    on('hnlL2w', 'change', (e) => set({ l2w: e.target.value }));
    on('hnlB1', 'input', (e) => set({ b1: e.target.value }));
    on('hnlB2', 'input', (e) => set({ b2: e.target.value }));
    on('hnlB3', 'input', (e) => set({ b3: e.target.value }));
    on('hnlDecor', 'change', (e) => set({ decor: e.target.checked }));
    document.querySelectorAll('#hnlFormat [data-f]').forEach(b => b.addEventListener('click', () => set({ format: b.dataset.f }, true)));
    on('hnlPhotoInput', 'change', (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadPhoto(f); });
    on('hnlPhotoRemove', 'click', removePhoto);
    on('hnlZoom', 'input', (e) => { d.photoPos[d.format].z = parseInt(e.target.value, 10) / 100; scheduleRender(); scheduleSave(); });
    const drop = $('hnlPhotoDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag-over'); }));
      drop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) uploadPhoto(f); });
    }
    on('hnlExport', 'click', exportPng);
  }

  // drag the photo on the preview
  function bindCanvasDrag() {
    const cv = canvas(); if (!cv || cv._bound) return; cv._bound = true;
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      const d = cur.data; if (!d || !d.hasPhoto) return;
      const r = cv.getBoundingClientRect(); const k = cv.width / r.width;
      const y = (e.clientY - r.top) * k;
      const f = FORMATS[d.format]; const lim = cur.kind === 'announce' ? f.photoH.announce : f.P;
      if (y > lim) return;
      drag = { x: e.clientX, y: e.clientY, k, ox: d.photoPos[d.format].x, oy: d.photoPos[d.format].y };
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return; const p = cur.data.photoPos[cur.data.format];
      p.x = drag.ox + (e.clientX - drag.x) * drag.k; p.y = drag.oy + (e.clientY - drag.y) * drag.k;
      scheduleRender();
    });
    const end = () => { if (!drag) return; drag = null; cv.style.cursor = ''; scheduleSave(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  function exportPng() {
    const d = cur.data; const cv = canvas();
    const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const name = cur.kind === 'announce' ? `HNL-aankondiging_${d.format}.png` : `HNL-${cur.kind === 'nextmen' ? 'heren' : 'dames'}_${slug(d.home)}-${slug(d.away)}_${d.format}.png`;
    flushSave();
    render().then(() => cv.toBlob((blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png'));
  }

  // ---------- Public API (used by the home menu in script.js) ----------
  window.HNL = {
    NAMES: { announce: 'Aankondiging', nextmen: 'Next heren', nextwomen: 'Next dames' },
    open(kind) {
      cur.kind = kind; cur.slot = 1;
      $('hnlTitle').textContent = KINDS[kind].title;
      $('hnlApp').dataset.kind = kind;
      $('hnlControls').innerHTML = '';
      bindCanvasDrag();
      loadItem();
    },
    close() { return flushSave(); },
  };
})();
