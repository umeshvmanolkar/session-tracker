// js/pages/fundManager.js

window.render_fundManager = function() {
  const fTxns = AppState.data.fund_transactions;
  
  // Calculate Stats
  const totalDep = fTxns.filter(t => t.type === 'deposit').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalWith = fTxns.filter(t => t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount), 0);
  const netInvested = totalDep - totalWith;
  
  document.getElementById('fund-stats').innerHTML = `
    <div class="sc"><p class="sl">Total deposited</p><p class="sv">${formatCurrency(totalDep)}</p></div>
    <div class="sc"><p class="sl">Total withdrawn</p><p class="sv">${formatCurrency(totalWith)}</p></div>
    <div class="sc"><p class="sl">Net invested</p><p class="sv">${formatCurrency(netInvested)}</p></div>
  `;
  
  // Populate dropdowns
  const accs = AppState.data.accounts;
  let optHtml = `<option value="ALL">Split equally — all ${accs.length}</option>`;
  accs.forEach(a => {
    optHtml += `<option value="${a.account_id}">${a.account_name} (${formatCurrency(a.current_balance)})</option>`;
  });
  
  const depAcc = document.getElementById('dep-account');
  const withAcc = document.getElementById('with-account');
  // retain current selections if possible
  const dVal = depAcc.value;
  const wVal = withAcc.value;
  depAcc.innerHTML = optHtml;
  withAcc.innerHTML = optHtml;
  if (dVal && [...depAcc.options].some(o => o.value === dVal)) depAcc.value = dVal;
  if (wVal && [...withAcc.options].some(o => o.value === wVal)) withAcc.value = wVal;
  
  // Render History
  const hist = [...fTxns].sort((a,b) => b._rowIndex - a._rowIndex);
  let hHtml = '';
  hist.forEach(t => {
    const badgeMap = {'deposit':'bb', 'withdrawal':'bo'};
    const prefix = t.type === 'deposit' ? '+' : '−';
    const accName = t.account_id === 'ALL' ? 'Split equally (ALL)' : (accs.find(a => a.account_id === t.account_id)?.account_name || t.account_id);
    
    hHtml += `
      <div class="txn-row">
        <span>${t.date.substring(0,5)}</span>
        <span><span class="badge ${badgeMap[t.type]}">${t.type}</span></span>
        <span style="color:#666;">${accName}<br><span style="font-size:10px;color:#aaa;">${t.notes||''}</span></span>
        <span style="font-weight:500;">${prefix}${formatCurrency(t.amount)}</span>
        <span style="color:#999;">${formatCurrency(t.balance_after)}</span>
      </div>
    `;
  });
  if (hist.length === 0) hHtml = '<p class="text-gray" style="font-size:12px;">No transactions found.</p>';
  document.getElementById('fund-history-list').innerHTML = hHtml;
  
  updateDepPreview();
  updateWithPreview();
};

document.querySelectorAll('#fund-tabs .seg-o').forEach(el => {
  el.addEventListener('click', (e) => {
    document.querySelectorAll('#fund-tabs .seg-o').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
    const t = el.getAttribute('data-tab');
    document.getElementById('fund-deposit-view').classList.add('d-none');
    document.getElementById('fund-withdrawal-view').classList.add('d-none');
    document.getElementById('fund-history-view').classList.add('d-none');
    document.getElementById(`fund-${t}-view`).classList.remove('d-none');
  });
});

document.getElementById('dep-amount').addEventListener('input', updateDepPreview);
document.getElementById('dep-account').addEventListener('change', updateDepPreview);

function updateDepPreview() {
  const amt = parseFloat(document.getElementById('dep-amount').value);
  const acc = document.getElementById('dep-account').value;
  const p = document.getElementById('dep-preview');
  
  if (isNaN(amt) || amt <= 0) {
    p.style.display = 'none';
    return;
  }
  
  if (acc === 'ALL') {
    const count = AppState.data.accounts.length;
    const split = amt / count;
    p.innerHTML = `Each account will receive <strong>+${formatCurrency(split)}</strong> · New balances recalculated automatically`;
  } else {
    p.innerHTML = `Account will receive <strong>+${formatCurrency(amt)}</strong>`;
  }
  p.style.display = 'block';
}

document.getElementById('with-amount').addEventListener('input', updateWithPreview);
document.getElementById('with-account').addEventListener('change', updateWithPreview);

function updateWithPreview() {
  const amt = parseFloat(document.getElementById('with-amount').value);
  const acc = document.getElementById('with-account').value;
  const p = document.getElementById('with-preview');
  
  if (isNaN(amt) || amt <= 0) {
    p.style.display = 'none';
    return;
  }
  
  if (acc === 'ALL') {
    const count = AppState.data.accounts.length;
    const split = amt / count;
    p.innerHTML = `Each account will deduct <strong>-${formatCurrency(split)}</strong>`;
  } else {
    p.innerHTML = `Account will deduct <strong>-${formatCurrency(amt)}</strong>`;
  }
  p.style.display = 'block';
}

async function handleFundTxn(type) {
  const prefix = type === 'deposit' ? 'dep' : 'with';
  const amt = parseFloat(document.getElementById(`${prefix}-amount`).value);
  const accId = document.getElementById(`${prefix}-account`).value;
  const notes = document.getElementById(`${prefix}-notes`).value;
  
  if (isNaN(amt) || amt <= 0) {
    showToast("Invalid amount", true);
    return;
  }
  
  const isAll = (accId === 'ALL');
  const splitAmt = isAll ? (amt / AppState.data.accounts.length) : amt;
  const multiplier = type === 'deposit' ? 1 : -1;
  const actualFlow = splitAmt * multiplier;
  
  const updatedAccounts = [];
  let totalBalBefore = getTotalBalance();
  
  if (isAll) {
    AppState.data.accounts.forEach(a => {
      let nb = parseFloat(a.current_balance) + actualFlow;
      updatedAccounts.push({ account_id: a.account_id, new_balance: nb });
      // Optimistic
      a.current_balance = nb;
    });
  } else {
    const a = AppState.data.accounts.find(x => x.account_id === accId);
    let nb = parseFloat(a.current_balance) + actualFlow;
    updatedAccounts.push({ account_id: accId, new_balance: nb });
    // Optimistic
    a.current_balance = nb;
  }
  
  const txn = {
    txn_id: generateId(),
    date: getTodayString(),
    time: getTimeString(),
    type: type,
    amount: amt,
    account_id: accId,
    balance_before: totalBalBefore,
    balance_after: totalBalBefore + (amt * multiplier),
    notes: notes
  };
  
  showLoader(true, `Processing ${type}...`);
  try {
    await SheetsAPI.addFundTransaction(txn, updatedAccounts);
    AppState.data.fund_transactions.push(txn);
    showToast(`${type} successful!`);
    
    document.getElementById(`form-${type === 'deposit' ? 'deposit' : 'withdraw'}`).reset();
    document.getElementById(`${prefix}-preview`).style.display = 'none';
    
    // Refresh views that depend on accounts balance
    if (window.render_fundManager) render_fundManager();
    evaluateGlobalBanners();
    
  } catch(err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
}

document.getElementById('form-deposit').addEventListener('submit', (e) => {
  e.preventDefault();
  handleFundTxn('deposit');
});

document.getElementById('form-withdraw').addEventListener('submit', (e) => {
  e.preventDefault();
  handleFundTxn('withdrawal');
});
