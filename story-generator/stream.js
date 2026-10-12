// SHL stream dashboard: follows the kick-off of one match. See stream.html for the URL parameters.
// Data and planning come from the server (/api/stream-state): the server also supplies "now", so a wrong clock on the
// streaming computer cannot shift the scenes.
(() => {
  const q = new URLSearchParams(location.search);
  const SIM = q.has('sim') ? parseFloat(q.get('sim')) : null;          // minutes before kick-off (test)
  const SPEED = Math.max(1, parseFloat(q.get('speed') || '1') || 1);
  const DEBUG = q.get('debug') === '1';
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), layers = $('layers'), wipe = $('wipe'), dbg = $('debug');

  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
  addEventListener('resize', fit); fit();
  if (DEBUG) dbg.hidden = false;

  // ---------- data ----------
  let S = null, skew = 0, simStart = Date.now(), lastSig = '';
  const passthrough = ['comp', 'home', 'away'].filter(k => q.get(k)).map(k => `${k}=${encodeURIComponent(q.get(k))}`).join('&');
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
  const COLORS = {
    men: { BEV: '#fddb75', BWH: '#6f84ba', DFS: '#ae5b53', EUP: '#fd7e79', HCS: '#f8d168', HCV: '#76b1dc', HUB: '#727ab3', HUP: '#fdb875', HVA: '#edd7aa', IZE: '#7396ba', PEL: '#db7169', SAB: '#5096dc', TAC: '#6fac94', VOL: '#fd9652' },
    women: { DSVD: '#e1471c', 'E&O': '#00a456', FOR: '#b87cff', KWI: '#fa4234', MHV: '#008845', PSV: '#fa4234', QUI: '#008845', SEW: '#1330b4', 'V&L': '#005ba2', VEN: '#193676', VOC: '#4c8d40', VOL: '#f78823', VZV: '#ee2b07', WPK: '#3ca815' },
  };
  const TEXT = {
    men: { results: 'Results', roundWord: 'Round', h2h: 'Head to head', stand: 'Standing', last: 'LAST RESULTS', prev: 'PREVIOUS MEETING', first: 'FIRST MEETING OF THE SEASON', vs: 'VS', round: 'Round', standings: 'Standings', next: 'Next up', kick: 'Throw-off in', form: 'Form', schedule: 'Today', pts: 'PTS', wait: 'No results yet', pos: '#', club: 'CLUB', id: 'Match', page: '', locale: 'en-GB' },
    women: { results: 'Uitslagen', roundWord: 'Ronde', h2h: 'Head to head', stand: 'Stand', last: 'LAATSTE UITSLAGEN', prev: 'VORIGE ONTMOETING', first: 'EERSTE ONTMOETING VAN HET SEIZOEN', vs: 'VS', round: 'Ronde', standings: 'Stand', next: 'Zo meteen', kick: 'Start over', form: 'Vorm', schedule: 'Vandaag', pts: 'PTN', wait: 'Nog geen uitslagen', pos: '#', club: 'CLUB', id: 'Wedstrijd', page: '', locale: 'nl-NL' },
  };
  const MONTHS = { men: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], women: ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'] };
  const span = (a, b) => {
    const M = MONTHS[comp()];
    if (!a) return '';
    if (!b || (a.day === b.day && a.month === b.month)) return `${a.day} ${M[a.month - 1]}`;
    return a.month === b.month ? `${a.day}–${b.day} ${M[b.month - 1]}` : `${a.day} ${M[a.month - 1]} – ${b.day} ${M[b.month - 1]}`;
  };
  const crest = (code, size) => {
    const dir = comp() === 'women' ? 'assets/women/teams' : 'assets/teams', s = size / 158;
    const img = code ? `background-image:url('${dir}/${encodeURIComponent(code)}.png');background-size:${1200 * s}px ${200 * s}px;background-position:0 ${-19 * s}px;` : '';
    return `<span class="crest" style="width:${size}px;height:${Math.round(159 * s)}px;${img}"></span>`;
  };
  const nameBr = (n) => esc(n).replace(/\//g, '/<wbr>');   // long names may break after a slash
  const logo = () => comp() === 'women' ? 'assets/women/footer-logo-women.png' : 'assets/footer-logo.png';
  const fmtClock = (min) => { const sec = Math.max(0, Math.ceil(min * 60)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
  const matchLine = () => { const m = S.match; return `${esc(m.homeCode || m.home)} – ${esc(m.awayCode || m.away)}${m.time ? ' · ' + esc(m.time) : ''}`; };

  const header = (title, sub) => `
    <div class="hd">
      <div class="hd-label"><i></i><div><b>${esc(title)}</b><span>${esc(sub || '')}</span></div></div>
      <div class="cd" data-cd><small>${esc(TEXT[comp()].kick)}</small><b data-cd-t>--:--</b><em>${matchLine()}</em></div>
    </div>`;
  const footer = () => `<img class="ft" src="${logo()}" alt="">`;
  const pageDots = (page, pages) => pages > 1 ? `<div class="pg">${page + 1} / ${pages}</div>` : '';

  // ---------- scenes ----------
  const scenes = {
    results(page) {
      const T = TEXT[comp()], list = S.results.filter(r => !(r.homeCode === S.match.homeCode && r.awayCode === S.match.awayCode));
      const PER = 8, pages = Math.max(1, Math.ceil(list.length / PER)), items = list.slice(page * PER, page * PER + PER);
      const md = S.matchday, sub = md ? `${md.round != null ? T.round + ' ' + md.round + '  ·  ' : ''}${span(md.from, md.to)}` : '';
      const cards = items.length ? items.map(r => {
        const hw = r.homeScore > r.awayScore, aw = r.awayScore > r.homeScore, draw = r.homeScore === r.awayScore;
        return `<div class="res">
          <div class="side">${crest(r.homeCode, 100)}<div class="nm">${esc(r.homeCode || r.home)}</div></div>
          <div class="sc"><span class="${!hw && !draw ? 'lo' : ''}">${r.homeScore}</span><i>–</i><span class="${!aw && !draw ? 'lo' : ''}">${r.awayScore}</span></div>
          <div class="side r">${crest(r.awayCode, 100)}<div class="nm">${esc(r.awayCode || r.away)}</div></div>
        </div>`;
      }).join('') : `<div class="res empty">${esc(T.wait)}</div>`;
      return { pages, html: `${header(T.results, sub)}<div class="res-grid">${cards}</div>${footer()}${pageDots(page, pages)}` };
    },
    round(page) {
      const T = TEXT[comp()], r = S.round || { matches: [] }, list = r.matches;
      const PER = 8, pages = Math.max(1, Math.ceil(list.length / PER)), items = list.slice(page * PER, page * PER + PER);
      const first = list[0], last = list[list.length - 1];
      const title = r.round != null ? `${T.roundWord} ${r.round}` : (comp() === 'women' ? 'Speelronde' : 'Matchday');
      const sub = first ? span({ day: first.day, month: first.month }, { day: last.day, month: last.month }) : '';
      const cards = items.length ? items.map(m => {
        const mid = m.played
          ? `<div class="sc"><span class="${m.homeScore < m.awayScore ? 'lo' : ''}">${m.homeScore}</span><i>–</i><span class="${m.awayScore < m.homeScore ? 'lo' : ''}">${m.awayScore}</span></div>`
          : `<div class="ko"><b>${esc(m.time || '–')}</b><small>${esc(span({ day: m.day, month: m.month }))}</small></div>`;
        return `<div class="res${m.me ? ' me' : ''}${m.played ? '' : ' todo'}">
          <div class="side">${crest(m.homeCode, 100)}<div class="nm">${esc(m.homeCode || m.home)}</div></div>${mid}
          <div class="side r">${crest(m.awayCode, 100)}<div class="nm">${esc(m.awayCode || m.away)}</div></div></div>`;
      }).join('') : `<div class="res empty">${esc(T.wait)}</div>`;
      return { pages, html: `${header(title, sub)}<div class="res-grid">${cards}</div>${footer()}${pageDots(page, pages)}` };
    },
    h2h() {
      const T = TEXT[comp()], m = S.match, c = COLORS[comp()], women = comp() === 'women';
      const st = (code) => S.standings.find(x => x.code === code);
      const ink = (hex) => { const n = parseInt((hex || '#ffffff').slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? '#1b2450' : '#ffffff'; };
      const col = (code, name) => {
        const row = st(code), color = c[code] || '#8a93c8', games = (S.form[code] || []).slice(-3).reverse();
        const rows = [0, 1, 2].map(i => {
          const g = games[i];
          return g ? `<div class="hh-row"><span>${crest(g.opp, 56)}</span><span class="opp">${esc(g.opp || '')}</span><span class="sc">${g.gf} – ${g.ga}</span><span class="chip ${g.res}">${g.res}</span></div>`
                   : `<div class="hh-row empty">${i === 0 ? esc(T.wait) : ''}</div>`;
        }).join('');
        return `<div class="hh-col"><div class="hh-top"><div class="tile">${crest(code, 190)}</div><div class="nm">${nameBr(name)}</div></div>
          <div class="hh-stand" style="background:${color};color:${ink(color)}"><b>${row ? '#' + row.pos : '–'}</b><span>${row ? esc(row.points) + ' ' + T.pts : ''}<small>${row ? esc(row.w) + 'W ' + esc(row.d) + 'D ' + esc(row.l) + 'L' : ''}</small></span></div>
          <div class="hh-lbl">${esc(T.last)}</div>${rows}</div>`;
      };
      const mt = S.meeting;
      const meet = mt
        ? `<div class="hh-meet"><span>${crest(mt.homeCode, 70)}</span><div><small>${esc(T.prev)} · ${esc(span({ day: mt.day, month: mt.month }))}</small><b>${mt.homeScore} – ${mt.awayScore}</b></div><span>${crest(mt.awayCode, 70)}</span></div>`
        : `<div class="hh-meet"><div><small>${esc(T.first)}</small></div></div>`;
      return { pages: 1, html: `${header(T.h2h, matchLine().replace(/<[^>]+>/g, ''))}
        <div class="hh">${col(m.homeCode, m.home)}<div class="hh-vs">${T.vs}</div>${col(m.awayCode, m.away)}</div>${meet}` };
    },
    standings() {
      const T = TEXT[comp()], m = S.match, rows = S.standings;
      const body = rows.map(r => {
        const me = r.code && (r.code === m.homeCode || r.code === m.awayCode);
        return `<div class="st-r${me ? ' me' : ''}"><span class="pos">${r.pos}</span><span>${crest(r.code, 40)}</span><span class="nm">${esc(r.name)}</span><span>${esc(r.played)}</span><span>${esc(r.w)}</span><span>${esc(r.d)}</span><span>${esc(r.l)}</span><span class="pts">${esc(r.points)}</span></div>`;
      }).join('');
      return { pages: 1, html: `${header(T.standings, '')}
        <div class="st"><div class="st-h"><span>${T.pos}</span><span></span><span>${T.club}</span><span>P</span><span>W</span><span>D</span><span>L</span><span>${T.pts}</span></div>${body}</div>
        <div class="next"><small>${esc(T.next)}</small><div class="pair">${crest(m.homeCode, 150)}<span class="vs">VS</span>${crest(m.awayCode, 150)}</div>
          <div class="names">${esc(m.home)}<br>${esc(m.away)}</div><div class="when">${esc(m.time || '')}</div><img src="${logo()}" alt="" style="height:70px;margin-top:10px"></div>` };
    },
    title() {
      const T = TEXT[comp()], m = S.match, c = COLORS[comp()], cl = (code) => c[code] || '#8a93c8';
      const id = [m.round != null ? `${T.round} ${m.round}` : null, `${m.homeCode || m.home} – ${m.awayCode || m.away}`].filter(Boolean).join('  ·  ');
      const glowA = comp() === 'women' ? 0.28 : 0.5;
      const glow = `radial-gradient(900px 700px at 0% 0%, ${cl(m.homeCode)}${Math.round(glowA * 255).toString(16).padStart(2, '0')}, transparent 70%), radial-gradient(900px 700px at 100% 0%, ${cl(m.awayCode)}${Math.round(glowA * 255).toString(16).padStart(2, '0')}, transparent 70%)`;
      return { pages: 1, html: `<div class="ti"><div class="ti-glow" style="background:${glow}"></div>
        <div class="ti-top">${esc(span({ day: m.day, month: m.month }))}${m.time ? '  ·  ' + esc(m.time) : ''}</div>
        <div class="ti-cd" data-cd><span data-cd-t></span></div>
        <div class="ti-main">
          <div class="ti-team"><div class="tile">${crest(m.homeCode, 300)}</div><div class="nm">${nameBr(m.home)}</div></div>
          <div class="ti-vs">VS</div>
          <div class="ti-team"><div class="tile">${crest(m.awayCode, 300)}</div><div class="nm">${nameBr(m.away)}</div></div>
        </div>
        <div class="ti-id"><small>${esc(T.id)}</small><span>${esc(id)}</span></div></div>` };
    },
    form() {
      const T = TEXT[comp()], m = S.match, st = (code) => S.standings.find(x => x.code === code);
      const col = (code, name) => {
        const row = st(code), games = (S.form[code] || []).slice().reverse();      // newest first
        return `<div class="fm-col"><div class="fm-head">${crest(code, 88)}<div class="nm">${esc(name)}</div>
          <div class="pp">${row ? `<b>#${row.pos}</b>${esc(row.points)} ${T.pts}` : ''}</div></div>
          ${games.length ? games.map(g => `<div class="fm-row"><span class="chip ${g.res}">${g.res}</span><span class="opp">${esc(g.opp || '')}</span><span class="sc">${g.gf} – ${g.ga}</span></div>`).join('') : `<div class="fm-row">${esc(T.wait)}</div>`}</div>`;
      };
      return { pages: 1, html: `${header(T.form, '')}<div class="fm">${col(m.homeCode, m.home)}${col(m.awayCode, m.away)}</div>${footer()}` };
    },
    schedule() {
      const T = TEXT[comp()], m = S.match;
      const rows = (S.schedule || []).slice(0, 6).map(x => {
        const me = x.homeCode === m.homeCode && x.awayCode === m.awayCode;
        return `<div class="sd-r${me ? ' me' : ''}"><span class="t">${esc(x.time || '')}</span><div class="side">${crest(x.homeCode, 80)}<span>${esc(x.home)}</span></div><span class="vs">VS</span><div class="side r">${crest(x.awayCode, 80)}<span>${esc(x.away)}</span></div></div>`;
      }).join('');
      return { pages: 1, html: `${header(T.schedule, span({ day: m.day, month: m.month }))}<div class="sd">${rows}</div>${footer()}` };
    },
    clean() { return { pages: 1, html: '' }; },
  };

  // ---------- rendering + transitions ----------
  let cur = null, curPage = 0, sceneSince = Date.now(), curPages = 1;
  function build(scene, page) {
    const out = scenes[scene](page);
    const solid = S.config.theme !== 'transparent';
    const root = document.createElement('div');
    root.className = 'layer';
    root.innerHTML = scene === 'clean' ? '' : `<div class="scene ${comp()}${solid ? ' solid' : ''}">${out.html}</div>`;
    return { root, pages: out.pages };
  }
  function show(scene, page, how) {
    const { root, pages } = build(scene, page);
    const old = [...layers.children];
    root.classList.add(how === 'flip' ? 'flip' : 'enter');
    layers.appendChild(root);
    old.forEach(o => { o.classList.add('leave'); setTimeout(() => o.remove(), 500); });
    if (how === 'wipe') { wipe.classList.remove('go'); void wipe.offsetWidth; wipe.style.setProperty('--acc', comp() === 'women' ? '#c93cf0' : '#caff1c'); wipe.classList.add('go'); }
    curPages = pages;
  }
  const dataSig = () => S ? JSON.stringify([S.match && [S.match.homeCode, S.match.awayCode, S.match.time], S.results, S.standings, S.schedule, S.config.theme]) : '';

  function tick() {
    if (!S) return;
    const T = minutesLeft(), scene = pickScene(T), rotate = (S.config.rotate || 12) * 1000;
    const page = curPages > 1 ? Math.floor((Date.now() - sceneSince) / rotate) % curPages : 0;
    const sig = dataSig();
    if (scene !== cur) {
      const first = cur === null;
      cur = scene; curPage = 0; sceneSince = Date.now(); lastSig = sig;
      show(scene, 0, first || scene === 'clean' ? 'enter' : 'wipe');
    } else if (page !== curPage) {
      curPage = page; show(scene, page, 'flip');
    } else if (sig !== lastSig) {
      lastSig = sig;
      const { root, pages } = build(scene, curPage); curPages = pages;      // new data: swap quietly, no animation
      [...layers.children].forEach(o => o.remove()); layers.appendChild(root);
    }
    // countdown
    document.querySelectorAll('[data-cd-t]').forEach(el => { el.textContent = T == null ? '' : T <= 0 ? '' : fmtClock(T); });
    document.querySelectorAll('.cd').forEach(el => el.classList.toggle('soon', T != null && T <= 5));
    if (DEBUG) dbg.textContent = `T-${T == null ? '?' : T.toFixed(2)} min · scene ${scene}${curPages > 1 ? ` (${curPage + 1}/${curPages})` : ''}${S.match ? ' · ' + S.match.home + ' – ' + S.match.away : ' · geen wedstrijd'}${SIM != null ? ' · sim x' + SPEED : ''}`;
  }

  load().then(() => { tick(); });
  setInterval(tick, 500);
  setInterval(load, 30000);
})();
