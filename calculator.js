'use strict';

// ─── DANE BUKMACHERÓW ────────────────────────────────────────────────────────

// freebetKeepsStake: true = wygrana z freebeta zawiera stawkę (SR), nawet gdy promocja jest SNR
const BOOKMAKERS = [
  { id: 'fortuna',   name: 'Fortuna',   tax: 0.12, margin: 0.09, freebetKeepsStake: true },
  { id: 'superbet',  name: 'Superbet',  tax: 0.12, margin: 0.09 },
  { id: 'sts',       name: 'STS',       tax: 0.12, margin: 0.09 },
  { id: 'etoto',     name: 'eToto',     tax: 0.12, margin: 0.09 },
  { id: 'lvbet',     name: 'LV BET',    tax: 0.12, margin: 0.09, freebetKeepsStake: true },
  { id: 'forbet',    name: 'Forbet',    tax: 0.12, margin: 0.09, freebetKeepsStake: true },
  { id: 'betfan',    name: 'BETFAN',    tax: 0.12, margin: 0.09 },
  { id: 'totalbet',  name: 'Totalbet',  tax: 0.12, margin: 0.09 },
  { id: 'comeon',    name: 'ComeOn',    tax: 0.12, margin: 0.09 },
  { id: 'betclic',   name: 'Betclic',   tax: 0.00, margin: 0.09 },
  { id: 'lebull',    name: 'LeBull',    tax: 0.12, margin: 0.09 },
  { id: 'admiral',   name: 'Admiral',   tax: 0.12, margin: 0.09 },
  { id: 'fuksiarz',  name: 'Fuksiarz',  tax: 0.12, margin: 0.09 },
  { id: 'betcris',   name: 'Betcris',   tax: 0.12, margin: 0.09 },
  { id: 'pzbuk',     name: 'PZBuk',     tax: 0.12, margin: 0.09 },
  { id: 'betters',   name: 'Betters',   tax: 0.12, margin: 0.09 },
  { id: 'traf',      name: 'Traf',      tax: 0.12, margin: 0.09 },
];

// ─── TYPY PROMOCJI ───────────────────────────────────────────────────────────

const PROMO_TYPES = [
  { id: 'freebet',       label: 'Freebet' },
  { id: 'cashback',      label: 'Cashback' },
  { id: 'boosted_odds',  label: 'Zwiększony kurs' },
  { id: 'deposit_bonus', label: 'Bonus za wpłatę' },
];

// ─── API KEY ─────────────────────────────────────────────────────────────────

const API_KEY_STORAGE = 'groq_api_key';
function getApiKey()     { return localStorage.getItem(API_KEY_STORAGE); }
function saveApiKey(key) { localStorage.setItem(API_KEY_STORAGE, key.trim()); }

// ─── MATH ────────────────────────────────────────────────────────────────────

// strata = S × [1 − (1-t) / (1+m)^N]
function calcQualifyingLoss(stake, tax, margin, events = 1) {
  return stake * (1 - (1 - tax) / Math.pow(1 + margin, events));
}

// SR:  EV = F × (1-t) / (1+m)^N
// SNR: EV = F × MF × [(1-t) − 1/B]
function calcFreebetEV(freebetType, freebet, backOdds, tax, margin, events = 1) {
  const mf = 1 / Math.pow(1 + margin, events);
  if (freebetType === 'sr')  return freebet * (1 - tax) * mf;
  if (freebetType === 'snr') return freebet * mf * ((1 - tax) - 1 / backOdds);
  return 0;
}

function calcRiskFreeEV(stake, backOdds, tax, margin, freebetKeepsStake = false) {
  const pWin      = 1 / (backOdds * (1 + margin));
  const winProfit = stake * (1 - tax) * backOdds - stake;
  const fbType    = freebetKeepsStake ? 'sr' : 'snr';
  const loseValue = calcFreebetEV(fbType, stake, backOdds, tax, margin) - stake;
  return pWin * winProfit + (1 - pWin) * loseValue;
}

function calcBoostedEV(stake, originalOdds, boostedOdds, tax, margin) {
  const pWin = 1 / (originalOdds * (1 + margin));
  return pWin * (stake * (1 - tax) * boostedOdds - stake) + (1 - pWin) * (-stake);
}

