import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { Project, Shot, Scene } from '@/types';

interface JsonExporterProps {
  onClose: () => void;
}

type Tab = 'export' | 'import';

interface ExportStats {
  scenes: number;
  shots: number;
  layers: number;
  dialogues: number;
  sfxTags: number;
  refImages: number;
}

export const JsonExporter: React.FC<JsonExporterProps> = ({ onClose }) => {
  const currentProject = useProjectStore((s) => s.currentProject);
  const scenes = useProjectStore((s) => s.scenes);
  const shots = useProjectStore((s) => s.shots);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('export');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalSize, setTotalSize] = useState<string>('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    project: Project;
    scenes: Scene[];
    shots: Shot[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats: ExportStats = {
    scenes: scenes.length,
    shots: shots.length,
    layers: shots.reduce((sum, s) => sum + (s.layers?.length || 0), 0),
    dialogues: shots.reduce((sum, s) => sum + (s.dialogues?.length || 0), 0),
    sfxTags: shots.reduce((sum, s) => sum + (s.sfxTags?.length || 0), 0),
    refImages: shots.filter((s) => s.referenceImage !== null).length,
  };

  const handleExportJson = async () => {
    if (!currentProject) return;
    setProcessing(true);
    setError(null);
    setProgress(0);
    try {
      await new Promise((r) => setTimeout(r, 200));
      setProgress(30);
      const data = exportProject();
      setProgress(70);
      const jsonStr = JSON.stringify(data);
      const sizeBytes = new Blob([jsonStr]).size;
      const sizeKB = sizeBytes / 1024;
      setTotalSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB.toFixed(1)} KB`);

      if (sizeBytes > 50 * 1024 * 1024) {
        setError(
          `导出文件超过 50MB 限制（当前 ${(sizeBytes / 1024 / 1024).toFixed(2)}MB），请精简分镜内容后重试。`
        );
        setProcessing(false);
        return;
      }

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}_${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setProgress(100);
    } catch (err: any) {
      setError(`导出失败：${err?.message || err}`);
    } finally {
      setTimeout(() => setProcessing(false), 500);
    }
  };

  const handleExportThumbnails = async () => {
    if (!currentProject || shots.length === 0) return;
    setProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const csvHeader = [
        '分镜ID',
        '序号',
        '场景',
        '标题',
        '时长(秒)',
        '镜头运动',
        '转场',
        '对白数',
        '音效数',
      ].join(',');

      const csvRows = [csvHeader];
      let done = 0;

      for (const shot of shots) {
        try {
          const sceneName = scenes.find((s) => s.id === shot.sceneId)?.name || '';
          const csvRow = [
            shot.id,
            (shot.orderIndex + 1).toString(),
            `"${sceneName.replace(/"/g, '""')}"`,
            `"${(shot.title || '').replace(/"/g, '""')}"`,
            shot.duration.toString(),
            shot.cameraMovement,
            shot.transition,
            (shot.dialogues?.length || 0).toString(),
            (shot.sfxTags?.length || 0).toString(),
          ].join(',');
          csvRows.push(csvRow);

          const url = await generateThumbnail(shot, 480, 270);
          const a = document.createElement('a');
          a.href = url;
          a.download = `shot_${(shot.orderIndex + 1).toString().padStart(3, '0')}_${
            shot.id.slice(0, 6)
          }.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          await new Promise((r) => setTimeout(r, 80));
        } catch (e) {
          console.warn(`缩略图生成失败: ${shot.id}`, e);
        }
        done++;
        setProgress(Math.round((done / shots.length) * 100));
      }

      const csvBlob = new Blob(['\ufeff' + csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const csvUrl = URL.createObjectURL(csvBlob);
      const csvA = document.createElement('a');
      csvA.href = csvUrl;
      csvA.download = `${currentProject.name}_分镜清单.csv`;
      document.body.appendChild(csvA);
      csvA.click();
      document.body.removeChild(csvA);
      URL.revokeObjectURL(csvUrl);
    } catch (err: any) {
      setError(`导出失败：${err?.message || err}`);
    } finally {
      setTimeout(() => setProcessing(false), 500);
    }
  };

  const handleImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportFile(file);
    setImportPreview(null);

    try {
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > 50) {
        setError(`文件过大（${sizeMB.toFixed(2)}MB），请选择 50MB 以内的 JSON 文件`);
        return;
      }
      setProcessing(true);
      setProgress(30);
      const text = await file.text();
      setProgress(60);
      const data = JSON.parse(text);
      if (!data.project || !data.scenes || !data.shots) {
        throw new Error('JSON 格式不合法：缺少必要字段 project/scenes/shots');
      }
      setProgress(90);
      setImportPreview({
        project: data.project as Project,
        scenes: data.scenes as Scene[],
        shots: data.shots as Shot[],
      });
      setProgress(100);
    } catch (err: any) {
      setError(`解析失败：${err?.message || err}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setProcessing(true);
    setError(null);
    try {
      const newProjectId = await importProject({
        project: importPreview.project,
        scenes: importPreview.scenes,
        shots: importPreview.shots,
      });
      onClose();
      navigate(`/editor?project=${newProjectId}`);
    } catch (err: any) {
      setError(`导入失败：${err?.message || err}`);
      setProcessing(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="space-y-4">
      <div className="flex bg-white/5 rounded-lg p-1">
        <button
          onClick={() => {
            setActiveTab('export');
            setError(null);
          }}
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${
            activeTab === 'export'
              ? 'bg-[#7c3aed] text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          📤 导出项目
        </button>
        <button
          onClick={() => {
            setActiveTab('import');
            setError(null);
            setImportFile(null);
            setImportPreview(null);
          }}
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${
            activeTab === 'import'
              ? 'bg-[#7c3aed] text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          📥 导入项目
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg px-4 py-3 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {processing && (
        <div className="space-y-2">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 text-center">{progress}%</p>
        </div>
      )}

      {activeTab === 'export' ? (
        <div className="space-y-4">
          <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
            <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#7c3aed]">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              项目概览
            </h4>
            <p className="text-xs text-gray-400">
              项目：<span className="text-gray-200 font-medium">{currentProject.name}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { label: '场景', val: stats.scenes, color: 'text-blue-400' },
                { label: '分镜', val: stats.shots, color: 'text-[#7c3aed]' },
                { label: '图层', val: stats.layers, color: 'text-amber-400' },
                { label: '对白', val: stats.dialogues, color: 'text-emerald-400' },
                { label: '音效', val: stats.sfxTags, color: 'text-rose-400' },
                { label: '参考图', val: stats.refImages, color: 'text-cyan-400' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-black/20 rounded-lg p-2.5 border border-white/5"
                >
                  <p className={`text-lg font-bold ${item.color}`}>{item.val}</p>
                  <p className="text-[10px] text-gray-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleExportJson}
              disabled={processing}
              className="w-full py-3.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-all shadow-lg shadow-[#7c3aed]/20 hover:shadow-[#7c3aed]/30 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              导出 JSON 项目文件
              {totalSize && <span className="text-xs opacity-70">({totalSize})</span>}
            </button>

            <button
              onClick={handleExportThumbnails}
              disabled={processing || shots.length === 0}
              className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-gray-200 text-sm font-medium transition-all border border-white/10 hover:border-[#7c3aed]/40 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              批量导出缩略图 PNG + 分镜清单 CSV
              <span className="text-xs text-gray-500">({shots.length} 张)</span>
            </button>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-200/80 leading-relaxed">
              💡 <strong className="text-amber-300">提示：</strong>JSON 文件包含完整项目数据（图层、对白、音效），可随时导入恢复。缩略图导出会逐张触发浏览器下载，请耐心等待。
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label
            className={`cursor-pointer block border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              importFile
                ? 'border-[#7c3aed]/40 bg-[#7c3aed]/5'
                : 'border-white/10 hover:border-[#7c3aed] hover:bg-[#7c3aed]/5'
            } ${processing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportSelect}
            />
            {importFile ? (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-[#7c3aed]/20 flex items-center justify-center text-[#7c3aed]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <p className="text-sm text-gray-200 font-medium">{importFile.name}</p>
                <p className="text-[11px] text-gray-500">
                  {(importFile.size / 1024).toFixed(1)} KB · 点击重新选择
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 flex items-center justify-center text-gray-500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-sm text-gray-300">点击选择 .json 项目文件</p>
                <p className="text-[11px] text-gray-500">
                  支持导出的项目文件，导入后会创建全新项目副本
                </p>
              </div>
            )}
          </label>

          {importPreview && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10 animate-fade-in">
              <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                文件解析成功
              </h4>
              <div className="text-xs space-y-1">
                <p className="flex justify-between">
                  <span className="text-gray-500">项目名称</span>
                  <span className="text-gray-200">{importPreview.project.name}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-500">场景数</span>
                  <span className="text-gray-200">{importPreview.scenes.length}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-500">分镜数</span>
                  <span className="text-gray-200">{importPreview.shots.length}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-500">总时长</span>
                  <span className="text-gray-200">
                    {importPreview.shots.reduce((s, sh) => s + sh.duration, 0).toFixed(1)}s
                  </span>
                </p>
              </div>

              <button
                onClick={handleConfirmImport}
                disabled={processing}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                确认导入并打开新项目
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
