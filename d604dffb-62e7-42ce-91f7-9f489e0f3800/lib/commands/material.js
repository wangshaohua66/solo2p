import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  validateMaterialType,
  validateMaterialStatus,
  validateScene,
  validateShot,
  validateAudioFormat
} from '../utils/validator.js';
import {
  renderTable,
  renderPaginatedTable,
  renderPaginatedTableInteractive,
  renderSuccess,
  renderError,
  renderWarning,
  renderInfo,
  renderHeader,
  renderDivider,
  formatStatus,
  formatMaterialType,
  formatDuration,
  formatFileSize,
  formatDate,
  saveCSV,
  renderProgressBar
} from '../utils/formatter.js';
import {
  getProjectById,
  addMaterial,
  findMaterials,
  getMaterial,
  updateMaterial,
  removeMaterial,
  addActivity
} from '../utils/store.js';
import {
  extractAudioMetadata,
  batchExtractMetadata,
  validateAudioSpecs
} from '../services/audio-meta.js';
import {
  getVersionList,
  getVersion,
  compareVersions
} from '../services/version-control.js';
import {
  getConfig,
  getStorageBasePath
} from '../utils/config.js';

const config = getConfig();

function getProjectStoragePath(project) {
  return project.storagePath || path.join(getStorageBasePath(), project.id);
}

function scanAudioFiles(sourcePath, recursive = true) {
  const results = [];
  if (!fs.existsSync(sourcePath)) return results;
  const stat = fs.statSync(sourcePath);
  if (stat.isFile()) {
    const ext = path.extname(sourcePath).toLowerCase();
    if (config.supportedFormats.includes(ext)) {
      results.push(sourcePath);
    }
    return results;
  }
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (config.supportedFormats.includes(ext)) {
          results.push(fullPath);
        }
      }
    });
  }
  scan(sourcePath);
  return results;
}

function detectTypeByName(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('对白') || lower.includes('dialog') || lower.includes('dlog') || lower.includes('dlg')) return 'dialogue';
  if (lower.includes('环境') || lower.includes('ambience') || lower.includes('bg') || lower.includes('atmosphere') || lower.includes('ambi')) return 'ambience';
  if (lower.includes('音效') || lower.includes('foley') || lower.includes('sfx') || lower.includes('sound_effect') || lower.includes('effect')) return 'foley';
  if (lower.includes('配乐') || lower.includes('music') || lower.includes('bgm') || lower.includes('score') || lower.includes('ost')) return 'music';
  return null;
}

function detectSceneShot(fileName) {
  const sceneMatch = fileName.match(/[Ss][Cc]?(\d+)/) || fileName.match(/场(\d+)/) || fileName.match(/scene[_\-]?(\d+)/i);
  const shotMatch = fileName.match(/[Ss][Hh](\d+)/) || fileName.match(/镜(\d+)/) || fileName.match(/shot[_\-]?(\d+)/i);
  return {
    scene: sceneMatch ? sceneMatch[1] : null,
    shot: shotMatch ? shotMatch[1] : null
  };
}