function calcDepositBonusEV(deposit, bonusPct, wagering, tax, margin) {
  const total    = deposit * (1 + bonusPct / 100);
  const keepRate = (1 - tax) / (1 + margin);
  return total * Math.pow(keepRate, wagering) - deposit;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function fmt(v)    { return v.toFixed(2) + ' PLN'; }
function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }
function esc(s)    { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ─── AI PARSE PROMPT ─────────────────────────────────────────────────────────

const PARSE_PROMPT = `Wyciągnij z poniższego regulaminu promocji bukmacherskiej dane i zwróć TYLKO JSON (bez komentarzy, bez markdown):
{
  "promoType": "freebet|cashback|boosted_odds|deposit_bonus lub null",
  "qualifying": {
    "stake": liczba lub null,
    "minOdds": liczba lub null,
    "isBetBuilder": true lub false,
    "minLegs": liczba lub null,
    "hasWagering": true lub false,
    "wageringMultiplier": liczba (1 jeśli brak)
  },
  "freebet": {
    "value": liczba lub null,
    "minOdds": liczba lub null,
    "isBetBuilder": true lub false,
    "minLegs": liczba lub null,
    "hasWagering": true lub false,
    "wageringMultiplier": liczba (1 jeśli niewymagany lub nieokreślony)
  },
  "boostedOdds": liczba lub null,
  "originalOdds": liczba lub null,
  "deposit": liczba lub null,
  "bonusPct": liczba lub null,
  "wagering": liczba lub null,
  "awardCondition": "always|win|lose lub null",
  "notes": "krótki komentarz o niejasnych warunkach lub null"
}
Zasady:
- Dla freebeta: qualifying = warunki kuponu kwalifikującego, freebet = warunki zagrania freebeta
- hasWagering=false i wageringMultiplier=1 gdy obrót niewymagany lub nieokreślony
- Zwróć TYLKO surowy JSON — zero dodatkowych słów, zero backtick-ów.`;

// ─── AI PARSING ──────────────────────────────────────────────────────────────

async function parseRegulaminWithAI(text) {
  const key = getApiKey();
  if (!key) throw new Error('Brak klucza API. Kliknij ⚙ Klucz API i wklej klucz Groq.');

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + key,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: PARSE_PROMPT + '\n\n---\n' + text }],
        max_tokens: 512,
        temperature: 0,
      }),
    });
  } catch {
    throw new Error('Błąd sieci. Sprawdź połączenie internetowe.');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || response.statusText;
    if (response.status === 401) throw new Error('Nieprawidłowy klucz API. Sprawdź klucz w ustawieniach.');
    if (response.status === 429) throw new Error('Przekroczono limit zapytań Groq API (14 400/dzień).');
    throw new Error(`Błąd API (${response.status}): ${msg}`);
  }

  const data = await response.json();
  const raw  = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI zwróciło nieprawidłowy format. Spróbuj jeszcze raz lub uprość regulamin.');
  }
}

// ─── EV COMPUTATION ──────────────────────────────────────────────────────────

function computeEV(parsed, bk) {
  const { tax, margin, freebetKeepsStake } = bk;
  const pt = parsed.promoType;

  if (pt === 'freebet') {
    const fb = parsed.freebet || {};
    const fv = fb.value;
    if (!fv) return null;

    const fbType = freebetKeepsStake ? 'sr' : 'snr';

    // qualifying params
    const q          = parsed.qualifying || {};
    const qualStake  = q.stake || fv;
    const isBBQual   = !!q.isBetBuilder;
    const numLegsQ   = q.minLegs || 1;
    const mQual      = isBBQual ? 0.13 : margin;
    const nEffQ      = isBBQual ? numLegsQ * 2 : numLegsQ;
    const qualLoss   = calcQualifyingLoss(qualStake, tax, mQual, nEffQ);

    // freebet params
    const isBBFB   = !!fb.isBetBuilder;
    const numLegsF = fb.minLegs || 1;
    const mFB      = isBBFB ? 0.13 : margin;
    const nEffF    = isBBFB ? numLegsF * 2 : numLegsF;
    const fbOdds   = fb.minOdds || 4.0;

    let freebetEV = calcFreebetEV(fbType, fv, fbOdds, tax, mFB, nEffF);

    // wagering: each additional round degrades EV by keepRate
    const wMult = fb.wageringMultiplier || 1;
    if (wMult > 1) {
      const keepRate = (1 - tax) / Math.pow(1 + mFB, nEffF);
      freebetEV = freebetEV * Math.pow(keepRate, wMult - 1);
    }

    // awardCondition weighting
    let evMultiplier = 1;
    if (parsed.awardCondition === 'win' || parsed.awardCondition === 'lose') {
      const refOdds = q.minOdds || 4.0;
      const pWin    = 1 / (Math.pow(1 + mQual, nEffQ) * refOdds);
      evMultiplier  = parsed.awardCondition === 'win' ? pWin : (1 - pWin);
    }

    const ev  = evMultiplier * freebetEV;
    const net = ev - qualLoss;

    return { ev, net, investment: qualStake };
  }

  if (pt === 'cashback') {
    const q        = parsed.qualifying || {};
    const stake    = q.stake;
    const backOdds = q.minOdds || 2.0;
    if (!stake) return null;
    const ev = calcRiskFreeEV(stake, backOdds, tax, margin, freebetKeepsStake);
    return { ev, net: ev, investment: stake };
  }

  if (pt === 'boosted_odds') {
    const q        = parsed.qualifying || {};
    const stake    = q.stake || 10;
    const origOdds = parsed.originalOdds || q.minOdds || 2.0;
    const boosted  = parsed.boostedOdds;
    if (!boosted) return null;
    const ev = calcBoostedEV(stake, origOdds, boosted, tax, margin);
    return { ev, net: ev, investment: stake };
  }

  if (pt === 'deposit_bonus') {
    const deposit  = parsed.deposit;
    const bonusPct = parsed.bonusPct;
    const wagering = parsed.wagering;
    if (!deposit || !bonusPct || !wagering) return null;
    const ev = calcDepositBonusEV(deposit, bonusPct, wagering, tax, margin);
    return { ev, net: ev, investment: deposit };
  }

  return null;
}

