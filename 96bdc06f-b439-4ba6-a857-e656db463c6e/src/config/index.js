const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const _ = require('lodash');

let config = null;

function loadConfig() {
  if (config) {
    return config;
  }

  try {
    const configPath = path.join(__dirname, 'settings.yaml');
    const fileContent = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContent);

    process.env.TZ = config.system.timezone || 'Asia/Shanghai';

    return config;
  } catch (error) {
    console.error('Failed to load configuration:', error.message);
    throw error;
  }
}

function getConfig(key, defaultValue = null) {
  const cfg = loadConfig();
  if (!key) {
    return cfg;
  }
  return _.get(cfg, key, defaultValue);
}

function getClients() {
  return getConfig('clients', []);
}

function getClientTrademarks() {
  const clients = getClients();
  const trademarks = [];
  
  clients.forEach(client => {
    (client.trademarks || []).forEach(tm => {
      trademarks.push({
        ...tm,
        clientId: client.id,
        clientName: client.name,
        contact: client.contact,
        notificationPreferences: client.notificationPreferences
      });
    });
  });
  
  return trademarks;
}

function getClientById(clientId) {
  const clients = getClients();
  return clients.find(c => c.id === clientId);
}

module.exports = {
  loadConfig,
  getConfig,
  getClients,
  getClientTrademarks,
  getClientById
};