export async function importMaterialsCmd(projectId, sourcePath, options) {
  renderHeader(`导入素材 - 项目: ${projectId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E201', error: `找不到项目: ${projectId}`, suggestion: '使用 "project list" 查看所有项目' });
    return null;
  }
  if (!fs.existsSync(sourcePath)) {
    renderError({ code: 'E202', error: `源路径不存在: ${sourcePath}` });
    return null;
  }
  const audioFiles = scanAudioFiles(sourcePath, options.recursive !== false);
  if (audioFiles.length === 0) {
    renderWarning('未找到支持的音频文件');
    renderInfo(`支持格式: ${config.supportedFormats.join(', ')}`);
    return null;
  }
  renderInfo(`找到 ${audioFiles.length} 个音频文件，开始处理中...`);
  const startTime = Date.now();
  const metaResults = await batchExtractMetadata(audioFiles, 10);
  renderProgressBar(metaResults.successCount, audioFiles.length);
  const projectPath = getProjectStoragePath(project);
  const rawPath = path.join(projectPath, 'raw');
  fs.ensureDirSync(rawPath);
  const importResults = { success: [], conflicts: [], failed: [], skipped: [] };
  const projectMaterials = project.materials || [];
  let globalConflictStrategy = null;

  for (const meta of metaResults.success) {
    try {
      const originalName = meta.fileName;
      let type = options.type || detectTypeByName(originalName) || 'dialogue';
      let { scene, shot } = options.scene || options.shot
        ? { scene: options.scene, shot: options.shot }
        : detectSceneShot(originalName);
      scene = scene || '未知场次';
      shot = shot || '未知镜头';
      const existing = projectMaterials.find(m =>
        m.originalName === originalName ||
        (m.type === type && m.scene === scene && m.shot === shot && m.originalName === originalName)
      );
      const conflictList = projectMaterials.filter(m => m.originalName === originalName);
      let targetDir = path.join(rawPath, scene, shot);
      fs.ensureDirSync(targetDir);
      let targetFileName = originalName;
      let conflictInfo = null;
      if (conflictList.length > 0) {
        const conflictStrategy = globalConflictStrategy || options.onConflict;
        if (conflictStrategy === 'skip') {
          importResults.skipped.push({ file: originalName, reason: '文件重名已跳过' });
          continue;
        } else if (conflictStrategy === 'rename' || !conflictStrategy || conflictStrategy === 'auto') {
          const base = path.parse(originalName);
          targetFileName = `${base.name}_${conflictList.length + 1}${base.ext}`;
          conflictInfo = { renamedFrom: originalName, strategy: 'rename' };
        } else if (conflictStrategy === 'overwrite') {
          conflictInfo = { strategy: 'overwrite' };
        } else if (conflictStrategy === 'manual') {
          console.log();
          console.log(chalk.yellow.bold('  ⚠️  检测到重名冲突:'));
          const existingFirst = conflictList[0];
          const conflictRows = [
            ['项目', chalk.gray(originalName)],
            ['类型/场次/镜头', `${type} / ${scene} / ${shot}`],
            ['— 新文件 —', ''],
            ['  文件大小', formatFileSize(meta.fileSize)],
            ['  时长', formatDuration(meta.duration)],
            ['  规格', `${meta.sampleRate || '-'}Hz / ${meta.bitsPerSample || '-'}bit / ${meta.numChannels || '-'}ch`],
            ['— 现有素材 —', ''],
            ['  素材ID', existingFirst.id],
            ['  文件大小', formatFileSize(existingFirst.metadata?.fileSize || 0)],
            ['  时长', formatDuration(existingFirst.metadata?.duration || 0)],
            ['  规格', `${existingFirst.metadata?.sampleRate || '-'}Hz / ${existingFirst.metadata?.bitsPerSample || '-'}bit / ${existingFirst.metadata?.numChannels || '-'}ch`],
            ['  状态', formatStatus(existingFirst.status)]
          ];
          renderTable([chalk.cyan('属性'), chalk.cyan('值')], conflictRows);

          const answers = await inquirer.prompt([
            {
              type: 'expand',
              name: 'strategy',
              message: '选择处理方式 (r=重命名 o=覆盖 s=跳过 R=全部重命名 O=全部覆盖 S=全部跳过):',
              choices: [
                { key: 'r', name: '自动重命名 (仅本次)', value: 'rename' },
                { key: 'o', name: '覆盖现有 (仅本次)', value: 'overwrite' },
                { key: 's', name: '跳过 (仅本次)', value: 'skip' },
                new inquirer.Separator(),
                { key: 'R', name: '✅ 应用「重命名」到所有后续冲突', value: 'rename_all' },
                { key: 'O', name: '✅ 应用「覆盖」到所有后续冲突', value: 'overwrite_all' },
                { key: 'S', name: '✅ 应用「跳过」到所有后续冲突', value: 'skip_all' },
                { key: 'n', name: '详细信息对比', value: 'detail' }
              ],
              default: 'rename'
            }
          ]);

          let selectedStrategy = answers.strategy;
          if (selectedStrategy === 'detail') {
            renderDivider();
            console.log(chalk.cyan('  🔍 详细差异对比:'));
            console.log(chalk.gray('  新文件路径: ') + meta.filePath);
            console.log(chalk.gray('  现有路径: ') + (existingFirst.filePath || '-'));
            console.log(chalk.gray('  现有创建时间: ') + formatDate(existingFirst.createdAt));
            if (existingFirst.assignedTo) {
              console.log(chalk.gray('  现有负责人: ') + existingFirst.assignedTo);
            }
            const detailAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'strategy',
                message: '请选择最终处理方式:',
                choices: [
                  { name: '自动重命名', value: 'rename' },
                  { name: '覆盖现有文件', value: 'overwrite' },
                  { name: '跳过此文件', value: 'skip' },
                  { name: '从后续列表中自定义命名', value: 'custom' }
                ]
              }
            ]);
            selectedStrategy = detailAnswer.strategy;
          }

          if (selectedStrategy === 'custom') {
            const { customName } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customName',
                message: '输入新文件名 (含扩展名):',
                default: () => {
                  const b = path.parse(originalName);
                  return `${b.name}_new${b.ext}`;
                },
                validate: (input) => {
                  if (!input || input.length < 3) return '文件名至少3个字符';
                  const sameName = projectMaterials.filter(m => m.originalName === input || path.basename(m.filePath || '') === input);
                  if (sameName.length > 0) return '该名称仍然存在冲突，请换一个';
                  return true;
                }
              }
            ]);
            targetFileName = customName;
            conflictInfo = { renamedFrom: originalName, strategy: 'custom', customName };
          } else if (selectedStrategy.endsWith('_all')) {
            const baseStrategy = selectedStrategy.replace('_all', '');
            globalConflictStrategy = baseStrategy;
            renderInfo(chalk.green(`已设置全局策略: 所有后续冲突将自动「${baseStrategy === 'rename' ? '重命名' : baseStrategy === 'overwrite' ? '覆盖' : '跳过'}」`));
            if (baseStrategy === 'skip') {
              importResults.skipped.push({ file: originalName, reason: '文件重名 (全局跳过)' });
              continue;
            } else if (baseStrategy === 'rename') {
              const b = path.parse(originalName);
              targetFileName = `${b.name}_${conflictList.length + 1}${b.ext}`;
              conflictInfo = { renamedFrom: originalName, strategy: 'rename', global: true };
            } else {
              conflictInfo = { strategy: 'overwrite', global: true };
            }
          } else if (selectedStrategy === 'skip') {
            importResults.skipped.push({ file: originalName, reason: '文件重名 (用户手动跳过)' });
            continue;
          } else if (selectedStrategy === 'rename') {
            const b = path.parse(originalName);
            targetFileName = `${b.name}_${conflictList.length + 1}${b.ext}`;
            conflictInfo = { renamedFrom: originalName, strategy: 'rename', manual: true };
          } else if (selectedStrategy === 'overwrite') {
            conflictInfo = { strategy: 'overwrite', manual: true };
          }
        } else {
          importResults.conflicts.push({
            file: originalName,
            existingIds: conflictList.map(c => c.id)
          });
          continue;
        }
      }
      const targetPath = path.join(targetDir, targetFileName);
      if (conflictInfo?.strategy === 'overwrite') {
        if (fs.existsSync(targetPath)) fs.removeSync(targetPath);
      }
      fs.copySync(meta.filePath, targetPath, { overwrite: true });
      const specs = options.validateSpecs ? validateAudioSpecs(meta, options.specRequirements || {}) : null;
      const material = {
        name: conflictInfo?.renamedFrom
          ? `${path.parse(targetFileName).name}`
          : path.parse(originalName).name,
        originalName,
        type,
        scene,
        shot,
        status: options.status || 'pending',
        assignedTo: options.assignedTo || null,
        description: options.description || '',
        filePath: targetPath,
        metadata: {
          format: meta.format,
          sampleRate: meta.sampleRate,
          bitsPerSample: meta.bitsPerSample,
          numChannels: meta.numChannels,
          duration: meta.duration,
          fileSize: meta.fileSize,
          codec: meta.codec,
          lossless: meta.lossless,
          bitRate: meta.bitRate
        },
        specsIssues: specs ? specs.issues : [],
        tags: options.tags || [],
        importedFrom: meta.filePath,
        conflictInfo,
        sourceHash: null
      };
      const saved = addMaterial(projectId, material);
      importResults.success.push({
        id: saved.id,
        name: saved.name,
        file: targetFileName,
        type
      });
      if (saved) {
        projectMaterials.push(saved);
      }
    } catch (err) {
      importResults.failed.push({ file: originalName, error: err.message });
    }
  }
  addActivity(projectId, {
    type: 'materials_imported',
    description: `导入 ${importResults.success.length} 个素材，失败 ${importResults.failed.length} 个`,
    actor: options.actor || 'system',
    details: {
      imported: importResults.success.length,
      failed: importResults.failed.length,
      skipped: importResults.skipped.length
    }
  });
  renderDivider();
  renderSuccess(`导入完成！成功: ${importResults.success.length} 个`);
  if (importResults.failed.length > 0) renderWarning(`失败: ${importResults.failed.length} 个`);
  if (importResults.conflicts.length > 0) renderWarning(`重名冲突: ${importResults.conflicts.length} 个`);
  if (importResults.skipped.length > 0) renderInfo(`跳过: ${importResults.skipped.length} 个`);
  renderInfo(`耗时: ${(Date.now() - startTime)}ms`);
  if (importResults.conflicts.length > 0 && options.verbose) {
    console.log(chalk.yellow('  冲突文件列表:'));
    importResults.conflicts.forEach(c => console.log(`    - ${c.file}`));
  }
  return importResults;
}

export function listMaterialsCmd(projectId, options) {
  renderHeader(`素材列表 - 项目: ${projectId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E201', error: `找不到项目: ${projectId}` });
    return;
  }
  const filter = {};
  if (options.type) {
    const r = validateMaterialType(options.type);
    if (!r.valid) { renderError({ code: r.code, error: r.error }); return; }
    filter.type = options.type;
  }
  if (options.status) {
    const r = validateMaterialStatus(options.status);
    if (!r.valid) { renderError({ code: r.code, error: r.error }); return; }
    filter.status = options.status;
  }
  if (options.scene) {
    filter.scene = options.scene;
  }
  if (options.shot) {
    filter.shot = options.shot;
  }
  if (options.keyword) {
    filter.keyword = options.keyword;
  }
  if (options.assignedTo) {
    filter.assignedTo = options.assignedTo;
  }
  const materials = findMaterials(projectId, filter);
  if (materials.length === 0) {
    renderInfo('暂无匹配的素材');
    return;
  }
  const rows = materials.map(m => [
    m.id.slice(0, 10),
    m.name,
    formatMaterialType(m.type),
    m.scene || '-',
    m.shot || '-',
    formatStatus(m.status),
    formatDuration(m.metadata?.duration || 0),
    formatFileSize(m.metadata?.fileSize || 0),
    formatDate(m.createdAt)
  ]);
  const headers = ['ID', '名称', '类型', '场次', '镜头', '状态', '时长', '大小', '导入时间'];
  renderPaginatedTable(headers, rows, {
    page: options.page,
    pageSize: options.pageSize
  });
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    const csvHeaders = ['ID', '名称', '原始文件名', '类型', '场次', '镜头', '状态', '时长(秒)',
      '采样率', '位深', '声道', '大小(字节)', '文件路径', '导入时间', '更新时间'];
    const csvRows = materials.map(m => [
      m.id, m.name, m.originalName || m.name, m.type, m.scene || '',
      m.shot || '', m.status, (m.metadata?.duration || 0).toFixed(2),
      m.metadata?.sampleRate || '',
      m.metadata?.bitsPerSample || '',
      m.metadata?.numChannels || '',
      m.metadata?.fileSize || 0,
      m.filePath || '',
      formatDate(m.createdAt), formatDate(m.updatedAt)
    ]);
    saveCSV(csvPath, csvHeaders, csvRows);
    renderSuccess(`CSV已导出: ${csvPath}`);
  }
}

