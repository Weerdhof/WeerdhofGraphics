// The Home dashboard's top bar (today's date) and the KPI row. Self-contained: it only reads
// /api/narrowcasting-matches, /api/narrowcasting and /api/exports and shows a dash where a source is not available.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function date() { const el = $('dashDate'); if (el) { const t = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }); el.textContent = t.charAt(0).toUpperCase() + t.slice(1); } }
  const get = (u) => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  async function kpis() {
    const now = new Date(), today = ymd(now), end = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
    const [m, n, e] = await Promise.all([get('/api/narrowcasting-matches'), get('/api/narrowcasting'), get('/api/exports')]);
    if (m && m.matches) {
      const list = m.matches, td = list.filter(x => x.date === today), wk = list.filter(x => x.date >= today && x.date <= end);
      set('kpiToday', String(td.length)); const comps = {}; td.forEach(x => { comps[x.comp] = 1; }); set('kpiTodayS', td.length ? `bij ${Object.keys(comps).length} klant${Object.keys(comps).length === 1 ? '' : 'en'}` : 'niets gepland');
      set('kpiWeek', String(wk.length));
    }
    if (n && n.items) { const it = n.items.filter(x => (x.endDate || x.date) >= today && x.date <= end); set('kpiScreen', String(it.length)); set('kpiScreenS', `${it.filter(x => (x.pillars || []).indexOf('jump') >= 0).length} livestreams, ${it.filter(x => (x.pillars || []).indexOf('productie') >= 0).length} producties`); }
    if (e && e.exports) set('kpiExports', String(e.exports.length));
  }

  // Example image on every asset card (static files in assets/dash, made from the real templates).
  // Cards keep their own markup and click handlers; the image is only added on top.
  const EX_TH = { shl: 'th_shl', shlw: 'th_shlw', nextmen: 'th_nextmen', nextwomen: 'th_nextwomen', lvlm: 'th_lvlm', lvlw: 'th_lvlw', lvlmail: 'mail_lvlmail', lvlwatch: 'mail_lvlwatch',
    shlmail: 'mail_shlmail', shlrank: 'mail_shlrank', shlh2h: 'mail_shlh2h', potm: 'potm' };
  const EX_HNL = { announce: 'hnl_announce', nextmen: 'hnl_nextmen', nextwomen: 'hnl_nextwomen' };
  const comp = () => { const h = $('homeMenu'); return h && h.classList.contains('theme-women') ? 'women' : 'men'; };
  function exampleOf(card) {
    const d = card.dataset;
    if (d.goMode) return d.goMode === 'announcement' ? { men: 'men_announcement', women: 'men_announcement' } : { men: 'men_' + d.goMode, women: 'women_' + d.goMode };
    const k = d.goTh ? EX_TH[d.goTh] : d.goHnl ? EX_HNL[d.goHnl] : '';
    return k ? { men: k, women: k } : null;
  }
  function thumbs() {
    document.querySelectorAll('#homeMenu .menu-card').forEach(card => {
      if (card.querySelector('.menu-thumb')) return;
      const ex = exampleOf(card); if (!ex) return;
      const box = document.createElement('span'), img = new Image();
      box.className = 'menu-thumb'; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.onload = () => box.classList.add('ready'); img.onerror = () => box.classList.add('fail');
      box.appendChild(img); card.insertBefore(box, card.firstChild); card._ex = ex; card._img = img;
    });
    paint();
  }
  function paint() {
    const c = comp();
    document.querySelectorAll('#homeMenu .menu-card').forEach(card => {
      if (!card._ex) return; const src = 'assets/dash/' + card._ex[c] + '.webp';
      if (card._img.getAttribute('src') !== src) { card._img.parentNode.classList.remove('ready', 'fail'); card._img.src = src; }
    });
  }
  thumbs();
  const hm = $('homeMenu'); if (hm && window.MutationObserver) new MutationObserver(paint).observe(hm, { attributes: true, attributeFilter: ['class'] });
  date(); kpis();
  setInterval(() => { if (document.getElementById('homeMenu') && document.getElementById('homeMenu').classList.contains('theme-dash') && !document.hidden) { date(); kpis(); } }, 60000);
})();
