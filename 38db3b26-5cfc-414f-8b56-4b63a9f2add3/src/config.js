import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, '../../.env') });

let _profiles = null;

function interpolateEnv(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateEnv);
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = interpolateEnv(v);
    }
    return result;
  }
  return obj;
}

export function loadProfiles() {
  if (_profiles) return _profiles;
  const yamlPath = resolve(__dirname, '../../config/profiles.yaml');
  const raw = readFileSync(yamlPath, 'utf-8');
  const parsed = yaml.load(raw);
  _profiles = interpolateEnv(parsed);
  return _profiles;
}

export function getProfile(platform) {
  const profiles = loadProfiles();
  if (!profiles[platform]) {
    throw new Error(`Unknown platform profile: ${platform}`);
  }
  return profiles[platform];
}

export function getBrowserPoolConfig() {
  const profiles = loadProfiles();
  return profiles.browserPool;
}

export function getPipelineConfig() {
  const profiles = loadProfiles();
  return profiles.pipeline;
}

export function getEnv(key, defaultValue) {
  return process.env[key] || defaultValue;
}
