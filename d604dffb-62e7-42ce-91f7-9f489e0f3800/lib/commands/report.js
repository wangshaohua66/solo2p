import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import {
  renderTable,
  renderSuccess,
  renderError,
  renderWarning,
  renderInfo,
  renderHeader,
  renderDivider,
  renderProgressBar,
  formatStatus,
  formatProjectStatus,
  formatMaterialType,
  formatDuration,
  formatFileSize,
  formatDate,
  formatPercentage,
  saveCSV
} from '../utils/formatter.js';
import {
  loadProjects,
  getProjectById,
  findMaterials,
  findFeedback,
  getMaterial
} from '../utils/store.js';
import {
  analyzeProjectStorage,
  analyzeMultiProject,
  cleanupTempFiles,
  getStorageAlert
} from '../services/storage-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_STORAGE_PATH = path.resolve(__dirname, '../../projects');

function calculateProjectProgress(project) {
  const materials = project.materials || [];
  const total = materials.length;
  const statusCounts = {
    pending: 0, editing: 0, review: 0, confirmed: 0, revision: 0
  };
  let totalDuration = 0;
  let totalSize = 0;
  const typeStats = { dialogue: 0, ambience: 0, foley: 0, music: 0, other: 0 };
  const typeDuration = { dialogue: 0, ambience: 0, foley: 0, music: 0, other: 0 };
  materials.forEach(m => {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    totalDuration += m.metadata?.duration || 0;
    totalSize += m.metadata?.fileSize || 0;
    const t = m.type || 'other';
    typeStats[t] = (typeStats[t] || 0) + 1;
    typeDuration[t] += m.metadata?.duration || 0;
  });
  const completedWeighted =
    (statusCounts.pending || 0) * 0 +
    (statusCounts.editing || 0) * 0.35 +
    (statusCounts.review || 0) * 0.7 +
    (statusCounts.revision || 0) * 0.5 +
    (statusCounts.confirmed || 0) * 1.0;
  const progressPct = total > 0 ? (completedWeighted / total) * 100 : 0;
  const confirmedPct = total > 0 ? ((statusCounts.confirmed || 0) / total) * 100 : 0;
  return {
    total,
    statusCounts,
    totalDuration,
    totalSize,
    typeStats,
    typeDuration,
    progressPct: parseFloat(progressPct.toFixed(2)),
    confirmedPct: parseFloat(confirmedPct.toFixed(2)),
    inProgressCount: (statusCounts.editing || 0) + (statusCounts.review || 0),
    issueCount: statusCounts.revision || 0
  };
}

function calculateWorkloadStats(project) {
  const materials = project.materials || [];
  const byPerson = {};
  const byRole = { editor: {}, mixer: {}, foley_artist: {} };
  materials.forEach(m => {
    const assignee = m.assignedTo || '未分配';
    if (!byPerson[assignee]) {
      byPerson[assignee] = {
        person: assignee,
        total: 0,
        confirmed: 0,
        pending: 0,
        inProgress: 0,
        revision: 0,
        totalDuration: 0,
        totalSize: 0,
        byType: {}
      };
    }
    const stat = byPerson[assignee];
    stat.total++;
    stat.totalDuration += m.metadata?.duration || 0;
    stat.totalSize += m.metadata?.fileSize || 0;
    if (m.status === 'confirmed') stat.confirmed++;
    else if (m.status === 'pending') stat.pending++;
    else if (m.status === 'revision') stat.revision++;
    else stat.inProgress++;
    const t = m.type || 'other';
    stat.byType[t] = (stat.byType[t] || 0) + 1;
  });
  const sorted = Object.values(byPerson).sort((a, b) => b.total - a.total);
  return sorted;
}

