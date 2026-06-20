'use strict';

const fs = require('fs');
const path = require('path');
const { pLimit } = require('./util');

const KEYWORD_RULES = [
  { re: /BEGIN\s+(RSA|EC|OPENSSH|PRIVATE)\s+PRIVATE\s+KEY|private[_-]?key/i, type: 'privatekey' },
  { re: /BEGIN\s+CERTIFICATE|certif(?:icate|)/i, type: 'certificate' },
  { re: /api[_-]?key|apikey/i, type: 'apikey' },
  { re: /access[_-]?token|auth[_-]?token|refresh[_-]?token|jwt[_-]?secret|bearer/i, type: 'token' },
  { re: /password|passwd|pwd/i, type: 'password' },
  { re: /secret|client[_-]?secret/i, type: 'secret' },
  { re: /credential/i, type: 'credential' }
];

const PLACEHOLDER_RE = /^(<.+>|\$\{.+\}|\$\(|changeme|change_me|replace_?me|your[_-]?.*|xxxx*|example|todo|undefined|null|none|""|'')$/i;

const VALID_EXTENSIONS = new Set([
  '.yml', '.yaml', '.json', '.env', '.properties', '.conf', '.ini', '.toml', '.cfg', '.config', ''
]);

function extOf(file) {
  const base = path.basename(file);
  if (base === '.env' || base.startsWith('.env.')) return '.env';
  return path.extname(file).toLowerCase();
}

function isValidFile(file) {
  const base = path.basename(file);
  if (base === '.env' || base.startsWith('.env.')) return true;
  return VALID_EXTENSIONS.has(extOf(file));
}

function classifyKey(key) {
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(key)) return rule.type;
  }
  return null;
}

function splitPair(line) {
  const m = line.match(/^\s*[-*]?\s*"?([A-Za-z0-9_.\-\/\[\]]+)"?\s*[:=]\s*(.*)$/);
  if (!m) return null;
  let val = m[2].replace(/^\s+/, '');
  val = val.replace(/^["']/, '').replace(/["']\s*$/, '');
  val = val.replace(/\s+#.*$/, '').replace(/\s*\/\/.*$/, '').trim();
  return { key: m[1], val };
}

function isLikelySecretValue(val) {
  if (!val || val.length < 4) return false;
  if (PLACEHOLDER_RE.test(val)) return false;
  if (/^(true|false|yes|no|on|off|enabled|disabled|info|debug|warn|error|trace)$/i.test(val)) return false;
  if (/^\d+$/.test(val) && val.length < 4) return false;
  if (/^https?:\/\//i.test(val) && !/key|token|secret/i.test(val)) return false;
  return true;
}

function maskValue(val) {
  if (!val) return '';
  if (val.length <= 6) return '***';
  return `${val.slice(0, 2)}***${val.slice(-2)}`;
}

async function walk(dir, ignore) {
  const results = [];
  const stack = [dir];
  const ignoreSet = new Set(ignore || ['node_modules', '.git', 'dist', 'build', '.svn']);
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (ignoreSet.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && isValidFile(full)) {
        results.push(full);
      }
    }
  }
  return results;
}

function scanText(content, file) {
  const findings = [];
  const lines = content.split('\n');
  let inPem = false;
  let pemType = '';
  let pemStart = 0;
  let pemBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const begin = line.match(/-----BEGIN ([A-Z ]+)-----/);
    if (begin) {
      inPem = true;
      pemType = begin[1].trim();
      pemStart = i + 1;
      pemBuffer = line + '\n';
      continue;
    }
    if (inPem) {
      pemBuffer += line + '\n';
      if (/-----END [A-Z ]+-----/.test(line)) {
        const type = /CERTIFICATE/.test(pemType) ? 'certificate' : 'privatekey';
        findings.push({
          name: `${type}-${path.basename(file)}`,
          type,
          source: 'file',
          location: `${file}:${pemStart}`,
          preview: `-----BEGIN ${pemType}-----`,
          file,
          line: pemStart
        });
        inPem = false;
        pemBuffer = '';
      }
      continue;
    }
    const pair = splitPair(line);
    if (!pair) continue;
    const type = classifyKey(pair.key);
    if (!type) continue;
    if (!isLikelySecretValue(pair.val)) continue;
    findings.push({
      name: pair.key,
      type,
      source: 'file',
      location: `${file}:${i + 1}`,
      preview: maskValue(pair.val),
      file,
      line: i + 1
    });
  }
  return findings;
}

async function scanDirectory(dir, options) {
  const opts = options || {};
  const files = await walk(dir, opts.ignore);
  const limit = pLimit(opts.concurrency || 16);
  const all = [];
  await Promise.all(files.map((file) => limit(async () => {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      return;
    }
    const found = scanText(content, file);
    for (const f of found) all.push(f);
  })));
  return { files: files.length, findings: all };
}

function dedupe(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = `${f.source}:${f.name}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  return map;
}

module.exports = {
  scanDirectory,
  scanText,
  classifyKey,
  isLikelySecretValue,
  maskValue,
  dedupe,
  isValidFile
};
