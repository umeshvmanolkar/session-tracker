// js/app.js

const AppState = {
  data: {
    accounts: [],
    sessions: [],
    fund_transactions: [],
    checkpoints: [],
    config: {}
  },
  currentUser: null,
  gasUrlChecked: false
};

// --- Utilities ---

function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : 'success'}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  // trigger reflow
  toast.offsetHeight; 
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoader(show, text = "Loading...") {
  const loader = document.getElementById('global-loader');
  document.getElementById('loader-text').textContent = text;
  if (show) {
    loader.classList.remove('d-none');
  } else {
    loader.classList.add('d-none');
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTodayString() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function getTimeString() {
  const d = new Date();
  const rawHours = d.getHours();
  const ampm = rawHours >= 12 ? 'PM' : 'AM';
  const hours = rawHours % 12 || 12; // 0 becomes 12
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins} ${ampm}`;
}

// --- Dynamic Rules Evaluators ---

function getConfigVal(key, defaultVal = 0) {
  const cfg = AppState.data.config.find(c => c.key === key);
  return cfg ? parseFloat(cfg.value) : defaultVal;
}

function getTotalBalance() {
  return AppState.data.accounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0);
}

function getAccountDailyTarget() {
  const target = getConfigVal('daily_target_per_account', 300);
  const sessions = getConfigVal('sessions_per_day', 8);
  const accCount = AppState.data.accounts.length || 1; // avoid division by zero
  // As per rules: daily_target_per_account / (sessions_per_day / account_count)
  // This logic from prompt: Session target per account = daily_target_per_account ÷ (sessions_per_day ÷ account_count)
  const sessionTarget = target / (sessions / accCount);
  return sessionTarget;
}

// Check for 3 loss streak today across all accounts
function checkLossStreak() {
  const todayStr = getTodayString();
  const todaySessions = AppState.data.sessions.filter(s => s.date === todayStr);
  if (todaySessions.length >= 3) {
    const last3 = todaySessions.slice(-3);
    const allLosses = last3.every(s => s.result === 'Loss');
    return allLosses;
  }
  return false;
}


// --- Routing & Initialization ---

function switchTab(target) {
  // Update sidebar active class
  document.querySelectorAll('.si').forEach(el => el.classList.remove('a'));
  const activeSi = document.querySelector(`.si[data-target="${target}"]`);
  if(activeSi) activeSi.classList.add('a');
  
  // Hide all pages, show target
  document.querySelectorAll('.page-section').forEach(el => el.classList.add('d-none'));
  const page = document.getElementById(`page-${target}`);
  if (page) page.classList.remove('d-none');
  
  // Trigger any page-specific renders if they exist in global scope
  if (window[`render_${target}`]) {
    window[`render_${target}`]();
  }
}

function initRouter() {
  document.querySelectorAll('.si').forEach(el => {
    el.addEventListener('click', () => {
      switchTab(el.getAttribute('data-target'));
    });
  });
}

// --- Login & Auth ---

function checkAuth() {
  const userStr = localStorage.getItem('tracko_user');
  if (userStr && SheetsAPI.hasGasUrl()) {
    AppState.currentUser = JSON.parse(userStr);
    showApp();
    loadDataAndInit();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('view-app').classList.add('d-none');
  document.getElementById('view-login').classList.remove('d-none');
}

function showApp() {
  document.getElementById('view-login').classList.add('d-none');
  document.getElementById('view-app').classList.remove('d-none');
  
  document.getElementById('topbar-date').textContent = getTodayString() + " " + getTimeString();
  if (AppState.currentUser) {
    const initials = AppState.currentUser.display_name.substring(0, 2).toUpperCase();
    document.getElementById('topbar-avatar').textContent = initials;
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const user = document.getElementById('login-username').value;
  const pass = document.getElementById('login-password').value;
  
  // Hash password
  const hash = CryptoJS.SHA256(pass).toString();
  
  showLoader(true, "Authenticating...");
  try {
    const usr = await SheetsAPI.login(user, hash);
    localStorage.setItem('tracko_user', JSON.stringify(usr));
    AppState.currentUser = usr;
    showApp();
    await loadDataAndInit();
  } catch (err) {
    showToast(err.message, true);
    // If it's a URL error, clear it so they can try again
    if(err.message.includes("Failed to fetch")) {
      SheetsAPI.setGasUrl('');
      showLogin();
    }
  } finally {
    showLoader(false);
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('tracko_user');
  location.reload();
});


// --- Main Data Loading ---

async function loadDataAndInit() {
  showLoader(true, "Syncing data...");
  try {
    const data = await SheetsAPI.sync();
    AppState.data = data;
    
    // Evaluate Global rules (Banners)
    evaluateGlobalBanners();
    
    // Initialize Dashboard as default
    switchTab('dashboard');
  } catch(err) {
    showToast("Failed to load data: " + err.message, true);
  } finally {
    showLoader(false);
  }
}

function evaluateGlobalBanners() {
  const container = document.getElementById('global-banner-container');
  container.innerHTML = '';
  
  // 1. Loss streak check
  if (checkLossStreak()) {
    container.innerHTML += `<div class="warn-banner"><div class="dot" style="background:#ef4444;"></div>3 loss sessions today — consider stopping for the day</div>`;
  }
  
  // 2. Checkpoint reached check
  const totalBalance = getTotalBalance();
  const cpActive = AppState.data.checkpoints.filter(cp => cp.status !== 'Reached');
  cpActive.forEach(cp => {
    if (totalBalance >= parseFloat(cp.trigger_balance)) {
      container.innerHTML += `<div class="success-banner"><div class="dot" style="background:#16a34a;"></div>Checkpoint "${cp.label}" reached! Total balance hit ${formatCurrency(totalBalance)}. Consider withdrawing!</div>`;
    }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  checkAuth();
});
