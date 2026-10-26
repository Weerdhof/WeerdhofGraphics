/* ByTomorrow Socials: animation ("Animeer" in the export step, like the SHL editor).
   The finished design is rendered once as separate transparent layers (background, photo, pills, title, tag,
   LIVE OP capsule, sport icon, logo). A canvas then composes them over time: circles pop in, stretch into
   horizontal bars in the title colour, and the bars invert (to the background colour) from left to right so the
   text only shows afterwards. The same canvas is previewed on the stage and recorded to video (MP4 when the
   browser can, WebM otherwise). The PNG export is not touched. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DUR = 5200;                         // one pass in ms (the preview loops it, the video is one pass)
  const SUPPORTED = ['wedstrijd'];          // assets that have an animation

  let on = false, layers = null, buildTimer = 0, building = false, again = false;
  let raf = 0, t0 = 0, recording = false, canvas = null;

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (ms, start, dur) => clamp((ms - start) / dur);
  const outCubic = (p) => 1 - Math.pow(1 - p, 3);
  const inOutCubic = (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const lerp = (a, b, p) => a + (b - a) * p;
  const B = () => window.BYT;

  // ---------- layers ----------
  const LAYERS = ['bg', 'photo', 'pills', 'title', 'tag', 'live', 'icon', 'logo'];

  // the elements of one wedstrijd template, by their place in the handoff markup
  function parts(frame) {
    const root = frame.firstElementChild;
    const kids = Array.from(root.children).filter(e => e.tagName !== 'STYLE');
    const top = kids[1];
    return { root, photo: kids[0], pills: top.children[0], title: top.children[1], tag: top.children[2], live: kids[2], icon: kids[3], logo: kids[4] };
  }

  function bars(frame, k) {
    const P = parts(frame), fr = frame.getBoundingClientRect();
    const rel = (r) => ({ x: (r.left - fr.left) / k, y: (r.top - fr.top) / k, w: r.width / k, h: r.height / k });
    const out = [];
    Array.from(P.pills.children).forEach(el => out.push(Object.assign(rel(el.getBoundingClientRect()), { kind: 'pill' })));
    // one bar per line of the title: the width of the text, the height of the line
    const blocks = P.title.querySelector('div') ? Array.from(P.title.children) : [P.title];
    blocks.forEach(el => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height / k;
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter(r => r.width > 2).map(rel).sort((a, b) => a.y - b.y);
      const lines = [];
      rects.forEach(r => {
        const cy = r.y + r.h / 2, l = lines.find(x => Math.abs(x.cy - cy) < lh * .45);
        if (l) { l.x0 = Math.min(l.x0, r.x); l.x1 = Math.max(l.x1, r.x + r.w); } else lines.push({ cy, x0: r.x, x1: r.x + r.w });
      });
      lines.forEach(l => out.push({ kind: 'line', x: l.x0 - 8, w: l.x1 - l.x0 + 16, y: l.cy - (lh - 8) / 2, h: lh - 8, lh }));
    });
    const tag = P.tag.firstElementChild; if (tag && tag.textContent.trim()) out.push(Object.assign(rel(tag.getBoundingClientRect()), { kind: 'tag' }));
    return { list: out, photo: rel(P.photo.getBoundingClientRect()), live: rel(P.live.getBoundingClientRect()), icon: rel(P.icon.getBoundingClientRect()) };
  }

  async function build() {
    const b = B(), t = b.state.t, frame = b.frameEl();
    const P = parts(frame), cs = getComputedStyle(frame);
    const colors = { bg: cs.getPropertyValue('--bg').trim() || '#FC06E5', bar: cs.getPropertyValue('--title').trim() || '#060228' };
    const geo = bars(frame, b.state.scale || 1);
    LAYERS.forEach(id => { if (P[id]) P[id].setAttribute('data-al', id); });
    let imgs;
    try {
      imgs = await Promise.all(LAYERS.map(id => b.renderCanvas(t, (clone) => {
        const r = clone.firstElementChild;
        r.querySelectorAll('*').forEach(e => { e.style.visibility = 'hidden'; });
        if (id !== 'bg') {
          r.style.background = 'transparent';
          const el = clone.querySelector('[data-al="' + id + '"]');
          if (el) { el.style.visibility = 'visible'; el.querySelectorAll('*').forEach(e => { e.style.visibility = 'visible'; }); }
        }
      })));
    } finally { LAYERS.forEach(id => { if (P[id]) P[id].removeAttribute('data-al'); }); }
    const L = {}; LAYERS.forEach((id, i) => { L[id] = imgs[i]; });
    return { tid: t.id, w: t.w, h: t.h, L, geo, colors };
  }

  async function rebuild() {
    if (!on) return;
    if (building) { again = true; return; }
    building = true; setStatus('Animatie voorbereiden…'); const mp = $('bytMp4'); if (mp) mp.disabled = true;
    try {
      const next = await build();
      layers = next; showCanvas(true);
      setStatus('');
    } catch (e) { console.error(e); setStatus('Animatie voorbereiden mislukt'); }
    building = false; { const mp = $('bytMp4'); if (mp && !recording) mp.disabled = false; }
    if (again) { again = false; rebuild(); }
  }

  // ---------- drawing one moment ----------
  function pillPath(ctx, x, y, w, h) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, h / 2) : ctx.rect(x, y, w, h); }

  function draw(ctx, ms) {
    const A = layers, { L, geo, colors } = A;
    ctx.clearRect(0, 0, A.w, A.h);
    ctx.drawImage(L.bg, 0, 0);

    // photo wipes up from the bottom
    const pp = inOutCubic(seg(ms, 1700, 850));
    if (pp > 0) {
      const ph = geo.photo;
      ctx.save(); ctx.beginPath(); ctx.rect(0, ph.y + ph.h * (1 - pp), A.w, ph.h * pp + 2); ctx.clip();
      ctx.drawImage(L.photo, 0, 0); ctx.restore();
    }

    // bars: circle pops in, stretches to a bar, then inverts left to right; the text appears behind the edge
    const st = geo.list.map((b, i) => ({
      b, pop: outCubic(seg(ms, 150 + 90 * i, 380)), str: inOutCubic(seg(ms, 650 + 110 * i, 700)), rev: inOutCubic(seg(ms, 1550 + 130 * i, 650)),
    }));
    // revealed text: each layer drawn through the revealed part of the bars that sit on it
    ['pills', 'title', 'tag'].forEach(layer => {
      ctx.save(); ctx.beginPath(); let any = false;
      st.forEach(s => {
        const b = s.b, isTag = b.kind === 'tag' && layer === 'tag', isPill = b.kind === 'pill' && layer === 'pills', isLine = b.kind === 'line' && layer === 'title';
        if (!(isTag || isPill || isLine) || s.rev <= 0) return;
        const padY = b.kind === 'line' ? (b.lh - b.h) / 2 + 6 : 3;
        ctx.rect(b.x - 4, b.y - padY, (b.w + 8) * s.rev, b.h + padY * 2); any = true;
      });
      if (any) { ctx.clip(); ctx.drawImage(L[layer], 0, 0); }
      ctx.restore();
    });
    // the bars themselves (the part right of the inversion edge is still there)
    ctx.fillStyle = colors.bar;
    st.forEach(s => {
      const b = s.b; if (s.pop <= 0 || s.rev >= 1) return;
      const d = b.h * s.pop, w = lerp(d, b.w, s.str), cx = b.x + b.h / 2, cy = b.y + b.h / 2;
      const x = s.str > 0 ? b.x : cx - d / 2, y = cy - d / 2;
      ctx.save();
      if (s.rev > 0) { ctx.beginPath(); ctx.rect(b.x + b.w * s.rev, b.y - 40, b.w + 80, b.h + 80); ctx.clip(); }
      pillPath(ctx, x, y, s.str > 0 ? w : d, d); ctx.fill(); ctx.restore();
    });

    // LIVE OP capsule grows out of a dot, the sport icon pops, the logo fades in
    const lp = inOutCubic(seg(ms, 2500, 650));
    if (lp > 0) {
      const c = geo.live, pad = 36;
      ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(c.x - pad, c.y - pad, lerp(c.h + pad * 2, c.w + pad * 2, lp), c.h + pad * 2, (c.h + pad * 2) / 2) : ctx.rect(c.x - pad, c.y - pad, c.w + pad * 2, c.h + pad * 2);
      ctx.clip(); ctx.drawImage(L.live, 0, 0); ctx.restore();
    }
    const ip = outCubic(seg(ms, 2350, 450));
    if (ip > 0) {
      const c = geo.icon, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(ip, ip); ctx.translate(-cx, -cy); ctx.globalAlpha = clamp(ip * 2); ctx.drawImage(L.icon, 0, 0); ctx.restore();
    }
    const gp = seg(ms, 3000, 450);
    if (gp > 0) { ctx.save(); ctx.globalAlpha = outCubic(gp); ctx.drawImage(L.logo, 0, 0); ctx.restore(); }
  }

  // ---------- preview ----------
  function ensureCanvas() {
    const scaler = $('bytScale'); if (!scaler) return null;
    if (!canvas || !canvas.isConnected) {
      canvas = document.createElement('canvas'); canvas.id = 'bytAnimCanvas'; canvas.className = 'byt-anim-canvas';
      scaler.appendChild(canvas);
    }
    return canvas;
  }
  function showCanvas(show) {
    const c = ensureCanvas(); if (!c) return;
    if (show && layers && layers.tid === B().state.t.id) {
      if (c.width !== layers.w || c.height !== layers.h) { c.width = layers.w; c.height = layers.h; }
      document.body.classList.add('byt-animating'); start();
    } else { document.body.classList.remove('byt-animating'); stop(); }
  }
  function frame(ts) {
    if (!on || !layers || recording) return;
    const ms = (ts - t0) % (DUR + 600);               // a short pause on the finished design before it loops
    draw(canvas.getContext('2d'), Math.min(ms, DUR));
    raf = requestAnimationFrame(frame);
  }
  function start() { stop(); t0 = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // ---------- recording ----------
  async function record() {
    const b = B(), btn = $('bytMp4');
    if (!layers) return;
    stop(); recording = true; btn.disabled = true; setStatus('Bezig met opnemen…');
    try {
      let mime = 'video/mp4;codecs=avc1';
      if (!(window.MediaRecorder && MediaRecorder.isTypeSupported(mime))) mime = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
      const c = ensureCanvas(), ctx = c.getContext('2d');
      const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 12000000 });
      const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise(res => { rec.onstop = res; });
      const s = performance.now(); rec.start();
      await new Promise(res => { const loop = () => { const ms = performance.now() - s; draw(ctx, Math.min(ms, DUR)); if (ms < DUR + 500) requestAnimationFrame(loop); else res(); }; requestAnimationFrame(loop); });
      rec.stop(); await stopped;
      const blob = new Blob(chunks, { type: mime }), ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = b.fileName().replace(/\.png$/, '-animatie.' + ext);
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus('✓ Video gedownload (' + ext.toUpperCase() + ')');
    } catch (e) { console.error(e); setStatus('Opname mislukt, probeer het opnieuw.'); }
    recording = false; btn.disabled = false; if (on) start();
  }

  function setStatus(s) { const el = $('bytAnimStatus'); if (el) { el.textContent = s; el.hidden = !s; } }

  // ---------- hooks used by socials.js ----------
  function mount(box) {
    if (!box) return;
    const asset = B().state.asset;
    if (!SUPPORTED.includes(asset)) { box.innerHTML = ''; return; }
    box.innerHTML = `<label class="upcoming-toggle byt-anim-toggle"><input type="checkbox" id="bytAnimToggle"${on ? ' checked' : ''}> Animeer (rondjes → balken)</label>
      <button class="btn btn-primary" id="bytMp4" type="button"${on ? '' : ' hidden'}>Download MP4</button>
      <p class="save-status" id="bytAnimStatus" hidden></p>`;
    $('bytAnimToggle').addEventListener('change', (e) => {
      on = e.target.checked; $('bytMp4').hidden = !on;
      if (on) rebuild(); else { document.body.classList.remove('byt-animating'); stop(); setStatus(''); }
    });
    $('bytMp4').addEventListener('click', record);
  }
  function changed() {
    if (!on) return;
    clearTimeout(buildTimer);
    if (layers && layers.tid !== B().state.t.id) { layers = null; showCanvas(false); }
    buildTimer = setTimeout(rebuild, 450);
  }
  function reset() {
    on = false; layers = null; clearTimeout(buildTimer); stop();
    document.body.classList.remove('byt-animating'); setStatus('');
  }

  window.BYT_ANIM = { mount, changed, reset, draw: (ctx, ms) => layers && draw(ctx, ms), get layers() { return layers; }, DUR };
})();
