import { ref, watch, onUnmounted } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import type { TimelineEvent } from '@/types'
import { formatTime, getAnnotationColor, getRoleColor } from '@/utils/storage'

export function useTimeSync() {
  const transcriptStore = useTranscriptStore()
  const evidenceStore = useEvidenceStore()

  const timelineEvents = ref<TimelineEvent[]>([])
  const syncInterval = ref<number | null>(null)
  const isSyncing = ref(false)

  const generateTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = []

    transcriptStore.activeTranscripts.forEach(transcript => {
      events.push({
        id: `t-${transcript.id}`,
        timestamp: transcript.timestamp,
        type: 'transcript',
        refId: transcript.id,
        label: `${getRoleName(transcript.role)}: ${transcript.content.slice(0, 20)}...`,
        color: getRoleColor(transcript.role)
      })
    })

    evidenceStore.evidenceList.forEach(evidence => {
      if (evidence.createdAt) {
        const relativeTime = evidence.createdAt - transcriptStore.startTime
        if (relativeTime >= 0) {
          events.push({
            id: `e-${evidence.id}`,
            timestamp: relativeTime,
            type: 'evidence',
            refId: evidence.id,
            label: `证据: ${evidence.name}`,
            color: '#3498db'
          })
        }
      }
    })

    transcriptStore.annotations.forEach(annotation => {
      events.push({
        id: `a-${annotation.id}`,
        timestamp: annotation.timestamp,
        type: 'annotation',
        refId: annotation.id,
        label: `${getAnnotationTypeLabel(annotation.type)}: ${annotation.content.slice(0, 20)}...`,
        color: getAnnotationColor(annotation.type)
      })
    })

    return events.sort((a, b) => a.timestamp - b.timestamp)
  }

  const getAnnotationTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      dispute: '争议焦点',
      proof: '举证要点',
      defense: '质证意见',
      note: '备注'
    }
    return labels[type] || type
  }

  const getRoleName = (role: string): string => {
    const names: Record<string, string> = {
      judge: '审判长',
      clerk: '书记员',
      prosecutor: '公诉人',
      defender: '辩护人'
    }
    return names[role] || role
  }

  const updateTimeline = () => {
    timelineEvents.value = generateTimelineEvents()
  }

  const findNearestTranscript = (time: number) => {
    const transcripts = transcriptStore.activeTranscripts
    if (transcripts.length === 0) return null

    let nearest = transcripts[0]
    let minDiff = Math.abs(time - transcripts[0].timestamp)

    for (const t of transcripts) {
      const diff = Math.abs(time - t.timestamp)
      if (diff < minDiff) {
        minDiff = diff
        nearest = t
      }
      if (t.timestamp > time) break
    }

    return nearest
  }

  const findEvidenceAtTime = (time: number) => {
    return evidenceStore.evidenceList.filter(e => {
      if (!e.createdAt) return false
      const relativeTime = e.createdAt - transcriptStore.startTime
      return Math.abs(relativeTime - time) < 5000
    })
  }

  const findAnnotationsAtTime = (time: number, window: number = 5000) => {
    return transcriptStore.annotations.filter(a =>
      Math.abs(a.timestamp - time) < window
    )
  }

  const syncTranscriptToTime = (time: number) => {
    const transcript = findNearestTranscript(time)
    if (transcript) {
      transcriptStore.jumpToTranscript(transcript.id)
      return transcript
    }
    return null
  }

  const syncEvidenceToTime = (time: number) => {
    const evidence = evidenceStore.selectedEvidence
    if (evidence && (evidence.type === 'video' || evidence.type === 'audio')) {
      evidenceStore.setEvidenceTime(evidence.id, time)
    }
  }

  const startSync = () => {
    if (syncInterval.value) return
    isSyncing.value = true
    syncInterval.value = window.setInterval(() => {
      if (transcriptStore.isRecording && !transcriptStore.isPlaybackMode) {
        const elapsed = Date.now() - transcriptStore.startTime
        transcriptStore.setCurrentTime(elapsed)
      }
      updateTimeline()
    }, 1000)
  }

  const stopSync = () => {
    if (syncInterval.value) {
      clearInterval(syncInterval.value)
      syncInterval.value = null
    }
    isSyncing.value = false
  }

  const jumpToEvent = (event: TimelineEvent) => {
    transcriptStore.setCurrentTime(event.timestamp)

    if (event.type === 'transcript') {
      transcriptStore.jumpToTranscript(event.refId)
    } else if (event.type === 'evidence') {
      evidenceStore.selectEvidence(event.refId)
      const transcript = findNearestTranscript(event.timestamp)
      if (transcript) {
        transcriptStore.jumpToTranscript(transcript.id)
      }
    } else if (event.type === 'annotation') {
      const annotation = transcriptStore.annotations.find(a => a.id === event.refId)
      if (annotation) {
        transcriptStore.jumpToTranscript(annotation.transcriptId)
        if (annotation.evidenceId) {
          evidenceStore.selectEvidence(annotation.evidenceId)
        }
      }
    }
  }

  const getEventsInRange = (startTime: number, endTime: number) => {
    return timelineEvents.value.filter(e =>
      e.timestamp >= startTime && e.timestamp <= endTime
    )
  }

  const getChapterMarkers = () => {
    const transcripts = transcriptStore.activeTranscripts
    if (transcripts.length < 2) return []

    const chapters: { time: number; label: string }[] = []
    const keywords = ['开庭', '法庭调查', '法庭辩论', '最后陈述', '休庭', '宣判']

    transcripts.forEach(t => {
      for (const kw of keywords) {
        if (t.content.includes(kw)) {
          chapters.push({
            time: t.timestamp,
            label: kw
          })
          break
        }
      }
    })

    return chapters
  }

  const formatTimestamp = (timestamp: number) => {
    return formatTime(timestamp + transcriptStore.startTime)
  }

  watch(
    () => transcriptStore.currentTime,
    (newTime) => {
      if (!transcriptStore.isPlaybackMode) {
        syncEvidenceToTime(newTime)
      }
    }
  )

  watch(
    () => [transcriptStore.activeTranscripts.length, evidenceStore.evidenceList.length, transcriptStore.annotations.length],
    () => {
      updateTimeline()
    },
    { deep: true }
  )

  onUnmounted(() => {
    stopSync()
  })

  return {
    timelineEvents,
    isSyncing,
    updateTimeline,
    findNearestTranscript,
    findEvidenceAtTime,
    findAnnotationsAtTime,
    syncTranscriptToTime,
    syncEvidenceToTime,
    startSync,
    stopSync,
    jumpToEvent,
    getEventsInRange,
    getChapterMarkers,
    formatTimestamp
  }
}
