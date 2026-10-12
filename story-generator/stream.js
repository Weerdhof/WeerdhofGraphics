// SHL stream dashboard: follows the start of one match. See stream.html for the URL parameters.
// The look follows the real SHL stream overlays: off-white bars, a lime tab and caption bar, the SHL icon between the teams
// inside a lime chevron frame, the white logo in the corner. Data and planning come from the server (/api/stream-state);
// the server also supplies "now", so a wrong clock on the streaming computer cannot shift the scenes.
(() => {
  const q = new URLSearchParams(location.search);
  const SIM = q.has('sim') ? parseFloat(q.get('sim')) : null;          // minutes before the start (test)
  const SPEED = Math.max(1, parseFloat(q.get('speed') || '1') || 1);
  const DEBUG = q.get('debug') === '1';
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), layers = $('layers'), dbg = $('debug');

  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
  addEventListener('resize', fit); fit();
  if (DEBUG) dbg.hidden = false;
  if (q.get('bg')) document.body.style.background = q.get('bg');       // test: a colour behind the overlay (e.g. bg=%23446)

  // ---------- data ----------
  let S = null, skew = 0, simStart = Date.now(), lastSig = '';
  const passthrough = ['home', 'away'].filter(k => q.get(k)).map(k => `${k}=${encodeURIComponent(q.get(k))}`).join('&');
  async function load() {
    try {
      const r = await fetch(q.get('mock') || '/api/stream-state' + (passthrough ? '?' + passthrough : ''), { cache: 'no-store' });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      skew = j.now - Date.now();
      const first = !S;
      S = j;
      if (first) simStart = Date.now();
    } catch (e) { /* keep showing what we have */ }
  }

  // ---------- time ----------
  const nowMs = () => SIM != null && S && S.match && S.match.kickoff ? S.match.kickoff * 1000 - SIM * 60000 + (Date.now() - simStart) * SPEED : Date.now() + skew;
  const minutesLeft = () => (S && S.match && S.match.kickoff) ? (S.match.kickoff * 1000 - nowMs()) / 60000 : null;
  function pickScene(T) {
    if (!S || !S.match || T == null || T <= 0) return 'clean';
    let active = null;
    for (const sg of S.config.segments) if (T <= sg.from) active = sg.scene;   // sorted from big to small: the last match is the closest one
    return active || 'clean';
  }

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const comp = () => (S && S.match && S.match.comp) || 'men';
  const women = () => comp() === 'women';
  const ICON = 'assets/singlematch/mark.png';
  const NAMES = {
    men: { SAB: 'Achilles Bocholt', IZE: 'HBC Izegem', EUP: 'KTSV Eupen', HCS: 'Sprimont', BEV: 'Bevo HC', PEL: 'Sporting Pelt', BWH: 'Hercules', DFS: 'DFS Arnhem', HUP: 'Hurry-Up', HCV: 'HC Visé', HVA: 'HV Aalsmeer', HUB: 'HUBO Handbal', VOL: 'KRAS/Volendam', TAC: 'Tachos' },
    women: { DSVD: 'DSVD', 'E&O': 'E&O', FOR: 'Foreholte', KWI: 'Kwiek', MHV: 'MHV', PSV: 'PSV', QUI: 'Quintus', SEW: 'SEW', 'V&L': 'V&L', VEN: 'Fortes Venlo', VOC: 'VOC', VOL: 'Volendam', VZV: 'VZV', WPK: 'Westlandia' },
  };
  const CLUB_COLORS = {
    men: { BEV: '#fddb75', BWH: '#6f84ba', DFS: '#ae5b53', EUP: '#fd7e79', HCS: '#f8d168', HCV: '#76b1dc', HUB: '#727ab3', HUP: '#fdb875', HVA: '#edd7aa', IZE: '#7396ba', PEL: '#db7169', SAB: '#5096dc', TAC: '#6fac94', VOL: '#fd9652' },
    women: { DSVD: '#e1471c', 'E&O': '#00a456', FOR: '#b87cff', KWI: '#fa4234', MHV: '#008845', PSV: '#fa4234', QUI: '#008845', SEW: '#1330b4', 'V&L': '#005ba2', VEN: '#193676', VOC: '#4c8d40', VOL: '#f78823', VZV: '#ee2b07', WPK: '#3ca815' },
  };
  const TX = {
    men: { round: 'Round', matchday: 'Matchday', results: 'Results', today: 'Today', stand: 'Standings', h2h: 'Head to head', pts: 'PTS', prev: 'Previous meeting', first: 'First meeting of the season', none: 'No results yet',
           cap: 'Coinmerce Super Handball League - Regular season' },
    women: { round: 'Ronde', matchday: 'Speelronde', results: 'Uitslagen', today: 'Vandaag', stand: 'Stand', h2h: 'Head to head', pts: 'PTN', prev: 'Vorige ontmoeting', first: 'Eerste ontmoeting van het seizoen', none: 'Nog geen uitslagen',
             cap: 'Coinmerce Super Handball League Women - Regular season' },
  };
  const DAYS = { men: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], women: ['ZONDAG', 'MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'] };
  const MONTHS = { men: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], women: ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'] };
  const MONTHS_FULL = { men: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'], women: ['JANUARI', 'FEBRUARI', 'MAART', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AUGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DECEMBER'] };
  const T_ = () => TX[comp()];
  const dateOf = (d, m) => { const now = new Date(); let y = now.getFullYear(); const t = new Date(y, m - 1, d); if (t - now > 200 * 864e5) y--; else if (now - t > 200 * 864e5) y++; return new Date(y, m - 1, d); };
  const span = (a, b) => {
    const M = MONTHS[comp()];
    if (!a) return '';
    if (!b || (a.day === b.day && a.month === b.month)) return `${a.day} ${M[a.month - 1]}`;
    return a.month === b.month ? `${a.day}–${b.day} ${M[b.month - 1]}` : `${a.day} ${M[a.month - 1]} – ${b.day} ${M[b.month - 1]}`;
  };
  const longDate = (d, m) => `${DAYS[comp()][dateOf(d, m).getDay()]} ${d} ${MONTHS_FULL[comp()][m - 1]}`;
  const nameOf = (code, feed) => (NAMES[comp()][code] || String(feed || code || '').replace(/\s+(HS|DS)\d+\s*$/i, '')).toUpperCase();
  const sizeCls = (name, a, b) => name.length <= a ? '' : name.length <= b ? ' m' : ' s';
  const crest = (code, size) => {
    const dir = women() ? 'assets/women/teams' : 'assets/teams', s = size / 158;
    const img = code ? `background-image:url('${dir}/${encodeURIComponent(code)}.png');background-size:${1200 * s}px ${200 * s}px;background-position:0 ${-19 * s}px;` : '';
    return `<span class="crest" style="width:${size}px;height:${Math.round(159 * s)}px;${img}"></span>`;
  };
  const logoSrc = () => women() ? 'assets/women/footer-logo-women.png' : 'assets/footer-logo.png';

  // the lime chevron frame around the score / time: an outline that draws itself
  const frame = (w, h, slant) => `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polygon class="draw" pathLength="1" points="${slant},1.5 ${w - slant},1.5 ${w - 1.5},${h - 1.5} 1.5,${h - 1.5}" fill="none" stroke="var(--acc)" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
  const logo = () => `<img class="lg" src="${logoSrc()}" alt="">`;
  const tab = (main, small) => `<div class="tab">${esc(main)}${small ? `<small>${esc(small)}</small>` : ''}</div>`;
  const cap = (text) => `<div class="cap"><span>${esc(text)}</span></div>`;

  // match rows, built like the Results graphic (played: crest badges, winner arrow in the club colour, icon, big scores) and the
  // Schedule graphic (still to play: the two team strips with the start time in the middle)
  const stripUrl = (code) => `url('${women() ? 'assets/women/teams' : 'assets/teams'}/${encodeURIComponent(code || '')}.png')`;
  function row(m, i, firstDay) {
    const played = m.played !== false && m.homeScore != null && m.awayScore != null;
    if (!played) {
      const other = firstDay && (m.day !== firstDay.day || m.month !== firstDay.month);
      return `<div class="rr sched${m.me ? ' me' : ''}" style="--i:${i}"><div class="half l" style="background-image:${stripUrl(m.homeCode)}"></div><div class="half r" style="background-image:${stripUrl(m.awayCode)}"></div>
        <div class="tm${other ? ' d' : ''}">${other ? `<small>${esc(span({ day: m.day, month: m.month }))}</small>` : ''}${esc(m.time || '–')}</div></div>`;
    }
    const hs = parseFloat(m.homeScore), as = parseFloat(m.awayScore), win = hs > as ? 'links' : as > hs ? 'rechts' : null;
    const col = CLUB_COLORS[comp()], wc = win ? col[win === 'links' ? m.homeCode : m.awayCode] : null;
    return `<div class="rr${m.me ? ' me' : ''}" style="--i:${i}">${win ? `<div class="arw" style="--mask:url(assets/arrows/winst-${win}.png);--wc:${wc || 'var(--acc)'}"></div>` : ''}
      <div class="bd l">${crest(m.homeCode, 130)}</div><div class="bd r">${crest(m.awayCode, 130)}</div><div class="ic"><i></i></div>
      <div class="s h${hs <= as ? ' lo' : ''}">${esc(m.homeScore)}</div><div class="s a${as <= hs ? ' lo' : ''}">${esc(m.awayScore)}</div></div>`;
  }
  // the matches as one narrow list, left-aligned (the rest of the picture stays free): the rows at half size; more than 8 would scroll
  const VISIBLE_ROWS = 8;
  const rowsPanel = (title, small, list) => {
    const items = list.slice(0, 12), n = items.length, vis = Math.min(Math.max(n, 1), VISIBLE_ROWS);
    const full = (k) => k * 148 + (k - 1) * 14, dist = Math.max(0, full(n) - full(vis)) / 2;
    const cells = n ? items.map((m, i) => row(m, i, items[0])).join('') : `<div class="rr empty">${esc(T_().none)}</div>`;
    return `<div class="pn left sm" style="top:110px;width:440px">${tab(title, small)}<div class="lst${n > vis ? ' scroll' : ''}" style="--h:${full(vis) / 2}px;--dist:${dist}px"><div class="mg-in"><div class="mg">${cells}</div></div></div>${cap(T_().cap)}</div>`;
  };

  // ---------- scenes ----------
  const scenes = {
    // all matches of the round of this match: the score when played, the start time when not
    round() {
      const r = S.round || { matches: [] }, list = r.matches, first = list[0], last = list[list.length - 1];
      const title = r.round != null ? `${T_().round} ${r.round}` : T_().matchday;
      return `${logo()}${rowsPanel(title, first ? span({ day: first.day, month: first.month }, { day: last.day, month: last.month }) : '', list)}`;
    },
    results() {
      const md = S.matchday, list = S.results || [];
      return `${logo()}${rowsPanel(T_().results, md ? `${md.round != null ? T_().round + ' ' + md.round + ' · ' : ''}${span(md.from, md.to)}` : '', list.map(x => Object.assign({ played: true }, x)))}`;
    },
    schedule() {
      const list = (S.schedule || []).map(x => Object.assign({ played: false, me: x.homeCode === S.match.homeCode && x.awayCode === S.match.awayCode }, x));
      return `${logo()}${rowsPanel(T_().today, span({ day: S.match.day, month: S.match.month }), list)}`;
    },
    standings() {
      const m = S.match, rows = (S.standings || []).slice(0, 14).map((r, i) => {
        const me = r.code && (r.code === m.homeCode || r.code === m.awayCode), nm = nameOf(r.code, r.name);
        return `<div class="st-r${me ? ' me' : ''}" style="--i:${i}"><span class="pos">${r.pos}</span>${crest(r.code, 30)}<span class="nm">${esc(nm)}</span><span>${esc(r.played)}</span><span>${esc(r.w)}</span><span>${esc(r.d)}</span><span>${esc(r.l)}</span><span class="pts">${esc(r.points)}</span></div>`;
      }).join('');
      return `${logo()}<div class="pn left sm" style="top:110px;width:550px">${tab(T_().stand, '')}
        <div class="st-head"><span>#</span><span></span><span>CLUB</span><span>P</span><span>W</span><span>D</span><span>L</span><span>${T_().pts}</span></div>${rows}${cap(T_().cap)}</div>`;
    },
    h2h() {
      const m = S.match, st = (code) => (S.standings || []).find(x => x.code === code), mt = S.meeting;
      const col = (code) => {
        const row = st(code), games = ((S.form || {})[code] || []).slice(-3).reverse();
        const lines = [0, 1, 2].map(i => {
          const g = games[i];
          return g ? `<div class="hh-g"><span class="chip ${g.res}">${g.res}</span>${crest(g.opp, 36)}<span class="opp">${esc(g.opp || '')}</span><span class="res">${g.gf} – ${g.ga}</span></div>`
                   : `<div class="hh-g none">${i === 0 ? esc(T_().none) : '&nbsp;'}</div>`;
        }).join('');
        return `<div class="hh-col"><div class="hh-top"><span>${row ? '#' + row.pos + ' · ' + esc(row.points) + ' ' + T_().pts : '–'}</span><small>${row ? esc(row.w) + 'W ' + esc(row.d) + 'D ' + esc(row.l) + 'L' : ''}</small></div>${lines}</div>`;
      };
      const meet = mt ? `${T_().prev} · ${span({ day: mt.day, month: mt.month })} · ${mt.homeCode || mt.home} ${mt.homeScore} – ${mt.awayScore} ${mt.awayCode || mt.away}` : T_().first;
      return `${logo()}<div class="pn" style="top:230px;width:1200px">${tab(T_().h2h, '')}
        <div class="hh-bar"><div class="half l" style="background-image:${stripUrl(m.homeCode)}"></div><div class="half r" style="background-image:${stripUrl(m.awayCode)}"></div><div class="ic"><i></i></div></div>
        <div class="hh-det">${col(m.homeCode)}${col(m.awayCode)}</div>${cap(meet)}</div>`;
    },
    // the match title is the Match graphic itself: its own team pieces, mark, time and date at their original positions, scaled up
    title() {
      const m = S.match, d = dateOf(m.day, m.month), wd = DAYS[comp()][d.getDay()].slice(0, 3), dd = String(m.day).padStart(2, '0') + '-' + String(m.month).padStart(2, '0');
      const sub = `${wd} ${dd}${m.round != null ? ' | ' + T_().round.toUpperCase() + ' ' + m.round : ''}`;
      if (!women()) {
        // the Match graphic stretched: the two team pieces stay as they are and the centre of the piece is stretched between them.
        // Everything is painted into one bitmap on whole pixels, so there is no seam where the parts meet.
        const k = 560 / 483, H = Math.round(256 * k);
        return `${logo()}<div class="ti-wrap" style="left:60px;top:700px;width:1800px;height:${H}px;transform:none">
          <canvas class="tcv" width="1800" height="${H}" data-home="${esc(m.homeCode)}" data-away="${esc(m.awayCode)}" style="left:0;top:0"></canvas>
          <img class="mk" src="assets/singlematch/mark.png" alt="" style="left:${(900 - 181 * k / 2).toFixed(1)}px;top:0;width:${(181 * k).toFixed(1)}px;height:${(156 * k).toFixed(1)}px">
          <div class="tt" style="top:${(186 * k).toFixed(1)}px;font-size:${(61 * k).toFixed(1)}px">${esc(m.time || '')}</div><div class="dd" style="top:${(227 * k).toFixed(1)}px;font-size:${(26 * k).toFixed(1)}px">${esc(sub)}</div></div>`;
      }
      const WCODE = { 'E&O': 'ENO', FOR: 'FORE', VEN: 'FORV', 'V&L': 'VEL' }, wc = (c) => WCODE[c] || c;
      return `${logo()}<div class="ti-wrap" style="width:967px;height:281px;transform:translateX(-50%) scale(1.55)">
        <img src="assets/women/singlematch/bar.png" alt="" style="left:0;top:102px;width:967px;height:179px">
        <img src="assets/women/singlematch/teams/${encodeURIComponent(wc(m.homeCode))}.png" alt="" style="left:24px;top:0;width:242px;height:258px">
        <img src="assets/women/singlematch/teams/${encodeURIComponent(wc(m.awayCode))}.png" alt="" style="left:697px;top:1px;width:243px;height:260px">
        <img class="mk" src="assets/women/singlematch/mark.png" alt="" style="left:420px;top:29px;width:126px;height:145px">
        <div class="tt" style="top:184px">${esc(m.time || '')}</div><div class="dd" style="top:244px;font-size:32px">${esc(sub)}</div></div>`;
    },
    form() { return scenes.h2h(); },
    clean() { return ''; },
  };

  // ---------- rendering + transitions ----------
  let cur = null;
  const sceneHtml = (scene) => {
    const html = scenes[scene] ? scenes[scene]() : '';
    return scene === 'clean' || !html ? '' : `<div class="scene ${comp()}${S.config.theme !== 'transparent' ? ' solid' : ''}">${html}</div>`;
  };
  // paints the stretched Match graphic (title scene) into its canvas
  function paintTitle(root) {
    root.querySelectorAll('canvas.tcv').forEach(cv => {
      const load = (code) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `assets/singlematch/teams/${encodeURIComponent(code)}.png`; });
      Promise.all([load(cv.dataset.home), load(cv.dataset.away)]).then(([h, a]) => {
        if (!h || !a || !cv.isConnected) return;
        const c = cv.getContext('2d'), w = 560, ph = cv.height;
        c.imageSmoothingQuality = 'high';
        c.drawImage(h, 0, 0, 966, 510, 0, 0, w, ph);                              // home piece
        c.drawImage(a, 966, 0, 966, 510, cv.width - w, 0, w, ph);                 // away piece
        c.drawImage(h, 964, 0, 2, 510, w, 0, cv.width - 2 * w, ph);               // the centre between them
      });
    });
  }
  // team names shrink until they fit their space
  function fitNames(root) {
    root.querySelectorAll('.nm').forEach(el => {
      let fs = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && fs > 16) { fs -= 2; el.style.fontSize = fs + 'px'; }
    });
  }
  function show(scene) {
    const old = [...layers.children];
    const root = document.createElement('div');
    root.className = 'layer';
    root.innerHTML = sceneHtml(scene);
    layers.appendChild(root); fitNames(root); paintTitle(root);
    old.forEach(o => { o.classList.add('leave'); setTimeout(() => o.remove(), 400); });
  }
  const dataSig = () => S ? JSON.stringify([S.match && [S.match.homeCode, S.match.awayCode, S.match.time], S.results, S.standings, S.schedule, S.round, S.meeting, S.config.theme]) : '';

  function tick() {
    if (!S) return;
    const T = minutesLeft(), scene = pickScene(T), sig = dataSig();
    if (scene !== cur) {
      cur = scene; lastSig = sig;
      show(scene);
    } else if (sig !== lastSig) {
      lastSig = sig;                       // new data: swap quietly, without restarting the entrance animations
      const old = [...layers.children];
      const root = document.createElement('div'); root.className = 'layer';
      root.innerHTML = sceneHtml(scene);
      root.querySelectorAll('*').forEach(el => { el.style.animation = 'none'; });
      layers.appendChild(root); fitNames(root); paintTitle(root); old.forEach(o => o.remove());
    }
    if (DEBUG) dbg.textContent = `T-${T == null ? '?' : T.toFixed(2)} min · scene ${scene}${S.match ? ' · ' + S.match.home + ' – ' + S.match.away : ' · geen wedstrijd'}${SIM != null ? ' · sim x' + SPEED : ''}`;
  }

  load().then(() => { tick(); });
  setInterval(tick, 500);
  setInterval(load, 30000);
})();