export async function getMaterialDetailCmd(projectId, materialId, options) {
  renderHeader(`素材详情`);
  const material = getMaterial(projectId, materialId);
  if (!material) {
    renderError({ code: 'E203', error: `找不到素材: ${materialId}` });
    return null;
  }
  const info = [
    ['素材ID', material.id],
    ['素材名称', material.name],
    ['原始文件名', material.originalName || '-'],
    ['类型', formatMaterialType(material.type)],
    ['场次', material.scene || '-'],
    ['镜头', material.shot || '-'],
    ['状态', formatStatus(material.status)],
    ['负责人', material.assignedTo || '-'],
    ['文件路径', material.filePath || '-'],
    ['描述', material.description || '-']
  ];
  renderTable(['属性', '值'], info, { colWidths: [15, 60] });
  if (material.metadata) {
    renderDivider();
    console.log(chalk.cyan.bold('  音频元数据:'));
    const m = material.metadata;
    const metaRows = [
      ['格式', m.format || '-'],
      ['采样率', m.sampleRate ? `${m.sampleRate} Hz` : '-'],
      ['位深', m.bitsPerSample ? `${m.bitsPerSample} bit` : '-'],
      ['声道数', m.numChannels ? (m.numChannels === 1 ? '单声道' : (m.numChannels === 2 ? '立体声' : `${m.numChannels}声道`)) : '-'],
      ['时长', formatDuration(m.duration || 0)],
      ['文件大小', formatFileSize(m.fileSize || 0)],
      ['编码', m.codec || '-'],
      ['码率', m.bitRate ? `${(m.bitRate / 1000).toFixed(0)} kbps` : '-'],
      ['无损', m.lossless ? '是' : '否']
    ];
    renderTable(['属性', '值'], metaRows, { colWidths: [15, 40] });
  }
  if (options.withVersions) {
    const project = getProjectById(projectId);
    const projectPath = getProjectStoragePath(project);
    const versions = getVersionList(projectPath, materialId);
    if (versions.length > 0) {
      renderDivider();
      console.log(chalk.cyan.bold('  版本历史:'));
      const vRows = versions.slice(0, 10).map(v => [
        `v${v.number}`,
        formatDate(v.createdAt),
        v.createdBy,
        (v.changeNote?.substring(0, 30) || '-'),
        formatFileSize(v.fileSize)
      ]);
      renderTable(['版本', '创建时间', '修改人', '变更说明', '大小'], vRows);
    }
  }
  return material;
}

