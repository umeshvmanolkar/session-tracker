// js/pages/dashboard.js

window.render_dashboard = function() {
  const { accounts, sessions, checkpoints } = AppState.data;
  const todayStr = getTodayString();
  const targetPerAcc = getAccountDailyTarget();
  
  // 1. Calculate Stats
  const totalBalance = getTotalBalance();
  
  const todaySessions = sessions.filter(s => s.date === todayStr);
  const todayPnL = todaySessions.reduce((sum, s) => sum + parseFloat(s.profit_loss || 0), 0);
  
  const wins = todaySessions.filter(s => s.result === 'Win').length;
  const winRate = todaySessions.length > 0 ? Math.round((wins / todaySessions.length) * 100) : 0;
  
  // Withdrawn comes from Checkpoints reached amount_withdrawn OR fund_transactions type='withdrawal'
  // But let's use checkpints reached as per wireframe: "1 checkpoint hit"
  const reachedCp = checkpoints.filter(cp => cp.status === 'Reached');
  const totalWithdrawn = reachedCp.reduce((sum, cp) => sum + parseFloat(cp.amount_withdrawn || 0), 0);

  document.getElementById('dash-stats').innerHTML = `
    <div class="sc"><p class="sl">Total balance</p><p class="sv">${formatCurrency(totalBalance)}</p><p class="ss">${accounts.length} accounts</p></div>
    <div class="sc"><p class="sl">Today's P&L</p><p class="sv" style="color:${todayPnL >= 0 ? '#166534' : '#991b1b'};">${todayPnL >= 0 ? '+' : ''}${formatCurrency(todayPnL)}</p><p class="ss">${todaySessions.length} sessions</p></div>
    <div class="sc"><p class="sl">Sessions won</p><p class="sv">${wins} / ${todaySessions.length}</p><p class="ss">${winRate}% win rate</p></div>
    <div class="sc"><p class="sl">Total withdrawn</p><p class="sv">${formatCurrency(totalWithdrawn)}</p><p class="ss">${reachedCp.length} checkpoint hit</p></div>
  `;

  // 2. Account Status Table & Progress Bar
  let htmlTable = '';
  let htmlProgress = '';
  let totalProgSum = 0;
  let totalProgTarget = targetPerAcc * accounts.length;

  accounts.forEach(acc => {
    const accSessions = todaySessions.filter(s => s.account_id === acc.account_id);
    const accPnl = accSessions.reduce((sum, s) => sum + parseFloat(s.profit_loss || 0), 0);
    const losses = accSessions.filter(s => s.result === 'Loss').length;
    
    // Status Logic
    let statusText = 'Active';
    let statusClass = 'bb'; // blue active
    
    if (accPnl >= targetPerAcc) {
      statusText = 'Done';
      statusClass = 'bg'; // green done
    } else if (losses >= 2) {
      statusText = 'Resting';
      statusClass = 'bgr'; // gray resting
    } else {
       // Check if left amount
       const left = targetPerAcc - accPnl;
       if (left > 0 && left < targetPerAcc) {
         statusText = formatCurrency(left) + ' left';
         statusClass = 'bw'; // yellow
       }
    }

    htmlTable += `
      <div class="row" style="padding:8px 0; border-bottom:0.5px solid #f3f4f6;">
        <span style="font-weight:500;">${acc.account_name}</span>
        <span>${formatCurrency(acc.current_balance)}</span>
        <span style="color:${accPnl >= 0 ? '#166534' : '#991b1b'};">${accPnl >= 0 ? '+' : ''}${formatCurrency(accPnl)}</span>
        <span>${formatCurrency(targetPerAcc)}</span>
        <span><span class="badge ${statusClass}">${statusText.toLowerCase()}</span></span>
      </div>
    `;

    // Progress
    let pct = Math.min(100, Math.max(0, (accPnl / targetPerAcc) * 100));
    htmlProgress += `
      <div class="pr">
        <span class="pt2">${acc.account_name}</span>
        <div class="ptrack"><div class="pfill" style="width:${pct}%;background:${pct === 100 ? '#16a34a' : '#1e40af'};"></div></div>
        <span class="pv">${pct === 100 ? 'done' : Math.round(pct)+'%'}</span>
      </div>
    `;
    
    totalProgSum += Math.max(0, accPnl); // Only positive PnL counts to combined progress visually? Sure
  });

  document.getElementById('dash-table-acc').innerHTML = htmlTable;
  
  htmlProgress += `
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;">
      <span style="color:#999;">Combined</span>
      <span style="font-weight:500;color:#166534;">${formatCurrency(totalProgSum)} / ${formatCurrency(totalProgTarget)}</span>
    </div>
  `;
  document.getElementById('dash-progress').innerHTML = htmlProgress;

  // 3. Recent Sessions (last 5 overall)
  const recent = [...sessions].sort((a,b) => b._rowIndex - a._rowIndex).slice(0,5);
  let htmlRecent = '';
  recent.forEach(s => {
    const accInfo = accounts.find(a => a.account_id === s.account_id);
    const accName = accInfo ? accInfo.account_name : 'Unknown';
    const badgeMap = { 'Win': 'bg', 'Loss': 'br', 'Skip': 'bgr' };
    const bColor = s.profit_loss >= 0 ? '#166534' : '#991b1b';
    const pnlPrefix = s.profit_loss >= 0 ? '+' : '';
    
    htmlRecent += `
      <div class="row">
        <span style="color:#666;">${accName} · ${s.game}</span>
        <span><span class="badge ${badgeMap[s.result]}">${s.result.toLowerCase()}</span></span>
        <span style="color:${bColor};font-weight:500;">${pnlPrefix}${formatCurrency(s.profit_loss)}</span>
      </div>
    `;
  });
  if(recent.length === 0) htmlRecent = '<p class="text-gray" style="font-size:12px;">No sessions logged yet.</p>';
  document.getElementById('dash-recent-sessions').innerHTML = htmlRecent;
};
