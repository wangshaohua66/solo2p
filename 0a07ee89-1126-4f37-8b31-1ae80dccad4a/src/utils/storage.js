import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.reconcile');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function statePath(dataDir) {
  return path.join(dataDir, 'import-state.json');
}

function loadState(dataDir) {
  const p = statePath(dataDir);
  if (!fs.existsSync(p)) return { imported: {} };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return { imported: {} };
  }
}

function saveState(dataDir, state) {
  ensureDir(dataDir);
  fs.writeFileSync(statePath(dataDir), JSON.stringify(state, null, 2), 'utf8');
}

class Storage {
  constructor(dataDir) {
    this.dataDir = dataDir || DEFAULT_DATA_DIR;
    ensureDir(this.dataDir);
    this.recordsDir = path.join(this.dataDir, 'records');
    this.resultsDir = path.join(this.dataDir, 'results');
    this.historyDir = path.join(this.dataDir, 'history');
    ensureDir(this.recordsDir);
    ensureDir(this.resultsDir);
    ensureDir(this.historyDir);
  }

  isImported(filePath) {
    const state = loadState(this.dataDir);
    if (!fs.existsSync(filePath)) return false;
    const hash = fileHash(filePath);
    const entry = state.imported[filePath];
    return Boolean(entry && entry.hash === hash);
  }

  markImported(filePath, meta) {
    const state = loadState(this.dataDir);
    const hash = fileHash(filePath);
    state.imported[filePath] = { hash, meta, importedAt: new Date().toISOString() };
    saveState(this.dataDir, state);
  }

  unmarkImported(filePath) {
    const state = loadState(this.dataDir);
    delete state.imported[filePath];
    saveState(this.dataDir, state);
  }

  importedFiles() {
    const state = loadState(this.dataDir);
    return Object.entries(state.imported).map(([file, info]) => ({ file, ...info }));
  }

  saveRecords(name, records) {
    const file = path.join(this.recordsDir, `${name}.json`);
    const ws = fs.createWriteStream(file);
    ws.write('[');
    records.forEach((r, i) => {
      if (i > 0) ws.write(',');
      ws.write(JSON.stringify(r));
    });
    ws.write(']');
    ws.end();
    return new Promise((resolve) => ws.on('finish', () => resolve(file)));
  }

  async loadRecords(name) {
    const file = path.join(this.recordsDir, `${name}.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  saveResult(name, result) {
    const file = path.join(this.resultsDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
    return file;
  }

  loadResult(name) {
    const file = path.join(this.resultsDir, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  latestResult() {
    if (!fs.existsSync(this.resultsDir)) return null;
    const files = fs
      .readdirSync(this.resultsDir)
      .filter((f) => f.startsWith('match-') && f.endsWith('.json'))
      .map((f) => ({ f, mtime: fs.statSync(path.join(this.resultsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return null;
    return this.loadResult(files[0].f.replace(/\.json$/, ''));
  }

  saveHistory(entry) {
    const id = entry.id || `recon-${Date.now()}`;
    const file = path.join(this.historyDir, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...entry, id }, null, 2), 'utf8');
    return file;
  }

  queryHistory(filter = {}) {
    const files = fs.existsSync(this.historyDir) ? fs.readdirSync(this.historyDir).filter((f) => f.endsWith('.json')) : [];
    const records = files.map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(this.historyDir, f), 'utf8'));
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
    let result = records;
    if (filter.merchantId) result = result.filter((r) => r.merchantId === filter.merchantId);
    if (filter.startDate) result = result.filter((r) => r.createdAt && r.createdAt >= filter.startDate);
    if (filter.endDate) result = result.filter((r) => r.createdAt && r.createdAt <= filter.endDate);
    if (filter.channel) result = result.filter((r) => r.channel === filter.channel);
    result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return result;
  }
}

const globalStorage = new Storage();

export { Storage, DEFAULT_DATA_DIR, globalStorage };
export default Storage;
