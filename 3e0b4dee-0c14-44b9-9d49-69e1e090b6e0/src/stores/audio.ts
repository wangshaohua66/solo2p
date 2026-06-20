import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AudioClip } from '@/types';
import { useProjectStore } from './project';
import { genId } from '@/utils/id';
import { decodeAudio, extractWaveform, AudioPlayer } from '@/utils/audio-helper';
import { deepClone } from '@/utils/diff';

export const useAudioStore = defineStore('audio', () => {
  const projectStore = useProjectStore();
  const selectedClipId = ref<string | null>(null);
  const player = ref<AudioPlayer | null>(null);
  const bufferMap = new Map<string, AudioBuffer>();
  const isDecoding = ref(false);
  const decodingProgress = ref(0);

  const selectedClip = computed<AudioClip | null>(() =>
    projectStore.audioClips.find(a => a.id === selectedClipId.value) || null
  );

  let playerInst: AudioPlayer | null = null;
  function ensurePlayer(): AudioPlayer {
    if (!playerInst) {
      playerInst = new AudioPlayer();
      player.value = playerInst;
    }
    return playerInst;
  }

  async function addAudio(file: File): Promise<AudioClip | null> {
    if (!projectStore.currentProjectId) return null;
    isDecoding.value = true; decodingProgress.value = 0;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((res, rej) => {
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.onprogress = (e) => {
        if (e.total > 0) decodingProgress.value = e.loaded / e.total * 0.5;
      };
      reader.readAsDataURL(file);
    });
    decodingProgress.value = 0.5;
    const clip: AudioClip = {
      id: genId('au'), projectId: projectStore.currentProjectId,
      name: file.name.replace(/\.[^.]+$/, ''),
      type: file.type, audioDataUrl: dataUrl,
      duration: 0, volume: 0.8, fadeIn: 0.01, fadeOut: 0.05,
      loop: false, startTime: 0, endTime: 0
    };
    try {
      const buffer = await decodeAudio(dataUrl);
      decodingProgress.value = 0.9;
      bufferMap.set(clip.id, buffer);
      clip.duration = buffer.duration;
      clip.endTime = buffer.duration;
      clip.waveformData = extractWaveform(buffer, 2000);
    } catch (e) {
      console.warn('音频解码失败', e);
    }
    const before = null;
    projectStore.audioClips.push(clip);
    projectStore.pushHistory({ type: 'audioclip', targetId: clip.id, before, after: deepClone(clip) });
    selectedClipId.value = clip.id;
    projectStore.persistCurrent();
    isDecoding.value = false; decodingProgress.value = 1;
    return clip;
  }

  async function playClip(id: string) {
    const clip = projectStore.audioClips.find(a => a.id === id);
    if (!clip) return;
    if (!bufferMap.has(id)) {
      try { bufferMap.set(id, await decodeAudio(clip.audioDataUrl)); } catch { return; }
    }
    const buf = bufferMap.get(id)!;
    ensurePlayer().play(clip, buf);
  }

  function stopPlay() { player.value?.stop(); }

  function updateClip(id: string, patch: Partial<AudioClip>) {
    const c = projectStore.audioClips.find(a => a.id === id);
    if (!c) return;
    const before = deepClone(c);
    Object.assign(c, patch);
    projectStore.pushHistory({ type: 'audioclip', targetId: id, before, after: deepClone(c) });
    projectStore.persistCurrent();
  }

  function deleteClip(id: string) {
    const idx = projectStore.audioClips.findIndex(a => a.id === id);
    if (idx < 0) return;
    const before = deepClone(projectStore.audioClips[idx]);
    projectStore.audioClips.splice(idx, 1);
    projectStore.pushHistory({ type: 'audioclip', targetId: id, before, after: null });
    if (selectedClipId.value === id) selectedClipId.value = null;
    bufferMap.delete(id);
    projectStore.persistCurrent();
  }

  function getBuffer(id: string): AudioBuffer | undefined { return bufferMap.get(id); }

  async function ensureBuffer(id: string): Promise<AudioBuffer | null> {
    if (bufferMap.has(id)) return bufferMap.get(id)!;
    const c = projectStore.audioClips.find(a => a.id === id);
    if (!c) return null;
    try {
      const b = await decodeAudio(c.audioDataUrl);
      bufferMap.set(id, b);
      if (!c.waveformData) {
        c.waveformData = extractWaveform(b);
        projectStore.persistCurrent();
      }
      return b;
    } catch { return null; }
  }

  return {
    selectedClipId, isDecoding, decodingProgress, selectedClip,
    addAudio, playClip, stopPlay, updateClip, deleteClip,
    getBuffer, ensureBuffer
  };
});
