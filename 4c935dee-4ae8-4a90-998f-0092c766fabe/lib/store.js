'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function appDir() {
  const override = process.env.SC_HOME;
  if (override) return path.resolve(override);
  return path.join(os.homedir(), '.sc-cli');
}

function storePath() {
  return path.join(appDir(), 'store.json');
}

function auditPath() {
  return path.join(appDir(), 'audit.jsonl');
}

function auditMaxSize() {
  const raw = process.env.SC_AUDIT_MAX_SIZE;
  if (!raw) return 10 * 1024 * 1024;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return 10 * 1024 * 1024;
}

function ensureDir() {
  const dir = appDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function defaultState() {
  return { version: 1, secrets: {}, updatedAt: new Date().toISOString() };
}

function loadState() {
  ensureDir();
  const file = storePath();
  if (!fs.existsSync(file)) {
    const state = defaultState();
    saveState(state);
    return state;
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data.secrets) data.secrets = {};
    return data;
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    fs.writeFileSync(backup, fs.readFileSync(file));
    const state = defaultState();
    saveState(state);
    return state;
  }
}

function saveState(state) {
  ensureDir();
  state.updatedAt = new Date().toISOString();
  const tmp = `${storePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, storePath());
}

function secretKey(profile, secretPath) {
  return `${profile}:${secretPath}`;
}

function upsertSecret(profile, meta) {
  const state = loadState();
  const key = secretKey(profile, meta.path || meta.name);
  const existing = state.secrets[key] || {};
  state.secrets[key] = {
    name: meta.name,
    path: meta.path,
    source: meta.source,
    profile,
    lastHash: meta.lastHash !== undefined ? meta.lastHash : existing.lastHash,
    prevHash: meta.prevHash !== undefined ? meta.prevHash : existing.prevHash,
    lastRotatedAt: meta.lastRotatedAt || existing.lastRotatedAt,
    lastSeenAt: new Date().toISOString(),
    metadata: meta.metadata || existing.metadata || {}
  };
  saveState(state);
  return state.secrets[key];
}

function getSecrets(profile) {
  const state = loadState();
  const all = Object.values(state.secrets);
  return profile ? all.filter((s) => s.profile === profile) : all;
}

function rotateAudit() {
  ensureDir();
  const file = auditPath();
  if (!fs.existsSync(file)) return false;
  const stat = fs.statSync(file);
  if (stat.size < auditMaxSize()) return false;
  const rotated = `${file}.1`;
  try {
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(file, rotated);
    return true;
  } catch {
    return false;
  }
}

function recordAudit(entry) {
  ensureDir();
  rotateAudit();
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    action: entry.action,
    actor: entry.actor || process.env.USER || process.env.LOGNAME || 'unknown',
    profile: entry.profile || '',
    secretName: entry.secretName || '',
    secretPath: entry.secretPath || '',
    source: entry.source || '',
    status: entry.status || 'success',
    beforeHash: entry.beforeHash || '',
    afterHash: entry.afterHash || '',
    message: entry.message || '',
    metadata: entry.metadata || {}
  };
  fs.appendFileSync(auditPath(), JSON.stringify(record) + '\n');
  return record;
}

function queryAudit(filters) {
  const f = filters || {};
  const file = auditPath();
  const results = [];
  const files = [file, `${file}.1`];
  for (const fpath of files) {
    if (!fs.existsSync(fpath)) continue;
    const lines = fs.readFileSync(fpath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      if (f.from && new Date(rec.timestamp) < new Date(f.from)) continue;
      if (f.to && new Date(rec.timestamp) > new Date(f.to)) continue;
      if (f.action && rec.action !== f.action) continue;
      if (f.status && rec.status !== f.status) continue;
      if (f.secret && rec.secretName !== f.secret && rec.secretPath !== f.secret) continue;
      if (f.profile && rec.profile !== f.profile) continue;
      results.push(rec);
    }
  }
  results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (f.limit) return results.slice(0, f.limit);
  return results;
}

function cleanupTemp(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  appDir,
  storePath,
  auditPath,
  loadState,
  saveState,
  upsertSecret,
  getSecrets,
  recordAudit,
  queryAudit,
  rotateAudit,
  cleanupTemp
};
