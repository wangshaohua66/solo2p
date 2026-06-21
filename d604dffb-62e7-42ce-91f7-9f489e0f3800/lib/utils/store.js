import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDataDir() {
  fs.ensureDirSync(DATA_DIR);
}

function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function writeAtomic(filePath, data) {
  ensureDataDir();
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.removeSync(tempPath); } catch (e) { /* ignore */ }
    }
    throw err;
  }
}

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 1000;

export function loadProjects(force = false) {
  const now = Date.now();
  if (!force && cache && (now - cacheTime) < CACHE_TTL) {
    return JSON.parse(JSON.stringify(cache));
  }
  ensureDataDir();
  if (!fs.existsSync(PROJECTS_FILE)) {
    const initial = {
      version: '1.0.0',
      projects: [],
      lastUpdated: null
    };
    writeAtomic(PROJECTS_FILE, initial);
    cache = initial;
    cacheTime = now;
    return JSON.parse(JSON.stringify(initial));
  }
  const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  cache = data;
  cacheTime = now;
  return JSON.parse(JSON.stringify(data));
}

export function saveProjects(data) {
  data.lastUpdated = new Date().toISOString();
  writeAtomic(PROJECTS_FILE, data);
  cache = JSON.parse(JSON.stringify(data));
  cacheTime = Date.now();
}

export function getProjectById(projectId) {
  const data = loadProjects();
  return data.projects.find(p => p.id === projectId) || null;
}

export function getProjectByName(name) {
  const data = loadProjects();
  return data.projects.find(p => p.name === name) || null;
}

export function addProject(project) {
  const data = loadProjects();
  project.id = project.id || generateId('proj_');
  project.createdAt = project.createdAt || new Date().toISOString();
  project.updatedAt = new Date().toISOString();
  project.materials = project.materials || [];
  project.feedback = project.feedback || [];
  project.activityLog = project.activityLog || [];
  project.teamMembers = project.teamMembers || [];
  data.projects.push(project);
  saveProjects(data);
  return project;
}