export async function batchRenameCmd(projectId, options) {
  renderHeader(`批量重命名 - 项目: ${projectId}`);
  const project = getProjectById(projectId);
  if (!project) {
    renderError({ code: 'E201', error: `找不到项目: ${projectId}` });
    return null;
  }
  let materials;
  if (options.materialIds && options.materialIds.length > 0) {
    materials = options.materialIds
      .map(id => getMaterial(projectId, id))
      .filter(Boolean);
  } else {
    const filter = {};
    if (options.type) filter.type = options.type;
    if (options.status) filter.status = options.status;
    if (options.scene) filter.scene = options.scene;
    materials = findMaterials(projectId, filter);
  }
  if (materials.length === 0) {
    renderWarning('没有可重命名的素材');
    return null;
  }
  const template = options.template || config.namingTemplate;
  renderInfo(`模板: ${template}`);
  renderInfo(`将重命名 ${materials.length} 个文件`);
  let index = options.startIndex || 1;
  const previewList = [];
  const sorted = materials.sort((a, b) => {
    if (a.scene !== b.scene) return (a.scene || '').localeCompare(b.scene || '');
    if (a.shot !== b.shot) return (a.shot || '').localeCompare(b.shot || '');
    return a.name.localeCompare(b.name);
  });
  for (const mat of sorted) {
    const vars = {
      project: project.name.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 20),
      scene: mat.scene || 'SC',
      shot: mat.shot || 'SH',
      type: mat.type,
      index: String(index).padStart(4, '0'),
      idx: index
    };
    let newName = template;
    newName = newName.replace(/\{project\}/g, vars.project);
    newName = newName.replace(/\{scene\}/g, vars.scene);
    newName = newName.replace(/\{shot\}/g, vars.shot);
    newName = newName.replace(/\{type\}/g, vars.type);
    newName = newName.replace(/\{index:0?(\d+)d\}/g, (_, digits) => String(index).padStart(parseInt(digits), '0'));
    newName = newName.replace(/\{idx\}/g, String(index));
    const ext = path.extname(mat.originalName || mat.filePath || '');
    const oldPath = mat.filePath;
    const oldDir = oldPath ? path.dirname(oldPath) : '';
    const newPath = oldDir ? path.join(oldDir, `${newName}${ext}`) : '';
    previewList.push({
      materialId: mat.id,
      oldName: mat.name,
      oldPath,
      newName,
      newPath
    });
    index++;
  }
  const rows = previewList.map(p => [p.oldName, p.newName, p.oldPath ? path.basename(p.oldPath) : '-']);
  console.log(chalk.cyan.bold('\n  预览:'));
  renderTable(['原名', '新名称', '文件'], rows, { compact: true });
  if (!options.confirm && !options.yes) {
    renderWarning('以上为重命名预览，使用 --yes 或 --confirm 确认执行');
    return { preview: true, count: previewList.length, items: previewList };
  }
  const results = { success: [], failed: [] };
  for (const p of previewList) {
    try {
      if (p.oldPath && fs.existsSync(p.oldPath) && p.newPath) {
        if (fs.existsSync(p.newPath)) {
          results.failed.push({ ...p, error: '目标文件已存在' });
          continue;
        }
        fs.moveSync(p.oldPath, p.newPath);
        updateMaterial(projectId, p.materialId, {
          name: p.newName,
          filePath: p.newPath
        });
        results.success.push(p);
      } else {
        results.failed.push({ ...p, error: '原文件不存在' });
      }
    } catch (e) {
      results.failed.push({ ...p, error: e.message });
    }
  }
  addActivity(projectId, {
    type: 'materials_renamed',
    description: `批量重命名 ${results.success.length} 个素材`,
    actor: options.actor || 'system'
  });
  renderSuccess(`完成: 成功 ${results.success.length}，失败 ${results.failed.length}`);
  return results;
}

export function deleteMaterialCmd(projectId, materialId, options) {
  renderHeader(`删除素材`);
  const mat = getMaterial(projectId, materialId);
  if (!mat) {
    renderError({ code: 'E203', error: `找不到素材: ${materialId}` });
    return false;
  }
  if (!options.force) {
    renderWarning(`即将删除素材: ${mat.name}`);
    if (!options.yes) {
      renderInfo('使用 --force 或 --yes 确认删除，或重新执行命令');
      return false;
    }
  }
  const ok = removeMaterial(projectId, materialId);
  if (ok && options.deleteFile && mat.filePath && fs.existsSync(mat.filePath)) {
    try {
      fs.removeSync(mat.filePath);
      renderInfo('关联文件已删除');
    } catch (e) {
      renderWarning(`文件删除失败: ${e.message}`);
    }
  }
  if (ok) {
    addActivity(projectId, {
      type: 'material_deleted',
      description: `删除素材: ${mat.name}`,
      actor: options.actor || 'system'
    });
    renderSuccess('素材已删除');
  }
  return ok;
}
