/* ByTomorrow narrowcasting screen: slides that take turns (agenda, featured, programme, SHL table and results, weather),
   with the chevron sweep of the platform in between. Plain ES5 on purpose: it has to run in the browser of an LG webOS TV. */
(function () {
  var PREVIEW = /[?&]slide=/.test(location.search);                          // a preview (in an iframe on the beheer page) loads its data once and does not poll
  var stage = document.getElementById('stage'), slidesEl = document.getElementById('slides');
  var PILLARS = {
    productie: { label: 'Productie', c: '#FC06E5', bg: '#FC06E5', ink: '#060228' }, jump: { label: 'JUMP', c: '#49FF9F', bg: '#49FF9F', ink: '#060228' },
    marketing: { label: 'Marketing', c: '#FFCC00', bg: '#FFCC00', ink: '#060228' }, content: { label: 'Content', c: '#00FFE6', bg: '#00FFE6', ink: '#060228' },
    standaard: { label: 'Algemeen', c: '#748FFF', bg: '#3D5AFE', ink: '#ffffff' }, navy: { label: 'Navy', c: '#A5B4FF', bg: '#2D43A8', ink: '#ffffff' },
    lvl: { label: 'Lotto Volley League', c: '#FF4B3E', bg: '#EE3124', ink: '#ffffff' }, shl: { label: 'SHL', c: '#ccff33', bg: '#ccff33', ink: '#060228' },
    shlw: { label: 'SHLW', c: '#e353fc', bg: '#e353fc', ink: '#060228' }, hnl: { label: 'HandbalNL', c: '#ff8a4d', bg: '#ff7429', ink: '#060228' },
    hnltv: { label: 'HandbalNL TV', c: '#B58CFF', bg: '#A66BFF', ink: '#060228' }, zwem: { label: 'Zwemsport TV', c: '#38BDF8', bg: '#38BDF8', ink: '#060228' }, kwpn: { label: 'KWPN TV', c: '#FF8A1F', bg: '#FF8A1F', ink: '#060228' },
    tvv: { label: 'Tijd voor Volleyball', c: '#D08A4E', bg: '#D08A4E', ink: '#060228' }, futsal: { label: 'Eredivisie Futsal', c: '#D4E04A', bg: '#D4E04A', ink: '#060228' }, sibv: { label: 'Sport in Beeld Veenendaal', c: '#20B2A0', bg: '#20B2A0', ink: '#060228' }, hhd: { label: 'Hoofdklasse Dames', c: '#2FD6C0', bg: '#2FD6C0', ink: '#060228' }, hhh: { label: 'Hoofdklasse Heren', c: '#8F66FF', bg: '#8F66FF', ink: '#ffffff' }
  };
  var SPORTS = { basketbal: 'sports_basketball', volleybal: 'sports_volleyball', handbal: 'sports_handball', voetbal: 'sports_soccer', tennis: 'sports_tennis', padel: 'sports_tennis',
    hockey: 'sports_hockey', zwemmen: 'pool', hardlopen: 'directions_run', wielrennen: 'directions_bike', turnen: 'sports_gymnastics', vechtsport: 'sports_martial_arts',
    honkbal: 'sports_baseball', rugby: 'sports_rugby', golf: 'sports_golf', schaatsen: 'ice_skating', skien: 'downhill_skiing', fitness: 'fitness_center', roeien: 'rowing',
    zeilen: 'sailing', esports: 'sports_esports', finish: 'sports_score' };
  var COMPS = { shl: { label: 'SHL', bg: '#ccff33', ink: '#14142b' }, shlw: { label: 'SHLW', bg: '#e353fc', ink: '#1a1b38' },
    lvlm: { label: 'LVL Heren', bg: '#EE3124', ink: '#ffffff' }, lvlw: { label: 'LVL Dames', bg: '#EE3124', ink: '#ffffff' },
    hnltv: { label: 'HandbalNL TV', bg: '#A66BFF', ink: '#060228' } };
  function compColor(c) { return c === 'shl' ? '#ccff33' : c === 'shlw' ? '#e353fc' : c === 'hnltv' ? '#B58CFF' : '#FF4B3E'; }
  var WD_LOW = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], WD_FULL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MON_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var SLIDE_MS = { agenda: 30000, featured: 30000, matches: 30000, streams: 30000, stand: 30000, quote: 30000, news1: 40000, news2: 30000, platforms: 60000, instagram: 30000, countdown: 30000, slogan: 70000, welcome: 70000, logo: 30000, weather: 30000 };      // every slide stays 30 seconds

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
  var items = [], news = [], plats = [], ig = [], hidden = [], slidesOn = {}, meeting = { mode: 'off', client: '', bg: 0, dim: 45 }, show = { shl: true, shlw: true, lvlm: true, lvlw: true }, matches = [], weather = null, shl = { men: null, women: null };
  function loadAgenda() {
    get('/api/narrowcasting', function (j) {
      if (!j) return;
      if (j.wall) wallDelta = j.wall - Date.now();
      items = j.items || []; show = j.show || show; slidesOn = j.slides || slidesOn; hidden = j.hidden || []; tick();
      applyMeeting(j.effective || j.meeting);                                // guest mode by hand, or a planned meeting that is on now
    });
  }
  // meeting mode switched: go there at once, through the cross-fade (when a fade is still going on, right after it)
  var pendingMeeting = false;
  function applyMeeting(m) {
    m = m || { mode: 'off', client: '', bg: 0, dim: 45 };
    if (m.mode === 'soon' && meeting.planned && meeting.planned === m.planned && meeting.mode !== 'soon') return;     // the screen already went live a moment before the server did
    if (meeting.mode === 'soon' && m.planned && m.planned === meeting.planned && m.mode !== 'soon' && m.mode !== 'off') { goLive(); return; }     // the server went live first: still do it with the animation
    if (m.mode === meeting.mode && m.client === meeting.client && m.bg === meeting.bg && m.dim === meeting.dim && m.start === meeting.start && m.end === meeting.end && m.kind === meeting.kind && m.theme === meeting.theme && m.label === meeting.label) return;
    meeting = m;
    if (!started) return;
    if (busy) { pendingMeeting = true; return; }
    clearTimeout(timer); next();
  }
  function loadMeeting() { get('/api/narrowcasting-meeting', function (j) { if (j) applyMeeting(j.meeting); }); }
  function loadMatches() { get('/api/narrowcasting-matches', function (j) { if (j && j.matches) matches = j.matches; }); }
  function loadWeather() { get('/api/weather', function (w) { if (w && w.now) { weather = w; var el = document.getElementById('wmini'); if (el) el.innerHTML = miniWeather(); } }); }
  function loadNews() { get('/api/narrowcasting-news', function (j) { if (j && j.items && j.items.length) news = j.items; }); }
  function loadIg() { get('/api/narrowcasting-instagram', function (j) { if (j && j.items) ig = j.items; }); }
  function loadPlats() { get('/api/narrowcasting-platforms', function (j) { if (j && j.items && j.items.length) plats = j.items; }); }
  function loadShl() { ['men', 'women'].forEach(function (c) { get('/api/narrowcasting-shl?comp=' + c, function (j) { if (j && j.standings && j.standings.length) shl[c] = j; }); }); }
  loadAgenda(); loadMatches(); loadWeather(); loadShl(); loadNews(); loadPlats(); loadIg();
  if (!PREVIEW) { setInterval(loadAgenda, 15000); setInterval(loadMeeting, 2000); setInterval(loadMatches, 600000); setInterval(loadWeather, 300000); setInterval(loadShl, 600000); setInterval(loadNews, 600000); setInterval(loadPlats, 1800000); setInterval(loadIg, 600000); }

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
      if (hidden.indexOf(m.date + '|' + (m.away ? m.home + ' - ' + m.away : m.home).toLowerCase()) >= 0) continue;                  // deleted on the beheer page
      out.push({ id: 'm' + i, auto: true, comp: m.comp, date: m.date, endDate: '', time: m.time || '', end: '', title: m.away ? m.home + ' - ' + m.away : m.home, place: '', pillars: [],
        sport: m.comp.indexOf('lvl') === 0 ? 'volleybal' : 'handbal', jump: true, allDay: false });
    }
    return out;
  }
  function isStream(it) { var i, prod = false; if (it.auto) return true; for (i = 0; i < it.pillars.length; i++) { if (it.pillars[i] === 'jump') return true; if (it.pillars[i] === 'productie') prod = true; } return !prod; }          // a stream, unless it is only a production
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
  // the tags of a match, in this order: the coloured tag(s) of the client, then a white "Stream" (every match is a stream, unless it is only a
  // production), then a pink "Productie" when it is a production
  function tagsHtml(it, all) {
    var h = '', i, P, k, prod = false;
    if (it.comp && COMPS[it.comp]) h += '<span class="tg" style="color:' + compColor(it.comp) + ';border-color:' + compColor(it.comp) + '">' + COMPS[it.comp].label + '</span>';
    for (i = 0; i < it.pillars.length; i++) {
      k = it.pillars[i];
      if (k === 'jump') continue;
      if (k === 'productie') { prod = true; continue; }
      P = PILLARS[k] || PILLARS.standaard;
      h += '<span class="tg" style="color:' + P.c + ';border-color:' + P.c + '">' + P.label + '</span>';
    }
    if (isStream(it)) h += '<span class="tg st">Stream</span>';
    if (prod) h += '<span class="tg prod">Productie</span>';
    return h;
  }
  // the colour of the client of a match: the sport icon takes it
  var CLIENTS = { shl: ['#ccff33', '#060228'], shlw: ['#e353fc', '#060228'], lvl: ['#FF4B3E', '#ffffff'], lvlm: ['#FF4B3E', '#ffffff'], lvlw: ['#FF4B3E', '#ffffff'], hnl: ['#ff8a4d', '#060228'],
    hnltv: ['#B58CFF', '#060228'], zwem: ['#38BDF8', '#060228', { f: 'pool' }], kwpn: ['#FF8A1F', '#060228', { vb: '0 0 256 256', d: 'M202.05,55A103.24,103.24,0,0,0,128,24h-8a8,8,0,0,0-8,8V59.53L11.81,121.19a8,8,0,0,0-2.59,11.05l13.78,22,.3.43a31.84,31.84,0,0,0,31.34,12.83c13.93-2.36,38.62-6.54,61.4,3.29l-26.6,36.57A84.71,84.71,0,0,1,69.34,194,8,8,0,1,0,58.67,206a103.32,103.32,0,0,0,69.26,26l2.17,0a104,104,0,0,0,72-177ZM124,112a12,12,0,1,1,12-12A12,12,0,0,1,124,112Z' }], tvv: ['#D08A4E', '#060228', { f: 'sports_volleyball' }],
    futsal: ['#D4E04A', '#060228', { f: 'sports_soccer' }], sibv: ['#20B2A0', '#060228', { vb: '0 0 24 24', d: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z' }], hhd: ['#2FD6C0', '#060228'], hhh: ['#8F66FF', '#ffffff'] };
  function clientOf(it) {
    var i; if (it.comp && CLIENTS[it.comp]) return CLIENTS[it.comp];
    for (i = 0; i < it.pillars.length; i++) { if (CLIENTS[it.pillars[i]]) return CLIENTS[it.pillars[i]]; }
    return null;
  }
  function isLvl(it) { var i; if (it.comp && it.comp.indexOf('lvl') === 0) return true; for (i = 0; i < it.pillars.length; i++) { if (it.pillars[i] === 'lvl') return true; } return false; }
  function icStyle(it) { var c = clientOf(it); return c ? ' style="background:' + c[0] + ';border-color:' + c[0] + ';color:' + c[1] + '"' : ''; }
  function iconHtml(it) {                                                   // the icon of a client that has its own (swimming, horse, volleyball, soccer, pin), else the sport, else the day
    var c = clientOf(it); if (c && c[2]) return c[2].f ? '<span class="mi">' + c[2].f + '</span>' : '<svg class="cis" width="38" height="38" viewBox="' + c[2].vb + '" fill="currentColor"><path d="' + c[2].d + '"/></svg>';
    return SPORTS[it.sport] ? '<span class="mi">' + SPORTS[it.sport] + '</span>' : '<span class="dn">' + new Date(parseYmd(it.date)).getUTCDate() + '</span>';
  }
  function dly(i) { return ' style="animation-delay:' + (i * 70 + 150) + 'ms"'; }

  // ---- slides: the stream agenda, one slide per day, slowly scrolling when there are more streams than fit ----
  function daySlides() {
    var list = upcoming(false), today = ymd(wallNow()), wEnd = parseYmd(today) + 7 * 86400000, week = [], days = {}, order = [], out = [], i, it;
    for (i = 0; i < list.length; i++) {
      it = list[i];
      if (it.endDate && parseYmd(it.date) < wEnd) { week.push(it); continue; }
      var key = it.date < today ? today : it.date;
      if (!days[key]) { days[key] = []; order.push(key); }
      days[key].push(it);
    }
    order.sort();
    // a day that has more streams than fit is split over more slides (today: 5 large rows, the other days: 16 in two columns)
    function pages(extra, items, cap) {
      var n = Math.ceil(items.length / cap), k;
      for (k = 0; k < n; k++) { var s = { type: 'agenda', items: items.slice(k * cap, (k + 1) * cap), total: items.length, page: k + 1, pages: n }; for (var p in extra) s[p] = extra[p]; out.push(s); }
    }
    for (i = 0; i < order.length; i++) {
      pages({ date: order[i] }, days[order[i]], order[i] <= today ? 5 : 16);
      if (i === 0 && order[0] === today && week.length) pages({ week: true }, week, 16);                   // the events over several days come after today
    }
    if (week.length && !(order.length && order[0] === today)) { var tail = out.splice(0, out.length); pages({ week: true }, week, 16); out = out.concat(tail); }
    return out;
  }
  function dayTitle(s) {
    var today = ymd(wallNow());
    var tot = s.total || s.items.length, pg = s.pages > 1 ? '<span class="cp">' + s.page + ' / ' + s.pages + '</span>' : '';
    if (s.week) return 'Deze <b>week</b><span class="cn">' + tot + (tot === 1 ? ' evenement' : ' evenementen') + '</span>' + pg;
    var diff = Math.round((parseYmd(s.date) - parseYmd(today)) / 86400000), d = new Date(parseYmd(s.date));
    var name = diff <= 0 ? 'vandaag' : diff === 1 ? 'morgen' : WD_FULL[d.getUTCDay()];
    return 'Wedstrijden <b>' + name + '</b><span class="cn">' + tot + (tot === 1 ? ' wedstrijd' : ' wedstrijden') + '</span>' + pg;
  }
  // under the days: the next seven days as pills, today marked, the day of this slide filled, and the number of streams per day
  function dayPills(curDate) {
    var today = ymd(wallNow()), l = upcoming(false), counts = {}, i, d, key, lab, n, h = '<div class="dpills rz" style="animation-delay:500ms">';
    for (i = 0; i < l.length; i++) { if (!l[i].endDate) { key = l[i].date < today ? today : l[i].date; counts[key] = (counts[key] || 0) + 1; } }
    for (i = 0; i < 7; i++) {
      d = new Date(parseYmd(today) + i * 86400000); key = ymd(d.getTime()); n = counts[key] || 0;
      lab = WD_LOW[d.getUTCDay()] + ' ' + two(d.getUTCDate()) + '-' + two(d.getUTCMonth() + 1);                  // za 31-10
      h += '<div class="dpill' + (n ? ' has' : '') + (i === 0 ? ' td' : '') + (key === curDate ? ' cur' : '') + '"><span>' + lab + '</span>' + (n ? '<i>' + n + '</i>' : '') + '</div>';
    }
    return h + '</div>';
  }
  function dayHtml(s) {
    if (s.empty) return '<div class="ttl rz">Wedstrijd<b>agenda</b></div><div class="empty rz"><b>Geen wedstrijden</b><span>Er staat op dit moment geen wedstrijd gepland.</span></div>';
    var html = '<div class="ttl rz">' + dayTitle(s) + '</div>';
    if (!s.items) return html + '<div class="empty rz"><b>Geen wedstrijden</b><span>Er staat op dit moment geen wedstrijd gepland.</span></div>';
    // today is large and in one column, the other days (and the events of the week) are in two columns
    var big = !s.week && s.date <= ymd(wallNow()), rows = [], i, it, live, sub, tm;
    for (i = 0; i < s.items.length; i++) {
      it = s.items[i]; live = isLive(it); sub = live ? '' : inTxt(it);
      tm = live ? '<span class="tm now"><i></i>' + (isStream(it) ? 'LIVE' : 'BEZIG') + '</span>' : (it.time ? '<span class="tm">' + esc(it.time) + (sub ? '<small>' + sub + '</small>' : '') + '</span>' : (it.allDay ? '<span class="tm">hele dag</span>' : ''));
      rows.push('<div class="it' + (big ? ' xl' : '') + ' rz' + (live ? ' live' : '') + '"' + dly(big ? i : i % Math.ceil(s.items.length / 2)) + '><div class="ic"' + icStyle(it) + '>' + iconHtml(it) + '</div><div class="tt">' + esc(it.title || 'Zonder titel').replace(/ [-\u2013] /, ' <span class="sep">\u2013</span> ') + '</div>' + tm +
        '<div class="tgs">' + tagsHtml(it) + (s.week ? '<span class="pl">' + rangeTxt(it) + '</span>' : (it.place && !isLvl(it) ? '<span class="pl">' + esc(it.place) + '</span>' : '')) + '</div></div>');
    }
    if (big) return html + '<div class="vp"><div class="scr" id="sc">' + rows.join('') + '</div></div>' + dayPills(s.date);
    var half = Math.ceil(rows.length / 2);
    return html + '<div class="vp two"><div class="scr" id="sc"><div class="dcol">' + rows.slice(0, half).join('') + '</div><div class="dcol">' + rows.slice(half).join('') + '</div></div></div>' + dayPills(s.week ? '' : s.date);
  }
  // more streams than fit: after a few seconds the list scrolls slowly up and stays at the end
  var scTimer = 0;
  function startScroll() {
    clearTimeout(scTimer);
    var sc = document.getElementById('sc'); if (!sc) return;
    var over = sc.offsetHeight - sc.parentNode.clientHeight;
    if (over < 6) return;
    var dur = Math.min(21, Math.max(8, over / 28));
    scTimer = setTimeout(function () {
      sc.style.webkitTransition = 'transform ' + dur + 's linear'; sc.style.transition = 'transform ' + dur + 's linear';
      sc.style.webkitTransform = 'translateY(' + (-over) + 'px)'; sc.style.transform = 'translateY(' + (-over) + 'px)';
    }, 5000);
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
    var h = shlLogo(women) + '<div class="pn" style="left:80px;width:1760px"><div class="tab rz">Komende wedstrijden<small>' + (women ? 'SHLW' : 'SHL') + '</small></div>';
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

  // ---- slide: sports news, three items of the NOS feed ----
  function ago(n) {
    var m = Math.round((wallNow() - n.pubWall) / 60000);
    if (!n.pubWall || m < 0) return 'zojuist';
    if (m < 2) return 'zojuist'; if (m < 60) return m + ' min geleden';
    if (m < 1440) return Math.floor(m / 60) + ' uur geleden';
    return Math.floor(m / 1440) + (m < 2880 ? ' dag' : ' dagen') + ' geleden';
  }
  function newsImg(n, cls) { return '<div class="' + cls + '"' + (n.image ? ' style="background-image:url(' + n.image + ')"' : '') + '></div>'; }
  // big: the latest item, photo right like the ByT socials
  function newsBigHtml() {
    if (!news.length) return null;
    var n = news[0];
    return '<div class="ttl rz">Laatste <b>nieuws</b><span class="cn">NOS Sport</span></div>' +
      '<div class="nbg rz" style="animation-delay:150ms"><span class="na">' + esc(ago(n)) + '</span><div class="nt">' + esc(n.title) + '</div><div class="ns">' + esc(n.summary) + '</div></div>' +
      '<div class="nbp">' + newsImg(n, 'nbi') + '<div class="nlg">' + document.getElementById('logoTpl').innerHTML + '</div></div>' + '<div class="nsrc rz" style="animation-delay:600ms">Bron: NOS Sport (RSS)</div>';
  }
  // small: the next three items as rows
  function newsSmallHtml() {
    if (news.length < 2) return null;
    var h = '<div class="ttl rz">Meer <b>nieuws</b><span class="cn">NOS Sport</span></div>', i, n;
    for (i = 1; i < Math.min(4, news.length); i++) {
      n = news[i];
      h += '<div class="nc rz" style="left:' + (80 + (i - 1) * 600) + 'px;animation-delay:' + (i * 150) + 'ms">' + newsImg(n, 'ni') +
        '<div class="nb"><span class="na">' + esc(ago(n)) + '</span><div class="nt">' + esc(n.title) + '</div><div class="ns">' + esc(n.summary) + '</div></div></div>';
    }
    return h + '<div class="nsrc rz" style="animation-delay:600ms">Bron: NOS Sport (RSS)</div>';
  }

  // ---- slide: countdown to the next matches of SHL, SHLW, Hoofdklasse Hockey and the Lotto Volley League (plus any other client that goes live earlier) ----
  var CD = {                                                                 // the colours, label and logo of the four fixed cards
    shl: { label: 'SHL', bg: '#ccff33', ink: '#14142b', logo: 'assets/shl-mark-white.png' },
    shlw: { label: 'SHLW', bg: '#e353fc', ink: '#1a1b38', logo: 'assets/women/shlw-mark-white.png' },
    hockey: { label: 'Hoofdklasse Hockey', bg: '#2FD6C0', ink: '#060228', logo: 'assets/platforms/hoofdklasse-logo.png' },
    lvl: { label: 'Lotto Volley League', bg: '#EE3124', ink: '#ffffff', logo: 'assets/lvl/logo.svg' }
  };
  var CD_PLAT = { hnl: 'handbalnl', hnltv: 'handbalnl', kwpn: 'kwpn', zwem: 'zwemsport', tvv: 'tvv', sibv: 'sportinbeeld' };   // client -> the platform whose logo it takes
  var cdTimer = 0, CD_KEYS = ['shl', 'shlw', 'hockey', 'lvl'];
  function hasPillar(it, k) { var i; for (i = 0; i < it.pillars.length; i++) { if (it.pillars[i] === k) return true; } return false; }
  function cdKind(it) {
    if (it.comp === 'shl' || it.comp === 'shlw') return it.comp;
    if (hasPillar(it, 'hhd') || hasPillar(it, 'hhh')) return 'hockey';
    if (isLvl(it)) return 'lvl';
    return '';
  }
  // the label, colour and logo of a client that is not one of the four
  function cdOther(it) {
    var i, k = it.comp && CLIENTS[it.comp] ? it.comp : '', c, P, p, lg = '';
    if (!k) { for (i = 0; i < it.pillars.length; i++) { if (CLIENTS[it.pillars[i]]) { k = it.pillars[i]; break; } } }
    if (!k) return null;
    c = CLIENTS[k]; P = PILLARS[k] || (COMPS[k] ? { label: COMPS[k].label } : { label: k });
    for (i = 0; i < plats.length; i++) { if (plats[i].key === CD_PLAT[k]) lg = plats[i].logo; }
    return { label: P.label, acc: c[0], ink: c[1], logo: lg, icon: lg ? '' : iconHtml(it) };
  }
  // per competition the first match that has not finished yet, plus the matches of other clients that start before the last of those four
  function cdCards() {
    var all = items.slice(), i, m, now = wallNow(), best = {}, k, it, extras = [], cards = [], last = 0, o;
    for (i = 0; i < matches.length; i++) {
      m = matches[i];
      all.push({ id: 'cm' + i, auto: true, comp: m.comp, date: m.date, endDate: '', time: m.time || '', end: '', title: m.away ? m.home + ' - ' + m.away : m.home, place: '', pillars: [], jump: true, allDay: false });
    }
    for (i = 0; i < all.length; i++) {
      it = all[i];
      if (!it.time || it.allDay || it.endDate || endMs(it) <= now) continue;
      k = cdKind(it);
      if (k) { if (!best[k] || startMs(it) < startMs(best[k])) best[k] = it; }
      else if (clientOf(it) && it.jump !== false) extras.push(it);
    }
    for (i = 0; i < CD_KEYS.length; i++) {
      k = CD_KEYS[i]; it = best[k];
      var C = CD[k], acc = C.bg, ink = C.ink, label = C.label;
      if (it && k === 'hockey') { label = hasPillar(it, 'hhh') ? 'Hoofdklasse Heren' : 'Hoofdklasse Dames'; if (hasPillar(it, 'hhh')) { acc = '#8F66FF'; ink = '#ffffff'; } }
      cards.push({ it: it || null, label: label, acc: acc, ink: ink, logo: C.logo, icon: '', ms: it ? startMs(it) : 0 });
      if (it && startMs(it) > last) last = startMs(it);
    }
    extras.sort(function (a, b) { return startMs(a) - startMs(b); });
    var seen = {};
    for (i = 0; i < extras.length; i++) {                                    // another client goes live: its next match takes its place in the order (one card per client)
      o = cdOther(extras[i]); if (!o || seen[o.label]) continue;
      seen[o.label] = 1;
      cards.push({ it: extras[i], label: o.label, acc: o.acc, ink: o.ink, logo: o.logo, icon: o.icon, ms: startMs(extras[i]) });
    }
    cards.sort(function (a, b) { return (a.ms || 9e15) - (b.ms || 9e15); });
    cards = cards.slice(0, 4);                                               // never more than four: the four that go live first
    return cards;
  }
  function cdSoon(cards) {                                                   // shown only when the first match is less than a day away
    var i;
    for (i = 0; i < cards.length; i++) { if (cards[i].it && cards[i].ms - wallNow() < 86400000) return true; }
    return false;
  }
  function two2(n) { return (n < 10 ? '0' : '') + n; }
  function hexMix(a, b, t) {                                                 // t of colour a over colour b
    function p(h, i) { return parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); }
    var r = Math.round(p(a, 0) * t + p(b, 0) * (1 - t)), g = Math.round(p(a, 1) * t + p(b, 1) * (1 - t)), l = Math.round(p(a, 2) * t + p(b, 2) * (1 - t));
    return 'rgb(' + r + ',' + g + ',' + l + ')';
  }
  function hexA(a, t) { return 'rgba(' + parseInt(a.slice(1, 3), 16) + ',' + parseInt(a.slice(3, 5), 16) + ',' + parseInt(a.slice(5, 7), 16) + ',' + t + ')'; }
  function cdUnits(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400);
    function u(n, l, cls) { return '<span class="cdu' + (cls ? ' ' + cls : '') + '"><b>' + n + '</b><i>' + l + '</i></span>'; }
    return u(d, d === 1 ? 'dag' : 'dagen', 'cdud') + u(two2(Math.floor(s % 86400 / 3600)), 'uur') + u(two2(Math.floor(s % 3600 / 60)), 'min') + u(two2(s % 60), 'sec') + '<span class="cdlv">NU LIVE</span>';
  }
  // subtle cards: a dark surface with a faint tint of the colour of the client, the colour itself only as an accent (pills, ring)
  function cdCard(cd, pos, n) {
    var small = n > 4, cols = small ? 3 : 2, w = small ? 560 : 860, left = 80 + (pos % cols) * (w + 40), top = 196 + Math.floor(pos / cols) * 440, it = cd.it, acc = cd.acc, parts, home, away, h, size, longest;
    h = '<div class="cdc rz' + (small ? ' cds' : '') + '" style="left:' + left + 'px;top:' + top + 'px;background:' + hexMix(acc, '#0a0836', 0.17) + ';border-color:' + hexA(acc, 0.4) + ';animation-delay:' + (pos * 120 + 150) + 'ms">';
    if (!it) return h + '<div class="cdp"><span class="cdpl" style="background:' + acc + ';color:' + cd.ink + '">' + esc(cd.label) + '</span></div><div class="cdn">Nog geen wedstrijd bekend</div></div>';
    parts = it.title.replace(/\[cup\]\s*/ig, '').split(' - '); home = parts[0]; away = parts.slice(1).join(' - ');
    longest = Math.max(home.length, away.length);
    size = small ? (longest > 26 ? 30 : longest > 18 ? 36 : 46) : (longest > 30 ? 36 : longest > 20 ? 46 : 62);
    var live = isLive(it), prod = hasPillar(it, 'productie') && !isStream(it);
    h += '<div class="cdp"><span class="cdpl" style="background:' + acc + ';color:' + cd.ink + '">' + esc(cd.label) + '</span><span class="cdpl cdpd">' +
      (live ? 'NU LIVE' : it.date.slice(8, 10) + '-' + it.date.slice(5, 7) + ' | ' + it.time) + '</span>' + (small ? '' : '<span class="cdpl cdpo" style="border-color:' + hexA(acc, 0.85) + ';color:' + acc + '">' + (prod ? 'Productie' : 'Livestream') + '</span>') + '</div>' +
      '<div class="cdt" style="font-size:' + size + 'px;line-height:' + Math.round(size * 1.08) + 'px">' + esc(home) + (away ? '<br>' + esc(away) : '') + '</div>' +
      '<div class="cdm" data-ms="' + cd.ms + '" style="color:' + acc + '">' + cdUnits(cd.ms - wallNow()) + '</div>' +
      '<div class="cdg" style="background:' + hexA(acc, 0.2) + ';border-color:' + acc + ';color:#ffffff">' + (cd.logo ? '<img src="' + cd.logo + '" alt="">' : cd.icon) + '</div></div>';
    return h;
  }
  var cdCache = null;
  function countdownHtml() {
    var cards = cdCards(), i, h = '<div class="ttl rz">Volgende <b>live</b></div>', any = false;
    for (i = 0; i < cards.length; i++) { if (cards[i].it) any = true; h += cdCard(cards[i], i, cards.length); }
    return any ? h : null;
  }
  function startCountdown() {                                                // every card has its own timer, ticking every second
    clearInterval(cdTimer);
    var els = document.getElementsByClassName('cdm');
    if (!els.length) return;
    function upd() {
      var i, left, s, d, bs, u, k;
      for (i = 0; i < els.length; i++) {
        left = +els[i].getAttribute('data-ms') - wallNow(); s = Math.max(0, Math.floor(left / 1000)); d = Math.floor(s / 86400);
        bs = els[i].getElementsByTagName('b'); u = els[i].getElementsByClassName('cdu');
        bs[0].innerHTML = d; bs[1].innerHTML = two2(Math.floor(s % 86400 / 3600)); bs[2].innerHTML = two2(Math.floor(s % 3600 / 60)); bs[3].innerHTML = two2(s % 60);
        u[0].getElementsByTagName('i')[0].innerHTML = d === 1 ? 'dag' : 'dagen';
        u[0].style.display = d > 0 && left > 0 ? 'inline-block' : 'none';
        for (k = 1; k < u.length; k++) u[k].style.display = left > 0 ? 'inline-block' : 'none';
        els[i].lastChild.style.display = left > 0 ? 'none' : 'inline-block';
      }
    }
    upd(); cdTimer = setInterval(upd, 1000);
  }

  // ---- slide: the latest Instagram post or reel of SHL and SHL Women; a reel plays (muted, looping) ----
  function igHtml() {
    if (!ig.length) return null;
    var h = '<div class="ttl rz">Laatste <b>posts</b><span class="cn" style="background:' + COMPS.shl.bg + ';color:' + COMPS.shl.ink + '">SHL</span><span class="cn" style="margin-left:14px;background:' + COMPS.shlw.bg + ';color:' + COMPS.shlw.ink + '">SHLW</span></div>', i, p, left, media;
    for (i = 0; i < ig.length; i++) {
      p = ig[i];
      left = ig.length === 1 ? 530 : 80 + i * 900;
      media = p.type === 'video'
        ? '<video class="igv" src="' + p.media + '"' + (p.poster ? ' poster="' + p.poster + '"' : '') + ' muted loop playsinline webkit-playsinline preload="auto"></video>'
        : '<div class="igi" style="background-image:url(' + p.media + ')"></div>';
      h += '<div class="igc rz' + (p.reel ? ' igr' : '') + '" style="left:' + left + 'px;animation-delay:' + (i * 200 + 150) + 'ms"><div class="igm">' + media + '</div>' +
        '<div class="igt"><span class="na" style="background:' + COMPS[p.key].bg + ';color:' + COMPS[p.key].ink + '">' + esc(p.label) + (p.reel ? ' \u00b7 reel' : '') + '</span><span class="na ig2">' + esc(ago(p)) + '</span>' +
        '<div class="igp">' + esc(p.caption || '') + '</div></div>' +
        '<div class="igu">' + (p.avatar ? '<span class="iga" style="background-image:url(' + p.avatar + ')"></span>' : '') + '<span>@' + esc(p.username) + '</span></div></div>';
    }
    return h;
  }
  function playIgVideos() {                                                 // autoplay can be blocked: start it ourselves, retry once
    var v = document.getElementsByClassName('igv'), i;
    for (i = 0; i < v.length; i++) { try { v[i].muted = true; var pr = v[i].play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
  }

  // ---- slide: platform wall, a snippet of the homepage of every platform that scrolls slowly sideways ----
  var PLAT_W = 720, PLAT_GAP = 48;
  function platformsHtml() {
    if (!plats.length) return null;
    var h = '<div class="ttl rz">Powered by <b class="jp">JUMP</b></div><div class="pw"><div class="pstrip" id="pstrip" style="width:' + (plats.length * (PLAT_W + PLAT_GAP)) + 'px">', i, p;
    for (i = 0; i < plats.length; i++) {
      p = plats[i];
      h += '<div class="pwc" style="left:' + (80 + i * (PLAT_W + PLAT_GAP)) + 'px"><div class="pwi" style="background-image:url(' + p.img + ')"></div>' +
        '<div class="pwl"><div class="pwg"' + (p.logo ? ' style="background-image:url(' + p.logo + ')"' : '') + '></div><div class="pwt"><div class="pwn">' + esc(p.name) + '</div><div class="pwd">' + esc(p.desc || '') + '</div><div class="pwu">' + esc(p.url) + '</div></div></div></div>';
    }
    return h + '</div></div>';
  }
  function startPlatScroll(ms) {                                            // the strip drifts from the first platform to the last, in one slow straight move
    var el = document.getElementById('pstrip'); if (!el) return;
    var dist = Math.max(0, plats.length * (PLAT_W + PLAT_GAP) - 1920 + 160);
    setTimeout(function () {
      el.style.webkitTransition = el.style.transition = 'transform ' + Math.round(ms / 1000) + 's linear';
      el.style.webkitTransform = el.style.transform = 'translateX(-' + dist + 'px)';
    }, 1500);
  }

  // ---- slide: only the logo ----
  function logoHtml() { return '<div class="lg1">' + document.getElementById('logoTpl').innerHTML + '</div>'; }

  // will it rain, and when: the moment comes from the server, the minutes are counted down here
  function minTxt(m) { if (m >= 10) m = Math.round(m / 5) * 5; return m < 60 ? m + ' min' : Math.floor(m / 60) + ' u' + (m % 60 ? ' ' + m % 60 + ' min' : ''); }     // rounded to 5 minutes
  function rainTxt(short) {                                                 // only "rain in X min", and only when it is within 2 hours; otherwise no pill at all
    var r = weather && weather.rainSoon; if (!r || r.state !== 'soon') return '';
    var m = Math.round((r.startWall - wallNow()) / 60000);
    if (m <= 0 || m > 120) return '';
    return (short ? 'Regen over ' : 'Regen verwacht over ') + minTxt(m);
  }
  var DROP = '<svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#ffffff" d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2z"/></svg>';

  // the current weather, small, top left: on the slides of the meeting mode
  function miniWeather() {                                                  // two pills, each with its icon in a circle inside: the temperature and the place
    if (!weather) return '';
    var n = weather.now, pin = '<svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#ffffff" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>';
    return '<span class="wm-g"><span class="wm-p"><span class="wm-i">' + icon(n.code, n.day, 42) + '</span><b>' + n.temp + '&deg;</b></span></span>' +
      '<span class="wm-g"><span class="wm-p"><span class="wm-i">' + pin + '</span>' + esc(weather.place) + '</span></span>' +
      (rainTxt(true) ? '<span class="wm-g"><span class="wm-p"><span class="wm-i">' + DROP + '</span>' + esc(rainTxt(true)) + '</span></span>' : '');   // will it rain, and when
  }
  function meetingWeather() { return meeting.mode === 'off' ? '' : '<div class="wmini rz" id="wmini" style="animation-delay:400ms">' + miniWeather() + '</div>'; }

  // the four pillars as round icons along the bottom (the letter and the name in the secondary colour of the pillar; the JUMP wordmark has green letters and a white arrow). One by one they stretch, then nothing for 30 seconds: each stretches (left anchored, like the circles
  // of the ByTomorrow socials) into a pill with its full name and goes back to a circle; the colours never mix
  // (only on the slogan and the meeting mode)
  var PB = [['Marketing', '#FFCC00', '#C25100', 'marketing.png'], ['Content', '#00FFE6', '#008B8B', 'content.png'], ['Productie', '#FC06E5', '#7B1FA2', 'productie.png'], ['JUMP', '#49FF9F', '#2F7E4D', 'jump.svg']], pbTimers = [], PB_D = 68;
  function pillarBar() {
    var h = '<div class="pb rz" id="pb" style="animation-delay:600ms">', i;
    for (i = 0; i < PB.length; i++) h += '<div class="pbc" style="background:' + PB[i][1] + '"><span class="pbw"><img src="/assets/pillars/' + PB[i][3] + '" alt=""></span><span class="pbt" style="' + (i === 3 ? 'left:28px' : 'color:' + PB[i][2]) + '">' + (i === 3 ? '<img src="/assets/pillars/jump-wordmark.svg" alt="JUMP">' : PB[i][0]) + '</span></div>';
    return h + '</div>';
  }
  function stopPillars() { while (pbTimers.length) clearTimeout(pbTimers.pop()); }
  function startPillars() {
    stopPillars();
    var el = document.getElementById('pb'); if (!el) return;
    var segs = el.children;
    function at(ms, fn) { pbTimers.push(setTimeout(fn, ms)); }
    // a pill with the feel of the circles in the ByTomorrow socials (a hard start and a long brake, the name fades in just before the
    // pill has landed), a little slower than the socials: the circle stretches into a pill, and later goes back
    var STRETCH = 850, FADE = 300;
    function open(n, t) {
      var seg = segs[n], ico = seg.children[0], txt = seg.children[1];
      // JUMP shows its full wordmark (with its own arrow) instead of the name, so the round arrow gives way to it
      at(t, function () { seg.style.width = (n === 3 ? 28 + txt.offsetWidth + 28 : PB_D + 8 + txt.offsetWidth + 30) + 'px'; if (n === 3) ico.style.opacity = 0; });
      at(t + STRETCH - 300, function () { txt.style.opacity = 1; });
    }
    function close(n, t) {
      var seg = segs[n], ico = seg.children[0], txt = seg.children[1];
      at(t, function () { txt.style.opacity = 0; });
      at(t + FADE, function () { seg.style.width = PB_D + 'px'; ico.style.opacity = 1; });
    }
    // the whole routine once per 3 minutes: first one, two, three and four on their own, then all four together, then rest
    function cycle() {
      var t = 2000, k, one = STRETCH + 2200 + FADE + STRETCH;
      for (k = 0; k < segs.length; k++) { open(k, t); close(k, t + STRETCH + 2200); t += one + 150; }
      t += 250;
      for (k = 0; k < segs.length; k++) { open(k, t); close(k, t + STRETCH + 3000); }
      at(180000, cycle);                                                         // much less often: the next round starts 3 minutes after this one
    }
    cycle();
  }

  // ---- slide: welcome (meeting mode), with the name of the client ----
  function welcomeHtml() {
    var name = meeting.client || 'bij ByTomorrow', n = name.length, size = n <= 10 ? 206 : n <= 16 ? 160 : n <= 24 ? 120 : 90;
    var bg = meeting.bg ? '<div class="wbg" style="background-image:url(/api/photo?key=narrowcasting%3Awelcome-bg&v=' + meeting.bg + ')"></div><div class="wdim" style="opacity:' + (meeting.dim / 100) + '"></div>' : '';   // the background photo of the welcome slide, made a bit darker
    return bg + '<div class="sg rz" style="animation-delay:150ms"><span style="font-weight:500;display:block;line-height:186px">Welkom</span><b style="display:block;margin-top:0;font-size:' + size + 'px;line-height:' + Math.round(size * 1.0) + 'px">' + esc(name) + '</b></div><div class="sgl rz" style="animation-delay:700ms">' + document.getElementById('logoTpl').innerHTML + '</div>' + meetingWeather() + pillarBar();
  }

  // ---- planned meetings: 10 minutes before the start "Binnenkort meeting", then the meeting itself (not the same as "Welkom") ----
  function guestBg() { return meeting.bg ? '<div class="wbg" style="background-image:url(/api/photo?key=narrowcasting%3Awelcome-bg&v=' + meeting.bg + ')"></div><div class="wdim" style="opacity:' + (meeting.dim / 100) + '"></div>' : ''; }
  function guestName(txt, def) { var n = txt.length; return '<b style="display:block;font-size:' + (n <= 10 ? 190 : n <= 16 ? 150 : n <= 24 ? 112 : 84) + 'px;line-height:' + (n <= 10 ? 190 : n <= 16 ? 150 : n <= 24 ? 112 : 84) + 'px">' + esc(txt || def) + '</b>'; }
  function themeKey(type) {                                                  // the colour scheme of the guest and meeting slides (a background photo keeps the navy look)
    if (type !== 'welcome' && type !== 'meeting' && type !== 'soon') return '';
    if (type === 'soon') return 'blauw';
    return meeting.bg ? '' : (meeting.theme && meeting.theme !== 'navy' ? meeting.theme : '');
  }
  function meetStartMs() { return meeting.date ? parseYmd(meeting.date) + (+meeting.start.slice(0, 2)) * 3600000 + (+meeting.start.slice(3, 5)) * 60000 : 0; }
  function soonProg() {                                                      // 0 to 1 over the ten minutes before the start
    var left = Math.max(0, (meetStartMs() - wallNow()) / 1000);
    return Math.max(0, Math.min(1, 1 - left / 600));
  }
  function soonText() {                                                      // "over 7 minuten", "over 1 minuut"
    var left = meetStartMs() - wallNow(), m = Math.ceil(left / 60000);
    return left <= 0 ? 'nu' : m <= 1 ? 'over 1 minuut' : 'over ' + m + ' minuten';
  }
  function soonHtml() {
    var visit = meeting.kind === 'welcome', word = meeting.label ? meeting.label.toLowerCase() : (visit ? 'bezoek' : 'meeting'), fs = word.length > 9 ? 120 : 176;
    return guestBg() + '<div class="sg rz" style="animation-delay:150ms"><span style="font-weight:500;display:block;line-height:176px;font-size:176px">Binnenkort</span><b style="display:block;line-height:176px;font-size:' + fs + 'px">' + esc(word) + '</b></div>' +
      '<div class="sgs rz" style="animation-delay:500ms">' + (meeting.client ? '<span class="sgn">' + esc(meeting.client) + '</span>' : '') + '</div>' +
      '<div class="sgt rz" id="soonleft" style="animation-delay:550ms">' + soonText() + '</div>' +
      '<div class="sgb rz" style="animation-delay:600ms"><i id="soonb" style="width:' + Math.round(soonProg() * 100) + '%"></i></div>' +
      '<div class="sgl rz" style="animation-delay:700ms">' + document.getElementById('logoTpl').innerHTML + '</div>' + meetingWeather();
  }
  function meetingHtml() {
    return guestBg() + '<div class="sg rz" style="animation-delay:150ms"><span style="font-weight:500;display:block;line-height:186px">' + esc(meeting.label || 'Meeting') + '</span>' + (meeting.client ? guestName(meeting.client, '') : '') + '</div>' +
      '<div class="sgl rz" style="animation-delay:700ms">' + document.getElementById('logoTpl').innerHTML + '</div>' + meetingWeather();
  }
  var soonTimer = 0, soonOnce = 0, burstNext = false;
  function startSoon() {                                                     // the bar fills up and the text counts down while the start comes closer
    clearInterval(soonTimer); clearTimeout(soonOnce);
    var left0 = meetStartMs() - wallNow(); if (left0 > 0 && left0 < 700000) soonOnce = setTimeout(goLive, left0);        // exactly at the start
    var el = document.getElementById('soonb'), tx = document.getElementById('soonleft'); if (!el) return;
    soonTimer = setInterval(function () {
      el.style.width = (soonProg() * 100).toFixed(2) + '%'; if (tx) tx.innerHTML = soonText();
      if (meetStartMs() <= wallNow()) goLive();
    }, 1000);
  }
  // the start time has come: the bar is full, then its colour bursts out of the end of the bar and becomes the meeting slide
  function goLive() {
    clearInterval(soonTimer); clearTimeout(soonOnce);
    if (meeting.mode !== 'soon') return;
    var el = document.getElementById('soonb'); if (el) el.style.width = '100%';
    meeting = { mode: meeting.kind === 'welcome' ? 'welcome' : 'meeting', client: meeting.client, bg: meeting.bg, dim: meeting.dim, theme: meeting.theme, label: meeting.label, start: meeting.start, end: meeting.end, date: meeting.date, planned: meeting.planned };
    burstNext = true; clearTimeout(timer);
    setTimeout(function () { if (busy) pendingMeeting = true; else next(); }, 450);
  }
  var THEME_BG = { blauw: '#3D5AFE', lichtblauw: '#A5B4FF', productie: '#FC06E5', jump: '#49FF9F', marketing: '#FFCC00', content: '#00FFE6', wit: '#ffffff' };
  function burst(swap, done) {
    var key = themeKey(meeting.mode === 'welcome' ? 'welcome' : 'meeting'), b = document.createElement('div');
    b.className = 'burst'; b.style.background = THEME_BG[key] || '#060228';
    stage.appendChild(b); b.offsetWidth;
    b.style.webkitTransform = 'scale(80)'; b.style.transform = 'scale(80)';
    setTimeout(function () {
      swap();
      var el = slidesEl.firstChild; if (el) el.className = el.className.replace(' pre', '');
      slidesEl.style.webkitTransition = 'none'; slidesEl.style.transition = 'none'; slidesEl.style.opacity = 1;
      b.style.opacity = 0;
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); done(); }, 800);
    }, 900);
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
  var DESC = { 0: 'Zonnig', 1: 'Overwegend zonnig', 2: 'Half bewolkt', 3: 'Bewolkt', 45: 'Mist', 48: 'Rijpmist', 51: 'Lichte motregen', 53: 'Motregen', 55: 'Zware motregen',
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
      '<div class="wd">' + esc(n.day === false ? (n.code === 0 ? 'Helder' : n.code === 1 ? 'Overwegend helder' : DESC[n.code] || '') : DESC[n.code] || '') + '</div><div class="ws">' + (rainTxt(false) ? '<span class="wp wrain" id="wrain">' + esc(rainTxt(false)) + '</span>' : '') + '<span class="wp">voelt als ' + n.feels + '&deg;</span><span class="wp">wind ' + n.wind + ' km/u</span>' +
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
    if (meeting.mode === 'soon') return [{ type: 'soon' }];
    if (meeting.mode === 'meeting') return [{ type: 'meeting' }];
    // which slides take part is set on the beheer page; when looking at one slide (?slide=...) they all do
    var on = function (k) { return !!only || slidesOn[k] !== false; };
    if (on('agenda')) { p = daySlides(); if (!p.length) out.push({ type: 'agenda', empty: true }); else for (i = 0; i < p.length; i++) out.push(p[i]); }
    if (on('featured')) { p = featuredPages(); for (i = 0; i < p.length; i++) out.push({ type: 'featured', list: p[i] }); }
    if (streamsHtml('men')) { if (on('streams_men')) out.push({ type: 'streams', comp: 'men' }); if (on('stand_men')) out.push({ type: 'stand', comp: 'men' }); }
    if (on('slogan')) out.push({ type: 'slogan' });
    if (streamsHtml('women')) { if (on('streams_women')) out.push({ type: 'streams', comp: 'women' }); if (on('stand_women')) out.push({ type: 'stand', comp: 'women' }); }
    if (on('matches') && matchesHtml()) out.push({ type: 'matches' });
    if (on('quote')) out.push({ type: 'quote' });
    if (on('news1') && news.length) out.push({ type: 'news1' });
    if (on('news2') && news.length > 1) out.push({ type: 'news2' });
    if (on('platforms') && plats.length) out.push({ type: 'platforms' });
    if (on('instagram') && ig.length) out.push({ type: 'instagram' });
    if (on('countdown') && (matches.length || items.length) && (only || cdSoon(cdCards()))) out.push({ type: 'countdown' });
    if (on('weather') && weather) out.push({ type: 'weather' });
    if (on('logo')) out.push({ type: 'logo' });
    return out.length ? out : [{ type: 'logo' }];                              // never a blank screen
  }
  function renderSlide(s) {
    if (s.type === 'agenda') return dayHtml(s);
    if (s.type === 'featured') return featuredHtml(s.list);
    if (s.type === 'matches') return matchesHtml();
    if (s.type === 'none') return '<div class="empty rz"><b>Geen inhoud</b><span>Deze slide heeft op dit moment niets te tonen.</span></div>';
    if (s.type === 'news1') return newsBigHtml();
    if (s.type === 'news2') return newsSmallHtml();
    if (s.type === 'platforms') return platformsHtml();
    if (s.type === 'instagram') return igHtml();
    if (s.type === 'countdown') return countdownHtml();
    if (s.type === 'streams') return streamsHtml(s.comp);
    if (s.type === 'stand') return shlHtml(s.comp);
    if (s.type === 'quote') return quoteHtml();
    if (s.type === 'slogan') return sloganHtml();
    if (s.type === 'welcome') return welcomeHtml();
    if (s.type === 'soon') return soonHtml();
    if (s.type === 'meeting') return meetingHtml();
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

  var only = (/[?&]slide=([a-z0-9_,]+)/.exec(location.search) || [])[1]; only = only ? only.split(',') : null;   // ?slide=shl,weather shows only those slides (to look at them)
  var onlyComp = (/[?&]comp=(men|women)/.exec(location.search) || [])[1];
  var onlyN = +((/[?&]n=(\d+)/.exec(location.search) || [])[1] || 0);       // ?slide=agenda&n=3 shows the third of those slides
  var busy = false, shownKey = '', timer = 0;
  var slides = [], idx = -1, current = null, dotsEl = null;
    function dots() { }                                                     // the slide dots at the bottom are gone
  function next(first) {
    if (busy) return;
    slides = buildSlides();
    if (only) { var f = [], q; for (q = 0; q < slides.length; q++) { if (only.indexOf(slides[q].type) >= 0 && (!onlyComp || slides[q].comp === onlyComp)) f.push(slides[q]); } if (f.length) slides = f; else slides = [{ type: 'none' }]; if (onlyN && slides[onlyN - 1]) slides = [slides[onlyN - 1]]; }
    if (!slides.length) { timer = setTimeout(next, 3000); return; }
    idx = (idx + 1) % slides.length;
    var s = slides[idx], html = renderSlide(s);
    if (!html) { timer = setTimeout(next, 200); return; }
    var key = s.type + '|' + (s.comp || '') + '|' + (s.type === 'welcome' || s.type === 'soon' || s.type === 'meeting' ? meeting.client + '|' + meeting.bg + '|' + meeting.dim + '|' + meeting.start + '|' + meeting.end + '|' + meeting.theme + '|' + meeting.label : '');
    if (slides.length === 1 && key === shownKey) { timer = setTimeout(next, 5000); return; }          // meeting mode: the one slide just stays
    shownKey = key; busy = true; stopPillars();
    var useBurst = burstNext; burstNext = false;
    (useBurst ? burst : crossfade)(function () {
      var shlSlide = s.type === 'streams' || s.type === 'stand';
      var mm = meeting.mode !== 'off' && (s.type === 'slogan' || s.type === 'welcome' || s.type === 'soon' || s.type === 'meeting');
      slidesEl.innerHTML = '<div class="slide pre' + (shlSlide ? ' shl' + (s.comp === 'women' ? ' women' : '') : '') + (mm ? ' mm' : '') + (s.type === 'soon' ? ' soonl' : '') + (themeKey(s.type) ? ' th-' + themeKey(s.type) : '') + (s.type === 'soon' || s.type === 'meeting' ? ' lowlogo' : '') + '">' + html + '</div>';
      stage.className = 'stage' + (shlSlide || s.type === 'logo' ? ' noclock' : '') + (mm ? ' mm' : '') + (themeKey(s.type) ? ' th-' + themeKey(s.type) : '') + (stage.className.indexOf(' inv') >= 0 ? ' inv' : '');
      dots(slides.length, idx);
      startPillars();
      if (s.type === 'platforms') startPlatScroll(SLIDE_MS.platforms - 4000);
      if (s.type === 'instagram') setTimeout(playIgVideos, 300);
      clearInterval(cdTimer); if (s.type === 'countdown') startCountdown();
      clearInterval(soonTimer); clearTimeout(soonOnce); if (s.type === 'soon') startSoon();
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

  // the minutes until the rain count down on the screen's own clock, once a minute
  setInterval(function () {
    var w = document.getElementById('wrain'), m = document.getElementById('wmini');
    if (w) { var t = rainTxt(false); if (t) w.innerHTML = esc(t); else w.style.display = 'none'; }
    if (m) m.innerHTML = miniWeather();
  }, 60000);

  // a fresh start now and then keeps a screen that runs for weeks tidy
  setTimeout(function () { location.reload(); }, 12 * 3600000);
})();
