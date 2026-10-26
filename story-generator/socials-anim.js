/* ByTomorrow Socials: animation ("Animeer" in the export step, like the SHL editor).
   The finished design is rendered once as separate transparent layers (background, photo, pills, title, tag,
   LIVE OP capsule, sport icon, logo). A canvas then composes them over time: the elements that sit in a circle
   (the sport icon) pop in as a circle, everything else fades in and slides in horizontally. The same canvas is
   previewed on the stage and recorded to video (MP4 when the browser can, WebM otherwise). The PNG export is
   not touched. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DUR = 4200;                         // one pass in ms (the preview loops it, the video is one pass)
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

  function rects(frame, k) {
    const P = parts(frame), fr = frame.getBoundingClientRect();
    const rel = (e) => { const r = e.getBoundingClientRect(); return { x: (r.left - fr.left) / k, y: (r.top - fr.top) / k, w: r.width / k, h: r.height / k }; };
    return { photo: rel(P.photo), live: rel(P.live), icon: rel(P.icon) };
  }

  async function build() {
    const b = B(), t = b.state.t, frame = b.frameEl();
    const P = parts(frame);
        const geo = rects(frame, b.state.scale || 1);
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
    return { tid: t.id, w: t.w, h: t.h, L, geo };
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
  // fade in while sliding in from the left
  function slideIn(ctx, img, ms, start, dur, dist) {
    const p = outCubic(seg(ms, start, dur)); if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = p; ctx.translate(-(1 - p) * dist, 0); ctx.drawImage(img, 0, 0); ctx.restore();
  }

  function draw(ctx, ms) {
    const A = layers, { L, geo } = A;
    ctx.clearRect(0, 0, A.w, A.h);
    ctx.drawImage(L.bg, 0, 0);

    slideIn(ctx, L.pills, ms, 200, 650, 90);
    slideIn(ctx, L.title, ms, 400, 700, 110);
    slideIn(ctx, L.tag, ms, 650, 650, 90);

    // photo: a horizontal wipe from the left
    const pp = inOutCubic(seg(ms, 800, 800));
    if (pp > 0) {
      const ph = geo.photo;
      ctx.save(); ctx.beginPath(); ctx.rect(0, ph.y - 2, A.w * pp, ph.h + 4); ctx.clip();
      ctx.drawImage(L.photo, 0, 0); ctx.restore();
    }

    slideIn(ctx, L.live, ms, 1500, 600, 90);

    // the sport icon sits in a circle: the circle pops in
    const ip = outCubic(seg(ms, 1700, 450));
    if (ip > 0) {
      const c = geo.icon, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(ip, ip); ctx.translate(-cx, -cy); ctx.drawImage(L.icon, 0, 0); ctx.restore();
    }

    const gp = seg(ms, 2200, 500);
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
    box.innerHTML = `<label class="upcoming-toggle byt-anim-toggle"><input type="checkbox" id="bytAnimToggle"${on ? ' checked' : ''}> Animeer (rondje + fade)</label>
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
