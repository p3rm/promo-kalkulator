'use strict';

// ─── MATH ENGINE ────────────────────────────────────────────────────────────

function calcEV(type, freebet, backOdds) {
  if (type === 'SNR') return (1 - 1 / backOdds) * freebet;
  return freebet; // SR — przy kursach fair EV = 100%
}

function calcLayStake(type, freebet, backOdds, layOdds, commission) {
  const c = commission / 100;
  if (type === 'SNR') return (freebet * (backOdds - 1)) / (layOdds - c);
  return (freebet * backOdds) / (layOdds - c);
}

function calcGuaranteedProfit(type, freebet, backOdds, layOdds, commission) {
  const c = commission / 100;
  const layStake = calcLayStake(type, freebet, backOdds, layOdds, commission);
  return layStake * (1 - c);
}

// ─── FORMATOWANIE ───────────────────────────────────────────────────────────

function fmt(value) {
  return value.toFixed(2) + ' PLN';
}

function fmtPct(value) {
  return value.toFixed(1) + '%';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'promo_log_v1';

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLog(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage niedostępny — cicha degradacja
  }
}

function addEntry(entry) {
  const entries = loadLog();
  entries.push(entry);
  saveLog(entries);
}

function deleteEntry(id) {
  const entries = loadLog().filter(e => e.id !== id);
  saveLog(entries);
}

// ─── RENDER TABELI ───────────────────────────────────────────────────────────

function renderTable() {
  const entries = loadLog();
  const empty = document.getElementById('log-empty');
  const wrap = document.getElementById('log-table-wrap');
  const tbody = document.getElementById('log-tbody');
  const tfoot = document.getElementById('log-tfoot');

  if (entries.length === 0) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  tbody.innerHTML = entries.map(e => `
    <tr>
      <td>${esc(e.bookmaker || '—')}</td>
      <td class="td-muted">${e.date}</td>
      <td>${e.type}</td>
      <td>${fmt(e.freebet)}</td>
      <td>${e.backOdds.toFixed(2)}</td>
      <td class="td-green">${fmt(e.ev)}</td>
      <td class="td-green">${fmtPct(e.conversion)}</td>
      <td>${e.guaranteedProfit != null ? `<span class="td-green">${fmt(e.guaranteedProfit)}</span>` : '<span class="td-muted">—</span>'}</td>
      <td><button class="btn-delete" data-id="${e.id}" title="Usuń">×</button></td>
    </tr>
  `).join('');

  const totalEV = entries.reduce((s, e) => s + e.ev, 0);
  const totalGuaranteed = entries.filter(e => e.guaranteedProfit != null).reduce((s, e) => s + e.guaranteedProfit, 0);
  const hasGuaranteed = entries.some(e => e.guaranteedProfit != null);

  tfoot.innerHTML = `
    <tr>
      <td colspan="5">Suma (${entries.length} ${entries.length === 1 ? 'promocja' : entries.length < 5 ? 'promocje' : 'promocji'})</td>
      <td class="td-green">${fmt(totalEV)}</td>
      <td></td>
      <td>${hasGuaranteed ? `<span class="td-green">${fmt(totalGuaranteed)}</span>` : ''}</td>
      <td></td>
    </tr>
  `;
}

function esc(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ─── AKTUALIZACJA WYNIKÓW ────────────────────────────────────────────────────

function updateResults() {
  const freebetVal = parseFloat(document.getElementById('freebet-value').value);
  const backOdds   = parseFloat(document.getElementById('back-odds').value);
  const layOddsVal = parseFloat(document.getElementById('lay-odds').value);
  const commission = parseFloat(document.getElementById('commission').value) || 5;
  const type       = document.getElementById('freebet-type').value;

  const resEV     = document.getElementById('res-ev');
  const resConv   = document.getElementById('res-conv');
  const layBlock  = document.getElementById('lay-results');
  const resLay    = document.getElementById('res-lay');
  const resProfit = document.getElementById('res-profit');
  const errorMsg  = document.getElementById('error-msg');

  errorMsg.classList.add('hidden');
  errorMsg.textContent = '';

  // Walidacja podstawowa
  if (!freebetVal || !backOdds) {
    resEV.textContent = '—';
    resConv.textContent = '—';
    layBlock.classList.add('hidden');
    return;
  }

  if (backOdds < 1.01) {
    showError('Kurs bukmachera musi być co najmniej 1.01.');
    return;
  }

  const ev = calcEV(type, freebetVal, backOdds);
  const conv = (ev / freebetVal) * 100;

  resEV.textContent = fmt(ev);
  resConv.textContent = fmtPct(conv);

  // Sekcja lay
  if (layOddsVal && !isNaN(layOddsVal)) {
    if (layOddsVal < backOdds) {
      showError('Kurs lay na giełdzie powinien być ≥ kursowi bukmachera.');
      layBlock.classList.add('hidden');
      return;
    }

    const layStake = calcLayStake(type, freebetVal, backOdds, layOddsVal, commission);
    const profit   = calcGuaranteedProfit(type, freebetVal, backOdds, layOddsVal, commission);

    resLay.textContent    = fmt(layStake);
    resProfit.textContent = fmt(profit);
    layBlock.classList.remove('hidden');
  } else {
    layBlock.classList.add('hidden');
  }
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Podgląd na żywo
  ['freebet-value', 'back-odds', 'lay-odds', 'commission'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateResults);
  });

  // Toggle SNR / SR
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('freebet-type').value = btn.dataset.type;
      updateResults();
    });
  });

  // Zapisz do tabeli
  document.getElementById('btn-save').addEventListener('click', () => {
    const freebetVal = parseFloat(document.getElementById('freebet-value').value);
    const backOdds   = parseFloat(document.getElementById('back-odds').value);
    const layOddsVal = parseFloat(document.getElementById('lay-odds').value);
    const commission = parseFloat(document.getElementById('commission').value) || 5;
    const type       = document.getElementById('freebet-type').value;
    const bookmaker  = document.getElementById('bookmaker-name').value.trim();

    if (!freebetVal || !backOdds || backOdds < 1.01) {
      showError('Uzupełnij wartość freebeta i kurs przed zapisem.');
      return;
    }

    const ev = calcEV(type, freebetVal, backOdds);
    const conv = (ev / freebetVal) * 100;

    let guaranteedProfit = null;
    if (layOddsVal && !isNaN(layOddsVal) && layOddsVal >= backOdds) {
      guaranteedProfit = calcGuaranteedProfit(type, freebetVal, backOdds, layOddsVal, commission);
    }

    addEntry({
      id: uid(),
      bookmaker,
      date: todayISO(),
      type,
      freebet: freebetVal,
      backOdds,
      layOdds: layOddsVal || null,
      commission,
      ev,
      conversion: conv,
      guaranteedProfit,
    });

    renderTable();
  });

  // Usuń wiersz (event delegation)
  document.getElementById('log-tbody').addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    deleteEntry(btn.dataset.id);
    renderTable();
  });

  // Wyczyść wszystko
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (loadLog().length === 0) return;
    if (confirm('Usunąć wszystkie zapisane promocje?')) {
      saveLog([]);
      renderTable();
    }
  });

  // Inicjalne renderowanie tabeli
  renderTable();
});
