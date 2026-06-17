'use strict';

const fs = require('fs');
const path = require('path');

const SAMPLES_CACHE = { data: null, mtime: 0 };
const SEQUENCES_CACHE = { data: null, mtime: 0 };

function getDataPaths(config) {
  const storagePath = path.isAbsolute(config.data.storagePath)
    ? config.data.storagePath
    : path.join(process.cwd(), config.data.storagePath);
  return {
    storagePath,
    samplesFile: path.join(storagePath, config.data.samplesFile),
    sequencesFile: path.join(storagePath, config.data.sequenceFile)
  };
}

function ensureStorageDir(config) {
  const { storagePath } = getDataPaths(config);
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
}

function readJSON(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    return JSON.parse(JSON.stringify(defaultValue));
  }
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) {
      return JSON.parse(JSON.stringify(defaultValue));
    }
    return JSON.parse(content);
  } catch (e) {
    return JSON.parse(JSON.stringify(defaultValue));
  }
}

function writeJSON(filePath, data) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function loadSamples(config) {
  const { samplesFile } = getDataPaths(config);
  const stat = fs.existsSync(samplesFile) ? fs.statSync(samplesFile) : null;
  if (stat && SAMPLES_CACHE.data && SAMPLES_CACHE.mtime === stat.mtimeMs) {
    return SAMPLES_CACHE.data;
  }
  const data = readJSON(samplesFile, []);
  if (stat) {
    SAMPLES_CACHE.data = data;
    SAMPLES_CACHE.mtime = stat.mtimeMs;
  }
  return data;
}

function saveSamples(config, samples) {
  ensureStorageDir(config);
  const { samplesFile } = getDataPaths(config);
  writeJSON(samplesFile, samples);
  const stat = fs.statSync(samplesFile);
  SAMPLES_CACHE.data = samples;
  SAMPLES_CACHE.mtime = stat.mtimeMs;
}

function loadSequences(config) {
  const { sequencesFile } = getDataPaths(config);
  const stat = fs.existsSync(sequencesFile) ? fs.statSync(sequencesFile) : null;
  if (stat && SEQUENCES_CACHE.data && SEQUENCES_CACHE.mtime === stat.mtimeMs) {
    return SEQUENCES_CACHE.data;
  }
  const data = readJSON(sequencesFile, {});
  if (stat) {
    SEQUENCES_CACHE.data = data;
    SEQUENCES_CACHE.mtime = stat.mtimeMs;
  }
  return data;
}

function saveSequences(config, sequences) {
  ensureStorageDir(config);
  const { sequencesFile } = getDataPaths(config);
  writeJSON(sequencesFile, sequences);
  const stat = fs.statSync(sequencesFile);
  SEQUENCES_CACHE.data = sequences;
  SEQUENCES_CACHE.mtime = stat.mtimeMs;
}

function getNextSequence(config, dateKey) {
  const sequences = loadSequences(config);
  const current = sequences[dateKey] || 0;
  const next = current + 1;
  sequences[dateKey] = next;
  saveSequences(config, sequences);
  return next;
}

function generateSampleId(config, date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateKey = `${y}${m}${day}`;
  const seq = getNextSequence(config, dateKey);
  const seqStr = String(seq).padStart(config.sample.idSequenceLength, '0');
  return `${config.sample.idPrefix}${dateKey}${seqStr}`;
}

function addSample(config, sample) {
  const samples = loadSamples(config);
  if (samples.find(s => s.id === sample.id)) {
    throw new Error(`样品编号已存在: ${sample.id}`);
  }
  samples.push(sample);
  saveSamples(config, samples);
  return sample;
}

function addSamples(config, sampleList) {
  const samples = loadSamples(config);
  const existingIds = new Set(samples.map(s => s.id));
  const added = [];
  const duplicates = [];
  for (const sample of sampleList) {
    if (existingIds.has(sample.id)) {
      duplicates.push(sample.id);
    } else {
      samples.push(sample);
      existingIds.add(sample.id);
      added.push(sample);
    }
  }
  saveSamples(config, samples);
  return { added, duplicates };
}

function getSampleById(config, id) {
  const samples = loadSamples(config);
  return samples.find(s => s.id === id) || null;
}

function updateSample(config, id, updates) {
  const samples = loadSamples(config);
  const idx = samples.findIndex(s => s.id === id);
  if (idx === -1) {
    throw new Error(`样品不存在: ${id}`);
  }
  samples[idx] = { ...samples[idx], ...updates, updatedAt: new Date().toISOString() };
  saveSamples(config, samples);
  return samples[idx];
}

function deleteSample(config, id) {
  const samples = loadSamples(config);
  const idx = samples.findIndex(s => s.id === id);
  if (idx === -1) {
    return false;
  }
  samples.splice(idx, 1);
  saveSamples(config, samples);
  return true;
}

function querySamples(config, filters = {}) {
  const samples = loadSamples(config);
  let result = samples;
  if (filters.status) {
    result = result.filter(s => s.status === filters.status);
  }
  if (filters.category) {
    result = result.filter(s => s.category === filters.category);
  }
  if (filters.source) {
    result = result.filter(s =>
      s.source && s.source.toLowerCase().includes(filters.source.toLowerCase())
    );
  }
  if (filters.startDate) {
    const start = filters.startDate.replace(/-/g, '');
    result = result.filter(s => {
      const sampleDate = (s.registeredAt || '').slice(0, 10).replace(/-/g, '');
      return sampleDate >= start;
    });
  }
  if (filters.endDate) {
    const end = filters.endDate.replace(/-/g, '');
    result = result.filter(s => {
      const sampleDate = (s.registeredAt || '').slice(0, 10).replace(/-/g, '');
      return sampleDate <= end;
    });
  }
  if (filters.sampler) {
    result = result.filter(s => s.sampler === filters.sampler);
  }
  if (filters.hasException !== undefined) {
    result = result.filter(s => (s.isException || false) === filters.hasException);
  }
  return result;
}

function addTestResult(config, sampleId, projectName, result) {
  const sample = getSampleById(config, sampleId);
  if (!sample) {
    throw new Error(`样品不存在: ${sampleId}`);
  }
  if (!sample.testResults) {
    sample.testResults = {};
  }
  if (!sample.testResults[projectName]) {
    sample.testResults[projectName] = [];
  }
  sample.testResults[projectName].push({
    ...result,
    timestamp: new Date().toISOString()
  });
  return updateSample(config, sampleId, { testResults: sample.testResults });
}

function getSampleIdsByDate(config, dateStr) {
  const samples = loadSamples(config);
  const target = dateStr.replace(/-/g, '');
  return samples
    .filter(s => {
      const d = (s.registeredAt || '').slice(0, 10).replace(/-/g, '');
      return d === target;
    })
    .map(s => s.id);
}

function countSamples(config, filters = {}) {
  return querySamples(config, filters).length;
}

module.exports = {
  getDataPaths,
  ensureStorageDir,
  loadSamples,
  saveSamples,
  loadSequences,
  saveSequences,
  generateSampleId,
  addSample,
  addSamples,
  getSampleById,
  updateSample,
  deleteSample,
  querySamples,
  addTestResult,
  getSampleIdsByDate,
  countSamples
};
