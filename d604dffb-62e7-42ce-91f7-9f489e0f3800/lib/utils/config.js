import Conf from 'conf';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_CONFIG_PATH = path.join(ROOT_DIR, 'config', 'default.json');

const defaultConfig = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'));

const conf = new Conf({
  projectName: 'audio-pm',
  configName: 'user-config',
  cwd: path.join(ROOT_DIR, 'data'),
  defaults: defaultConfig,
  fileExtension: 'json',
  clearInvalidConfig: true,
  schema: {
    storage: {
      type: 'object',
      properties: {
        basePath: { type: 'string' },
        tempPath: { type: 'string' },
        archivePath: { type: 'string' }
      }
    },
    directoryStructure: {
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    materialTypes: {
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    projectStatus: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          color: { type: 'string' }
        }
      }
    },
    materialStatus: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          color: { type: 'string' }
        }
      }
    },
    feedbackStatus: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          color: { type: 'string' }
        }
      }
    },
    roles: {
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    supportedFormats: {
      type: 'array',
      items: { type: 'string' }
    },
    versioning: {
      type: 'object',
      properties: {
        maxVersionsPerMaterial: { type: 'number' },
        keepExpiredVersions: { type: 'boolean' },
        expireDays: { type: 'number' }
      }
    },
    storageThreshold: {
      type: 'object',
      properties: {
        warningGB: { type: 'number' },
        criticalGB: { type: 'number' }
      }
    },
    pagination: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', minimum: 5, maximum: 200 }
      }
    },
    namingTemplate: { type: 'string' }
  }
});

export function getConfig(key) {
  if (key === undefined) {
    return conf.store;
  }
  return conf.get(key);
}

export function setConfig(key, value) {
  conf.set(key, value);
}

export function resetConfig(key) {
  if (key === undefined) {
    conf.set(defaultConfig);
    return;
  }
  const pathKeys = key.split('.');
  let defVal = defaultConfig;
  for (const k of pathKeys) {
    if (defVal && typeof defVal === 'object' && k in defVal) {
      defVal = defVal[k];
    } else {
      conf.delete(key);
      return;
    }
  }
  conf.set(key, defVal);
}

export function getStorageBasePath() {
  const configured = conf.get('storage.basePath');
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(ROOT_DIR, configured);
}

export function getArchivePath() {
  const configured = conf.get('storage.archivePath');
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(ROOT_DIR, configured);
}

export function getTempPath() {
  const configured = conf.get('storage.tempPath');
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(ROOT_DIR, configured);
}

export { conf, defaultConfig };
