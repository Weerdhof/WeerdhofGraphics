// Scene renderer for the thumbnail templates exported from the PSDs (shapes as paths, rasters as PNGs).
(function () {
  'use strict';
  const imgCache = new Map();
  function loadImg(src) {
    if (!imgCache.has(src)) imgCache.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
    return imgCache.get(src);
  }
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  function gradientFor(ctx, fill, bbox) {
    const [x0, y0, x1, y1] = bbox, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const a = (fill.angle || 0) * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a);
    const L = (Math.abs(w * dx) + Math.abs(h * dy)) * (fill.scale || 100) / 100;
    const g = ctx.createLinearGradient(cx - dx * L / 2, cy - dy * L / 2, cx + dx * L / 2, cy + dy * L / 2);
    let stops = fill.stops.slice();
    if (fill.rev) stops = stops.map(([l, c]) => [1 - l, c]).reverse();
    stops.forEach(([l, c]) => g.addColorStop(Math.min(1, Math.max(0, l)), rgb(c)));
    return g;
  }

  // draws one layer's pixels (no opacity), used directly and as the mask source for clipped layers
  async function drawLayerPixels(ctx, L, base) {
    if (L.type === 'shape') {
      const path = new Path2D(L.d);
      ctx.fillStyle = L.fill.t === 'solid' ? rgb(L.fill.c) : gradientFor(ctx, L.fill, L.bbox);
      ctx.fill(path);
    } else if (L.type === 'image') {
      const im = await loadImg(base + '/' + L.file);
      if (im) ctx.drawImage(im, L.x, L.y, L.w, L.h);
    }
  }

  // opts: { visible: {name: bool}, dynamic: {name: async(ctx, layer)} }
  async function renderScene(ctx, scene, base, opts = {}) {
    const W = scene.w, H = scene.h;
    let lastBase = null;
    for (const L of scene.layers) {
      let vis = L.visible && L.gvis;
      if (opts.visible && L.name in opts.visible) vis = opts.visible[L.name];
      if (opts.groups && L.group in opts.groups) vis = opts.groups[L.group] && L.visible;
      if (L.type === 'dynamic') { if (vis && opts.dynamic && opts.dynamic[L.name]) { try { await opts.dynamic[L.name](ctx, L); } catch (e) { console.error('thumb layer', L.name, e); } } continue; }
      if (!L.clip) lastBase = L;
      if (!vis) continue;
      ctx.save();
      ctx.globalAlpha = L.op;
      if (L.mask) {
        const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
        const t = tmp.getContext('2d');
        await drawLayerPixels(t, L, base);
        const mk = await loadImg(base + '/' + L.mask);
        t.globalCompositeOperation = 'destination-in'; t.drawImage(mk, 0, 0);
        ctx.drawImage(tmp, 0, 0);
      } else if (L.clip && lastBase) {
        const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
        const t = tmp.getContext('2d');
        await drawLayerPixels(t, L, base);
        t.globalCompositeOperation = 'destination-in';
        await drawLayerPixels(t, lastBase, base);
        ctx.drawImage(tmp, 0, 0);
      } else {
        await drawLayerPixels(ctx, L, base);
      }
      ctx.restore();
    }
  }
  window.ThumbScene = { renderScene, loadImg };
})();
