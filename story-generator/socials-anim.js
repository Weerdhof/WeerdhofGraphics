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
  const DUR = 4500;                         // the movement, in ms
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

  // the ByTomorrow monogram (988 x 1121), for the white badge that stands in the first circle
  const BUG = new Path2D('M0.7 0L564.9 -0.7L566.4 0.7L598.9 0.7L600.3 2.2L615.1 2.2L616.6 3.7L629.8 3.7L631.3 5.2L638.7 5.2L640.2 6.6L650.5 6.6L652 8.1L657.9 8.1L659.3 9.6L666.7 9.6L668.2 11.1L681.5 12.5L682.9 14L687.4 14L688.8 15.5L693.3 15.5L694.7 17L705.1 18.4L711 21.4L715.4 21.4L716.9 22.9L733.1 27.3L734.6 28.8L746.4 31.7L750.8 34.7L761.1 37.6L774.4 45L777.3 45L780.3 47.9L783.2 47.9L786.2 50.9L789.1 50.9L792.1 53.8L799.5 56.8L802.4 59.7L809.8 62.7L826 74.5L827.5 74.5L837.8 83.3L839.3 83.3L859.9 102.5L861.4 102.5L884.3 126.9L884.3 128.3L890.2 134.2L890.2 135.7L894.6 140.1L894.6 141.6L899 146L904.9 156.4L907.9 159.3L916.7 177L919.7 180L921.1 185.9L924.1 188.8L924.1 191.8L930 202.1L930 205L932.9 209.5L938.8 230.1L941.8 236L944.7 252.2L946.2 253.7L946.2 259.6L947.7 261.1L947.7 265.5L949.2 267L950.6 283.2L952.1 284.7L952.1 296.5L953.6 298L953.6 312.7L955.1 314.2L955.1 362.9L953.6 364.3L953.6 374.7L952.1 376.1L952.1 386.5L950.6 387.9L949.2 401.2L946.2 407.1L946.2 411.5L943.3 417.4L941.8 426.3L938.8 430.7L938.8 433.7L935.9 438.1L935.9 441L930 451.4L930 454.3L927 457.3L922.6 467.6L919.7 470.5L918.2 475L915.2 477.9L912.3 483.8L903.4 494.1L903.4 495.6L896.1 503L896.1 504.5L860.7 538.4L877.6 552.4L879.1 552.4L886.5 559.8L888 559.8L910.8 582.6L910.8 584.1L918.2 591.5L918.2 593L932.9 610.7L938.8 619.5L940.3 623.9L943.3 626.9L946.2 634.3L949.2 637.2L961 660.8L961 663.8L966.9 674.1L969.8 685.9L974.2 694.7L974.2 699.2L977.2 705.1L977.2 709.5L980.1 715.4L980.1 721.3L981.6 722.8L981.6 727.2L983.1 728.7L983.1 736L984.6 737.5L984.6 744.9L986 746.4L986 762.6L987.5 764.1L987.5 789.1L986 790.6L986 815.7L984.6 817.2L984.6 829L983.1 830.4L983.1 839.3L981.6 840.8L981.6 848.1L980.1 849.6L980.1 857L978.7 858.5L978.7 862.9L977.2 864.4L977.2 868.8L975.7 870.3L975.7 874.7L974.2 876.2L972.8 886.5L968.3 896.8L966.9 904.2L963.9 908.6L963.9 911.6L961 916L961 918.9L958 923.4L958 926.3L955.1 929.3L953.6 935.2L947.7 944L944.7 951.4L941.8 954.3L940.3 958.8L934.4 966.1L931.5 972L922.6 982.4L922.6 983.8L916.7 989.7L916.7 991.2L882.1 1025.9L880.6 1025.9L874.7 1031.8L873.2 1031.8L862.9 1040.6L861.4 1040.6L845.2 1052.4L809.8 1071.6L806.8 1071.6L796.5 1077.5L793.6 1077.5L786.2 1081.9L778.8 1083.4L774.4 1086.3L771.4 1086.3L770 1087.8L767 1087.8L761.1 1090.8L753.7 1092.2L752.3 1093.7L747.8 1093.7L741.9 1096.7L737.5 1096.7L731.6 1099.6L725.7 1099.6L719.8 1102.6L713.9 1102.6L712.4 1104L708 1104L706.5 1105.5L691.8 1107L690.3 1108.5L684.4 1108.5L682.9 1109.9L675.6 1109.9L674.1 1111.4L666.7 1111.4L665.2 1112.9L653.4 1112.9L652 1114.4L643.1 1114.4L641.6 1115.8L625.4 1115.8L623.9 1117.3L609.2 1117.3L607.7 1118.8L593 1118.8L591.5 1120.3L463.2 1120.3L462.4 842.2L626.9 841.5L628.4 840L634.3 840L635.7 838.5L643.1 837.1L653.4 832.6L660.8 826.7L666.7 823.8L677.8 812.7L689.6 793.6L691 786.2L694 780.3L694 774.4L695.5 772.9L695.5 749.3L694 747.8L694 741.9L692.5 740.5L689.6 728.7L680.7 713.9L668.2 699.9L666.7 699.9L657.9 692.5L643.1 685.1L634.3 683.7L632.8 682.2L628.4 682.2L626.9 680.7L137.2 680.7L135.7 682.2L129.8 682.2L128.3 683.7L123.9 683.7L119.5 686.6L116.5 686.6L98.8 696.9L83.3 712.4L80.4 718.3L77.4 721.3L70.1 739L70.1 743.4L68.6 744.9L68.6 752.3L67.1 753.7L67.1 768.5L68.6 770L68.6 777.3L70.1 778.8L70.1 783.2L73 789.1L73 792.1L83.3 809.8L100.3 826.7L119.5 837.1L128.3 838.5L129.8 840L135.7 840L137.2 841.5L301.6 842.2L301.6 1119.5L-0.7 1119.5L-0.7 418.9L625.4 418.2L626.9 416.7L634.3 416.7L635.7 415.2L644.6 413.7L659.3 406.4L666 401.2L680.7 386.5L685.1 377.6L688.1 374.7L688.1 371.7L691 367.3L691 364.3L694 358.4L694 352.5L695.5 351.1L695.5 324.5L694 323L694 315.7L691 309.8L691 306.8L682.2 290.6L668.2 275.1L666.7 275.1L657.9 267.7L646.1 261.8L643.1 261.8L637.2 258.9L631.3 258.9L629.8 257.4L0 257.4L-0.7 1.5Z');

  // order: the two pills at the top, then the title together with the photo and the label, then LIVE OP and the icon together
  const T_TITLE = 2050, T_TAG = 2050, T_LIVE = 2900, T_ICON = 2900;   // three moments: the pills, then title + photo + label together, then LIVE OP + icon together

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
    const cs = getComputedStyle(frame), bg = cs.getPropertyValue('--bg').trim() || '#060228';
    return { tid: t.id, w: t.w, h: t.h, L, geo, bg, alt: cs.getPropertyValue('--pill-bg').trim() || bg };
  }

  async function rebuild() {
    if (!on) return;
    if (building) { again = true; return; }
    building = true; setStatus('Animatie voorbereiden…'); const mp = $('bytMp4'), gb = $('bytGif'); if (mp) mp.disabled = true; if (gb) gb.disabled = true;
    try {
      const next = await build();
      layers = next; showCanvas(true);
      setStatus('');
    } catch (e) { console.error(e); setStatus('Animatie voorbereiden mislukt'); }
    building = false; { const mp = $('bytMp4'), gb = $('bytGif'); if (mp && !recording) mp.disabled = false; if (gb && !recording) gb.disabled = false; }
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

  // the white badge with the monogram, slid by `dx` and keyed by the circle underneath (x): it only shows inside
  // that circle, so it slides out of it instead of across the page
  function badge(ctx, x, r, dx) {
    const cx = x + r.h / 2, cy = r.y + r.h / 2, k = (r.h * .52) / 1121;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r.h / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + dx, cy, r.h / 2, 0, Math.PI * 2); ctx.fill();
    ctx.translate(cx + dx - 988 * k / 2, cy - 1121 * k / 2); ctx.scale(k, k); ctx.fillStyle = layers.bg; ctx.fill(BUG, 'evenodd'); ctx.restore();
  }

  // the two pills at the top: both circles come in from the left (the second a little ahead, so they never cross)
  // and land next to each other, then the first one stretches and pushes the second one aside, which then
  // stretches too
  function pillRow(ctx, img, list, ms) {
    const gap = list.length > 1 ? list[1].x - (list[0].x + list[0].w) : 0;
    let right = null;
    list.forEach((r, i) => {
      const t0 = i === 0 ? 270 : 150, s0 = [1000, 1400][i] || 1400;
      const mv = outExpo(seg(ms, t0, 600)), str = inOutExpo(seg(ms, s0, 650)), tx = seg(ms, s0 + 450, 250), w = lerp(r.h, r.w, str);
      let x;
      if (i === 0) x = str > 0 ? r.x : lerp(-r.h * 1.3, r.x, mv);
      else x = lerp(-r.h * 1.3, right + gap, mv);        // the second one also comes from the left, a little ahead, and lands next to the first
      if (mv > 0) {
        if (tx < 1) bar(ctx, r, x, w, {}, 1);
        if (tx > 0) content(ctx, img, r, outExpo(tx), 4);
        // a white badge with the ByTomorrow monogram (in the colour of the background) stands on the first circle (it travels in together with it) and slides out of it to the right
        if (i === 0) { const e = inOutExpo(seg(ms, 900, 450)); if (e < 1) badge(ctx, x, r, e * r.h * 1.15); }
      }
      right = r.x + w;                                    // where the next one lands: behind the landed place of this one
    });
  }

  // layouts with the sport circle in front of the pills: it travels in from the left with the circles of the pills
  // (the last of the three, so none of them cross) and lands in its own place
  function iconLead(ctx, img, r, ms) {
    const mv = outExpo(seg(ms, 390, 600)); if (mv <= 0) return;
    ctx.save(); ctx.translate(lerp(-r.h * 1.3 - r.x, 0, mv), 0); ctx.drawImage(img, 0, 0); ctx.restore();
  }

  function draw(ctx, ms, noLogo) {
    const A = layers, { L, geo } = A;
    ctx.clearRect(0, 0, A.w, A.h);
    ctx.drawImage(L.bg, 0, 0);

    // competition and date pills (one after the other)
    const lead = geo.icon.x < geo.pills[0].x && geo.icon.y < geo.live.y;
    pillRow(ctx, L.pills, geo.pills, ms);
    if (lead) iconLead(ctx, L.icon, geo.icon, ms);
    slideIn(ctx, L.title, ms, T_TITLE, 800, 170);
    if (geo.tag) morph(ctx, L.tag, geo.tag, ms, T_TAG, { outline: true, pad: 4 });

    // photo: wipes in from the left to the right
    const pp = inOutExpo(seg(ms, T_TITLE, 800));          // the photo goes with the title
    if (pp > 0) {
      const ph = geo.photo;
      ctx.save(); ctx.beginPath(); ctx.rect(ph.x - 2, ph.y - 2, ph.w * pp + 4, ph.h + 4); ctx.clip();
      ctx.drawImage(L.photo, 0, 0); ctx.restore();
    }

    morph(ctx, L.live, geo.live, ms, T_LIVE, { shadow: true, pad: 40 });

    // the sport icon sits in a circle: it slides in from the right
    const ip = outExpo(seg(ms, T_ICON, 700));
    if (!lead && ip > 0) { ctx.save(); ctx.translate((1 - ip) * (A.w - geo.icon.x + 20), 0); ctx.drawImage(L.icon, 0, 0); ctx.restore(); }

    // the ByTomorrow logo is always there, from the first frame, on top of the photo
    if (!noLogo) ctx.drawImage(L.logo, 0, 0);
  }

  // the way out, and so the way back to the start of the loop, in one movement: a big ByT monogram goes slowly to the
  // middle and then away to the right, ever faster; on its way its colour goes from the alternative colour (the pills) to
  // the colour of the background, while the design fades into that colour. What is left is the plain colour and the
  // logo, as in the first frame. `p` is how far it is (0 = finished, 1 = back at the start).
  const rgb = (c) => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; const v = x.fillStyle;
    if (v[0] === '#') return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
    return (v.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
  const smooth = (p) => p * p * (3 - 2 * p), sineInOut = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  let outCv = null;
  function drawOut(ctx, p) {
    const A = layers; if (!outCv) outCv = document.createElement('canvas');
    if (outCv.width !== A.w || outCv.height !== A.h) { outCv.width = A.w; outCv.height = A.h; }
    draw(outCv.getContext('2d'), DUR, true);
    ctx.clearRect(0, 0, A.w, A.h); ctx.fillStyle = A.bg; ctx.fillRect(0, 0, A.w, A.h);
    ctx.save(); ctx.globalAlpha = 1 - smooth(clamp((p - .1) / .6)); ctx.drawImage(outCv, 0, 0); ctx.restore();
    const H = A.h * 1.3, k = H / 1121, w = 988 * k, mid = (A.w - w) / 2, T = .5;
    const xl = p < T ? lerp(-w, mid, sineInOut(p / T)) : lerp(mid, A.w + 20, Math.pow((p - T) / (1 - T), 3));
    const from = rgb(A.alt), to = rgb(A.bg), f = smooth(clamp(p / .85));
    ctx.save(); ctx.fillStyle = `rgb(${from.map((v, i) => Math.round(lerp(v, to[i], f))).join(',')})`;
    ctx.translate(xl, (A.h - H) / 2); ctx.scale(k, k); ctx.fill(BUG, 'evenodd'); ctx.restore();
    ctx.drawImage(A.L.logo, 0, 0);
  }
  const LOOP_HOLD = 1800, LOOP_OUT = 1000;

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
    const ms = (ts - t0) % (DUR + LOOP_HOLD + LOOP_OUT);   // the preview pauses a moment on the finished design, then the monogram takes it away
    if (ms <= DUR) draw(canvas.getContext('2d'), ms); else drawOut(canvas.getContext('2d'), Math.max(0, (ms - DUR - LOOP_HOLD) / LOOP_OUT));
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

  // ---------- GIF (loops) ----------
  // the movement at 33 frames per second, then the finished design stays as one long frame and is wiped away by the monogram (full colour and
  // logo are left), where the loop begins again. Smaller than the video: the longest side is 800 px.
  const GIF_STEP = 30, GIF_HOLD = 2600, GIF_OUT = 1000, GIF_MAX = 800;
  async function recordGif() {
    const b = B(), btn = $('bytGif'), A = layers;
    if (!A || typeof GIF === 'undefined') { setStatus('GIF-export niet beschikbaar'); return; }
    stop(); recording = true; btn.disabled = true; $('bytMp4').disabled = true;
    try {
      const k = Math.min(1, GIF_MAX / Math.max(A.w, A.h)), w = Math.round(A.w * k), h = Math.round(A.h * k);
      const full = document.createElement('canvas'); full.width = A.w; full.height = A.h;
      const small = document.createElement('canvas'); small.width = w; small.height = h;
      const fctx = full.getContext('2d'), sctx = small.getContext('2d', { willReadFrequently: true });
      sctx.imageSmoothingQuality = 'high';
      const gif = new GIF({ workers: 3, quality: 6, width: w, height: h, repeat: 0, workerScript: 'vendor/gif.worker.js' });
      const step = GIF_STEP, n = Math.ceil(DUR / step);
      for (let i = 0; i <= n; i++) {
        const last = i === n;
        draw(fctx, Math.min(DUR, i * step)); sctx.fillStyle = A.bg; sctx.fillRect(0, 0, w, h); sctx.drawImage(full, 0, 0, w, h);
        gif.addFrame(sctx, { copy: true, delay: last ? GIF_HOLD : step });
        setStatus('GIF maken… ' + Math.round(i / n * 40) + '%');
        if (i % 6 === 0) await new Promise(r => setTimeout(r));
      }
      // the way out: the monogram goes by and the design fades, so the loop starts again from the plain colour and the logo
      const fn = Math.round(GIF_OUT / GIF_STEP);
      for (let j = 1; j < fn; j++) {
        drawOut(fctx, j / fn); sctx.fillStyle = A.bg; sctx.fillRect(0, 0, w, h); sctx.drawImage(full, 0, 0, w, h);
        gif.addFrame(sctx, { copy: true, delay: GIF_STEP });
      }
      gif.on('progress', p => setStatus('GIF maken… ' + (40 + Math.round(p * 60)) + '%'));
      const blob = await new Promise((res, rej) => { gif.on('finished', res); gif.on('abort', rej); gif.render(); });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = b.fileName().replace(/\.png$/, '-animatie.gif');
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus('✓ GIF gedownload (' + (blob.size / 1048576).toFixed(1) + ' MB, loopt)');
    } catch (e) { console.error(e); setStatus('GIF maken mislukt, probeer het opnieuw.'); }
    recording = false; btn.disabled = false; $('bytMp4').disabled = false; if (on) start();
  }

  function setStatus(s) { const el = $('bytAnimStatus'); if (el) { el.textContent = s; el.hidden = !s; } }

  // ---------- hooks used by socials.js ----------
  function mount(box) {
    if (!box) return;
    const asset = B().state.asset;
    if (!SUPPORTED.includes(asset)) { box.innerHTML = ''; return; }
    box.innerHTML = `<label class="upcoming-toggle byt-anim-toggle"><input type="checkbox" id="bytAnimToggle"${on ? ' checked' : ''}> Animeer (rondjes worden balken)</label>
      <button class="btn btn-primary" id="bytMp4" type="button"${on ? '' : ' hidden'}>Download MP4</button>
      <button class="btn" id="bytGif" type="button"${on ? '' : ' hidden'}>Download GIF (loopt)</button>
      <p class="save-status" id="bytAnimStatus" hidden></p>`;
    $('bytAnimToggle').addEventListener('change', (e) => {
      on = e.target.checked; $('bytMp4').hidden = !on; $('bytGif').hidden = !on;
      if (on) rebuild(); else { document.body.classList.remove('byt-animating'); stop(); setStatus(''); }
    });
    $('bytMp4').addEventListener('click', record);
    $('bytGif').addEventListener('click', recordGif);
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

  window.BYT_ANIM = { mount, changed, reset, draw: (ctx, ms, noLogo) => layers && draw(ctx, ms, noLogo), get layers() { return layers; }, DUR };
})();
