'use strict';

// ─── DANE BUKMACHERÓW ────────────────────────────────────────────────────────

// freebetKeepsStake: true = wygrana z freebeta zawiera stawkę (auto-SR), nawet gdy promocja jest SNR
const BOOKMAKERS = [
  { id: 'fortuna',   name: 'Fortuna',   tax: 0.12, margin: 0.10, freebetKeepsStake: true },
  { id: 'superbet',  name: 'Superbet',  tax: 0.12, margin: 0.10 },
  { id: 'sts',       name: 'STS',       tax: 0.12, margin: 0.10 },
  { id: 'etoto',     name: 'eToto',     tax: 0.12, margin: 0.10 },
  { id: 'lvbet',     name: 'LV BET',    tax: 0.12, margin: 0.10, freebetKeepsStake: true },
  { id: 'forbet',    name: 'Forbet',    tax: 0.12, margin: 0.10, freebetKeepsStake: true },
  { id: 'betfan',    name: 'BETFAN',    tax: 0.12, margin: 0.10 },
  { id: 'totalbet',  name: 'Totalbet',  tax: 0.12, margin: 0.10 },
  { id: 'comeon',    name: 'ComeOn',    tax: 0.12, margin: 0.10 },
  { id: 'betclic',   name: 'Betclic',   tax: 0.00, margin: 0.10 },
  { id: 'lebull',    name: 'LeBull',    tax: 0.12, margin: 0.10 },
  { id: 'admiral',   name: 'Admiral',   tax: 0.12, margin: 0.10 },
  { id: 'fuksiarz',  name: 'Fuksiarz',  tax: 0.12, margin: 0.10 },
  { id: 'betcris',   name: 'Betcris',   tax: 0.12, margin: 0.10 },
  { id: 'pzbuk',     name: 'PZBuk',     tax: 0.12, margin: 0.10 },
  { id: 'betters',   name: 'Betters',   tax: 0.12, margin: 0.10 },
  { id: 'traf',      name: 'Traf',      tax: 0.12, margin: 0.10 },
];

function bookmakerTip(bk) {
  const tips = [];
  if (bk.tax === 0) tips.push('bez podatku');
  if (bk.freebetKeepsStake) tips.push('freebet bez odjęcia stawki');
  return tips.join(', ');
}

// ─── TYPY PROMOCJI ───────────────────────────────────────────────────────────

const PROMO_TYPES = [
  {
    id: 'free_freebet',
    label: 'Darmowy free bet',
    desc: 'Gotowe kredyty do wykorzystania bez wpłaty',
    sections: [
      { title: null,                   fields: ['award-condition'] },
      { title: 'Wymogi co do kuponu',  fields: ['coupon-is-bb', 'coupon-amount', 'min-events', 'min-coupon-odds'] },
      { title: 'Wymogi co do bonusu',  fields: ['freebet-is-bb', 'freebet-value', 'freebet-min-events'] },
    ],
  },
  {
    id: 'risk_free',
    label: 'Cashback (zakład bez ryzyka)',
    desc: 'Zwrot stawki (jako freebet) jeśli przegrasz pierwszy zakład',
    fields: ['qual-stake', 'back-odds'],
  },
  {
    id: 'boosted_odds',
    label: 'Zwiększony kurs',
    desc: 'Podwyższony kurs na wybrane wydarzenie',
    fields: ['qual-stake', 'original-odds', 'boosted-odds'],
  },
  {
    id: 'deposit_bonus',
    label: 'Dodatkowy bonus za wpłatę',
    desc: 'np. 100% do 500 zł — bukmacher dopłaca tyle samo co wpłacasz',
    fields: ['deposit', 'bonus-pct', 'wagering', 'min-odds'],
  },
];

