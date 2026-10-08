// The settings page: club names/labels/codes, logos and default texts (see settings.js).
(() => {
  'use strict';
  const S = window.SETTINGS, DEF = S.DEF;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let hnlClubs = [];
  const STATE_LABEL = { idle: '', pending: '● Wijzigingen worden opgeslagen…', saving: 'Opslaan…', saved: '✓ Opgeslagen op de server', error: '⚠ Opslaan mislukt' };

  S.onChange((what) => {
    if (what === 'state') { const el = $('setSave'); if (el) { el.dataset.state = S.state; el.textContent = STATE_LABEL[S.state] || ''; } }
  });

  function row({ key, logoHtml, label, name, code, defLabel, defName, defCode, showName }) {
    return `<div class="set-row" data-key="${esc(key)}">
      ${logoHtml}
      <input type="text" class="set-label" data-f="label" value="${esc(S.data.clubs[key] && S.data.clubs[key].label || '')}" placeholder="${esc(defLabel)}" aria-label="Naam">
      ${showName ? `<input type="text" class="set-name" data-f="name" value="${esc(S.data.clubs[key] && S.data.clubs[key].name || '')}" placeholder="${esc(defName)}" aria-label="Standaardnaam op de visual">` : '<span class="set-name"></span>'}
      <input type="text" class="set-code" data-f="code" value="${esc(S.data.clubs[key] && S.data.clubs[key].code || '')}" placeholder="${esc(defCode)}" aria-label="Code">
      <button class="set-reset" type="button" title="Standaard herstellen" data-reset>↺</button>
    </div>`;
  }
  const logoCell = (logoKey, src, extra = '') => `<label class="set-logo" title="Klik om het logo te vervangen" data-logo="${esc(logoKey)}"><img src="${esc(src)}" alt="" ${extra}><input type="file" accept="image/*" hidden></label>`;

  function build() {
    const box = $('setBody'); if (!box) return;
    const head = (cols) => `<div class="set-row set-head"><span></span><span>${cols[0]}</span><span>${cols[1]}</span><span>${cols[2]}</span><span></span></div>`;
    let h = '';
    // --- HandbalNL clubs
    h += `<details class="set-sec" open><summary>Clubs HandbalNL (Next heren/dames en SHLW-logo's)</summary>
      <p class="sync-info">Het logo, de naam in de lijsten, de standaardnaam op de visual (sponsornaam) en de code in de bestandsnaam. Leeg laten = standaard.</p>
      ${head(['Naam in lijsten', 'Standaardnaam op de visual', 'Code (bestandsnaam)'])}
      ${hnlClubs.map(c => row({ key: 'hnl:' + c.id, logoHtml: logoCell('hnl:' + c.id, S.logo('hnl:' + c.id, `assets/hnl/clubs/${c.id}.jpg`)), defLabel: c.label, defName: c.name, defCode: DEF.hnlCode[c.id] || c.id.toUpperCase(), showName: true })).join('')}
    </details>`;
    // --- SHL men
    h += `<details class="set-sec"><summary>Clubs SHL heren</summary>
      <p class="sync-info">Het logo is het wapen uit het club-bestand; een eigen logo vervangt het (SHL-thumbnails). De naam komt in de keuzelijsten van de thumbnails.</p>
      ${head(['Naam in lijsten', '', 'Code (bestandsnaam)'])}
      ${DEF.men.map(([code, label]) => row({ key: 'men:' + code, logoHtml: logoCell('men:' + code, S.logo('men:' + code, ''), `data-crest="${code}"`), defLabel: label, defName: '', defCode: DEF.menExportCode[code] || code, showName: false })).join('')}
    </details>`;
    // --- SHLW
    h += `<details class="set-sec"><summary>Clubs SHLW dames</summary>
      <p class="sync-info">Het onderschrift staat onder het logo op de SHLW-thumbnail. Een logo wijzig je hier; het geldt dan ook voor de HandbalNL-club.</p>
      ${head(['Onderschrift bij het logo', '', 'Code (bestandsnaam)'])}
      ${DEF.women.map(([code, label]) => { const jid = DEF.womenJpg[code]; return row({ key: 'women:' + code, logoHtml: logoCell('hnl:' + jid, S.logo('hnl:' + jid, `assets/hnl/clubs/${jid}.jpg`)), defLabel: label, defName: '', defCode: DEF.womenExportCode[code] || code, showName: false }); }).join('')}
    </details>`;
    // --- texts
    h += `<details class="set-sec" open><summary>Standaardteksten</summary>
      <p class="sync-info">Beginwaarden voor nieuwe thumbnails en visuals. Al opgeslagen onderdelen veranderen niet.</p>
      ${DEF.texts.map(([key, label, def]) => `<div class="set-text"><label for="st_${esc(key)}">${esc(label)}</label><input type="text" id="st_${esc(key)}" data-text="${esc(key)}" value="${esc(S.data.texts[key] || '')}" placeholder="${esc(def)}"></div>`).join('')}
    </details>`;
    box.innerHTML = h;
    // crest previews for the SHL men rows (crop of the team strip)
    box.querySelectorAll('img[data-crest]').forEach(img => {
      if (img.getAttribute('src')) return;
      const code = img.dataset.crest, st = new Image();
      st.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 160; c.getContext('2d').drawImage(st, 0, 19, 158, 159, 0, 0, 160, 160); img.src = c.toDataURL('image/png'); };
      st.src = `assets/teams/${code}.png`;
    });
    bind(box);
  }

  function bind(box) {
    box.querySelectorAll('.set-row[data-key] input[data-f]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.closest('.set-row').dataset.key;
        S.setClub(key, inp.dataset.f, inp.value.trim());
        if (inp.dataset.f === 'name' && key.startsWith('hnl:')) { try { const m = JSON.parse(localStorage.getItem('hnl-club-names') || '{}'); delete m[key.slice(4)]; localStorage.setItem('hnl-club-names', JSON.stringify(m)); } catch (e) { /* ignore */ } }
      });
    });
    box.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => {
      const r = b.closest('.set-row'); const key = r.dataset.key;
      if (!window.confirm('Standaardwaarden voor deze club herstellen (ook het eigen logo)?')) return;
      S.resetClub(key);
      const lg = r.querySelector('.set-logo'); if (lg && lg.dataset.logo !== key) S.removeLogo(lg.dataset.logo);
      setTimeout(build, 50);
    }));
    box.querySelectorAll('.set-logo input[type=file]').forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const key = inp.closest('.set-logo').dataset.logo;
      try { await S.uploadLogo(key, f); build(); } catch (e) { window.alert('Logo uploaden mislukt'); }
    }));
    box.querySelectorAll('input[data-text]').forEach(inp => inp.addEventListener('input', () => S.setText(inp.dataset.text, inp.value)));
  }

  async function open() {
    await S.ready;
    try { hnlClubs = await (await fetch('assets/hnl/clubs.json')).json(); } catch (e) { hnlClubs = []; }
    build();
    const el = $('setSave'); if (el) { el.dataset.state = S.state; el.textContent = STATE_LABEL[S.state] || ''; }
  }
  $('setResetAll') && $('setResetAll').addEventListener('click', async () => {
    if (!window.confirm('ALLE instellingen (namen, codes, teksten en eigen logo\'s) terugzetten naar de standaard?')) return;
    const logos = Object.keys(S.data.clubs).filter(k => S.data.clubs[k].logo);
    await Promise.all(logos.map(k => S.removeLogo(k)));
    S.data.clubs = {}; S.data.texts = {}; await S.save(); build();
  });
  window.SETUI = { open, close() { return S.save(); } };
})();
