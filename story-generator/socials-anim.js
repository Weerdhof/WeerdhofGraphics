/* ByTomorrow Socials: animation ("Animeer" in the export step, like the SHL editor).
   The finished design is rendered once as separate transparent layers (background, photo, pills, title, tag,
   LIVE OP capsule, sport icon, logo). A canvas then composes them over time: the pill-shaped elements (the
   competition and date pills, the pillar label, the LIVE OP capsule) first travel to their place as a circle and
   then stretch into their bar; the sport icon slides in as the circle it is; the title, photo and logo fade and
   slide in horizontally. The same canvas is
   previewed on the stage and recorded to video (MP4 when the browser can, WebM otherwise). The PNG export is
   not touched. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DUR = 5000;                         // one pass in ms (the preview loops it, the video is one pass)
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
    const tag = P.tag.firstElementChild;
    return { photo: rel(P.photo), live: rel(P.live), icon: rel(P.icon), pills: Array.from(P.pills.children).map(rel), tag: tag ? rel(tag) : null };
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
    // the colour of each pill at its left edge: that is the colour of its circle
    const col = (img, r) => { const d = img.getContext('2d').getImageData(Math.round(r.x + 2), Math.round(r.y + r.h / 2), 1, 1).data; return `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`; };
    geo.pills.forEach(r => { r.col = col(L.pills, r); });
    if (geo.tag) geo.tag.col = col(L.tag, geo.tag);
    geo.live.col = col(L.live, geo.live);
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

  // a pill-shaped element: first a circle that travels in from the side to the place of the element, then it
  // stretches (left anchored) into its bar; the layer is only visible inside that shape, so the content comes out
  // of the circle. `outline` is for the label, which is a ring and not a filled pill.
  function morph(ctx, img, r, ms, start, o) {
    const mv = outCubic(seg(ms, start, 500)); if (mv <= 0) return;
    const str = inOutCubic(seg(ms, start + 650, 650));
    if (str <= 0) {
      const x = lerp(-r.h * 1.3, r.x, mv), cy = r.y + r.h / 2;
      ctx.save(); ctx.beginPath(); ctx.arc(x + r.h / 2, cy, r.h / 2 - (o.outline ? 1.5 : 0), 0, Math.PI * 2);
      if (o.outline) { ctx.strokeStyle = r.col; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.fillStyle = r.col; ctx.fill(); }
      ctx.restore(); return;
    }
    const w = lerp(r.h, r.w, str), pd = o.pad || 0;
    ctx.save(); ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(r.x - pd, r.y - pd, w + pd * 2, r.h + pd * 2, (r.h + pd * 2) / 2); else ctx.rect(r.x - pd, r.y - pd, w + pd * 2, r.h + pd * 2);
    ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
  }

  function draw(ctx, ms) {
    const A = layers, { L, geo } = A;
    ctx.clearRect(0, 0, A.w, A.h);
    ctx.drawImage(L.bg, 0, 0);

    // competition and date pills (one after the other)
    geo.pills.forEach((r, i) => morph(ctx, L.pills, r, ms, 200 + 120 * i, { pad: 2 }));
    slideIn(ctx, L.title, ms, 1000, 700, 110);
    if (geo.tag) morph(ctx, L.tag, geo.tag, ms, 1200, { pad: 3, outline: true });

    // photo: a horizontal wipe from the left
    const pp = inOutCubic(seg(ms, 1300, 800));
    if (pp > 0) {
      const ph = geo.photo;
      ctx.save(); ctx.beginPath(); ctx.rect(0, ph.y - 2, A.w * pp, ph.h + 4); ctx.clip();
      ctx.drawImage(L.photo, 0, 0); ctx.restore();
    }

    // LIVE OP capsule, wide padding so its shadow is not cut off
    morph(ctx, L.live, geo.live, ms, 2000, { pad: 36 });

    // the sport icon sits in a circle: it slides in from the right
    const ip = outCubic(seg(ms, 2200, 600));
    if (ip > 0) { ctx.save(); ctx.translate((1 - ip) * (A.w - geo.icon.x + 20), 0); ctx.drawImage(L.icon, 0, 0); ctx.restore(); }

    const gp = seg(ms, 3000, 500);
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
    box.innerHTML = `<label class="upcoming-toggle byt-anim-toggle"><input type="checkbox" id="bytAnimToggle"${on ? ' checked' : ''}> Animeer (rondjes worden balken)</label>
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