const FIELD_DEFS = {
  'qual-stake':    { label: 'Stawka kwalifikująca (PLN)', placeholder: 'np. 30.00', type: 'number', min: 0, step: 0.01 },
  'freebet-value': { label: 'Wartość freebeta (PLN)',     placeholder: 'np. 30.00', type: 'number', min: 0, step: 0.01 },
  'back-odds':     { label: 'Kurs zakładu',               placeholder: 'np. 4.00',  type: 'number', min: 1.01, step: 0.01 },
  'deposit':       { label: 'Kwota depozytu (PLN)',       placeholder: 'np. 500.00',type: 'number', min: 0, step: 0.01 },
  'bonus-pct':     { label: 'Bonus (%)',                  placeholder: 'np. 100',   type: 'number', min: 0, step: 1 },
  'wagering':      { label: 'Wymóg obrotu (x razy)',      placeholder: 'np. 5',     type: 'number', min: 1, step: 1 },
  'min-odds':      { label: 'Minimalny kurs obrotu',      placeholder: 'np. 1.80',  type: 'number', min: 1.01, step: 0.01 },
  'original-odds': { label: 'Kurs oryginalny',            placeholder: 'np. 3.00',  type: 'number', min: 1.01, step: 0.01 },
  'boosted-odds':  { label: 'Kurs zboostowany',           placeholder: 'np. 5.00',  type: 'number', min: 1.01, step: 0.01 },
  'freebet-type':  { label: 'Typ freebeta',               type: 'select', options: [
                       { value: 'sr',  label: 'SR — stawka wraca' },
                       { value: 'snr', label: 'SNR — stawka przepada' },
                     ] },
  'coupon-amount': { label: 'Wymagana kwota kuponu (PLN)',placeholder: 'np. 20.00', type: 'number', min: 0, step: 0.01 },
  'coupon-odds':   { label: 'Kurs kuponu (łączny)',        placeholder: 'np. 1.50',  type: 'number', min: 1.01, step: 0.01 },
  'min-events':    { label: 'Liczba zdarzeń (min)',       type: 'select',
                     options: [{value:'',label:''}, ...[1,2,3,4,5,6,7,8,9].map(n => ({ value: String(n), label: String(n) }))] },
  'freebet-min-events': { label: 'Liczba zdarzeń (min)',  type: 'select',
                     options: [{value:'',label:''}, ...[1,2,3,4,5,6,7,8,9].map(n => ({ value: String(n), label: String(n) }))] },
  'min-coupon-odds':{ label: 'Kurs kuponu (min)',          placeholder: 'np. 1.80', type: 'number', min: 1.01, step: 0.01 },
  'coupon-is-bb':  { label: 'Bet builder?',                type: 'select', options: [
                         { value: '',      label: '' },
                         { value: 'yes',   label: 'Tak' },
                         { value: 'no',    label: 'Nie' },
                       ] },
  'freebet-is-bb': { label: 'Bet builder?',                type: 'select', options: [
                         { value: '',      label: '' },
                         { value: 'yes',   label: 'Tak' },
                         { value: 'no',    label: 'Nie' },
                       ] },
  'award-condition': { label: 'Freebet przyznawany za',   type: 'select', options: [
                         { value: '',       label: '' },
                         { value: 'always', label: 'Za każdym razem' },
                         { value: 'win',    label: 'Tylko za wygrany kupon' },
                         { value: 'lose',   label: 'Tylko za przegrany kupon' },
                       ] },
};

// ─── STATE ───────────────────────────────────────────────────────────────────

let selectedBK    = null;
let selectedPromo = null;

// ─── MATH ────────────────────────────────────────────────────────────────────

// Strata na zwykłym zakładzie — marża kumuluje się przez N zdarzeń
// strata = S × [1 − (1-t)(1-m)^N]
function calcQualifyingLoss(stake, tax, margin, events = 1) {
  return stake * (1 - (1 - tax) * Math.pow(1 - margin, events));
}

