// js/sheetsApi.js

const SheetsAPI = (function() {
  
  function getGasUrl() {
    return localStorage.getItem('tracko_gas_url');
  }

  function setGasUrl(url) {
    localStorage.setItem('tracko_gas_url', url);
  }

  function hasGasUrl() {
    return !!getGasUrl();
  }

  async function postData(payload) {
    const url = getGasUrl();
    if (!url) throw new Error("GAS URL is not configured. Please set it in Settings.");
    
    // We use text/plain to avoid CORS preflight, GAS handles it fine via e.postData.contents
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain", 
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Unknown error occurred on backend.");
    }
    return result.data;
  }

  return {
    getGasUrl,
    setGasUrl,
    hasGasUrl,

    login: async (username, password_hash) => {
      return await postData({ action: 'login', username, password_hash });
    },

    sync: async () => {
      return await postData({ action: 'sync' });
    },

    logSession: async (session) => {
      return await postData({ action: 'logSession', session });
    },

    addFundTransaction: async (transaction, updatedAccounts) => {
      return await postData({ action: 'addFundTransaction', transaction, updatedAccounts });
    },

    addCheckpoint: async (checkpoint) => {
      return await postData({ action: 'addCheckpoint', checkpoint });
    },

    deleteCheckpoint: async (checkpoint_id) => {
      return await postData({ action: 'deleteCheckpoint', checkpoint_id });
    },

    editCheckpoint: async (checkpoint_id, checkpoint) => {
      return await postData({ action: 'editCheckpoint', checkpoint_id, checkpoint });
    },

    saveConfig: async (configs) => {
      return await postData({ action: 'saveConfig', configs });
    },

    addAccount: async (account) => {
      return await postData({ action: 'addAccount', account });
    },

    renameAccount: async (account_id, new_name) => {
      return await postData({ action: 'renameAccount', account_id, new_name });
    }
  };
})();
