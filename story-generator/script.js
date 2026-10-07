(() => {
  // ---------- Shared layout (identical grid for every competition) ----------
  const CANVAS_W = 1080, CANVAS_H = 1920;
  const ROW_H = 148;
  const ROW_Y = [468, 634, 800, 966, 1132, 1298, 1464];
  // Rows the user unticked ("Toon deze wedstrijd") are skipped; the rest stay
  // centered inside the same 7-slot area.
  const ROW_PITCH = ROW_Y[1] - ROW_Y[0];
  function visibleMatches() { return state.matches.filter(m => !m.hidden); }
  function visibleRowY(vi, count) { return ROW_Y[0] + (ROW_Y.length - count) * ROW_PITCH / 2 + vi * ROW_PITCH; }
  // Results "Post": the story layout scaled to 600px-wide rows and pinned to
  // the right half of a 1080x1350 canvas (matches the posted examples).
  const RP_W = 1080, RP_H = 1350;
  const RP_SCALE = 600 / 880, RP_CX = 725, RP_Y0 = 363;
  const RP_NO_BAR_SHIFT = 58;
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
      // Distinctive lowercase substrings of the club names as shown on
      // shlw.nl (results + standings pages). Order matters: first match wins.
      resultAliases: {
        DSVD: ['dsvd', 'aqqo'], 'E&O': ['misker'], FOR: ['foreholte'], KWI: ['kwiek'],
        MHV: ['m.h.v'], PSV: ['hypotheekvisie', 'eindhoven'], QUI: ['quintus'],
        SEW: ['westfriesland'], 'V&L': ['geonius'], VEN: ['venlo', 'cabooter'],
        VOC: ['ruitenheer'], VOL: ['volendam'], VZV: ['juro'], WPK: ['westlandia'],
      },
    },
  };
  const SITE_LABEL = { men: 'SHL site', women: 'shlw.nl' };

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
  const SM_FOOTER = { x: 295, y: 1191, w: 490, h: 120 }; // min height (was crowding the Post edge at 152)
  const SM_TEXT_COLOR = '#14142b';
  const SM_TIME_Y = 1090, SM_TIME_FONT = 61;
  const SM_DATE_Y = 1131, SM_DATE_FONT = 26;
  const SM_CENTER_X = 540;
  // Post (the original, only size) vs Story — same horizontal layout, the
  // Story canvas is just taller (1920 vs 1350) so everything shifts down
  // by the same amount used for the Vrouwen Post->Story shift (+250 for
  // the team cards/mark/time/date, +469 for the footer logo, which sits
  // right at the bottom).
  const SM_LAYOUTS = {
    post: {
      canvasW: SM_CANVAS_W, canvasH: SM_CANVAS_H,
      teamY: SM_TEAM_Y, mark: SM_MARK, footer: SM_FOOTER,
      timeY: SM_TIME_Y, dateY: SM_DATE_Y,
      cardChevronYExtra: 0, cardChevronScale: 1,
    },
    story: {
      canvasW: 1080, canvasH: 1920,
      teamY: SM_TEAM_Y + 250,
      mark: { x: SM_MARK.x, y: SM_MARK.y + 250, w: SM_MARK.w, h: SM_MARK.h },
      // Story has a lot more room below the cards, so the footer logo can
      // be a good deal bigger here than the Post floor allows.
      footer: { x: 193, y: SM_FOOTER.y + 469, w: 694, h: 170 },
      timeY: SM_TIME_Y + 250, dateY: SM_DATE_Y + 250,
      cardChevronYExtra: 250, cardChevronScale: 1.35,
    },
  };
  // The score (matchresult mode only) sits a bit lower than the time text,
  // and is noticeably bigger — same size for Mannen and Vrouwen.
  const SM_SCORE_Y_OFFSET = 18;
  const SM_SCORE_FONT = 78;

  const SM_TEAM_NAMES = {
    SAB: 'Sezoens Achilles Bocholt', IZE: 'Besox HBC Izegem', EUP: 'KTSV Eupen',
    SPR: 'Sprimont', BEV: 'HUMBY BEVO HC', PEL: 'Derdaele/Sporting Pelt',
    BWH: 'B&B Healthcare/WHC-Hercules', DFS: 'DFS Arnhem', HUP: 'JD Techniek/Hurry-up',
    HCV: 'HC Visé BM', HVA: 'HV Aalsmeer', HUB: 'HUBO Handbal',
    VOL: 'KRAS/Volendam', TAC: 'van Mossel/MGTachos/Witte Ster',
  };
  const SM_TEAM_CODES = Object.keys(SM_TEAM_NAMES).sort();

  // The Results/Schedule/Ranking team-code set uses "HCS" for the same club
  // the single-match/site-scrape data calls "SPR" (Sprimont) — same names
  // otherwise, so just re-key that one entry rather than keeping a second
  // full copy of the list.
  const MEN_TEAM_NAMES = { ...SM_TEAM_NAMES, HCS: SM_TEAM_NAMES.SPR };
  delete MEN_TEAM_NAMES.SPR;

  // ---------- Single-match template (Vrouwen) ----------
  // Own PSD (WOMENmatch/Wedstrijdaankondigingen.psd) has two artboards for
  // this same design — "STORY-SHLW" (a full Story canvas, 1080x1920) and
  // "POST-SHLW" (an Instagram post, 1080x1350, matching the Mannen
  // template's own canvas) — same art (bar/mark/chevrons/footer), just
  // repositioned for the shorter canvas, so both reuse the same assets.
  // Each team's own PNG already bakes in its white card, crest, name and
  // drop shadow as finished art, same "just place it" approach.
  const SMW_TEXT_COLOR = '#14142b';
  let smFormat = 'story'; // 'story' | 'post'
  // Results has its own Story/Post choice: Post is a right-aligned, transparent
  // 1080x1350 block meant to be pasted over a photo in an external template.
  let resultsFormat = 'story';
  const SMW_LAYOUTS = {
    story: {
      canvasW: 1080, canvasH: 1920,
      teamLeft: { x: 82, y: 1132, w: 242, h: 258 },
      teamRight: { x: 755, y: 1133, w: 243, h: 260 },
      mark: { x: 475, y: 1160, w: 126, h: 145 },
      bar: { x: 55, y: 1233, w: 967, h: 179 },
      footer: { x: 222, y: 1660, w: 637, h: 134 },
      centerX: 540, timeY: 1315, timeFont: 61, dateY: 1375, dateFont: 32,
    },
    post: {
      canvasW: 1080, canvasH: 1350,
      teamLeft: { x: 79, y: 881, w: 242, h: 258 },
      teamRight: { x: 752, y: 882, w: 243, h: 260 },
      mark: { x: 475, y: 910, w: 126, h: 145 },
      bar: { x: 55, y: 983, w: 967, h: 179 },
      footer: { x: 315, y: 1191, w: 450, h: 95 },
      centerX: 540, timeY: 1065, timeFont: 61, dateY: 1125, dateFont: 32,
    },
  };

  // Canvas size for whichever competition/format combination is active —
  // both Mannen and Vrouwen toggle between Post and Story.
  function smCanvasSize() {
    if (isListMode()) return resultsFormat === 'post' ? { w: RP_W, h: RP_H } : { w: CANVAS_W, h: CANVAS_H };
    if (mode === 'topscorer' || mode === 'playerweek') return { w: TS_W, h: TS_H };
    if (compKey === 'women') {
      const L = SMW_LAYOUTS[smFormat] || SMW_LAYOUTS.story;
      return { w: L.canvasW, h: L.canvasH };
    }
    const L = SM_LAYOUTS[smFormat] || SM_LAYOUTS.post;
    return { w: L.canvasW, h: L.canvasH };
  }

  // Names aren't known for every club — fall back to the bare code (same
  // pattern as the Ranking team dropdown) rather than keeping a partial,
  // misleading map.
  const SMW_TEAM_NAMES = {
    FORV: 'Cabooter Fortes Venlo', SEW: 'Westfriesland/SEW',
  };
  const SMW_TEAM_CODES = [
    'DSVD', 'ENO', 'FORE', 'FORV', 'KWI', 'MHV', 'PSV',
    'QUI', 'SEW', 'VEL', 'VOC', 'VOL', 'VZV', 'WPK',
  ].sort();
  // Sampled from each team's own crest — tints the chevron accent behind
  // the cards (home color on the left, away color on the right).
  const SMW_TEAM_COLORS = {
    DSVD: '#d0332e', ENO: '#1a9b4d', FORE: '#1a2a6e', FORV: '#142864',
    KWI: '#e8383a', MHV: '#1f7a4c', PSV: '#db3b3a', QUI: '#1a8a3d',
    SEW: '#14225e', VEL: '#1a5ba0', VOC: '#2d7a3d', VOL: '#ee7212',
    VZV: '#e0332e', WPK: '#3ca815',
  };
  // Sampled directly from each Mannen team's own card asset — specifically
  // the solid design element the team name/subtitle text sits on, which is
  // consistent across every card (unlike the earlier attempt, which
  // sampled a washed-out background patch and guessed at a correction).
  const SM_TEAM_COLORS = {
    BEV: '#ffd54d', BWH: '#496aae', DFS: '#d2ddf2', EUP: '#ff5e4c',
    HCV: '#4ea4d6', HUB: '#5253ad', HUP: '#ffab49', HVA: '#e7c682',
    IZE: '#4c82ad', PEL: '#dc482f', SAB: '#007ad3', SPR: '#f7bd23',
    TAC: '#2d8761', VOL: '#ff7e15',
  };
  // The 4 nested-chevron-line paths (traced from the real SHLPULSE.ai
  // vector art), used as one small animated accent behind each team card
  // — see smChevronState() for the shared grow/fade timing.
  const SM_CARD_CHEVRON_D = [
    'M -9.21 171.38 L -123.83 -29.64 L 219.48 -132.99 L 220.86 -128.40 L -116.69 -26.79 L -5.05 169.01 Z M -120.84 -28.45 L -8.47 168.65 L -7.78 168.26 L -119.67 -27.98 L 218.37 -129.74 L 218.14 -130.49 Z M -9.96 174.11 L -126.81 -30.83 L 220.82 -135.48 L 223.35 -127.06 L 221.44 -126.49 L -113.71 -25.60 L -2.32 169.76 Z',
    'M -45.47 156.33 L -159.34 -43.39 L 182.53 -146.30 L 183.22 -144.01 L -155.77 -41.97 L -43.39 155.14 Z M -46.03 158.37 L -161.57 -44.29 L 183.53 -148.17 L 185.09 -143.01 L 183.65 -142.57 L -153.53 -41.07 L -41.34 155.70 Z',
    'M -79.84 141.52 L -193.34 -57.55 L -192.62 -57.76 L 147.81 -160.24 L 148.16 -159.09 L -191.55 -56.83 L -78.80 140.93 Z M -80.21 142.88 L -194.83 -58.14 L -192.91 -58.72 L 148.48 -161.49 L 149.40 -158.43 L 148.45 -158.14 L -190.06 -56.24 L -77.43 141.30 Z',
    'M -109.86 127.65 L -223.35 -71.42 L -222.63 -71.63 L 117.80 -174.11 L 118.14 -172.97 L -221.57 -70.70 L -108.82 127.05 Z',
  ];
  let smCardChevronPaths = null; // lazily built Path2D[], see drawSmCardChevron()
  // The viewBox is 507 wide; this is the unit scale that makes it render
  // at roughly the same size validated in the animatie/ prototype.
  const SM_CARD_CHEVRON_UNIT_SCALE = 490 / 507;
  const SM_CARD_CHEVRON_TILT_DEG = 18;

  // Draws one small animated chevron accent behind a team card, anchored
  // at (cx, cy) — mirror=true for the home/left side (its own tip plants
  // at the left edge), mirror=false for away/right (mirrors the other
  // way automatically since it isn't flipped).
  function drawSmCardChevron(ctx, cx, cy, mirror, color, scale, opacity) {
    if (opacity <= 0) return;
    if (!smCardChevronPaths) smCardChevronPaths = SM_CARD_CHEVRON_D.map((d) => new Path2D(d));
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.translate(cx, cy);
    if (mirror) ctx.scale(-1, 1);
    ctx.rotate((SM_CARD_CHEVRON_TILT_DEG * Math.PI) / 180);
    const s = SM_CARD_CHEVRON_UNIT_SCALE * scale;
    ctx.scale(s, s);
    smCardChevronPaths.forEach((p) => ctx.fill(p));
    ctx.restore();
  }

  let smMatches = []; // parsed from assets/(women/)singlematch/schedule_per_match_all.csv
  let smMatchesCompKey = null; // which competition's data is currently in smMatches
  const smState = {
    id: '', home: '', away: '', time: '', homeScore: '', awayScore: '', dateRound: '',
    // Top scorer graphic only: which side the player is on + their name and goals.
    tsSide: 'home', tsFirst: '', tsLast: '', tsGoals: '',
    // Player of the week: the player's club and name.
    pwTeam: '', pwName: '',
  };
  // Results / Schedule / Ranking share the Story-or-Post choice (Post = left or right aligned, transparent).
  function isListMode() { return mode === 'results' || mode === 'schedule' || mode === 'ranking'; }
  function isSingleMode() { return mode === 'match' || mode === 'matchresult' || mode === 'topscorer' || mode === 'playerweek'; }

  // Optional user-uploaded photo behind the single-match graphic (Mannen
  // Match/Matchresult only). In-memory only — not persisted via saveState,
  // since it's a large per-session convenience, not fixture data.
  let bgPhotoImg = null;
  let bgPhotoScale = 1; // user zoom on top of the auto "cover" fit
  let bgPhotoOffsetX = 0, bgPhotoOffsetY = 0; // pan, in canvas pixels

  // Uses the canvas's own CURRENT dimensions (not a hardcoded constant) so
  // this works for both the Mannen (post, 1080x1350) and Vrouwen (story,
  // 1080x1920) single-match canvas sizes.
  // Player of the week only shows the photo in the top part of the canvas.
  const PW_PHOTO_H = 860;
  function bgPhotoAreaH() { return mode === 'playerweek' ? PW_PHOTO_H : canvas.height; }
  function bgPhotoCoverScale(img) {
    return Math.max(canvas.width / img.naturalWidth, bgPhotoAreaH() / img.naturalHeight);
  }

  function clampBgPhotoOffsets() {
    if (!bgPhotoImg) return;
    const s = bgPhotoCoverScale(bgPhotoImg) * bgPhotoScale;
    const dw = bgPhotoImg.naturalWidth * s, dh = bgPhotoImg.naturalHeight * s;
    const maxX = Math.max(0, (dw - canvas.width) / 2);
    const maxY = Math.max(0, (dh - bgPhotoAreaH()) / 2);
    bgPhotoOffsetX = Math.max(-maxX, Math.min(maxX, bgPhotoOffsetX));
    bgPhotoOffsetY = Math.max(-maxY, Math.min(maxY, bgPhotoOffsetY));
  }

  function drawBgPhotoCover(c, img) {
    const s = bgPhotoCoverScale(img) * bgPhotoScale;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const dx = (canvas.width - dw) / 2 + bgPhotoOffsetX;
    const dy = (bgPhotoAreaH() - dh) / 2 + bgPhotoOffsetY;
    c.drawImage(img, dx, dy, dw, dh);
  }

  // ---------- Results "pop in" animation ----------
  // Two global stages, not independent per-row sequences:
  //   Stage A — every row's bar + badges + icon pop in fast, staggered top
  //     to bottom (STAGE_A_STAGGER_MS apart).
  //   (a pause once every row has finished Stage A)
  //   Stage B — only once ALL rows are showing does the score reveal
  //     begin: the winner-line graphic wipes outward from the center and
  //     the score numbers cascade in, with more breathing room between
  //     rows (STAGE_B_STAGGER_MS apart).
  const STAGE_A_STAGGER_MS = 150, STAGE_B_STAGGER_MS = 500;
  const PHASE1_MS = 300, PAUSE_MS = 500;
  const ICON_MS = 520; // 13 frames @ 25fps — exact AE keyframe export
  // Winner-line ("de lijnen") reveal: grows outward from the center, fast
  // then slow — a plain wipe, no bounce (that read as too wiggly).
  const ARROW_WIPE_MS = 550;
  const ELEMENT_STAGGER_MS = 300, ELEMENT_POP_MS = 280;
  // The whole clip (reveal + hold) is exactly this long — the hold is
  // whatever's left over after the reveal cascade finishes, not extra
  // time added on top of it.
  const ANIM_TOTAL_TARGET_MS = 15000;
  let resultsAnimating = false;
  let animStartTs = null;
  let animRafId = null;

  // Stage A finishes once the LAST row's own bar has fully popped in.
  function stageATotalMs(rowCount) {
    return Math.max(0, rowCount - 1) * STAGE_A_STAGGER_MS + PHASE1_MS;
  }
  // Stage B (scores) starts only after Stage A is fully done for every
  // row, plus the pause.
  function stageBStartMs(rowCount) {
    return stageATotalMs(rowCount) + PAUSE_MS;
  }

  // Subtle reveal for a row element: eased fade 0->1 with a very slight
  // scale-up (0.94 -> 1.0) riding along with it — no bounce/overshoot.
  function rowReveal(t) {
    if (t <= 0) return { alpha: 0, scale: 0.97 };
    if (t >= 1) return { alpha: 1, scale: 1 };
    const alpha = 1 - Math.pow(1 - t, 3); // easeOutCubic
    return { alpha, scale: 0.97 + 0.03 * alpha };
  }

  // Heartbeat pop for the center mark icon: pops in from nothing on the
  // first beat, then keeps beating — hand-tuned keyframes matching the
  // reference video's rhythm (quick overshoot, small undershoot, smaller
  // overshoot, settle), smoothstepped between.
  const HEARTBEAT_KEYFRAMES = [
    [0.00, 0.00], [0.10, 1.16], [0.30, 0.95],
    [0.48, 1.10], [0.68, 0.99], [1.00, 1.00],
  ];
  function keyframeScale(t, keyframes) {
    for (let i = 0; i < keyframes.length - 1; i++) {
      const [t0, v0] = keyframes[i], [t1, v1] = keyframes[i + 1];
      if (t >= t0 && t <= t1) {
        const local = (t - t0) / (t1 - t0);
        const eased = 0.5 - 0.5 * Math.cos(Math.PI * local);
        return v0 + (v1 - v0) * eased;
      }
    }
    return 1;
  }
  function heartbeatScale(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return keyframeScale(t, HEARTBEAT_KEYFRAMES);
  }

  // A gentler bounce (no pop-in-from-zero) for repeat beats after the first,
  // once the element is already fully visible.
  const REPEAT_BEAT_KEYFRAMES = [
    [0.00, 1.00], [0.20, 1.15], [0.50, 0.92], [0.80, 1.08], [1.00, 1.00],
  ];
  // Plays the heartbeat `beats` times over `beatMs` each: the first beat
  // pops in from nothing (scale 0), the rest are gentler bounces around 1 —
  // then holds at 1 once all beats are done.
  function repeatingHeartbeatScale(elapsed, beats, beatMs) {
    if (elapsed == null) return 1;
    if (elapsed <= 0) return 0;
    const totalMs = beatMs * beats;
    if (elapsed >= totalMs) return 1;
    const beatIdx = Math.min(beats - 1, Math.floor(elapsed / beatMs));
    const localT = (elapsed - beatIdx * beatMs) / beatMs;
    return beatIdx === 0 ? heartbeatScale(localT) : keyframeScale(localT, REPEAT_BEAT_KEYFRAMES);
  }




  // Winner-line wipe: grows outward from the row's center, fast until it
  // reaches the icon's own edge, then slow the rest of the way out —
  // returns a 0..1 fraction of the total half-row distance to reveal.
  function arrowWipeProgress(t, fastFraction) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const fastTimeFrac = 0.35;
    if (t <= fastTimeFrac) {
      const local = t / fastTimeFrac;
      return fastFraction * (1 - Math.pow(1 - local, 2));
    }
    const local = (t - fastTimeFrac) / (1 - fastTimeFrac);
    return fastFraction + (1 - fastFraction) * (1 - Math.pow(1 - local, 2));
  }

  // Full per-row animation state. `globalElapsed` is ms since the whole
  // animation started; `i`/`rowCount` place this row within Stage A (bar)
  // and Stage B (scores), which run on separate global clocks. Returns
  // null before this row's own bar starts popping in.
  function resultRowAnimState(globalElapsed, i, rowCount) {
    const barLocal = globalElapsed - i * STAGE_A_STAGGER_MS;
    if (barLocal <= 0) return null;
    const bar = rowReveal(Math.min(barLocal / PHASE1_MS, 1));
    // Icon pops in together with the bar/badges (not after the pause) so
    // there's no empty gap sitting in its spot while waiting.
    const iconScale = heartbeatScale(Math.min(Math.max(barLocal, 0) / ICON_MS, 1));
    // Stage B (scores) only starts once every row has finished Stage A,
    // then cascades per row with its own (slower) stagger.
    const e2 = globalElapsed - stageBStartMs(rowCount) - i * STAGE_B_STAGGER_MS;
    const arrowT = Math.min(Math.max(e2, 0) / ARROW_WIPE_MS, 1);
    const home = rowReveal(Math.min(Math.max(e2, 0) / ELEMENT_POP_MS, 1));
    const away = rowReveal(Math.min(Math.max(e2 - ELEMENT_STAGGER_MS, 0) / ELEMENT_POP_MS, 1));
    return {
      bar,
      iconScale,
      arrowT: e2 > 0 ? arrowT : 0,
      winnerElapsed: e2 > 0 ? e2 : null,
      home: e2 > 0 ? home : { alpha: 0, scale: 0.97 },
      away: e2 - ELEMENT_STAGGER_MS > 0 ? away : { alpha: 0, scale: 0.97 },
    };
  }

  function animTotalDuration(rowCount) {
    const lastRowScoreDone = Math.max(0, rowCount - 1) * STAGE_B_STAGGER_MS
      + Math.max(ARROW_WIPE_MS, ELEMENT_STAGGER_MS + ELEMENT_POP_MS);
    return stageBStartMs(rowCount) + lastRowScoreDone;
  }

  // Full clip length: the reveal cascade, then whatever's left of the 15s
  // target as a hold (never shorter than the reveal itself, for rounds
  // with enough matches that the cascade alone runs past 15s).
  function animClipDuration(rowCount) {
    return Math.max(animTotalDuration(rowCount), ANIM_TOTAL_TARGET_MS);
  }

  function stopResultsAnimationLoop() {
    if (animRafId) cancelAnimationFrame(animRafId);
    animRafId = null;
  }

  // Drives the on-screen looping preview (not the recording — see
  // recordResultsAnimation, which runs its own single, unlooped pass so the
  // exported clip doesn't restart mid-recording).
  function startResultsAnimationLoop() {
    stopResultsAnimationLoop();
    animStartTs = performance.now();
    const loop = () => {
      render();
      const elapsed = performance.now() - animStartTs;
      const total = animClipDuration(visibleMatches().length);
      if (elapsed >= total) {
        if (!resultsAnimating) return;
        animStartTs = performance.now();
      }
      animRafId = requestAnimationFrame(loop);
    };
    animRafId = requestAnimationFrame(loop);
  }

  async function recordResultsAnimation() {
    stopResultsAnimationLoop();
    let mimeType = 'video/mp4;codecs=avc1';
    if (!(window.MediaRecorder && MediaRecorder.isTypeSupported(mimeType))) mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

    animStartTs = performance.now();
    recorder.start();
    const total = animClipDuration(visibleMatches().length);
    await new Promise((resolve) => {
      const loop = () => {
        render();
        if (performance.now() - animStartTs < total) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
    });
    recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${compKey}-results-animatie.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (resultsAnimating) startResultsAnimationLoop();
    else { animStartTs = null; render(); }
  }

  // ---------- Single-match "pop in" animation ----------
  // Everything (cards, bar, text) is static/visible immediately — only the
  // mark icon, and for Vrouwen the chevron accent, actually animate.
  //
  // Icon: exact AE keyframe export (25fps, one beat = 13 frames = 520ms):
  // frame 0=100%, 3=118%, 6=93%, 9=110%, 13=100%. It's ALWAYS visible at
  // rest (never pops in from 0) and repeats this same bounce every beat —
  // unlike the Results system's heartbeatScale above, which pops in from 0
  // (a different, already-tuned feature; left untouched).
  const SM_BEATS = 1;
  const SM_ICON_BEAT_KEYFRAMES = [
    [0 / 13, 1.00], [3 / 13, 1.18], [6 / 13, 0.93], [9 / 13, 1.10], [13 / 13, 1.00],
  ];
  function smRepeatingIconScale(elapsed, beats, beatMs) {
    if (elapsed == null) return 1;
    if (elapsed <= 0) return 1;
    const totalMs = beatMs * beats;
    if (elapsed >= totalMs) return 1;
    const beatIdx = Math.min(beats - 1, Math.floor(elapsed / beatMs));
    const localT = (elapsed - beatIdx * beatMs) / beatMs;
    return keyframeScale(localT, SM_ICON_BEAT_KEYFRAMES);
  }

  // Vrouwen chevron accent: one continuous eased curve — hard-appears at
  // the start (matching the reference clip), grows 90% -> 100% (at 1300ms)
  // -> 113% (at 1820ms) without ever freezing, then fades out fast (200ms,
  // cubic ease-out) right at the end — all measured directly off the AE
  // project's own keyframes plus the reference video's per-frame pixel
  // area. Settles back to its normal (unscaled, fully hidden) state for
  // the remainder of the clip, same as the reference.
  const SM_CHEVRON_100PCT_MS = 1300;
  const SM_CHEVRON_GROW_MS = 1820;
  const SM_CHEVRON_FADE_MS = 200;
  const SM_CHEVRON_FADE_IN_MS = 180; // soft start instead of a hard pop-in
  const SM_CHEVRON_KEYFRAMES = [
    [0, 0.90], [SM_CHEVRON_100PCT_MS / SM_CHEVRON_GROW_MS, 1.00], [1, 1.13],
  ];
  function smChevronState(elapsed) {
    if (elapsed == null) return { scale: 1, opacity: 1 };
    if (elapsed <= 0) return { scale: SM_CHEVRON_KEYFRAMES[0][1], opacity: 0 };
    const t = Math.min(1, elapsed / SM_CHEVRON_GROW_MS);
    const scale = keyframeScale(t, SM_CHEVRON_KEYFRAMES);
    const fadeStart = (SM_CHEVRON_GROW_MS - SM_CHEVRON_FADE_MS) / SM_CHEVRON_GROW_MS;
    let opacity = 1;
    if (t > fadeStart) {
      const ft = (t - fadeStart) / (1 - fadeStart);
      opacity = Math.pow(1 - ft, 3); // fast-then-trailing, matches the reference
    } else if (elapsed < SM_CHEVRON_FADE_IN_MS) {
      // Soft fade in instead of a hard pop-in.
      const fit = elapsed / SM_CHEVRON_FADE_IN_MS;
      opacity = 0.5 - 0.5 * Math.cos(Math.PI * fit);
    }
    return { scale, opacity };
  }

  let smAnimating = false;
  let smAnimStartTs = null;
  let smAnimRafId = null;

  function smAnimClipDuration() {
    return Math.max(ICON_MS * SM_BEATS, ANIM_TOTAL_TARGET_MS);
  }

  function smAnimElapsed() {
    return (isSingleMode()) && smAnimating && smAnimStartTs != null
      ? performance.now() - smAnimStartTs : null;
  }

  // Only the score itself waits, then fades in — everything else (badges,
  // mark, footer) is there immediately. The icon+chevron beat loop starts
  // only once the score has finished appearing.
  const SM_SCORE_DELAY_MS = 500;
  const SM_SCORE_FADE_MS = 200;
  const SM_SCORE_REVEAL_MS = SM_SCORE_DELAY_MS + SM_SCORE_FADE_MS;
  function smScoreRevealAlpha() {
    const elapsed = smAnimElapsed();
    if (elapsed == null) return 1;
    if (elapsed <= SM_SCORE_DELAY_MS) return 0;
    if (elapsed >= SM_SCORE_REVEAL_MS) return 1;
    const t = (elapsed - SM_SCORE_DELAY_MS) / SM_SCORE_FADE_MS;
    return 1 - Math.pow(1 - t, 3);
  }

  // The icon+chevron animation loops once every 3s throughout the whole
  // clip, instead of playing once and holding static for the rest of it.
  const SM_LOOP_CYCLE_MS = 3000;
  function smCycleElapsed() {
    const elapsed = smAnimElapsed();
    if (elapsed == null) return null;
    const shifted = elapsed - SM_SCORE_REVEAL_MS;
    return shifted < 0 ? null : shifted % SM_LOOP_CYCLE_MS;
  }

  function stopSmAnimationLoop() {
    if (smAnimRafId) cancelAnimationFrame(smAnimRafId);
    smAnimRafId = null;
  }

  function startSmAnimationLoop() {
    stopSmAnimationLoop();
    smAnimStartTs = performance.now();
    const loop = () => {
      render();
      const elapsed = performance.now() - smAnimStartTs;
      if (elapsed >= smAnimClipDuration()) {
        if (!smAnimating) return;
        smAnimStartTs = performance.now();
      }
      smAnimRafId = requestAnimationFrame(loop);
    };
    smAnimRafId = requestAnimationFrame(loop);
  }

  async function recordSmAnimation() {
    stopSmAnimationLoop();
    let mimeType = 'video/mp4;codecs=avc1';
    if (!(window.MediaRecorder && MediaRecorder.isTypeSupported(mimeType))) mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

    smAnimStartTs = performance.now();
    recorder.start();
    const total = smAnimClipDuration();
    await new Promise((resolve) => {
      const loop = () => {
        render();
        if (performance.now() - smAnimStartTs < total) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
    });
    recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${compKey}-${mode}-animatie.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (smAnimating) startSmAnimationLoop();
    else { smAnimStartTs = null; render(); }
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
    } else if (mode === 'playerweek') {
      matchesLabel.textContent = compKey === 'women' ? 'Speelster van de week' : 'Speler van de week';
      modeHint.textContent = 'Kies de club en vul de naam in. Upload bij Opmaak de foto.';
    } else if (mode === 'topscorer') {
      matchesLabel.textContent = 'Top scorer & uitslag';
      modeHint.textContent = 'Kies een wedstrijd, vul de eindstand in en de gegevens van de topscorer. Upload bij Opmaak een spelersfoto.';
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

  const postDecorField = document.getElementById('postDecorField');
  const postDecorToggle = document.getElementById('postDecorToggle');
  postDecorToggle.addEventListener('change', () => { postDecor = postDecorToggle.checked; render(); });

  // Results: show the date(s). One shared date goes under the title when all
  // played results are on the same day; with several days, each result gets
  // its own date under its middle icon.
  const showDateField = document.getElementById('showDateField');
  const showDateToggle = document.getElementById('showDateToggle');
  let showDates = false;
  let resultDateMode = 'none'; // 'none' | 'header' | 'rows' — recomputed on every render
  showDateToggle.addEventListener('change', () => {
    showDates = showDateToggle.checked;
    buildMatchRows();
    render();
  });
  // Comparable key for "SAT 5 SEP" / "ZATERDAG 5 SEPTEMBER" / "ZAT 5 SEP": day + month.
  function dateKey(str) {
    const d = /(\d+)\s+([A-Za-z]+)/.exec(str || '');
    if (!d) return (str || '').trim().toUpperCase();
    const abbr = d[2].toUpperCase();
    const month = Object.keys(MONTHS).find(k => k.startsWith(abbr.slice(0, 3)));
    return `${parseInt(d[1], 10)}-${month ? MONTHS[month] : abbr}`;
  }
  function resultDates() {
    return visibleMatches().filter(m => m.played !== false).map(m => m.rowDate || defaultRowDate(m));
  }

  // ---- Schedule dates: one entry per match (round date, or its own other-day date) ----
  function shortFromFull(full) {
    const d = /^([A-Z]+)\s+(\d+)\s+([A-Z]+)/.exec(full || '');
    if (!d) return full || '';
    return `${d[1].slice(0, 3)} ${d[2]} ${/^MAART/.test(d[3]) ? 'MRT' : d[3].slice(0, 3)}`;
  }
  function scheduleDateInfo(m) {
    let full = String(state.date || '').toUpperCase();
    const dm = m.showDate && m.dateLabel ? /(\d+)-(\d+)/.exec(m.dateLabel) : null;
    if (dm) {
      const now = new Date();
      const seasonYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      const mon = parseInt(dm[2], 10);
      const dt = new Date(mon >= 7 ? seasonYear : seasonYear + 1, mon - 1, parseInt(dm[1], 10));
      full = dt.toLocaleDateString(compKey === 'women' ? 'nl-NL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    }
    return { key: dateKey(full), full, short: shortFromFull(full) };
  }
  function computeResultDateMode() {
    if (!showDates || mode !== 'results') return { mode: 'none' };
    const dates = resultDates().filter(Boolean);
    if (!dates.length) return { mode: 'none' };
    const keys = new Set(dates.map(dateKey));
    if (keys.size > 1) return { mode: 'rows' };
    // all on one day: full round date when nobody overrides it, else the shared label
    const overridden = visibleMatches().some(m => m.played !== false && m.rowDate && dateKey(m.rowDate) !== dateKey(defaultRowDate({})));
    return { mode: 'header', text: (!overridden && state.date ? state.date : dates[0]).toUpperCase() };
  }

  // ---------- Vrouwen single-match format toggle (Story / Post) ----------
  const smwFormatField = document.getElementById('smwFormatField');
  const smwFormatBtns = document.querySelectorAll('[data-smw-format]');
  function syncFormatButtons() {
    const current = isListMode() ? resultsFormat : smFormat;
    smwFormatBtns.forEach(b => b.classList.toggle('active', b.dataset.smwFormat === current));
  }
  smwFormatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isListMode()) resultsFormat = btn.dataset.smwFormat;
      else smFormat = btn.dataset.smwFormat;
      syncFormatButtons();
      const sz = smCanvasSize();
      canvas.width = sz.w;
      canvas.height = sz.h;
      clampBgPhotoOffsets();
      render();
    });
  });

  // ---------- Background photo (Match/Matchresult, both competitions) ----------
  const bgPhotoField = document.getElementById('bgPhotoField');
  const bgPhotoInput = document.getElementById('bgPhotoInput');
  const bgPhotoControls = document.getElementById('bgPhotoControls');
  const bgPhotoZoom = document.getElementById('bgPhotoZoom');
  const removeBgPhotoBtn = document.getElementById('removeBgPhotoBtn');
  const photoBtnText = document.getElementById('photoBtnText');
  const photoDrop = document.getElementById('photoDrop');
  ['dragenter', 'dragover'].forEach(ev => photoDrop.addEventListener(ev, (e) => { e.preventDefault(); photoDrop.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(ev => photoDrop.addEventListener(ev, (e) => { e.preventDefault(); photoDrop.classList.remove('drag-over'); }));
  photoDrop.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !/^image\//.test(f.type)) return;
    const dt = new DataTransfer(); dt.items.add(f);
    bgPhotoInput.files = dt.files;
    bgPhotoInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

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
        uploadItemPhoto();
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
    deleteItemPhoto();
    render();
  });

  // Where a background photo can be used: every single-match graphic, Results/Schedule
  // (Story and Post) and the Ranking Post.
  function photoModeActive() {
    return isSingleMode() || mode === 'results' || mode === 'schedule' || (mode === 'ranking' && resultsFormat === 'post');
  }
  // In the Post formats the photo is drawn into the canvas (so PNG and MP4 contain it) with
  // a subtle navy gradient on the side the block sits on, keeping the rows readable.
  // Without a photo the Post stays fully transparent.
  function drawPostPhoto(side) {
    if (!bgPhotoImg) return;
    drawBgPhotoCover(ctx, bgPhotoImg);
    const W = canvas.width;
    const g = side === 'right' ? ctx.createLinearGradient(W * 0.3, 0, W, 0) : ctx.createLinearGradient(W * 0.7, 0, 0, 0);
    g.addColorStop(0, 'rgba(26, 27, 56, 0)');
    g.addColorStop(1, 'rgba(26, 27, 56, 0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, canvas.height);
  }

  // Drag-to-pan directly on the preview. Pointer events cover mouse + touch
  // uniformly; delta is scaled from displayed (CSS) pixels to actual canvas
  // pixels since the preview is shown scaled down.
  let bgPhotoDragging = false;
  let bgPhotoDragStart = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!bgPhotoImg || !photoModeActive()) return;
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

  // Scroll-to-zoom directly on the preview, on top of the slider — feels
  // more like a native photo editor than a slider-only control.
  canvas.addEventListener('wheel', (e) => {
    if (!bgPhotoImg || !photoModeActive()) return;
    e.preventDefault();
    const min = parseFloat(bgPhotoZoom.min), max = parseFloat(bgPhotoZoom.max);
    const step = -e.deltaY * 0.0015;
    bgPhotoScale = Math.max(min, Math.min(max, bgPhotoScale + step));
    bgPhotoZoom.value = String(bgPhotoScale);
    clampBgPhotoOffsets();
    render();
  }, { passive: false });

  // ---------- Results "pop in" animation ----------
  const resultsAnimField = document.getElementById('resultsAnimField');
  const resultsAnimateToggle = document.getElementById('resultsAnimateToggle');
  const downloadMp4Btn = document.getElementById('downloadMp4Btn');
  const mp4Status = document.getElementById('mp4Status');

  resultsAnimateToggle.addEventListener('change', () => {
    resultsAnimating = resultsAnimateToggle.checked;
    downloadMp4Btn.hidden = !resultsAnimating;
    if (resultsAnimating) startResultsAnimationLoop();
    else { stopResultsAnimationLoop(); animStartTs = null; render(); }
  });

  downloadMp4Btn.addEventListener('click', async () => {
    downloadMp4Btn.disabled = true;
    mp4Status.hidden = false;
    mp4Status.textContent = 'Bezig met opnemen…';
    mp4Status.className = 'save-status';
    try {
      await recordResultsAnimation();
      mp4Status.textContent = '✓ Video gedownload';
      mp4Status.className = 'save-status ok';
    } catch (err) {
      console.error('MP4-opname mislukt:', err);
      mp4Status.textContent = 'Opname mislukt — probeer het opnieuw.';
      mp4Status.className = 'save-status warn';
    }
    downloadMp4Btn.disabled = false;
  });

  // Called whenever leaving Results mode (or switching away from it) so a
  // running/queued animation and its download button don't linger.
  function resetResultsAnim() {
    resultsAnimating = false;
    resultsAnimateToggle.checked = false;
    stopResultsAnimationLoop();
    animStartTs = null;
    resultsAnimField.hidden = true;
    downloadMp4Btn.hidden = true;
    mp4Status.hidden = true;
  }

  // ---------- Single-match "pop in" animation ----------
  const smAnimField = document.getElementById('smAnimField');
  const smAnimateToggle = document.getElementById('smAnimateToggle');
  const smDownloadMp4Btn = document.getElementById('smDownloadMp4Btn');
  const smMp4Status = document.getElementById('smMp4Status');

  smAnimateToggle.addEventListener('change', () => {
    smAnimating = smAnimateToggle.checked;
    smDownloadMp4Btn.hidden = !smAnimating;
    if (smAnimating) startSmAnimationLoop();
    else { stopSmAnimationLoop(); smAnimStartTs = null; render(); }
  });

  smDownloadMp4Btn.addEventListener('click', async () => {
    smDownloadMp4Btn.disabled = true;
    smMp4Status.hidden = false;
    smMp4Status.textContent = 'Bezig met opnemen…';
    smMp4Status.className = 'save-status';
    try {
      await recordSmAnimation();
      smMp4Status.textContent = '✓ Video gedownload';
      smMp4Status.className = 'save-status ok';
    } catch (err) {
      console.error('MP4-opname mislukt:', err);
      smMp4Status.textContent = 'Opname mislukt — probeer het opnieuw.';
      smMp4Status.className = 'save-status warn';
    }
    smDownloadMp4Btn.disabled = false;
  });

  // Called whenever leaving Match/Matchresult mode so a running/queued
  // animation and its download button don't linger.
  function resetSmAnim() {
    smAnimating = false;
    smAnimateToggle.checked = false;
    stopSmAnimationLoop();
    smAnimStartTs = null;
    smAnimField.hidden = true;
    smDownloadMp4Btn.hidden = true;
    smMp4Status.hidden = true;
  }

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
  // per-item server persistence (see "Per-item persistence" near the end)
  let lastItemKey = null, itemLoaded = false, itemSaveTimer = null, lastSavedItemJson = '';

  // ---------- Autosave (survives a page reload) ----------
  // Plain localStorage — per-browser, not shared between devices, but that's
  // enough to stop a refresh from wiping out scores you already typed in.
  const STORAGE_KEY = 'shl-story-generator-v1';

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        compKey, mode, roundId: currentRoundId, date: state.date, matches: state.matches,
        sm: smState, transparentBg, showDates, resultsFormat, postDecor, ranking: rankState,
      }));
    } catch (err) { /* private browsing / quota / disabled storage — just skip */ }
    scheduleServerSave();
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
          sm: smState, transparentBg, showDates, resultsFormat, ranking: rankState,
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

  // Single-match (Matchresult / Top scorer): fill the score of the selected
  // match. The site's team names resolve to the Results-style codes; the
  // single-match templates use a few different codes for the same clubs.
  const SINGLE_CODE = {
    men: { HCS: 'SPR' },
    women: { 'E&O': 'ENO', FOR: 'FORE', VEN: 'FORV', 'V&L': 'VEL' },
  };
  const MONTH_ABBR = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function checkSingleMatchScore() {   // -> Promise<{text, cls}>
    const aliases = comp().resultAliases;
    const toSingle = (name) => {
      const c = matchCodeByAlias(aliases, name);
      return (SINGLE_CODE[compKey] && SINGLE_CODE[compKey][c]) || c;
    };
    return fetch('/api/results?comp=' + compKey)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) throw new Error(data.error);
        const pair = (data.results || []).filter(r => {
          const a = toSingle(r.teamA), b = toSingle(r.teamB);
          return (a === smState.home && b === smState.away) || (a === smState.away && b === smState.home);
        });
        // same pairing can appear twice (home and away leg): prefer this fixture's day
        const dm = /(\d+)-(\d+)/.exec(smState.dateRound || '');
        const sameDay = dm ? pair.find(r => {
          const sm = /(\d+)\s+([A-Za-z]{3})/.exec(r.date || '');
          return sm && MONTH_ABBR[sm[2].toLowerCase()] === parseInt(dm[2], 10)
            && (parseInt(sm[1], 10) === parseInt(dm[1], 10) || parseInt(sm[1], 10) === parseInt(dm[1], 10) + 1);
        }) : null;
        const hit = sameDay || pair[0];
        if (!hit) return { text: `Nog geen uitslag gevonden op ${SITE_LABEL[compKey]}`, cls: 'warn' };
        const homeIsA = toSingle(hit.teamA) === smState.home;
        smState.homeScore = String(homeIsA ? hit.scoreA : hit.scoreB);
        smState.awayScore = String(homeIsA ? hit.scoreB : hit.scoreA);
        buildMatchRows();
        render();
        return { text: `✓ Uitslag ingevuld: ${smState.homeScore} – ${smState.awayScore}`, cls: 'ok' };
      })
      .catch(err => ({ text: '✗ Score ophalen mislukt: ' + err.message, cls: 'warn' }));
  }

  // Scores step of the combined "Check" button -> Promise<{text, cls}>.
  function checkScoresStep() {
  if (isSingleMode()) return checkSingleMatchScore();
  const aliases = comp().resultAliases;
  if (!aliases) return Promise.resolve({ text: 'Scores niet beschikbaar voor deze competitie', cls: 'warn' });
  return fetch('/api/results?comp=' + compKey)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      if (data.error) throw new Error(data.error);
      const scraped = data.results || [];
      let filled = 0;
      state.matches.forEach(m => {
        if (!m.home || !m.away) return;
        const pair = scraped.filter(r => {
          const a = matchCodeByAlias(aliases, r.teamA);
          const b = matchCodeByAlias(aliases, r.teamB);
          return (a === m.home && b === m.away) || (a === m.away && b === m.home);
        });
        // The same pairing can be on the site twice (home and away leg):
        // prefer the one played on this round's day (or the day after).
        const dm = /(\d+)\s+([A-Za-z]+)/.exec(state.date || '');
        const sameDay = dm ? pair.find(r => {
          const sm = /(\d+)\s+([A-Za-z]{3})/.exec(r.date || '');
          if (!sm) return false;
          const day = parseInt(dm[1], 10);
          return sm[2].toLowerCase() === dm[2].slice(0, 3).toLowerCase()
            && (parseInt(sm[1], 10) === day || parseInt(sm[1], 10) === day + 1);
        }) : null;
        const hit = sameDay || pair[0];
        if (!hit) return;
        const homeIsA = matchCodeByAlias(aliases, hit.teamA) === m.home;
        m.homeScore = String(homeIsA ? hit.scoreA : hit.scoreB);
        m.awayScore = String(homeIsA ? hit.scoreB : hit.scoreA);
        m.played = true;
        if (hit.date) m.rowDate = localizeSiteDate(hit.date);
        filled++;
      });
      if (filled > 0) {
        buildMatchRows();
        render();
        return { text: `✓ ${filled} van ${state.matches.length} scores ingevuld`, cls: 'ok' };
      }
      return { text: `Geen bijpassende scores gevonden op ${SITE_LABEL[compKey]}`, cls: 'warn' };
    })
    .catch(err => ({ text: '✗ Score ophalen mislukt: ' + err.message, cls: 'warn' }));
  }

  // ---------- Schedule sync with the site ----------
  // The CSVs go stale (kickoff moved, a match shifted day, home/away swapped). This pulls the
  // site's complete fixture list and REPLACES the schedule: round contents, dates, times and
  // home/away for every round (Results/Schedule) and for the single-match list. Typed scores
  // survive for matches whose home/away didn't change. Runs by itself once per competition per
  // page load, and on demand via the "Check schema" button.
  const scheduleSynced = { men: false, women: false };

  function parseDayMonth(datum) {
    const m = /(\d+)\s+([A-Za-z]+)/.exec(datum || '');
    const month = m ? MONTHS[m[2].toUpperCase()] : undefined;
    return m && month !== undefined ? { day: parseInt(m[1], 10), month: month + 1 } : null;
  }
  const pad2 = (n) => String(n).padStart(2, '0');

  function dateParts(day, month) {
    const now = new Date();
    const seasonYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const dt = new Date(month >= 7 ? seasonYear : seasonYear + 1, month - 1, day);
    const nl = compKey === 'women';
    return {
      t: dt.getTime(),
      full: dt.toLocaleDateString(nl ? 'nl-NL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase(),
      weekday: dt.toLocaleDateString(nl ? 'nl-NL' : 'en-GB', { weekday: nl ? 'long' : 'short' }).toUpperCase(),
    };
  }

  function applySiteSchedule(fixtures) {
    const aliases = comp().resultAliases;
    const toSingle = (c) => (SINGLE_CODE[compKey] && SINGLE_CODE[compKey][c]) || c;
    const oldTime = new Map();                       // existing kickoff per unordered pair (for feeds without times)
    rounds.forEach(r => r.matches.forEach(m => oldTime.set([m.home, m.away].sort().join('|') + '|' + r.roundNum, m.time)));
    const oldSingleIds = new Map(smMatches.map(m => [m.id, `${m.dateRound}|${m.time}`]));

    const entries = fixtures.map(f => ({
      home: matchCodeByAlias(aliases, f.home), away: matchCodeByAlias(aliases, f.away),
      day: f.day, month: f.month, time: f.time || '', round: f.round || null,
    })).filter(e => e.home && e.away);

    // feeds without a round number (Vrouwen): take the CSV round of that pairing closest in date
    entries.forEach(e => {
      if (e.round) return;
      const et = dateParts(e.day, e.month).t;
      let best = null;
      rounds.forEach(r => {
        const rd = parseDayMonth(r.datum);
        if (!rd) return;
        if (!r.matches.some(m => (m.home === e.home && m.away === e.away) || (m.home === e.away && m.away === e.home))) return;
        const dist = Math.abs(dateParts(rd.day, rd.month).t - et);
        if (!best || dist < best.dist) best = { dist, roundNum: r.roundNum };
      });
      if (best) e.round = best.roundNum;
    });
    const usable = entries.filter(e => e.round);

    // 1. rounds. Several matches played midweek next to weekend matches are split off into a
    // separate "tussenronde" (an extra entry in the round list); a lone midweek match just
    // stays in its round with its own date.
    rounds = rounds.filter(r => !r.isInterim);
    const byRound = new Map();
    usable.forEach(e => { if (!byRound.has(e.round)) byRound.set(e.round, []); byRound.get(e.round).push(e); });
    const isWeekday = (e) => { const d = new Date(dateParts(e.day, e.month).t).getDay(); return d >= 1 && d <= 5; };
    const byDateTime = (a, b) => dateParts(a.day, a.month).t - dateParts(b.day, b.month).t || (a.time || '').localeCompare(b.time || '');
    const buildBlock = (list, roundNum) => {
      list.sort(byDateTime);
      const counts = new Map();
      list.forEach(e => counts.set(`${e.day}-${e.month}`, (counts.get(`${e.day}-${e.month}`) || 0) + 1));
      const mainKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split('-').map(Number);
      return {
        datum: dateParts(mainKey[0], mainKey[1]).full,
        matches: list.slice(0, 7).map(e => {
          const otherDay = e.day !== mainKey[0] || e.month !== mainKey[1];
          const time = e.time || oldTime.get([e.home, e.away].sort().join('|') + '|' + roundNum) || '';
          return { time, home: e.home, away: e.away, otherDay, otherDayLabel: otherDay ? `${pad2(e.day)}-${pad2(e.month)}` : '' };
        }),
      };
    };
    const interim = [];
    rounds.forEach(r => {
      const list = byRound.get(r.roundNum);
      if (!list || !list.length) return;
      const wd = list.filter(isWeekday), we = list.filter(e => !isWeekday(e));
      let mainList = list;
      if (wd.length >= 2 && we.length > wd.length) {
        mainList = we;
        const block = buildBlock(wd, r.roundNum);
        interim.push({ id: `${r.id}__tussen`, roundNum: r.roundNum, isInterim: true, datum: block.datum, matches: block.matches });
      }
      const block = buildBlock(mainList, r.roundNum);
      r.datum = block.datum; r.matches = block.matches;
    });
    if (interim.length) {
      rounds.push(...interim);
      rounds.sort((a, b) => {
        const da = parseDayMonth(a.datum), db = parseDayMonth(b.datum);
        return (da ? dateParts(da.day, da.month).t : 0) - (db ? dateParts(db.day, db.month).t : 0);
      });
    }

    // 2. single-match list
    const roundWord = compKey === 'women' ? 'RONDE' : 'ROUND';
    const sorted = usable.slice().sort((a, b) =>
      dateParts(a.day, a.month).t - dateParts(b.day, b.month).t || (a.time || '').localeCompare(b.time || '') || a.round - b.round);
    const newSingle = sorted.map(e => {
      const home = toSingle(e.home), away = toSingle(e.away), dp = dateParts(e.day, e.month);
      const time = e.time || oldTime.get([e.home, e.away].sort().join('|') + '|' + e.round) || '';
      return { id: `r${e.round}_${home}-${away}`, dateRound: `${dp.weekday} ${pad2(e.day)}-${pad2(e.month)} | ${roundWord} ${e.round}`, time, home, away, roundNum: e.round };
    });
    let changed = 0;
    newSingle.forEach(m => { if (oldSingleIds.get(m.id) !== `${m.dateRound}|${m.time}`) changed++; });
    if (newSingle.length) smMatches = newSingle;
    return { changed, total: newSingle.length };
  }

  // After the data changed: rebuild dropdowns and reload what's on screen, keeping typed scores.
  function refreshAfterScheduleChange() {
    if (isSingleMode()) {
      const prev = smMatches.length ? { id: smState.id, home: smState.home, away: smState.away } : null;
      populateSingleMatchSelect();
      if (mode === 'playerweek') return;
      const target = smMatches.find(m => m.id === smState.id)
        || smMatches.find(m => prev && m.home === prev.home && m.away === prev.away)
        || smMatches.find(m => prev && m.home === prev.away && m.away === prev.home)
        || smMatches[0];
      if (target) loadSingleMatch(target, target.id === smState.id ? smState : null);
    } else if (mode !== 'ranking') {
      const before = state.matches.slice();
      populateRoundSelect();
      const round = rounds.find(r => r.id === currentRoundId) || rounds[0];
      if (round) {
        loadRound(round);
        state.matches.forEach(m => {
          const old = before.find(o => o.home === m.home && o.away === m.away);
          if (old) Object.assign(m, { homeScore: old.homeScore, awayScore: old.awayScore, played: old.played === false ? false : m.played,
            hidden: old.hidden, showRowDate: old.showRowDate, rowDate: old.rowDate });
        });
        buildMatchRows();
        render();
      }
    }
  }

  function fetchAndApplySchedule() {
    return fetch('/api/schedule?comp=' + compKey)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) throw new Error(data.error);
        const result = applySiteSchedule(data.fixtures || []);
        refreshAfterScheduleChange();
        return result;
      });
  }

  function checkScheduleStep() {   // -> Promise<{text, cls}>
    return fetchAndApplySchedule()
      .then(r => ({
        text: r.changed ? `✓ Schema vervangen: ${r.changed} wedstrijden gewijzigd (${r.total} totaal)` : '✓ Schema klopt al',
        cls: 'ok',
      }))
      .catch(err => ({ text: '✗ Schema ophalen mislukt: ' + err.message, cls: 'warn' }));
  }

  // One button: schema first (rounds/dates/times may change), then the scores of the (new) round.
  function checkSite() {
    if (checkScoresBtn.disabled) return;
    checkScoresBtn.disabled = true;
    showCheckStatus(`Ophalen van ${SITE_LABEL[compKey]}…`);
    const withScores = mode !== 'match';   // a fixture has no score yet
    checkScheduleStep()
      .then(sr => (withScores ? checkScoresStep() : Promise.resolve(null)).then(cr => [sr, cr].filter(Boolean)))
      .then(parts => {
        showCheckStatus(parts.map(p => p.text).join(' · '), parts.some(p => p.cls === 'warn') ? 'warn' : 'ok');
        markSiteChecked();
      })
      .finally(() => { checkScoresBtn.disabled = false; });
  }
  if (checkScoresBtn) checkScoresBtn.addEventListener('click', checkSite);

  // Silent, once per competition per page load, as soon as both lists for it have loaded.
  function maybeAutoSyncSchedule() {
    if (scheduleSynced[compKey] || roundsCompKey !== compKey || smLoadedKey !== compKey) return;
    scheduleSynced[compKey] = true;
    fetchAndApplySchedule().catch(() => { scheduleSynced[compKey] = false; });
  }

  // ---------- Jump to the date closest to today ----------
  // Results / Matchresult / Top scorer: the most recent round or match (already played).
  // Schedule / Match: the next one coming up. Falls back to whichever exists.
  function jumpToNearestDate() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const seasonYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const toTime = (day, month) => new Date(month >= 7 ? seasonYear : seasonYear + 1, month - 1, day).getTime();
    const wantsPast = mode === 'results' || mode === 'matchresult' || mode === 'topscorer';
    let items;
    if (isSingleMode()) {
      items = smMatches.map(m => {
        const d = /(\d+)-(\d+)/.exec(m.dateRound || '');
        return d ? { id: m.id, t: toTime(parseInt(d[1], 10), parseInt(d[2], 10)), label: `Ronde ${m.roundNum}: ${m.home} vs ${m.away}` } : null;
      });
    } else {
      items = rounds.map(r => {
        const d = parseDayMonth(r.datum);
        return d ? { id: r.id, t: toTime(d.day, d.month), label: `Ronde ${r.roundNum} — ${r.datum}` } : null;
      });
    }
    items = items.filter(Boolean);
    if (!items.length) return;
    const past = items.filter(i => i.t <= today).sort((a, b) => b.t - a.t)[0];
    const next = items.filter(i => i.t >= today).sort((a, b) => a.t - b.t)[0];
    const pick = wantsPast ? (past || next) : (next || past);
    roundSelect.value = pick.id;
    roundSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Runs automatically whenever an asset is opened: waits for its data to load, then
  // jumps to the nearest date — unless the round/match on screen already has typed data.
  function hasTypedData() {
    if (isSingleMode()) {
      return !!(smState.homeScore || smState.awayScore || smState.tsGoals || smState.tsLast || smState.pwName);
    }
    return state.matches.some(m => m.homeScore !== '' || m.awayScore !== '');
  }
  function jumpWhenReady(attempt = 0) {
    if (mode === 'ranking' || mode === 'playerweek') return;
    const ready = isSingleMode() ? (smMatches.length > 0 && smLoadedKey === compKey) : rounds.length > 0 && roundsCompKey === compKey && state.matches.length > 0;
    if (!ready) { if (attempt < 25) setTimeout(() => jumpWhenReady(attempt + 1), 150); return; }
    if (!hasTypedData()) jumpToNearestDate();
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
      const aliases = comp().resultAliases;
      checkStandingsBtn.disabled = true;
      showStandingsStatus(`Stand ophalen van ${SITE_LABEL[compKey]}…`);
      fetch('/api/standings?comp=' + compKey)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data.error) throw new Error(data.error);
          const standings = data.standings || [];
          let filled = 0;
          const menRanking = rankState[compKey];
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
            showStandingsStatus(`Geen bijpassende teams gevonden op ${SITE_LABEL[compKey]}`, 'warn');
          }
        })
        .catch(err => showStandingsStatus('✗ Ophalen mislukt: ' + err.message, 'warn'))
        .finally(() => { checkStandingsBtn.disabled = false; });
    });
  }

  // ---------- Site monitor info (the server checks the data sites every 30 min) ----------
  const siteSyncInfo = document.getElementById('siteSyncInfo');
  let syncStatus = null;
  const seenKey = () => 'shl-site-seen-' + compKey;
  function readSeen() { try { return parseInt(localStorage.getItem(seenKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function markSiteChecked() {
    try { localStorage.setItem(seenKey(), String(Date.now())); } catch (e) { /* private mode */ }
    fetchSyncStatus(true);
  }
  function fmtWhen(ts) {
    const d = new Date(ts * 1000), tz = 'Europe/Amsterdam';
    const clock = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    const dayOf = (x) => x.toLocaleDateString('nl-NL', { timeZone: tz });
    const now = new Date();
    if (dayOf(d) === dayOf(now)) return 'vandaag ' + clock;
    if (dayOf(d) === dayOf(new Date(now - 864e5))) return 'gisteren ' + clock;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: tz }) + ' ' + clock;
  }
  function syncLines(key) {
    const st = syncStatus && syncStatus.status && syncStatus.status[key];
    if (!st || !st.checkedAt) return null;
    const lines = [`Server controleert de site elk half uur · laatst ${fmtWhen(st.checkedAt)}`];
    if (st.error) lines[0] += ' (⚠ laatste poging mislukt)';
    if (st.changedAt) {
      const c = st.changes || {};
      const bits = [];
      if (c.results) bits.push(`${c.results} uitslag${c.results === 1 ? '' : 'en'}`);
      if (c.schedule) bits.push(`${c.schedule} in schema`);
      if (c.standings) bits.push('stand');
      lines.push(`Laatste wijziging op de site: ${fmtWhen(st.changedAt)}${bits.length ? ' (' + bits.join(', ') + ')' : ''}`);
    } else {
      lines.push('Nog geen wijzigingen op de site gezien sinds de server draait');
    }
    return lines;
  }
  function renderSyncInfo() {
    if (!siteSyncInfo) return;
    const st = syncStatus && syncStatus.status && syncStatus.status[compKey];
    const lines = syncLines(compKey);
    if (!lines) { siteSyncInfo.textContent = ''; siteSyncInfo.hidden = true; renderOverviewMeta(); return; }
    const seen = readSeen();
    const fresh = st.changedAt && seen && st.changedAt * 1000 > seen;
    siteSyncInfo.textContent = lines.join('\n');
    siteSyncInfo.classList.toggle('fresh', !!fresh);
    if (fresh) siteSyncInfo.textContent += '\n● Nieuw op de site sinds je laatste check — druk op de knop om het over te nemen';
    siteSyncInfo.hidden = checkScoresBtn.hidden;
    renderOverviewMeta();
  }
  function fetchSyncStatus(refresh) {
    return fetch('/api/sync-status' + (refresh ? '?refresh=1&comp=' + compKey : ''))
      .then(r => r.json()).then(d => { syncStatus = d; renderSyncInfo(); }).catch(() => {});
  }
  try { if (!localStorage.getItem('shl-site-seen-men')) { localStorage.setItem('shl-site-seen-men', String(Date.now())); localStorage.setItem('shl-site-seen-women', String(Date.now())); } } catch (e) { /* ignore */ }
  fetchSyncStatus(false);
  setInterval(() => fetchSyncStatus(false), 60000);

  function refreshCheckButtonLabels() {
    const label = SITE_LABEL[compKey] || 'SHL site';
    if (checkScoresBtn) checkScoresBtn.textContent = `\u{1F517} Check ${mode === 'match' ? 'schema' : 'score & schema'} ${label}`;
    if (checkStandingsBtn) checkStandingsBtn.textContent = `\u{1F517} Vul in vanuit ${label}`;
    renderSyncInfo();
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
      refreshCheckButtonLabels();
      // Top scorer only exists for Mannen — fall back to Matchresult.
      if (compKey === 'women' && mode === 'topscorer') {
        mode = 'matchresult';
        modeTabs.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        updateHint();
      }
      // Match/Matchresult exist for both competitions now, each with its
      // own canvas size and fixture list — resize and reload rather than
      // bailing back to Results.
      if (isSingleMode()) {
        smwFormatField.hidden = mode === 'topscorer' || mode === 'playerweek'; // Post/Story choice now applies to both competitions
        resetSmAnim();
        smAnimField.hidden = false; // resetSmAnim hides it; still in Match/Matchresult
        { const sz = smCanvasSize(); canvas.width = sz.w; canvas.height = sz.h; }
        loadSingleMatchData();
      }
      if (mode === 'ranking') {
        checkStandingsBtn.hidden = false;
        updateHint();
        buildMatchRows();
        render();
      }
      loadCompetition();
    });
  });

  let roundsCompKey = null; // which competition `rounds` currently holds
  function loadCompetition() {
    const requestedComp = compKey;
    fetch(comp().csvPath)
      .then(r => r.text())
      .then(text => {
        rounds = parseCsv(text);
        roundsCompKey = requestedComp;
        maybeAutoSyncSchedule();
        if (isSingleMode() || mode === 'ranking') return; // these UIs own the dropdown right now
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
      const roundMatch = /(?:ROUND|RONDE)\s+(\d+)/i.exec(dateRound);
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
    smState.tsSide = restore && restore.tsSide ? restore.tsSide : 'home';
    smState.tsFirst = restore ? (restore.tsFirst || '') : '';
    smState.tsLast = restore ? (restore.tsLast || '') : '';
    smState.tsGoals = restore ? (restore.tsGoals || '') : '';
    if (restore) { smState.pwTeam = restore.pwTeam || smState.pwTeam; smState.pwName = restore.pwName || smState.pwName; }
    roundSelect.value = m.id;
    buildMatchRows();
    render();
  }

  function singleMatchCsvPath() {
    return compKey === 'women'
      ? 'assets/women/singlematch/schedule_per_match_all.csv'
      : 'assets/singlematch/schedule_per_match_all.csv';
  }

  // Re-fetched whenever compKey changes while in Match/Matchresult mode —
  // each competition has its own fixture list.
  let smLoadedKey = null; // which competition `smMatches` actually holds (set once parsed)
  function loadSingleMatchData() {
    smMatchesCompKey = compKey;
    const requestedComp = compKey;
    fetch(singleMatchCsvPath())
      .then(r => r.text())
      .then(text => {
        smMatches = parseSingleMatchCsv(text);
        smLoadedKey = requestedComp;
        maybeAutoSyncSchedule();
        if (!isSingleMode()) return; // round-based UI owns the dropdown right now
        populateSingleMatchSelect();
        if (!smMatches.length) return;
        let restoreMatch = null, restoreSm = null;
        if (savedState && (['match', 'matchresult', 'topscorer', 'playerweek'].includes(savedState.mode)) && savedState.sm && savedState.sm.id) {
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
      opt.textContent = r.isInterim ? `Ronde ${r.roundNum} · tussenronde — ${r.datum}` : `Ronde ${r.roundNum} — ${r.datum}`;
      roundSelect.appendChild(opt);
    });
  }

  roundSelect.addEventListener('change', () => {
    if (isSingleMode()) {
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

      if (isSingleMode()) {
        roundSelectField.hidden = mode === 'playerweek'; // no fixture to pick
        roundSelectLabel.textContent = 'Wedstrijd';
        updateHint();
        checkScoresBtn.hidden = mode === 'match' || mode === 'playerweek'; // no score to fetch
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = true;
        checkStandingsStatus.hidden = true;
        exportElementBtn.hidden = true;
        bgPhotoField.hidden = false;
        smwFormatField.hidden = mode === 'topscorer' || mode === 'playerweek'; // Post-only
        syncFormatButtons();
        resetResultsAnim();
        smAnimField.hidden = false;
        { const sz = smCanvasSize(); canvas.width = sz.w; canvas.height = sz.h; }
        if (smMatches.length && smMatchesCompKey === compKey) {
          populateSingleMatchSelect();
          const target = smMatches.find(x => x.id === smState.id) || smMatches[0];
          loadSingleMatch(target, smState.id === target.id ? smState : null);
        } else {
          loadSingleMatchData();
        }
      } else if (mode === 'ranking') {
        roundSelectField.hidden = true;
        updateHint();
        checkScoresBtn.hidden = true;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = false;
        exportElementBtn.hidden = false;
        bgPhotoField.hidden = true;
        smwFormatField.hidden = false;
        syncFormatButtons();
        resetResultsAnim();
        resetSmAnim();
        { const sz = smCanvasSize(); canvas.width = sz.w; canvas.height = sz.h; }
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
        smwFormatField.hidden = mode !== 'results' && mode !== 'schedule';
        syncFormatButtons();
        resetResultsAnim();
        resetSmAnim();
        resultsAnimField.hidden = mode !== 'results';
        { const sz = (mode === 'results' || mode === 'schedule') ? smCanvasSize() : { w: CANVAS_W, h: CANVAS_H }; canvas.width = sz.w; canvas.height = sz.h; }
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
  // "SATURDAY 5 SEPTEMBER" / "ZATERDAG 5 SEPTEMBER" -> "SAT 5 SEP" / "ZAT 5 SEP"
  // (the match's own other-day label wins when it has one).
  function defaultRowDate(m) {
    if (m.dateLabel) return m.dateLabel;
    const d = /^([A-Za-z]+)\s+(\d+)\s+([A-Za-z]+)/.exec((state.date || '').trim());
    if (!d) return '';
    const month = /^maart/i.test(d[3]) ? 'MRT' : d[3].slice(0, 3);
    return `${d[1].slice(0, 3)} ${d[2]} ${month}`.toUpperCase();
  }

  // shlw.nl shows English dates ("Sat 3 Oct"); the Vrouwen graphics are Dutch
  // ("ZAT 3 OKT"), the Mannen ones English.
  const NL_DAYS = { MON: 'MAA', TUE: 'DIN', WED: 'WOE', THU: 'DON', FRI: 'VRI', SAT: 'ZAT', SUN: 'ZON' };
  const NL_MONTHS = { MAR: 'MRT', MAY: 'MEI', OCT: 'OKT' };
  function localizeSiteDate(str) {
    const up = String(str || '').toUpperCase();
    if (compKey !== 'women') return up;
    return up.replace(/[A-Z]+/g, (w) => NL_DAYS[w] || NL_MONTHS[w] || w);
  }

  function buildMatchRows() {
    matchesList.innerHTML = '';
    rankingHeader.hidden = mode !== 'ranking';
    if (mode === 'playerweek') { buildPlayerWeekRow(); return; }
    if (isSingleMode()) {
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

      const showRowCheckbox = node.querySelector('.show-row-checkbox');
      showRowCheckbox.checked = !m.hidden;
      showRowCheckbox.addEventListener('change', () => {
        m.hidden = !showRowCheckbox.checked;
        node.classList.toggle('row-hidden', m.hidden);
        render();
      });
      node.classList.toggle('row-hidden', !!m.hidden);

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
        // Editable per-result date label (only shown while "Toon datum" is on).
        const resultDateRow = node.querySelector('.result-date-row');
        const rowDateInput = node.querySelector('.row-date-input');
        resultDateRow.hidden = !(showDates && m.played);
        rowDateInput.value = m.rowDate || defaultRowDate(m);
        rowDateInput.addEventListener('input', () => { m.rowDate = rowDateInput.value; render(); });

        upcomingCheckbox.addEventListener('change', () => {
          m.played = !upcomingCheckbox.checked;
          scorePair.hidden = !m.played;
          upcomingTime.hidden = m.played;
          dateRow.hidden = m.played;
          resultDateRow.hidden = !(showDates && m.played);
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

  // Player of the week: club + name inputs (club names are shown in full on the poster).
  const PW_CLUB_NAMES_WOMEN = {
    DSVD: 'Aqqo Bookings DSVD', ENO: 'Misker E&O', FORE: 'Foreholte', FORV: 'Cabooter Fortes Venlo',
    KWI: 'Zwartwoud Kwiek', MHV: "M.H.V. '81", PSV: 'Hypotheekvisie Eindhoven PSV',
    QUI: 'Drive in Units Quintus', SEW: 'Westfriesland SEW', VEL: 'Geonius V&L',
    VOC: 'Ruitenheer VOC Amsterdam', VOL: 'Garage Kil Volendam', VZV: 'JuRo Unirek VZV', WPK: 'WPK Westlandia',
  };
  function pwClubNames() { return compKey === 'women' ? PW_CLUB_NAMES_WOMEN : SM_TEAM_NAMES; }

  function buildPlayerWeekRow() {
    const node = document.getElementById('playerWeekRowTemplate').content.firstElementChild.cloneNode(true);
    const select = node.querySelector('.pw-team');
    const nameInput = node.querySelector('.pw-name');
    const codes = compKey === 'women' ? SMW_TEAM_CODES : SM_TEAM_CODES;
    const names = pwClubNames();
    if (!codes.includes(smState.pwTeam)) smState.pwTeam = codes[0];
    codes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = names[c] ? `${c} — ${names[c]}` : c;
      if (c === smState.pwTeam) opt.selected = true;
      select.appendChild(opt);
    });
    nameInput.value = smState.pwName;
    nameInput.placeholder = compKey === 'women' ? 'bv. Jante van Katwijk' : 'bv. Lennert Ceyssens';
    select.addEventListener('change', () => { smState.pwTeam = select.value; render(); });
    nameInput.addEventListener('input', () => { smState.pwName = nameInput.value; render(); });
    matchesList.appendChild(node);
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

    const smCodes = compKey === 'women' ? SMW_TEAM_CODES : SM_TEAM_CODES;
    const smNames = compKey === 'women' ? SMW_TEAM_NAMES : SM_TEAM_NAMES;
    function fillSelect(select, code) {
      select.innerHTML = '';
      smCodes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = smNames[c] ? `${c} — ${smNames[c]}` : c;
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
    scorePair.hidden = mode === 'match';
    homeScoreInput.value = smState.homeScore;
    awayScoreInput.value = smState.awayScore;

    timeInput.addEventListener('input', () => { smState.time = timeInput.value; render(); });
    homeScoreInput.addEventListener('input', () => { smState.homeScore = homeScoreInput.value; render(); });
    awayScoreInput.addEventListener('input', () => { smState.awayScore = awayScoreInput.value; render(); });

    // The date/round line is only drawn on the poster in Match mode — a
    // result graphic doesn't need it — and only Match lets you edit it,
    // since Matchresult never shows it anyway.
    const tsFields = node.querySelector('.topscorer-fields');
    tsFields.hidden = mode !== 'topscorer';
    const tsSide = node.querySelector('.ts-side');
    const tsFirst = node.querySelector('.ts-first');
    const tsLast = node.querySelector('.ts-last');
    const tsGoals = node.querySelector('.ts-goals');
    tsSide.value = smState.tsSide; tsFirst.value = smState.tsFirst;
    tsLast.value = smState.tsLast; tsGoals.value = smState.tsGoals;
    tsSide.addEventListener('change', () => { smState.tsSide = tsSide.value; render(); });
    tsFirst.addEventListener('input', () => { smState.tsFirst = tsFirst.value; render(); });
    tsLast.addEventListener('input', () => { smState.tsLast = tsLast.value; render(); });
    tsGoals.addEventListener('input', () => { smState.tsGoals = tsGoals.value; render(); });

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
    syncItemKey();
    // Transparent output is shown on a checkerboard in the preview only (CSS behind
    // the canvas) — the canvas pixels, and so the PNG/MP4 export, stay transparent.
    // (A photo, when present, is drawn into the canvas and covers it.)
    canvas.classList.toggle('canvas-checker',
      !bgPhotoImg && (transparentBg || (['results', 'schedule', 'ranking'].includes(mode) && resultsFormat === 'post')));
    postDecorField.hidden = !((mode === 'results' && resultsFormat === 'post') || mode === 'playerweek');
    bgPhotoField.hidden = !photoModeActive() || mode === 'ranking' && resultsFormat !== 'post';
    photoBtnText.textContent = bgPhotoImg ? 'Foto vervangen' : 'Foto toevoegen';
    showDateField.hidden = true;
    checkScoresBtn.hidden = mode === 'ranking' || mode === 'playerweek';
    siteSyncInfo.hidden = checkScoresBtn.hidden || !siteSyncInfo.textContent;
    refreshCheckButtonLabels();
    if (isSingleMode()) { renderSingleMatch(); return; }
    if (mode === 'ranking') { if (resultsFormat === 'post') renderRankingPost(); else renderRanking(); return; }
    const C = comp();
    showDateField.hidden = mode !== 'results' && mode !== 'schedule';
    const dateInfo = computeResultDateMode();
    resultDateMode = dateInfo.mode;
    const post = (mode === 'results' || mode === 'schedule') && resultsFormat === 'post';
    // Without the colored date bar the rows (and logo) sit higher, closing its gap.
    const rpShift = post && dateInfo.mode !== 'header' ? -RP_NO_BAR_SHIFT : 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!post && !transparentBg) {
      ctx.fillStyle = C.bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (!post && bgPhotoImg) drawBgPhotoCover(ctx, bgPhotoImg);

    if (post && mode === 'results') { drawPostPhoto('right'); drawPostDecor(); }
    if (!post) C.decorations.forEach(d => {
      const img = loadImg(d.src);
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, d.x, d.y);
      }
    });

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    if (post && mode === 'schedule') { renderSchedulePost(C, fontFamily); return; }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (post) {
      // right-aligned header block: white title, then the date in a colored bar
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(C.titleFontSize * 0.8)}px "${fontFamily}"`;
      ctx.fillText(C.titles.results, RP_CX - 1, 182);
      if (dateInfo.mode === 'header') {
        const bx = 463, by = 237, bw = 522, bh = 55;
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        if (compKey === 'women') { g.addColorStop(0, '#00f2e2'); g.addColorStop(1, '#00e5b1'); }
        else { g.addColorStop(0, '#f47987'); g.addColorStop(0.5, '#e67088'); g.addColorStop(1, '#f1913d'); }
        ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#14142b';
        ctx.font = `700 28px "${fontFamily}"`;
        ctx.fillText(dateInfo.text, RP_CX, by + bh / 2 + 1);
      }
    } else {
    ctx.fillStyle = C.titleColor;
    ctx.font = `700 ${C.titleFontSize}px "${fontFamily}"`;
    ctx.fillText(mode === 'results' ? C.titles.results : C.titles.schedule, CANVAS_W / 2, C.titleY);
    }
    if (!post && dateInfo.mode === 'header') {
      ctx.font = `500 34px "${fontFamily}"`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(dateInfo.text, CANVAS_W / 2, C.titleY + 70);
      ctx.globalAlpha = 1;
    }

    const animElapsed = (mode === 'results' && resultsAnimating && animStartTs != null)
      ? performance.now() - animStartTs : null;

    const shownMatches = visibleMatches();
    if (post) {
      ctx.save();
      ctx.translate(RP_CX - ROW_CENTER * RP_SCALE, RP_Y0 + rpShift - ROW_Y[0] * RP_SCALE);
      ctx.scale(RP_SCALE, RP_SCALE);
    }
    shownMatches.forEach((m, i) => {
      const cy = visibleRowY(i, shownMatches.length);
      let anim = null;
      if (animElapsed != null) {
        anim = resultRowAnimState(animElapsed, i, shownMatches.length);
        if (!anim) return; // hasn't popped in yet this pass
      }
      const bar = anim ? anim.bar : { alpha: 1, scale: 1 };
      // Only the (very slight) scale rides on the outer transform — the
      // card's own background is always drawn fully solid (never faded
      // via alpha), since fading a large flat shape against the dark page
      // looks patchy/uneven; only the badges/icon/score content fades in.
      const transformed = bar.scale !== 1;
      if (transformed) ctx.save();
      try {
        // A round can be partly played: rows the user marked "nog te
        // spelen" render as a schedule row (time) even while the poster's
        // overall mode is Results, so one story can show a mix of both.
        const showAsSchedule = mode === 'schedule' || m.played === false;
        if (transformed) {
          ctx.translate(ROW_CENTER, cy);
          ctx.scale(bar.scale, bar.scale);
          ctx.translate(-ROW_CENTER, -cy);
        }
        if (showAsSchedule) drawScheduleRow(m, cy, fontFamily, C);
        else drawResultRow(m, cy, fontFamily, C, anim);
      } catch (err) {
        console.error('Kon wedstrijd niet tekenen:', m, err);
      } finally {
        if (transformed) ctx.restore();
      }
    });

    if (post) ctx.restore();

    if (post) {
      // white logo, right-aligned under the rows (Vrouwen use their own white logo)
      const logo = loadImg(compKey === 'women' ? 'assets/women/singlematch/footer-white.png' : C.footerLogo);
      if (logo && logo.complete && logo.naturalWidth) {
        const lw = 485, lh = lw * logo.naturalHeight / logo.naturalWidth;
        ctx.drawImage(logo, 480, 1203 + rpShift - lh / 2, lw, lh);
      }
    } else {
      const footerImg = loadImg(C.footerLogo);
      if (footerImg && footerImg.complete && footerImg.naturalWidth) {
        ctx.drawImage(footerImg, C.footer.x, C.footer.y, C.footer.w, C.footer.h);
      }
    }

    saveState();
  }


  // Schedule Post (right-aligned, transparent): one colored date bar per day when
  // there are one or two days; with more days the date sits above each time instead.
  function drawDateBar(x, y, w, h, text, idx, fontFamily) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const palettes = compKey === 'women'
      ? [['#00f2e2', '#00e5b1'], ['#b87cff', '#e45cff']]
      : [['#c7f23a', '#5fe39a'], ['#f47987', '#f1913d']];
    const [a, b] = palettes[idx % palettes.length];
    g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#14142b';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 28px "${fontFamily}"`;
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  }

  function renderSchedulePost(C, fontFamily) {
    drawPostPhoto('right');
    const shown = visibleMatches();
    const infos = shown.map(scheduleDateInfo);
    const keys = [...new Set(infos.map(i => i.key))];
    const bars = showDates && keys.length > 0 && keys.length <= 2;
    const rowDates = showDates && keys.length > 2;
    const groups = bars
      ? keys.map(k => shown.map((m, i) => ({ m, info: infos[i] })).filter(x => x.info.key === k))
      : [shown.map((m, i) => ({ m, info: infos[i] }))];
    const BAR_H = 53, BAR_GAP = 14, ROW_PX = ROW_H * RP_SCALE, PITCH = (ROW_Y[1] - ROW_Y[0]) * RP_SCALE, GROUP_GAP = 21;
    // dry run for the stack height; the stack is anchored at the TOP (like Results), so a
    // short list doesn't leave a gap above it, and the logo follows right under it
    let h = 0;
    groups.forEach((g, gi) => {
      if (bars) h += BAR_H + BAR_GAP;
      h += g.length ? (g.length - 1) * PITCH + ROW_PX : 0;
      if (gi < groups.length - 1) h += GROUP_GAP;
    });
    // Normally the list starts at the usual top. When it is tall (e.g. two date bars and seven
    // rows) the whole block slides up instead, so the logo keeps real breathing room: at least
    // LOGO_AIR above it and below it, inside the 1350px canvas.
    const LOGO_H = 118, LOGO_AIR = 70;
    const top = Math.min(bars ? 237 : 255, 1350 - LOGO_H - 2 * LOGO_AIR - h);
    let y = top;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(C.titleFontSize * 0.8)}px "${fontFamily}"`;
    ctx.fillText(C.titles.schedule, RP_CX - 1, top - (bars ? 55 : 73));
    groups.forEach((g, gi) => {
      if (bars) { drawDateBar(463, y, 522, BAR_H, g[0] ? g[0].info.full : '', gi, fontFamily); y += BAR_H + BAR_GAP; }
      g.forEach((x, ri) => {
        const cyPost = y + ROW_PX / 2;
        ctx.save();
        ctx.translate(RP_CX - ROW_CENTER * RP_SCALE, cyPost - ROW_Y[0] * RP_SCALE);
        ctx.scale(RP_SCALE, RP_SCALE);
        try { drawScheduleRow(x.m, ROW_Y[0], fontFamily, C, bars ? false : (rowDates ? x.info.short : null)); }
        catch (err) { console.error('Kon wedstrijd niet tekenen:', x.m, err); }
        ctx.restore();
        y += ri < g.length - 1 ? PITCH : ROW_PX;
      });
      if (gi < groups.length - 1) y += GROUP_GAP;
    });
    const logo = loadImg(compKey === 'women' ? 'assets/women/singlematch/footer-white.png' : C.footerLogo);
    if (logo && logo.complete && logo.naturalWidth) {
      const lw = 485, lh = lw * logo.naturalHeight / logo.naturalWidth;
      ctx.drawImage(logo, 480, top + h + LOGO_AIR, lw, lh);
    }
    saveState();
  }

  // ---------- Ranking Post (left-aligned, transparent) ----------
  // The Story's own card (same rows, fonts, columns, dividers, bottom bar) scaled down onto
  // the 1080x1350 canvas, pinned to the left so the right side stays free for a player photo
  // in the external template. Mannen: square card + the mark on its top-right corner.
  // Vrouwen: their rounded card, round crests and purple accents (no mark, as in their Story).
  function renderRankingPost() {
    const women = compKey === 'women';
    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    const L = women ? WRANK_CARD_LEFT : RANK_CARD_LEFT, R = women ? WRANK_CARD_RIGHT : RANK_CARD_RIGHT;
    const T = women ? WRANK_CARD_TOP : RANK_CARD_TOP, B = women ? WRANK_CARD_BOTTOM : RANK_CARD_BOTTOM;
    const PANEL_H = 1040, PANEL_X = 100, PANEL_Y = 110;
    const s = PANEL_H / (B - T);
    ctx.clearRect(0, 0, RP_W, RP_H);
    drawPostPhoto('left');

    ctx.save();
    ctx.translate(PANEL_X - L * s, PANEL_Y - T * s);
    ctx.scale(s, s);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    if (!women) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(L, T, R - L, B - T);
      ctx.fillStyle = RANK_DIVIDER_COLOR;
      RANK_DIVIDER_Y.forEach(y => ctx.fillRect(L, y, R - L, RANK_DIVIDER_H));
      const bar = ctx.createLinearGradient(L, 0, R, 0);
      bar.addColorStop(0, 'rgb(252, 119, 69)'); bar.addColorStop(1, 'rgb(243, 85, 121)');
      ctx.fillStyle = bar;
      ctx.fillRect(L, RANK_BOTTOM_BAR_Y, R - L, RANK_BOTTOM_BAR_H);

      ctx.fillStyle = RANK_TEXT_COLOR;
      ctx.font = `500 ${RANK_HEADER_FONT}px "${fontFamily}"`;
      ctx.fillText('P', RANK_P_X, RANK_HEADER_Y);
      ctx.fillText('PTS', RANK_PTS_X, RANK_HEADER_Y);
      rankState.men.forEach((row, i) => {
        if (!row.code) return;
        const cy = RANK_ROW_TOP + RANK_ROW_H * i + RANK_ROW_H / 2;
        drawRankBadge(loadImg(`${COMPETITIONS.men.teamsDir}/${row.code}.png`), RANK_BADGE_CX, cy);
        ctx.fillStyle = RANK_TEXT_COLOR;
        ctx.font = `500 ${RANK_DATA_FONT}px "${fontFamily}"`;
        ctx.fillText(String(i + 1) + '.', RANK_NUM_X, cy);
        ctx.fillText(row.code, RANK_CODE_X, cy);
        ctx.fillText(row.p, RANK_P_X, cy);
        ctx.font = `700 ${RANK_DATA_FONT}px "${fontFamily}"`;
        ctx.fillText(row.pts, RANK_PTS_X, cy);
      });
      const mark = loadImg('assets/ranking/mark.png');
      if (mark && mark.complete && mark.naturalWidth) ctx.drawImage(mark, RANK_MARK.x, RANK_MARK.y, RANK_MARK.w, RANK_MARK.h);
    } else {
      fillRow(ctx, L, T, R - L, B - T, 'rgba(249,246,251,0.92)', WRANK_CARD_RADIUS, WRANK_CARD_BORDER);
      const bar = ctx.createLinearGradient(L, 0, R, 0);
      bar.addColorStop(0, 'rgb(229, 84, 252)'); bar.addColorStop(1, 'rgb(189, 81, 252)');
      roundedRectBottomPath(ctx, L, B - WRANK_BOTTOM_ACCENT_H, R - L, WRANK_BOTTOM_ACCENT_H, WRANK_CARD_RADIUS);
      ctx.fillStyle = bar; ctx.fill();

      ctx.fillStyle = WRANK_TEXT_COLOR;
      ctx.font = `500 ${WRANK_HEADER_FONT}px "${fontFamily}"`;
      ctx.fillText('P', WRANK_P_X, WRANK_HEADER_Y);
      ctx.font = `700 ${WRANK_HEADER_FONT}px "${fontFamily}"`;
      ctx.fillText('PTS', WRANK_PTS_X, WRANK_HEADER_Y);
      WRANK_DIVIDER_Y.forEach(y => fillRow(ctx, L, y, R - L, WRANK_DIVIDER_H, WRANK_DIVIDER_COLOR, WRANK_DIVIDER_H / 2));
      rankState.women.forEach((row, i) => {
        if (!row.code) return;
        const cy = WRANK_ROW_TOP + WRANK_ROW_H * i + WRANK_ROW_H / 2;
        drawBadge(ctx, loadImg(`${COMPETITIONS.women.teamsDir}/${row.code}.png`), CREST_X_LEFT, WRANK_BADGE_CX, cy, WRANK_BADGE_RADIUS, WRANK_BADGE_SIZE, 6);
        ctx.fillStyle = WRANK_TEXT_COLOR;
        ctx.font = `500 ${WRANK_DATA_FONT}px "${fontFamily}"`;
        ctx.fillText(String(i + 1) + '.', WRANK_NUM_X, cy);
        ctx.fillText(row.code, WRANK_CODE_X, cy);
        ctx.fillText(row.p, WRANK_P_X, cy);
        ctx.font = `700 ${WRANK_DATA_FONT}px "${fontFamily}"`;
        ctx.fillText(row.pts, WRANK_PTS_X, cy);
      });
    }
    ctx.restore();

    // white logo directly under the card, left-aligned with it
    const logo = loadImg(women ? 'assets/women/singlematch/footer-white.png' : 'assets/footer-logo.png');
    if (logo && logo.complete && logo.naturalWidth) {
      const lh = 118, lw = lh * logo.naturalWidth / logo.naturalHeight;
      ctx.drawImage(logo, PANEL_X - 8, PANEL_Y + PANEL_H + 28, lw, lh);
    }
    saveState();
  }

  // ---------- Post design elements ----------
  // The decorative lines from the results examples, top-left (Results Post only). Vrouwen use their
  // own asset (corner-lines-women.png); Mannen get the corner chevron flipped so its
  // steep arms run up off the top edge. Optional, so the Post can still be pasted bare.
  let postDecor = true;
  let postDecorCanvas = null;
  function drawPostDecor() {
    if (!postDecor) return;
    // With "Animeer" on the lines play the same chevron animation as Matchresult: the
    // shared curve (90% -> 113% with a soft fade in and out), looping every 3s, all
    // lines together. Otherwise they just sit there.
    const el = (mode === 'results' && resultsAnimating && animStartTs != null)
      ? (performance.now() - animStartTs) % SM_LOOP_CYCLE_MS : null;
    const lineState = () => el == null ? { scale: 1, opacity: 1 } : smChevronState(el);

    if (compKey === 'women') {
      const d = COMPETITIONS.women.decorations[0];
      const img = loadImg(d.src);
      if (img && img.complete && img.naturalWidth) {
        const st = lineState();
        if (st.opacity > 0) {
          ctx.save();
          ctx.globalAlpha = st.opacity;
          const ax = d.x + img.naturalWidth, ay = d.y + img.naturalHeight; // grows out from its lower-right corner
          ctx.translate(ax, ay); ctx.scale(st.scale, st.scale); ctx.translate(-ax, -ay);
          ctx.drawImage(img, d.x, d.y);
          ctx.restore();
        }
      }
      return;
    }
    if (!smCardChevronPaths) smCardChevronPaths = SM_CARD_CHEVRON_D.map((p) => new Path2D(p));
    // Drawn to a scratch canvas first so the pink-to-orange "colormash" gradient can be
    // applied in canvas pixels: pink at the top edge, warming to orange further down.
    if (!postDecorCanvas) { postDecorCanvas = document.createElement('canvas'); postDecorCanvas.width = 600; postDecorCanvas.height = 500; }
    const d = postDecorCanvas.getContext('2d');
    d.clearRect(0, 0, 600, 500);
    smCardChevronPaths.forEach((p) => {
      const st = lineState();
      if (st.opacity <= 0) return;
      d.save();
      d.globalAlpha = st.opacity;
      d.translate(-85, 71);
      d.rotate(195.5 * Math.PI / 180);
      d.scale(2.6 * st.scale, 2.6 * st.scale); // scales about the chevron's own centre, like Matchresult
      d.fillStyle = '#fff';
      d.fill(p);
      d.restore();
    });
    d.globalCompositeOperation = 'source-in';
    const g = d.createLinearGradient(0, 0, 0, 430);
    g.addColorStop(0, '#fb718b'); g.addColorStop(0.55, '#fb7582'); g.addColorStop(1, '#f39760');
    d.fillStyle = g;
    d.fillRect(0, 0, 600, 500);
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(postDecorCanvas, 0, 0);
  }

  function renderSingleMatch() {
    if (mode === 'playerweek') { renderPlayerWeek(); return; }
    if (mode === 'topscorer') { renderTopScorer(); return; }
    if (compKey === 'women') { renderWomenSingleMatch(); return; }
    renderMenSingleMatch();
  }


  // ---------- Top scorer of the match (Mannen, Post) ----------
  const TS_W = 1080, TS_H = 1350;
  const TS_MARGIN = 70;
  const TS_COUNT_START_MS = 250;   // wait before the goal counter starts ticking
  const TS_COUNT_MIN_MS = 500;     // slot-machine roll: base duration ...
  const TS_COUNT_PER_GOAL_MS = 120; // ... plus this per goal ...
  const TS_COUNT_MAX_MS = 1500;    // ... never longer than this
  const TS_CHEVRON_STATIC = 1.6;   // static end-state chevron size
  const TS_FILL_DELAY_MS = 200;    // masked tile chevron shows this long before the color fades in
  const TS_REST_DELAY_MS = 380;    // rest fades in after the goals frame is fully colored
  const TS_REST_FADE_MS = 450;
  const TS_CREST_REVEAL_MS = 700;   // club crest: sweep of the mirrored chevron, then crossfade to the full crest
  const TS_CREST_CHEVRON = 1.3;
  const TS_TILE_CHEVRON = 2.4;     // size of the chevron masked inside the goals frame
  const TS_CHEVRON_ANIM = 3.0;     // looping chevron during the animation

  // Draws text so its visible ink edge (not the glyph's side bearing) sits
  // exactly on x — keeps the left/right margins optically aligned.
  function tsInkText(str, x, y, font, color, align, alpha) {
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(str);
    const dx = align === 'right' ? (m.width - m.actualBoundingBoxRight) : m.actualBoundingBoxLeft;
    ctx.textAlign = align || 'left';
    ctx.fillStyle = color;
    ctx.globalAlpha *= (alpha == null ? 1 : alpha);
    ctx.fillText(str, x + dx, y);
    ctx.restore();
  }

  // Dark ink on light team colors, white on dark ones.
  function tsInkFor(hex) {
    const n = parseInt((hex || '#ffffff').slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? '#1b2450' : '#ffffff';
  }

  function tsDrawCrest(img, cx, cy, size) {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.drawImage(img, CREST_X_LEFT, CREST_Y, CREST_W, CREST_H, cx - size / 2, cy - size / 2, size, size * CREST_H / CREST_W);
  }

  // Club crest in its white square. Static = just the crest. In the animation
  // the crest is revealed by the chevron mirrored from the goals frame's: its
  // thick strips mask the crest in while they sweep in from the right edge,
  // then the full crest fades in as the strips fade out.
  let tsCrestMask = null;
  function tsDrawClubCrest(img, bx, by, size, color, t) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const cx = bx + size / 2, cy = by + size / 2;
    if (t >= TS_CREST_REVEAL_MS) { tsDrawCrest(img, cx, cy, 112); return; }
    if (t < 0) return;
    const p = t / TS_CREST_REVEAL_MS;
    const ease = 1 - Math.pow(1 - p, 3);
    const full = Math.max(0, Math.min(1, (p - 0.5) / 0.5));
    const scale = TS_CREST_CHEVRON * (0.55 + 0.45 * ease);
    if (!smCardChevronPaths) smCardChevronPaths = SM_CARD_CHEVRON_D.map((d) => new Path2D(d));
    if (!tsCrestMask) { tsCrestMask = document.createElement('canvas'); tsCrestMask.width = tsCrestMask.height = size; }
    const m = tsCrestMask.getContext('2d');
    m.clearRect(0, 0, size, size);
    // the crest itself, then keep only what the chevron strips cover
    m.drawImage(img, CREST_X_LEFT, CREST_Y, CREST_W, CREST_H, (size - 112) / 2, (size - 112 * CREST_H / CREST_W) / 2, 112, 112 * CREST_H / CREST_W);
    m.save();
    m.globalCompositeOperation = 'destination-in';
    m.translate(size - 20, size * 0.9);
    m.rotate((SM_CARD_CHEVRON_TILT_DEG * Math.PI) / 180);
    const s = SM_CARD_CHEVRON_UNIT_SCALE * scale;
    m.scale(s, s);
    m.fillStyle = '#fff'; m.strokeStyle = '#fff'; m.lineWidth = 120 / s; m.lineJoin = 'round';
    smCardChevronPaths.forEach((pp) => { m.fill(pp); m.stroke(pp); });
    m.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(bx, by, size, size); ctx.clip();
    // visible chevron lines (mirrored of the goals frame's), fading out with the reveal
    drawSmCardChevron(ctx, bx + size - 20, by + size * 0.9, false, color, scale, 1 - full);
    ctx.drawImage(tsCrestMask, bx, by);
    if (full > 0) { ctx.globalAlpha *= full; tsDrawCrest(img, cx, cy, 112); }
    ctx.restore();
  }

  // Shrinks the font until `str` fits `maxW`.
  function tsFitFont(str, weight, startPx, maxW, family) {
    let px = startPx;
    ctx.save();
    while (px > 12) {
      ctx.font = `${weight} ${px}px "${family}"`;
      if (ctx.measureText(str).width <= maxW) break;
      px -= 2;
    }
    ctx.restore();
    return px;
  }

  // Largest font (<= 60px) at which `full` fits `maxW` on one line, else on two
  // lines (split at a space or slash, choosing the most balanced break).
  function tsFitClubName(full, maxW, family) {
    ctx.save();
    const breaks = [];
    for (let i = 1; i < full.length - 1; i++) {
      if (full[i] === ' ') breaks.push([full.slice(0, i), full.slice(i + 1)]);
      else if (full[i] === '/') breaks.push([full.slice(0, i + 1), full.slice(i + 1)]);
    }
    let result = null;
    for (let px = 60; px >= 20; px -= 2) {
      ctx.font = `700 ${px}px "${family}"`;
      if (ctx.measureText(full).width <= maxW) { result = { px, rows: [full] }; break; }
      let best = null;
      breaks.forEach(([a, b]) => {
        const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (w <= maxW && (!best || w < best.w)) best = { w, rows: [a, b] };
      });
      if (best) { result = { px, rows: best.rows }; break; }
    }
    ctx.restore();
    return result || { px: 20, rows: [full] };
  }

  function renderTopScorer() {
    const W = TS_W, H = TS_H, L = TS_MARGIN, R = W - TS_MARGIN;
    ctx.clearRect(0, 0, W, H);
    if (!transparentBg) {
      ctx.fillStyle = COMPETITIONS.men.bgColor;
      ctx.fillRect(0, 0, W, H);
    }
    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    const code = smState.tsSide === 'away' ? smState.away : smState.home;
    const col = SM_TEAM_COLORS[code] || '#d2ddf2';
    const ink = tsInkFor(col);
    const navyInk = '#1b2450';

    // Animation timeline (only when "Animeer" is on): the goals tick up in a
    // white frame; once the counter reaches its final number the frame turns
    // the club color and the big chevron starts looping. Static = end state.
    const goalsN = Math.max(0, parseInt(smState.tsGoals, 10) || 0);
    const elapsed = smAnimElapsed();
    let reelPos = goalsN, reelSpeed = 0, tileMix = 1, chevElapsed = null, tileAfter = -1, restAlpha = 1, clubT = Infinity;
    if (elapsed != null) {
      // One continuous slot-machine roll: the reel spins up fast and
      // decelerates smoothly until it lands on the final number.
      const countMs = goalsN > 0 ? Math.min(TS_COUNT_MAX_MS, TS_COUNT_MIN_MS + goalsN * TS_COUNT_PER_GOAL_MS) : 0;
      const tc = elapsed - TS_COUNT_START_MS;
      if (tc <= 0) reelPos = 0;
      else if (tc < countMs) {
        const t = tc / countMs;
        reelPos = goalsN * (1 - Math.pow(1 - t, 4));
        reelSpeed = goalsN * 4 * Math.pow(1 - t, 3) / countMs * 1000; // goals per second
      }
      const endT = TS_COUNT_START_MS + countMs;
      const after = elapsed - endT;
      tileAfter = after;
      // the club color floods in almost at once, right after the masked chevron appears
      tileMix = after <= TS_FILL_DELAY_MS ? 0 : Math.min(1, (after - TS_FILL_DELAY_MS) / 180);
      tileMix = tileMix * tileMix * (3 - 2 * tileMix);
      chevElapsed = after >= 0 ? after % SM_LOOP_CYCLE_MS : null;
      // everything except the name, goals frame and Coinmerce logo fades in
      // once the goals animation (roll, chevron, color) has finished
      clubT = after - TS_REST_DELAY_MS;
      const rt = (after - TS_REST_DELAY_MS) / TS_REST_FADE_MS;
      restAlpha = rt <= 0 ? 0 : rt >= 1 ? 1 : 1 - Math.pow(1 - rt, 3);
    }

    // The photo is there from the start and runs full-bleed (no hard edge); the
    // navy fade-out that confines it to the top area joins the later fade-in.
    const photoH = 820;
    if (bgPhotoImg) {
      drawBgPhotoCover(ctx, bgPhotoImg);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, photoH);
      g.addColorStop(0, '#3a3c6e'); g.addColorStop(1, '#14152e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, photoH);
      ctx.fillStyle = '#14152e'; ctx.fillRect(0, photoH, W, H - photoH);
      ctx.save();
      ctx.font = `500 28px "${fontFamily}"`; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35;
      ctx.textAlign = 'center'; ctx.fillText('SPELERSFOTO', W / 2, 60);
      ctx.restore();
    }
    const fade = ctx.createLinearGradient(0, 470, 0, photoH);
    fade.addColorStop(0, 'rgba(26, 27, 56, 0)');
    fade.addColorStop(1, 'rgba(26, 27, 56, 1)');
    ctx.save();
    ctx.globalAlpha = restAlpha;
    ctx.fillStyle = fade;
    ctx.fillRect(0, 470, W, photoH - 470);
    if (!transparentBg) {
      ctx.fillStyle = COMPETITIONS.men.bgColor;
      ctx.fillRect(0, photoH, W, H - photoH);
    }
    ctx.restore();

    // big chevron out of the bottom-left corner, behind everything else
    // (the logo always stays on top).
    if (elapsed == null) {
      drawSmCardChevron(ctx, 40, 1290, true, col, TS_CHEVRON_STATIC, 0.9);
    } else if (chevElapsed != null) {
      const chev = smChevronState(chevElapsed);
      drawSmCardChevron(ctx, 40, 1290, true, col, TS_CHEVRON_ANIM * chev.scale, 0.9 * chev.opacity);
    }

    // label
    ctx.save(); ctx.globalAlpha = restAlpha;
    ctx.fillStyle = col; ctx.fillRect(L, 95, 10, 78);
    tsInkText('TOP SCORER', L + 34, 130, `700 44px "${fontFamily}"`, '#fff');
    tsInkText('OF THE MATCH', L + 34, 168, `500 30px "${fontFamily}"`, '#fff', 'left', 0.8);
    ctx.restore();

    // player name
    const first = (smState.tsFirst || '').toUpperCase();
    const last = (smState.tsLast || '').toUpperCase();
    if (first) tsInkText(first, L, 620, `500 60px "${fontFamily}"`, '#fff', 'left', 0.85);
    if (last) {
      const px = tsFitFont(last, 700, 128, R - L, fontFamily);
      tsInkText(last, L, 725, `700 ${px}px "${fontFamily}"`, '#fff');
    }

    // goals tile + the player's club
    const ty = 765, th = 150, pad = 36;
    // the goals frame grows with the number of digits so "13" never touches "GOALS"
    ctx.save();
    ctx.font = `700 130px "${fontFamily}"`;
    const numW = ctx.measureText(String(goalsN)).width;
    ctx.font = `700 44px "${fontFamily}"`;
    const labelW = ctx.measureText('GOALS').width;
    ctx.restore();
    const tw = Math.max(360, Math.ceil(pad + numW + 36 + labelW + pad));
    ctx.fillStyle = '#fff'; ctx.fillRect(L, ty, tw, th);
    // chevron inside the white frame, masked to it; the color fill below
    // then covers it (same color), so it reads as the chevron flooding the tile
    if (tileAfter >= 0 && tileMix < 1) {
      const mini = smChevronState(tileAfter * 3);
      ctx.save();
      ctx.beginPath(); ctx.rect(L, ty, tw, th); ctx.clip();
      drawSmCardChevron(ctx, L + 20, ty + th * 1.05, true, col, TS_TILE_CHEVRON * mini.scale, mini.opacity);
      ctx.restore();
    }
    if (tileMix > 0) {
      ctx.save(); ctx.globalAlpha = tileMix; ctx.fillStyle = col; ctx.fillRect(L, ty, tw, th); ctx.restore();
    }
    const tileInk = tileMix > 0.5 ? ink : navyInk;
    ctx.save();
    ctx.beginPath(); ctx.rect(L, ty, tw, th); ctx.clip();
    const goalFont = `700 130px "${fontFamily}"`;
    // Reel: number k sits at (k - reelPos) rows from the resting position.
    // While it's moving fast, faint ghost copies above/below fake motion blur.
    const blur = Math.min(26, reelSpeed * 2.2);
    for (let k = Math.max(0, Math.floor(reelPos) - 1); k <= Math.min(goalsN, Math.floor(reelPos) + 2); k++) {
      const y = ty + 120 + (k - reelPos) * th;
      if (blur > 3) {
        ctx.save(); ctx.globalAlpha = 0.28;
        tsInkText(String(k), L + pad, y - blur, goalFont, tileInk);
        tsInkText(String(k), L + pad, y + blur, goalFont, tileInk);
        ctx.restore();
      }
      tsInkText(String(k), L + pad, y, goalFont, tileInk);
    }
    tsInkText('GOALS', L + tw - pad, ty + 94, `700 44px "${fontFamily}"`, tileInk, 'right');
    ctx.restore();
    ctx.save(); ctx.globalAlpha = restAlpha;
    const clubX = L + tw + 24;
    ctx.fillStyle = '#fff'; ctx.fillRect(clubX, ty, th, th);
    tsDrawClubCrest(code ? loadImg(`assets/teams/${code}.png`) : null, clubX, ty, th, col, clubT);
    const textX = clubX + th + 28, textMaxW = R - textX;
    if (code) {
      // Club name only (no code), as big as fits; wraps onto two lines when too long.
      const full = (SM_TEAM_NAMES[code] || code).toUpperCase();
      const lines = tsFitClubName(full, textMaxW, fontFamily);
      const lh = lines.px * 1.08;
      const first = ty + th / 2 - ((lines.rows.length - 1) * lh) / 2 + lines.px * 0.35;
      lines.rows.forEach((row, i) => tsInkText(row, textX, first + i * lh, `700 ${lines.px}px "${fontFamily}"`, '#fff'));
    }
    ctx.restore();

    ctx.save(); ctx.globalAlpha = restAlpha;
    // match strip on the same margins
    ctx.fillStyle = '#fff'; ctx.fillRect(L, 955, R - L, 110);
    tsDrawCrest(smState.home ? loadImg(`assets/teams/${smState.home}.png`) : null, L + 75, 1010, 76);
    tsDrawCrest(smState.away ? loadImg(`assets/teams/${smState.away}.png`) : null, R - 75, 1010, 76);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = navyInk;
    ctx.font = `600 22px "${fontFamily}"`; ctx.globalAlpha = 0.55 * restAlpha;
    ctx.fillText(`${smState.home || ''}  vs  ${smState.away || ''}`, W / 2, 986);
    if (smState.homeScore !== '' || smState.awayScore !== '') {
      ctx.font = `700 64px "${fontFamily}"`; ctx.globalAlpha = restAlpha;
      ctx.fillText(`${smState.homeScore || 0} – ${smState.awayScore || 0}`, W / 2, 1044);
    }
    ctx.restore();
    ctx.restore();

    // Coinmerce logo: bigger, centered in the clear space under the strip
    const footerImg = loadImg('assets/footer-logo.png');
    if (footerImg && footerImg.complete && footerImg.naturalWidth) {
      const lw = 560, lh = lw * footerImg.naturalHeight / footerImg.naturalWidth;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(footerImg, (W - lw) / 2, 1065 + (H - 1065 - lh) / 2, lw, lh);
      ctx.restore();
    }

    saveState();
  }

  // ---------- Player of the week (Mannen + Vrouwen, Post) ----------
  const PW_THEMES = {
    men: { bg: '#1a1b38', text: '#ffffff', accent: '#bdff00', accentInk: '#14142b', ghost: 'rgba(255,255,255,0.10)', banner: 'PLAYER OF THE WEEK', logo: 'assets/footer-logo.png' },
    women: { bg: '#f7f7fb', text: '#1a1b38', accent: '#d07af0', accentInk: '#1a1b38', ghost: 'rgba(26,27,56,0.07)', banner: 'SPEELSTER VAN DE WEEK', logo: 'assets/women/footer-logo-women.png' },
  };

  // Three nested ">" lines: a steep upper arm and a shallower lower arm, as in the
  // posted examples. `clipY0..clipY1` limits where the lines may show.
  function pwChevronLines(color, lineW, alpha, dy, clipY0, clipY1, scale) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, clipY0, TS_W, clipY1 - clipY0); ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineJoin = 'miter';
    [[775, 440], [905, 458], [1035, 472]].forEach(([ax, ay]) => {
      ctx.save();
      ctx.translate(1035, 472 + dy); ctx.scale(scale, scale); ctx.translate(-1035, -(472 + dy));
      ctx.beginPath();
      ctx.moveTo(ax - 700, ay + dy - 0.957 * 700);
      ctx.lineTo(ax, ay + dy);
      ctx.lineTo(ax - 1400, ay + dy + 0.62 * 1400);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  function renderPlayerWeek() {
    const W = TS_W, H = TS_H, L = 57;
    const T = PW_THEMES[compKey] || PW_THEMES.men;
    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);

    // animation: the lower block builds up in steps, the chevron lines loop
    const el = smAnimElapsed();
    const ramp = (t0) => el == null ? 1 : Math.max(0, Math.min(1, (el - t0) / 400));
    const chev = el == null ? { scale: 1, opacity: 1 } : smChevronState(el % SM_LOOP_CYCLE_MS);

    // photo
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, PW_PHOTO_H); ctx.clip();
    if (bgPhotoImg) {
      drawBgPhotoCover(ctx, bgPhotoImg);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, PW_PHOTO_H);
      g.addColorStop(0, '#3a3c6e'); g.addColorStop(1, '#14152e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, PW_PHOTO_H);
      ctx.font = `500 28px "${fontFamily}"`; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('SPELERSFOTO', W / 2, 60);
    }
    ctx.restore();

    // chevron lines over the photo, and a faint echo in the lower block
    if (postDecor) pwChevronLines(T.accent, 7, chev.opacity, 0, 0, PW_PHOTO_H, chev.scale);   // optional
    pwChevronLines(T.ghost, 9, 1, 660, PW_PHOTO_H + 54, H, 1);                                // always there, never animated

    // banner
    ctx.save();
    ctx.globalAlpha = ramp(200);
    ctx.fillStyle = T.accent; ctx.fillRect(0, PW_PHOTO_H, W, 54); // flush with the photo, no gap
    tsInkText(T.banner, L, PW_PHOTO_H + 2 + 36, `700 30px "${fontFamily}"`, T.accentInk);
    ctx.restore();

    // name + club
    const name = (smState.pwName || '').toUpperCase();
    if (name) {
      const px = tsFitFont(name, 700, 72, W - L * 2, fontFamily);
      ctx.save(); ctx.globalAlpha = ramp(500);
      tsInkText(name, L, 985, `700 ${px}px "${fontFamily}"`, T.text);
      ctx.restore();
    }
    const club = (pwClubNames()[smState.pwTeam] || smState.pwTeam || '').toUpperCase();
    if (club) {
      const px = tsFitFont(club, 500, 30, W - L * 2, fontFamily);
      ctx.save(); ctx.globalAlpha = ramp(800);
      tsInkText(club, L, 1033, `500 ${px}px "${fontFamily}"`, T.accent);
      ctx.restore();
    }

    // logo, bottom-left
    const logo = loadImg(T.logo);
    if (logo && logo.complete && logo.naturalWidth) {
      const lh = 118, lw = lh * logo.naturalWidth / logo.naturalHeight;
      ctx.save(); ctx.globalAlpha = ramp(1100);
      ctx.drawImage(logo, L, 1110, lw, lh);
      ctx.restore();
    }
    saveState();
  }

  function renderMenSingleMatch() {
    const L = SM_LAYOUTS[smFormat] || SM_LAYOUTS.post;
    ctx.clearRect(0, 0, L.canvasW, L.canvasH);
    if (bgPhotoImg) {
      drawBgPhotoCover(ctx, bgPhotoImg);
      // A user's own photo can be any brightness — fade to dark navy along
      // the bottom so the white Coinmerce footer logo (and the team band
      // above it) stays legible.
      const fadeTop = L.teamY - 260;
      const footerFade = ctx.createLinearGradient(0, fadeTop, 0, L.canvasH);
      footerFade.addColorStop(0, 'rgba(26, 27, 56, 0)');
      footerFade.addColorStop(1, 'rgba(26, 27, 56, 0.94)');
      ctx.fillStyle = footerFade;
      ctx.fillRect(0, fadeTop, L.canvasW, L.canvasH - fadeTop);
    } else if (!transparentBg) {
      ctx.fillStyle = COMPETITIONS.men.bgColor;
      ctx.fillRect(0, 0, L.canvasW, L.canvasH);
    }

    // Once a result is in (Matchresult mode), the winning side is tracked
    // for both the card-chevron accent below and the score-text dimming
    // further down — same win/loss convention as the Results list.
    let winner = null;
    if (mode === 'matchresult') {
      const homeNum = parseFloat(smState.homeScore);
      const awayNum = parseFloat(smState.awayScore);
      if (!isNaN(homeNum) && !isNaN(awayNum)) {
        if (homeNum > awayNum) winner = 'home';
        else if (awayNum > homeNum) winner = 'away';
      }
    }

    // Small animated chevron accent behind each team card — same shared
    // grow/fade curve as the Vrouwen bar chevron, anchored at the outer
    // corner and tilted outward. Drawn BEFORE the cards (and well before
    // the Coinmerce footer logo, which always stays on top).
    // Unlike the Vrouwen bar chevron (a permanent brand element), this
    // accent is purely part of the animation — it doesn't show at all
    // unless "Animeer" is on.
    const smChevronElapsed = smCycleElapsed();
    if (smChevronElapsed != null) {
      const smChevronNow = smChevronState(smChevronElapsed);
      const cardChevronCy = L.teamY + SM_TEAM_H + 101 + (L.cardChevronYExtra || 0);
      const baseChevronScale = smChevronNow.scale * (L.cardChevronScale || 1);
      // Only the winner's chevron shows — much bigger — instead of both
      // sides pulsing equally.
      if (winner) {
        const winnerScale = baseChevronScale * 3;
        if (winner === 'home' && smState.home) {
          drawSmCardChevron(ctx, 140, cardChevronCy, true,
            SM_TEAM_COLORS[smState.home] || SM_TEXT_COLOR, winnerScale, smChevronNow.opacity);
        } else if (winner === 'away' && smState.away) {
          drawSmCardChevron(ctx, L.canvasW - 140, cardChevronCy, false,
            SM_TEAM_COLORS[smState.away] || SM_TEXT_COLOR, winnerScale, smChevronNow.opacity);
        }
      } else {
        if (smState.home) {
          drawSmCardChevron(ctx, 140, cardChevronCy, true,
            SM_TEAM_COLORS[smState.home] || SM_TEXT_COLOR, baseChevronScale, smChevronNow.opacity);
        }
        if (smState.away) {
          drawSmCardChevron(ctx, L.canvasW - 140, cardChevronCy, false,
            SM_TEAM_COLORS[smState.away] || SM_TEXT_COLOR, baseChevronScale, smChevronNow.opacity);
        }
      }
    }

    // Each team's own asset (assets/singlematch/teams/<CODE>.png) already
    // bakes in that team's color, crest and name as finished art, pre-built
    // for BOTH slots side by side at 2x resolution: the left half is meant
    // for the left-hand position, the right half for the right-hand one —
    // so there's no separate tinting step, just crop the matching half.
    const homeImg = smState.home ? loadImg(`assets/singlematch/teams/${smState.home}.png`) : null;
    if (homeImg && homeImg.complete && homeImg.naturalWidth) {
      const halfW = homeImg.naturalWidth / 2;
      ctx.drawImage(homeImg, 0, 0, halfW, homeImg.naturalHeight, SM_TEAM_LEFT_X, L.teamY, SM_TEAM_W, SM_TEAM_H);
    }
    const awayImg = smState.away ? loadImg(`assets/singlematch/teams/${smState.away}.png`) : null;
    if (awayImg && awayImg.complete && awayImg.naturalWidth) {
      const halfW = awayImg.naturalWidth / 2;
      ctx.drawImage(awayImg, halfW, 0, halfW, awayImg.naturalHeight, SM_TEAM_RIGHT_X, L.teamY, SM_TEAM_W, SM_TEAM_H);
    }

    const mark = loadImg('assets/singlematch/mark.png');
    if (mark && mark.complete && mark.naturalWidth) {
      const smElapsed = smCycleElapsed();
      const iconScale = smRepeatingIconScale(smElapsed, SM_BEATS, ICON_MS);
      const mcx = L.mark.x + L.mark.w / 2, mcy = L.mark.y + L.mark.h / 2;
      if (iconScale !== 1) {
        ctx.save();
        ctx.translate(mcx, mcy);
        ctx.scale(iconScale, iconScale);
        ctx.translate(-mcx, -mcy);
      }
      ctx.drawImage(mark, L.mark.x, L.mark.y, L.mark.w, L.mark.h);
      if (iconScale !== 1) ctx.restore();
    }

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SM_TEXT_COLOR;
    ctx.globalAlpha = 1;

    if (mode === 'matchresult') {
      ctx.font = `700 ${SM_SCORE_FONT}px "${fontFamily}"`;
      const scoreY = L.timeY + SM_SCORE_Y_OFFSET;
      if (smState.homeScore !== '' || smState.awayScore !== '') {
        // The score itself waits, then fades in — see SM_SCORE_DELAY_MS —
        // while everything else on the card is there immediately. Losing
        // side's number is also dimmed, same convention as the Results
        // list — drawn as three separate pieces (home, dash, away) so only
        // the loser's alpha changes, still centered as one group.
        const scoreReveal = smScoreRevealAlpha();
        const homeAlpha = (winner === 'away' ? 0.35 : 1) * scoreReveal;
        const awayAlpha = (winner === 'home' ? 0.35 : 1) * scoreReveal;
        const gap = SM_SCORE_FONT * 0.45;
        ctx.textAlign = 'right';
        ctx.globalAlpha = homeAlpha;
        ctx.fillText(String(smState.homeScore || 0), SM_CENTER_X - gap, scoreY);
        ctx.textAlign = 'center';
        ctx.globalAlpha = scoreReveal;
        ctx.fillText('-', SM_CENTER_X, scoreY);
        ctx.textAlign = 'left';
        ctx.globalAlpha = awayAlpha;
        ctx.fillText(String(smState.awayScore || 0), SM_CENTER_X + gap, scoreY);
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.font = `700 ${SM_TIME_FONT}px "${fontFamily}"`;
      ctx.fillText(smState.time || '', SM_CENTER_X, L.timeY);
    }

    if (mode === 'match') {
      ctx.font = `500 ${SM_DATE_FONT}px "${fontFamily}"`;
      ctx.fillText(smState.dateRound || '', SM_CENTER_X, L.dateY);
    }

    const footerImg = loadImg('assets/footer-logo.png');
    if (footerImg && footerImg.complete && footerImg.naturalWidth) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(footerImg, L.footer.x, L.footer.y, L.footer.w, L.footer.h);
      ctx.restore();
    }

    saveState();
  }

  function renderWomenSingleMatch() {
    const L = SMW_LAYOUTS[smFormat] || SMW_LAYOUTS.story;
    ctx.clearRect(0, 0, L.canvasW, L.canvasH);
    if (bgPhotoImg) {
      drawBgPhotoCover(ctx, bgPhotoImg);
      // Same reasoning as the Mannen version: a user's own photo can be any
      // brightness, so fade to dark navy along the bottom to keep the
      // white footer logo (and the card row above it) legible.
      const fadeTop = L.teamLeft.y - 260;
      const footerFade = ctx.createLinearGradient(0, fadeTop, 0, L.canvasH);
      footerFade.addColorStop(0, 'rgba(26, 27, 56, 0)');
      footerFade.addColorStop(1, 'rgba(26, 27, 56, 0.94)');
      ctx.fillStyle = footerFade;
      ctx.fillRect(0, fadeTop, L.canvasW, L.canvasH - fadeTop);
    } else if (!transparentBg) {
      ctx.fillStyle = SMW_TEXT_COLOR;
      ctx.fillRect(0, 0, L.canvasW, L.canvasH);
    }

    const bar = loadImg('assets/women/singlematch/bar.png');
    if (bar && bar.complete && bar.naturalWidth) {
      ctx.drawImage(bar, L.bar.x, L.bar.y, L.bar.w, L.bar.h);
    }

    // Chevron accent behind the cards — home team's color on the left half,
    // away team's on the right, both tinted from the same plain (white)
    // shape mask so this stays in sync with whichever teams are selected.
    // Scales up from its own center (90% -> 113%, see smChevronState) and
    // fades out fast right at the end — same universal curve as the icon
    // uses, not a direction-specific reveal.
    const smElapsed = smCycleElapsed();
    const { scale: chevronScale, opacity: chevronOpacity } = smChevronState(smElapsed);
    const chevronMask = loadImg('assets/women/singlematch/chevron-mask.png');
    if (chevronMask && chevronMask.complete && chevronMask.naturalWidth && chevronOpacity > 0) {
      const homeColor = SMW_TEAM_COLORS[smState.home] || SMW_TEXT_COLOR;
      const awayColor = SMW_TEAM_COLORS[smState.away] || SMW_TEXT_COLOR;
      const homeTinted = tintImage(chevronMask, 'smw-chevron', homeColor);
      const awayTinted = tintImage(chevronMask, 'smw-chevron', awayColor);
      ctx.globalAlpha = chevronOpacity;
      if (homeTinted) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(L.bar.x, L.bar.y, L.bar.w / 2, L.bar.h);
        ctx.clip();
        const cx = L.bar.x + L.bar.w / 4, cy = L.bar.y + L.bar.h / 2;
        ctx.translate(cx, cy);
        ctx.scale(chevronScale, chevronScale);
        ctx.translate(-cx, -cy);
        ctx.drawImage(homeTinted, L.bar.x, L.bar.y, L.bar.w, L.bar.h);
        ctx.restore();
      }
      if (awayTinted) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(L.bar.x + L.bar.w / 2, L.bar.y, L.bar.w / 2, L.bar.h);
        ctx.clip();
        const cx = L.bar.x + (3 * L.bar.w) / 4, cy = L.bar.y + L.bar.h / 2;
        ctx.translate(cx, cy);
        ctx.scale(chevronScale, chevronScale);
        ctx.translate(-cx, -cy);
        ctx.drawImage(awayTinted, L.bar.x, L.bar.y, L.bar.w, L.bar.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    const mark = loadImg('assets/women/singlematch/mark.png');
    if (mark && mark.complete && mark.naturalWidth) {
      const iconScale = smRepeatingIconScale(smElapsed, SM_BEATS, ICON_MS);
      const mcx = L.mark.x + L.mark.w / 2, mcy = L.mark.y + L.mark.h / 2;
      if (iconScale !== 1) {
        ctx.save();
        ctx.translate(mcx, mcy);
        ctx.scale(iconScale, iconScale);
        ctx.translate(-mcx, -mcy);
      }
      ctx.drawImage(mark, L.mark.x, L.mark.y, L.mark.w, L.mark.h);
      if (iconScale !== 1) ctx.restore();
    }

    const fontFamily = fontReady ? 'ClashDisplay' : 'Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SMW_TEXT_COLOR;
    ctx.globalAlpha = 1;

    if (mode === 'matchresult') {
      let winner = null;
      const homeNum = parseFloat(smState.homeScore);
      const awayNum = parseFloat(smState.awayScore);
      if (!isNaN(homeNum) && !isNaN(awayNum)) {
        if (homeNum > awayNum) winner = 'home';
        else if (awayNum > homeNum) winner = 'away';
      }
      ctx.font = `700 ${SM_SCORE_FONT}px "${fontFamily}"`;
      const scoreY = L.timeY + SM_SCORE_Y_OFFSET;
      if (smState.homeScore !== '' || smState.awayScore !== '') {
        // The score itself waits, then fades in — see SM_SCORE_DELAY_MS.
        // Losing side's number is also dimmed, same convention as Results.
        const scoreReveal = smScoreRevealAlpha();
        const homeAlpha = (winner === 'away' ? 0.35 : 1) * scoreReveal;
        const awayAlpha = (winner === 'home' ? 0.35 : 1) * scoreReveal;
        const gap = SM_SCORE_FONT * 0.45;
        ctx.textAlign = 'right';
        ctx.globalAlpha = homeAlpha;
        ctx.fillText(String(smState.homeScore || 0), L.centerX - gap, scoreY);
        ctx.textAlign = 'center';
        ctx.globalAlpha = scoreReveal;
        ctx.fillText('-', L.centerX, scoreY);
        ctx.textAlign = 'left';
        ctx.globalAlpha = awayAlpha;
        ctx.fillText(String(smState.awayScore || 0), L.centerX + gap, scoreY);
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.font = `700 ${L.timeFont}px "${fontFamily}"`;
      ctx.fillText(smState.time || '', L.centerX, L.timeY);
    }

    if (mode === 'match') {
      ctx.font = `500 ${L.dateFont}px "${fontFamily}"`;
      ctx.fillText(smState.dateRound || '', L.centerX, L.dateY);
    }

    // Each team's own PNG (assets/women/singlematch/teams/<CODE>.png) is
    // already a finished card — white background, crest, name and drop
    // shadow all baked in — so it's just placed, drawn after the bar so
    // its own shadow falls naturally onto it.
    const homeImg = smState.home ? loadImg(`assets/women/singlematch/teams/${smState.home}.png`) : null;
    if (homeImg && homeImg.complete && homeImg.naturalWidth) {
      ctx.drawImage(homeImg, L.teamLeft.x, L.teamLeft.y, L.teamLeft.w, L.teamLeft.h);
    }
    const awayImg = smState.away ? loadImg(`assets/women/singlematch/teams/${smState.away}.png`) : null;
    if (awayImg && awayImg.complete && awayImg.naturalWidth) {
      ctx.drawImage(awayImg, L.teamRight.x, L.teamRight.y, L.teamRight.w, L.teamRight.h);
    }

    const footerImg = loadImg('assets/women/singlematch/footer-white.png');
    if (footerImg && footerImg.complete && footerImg.naturalWidth) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(footerImg, L.footer.x, L.footer.y, L.footer.w, L.footer.h);
      ctx.restore();
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

  function drawResultRow(m, cy, fontFamily, C, anim) {
    // Card background is always drawn fully solid — see the render() loop
    // for why alpha-fading a large flat shape isn't used here.
    fillRow(ctx, ROW_LEFT, cy - ROW_H / 2, ROW_RIGHT - ROW_LEFT, ROW_H, C.resultRowBg, C.cornerRadius, C.rowBorder);

    const barAlpha = anim ? anim.bar.alpha : 1;
    if (barAlpha !== 1) { ctx.save(); ctx.globalAlpha = barAlpha; }
    const leftBadgeCx = ROW_LEFT + BADGE_MARGIN + BADGE_SIZE / 2;
    const rightBadgeCx = ROW_RIGHT - BADGE_MARGIN - BADGE_SIZE / 2;
    drawBadge(ctx, teamImg(m.home), CREST_X_LEFT, leftBadgeCx, cy, C.badgeRadius);
    drawBadge(ctx, teamImg(m.away), CREST_X_RIGHT, rightBadgeCx, cy, C.badgeRadius);
    if (resultDateMode === 'rows' && m.played !== false && (m.rowDate || defaultRowDate(m))) {
      ctx.save();
      ctx.globalAlpha = barAlpha * 0.65;
      ctx.fillStyle = C.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 22px "${fontFamily}"`;
      ctx.fillText(String(m.rowDate || defaultRowDate(m)).toUpperCase(), ROW_CENTER, cy + 56);
      ctx.restore();
    }
    if (barAlpha !== 1) ctx.restore();

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
      // Win-arrow overlay ("de lijnen"), positioned exactly like a team
      // strip: full row width, same 1200:rowWidth scale. During the reveal
      // animation this wipes outward from the row's center toward the
      // winning side instead of appearing all at once.
      const winnerCode = winner === 'home' ? m.home : m.away;
      const tintColor = C.teamColors[winnerCode] || '#caff1c';
      const arrowImg = winner === 'home' ? winArrowLeft : winArrowRight;
      const tinted = tintImage(arrowImg, winner === 'home' ? 'awL' : 'awR', tintColor);
      if (tinted) {
        const scale = (ROW_RIGHT - ROW_LEFT) / 1200;
        const dh = 200 * scale;
        const arrowT = anim ? anim.arrowT : 1;
        if (arrowT > 0) {
          if (arrowT < 1) {
            // Fast-then-slow growth: fastFraction is however much of the
            // half-row distance the icon's own half-width already covers.
            const iconImg = tintImage(vsIcon, 'vs', C.textColor);
            const ih = ROW_H * 0.48;
            const iw = iconImg ? ih * (iconImg.width / iconImg.height) : ih;
            const maxDist = (ROW_RIGHT - ROW_LEFT) / 2;
            const fastFraction = Math.min(0.9, (iw / 2) / maxDist);
            const dist = arrowWipeProgress(arrowT, fastFraction) * maxDist;
            const clipX0 = winner === 'home' ? ROW_CENTER - dist : ROW_CENTER;
            const clipX1 = winner === 'home' ? ROW_CENTER : ROW_CENTER + dist;
            ctx.save();
            ctx.beginPath();
            ctx.rect(clipX0, cy - dh, clipX1 - clipX0, dh * 2);
            ctx.clip();
            ctx.drawImage(tinted, ROW_LEFT, cy - dh / 2, ROW_RIGHT - ROW_LEFT, dh);
            ctx.restore();
          } else {
            ctx.drawImage(tinted, ROW_LEFT, cy - dh / 2, ROW_RIGHT - ROW_LEFT, dh);
          }
        }
      }
    }

    // The neutral SHL mark always sits in the middle — win or no win —
    // drawn on top of the chevron (if any) so it stays legible. During the
    // Results reveal animation this is the piece that "beats" like a heart.
    {
      const tinted = tintImage(vsIcon, 'vs', C.textColor);
      const iconScale = anim ? anim.iconScale : 1;
      if (tinted && iconScale > 0) {
        const ih = ROW_H * 0.48;
        const iw = ih * (tinted.width / tinted.height);
        if (iconScale !== 1) {
          ctx.save();
          ctx.translate(ROW_CENTER, cy);
          ctx.scale(iconScale, iconScale);
          ctx.translate(-ROW_CENTER, -cy);
        }
        ctx.drawImage(tinted, ROW_CENTER - iw / 2, cy - ih / 2, iw, ih);
        if (iconScale !== 1) ctx.restore();
      }
    }

    const fontSize = ROW_H * 0.62;
    const gap = fontSize * 0.62;
    ctx.font = `700 ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = C.textColor;
    const homeReveal = anim ? anim.home : { alpha: 1, scale: 1 };
    const awayReveal = anim ? anim.away : { alpha: 1, scale: 1 };
    if (m.homeScore !== '' && homeReveal.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = homeAlpha * homeReveal.alpha;
      ctx.textAlign = 'right';
      if (homeReveal.scale !== 1) {
        ctx.translate(ROW_CENTER - gap, cy);
        ctx.scale(homeReveal.scale, homeReveal.scale);
        ctx.translate(-(ROW_CENTER - gap), -cy);
      }
      ctx.fillText(m.homeScore, ROW_CENTER - gap, cy);
      ctx.restore();
    }
    if (m.awayScore !== '' && awayReveal.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = awayAlpha * awayReveal.alpha;
      ctx.textAlign = 'left';
      if (awayReveal.scale !== 1) {
        ctx.translate(ROW_CENTER + gap, cy);
        ctx.scale(awayReveal.scale, awayReveal.scale);
        ctx.translate(-(ROW_CENTER + gap), -cy);
      }
      ctx.fillText(m.awayScore, ROW_CENTER + gap, cy);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawScheduleRow(m, cy, fontFamily, C, dateOverride) {
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

    const rowDateText = dateOverride === false ? '' : (dateOverride || (m.showDate && m.dateLabel ? m.dateLabel : ''));
    if (rowDateText) {
      // Still-to-play match on a different day than the poster's main date
      // (e.g. one Sunday game amid a Saturday result round) — show both,
      // day on top of the time, so it isn't mistaken for the round's date.
      const dateFontSize = ROW_H * 0.16;
      const timeFontSize = ROW_H * 0.3;
      ctx.font = `700 ${dateFontSize}px "${fontFamily}"`;
      ctx.fillText(rowDateText, ROW_CENTER, cy - timeFontSize * 0.45);
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
      const nameBit = (isSingleMode()) ? (smState.id || 'match')
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
    if (savedState.resultsFormat === 'post' || savedState.resultsFormat === 'story') resultsFormat = savedState.resultsFormat;
    if (typeof savedState.postDecor === 'boolean') { postDecor = savedState.postDecor; postDecorToggle.checked = postDecor; }
    if (typeof savedState.showDates === 'boolean') {
      showDates = savedState.showDates;
      showDateToggle.checked = showDates;
    }
    if (typeof savedState.transparentBg === 'boolean') {
      transparentBg = savedState.transparentBg;
      transparentBgToggle.checked = transparentBg;
    }
    if (savedState.compKey && COMPETITIONS[savedState.compKey]) {
      compKey = savedState.compKey;
      competitionTabs.forEach(b => b.classList.toggle('active', b.dataset.competition === compKey));
      appEl.classList.toggle('theme-women', compKey === 'women');
    }
    refreshCheckButtonLabels();
    if (savedState.mode === 'topscorer' && compKey !== 'men') savedState.mode = 'matchresult';
    const canRestoreMode = ['results', 'schedule', 'match', 'matchresult', 'topscorer', 'playerweek', 'ranking'].includes(savedState.mode);
    if (canRestoreMode) {
      mode = savedState.mode;
      modeTabs.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      if (isSingleMode()) {
        roundSelectLabel.textContent = 'Wedstrijd';
        checkScoresBtn.hidden = mode === 'match' || mode === 'playerweek';
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = true;
        exportElementBtn.hidden = true;
        bgPhotoField.hidden = false;
        smAnimField.hidden = false;
        smwFormatField.hidden = mode === 'topscorer' || mode === 'playerweek';
        roundSelectField.hidden = mode === 'playerweek';
        smwFormatBtns.forEach(b => b.classList.toggle('active', b.dataset.smwFormat === smFormat));
        { const sz = smCanvasSize(); canvas.width = sz.w; canvas.height = sz.h; }
      } else if (mode === 'ranking') {
        roundSelectField.hidden = true;
        checkScoresBtn.hidden = true;
        checkScoresStatus.hidden = true;
        checkStandingsBtn.hidden = false;
        exportElementBtn.hidden = false;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
      }
      resultsAnimField.hidden = mode !== 'results';
      if (isListMode()) {
        smwFormatField.hidden = false;
        { const sz = smCanvasSize(); canvas.width = sz.w; canvas.height = sz.h; }
      }
      syncFormatButtons();
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


  // ---------- Per-item persistence on the server ----------
  // Every round / match / ranking / player gets its own record on the server (/api/item) with its
  // settings, the typed-in data and the transform of its photo; the photo itself goes to
  // /api/photo. Opening an item restores all of it; changes are saved a moment after you stop.
  const itemEnc = (k) => encodeURIComponent(k);

  function itemKey() {
    let id;
    if (mode === 'results' || mode === 'schedule') id = currentRoundId;
    else if (mode === 'ranking') id = 'table';
    else if (mode === 'playerweek') id = 'current';
    else id = smState.id;
    return id ? `${compKey}:${mode}:${id}` : null;
  }

  function collectItem() {
    const common = {
      v: 1, transparentBg,
      photo: bgPhotoImg ? { scale: bgPhotoScale, x: bgPhotoOffsetX, y: bgPhotoOffsetY } : null,
    };
    if (mode === 'results' || mode === 'schedule') {
      return {
        ...common, kind: 'round', format: resultsFormat, showDates, postDecor,
        matches: state.matches.map(m => ({
          home: m.home, away: m.away, homeScore: m.homeScore, awayScore: m.awayScore, played: m.played,
          hidden: m.hidden, showDate: m.showDate, dateLabel: m.dateLabel, showRowDate: m.showRowDate, rowDate: m.rowDate,
        })),
      };
    }
    if (mode === 'ranking') {
      return { ...common, kind: 'ranking', format: resultsFormat, rows: rankState[compKey].map(r => ({ ...r })) };
    }
    const sm = {};
    ['homeScore', 'awayScore', 'tsSide', 'tsFirst', 'tsLast', 'tsGoals', 'pwTeam', 'pwName'].forEach(k => { sm[k] = smState[k]; });
    return { ...common, kind: 'single', format: smFormat, postDecor, sm };
  }

  function applyItem(d) {
    if (typeof d.transparentBg === 'boolean') { transparentBg = d.transparentBg; transparentBgToggle.checked = transparentBg; }
    if (typeof d.postDecor === 'boolean') { postDecor = d.postDecor; postDecorToggle.checked = postDecor; }
    if (d.kind === 'round') {
      if (d.format === 'story' || d.format === 'post') resultsFormat = d.format;
      if (typeof d.showDates === 'boolean') { showDates = d.showDates; showDateToggle.checked = showDates; }
      // match by home/away so a schedule change doesn't misplace typed data
      (d.matches || []).forEach(sm => {
        const m = state.matches.find(x => x.home === sm.home && x.away === sm.away);
        if (m) ['homeScore', 'awayScore', 'played', 'hidden', 'showDate', 'dateLabel', 'showRowDate', 'rowDate']
          .forEach(k => { if (sm[k] !== undefined) m[k] = sm[k]; });
      });
    } else if (d.kind === 'ranking') {
      if (d.format === 'story' || d.format === 'post') resultsFormat = d.format;
      (d.rows || []).forEach((r, i) => { if (rankState[compKey][i]) Object.assign(rankState[compKey][i], r); });
    } else if (d.kind === 'single') {
      if (d.format === 'story' || d.format === 'post') smFormat = d.format;
      const sm = d.sm || {};
      Object.keys(sm).forEach(k => { if (sm[k] !== undefined) smState[k] = sm[k]; });
    }
    syncFormatButtons();
    { const sz = smCanvasSize(); canvas.width = sz.w; canvas.height = sz.h; }
  }

  function clearPhotoLocal() {
    bgPhotoImg = null; bgPhotoScale = 1; bgPhotoOffsetX = 0; bgPhotoOffsetY = 0;
    bgPhotoInput.value = ''; bgPhotoZoom.value = '1'; bgPhotoControls.hidden = true;
    canvas.classList.remove('bg-photo-draggable');
  }

  function loadPhotoFromServer(k, meta) {
    return fetch('/api/photo?key=' + itemEnc(k))
      .then(r => (r.ok ? r.blob() : null))
      .then(blob => new Promise(resolve => {
        if (!blob || k !== lastItemKey) return resolve();
        const img = new Image();
        img.onload = () => {
          bgPhotoImg = img;
          bgPhotoScale = (meta && meta.scale) || 1; bgPhotoOffsetX = (meta && meta.x) || 0; bgPhotoOffsetY = (meta && meta.y) || 0;
          bgPhotoZoom.value = String(bgPhotoScale); bgPhotoControls.hidden = false;
          canvas.classList.add('bg-photo-draggable');
          clampBgPhotoOffsets();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = URL.createObjectURL(blob);
      }))
      .catch(() => {});
  }

  function loadItemFromServer(k) {
    return fetch('/api/item?key=' + itemEnc(k))
      .then(r => (r.ok ? r.json() : {}))
      .then(async data => {
        if (k !== lastItemKey) return;
        clearPhotoLocal();                       // a photo belongs to one item
        if (data && data.kind) {
          applyItem(data);
          if (data.photo) await loadPhotoFromServer(k, data.photo);
        } else if (mode === 'playerweek') {
          // a new player slot (e.g. the other competition's) starts empty, not with the last name/club
          smState.pwName = ''; smState.pwTeam = '';
        }
        if (k !== lastItemKey) return;
        itemLoaded = true;
        buildMatchRows();
        render();
        lastSavedItemJson = JSON.stringify(collectItem());
        setSaveState(data && data.kind ? 'saved' : 'idle');
      })
      .catch(() => { if (k === lastItemKey) { itemLoaded = true; setSaveState('error'); } });
  }

  // Called at the start of every render: a different item (round, match, mode, competition)
  // means: stop saving, fetch that item's record, restore it.
  const saveIndicator = document.getElementById('saveIndicator');
  const SAVE_LABELS = { idle: '', loading: 'Laden…', pending: '● Wijzigingen nog niet opgeslagen', saving: 'Opslaan…', saved: '✓ Opgeslagen op de server', error: '⚠ Opslaan mislukt — probeer opnieuw' };
  function setSaveState(state) {
    if (!saveIndicator) return;
    saveIndicator.dataset.state = state;
    saveIndicator.textContent = SAVE_LABELS[state] || '';
  }

  function syncItemKey() {
    const k = itemKey();
    if (k === lastItemKey) return;
    lastItemKey = k;
    itemLoaded = false;
    setSaveState(k ? 'loading' : 'idle');
    if (itemSaveTimer) { clearTimeout(itemSaveTimer); itemSaveTimer = null; }
    if (k) loadItemFromServer(k);
  }

  function flushItemSave(keepalive) {
    const k = lastItemKey;
    if (!k || !itemLoaded) return;
    const json = JSON.stringify(collectItem());
    if (json === lastSavedItemJson) return;
    lastSavedItemJson = json;
    setSaveState('saving');
    fetch('/api/item?key=' + itemEnc(k), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: !!keepalive })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); if (k === lastItemKey) setSaveState('saved'); })
      .catch(() => { lastSavedItemJson = ''; setSaveState('error'); });
  }

  function scheduleServerSave() {
    if (!lastItemKey || !itemLoaded || itemSaveTimer) return;
    if (JSON.stringify(collectItem()) === lastSavedItemJson) return;   // nothing changed
    setSaveState('pending');
    itemSaveTimer = setTimeout(() => { itemSaveTimer = null; flushItemSave(false); }, 800);
  }
  window.addEventListener('pagehide', () => { if (itemSaveTimer) { clearTimeout(itemSaveTimer); itemSaveTimer = null; } flushItemSave(true); });

  function uploadItemPhoto() {
    const k = lastItemKey;
    if (!k || !bgPhotoImg) return;
    const maxSide = 2200, sc = Math.min(1, maxSide / Math.max(bgPhotoImg.naturalWidth, bgPhotoImg.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(bgPhotoImg.naturalWidth * sc); c.height = Math.round(bgPhotoImg.naturalHeight * sc);
    c.getContext('2d').drawImage(bgPhotoImg, 0, 0, c.width, c.height);
    c.toBlob(blob => {
      if (!blob) return;
      setSaveState('saving');
      fetch('/api/photo?key=' + itemEnc(k), { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); lastSavedItemJson = ''; scheduleServerSave(); flushItemSave(false); })
        .catch(() => setSaveState('error'));
    }, 'image/jpeg', 0.92);
  }

  function deleteItemPhoto() {
    const k = lastItemKey;
    if (!k) return;
    fetch('/api/photo?key=' + itemEnc(k), { method: 'DELETE' }).then(() => { lastSavedItemJson = ''; scheduleServerSave(); }).catch(() => {});
  }

  updateHint();
  buildMatchRows();
  loadCompetition();
  loadSingleMatchData();

  // ---------- Home menu (start page) ----------
  const homeMenu = document.getElementById('homeMenu');
  const ASSET_NAMES = { results: 'Results', schedule: 'Schedule', match: 'Match', matchresult: 'Matchresult', topscorer: 'Top scorer', playerweek: 'Speler van de week', ranking: 'Ranking' };
  var menuComp = compKey;   // var: renderOverviewMeta can run during early init (render)

  function syncMenuComp() {
    homeMenu.classList.toggle('theme-women', menuComp === 'women');
    homeMenu.querySelectorAll('[data-home-comp]').forEach(b => b.classList.toggle('active', b.dataset.homeComp === menuComp));
    homeMenu.querySelectorAll('.menu-card[data-go-mode="topscorer"]').forEach(c => { c.disabled = menuComp === 'women'; });
    const logo = document.getElementById('homeLogo');
    if (logo) logo.setAttribute('src', menuComp === 'women' ? 'assets/women/footer-logo-women.png' : 'assets/footer-logo.png');
    const tk = document.getElementById('homeTicker');
    const tkSrc = `ticker.html?comp=${menuComp}&size=64&bg=transparent&label=0&speed=50`;
    if (tk && tk.getAttribute('src') !== tkSrc) tk.setAttribute('src', tkSrc);
  }

  function showMenu() {
    resetResultsAnim();
    resetSmAnim();
    menuComp = compKey;
    syncMenuComp();
    document.body.classList.add('menu-open');
    window.scrollTo(0, 0);
    homeMenu.scrollTop = 0;
    if (typeof refreshStorage === 'function') refreshStorage();
    if (typeof loadOverview === 'function') loadOverview(false);
  }

  function updateEditorBar() {
    document.getElementById('editorAssetName').textContent = ASSET_NAMES[mode] || '';
    document.getElementById('editorCompName').textContent = COMPETITIONS[compKey].label;
    document.getElementById('editorSwitchBtn').textContent = compKey === 'men' ? '⇄ Vrouwen' : '⇄ Mannen';
  }

  function openAsset(comp, assetMode, fromMenu) {
    document.querySelector(`[data-competition="${comp}"]`).click();
    document.querySelector(`[data-mode="${assetMode}"]`).click();
    document.body.classList.remove('menu-open');
    updateEditorBar();
    jumpWhenReady();
    window.scrollTo(0, 0);
    if (fromMenu) history.pushState({ editor: true }, '');
  }

  homeMenu.querySelectorAll('[data-home-comp]').forEach(btn => {
    btn.addEventListener('click', () => { menuComp = btn.dataset.homeComp; syncMenuComp(); loadOverview(false); });
  });
  homeMenu.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', () => openAsset(menuComp, card.dataset.goMode, true));
  });
  document.getElementById('backToMenuBtn').addEventListener('click', () => {
    if (history.state && history.state.editor) history.back(); else showMenu();
  });
  document.getElementById('editorSwitchBtn').addEventListener('click', () => {
    openAsset(compKey === 'men' ? 'women' : 'men', mode, false);
  });
  window.addEventListener('popstate', () => showMenu());
  syncMenuComp();


  // ---------- Home page: all results + programme of the chosen competition ----------
  var overviewData = {};      // comp -> { at, data }; var: see menuComp
  var overviewTab = 'results';
  const WEEKDAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function overviewDateLabel(m) {
    const now = new Date();
    const startYear = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const d = new Date(m.month >= 8 ? startYear : startYear + 1, m.month - 1, m.day);
    return `${WEEKDAYS[d.getDay()]} ${m.day} ${MONTHS_NL[m.month - 1]}`;
  }
  const overviewClub = (n) => String(n || '').replace(/\s+HS1$/, '');

  function renderOverviewMeta() {
    const el = document.getElementById('overviewMeta');
    if (!el || !overviewData || !menuComp) return;
    const lines = syncLines(menuComp);
    const entry = overviewData[menuComp];
    const parts = [];
    if (entry && entry.data && entry.data.fetchedAt) parts.push(`Gegevens opgehaald ${fmtWhen(entry.data.fetchedAt)}`);
    if (lines) parts.push(...lines);
    el.textContent = parts.join('\n');
  }

  function renderOverview() {
    const list = document.getElementById('overviewList');
    if (!list) return;
    document.querySelectorAll('#overviewTabs [data-ov]').forEach(b => b.classList.toggle('active', b.dataset.ov === overviewTab));
    renderOverviewMeta();
    const entry = overviewData[menuComp];
    if (!entry) { list.textContent = 'Laden…'; return; }
    if (entry.error) { list.textContent = '✗ Ophalen mislukt: ' + entry.error; return; }
    const results = overviewTab === 'results';
    const items = (results ? entry.data.results : entry.data.upcoming).slice()
      .sort((a, b) => results ? b.ord - a.ord : a.ord - b.ord);
    if (!items.length) { list.textContent = results ? 'Nog geen uitslagen.' : 'Geen wedstrijden gepland.'; return; }
    // group by round when the site gives one (men), else by day (women)
    const groups = [];
    items.forEach(m => {
      const key = m.round != null ? 'r' + m.round : 'd' + m.ord;
      let g = groups.find(x => x.key === key);
      if (!g) { g = { key, round: m.round, label: m.round != null ? `Ronde ${m.round}` : overviewDateLabel(m), items: [] }; groups.push(g); }
      g.items.push(m);
    });
    list.innerHTML = '';
    groups.forEach((g, i) => {
      const det = document.createElement('details');
      det.className = 'ov-group';
      det.open = i === 0;
      const sum = document.createElement('summary');
      sum.textContent = `${g.label} · ${g.items.length} wedstrijd${g.items.length === 1 ? '' : 'en'}`;
      det.appendChild(sum);
      g.items.sort((a, b) => a.ord - b.ord || (a.time || '').localeCompare(b.time || '')).forEach(m => {
        const row = document.createElement('div');
        row.className = 'ov-row';
        const when = [overviewDateLabel(m), m.time].filter(Boolean).join(' ');
        row.innerHTML = '<span class="ov-when"></span><span class="ov-home"></span><span class="ov-score"></span><span class="ov-away"></span>';
        row.querySelector('.ov-when').textContent = when;
        row.querySelector('.ov-home').textContent = overviewClub(m.home);
        row.querySelector('.ov-away').textContent = overviewClub(m.away);
        const sc = row.querySelector('.ov-score');
        if (results) {
          sc.textContent = `${m.homeScore} – ${m.awayScore}`;
          row.classList.toggle('home-win', m.homeScore > m.awayScore);
          row.classList.toggle('away-win', m.awayScore > m.homeScore);
        } else {
          sc.textContent = m.time || '–';
        }
        det.appendChild(row);
      });
      list.appendChild(det);
    });
  }

  function loadOverview(force) {
    const key = menuComp;
    const e = overviewData[key];
    if (e && !e.error && !force && Date.now() - e.at < 60000) { renderOverview(); return; }
    if (!e) renderOverview();
    fetch('/api/overview?comp=' + key)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); overviewData[key] = { at: Date.now(), data: d }; })
      .catch(err => { if (!overviewData[key] || overviewData[key].error) overviewData[key] = { at: Date.now(), error: err.message }; })
      .finally(() => { if (key === menuComp) renderOverview(); });
  }
  document.querySelectorAll('#overviewTabs [data-ov]').forEach(b => b.addEventListener('click', () => { overviewTab = b.dataset.ov; renderOverview(); }));
  document.getElementById('overviewRefresh').addEventListener('click', () => { fetchSyncStatus(true).then(() => loadOverview(true)); });


  // ---------- Home page: liveticker links ----------
  (function buildTickerLinks() {
    const box = document.getElementById('tickerLinks');
    if (!box) return;
    [['men', 'Mannen'], ['women', 'Vrouwen']].forEach(([c, label]) => {
      const url = `${location.origin}/ticker.html?comp=${c}`;
      const iframe = `<iframe src="${url}" style="position:fixed;left:0;bottom:0;width:100%;height:110px;border:0;z-index:9999"></iframe>`;
      const row = document.createElement('div');
      row.className = 'ticker-row';
      row.innerHTML = '<strong></strong><input type="text" readonly><button class="btn btn-link" type="button" data-copy="url">Kopieer link</button><button class="btn btn-link" type="button" data-copy="iframe">Kopieer iframe-code</button><a class="btn btn-link" target="_blank" rel="noopener">Open ↗</a>';
      row.querySelector('strong').textContent = label;
      row.querySelector('input').value = url;
      row.querySelector('a').href = url;
      row.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
        const text = b.dataset.copy === 'url' ? url : iframe;
        const done = () => { const o = b.textContent; b.textContent = '✓ Gekopieerd'; setTimeout(() => { b.textContent = o; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => window.prompt('Kopieer:', text));
        else window.prompt('Kopieer:', text);
      }));
      box.appendChild(row);
    });
    const opt = document.createElement('p');
    opt.className = 'sync-info';
    opt.textContent = 'Balk onderaan het scherm, scrollt als een nieuwsuitzending. OBS: Browser Source 1920×1080 met deze link (alleen de balk is zichtbaar). Opties achter de link: &n=5 (aantal wedstrijden, max 10) · &dates=1 (datum onder de score) · &bg=transparent (zonder balkachtergrond) · &size=130 (hoogte) · &speed=100 (scrolsnelheid) · &layout=list (losse lijst).';
    box.appendChild(opt);
  })();

  // ---------- Storage & back-up (home menu) ----------
  const storageSummary = document.getElementById('storageSummary');
  const storageStatus = document.getElementById('storageStatus');
  const storageList = document.getElementById('storageList');
  const storageRows = document.getElementById('storageRows');
  const fmtBytes = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const fmtGB = (n) => (n / 1073741824).toFixed(1) + ' GB';
  let storageItems = [];

  function say(text, cls) {
    storageStatus.textContent = text; storageStatus.className = 'save-status' + (cls ? ' ' + cls : ''); storageStatus.hidden = !text;
  }
  function labelForKey(key) {
    if (!key) return { title: 'Onbekend onderdeel (oud)', sub: '' };
    const [c, m, ...rest] = key.split(':'); const id = rest.join(':');
    let what = ASSET_NAMES[m] || m;
    let sub = id;
    const single = /^r(\d+)_(.+)-(.+)$/.exec(id), round = /^ronde(\d+)/.exec(id);
    if (single) sub = `Ronde ${single[1]}: ${single[2]} – ${single[3]}`;
    else if (round) sub = `Ronde ${round[1]}${/__tussen/.test(id) ? ' (tussenronde)' : ''}`;
    else if (id === 'table' || id === 'current') sub = '';
    return { title: `${COMPETITIONS[c] ? COMPETITIONS[c].label : c} · ${what}`, sub };
  }
  function renderStorageRows() {
    storageRows.innerHTML = '';
    if (!storageItems.length) { storageRows.innerHTML = '<li><span class="row-label"><span>Nog niets opgeslagen.</span></span></li>'; return; }
    storageItems.forEach(it => {
      const { title, sub } = labelForKey(it.key);
      const li = document.createElement('li');
      const when = new Date(it.savedAt * 1000).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `<span class="row-label"><strong></strong><span></span></span><button class="btn btn-link" type="button">Verwijder</button>`;
      li.querySelector('strong').textContent = title;
      li.querySelector('.row-label span').textContent = `${sub ? sub + ' · ' : ''}${when} · ${fmtBytes(it.bytes + it.photoBytes)}${it.photoBytes ? ' (met foto)' : ''}`;
      li.querySelector('button').addEventListener('click', () => deleteStored([it], `"${title}${sub ? ' — ' + sub : ''}" verwijderen?`));
      storageRows.appendChild(li);
    });
  }
  function refreshStorage() {
    return fetch('/api/items').then(r => r.json()).then(d => {
      storageItems = d.items || [];
      const u = d.usage || {};
      storageSummary.textContent = `${u.items || 0} ${u.items === 1 ? 'onderdeel' : 'onderdelen'} opgeslagen · ${fmtBytes(u.bytes || 0)} gebruikt` + (u.diskFree ? ` · ${fmtGB(u.diskFree)} vrij op de schijf` : '');
      renderStorageRows();
    }).catch(() => { storageSummary.textContent = 'Opslag niet bereikbaar'; });
  }
  function deleteStored(list, question) {
    if (!list.length || !window.confirm(question)) return Promise.resolve();
    say('Verwijderen…');
    return Promise.all(list.map(it => fetch('/api/item?hash=' + it.hash, { method: 'DELETE' })))
      .then(() => { lastItemKey = null; say(`✓ ${list.length} verwijderd`, 'ok'); return refreshStorage(); })
      .catch(err => say('✗ Verwijderen mislukt: ' + err.message, 'warn'));
  }
  document.getElementById('toggleStorageList').addEventListener('click', () => { storageList.hidden = !storageList.hidden; });
  document.getElementById('cleanOldBtn').addEventListener('click', () => {
    const days = parseInt(document.getElementById('cleanDays').value, 10);
    const cutoff = Date.now() / 1000 - days * 86400;
    const old = storageItems.filter(it => it.savedAt < cutoff);
    if (!old.length) { say(`Niets ouder dan ${days} dagen.`, 'ok'); return; }
    deleteStored(old, `${old.length} onderdelen (en hun foto's) ouder dan ${days} dagen verwijderen?`);
  });
  document.getElementById('restoreInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!window.confirm(`Back-up "${f.name}" terugzetten? Onderdelen met dezelfde sleutel worden overschreven.`)) { e.target.value = ''; return; }
    say('Terugzetten…');
    fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: f })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); lastItemKey = null; say(`✓ ${d.restored} bestanden teruggezet`, 'ok'); return refreshStorage(); })
      .catch(err => say('✗ Terugzetten mislukt: ' + err.message, 'warn'))
      .finally(() => { e.target.value = ''; });
  });
  refreshStorage();
  loadOverview(false);


})();