// EV freebeta SR / SNR — marża kumuluje się przez N zdarzeń na kuponie freebetowym
// SR:  EV = F × (1-t) × (1-m)^N
// SNR: EV = F × [(1-t)(1-m)^N − 1/B]  (bukmacher odejmuje NOMINALNĄ wartość freebeta)
function calcFreebetEV(freebetType, freebet, backOdds, tax, margin, events = 1) {
  const marginFactor = Math.pow(1 - margin, events);
  if (freebetType === 'sr')  return freebet * (1 - tax) * marginFactor;
  if (freebetType === 'snr') return freebet * ((1 - tax) * marginFactor - 1 / backOdds);
  return 0;
}

// Bonus od depozytu
// Zakładamy że musisz obrócić (deposit+bonus) × wagering na kursach min-odds
// Po W rundach obrotu kapitał maleje wykładniczo × (1-t)(1-m) każdą rundę
function calcDepositBonusEV(deposit, bonusPct, wagering, tax, margin) {
  const total = deposit * (1 + bonusPct / 100);
  const keepRate = (1 - tax) * (1 - margin);
  const finalMoney = total * Math.pow(keepRate, wagering);
  return finalMoney - deposit;
}

// Zakład bez ryzyka — wygrywasz normalnie albo dostajesz freebet przy przegranej
// Przy freebetKeepsStake=true → freebet traktowany jak SR (bukmacher nie odejmuje stawki)
function calcRiskFreeEV(stake, backOdds, tax, margin, freebetKeepsStake = false) {
  const pWin  = (1 - margin) / backOdds;
  const pLose = 1 - pWin;
  const winProfit = stake * (1 - tax) * backOdds * (1 - margin) - stake;
  const fbType    = freebetKeepsStake ? 'sr' : 'snr';
  const loseValue = calcFreebetEV(fbType, stake, backOdds, tax, margin) - stake;
  return pWin * winProfit + pLose * loseValue;
}