export async function progressReportCmd(projectId, options) {
  renderHeader('项目进度报告');
  const startTime = Date.now();
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E401', error: `找不到项目: ${projectId}` });
    return null;
  }
  const stats = calculateProjectProgress(project);
  renderDivider();
  console.log(chalk.cyan.bold(`  项目: ${project.name}`));
  console.log(chalk.gray(`  状态: ${formatProjectStatus(project.status)}    创建: ${formatDate(project.createdAt)}`));
  renderDivider();
  console.log();
  console.log(chalk.cyan.bold('  总体进度:'));
  renderProgressBar(Math.round(stats.progressPct), 100);
  console.log();
  const overview = [
    ['素材总数', stats.total],
    ['已确认', chalk.green(`${stats.statusCounts.confirmed || 0} (${formatPercentage(stats.statusCounts.confirmed, stats.total)})`)],
    ['进行中', chalk.yellow(`${stats.inProgressCount} (${formatPercentage(stats.inProgressCount, stats.total)})`)],
    ['需修改', chalk.red(`${stats.issueCount} (${formatPercentage(stats.issueCount, stats.total)})`)],
    ['总时长', formatDuration(stats.totalDuration) + ` (${(stats.totalDuration / 60).toFixed(1)} 分钟)`],
    ['总大小', formatFileSize(stats.totalSize)]
  ];
  renderTable(['指标', '数值'], overview, { colWidths: [20, 50] });
  console.log();
  console.log(chalk.cyan.bold('  按状态分布:'));
  const statusRows = Object.entries(stats.statusCounts).map(([s, c]) => [
    formatStatus(s),
    c,
    formatPercentage(c, stats.total),
    Array(Math.round((c / (stats.total || 1)) * 30)).fill('█').join('')
  ]);
  renderTable(['状态', '数量', '占比', '分布图'], statusRows, { colWidths: [12, 10, 12, 38] });
  console.log();
  if (stats.total > 0) {
    console.log(chalk.cyan.bold('  按素材类型分布:'));
    const typeRows = Object.entries(stats.typeStats).map(([t, c]) => [
      formatMaterialType(t),
      c,
      formatPercentage(c, stats.total),
      formatDuration(stats.typeDuration[t] || 0)
    ]);
    renderTable(['类型', '数量', '占比', '时长'], typeRows);
    console.log();
  }
  if (options.groupByScene) {
    console.log(chalk.cyan.bold('  按场次进度:'));
    const byScene = {};
    (project.materials || []).forEach(m => {
      const scene = m.scene || '未知';
      if (!byScene[scene]) byScene[scene] = { total: 0, confirmed: 0 };
      byScene[scene].total++;
      if (m.status === 'confirmed') byScene[scene].confirmed++;
    });
    const sceneRows = Object.entries(byScene)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([scene, s]) => [
        scene,
        s.total,
        s.confirmed,
        `${formatPercentage(s.confirmed, s.total)}`
      ]);
    renderPaginatedTable(['场次', '总数', '已确认', '完成率'], sceneRows, { pageSize: 50 });
    console.log();
  }
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    const csvHeaders = ['指标', '数值', '备注'];
    const csvRows = [];
    csvRows.push(['项目名称', project.name, '']);
    csvRows.push(['项目状态', project.status, '']);
    csvRows.push(['素材总数', stats.total, '']);
    csvRows.push(['总体进度(%)', stats.progressPct, '加权计算']);
    csvRows.push(['确认进度(%)', stats.confirmedPct, '']);
    csvRows.push(['总时长(秒)', stats.totalDuration.toFixed(2), '']);
    csvRows.push(['总大小(字节)', stats.totalSize, '']);
    Object.entries(stats.statusCounts).forEach(([s, c]) => {
      csvRows.push([`状态-${s}`, c, formatStatus(s) + ' 数量']);
    });
    Object.entries(stats.typeStats).forEach(([t, c]) => {
      csvRows.push([`类型-${t}`, c, formatMaterialType(t) + ' 数量']);
    });
    saveCSV(csvPath, csvHeaders, csvRows);
    renderSuccess(`CSV进度报告已导出: ${csvPath}`);
  }
  renderInfo(`统计耗时: ${Date.now() - startTime}ms`);
  return stats;
}

