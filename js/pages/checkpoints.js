// js/pages/checkpoints.js

window.render_checkpoints = function() {
  const cps = AppState.data.checkpoints;
  const totalBalance = getTotalBalance();
  const listEl = document.getElementById('checkpoints-list');
  
  let html = '';
  
  cps.forEach((cp, index) => {
    let statusBadge = '';
    const trigger = parseFloat(cp.trigger_balance);
    let isReached = cp.status === 'Reached';
    
    // Auto-compute Reached
    if (!isReached && totalBalance >= trigger) {
      isReached = true;
      cp.status = 'Reached';
      cp.reached_date = getTodayString();
      // Should fire off API call to save status, but we'll do it lazily or rely on global evaluate to just alert
      // To strictly follow, we update the status via API
      SheetsAPI.editCheckpoint(cp.checkpoint_id, { status: 'Reached' });
    }
    
    if (isReached) {
      statusBadge = `<span class="badge bg">Reached</span>`;
    } else {
      const away = trigger - totalBalance;
      statusBadge = `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="badge bw">${formatCurrency(away)} away</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-s" style="padding:3px 8px;font-size:10px;" onclick="editCp('${cp.checkpoint_id}')">Edit</button>
            <button class="btn btn-r" style="padding:3px 8px;font-size:10px;" onclick="deleteCp('${cp.checkpoint_id}')">Delete</button>
          </div>
        </div>
      `;
    }
    
    html += `
      <div class="cp-card">
        <div class="cp-icon" style="${isReached ? 'background:#dcfce7;color:#166534;' : ''}">${index + 1}</div>
        <div class="cp-info">
          <p class="cp-label">${cp.label}</p>
          <p class="cp-sub">Trigger: ${formatCurrency(trigger)} · Withdraw ${cp.withdraw_pct}% of profits</p>
        </div>
        ${statusBadge}
      </div>
    `;
  });
  
  if (cps.length === 0) {
    html = `<p class="text-gray" style="font-size:12px;">No checkpoints found. Add one above.</p>`;
  }
  
  listEl.innerHTML = html;
};

document.getElementById('form-checkpoint').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const idEl = document.getElementById('cp-id-edit');
  const editId = idEl.value;
  
  const payload = {
    label: document.getElementById('cp-label').value,
    trigger_balance: parseFloat(document.getElementById('cp-trigger').value),
    withdraw_pct: parseFloat(document.getElementById('cp-withdraw').value)
  };
  
  showLoader(true, "Saving checkpoint...");
  try {
    if (editId) {
      await SheetsAPI.editCheckpoint(editId, payload);
      const idx = AppState.data.checkpoints.findIndex(c => c.checkpoint_id === editId);
      if(idx > -1) {
        AppState.data.checkpoints[idx].label = payload.label;
        AppState.data.checkpoints[idx].trigger_balance = payload.trigger_balance;
        AppState.data.checkpoints[idx].withdraw_pct = payload.withdraw_pct;
      }
      showToast("Checkpoint updated");
    } else {
      payload.checkpoint_id = generateId();
      payload.status = 'Pending';
      await SheetsAPI.addCheckpoint(payload);
      AppState.data.checkpoints.push(payload);
      showToast("Checkpoint added");
    }
    
    cancelEditCp();
    render_checkpoints();
    evaluateGlobalBanners();
    
  } catch(err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
});

document.getElementById('cp-cancel-btn').addEventListener('click', cancelEditCp);

function cancelEditCp() {
  document.getElementById('form-checkpoint').reset();
  document.getElementById('cp-id-edit').value = '';
  document.getElementById('cp-form-title').textContent = 'Add new checkpoint';
  document.getElementById('cp-submit-btn').textContent = 'Add checkpoint';
  document.getElementById('cp-cancel-btn').classList.add('d-none');
}

window.editCp = function(id) {
  const cp = AppState.data.checkpoints.find(c => c.checkpoint_id === id);
  if(!cp) return;
  document.getElementById('cp-id-edit').value = cp.checkpoint_id;
  document.getElementById('cp-label').value = cp.label;
  document.getElementById('cp-trigger').value = cp.trigger_balance;
  document.getElementById('cp-withdraw').value = cp.withdraw_pct;
  
  document.getElementById('cp-form-title').textContent = 'Edit checkpoint';
  document.getElementById('cp-submit-btn').textContent = 'Save changes';
  document.getElementById('cp-cancel-btn').classList.remove('d-none');
  
  document.getElementById('page-checkpoints').scrollIntoView();
};

window.deleteCp = async function(id) {
  if(!confirm("Are you sure you want to delete this checkpoint?")) return;
  
  showLoader(true, "Deleting...");
  try {
    await SheetsAPI.deleteCheckpoint(id);
    AppState.data.checkpoints = AppState.data.checkpoints.filter(c => c.checkpoint_id !== id);
    showToast("Checkpoint deleted");
    render_checkpoints();
  } catch(err) {
    showToast(err.message, true);
  } finally {
    showLoader(false);
  }
};