// Zboostowany kurs — kurs oryginalny B, ale wypłata na B_boost
function calcBoostedEV(stake, originalOdds, boostedOdds, tax, margin) {
  const pWin = (1 - margin) / originalOdds;
  const winProfit = stake * (1 - tax) * boostedOdds - stake;
  return pWin * winProfit + (1 - pWin) * (-stake);
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function fmt(v)    { return v.toFixed(2) + ' PLN'; }
function fmtPct(v) { return v.toFixed(1) + '%'; }
function todayISO(){ return new Date().toISOString().slice(0, 10); }
function uid()     { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── STORAGE ─────────────────────────────────────────────────────────────────

const KEY = 'promo_log_v1';
function loadLog()      { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function saveLog(e)     { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch {} }
function addEntry(e)    { const arr = loadLog(); arr.push(e); saveLog(arr); }
function deleteEntry(id){ saveLog(loadLog().filter(e => e.id !== id)); }

// ─── INICJALIZACJA DROPDOWNÓW ────────────────────────────────────────────────

function populateBookmakers() {
  const sel = document.getElementById('bk-select');
  BOOKMAKERS.forEach(bk => {
    const opt = document.createElement('option');
    opt.value = bk.id;
    const tip = bookmakerTip(bk);
    opt.textContent = tip ? `${bk.name} (${tip})` : bk.name;
    sel.appendChild(opt);
  });
}

function populatePromoTypes() {
  const sel = document.getElementById('promo-select');
  PROMO_TYPES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  });
}

// ─── RENDER PÓL ──────────────────────────────────────────────────────────────

function renderField(fid) {
  const def = FIELD_DEFS[fid];
  if (def.type === 'checkbox') {
    return `
      <div class="field field-checkbox">
        <label class="checkbox-label">
          <input type="checkbox" id="${fid}" />
          <span>${def.label}</span>
        </label>
      </div>
    `;
  }
  if (def.type === 'select') {
    return `
      <div class="field">
        <label for="${fid}">${def.label}</label>
        <select id="${fid}">
          ${def.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
    `;
  }
  return `
    <div class="field">
      <label for="${fid}">${def.label}</label>
      <input type="number" id="${fid}" min="${def.min}" step="${def.step}" placeholder="${def.placeholder}" />
    </div>
  `;
}

function renderFormFields() {
  const container = document.getElementById('form-fields');
  // Zachowaj aktualne wartości przed re-renderem
  const savedValues = {};
  container.querySelectorAll('input, select').forEach(el => {
    if (el.id) savedValues[el.id] = el.value;
  });

  const awardCond = savedValues['award-condition'] || '';
  const showCouponOdds = awardCond === 'win' || awardCond === 'lose';
  // Dla typu free_freebet: dopóki award-condition jest puste, pokazuj tylko tę sekcję
  const showOnlyAward = selectedPromo.id === 'free_freebet' && awardCond === '';

  let sections = (selectedPromo.sections || [{ title: null, fields: selectedPromo.fields }])
    .map(sec => {
      // Dynamicznie dodaj/usuń min-coupon-odds w sekcji Wymogi co do kuponu
      if (sec.fields.includes('coupon-amount')) {
        const base = sec.fields.filter(f => f !== 'min-coupon-odds');
        const newFields = showCouponOdds
          ? [...base, 'min-coupon-odds']
          : base;
        return { ...sec, fields: newFields };
      }
      return sec;
    });

  // Ukryj wszystko poza pierwszą sekcją (z award-condition) gdy blank
  if (showOnlyAward) {
    sections = sections.filter(sec => sec.fields.includes('award-condition'));
  }

  container.innerHTML = sections.map(sec => `
    ${sec.title ? `<h3 class="section-title">${sec.title}</h3>` : ''}
    <div class="section-grid">
      ${sec.fields.map(renderField).join('')}
    </div>
  `).join('');

  // Przywróć zapisane wartości
  container.querySelectorAll('input, select').forEach(el => {
    if (el.id && savedValues[el.id] !== undefined) el.value = savedValues[el.id];
    el.addEventListener('input', updateResults);
    el.addEventListener('change', () => {
      if (el.id === 'award-condition') renderFormFields();
      updateTips();
      updateResults();
    });
  });
}

function checkReady() {
  const details = document.getElementById('details-section');
  if (selectedBK && selectedPromo) {
    details.classList.remove('hidden');
    renderFormFields();
    updateResults();
  } else {
    details.classList.add('hidden');
  }
}

// ─── AKTUALIZACJA WYNIKÓW ────────────────────────────────────────────────────

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value) || 0;
}
function getStr(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

// Sprawdza czy wszystkie wymagane pola są uzupełnione (dla free_freebet)
function areRequiredFieldsFilled() {
  const awardCond = getStr('award-condition');
  const base = [
    'award-condition', 'coupon-is-bb', 'coupon-amount',
    'min-events', 'freebet-is-bb', 'freebet-value',
    'freebet-min-events',
  ];
  const fields = [...base];
  if (awardCond === 'win' || awardCond === 'lose') fields.push('min-coupon-odds');
  return fields.every(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    const v = el.value;
    return v !== '' && v !== null && v !== undefined;
  });
}

