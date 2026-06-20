<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  poster: {
    type: String,
    default: ''
  },
  autoplay: {
    type: Boolean,
    default: false
  },
  controls: {
    type: Boolean,
    default: true
  },
  loop: {
    type: Boolean,
    default: false
  },
  muted: {
    type: Boolean,
    default: false
  },
  playbackRates: {
    type: Array,
    default: () => [0.5, 0.75, 1, 1.25, 1.5, 2]
  },
  aspectRatio: {
    type: String,
    default: '16:9'
  }
})

const emit = defineEmits(['ready', 'play', 'pause', 'timeupdate', 'ended', 'error'])

const videoRef = ref<HTMLVideoElement>()
const player = ref<any>(null)

function initPlayer() {
  if (!videoRef.value) return
  
  player.value = videojs(videoRef.value, {
    poster: props.poster,
    autoplay: props.autoplay,
    controls: props.controls,
    loop: props.loop,
    muted: props.muted,
    playbackRates: props.playbackRates,
    aspectRatio: props.aspectRatio,
    fluid: true,
    language: 'zh-CN',
    sources: [{
      src: props.src,
      type: 'video/mp4'
    }],
    controlBar: {
      volumePanel: {
        inline: false
      },
      pictureInPictureToggle: true,
      playbackRateMenuButton: true
    },
    html5: {
      vhs: {
        overrideNative: true
      },
      nativeVideoTracks: false,
      nativeAudioTracks: false,
      nativeTextTracks: false
    }
  })
  
  player.value.ready(() => {
    emit('ready', player.value)
  })
  
  player.value.on('play', () => emit('play'))
  player.value.on('pause', () => emit('pause'))
  player.value.on('timeupdate', () => {
    emit('timeupdate', {
      currentTime: player.value.currentTime(),
      duration: player.value.duration()
    })
  })
  player.value.on('ended', () => emit('ended'))
  player.value.on('error', (err: any) => emit('error', err))
}

function destroyPlayer() {
  if (player.value) {
    player.value.dispose()
    player.value = null
  }
}

watch(() => props.src, (newSrc) => {
  if (player.value && newSrc) {
    player.value.src({
      src: newSrc,
      type: 'video/mp4'
    })
  }
})

watch(() => props.poster, (newPoster) => {
  if (player.value && newPoster) {
    player.value.poster(newPoster)
  }
})

onMounted(() => {
  nextTick(() => {
    initPlayer()
  })
})

onBeforeUnmount(() => {
  destroyPlayer()
})

defineExpose({
  player,
  play: () => player.value?.play(),
  pause: () => player.value?.pause(),
  currentTime: (time?: number) => time !== undefined ? player.value?.currentTime(time) : player.value?.currentTime(),
  duration: () => player.value?.duration(),
  requestFullscreen: () => player.value?.requestFullscreen()
})
</script>

<template>
  <div class="video-preview-wrapper">
    <video
      ref="videoRef"
      class="video-js vjs-big-play-centered"
      playsinline
    />
  </div>
</template>

<style lang="scss" scoped>
.video-preview-wrapper {
  width: 100%;
  background-color: #000;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  
  :deep(.video-js) {
    width: 100%;
    
    &.vjs-big-play-centered .vjs-big-play-button {
      top: 50%;
      left: 50%;
      margin-top: -1.5em;
      margin-left: -1.5em;
      width: 3em;
      height: 3em;
      line-height: 3em;
      border-radius: 50%;
      background-color: rgba(64, 158, 255, 0.9);
      border: none;
      
      &:hover {
        background-color: var(--primary-color);
      }
    }
    
    .vjs-control-bar {
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
    }
    
    .vjs-slider {
      background-color: rgba(255,255,255,0.3);
    }
    
    .vjs-play-progress {
      background-color: var(--primary-color);
    }
    
    .vjs-load-progress {
      background: rgba(255,255,255,0.2);
    }
    
    .vjs-volume-panel {
      .vjs-volume-control {
        background-color: rgba(255,255,255,0.3);
      }
      
      .vjs-volume-level {
        background-color: var(--primary-color);
      }
    }
  }
}
</style>