export function updateProject(projectId, updates) {
  const data = loadProjects();
  const idx = data.projects.findIndex(p => p.id === projectId);
  if (idx === -1) return null;
  data.projects[idx] = {
    ...data.projects[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveProjects(data);
  return data.projects[idx];
}

export function removeProject(projectId) {
  const data = loadProjects();
  const idx = data.projects.findIndex(p => p.id === projectId);
  if (idx === -1) return false;
  data.projects.splice(idx, 1);
  saveProjects(data);
  return true;
}

export function addMaterial(projectId, material) {
  const project = getProjectById(projectId);
  if (!project) return null;
  const data = loadProjects();
  const idx = data.projects.findIndex(p => p.id === projectId);
  material.id = material.id || generateId('mat_');
  material.createdAt = material.createdAt || new Date().toISOString();
  material.updatedAt = new Date().toISOString();
  material.status = material.status || 'pending';
  material.versions = material.versions || 0;
  material.feedbackIds = material.feedbackIds || [];
  data.projects[idx].materials = data.projects[idx].materials || [];
  data.projects[idx].materials.push(material);
  data.projects[idx].updatedAt = new Date().toISOString();
  saveProjects(data);
  return material;
}

export function getMaterial(projectId, materialId) {
  const project = getProjectById(projectId);
  if (!project || !project.materials) return null;
  return project.materials.find(m => m.id === materialId) || null;
}

export function updateMaterial(projectId, materialId, updates) {
  const data = loadProjects();
  const pIdx = data.projects.findIndex(p => p.id === projectId);
  if (pIdx === -1) return null;
  const mIdx = data.projects[pIdx].materials.findIndex(m => m.id === materialId);
  if (mIdx === -1) return null;
  data.projects[pIdx].materials[mIdx] = {
    ...data.projects[pIdx].materials[mIdx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  data.projects[pIdx].updatedAt = new Date().toISOString();
  saveProjects(data);
  return data.projects[pIdx].materials[mIdx];
}

export function removeMaterial(projectId, materialId) {
  const data = loadProjects();
  const pIdx = data.projects.findIndex(p => p.id === projectId);
  if (pIdx === -1) return false;
  const mIdx = data.projects[pIdx].materials.findIndex(m => m.id === materialId);
  if (mIdx === -1) return false;
  data.projects[pIdx].materials.splice(mIdx, 1);
  data.projects[pIdx].updatedAt = new Date().toISOString();
  saveProjects(data);
  return true;
}

export function findMaterials(projectId, filter = {}) {
  const project = getProjectById(projectId);
  if (!project || !project.materials) return [];
  return project.materials.filter(m => {
    if (filter.type && m.type !== filter.type) return false;
    if (filter.status && m.status !== filter.status) return false;
    if (filter.scene && m.scene !== filter.scene) return false;
    if (filter.shot && m.shot !== filter.shot) return false;
    if (filter.assignedTo && m.assignedTo !== filter.assignedTo) return false;
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      if (!m.name.toLowerCase().includes(kw) &&
          !(m.description || '').toLowerCase().includes(kw) &&
          !(m.originalName || '').toLowerCase().includes(kw)) {
        return false;
      }
    }
    return true;
  });
}

export function addActivity(projectId, activity) {
  const data = loadProjects();
  const idx = data.projects.findIndex(p => p.id === projectId);
  if (idx === -1) return null;
  activity.id = activity.id || generateId('act_');
  activity.timestamp = activity.timestamp || new Date().toISOString();
  data.projects[idx].activityLog = data.projects[idx].activityLog || [];
  data.projects[idx].activityLog.unshift(activity);
  if (data.projects[idx].activityLog.length > 500) {
    data.projects[idx].activityLog = data.projects[idx].activityLog.slice(0, 500);
  }
  saveProjects(data);
  return activity;
}

export function addFeedback(projectId, feedback) {
  const data = loadProjects();
  const pIdx = data.projects.findIndex(p => p.id === projectId);
  if (pIdx === -1) return null;
  feedback.id = feedback.id || generateId('fb_');
  feedback.createdAt = feedback.createdAt || new Date().toISOString();
  feedback.status = feedback.status || 'pending';
  feedback.timecodes = feedback.timecodes || [];
  data.projects[pIdx].feedback = data.projects[pIdx].feedback || [];
  data.projects[pIdx].feedback.push(feedback);
  if (feedback.materialId) {
    const mIdx = data.projects[pIdx].materials.findIndex(m => m.id === feedback.materialId);
    if (mIdx !== -1) {
      data.projects[pIdx].materials[mIdx].feedbackIds = data.projects[pIdx].materials[mIdx].feedbackIds || [];
      if (!data.projects[pIdx].materials[mIdx].feedbackIds.includes(feedback.id)) {
        data.projects[pIdx].materials[mIdx].feedbackIds.push(feedback.id);
      }
    }
  }
  saveProjects(data);
  return feedback;
}

export function updateFeedback(projectId, feedbackId, updates) {
  const data = loadProjects();
  const pIdx = data.projects.findIndex(p => p.id === projectId);
  if (pIdx === -1) return null;
  const fIdx = data.projects[pIdx].feedback.findIndex(f => f.id === feedbackId);
  if (fIdx === -1) return null;
  data.projects[pIdx].feedback[fIdx] = {
    ...data.projects[pIdx].feedback[fIdx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveProjects(data);
  return data.projects[pIdx].feedback[fIdx];
}

export function findFeedback(projectId, filter = {}) {
  const project = getProjectById(projectId);
  if (!project || !project.feedback) return [];
  return project.feedback.filter(f => {
    if (filter.status && f.status !== filter.status) return false;
    if (filter.materialId && f.materialId !== filter.materialId) return false;
    if (filter.author && f.author !== filter.author) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export { generateId, ensureDataDir };