// Oblicza { ev, qualLoss, net, investment } w zależności od typu promocji
function calculate() {
  if (!selectedBK || !selectedPromo) return null;
  const { tax, margin } = selectedBK;

  if (selectedPromo.id === 'free_freebet') {
    if (!areRequiredFieldsFilled()) return null;

    const couponAmount   = getVal('coupon-amount');
    const freebet        = getVal('freebet-value');
    const couponEvents   = parseInt(getStr('min-events'));
    const freebetEvents  = parseInt(getStr('freebet-min-events'));
    const awardCondition = getStr('award-condition');
    const couponOdds     = getVal('min-coupon-odds');

    // SR tylko dla Fortuna/LVBET/Forbet, reszta SNR
    const fbType = selectedBK.freebetKeepsStake ? 'sr' : 'snr';
    const assumedFreebetOdds = 4.0;

    // Bet builder dropdown "yes"/"no"/"" — jeśli yes to m=12% i N×2
    const couponIsBB  = getStr('coupon-is-bb')  === 'yes';
    const freebetIsBB = getStr('freebet-is-bb') === 'yes';
    const couponM     = couponIsBB  ? 0.12 : margin;
    const couponNEff  = couponIsBB  ? couponEvents * 2 : couponEvents;
    const freebetM    = freebetIsBB ? 0.12 : margin;
    const freebetNEff = freebetIsBB ? freebetEvents * 2 : freebetEvents;

    const evBase   = calcFreebetEV(fbType, freebet, assumedFreebetOdds, tax, freebetM, freebetNEff);
    const qualLoss = calcQualifyingLoss(couponAmount, tax, couponM, couponNEff);

    // Mnożnik EV zależny od warunku przyznania freebeta
    let evMultiplier = 1;
    if (awardCondition === 'win' || awardCondition === 'lose') {
      const pWin = Math.pow(1 - couponM, couponNEff) / couponOdds;
      evMultiplier = awardCondition === 'win' ? pWin : (1 - pWin);
    }

    const ev  = evMultiplier * evBase;
    const net = ev - qualLoss;
    return { ev, qualLoss, net, investment: couponAmount };
  }

  if (selectedPromo.id === 'risk_free') {
    const stake    = getVal('qual-stake');
    const backOdds = getVal('back-odds');
    if (!stake || !backOdds) return null;
    const ev = calcRiskFreeEV(stake, backOdds, tax, margin, selectedBK.freebetKeepsStake);
    return { ev, qualLoss: 0, net: ev, investment: stake };
  }

  if (selectedPromo.id === 'boosted_odds') {
    const stake    = getVal('qual-stake');
    const origOdds = getVal('original-odds');
    const boosted  = getVal('boosted-odds');
    if (!stake || !origOdds || !boosted) return null;
    const ev = calcBoostedEV(stake, origOdds, boosted, tax, margin);
    return { ev, qualLoss: 0, net: ev, investment: stake };
  }

  if (selectedPromo.id === 'deposit_bonus') {
    const deposit  = getVal('deposit');
    const bonusPct = getVal('bonus-pct');
    const wagering = getVal('wagering');
    if (!deposit || !bonusPct || !wagering) return null;
    const ev = calcDepositBonusEV(deposit, bonusPct, wagering, tax, margin);
    return { ev, qualLoss: 0, net: ev, investment: deposit };
  }

  return null;
}

function updateResults() {
  const errEl = document.getElementById('error-msg');
  errEl.classList.add('hidden');

  const result = calculate();
  const recalcRow = document.getElementById('recalc-row');
  if (!result) {
    clearResults();
    if (recalcRow) recalcRow.classList.add('hidden');
    updateStrategyPanel();
    return;
  }

  const { ev, qualLoss, net, investment } = result;
  const pct = investment ? (net / investment) * 100 : null;

  document.getElementById('res-ev').textContent        = fmt(ev);
  document.getElementById('res-qual-loss').textContent = qualLoss ? fmt(qualLoss) : '—';
  document.getElementById('res-net').textContent       = fmt(net);
  document.getElementById('res-net').className         = 'result-value result-value-big ' + (net >= 0 ? 'green' : 'red');
  document.getElementById('res-pct').textContent       = pct !== null ? fmtPct(pct) : '—';

  if (recalcRow) recalcRow.classList.remove('hidden');
  updateStrategyPanel();
}

