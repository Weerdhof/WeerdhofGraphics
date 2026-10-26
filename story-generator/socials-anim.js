/* ByTomorrow Socials: animation ("Animeer" in the export step, like the SHL editor).
   The finished design is rendered once as separate transparent layers (background, photo, pills, title, tag,
   LIVE OP capsule, sport icon, logo). A canvas then composes them over time: the pill-shaped elements (the
   competition and date pills, the pillar label, the LIVE OP capsule) first travel to their place as a circle,
   stretch into a bar and fade their text in just before it lands; the sport icon slides in as the circle it is; the title slides in horizontally, the photo
   wipes up from the bottom and the ByTomorrow logo is always there. The same canvas is
   previewed on the stage and recorded to video (MP4 when the browser can, WebM otherwise). The PNG export is
   not touched. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DUR = 3900;                         // the movement, in ms
  const CLIP = 15000;                       // the video: the movement, then the finished graphic stays until 15 seconds
  const SUPPORTED = ['wedstrijd'];          // assets that have an animation

  let on = false, layers = null, buildTimer = 0, building = false, again = false;
  let raf = 0, t0 = 0, recording = false, canvas = null;

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const seg = (ms, start, dur) => clamp((ms - start) / dur);
  // speed ramps: a hard start, then a long braking into place
  const outExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
  const inOutExpo = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);
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
    const p = outExpo(seg(ms, start, dur)); if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 2.5); ctx.translate(-(1 - p) * dist, 0); ctx.drawImage(img, 0, 0); ctx.restore();
  }

  // the empty bar of a pill-shaped element, `a` is the weight of its shadow
  function bar(ctx, r, x, w, o, a) {
    ctx.save(); ctx.beginPath();
    if (o.outline) { if (ctx.roundRect) ctx.roundRect(x + 1.5, r.y + 1.5, w - 3, r.h - 3, (r.h - 3) / 2); else ctx.rect(x + 1.5, r.y + 1.5, w - 3, r.h - 3); ctx.strokeStyle = r.col; ctx.lineWidth = 3; ctx.stroke(); }
    else {
      if (o.shadow) { ctx.shadowColor = 'rgba(6,2,40,' + (.22 * a).toFixed(3) + ')'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
      if (ctx.roundRect) ctx.roundRect(x, r.y, w, r.h, r.h / 2); else ctx.rect(x, r.y, w, r.h);
      ctx.fillStyle = r.col; ctx.fill();
    }
    ctx.restore();
  }
  // the element's own part of its layer (a layer can hold several elements), faded in by `p`
  function content(ctx, img, r, p, pad) {
    ctx.save(); ctx.beginPath(); ctx.rect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2); ctx.clip();
    ctx.globalAlpha = p; ctx.drawImage(img, 0, 0); ctx.restore();
  }

  // a pill-shaped element: first a circle that travels in from the side to the place of the element, then it
  // stretches (left anchored) into its bar and its text fades in while the bar lands. `o.pad` is the room around
  // the element that belongs to it (its shadow), `o.outline` is for the label, which is a ring and not a filled pill.
  function morph(ctx, img, r, ms, start, o) {
    const mv = outExpo(seg(ms, start, 600)); if (mv <= 0) return;
    const str = inOutExpo(seg(ms, start + 450, 650)), tx = seg(ms, start + 900, 250);
    if (tx >= 1) { content(ctx, img, r, 1, o.pad); return; }
    bar(ctx, r, str > 0 ? r.x : lerp(-r.h * 1.3, r.x, mv), lerp(r.h, r.w, str), o, 1 - outExpo(tx));
    if (tx > 0) content(ctx, img, r, outExpo(tx), o.pad);
  }

  // the two pills at the top: both circles come out next to each other, then the first one stretches and
  // pushes the second one aside, which then stretches too
  function pillRow(ctx, img, list, ms) {
    const gap = list.length > 1 ? list[1].x - (list[0].x + list[0].w) : 0, W = layers.w;
    let right = null;
    list.forEach((r, i) => {
      const t0 = [150, 450][i] || 450, s0 = [850, 1250][i] || 1250;
      const mv = outExpo(seg(ms, t0, 600)), str = inOutExpo(seg(ms, s0, 650)), tx = seg(ms, s0 + 450, 250), w = lerp(r.h, r.w, str);
      let x;
      if (i === 0) x = str > 0 ? r.x : lerp(-r.h * 1.3, r.x, mv);
      else x = lerp(W + r.h, right + gap, mv);            // the second one arrives from the right, next to the first
      if (mv > 0) {
        if (tx < 1) bar(ctx, r, x, w, {}, 1);
        if (tx > 0) content(ctx, img, r, outExpo(tx), 4);
      }
      right = x + w;
    });
  }

  function draw(ctx, ms) {
    const A = layers, { L, geo } = A;
    ctx.clearRect(0, 0, A.w, A.h);
    ctx.drawImage(L.bg, 0, 0);

    // competition and date pills (one after the other)
    pillRow(ctx, L.pills, geo.pills, ms);
    slideIn(ctx, L.title, ms, 650, 800, 170);
    if (geo.tag) morph(ctx, L.tag, geo.tag, ms, 850, { outline: true, pad: 4 });

    // photo: wipes up from the bottom
    const pp = inOutExpo(seg(ms, 950, 800));
    if (pp > 0) {
      const ph = geo.photo;
      ctx.save(); ctx.beginPath(); ctx.rect(0, ph.y + ph.h * (1 - pp) - 2, A.w, ph.h * pp + 4); ctx.clip();
      ctx.drawImage(L.photo, 0, 0); ctx.restore();
    }

    morph(ctx, L.live, geo.live, ms, 1450, { shadow: true, pad: 40 });

    // the sport icon sits in a circle: it slides in from the right
    const ip = outExpo(seg(ms, 1650, 700));
    if (ip > 0) { ctx.save(); ctx.translate((1 - ip) * (A.w - geo.icon.x + 20), 0); ctx.drawImage(L.icon, 0, 0); ctx.restore(); }

    // the ByTomorrow logo is always there, from the first frame, on top of the photo
    ctx.drawImage(L.logo, 0, 0);
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
    const ms = (ts - t0) % (DUR + 1800);              // the preview pauses a moment on the finished design before it loops
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
      await new Promise(res => { const loop = () => { const ms = performance.now() - s; draw(ctx, Math.min(ms, DUR)); if (ms < CLIP) requestAnimationFrame(loop); else res(); }; requestAnimationFrame(loop); });
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
