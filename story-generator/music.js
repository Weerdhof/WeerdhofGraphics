// Music under the exported videos.
//  - Built-in tracks: original high-energy electronic loops, synthesised here with the Web Audio API (no audio files,
//    nothing to license). Rendered offline to a buffer, so the result is the same every time.
//  - Own tracks: audio files listed in assets/music/manifest.json ([{ "name": "...", "file": "track.mp3" }]).
// Used by script.js (SHL videos): ShlMusic.prepare(choice, totalMs, dropMs) -> { tracks, start(), close() } or null.
(function () {
  const SR = 44100;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // root = MIDI note of the bass, prog = chord roots (semitones) with their quality, arp = indexes into the chord tones
  const PRESETS = {
    neon:    { name: 'Neon Rush · 128 BPM',     bpm: 128, root: 33, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], arp: [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 3, 4, 3, 2, 1], lead: 'saw', swing: 0 },
    pulse:   { name: 'Pulse Drive · 140 BPM',   bpm: 140, root: 29, prog: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']], arp: [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 3, 4, 3, 2, 3], lead: 'square', swing: 0 },
    stadium: { name: 'Stadium Surge · 124 BPM', bpm: 124, root: 38, prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-2, 'M']], arp: [0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3, 2, 1], lead: 'saw', swing: 0 },
    night:   { name: 'Night Run · 150 BPM',     bpm: 150, root: 40, prog: [[0, 'm'], [-4, 'M'], [-7, 'M'], [-5, 'M']], arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 3, 1, 2, 0], lead: 'square', swing: 0 },
  };

  function noiseBuffer(oc) {
    const b = oc.createBuffer(1, SR, SR), d = b.getChannelData(0);
    let seed = 12345;                                        // fixed seed: the same noise every render
    for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
    return b;
  }

  // durSec = length of the track; dropSec = when the full groove kicks in (before it: riser + snare roll, no kick or bass)
  function renderPreset(key, durSec, dropSec) {
    const P = PRESETS[key];
    const len = Math.ceil(durSec * SR);
    const oc = new OfflineAudioContext(2, len, SR);
    const noise = noiseBuffer(oc);
    const spb = 60 / P.bpm, s16 = spb / 4;

    const master = oc.createGain(); master.gain.value = 0.9;
    const comp = oc.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
    // soft limiter at the end, so the peaks never clip
    const sat = oc.createWaveShaper(), curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4) * 0.95; }
    sat.curve = curve;
    master.connect(comp); comp.connect(sat); sat.connect(oc.destination);
    // fades: quick in (a longer build when there is an opening), out over the last 1.2 s
    const fin = dropSec > 0 ? 0.05 : 0.15;
    master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(0.9, fin);
    master.gain.setValueAtTime(0.9, Math.max(fin, durSec - 1.2)); master.gain.linearRampToValueAtTime(0, durSec);

    // the pump: everything melodic ducks on every beat (sidechain feel)
    const pump = oc.createGain(); pump.connect(master);
    for (let t = dropSec; t < durSec; t += spb) {
      pump.gain.setValueAtTime(0.25, t); pump.gain.linearRampToValueAtTime(1, t + spb * 0.55);
    }
    // echo for the arp
    const echoIn = oc.createGain(), echo = oc.createDelay(1), fb = oc.createGain(), echoOut = oc.createGain();
    echo.delayTime.value = s16 * 3; fb.gain.value = 0.32; echoOut.gain.value = 0.4;
    echoIn.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(echoOut); echoOut.connect(pump);

    const env = (g, t, a, peak, d, end) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const noiseHit = (t, type, f, q, peak, dur, dest) => {
      const s = oc.createBufferSource(); s.buffer = noise; s.loop = true;
      const fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = oc.createGain(); env(g, t, 0.002, peak, dur);
      s.connect(fl); fl.connect(g); g.connect(dest || master); s.start(t, 0); s.stop(t + dur + 0.05);
    };
    const kick = (t) => {
      const o = oc.createOscillator(), g = oc.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
      g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
    };
    const clap = (t) => { noiseHit(t, 'bandpass', 1700, 0.8, 0.55, 0.2); noiseHit(t + 0.012, 'bandpass', 2300, 0.8, 0.4, 0.16); };
    const hat = (t, open) => noiseHit(t, 'highpass', 8500, 0.7, open ? 0.22 : 0.12, open ? 0.2 : 0.04);
    const synth = (t, midi, type, len, cutoff, peak, dest, detune) => {
      const g = oc.createGain(), fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 5;
      fl.frequency.setValueAtTime(cutoff * 2.4, t); fl.frequency.exponentialRampToValueAtTime(cutoff, t + len * 0.8);
      env(g, t, 0.005, peak, len);
      [0, detune || 0].forEach((dt, i) => {
        if (i && !detune) return;
        const o = oc.createOscillator(); o.type = type; o.frequency.value = mtof(midi); o.detune.value = dt;
        o.connect(fl); o.start(t); o.stop(t + len + 0.1);
      });
      fl.connect(g); g.connect(dest || pump);
    };

    // build-up before the drop: a rising noise sweep and a snare roll that speeds up
    if (dropSec > 0.1) {
      const rs = oc.createBufferSource(); rs.buffer = noise; rs.loop = true;
      const rf = oc.createBiquadFilter(); rf.type = 'bandpass'; rf.Q.value = 2.5;
      rf.frequency.setValueAtTime(300, 0); rf.frequency.exponentialRampToValueAtTime(9000, dropSec);
      const rg = oc.createGain(); rg.gain.setValueAtTime(0.0001, 0); rg.gain.exponentialRampToValueAtTime(0.5, dropSec - 0.05); rg.gain.linearRampToValueAtTime(0, dropSec);
      rs.connect(rf); rf.connect(rg); rg.connect(master); rs.start(0); rs.stop(dropSec);
      // a soft pulse so the opening already has a heartbeat
      for (let t = 0; t < dropSec - 0.3; t += spb) { const o = oc.createOscillator(), g = oc.createGain(); o.type = 'sine'; o.frequency.value = 55; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3); }
      let gap = spb / 2;
      for (let t = Math.max(0, dropSec - spb * 2); t < dropSec - 0.02; t += gap) { noiseHit(t, 'bandpass', 2000, 0.8, 0.25 + 0.3 * (1 - (dropSec - t) / (spb * 2)), 0.12); gap = Math.max(0.05, gap * 0.78); }
      noiseHit(dropSec, 'highpass', 5000, 0.5, 0.5, 1.4);       // crash on the drop
    }

    // the groove
    const steps = Math.floor((durSec - dropSec) / s16);
    for (let n = 0; n < steps; n++) {
      const t = dropSec + n * s16, st = n % 16, bar = Math.floor(n / 16), ch = P.prog[Math.floor(bar / 2) % P.prog.length];
      const rootMidi = P.root + ch[0], third = ch[1] === 'm' ? 3 : 4;
      const tones = [0, third, 7, 12, 12 + third, 19];
      if (st % 4 === 0) kick(t);
      if (st === 4 || st === 12) clap(t);
      if (st % 4 === 2) hat(t, true); else if (st % 2 === 1 || st % 4 === 0) hat(t, false);
      if (st % 4 === 2) synth(t, rootMidi, 'sawtooth', s16 * 3.4, 380, 0.5);                       // off-beat bass
      if (st === 0 && n % 32 === 0) [0, third, 7].forEach((iv) => synth(t, rootMidi + 24 + iv, 'sawtooth', spb * 3.5, 1500, 0.1, null, 9));   // chord pad
      if (bar >= 1) synth(t, rootMidi + 24 + tones[P.arp[st] % tones.length], P.lead === 'square' ? 'square' : 'sawtooth', s16 * 0.9, 2600, 0.11, echoIn);
    }
    return oc.startRendering();
  }

  // own tracks: decode, loop to the length of the video, fade out
  async function renderFile(url, durSec) {
    const res = await fetch(url); if (!res.ok) throw new Error('track niet gevonden');
    const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 2, SR);
    const src = await ac.decodeAudioData(await res.arrayBuffer());
    const oc = new OfflineAudioContext(2, Math.ceil(durSec * SR), SR);
    const s = oc.createBufferSource(); s.buffer = src; s.loop = true;
    const g = oc.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.2);
    g.gain.setValueAtTime(1, Math.max(0.2, durSec - 1.2)); g.gain.linearRampToValueAtTime(0, durSec);
    s.connect(g); g.connect(oc.destination); s.start(0);
    return oc.startRendering();
  }

  async function renderChoice(choice, durSec, dropSec) {
    if (choice.indexOf('preset:') === 0) return renderPreset(choice.slice(7), durSec, dropSec);
    if (choice.indexOf('file:') === 0) return renderFile('assets/music/' + encodeURIComponent(choice.slice(5)), durSec);
    return null;
  }

  // for a recording: an audio track that starts when start() is called
  async function prepare(choice, totalMs, dropMs) {
    if (!choice || choice === 'none') return null;
    const buf = await renderChoice(choice, totalMs / 1000, dropMs / 1000);
    if (!buf) return null;
    const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    const dest = ac.createMediaStreamDestination();
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
    return {
      tracks: dest.stream.getAudioTracks(),
      start: () => { if (ac.state === 'suspended') ac.resume(); src.start(); },
      close: () => { try { src.stop(); } catch (e) {} ac.close(); },
    };
  }

  // a short listen in the browser
  let previewCtx = null, previewSrc = null;
  async function preview(choice, dropMs) {
    stopPreview();
    const buf = await renderChoice(choice, 12, (dropMs || 0) / 1000);
    if (!buf) return;
    previewCtx = new (window.AudioContext || window.webkitAudioContext)();
    previewSrc = previewCtx.createBufferSource(); previewSrc.buffer = buf; previewSrc.connect(previewCtx.destination);
    previewSrc.onended = stopPreview; previewSrc.start();
  }
  function stopPreview() {
    if (previewSrc) { previewSrc.onended = null; try { previewSrc.stop(); } catch (e) {} }
    if (previewCtx) previewCtx.close();
    previewCtx = previewSrc = null;
  }

  window.ShlMusic = { PRESETS, prepare, preview, stopPreview, isPlaying: () => !!previewSrc, renderChoice };
})();
