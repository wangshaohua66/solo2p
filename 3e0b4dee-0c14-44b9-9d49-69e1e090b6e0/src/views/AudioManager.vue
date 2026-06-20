<script setup lang="ts">
import { ref } from 'vue';
import { useAudioStore } from '@/stores/audio';
import { useProjectStore } from '@/stores/project';
import WaveformViewer from '@/components/common/WaveformViewer.vue';

const audioStore = useAudioStore();
const projectStore = useProjectStore();
const fileInput = ref<HTMLInputElement | null>(null);

function triggerUpload() { fileInput.value?.click(); }

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a)$/i.test(f.name)) {
      await audioStore.addAudio(f);
    } else {
      alert(`不支持的文件类型: ${f.name}`);
    }
  }
  input.value = '';
}
</script>

<template>
  <div class="audio-page">
    <div class="page-toolbar">
      <div class="tool-group">
        <button class="btn-primary" @click="triggerUpload">⬆ 上传音效</button>
        <input ref="fileInput" type="file" accept="audio/*" multiple style="display: none;" @change="onFile" />
        <span v-if="audioStore.isDecoding" class="decoding-hint">
          <span class="spinner"></span> 解码中 {{ (audioStore.decodingProgress*100).toFixed(0) }}%
        </span>
      </div>
      <div class="spacer"></div>
      <div class="tool-group">
        <span class="hint">拖拽音频到左侧资源树或点击上传</span>
      </div>
    </div>

    <div class="main-body">
      <div class="left-list">
        <div class="panel audio-list" style="height: 100%; display: flex; flex-direction: column;">
          <div class="panel-header">🔊 音效列表 ({{ projectStore.audioClips.length }})</div>
          <div class="list-body">
            <div v-if="projectStore.audioClips.length === 0" class="empty-list">
              <div class="big">🎵</div>
              <p>暂无音效，点击上方按钮上传</p>
              <p class="tiny">支持 WAV / MP3 / OGG / FLAC / M4A</p>
            </div>
            <div v-else class="audio-items">
              <div v-for="a in projectStore.audioClips" :key="a.id"
                class="audio-item"
                :class="{ active: audioStore.selectedClipId === a.id }"
                @click="audioStore.selectedClipId = a.id">
                <div class="ai-play">
                  <button class="play-btn" @click.stop="audioStore.playClip(a.id)" title="试听">▶</button>
                </div>
                <div class="ai-info">
                  <div class="ai-name">{{ a.name }}</div>
                  <div class="ai-meta">
                    <span>{{ a.duration.toFixed(2) }}s</span>
                    <span class="dot">·</span>
                    <span>{{ (a.volume*100).toFixed(0) }}%</span>
                    <span v-if="a.loop" class="loop-badge">🔁</span>
                  </div>
                </div>
                <div v-if="projectStore.getReferencesOfAudio(a.id).length > 0" class="used-dot" title="已被引用"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="center-col">
        <div class="waveform-box">
          <WaveformViewer />
        </div>
        <div class="bindings-box panel">
          <div class="panel-header">🔗 音效挂载位置</div>
          <div class="bindings-body">
            <div v-if="!audioStore.selectedClip" class="empty-hint">选择音效查看挂载位置</div>
            <template v-else>
              <div class="section-group-title">动画事件帧引用</div>
              <div class="refs-grid">
                <template v-for="a in projectStore.animations" :key="a.id">
                  <template v-for="t in a.tracks" :key="t.id">
                    <template v-for="(k, ki) in t.keyframes.filter(k => k.audioClipId === audioStore.selectedClipId)" :key="k.id">
                      <div class="ref-card">
                        <div class="ref-icon">🎬</div>
                        <div class="ref-detail">
                          <div class="ref-main">{{ a.name }} / {{ t.name }}</div>
                          <div class="ref-sub">第 {{ ki + 1 }} 帧 · {{ k.eventType }}</div>
                        </div>
                      </div>
                    </template>
                  </template>
                </template>
              </div>
              <div class="section-group-title" style="margin-top: 12px;">地图触发区域引用</div>
              <div class="refs-grid">
                <template v-for="tm in projectStore.tilemaps" :key="tm.id">
                  <div v-for="z in tm.triggerZones.filter(z => z.audioClipId === audioStore.selectedClipId)" :key="z.id" class="ref-card">
                    <div class="ref-icon">🗺️</div>
                    <div class="ref-detail">
                      <div class="ref-main">{{ tm.name }}</div>
                      <div class="ref-sub">{{ z.type }} · ({{ z.x }}, {{ z.y }}) {{ z.w }}×{{ z.h }}</div>
                    </div>
                  </div>
                </template>
              </div>
              <div class="section-group-title" style="margin-top: 12px;">💡 使用提示</div>
              <ul class="tips">
                <li>在「动画编排」页选关键帧→属性面板→事件→触发音效→选择音效</li>
                <li>在「地图编辑」页新建触发区域→属性面板→关联音效</li>
                <li>当前音效页可试听、裁剪片段、调节音量与淡入淡出</li>
              </ul>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-page {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-height: 0;
  background: var(--color-bg-canvas);
}
.page-toolbar {
  flex: 0 0 auto; display: flex;
  align-items: center; gap: 12px;
  padding: 8px 14px;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}
