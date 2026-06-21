import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import {
  validateMaterialStatus,
  validateTimecode,
  validateEmail
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
  formatStatus,
  formatFeedbackStatus,
  formatMaterialType,
  formatDuration,
  formatFileSize,
  formatDate,
  saveCSV
} from '../utils/formatter.js';
import {
  getProjectById,
  getMaterial,
  updateMaterial,
  findMaterials,
  addActivity,
  addFeedback,
  findFeedback,
  updateFeedback
} from '../utils/store.js';
import {
  createVersion,
  getVersionList,
  getVersion,
  compareVersions,
  rollbackVersion
} from '../services/version-control.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProjectStoragePath(project) {
  return project.storagePath || path.resolve(__dirname, '../../projects', project.id);
}

export async function submitVersionCmd(projectId, materialId, options) {
  renderHeader(`提交版本 - 项目: ${projectId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  const material = getMaterial(projectId, materialId);
  if (!material) {
    renderError({ code: 'E302', error: `找不到素材: ${materialId}` });
    return null;
  }
  const projectPath = getProjectStoragePath(project);
  const filePath = options.sourcePath || material.filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    renderError({ code: 'E303', error: `素材文件不存在: ${filePath}`, suggestion: '使用 --source-path 指定文件路径' });
    return null;
  }
  renderInfo(`素材: ${material.name}`);
  renderInfo(`源文件: ${filePath}`);
  const result = await createVersion(projectPath, material, {
    modifiedBy: options.modifiedBy || 'system',
    changeNote: options.note || '',
    sourceFilePath: filePath
  });
  if (result.skipped) {
    renderWarning('版本未变更，已跳过');
    renderInfo(`当前版本: v${result.version.number}`);
    return result;
  }
  const updates = {
    versions: (material.versions || 0) + 1
  };
  if (options.newStatus) {
    const sr = validateMaterialStatus(options.newStatus);
    if (sr.valid) {
      updates.status = options.newStatus;
    }
  } else if (!options.keepStatus) {
    updates.status = 'review';
  }
  const updatedMaterial = updateMaterial(projectId, materialId, updates);
  addActivity(projectId, {
    type: 'version_submitted',
    description: `[${material.name}] 提交版本 v${result.version.number}${options.note ? ` - ${options.note}` : ''}`,
    actor: options.modifiedBy || 'system',
    materialId,
    versionId: result.version.id,
    versionNumber: result.version.number
  });
  renderSuccess(`版本提交成功: v${result.version.number}`);
  renderInfo(`版本ID: ${result.version.id}`);
  renderInfo(`耗时: ${result.elapsed}ms`);
  if (result.versionsCount) {
    renderInfo(`总版本数: ${result.versionsCount}`);
  }
  const v = result.version;
  if (v.metadata) {
    const info = [
      ['采样率', `${v.metadata.sampleRate} Hz`],
      ['位深', `${v.metadata.bitsPerSample} bit`],
      ['声道', v.metadata.numChannels === 1 ? '单声道' : v.metadata.numChannels === 2 ? '立体声' : `${v.metadata.numChannels}声道`],
      ['时长', formatDuration(v.metadata.duration)],
      ['大小', formatFileSize(v.fileSize)]
    ];
    renderTable(['属性', '值'], info, { colWidths: [15, 40] });
  }
  return { version: result.version, material: updatedMaterial };
}

export function listVersionsCmd(projectId, materialId, options) {
  renderHeader(`版本历史 - 素材: ${materialId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return;
  }
  const material = getMaterial(projectId, materialId);
  if (!material) {
    renderError({ code: 'E302', error: `找不到素材: ${materialId}` });
    return;
  }
  const projectPath = getProjectStoragePath(project);
  const versions = getVersionList(projectPath, materialId);
  if (versions.length === 0) {
    renderInfo('暂无版本历史');
    return;
  }
  const rows = versions.map(v => [
    `v${v.number}${v.id === (options.currentId || '') ? ' ←当前' : ''}`,
    v.id.slice(0, 12),
    formatDate(v.createdAt),
    v.createdBy,
    (v.changeNote || '').substring(0, 40),
    formatDuration(v.metadata?.duration || 0),
    formatFileSize(v.fileSize)
  ]);
  renderTable(['版本', 'ID', '创建时间', '修改人', '变更说明', '时长', '大小'], rows);
}

export async function compareVersionsCmd(projectId, materialId, versionId1, versionId2, options) {
  renderHeader(`版本对比`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  const projectPath = getProjectStoragePath(project);
  const result = compareVersions(projectPath, materialId, versionId1, versionId2);
  if (result.error) {
    renderError({ code: 'E304', error: result.error });
    return null;
  }
  const info = [
    ['版本A', `v${result.version1.number} (${result.version1.createdBy}) - ${formatDate(result.version1.createdAt)}`],
    ['版本B', `v${result.version2.number} (${result.version2.createdBy}) - ${formatDate(result.version2.createdAt)}`],
    ['文件内容', result.hashMatch ? chalk.green('相同') : chalk.red('不同')],
    ['时长变化', result.durationChange === 0 ? '无变化' : chalk[result.durationChange > 0 ? 'green' : 'yellow'](`${result.durationChange > 0 ? '+' : ''}${result.durationChange.toFixed(3)}秒`)],
    ['大小变化', result.rawSizeDiff === 0 ? '无变化' : chalk[result.rawSizeDiff > 0 ? 'yellow' : 'green'](`${result.rawSizeDiff > 0 ? '+' : ''}${formatFileSize(result.rawSizeDiff)}`)]
  ];
  renderTable(['项目', '值'], info, { colWidths: [15, 60] });
  if (result.metadataDifferences.length > 0) {
    console.log();
    console.log(chalk.cyan.bold('  元数据差异:'));
    const diffRows = result.metadataDifferences.map(d => [
      d.field,
      String(d.oldValue),
      String(d.newValue)
    ]);
    renderTable(['字段', '旧值', '新值'], diffRows);
  } else if (result.hashMatch) {
    renderSuccess('两个版本完全相同');
  }
  return result;
}

export async function rollbackVersionCmd(projectId, materialId, targetVersionId, options) {
  renderHeader(`回滚版本`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  const material = getMaterial(projectId, materialId);
  if (!material) {
    renderError({ code: 'E302', error: `找不到素材: ${materialId}` });
    return null;
  }
  if (!options.confirm && !options.yes) {
    renderWarning(`即将回滚到版本: ${targetVersionId}`);
    renderInfo('使用 --yes 或 --confirm 确认执行');
    return null;
  }
  const projectPath = getProjectStoragePath(project);
  try {
    const result = await rollbackVersion(projectPath, materialId, targetVersionId, {
      restoredBy: options.actor || 'system',
      rollbackNote: options.note || '',
      deleteLaterVersions: options.deleteLater || false
    });
    addActivity(projectId, {
      type: 'version_rollback',
      description: `[${material.name}] 回滚到版本 v${result.targetVersion.number}`,
      actor: options.actor || 'system',
      materialId,
      rollbackTo: targetVersionId,
      newVersionId: result.rollbackVersion.id
    });
    updateMaterial(projectId, materialId, {
      versions: (material.versions || 0) + 1,
      status: options.newStatus || material.status
    });
    renderSuccess(`回滚成功: 创建新版本 v${result.rollbackVersion.number}`);
    renderInfo(`来源版本: v${result.targetVersion.number}`);
    if (result.sourceRestored) {
      renderInfo('工作目录文件已同步还原');
    }
    return result;
  } catch (e) {
    renderError({ code: 'E305', error: e.message });
    return null;
  }
}

export async function updateStatusCmd(projectId, materialIds, newStatus, options) {
  renderHeader(`状态更新`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  const sr = validateMaterialStatus(newStatus);
  if (!sr.valid) {
    renderError({ code: sr.code, error: sr.error });
    return null;
  }
  let targets = [];
  if (materialIds && materialIds.length > 0) {
    targets = materialIds.map(id => getMaterial(projectId, id)).filter(Boolean);
  } else {
    const filter = {};
    if (options.fromStatus) filter.status = options.fromStatus;
    if (options.type) filter.type = options.type;
    if (options.scene) filter.scene = options.scene;
    if (options.assignedTo) filter.assignedTo = options.assignedTo;
    targets = findMaterials(projectId, filter);
  }
  if (targets.length === 0) {
    renderWarning('没有符合条件的素材');
    return null;
  }
  if (targets.length > 1 && !options.yes && !options.confirm) {
    renderWarning(`将更新 ${targets.length} 个素材的状态`);
    renderInfo('使用 --yes 或 --confirm 确认执行');
    return null;
  }
  const results = { success: [], failed: [] };
  for (const m of targets) {
    try {
      const oldStatus = m.status;
      const updated = updateMaterial(projectId, m.id, { status: newStatus });
      results.success.push({ id: m.id, name: m.name, oldStatus, newStatus });
      addActivity(projectId, {
        type: 'material_status_changed',
        description: `[${m.name}] 状态变更: ${oldStatus} → ${newStatus}${options.reason ? ` (${options.reason})` : ''}`,
        actor: options.actor || 'system',
        materialId: m.id
      });
    } catch (e) {
      results.failed.push({ id: m.id, name: m.name, error: e.message });
    }
  }
  renderSuccess(`完成: 成功 ${results.success.length}，失败 ${results.failed.length}`);
  if (results.success.length > 0 && options.verbose) {
    const rows = results.success.map(r => [r.name, formatStatus(r.oldStatus) + ' → ' + formatStatus(r.newStatus)]);
    renderTable(['素材', '状态变更'], rows, { compact: true });
  }
  return results;
}

export async function addFeedbackCmd(projectId, options) {
  renderHeader(`添加审听反馈`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  if (!options.materialId) {
    renderError({ code: 'E306', error: '必须指定素材ID (--material-id)' });
    return null;
  }
  const material = getMaterial(projectId, options.materialId);
  if (!material) {
    renderError({ code: 'E302', error: `找不到素材: ${options.materialId}` });
    return null;
  }
  if (!options.content || options.content.trim() === '') {
    renderError({ code: 'E307', error: '反馈内容不能为空 (--content)' });
    return null;
  }
  const emailResult = validateEmail(options.authorEmail);
  if (!emailResult.valid) {
    renderError({ code: emailResult.code, error: emailResult.error });
    return null;
  }
  const timecodes = [];
  if (options.timecodes) {
    for (const tc of options.timecodes) {
      const parts = tc.split('|');
      const tr = validateTimecode(parts[0]);
      if (!tr.valid) {
        renderWarning(`无效时间码 ${parts[0]}: ${tr.error}`);
        continue;
      }
      timecodes.push({
        timecode: parts[0],
        description: parts[1] || ''
      });
    }
  }
  const feedback = addFeedback(projectId, {
    materialId: options.materialId,
    materialName: material.name,
    content: options.content,
    author: options.author || '客户',
    authorEmail: options.authorEmail || '',
    status: options.status || 'pending',
    priority: options.priority || 'normal',
    timecodes,
    source: options.source || 'manual'
  });
  if (options.autoSetRevision && material.status !== 'revision') {
    updateMaterial(projectId, options.materialId, { status: 'revision' });
  }
  addActivity(projectId, {
    type: 'feedback_added',
    description: `[${material.name}] 新增审听反馈`,
    actor: options.author || 'system',
    materialId: options.materialId,
    feedbackId: feedback.id
  });
  renderSuccess(`反馈已添加: ${feedback.id.slice(0, 10)}`);
  renderInfo(`素材: ${material.name}`);
  renderInfo(`状态: ${formatFeedbackStatus(feedback.status)}`);
  if (timecodes.length > 0) {
    console.log();
    console.log(chalk.cyan.bold('  时间码标记:'));
    timecodes.forEach(tc => console.log(chalk.gray(`    [${tc.timecode}] ${tc.description || options.content.substring(0, 30)}`)));
  }
  return feedback;
}

export function listFeedbackCmd(projectId, options) {
  renderHeader(`审听反馈列表 - 项目: ${projectId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return;
  }
  const filter = {};
  if (options.status) filter.status = options.status;
  if (options.materialId) filter.materialId = options.materialId;
  if (options.author) filter.author = options.author;
  const list = findFeedback(projectId, filter);
  if (list.length === 0) {
    renderInfo('暂无反馈记录');
    return;
  }
  const rows = list.map(f => [
    f.id.slice(0, 10),
    (f.materialName || f.materialId || '').substring(0, 20),
    formatFeedbackStatus(f.status),
    f.priority === 'high' ? chalk.red('高') : f.priority === 'low' ? chalk.gray('低') : '中',
    f.author || '-',
    f.timecodes?.length || 0,
    f.content.substring(0, 40),
    formatDate(f.createdAt)
  ]);
  renderPaginatedTable(rows,
    ['ID', '素材', '状态', '优先级', '提交人', '时间码', '内容', '创建时间'],
    { page: options.page, pageSize: options.pageSize }
  );
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    const csvHeaders = ['ID', '素材ID', '素材名称', '状态', '优先级', '提交人', '邮箱', '内容', '时间码', '创建时间', '更新时间'];
    const csvRows = list.map(f => [
      f.id, f.materialId, f.materialName || '', f.status, f.priority || 'normal',
      f.author || '', f.authorEmail || '', f.content,
      (f.timecodes || []).map(t => `${t.timecode}:${t.description}`).join('; '),
      formatDate(f.createdAt), formatDate(f.updatedAt || '')
    ]);
    saveCSV(csvPath, csvHeaders, csvRows);
    renderSuccess(`CSV已导出: ${csvPath}`);
  }
}

export function updateFeedbackStatusCmd(projectId, feedbackId, newStatus, options) {
  renderHeader('更新反馈状态');
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  const list = findFeedback(projectId, {});
  const feedback = list.find(f => f.id === feedbackId);
  if (!feedback) {
    renderError({ code: 'E308', error: `找不到反馈: ${feedbackId}` });
    return null;
  }
  const validStatuses = ['pending', 'resolved'];
  if (!validStatuses.includes(newStatus)) {
    renderError({ code: 'E309', error: `无效状态，有效值: ${validStatuses.join(', ')}` });
    return null;
  }
  const updated = updateFeedback(projectId, feedbackId, {
    status: newStatus,
    resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
    resolvedBy: options.actor || 'system',
    resolveNote: options.note || ''
  });
  addActivity(projectId, {
    type: 'feedback_status_changed',
    description: `反馈状态变更: ${feedback.status} → ${newStatus}`,
    actor: options.actor || 'system',
    feedbackId,
    materialId: feedback.materialId
  });
  if (newStatus === 'resolved' && feedback.materialId) {
    const mat = getMaterial(projectId, feedback.materialId);
    if (mat && mat.status === 'revision') {
      const remaining = findFeedback(projectId, { materialId: feedback.materialId, status: 'pending' }).length;
      if (remaining === 0) {
        updateMaterial(projectId, feedback.materialId, { status: 'editing' });
        renderInfo('关联素材状态已自动更新为「剪辑中」(所有待处理反馈已解决)');
      }
    }
  }
  renderSuccess(`反馈状态已更新: ${formatFeedbackStatus(feedback.status)} → ${formatFeedbackStatus(newStatus)}`);
  return updated;
}

export function exportRevisionListCmd(projectId, options) {
  renderHeader('导出待修改清单');
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E301', error: `找不到项目: ${projectId}` });
    return null;
  }
  const pendingFeedback = findFeedback(projectId, { status: 'pending' });
  const revisionMaterials = findMaterials(projectId, { status: 'revision' });
  const byMaterial = {};
  pendingFeedback.forEach(f => {
    if (!byMaterial[f.materialId]) {
      const mat = getMaterial(projectId, f.materialId);
      byMaterial[f.materialId] = {
        material: mat,
        feedback: []
      };
    }
    byMaterial[f.materialId].feedback.push(f);
  });
  const rows = Object.entries(byMaterial).map(([mid, data]) => {
    const mat = data.material || { name: '-', type: '-', scene: '-', shot: '-' };
    const feedbackList = data.feedback;
    const tcCount = feedbackList.reduce((s, f) => s + (f.timecodes?.length || 0), 0);
    return [
      mid.slice(0, 10),
      mat.name,
      formatMaterialType(mat.type),
      mat.scene || '-',
      mat.shot || '-',
      feedbackList.length,
      tcCount,
      feedbackList.map(f => f.content.substring(0, 20)).join('; ')
    ];
  });
  if (rows.length === 0) {
    renderInfo('暂无待修改项');
    return { count: 0 };
  }
  const headers = ['素材ID', '素材名称', '类型', '场次', '镜头', '反馈数', '时间码数', '反馈摘要'];
  renderTable(headers, rows);
  console.log();
  renderInfo(`共 ${Object.keys(byMaterial).length} 个素材需要修改，${pendingFeedback.length} 条待处理反馈`);
  const outputPath = options.output || path.resolve(__dirname, `../../待修改清单_${projectId}_${Date.now()}.csv`);
  const csvHeaders = ['素材ID', '素材名称', '类型', '场次', '镜头', '文件路径',
    '反馈ID', '反馈状态', '优先级', '提交人', '反馈内容', '时间码', '创建时间'];
  const csvRows = [];
  Object.entries(byMaterial).forEach(([mid, data]) => {
    const mat = data.material || {};
    data.feedback.forEach(f => {
      csvRows.push([
        mid, mat.name || '-', mat.type || '-', mat.scene || '-', mat.shot || '-',
        mat.filePath || '', f.id, f.status, f.priority || 'normal',
        f.author || '', f.content,
        (f.timecodes || []).map(t => `${t.timecode}:${t.description}`).join(' | '),
        formatDate(f.createdAt)
      ]);
    });
  });
  saveCSV(outputPath, csvHeaders, csvRows);
  renderSuccess(`待修改清单已导出: ${outputPath}`);
  return {
    materialCount: Object.keys(byMaterial).length,
    feedbackCount: pendingFeedback.length,
    outputPath
  };
}
