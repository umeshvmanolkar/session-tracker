function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    switch(action) {
      case 'login': 
        result = handleLogin(data); 
        break;
      case 'sync': 
        result = handleSync(data); 
        break;
      case 'logSession': 
        result = handleLogSession(data); 
        break;
      case 'addFundTransaction': 
        result = handleAddFundTransaction(data); 
        break;
      case 'addCheckpoint': 
        result = handleAddCheckpoint(data); 
        break;
      case 'deleteCheckpoint': 
        result = handleDeleteCheckpoint(data); 
        break;
      case 'editCheckpoint': 
        result = handleEditCheckpoint(data); 
        break;
      case 'saveConfig': 
        result = handleSaveConfig(data); 
        break;
      case 'addAccount': 
        result = handleAddAccount(data); 
        break;
      case 'renameAccount': 
        result = handleRenameAccount(data); 
        break;
      default: 
        throw new Error("Unknown action: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({success: true, data: result}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    // inject row index so we can update it later
    obj._rowIndex = i + 1;
    rows.push(obj);
  }
  return rows;
}

function handleLogin(data) {
  const users = getSheetData('Users');
  const user = users.find(u => u.username === data.username && u.password_hash === data.password_hash);
  if (!user) throw new Error("Invalid credentials");
  return {
    username: user.username,
    display_name: user.display_name
  };
}

function handleSync(data) {
  // optionally verify user token/hash here
  return {
    accounts: getSheetData('Accounts'),
    sessions: getSheetData('Sessions'),
    fund_transactions: getSheetData('Fund Transactions'),
    checkpoints: getSheetData('Checkpoints'),
    config: getSheetData('Config')
  };
}

function handleLogSession(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  const session = data.session;
  
  sheet.appendRow([
    session.session_id,
    session.date,
    session.time,
    session.account_id,
    session.game,
    session.opening_balance,
    session.closing_balance,
    session.profit_loss,
    session.result,
    session.duration_minutes,
    session.notes,
    session.logged_by
  ]);
  
  // Update Accounts table current_balance
  updateAccountBalance(session.account_id, session.closing_balance);
  return { completed: true };
}

function updateAccountBalance(accountId, newBalance) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const accIdIdx = headers.indexOf('account_id');
  const curBalIdx = headers.indexOf('current_balance');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][accIdIdx] === accountId) {
      sheet.getRange(i + 1, curBalIdx + 1).setValue(newBalance);
      break;
    }
  }
}

function handleAddFundTransaction(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fund Transactions');
  const tx = data.transaction;
  sheet.appendRow([
    tx.txn_id,
    tx.date,
    tx.time,
    tx.type,
    tx.amount,
    tx.account_id,
    tx.balance_before,
    tx.balance_after,
    tx.notes
  ]);
  
  // Update balances for specific or all accounts
  if (data.updatedAccounts && data.updatedAccounts.length > 0) {
    const accSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
    const accData = accSheet.getDataRange().getValues();
    const headers = accData[0];
    const accIdIdx = headers.indexOf('account_id');
    const curBalIdx = headers.indexOf('current_balance');
    
    for (let u = 0; u < data.updatedAccounts.length; u++) {
      const uAcc = data.updatedAccounts[u];
      for (let i = 1; i < accData.length; i++) {
        if (accData[i][accIdIdx] === uAcc.account_id) {
          accSheet.getRange(i + 1, curBalIdx + 1).setValue(uAcc.new_balance);
          break;
        }
      }
    }
  }
  return { completed: true };
}

function handleAddCheckpoint(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Checkpoints');
  const cp = data.checkpoint;
  sheet.appendRow([
    cp.checkpoint_id,
    cp.label,
    cp.trigger_balance,
    cp.withdraw_pct,
    cp.status,
    cp.reached_date || '',
    cp.amount_withdrawn || '',
    cp.notes || ''
  ]);
  return { completed: true };
}

function handleDeleteCheckpoint(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Checkpoints');
  const cpId = data.checkpoint_id;
  const sheetData = sheet.getDataRange().getValues();
  const headers = sheetData[0];
  const idIdx = headers.indexOf('checkpoint_id');
  
  for (let i = sheetData.length - 1; i >= 1; i--) {
    if (sheetData[i][idIdx] === cpId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { completed: true };
}

function handleEditCheckpoint(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Checkpoints');
  const cpId = data.checkpoint_id;
  const newCp = data.checkpoint;
  const sheetData = sheet.getDataRange().getValues();
  const headers = sheetData[0];
  const idIdx = headers.indexOf('checkpoint_id');
  
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][idIdx] === cpId) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, headers.indexOf('label') + 1).setValue(newCp.label);
      sheet.getRange(rowNum, headers.indexOf('trigger_balance') + 1).setValue(newCp.trigger_balance);
      sheet.getRange(rowNum, headers.indexOf('withdraw_pct') + 1).setValue(newCp.withdraw_pct);
      if(newCp.status) sheet.getRange(rowNum, headers.indexOf('status') + 1).setValue(newCp.status);
      break;
    }
  }
  return { completed: true };
}

function handleSaveConfig(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const configs = data.configs; // object of key:value
  const sheetData = sheet.getDataRange().getValues();
  const headers = sheetData[0];
  const keyIdx = headers.indexOf('key');
  const valIdx = headers.indexOf('value');
  
  // Update existing
  for (let i = 1; i < sheetData.length; i++) {
    const key = sheetData[i][keyIdx];
    if (configs.hasOwnProperty(key)) {
      sheet.getRange(i + 1, valIdx + 1).setValue(configs[key]);
      delete configs[key];
    }
  }
  
  // Add remaining
  for (const key in configs) {
    sheet.appendRow([key, configs[key]]);
  }
  return { completed: true };
}

function handleAddAccount(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
  const acc = data.account;
  sheet.appendRow([
    acc.account_id,
    acc.account_name,
    acc.starting_balance,
    acc.current_balance,
    acc.phase || '',
    acc.created_at
  ]);
  return { completed: true };
}

function handleRenameAccount(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
  const accId = data.account_id;
  const newName = data.new_name;
  const sheetData = sheet.getDataRange().getValues();
  const headers = sheetData[0];
  const idIdx = headers.indexOf('account_id');
  const titleIdx = headers.indexOf('account_name');
  
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][idIdx] === accId) {
      sheet.getRange(i + 1, titleIdx + 1).setValue(newName);
      break;
    }
  }
  return { completed: true };
}
