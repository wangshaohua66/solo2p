import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Animation, AnimationTrack, AnimationKeyframe } from '@/types';
import { useProjectStore } from './project';
import { genId } from '@/utils/id';
import { deepClone } from '@/utils/diff';

export const useAnimationStore = defineStore('animation', () => {
  const projectStore = useProjectStore();
  const selectedAnimId = ref<string | null>(null);
  const selectedTrackId = ref<string | null>(null);
  const selectedKeyframeId = ref<string | null>(null);
  const isPlaying = ref(false);
  const playbackTime = ref(0);

  const selectedAnim = computed<Animation | null>(() =>
    projectStore.animations.find(a => a.id === selectedAnimId.value) || null
  );

  const selectedTrack = computed<AnimationTrack | null>(() => {
    const a = selectedAnim.value;
    if (!a || !selectedTrackId.value) return null;
    return a.tracks.find(t => t.id === selectedTrackId.value) || null;
  });

  const selectedKeyframe = computed<AnimationKeyframe | null>(() => {
    const t = selectedTrack.value;
    if (!t || !selectedKeyframeId.value) return null;
    return t.keyframes.find(k => k.id === selectedKeyframeId.value) || null;
  });

  const totalDuration = computed(() => {
    const a = selectedAnim.value;
    if (!a) return 0;
    return a.tracks.reduce((max, t) => {
      const d = t.keyframes.reduce((s, k) => s + k.durationMs, 0);
      return Math.max(max, d);
    }, 0);
  });

  function createAnimation(name: string): Animation | null {
    if (!projectStore.currentProjectId) return null;
    const anim: Animation = {
      id: genId('anim'), projectId: projectStore.currentProjectId,
      name, loop: true, frameRate: 24, tracks: [
        { id: genId('tr'), animId: '', name: '身体', zIndex: 0, keyframes: [] },
        { id: genId('tr'), animId: '', name: '武器', zIndex: 1, keyframes: [] },
        { id: genId('tr'), animId: '', name: '特效', zIndex: 2, keyframes: [] }
      ]
    };
    anim.tracks.forEach(t => t.animId = anim.id);
    projectStore.animations.push(anim);
    selectedAnimId.value = anim.id;
    selectedTrackId.value = anim.tracks[0].id;
    projectStore.persistCurrent();
    return anim;
  }

  function addTrack(animId: string, name: string): AnimationTrack | null {
    const a = projectStore.animations.find(x => x.id === animId);
    if (!a) return null;
    const t: AnimationTrack = {
      id: genId('tr'), animId, name,
      zIndex: a.tracks.length, keyframes: []
    };
    a.tracks.push(t);
    projectStore.persistCurrent();
    return t;
  }

  function addKeyframe(trackId: string, frameId: string, durationMs = 83): AnimationKeyframe | null {
    const track = findTrack(trackId);
    if (!track) return null;
    const k: AnimationKeyframe = {
      id: genId('kf'), trackId, frameId, durationMs,
      offsetX: 0, offsetY: 0, rotation: 0,
      eventType: 'none', eventValue: '', audioClipId: null
    };
    track.keyframes.push(k);
    projectStore.persistCurrent();
    return k;
  }

  function insertKeyframe(trackId: string, index: number, frameId: string, durationMs = 83): AnimationKeyframe | null {
    const track = findTrack(trackId);
    if (!track) return null;
    const k: AnimationKeyframe = {
      id: genId('kf'), trackId, frameId, durationMs,
      offsetX: 0, offsetY: 0, rotation: 0,
      eventType: 'none', eventValue: '', audioClipId: null
    };
    track.keyframes.splice(index, 0, k);
    projectStore.persistCurrent();
    return k;
  }

  function findTrack(id: string): AnimationTrack | null {
    for (const a of projectStore.animations) {
      const t = a.tracks.find(x => x.id === id);
      if (t) return t;
    }
    return null;
  }

  function moveKeyframe(trackId: string, from: number, to: number) {
    const track = findTrack(trackId);
    if (!track) return;
    const before = deepClone(track.keyframes);
    const [item] = track.keyframes.splice(from, 1);
    track.keyframes.splice(to, 0, item);
    projectStore.pushHistory({
      type: 'track-keyframes', targetId: trackId,
      before, after: deepClone(track.keyframes),
      label: `移动关键帧`
    });
    projectStore.persistCurrent();
  }

  function removeKeyframe(trackId: string, kfId: string) {
    const track = findTrack(trackId);
    if (!track) return;
    const before = deepClone(track.keyframes);
    const kf = track.keyframes.find(k => k.id === kfId);
    track.keyframes = track.keyframes.filter(k => k.id !== kfId);
    if (selectedKeyframeId.value === kfId) selectedKeyframeId.value = null;
    if (kf) {
      projectStore.pushHistory({
        type: 'keyframe', targetId: kfId,
        before: kf, after: null as any,
        label: `删除关键帧`
      });
    }
    projectStore.persistCurrent();
  }

  function updateKeyframe(kfId: string, patch: Partial<AnimationKeyframe>) {
    for (const a of projectStore.animations) {
      for (const t of a.tracks) {
        const k = t.keyframes.find(k => k.id === kfId);
        if (k) {
          const before = deepClone(k);
          Object.assign(k, patch);
          projectStore.pushHistory({
            type: 'keyframe', targetId: kfId,
            before, after: deepClone(k),
            label: `更新关键帧`
          });
          projectStore.persistCurrent();
          return;
        }
      }
    }
  }

  function updateAnim(animId: string, patch: Partial<Animation>) {
    const a = projectStore.animations.find(x => x.id === animId);
    if (a) {
      const before = deepClone(a);
      Object.assign(a, patch);
      projectStore.pushHistory({
        type: 'animation', targetId: animId,
        before, after: deepClone(a),
        label: `更新动画 ${a.name}`
      });
      projectStore.persistCurrent();
    }
  }

  function deleteAnim(id: string) {
    const a = projectStore.animations.find(x => x.id === id);
    if (a) {
      projectStore.pushHistory({
        type: 'animation', targetId: id,
        before: deepClone(a), after: null as any,
        label: `删除动画 ${a.name}`
      });
    }
    projectStore.animations = projectStore.animations.filter(a => a.id !== id);
    if (selectedAnimId.value === id) {
      selectedAnimId.value = null;
      selectedTrackId.value = null;
      selectedKeyframeId.value = null;
    }
    projectStore.persistCurrent();
  }

  function selectAnim(id: string | null) {
    selectedAnimId.value = id;
    selectedTrackId.value = null;
    selectedKeyframeId.value = null;
    playbackTime.value = 0;
  }

  function selectTrack(id: string | null) {
    selectedTrackId.value = id;
    selectedKeyframeId.value = null;
  }

  function selectKeyframe(id: string | null) {
    selectedKeyframeId.value = id;
  }

  return {
    selectedAnimId, selectedTrackId, selectedKeyframeId,
    isPlaying, playbackTime,
    selectedAnim, selectedTrack, selectedKeyframe, totalDuration,
    createAnimation, addTrack, addKeyframe, insertKeyframe,
    moveKeyframe, removeKeyframe, updateKeyframe, updateAnim,
    deleteAnim, selectAnim, selectTrack, selectKeyframe
  };
});
