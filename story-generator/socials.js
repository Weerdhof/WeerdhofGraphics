/* ByTomorrow Socials: the social templates from the design handoff (socials/templates.js, built by
   socials/build_socials.py) as a small editor: fill in the fields, pick the pillar, drop a photo, export a PNG.
   The templates are rendered as the HTML they were designed in, at their native size, and exported through an
   SVG foreignObject so the PNG is what the browser shows (fonts and photo are embedded). */
(function () {
  'use strict';
  const TEMPLATES = window.BYT_TEMPLATES || [];
  const byId = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
  const ASSETS = window.BYT_ASSETS || {};
  const CHANNELS = window.BYT_CHANNELS || [];            // logos that can stand next to "LIVE OP" instead of the typed platform
  const channelOf = (id) => CHANNELS.find(c => c.id === id);
  const assetIds = []; TEMPLATES.forEach(t => { if (!assetIds.includes(t.asset)) assetIds.push(t.asset); });
  const formatsOf = (asset) => TEMPLATES.filter(t => t.asset === asset);
  const assetOf = (id) => (ASSETS[id] ? id : (byId[id] && byId[id].asset));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const PILLARS = {   // swatch colours for the picker (the real maps live in each template's logic)
    standaard: ['#3D5AFE', '#060228', 'ByTomorrow'],
    productie: ['#FC06E5', '#7B1FA2', 'Productie'],
    jump: ['#49FF9F', '#2F7E4D', 'JUMP'],
    marketing: ['#FFCC00', '#C25100', 'Marketing'],
    content: ['#00FFE6', '#008B8B', 'Content'],
    navy: ['#060228', '#3D5AFE', 'Navy'],
  };
  const LABELS = {
    title: 'Titel', titleLine1: 'Titel, regel 1', titleLine2: 'Titel, regel 2 (mag leeg)', competition: 'Competitie',
    datetime: 'Datum en tijd', platform: 'Platform (achter "LIVE OP")', pillarLabel: 'Label onder de titel (leeg: naam van de pijler)',
    quote: 'Quote', author: 'Auteur', cta: 'Tekst op de knop',
    person: 'Persoon', name: 'Naam', role: 'Functie', eyebrow: 'Label (klein, boven de titel)', duration: 'Duur', version: 'Versie',
    intro: 'Intro', u1: 'Update 1 (mag leeg)', u2: 'Update 2 (mag leeg)', u3: 'Update 3 (mag leeg)',
    homeTeam: 'Thuisploeg', awayTeam: 'Uitploeg', homeScore: 'Score thuis', awayScore: 'Score uit',
  };
  const LONG = { quote: 4, intro: 4, title: 0 };   // textarea rows
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const cur = { asset: null, t: null, props: {}, photo: null, scale: 1, safe: false };
  const classes = {};
  class DCLogic { constructor(props) { this.props = props || {}; } }
  function logicFor(t) {
    if (!classes[t.id]) classes[t.id] = new Function('DCLogic', t.logic + '\nreturn typeof Component === "undefined" ? DCLogic : Component;')(DCLogic);
    return classes[t.id];
  }

  // ---------- persistence: the last fields per template (the photo stays in this session) ----------
  const storeKey = (asset) => 'byt-social:asset:' + asset;
  const fmtKey = (asset) => 'byt-social:format:' + asset;
  function defaultProps(asset) {
    const props = {};
    formatsOf(asset).forEach(t => Object.entries(t.props).forEach(([k, v]) => { if (!(k in props)) props[k] = v.default; }));
    return props;
  }
  function loadProps(asset) {
    const props = defaultProps(asset);
    try { Object.assign(props, JSON.parse(localStorage.getItem(storeKey(asset)) || '{}')); } catch (e) { /* ignore */ }
    return props;
  }
  function saveProps() { try { localStorage.setItem(storeKey(cur.asset), JSON.stringify(cur.props)); } catch (e) { /* ignore */ } }

  // the story has two title lines, the other formats one: carry the title over when the format changes
  function carryTitle(from, to) {
    const p = cur.props, lines = (t) => 'titleLine1' in t.props;
    // artikel (person) and quote (author) are the same name on two slides
    if ('person' in from.props && 'author' in to.props) p.author = p.person;
    else if ('author' in from.props && 'person' in to.props) p.person = p.author;
    if (lines(from) && !lines(to) && 'title' in to.props) {
      p.title = [p.titleLine1, p.titleLine2].filter(x => x && String(x).trim()).join('  ');
    } else if (!lines(from) && lines(to) && 'title' in from.props) {
      const parts = String(p.title || '').split(/\s{2,}|\n/).filter(Boolean);
      p.titleLine1 = parts[0] || ''; p.titleLine2 = parts.slice(1).join(' ');
    }
  }

  // ---------- rendering ----------
  function frameEl() { return $('bytFrame'); }
  function render() {
    const t = cur.t, frame = frameEl(); if (!t || !frame) return;
    frame.style.width = t.w + 'px'; frame.style.height = t.h + 'px';
    window.__bytRoot = frame;
    const logic = new (logicFor(t))(cur.props);
    if (typeof logic.applyVars === 'function') logic.applyVars();
    if ('iconColor' in t.props) { if (cur.props.iconColor && cur.props.iconColor !== 'auto') frame.style.setProperty('--icon', cur.props.iconColor); else frame.style.removeProperty('--icon'); }
    const vals = typeof logic.renderVals === 'function' ? logic.renderVals() : {};
    let h = t.html.replace(/<!--if:(\w+)-->([\s\S]*?)<!--\/if-->/g, (m, k, body) => ((vals[k] != null ? vals[k] : cur.props[k]) ? body : ''));
    // a channel logo takes the place of the typed platform
    const ch = 'platform' in t.props && channelOf(cur.props.channel);
    // the arrow of the JUMP logo: in the colour of the background, the original green, or navy with a light grey arrow (mono)
    const arrow = !ch ? '' : ({ jump: getComputedStyle(frame).getPropertyValue('--bg').trim() || '#49FF9F', 'jump-mono': '#C9C9D4' })[ch.id];
    const chSrc = !ch ? '' : (arrow ? 'data:image/svg+xml;base64,' + btoa(atob(ch.src.split(',')[1]).replace(/#49FF9F/gi, arrow)) : ch.src);
    if (ch) h = h.replace(/<span([^>]*)>\{\{\s*platform\s*\}\}<\/span>/, (m, a) =>
      `<span${a.replace(/style="([^"]*)"/, (mm, st) => `style="${st}; display:flex; align-items:center;"`)}><img src="${chSrc}" alt="${esc(ch.label)}" style="height:1.35em; width:auto; display:block;"></span>`);
    h = h.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => esc(vals[k] != null ? vals[k] : cur.props[k]));
    frame.innerHTML = h;
    frame.querySelectorAll('.byt-slot').forEach(applySlot);
    fit();
    applySafe();
    if (window.BYT_ANIM) window.BYT_ANIM.changed();
  }
  // Instagram story safe zones, shown over the preview only (they are not part of the frame, so not in the export)
  const SAFE = { top: 250, bottom: 340, side: 60 };
  const is916 = (t) => t && t.w === 1080 && t.h === 1920;
  function applySafe() {
    const scaler = $('bytScale'); if (!scaler) return;
    let o = $('bytSafe'); if (o) o.remove();
    if (!cur.safe || !is916(cur.t)) return;
    o = document.createElement('div'); o.id = 'bytSafe'; o.className = 'byt-safe';
    const p = (v, of) => (v / of * 100) + '%';
    o.innerHTML = `<i class="top" style="height:${p(SAFE.top, 1920)}"><span>Instagram: naam en voortgangsbalk</span></i><i class="bottom" style="height:${p(SAFE.bottom, 1920)}"><span>Instagram: reageren en delen</span></i>` +
      `<i class="side l" style="width:${p(SAFE.side, 1080)}; top:${p(SAFE.top, 1920)}; bottom:${p(SAFE.bottom, 1920)}"></i><i class="side r" style="width:${p(SAFE.side, 1080)}; top:${p(SAFE.top, 1920)}; bottom:${p(SAFE.bottom, 1920)}"></i>`;
    scaler.appendChild(o);
  }
  const scheduled = { v: false };
  function scheduleRender() { if (!scheduled.v) { scheduled.v = true; requestAnimationFrame(() => { scheduled.v = false; render(); }); } }

  // cover for photos, contain for cut-out portraits
  function slotScale(slot, p, w, h) { return (slot.dataset.fit === 'contain' ? Math.min(w / p.iw, h / p.ih) : Math.max(w / p.iw, h / p.ih)) * p.z; }
  function applySlot(slot) {
    const p = cur.photo;
    if (!p) {
      slot.classList.add('empty');
      slot.innerHTML = '<span>' + esc(slot.dataset.ph || 'Sleep hier een foto') + '</span>';
      return;
    }
    slot.classList.remove('empty'); slot.innerHTML = '';
    const w = slot.offsetWidth, h = slot.offsetHeight;
    const sc = slotScale(slot, p, w, h), bw = p.iw * sc, bh = p.ih * sc;
    slot.style.backgroundImage = `url("${p.src}")`;
    slot.style.backgroundRepeat = 'no-repeat';
    slot.style.backgroundSize = `${bw}px ${bh}px`;
    slot.style.backgroundPosition = `${(w - bw) * p.x}px ${(h - bh) * p.y}px`;
    slot.style.cursor = 'grab';
  }

  // fit the native-size frame into the stage
  function fit() {
    const t = cur.t, stage = $('bytStage'), scaler = $('bytScale'); if (!t || !stage || !scaler) return;
    const narrow = window.innerWidth <= 860;
    const availW = Math.max(240, stage.clientWidth - (narrow ? 32 : 80));
    const availH = narrow ? Math.max(300, window.innerHeight * 0.62) : Math.max(300, window.innerHeight - 96);
    const k = Math.min(availW / t.w, availH / t.h, 1);
    cur.scale = k;
    scaler.style.width = Math.round(t.w * k) + 'px'; scaler.style.height = Math.round(t.h * k) + 'px';
    frameEl().style.transform = `scale(${k})`;
  }
  window.addEventListener('resize', () => { if (document.body.classList.contains('byt-open')) fit(); });

  // ---------- photo ----------
  function loadPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      // keep it light: at most 2400px on the long side, as JPEG
      const k = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = file.type === 'image/png';
      cur.photo = { src: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92), iw: c.width, ih: c.height, x: .5, y: /data-fit="contain"/.test(cur.t.html) ? 1 : .5, z: 1 };
      buildControls(); render();
    };
    img.onerror = () => { URL.revokeObjectURL(url); status('Die afbeelding kon niet worden gelezen'); };
    img.src = url;
  }
  let drag = null;
  function bindDrag() {
    const stage = $('bytStage');
    // a finger that swipes over the frame must scroll the page: on touch a drag only starts after a short hold
    let hold = null;
    const begin = (e, target) => {
      const el = target.closest('[data-drag]');
      if (el) {            // a marked element (title block, icon): drag it up or down
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        drag = { kind: 'el', el, key: el.dataset.drag, base: Number(el.dataset.base), axis: el.dataset.axis, y: e.clientY, off: Number(cur.props[el.dataset.drag]) || 0 };
        return;
      }
      const slot = target.closest('.byt-slot'); if (!slot || !cur.photo) return;
      slot.setPointerCapture && slot.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, slot };
      slot.style.cursor = 'grabbing';
    };
    stage.addEventListener('pointerdown', (e) => {
      const target = e.target;
      if (e.pointerType === 'touch') {
        if (!target.closest('[data-drag], .byt-slot')) return;
        const pt = { id: e.pointerId, x: e.clientX, y: e.clientY };
        hold = { pt, startX: e.clientX, startY: e.clientY, timer: setTimeout(() => { hold = null; begin({ pointerId: pt.id, clientX: pt.x, clientY: pt.y }, target); if (navigator.vibrate) navigator.vibrate(12); }, 320) };
        return;
      }
      if (!target.closest('[data-drag], .byt-slot')) return;
      if (target.closest('[data-drag]') || cur.photo) e.preventDefault();
      begin(e, target);
    });
    stage.addEventListener('touchmove', (e) => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
    const cancelHold = () => { if (hold) { clearTimeout(hold.timer); hold = null; } };
    stage.addEventListener('pointermove', (e) => {
      if (hold) { hold.pt.x = e.clientX; hold.pt.y = e.clientY; if (Math.hypot(e.clientX - hold.startX, e.clientY - hold.startY) > 8) cancelHold(); }
      if (drag && drag.kind === 'el') {
        const t = cur.t, d = drag, h = d.el.offsetHeight;
        d.off += (e.clientY - d.y) / cur.scale; d.y = e.clientY;
        // keep the element inside the frame
        const lo = d.axis === 'top' ? -d.base : d.base - (t.h - h), hi = d.axis === 'top' ? t.h - h - d.base : d.base;
        d.off = Math.min(hi, Math.max(lo, d.off));
        cur.props[d.key] = Math.round(d.off);
        if (d.axis === 'top') d.el.style.top = `calc(${d.base}px + ${Math.round(d.off)}px)`; else d.el.style.bottom = `calc(${d.base}px - ${Math.round(d.off)}px)`;
        return;
      }
      if (!drag || !cur.photo) return;
      const p = cur.photo, w = drag.slot.offsetWidth, h = drag.slot.offsetHeight;
      const sc = slotScale(drag.slot, p, w, h), bw = p.iw * sc, bh = p.ih * sc;
      const dx = (e.clientX - drag.x) / cur.scale, dy = (e.clientY - drag.y) / cur.scale;
      drag.x = e.clientX; drag.y = e.clientY;
      if (Math.abs(w - bw) > 0.5) p.x = Math.min(1, Math.max(0, p.x + dx / (w - bw)));
      if (Math.abs(h - bh) > 0.5) p.y = Math.min(1, Math.max(0, p.y + dy / (h - bh)));
      frameEl().querySelectorAll('.byt-slot').forEach(applySlot);
    });
    const end = () => { cancelHold(); if (drag) { if (drag.kind === 'el') saveProps(); else drag.slot.style.cursor = 'grab'; drag = null; } };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    ['dragover', 'drop'].forEach(ev => stage.addEventListener(ev, (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault(); if (ev === 'drop') loadPhoto(e.dataTransfer.files[0]);
    }));
  }

  // ---------- controls ----------
  function buildControls() {
    const box = $('bytControls'), t = cur.t; if (!box || !t) return;
    const textKeys = Object.keys(t.props).filter(k => t.props[k].editor === 'text');
    const hasSlot = /class="byt-slot"/.test(t.html);
    const formats = formatsOf(cur.asset);
    let n = 1, html = '';
    if (formats.length > 1) {
      const slides = /^Slide/.test(formats[0].format);
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">${n++}</span> ${slides ? 'Slide' : 'Formaat'}</div>
        <div class="mode-tabs mode-tabs-compact" id="bytFormats" role="tablist" aria-label="Formaat">${formats.map(f => `<button type="button" class="mode-tab${f.id === t.id ? ' active' : ''}" role="tab" aria-selected="${f.id === t.id}" data-f="${f.id}">${esc(f.format)}</button>`).join('')}</div>
        <p class="hint">${slides ? 'De slides vormen samen een carrousel. De pijler, de foto en de naam blijven staan als je van slide wisselt.' : `${t.w} × ${t.h} px. De velden en de foto blijven staan als je van formaat wisselt.`}</p></div>`;
    }
    if (textKeys.length) html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">${n++}</span> Tekst</div>` +
      textKeys.map(k => LONG[k]
        ? `<div class="field"><label for="byt_${k}">${esc(LABELS[k] || k)}</label><textarea id="byt_${k}" data-k="${k}" rows="${LONG[k]}">${esc(cur.props[k])}</textarea></div>`
        : `<div class="field"><label for="byt_${k}">${esc(LABELS[k] || k)}${k === 'platform' && channelOf(cur.props.channel) ? ' (het logo is gekozen)' : ''}</label><input type="text" id="byt_${k}" data-k="${k}" value="${esc(cur.props[k])}"${k === 'platform' && channelOf(cur.props.channel) ? ' disabled' : ''}></div>`).join('') + '</div>';
    const pOpts = (t.props.pillar && t.props.pillar.options) || [];
    const hasChannel = 'platform' in t.props && CHANNELS.length;
    if (!pOpts.length && !t.props.sport && !hasChannel) {
      if (!textKeys.length) html += '<div class="panel-step"><p class="hint">Deze template heeft geen velden: je kunt hem direct exporteren.</p></div>';
    } else {
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">${n++}</span> Opmaak</div>`;
      if (pOpts.length) {
        html += `<div class="field"><label>Pijler</label><div class="byt-pillars" id="bytPillars">${pOpts.map(p => { const c = PILLARS[p] || ['#888', '#444', p];
          return `<button type="button" class="byt-pillar${cur.props.pillar === p ? ' active' : ''}" data-p="${p}" title="${esc(c[2])}"><i style="background:linear-gradient(135deg,${c[0]} 50%,${c[1]} 50%)"></i><span>${esc(c[2])}</span></button>`; }).join('')}</div></div>`;
      }
      if (t.props.sport) {
        html += `<div class="field"><label for="byt_sport">Sport (icoon)</label><select id="byt_sport" data-k="sport">${t.props.sport.options.map(s => `<option value="${s}"${cur.props.sport === s ? ' selected' : ''}>${esc(cap(s))}</option>`).join('')}</select></div>`;
      }
      if (hasChannel) {
        html += `<div class="field"><label for="byt_channel">Kanaal naast "LIVE OP"</label><select id="byt_channel" data-ch="1"><option value="">Zelf typen</option>${CHANNELS.map(c => `<option value="${c.id}"${cur.props.channel === c.id ? ' selected' : ''}>${esc(c.label)} (logo)</option>`).join('')}</select></div>`;
      }
      html += '</div>';
    }
    if (hasSlot) {
      const p = cur.photo;
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">${n++}</span> Foto</div>
        <label class="photo-btn" id="bytPhotoDrop" for="bytPhotoInput"><span class="photo-btn-text">${p ? 'Foto vervangen' : 'Foto toevoegen'}</span><span class="photo-btn-sub">klik, of sleep hier een afbeelding in</span></label>
        <input type="file" id="bytPhotoInput" accept="image/*" hidden>
        ${p ? `<div class="field"><label for="bytZoom">Zoom</label><input type="range" id="bytZoom" min="100" max="300" value="${Math.round(p.z * 100)}"></div>
        <button class="btn btn-link" id="bytPhotoRemove" type="button">✕ Verwijder foto</button>
        <p class="hint">Sleep in het voorbeeld om de foto te verschuiven. Zoom in om hem verder te kunnen verplaatsen. Op een telefoon: houd even vast en sleep dan.</p>` : ''}</div>`;
    }
    const toggles = Object.keys(t.props).filter(k => t.props[k].editor === 'toggle'), ranges = Object.keys(t.props).filter(k => t.props[k].editor === 'range');
    if (toggles.length) {
      html += `<div class="panel-step"><div class="panel-step-title"><span class="step-num">${n++}</span> Onderdelen</div>
        <p class="hint">Zet onderdelen aan of uit.</p>` + toggles.filter(k => k !== 'gradient').map(k => `<label class="upcoming-toggle byt-toggle"><input type="checkbox" data-tg="${k}"${cur.props[k] ? ' checked' : ''}> ${esc(t.props[k].label)}</label>`).join('');
      if (t.props.gradient) {
        html += `<label class="upcoming-toggle byt-toggle"><input type="checkbox" data-tg="gradient"${cur.props.gradient ? ' checked' : ''}> ${esc(t.props.gradient.label)}</label>` +
          (cur.props.gradient ? ranges.map(k => `<div class="field"><label for="byt_${k}">${esc(t.props[k].label)}</label><input type="range" id="byt_${k}" data-rg="${k}" min="${t.props[k].min}" max="${t.props[k].max}" value="${cur.props[k]}"></div>`).join('') : '');
      }
      const choices = Object.keys(t.props).filter(k => t.props[k].editor === 'choice');
      html += choices.map(k => `<div class="field"><label for="byt_${k}">${esc(t.props[k].label)}</label><select id="byt_${k}" data-cs="${k}">${t.props[k].options.map(([v, l]) => `<option value="${esc(v)}"${String(cur.props[k]) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`).join('');
      if (/data-drag/.test(t.html)) html += '<p class="hint">Sleep de titel en het icoon in het voorbeeld omhoog of omlaag.</p>';
      html += '</div>';
    }
    html += `<div class="panel-step panel-step-last"><div class="panel-step-title"><span class="step-num">${n++}</span> Exporteren</div>
      <p class="hint">PNG op ware grootte: ${t.w} × ${t.h} px${formats.length > 1 ? ` (${esc(t.format)})` : ''}.</p>
      ${is916(t) ? `<label class="upcoming-toggle byt-toggle"><input type="checkbox" id="bytSafeToggle"${cur.safe ? ' checked' : ''}> Toon Instagram safe zones (alleen in het voorbeeld)</label>` : ''}
      <div id="bytAnimBox"></div>
      <button class="btn btn-primary" id="bytExport" type="button">Exporteer als PNG</button>
      <button class="btn btn-link" id="bytReset" type="button">Velden terugzetten</button>
      <p class="save-status" id="bytStatus" hidden></p></div>`;
    box.innerHTML = html;
    bindControls();
    if (window.BYT_ANIM) window.BYT_ANIM.mount($('bytAnimBox'));
  }
  function bindControls() {
    const fm = $('bytFormats');
    if (fm) fm.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => switchFormat(b.dataset.f)));
    $('bytControls').querySelectorAll('[data-tg]').forEach(el => el.addEventListener('change', () => {
      cur.props[el.dataset.tg] = el.checked; saveProps(); if (el.dataset.tg === 'gradient') buildControls(); render();
    }));
    $('bytControls').querySelectorAll('[data-rg]').forEach(el => el.addEventListener('input', () => { cur.props[el.dataset.rg] = Number(el.value); saveProps(); scheduleRender(); }));
    $('bytControls').querySelectorAll('[data-cs]').forEach(el => el.addEventListener('change', () => { cur.props[el.dataset.cs] = el.value; saveProps(); render(); }));
    const sf = $('bytSafeToggle'); if (sf) sf.addEventListener('change', () => { cur.safe = sf.checked; applySafe(); });
    const chSel = $('byt_channel');
    if (chSel) chSel.addEventListener('change', () => { cur.props.channel = chSel.value; saveProps(); buildControls(); render(); });
    $('bytControls').querySelectorAll('[data-k]').forEach(el => {
      const on = () => { cur.props[el.dataset.k] = el.value; saveProps(); scheduleRender(); };
      el.addEventListener('input', on); el.addEventListener('change', on);
    });
    if ($('bytPillars')) $('bytPillars').querySelectorAll('.byt-pillar').forEach(b => b.addEventListener('click', () => {
      cur.props.pillar = b.dataset.p; saveProps();
      $('bytPillars').querySelectorAll('.byt-pillar').forEach(x => x.classList.toggle('active', x === b)); render();
    }));
    const inp = $('bytPhotoInput'); if (inp) inp.addEventListener('change', () => { loadPhoto(inp.files[0]); inp.value = ''; });
    const drop = $('bytPhotoDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); if (ev === 'drop') loadPhoto(e.dataTransfer.files[0]); }));
    }
    const z = $('bytZoom'); if (z) z.addEventListener('input', () => { cur.photo.z = z.value / 100; frameEl().querySelectorAll('.byt-slot').forEach(applySlot); });
    const rm = $('bytPhotoRemove'); if (rm) rm.addEventListener('click', () => { cur.photo = null; buildControls(); render(); });
    $('bytExport').addEventListener('click', exportPng);
    $('bytReset').addEventListener('click', () => {
      const keep = cur.props.pillar; cur.props = defaultProps(cur.asset); cur.props.pillar = keep; saveProps(); buildControls(); render();
    });
  }
  const status = (s) => { const el = $('bytStatus'); if (el) { el.textContent = s; el.hidden = !s; } };

  // ---------- export ----------
  const FONTS = [
    ['Niveau Grotesk', 300, 'socials/fonts/NiveauGroteskLight.otf', 'font/otf'],
    ['Niveau Grotesk', 400, 'socials/fonts/NiveauGroteskRegular.otf', 'font/otf'],
    ['Niveau Grotesk', 500, 'socials/fonts/NiveauGroteskMedium.otf', 'font/otf'],
    ['Niveau Grotesk', 700, 'socials/fonts/NiveauGroteskBold.otf', 'font/otf'],
    ['Niveau Grotesk', 900, 'socials/fonts/NiveauGroteskBlack.otf', 'font/otf'],
    ['Open Sans', 400, 'fonts/bt/OpenSans-Regular.ttf', 'font/ttf'],
    ['Open Sans', 600, 'fonts/bt/OpenSans-SemiBold.ttf', 'font/ttf'],
    ['Open Sans', 700, 'fonts/bt/OpenSans-Bold.ttf', 'font/ttf'],
    ['Material Symbols Rounded', 600, 'socials/fonts/MaterialSymbolsRounded-sports.woff2', 'font/woff2'],
  ];
  function b64(u8) {
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  let fontCss = null;
  async function embeddedFonts() {
    if (fontCss) return fontCss;
    const parts = await Promise.all(FONTS.map(async ([fam, w, url, mime]) => {
      const buf = await (await fetch(url)).arrayBuffer();
      return `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;src:url(data:${mime};base64,${b64(new Uint8Array(buf))});}`;
    }));
    return (fontCss = parts.join('\n'));
  }
  const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('afbeelding laden mislukt')); i.src = src; });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // renders the frame to a canvas; `mutate(clone)` may change the clone first (used for the animation layers)
  async function renderCanvas(t, mutate) {
    await document.fonts.ready;
    const clone = frameEl().cloneNode(true);
    clone.removeAttribute('id'); clone.style.transform = 'none';
    clone.querySelectorAll('.byt-slot.empty').forEach(s => { s.classList.remove('empty'); s.innerHTML = ''; });
    if (mutate) mutate(clone);
    const xhtml = new XMLSerializer().serializeToString(clone);
    const css = await embeddedFonts();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}"><foreignObject x="0" y="0" width="${t.w}" height="${t.h}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${t.w}px;height:${t.h}px"><style>${css}</style>${xhtml}</div></foreignObject></svg>`;
    // a data: URL (not a blob: URL): Chrome taints the canvas for blob: SVGs with foreignObject
    const url = 'data:image/svg+xml;base64,' + b64(new TextEncoder().encode(svg));
    await loadImage(url); await sleep(150);        // first pass warms up the embedded fonts
    const img = await loadImage(url); await sleep(60);
    const c = document.createElement('canvas'); c.width = t.w; c.height = t.h;
    c.getContext('2d').drawImage(img, 0, 0, t.w, t.h);
    return c;
  }
  async function renderBlob(t) {
    const c = await renderCanvas(t);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('PNG maken mislukt')), 'image/png'));
  }
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function fileName() {
    const t = cur.t, p = cur.props;
    const what = slug(p.title || [p.titleLine1, p.titleLine2].filter(Boolean).join(' ') || p.name || p.author || [p.homeTeam, p.awayTeam].filter(Boolean).join(' ') || p.version || p.eyebrow || '') || 'post';
    return `BYT_${t.id.replace(/^social-/, '')}_${what}.png`;
  }
  async function exportPng() {
    const btn = $('bytExport'); btn.disabled = true; status('Bezig met exporteren…');
    try {
      const t = cur.t, blob = await renderBlob(t), name = fileName();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      let saved = null;
      try { const r = await fetch('/api/export?name=' + encodeURIComponent(name), { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob }); if (r.ok) saved = await r.json(); } catch (e) { /* offline */ }
      status(saved ? `✓ Gedownload en op de server: ${saved.path}` : '✓ Gedownload');
    } catch (err) {
      status('Exporteren mislukt: ' + err.message);
    } finally { btn.disabled = false; }
  }

  function setHeader() {
    const t = cur.t, a = ASSETS[cur.asset] || {};
    $('bytTitle').textContent = a.label || t.id;
    $('bytSub').textContent = (formatsOf(cur.asset).length > 1 ? t.format + ' · ' : '') + `${t.w} × ${t.h}`;
  }
  function switchFormat(id) {
    const to = byId[id]; if (!to || to === cur.t) return;
    carryTitle(cur.t, to);
    cur.t = to; saveProps();
    try { localStorage.setItem(fmtKey(cur.asset), id); } catch (e) { /* ignore */ }
    setHeader(); buildControls(); render();
    requestAnimationFrame(fit);
  }

  // ---------- landing page cards ----------
  function buildCards() {
    const box = $('bytCards'); if (!box) return;
    box.innerHTML = '<h2 class="home-group">Templates</h2><div class="home-cards byt-cards">' + assetIds.map(id => {
      const a = ASSETS[id] || {}, fs = formatsOf(id);
      return `<button class="menu-card byt-card" data-go-byt="${id}" type="button">
        <span class="byt-thumb"><img src="socials/thumbs/${fs[0].id}.webp" alt="" loading="lazy"></span>
        <span class="menu-title">${esc(a.label || id)}</span>
        <span class="menu-desc">${esc(a.desc || '')}</span>
        <span class="menu-tags">${fs.length > 1 ? fs.map(f => `<i>${esc(f.format)}</i>`).join('') : ''}<i>PNG</i>${id === 'wedstrijd' ? '<i>Animatie</i>' : ''}</span>
      </button>`;
    }).join('') + '</div>';
  }

  window.BYT = {
    templates: TEMPLATES,
    open(id) {
      const asset = assetOf(id); if (!asset) return;
      let t = byId[id] && byId[id].asset === asset ? byId[id] : null;   // a template id opens that format
      if (!t) { let last = null; try { last = localStorage.getItem(fmtKey(asset)); } catch (e) { /* ignore */ } t = (byId[last] && byId[last].asset === asset) ? byId[last] : formatsOf(asset)[0]; }
      if (window.BYT_ANIM) window.BYT_ANIM.reset();
      cur.asset = asset; cur.t = t; cur.props = loadProps(asset); cur.photo = null;
      setHeader();
      buildControls();
      if (!bindDrag.done) { bindDrag(); bindDrag.done = true; }
      render();
      requestAnimationFrame(fit);
    },
    close() { saveProps(); if (window.BYT_ANIM) window.BYT_ANIM.reset(); },
    get state() { return cur; },
    renderBlob: () => renderBlob(cur.t),
    renderCanvas, frameEl, fileName,
  };
  buildCards();
  document.querySelectorAll('[data-go-byt]').forEach(c => c.addEventListener('click', () => document.dispatchEvent(new CustomEvent('byt-go', { detail: c.dataset.goByt }))));
})();
