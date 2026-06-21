#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const configPath = path.join(ROOT_DIR, 'config', 'default.json');
const config = await fs.readJson(configPath);

import {
  createProjectCmd,
  archiveProjectCmd,
  getProjectStatusCmd,
  listProjectsCmd,
  updateProjectStatusCmd
} from '../lib/commands/project.js';

import {
  importMaterialsCmd,
  listMaterialsCmd,
  getMaterialDetailCmd,
  batchRenameCmd,
  deleteMaterialCmd
} from '../lib/commands/material.js';

import {
  submitVersionCmd,
  listVersionsCmd,
  compareVersionsCmd,
  rollbackVersionCmd,
  updateStatusCmd,
  addFeedbackCmd,
  listFeedbackCmd,
  updateFeedbackStatusCmd,
  exportRevisionListCmd
} from '../lib/commands/workflow.js';

import {
  progressReportCmd,
  workloadReportCmd,
  storageReportCmd,
  comprehensiveReportCmd
} from '../lib/commands/report.js';

import {
  loadProjects,
  getProjectById,
  getProjectByName
} from '../lib/utils/store.js';

import {
  renderHeader,
  renderError,
  renderSuccess,
  renderInfo,
  renderDivider
} from '../lib/utils/formatter.js';

const program = new Command();

program
  .name('audio-pm')
  .description(chalk.cyan('🎬 影视后期声音制作项目管理系统'))
  .version('1.0.0', '-v, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息')
  .configureOutput({
    outputError: (str, write) => write(chalk.red(str))
  });

const project = program.command('project')
  .description(chalk.cyan('📁 项目管理'));

