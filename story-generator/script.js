(() => {
  // ---------- Shared layout (identical grid for every competition) ----------
  const CANVAS_W = 1080, CANVAS_H = 1920;
  const ROW_H = 148;
  const ROW_Y = [468, 634, 800, 966, 1132, 1298, 1464];
  const ROW_LEFT = 100, ROW_RIGHT = 980, ROW_CENTER = (ROW_LEFT + ROW_RIGHT) / 2; // 540
  const BADGE_SIZE = 130, BADGE_MARGIN = 15;

  // Crest crop within each team's 1200x200 asset. Bounds come straight from
  // "mask logo.png" (a hand-made mask: a plain white rectangle over each
  // crest, black everywhere else) so the decorative diagonal accent lines
  // never bleed into the badge. Same asset template for men and women.
  const CREST_X_LEFT = 0, CREST_X_RIGHT = 1042, CREST_Y = 19, CREST_W = 158, CREST_H = 159;

  // ---------- Per-competition config ----------
  const COMPETITIONS = {
    men: {
      label: 'Mannen',
      csvPath: 'assets/schedule_dataset_all_rounds.csv',
      teamsDir: 'assets/teams',
      footerLogo: 'assets/footer-logo.png',
      footer: { x: 198, y: 1607, w: 707, h: 174 },
      bgColor: '#1a1b38',
      titleColor: '#ffffff',
      textColor: '#1b2450',
      titleY: 283,
      titleFontSize: 108,
      resultRowBg: '#ffffff',
      scheduleRowBg: '#f9faff',
      rowBorder: null,
      cornerRadius: 0,
      badgeRadius: 0,
      titles: { results: 'RESULTS', schedule: 'SCHEDULE' },
      decorations: [],
      teamColors: {
        BEV: '#fddb75', BWH: '#6f84ba', DFS: '#ae5b53', EUP: '#fd7e79',
        HCS: '#f8d168', HCV: '#76b1dc', HUB: '#727ab3', HUP: '#fdb875',
        HVA: '#edd7aa', IZE: '#7396ba', PEL: '#db7169', SAB: '#5096dc',
        TAC: '#6fac94', VOL: '#fd9652',
      },
    },
    women: {
      label: 'Vrouwen',
      csvPath: 'assets/women/schedule_dataset_all_rounds_vrouwen.csv',
      teamsDir: 'assets/women/teams',
      footerLogo: 'assets/women/footer-logo-women.png',
      footer: { x: 193, y: 1604, w: 694, h: 147 },
      bgColor: '#ffffff',
      titleColor: '#1a1b38',
      textColor: '#1a1b38',
      titleY: 272,
      titleFontSize: 92,
      resultRowBg: '#ffffff',
      scheduleRowBg: '#f9f6fb',
      rowBorder: '#e7e0ef',
      cornerRadius: 26,
      badgeRadius: 18,
      titles: { results: 'UITSLAGEN', schedule: 'PROGRAMMA' },
      // Positioned exactly like the layers in the source .psd — offsets can
      // (and do) go negative / off-canvas, the canvas just clips them.
      decorations: [
        { src: 'assets/women/corner-lines-women.png', x: -630, y: -366 },
        { src: 'assets/women/bottom-triangle-women.png', x: 422, y: 946 },
      ],
      teamColors: {
        DSVD: '#e1471c', 'E&O': '#00a456', FOR: '#b87cff', KWI: '#fa4234',
        MHV: '#008845', PSV: '#fa4234', QUI: '#008845', SEW: '#1330b4',
        'V&L': '#005ba2', VEN: '#193676', VOC: '#4c8d40', VOL: '#f78823',
        VZV: '#ee2b07', WPK: '#3ca815',
      },
    },
  };

  let compKey = 'men';
  const comp = () => COMPETITIONS[compKey];

  const canvas = document.getElementById('posterCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const competitionTabs = document.querySelectorAll('.competition-tab');
  const roundSelect = document.getElementById('roundSelect');
  const matchesList = document.getElementById('matchesList');
  const matchesLabel = document.getElementById('matchesLabel');
  const exportBtn = document.getElementById('exportBtn');
  const modeTabs = document.querySelectorAll('.mode-tab');
  const resultTpl = document.getElementById('resultMatchRowTemplate');
  const scheduleTpl = document.getElementById('scheduleMatchRowTemplate');

  let mode = 'results'; // or 'schedule'
  let rounds = [];       // parsed from the current competition's CSV
  let fontReady = false;

  const state = {
    date: '',
    matches: Array.from({ length: 7 }, () => ({ home: '', away: '', homeScore: '', awayScore: '', time: '', played: true, showDate: false, dateLabel: '' })),
  };
  let currentRoundId = null;

  // ---------- Autosave (survives a page reload) ----------
  // Plain localStorage — per-browser, not shared between devices, but that's
  // enough to stop a refresh from wiping out scores you already typed in.
  const STORAGE_KEY = 'shl-story-generator-v1';

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        compKey, mode, roundId: currentRoundId, date: state.date, matches: state.matches,
      }));
    } catch (err) { /* private browsing / quota / disabled storage — just skip */ }
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  const savedState = loadSavedState();

  // ---------- Font ----------
  const font = new FontFace('ClashDisplay', 'url(fonts/ClashDisplay-Bold.otf)', { weight: '700' });
  font.load().then(f => { document.fonts.add(f); fontReady = true; render(); }).catch(() => {});

  // ---------- Generic cached image loader ----------
  // Keyed by the literal src string, so men's and women's assets (different
  // paths) never collide even though some team codes repeat (e.g. "VOL").
  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return null;
    if (imgCache.has(src)) return imgCache.get(src);
    const img = new Image();
    img.onload = () => render();
    img.src = src;
    imgCache.set(src, img);
    return img;
  }

  function teamImg(code) {
    if (!code) return null;
    return loadImg(`${comp().teamsDir}/${code}.png`);
  }

  const vsIcon = new Image();
  vsIcon.onload = () => render();
  vsIcon.src = 'assets/vs-icon.png';

  // Win-arrow overlays — shared art for both competitions, tinted per
  // winning team. Drawn in the SAME 1200x200 coordinate frame as the team
  // strip assets (assets/teams/*.png): the chevron art already sits at the
  // correct relative position within that frame, so it's placed exactly
  // like a team strip (full row width, same scale).
  const winArrowLeft = new Image();
  const winArrowRight = new Image();
  winArrowLeft.onload = () => render();
  winArrowRight.onload = () => render();
  winArrowLeft.src = 'assets/arrows/winst-links.png';
  winArrowRight.src = 'assets/arrows/winst-rechts.png';

  const tintCache = new Map();

  function tintImage(img, id, colorHex) {
    if (!img.naturalWidth) return null;
    const key = id + colorHex;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cc = c.getContext('2d');
    cc.drawImage(img, 0, 0);
    cc.globalCompositeOperation = 'source-in';
    cc.fillStyle = colorHex;
    cc.fillRect(0, 0, c.width, c.height);

    // naturalWidth can report ready before the image is FULLY decoded (seen
    // in practice: an early render() call — e.g. while other images are
    // still loading — tints a still-blank frame). Caching that blank result
    // would then hide the icon/arrow forever, since every later call just
    // returns the same empty canvas. Verified non-blank before caching, so
    // a bad early attempt gets retried on the next render instead of stuck.
    const data = cc.getImageData(0, 0, c.width, c.height).data;
    let hasContent = false;
    for (let i = 3; i < data.length; i += 4 * 37) { // sparse scan, plenty for a real image
      if (data[i] > 10) { hasContent = true; break; }
    }
    if (!hasContent) return null;

    tintCache.set(key, c);
    return c;
  }

  // ---------- Competition switching ----------
  const appEl = document.querySelector('.app');
  competitionTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.competition === compKey) return;
      compKey = btn.dataset.competition;
      competitionTabs.forEach(b => b.classList.toggle('active', b === btn));
      appEl.classList.toggle('theme-women', compKey === 'women');
      loadCompetition();
    });
  });

  function loadCompetition() {
    fetch(comp().csvPath)
      .then(r => r.text())
      .then(text => {
        rounds = parseCsv(text);
        populateRoundSelect();
        if (!rounds.length) return;

        // Restore a saved round + its scores, but only the first time this
        // competition loads after a page load — once the user picks a
        // different round or switches tabs by hand, start fresh from the
        // CSV like normal instead of re-restoring old data every time.
        if (savedState && savedState.compKey === compKey && savedState.roundId) {
          const round = rounds.find(r => r.id === savedState.roundId);
          if (round) {
            loadRound(round, savedState.matches);
            savedState.compKey = null; // consumed
            return;
          }
        }
        loadRound(rounds[0]);
      })
      .catch(err => console.error('Kon CSV niet laden:', err));
  }

  // ---------- Date helpers ----------
  // Bilingual (the men's CSV is English, the women's is Dutch) so the
  // "other day" auto-detection works for both without extra config.
  const MONTHS = {
    JANUARY: 0, JANUARI: 0, FEBRUARY: 1, FEBRUARI: 1, MARCH: 2, MAART: 2,
    APRIL: 3, MAY: 4, MEI: 4, JUNE: 5, JUNI: 5, JULY: 6, JULI: 6,
    AUGUST: 7, AUGUSTUS: 7, SEPTEMBER: 8, OCTOBER: 9, OKTOBER: 9,
    NOVEMBER: 10, DECEMBER: 11,
  };

  function nextDayLabel(datum) {
    // "SATURDAY 19 SEPTEMBER" / "ZATERDAG 19 SEPTEMBER" -> "20-09". Short
    // numeric date (day-month) — a full weekday+month label was too wide
    // for the row. A Date object is only used for the day/month rollover
    // arithmetic, with a throwaway reference year (the season's actual
    // years aren't known here).
    const m = /^([A-Z]+)\s+(\d+)\s+([A-Z]+)/i.exec((datum || '').toUpperCase());
    if (!m) return '';
    const monthIdx = MONTHS[m[3]];
    if (monthIdx === undefined) return '';
    const d = new Date(2024, monthIdx, parseInt(m[2], 10));
    d.setDate(d.getDate() + 1);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}`;
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      const dataset = cols[0];
      const datum = cols[1];
      const roundMatch = /ronde(\d+)/i.exec(dataset);
      const roundNum = roundMatch ? Number(roundMatch[1]) : i;

      // Some rounds span two days (dataset id ends in e.g. "_satsun" or
      // "_tuewedthu"). The CSV only gives one date (the first day), and
      // doesn't say which match is on which day — but in practice the
      // extra day's match(es) are the ones with a clearly earlier kickoff
      // (an afternoon slot before 18:00) while the rest play in the evening.
      const daySuffix = dataset.includes('_') ? dataset.split('_')[1] : '';
      const isMultiDay = /sun/.test(daySuffix) || (daySuffix.match(/tue|wed|thu|fri/g) || []).length > 1;
      const otherDayLabel = isMultiDay ? nextDayLabel(datum) : '';

      const matches = [];
      for (let m = 0; m < 7; m++) {
        const base = 2 + m * 3;
        const time = cols[base];
        const home = (cols[base + 1] || '').replace(/\.png$/i, '');
        const away = (cols[base + 2] || '').replace(/\.png$/i, '');
        const hour = parseInt((time || '').split(':')[0], 10);
        const otherDay = isMultiDay && !isNaN(hour) && hour < 18;
        matches.push({ time, home, away, otherDay, otherDayLabel: otherDay ? otherDayLabel : '' });
      }
      rows.push({ id: dataset, roundNum, datum, matches });
    }
    return rows;
  }

  function populateRoundSelect() {
    roundSelect.innerHTML = '';
    rounds.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `Ronde ${r.roundNum} — ${r.datum}`;
      roundSelect.appendChild(opt);
    });
  }

  roundSelect.addEventListener('change', () => {
    const round = rounds.find(r => r.id === roundSelect.value);
    if (round) loadRound(round);
  });

  function loadRound(round, restoreMatches) {
    currentRoundId = round.id;
    roundSelect.value = round.id;
    state.date = round.datum;
    state.matches = (restoreMatches && restoreMatches.length === round.matches.length)
      ? restoreMatches
      : round.matches.map(m => ({
        home: m.home, away: m.away,
        homeScore: '', awayScore: '',
        time: m.time,
        // A match auto-flagged as being on the round's other day (see
        // parseCsv) starts pre-toggled to "nog te spelen" with its date
        // shown — still fully editable per row afterwards.
        played: !m.otherDay,
        showDate: m.otherDay,
        dateLabel: m.otherDayLabel,
      }));
    buildMatchRows();
    render();
  }

  // ---------- Mode switching ----------
  modeTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      modeTabs.forEach(b => b.classList.toggle('active', b === btn));
      matchesLabel.textContent = mode === 'results' ? 'Wedstrijden — vul de scores in' : 'Wedstrijden — tijd is aanpasbaar';
      buildMatchRows();
      render();
    });
  });

  // ---------- Match row UI ----------
  function buildMatchRows() {
    matchesList.innerHTML = '';
    const tpl = mode === 'results' ? resultTpl : scheduleTpl;
    const teamCodes = Object.keys(comp().teamColors).sort();
    state.matches.forEach((m, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const homeLogo = node.querySelector('.home-chip .team-logo');
      const homeSelect = node.querySelector('.home-chip .team-select');
      const awayLogo = node.querySelector('.away-chip .team-logo');
      const awaySelect = node.querySelector('.away-chip .team-select');

      // The panel thumbnail uses the same wide 1200x200 asset as the canvas.
      // Scaled to a 28px-tall chip that's ~0.14x, so the crest natively at
      // x:0-190 (home) or x:1010-1200 (away) is shifted into view instead of
      // showing the whole wide strip shrunk down to an unreadable sliver.
      function fillTeamSelect(select, code) {
        select.innerHTML = '';
        teamCodes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = c;
          if (c === code) opt.selected = true;
          select.appendChild(opt);
        });
      }

      fillTeamSelect(homeSelect, m.home);
      homeLogo.src = m.home ? `${comp().teamsDir}/${m.home}.png` : '';
      homeLogo.style.left = '0px';
      fillTeamSelect(awaySelect, m.away);
      awayLogo.src = m.away ? `${comp().teamsDir}/${m.away}.png` : '';
      awayLogo.style.left = '-141px';

      homeSelect.addEventListener('change', () => {
        m.home = homeSelect.value;
        homeLogo.src = `${comp().teamsDir}/${m.home}.png`;
        render();
      });
      awaySelect.addEventListener('change', () => {
        m.away = awaySelect.value;
        awayLogo.src = `${comp().teamsDir}/${m.away}.png`;
        render();
      });

      if (mode === 'results') {
        const homeInput = node.querySelector('.home-score');
        const awayInput = node.querySelector('.away-score');
        const scorePair = node.querySelector('.score-pair');
        const upcomingTime = node.querySelector('.upcoming-time');
        const upcomingCheckbox = node.querySelector('.upcoming-checkbox');
        const dateRow = node.querySelector('.upcoming-date-row');
        const showDateCheckbox = node.querySelector('.show-date-checkbox');
        const dateLabelInput = node.querySelector('.date-label-input');

        homeInput.value = m.homeScore;
        awayInput.value = m.awayScore;
        upcomingTime.value = m.time;
        upcomingCheckbox.checked = !m.played;
        scorePair.hidden = !m.played;
        upcomingTime.hidden = m.played;
        dateRow.hidden = m.played;
        showDateCheckbox.checked = m.showDate;
        dateLabelInput.value = m.dateLabel;
        dateLabelInput.hidden = !m.showDate;

        homeInput.addEventListener('input', () => { m.homeScore = homeInput.value; render(); });
        awayInput.addEventListener('input', () => { m.awayScore = awayInput.value; render(); });
        upcomingTime.addEventListener('input', () => { m.time = upcomingTime.value; render(); });
        upcomingCheckbox.addEventListener('change', () => {
          m.played = !upcomingCheckbox.checked;
          scorePair.hidden = !m.played;
          upcomingTime.hidden = m.played;
          dateRow.hidden = m.played;
          render();
        });
        showDateCheckbox.addEventListener('change', () => {
          m.showDate = showDateCheckbox.checked;
          dateLabelInput.hidden = !m.showDate;
          render();
        });
        dateLabelInput.addEventListener('input', () => { m.dateLabel = dateLabelInput.value; render(); });
      } else {
        const timeInput = node.querySelector('.time-input');
        const showDateCheckbox = node.querySelector('.show-date-checkbox');
        const dateLabelInput = node.querySelector('.date-label-input');

        timeInput.value = m.time;
        showDateCheckbox.checked = m.showDate;
        dateLabelInput.value = m.dateLabel;
        dateLabelInput.hidden = !m.showDate;

        timeInput.addEventListener('input', () => { m.time = timeInput.value; render(); });
        showDateCheckbox.addEventListener('change', () => {
          m.showDate = showDateCheckbox.checked;
          dateLabelInput.hidden = !m.showDate;
          render();
        });
        dateLabelInput.addEventListener('input', () => { m.dateLabel = dateLabelInput.value; render(); });
      }

      matchesList.appendChild(node);
    });
  }

  // ---------- Drawing helpers ----------
  function roundedRectPath(c, x, y, w, h, r) {
    if (r <= 0) { c.beginPath(); c.rect(x, y, w, h); return; }
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function fillRow(c, x, y, w, h, fillStyle, radius, borderStyle) {
    roundedRectPath(c, x, y, w, h, radius);
    c.fillStyle = fillStyle;
    c.fill();
    if (borderStyle) {
      c.lineWidth = 2;
      c.strokeStyle = borderStyle;
      c.stroke();
    }
  }

  function drawBadge(c, img, cropX, cx, cy, radius) {
    const box = BADGE_SIZE;
    const x0 = cx - box / 2, y0 = cy - box / 2;
    c.save();
    roundedRectPath(c, x0, y0, box, box, radius);
    c.clip();
    c.fillStyle = '#ffffff';
    c.fillRect(x0, y0, box, box);
    if (img && img.complete && img.naturalWidth) {
      const scale = Math.min(box / CREST_W, box / CREST_H);
      const dw = CREST_W * scale, dh = CREST_H * scale;
      const dx = x0 + (box - dw) / 2, dy = y0 + (box - dh) / 2;
      c.drawImage(img, cropX, CREST_Y, CREST_W, CREST_H, dx, dy, dw, dh);
    }
    c.restore();
  }

  function drawStrip(c, img, side, x0, x1, cy) {
    // side: 'left' -> crop native (0,0,600,200); 'right' -> crop (600,0,600,200)
    if (!img || !img.complete || !img.naturalWidth) return;
    const w = x1 - x0;
    const scale = w / 600;
    const dh = 200 * scale;
    const dy = cy - dh / 2;
    const sx = side === 'left' ? 0 : 600;
    c.drawImage(img, sx, 0, 600, 200, x0, dy, w, dh);
  }

  // ---------- Main render ----------
  function render() {
    const C = comp();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = C.bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    C.decorations.forEach(d => {
      const img = loadImg(d.src);
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, d.x, d.y);
      }
    });

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.titleColor;
    ctx.font = `700 ${C.titleFontSize}px "${fontFamily}"`;
    ctx.fillText(mode === 'results' ? C.titles.results : C.titles.schedule, CANVAS_W / 2, C.titleY);

    state.matches.forEach((m, i) => {
      const cy = ROW_Y[i];
      try {
        // A round can be partly played: rows the user marked "nog te
        // spelen" render as a schedule row (time) even while the poster's
        // overall mode is Results, so one story can show a mix of both.
        const showAsSchedule = mode === 'schedule' || m.played === false;
        if (showAsSchedule) drawScheduleRow(m, cy, fontFamily, C);
        else drawResultRow(m, cy, fontFamily, C);
      } catch (err) {
        console.error('Kon wedstrijd niet tekenen:', m, err);
      }
    });

    const footerImg = loadImg(C.footerLogo);
    if (footerImg && footerImg.complete && footerImg.naturalWidth) {
      ctx.drawImage(footerImg, C.footer.x, C.footer.y, C.footer.w, C.footer.h);
    }

    saveState();
  }

  function drawResultRow(m, cy, fontFamily, C) {
    fillRow(ctx, ROW_LEFT, cy - ROW_H / 2, ROW_RIGHT - ROW_LEFT, ROW_H, C.resultRowBg, C.cornerRadius, C.rowBorder);

    const leftBadgeCx = ROW_LEFT + BADGE_MARGIN + BADGE_SIZE / 2;
    const rightBadgeCx = ROW_RIGHT - BADGE_MARGIN - BADGE_SIZE / 2;
    drawBadge(ctx, teamImg(m.home), CREST_X_LEFT, leftBadgeCx, cy, C.badgeRadius);
    drawBadge(ctx, teamImg(m.away), CREST_X_RIGHT, rightBadgeCx, cy, C.badgeRadius);

    const homeNum = parseFloat(m.homeScore);
    const awayNum = parseFloat(m.awayScore);
    const bothNumeric = !isNaN(homeNum) && !isNaN(awayNum);
    let homeAlpha = 1, awayAlpha = 1, winner = null;
    if (bothNumeric) {
      if (homeNum > awayNum) { awayAlpha = 0.35; winner = 'home'; }
      else if (awayNum > homeNum) { homeAlpha = 0.35; winner = 'away'; }
      else { homeAlpha = 0.35; awayAlpha = 0.35; }
    }

    if (winner) {
      // Win-arrow overlay, positioned exactly like a team strip: full row
      // width, same 1200:rowWidth scale — the chevron art already sits at
      // the right spot within that 1200x200 frame.
      const winnerCode = winner === 'home' ? m.home : m.away;
      const tintColor = C.teamColors[winnerCode] || '#caff1c';
      const arrowImg = winner === 'home' ? winArrowLeft : winArrowRight;
      const tinted = tintImage(arrowImg, winner === 'home' ? 'awL' : 'awR', tintColor);
      if (tinted) {
        const scale = (ROW_RIGHT - ROW_LEFT) / 1200;
        const dh = 200 * scale;
        ctx.drawImage(tinted, ROW_LEFT, cy - dh / 2, ROW_RIGHT - ROW_LEFT, dh);
      }
    }

    // The neutral SHL mark always sits in the middle — win or no win —
    // drawn on top of the chevron (if any) so it stays legible.
    {
      const tinted = tintImage(vsIcon, 'vs', C.textColor);
      if (tinted) {
        const ih = ROW_H * 0.48;
        const iw = ih * (tinted.width / tinted.height);
        ctx.drawImage(tinted, ROW_CENTER - iw / 2, cy - ih / 2, iw, ih);
      }
    }

    const fontSize = ROW_H * 0.62;
    const gap = fontSize * 0.62;
    ctx.font = `700 ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = C.textColor;
    if (m.homeScore !== '') {
      ctx.globalAlpha = homeAlpha;
      ctx.textAlign = 'right';
      ctx.fillText(m.homeScore, ROW_CENTER - gap, cy);
    }
    if (m.awayScore !== '') {
      ctx.globalAlpha = awayAlpha;
      ctx.textAlign = 'left';
      ctx.fillText(m.awayScore, ROW_CENTER + gap, cy);
    }
    ctx.globalAlpha = 1;
  }

  function drawScheduleRow(m, cy, fontFamily, C) {
    // Matches the pale background baked into the team strip art itself
    // (assets/teams/*.png), so the drawn strip has no visible seam against
    // the row behind it.
    fillRow(ctx, ROW_LEFT, cy - ROW_H / 2, ROW_RIGHT - ROW_LEFT, ROW_H, C.scheduleRowBg, C.cornerRadius, C.rowBorder);

    const innerLeft = ROW_LEFT + BADGE_MARGIN;
    const innerRight = ROW_RIGHT - BADGE_MARGIN;
    drawStrip(ctx, teamImg(m.home), 'left', innerLeft, ROW_CENTER, cy);
    drawStrip(ctx, teamImg(m.away), 'right', ROW_CENTER, innerRight, cy);

    ctx.fillStyle = C.textColor;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1;

    if (m.showDate && m.dateLabel) {
      // Still-to-play match on a different day than the poster's main date
      // (e.g. one Sunday game amid a Saturday result round) — show both,
      // day on top of the time, so it isn't mistaken for the round's date.
      const dateFontSize = ROW_H * 0.16;
      const timeFontSize = ROW_H * 0.3;
      ctx.font = `700 ${dateFontSize}px "${fontFamily}"`;
      ctx.fillText(m.dateLabel, ROW_CENTER, cy - timeFontSize * 0.45);
      ctx.font = `700 ${timeFontSize}px "${fontFamily}"`;
      ctx.fillText(m.time || '', ROW_CENTER, cy + dateFontSize * 0.55);
    } else {
      const fontSize = ROW_H * 0.34;
      ctx.font = `700 ${fontSize}px "${fontFamily}"`;
      ctx.fillText(m.time || '', ROW_CENTER, cy);
    }
  }

  // ---------- Export ----------
  exportBtn.addEventListener('click', () => {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = (compKey + '-' + mode + '-' + (state.date || 'story')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.download = `${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  // Restore the last-used competition/mode before the first load, so a
  // reload lands back where the user left off (loadCompetition() then picks
  // up the matching round + scores via savedState above).
  if (savedState) {
    if (savedState.compKey && COMPETITIONS[savedState.compKey]) {
      compKey = savedState.compKey;
      competitionTabs.forEach(b => b.classList.toggle('active', b.dataset.competition === compKey));
      appEl.classList.toggle('theme-women', compKey === 'women');
    }
    if (savedState.mode === 'results' || savedState.mode === 'schedule') {
      mode = savedState.mode;
      modeTabs.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      matchesLabel.textContent = mode === 'results' ? 'Wedstrijden — vul de scores in' : 'Wedstrijden — tijd is aanpasbaar';
    }
  }

  buildMatchRows();
  loadCompetition();
})();