export async function workloadReportCmd(projectId, options) {
  renderHeader('工作量统计报告');
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E401', error: `找不到项目: ${projectId}` });
    return null;
  }
  const workloads = calculateWorkloadStats(project);
  if (workloads.length === 0) {
    renderInfo('暂无工作量数据');
    return null;
  }
  const rows = workloads.map(w => {
    const pct = workloads.length > 0 ? formatPercentage(w.confirmed, w.total) : '0.00%';
    return [
      w.person,
      w.total,
      chalk.green(String(w.confirmed)),
      chalk.yellow(String(w.inProgress)),
      chalk.gray(String(w.pending)),
      w.revision > 0 ? chalk.red(String(w.revision)) : '0',
      pct,
      formatDuration(w.totalDuration),
      formatFileSize(w.totalSize)
    ];
  });
  const headers = ['人员', '总数', '已确认', '进行中', '待处理', '需修改', '完成率', '总时长', '总大小'];
  renderTable(headers, rows);
  console.log();
  const totals = {
    total: workloads.reduce((s, w) => s + w.total, 0),
    confirmed: workloads.reduce((s, w) => s + w.confirmed, 0),
    duration: workloads.reduce((s, w) => s + w.totalDuration, 0),
    size: workloads.reduce((s, w) => s + w.totalSize, 0)
  };
  const summary = [
    ['参与人数', workloads.length],
    ['任务总数', totals.total],
    ['总确认数', `${totals.confirmed} (${formatPercentage(totals.confirmed, totals.total)})`],
    ['总工作量时长', formatDuration(totals.duration) + ` (${(totals.duration / 60).toFixed(1)} 分钟)`],
    ['总素材大小', formatFileSize(totals.size)]
  ];
  renderTable(['汇总指标', '值'], summary, { colWidths: [20, 50] });
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    const csvHeaders = ['人员', '任务总数', '已确认', '进行中', '待处理', '需修改', '完成率(%)',
      '总时长(秒)', '总大小(字节)'];
    const csvRows = workloads.map(w => [
      w.person, w.total, w.confirmed, w.inProgress, w.pending, w.revision,
      w.total > 0 ? ((w.confirmed / w.total) * 100).toFixed(2) : '0.00',
      w.totalDuration.toFixed(2), w.totalSize
    ]);
    saveCSV(csvPath, csvHeaders, csvRows);
    renderSuccess(`CSV工作量报告已导出: ${csvPath}`);
  }
  return workloads;
}

