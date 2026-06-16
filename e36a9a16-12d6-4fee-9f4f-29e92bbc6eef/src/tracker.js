import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!__dirname || typeof __dirname !== 'string' || __dirname.trim() === '') {
  throw new Error('无法确定当前目录路径 __dirname');
}

function safeJoin(...parts) {
  const validParts = parts.filter(p => p != null && typeof p === 'string' && p.trim() !== '');
  if (validParts.length === 0) {
    throw new Error('路径拼接失败：所有路径段均为空或无效');
  }
  return path.join(...validParts);
}

const dataDir = safeJoin(__dirname, '..', 'data');
const trackedFile = safeJoin(dataDir, 'tracked-projects.json');

class ChangeTracker {
  constructor() {
    this.trackedProjects = new Map();
    this.changeHistory = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await this.loadTrackedProjects();
    this.initialized = true;
  }

  async loadTrackedProjects() {
    try {
      const exists = await fs.pathExists(trackedFile);
      if (exists) {
        const data = await fs.readJson(trackedFile);
        this.trackedProjects = new Map(data.projects || []);
        this.changeHistory = data.history || [];
        logger.info(`已加载 ${this.trackedProjects.size} 个关注项目, ${this.changeHistory.length} 条变更记录`);
      } else {
        logger.info('暂无关注项目数据，初始化空追踪器');
      }
    } catch (error) {
      logger.error(`加载关注项目失败: ${error.message}`);
      this.trackedProjects = new Map();
      this.changeHistory = [];
    }
  }

  async saveTrackedProjects() {
    try {
      await fs.ensureDir(dataDir);
      const data = {
        projects: Array.from(this.trackedProjects.entries()),
        history: this.changeHistory.slice(-1000),
        updatedAt: new Date().toISOString()
      };
      await fs.writeJson(trackedFile, data, { spaces: 2 });
      logger.debug(`关注项目已保存, 共 ${this.trackedProjects.size} 个`);
    } catch (error) {
      logger.error(`保存关注项目失败: ${error.message}`);
    }
  }

  addTrackedProject(announcement) {
    const projectKey = this.getProjectKey(announcement);
    if (!projectKey) return false;

    const existing = this.trackedProjects.get(projectKey);
    const projectInfo = {
      projectNo: announcement.projectNo || '',
      title: announcement.title,
      link: announcement.link,
      siteId: announcement.siteId,
      siteName: announcement.siteName,
      budget: announcement.budget || null,
      bidDeadline: announcement.bidDeadline || null,
      firstSeenAt: existing?.firstSeenAt || new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      lastContent: announcement.content || '',
      version: (existing?.version || 0) + 1,
      changeCount: existing?.changeCount || 0,
      isWatched: true
    };

    this.trackedProjects.set(projectKey, projectInfo);
    logger.debug(`添加关注项目: ${announcement.title}`);
    return true;
  }

  removeTrackedProject(projectKey) {
    const result = this.trackedProjects.delete(projectKey);
    if (result) {
      logger.debug(`移除关注项目: ${projectKey}`);
    }
    return result;
  }

  async checkChanges(listItems, siteId) {
    const changes = [];

    for (const item of listItems) {
      if (!item.hasChange && !item.isChange && !item.isClarification) {
        continue;
      }

      const projectKey = this.extractProjectKeyFromTitle(item.title);
      const isTracked = projectKey && this.trackedProjects.has(projectKey);

      if (isTracked) {
        const trackedProject = this.trackedProjects.get(projectKey);

        const changeRecord = {
          projectKey,
          title: item.title,
          link: item.link,
          siteId: item.siteId,
          siteName: item.siteName,
          type: item.isClarification ? 'clarification' : 'change',
          detectedAt: new Date().toISOString(),
          trackedProject
        };

        changes.push(changeRecord);

        trackedProject.lastUpdatedAt = new Date().toISOString();
        trackedProject.changeCount = (trackedProject.changeCount || 0) + 1;
        this.trackedProjects.set(projectKey, trackedProject);

        this.changeHistory.push({
          ...changeRecord,
          at: new Date().toISOString()
        });

        logger.warn(`检测到关注项目变更: ${item.title}, 类型: ${changeRecord.type}`);
      }
    }

    if (changes.length > 0) {
      await this.saveTrackedProjects();
    }

    return changes;
  }

  getTrackedProjects(siteId = null) {
    let projects = Array.from(this.trackedProjects.values());
    if (siteId) {
      projects = projects.filter(p => p.siteId === siteId);
    }
    return projects;
  }

  getProjectKey(announcement) {
    if (announcement.projectNo) {
      return `proj:${announcement.projectNo}`;
    }
    if (announcement.title) {
      return this.extractProjectKeyFromTitle(announcement.title);
    }
    return null;
  }

  extractProjectKeyFromTitle(title) {
    if (!title) return null;

    const patterns = [
      /([A-Z]{2,}\d{4,}[-_]?\d+)/i,
      /项目编号[：:]\s*([^\s，。、；]+)/i,
      /采购编号[：:]\s*([^\s，。、；]+)/i
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return `proj:${match[1].toUpperCase()}`;
      }
    }

    const normalized = title
      .replace(/变更公告|答疑|补遗|澄清|修改|更正/g, '')
      .replace(/（.+?）|\(.+?\)/g, '')
      .trim()
      .substring(0, 50);

    if (normalized.length > 10) {
      return `title:${normalized}`;
    }

    return null;
  }

  isTracked(announcement) {
    const key = this.getProjectKey(announcement);
    return key ? this.trackedProjects.has(key) : false;
  }

  getStats() {
    const total = this.trackedProjects.size;
    const withChanges = Array.from(this.trackedProjects.values()).filter(p => (p.changeCount || 0) > 0).length;

    return {
      totalTracked: total,
      withChanges,
      totalChanges: this.changeHistory.length
    };
  }
}

const changeTracker = new ChangeTracker();

export default changeTracker;
export { ChangeTracker };
