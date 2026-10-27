/* ByTomorrow narrowcasting screen: slides that take turns (agenda, featured, programme, SHL table and results, weather),
   with the chevron sweep of the platform in between. Plain ES5 on purpose: it has to run in the browser of an LG webOS TV. */
(function () {
  var stage = document.getElementById('stage'), slidesEl = document.getElementById('slides');
  var PILLARS = {
    productie: { label: 'Productie', c: '#FC06E5', bg: '#FC06E5', ink: '#060228' }, jump: { label: 'JUMP', c: '#49FF9F', bg: '#49FF9F', ink: '#060228' },
    marketing: { label: 'Marketing', c: '#FFCC00', bg: '#FFCC00', ink: '#060228' }, content: { label: 'Content', c: '#00FFE6', bg: '#00FFE6', ink: '#060228' },
    standaard: { label: 'Algemeen', c: '#748FFF', bg: '#3D5AFE', ink: '#ffffff' }, navy: { label: 'Navy', c: '#A5B4FF', bg: '#2D43A8', ink: '#ffffff' },
    lvl: { label: 'Lotto Volley League', c: '#EE3124', bg: '#EE3124', ink: '#ffffff', fill: true }, shl: { label: 'SHL', c: '#ccff33', bg: '#ccff33', ink: '#060228' },
    shlw: { label: 'SHLW', c: '#e353fc', bg: '#e353fc', ink: '#060228' }, hnl: { label: 'HandbalNL', c: '#ff8a4d', bg: '#ff7429', ink: '#060228' }
  };
  var SPORTS = { basketbal: 'sports_basketball', volleybal: 'sports_volleyball', handbal: 'sports_handball', voetbal: 'sports_soccer', tennis: 'sports_tennis', padel: 'sports_tennis',
    hockey: 'sports_hockey', zwemmen: 'pool', hardlopen: 'directions_run', wielrennen: 'directions_bike', turnen: 'sports_gymnastics', vechtsport: 'sports_martial_arts',
    honkbal: 'sports_baseball', rugby: 'sports_rugby', golf: 'sports_golf', schaatsen: 'ice_skating', skien: 'downhill_skiing', fitness: 'fitness_center', roeien: 'rowing',
    zeilen: 'sailing', esports: 'sports_esports', finish: 'sports_score' };
  var COMPS = { shl: { label: 'SHL', bg: '#ccff33', ink: '#14142b' }, shlw: { label: 'SHLW', bg: '#e353fc', ink: '#1a1b38' },
    lvlm: { label: 'LVL Heren', bg: '#EE3124', ink: '#ffffff' }, lvlw: { label: 'LVL Dames', bg: '#EE3124', ink: '#ffffff' } };
  var WD_LOW = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], WD_FULL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MON_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var SLIDE_MS = { agenda: 30000, featured: 30000, matches: 30000, streams: 30000, stand: 30000, quote: 30000, slogan: 70000, welcome: 70000, logo: 30000, weather: 30000 };      // every slide stays 30 seconds

  // ---- time: the Dutch wall clock, taken from the server (the TV's own clock or time zone may be off) ----
  var wallDelta = null;
  function wallNow() { return wallDelta === null ? Date.now() - new Date().getTimezoneOffset() * 60000 : Date.now() + wallDelta; }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()); }
  function parseYmd(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function get(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), true);
    x.timeout = 20000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var j = null; try { j = x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e) { j = null; }
      cb(j);
    };
    x.send();
  }
  function fit() { var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080), t = 'scale(' + k + ')'; stage.style.webkitTransform = t; stage.style.transform = t; }
  window.addEventListener('resize', fit); fit();

  // ---- clock ----
  var lastClock = '';
  function tick() {
    var d = new Date(wallNow()), c = two(d.getUTCHours()) + ':' + two(d.getUTCMinutes());
    if (c === lastClock) return; lastClock = c;
    document.getElementById('clock').innerHTML = c;
    document.getElementById('date').innerHTML = WD_FULL[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON_FULL[d.getUTCMonth()];
  }
  setInterval(tick, 1000); tick();

  // ---- data ----
  var items = [], meeting = { mode: 'off', client: '' }, show = { shl: true, shlw: true, lvlm: true, lvlw: true }, matches = [], weather = null, shl = { men: null, women: null };
  function loadAgenda() {
    get('/api/narrowcasting', function (j) {
      if (!j) return;
      if (j.wall) wallDelta = j.wall - Date.now();
      items = j.items || []; show = j.show || show; tick();
      applyMeeting(j.meeting);
    });
  }
  // meeting mode switched: go there at once, through the cross-fade (when a fade is still going on, right after it)
  var pendingMeeting = false;
  function applyMeeting(m) {
    m = m || { mode: 'off', client: '' };
    if (m.mode === meeting.mode && m.client === meeting.client) return;
    meeting = m;
    if (!started) return;
    if (busy) { pendingMeeting = true; return; }
    clearTimeout(timer); next();
  }
  function loadMeeting() { get('/api/narrowcasting-meeting', function (j) { if (j) applyMeeting(j.meeting); }); }
  function loadMatches() { get('/api/narrowcasting-matches', function (j) { if (j && j.matches) matches = j.matches; }); }
  function loadWeather() { get('/api/weather', function (w) { if (w && w.now) { weather = w; var el = document.getElementById('wmini'); if (el) el.innerHTML = miniWeather(); } }); }
  function loadShl() { ['men', 'women'].forEach(function (c) { get('/api/narrowcasting-shl?comp=' + c, function (j) { if (j && j.standings && j.standings.length) shl[c] = j; }); }); }
  loadAgenda(); loadMatches(); loadWeather(); loadShl();
  setInterval(loadAgenda, 15000); setInterval(loadMeeting, 2000); setInterval(loadMatches, 600000); setInterval(loadWeather, 600000); setInterval(loadShl, 600000);

  // ---- agenda helpers ----
  function startMs(it) { var b = parseYmd(it.date); if (it.time) b += (+it.time.slice(0, 2)) * 3600000 + (+it.time.slice(3, 5)) * 60000; return b; }
  function endMs(it) {
    if (it.auto) return startMs(it) + 6000000;                             // a match from the schedules lasts about 100 minutes
    if (it.endDate) return parseYmd(it.endDate) + 86400000;
    if (it.allDay || !it.time) return parseYmd(it.date) + 86400000;
    if (it.end) { var e = parseYmd(it.date) + (+it.end.slice(0, 2)) * 3600000 + (+it.end.slice(3, 5)) * 60000; if (e > startMs(it)) return e; }
    return startMs(it) + 3600000;                                          // without an end time an item counts for an hour
  }
  function upcoming(onlyFeatured) {                                        // the agenda is about JUMP: only what is on JUMP (the featured slide takes every starred item)
    var now = wallNow(), out = [], i, horizon = now + 21 * 86400000, m, key, seen = {}, auto = matchItems();
    for (i = 0; i < items.length; i++) {
      if (endMs(items[i]) > now && parseYmd(items[i].date) < horizon && (onlyFeatured ? items[i].featured : items[i].jump !== false)) {
        out.push(items[i]); seen[items[i].date + '|' + String(items[i].title).toLowerCase()] = 1;
      }
    }
    if (!onlyFeatured) for (i = 0; i < auto.length; i++) { m = auto[i]; key = m.date + '|' + m.title.toLowerCase(); if (!seen[key] && endMs(m) > now) out.push(m); }
    out.sort(function (a, b) { return startMs(a) - startMs(b); });
    return out;
  }
  // every match of SHL, SHLW and the LVL in the next 7 days, as agenda items
  function matchItems() {
    var out = [], i, m, C, last = ymd(wallNow() + 7 * 86400000);
    for (i = 0; i < matches.length; i++) {
      m = matches[i]; C = COMPS[m.comp];
      if (!C || show[m.comp] === false || m.date > last) continue;
      out.push({ id: 'm' + i, auto: true, comp: m.comp, date: m.date, endDate: '', time: m.time || '', end: '', title: m.home + ' - ' + m.away, place: '', pillars: [],
        sport: m.comp.indexOf('lvl') === 0 ? 'volleybal' : 'handbal', jump: true, allDay: false });
    }
    return out;
  }
  function isLive(it) { var n = wallNow(); return !!it.time && !it.allDay && startMs(it) <= n && endMs(it) > n; }
  function inTxt(it) {                                                      // "over 45 min" for a broadcast that starts soon today
    var m = Math.round((startMs(it) - wallNow()) / 60000);
    if (!it.time || m <= 0 || m >= 360) return '';
    return 'over ' + (m < 60 ? m + ' min' : Math.floor(m / 60) + ' u' + (m % 60 ? ' ' + m % 60 + ' min' : ''));
  }
  function dayHead(date, today) {
    var diff = Math.round((parseYmd(date) - parseYmd(today)) / 86400000), d = new Date(parseYmd(date)), full = WD_FULL[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON_FULL[d.getUTCMonth()];
    return diff <= 0 ? 'Vandaag, ' + full : diff === 1 ? 'Morgen, ' + full : cap(full);
  }
  function rangeTxt(it) {
    var a = new Date(parseYmd(it.date)), b = new Date(parseYmd(it.endDate));
    return WD_LOW[a.getUTCDay()] + ' ' + a.getUTCDate() + ' ' + MON[a.getUTCMonth()] + ' – ' + WD_LOW[b.getUTCDay()] + ' ' + b.getUTCDate() + ' ' + MON[b.getUTCMonth()];
  }
  function tagsHtml(it, all) {
    var cp = it.comp && COMPS[it.comp] ? '<span class="tg" style="color:' + (it.comp === 'shl' ? '#ccff33' : it.comp === 'shlw' ? '#e353fc' : '#fff;background:#EE3124') + ';border-color:' + (it.comp === 'shl' ? '#ccff33' : it.comp === 'shlw' ? '#e353fc' : '#EE3124') + '">' + COMPS[it.comp].label + '</span>' : '';                                             // on the JUMP agenda the JUMP tag would be on every row, so it is left out there
    var h = '', i, P;
    for (i = 0; i < it.pillars.length; i++) { if (it.pillars[i] === 'jump' && !all) continue; P = PILLARS[it.pillars[i]] || PILLARS.standaard; h += '<span class="tg" style="' + (P.fill ? 'background:' + P.c + ';color:#fff;' : 'color:' + P.c + ';') + 'border-color:' + P.c + '">' + P.label + '</span>'; }
    return cp + h;
  }
  function iconHtml(it) { return SPORTS[it.sport] ? '<span class="mi">' + SPORTS[it.sport] + '</span>' : '<span class="dn">' + new Date(parseYmd(it.date)).getUTCDate() + '</span>'; }
  function dly(i) { return ' style="animation-delay:' + (i * 70 + 150) + 'ms"'; }

  // ---- slide: agenda (two columns per page, grouped by day) ----
  function agendaPages() {
    var list = upcoming(false), today = ymd(wallNow()), week = [], days = {}, order = [], live = [], i, it, key, entries = [];
    var wEnd = parseYmd(today) + 7 * 86400000;
    for (i = 0; i < list.length; i++) {
      it = list[i];
      if (it.endDate && parseYmd(it.date) < wEnd) { week.push(it); continue; }
      key = it.date < today ? today : it.date;
      if (!days[key]) { days[key] = []; order.push(key); }
      days[key].push(it);
    }
    order.sort();
    if (week.length) { entries.push({ h: 'Deze week' }); for (i = 0; i < week.length; i++) entries.push({ it: week[i], range: true }); }
    for (i = 0; i < order.length; i++) { entries.push({ h: dayHead(order[i], today) }); for (key = 0; key < days[order[i]].length; key++) entries.push({ it: days[order[i]][key] }); }
    var HEAD = 66, ITEM = 104, COLH = 740, pages = [], cols = [], col = { h: 0, rows: [] }, lastHead = '';
    function nextCol() { if (col.rows.length) cols.push(col); col = { h: 0, rows: [] }; if (cols.length === 2) { pages.push(cols); cols = []; } }
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.h !== undefined) {
        if (col.h + HEAD + ITEM > COLH) nextCol();
        col.rows.push(e); col.h += HEAD; lastHead = e.h;
      } else {
        if (col.h + ITEM > COLH) { nextCol(); if (lastHead) { col.rows.push({ h: lastHead }); col.h += HEAD; } }
        col.rows.push(e); col.h += ITEM;
      }
    }
    if (col.rows.length) cols.push(col);
    if (cols.length) pages.push(cols);
    return pages;
  }
  function agendaHtml(cols) {
    var html = '<div class="ttl rz">Stream<b>agenda</b></div>', c, r, k = 0, row, it, live, tm, sub;
    if (!cols) return html + '<div class="empty rz"><b>Geen streams</b><span>Er staat op dit moment geen stream gepland.</span></div>';
    for (c = 0; c < cols.length; c++) {
      html += '<div class="col" style="left:' + (80 + c * 920) + 'px">';
      for (r = 0; r < cols[c].rows.length; r++) {
        row = cols[c].rows[r];
        if (row.h !== undefined) { html += '<div class="gh rz' + (r === 0 ? ' first' : '') + (row.live ? ' lv' : '') + '"' + dly(k++) + '>' + esc(row.h) + '</div>'; continue; }
        it = row.it; live = isLive(it); sub = live ? '' : inTxt(it);
        tm = live ? '<span class="tm now"><i></i>LIVE</span>' : (it.time ? '<span class="tm">' + esc(it.time) + (sub ? '<small>' + sub + '</small>' : '') + '</span>' : (it.allDay ? '<span class="tm">hele dag</span>' : ''));
        html += '<div class="it rz' + (live ? ' live' : '') + '"' + dly(k++) + '><div class="ic">' + iconHtml(it) + '</div><div class="tt">' + esc(it.title || 'Zonder titel') + '</div>' + tm +
          '<div class="tgs">' + tagsHtml(it) + (row.range ? '<span class="pl">' + rangeTxt(it) + '</span>' : (it.place ? '<span class="pl">' + esc(it.place) + '</span>' : '')) + '</div></div>';
      }
      html += '</div>';
    }
    return html;
  }

  // ---- slide: featured (the starred agenda items as big cards, four to a page) ----
  function featuredPages() {
    var list = upcoming(true), pages = [], i;
    for (i = 0; i < list.length; i += 4) pages.push(list.slice(i, i + 4));
    return pages;
  }
  function featuredHtml(list) {
    var html = '<div class="ttl rz">ByTomorrow <b>Uitgelicht</b></div>', i, it, P, today = ymd(wallNow()), pos = [[80, 190], [980, 190], [80, 556], [980, 556]], lab, diff;
    for (i = 0; i < list.length; i++) {
      it = list[i]; P = PILLARS[it.pillars[0]] || PILLARS.standaard;
      diff = Math.round((parseYmd(it.date) - parseYmd(today)) / 86400000); var d = new Date(parseYmd(it.date));
      lab = diff <= 0 ? 'Vandaag' : diff === 1 ? 'Morgen' : WD_LOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
      html += '<div class="card rz" style="left:' + pos[i][0] + 'px;top:' + pos[i][1] + 'px;background:' + P.bg + ';color:' + P.ink + ';animation-delay:' + (i * 90 + 160) + 'ms">' +
        '<div class="ic2" style="color:' + (P.ink === '#ffffff' ? P.bg : '#060228') + '">' + (SPORTS[it.sport] ? '<span class="mi">' + SPORTS[it.sport] + '</span>' : '<span class="dn">' + d.getUTCDate() + '</span>') + '</div>' +
        '<div class="dl" style="background:' + P.ink + ';color:' + (P.ink === '#ffffff' ? P.bg : '#ffffff') + '">' + esc(lab) + '</div>' +
        '<div class="ct">' + esc(it.title || '') + '</div><div class="cm">' + (it.allDay || !it.time ? '<span class="t">Hele dag</span>' : '<span class="t">' + esc(it.time) + '</span>') +
        (it.place ? '<span class="p">' + esc(it.place) + '</span>' : '') + '</div></div>';
    }
    return html;
  }

  // ---- slide: programme (the next matches of the competitions in the schedules of the platform) ----
  function matchesHtml() {
    var keys = ['lvlm', 'lvlw'], cols = [], i, j, k, list, today = ymd(wallNow()), html = '<div class="ttl rz">Lotto Volley League <b>wedstrijden</b></div>';
    for (i = 0; i < keys.length; i++) {
      if (show[keys[i]] === false) continue;
      list = []; for (j = 0; j < matches.length; j++) { if (matches[j].comp === keys[i] && matches[j].date >= today) list.push(matches[j]); }
      if (list.length) cols.push({ key: keys[i], list: list.slice(0, 4) });
    }
    if (!cols.length) return null;
    var gap = 28, w = Math.floor((1760 - gap * (cols.length - 1)) / cols.length);
    for (i = 0; i < cols.length; i++) {
      var C = COMPS[cols[i].key];
      html += '<div class="mcol" style="left:' + (80 + i * (w + gap)) + 'px;width:' + w + 'px"><div class="mh rz" style="background:' + C.bg + ';color:' + C.ink + ';animation-delay:' + (i * 90 + 120) + 'ms">' + C.label + '</div>';
      for (k = 0; k < cols[i].list.length; k++) {
        var m = cols[i].list[k], d = new Date(parseYmd(m.date)), diff = Math.round((parseYmd(m.date) - parseYmd(today)) / 86400000);
        var when = (diff <= 0 ? 'Vandaag' : diff === 1 ? 'Morgen' : WD_LOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]) + (m.time ? ' · ' + m.time : '');
        html += '<div class="mc rz" style="animation-delay:' + (i * 90 + k * 60 + 200) + 'ms"><span class="md" style="background:' + C.bg + ';color:' + C.ink + '">' + esc(when) + '</span>' +
          '<div class="mt">' + esc(m.home) + '</div><div class="mt2">' + esc(m.away) + '</div></div>';
      }
      html += '</div>';
    }
    return html;
  }

  // ---- slide: SHL table and results, in the look of the SHL stream graphics ----
  function crest(code, size, women) {
    var s = size / 158, img = code ? 'background-image:url(/assets/' + (women ? 'women/' : '') + 'teams/' + encodeURIComponent(code) + '.png);background-size:' + (1200 * s) + 'px ' + (200 * s) + 'px;background-position:0 ' + (-19 * s) + 'px;' : '';
    return '<span class="crest" style="width:' + size + 'px;height:' + Math.round(159 * s) + 'px;' + img + '"></span>';
  }
  function shlLogo(women) { return '<img class="shl-logo rz" src="' + (women ? '/assets/women/footer-logo-women.png' : '/assets/footer-logo.png') + '" alt="">'; }
  // the next 7 matches (the streams) of SHL or SHLW
  function streamsHtml(comp) {
    var D = shl[comp], women = comp === 'women', i, n, d, diff, lab, today = ymd(wallNow());
    if (!D || !D.next || !D.next.length || show[women ? 'shlw' : 'shl'] === false) return null;
    var h = shlLogo(women) + '<div class="pn" style="left:80px;width:1760px"><div class="tab rz">Komende streams<small>' + (women ? 'SHLW' : 'SHL') + '</small></div>';
    for (i = 0; i < D.next.length; i++) {
      n = D.next[i]; d = new Date(parseYmd(n.date)); diff = Math.round((parseYmd(n.date) - parseYmd(today)) / 86400000);
      lab = diff <= 0 ? 'Vandaag' : diff === 1 ? 'Morgen' : WD_LOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
      h += '<div class="sr rz"' + dly(i) + '><span class="sd">' + esc(lab) + '</span><span class="cr1">' + crest(n.homeCode, 62, women) + '</span><span class="n1">' + esc(n.home) + '</span>' +
        '<span class="sc">' + esc(n.time || '\u2013') + '</span><span class="n2">' + esc(n.away) + '</span><span class="cr2">' + crest(n.awayCode, 62, women) + '</span></div>';
    }
    return h + '</div>';
  }
  // the table and the latest results, in the look of the SHL stream graphics
  function shlHtml(comp) {
    var D = shl[comp], women = comp === 'women';
    if (!D || show[women ? 'shlw' : 'shl'] === false) return null;
    var st = D.standings, rs = D.results || [], i, h = shlLogo(women);
    h += '<div class="pn" style="left:80px;width:880px"><div class="tab rz">Stand<small>' + (women ? 'SHLW' : 'SHL') + '</small></div>' +
      '<div class="st-h rz"' + dly(0) + '><span class="pos">#</span><span class="nm">Club</span><span class="c1">G</span><span class="c2">W</span><span class="c3">GL</span><span class="c4">V</span><span class="pts">PT</span></div>';
    for (i = 0; i < Math.min(14, st.length); i++) {
      h += '<div class="st-r rz"' + dly(i + 1) + '><span class="pos">' + (st[i].pos || i + 1) + '</span><span class="cr">' + crest(st[i].code, 36, women) + '</span><span class="nm">' + esc(st[i].name || st[i].club) + '</span>' +
        '<span class="c1">' + esc(st[i].played) + '</span><span class="c2">' + esc(st[i].w) + '</span><span class="c3">' + esc(st[i].d) + '</span><span class="c4">' + esc(st[i].l) + '</span><span class="pts">' + esc(st[i].points) + '</span></div>';
    }
    h += '</div><div class="pn" style="left:1000px;width:840px"><div class="tab rz">Uitslagen<small>' + (D.round ? 'Speelronde ' + D.round : '') + '</small></div>';
    for (i = 0; i < Math.min(8, rs.length); i++) {
      var r = rs[i];
      h += '<div class="rs rz"' + dly(i + 2) + '><span class="cr1">' + crest(r.homeCode, 62, women) + '</span><span class="n1">' + esc(r.home) + '</span>' +
        '<span class="sc">' + r.homeScore + ' \u2013 ' + r.awayScore + '</span><span class="n2">' + esc(r.away) + '</span><span class="cr2">' + crest(r.awayCode, 62, women) + '</span></div>';
    }
    return h + '</div>';
  }

  // ---- slide: only the logo ----
  function logoHtml() { return '<div class="lg1">' + document.getElementById('logoTpl').innerHTML + '</div>'; }

  // the current weather, small, top left: on the slides of the meeting mode
  function miniWeather() {
    if (!weather) return '';
    var n = weather.now;
    return '<span class="wm-i">' + icon(n.code, n.day, 88) + '</span><span class="wm-t">' + n.temp + '&deg;</span><span class="wm-d">' + esc(DESC[n.code] || '') + '<br>' + esc(weather.place) + '</span>';
  }
  function meetingWeather() { return meeting.mode === 'off' ? '' : '<div class="wmini rz" id="wmini" style="animation-delay:400ms">' + miniWeather() + '</div>'; }

  // the four pillars as colour blocks along the bottom (like the example), the words in the alternative colour of the pillar. Very
  // subtle: now and then one pillar slowly fills the whole bar in its colour and the bar goes back to the four blocks again
  // (only on the slogan and the meeting mode)
  var PB = [['Marketing', '#FFCC00', '#C25100'], ['Content', '#00FFE6', '#008B8B'], ['Productie', '#FC06E5', '#7B1FA2'], ['JUMP', '#49FF9F', '#2F7E4D']], pbTimers = [];
  function pillarBar() {
    var h = '<div class="pb rz" id="pb" style="animation-delay:600ms">', i;
    for (i = 0; i < PB.length; i++) h += '<div class="pbs" style="background:' + PB[i][1] + '"><span style="color:' + PB[i][2] + '">' + PB[i][0] + '</span></div>';
    return h + '</div>';
  }
  function stopPillars() { while (pbTimers.length) clearTimeout(pbTimers.pop()); }
  function startPillars() {
    stopPillars();
    var el = document.getElementById('pb'); if (!el) return;
    var segs = el.children;
    function at(ms, fn) { pbTimers.push(setTimeout(fn, ms)); }
    function widths(only) { var k; for (k = 0; k < segs.length; k++) segs[k].style.width = only < 0 ? '25%' : (k === only ? '100%' : '0'); }
    function cycle() {
      var t = 4000, k;
      for (k = 0; k < segs.length; k++) (function (n) {
        at(t, function () { widths(n); }); t += 2800 + 2500;                      // slowly fills the whole bar, stays a moment
        at(t, function () { widths(-1); }); t += 2800 + 4500;                     // and slowly goes back to the four blocks
      })(k);
      at(t, cycle);
    }
    cycle();
  }

  // ---- slide: welcome (meeting mode), with the name of the client ----
  function welcomeHtml() {
    var name = meeting.client || 'bij ByTomorrow', n = name.length, size = n <= 10 ? 206 : n <= 16 ? 160 : n <= 24 ? 120 : 90;
    return '<div class="sg rz" style="animation-delay:150ms"><span style="font-weight:500">Welkom</span><br><b style="font-size:' + size + 'px;line-height:' + Math.round(size * 1.03) + 'px">' + esc(name) + '</b></div><div class="sgl rz" style="animation-delay:700ms">' + document.getElementById('logoTpl').innerHTML + '</div>' + meetingWeather() + pillarBar();
  }

  // ---- slide: a statement in between ----
  function sloganHtml() {
    return '<div class="sg rz" style="animation-delay:150ms">Alle sporters<br>zijn <b>helden.</b></div><div class="sgl rz" style="animation-delay:700ms">' + document.getElementById('logoTpl').innerHTML + '</div>' + meetingWeather() + pillarBar();
  }

  // ---- slide: a random sport quote ----
  var QUOTES = [
    ['Voetballen is simpel, maar het moeilijkste wat er is, is simpel voetballen.', 'Johan Cruijff', 'Voetbal'],
    ['Quality without results is pointless. Results without quality is boring.', 'Johan Cruyff', 'Voetbal'],
    ['Je gaat het pas zien als je het door hebt.', 'Johan Cruijff', 'Voetbal'],
    ['Elk nadeel heb z\u2019n voordeel.', 'Johan Cruijff', 'Voetbal'],
    ['I like criticism. It makes you strong.', 'LeBron James', 'Basketbal'],
    ['You have to be able to accept failure to get better.', 'LeBron James', 'Basketbal'],
    ['I\u2019ve failed over and over and over again in my life. And that is why I succeed.', 'Michael Jordan', 'Basketbal'],
    ['Talent wins games, but teamwork and intelligence win championships.', 'Michael Jordan', 'Basketbal'],
    ['Everything negative \u2013 pressure, challenges \u2013 is all an opportunity for me to rise.', 'Kobe Bryant', 'Basketbal'],
    ['Don\u2019t quit. Suffer now and live the rest of your life as a champion.', 'Muhammad Ali', 'Boksen'],
    ['I really think a champion is defined not by their wins but by how they can recover when they fall.', 'Serena Williams', 'Tennis'],
    ['You miss 100% of the shots you don\u2019t take.', 'Wayne Gretzky', 'IJshockey'],
    ['Pressure is a privilege.', 'Billie Jean King', 'Tennis'],
    ['Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing.', 'Pel\u00e9', 'Voetbal'],
    ['Winning isn\u2019t everything, but wanting to win is.', 'Vince Lombardi', 'American football'],
    ['I don\u2019t think limits.', 'Usain Bolt', 'Atletiek']
  ];
  function quoteHtml() {
    var n, q, size;
    n = (Math.floor(wallNow() / 86400000) * 7 + 3) % QUOTES.length;           // one quote per day: the same all day, another one tomorrow
    q = QUOTES[n];
    size = q[0].length <= 50 ? 120 : q[0].length <= 90 ? 96 : q[0].length <= 130 ? 80 : 68;
    return '<div class="ttl rz">ByTomorrow <b>Quote</b></div><div class="qm rz" style="animation-delay:120ms">\u201c</div>' +
      '<div class="qt rz" style="font-size:' + size + 'px;line-height:' + Math.round(size * 1.1) + 'px;animation-delay:240ms">' + esc(q[0]) + '</div>' +
      '<div class="qa rz" style="animation-delay:420ms"><span class="pill-b">' + esc(q[1]) + '</span><span class="pill-o">' + esc(q[2]) + '</span></div>';
  }

  // ---- slide: weather ----
  var KIND = function (c) {
    if (c === 0) return 'clear'; if (c === 1) return 'mostly'; if (c === 2) return 'partly'; if (c === 3) return 'cloud';
    if (c === 45 || c === 48) return 'fog'; if (c >= 51 && c <= 57) return 'drizzle'; if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow'; if (c >= 95) return 'thunder'; return 'cloud';
  };
  var DESC = { 0: 'Onbewolkt', 1: 'Overwegend zonnig', 2: 'Half bewolkt', 3: 'Bewolkt', 45: 'Mist', 48: 'Rijpmist', 51: 'Lichte motregen', 53: 'Motregen', 55: 'Zware motregen',
    56: 'IJzel', 57: 'IJzel', 61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen', 66: 'IJzel', 67: 'IJzel', 71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 77: 'Sneeuwkorrels',
    80: 'Lichte buien', 81: 'Buien', 82: 'Zware buien', 85: 'Sneeuwbuien', 86: 'Zware sneeuwbuien', 95: 'Onweer', 96: 'Onweer met hagel', 99: 'Onweer met hagel' };
  var CLOUD = 'M30 74a18 18 0 0 1-2-35.9A24 24 0 0 1 74 36a19 19 0 0 1 0 38z';
  function icon(code, day, size) {
    var k = KIND(code), sun = '<circle cx="42" cy="40" r="17" fill="#FFCC00"/>', rays = '', i, a, g = '';
    if (k === 'clear' || k === 'mostly' || k === 'partly') for (i = 0; i < 8; i++) { a = i * Math.PI / 4; rays += '<line x1="' + (42 + Math.cos(a) * 24).toFixed(1) + '" y1="' + (40 + Math.sin(a) * 24).toFixed(1) + '" x2="' + (42 + Math.cos(a) * 31).toFixed(1) + '" y2="' + (40 + Math.sin(a) * 31).toFixed(1) + '" stroke="#FFCC00" stroke-width="5" stroke-linecap="round"/>'; }
    var moon = '<path d="M52 16A32 32 0 1 0 84 62A26 26 0 0 1 52 16z" fill="#A5B4FF"/>';
    var cloud = function (dx, dy, fill) { return '<g transform="translate(' + dx + ',' + dy + ')"><path d="' + CLOUD + '" fill="' + fill + '"/></g>'; };
    if (k === 'clear') g = day ? '<g transform="translate(8,10)">' + sun + rays + '</g>' : moon;
    else if (k === 'mostly' || k === 'partly') g = (day ? '<g transform="translate(-4,-4) scale(.9)">' + sun + rays + '</g>' : '<g transform="translate(-6,-8) scale(.7)">' + moon + '</g>') + cloud(4, 4, k === 'mostly' ? '#dfe4ff' : '#ffffff');
    else if (k === 'cloud') g = cloud(-2, 0, '#c9d0f5') + cloud(6, 8, '#ffffff');
    else if (k === 'fog') g = cloud(0, -8, '#c9d0f5') + '<line x1="22" y1="72" x2="80" y2="72" stroke="#A5B4FF" stroke-width="6" stroke-linecap="round"/><line x1="30" y1="86" x2="88" y2="86" stroke="#A5B4FF" stroke-width="6" stroke-linecap="round"/>';
    else if (k === 'drizzle' || k === 'rain') {
      g = cloud(0, -10, '#c9d0f5'); var xs = k === 'rain' ? [34, 52, 70] : [40, 62];
      for (i = 0; i < xs.length; i++) g += '<line x1="' + xs[i] + '" y1="74" x2="' + (xs[i] - 7) + '" y2="92" stroke="#748FFF" stroke-width="6" stroke-linecap="round"/>';
    } else if (k === 'snow') { g = cloud(0, -10, '#c9d0f5'); for (i = 0; i < 3; i++) g += '<circle cx="' + (34 + i * 18) + '" cy="' + (82 + (i % 2) * 6) + '" r="5" fill="#ffffff"/>'; }
    else if (k === 'thunder') g = cloud(0, -12, '#9aa3d6') + '<path d="M56 62L40 86H54L48 102L72 74H58z" fill="#FFCC00"/>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' + g + '</svg>';
  }
  function weatherHtml() {
    if (!weather) return null;
    var n = weather.now, h = '<div class="ttl rz">Weer in <b>' + esc(weather.place) + '</b></div>', i, d, x;
    h += '<div class="wbig rz" style="animation-delay:120ms"><div class="wi">' + icon(n.code, n.day, 330) + '</div><div class="wt">' + n.temp + '&deg;</div>' +
      '<div class="wd">' + esc(DESC[n.code] || '') + '</div><div class="ws"><span class="wp">voelt als ' + n.feels + '&deg;</span><span class="wp">wind ' + n.wind + ' km/u</span>' +
      (weather.rain !== undefined ? '<span class="wp">regen ' + weather.rain + '%</span>' : '') + '</div></div>';
    h += '<div class="wh rz" style="left:80px;animation-delay:260ms"><div class="wlbl">Komende uren</div>';
    for (i = 0; i < Math.min(6, (weather.hours || []).length); i++) {
      x = weather.hours[i];
      h += '<div class="hc"><span class="h1">' + esc(x.time) + '</span><span class="h2">' + icon(x.code, +x.time.slice(0, 2) > 7 && +x.time.slice(0, 2) < 19, 72) + '</span><span class="h3">' + x.temp + '&deg;</span><span class="h4">' + x.rain + '%</span></div>';
    }
    h += '</div><div class="wdy rz" style="left:960px;animation-delay:340ms"><div class="wlbl">Komende dagen</div>';
    for (i = 1; i < Math.min(4, weather.days.length); i++) {
      d = weather.days[i];
      h += '<div class="dc"><span class="h1">' + WD_LOW[new Date(parseYmd(d.date)).getUTCDay()] + '</span><span class="h2">' + icon(d.code, true, 88) + '</span><span class="h3">' + d.max + '&deg; <s>' + d.min + '&deg;</s></span><span class="h4">regen ' + d.rain + '%</span></div>';
    }
    return h + '</div>';
  }

  // ---- the order of the slides, built fresh every turn ----
  function buildSlides() {
    var out = [], p, i;
    if (meeting.mode === 'slogan') return [{ type: 'slogan' }];
    if (meeting.mode === 'welcome') return [{ type: 'welcome' }];
    p = agendaPages(); if (!p.length) out.push({ type: 'agenda', html: agendaHtml(null) }); else for (i = 0; i < p.length; i++) out.push({ type: 'agenda', cols: p[i] });
    p = featuredPages(); for (i = 0; i < p.length; i++) out.push({ type: 'featured', list: p[i] });
    if (streamsHtml('men')) { out.push({ type: 'streams', comp: 'men' }); out.push({ type: 'stand', comp: 'men' }); }
    out.push({ type: 'slogan' });
    if (streamsHtml('women')) { out.push({ type: 'streams', comp: 'women' }); out.push({ type: 'stand', comp: 'women' }); }
    if (matchesHtml()) out.push({ type: 'matches' });
    out.push({ type: 'quote' });
    if (weather) out.push({ type: 'weather' });
    out.push({ type: 'logo' });
    return out;
  }
  function renderSlide(s) {
    if (s.type === 'agenda') return s.html || agendaHtml(s.cols);
    if (s.type === 'featured') return featuredHtml(s.list);
    if (s.type === 'matches') return matchesHtml();
    if (s.type === 'streams') return streamsHtml(s.comp);
    if (s.type === 'stand') return shlHtml(s.comp);
    if (s.type === 'quote') return quoteHtml();
    if (s.type === 'slogan') return sloganHtml();
    if (s.type === 'welcome') return welcomeHtml();
    if (s.type === 'logo') return logoHtml();
    return weatherHtml();
  }

  // ---- between slides: a calm cross-fade (the old slide fades away, the new one fades in while its blocks settle) ----
  function crossfade(swap, done, first) {
    function show() {
      swap();
      var el = slidesEl.firstChild;
      slidesEl.style.webkitTransition = 'opacity 1100ms ease'; slidesEl.style.transition = 'opacity 1100ms ease'; slidesEl.style.opacity = 1;
      if (el) el.className = el.className.replace(' pre', '');
      setTimeout(done, 1150);
    }
    if (first) { slidesEl.style.opacity = 0; slidesEl.offsetWidth; show(); return; }
    slidesEl.style.webkitTransition = 'opacity 900ms ease'; slidesEl.style.transition = 'opacity 900ms ease'; slidesEl.style.opacity = 0;
    setTimeout(show, 950);
  }

  var only = (/[?&]slide=([a-z,]+)/.exec(location.search) || [])[1]; only = only ? only.split(',') : null;   // ?slide=shl,weather shows only those slides (to look at them)
  var onlyComp = (/[?&]comp=(men|women)/.exec(location.search) || [])[1];
  var busy = false, shownKey = '', timer = 0;
  var slides = [], idx = -1, current = null, dotsEl = document.getElementById('dots');
    function dots(n, at) { var h = '', i; if (n > 1) for (i = 0; i < n; i++) h += '<i' + (i === at ? ' class="on"' : '') + '></i>'; dotsEl.innerHTML = h; }
  function next(first) {
    if (busy) return;
    slides = buildSlides();
    if (only) { var f = [], q; for (q = 0; q < slides.length; q++) { if (only.indexOf(slides[q].type) >= 0 && (!onlyComp || slides[q].comp === onlyComp)) f.push(slides[q]); } if (f.length) slides = f; }
    if (!slides.length) { timer = setTimeout(next, 3000); return; }
    idx = (idx + 1) % slides.length;
    var s = slides[idx], html = renderSlide(s);
    if (!html) { timer = setTimeout(next, 200); return; }
    var key = s.type + '|' + (s.comp || '') + '|' + (s.type === 'welcome' ? meeting.client : '');
    if (slides.length === 1 && key === shownKey) { timer = setTimeout(next, 5000); return; }          // meeting mode: the one slide just stays
    shownKey = key; busy = true; stopPillars();
    crossfade(function () {
      var shlSlide = s.type === 'streams' || s.type === 'stand';
      var mm = meeting.mode !== 'off' && (s.type === 'slogan' || s.type === 'welcome');
      slidesEl.innerHTML = '<div class="slide pre' + (shlSlide ? ' shl' + (s.comp === 'women' ? ' women' : '') : '') + (mm ? ' mm' : '') + '">' + html + '</div>';
      stage.className = 'stage' + (shlSlide || s.type === 'logo' ? ' noclock' : '') + (mm ? ' mm' : '') + (stage.className.indexOf(' inv') >= 0 ? ' inv' : '');
      dots(slides.length, idx);
      startPillars();
    }, function () { busy = false; if (pendingMeeting) { pendingMeeting = false; next(); } else timer = setTimeout(next, SLIDE_MS[s.type] || 15000); }, first === true);
  }
  // first start: under the cover, once the first data is there (or after a few seconds)
  var started = false;
  function boot() { if (started) return; started = true; next(true); }
  setTimeout(boot, 2500);
  (function waitData() { if (weather && shl.men && items) { setTimeout(boot, 400); } else { setTimeout(waitData, 200); } })();

  // OLED burn-in prevention: every 45 minutes the screen runs inverted for 10 seconds (blue becomes white and the other way round)
  var burnWait = (/[?&]burn=(\d+)/.exec(location.search) || [])[1];                // ?burn=8 tries it after 8 seconds
  function burn() {
    stage.className += ' inv';
    setTimeout(function () { stage.className = stage.className.replace(' inv', ''); }, 10000);
  }
  if (burnWait) setTimeout(burn, +burnWait * 1000); else setInterval(burn, 45 * 60000);

  // a fresh start now and then keeps a screen that runs for weeks tidy
  setTimeout(function () { location.reload(); }, 12 * 3600000);
})();
