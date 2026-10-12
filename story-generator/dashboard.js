// Home dashboard: standings, latest results and the programme of the SHL (men) and SHLW (women),
// plus shortcuts to every asset. Data comes from the server's site-data store.
(() => {
  'use strict';
  const S = window.SETTINGS, DEF = S.DEF;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const COMPS = {
    men: { key: 'men', short: 'SHL', title: 'Super Handball League', accent: '#caff1c', clubs: DEF.men, aliases: DEF.aliases.men, strip: 'assets/teams' },
    women: { key: 'women', short: 'SHLW', title: 'Super Handball League Women', accent: '#e353fc', clubs: DEF.women, aliases: DEF.aliases.women },
  };
  const codeOf = (c, name) => { const n = norm(name); return Object.keys(c.aliases).find(k => c.aliases[k].some(a => n.includes(a))) || null; };
  const labelOf = (c, code) => S.label(`${c.key}:${code}`, (c.clubs.find(x => x[0] === code) || [0, code])[1]);
  function seasonDate(day, month) { const now = new Date(), st = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1; return new Date(month >= 8 ? st : st + 1, month - 1, day); }
  const dateLabel = (m) => { const d = seasonDate(m.day, m.month); return `${DAYS[d.getDay()]} ${m.day} ${MONTHS[m.month - 1]}`; };

  // small crest: men = the crest of the team strip, women = the club logo jpg (both overridable in the settings)
  function crest(c, code) {
    if (!code) return '<span class="dash-crest"></span>';
    const key = `${c.key}:${code}`;
    if (S.hasLogo(key)) return `<span class="dash-crest" style="background-image:url('${S.logo(key, '')}');background-size:cover"></span>`;
    if (c.key === 'men') return `<span class="dash-crest dash-crest-strip" style="background-image:url('assets/teams/${code}.png')"></span>`;
    const jid = DEF.womenJpg[code]; const src = S.logo('hnl:' + jid, `assets/hnl/clubs/${jid}.jpg`);
    return `<span class="dash-crest" style="background-image:url('${src}');background-size:cover"></span>`;
  }

  const data = { men: null, women: null, sync: null };
  let timer = 0, visible = false;

  async function fetchComp(k) {
    const [st, ov] = await Promise.all([
      fetch(`/api/standings?comp=${k}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/overview?comp=${k}`).then(r => r.json()).catch(() => ({})),
    ]);
    data[k] = { standings: st.standings || [], results: ov.results || [], upcoming: ov.upcoming || [], fetchedAt: ov.fetchedAt || st.fetchedAt, error: (ov.error && st.error) ? ov.error : null };
  }

  function standingsHtml(c, rows) {
    if (!rows.length) return '<p class="dash-empty">Stand niet beschikbaar.</p>';
    const women = c.key === 'women';
    return `<table class="dash-table"><thead><tr><th>#</th><th>Club</th><th>Gs</th><th>W</th><th>G</th><th>V</th>${women ? '<th>DS</th>' : ''}<th>Ptn</th>${women ? '<th class="dash-form-h">Vorm</th>' : ''}</tr></thead><tbody>${rows.map((r, i) => {
      const code = codeOf(c, r.club);
      return `<tr><td class="dash-pos">${i + 1}</td><td class="dash-club">${crest(c, code)}<span>${esc(code ? labelOf(c, code) : r.club)}</span></td><td>${esc(r.played)}</td><td>${esc(r.w ?? '')}</td><td>${esc(r.d ?? '')}</td><td>${esc(r.l ?? '')}</td>${women ? `<td>${esc(r.gd ?? '')}</td>` : ''}<td class="dash-pts">${esc(r.points)}</td>${women ? `<td class="dash-form">${(r.form || []).slice(-5).map(f => `<i class="f-${f}"></i>`).join('')}</td>` : ''}</tr>`;
    }).join('')}</tbody></table>`;
  }

  function matchRow(c, m, kind) {
    const hc = codeOf(c, m.home), ac = codeOf(c, m.away);
    const hn = hc ? labelOf(c, hc) : m.home, an = ac ? labelOf(c, ac) : m.away;
    const mid = kind === 'result' ? `<b class="dash-score">${esc(m.homeScore)} – ${esc(m.awayScore)}</b>` : `<span class="dash-time">${esc(m.time || '–')}</span>`;
    const hw = kind === 'result' && m.homeScore > m.awayScore, aw = kind === 'result' && m.awayScore > m.homeScore;
    const tip = kind === 'result' ? 'Maak de uitslag-visual van deze wedstrijd' : 'Maak de aankondiging van deze wedstrijd';
    return `<div class="dash-match dash-match-go" role="button" tabindex="0" title="${tip}" data-mc="${c.key}" data-mk="${kind}" data-mh="${esc(m.home)}" data-ma="${esc(m.away)}" data-md="${esc(m.day)}" data-mm="${esc(m.month)}"><span class="dash-home${hw ? ' win' : ''}"><span>${esc(hn)}</span>${crest(c, hc)}</span>${mid}<span class="dash-away${aw ? ' win' : ''}">${crest(c, ac)}<span>${esc(an)}</span></span></div>`;
  }
  function groupBy(list, limitGroups, limitRows) {
    const groups = [];
    list.forEach(m => { const k = m.month * 100 + m.day; let g = groups.find(x => x.k === k); if (!g) { if (groups.length >= limitGroups) return; g = { k, m, items: [] }; groups.push(g); } if (g.items.length < limitRows) g.items.push(m); });
    return groups;
  }

  const GO = {
    men: [['results', '🏆', 'Results'], ['schedule', '📅', 'Schedule'], ['match', '⚡', 'Match'], ['matchresult', '🎯', 'Matchresult'], ['prediction', '🔮', 'Prediction'], ['headtohead', '🆚', 'Head to head'], ['nowlive', '🔴', 'Now live'], ['topscorer', '🥅', 'Top scorer'], ['playerweek', '⭐', 'Speler van de week'], ['ranking', '📈', 'Ranking']],
    women: [['results', '🏆', 'Results'], ['schedule', '📅', 'Schedule'], ['match', '⚡', 'Match'], ['matchresult', '🎯', 'Matchresult'], ['prediction', '🔮', 'Prediction'], ['headtohead', '🆚', 'Head to head'], ['topscorer', '🥅', 'Top scorer'], ['playerweek', '⭐', 'Speelster van de week'], ['ranking', '📈', 'Ranking']],
  };
  const chips = (list, prefix) => list.map(([id, icon, label]) => `<button type="button" class="dash-chip" data-dash-go="${prefix}:${id}"><span>${icon}</span>${esc(label)}</button>`).join('');

  function panelHtml(c) {
    const d = data[c.key];
    if (!d) return `<section class="dash-panel" style="--acc:${c.accent}"><header class="dash-head"><h2>${c.short}</h2><small>${c.title}</small></header><p class="dash-empty">Laden…</p></section>`;
    const results = d.results.slice().sort((a, b) => b.ord - a.ord || (b.time || '').localeCompare(a.time || ''));
    const upcoming = d.upcoming.slice().sort((a, b) => a.ord - b.ord || (a.time || '').localeCompare(b.time || ''));
    const rg = groupBy(results, 2, 8), nextDay = upcoming.length ? upcoming.filter(m => m.ord === upcoming[0].ord) : [];
    const lead = d.standings[0], leadCode = lead ? codeOf(c, lead.club) : null;
    const st = data.sync && data.sync.status && data.sync.status[c.key];
    const when = (st && st.checkedAt) ? new Date(st.checkedAt * 1000).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : '';
    const kpis = `<div class="dash-kpis">
      <div><span>Volgende speeldag</span><b>${nextDay.length ? esc(dateLabel(nextDay[0])) : '–'}</b><small>${nextDay.length} wedstrijd${nextDay.length === 1 ? '' : 'en'}</small></div>
      <div><span>Koploper</span><b>${lead ? esc(leadCode ? labelOf(c, leadCode) : lead.club) : '–'}</b><small>${lead ? esc(lead.points) + ' ptn uit ' + esc(lead.played) : ''}</small></div>
      <div><span>Gespeeld</span><b>${results.length}</b><small>wedstrijden dit seizoen</small></div>
    </div>`;
    return `<section class="dash-panel" style="--acc:${c.accent}">
      <header class="dash-head"><h2>${c.short}</h2><small>${c.title}</small><span class="dash-sync">${when ? 'gecontroleerd ' + when : ''}</span></header>
      <div class="dash-block"><h3>Laatste uitslagen</h3>${rg.length ? rg.map(g => `<div class="dash-day">${esc(dateLabel(g.m))}${g.m.round ? ' · ronde ' + esc(g.m.round) : ''}</div>${g.items.map(m => matchRow(c, m, 'result')).join('')}`).join('') : '<p class="dash-empty">Nog geen uitslagen.</p>'}</div>
      <div class="dash-block"><h3>Programma</h3>${upcoming.length ? groupBy(upcoming, 2, 8).map(g => `<div class="dash-day">${esc(dateLabel(g.m))}${g.m.round ? ' · ronde ' + esc(g.m.round) : ''}</div>${g.items.map(m => matchRow(c, m, 'upcoming')).join('')}`).join('') : '<p class="dash-empty">Geen wedstrijden gepland.</p>'}</div>
      ${kpis}
      <div class="dash-block"><h3>Stand</h3>${standingsHtml(c, d.standings)}</div>
      <div class="dash-block dash-go"><h3>Maak een visual</h3><div class="dash-chips">${chips(GO[c.key], c.key)}</div></div>
    </section>`;
  }

  function render() {
    const box = $('dashPanels'); if (!box) return;
    buildFeatured(false);
    box.innerHTML = panelHtml(COMPS.men) + panelHtml(COMPS.women);
    const more = $('dashMore');
    if (more && !more.dataset.built) {
      more.dataset.built = '1';
      more.innerHTML = `<div class="dash-more-col"><h3>HandbalNL</h3><div class="dash-chips">${chips([['announce', '📣', 'Aankondiging'], ['nextmen', '⚡', 'Next heren'], ['nextwomen', '⚡', 'Next dames']], 'hnl')}</div></div>
        <div class="dash-more-col"><h3>Thumbnails</h3><div class="dash-chips">${chips([['shl', '🖼️', 'SHL'], ['shlw', '🖼️', 'SHLW'], ['nextmen', '🖼️', 'Next heren'], ['nextwomen', '🖼️', 'Next dames']], 'th')}</div></div>`;
    }
  }


  // ---------- Uitgelicht: the weekly planning, each asset with a live preview (rendered on the server with the real data) ----------
  // The planning per weekday lives in the settings (default: your weekly planning); two assets per day, for men and women.
  const TITLES = { results: 'Uitslagen', schedule: 'Schedule', ranking: 'Stand', match: 'Wedstrijdaankondiging', matchresult: 'Uitslag los', prediction: 'Prediction', headtohead: 'Head to head', playerweek: 'Speler / speelster van de week', topscorer: 'Top scorer' };
  const DOW_KEY = { 0: 'zo', 1: 'ma', 2: 'di', 3: 'wo', 4: 'dovr', 5: 'dovr', 6: 'za' };
  // the planning comes from the server (/api/plan): learned from what is used on this weekday, completed with the fixed planning
  let planInfo = null;
  const todaySlots = () => {
    const key = DOW_KEY[new Date().getDay()], list = planInfo && planInfo.plan && planInfo.plan[key];
    if (list && list.length) return list.map(p => ({ asset: p.asset, fmt: p.format, source: p.source }));
    return ((S.dash().plan[key]) || []).map(([asset, fmt]) => ({ asset, fmt: fmt || 'story', source: 'fixed' }));
  };
  const todayItems = () => todaySlots().map(({ asset, fmt }) => [asset, fmt, TITLES[asset] || asset]);
  const planSig = () => JSON.stringify(todaySlots());
  let usage = null;
  const whenText = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000), tz = 'Europe/Amsterdam', clock = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    const dayOf = (x) => x.toLocaleDateString('nl-NL', { timeZone: tz }), now = new Date();
    if (dayOf(d) === dayOf(now)) return 'vandaag ' + clock;
    if (dayOf(d) === dayOf(new Date(now - 864e5))) return 'gisteren ' + clock;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: tz }) + ' ' + clock;
  };
  function usageLine(comp, asset, fmt) {
    const u = usage && usage.last && usage.last[`${comp}:${asset}:${fmt}`];
    if (!u) return 'nog niet gebruikt';
    const parts = [];
    if (u.export) parts.push('geëxporteerd ' + whenText(u.export));
    else if (u.open) parts.push('geopend ' + whenText(u.open));
    return 'laatst ' + parts.join('');
  }
  function featuredHtml() {
    const cards = todaySlots().map(({ asset, fmt, source }) => [asset, fmt, TITLES[asset] || asset, source]).map(([asset, fmt, title, source]) => ['men', 'women'].map(comp => {
      const c = COMPS[comp], q = `asset=${asset}&comp=${comp}&format=${fmt}`;
      return `<button type="button" class="feat-card feat-${comp}" style="--acc:${c.accent}" data-dash-go="${comp}:${asset}:${fmt}">
        <span class="feat-img feat-${fmt}"><img loading="lazy" alt="" src="/api/preview?${q}" onload="this.classList.add('ready');this.parentNode.classList.add('loaded')" onerror="this.parentNode.classList.add('feat-fail')"><span class="feat-spin"></span></span>
        <span class="feat-cap"><span class="feat-pill">${comp === 'men' ? 'Mannen' : 'Vrouwen'}</span><b>${esc(title)}</b><span>${fmt === 'post' ? 'Post' : 'Story'}${source === 'usage' ? ' · <span class="feat-learned" title="Staat hier omdat je dit vaak op deze dag gebruikt">★ jouw gebruik</span>' : ''}</span><small data-usage="${comp}:${asset}:${fmt}">${esc(usageLine(comp, asset, fmt))}</small></span>
      </button>`;
    }).join('')).join('');
    return `<div class="feat-cards">${cards}</div>`;
  }
  let settingsReady = false;   // the planning comes from the settings: do not build (and fetch previews) before they have loaded
  // build the cards once the settings AND the planning are known (but do not wait longer than 2 s for the server)
  const planFetched = fetch('/api/plan').then(r => r.json()).then(j => { planInfo = j; }).catch(() => {});
  Promise.all([S.ready, Promise.race([planFetched, new Promise(r => setTimeout(r, 2000))])]).then(() => { settingsReady = true; buildFeatured(true); });
  function buildFeatured(force) {
    const box = $('dashFeatured'); if (!box || !settingsReady) return;
    if (!force && box.dataset.built) return;
    box.dataset.built = '1'; box.dataset.sig = planSig(); box.innerHTML = featuredHtml();
    const hint = document.getElementById('dashFeatHint');
    if (hint) {
      const n = todaySlots().filter(x => x.source === 'usage').length;
      hint.textContent = planInfo && planInfo.mode === 'auto'
        ? (n ? `Je planning voor vandaag, met de actuele uitslagen en stand al ingevuld. ${n === todaySlots().length ? 'Dit is wat' : n + ' van de ' + todaySlots().length + ' is wat'} je op deze dag het vaakst gebruikt (★)${n === todaySlots().length ? '' : '; de rest komt uit je vaste planning'}.`
              : 'Je planning voor vandaag, met de actuele uitslagen en stand al ingevuld. Zodra je op deze weekdag dezelfde assets vaker gebruikt, past de planning zich vanzelf aan.')
        : 'Je vaste planning voor vandaag, met de actuele uitslagen en stand al ingevuld. Stel hem in bij Instellingen.';
    }
  }
  const photoSeen = {};   // 'comp:asset:format' -> time of the photo change the shown preview already includes
  function updateUsage() {
    document.querySelectorAll('[data-usage]').forEach(el => { const [comp, asset, fmt] = el.dataset.usage.split(':'); el.textContent = usageLine(comp, asset, fmt); });
    // a photo was added, moved or removed in the editor: show a fresh preview
    document.querySelectorAll('.feat-card[data-dash-go]').forEach(card => {
      const [comp, asset, fmt] = card.dataset.dashGo.split(':'), key = card.dataset.dashGo;
      const t = (usage && usage.photo && usage.photo[key]) || 0;
      if (photoSeen[key] === undefined) { photoSeen[key] = t; return; }
      if (t > photoSeen[key]) {
        photoSeen[key] = t;
        const img = card.querySelector('img'); if (!img) return;
        img.parentNode.classList.remove('loaded', 'feat-fail'); img.classList.remove('ready');
        img.src = `/api/preview?asset=${asset}&comp=${comp}&format=${fmt}&v=${t}`;
      }
    });
  }

  async function refresh() {
    await S.ready;
    await Promise.all([fetchComp('men'), fetchComp('women'), fetch('/api/sync-status').then(r => r.json()).then(j => { data.sync = j; }).catch(() => {}), fetch('/api/usage?limit=1').then(r => r.json()).then(j => { usage = j; }).catch(() => {}), fetch('/api/plan').then(r => r.json()).then(j => { planInfo = j; }).catch(() => {})]);
    render(); updateUsage();
    // the learned planning changed (or arrived after the first build): rebuild the cards
    const box = $('dashFeatured'); if (settingsReady && box && box.dataset.built && box.dataset.sig !== planSig()) buildFeatured(true);
  }
  function show() { visible = true; render(); const p = refresh(); clearInterval(timer); timer = setInterval(() => { if (visible) refresh(); }, 60000); return Promise.race([p, new Promise(r => setTimeout(r, 4000))]); }
  function hide() { visible = false; clearInterval(timer); }

  // a match row: open Matchresult (played) or Match (to come) with exactly that match selected
  function openMatch(row) {
    window.DASH_TARGET = { home: row.dataset.mh, away: row.dataset.ma, day: +row.dataset.md, month: +row.dataset.mm };
    const D = S.dash(), result = row.dataset.mk === 'result';
    document.dispatchEvent(new CustomEvent('dash-go', { detail: `${row.dataset.mc}:${result ? 'matchresult' : 'match'}:${result ? D.resultFmt : D.matchFmt}` }));
  }
  document.addEventListener('click', (e) => { const r = e.target.closest('.dash-match-go'); if (r) openMatch(r); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('dash-match-go')) { e.preventDefault(); openMatch(e.target); } });

  // shortcuts: let the navigation code in script.js do the work
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dash-go]'); if (!b) return;
    document.dispatchEvent(new CustomEvent('dash-go', { detail: b.dataset.dashGo }));
  });
  S.onChange((what) => { if (what === 'change') { buildFeatured(true); if (visible) render(); } });
  window.DASH = { show, hide, refresh };
})();
