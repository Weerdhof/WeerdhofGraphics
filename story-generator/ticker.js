// SHL liveticker: the last N results (one card per match) in the Results-list design,
// as a news-broadcast bar pinned to the bottom of the page (scrolls like a TV ticker).
// Embed:  <iframe src=".../ticker.html?comp=men" style="position:fixed;left:0;bottom:0;width:100%;height:110px;border:0"></iframe>
// OBS:    Browser source, 1920x1080, same URL — the page is transparent except for the bar.
// Params: comp=men|women   n=1..10 (default 7)   dates=1 (date under each score)
//         layout=list (vertical list instead of the bar)   bg=<hex>|transparent (bar strip colour)
//         label=0 (hide the RESULTS/UITSLAGEN label)   size=<bar height px, default 110>   speed=<px per second, default 70>   refresh=<seconds, default 60>
(() => {
  const q = new URLSearchParams(location.search);
  const compKey = q.get('comp') === 'women' ? 'women' : 'men';
  const N = Math.max(1, Math.min(10, parseInt(q.get('n') || '7', 10) || 7));
  const showDates = q.get('dates') === '1';
  const REFRESH_MS = Math.max(15, parseInt(q.get('refresh') || '60', 10) || 60) * 1000;
  const layout = q.get('layout') === 'list' ? 'list' : 'bar';
  const BAR_H = Math.max(50, parseInt(q.get('size') || '110', 10) || 110);
  const SPEED = Math.max(10, parseInt(q.get('speed') || '70', 10) || 70);
  const bgParam = q.get('bg');
  const bg = bgParam === 'transparent' ? null : bgParam ? '#' + bgParam.replace(/^#/, '') : (layout === 'bar' ? 'rgba(26,27,56,.94)' : null);

  const W = 880, ROW_H = 148, PITCH = 166, S = 1.5;
  const CREST = { left: 0, right: 1042, y: 19, w: 158, h: 159 }, BADGE = 130, MARGIN = 15;
  const CFG = {
    men: {
      dir: 'assets/teams', text: '#1b2450', radius: 0, badgeRadius: 0, border: null, locale: 'en-GB',
      colors: { BEV: '#fddb75', BWH: '#6f84ba', DFS: '#ae5b53', EUP: '#fd7e79', HCS: '#f8d168', HCV: '#76b1dc', HUB: '#727ab3', HUP: '#fdb875', HVA: '#edd7aa', IZE: '#7396ba', PEL: '#db7169', SAB: '#5096dc', TAC: '#6fac94', VOL: '#fd9652' },
      aliases: { SAB: ['bocholt'], IZE: ['izegem'], EUP: ['eupen'], HCS: ['sprimont'], BEV: ['bevo'], PEL: ['pelt'], BWH: ['hercules', 'whc'], DFS: ['arnhem'], HUP: ['hurry'], HCV: ['vise', 'visé'], HVA: ['aalsmeer', 'royalfloraholland'], HUB: ['hubo'], VOL: ['volendam'], TAC: ['tachos', 'mossel', 'witte ster'] },
    },
    women: {
      dir: 'assets/women/teams', text: '#1a1b38', radius: 26, badgeRadius: 18, border: '#e7e0ef', locale: 'nl-NL',
      colors: { DSVD: '#e1471c', 'E&O': '#00a456', FOR: '#b87cff', KWI: '#fa4234', MHV: '#008845', PSV: '#fa4234', QUI: '#008845', SEW: '#1330b4', 'V&L': '#005ba2', VEN: '#193676', VOC: '#4c8d40', VOL: '#f78823', VZV: '#ee2b07', WPK: '#3ca815' },
      aliases: { DSVD: ['dsvd', 'aqqo'], 'E&O': ['misker'], FOR: ['foreholte'], KWI: ['kwiek'], MHV: ['m.h.v'], PSV: ['hypotheekvisie', 'eindhoven'], QUI: ['quintus'], SEW: ['westfriesland'], 'V&L': ['geonius'], VEN: ['venlo', 'cabooter'], VOC: ['ruitenheer'], VOL: ['volendam'], VZV: ['juro'], WPK: ['westlandia'] },
    },
  }[compKey];

  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const codeOf = (name) => {
    const n = norm(name);
    return Object.keys(CFG.aliases).find(c => CFG.aliases[c].some(a => n.includes(a))) || null;
  };

  const imgs = new Map();
  const loadImg = (src) => new Promise(res => {
    if (imgs.has(src)) return res(imgs.get(src));
    const im = new Image();
    im.onload = () => { imgs.set(src, im); res(im); };
    im.onerror = () => res(null);
    im.src = src;
  });
  const tinted = new Map();
  function tint(img, id, color) {
    const key = id + color;
    if (tinted.has(key)) return tinted.get(key);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const cc = c.getContext('2d');
    cc.drawImage(img, 0, 0);
    cc.globalCompositeOperation = 'source-in';
    cc.fillStyle = color;
    cc.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c);
    return c;
  }
  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  const canvas = document.getElementById('c');
  const bar = document.getElementById('bar');
  const track = document.getElementById('track');
  const tag = document.getElementById('tag');
  let ctx = canvas.getContext('2d');
  let shown = '';
  document.body.classList.add(layout);
  const showLabel = q.get('label') !== '0';
  if (layout === 'bar') {
    bar.style.height = BAR_H + 'px';
    if (bg) bar.style.background = bg;
    tag.style.background = compKey === 'women' ? '#a62ee0' : '#caff1c';   // men: SHL green
    tag.style.color = compKey === 'women' ? '#fff' : '#1a1b38';
    tag.textContent = compKey === 'women' ? 'UITSLAGEN' : 'RESULTS';
    tag.style.fontSize = Math.round(BAR_H * .24) + 'px';
    if (!showLabel) { tag.style.display = 'none'; track.style.paddingLeft = '0'; }
  }

  function drawBadge(img, cropX, cx, cy) {
    const x0 = cx - BADGE / 2, y0 = cy - BADGE / 2;
    ctx.save();
    roundRect(ctx, x0, y0, BADGE, BADGE, CFG.badgeRadius);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x0, y0, BADGE, BADGE);
    if (img) {
      const sc = Math.min(BADGE / CREST.w, BADGE / CREST.h);
      const dw = CREST.w * sc, dh = CREST.h * sc;
      ctx.drawImage(img, cropX, CREST.y, CREST.w, CREST.h, cx - dw / 2, cy - dh / 2, dw, dh);
    }
    ctx.restore();
  }

  let art = null;   // { vs, arL, arR }
  function drawRowAt(r, logos, top) {
    const cy = top + ROW_H / 2, cx = W / 2;
    roundRect(ctx, 0, cy - ROW_H / 2, W, ROW_H, CFG.radius);
    ctx.fillStyle = '#fff'; ctx.fill();
    if (CFG.border) { ctx.lineWidth = 2; ctx.strokeStyle = CFG.border; ctx.stroke(); }
    drawBadge(logos[0], CREST.left, MARGIN + BADGE / 2, cy);
    drawBadge(logos[1], CREST.right, W - MARGIN - BADGE / 2, cy);
    const hs = r.homeScore, as = r.awayScore, { vs, arL, arR } = art;
    let ha = 1, aa = 1, win = null;
    if (hs > as) { aa = .35; win = 'home'; } else if (as > hs) { ha = .35; win = 'away'; } else { ha = aa = .35; }
    if (win) {
      const arrow = win === 'home' ? arL : arR;
      const col = CFG.colors[win === 'home' ? r.hc : r.ac] || '#caff1c';
      if (arrow) { const dh = 200 * (W / 1200); ctx.drawImage(tint(arrow, win, col), 0, cy - dh / 2, W, dh); }
    }
    if (vs) { const ih = ROW_H * .48, iw = ih * vs.naturalWidth / vs.naturalHeight; ctx.drawImage(tint(vs, 'vs', CFG.text), cx - iw / 2, cy - ih / 2, iw, ih); }
    const fs = ROW_H * .62, gap = fs * .62;
    ctx.font = `700 ${fs}px "ClashDisplay"`; ctx.fillStyle = CFG.text; ctx.textBaseline = 'middle';
    ctx.globalAlpha = ha; ctx.textAlign = 'right'; ctx.fillText(String(hs), cx - gap, cy);
    ctx.globalAlpha = aa; ctx.textAlign = 'left'; ctx.fillText(String(as), cx + gap, cy);
    ctx.globalAlpha = 1;
    if (showDates) {
      const now = new Date(), y0 = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const d = new Date(r.month >= 8 ? y0 : y0 + 1, r.month - 1, r.day);   // season runs Aug..Jul
      ctx.globalAlpha = .65; ctx.textAlign = 'center'; ctx.font = '600 22px "ClashDisplay"';
      ctx.fillText(d.toLocaleDateString(CFG.locale, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase(), cx, cy + 56);
      ctx.globalAlpha = 1;
    }
  }

  async function draw(rows) {
    const [vs, arL, arR] = await Promise.all([loadImg('assets/vs-icon.png'), loadImg('assets/arrows/winst-links.png'), loadImg('assets/arrows/winst-rechts.png')]);
    art = { vs, arL, arR };
    await Promise.all([document.fonts.load('700 90px ClashDisplay'), document.fonts.load('600 22px ClashDisplay')]);
    const logos = await Promise.all(rows.map(r => Promise.all([loadImg(`${CFG.dir}/${r.hc}.png`), loadImg(`${CFG.dir}/${r.ac}.png`)])));
    if (layout === 'list') {
      const H = Math.max(1, rows.length) * PITCH - (PITCH - ROW_H);
      canvas.width = W * S; canvas.height = H * S;
      ctx = canvas.getContext('2d');
      ctx.setTransform(S, 0, 0, S, 0, 0);
      ctx.clearRect(0, 0, W, H);
      rows.forEach((r, i) => drawRowAt(r, logos[i], i * PITCH));
      return;
    }
    // news bar: [date] [that day's matches] [date] [matches] ... [competition logo], scrolling right-to-left
    const cardH = BAR_H - 26, cardW = Math.round(cardH * W / ROW_H), GAP = Math.round(cardH * .2);
    const accent = compKey === 'women' ? '#a62ee0' : '#caff1c', onAccent = compKey === 'women' ? '#fff' : '#1a1b38';
    const dayLabel = (r) => {
      const now = new Date(), y0 = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const d = new Date(r.month >= 8 ? y0 : y0 + 1, r.month - 1, r.day);
      return d.toLocaleDateString(CFG.locale, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase();
    };
    const groups = [];
    rows.forEach((r, i) => {
      const key = r.month * 100 + r.day;
      let g = groups.find(x => x.key === key);
      if (!g) { g = { key, label: dayLabel(r), items: [] }; groups.push(g); }
      g.items.push(i);
    });
    const logoSrc = compKey === 'women' ? 'assets/women/footer-logo-women.png' : 'assets/footer-logo.png';
    const make = () => {
      const frag = document.createDocumentFragment();
      groups.forEach(g => {
        const chip = document.createElement('div');
        chip.textContent = g.label;
        chip.style.cssText = `flex:none;display:flex;align-items:center;height:${cardH}px;padding:0 ${Math.round(cardH * .45)}px;background:${accent};color:${onAccent};font:700 ${Math.round(cardH * .42)}px/1 ClashDisplay,sans-serif;letter-spacing:.04em;white-space:nowrap;`;
        frag.appendChild(chip);
        g.items.forEach(i => {
          const cv = document.createElement('canvas');
          cv.width = W * 2; cv.height = ROW_H * 2;
          cv.style.cssText = `width:${cardW}px;height:${cardH}px;flex:none;`;
          ctx = cv.getContext('2d');
          ctx.setTransform(2, 0, 0, 2, 0, 0);
          drawRowAt(rows[i], logos[i], 0);
          frag.appendChild(cv);
        });
      });
      const logo = document.createElement('img');
      logo.src = logoSrc;
      logo.style.cssText = `flex:none;height:${Math.round(cardH * .8)}px;width:auto;margin:0 ${Math.round(cardH * .3)}px;${compKey === 'women' ? 'filter:brightness(0) invert(1);' : ''}`;
      frag.appendChild(logo);
      return frag;
    };
    await loadImg(logoSrc);
    track.innerHTML = '';
    track.style.gap = GAP + 'px';
    track.style.animation = 'none';
    track.appendChild(make());
    const one = [...track.children].reduce((w, el) => w + el.getBoundingClientRect().width + GAP, 0);
    const avail = bar.clientWidth - (tag.style.display === 'none' ? 0 : tag.offsetWidth);
    if (one > avail) {            // longer than the screen: scroll, with a second copy for a seamless loop
      track.appendChild(make());
      track.style.setProperty('--shift', `-${one}px`);
      void track.offsetWidth;
      track.style.animation = `scroll ${one / SPEED}s linear infinite`;
    }
  }

  function refresh() {
    fetch('/api/overview?comp=' + compKey, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        const rows = (d.results || [])
          .map(r => ({ ...r, hc: codeOf(r.home), ac: codeOf(r.away) }))
          .filter(r => r.hc && r.ac && r.homeScore != null && r.awayScore != null)
          .sort((a, b) => b.ord - a.ord || (b.time || '').localeCompare(a.time || ''))
          .slice(0, N);
        const sig = JSON.stringify(rows.map(r => [r.hc, r.ac, r.homeScore, r.awayScore, r.day, r.month]));
        if (sig !== shown) { shown = sig; return draw(rows); }
      })
      .catch(() => { /* keep showing the last good frame */ });
  }
  refresh();
  setInterval(refresh, REFRESH_MS);
})();