export async function storageReportCmd(projectId, options) {
  renderHeader('存储占用报告');
  if (projectId === 'all' || !projectId) {
    const data = loadProjects();
    renderInfo(`分析 ${data.projects.length} 个项目的存储占用...`);
    const result = analyzeMultiProject(data.projects, BASE_STORAGE_PATH);
    renderDivider();
    const summary = [
      ['项目总数', data.projects.length],
      ['已分析项目', result.analyzedProjectCount],
      ['文件总数', result.totalFiles],
      ['总占用空间', `${result.totalSizeGB} GB (${formatFileSize(result.totalSize)})`],
      ['警告阈值', `${result.thresholds.warningGB.toFixed(1)} GB`],
      ['临界阈值', `${result.thresholds.criticalGB.toFixed(1)} GB`],
      ['存储状态', result.alert === 'normal' ? chalk.green('正常')
        : result.alert === 'warning' ? chalk.yellow('警告')
        : chalk.red('严重')]
    ];
    renderTable(['指标', '值'], summary, { colWidths: [20, 50] });
    console.log();
    if (result.projectRankings.length > 0) {
      console.log(chalk.cyan.bold('  项目占用排行 (Top 15):'));
      const topRows = result.projectRankings.slice(0, 15).map((r, i) => [
        i + 1,
        r.projectName,
        `${r.sizeGB.toFixed(2)} GB`,
        r.alert === 'normal' ? chalk.green('正常')
          : r.alert === 'warning' ? chalk.yellow('警告')
          : chalk.red('严重'),
        Array(Math.min(30, Math.round(r.sizeGB / (result.projectRankings[0].sizeGB || 1) * 30))).fill('█').join('')
      ]);
      renderTable(['#', '项目名称', '大小', '状态', '分布'], topRows);
    }
    if (options.cleanupTemp) {
      console.log();
      renderInfo('正在清理临时文件...');
      let totalFreed = 0;
      data.projects.forEach(p => {
        const pPath = p.storagePath || path.join(BASE_STORAGE_PATH, p.id);
        if (fs.existsSync(pPath)) {
          const clean = cleanupTempFiles(pPath, { daysOld: options.daysOld || 7, dryRun: !options.forceCleanup });
          totalFreed += clean.dryRun ? clean.wouldFreeBytes : clean.freedBytes;
        }
      });
      renderSuccess(options.forceCleanup
        ? `清理完成，释放空间: ${formatFileSize(totalFreed)}`
        : `[预览] 可释放空间: ${formatFileSize(totalFreed)}，使用 --force-cleanup 确认执行`);
    }
    if (options.csv) {
      const csvPath = path.resolve(options.csv);
      const csvHeaders = ['项目ID', '项目名称', '大小(GB)', '告警级别'];
      const csvRows = result.projectRankings.map(r =>
        [r.projectId, r.projectName, r.sizeGB.toFixed(2), r.alert]
      );
      saveCSV(csvPath, csvHeaders, csvRows);
      renderSuccess(`CSV存储报告已导出: ${csvPath}`);
    }
    return result;
  }
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E401', error: `找不到项目: ${projectId}` });
    return null;
  }
  const projectPath = project.storagePath || path.join(BASE_STORAGE_PATH, projectId);
  const storage = analyzeProjectStorage(projectPath);
  renderInfo(`项目: ${project.name}`);
  renderDivider();
  const summary = [
    ['总占用', `${storage.totalSizeGB} GB`],
    ['存储状态', storage.alert === 'normal' ? chalk.green('正常')
      : storage.alert === 'warning' ? chalk.yellow('警告')
      : chalk.red('严重')],
    ['警告阈值', `${storage.thresholds.warningGB} GB`],
    ['临界阈值', `${storage.thresholds.criticalGB} GB`]
  ];
  renderTable(['指标', '值'], summary, { colWidths: [20, 40] });
  console.log();
  console.log(chalk.cyan.bold('  按目录层级:'));
  const layerRows = Object.entries(storage.layers).map(([key, layer]) => [
    layer.label,
    layer.totalFiles || 0,
    formatFileSize(layer.totalSize || 0),
    layer.exists === false ? chalk.gray('未创建') : layer.error ? chalk.red('错误') : ''
  ]);
  renderTable(['目录层级', '文件数', '占用空间', '备注'], layerRows);
  console.log();
  console.log(chalk.cyan.bold('  按素材类型:'));
  const typeBreakdown = storage.materialBreakdown;
  const typeRows = Object.entries(typeBreakdown.byCount).map(([t, c]) => [
    formatMaterialType(t),
    c,
    formatPercentage(c, typeBreakdown.totalCount),
    formatFileSize(typeBreakdown.bySize[t] || 0),
    formatPercentage(typeBreakdown.bySize[t] || 0, typeBreakdown.totalSize)
  ]);
  renderTable(['类型', '数量', '数量占比', '空间', '空间占比'], typeRows);
  if (options.cleanupTemp && projectPath) {
    console.log();
    renderInfo('检查临时文件...');
    const alert = getStorageAlert(projectPath);
    renderInfo(alert.message);
    const clean = cleanupTempFiles(projectPath, { daysOld: options.daysOld || 7, dryRun: !options.forceCleanup });
    renderSuccess(options.forceCleanup
      ? `清理完成: 删除 ${clean.deletedCount} 个文件，释放 ${formatFileSize(clean.freedBytes)}`
      : `[预览] 可删除 ${clean.targetCount} 个过期临时文件，约释放 ${formatFileSize(clean.wouldFreeBytes)}，使用 --force-cleanup 确认`);
  }
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    const csvHeaders = ['目录层级', '标签', '文件数', '大小(字节)'];
    const csvRows = Object.entries(storage.layers).map(([k, l]) =>
      [k, l.label, l.totalFiles || 0, l.totalSize || 0]
    );
    saveCSV(csvPath, csvHeaders, csvRows);
    renderSuccess(`CSV存储报告已导出: ${csvPath}`);
  }
  return storage;
}

