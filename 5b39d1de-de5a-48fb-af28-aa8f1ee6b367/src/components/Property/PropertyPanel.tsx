import React, { useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  CAMERA_MOVEMENT_OPTIONS,
  TRANSITION_OPTIONS,
  SFX_PRESETS,
  MAX_DIALOGUES,
  MIN_DURATION,
  MAX_DURATION,
} from '@/types';
import { db } from '@/db';

const SectionTitle: React.FC<{ icon: string; title: string; count?: number }> = ({
  icon,
  title,
  count,
}) => (
  <div className="section-collapse">
    <div className="flex items-center gap-2 px-0.5">
      <span className="text-[#7c3aed]">{icon}</span>
      <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </div>
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs text-gray-400 mb-1.5">{children}</label>
);

export const PropertyPanel: React.FC = () => {
  const currentShot = useProjectStore((s) => s.getCurrentShot());
  const updateShot = useProjectStore((s) => s.updateShot);
  const addDialogue = useProjectStore((s) => s.addDialogue);
  const updateDialogue = useProjectStore((s) => s.updateDialogue);
  const deleteDialogue = useProjectStore((s) => s.deleteDialogue);
  const toggleSfxTag = useProjectStore((s) => s.toggleSfxTag);
  const uploadReferenceImage = useProjectStore((s) => s.uploadReferenceImage);
  const removeReferenceImage = useProjectStore((s) => s.removeReferenceImage);
  const updateReferenceOpacity = useProjectStore((s) => s.updateReferenceOpacity);
  const commitHistory = useProjectStore((s) => s._commitHistory);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refLoading, setRefLoading] = useState(false);

  if (!currentShot) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-gray-600">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        </div>
        <h3 className="text-sm text-gray-300 mb-2 font-medium">未选择分镜</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          在左侧场景树中选择或创建一个分镜，即可编辑镜头时长、对白、音效等属性。
        </p>
      </div>
    );
  }

  const handleDurationChange = (value: number) => {
    updateShot(currentShot.id, { duration: value });
    commitHistory();
  };

  const handleFieldChange = <K extends 'cameraMovement' | 'transition' | 'title'>(
    key: K,
    value: any
  ) => {
    updateShot(currentShot.id, { [key]: value });
    commitHistory();
  };

  const handleAddDialogue = () => {
    if ((currentShot.dialogues?.length || 0) >= MAX_DIALOGUES) return;
    addDialogue(currentShot.id, { character: '', text: '', timePoint: 0 });
    commitHistory();
  };

  const handleUpdateDialogue = (dialogueId: string, patch: Partial<any>) => {
    updateDialogue(currentShot.id, dialogueId, patch);
  };

  const handleDeleteDialogue = (dialogueId: string) => {
    deleteDialogue(currentShot.id, dialogueId);
    commitHistory();
  };

  const handleSfxToggle = (sfxName: string) => {
    toggleSfxTag(currentShot.id, sfxName);
    commitHistory();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentShot) return;
    if (!file.type.startsWith('image/')) {
      alert('请上传图片格式的参考图（PNG/JPG/WebP 等）');
      return;
    }
    setRefLoading(true);
    try {
      const blob = file.slice(0, file.size, file.type);
      const url = await db.addReferenceImage(blob);
      uploadReferenceImage(currentShot.id, {
        id: `ref_${Date.now()}`,
        url,
        name: file.name,
        opacity: 0.5,
      });
      commitHistory();
    } catch (err) {
      console.error('上传失败', err);
      alert('参考图上传失败，请重试');
    } finally {
      setRefLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveRef = () => {
    if (!currentShot.referenceImage) return;
    if (!confirm(`删除参考图「${currentShot.referenceImage.name}」？`)) return;
    removeReferenceImage(currentShot.id);
    commitHistory();
  };

  const dialogueCount = currentShot.dialogues?.length || 0;
  const sfxCount = currentShot.sfxTags?.length || 0;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="sticky top-0 z-10 bg-[#1e1e2e] px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1 h-5 bg-[#7c3aed] rounded-full"></span>
          <h2 className="text-sm font-semibold text-gray-100">属性面板</h2>
        </div>
        <p className="text-xs text-gray-500 truncate">
          {currentShot.title || `分镜 #${currentShot.orderIndex + 1}`}
        </p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        <section>
          <SectionTitle icon="🎬" title="分镜基础" />
          <div className="space-y-4 mt-3">
            <div>
              <FieldLabel>分镜标题</FieldLabel>
              <input
                type="text"
                value={currentShot.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="如：主角仰望星空特写"
                className="input-primary w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>镜头时长</FieldLabel>
                <span className="text-xs font-mono text-[#7c3aed] bg-[#7c3aed]/10 px-1.5 py-0.5 rounded">
                  {currentShot.duration.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min={MIN_DURATION}
                max={MAX_DURATION}
                step={0.1}
                value={currentShot.duration}
                onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                className="w-full accent-[#7c3aed] h-1.5 cursor-pointer"
              />
              <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                <span>{MIN_DURATION}s</span>
                <span>{MAX_DURATION}s</span>
              </div>
            </div>

            <div>
              <FieldLabel>镜头运动</FieldLabel>
              <select
                value={currentShot.cameraMovement}
                onChange={(e) => handleFieldChange('cameraMovement', e.target.value)}
                className="w-full input-primary appearance-none cursor-pointer pr-8"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%239ca3af%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '12px',
                }}
              >
                {CAMERA_MOVEMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>转场类型</FieldLabel>
              <select
                value={currentShot.transition}
                onChange={(e) => handleFieldChange('transition', e.target.value)}
                className="w-full input-primary appearance-none cursor-pointer pr-8"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%239ca3af%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '12px',
                }}
              >
                {TRANSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle icon="💬" title="对白" count={dialogueCount} />
          <div className="space-y-3 mt-3">
            {(currentShot.dialogues || []).map((d, i) => (
              <div
                key={d.id}
                className="group bg-white/5 border border-white/10 rounded-lg p-3 space-y-2 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-500">#{i + 1}</span>
                  <button
                    onClick={() => handleDeleteDialogue(d.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10"
                    title="删除对白"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={d.character}
                  onChange={(e) => handleUpdateDialogue(d.id, { character: e.target.value })}
                  onBlur={() => commitHistory()}
                  placeholder="角色名"
                  className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-gray-100 placeholder-gray-600 outline-none focus:border-[#7c3aed]"
                />
                <textarea
                  value={d.text}
                  onChange={(e) => handleUpdateDialogue(d.id, { text: e.target.value })}
                  onBlur={() => commitHistory()}
                  placeholder="台词内容..."
                  rows={2}
                  className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-gray-100 placeholder-gray-600 outline-none focus:border-[#7c3aed] resize-none"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">出场时间</span>
                  <input
                    type="range"
                    min={0}
                    max={currentShot.duration}
                    step={0.1}
                    value={d.timePoint}
                    onChange={(e) => handleUpdateDialogue(d.id, { timePoint: parseFloat(e.target.value) })}
                    onMouseUp={() => commitHistory()}
                    className="flex-1 accent-[#7c3aed] h-1"
                  />
                  <span className="text-[10px] font-mono text-gray-400 w-8 text-right">
                    {d.timePoint.toFixed(1)}s
                  </span>
                </div>
              </div>
            ))}

            {dialogueCount < MAX_DIALOGUES && (
              <button
                onClick={handleAddDialogue}
                className="w-full py-2.5 border-2 border-dashed border-white/10 rounded-lg text-xs text-gray-400 hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors flex items-center justify-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                添加对白 ({dialogueCount}/{MAX_DIALOGUES})
              </button>
            )}
            {dialogueCount >= MAX_DIALOGUES && (
              <p className="text-[10px] text-amber-400 text-center">已达每分镜 {MAX_DIALOGUES} 条对白上限</p>
            )}
          </div>
        </section>

        <section>
          <SectionTitle icon="🔊" title="音效标签" count={sfxCount} />
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SFX_PRESETS.map((sfx) => {
              const active = currentShot.sfxTags?.includes(sfx.value) || false;
              return (
                <button
                  key={sfx.value}
                  onClick={() => handleSfxToggle(sfx.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] transition-all duration-200 border ${
                    active
                      ? 'bg-[#7c3aed] border-[#7c3aed] text-white shadow-[0_0_8px_rgba(124,58,237,0.4)]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-200'
                  }`}
                  title={sfx.label}
                >
                  {sfx.icon} {sfx.label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle icon="🖼️" title="参考图" />
          <div className="mt-3 space-y-3">
            {currentShot.referenceImage ? (
              <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5">
                <div className="relative aspect-video bg-black/30 overflow-hidden">
                  <img
                    src={currentShot.referenceImage.url}
                    alt={currentShot.referenceImage.name}
                    className="w-full h-full object-contain"
                    style={{ opacity: currentShot.referenceImage.opacity }}
                  />
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-300 truncate flex-1">
                      {currentShot.referenceImage.name}
                    </p>
                    <button
                      onClick={handleRemoveRef}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10 ml-2"
                      title="删除参考图"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>透明度</span>
                      <span className="text-gray-300">
                        {Math.round(currentShot.referenceImage.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={0.9}
                      step={0.05}
                      value={currentShot.referenceImage.opacity}
                      onChange={(e) =>
                        updateReferenceOpacity(currentShot.id, parseFloat(e.target.value))
                      }
                      onMouseUp={() => commitHistory()}
                      className="w-full accent-[#7c3aed] h-1"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div
                  className={`border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-[#7c3aed] transition-colors ${
                    refLoading ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {refLoading ? (
                    <div className="text-xs text-[#7c3aed]">上传中...</div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-[#7c3aed]/10 flex items-center justify-center mx-auto mb-2 text-[#7c3aed]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <path d="M17 8l-5-5-5 5" />
                          <path d="M12 3v12" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-300 mb-1">点击上传参考图</p>
                      <p className="text-[10px] text-gray-500">PNG / JPG / WebP，作为半透明底层</p>
                    </>
                  )}
                </div>
              </label>
            )}
          </div>
        </section>

        <section>
          <SectionTitle icon="📊" title="分镜信息" />
          <div className="mt-3 bg-white/5 rounded-lg p-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-500">ID</span>
              <span className="font-mono text-gray-300 truncate ml-2 max-w-[50%]" title={currentShot.id}>
                {currentShot.id.slice(0, 12)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">图层数量</span>
              <span className="text-gray-300">{currentShot.layers?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">排序索引</span>
              <span className="text-gray-300">{currentShot.orderIndex}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">创建时间</span>
              <span className="text-gray-300">{new Date(currentShot.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">更新时间</span>
              <span className="text-gray-300">{new Date(currentShot.updatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </section>

        <div className="h-4" />
      </div>
    </div>
  );
};