// ─── RENDER HELPERS ──────────────────────────────────────────────────────────

function row(label, val) {
  return `<li><span class="summary-key">${esc(label)}:</span><span class="summary-val">${esc(String(val))}</span></li>`;
}

function fmtWagering(hasWagering, multiplier) {
  if (!hasWagering) return 'nie';
  const m = multiplier || 1;
  return m <= 1 ? 'nie' : `${m}× kwota freebetu`;
}

function buildFreebetBlocks(parsed) {
  const q  = parsed.qualifying || {};
  const fb = parsed.freebet    || {};

  // Block A — kupon kwalifikujący
  let rowsA = '';
  if (q.stake != null) rowsA += row('Kwota do zagrania', fmt(q.stake));
  rowsA += row('Minimalny kurs', q.minOdds != null ? q.minOdds.toFixed(2) : 'brak');
  rowsA += row('Liczba zdarzeń (min)', q.minLegs != null ? q.minLegs : 'brak');
  rowsA += row('Betbuilder', q.isBetBuilder ? 'tak' : 'nie');
  rowsA += row('Wymaga obrotu', fmtWagering(q.hasWagering, q.wageringMultiplier));

  // Block B — freebet
  let rowsB = '';
  if (fb.value != null) rowsB += row('Wartość freebetu', fmt(fb.value));
  rowsB += row('Minimalny kurs', fb.minOdds != null ? fb.minOdds.toFixed(2) : 'brak');
  rowsB += row('Liczba zdarzeń (min)', fb.minLegs != null ? fb.minLegs : 'brak');
  rowsB += row('Betbuilder', fb.isBetBuilder ? 'tak' : 'nie');
  rowsB += row('Wymaga obrotu', fmtWagering(fb.hasWagering, fb.wageringMultiplier));

  return `
    <div class="promo-block">
      <div class="promo-block-title">Kupon kwalifikujący</div>
      <ul>${rowsA}</ul>
    </div>
    <div class="promo-block">
      <div class="promo-block-title">Freebet</div>
      <ul>${rowsB}</ul>
    </div>`;
}

function buildFlatList(parsed) {
  const items = [];
  const add   = (label, value) => { if (value != null) items.push({ label, value }); };

  const q = parsed.qualifying || {};
  if (q.stake)            add('Wymagana stawka',  fmt(q.stake));
  if (q.minOdds)          add('Minimalny kurs',   q.minOdds.toFixed(2));
  if (q.isBetBuilder)     add('Bet Builder',      'Tak');
  if (q.minLegs)          add('Min. zdarzeń',     q.minLegs);
  if (parsed.boostedOdds)  add('Kurs zboostowany', parsed.boostedOdds.toFixed(2));
  if (parsed.originalOdds) add('Kurs oryginalny',  parsed.originalOdds.toFixed(2));
  if (parsed.deposit)      add('Depozyt',          fmt(parsed.deposit));
  if (parsed.bonusPct)     add('Bonus',            parsed.bonusPct + '%');
  if (parsed.wagering)     add('Wymóg obrotu',     parsed.wagering + 'x');
  if (parsed.awardCondition) {
    const map = { always: 'zawsze', win: 'przy wygranej', lose: 'przy przegranej' };
    add('Warunek', map[parsed.awardCondition] ?? parsed.awardCondition);
  }

  return `<ul class="promo-flat-list">${
    items.map(i => row(i.label, i.value)).join('')
  }</ul>`;
}

// ─── APPLY PARSED DATA ───────────────────────────────────────────────────────

function buildPromoTypeLabel(parsed) {
  return PROMO_TYPES.find(p => p.id === parsed.promoType)?.label ?? 'Nieznany typ';
}

function buildPromoCondition(parsed) {
  if (parsed.promoType !== 'freebet') return '';
  const cond = parsed.awardCondition;
  if (cond === 'win')    return 'Przyznawany za wygraną';
  if (cond === 'lose')   return 'Przyznawany za przegraną';
  if (cond === 'always') return 'Za każdy zagrany kupon';
  return '';
}

