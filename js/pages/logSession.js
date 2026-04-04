// js/pages/logSession.js

let logCurrentResult = '';

window.render_logSession = function() {
  const accountSelect = document.getElementById('log-account');
  const accounts = AppState.data.accounts;
  
  if (accounts.length === 0) {
    accountSelect.innerHTML = '<option value="">No accounts found</option>';
    return;
  }
  
  accountSelect.innerHTML = accounts.map(a => 
    `<option value="${a.account_id}">${a.account_name} — ${formatCurrency(a.current_balance)}</option>`
  ).join('');
  
  updateLogOpening();
};

document.getElementById('log-account').addEventListener('change', updateLogOpening);

function updateLogOpening() {
  const accId = document.getElementById('log-account').value;
  const acc = AppState.data.accounts.find(a => a.account_id === accId);
  if (acc) {
    document.getElementById('log-opening').value = acc.current_balance;
    calculateLogPreview();
  }
}

document.querySelectorAll('.rt-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.rt-btn').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    logCurrentResult = btn.getAttribute('data-val');
    calculateLogPreview();
  });
});

['log-opening', 'log-closing'].forEach(id => {
  document.getElementById(id).addEventListener('input', calculateLogPreview);
});

function calculateLogPreview() {
  const open = parseFloat(document.getElementById('log-opening').value) || 0;
  const clse = parseFloat(document.getElementById('log-closing').value);
  const previewBox = document.getElementById('log-preview');
  
  if (isNaN(clse)) {
    previewBox.style.display = 'none';
    return;
  }
  
  const pnl = clse - open;
  const targetPerAcc = getAccountDailyTarget();
  let msg = `P&L preview: <strong>${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}</strong> · Session target: ${formatCurrency(targetPerAcc)}`;
  
  if (pnl >= targetPerAcc) {
    msg += ` · <strong>Target hit!</strong>`;
  }
  
  previewBox.innerHTML = msg;
  previewBox.style.display = 'block';
  previewBox.style.background = pnl >= 0 ? '#f0fdf4' : '#fef2f2';
  previewBox.style.borderColor = pnl >= 0 ? '#bbf7d0' : '#fecaca';
  previewBox.style.color = pnl >= 0 ? '#166534' : '#991b1b';
  
  // auto select Win/Loss if user didn't manually click
  if (!logCurrentResult || document.querySelectorAll('.rt-btn.sel').length === 0) {
    const autoRes = pnl > 0 ? 'Win' : (pnl < 0 ? 'Loss' : 'Skip');
    logCurrentResult = autoRes;
    document.querySelectorAll('.rt-btn').forEach(b => b.classList.remove('sel'));
    document.querySelector(`.rt-btn[data-val="${autoRes}"]`).classList.add('sel');
  }
}

document.getElementById('form-log-session').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!logCurrentResult) {
    showToast("Please select a game result", true);
    return;
  }
  
  const open = parseFloat(document.getElementById('log-opening').value);
  const clse = parseFloat(document.getElementById('log-closing').value);
  
  const payload = {
    session_id: generateId(),
    date: getTodayString(),
    time: getTimeString(),
    account_id: document.getElementById('log-account').value,
    game: document.getElementById('log-game').value,
    opening_balance: open,
    closing_balance: clse,
    profit_loss: clse - open,
    result: logCurrentResult,
    duration_minutes: document.getElementById('log-duration').value,
    notes: document.getElementById('log-notes').value,
    logged_by: AppState.currentUser.username
  };
  
  showLoader(true, "Saving session...");
  try {
    await SheetsAPI.logSession(payload);
    
    // Optimistic update locally
    AppState.data.sessions.push(payload);
    const acc = AppState.data.accounts.find(a => a.account_id === payload.account_id);
    if(acc) acc.current_balance = clse;
    
    showToast("Session logged successfully!");
    
    // Reset form
    document.getElementById('form-log-session').reset();
    document.querySelectorAll('.rt-btn').forEach(b => b.classList.remove('sel'));
    logCurrentResult = '';
    document.getElementById('log-preview').style.display = 'none';
    
    // Go to dashboard
    switchTab('dashboard');
    evaluateGlobalBanners();
    
  } catch(err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
});