export async function comprehensiveReportCmd(projectId, options) {
  renderHeader('综合报表');
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E401', error: `找不到项目: ${projectId}` });
    return null;
  }
  renderInfo(`生成 ${project.name} 的综合报表...`);
  const progress = calculateProjectProgress(project);
  const workloads = calculateWorkloadStats(project);
  const projectPath = project.storagePath || path.join(BASE_STORAGE_PATH, projectId);
  let storage = null;
  try { storage = analyzeProjectStorage(projectPath); } catch (e) { /* ignore */ }
  const pendingFeedback = findFeedback(projectId, { status: 'pending' });
  const allFeedback = findFeedback(projectId, {});
  console.log();
  renderDivider('=');
  console.log(chalk.cyan.bold(`\n  综合报表 - ${project.name}`));
  console.log(chalk.gray(`  生成时间: ${formatDate(new Date().toISOString())}`));
  renderDivider('=');
  console.log();
  console.log(chalk.cyan.bold('  【一、项目概况】'));
  renderTable(['', ''], [
    ['项目ID', project.id],
    ['客户', project.client || '-'],
    ['声音总监', project.supervisor || '-'],
    ['开始日期', project.startDate || '-'],
    ['截止日期', project.deadline || '-'],
    ['当前状态', formatProjectStatus(project.status)],
    ['团队成员', (project.teamMembers?.length || 0) + ' 人'],
    ['素材总数', progress.total + ' 条'],
    ['反馈总数', allFeedback.length + ` 条 (待处理 ${pendingFeedback.length})`]
  ], { colWidths: [20, 60] });
  console.log();
  console.log(chalk.cyan.bold('  【二、完成进度】'));
  renderProgressBar(Math.round(progress.progressPct), 100);
  console.log(chalk.green(`    加权完成率: ${progress.progressPct}%，确认完成率: ${progress.confirmedPct}%`));
  console.log();
  console.log(chalk.cyan.bold('  【三、工作量概览】'));
  const wl = workloads.slice(0, 10).map(w => [
    w.person, w.total, w.confirmed, formatDuration(w.totalDuration)
  ]);
  renderTable(['人员', '任务数', '已确认', '处理时长'], wl);
  console.log();
  if (storage) {
    console.log(chalk.cyan.bold('  【四、存储情况】'));
    console.log(`    总占用: ${storage.totalSizeGB} GB，状态: ${
      storage.alert === 'normal' ? chalk.green('正常')
      : storage.alert === 'warning' ? chalk.yellow('警告')
      : chalk.red('严重')}`);
  }
  if (pendingFeedback.length > 0) {
    console.log();
    console.log(chalk.cyan.bold('  【五、待处理反馈】'));
    console.log(chalk.red(`    共 ${pendingFeedback.length} 条待处理反馈需要跟进`));
  }
  const outputDir = options.outputDir || path.resolve(__dirname, '../../reports');
  fs.ensureDirSync(outputDir);
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = project.name.replace(/[^\w\u4e00-\u9fa5]/g, '_');
  if (options.exportAll) {
    const progressCSV = path.join(outputDir, `${safeName}_${timestamp}_进度.csv`);
    const workloadCSV = path.join(outputDir, `${safeName}_${timestamp}_工作量.csv`);
    const storageCSV = path.join(outputDir, `${safeName}_${timestamp}_存储.csv`);
    const feedbackCSV = path.join(outputDir, `${safeName}_${timestamp}_反馈.csv`);
    progressReportCmd(projectId, { csv: progressCSV });
    workloadReportCmd(projectId, { csv: workloadCSV });
    storageReportCmd(projectId, { csv: storageCSV });
    const fbHeaders = ['反馈ID', '素材ID', '素材名称', '状态', '优先级', '提交人', '内容', '创建时间'];
    const fbRows = allFeedback.map(f => [
      f.id, f.materialId, f.materialName || '-', f.status, f.priority || 'normal',
      f.author || '-', f.content, formatDate(f.createdAt)
    ]);
    saveCSV(feedbackCSV, fbHeaders, fbRows);
    console.log();
    renderDivider();
    renderSuccess(`综合报表已导出到: ${outputDir}`);
  }
  return {
    project, progress, workloads, storage,
    feedback: { total: allFeedback.length, pending: pendingFeedback.length }
  };
}