project.command('create')
  .description('创建新项目')
  .requiredOption('-n, --name <name>', '项目名称 (2-50字符)')
  .option('-d, --description <text>', '项目描述')
  .option('-c, --client <name>', '客户名称')
  .option('-s, --supervisor <name>', '声音总监')
  .option('-p, --path <dir>', '项目存储路径，默认自动创建')
  .option('-S, --status <status>', '初始状态: preparation|production|mixing|delivery|archived')
  .option('--start-date <date>', '开始日期 YYYY-MM-DD')
  .option('--deadline <date>', '截止日期 YYYY-MM-DD')
  .option('--crew-count <n>', '团队人数', parseInt)
  .option('-f, --force', '强制覆盖已存在的目录')
  .action(async (opts) => {
    try { await createProjectCmd(opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

project.command('archive')
  .description('归档项目')
  .argument('<projectId>', '项目ID')
  .option('-o, --output <path>', '归档输出路径')
  .option('-a, --actor <name>', '操作人')
  .option('-n, --note <text>', '归档备注')
  .option('--delete-original', '归档后删除原目录')
  .option('--keep-data', '保留项目数据')
  .action(async (id, opts) => {
    try { await archiveProjectCmd(id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

project.command('status')
  .description('查看项目状态')
  .argument('<projectId>', '项目ID')
  .option('--with-storage', '包含存储分析')
  .option('--with-progress', '包含进度统计')
  .action(async (id, opts) => {
    try { await getProjectStatusCmd(id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

project.command('list')
  .description('列出所有项目')
  .option('-n, --name <keyword>', '按名称关键字筛选')
  .option('-s, --status <status>', '按状态筛选')
  .option('--start-date <date>', '创建日期起 YYYY-MM-DD')
  .option('--end-date <date>', '创建日期止 YYYY-MM-DD')
  .option('--sort <type>', '排序方式: date|name|status', 'date')
  .option('-p, --page <n>', '页码', parseInt)
  .option('--page-size <n>', '每页条数', parseInt, config.pagination.pageSize)
  .option('--csv <path>', '导出CSV')
  .action(async (opts) => {
    try { listProjectsCmd(opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

project.command('update-status')
  .description('更新项目状态')
  .argument('<projectId>', '项目ID')
  .argument('<status>', '新状态: preparation|production|mixing|delivery|archived')
  .option('-r, --reason <text>', '变更原因')
  .option('-a, --actor <name>', '操作人')
  .action(async (id, status, opts) => {
    try { await updateProjectStatusCmd(id, status, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

const material = program.command('material')
  .description(chalk.cyan('🎵 素材管理'));

material.command('import')
  .description('导入音频素材')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-s, --source <path>', '源文件或目录路径')
  .option('-t, --type <type>', '素材类型: dialogue|ambience|foley|music，自动检测')
  .option('--scene <scene>', '场次号')
  .option('--shot <shot>', '镜头号')
  .option('-S, --status <status>', '初始状态: pending|editing|review|confirmed|revision')
  .option('-a, --assigned-to <name>', '分配给')
  .option('-d, --description <text>', '描述')
  .option('--no-recursive', '不递归扫描子目录')
  .option('--on-conflict <strategy>', '重名处理: rename|skip|overwrite|manual', 'rename')
  .option('--validate-specs', '验证音频规格')
  .option('--actor <name>', '操作人')
  .option('--tags <items>', '标签(逗号分隔)', v => v.split(','))
  .option('-v, --verbose', '显示详细信息')
  .action(async (opts) => {
    try { await importMaterialsCmd(opts.project, opts.source, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

material.command('list')
  .description('列出项目素材')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .option('-t, --type <type>', '按类型筛选')
  .option('-s, --status <status>', '按状态筛选')
  .option('--scene <scene>', '按场次筛选')
  .option('--shot <shot>', '按镜头筛选')
  .option('-k, --keyword <kw>', '名称关键字')
  .option('--assigned-to <name>', '按负责人筛选')
  .option('-p, --page <n>', '页码', parseInt)
  .option('--page-size <n>', '每页条数', parseInt, config.pagination.pageSize)
  .option('--csv <path>', '导出CSV')
  .action(async (opts) => {
    try { listMaterialsCmd(opts.project, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

material.command('show')
  .description('查看素材详情')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .argument('<materialId>', '素材ID')
  .option('--with-versions', '显示版本历史')
  .action(async (opts, id) => {
    try { await getMaterialDetailCmd(opts.project, id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

material.command('rename')
  .description('批量重命名素材')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .option('-m, --material-ids <ids>', '素材ID列表(逗号分隔)', v => v.split(','))
  .option('-t, --type <type>', '按类型筛选')
  .option('-s, --status <status>', '按状态筛选')
  .option('--scene <scene>', '按场次筛选')
  .option('--template <tpl>', '命名模板')
  .option('--start-index <n>', '起始序号', parseInt, 1)
  .option('-y, --yes', '确认执行(无预览)')
  .option('--confirm', '确认执行(无预览)')
  .option('--actor <name>', '操作人')
  .action(async (opts) => {
    try { await batchRenameCmd(opts.project, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

material.command('delete')
  .description('删除素材')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .argument('<materialId>', '素材ID')
  .option('-f, --force', '强制删除')
  .option('--delete-file', '同时删除文件')
  .option('-y, --yes', '确认删除')
  .option('--actor <name>', '操作人')
  .action(async (opts, id) => {
    try { deleteMaterialCmd(opts.project, id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

const workflow = program.command('workflow')
  .description(chalk.cyan('🔄 工作流管理'));

workflow.command('submit')
  .description('提交素材版本')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-m, --material <materialId>', '素材ID')
  .option('-s, --source-path <path>', '源文件路径')
  .option('-n, --note <text>', '变更说明')
  .option('-b, --modified-by <name>', '修改人')
  .option('--new-status <status>', '同时更新状态')
  .option('--keep-status', '保持当前状态不自动变更')
  .action(async (opts) => {
    try { await submitVersionCmd(opts.project, opts.material, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('versions')
  .description('查看素材版本历史')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-m, --material <materialId>', '素材ID')
  .action(async (opts) => {
    try { listVersionsCmd(opts.project, opts.material, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('diff')
  .description('对比两个版本差异')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-m, --material <materialId>', '素材ID')
  .argument('<versionId1>', '版本ID1')
  .argument('<versionId2>', '版本ID2')
  .action(async (opts, v1, v2) => {
    try { await compareVersionsCmd(opts.project, opts.material, v1, v2, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('rollback')
  .description('回滚到指定版本')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-m, --material <materialId>', '素材ID')
  .argument('<targetVersionId>', '目标版本ID')
  .option('-n, --note <text>', '回滚说明')
  .option('-a, --actor <name>', '操作人')
  .option('--new-status <status>', '回滚后状态')
  .option('--delete-later', '删除后续版本')
  .option('-y, --yes', '确认执行')
  .option('--confirm', '确认执行')
  .action(async (opts, target) => {
    try { await rollbackVersionCmd(opts.project, opts.material, target, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('set-status')
  .description('批量更新素材状态')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-s, --status <status>', '新状态')
  .option('-m, --materials <ids>', '素材ID列表(逗号分隔)', v => v ? v.split(',') : [])
  .option('--from-status <status>', '筛选原状态')
  .option('-t, --type <type>', '按类型筛选')
  .option('--scene <scene>', '按场次筛选')
  .option('--assigned-to <name>', '按负责人筛选')
  .option('-r, --reason <text>', '变更原因')
  .option('-a, --actor <name>', '操作人')
  .option('-y, --yes', '确认执行(批量操作时)')
  .option('--confirm', '确认执行')
  .option('-v, --verbose', '显示详细变更')
  .action(async (opts) => {
    try { await updateStatusCmd(opts.project, opts.materials, opts.status, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('add-feedback')
  .description('添加审听反馈')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .requiredOption('-m, --material-id <id>', '关联的素材ID')
  .requiredOption('-c, --content <text>', '反馈内容')
  .option('--author <name>', '提交人', '客户')
  .option('--author-email <email>', '提交人邮箱')
  .option('-s, --status <status>', '状态: pending|resolved', 'pending')
  .option('-p, --priority <level>', '优先级: low|normal|high', 'normal')
  .option('--timecodes <items>', '时间码列表，格式 HH:MM:SS|描述(逗号分隔多个)', v => v ? v.split(',') : [])
  .option('--source <src>', '来源')
  .option('--auto-set-revision', '自动将素材设为「需修改」')
  .action(async (opts) => {
    try { await addFeedbackCmd(opts.project, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('feedback')
  .description('列出审听反馈')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .option('-s, --status <status>', '按状态筛选')
  .option('-m, --material-id <id>', '按素材筛选')
  .option('--author <name>', '按提交人筛选')
  .option('-p, --page <n>', '页码', parseInt)
  .option('--page-size <n>', '每页条数', parseInt, config.pagination.pageSize)
  .option('--csv <path>', '导出CSV')
  .action(async (opts) => {
    try { listFeedbackCmd(opts.project, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('resolve-feedback')
  .description('标记反馈已解决')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .argument('<feedbackId>', '反馈ID')
  .option('-n, --note <text>', '处理说明')
  .option('-a, --actor <name>', '处理人')
  .option('--reopen', '重新打开(设为待处理)')
  .action(async (opts, fid) => {
    try {
      const status = opts.reopen ? 'pending' : 'resolved';
      updateFeedbackStatusCmd(opts.project, fid, status, opts);
    } catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

workflow.command('revision-list')
  .description('导出待修改清单')
  .requiredOption('-P, --project <projectId>', '项目ID')
  .option('-o, --output <path>', 'CSV输出路径')
  .action(async (opts) => {
    try { exportRevisionListCmd(opts.project, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

const report = program.command('report')
  .description(chalk.cyan('📊 报表统计'));

report.command('progress')
  .description('项目进度报告')
  .argument('<projectId>', '项目ID')
  .option('--group-by-scene', '按场次统计')
  .option('--csv <path>', '导出CSV')
  .action(async (id, opts) => {
    try { await progressReportCmd(id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

report.command('workload')
  .description('工作量统计报告')
  .argument('<projectId>', '项目ID')
  .option('--csv <path>', '导出CSV')
  .action(async (id, opts) => {
    try { await workloadReportCmd(id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

report.command('storage')
  .description('存储占用报告')
  .argument('[projectId]', '项目ID，"all" 或留空为全部项目', 'all')
  .option('--cleanup-temp', '清理临时文件')
  .option('--days-old <n>', '删除N天前的临时文件', parseInt, 7)
  .option('--force-cleanup', '真正执行删除(否则只预览)')
  .option('--csv <path>', '导出CSV')
  .action(async (id, opts) => {
    try { await storageReportCmd(id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

report.command('all')
  .description('综合报表(全部)')
  .argument('<projectId>', '项目ID')
  .option('--output-dir <dir>', '输出目录')
  .option('--export-all', '导出所有CSV')
  .action(async (id, opts) => {
    try { await comprehensiveReportCmd(id, opts); }
    catch (e) { renderError({ code: 'E000', error: e.message }); process.exit(1); }
  });

program.command('interactive')
  .description(chalk.cyan('🎯 交互式菜单模式'))
  .alias('menu')
  .action(async () => {
    await runInteractiveMenu();
  });

async function selectProject(promptText = '请选择项目') {
  const data = loadProjects();
  if (data.projects.length === 0) {
    renderInfo('暂无项目，请先创建项目');
    return null;
  }
  const choices = data.projects.map(p => ({
    name: `${p.name} (${p.id.slice(0, 8)}) - ${chalk.gray(p.status)}`,
    value: p.id
  }));
  choices.unshift({ name: chalk.gray('← 返回上级'), value: '__back__' });
  const { projectId } = await inquirer.prompt([
    { type: 'list', name: 'projectId', message: promptText, choices, pageSize: 15 }
  ]);
  return projectId === '__back__' ? null : projectId;
}

async function selectMaterial(projectId, promptText = '请选择素材', filter = {}) {
  if (!projectId) return null;
  const project = getProjectById(projectId);
  if (!project || !project.materials || project.materials.length === 0) {
    renderInfo('暂无素材，请先导入素材');
    return null;
  }
  let list = project.materials;
  if (filter.status) list = list.filter(m => m.status === filter.status);
  if (filter.type) list = list.filter(m => m.type === filter.type);
  const choices = list.map(m => ({
    name: `${m.name} - ${chalk.cyan(m.type)} ${chalk.gray(m.scene || '')} ${chalk.yellow(m.status)}`,
    value: m.id,
    short: m.name
  }));
  choices.unshift({ name: chalk.gray('← 返回上级'), value: '__back__' });
  const { materialId } = await inquirer.prompt([
    { type: 'list', name: 'materialId', message: promptText, choices, pageSize: 15 }
  ]);
  return materialId === '__back__' ? null : materialId;
}

async function interactiveCreateProject() {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: '项目名称:',
      validate: v => (v.length >= 2 && v.length <= 50) ? true : '名称长度2-50字符' },
    { type: 'input', name: 'client', message: '客户名称 (可选):' },
    { type: 'input', name: 'supervisor', message: '声音总监 (可选):' },
    { type: 'input', name: 'description', message: '项目描述 (可选):' },
    { type: 'list', name: 'status', message: '初始状态:',
      choices: [
        { name: '筹备', value: 'preparation' },
        { name: '制作', value: 'production' },
        { name: '混音', value: 'mixing' }
      ], default: 'preparation' },
    { type: 'input', name: 'startDate', message: '开始日期 YYYY-MM-DD (可选):', default: '' },
    { type: 'input', name: 'deadline', message: '截止日期 YYYY-MM-DD (可选):', default: '' }
  ]);
  await createProjectCmd(answers);
}

async function interactiveImportMaterials() {
  const projectId = await selectProject('选择导入的目标项目');
  if (!projectId) return;
  const answers = await inquirer.prompt([
    { type: 'input', name: 'source', message: '源文件/目录路径:',
      validate: v => v ? true : '请输入路径' },
    { type: 'list', name: 'type', message: '素材类型 (留空自动检测):',
      choices: [
        { name: '自动检测', value: '' },
        { name: '对白 dialogue', value: 'dialogue' },
        { name: '环境音 ambience', value: 'ambience' },
        { name: '音效 foley', value: 'foley' },
        { name: '配乐 music', value: 'music' }
      ], default: '' },
    { type: 'input', name: 'scene', message: '场次号 (可选):' },
    { type: 'input', name: 'shot', message: '镜头号 (可选):' },
    { type: 'input', name: 'assignedTo', message: '分配给 (可选):' },
    { type: 'confirm', name: 'recursive', message: '递归扫描子目录?', default: true },
    { type: 'list', name: 'onConflict', message: '重名冲突处理:',
      choices: [
        { name: '自动重命名', value: 'rename' },
        { name: '跳过', value: 'skip' },
        { name: '覆盖', value: 'overwrite' }
      ], default: 'rename' }
  ]);
  await importMaterialsCmd(projectId, answers.source, {
    ...answers,
    recursive: answers.recursive,
    type: answers.type || undefined
  });
}

async function interactiveSubmitVersion() {
  const projectId = await selectProject('选择项目');
  if (!projectId) return;
  const materialId = await selectMaterial(projectId, '选择要提交版本的素材');
  if (!materialId) return;
  const answers = await inquirer.prompt([
    { type: 'input', name: 'sourcePath', message: '源文件路径 (留空使用素材当前文件):', default: '' },
    { type: 'input', name: 'note', message: '变更说明:' },
    { type: 'input', name: 'modifiedBy', message: '修改人:', default: 'system' },
    { type: 'list', name: 'newStatus', message: '提交后状态:',
      choices: [
        { name: '待审核 review (推荐)', value: 'review' },
        { name: '保持当前状态', value: '' }
      ], default: 'review' }
  ]);
  await submitVersionCmd(projectId, materialId, {
    ...answers,
    sourcePath: answers.sourcePath || undefined,
    newStatus: answers.newStatus || undefined,
    keepStatus: !answers.newStatus
  });
}

async function runInteractiveMenu() {
  console.clear();
  console.log(chalk.cyan.bold(`
  ╔══════════════════════════════════════════════════════╗
  ║   🎬  影视后期声音制作项目管理系统  v1.0.0           ║
  ║      Audio Post-Production Management CLI            ║
  ╚══════════════════════════════════════════════════════╝
  `));
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择功能模块:',
        pageSize: 20,
        choices: [
          new inquirer.Separator(chalk.cyan('── 项目管理 ──')),
          { name: '📁 创建新项目', value: 'create_project' },
          { name: '📋 查看项目列表', value: 'list_projects' },
          { name: '📊 查看项目状态', value: 'project_status' },
          { name: '📦 归档项目', value: 'archive_project' },
          { name: '🔄 更新项目状态', value: 'update_project_status' },
          new inquirer.Separator(chalk.cyan('── 素材管理 ──')),
          { name: '🎵 导入音频素材', value: 'import_materials' },
          { name: '📃 查看素材列表', value: 'list_materials' },
          { name: '🔍 查看素材详情', value: 'show_material' },
          { name: '✏️  批量重命名素材', value: 'rename_materials' },
          { name: '🗑️  删除素材', value: 'delete_material' },
          new inquirer.Separator(chalk.cyan('── 工作流 ──')),
          { name: '💾 提交素材版本', value: 'submit_version' },
          { name: '📜 查看版本历史', value: 'list_versions' },
          { name: '⚖️  对比版本差异', value: 'diff_versions' },
          { name: '⏪ 回滚版本', value: 'rollback_version' },
          { name: '✅ 批量更新素材状态', value: 'set_status' },
          { name: '📝 添加审听反馈', value: 'add_feedback' },
          { name: '📋 查看反馈列表', value: 'list_feedback' },
          { name: '📌 导出待修改清单', value: 'export_revision' },
          new inquirer.Separator(chalk.cyan('── 报表统计 ──')),
          { name: '📈 项目进度报告', value: 'report_progress' },
          { name: '👥 工作量统计', value: 'report_workload' },
          { name: '💽 存储占用报告', value: 'report_storage' },
          { name: '📄 综合报表', value: 'report_all' },
          new inquirer.Separator(chalk.cyan('── 其他 ──')),
          { name: '❓ 查看帮助文档', value: 'show_help' },
          { name: chalk.red('🚪 退出系统'), value: 'exit' }
        ]
      }
    ]);
    try {
      switch (action) {
        case 'create_project':
          renderHeader('创建项目');
          await interactiveCreateProject();
          break;
        case 'list_projects':
          listProjectsCmd({ sort: 'date' });
          break;
        case 'project_status': {
          const pid = await selectProject();
          if (pid) await getProjectStatusCmd(pid, { withStorage: true, withProgress: true });
          break;
        }
        case 'archive_project': {
          const pid = await selectProject('选择要归档的项目');
          if (pid) {
            const { confirm, output, note } = await inquirer.prompt([
              { type: 'input', name: 'output', message: '归档输出路径 (留空默认):', default: '' },
              { type: 'input', name: 'note', message: '归档备注 (可选):', default: '' },
              { type: 'confirm', name: 'confirm', message: '确认归档此项目?', default: false }
            ]);
            if (confirm) await archiveProjectCmd(pid, { output, note });
          }
          break;
        }
        case 'update_project_status': {
          const pid = await selectProject();
          if (pid) {
            const { status, reason } = await inquirer.prompt([
              { type: 'list', name: 'status', message: '新状态:',
                choices: [
                  { name: '筹备', value: 'preparation' },
                  { name: '制作', value: 'production' },
                  { name: '混音', value: 'mixing' },
                  { name: '交付', value: 'delivery' },
                  { name: '归档', value: 'archived' }
                ] },
              { type: 'input', name: 'reason', message: '变更原因 (可选):' }
            ]);
            await updateProjectStatusCmd(pid, status, { reason });
          }
          break;
        }
        case 'import_materials':
          await interactiveImportMaterials();
          break;
        case 'list_materials': {
          const pid = await selectProject();
          if (pid) listMaterialsCmd(pid, {});
          break;
        }
        case 'show_material': {
          const pid = await selectProject();
          if (pid) {
            const mid = await selectMaterial(pid);
            if (mid) await getMaterialDetailCmd(pid, mid, { withVersions: true });
          }
          break;
        }
        case 'rename_materials': {
          const pid = await selectProject();
          if (pid) {
            const { template, startIndex, confirm } = await inquirer.prompt([
              { type: 'input', name: 'template', message: '命名模板:',
                default: config.namingTemplate },
              { type: 'number', name: 'startIndex', message: '起始序号:', default: 1 },
              { type: 'confirm', name: 'confirm', message: '确认执行重命名?', default: false }
            ]);
            if (confirm) {
              await batchRenameCmd(pid, { template, startIndex, yes: true });
            } else {
              await batchRenameCmd(pid, { template, startIndex });
            }
          }
          break;
        }
        case 'delete_material': {
          const pid = await selectProject();
          if (pid) {
            const mid = await selectMaterial(pid, '选择要删除的素材');
            if (mid) {
              const { confirm, deleteFile } = await inquirer.prompt([
                { type: 'confirm', name: 'deleteFile', message: '同时删除文件?', default: false },
                { type: 'confirm', name: 'confirm', message: '确认删除该素材?', default: false }
              ]);
              if (confirm) deleteMaterialCmd(pid, mid, { force: true, yes: true, deleteFile });
            }
          }
          break;
        }
        case 'submit_version':
          await interactiveSubmitVersion();
          break;
        case 'list_versions': {
          const pid = await selectProject();
          if (pid) {
            const mid = await selectMaterial(pid);
            if (mid) listVersionsCmd(pid, mid, {});
          }
          break;
        }
        case 'diff_versions': {
          const pid = await selectProject();
          if (pid) {
            const mid = await selectMaterial(pid);
            if (mid) {
              const project = getProjectById(pid);
              const storage = project.storagePath || path.join(ROOT_DIR, 'projects', pid);
              const versions = getVersionList(storage, mid);
              if (versions.length < 2) {
                renderWarning('版本不足2个，无法对比');
                break;
              }
              const choices = versions.map(v => ({
                name: `v${v.number} - ${formatDate(v.createdAt)} - ${v.createdBy}`,
                value: v.id
              }));
              const { v1, v2 } = await inquirer.prompt([
                { type: 'list', name: 'v1', message: '选择版本A:', choices },
                { type: 'list', name: 'v2', message: '选择版本B:', choices }
              ]);
              await compareVersionsCmd(pid, mid, v1, v2, {});
            }
          }
          break;
        }
        case 'rollback_version': {
          const pid = await selectProject();
          if (pid) {
            const mid = await selectMaterial(pid);
            if (mid) {
              const project = getProjectById(pid);
              const storage = project.storagePath || path.join(ROOT_DIR, 'projects', pid);
              const versions = getVersionList(storage, mid);
              if (versions.length < 1) {
                renderWarning('暂无版本可回滚');
                break;
              }
              const choices = versions.map(v => ({
                name: `v${v.number} - ${formatDate(v.createdAt)} - ${v.changeNote?.substring(0, 30) || '-'}`,
                value: v.id
              }));
              const { target, note, confirm } = await inquirer.prompt([
                { type: 'list', name: 'target', message: '回滚到版本:', choices },
                { type: 'input', name: 'note', message: '回滚说明 (可选):' },
                { type: 'confirm', name: 'confirm', message: '确认回滚?', default: false }
              ]);
              if (confirm) {
                await rollbackVersionCmd(pid, mid, target, { note, yes: true });
              }
            }
          }
          break;
        }
        case 'set_status': {
          const pid = await selectProject();
          if (pid) {
            const { status, reason, confirm } = await inquirer.prompt([
              { type: 'list', name: 'status', message: '设为状态:',
                choices: [
                  { name: '待处理 pending', value: 'pending' },
                  { name: '剪辑中 editing', value: 'editing' },
                  { name: '待审核 review', value: 'review' },
                  { name: '已确认 confirmed', value: 'confirmed' },
                  { name: '需修改 revision', value: 'revision' }
                ] },
              { type: 'input', name: 'reason', message: '变更原因 (可选):' },
              { type: 'confirm', name: 'confirm', message: '使用筛选条件选择素材?(否则手动指定ID)', default: true }
            ]);
            if (!confirm) {
              const { ids } = await inquirer.prompt([
                { type: 'input', name: 'ids', message: '输入素材ID(逗号分隔多个):' }
              ]);
              if (ids) {
                await updateStatusCmd(pid, ids.split(','), status, { reason, yes: true });
              }
            } else {
              const { type, scene, fromStatus } = await inquirer.prompt([
                { type: 'input', name: 'fromStatus', message: '筛选原状态 (留空不限):' },
                { type: 'input', name: 'type', message: '筛选类型 (留空不限):' },
                { type: 'input', name: 'scene', message: '筛选场次 (留空不限):' }
              ]);
              await updateStatusCmd(pid, [], status, {
                reason, fromStatus: fromStatus || undefined,
                type: type || undefined, scene: scene || undefined,
                yes: true
              });
            }
          }
          break;
        }
        case 'add_feedback': {
          const pid = await selectProject();
          if (pid) {
            const mid = await selectMaterial(pid, '选择关联素材');
            if (mid) {
              const { content, author, priority, timecodes, autoSetRevision } = await inquirer.prompt([
                { type: 'input', name: 'content', message: '反馈内容:',
                  validate: v => v ? true : '内容不能为空' },
                { type: 'input', name: 'author', message: '提交人:', default: '客户' },
                { type: 'list', name: 'priority', message: '优先级:',
                  choices: ['low', 'normal', 'high'], default: 'normal' },
                { type: 'input', name: 'timecodes', message: '时间码 HH:MM:SS|描述 (多个用逗号分隔,可选):' },
                { type: 'confirm', name: 'autoSetRevision', message: '自动将素材设为需修改?', default: true }
              ]);
              await addFeedbackCmd(pid, {
                materialId: mid, content, author, priority,
                timecodes: timecodes ? timecodes.split(',') : [],
                autoSetRevision
              });
            }
          }
          break;
        }
        case 'list_feedback': {
          const pid = await selectProject();
          if (pid) listFeedbackCmd(pid, {});
          break;
        }
        case 'export_revision': {
          const pid = await selectProject();
          if (pid) exportRevisionListCmd(pid, {});
          break;
        }
        case 'report_progress': {
          const pid = await selectProject();
          if (pid) {
            const { groupByScene, csv } = await inquirer.prompt([
              { type: 'confirm', name: 'groupByScene', message: '按场次统计?', default: false },
              { type: 'input', name: 'csv', message: '导出CSV路径 (留空不导出):', default: '' }
            ]);
            await progressReportCmd(pid, { groupByScene, csv: csv || undefined });
          }
          break;
        }
        case 'report_workload': {
          const pid = await selectProject();
          if (pid) {
            const { csv } = await inquirer.prompt([
              { type: 'input', name: 'csv', message: '导出CSV路径 (留空不导出):', default: '' }
            ]);
            await workloadReportCmd(pid, { csv: csv || undefined });
          }
          break;
        }
        case 'report_storage': {
          const data = loadProjects();
          const allChoice = { name: '📊 全部项目 (多项目对比)', value: 'all' };
          const pChoices = data.projects.map(p => ({ name: p.name, value: p.id }));
          const { target } = await inquirer.prompt([
            { type: 'list', name: 'target', message: '选择目标:',
              choices: [allChoice, ...pChoices] }
          ]);
          const { cleanup, force } = await inquirer.prompt([
            { type: 'confirm', name: 'cleanup', message: '同时检查临时文件?', default: true },
            { type: 'confirm', name: 'force', message: '真正执行删除临时文件? (否=仅预览)', default: false }
          ]);
          await storageReportCmd(target, {
            cleanupTemp: cleanup, forceCleanup: force
          });
          break;
        }
        case 'report_all': {
          const pid = await selectProject();
          if (pid) {
            const { exportAll } = await inquirer.prompt([
              { type: 'confirm', name: 'exportAll', message: '同时导出CSV?', default: true }
            ]);
            await comprehensiveReportCmd(pid, { exportAll });
          }
          break;
        }
        case 'show_help':
          program.outputHelp();
          break;
        case 'exit':
          console.log();
          renderSuccess('感谢使用，再见！');
          process.exit(0);
      }
    } catch (e) {
      renderError({ code: 'E000', error: e.message, suggestion: '查看堆栈:' + e.stack?.substring(0, 300) });
    }
    renderDivider();
    const { goOn } = await inquirer.prompt([
      { type: 'confirm', name: 'goOn', message: '返回主菜单?', default: true }
    ]);
    if (!goOn) {
      renderSuccess('感谢使用，再见！');
      process.exit(0);
    }
    console.clear();
  }
}

if (!process.argv.slice(2).length) {
  console.log(chalk.cyan('🎬 影视后期声音制作项目管理系统 v1.0.0'));
  console.log(chalk.gray('  使用 -h 查看帮助，使用 interactive 进入交互菜单模式'));
  console.log(chalk.gray('  快速启动: ' + chalk.white.bold('audio-pm interactive')));
  console.log();
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);
