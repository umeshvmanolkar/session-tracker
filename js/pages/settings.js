// js/pages/settings.js

window.render_settings = function() {
  const { accounts } = AppState.data;
  
  // GAS Config
  document.getElementById('set-gas-url').value = SheetsAPI.getGasUrl() || '';
  
  // Bankroll Config
  document.getElementById('cfg-daily-target').value = getConfigVal('daily_target_per_account', 300);
  document.getElementById('cfg-sessions-day').value = getConfigVal('sessions_per_day', 8);
  document.getElementById('cfg-session-pct').value = getConfigVal('session_bankroll_pct', 20);
  document.getElementById('cfg-max-bet').value = getConfigVal('max_bet_pct', 5);
  
  // Accounts List
  let aHtml = '';
  accounts.forEach(a => {
    aHtml += `
      <div class="row">
        <span style="font-weight:500;">${a.account_name} (${formatCurrency(a.current_balance)})</span>
        <button class="btn btn-s" style="padding:3px 8px;font-size:10px;" onclick="renameAcc('${a.account_id}', '${a.account_name}')">Rename</button>
      </div>
    `;
  });
  if (accounts.length === 0) aHtml = '<p class="text-gray" style="font-size:12px;">No accounts</p>';
  document.getElementById('settings-acc-list').innerHTML = aHtml;
};

document.getElementById('form-gas-url').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = document.getElementById('set-gas-url').value.trim();
  SheetsAPI.setGasUrl(url);
  showToast("GAS API URL Saved!");
});

document.getElementById('form-config').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    'daily_target_per_account': parseFloat(document.getElementById('cfg-daily-target').value),
    'sessions_per_day': parseFloat(document.getElementById('cfg-sessions-day').value),
    'session_bankroll_pct': parseFloat(document.getElementById('cfg-session-pct').value),
    'max_bet_pct': parseFloat(document.getElementById('cfg-max-bet').value)
  };
  
  showLoader(true, "Saving config...");
  try {
    await SheetsAPI.saveConfig(payload);
    
    // Update local state
    Object.keys(payload).forEach(k => {
      let cfgItem = AppState.data.config.find(c => c.key === k);
      if (cfgItem) {
        cfgItem.value = payload[k];
      } else {
        AppState.data.config.push({ key: k, value: payload[k] });
      }
    });
    
    showToast("Config saved successfully!");
  } catch(err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
});

document.getElementById('form-add-acc').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('set-new-acc-name').value.trim();
  const bal = parseFloat(document.getElementById('set-new-acc-bal').value);
  
  if (!name || isNaN(bal)) return;
  
  const acc = {
    account_id: 'acc_' + generateId(),
    account_name: name,
    starting_balance: bal,
    current_balance: bal,
    phase: '1',
    created_at: getTodayString()
  };
  
  showLoader(true, "adding account...");
  try {
    await SheetsAPI.addAccount(acc);
    AppState.data.accounts.push(acc);
    showToast("Account added!");
    document.getElementById('form-add-acc').reset();
    render_settings();
    
    // Create initial fund txn for starting balance manually? Wireframe says no hardcoded, but starting balance is handled implicitly in total balance.
    // To match wireframe flows, usually starting balance does not trigger fund txn, it's just raw balance.
  } catch (err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
});

window.renameAcc = async function(id, oldName) {
  const newName = prompt(`Enter new name for ${oldName}:`, oldName);
  if (!newName || newName.trim() === '' || newName === oldName) return;
  
  showLoader(true, "Renaming account...");
  try {
    await SheetsAPI.renameAccount(id, newName.trim());
    const acc = AppState.data.accounts.find(a => a.account_id === id);
    if(acc) acc.account_name = newName.trim();
    showToast("Account renamed!");
    render_settings();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
};