function applyParsedData(parsed, bk) {
  const typeLabel = buildPromoTypeLabel(parsed);
  document.getElementById('promo-type-label').textContent = typeLabel;
  const condEl = document.getElementById('promo-condition-label');
  const cond = buildPromoCondition(parsed);
  condEl.textContent = cond;
  condEl.classList.toggle('hidden', !cond);

  const evResult    = computeEV(parsed, bk);
  const container   = document.getElementById('promo-details-container');
  const resultsCard = document.getElementById('results-card');

  const isFreebet = parsed.promoType === 'freebet';
  container.innerHTML = isFreebet
    ? buildFreebetBlocks(parsed)
    : buildFlatList(parsed);
  container.classList.toggle('two-col', isFreebet);

  const notesEl = document.getElementById('ai-notes');
  if (parsed.notes) {
    notesEl.textContent = '⚠ ' + parsed.notes;
    notesEl.classList.remove('hidden');
  } else {
    notesEl.classList.add('hidden');
  }

  const evEl      = document.getElementById('ev-result');
  const tooltipEl = document.getElementById('ev-tooltip-wrap');

  if (evResult) {
    const { net, investment } = evResult;
    const pct = investment ? (net / investment) * 100 : null;
    evEl.textContent = pct !== null ? fmtPct(pct) : fmt(net);
    evEl.className   = 'ev-value ' + (net >= 0 ? 'green' : 'red');

    if (pct !== null && tooltipEl) {
      const perZl = (1 + pct / 100).toFixed(2);
      tooltipEl.dataset.tooltip = pct >= 0
        ? `Statystycznie grając tę promocję zyskasz za 1 zł → ${perZl} zł`
        : `Statystycznie grając tę promocję stracisz za 1 zł → ${perZl} zł`;
    }
  } else {
    evEl.textContent = '?';
    evEl.className   = 'ev-value';
    if (tooltipEl) tooltipEl.dataset.tooltip = '';
  }

  document.getElementById('input-card').classList.add('hidden');
  resultsCard.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── HELPERS UI ──────────────────────────────────────────────────────────────

function setParseStatus(msg, isError = false) {
  const el = document.getElementById('parse-status');
  el.textContent = msg;
  el.className   = 'parse-status' + (isError ? ' parse-error' : '');
  if (msg) el.classList.remove('hidden');
  else     el.classList.add('hidden');
}

function checkParseBtnState() {
  const bk   = document.getElementById('bk-select').value;
  const text = document.getElementById('regulamin-input').value.trim();
  document.getElementById('parse-btn').disabled = !(bk && text);
}

// ─── INICJALIZACJA ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const bkSel = document.getElementById('bk-select');
  BOOKMAKERS.forEach(bk => {
    const opt  = document.createElement('option');
    opt.value  = bk.id;
    const tips = [];
    if (bk.tax === 0)          tips.push('bez podatku');
    if (bk.freebetKeepsStake)  tips.push('SR');
    opt.textContent = tips.length ? `${bk.name} (${tips.join(', ')})` : bk.name;
    bkSel.appendChild(opt);
  });

  const keyInput = document.getElementById('api-key-input');
  const saved    = getApiKey();
  if (saved) keyInput.value = saved;

  document.getElementById('api-key-btn').addEventListener('click', () => {
    document.getElementById('api-key-modal').classList.toggle('hidden');
  });

  document.getElementById('save-api-key').addEventListener('click', () => {
    const v = keyInput.value.trim();
    if (v) {
      saveApiKey(v);
      document.getElementById('api-key-modal').classList.add('hidden');
      setParseStatus('Klucz API zapisany.');
      setTimeout(() => setParseStatus(''), 2000);
    }
  });

  bkSel.addEventListener('change', checkParseBtnState);
  document.getElementById('regulamin-input').addEventListener('input', checkParseBtnState);

  document.getElementById('parse-btn').addEventListener('click', async () => {
    const bk   = BOOKMAKERS.find(b => b.id === bkSel.value);
    const text = document.getElementById('regulamin-input').value.trim();
    if (!bk || !text) return;

    const btn = document.getElementById('parse-btn');
    btn.disabled = true;
    setParseStatus('⏳ Analizuję regulamin...');
    document.getElementById('results-card').classList.add('hidden');

    try {
      const parsed = await parseRegulaminWithAI(text);
      applyParsedData(parsed, bk);
      setParseStatus('');
    } catch (err) {
      setParseStatus(err.message, true);
    } finally {
      btn.disabled = false;
      checkParseBtnState();
    }
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('results-card').classList.add('hidden');
    document.getElementById('input-card').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
