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
      // Distinctive lowercase substrings to recognize each team in the free-text
      // results feed from superhandballeague.com (e.g. "Sezoens Achilles
      // Bocholt HS1") — matched against the whole scraped name, so exact
      // spelling/suffix differences ("HS1", sponsor prefixes) don't matter.
      resultAliases: {
        SAB: ['bocholt'],
        IZE: ['izegem'],
        EUP: ['eupen'],
        HCS: ['sprimont'],
        BEV: ['bevo'],
        PEL: ['pelt'],
        BWH: ['hercules', 'whc'],
        DFS: ['arnhem'],
        HUP: ['hurry'],
        HCV: ['vise', 'visé'],
        // "Aalsmeer" in the results feed, but "RoyalFloraHolland/HVA" in
        // the standings table — same team, two different display names.
        HVA: ['aalsmeer', 'royalfloraholland'],
        HUB: ['hubo'],
        VOL: ['volendam'],
        TAC: ['tachos', 'mossel', 'witte ster'],
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

  // ---------- Single-match template (Mannen only) ----------
  // A separate one-off graphic (Instagram feed post, 1080x1350) built from
  // its own PSD, independent of the per-round COMPETITIONS config above:
  // each team's own PNG (assets/singlematch/teams/*.png) already has its
  // color, crest and name baked in as finished art, so there's no separate
  // teamColors map or tinting step needed here — just crop the matching
  // half and place it.
  const SM_CANVAS_W = 1080, SM_CANVAS_H = 1350;
  // Each half of a team's 1932x510 asset is a self-contained card at 2x
  // resolution (966x510) — scaling it down UNIFORMLY by 0.5 (to 483x255,
  // half of the PSD's own 966-wide LINKS/RECHTS bbox) keeps crests round
  // instead of squashed, and naturally leaves the center gap for the
  // time/date text that the PSD's own (unreproducible outside Photoshop)
  // inter-layer clipping otherwise provided.
  const SM_TEAM_W = 483, SM_TEAM_Y = 904, SM_TEAM_H = 255;
  const SM_TEAM_LEFT_X = 55, SM_TEAM_RIGHT_X = 1021 - SM_TEAM_W;
  const SM_MARK = { x: 444, y: 904, w: 181, h: 156 };
  const SM_FOOTER = { x: 306, y: 1191, w: 478, h: 117 };
  const SM_TEXT_COLOR = '#14142b';
  const SM_TIME_Y = 1090, SM_TIME_FONT = 61;
  const SM_DATE_Y = 1131, SM_DATE_FONT = 26;
  const SM_CENTER_X = 540;

  const SM_TEAM_NAMES = {
    SAB: 'Sezoens Achilles Bocholt', IZE: 'Besox HBC Izegem', EUP: 'KTSV Eupen',
    SPR: 'Sprimont', BEV: 'HUMBY BEVO HC', PEL: 'Derdaele/Sporting Pelt',
    BWH: 'B&B Healthcare/WHC-Hercules', DFS: 'DFS Arnhem', HUP: 'JD Techniek/Hurry-up',
    HCV: 'HC Visé BM', HVA: 'RoyalFloraHolland/HVA', HUB: 'HUBO Handbal',
    VOL: 'KRAS/Volendam', TAC: 'van Mossel/MGTachos/Witte Ster',
  };
  const SM_TEAM_CODES = Object.keys(SM_TEAM_NAMES).sort();

  // The Results/Schedule/Ranking team-code set uses "HCS" for the same club
  // the single-match/site-scrape data calls "SPR" (Sprimont) — same names
  // otherwise, so just re-key that one entry rather than keeping a second
  // full copy of the list.
  const MEN_TEAM_NAMES = { ...SM_TEAM_NAMES, HCS: SM_TEAM_NAMES.SPR };
  delete MEN_TEAM_NAMES.SPR;

  let smMatches = []; // parsed from assets/singlematch/schedule_per_match_all.csv
  const smState = { id: '', home: '', away: '', time: '', homeScore: '', awayScore: '', dateRound: '' };

  // Optional user-uploaded photo behind the single-match graphic (Mannen
  // Match/Matchresult only). In-memory only — not persisted via saveState,
  // since it's a large per-session convenience, not fixture data.
  let bgPhotoImg = null;
  let bgPhotoScale = 1; // user zoom on top of the auto "cover" fit
  let bgPhotoOffsetX = 0, bgPhotoOffsetY = 0; // pan, in canvas pixels

  function bgPhotoCoverScale(img) {
    return Math.max(SM_CANVAS_W / img.naturalWidth, SM_CANVAS_H / img.naturalHeight);
  }

  function clampBgPhotoOffsets() {
    if (!bgPhotoImg) return;
    const s = bgPhotoCoverScale(bgPhotoImg) * bgPhotoScale;
    const dw = bgPhotoImg.naturalWidth * s, dh = bgPhotoImg.naturalHeight * s;
    const maxX = Math.max(0, (dw - SM_CANVAS_W) / 2);
    const maxY = Math.max(0, (dh - SM_CANVAS_H) / 2);
    bgPhotoOffsetX = Math.max(-maxX, Math.min(maxX, bgPhotoOffsetX));
    bgPhotoOffsetY = Math.max(-maxY, Math.min(maxY, bgPhotoOffsetY));
  }

  function drawBgPhotoCover(c, img) {
    const s = bgPhotoCoverScale(img) * bgPhotoScale;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const dx = (SM_CANVAS_W - dw) / 2 + bgPhotoOffsetX;
    const dy = (SM_CANVAS_H - dh) / 2 + bgPhotoOffsetY;
    c.drawImage(img, dx, dy, dw, dh);
  }

  // ---------- Ranking template (Mannen only) ----------
  // Same 1080x1920 canvas as Results/Schedule, built from its own PSD
  // (MEN-RANKING.psd): a static background (card, divider lines after
  // position 8 and 10, decorations, footer) with 14 data rows drawn on top.
  // Uses the men competition's own team codes/crests/colors — this table
  // reflects the whole league standing, not a fixed CSV fixture list, so
  // it's plain manual entry rather than CSV-driven like the other modes.
  // Measured directly off the current PSD (its own layout was updated since
  // this was first built), then shifted 48px left so the card sits centered
  // on the 1080-wide canvas instead of the PSD's own off-center placement.
  // Row top/height are solved from the two divider lines' actual positions
  // (999-1006 and 1185-1193, i.e. after row 8 and row 10) rather than the
  // badge asset's own bounding box, which didn't divide evenly into 14
  // equal rows aligned with those dividers.
  const RANK_ROWS = 14;
  const RANK_ROW_H = 93.25, RANK_ROW_TOP = 256.5;
  const RANK_BADGE_CX = 341, RANK_BADGE_SIZE = 74, RANK_BADGE_PAD = 6;
  const RANK_NUM_X = 215, RANK_CODE_X = 424, RANK_P_X = 615, RANK_PTS_X = 752;
  const RANK_HEADER_Y = 236, RANK_HEADER_FONT = 36;
  // Calibrated so the rendered cap-height matches the reference (measured
  // ~40px there): this font's cap-height is ~0.667x its CSS size, so 60px
  // gets back to a 40px cap-height — the previous 36px was undersized.
  const RANK_DATA_FONT = 60;
  const RANK_TEXT_COLOR = '#14142b';
  // Shifted the same -48px as the card, so the mark keeps its original
  // relationship of overlapping the card's top-right corner.
  const RANK_MARK = { x: 844, y: 84, w: 153, h: 176 };
  const RANK_CARD_LEFT = 174, RANK_CARD_RIGHT = 906;
  const RANK_CARD_TOP = 170, RANK_CARD_BOTTOM = 1619;
  const RANK_DIVIDER_COLOR = 'rgb(243, 85, 122)';
  const RANK_DIVIDER_Y = [999, 1185]; // after position 8 and position 10
  const RANK_DIVIDER_H = 7;
  const RANK_BOTTOM_BAR_Y = 1587, RANK_BOTTOM_BAR_H = 32;

  // Women's ranking has no source PSD (unlike men's) — built programmatically
  // instead of from extracted assets, echoing the Vrouwen results/schedule
  // look (white card, rounded corners, purple/pink accent) and reusing that
  // template's own row margins (100-980) for consistency with those posters.
  const WRANK_CARD_LEFT = 100, WRANK_CARD_RIGHT = 980;
  // Card bottom sits well clear of row 14 + the bottom accent bar's own
  // height (see WRANK_BOTTOM_ACCENT_H) — the original 1610 left virtually
  // no room and the last row collided with the bar.
  const WRANK_CARD_TOP = 180, WRANK_CARD_BOTTOM = 1660;
  const WRANK_ROW_TOP = 258, WRANK_ROW_H = 96.5;
  // Badges are full circles (radius = half the size) per the official
  // SHLW2627templateranking.psd reference, not the rounded squares used
  // elsewhere in the app.
  const WRANK_BADGE_CX = 296, WRANK_BADGE_SIZE = 74, WRANK_BADGE_RADIUS = WRANK_BADGE_SIZE / 2;
  const WRANK_NUM_X = 144, WRANK_CODE_X = 390, WRANK_P_X = 668, WRANK_PTS_X = 832;
  // Same font sizes as the Mannen ranking (calibrated against ClashDisplay's
  // actual cap-height, not just the PSD's raw FontSize value).
  const WRANK_HEADER_Y = 220, WRANK_HEADER_FONT = 36, WRANK_DATA_FONT = 60;
  const WRANK_TEXT_COLOR = '#1a1b38';
  const WRANK_CARD_BG = '#f9f6fb', WRANK_CARD_BORDER = '#e7e0ef', WRANK_CARD_RADIUS = 26;
  // Sampled from colormash/WOMENPURPLE.png — this competition's own brand
  // gradient (also used for the bottom accent bar).
  const WRANK_DIVIDER_COLOR = 'rgb(211, 82, 252)';
  const WRANK_DIVIDER_Y = [WRANK_ROW_TOP + 8 * WRANK_ROW_H, WRANK_ROW_TOP + 10 * WRANK_ROW_H];
  const WRANK_DIVIDER_H = 6;
  const WRANK_BOTTOM_ACCENT_H = 32;
  const WRANK_CORNER_DECO = { x: -560, y: -420 };
  // The shared C.footer position (tuned for Results/Schedule) sits almost
  // flush with this card's own bottom edge — give the ranking its own,
  // slightly lower Y so the logo doesn't crowd the card.
  const WRANK_FOOTER_Y = 1700;

  const rankState = {
    men: Array.from({ length: RANK_ROWS }, () => ({ code: '', p: '', pts: '' })),
    women: Array.from({ length: RANK_ROWS }, () => ({ code: '', p: '', pts: '' })),
  };

  let compKey = 'men';
  const comp = () => COMPETITIONS[compKey];

  const canvas = document.getElementById('posterCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const competitionTabs = document.querySelectorAll('.competition-tab');
  const roundSelect = document.getElementById('roundSelect');
  const roundSelectLabel = document.getElementById('roundSelectLabel');
  const roundSelectField = document.getElementById('roundSelectField');
  const rankingHeader = document.getElementById('rankingHeader');
  const matchesList = document.getElementById('matchesList');
  const matchesLabel = document.getElementById('matchesLabel');
  const modeHint = document.getElementById('modeHint');

  // Single source of truth for the label + help text below the entry list,
  // so switching modes can't leave stale advice showing (e.g. "kies een
  // speelronde" while in Match mode, which has no speelronde at all).
  function updateHint() {
    if (mode === 'match') {
      matchesLabel.textContent = 'Tijd & teams';
      modeHint.textContent = 'Kies een wedstrijd — teams en tijd worden automatisch ingevuld, de datum/ronde kun je aanpassen.';
    } else if (mode === 'matchresult') {
      matchesLabel.textContent = 'Uitslag & teams';
      modeHint.textContent = 'Kies een wedstrijd en vul de eindstand in.';
    } else if (mode === 'ranking') {
      matchesLabel.textContent = 'Ranking — vul de stand in';
      modeHint.textContent = 'Vul per positie het team, gespeelde wedstrijden en punten in' +
        (compKey === 'men' ? ' — of haal de stand automatisch op vanaf de SHL site.' : '.');
    } else if (mode === 'schedule') {
      matchesLabel.textContent = 'Wedstrijden — tijd is aanpasbaar';
      modeHint.textContent = 'Kies eerst een speelronde — teams en tijden worden automatisch ingevuld.';
    } else {
      matchesLabel.textContent = 'Wedstrijden — vul de scores in';
      modeHint.textContent = 'Kies eerst een speelronde — teams worden automatisch ingevuld, scores vul je zelf in.';
    }
  }
  const exportBtn = document.getElementById('exportBtn');
  const transparentBgToggle = document.getElementById('transparentBgToggle');
  let transparentBg = false;
  // Only ever set true transiently, during the "element only" export click
  // below — never toggled by the visible UI — so the on-screen preview
  // always shows the full decorated poster.
  let rankingNoDecor = false;
  transparentBgToggle.addEventListener('change', () => {
    transparentBg = transparentBgToggle.checked;
    render();
  });

  // ---------- Background photo (Mannen Match/Matchresult only) ----------
  const bgPhotoField = document.getElementById('bgPhotoField');
  const bgPhotoInput = document.getElementById('bgPhotoInput');
  const bgPhotoControls = document.getElementById('bgPhotoControls');
  const bgPhotoZoom = document.getElementById('bgPhotoZoom');
  const removeBgPhotoBtn = document.getElementById('removeBgPhotoBtn');

  bgPhotoInput.addEventListener('change', () => {
    const file = bgPhotoInput.files && bgPhotoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        bgPhotoImg = img;
        bgPhotoScale = 1;
        bgPhotoOffsetX = 0;
        bgPhotoOffsetY = 0;
        bgPhotoZoom.value = '1';
        bgPhotoControls.hidden = false;
        canvas.classList.add('bg-photo-draggable');
        render();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  bgPhotoZoom.addEventListener('input', () => {
    bgPhotoScale = parseFloat(bgPhotoZoom.value) || 1;
    clampBgPhotoOffsets();
    render();
  });

  removeBgPhotoBtn.addEventListener('click', () => {
    bgPhotoImg = null;
    bgPhotoInput.value = '';
    bgPhotoControls.hidden = true;
    canvas.classList.remove('bg-photo-draggable');
    render();
  });

  // Drag-to-pan directly on the preview. Pointer events cover mouse + touch
  // uniformly; delta is scaled from displayed (CSS) pixels to actual canvas
  // pixels since the preview is shown scaled down.
  let bgPhotoDragging = false;
  let bgPhotoDragStart = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!bgPhotoImg || !(mode === 'match' || mode === 'matchresult')) return;
    bgPhotoDragging = true;
    canvas.classList.add('bg-photo-dragging');
    canvas.setPointerCapture(e.pointerId);
    bgPhotoDragStart = {
      x: e.clientX, y: e.clientY,
      offX: bgPhotoOffsetX, offY: bgPhotoOffsetY,
    };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!bgPhotoDragging || !bgPhotoDragStart) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    bgPhotoOffsetX = bgPhotoDragStart.offX + (e.clientX - bgPhotoDragStart.x) * scaleX;
    bgPhotoOffsetY = bgPhotoDragStart.offY + (e.clientY - bgPhotoDragStart.y) * scaleY;
    clampBgPhotoOffsets();
    render();
  });
  ['pointerup', 'pointercancel'].forEach(evt => {
    canvas.addEventListener(evt, (e) => {
      if (!bgPhotoDragging) return;
      bgPhotoDragging = false;
      canvas.classList.remove('bg-photo-dragging');
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    });
  });

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
        sm: smState, transparentBg, ranking: rankState,
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

  // ---------- Server-side save (manual button) ----------
  // Separate from the automatic localStorage autosave above: this is an
  // explicit action so scores also survive a cleared browser / different
  // device, by writing to a JSON file on the server.
  const serverSaveBtn = document.getElementById('serverSaveBtn');
  const serverSaveStatus = document.getElementById('serverSaveStatus');

  function showSaveStatus(text, cls) {
    if (!serverSaveStatus) return;
    serverSaveStatus.textContent = text;
    serverSaveStatus.className = 'save-status' + (cls ? ' ' + cls : '');
    serverSaveStatus.hidden = false;
  }

  if (serverSaveBtn) {
    serverSaveBtn.addEventListener('click', () => {
      serverSaveBtn.disabled = true;
      showSaveStatus('Opslaan…');
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compKey, mode, roundId: currentRoundId, date: state.date, matches: state.matches,
          sm: smState, transparentBg, ranking: rankState,
        }),
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(() => showSaveStatus('✓ Opgeslagen op server', 'ok'))
        .catch(() => showSaveStatus('✗ Opslaan mislukt, probeer opnieuw', 'warn'))
        .finally(() => { serverSaveBtn.disabled = false; });
    });
  }

  // ---------- Check score SHL site (server-side headless fetch) ----------
  // Only runs when the button is pressed: the server launches a headless
  // browser on demand, reads the live results feed, and returns them here to
  // match against the currently loaded round's teams.
  function normalizeForMatch(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function matchCodeByAlias(aliases, name) {
    const norm = normalizeForMatch(name);
    for (const code of Object.keys(aliases)) {
      if (aliases[code].some(alias => norm.includes(alias))) return code;
    }
    return null;
  }

  const checkScoresBtn = document.getElementById('checkScoresBtn');
  const checkScoresStatus = document.getElementById('checkScoresStatus');

  function showCheckStatus(text, cls) {
    if (!checkScoresStatus) return;
    checkScoresStatus.textContent = text;
    checkScoresStatus.className = 'save-status' + (cls ? ' ' + cls : '');
    checkScoresStatus.hidden = false;
  }

  if (checkScoresBtn) {
    checkScoresBtn.addEventListener('click', () => {
      const aliases = comp().resultAliases;
      if (!aliases) {
        showCheckStatus('Niet beschikbaar voor deze competitie', 'warn');
        return;
      }
      checkScoresBtn.disabled = true;
      showCheckStatus('Scores ophalen van SHL site…');
      fetch('/api/results')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data.error) throw new Error(data.error);
          const scraped = data.results || [];
          let filled = 0;
          state.matches.forEach(m => {
            if (!m.home || !m.away) return;
            const hit = scraped.find(r => {
              const a = matchCodeByAlias(aliases, r.teamA);
              const b = matchCodeByAlias(aliases, r.teamB);
              return (a === m.home && b === m.away) || (a === m.away && b === m.home);
            });
            if (!hit) return;
            const homeIsA = matchCodeByAlias(aliases, hit.teamA) === m.home;
            m.homeScore = String(homeIsA ? hit.scoreA : hit.scoreB);
            m.awayScore = String(homeIsA ? hit.scoreB : hit.scoreA);
            m.played = true;
            filled++;
          });
          if (filled > 0) {
            buildMatchRows();
            render();
            showCheckStatus(`✓ ${filled} van ${state.matches.length} scores ingevuld`, 'ok');
          } else {
            showCheckStatus('Geen bijpassende scores gevonden op de site', 'warn');
          }
        })
        .catch(err => showCheckStatus('✗ Ophalen mislukt: ' + err.message, 'warn'))
        .finally(() => { checkScoresBtn.disabled = false; });
    });
  }

  // ---------- Check standings SHL site (ranking mode) ----------
  const checkStandingsBtn = document.getElementById('checkStandingsBtn');
  const checkStandingsStatus = document.getElementById('checkStandingsStatus');

  function showStandingsStatus(text, cls) {
    if (!checkStandingsStatus) return;
    checkStandingsStatus.textContent = text;
    checkStandingsStatus.className = 'save-status' + (cls ? ' ' + cls : '');
    checkStandingsStatus.hidden = false;
  }

  if (checkStandingsBtn) {
    checkStandingsBtn.addEventListener('click', () => {
      const aliases = COMPETITIONS.men.resultAliases;
      checkStandingsBtn.disabled = true;
      showStandingsStatus('Stand ophalen van SHL site…');
      fetch('/api/standings')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data.error) throw new Error(data.error);
          const standings = data.standings || [];
          let filled = 0;
          const menRanking = rankState.men;
          standings.forEach((s, i) => {
            if (i >= menRanking.length) return;
            const code = matchCodeByAlias(aliases, s.club);
            if (!code) return;
            menRanking[i].code = code;
            menRanking[i].p = s.played;
            menRanking[i].pts = s.points;
            filled++;
          });
          if (filled > 0) {
            buildMatchRows();
            render();
            showStandingsStatus(`✓ ${filled} van ${standings.length} teams ingevuld`, 'ok');
          } else {
            showStandingsStatus('Geen bijpassende teams gevonden op de site', 'warn');
          }
        })
        .catch(err => showStandingsStatus('✗ Ophalen mislukt: ' + err.message, 'warn'))
        .finally(() => { checkStandingsBtn.disabled = false; });
    });
  }

  // ---------- Font ----------
  // The full family is registered (not just Bold) so different text
  // elements can pick whichever weight matches the source design. Each
  // weight re-renders on its own load so a row drawn before its specific
  // weight was ready gets redrawn correctly instead of staying on
  // whatever weight the browser substituted in the meantime.
  const FONT_WEIGHTS = {
    200: 'ClashDisplay-Extralight', 300: 'ClashDisplay-Light', 400: 'ClashDisplay-Regular',
    500: 'ClashDisplay-Medium', 600: 'ClashDisplay-Semibold', 700: 'ClashDisplay-Bold',
  };
  Object.entries(FONT_WEIGHTS).forEach(([weight, file]) => {
    const face = new FontFace('ClashDisplay', `url(fonts/${file}.otf)`, { weight });
    face.load().then(f => {
      document.fonts.add(f);
      fontReady = true;
      render();
    }).catch(() => {});
  });

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

  // Waits for an image requested via loadImg to actually finish loading —
  // needed before capturing an export whose assets (e.g. card-only.png)
  // might be requested here for the first time and not yet ready when the
  // canvas is captured a moment later.
  function preloadImg(src) {
    return new Promise(resolve => {
      const img = loadImg(src);
      if (!img || (img.complete && img.naturalWidth)) { resolve(img); return; }
      img.addEventListener('load', () => resolve(img), { once: true });
      img.addEventListener('error', () => resolve(img), { once: true });
    });
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
      // The single-match graphics only exist for Mannen — bail back to
      // Results if Vrouwen gets picked while one of those is active.
      // Ranking exists for both, just styled differently per competition.
      if (compKey === 'women' && (mode === 'match' || mode === 'matchresult')) {
        mode = 'results';
        modeTabs.forEach(b => b.classList.toggle('active', b.dataset.mode === 'results'));
        roundSelectField.hidden = false;
        roundSelectLabel.textContent = 'Speelronde';
        updateHint();
        checkScoresBtn.hidden = false;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = true;
        checkStandingsStatus.hidden = true;
        bgPhotoField.hidden = true;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
      }
      if (mode === 'ranking') {
        checkStandingsBtn.hidden = compKey !== 'men'; // site scrape is men-only
        updateHint();
        buildMatchRows();
        render();
      }
      loadCompetition();
    });
  });

  function loadCompetition() {
    fetch(comp().csvPath)
      .then(r => r.text())
      .then(text => {
        rounds = parseCsv(text);
        if (mode === 'match' || mode === 'matchresult' || mode === 'ranking') return; // these UIs own the dropdown right now
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

  // ---------- Single-match data (loaded once, independent of compKey) ----------
  function parseSingleMatchCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      const id = cols[0];
      const dateRound = cols[1];
      const time = cols[2];
      const home = (cols[3] || '').replace(/\.png$/i, '');
      const away = (cols[4] || '').replace(/\.png$/i, '');
      const roundMatch = /ROUND\s+(\d+)/i.exec(dateRound);
      rows.push({ id, dateRound, time, home, away, roundNum: roundMatch ? Number(roundMatch[1]) : 0 });
    }
    return rows;
  }

  function populateSingleMatchSelect() {
    roundSelect.innerHTML = '';
    smMatches.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `Ronde ${m.roundNum}: ${m.home} vs ${m.away} — ${m.dateRound.split('|')[0].trim()}`;
      roundSelect.appendChild(opt);
    });
  }

  function loadSingleMatch(m, restore) {
    smState.id = m.id;
    smState.home = restore ? restore.home : m.home;
    smState.away = restore ? restore.away : m.away;
    smState.time = restore ? restore.time : m.time;
    smState.homeScore = restore ? restore.homeScore : '';
    smState.awayScore = restore ? restore.awayScore : '';
    smState.dateRound = m.dateRound;
    roundSelect.value = m.id;
    buildMatchRows();
    render();
  }

  function loadSingleMatchData() {
    fetch('assets/singlematch/schedule_per_match_all.csv')
      .then(r => r.text())
      .then(text => {
        smMatches = parseSingleMatchCsv(text);
        if (mode !== 'match' && mode !== 'matchresult') return; // round-based UI owns the dropdown right now
        populateSingleMatchSelect();
        if (!smMatches.length) return;
        let restoreMatch = null, restoreSm = null;
        if (savedState && (savedState.mode === 'match' || savedState.mode === 'matchresult') && savedState.sm && savedState.sm.id) {
          restoreMatch = smMatches.find(x => x.id === savedState.sm.id);
          restoreSm = savedState.sm;
        }
        loadSingleMatch(restoreMatch || smMatches[0], restoreMatch ? restoreSm : null);
      })
      .catch(err => console.error('Kon single-match CSV niet laden:', err));
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
    if (mode === 'match' || mode === 'matchresult') {
      const m = smMatches.find(x => x.id === roundSelect.value);
      if (m) loadSingleMatch(m);
      return;
    }
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
      if (btn.classList.contains('men-only-tab') && compKey !== 'men') return; // also hidden via CSS
      mode = btn.dataset.mode;
      modeTabs.forEach(b => b.classList.toggle('active', b === btn));

      if (mode === 'match' || mode === 'matchresult') {
        roundSelectField.hidden = false;
        roundSelectLabel.textContent = 'Wedstrijd';
        updateHint();
        checkScoresBtn.hidden = true;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = true;
        checkStandingsStatus.hidden = true;
        exportElementBtn.hidden = true;
        bgPhotoField.hidden = false;
        canvas.width = SM_CANVAS_W;
        canvas.height = SM_CANVAS_H;
        if (smMatches.length) {
          populateSingleMatchSelect();
          const target = smMatches.find(x => x.id === smState.id) || smMatches[0];
          loadSingleMatch(target, smState.id === target.id ? smState : null);
        } else {
          buildMatchRows();
          render();
        }
      } else if (mode === 'ranking') {
        roundSelectField.hidden = true;
        updateHint();
        checkScoresBtn.hidden = true;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = compKey !== 'men'; // site scrape is men-only
        exportElementBtn.hidden = false;
        bgPhotoField.hidden = true;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        buildMatchRows();
        render();
      } else {
        roundSelectField.hidden = false;
        roundSelectLabel.textContent = 'Speelronde';
        updateHint();
        checkScoresBtn.hidden = false;
        checkStandingsBtn.hidden = true;
        exportElementBtn.hidden = true;
        checkStandingsStatus.hidden = true;
        bgPhotoField.hidden = true;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        if (rounds.length) {
          populateRoundSelect();
          const round = rounds.find(r => r.id === currentRoundId) || rounds[0];
          loadRound(round, state.matches);
        } else {
          buildMatchRows();
          render();
        }
      }
    });
  });

  // ---------- Match row UI ----------
  function buildMatchRows() {
    matchesList.innerHTML = '';
    rankingHeader.hidden = mode !== 'ranking';
    if (mode === 'match' || mode === 'matchresult') {
      buildSingleMatchRow();
      return;
    }
    if (mode === 'ranking') {
      buildRankingRows();
      return;
    }
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

  function buildSingleMatchRow() {
    const tpl = document.getElementById('singleMatchRowTemplate');
    const node = tpl.content.firstElementChild.cloneNode(true);
    const homeSelect = node.querySelector('.home-chip .team-select');
    const awaySelect = node.querySelector('.away-chip .team-select');
    const timeInput = node.querySelector('.single-match-time');
    const scorePair = node.querySelector('.single-match-score');
    const homeScoreInput = node.querySelector('.home-score');
    const awayScoreInput = node.querySelector('.away-score');
    const dateRow = node.querySelector('.single-match-date-row');
    const dateInput = node.querySelector('.single-match-dateround');

    function fillSelect(select, code) {
      select.innerHTML = '';
      SM_TEAM_CODES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${c} — ${SM_TEAM_NAMES[c]}`;
        if (c === code) opt.selected = true;
        select.appendChild(opt);
      });
    }
    fillSelect(homeSelect, smState.home);
    fillSelect(awaySelect, smState.away);
    homeSelect.addEventListener('change', () => { smState.home = homeSelect.value; render(); });
    awaySelect.addEventListener('change', () => { smState.away = awaySelect.value; render(); });

    timeInput.value = smState.time;
    timeInput.hidden = mode !== 'match';
    scorePair.hidden = mode !== 'matchresult';
    homeScoreInput.value = smState.homeScore;
    awayScoreInput.value = smState.awayScore;

    timeInput.addEventListener('input', () => { smState.time = timeInput.value; render(); });
    homeScoreInput.addEventListener('input', () => { smState.homeScore = homeScoreInput.value; render(); });
    awayScoreInput.addEventListener('input', () => { smState.awayScore = awayScoreInput.value; render(); });

    // The date/round line is only drawn on the poster in Match mode — a
    // result graphic doesn't need it — and only Match lets you edit it,
    // since Matchresult never shows it anyway.
    dateRow.hidden = mode !== 'match';
    dateInput.value = smState.dateRound;
    dateInput.addEventListener('input', () => { smState.dateRound = dateInput.value; render(); });

    matchesList.appendChild(node);
  }

  function buildRankingRows() {
    const tpl = document.getElementById('rankingRowTemplate');
    const teamCodes = Object.keys(comp().teamColors).sort();
    const names = compKey === 'men' ? MEN_TEAM_NAMES : {};
    const rows = rankState[compKey];
    rows.forEach((row, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const numEl = node.querySelector('.rank-num');
      const select = node.querySelector('.rank-team-select');
      const pInput = node.querySelector('.rank-p');
      const ptsInput = node.querySelector('.rank-pts');

      numEl.textContent = (i + 1) + '.';

      select.innerHTML = '';
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '—';
      select.appendChild(emptyOpt);
      teamCodes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = names[c] ? `${c} — ${names[c]}` : c;
        if (c === row.code) opt.selected = true;
        select.appendChild(opt);
      });

      pInput.value = row.p;
      ptsInput.value = row.pts;

      select.addEventListener('change', () => { row.code = select.value; render(); });
      pInput.addEventListener('input', () => { row.p = pInput.value; render(); });
      ptsInput.addEventListener('input', () => { row.pts = ptsInput.value; render(); });

      // Echoes the poster's own zone dividers (after position 8 and 10).
      if (i === 8 || i === 10) node.classList.add('zone-start');

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

  // Square top corners, rounded bottom — for a shape flush with another
  // shape's own bottom edge that should inherit that edge's exact radius
  // (e.g. an accent bar sitting under a card, rounded to match).
  function roundedRectBottomPath(c, x, y, w, h, r) {
    if (r <= 0) { c.beginPath(); c.rect(x, y, w, h); return; }
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
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

  function drawBadge(c, img, cropX, cx, cy, radius, size, pad) {
    const box = size || BADGE_SIZE;
    const inner = box - (pad || 0) * 2;
    const x0 = cx - box / 2, y0 = cy - box / 2;
    c.save();
    roundedRectPath(c, x0, y0, box, box, radius);
    c.clip();
    c.fillStyle = '#ffffff';
    c.fillRect(x0, y0, box, box);
    if (img && img.complete && img.naturalWidth) {
      const scale = Math.min(inner / CREST_W, inner / CREST_H);
      const dw = CREST_W * scale, dh = CREST_H * scale;
      const dx = cx - dw / 2, dy = cy - dh / 2;
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
    if (mode === 'match' || mode === 'matchresult') { renderSingleMatch(); return; }
    if (mode === 'ranking') { renderRanking(); return; }
    const C = comp();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!transparentBg) {
      ctx.fillStyle = C.bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

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

  function renderSingleMatch() {
    ctx.clearRect(0, 0, SM_CANVAS_W, SM_CANVAS_H);
    if (bgPhotoImg) {
      drawBgPhotoCover(ctx, bgPhotoImg);
    } else if (!transparentBg) {
      ctx.fillStyle = COMPETITIONS.men.bgColor;
      ctx.fillRect(0, 0, SM_CANVAS_W, SM_CANVAS_H);
    }

    // Each team's own asset (assets/singlematch/teams/<CODE>.png) already
    // bakes in that team's color, crest and name as finished art, pre-built
    // for BOTH slots side by side at 2x resolution: the left half is meant
    // for the left-hand position, the right half for the right-hand one —
    // so there's no separate tinting step, just crop the matching half.
    const homeImg = smState.home ? loadImg(`assets/singlematch/teams/${smState.home}.png`) : null;
    if (homeImg && homeImg.complete && homeImg.naturalWidth) {
      const halfW = homeImg.naturalWidth / 2;
      ctx.drawImage(homeImg, 0, 0, halfW, homeImg.naturalHeight, SM_TEAM_LEFT_X, SM_TEAM_Y, SM_TEAM_W, SM_TEAM_H);
    }
    const awayImg = smState.away ? loadImg(`assets/singlematch/teams/${smState.away}.png`) : null;
    if (awayImg && awayImg.complete && awayImg.naturalWidth) {
      const halfW = awayImg.naturalWidth / 2;
      ctx.drawImage(awayImg, halfW, 0, halfW, awayImg.naturalHeight, SM_TEAM_RIGHT_X, SM_TEAM_Y, SM_TEAM_W, SM_TEAM_H);
    }

    const mark = loadImg('assets/singlematch/mark.png');
    if (mark && mark.complete && mark.naturalWidth) {
      ctx.drawImage(mark, SM_MARK.x, SM_MARK.y, SM_MARK.w, SM_MARK.h);
    }

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SM_TEXT_COLOR;
    ctx.globalAlpha = 1;

    ctx.font = `700 ${SM_TIME_FONT}px "${fontFamily}"`;
    const mainText = mode === 'matchresult'
      ? (smState.homeScore !== '' || smState.awayScore !== '' ? `${smState.homeScore || 0} - ${smState.awayScore || 0}` : '')
      : (smState.time || '');
    ctx.fillText(mainText, SM_CENTER_X, SM_TIME_Y);

    if (mode === 'match') {
      ctx.font = `500 ${SM_DATE_FONT}px "${fontFamily}"`;
      ctx.fillText(smState.dateRound || '', SM_CENTER_X, SM_DATE_Y);
    }

    const footerImg = loadImg('assets/footer-logo.png');
    if (footerImg && footerImg.complete && footerImg.naturalWidth) {
      ctx.drawImage(footerImg, SM_FOOTER.x, SM_FOOTER.y, SM_FOOTER.w, SM_FOOTER.h);
    }

    saveState();
  }

  // The template's own badge-card asset (a hidden PSD reference layer) has
  // a soft drop shadow under each white card — the shadow must be drawn
  // BEFORE clipping to the box, since clipping the context also clips away
  // the shadow. Square corners (no radius) per the reference design.
  function drawRankBadge(img, cx, cy) {
    const box = RANK_BADGE_SIZE, pad = RANK_BADGE_PAD;
    const x0 = cx - box / 2, y0 = cy - box / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(20, 20, 43, 0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, y0, box, box);
    ctx.restore();

    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, box, box);
      ctx.clip();
      const inner = box - pad * 2;
      const scale = Math.min(inner / CREST_W, inner / CREST_H);
      const dw = CREST_W * scale, dh = CREST_H * scale;
      ctx.drawImage(img, CREST_X_LEFT, CREST_Y, CREST_W, CREST_H, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    }
  }

  function renderRanking() {
    if (compKey === 'women') { renderWomenRanking(); return; }
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!transparentBg) {
      ctx.fillStyle = COMPETITIONS.men.bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // rankingNoDecor swaps in a version with just the card/bottom bar/footer
    // (no navy fill or diagonal lines baked in) for the "element only" export,
    // drawn at 80% opacity so it reads as a translucent white block rather
    // than a fully solid one on whatever background it gets pasted onto.
    const bg = loadImg(rankingNoDecor ? 'assets/ranking/card-only.png' : 'assets/ranking/background.png');
    if (bg && bg.complete && bg.naturalWidth) {
      if (rankingNoDecor) ctx.globalAlpha = 0.8;
      ctx.drawImage(bg, 0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }

    // Drawn as its own asset (not baked into the background) so it never
    // moves or gets clipped when the card underneath is repositioned —
    // it's fine (and matches the source design) for it to overlap the card.
    const mark = loadImg('assets/ranking/mark.png');
    if (mark && mark.complete && mark.naturalWidth) {
      ctx.drawImage(mark, RANK_MARK.x, RANK_MARK.y, RANK_MARK.w, RANK_MARK.h);
    }

    // Divider lines and the bottom gradient bar are drawn fresh, spanning
    // the card's own edges exactly — the PSD's originals (baked into the
    // background) were narrower than the card and stopped short of it.
    ctx.fillStyle = RANK_DIVIDER_COLOR;
    RANK_DIVIDER_Y.forEach(y => {
      ctx.fillRect(RANK_CARD_LEFT, y, RANK_CARD_RIGHT - RANK_CARD_LEFT, RANK_DIVIDER_H);
    });

    const barGradient = ctx.createLinearGradient(RANK_CARD_LEFT, 0, RANK_CARD_RIGHT, 0);
    barGradient.addColorStop(0, 'rgb(252, 119, 69)');
    barGradient.addColorStop(1, 'rgb(243, 85, 121)');
    ctx.fillStyle = barGradient;
    ctx.fillRect(RANK_CARD_LEFT, RANK_BOTTOM_BAR_Y, RANK_CARD_RIGHT - RANK_CARD_LEFT, RANK_BOTTOM_BAR_H);

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.fillStyle = RANK_TEXT_COLOR;
    ctx.textBaseline = 'middle';

    ctx.font = `500 ${RANK_HEADER_FONT}px "${fontFamily}"`;
    ctx.textAlign = 'left';
    ctx.fillText('P', RANK_P_X, RANK_HEADER_Y);
    ctx.fillText('PTS', RANK_PTS_X, RANK_HEADER_Y);

    rankState.men.forEach((row, i) => {
      if (!row.code) return;
      const cy = RANK_ROW_TOP + RANK_ROW_H * i + RANK_ROW_H / 2;

      const img = row.code ? loadImg(`${COMPETITIONS.men.teamsDir}/${row.code}.png`) : null;
      drawRankBadge(img, RANK_BADGE_CX, cy);

      ctx.font = `500 ${RANK_DATA_FONT}px "${fontFamily}"`;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1) + '.', RANK_NUM_X, cy);
      ctx.fillText(row.code, RANK_CODE_X, cy);
      ctx.fillText(row.p, RANK_P_X, cy);

      // PTS is the one column set in Bold — everything else in this
      // template is Medium.
      ctx.font = `700 ${RANK_DATA_FONT}px "${fontFamily}"`;
      ctx.fillText(row.pts, RANK_PTS_X, cy);
    });

    saveState();
  }

  // Vrouwen has no source PSD for its ranking — built programmatically to
  // echo the Vrouwen results/schedule look (white, rounded, purple/pink)
  // instead of extracted assets, reusing that template's own row margins.
  function renderWomenRanking() {
    const C = COMPETITIONS.women;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!transparentBg) {
      ctx.fillStyle = C.bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Same corner decoration used behind Results/Schedule, repositioned so
    // it fills the space above the card instead of sitting empty. Skipped
    // for the "element only" export (rankingNoDecor).
    if (!rankingNoDecor) {
      const corner = loadImg(C.decorations[0].src);
      if (corner && corner.complete && corner.naturalWidth) {
        ctx.drawImage(corner, WRANK_CORNER_DECO.x, WRANK_CORNER_DECO.y);
      }
    }

    fillRow(ctx, WRANK_CARD_LEFT, WRANK_CARD_TOP, WRANK_CARD_RIGHT - WRANK_CARD_LEFT,
      WRANK_CARD_BOTTOM - WRANK_CARD_TOP, WRANK_CARD_BG, WRANK_CARD_RADIUS, WRANK_CARD_BORDER);

    // Gradient bar flush with the card's bottom edge — rounded only at the
    // bottom, with the same radius as the card's own corners, so the
    // rounding is identical top and bottom instead of the flat/sharp bar
    // the Mannen version gets away with.
    const wBarGradient = ctx.createLinearGradient(WRANK_CARD_LEFT, 0, WRANK_CARD_RIGHT, 0);
    wBarGradient.addColorStop(0, 'rgb(229, 84, 252)');
    wBarGradient.addColorStop(1, 'rgb(189, 81, 252)');
    roundedRectBottomPath(ctx, WRANK_CARD_LEFT, WRANK_CARD_BOTTOM - WRANK_BOTTOM_ACCENT_H,
      WRANK_CARD_RIGHT - WRANK_CARD_LEFT, WRANK_BOTTOM_ACCENT_H, WRANK_CARD_RADIUS);
    ctx.fillStyle = wBarGradient;
    ctx.fill();

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.fillStyle = WRANK_TEXT_COLOR;
    ctx.textBaseline = 'middle';

    // Same weight split as the Mannen ranking: Medium everywhere, Bold
    // only for PTS.
    ctx.font = `500 ${WRANK_HEADER_FONT}px "${fontFamily}"`;
    ctx.textAlign = 'left';
    ctx.fillText('P', WRANK_P_X, WRANK_HEADER_Y);
    ctx.font = `700 ${WRANK_HEADER_FONT}px "${fontFamily}"`;
    ctx.fillText('PTS', WRANK_PTS_X, WRANK_HEADER_Y);

    WRANK_DIVIDER_Y.forEach(y => {
      fillRow(ctx, WRANK_CARD_LEFT, y, WRANK_CARD_RIGHT - WRANK_CARD_LEFT, WRANK_DIVIDER_H,
        WRANK_DIVIDER_COLOR, WRANK_DIVIDER_H / 2);
    });

    rankState.women.forEach((row, i) => {
      if (!row.code) return;
      const cy = WRANK_ROW_TOP + WRANK_ROW_H * i + WRANK_ROW_H / 2;

      const img = loadImg(`${C.teamsDir}/${row.code}.png`);
      drawBadge(ctx, img, CREST_X_LEFT, WRANK_BADGE_CX, cy, WRANK_BADGE_RADIUS, WRANK_BADGE_SIZE, 6);

      ctx.fillStyle = WRANK_TEXT_COLOR;
      ctx.font = `500 ${WRANK_DATA_FONT}px "${fontFamily}"`;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1) + '.', WRANK_NUM_X, cy);
      ctx.fillText(row.code, WRANK_CODE_X, cy);
      ctx.fillText(row.p, WRANK_P_X, cy);

      // PTS is the one column set in Bold — everything else is Medium.
      ctx.font = `700 ${WRANK_DATA_FONT}px "${fontFamily}"`;
      ctx.fillText(row.pts, WRANK_PTS_X, cy);
    });

    const footerImg = loadImg(C.footerLogo);
    if (footerImg && footerImg.complete && footerImg.naturalWidth) {
      ctx.drawImage(footerImg, C.footer.x, WRANK_FOOTER_Y, C.footer.w, C.footer.h);
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
      const nameBit = (mode === 'match' || mode === 'matchresult') ? (smState.id || 'match')
        : mode === 'ranking' ? 'ranking'
        : (state.date || 'story');
      const slug = (compKey + '-' + mode + '-' + nameBit).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.download = `${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  // Ranking-only: exports the full-size poster with the decorative
  // background (navy/photo, diagonal lines) removed — card, rows, mark
  // icon and footer logo stay exactly where they are — so it can be laid
  // over a custom background elsewhere. Not a crop: same canvas size as
  // the normal export.
  const exportElementBtn = document.getElementById('exportElementBtn');
  if (exportElementBtn) {
    exportElementBtn.addEventListener('click', async () => {
      const prevTransparentBg = transparentBg;
      rankingNoDecor = true;
      transparentBg = true;
      // card-only.png (and the mark) may be requested here for the first
      // time in this session — wait for them so the export isn't captured
      // mid-load, which produced a blank/transparent card.
      await preloadImg('assets/ranking/card-only.png');
      await preloadImg('assets/ranking/mark.png');
      render();
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${compKey}-ranking-zonder-achtergrond.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        rankingNoDecor = false;
        transparentBg = prevTransparentBg;
        render();
      }, 'image/png');
    });
  }

  // Restore the last-used competition/mode before the first load, so a
  // reload lands back where the user left off (loadCompetition() then picks
  // up the matching round + scores via savedState above).
  if (savedState) {
    if (typeof savedState.transparentBg === 'boolean') {
      transparentBg = savedState.transparentBg;
      transparentBgToggle.checked = transparentBg;
    }
    if (savedState.compKey && COMPETITIONS[savedState.compKey]) {
      compKey = savedState.compKey;
      competitionTabs.forEach(b => b.classList.toggle('active', b.dataset.competition === compKey));
      appEl.classList.toggle('theme-women', compKey === 'women');
    }
    const menOnlyMode = savedState.mode === 'match' || savedState.mode === 'matchresult';
    const canRestoreMode = ['results', 'schedule', 'match', 'matchresult', 'ranking'].includes(savedState.mode)
      && !(compKey === 'women' && menOnlyMode);
    if (canRestoreMode) {
      mode = savedState.mode;
      modeTabs.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      if (mode === 'match' || mode === 'matchresult') {
        roundSelectLabel.textContent = 'Wedstrijd';
        checkScoresBtn.hidden = true;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = true;
        exportElementBtn.hidden = true;
        bgPhotoField.hidden = false;
        canvas.width = SM_CANVAS_W;
        canvas.height = SM_CANVAS_H;
      } else if (mode === 'ranking') {
        roundSelectField.hidden = true;
        checkScoresBtn.hidden = true;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = compKey !== 'men'; // site scrape is men-only
        exportElementBtn.hidden = false;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
      }
    }
    ['men', 'women'].forEach(key => {
      const saved = savedState.ranking && savedState.ranking[key];
      if (Array.isArray(saved) && saved.length === RANK_ROWS) {
        saved.forEach((row, i) => {
          if (row && typeof row === 'object') Object.assign(rankState[key][i], row);
        });
      }
    });
  }

  updateHint();
  buildMatchRows();
  loadCompetition();
  loadSingleMatchData();
})();
