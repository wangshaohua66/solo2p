const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { minimatch } = require('minimatch');

async function resolveFiles(globPattern, cwd) {
  const base = cwd || process.cwd();
  const pattern = path.isAbsolute(globPattern) ? globPattern : path.resolve(base, globPattern);

  const dirPart = path.dirname(pattern);
  const basePart = pattern.startsWith(dirPart) ? dirPart : base;
  const filePattern = pattern.slice(dirPart.length + 1) || '*';

  const exists = await fs.pathExists(basePart);
  if (!exists) return [];

  const entries = await walkDir(basePart);
  const matched = entries.filter(f => {
    const relative = path.relative(basePart, f);
    return minimatch(relative, filePattern, { dot: true });
  });

  const files = [];
  for (const m of matched) {
    const stat = await fs.stat(m);
    if (stat.isFile()) {
      files.push({ path: m, size: stat.size, mtime: stat.mtime });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function walkDir(dir) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walkDir(full);
      results.push(...sub);
    } else {
      results.push(full);
    }
  }

  return results;
}

function createLineStream(filePath, options = {}) {
  const encoding = options.encoding || 'utf-8';
  const highWaterMark = options.highWaterMark || 64 * 1024;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding, highWaterMark });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('error', reject);

    const lineIterator = (async function* () {
      let line;
      const queue = [];
      let done = false;
      let resolveWait = null;

      rl.on('line', (l) => {
        if (resolveWait) {
          resolveWait(l);
          resolveWait = null;
        } else {
          queue.push(l);
        }
      });

      rl.on('close', () => {
        done = true;
        if (resolveWait) {
          resolveWait(null);
          resolveWait = null;
        }
      });

      while (true) {
        if (queue.length > 0) {
          line = queue.shift();
        } else if (done) {
          return;
        } else {
          line = await new Promise(r => { resolveWait = r; });
          if (line === null) return;
        }
        yield line;
      }
    })();

    resolve({ iterator: lineIterator, stream, rl });
  });
}

async function readFileLines(filePath, options = {}) {
  const { iterator } = await createLineStream(filePath, options);
  const lines = [];
  for await (const line of iterator) {
    if (line.trim()) {
      lines.push(line);
    }
  }
  return lines;
}

async function* streamLines(filePath, options = {}) {
  const { iterator } = await createLineStream(filePath, options);
  for await (const line of iterator) {
    if (line.trim()) {
      yield line;
    }
  }
}

async function resolveSourceFiles(source, cwd) {
  return resolveFiles(source.path, cwd);
}

async function readSource(source, options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = await resolveSourceFiles(source, cwd);
  const allLines = [];

  for (const file of files) {
    const lines = await readFileLines(file.path, { encoding: source.encoding || 'utf-8' });
    for (const line of lines) {
      allLines.push({ source: source.name, file: file.path, line, raw: line });
    }
  }

  return allLines;
}

async function* streamSource(source, cwd) {
  const files = await resolveSourceFiles(source, cwd);
  for (const file of files) {
    for await (const line of streamLines(file.path, { encoding: source.encoding || 'utf-8' })) {
      yield { source: source.name, file: file.path, line, raw: line };
    }
  }
}

async function getFileInfos(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      size: stat.size,
      mtime: stat.mtime,
      ctime: stat.ctime,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory()
    };
  } catch (e) {
    return { path: filePath, error: e.message };
  }
}

module.exports = {
  resolveFiles,
  createLineStream,
  readFileLines,
  streamLines,
  resolveSourceFiles,
  readSource,
  streamSource,
  getFileInfos,
  walkDir
};
