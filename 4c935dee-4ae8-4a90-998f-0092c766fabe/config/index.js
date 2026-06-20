'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_DIR = '.sc-cli';
const CONFIG_FILE = 'config.json';

function appDir() {
  const override = process.env.SC_HOME;
  if (override) return path.resolve(override);
  return path.join(os.homedir(), APP_DIR);
}

function configPath() {
  const override = process.env.SC_CONFIG_PATH;
  if (override) return path.resolve(override);
  return path.join(appDir(), CONFIG_FILE);
}

function defaultProfiles() {
  const base = (description, endpoint) => ({
    description,
    vault: {
      endpoint,
      auth: { method: 'token', token: '' },
      mount: 'secret',
      kvVersion: 2,
      namespace: ''
    },
    k8s: { context: '', namespace: 'default' },
    notifier: { dingtalk: '', wechat: '' },
    rotation: { maxAgeDays: 90, passwordLength: 24 }
  });
  return {
    dev: base('开发环境', 'http://127.0.0.1:8200'),
    test: base('测试环境', 'http://127.0.0.1:8201'),
    staging: base('预发布环境', 'https://vault-staging.example.com'),
    prod: base('生产环境', 'https://vault.example.com')
  };
}

function ensureConfigFile() {
  const file = configPath();
  if (!fs.existsSync(file)) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const initial = {
      version: 1,
      activeProfile: 'dev',
      profiles: defaultProfiles()
    };
    fs.writeFileSync(file, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveConfig(config) {
  const file = configPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

function listProfiles() {
  const config = ensureConfigFile();
  return Object.keys(config.profiles || {}).map((name) => ({
    name,
    description: config.profiles[name].description || '',
    active: name === config.activeProfile
  }));
}

function getProfile(name) {
  const config = ensureConfigFile();
  const profiles = config.profiles || {};
  const target = name || config.activeProfile || 'dev';
  return profiles[target] ? { name: target, ...profiles[target] } : null;
}

function setActiveProfile(name) {
  const config = ensureConfigFile();
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist. Available: ${Object.keys(config.profiles).join(', ')}`);
  }
  config.activeProfile = name;
  saveConfig(config);
  return config.profiles[name];
}

function setProfile(name, data) {
  const config = ensureConfigFile();
  config.profiles[name] = { ...(config.profiles[name] || {}), ...data };
  saveConfig(config);
  return config.profiles[name];
}

function envOverrides(profile) {
  const merged = JSON.parse(JSON.stringify(profile));
  const v = merged.vault || (merged.vault = {});
  const auth = v.auth || (v.auth = {});
  if (process.env.SC_VAULT_ADDR) v.endpoint = process.env.SC_VAULT_ADDR;
  if (process.env.SC_VAULT_TOKEN) { auth.method = 'token'; auth.token = process.env.SC_VAULT_TOKEN; }
  if (process.env.SC_VAULT_MOUNT) v.mount = process.env.SC_VAULT_MOUNT;
  if (process.env.SC_VAULT_KV_VERSION) v.kvVersion = Number(process.env.SC_VAULT_KV_VERSION);
  if (process.env.SC_VAULT_NAMESPACE) v.namespace = process.env.SC_VAULT_NAMESPACE;
  const k = merged.k8s || (merged.k8s = {});
  if (process.env.SC_K8S_CONTEXT) k.context = process.env.SC_K8S_CONTEXT;
  if (process.env.SC_K8S_NAMESPACE) k.namespace = process.env.SC_K8S_NAMESPACE;
  const n = merged.notifier || (merged.notifier = {});
  if (process.env.SC_DINGTALK_WEBHOOK) n.dingtalk = process.env.SC_DINGTALK_WEBHOOK;
  if (process.env.SC_WECHAT_WEBHOOK) n.wechat = process.env.SC_WECHAT_WEBHOOK;
  return merged;
}

function resolve(options) {
  const opts = options || {};
  const config = ensureConfigFile();
  const profileName = opts.profile || process.env.SC_PROFILE || config.activeProfile || 'dev';
  const profiles = config.profiles || {};
  const profile = profiles[profileName] || profiles.dev || defaultProfiles().dev;
  const withEnv = envOverrides(profile);
  withEnv.name = profileName;
  return withEnv;
}

module.exports = {
  configPath,
  appDir,
  listProfiles,
  getProfile,
  setActiveProfile,
  setProfile,
  defaultProfiles,
  ensureConfigFile,
  resolve
};
