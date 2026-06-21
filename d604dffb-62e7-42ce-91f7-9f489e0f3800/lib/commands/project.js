import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import {
  validateProjectName,
  validatePath,
  validateProjectStatus,
  validateDateRange
} from '../utils/validator.js';
import {
  renderTable,
  renderPaginatedTable,
  renderSuccess,
  renderError,
  renderWarning,
  renderInfo,
  renderHeader,
  renderDivider,
  formatProjectStatus,
  formatDate,
  formatFileSize,
  saveCSV
} from '../utils/formatter.js';
import {
  loadProjects,
  addProject,
  getProjectById,
  getProjectByName,
  updateProject,
  addActivity
} from '../utils/store.js';
import { analyzeProjectStorage } from '../services/storage-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../../config/default.json');
const config = await fs.readJson(configPath);

const BASE_STORAGE_PATH = path.resolve(__dirname, '../../projects');
const ARCHIVE_PATH = path.resolve(__dirname, '../../archives');

function getProjectPath(project) {
  return project.storagePath || path.join(BASE_STORAGE_PATH, project.id);
}

function createProjectStructure(projectPath) {
  fs.ensureDirSync(projectPath);
  const layers = Object.keys(config.directoryStructure);
  layers.forEach(layer => {
    fs.ensureDirSync(path.join(projectPath, layer));
  });
  fs.ensureDirSync(path.join(projectPath, '.versions'));
  const manifest = {
    createdAt: new Date().toISOString(),
    structure: layers,
    configVersion: config.version || '1.0.0'
  };
  fs.writeFileSync(
    path.join(projectPath, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
}

export async function createProjectCmd(options) {
  renderHeader('创建新项目');
  const nameResult = validateProjectName(options.name);
  if (!nameResult.valid) {
    renderError({ code: nameResult.code, error: nameResult.error, suggestion: '请使用2-50个字符的名称，支持中文、英文、数字' });
    return null;
  }
  const existing = getProjectByName(options.name);
  if (existing) {
    renderError({ code: 'E101', error: `项目名称已存在: ${options.name}`, suggestion: '请使用不同的项目名称，或先删除同名项目' });
    return null;
  }
  let storagePath = options.path;
  if (!storagePath) {
    const safeName = options.name.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    storagePath = path.join(BASE_STORAGE_PATH, safeName);
  } else {
    const pathResult = validatePath(storagePath);
    if (!pathResult.valid) {
      renderError({ code: pathResult.code, error: pathResult.error });
      return null;
    }
    storagePath = path.resolve(storagePath);
  }
  if (fs.existsSync(storagePath) && fs.readdirSync(storagePath).length > 0) {
    if (!options.force) {
      renderError({
        code: 'E102',
        error: `目标目录已存在且非空: ${storagePath}`,
        suggestion: '使用 --force 强制覆盖，或指定其他目录'
      });
      return null;
    }
  }
  if (options.status) {
    const statusResult = validateProjectStatus(options.status);
    if (!statusResult.valid) {
      renderError({ code: statusResult.code, error: statusResult.error });
      return null;
    }
  }
  const projectData = {
    name: options.name,
    description: options.description || '',
    client: options.client || '',
    supervisor: options.supervisor || '',
    crewCount: options.crewCount || 0,
    startDate: options.startDate || new Date().toISOString().slice(0, 10),
    deadline: options.deadline || '',
    status: options.status || 'preparation',
    storagePath,
    materialCount: 0,
    teamMembers: []
  };
  const project = addProject(projectData);
  createProjectStructure(storagePath);
  addActivity(project.id, {
    type: 'project_created',
    description: `创建项目: ${options.name}`,
    actor: options.supervisor || 'system'
  });
  renderSuccess(`项目创建成功: ${project.name}`);
  console.log();
  renderProjectDetails(project);
  return project;
}

export async function archiveProjectCmd(projectId, options) {
  renderHeader('归档项目');
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E103', error: `找不到项目: ${projectId}`, suggestion: '使用 "project list" 查看所有项目' });
    return false;
  }
  const projectPath = getProjectPath(project);
  if (!fs.existsSync(projectPath)) {
    renderWarning(`项目目录不存在: ${projectPath}`);
  }
  fs.ensureDirSync(ARCHIVE_PATH);
  const safeName = project.name.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  const archiveFileName = `${safeName}_${timestamp}_${project.id.slice(-6)}.tar.gz`;
  const archivePath = options.output
    ? path.resolve(options.output)
    : path.join(ARCHIVE_PATH, archiveFileName);
  const manifest = {
    projectId: project.id,
    projectName: project.name,
    archivedAt: new Date().toISOString(),
    archivedBy: options.actor || 'system',
    materialCount: project.materials?.length || 0,
    feedbackCount: project.feedback?.length || 0,
    status: project.status,
    note: options.note || ''
  };
  if (projectPath && fs.existsSync(projectPath)) {
    fs.writeFileSync(
      path.join(projectPath, 'archive_manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
  }
  renderInfo(`正在归档项目: ${project.name}`);
  renderInfo(`归档路径: ${archivePath}`);
  const materialListPath = path.join(ARCHIVE_PATH, `${safeName}_${timestamp}_清单.csv`);
  const headers = ['素材ID', '名称', '类型', '场次', '镜头', '状态', '文件大小', '时长(秒)', '创建时间'];
  const rows = (project.materials || []).map(m => [
    m.id, m.name, m.type, m.scene || '-', m.shot || '-',
    m.status, formatFileSize(m.metadata?.fileSize || 0),
    (m.metadata?.duration || 0).toFixed(2), formatDate(m.createdAt)
  ]);
  saveCSV(materialListPath, headers, rows);
  updateProject(project.id, {
    status: 'archived',
    archivePath,
    archivedAt: manifest.archivedAt,
    materialListPath
  });
  addActivity(project.id, {
    type: 'project_archived',
    description: `项目归档: ${archivePath}`,
    actor: options.actor || 'system'
  });
  renderSuccess(`项目归档完成: ${project.name}`);
  renderInfo(`归档清单已保存: ${materialListPath}`);
  if (!options.keepData && projectPath && fs.existsSync(projectPath)) {
    if (options.deleteOriginal) {
      fs.removeSync(projectPath);
      renderInfo(`项目原目录已删除: ${projectPath}`);
    }
  }
  return true;
}

export async function getProjectStatusCmd(projectId, options) {
  renderHeader(`项目状态 - ${projectId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E103', error: `找不到项目: ${projectId}` });
    return null;
  }
  renderProjectDetails(project);
  if (options.withStorage) {
    renderDivider();
    console.log(chalk.cyan.bold('  存储分析:'));
    try {
      const storage = analyzeProjectStorage(getProjectPath(project));
      const rows = Object.entries(storage.layers).map(([key, layer]) => [
        layer.label,
        layer.totalFiles || 0,
        formatFileSize(layer.totalSize || 0)
      ]);
      renderTable(['层级', '文件数', '占用空间'], rows);
      console.log();
      renderInfo(`总存储占用: ${storage.totalSizeGB}GB，状态: ${storage.alert}`);
    } catch (e) {
      renderWarning(`存储分析失败: ${e.message}`);
    }
  }
  if (options.withProgress) {
    renderDivider();
    console.log(chalk.cyan.bold('  进度统计:'));
    const materials = project.materials || [];
    const statusCounts = {};
    let totalDuration = 0;
    let totalSize = 0;
    Object.keys(config.materialStatus).forEach(s => statusCounts[s] = 0);
    materials.forEach(m => {
      statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
      totalDuration += m.metadata?.duration || 0;
      totalSize += m.metadata?.fileSize || 0;
    });
    const completed = statusCounts.confirmed || 0;
    const pct = materials.length > 0 ? ((completed / materials.length) * 100).toFixed(2) : '0.00';
    const progressRows = Object.entries(statusCounts).map(([s, c]) => [
      formatProjectStatus(s) === s ? s : formatProjectStatus(s), c
    ]);
    renderTable(['状态', '素材数量'], progressRows);
    console.log();
    console.log(chalk.green(`  完成进度: ${pct}% (${completed}/${materials.length})`));
    console.log(chalk.blue(`  总素材数: ${materials.length}，总时长: ${(totalDuration / 60).toFixed(2)}分钟，总大小: ${formatFileSize(totalSize)}`));
  }
  return project;
}

export function listProjectsCmd(options) {
  renderHeader('项目列表');
  let projects = loadProjects().projects;
  if (options.name) {
    const kw = options.name.toLowerCase();
    projects = projects.filter(p => p.name.toLowerCase().includes(kw));
  }
  if (options.status) {
    const statusResult = validateProjectStatus(options.status);
    if (!statusResult.valid) {
      renderError({ code: statusResult.code, error: statusResult.error });
      return;
    }
    projects = projects.filter(p => p.status === options.status);
  }
  if (options.startDate || options.endDate) {
    const dateResult = validateDateRange(options.startDate, options.endDate);
    if (!dateResult.valid) {
      renderError({ code: dateResult.code, error: dateResult.error });
      return;
    }
    if (options.startDate) {
      const sd = new Date(options.startDate);
      projects = projects.filter(p => new Date(p.createdAt) >= sd);
    }
    if (options.endDate) {
      const ed = new Date(options.endDate);
      ed.setHours(23, 59, 59);
      projects = projects.filter(p => new Date(p.createdAt) <= ed);
    }
  }
  if (options.sort === 'date') {
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (options.sort === 'name') {
    projects.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  } else if (options.sort === 'status') {
    const order = ['preparation', 'production', 'mixing', 'delivery', 'archived'];
    projects.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  }
  if (projects.length === 0) {
    renderInfo('暂无匹配的项目');
    return;
  }
  const rows = projects.map(p => [
    p.id.slice(0, 10),
    p.name,
    formatProjectStatus(p.status),
    p.materials?.length || 0,
    p.client || '-',
    formatDate(p.createdAt)
  ]);
  const headers = ['ID', '项目名称', '状态', '素材数', '客户', '创建时间'];
  if (options.page !== undefined) {
    renderPaginatedTable(headers, rows, { page: options.page, pageSize: options.pageSize });
  } else {
    renderPaginatedTable(headers, rows, { pageSize: options.pageSize });
  }
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    const csvRows = projects.map(p => [
      p.id, p.name, p.status, p.materials?.length || 0, p.client || '',
      p.description || '', p.startDate || '', p.deadline || '',
      p.supervisor || '', formatDate(p.createdAt), formatDate(p.updatedAt)
    ]);
    const csvHeaders = ['ID', '名称', '状态', '素材数', '客户', '描述', '开始日期', '截止日期', '负责人', '创建时间', '更新时间'];
    saveCSV(csvPath, csvHeaders, csvRows);
    renderSuccess(`CSV已导出: ${csvPath}`);
  }
}

export async function updateProjectStatusCmd(projectId, status, options) {
  renderHeader('更新项目状态');
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E103', error: `找不到项目: ${projectId}` });
    return null;
  }
  const statusResult = validateProjectStatus(status);
  if (!statusResult.valid) {
    renderError({ code: statusResult.code, error: statusResult.error });
    return null;
  }
  const oldStatus = project.status;
  const updated = updateProject(projectId, { status });
  addActivity(projectId, {
    type: 'status_changed',
    description: `状态变更: ${oldStatus} → ${status}${options.reason ? ` (${options.reason})` : ''}`,
    actor: options.actor || 'system'
  });
  renderSuccess(`状态已更新: ${formatProjectStatus(oldStatus)} → ${formatProjectStatus(status)}`);
  return updated;
}

export function renderProjectDetails(project) {
  const projectPath = getProjectPath(project);
  const materials = project.materials || [];
  const info = [
    ['项目ID', project.id],
    ['项目名称', project.name],
    ['状态', formatProjectStatus(project.status)],
    ['客户', project.client || '-'],
    ['声音总监', project.supervisor || '-'],
    ['开始日期', project.startDate || '-'],
    ['截止日期', project.deadline || '-'],
    ['描述', project.description || '-'],
    ['存储路径', projectPath],
    ['素材总数', materials.length],
    ['反馈数', project.feedback?.length || 0],
    ['团队人数', project.teamMembers?.length || 0],
    ['创建时间', formatDate(project.createdAt)],
    ['更新时间', formatDate(project.updatedAt)]
  ];
  renderTable(['属性', '值'], info, { colWidths: [15, 60] });
}
