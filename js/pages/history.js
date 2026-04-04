// js/pages/history.js

let historyChartObj = null;

window.render_history = function() {
  const { sessions, accounts } = AppState.data;
  const accFilter = document.getElementById('hist-filter-acc');
  
  // Populate filter only once if empty (except the ALL option)
  if (accFilter.options.length <= 1) {
    let optHtml = `<option value="ALL">All accounts</option>`;
    accounts.forEach(a => {
      optHtml += `<option value="${a.account_id}">${a.account_name}</option>`;
    });
    accFilter.innerHTML = optHtml;
  }
  
  const fVal = accFilter.value;
  let dispSess = sessions;
  if(fVal !== 'ALL') {
    dispSess = sessions.filter(s => s.account_id === fVal);
  }
  
  // Stats
  const wins = dispSess.filter(s => s.result === 'Win').length;
  const winR = dispSess.length > 0 ? Math.round((wins / dispSess.length) * 100) : 0;
  const overallPnL = dispSess.reduce((s, x) => s + parseFloat(x.profit_loss || 0), 0);
  
  // Best day logic
  const dailySums = {};
  dispSess.forEach(s => {
    if(!dailySums[s.date]) dailySums[s.date] = 0;
    dailySums[s.date] += parseFloat(s.profit_loss || 0);
  });
  const bestDayVal = Object.values(dailySums).length > 0 ? Math.max(...Object.values(dailySums)) : 0;
  
  document.getElementById('hist-stats').innerHTML = `
    <div class="sc"><p class="sl">Total sessions</p><p class="sv">${dispSess.length}</p></div>
    <div class="sc"><p class="sl">Win rate</p><p class="sv">${winR}%</p></div>
    <div class="sc"><p class="sl">Overall P&L</p><p class="sv" style="color:${overallPnL >= 0 ? '#166534' : '#991b1b'};">${overallPnL > 0 ? '+' : ''}${formatCurrency(overallPnL)}</p></div>
    <div class="sc"><p class="sl">Best day</p><p class="sv" style="color:#166534;">+${formatCurrency(Math.max(0, bestDayVal))}</p></div>
  `;
  
  // List
  const hist = [...dispSess].sort((a,b) => b._rowIndex - a._rowIndex);
  let hHtml = '';
  hist.forEach(s => {
    const accName = accounts.find(a => a.account_id === s.account_id)?.account_name || 'Unknown';
    const cColor = s.profit_loss >= 0 ? '#166534' : '#991b1b';
    const cPrefix = s.profit_loss >= 0 ? '+' : '';
    
    hHtml += `
      <div class="hist-row">
        <span>${s.date.substring(0,5)}</span>
        <span style="color:#aaa;">${s.time}</span>
        <span>${accName} · ${s.game}</span>
        <span>${formatCurrency(s.opening_balance)}</span>
        <span>${formatCurrency(s.closing_balance)}</span>
        <span style="color:${cColor};font-weight:500;">${cPrefix}${formatCurrency(s.profit_loss)}</span>
      </div>
    `;
  });
  if (hist.length === 0) hHtml = '<p class="text-gray" style="font-size:12px;">No sessions found.</p>';
  document.getElementById('hist-table-list').innerHTML = hHtml;
  
  // Chart rendering (last 14 days)
  renderChart(dailySums);
};

document.getElementById('hist-filter-acc').addEventListener('change', () => {
  window.render_history();
});

function renderChart(dailySums) {
  // Generate last 14 days labels
  const labels = [];
  const data = [];
  const bgColors = [];
  
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    const displayLabel = `${d.getDate()}/${d.getMonth()+1}`;
    
    const val = dailySums[dateStr] || 0;
    
    labels.push(displayLabel);
    data.push(val);
    bgColors.push(val >= 0 ? '#bbf7d0' : '#fecaca'); // green / red
  }
  
  const ctx = document.getElementById('hist-chart').getContext('2d');
  if (historyChartObj) {
    historyChartObj.destroy();
  }
  
  historyChartObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily P&L',
        data: data,
        backgroundColor: bgColors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { 
          grid: { color: '#f3f4f6' },
          ticks: { callback: (value) => '₹' + value }
        }
      }
    }
  });
}
