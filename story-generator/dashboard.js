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
    return `<div class="dash-match"><span class="dash-home${hw ? ' win' : ''}"><span>${esc(hn)}</span>${crest(c, hc)}</span>${mid}<span class="dash-away${aw ? ' win' : ''}">${crest(c, ac)}<span>${esc(an)}</span></span></div>`;
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
      ${kpis}
      <div class="dash-block"><h3>Stand</h3>${standingsHtml(c, d.standings)}</div>
      <div class="dash-block"><h3>Laatste uitslagen</h3>${rg.length ? rg.map(g => `<div class="dash-day">${esc(dateLabel(g.m))}${g.m.round ? ' · ronde ' + esc(g.m.round) : ''}</div>${g.items.map(m => matchRow(c, m, 'result')).join('')}`).join('') : '<p class="dash-empty">Nog geen uitslagen.</p>'}</div>
      <div class="dash-block"><h3>Programma</h3>${upcoming.length ? groupBy(upcoming, 2, 8).map(g => `<div class="dash-day">${esc(dateLabel(g.m))}${g.m.round ? ' · ronde ' + esc(g.m.round) : ''}</div>${g.items.map(m => matchRow(c, m, 'upcoming')).join('')}`).join('') : '<p class="dash-empty">Geen wedstrijden gepland.</p>'}</div>
      <div class="dash-block dash-go"><h3>Maak een visual</h3><div class="dash-chips">${chips(GO[c.key], c.key)}</div></div>
    </section>`;
  }

  function render() {
    const box = $('dashPanels'); if (!box) return;
    box.innerHTML = panelHtml(COMPS.men) + panelHtml(COMPS.women);
    const more = $('dashMore');
    if (more && !more.dataset.built) {
      more.dataset.built = '1';
      more.innerHTML = `<div class="dash-more-col"><h3>HandbalNL</h3><div class="dash-chips">${chips([['announce', '📣', 'Aankondiging'], ['nextmen', '⚡', 'Next heren'], ['nextwomen', '⚡', 'Next dames']], 'hnl')}</div></div>
        <div class="dash-more-col"><h3>Thumbnails</h3><div class="dash-chips">${chips([['shl', '🖼️', 'SHL'], ['shlw', '🖼️', 'SHLW'], ['nextmen', '🖼️', 'Next heren'], ['nextwomen', '🖼️', 'Next dames']], 'th')}</div></div>`;
    }
  }

  async function refresh() {
    await S.ready;
    await Promise.all([fetchComp('men'), fetchComp('women'), fetch('/api/sync-status').then(r => r.json()).then(j => { data.sync = j; }).catch(() => {})]);
    render();
  }
  function show() { visible = true; render(); const p = refresh(); clearInterval(timer); timer = setInterval(() => { if (visible) refresh(); }, 60000); return Promise.race([p, new Promise(r => setTimeout(r, 4000))]); }
  function hide() { visible = false; clearInterval(timer); }

  // shortcuts: let the navigation code in script.js do the work
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dash-go]'); if (!b) return;
    document.dispatchEvent(new CustomEvent('dash-go', { detail: b.dataset.dashGo }));
  });
  S.onChange((what) => { if (what === 'change' && visible) render(); });
  window.DASH = { show, hide, refresh };
})();
