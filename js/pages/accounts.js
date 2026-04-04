// js/pages/accounts.js

window.render_accounts = function() {
  const { accounts, sessions } = AppState.data;
  
  const bankrollPct = getConfigVal('session_bankroll_pct', 20) / 100;
  const maxBetPct = getConfigVal('max_bet_pct', 5) / 100;
  const targetPerAcc = getAccountDailyTarget();
  const todayStr = getTodayString();
  const todaySessions = sessions.filter(s => s.date === todayStr);
  
  const accountsGrid = document.getElementById('accounts-grid');
  let html = '';
  
  accounts.forEach(acc => {
    // Math
    const bal = parseFloat(acc.current_balance || 0);
    const sessionBankroll = bal * bankrollPct;
    const maxBet = sessionBankroll * maxBetPct;
    
    // Stats for today
    const accSessions = todaySessions.filter(s => s.account_id === acc.account_id);
    const pnl = accSessions.reduce((sum, s) => sum + parseFloat(s.profit_loss || 0), 0);
    const losses = accSessions.filter(s => s.result === 'Loss').length;
    
    // Status Logic
    let statusText = 'active';
    let statusClass = 'bb';
    if (pnl >= targetPerAcc) {
      statusText = 'done';
      statusClass = 'bg';
    } else if (losses >= 2) {
      statusText = 'resting';
      statusClass = 'bgr';
    } else {
       const left = targetPerAcc - pnl;
       if (left > 0 && left < targetPerAcc) {
         statusText = formatCurrency(left) + ' left';
         statusClass = 'bw';
       }
    }
    
    // Last 3 sessions overall
    const last3 = sessions.filter(s => s.account_id === acc.account_id)
                          .sort((a,b) => b._rowIndex - a._rowIndex)
                          .slice(0, 3);
    
    let last3Html = '';
    const badgeMap = { 'Win': 'bg', 'Loss': 'br', 'Skip': 'bgr' };
    last3.forEach(s => {
      const isSkip = s.result === 'Skip';
      const pnlPrefix = parseFloat(s.profit_loss) >= 0 ? '+' : '';
      const t = isSkip ? s.result.toLowerCase() : pnlPrefix + formatCurrency(s.profit_loss);
      last3Html += `<span class="badge ${badgeMap[s.result]}">${t}</span>`;
    });
    if (last3.length === 0) last3Html = '<span class="text-gray" style="font-size:10px;">No sessions</span>';

    html += `
      <div class="acc-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div><p class="acc-name">${acc.account_name}</p><p class="acc-bal">${formatCurrency(bal)}</p></div>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
        <div class="divider"></div>
        <div class="acc-row2"><span>Session bankroll</span><span style="font-weight:500;color:#111;">${formatCurrency(sessionBankroll)}</span></div>
        <div class="acc-row2"><span>Max bet</span><span style="font-weight:500;color:#111;">${formatCurrency(maxBet)}</span></div>
        <div class="acc-row2"><span>Session target</span><span style="font-weight:500;color:#111;">${formatCurrency(targetPerAcc)}</span></div>
        <div class="acc-row2"><span>Today's P&L</span><span style="font-weight:500;color:${pnl >= 0 ? '#166534' : '#999'};">${pnl > 0 ? '+' : ''}${pnl !== 0 ? formatCurrency(pnl) : '₹0'}</span></div>
        <div class="divider"></div>
        <p style="font-size:9px;color:#aaa;margin-bottom:4px;">Last 3 sessions</p>
        <div style="display:flex;gap:4px;">${last3Html}</div>
      </div>
    `;
  });
  
  if (accounts.length === 0) {
    accountsGrid.innerHTML = '<p class="text-gray">No accounts found.</p>';
  } else {
    accountsGrid.innerHTML = html;
  }
};