.tool-group { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
.hint { font-size: 11px; color: var(--color-text-muted); }
.decoding-hint {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--color-text-secondary);
  padding: 4px 10px; background: var(--color-bg-input);
  border-radius: 14px;
}
.spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border: 2px solid var(--color-text-secondary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.main-body {
  flex: 1; min-height: 0;
  display: flex; padding: 10px;
  gap: 10px;
}
.left-list {
  flex: 0 0 260px; min-height: 0;
  display: flex;
}
.audio-list .panel-header { font-size: 12px; }
.list-body {
  flex: 1; overflow-y: auto; padding: 8px;
  min-height: 0;
}
.empty-list {
  height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; color: var(--color-text-muted);
  text-align: center;
}
.empty-list .big { font-size: 48px; opacity: 0.5; }
.empty-list .tiny { font-size: 10px; opacity: 0.7; }

.audio-items { display: flex; flex-direction: column; gap: 6px; }
.audio-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}
.audio-item:hover {
  border-color: var(--color-text-secondary);
  transform: translateX(2px);
}
.audio-item.active {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 10px var(--shadow-glow-orange);
  background: rgba(255, 107, 53, 0.08);
}
.ai-play { flex-shrink: 0; }
.play-btn {
  width: 32px; height: 32px; border-radius: 50%;
  padding: 0; display: flex; align-items: center; justify-content: center;
  background: var(--color-text-secondary);
  border-color: var(--color-text-secondary);
  color: #1a1d24; font-weight: 700;
}
.play-btn:hover {
  box-shadow: 0 0 12px var(--shadow-glow-cyan);
}
.ai-info {
  flex: 1; min-width: 0;
  overflow: hidden;
}
.ai-name {
  font-size: 12px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ai-meta {
  font-size: 10px; color: var(--color-text-muted);
  margin-top: 3px;
  display: flex; align-items: center; gap: 4px;
}
.ai-meta .dot { opacity: 0.5; }
.loop-badge { font-size: 10px; }
.used-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-text-success);
  box-shadow: 0 0 6px var(--color-text-success);
  flex-shrink: 0;
}

.center-col {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.waveform-box {
  flex: 0 0 auto;
  min-height: 0;
}
.bindings-box {
  flex: 1;
  display: flex; flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.bindings-box .panel-header { font-size: 12px; flex-shrink: 0; }
.bindings-body {
  flex: 1; overflow-y: auto;
  padding: 14px;
}
.empty-hint {
  padding: 40px 20px; text-align: center;
  color: var(--color-text-muted); font-size: 12px;
}
.refs-grid {
  display: flex; flex-direction: column; gap: 6px;
}
.ref-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.ref-icon { font-size: 18px; }
.ref-main {
  font-size: 12px; font-weight: 600;
}
.ref-sub {
  font-size: 10px; color: var(--color-text-muted);
  margin-top: 2px;
}
.tips {
  list-style: none;
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(0,212,255,0.06), rgba(255,107,53,0.06));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.tips li {
  font-size: 11px; color: var(--color-text-muted);
  line-height: 1.9; padding-left: 16px;
  position: relative;
}
.tips li::before {
  content: '✓'; position: absolute; left: 0;
  color: var(--color-text-success); font-weight: 700;
}
</style>