function clearResults() {
  ['res-ev','res-qual-loss','res-net','res-pct'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
}

function updateTips() {
  const list = document.getElementById('tips-list');
  if (!list) return;
  const hasBK  = !!selectedBK;
  const isSR   = hasBK && selectedBK.freebetKeepsStake;
  const award  = document.getElementById('award-condition')?.value || '';
  const isLose = award === 'lose';

  list.querySelectorAll('li').forEach(li => {
    const tip = li.dataset.tip;
    let show = false;

    if (tip === 'always') show = true;
    // Tipy kupon-bonusowy — zależne od SR/SNR
    else if (tip === 'sr')  show = hasBK && isSR;
    else if (tip === 'snr') show = hasBK && !isSR;
    // Strategia kuponu kwalifikującego
    else if (tip === 'coupon-low-default') show = award === '' || award === 'always';
    else if (tip === 'coupon-low-win')     show = award === 'win';
    // Tipy dla "tylko przegrany" — progi per N
    else if (tip === 'lose-limit-solo')    show = isLose;
    else if (tip === 'lose-limit-ako2')    show = isLose;
    else if (tip === 'lose-limit-ako3')    show = isLose;

    li.classList.toggle('hidden', !show);
  });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── TABELA ──────────────────────────────────────────────────────────────────

function renderTable() {
  const entries = loadLog();
  const empty = document.getElementById('log-empty');
  const wrap  = document.getElementById('log-table-wrap');
  const tbody = document.getElementById('log-tbody');
  const tfoot = document.getElementById('log-tfoot');

  if (!entries.length) { empty.classList.remove('hidden'); wrap.classList.add('hidden'); return; }
  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  tbody.innerHTML = entries.map(e => `
    <tr>
      <td>${esc(e.bookmaker)}</td>
      <td class="td-muted">${e.date}</td>
      <td>${esc(e.promoType)}</td>
      <td>${fmt(e.freebet)}</td>
      <td>${e.backOdds.toFixed(2)}</td>
      <td class="${e.net >= 0 ? 'td-green' : 'td-red'}">${fmt(e.net)}</td>
      <td class="${e.net >= 0 ? 'td-green' : 'td-red'}">${fmtPct(e.returnPct)}</td>
      <td><button class="btn-delete" data-id="${e.id}">×</button></td>
    </tr>
  `).join('');

  const total = entries.reduce((s, e) => s + e.net, 0);
  const n = entries.length;
  tfoot.innerHTML = `
    <tr>
      <td colspan="5">Suma (${n} ${n===1?'promocja':n<5?'promocje':'promocji'})</td>
      <td class="${total>=0?'td-green':'td-red'}">${fmt(total)}</td>
      <td></td><td></td>
    </tr>
  `;
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  populateBookmakers();
  populatePromoTypes();

  const bkSel    = document.getElementById('bk-select');
  const promoSel = document.getElementById('promo-select');

  bkSel.addEventListener('change', () => {
    selectedBK = BOOKMAKERS.find(b => b.id === bkSel.value) || null;
    updateTips();
    checkReady();
  });

  promoSel.addEventListener('change', () => {
    selectedPromo = PROMO_TYPES.find(p => p.id === promoSel.value) || null;
    checkReady();
  });

  document.getElementById('btn-recalc').addEventListener('click', updateResults);

  document.getElementById('btn-save').addEventListener('click', () => {
    const result = calculate();
    if (!result) { showError('Uzupełnij wszystkie pola.'); return; }

    const { net, investment } = result;
    const returnPct = investment ? (net / investment) * 100 : 0;

    addEntry({
      id: uid(),
      bookmaker: selectedBK.name,
      date: todayISO(),
      promoType: selectedPromo.label,
      freebet: investment,
      backOdds: getVal('back-odds') || getVal('boosted-odds') || 0,
      net,
      returnPct,
    });
    renderTable();
  });

  document.getElementById('log-tbody').addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    deleteEntry(btn.dataset.id);
    renderTable();
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!loadLog().length) return;
    if (confirm('Usunąć wszystkie zapisane promocje?')) { saveLog([]); renderTable(); }
  });

  renderTable();
  updateTips();
});
