import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { TranscriptEntry, Role, QuickPhrase, SearchResult, AppSettings, CourtCase, Annotation, CollaborationAction, CollaborationUser } from '@/types'
import { storage, generateId, debounce } from '@/utils/storage'
import { useCollaboration } from '@/composables/useCollaboration'

const STORAGE_KEYS = {
  TRANSCRIPTS: 'transcripts',
  SETTINGS: 'settings',
  CASES: 'cases',
  QUICK_PHRASES: 'quickPhrases',
  CURRENT_CASE: 'currentCase'
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  projectionMode: false,
  currentRole: 'clerk',
  currentCaseId: '',
  autoSaveInterval: 60000,
  fontSize: 14,
  showLineNumbers: true
}

const DEFAULT_QUICK_PHRASES: QuickPhrase[] = [
  { id: '1', content: '现在开庭', category: '庭审流程', usageCount: 0 },
  { id: '2', content: '请坐下', category: '庭审流程', usageCount: 0 },
  { id: '3', content: '请公诉人宣读起诉书', category: '庭审流程', usageCount: 0 },
  { id: '4', content: '被告人，你对起诉书指控的犯罪事实有异议吗？', category: '庭审流程', usageCount: 0 },
  { id: '5', content: '请公诉人举证', category: '庭审流程', usageCount: 0 },
  { id: '6', content: '请辩护人质证', category: '庭审流程', usageCount: 0 },
  { id: '7', content: '请被告人做最后陈述', category: '庭审流程', usageCount: 0 },
  { id: '8', content: '现在休庭', category: '庭审流程', usageCount: 0 },
  { id: '9', content: '请法警带被告人退庭', category: '庭审流程', usageCount: 0 },
  { id: '10', content: '记录在案', category: '常用语', usageCount: 0 },
  { id: '11', content: '补充侦查', category: '法律术语', usageCount: 0 },
  { id: '12', content: '自首情节', category: '法律术语', usageCount: 0 },
  { id: '13', content: '立功表现', category: '法律术语', usageCount: 0 },
  { id: '14', content: '认罪认罚', category: '法律术语', usageCount: 0 },
  { id: '15', content: '附带民事诉讼', category: '法律术语', usageCount: 0 }
]

const DEFAULT_CASES: CourtCase[] = [
  {
    id: 'case-001',
    caseNumber: '(2024)京0101刑初123号',
    caseName: '被告人张三盗窃一案',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now()
  },
  {
    id: 'case-002',
    caseNumber: '(2024)京0101刑初124号',
    caseName: '被告人李四故意伤害一案',
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000
  }
]

export const useTranscriptStore = defineStore('transcript', () => {
  const collaboration = useCollaboration()
  
  const transcripts = ref<TranscriptEntry[]>([])
  const settings = ref<AppSettings>(DEFAULT_SETTINGS)
  const cases = ref<CourtCase[]>(DEFAULT_CASES)
  const quickPhrases = ref<QuickPhrase[]>([])
  const annotations = ref<Annotation[]>([])
  const isRecording = ref(false)
  const currentTime = ref(0)
  const startTime = ref(0)
  const searchQuery = ref('')
  const searchResults = ref<SearchResult[]>([])
  const selectedTranscriptId = ref<string | null>(null)
  const isSaving = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const isPlaybackMode = ref(false)
  const playbackSpeed = ref(1)
  const playbackInterval = ref<number | null>(null)
  const playbackAnnotationIds = ref<Set<string>>(new Set())
  const collaborationActions = ref<CollaborationAction[]>([])

  let collaborationUserId = collaboration.userId
  const isCollaborating = computed(() => collaboration.isConnected.value)
  const connectedUsers = computed(() => collaboration.connectedUsers)
  const isConnecting = computed(() => collaboration.isConnecting.value)
  const connectionError = computed(() => collaboration.connectionError.value)

  let unregisterActionHandler: (() => void) | null = null

  const currentCase = computed(() => {
    return cases.value.find(c => c.id === settings.value.currentCaseId) || cases.value[0]
  })

  const totalDuration = computed(() => {
    if (transcripts.value.length === 0) return 0
    return transcripts.value[transcripts.value.length - 1].timestamp
  })

  const activeTranscripts = computed(() => {
    return transcripts.value.filter(t => !t.isDeleted)
  })

  const filteredTranscripts = computed(() => {
    let results = activeTranscripts.value
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      results = results.filter(t => t.content.toLowerCase().includes(query))
    }
    return results
  })

  const getTranscriptById = (id: string) => {
    return transcripts.value.find(t => t.id === id)
  }

  const getAnnotationsByTranscriptId = (transcriptId: string) => {
    return annotations.value.filter(a => a.transcriptId === transcriptId)
  }

  const getAnnotationsByRole = (role: Role) => {
    return annotations.value.filter(a => a.role === role)
  }

  const loadFromStorage = async () => {
    try {
      const storedTranscripts = await storage.getItem<TranscriptEntry[]>(`${STORAGE_KEYS.TRANSCRIPTS}-${settings.value.currentCaseId}`)
      if (storedTranscripts) {
        transcripts.value = storedTranscripts
      }

      const storedSettings = await storage.getItem<AppSettings>(STORAGE_KEYS.SETTINGS)
      if (storedSettings) {
        settings.value = { ...DEFAULT_SETTINGS, ...storedSettings }
      }

      const storedCases = await storage.getItem<CourtCase[]>(STORAGE_KEYS.CASES)
      if (storedCases) {
        cases.value = storedCases
      }

      const storedPhrases = await storage.getItem<QuickPhrase[]>(STORAGE_KEYS.QUICK_PHRASES)
      if (storedPhrases) {
        quickPhrases.value = storedPhrases
      }

      const currentCaseId = await storage.getItem<string>(STORAGE_KEYS.CURRENT_CASE)
      if (currentCaseId && cases.value.find(c => c.id === currentCaseId)) {
        settings.value.currentCaseId = currentCaseId
      } else if (cases.value.length > 0) {
        settings.value.currentCaseId = cases.value[0].id
      }

      if (!settings.value.currentCaseId && cases.value.length > 0) {
        settings.value.currentCaseId = cases.value[0].id
      }
    } catch (error) {
      console.error('Failed to load from storage:', error)
    }
  }

  const saveToStorage = async () => {
    isSaving.value = true
    try {
      await storage.setItem(`${STORAGE_KEYS.TRANSCRIPTS}-${settings.value.currentCaseId}`, transcripts.value)
      await storage.setItem(STORAGE_KEYS.SETTINGS, settings.value)
      await storage.setItem(STORAGE_KEYS.CASES, cases.value)
      await storage.setItem(STORAGE_KEYS.QUICK_PHRASES, quickPhrases.value)
      await storage.setItem(STORAGE_KEYS.CURRENT_CASE, settings.value.currentCaseId)
      lastSavedAt.value = Date.now()
    } catch (error) {
      console.error('Failed to save to storage:', error)
    } finally {
      isSaving.value = false
    }
  }

  const debouncedSave = debounce(saveToStorage, 2000)

  const addTranscript = (content: string, role: Role = settings.value.currentRole, speaker?: string, isRemote = false) => {
    const now = Date.now()
    const entry: TranscriptEntry = {
      id: generateId(),
      timestamp: isRecording.value ? now - startTime.value : currentTime.value,
      content,
      role,
      speaker: speaker || role,
      evidenceIds: [],
      annotationIds: [],
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    }
    transcripts.value.push(entry)
    selectedTranscriptId.value = entry.id
    debouncedSave()

    if (!isRemote && isCollaborating.value) {
      broadcastCollaborationAction('add-transcript', entry)
    }

    return entry
  }

  const updateTranscript = (id: string, updates: Partial<TranscriptEntry>, isRemote = false) => {
    const index = transcripts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      transcripts.value[index] = {
        ...transcripts.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      debouncedSave()

      if (!isRemote && isCollaborating.value) {
        broadcastCollaborationAction('update-transcript', { id, updates })
      }
    }
  }

  const deleteTranscript = (id: string) => {
    updateTranscript(id, { isDeleted: true })
  }

  const addEvidenceToTranscript = (transcriptId: string, evidenceId: string) => {
    const transcript = getTranscriptById(transcriptId)
    if (transcript && !transcript.evidenceIds.includes(evidenceId)) {
      updateTranscript(transcriptId, {
        evidenceIds: [...transcript.evidenceIds, evidenceId]
      })
    }
  }

  const addAnnotation = (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Annotation, 'id' | 'createdAt'>>, isRemote = false) => {
    const now = Date.now()
    const newAnnotation: Annotation = {
      ...annotation,
      id: annotation.id || generateId(),
      createdAt: annotation.createdAt || now,
      updatedAt: now
    }

    const exists = annotations.value.find(a => a.id === newAnnotation.id)
    if (exists) return exists

    annotations.value.push(newAnnotation)

    const transcript = getTranscriptById(annotation.transcriptId)
    if (transcript) {
      updateTranscript(annotation.transcriptId, {
        annotationIds: [...transcript.annotationIds, newAnnotation.id]
      })
    }

    if (!isRemote && isCollaborating.value) {
      broadcastCollaborationAction('add-annotation', newAnnotation)
    }

    debouncedSave()
    return newAnnotation
  }

  const updateAnnotation = (id: string, updates: Partial<Annotation>, isRemote = false) => {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index !== -1) {
      annotations.value[index] = {
        ...annotations.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      debouncedSave()

      if (!isRemote && isCollaborating.value) {
        broadcastCollaborationAction('update-annotation', { id, updates })
      }
    }
  }

  const deleteAnnotation = (id: string, isRemote = false) => {
    const annotation = annotations.value.find(a => a.id === id)
    if (annotation) {
      const transcript = getTranscriptById(annotation.transcriptId)
      if (transcript) {
        updateTranscript(annotation.transcriptId, {
          annotationIds: transcript.annotationIds.filter(aid => aid !== id)
        }, true)
      }
      annotations.value = annotations.value.filter(a => a.id !== id)
      debouncedSave()

      if (!isRemote && isCollaborating.value) {
        broadcastCollaborationAction('delete-annotation', id)
      }
    }
  }

  const searchTranscripts = (query: string): SearchResult[] => {
    searchQuery.value = query
    if (!query.trim()) {
      searchResults.value = []
      return []
    }

    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    activeTranscripts.value.forEach(transcript => {
      const content = transcript.content.toLowerCase()
      const highlights: [number, number][] = []
      let pos = content.indexOf(lowerQuery)
      while (pos !== -1) {
        highlights.push([pos, pos + query.length])
        pos = content.indexOf(lowerQuery, pos + 1)
      }
      if (highlights.length > 0) {
        results.push({
          transcriptId: transcript.id,
          content: transcript.content,
          timestamp: transcript.timestamp,
          role: transcript.role,
          highlight: highlights
        })
      }
    })

    annotations.value.forEach(annotation => {
      const content = annotation.content.toLowerCase()
      if (content.includes(lowerQuery)) {
        const highlights: [number, number][] = []
        let pos = content.indexOf(lowerQuery)
        while (pos !== -1) {
          highlights.push([pos, pos + query.length])
          pos = content.indexOf(lowerQuery, pos + 1)
        }
        results.push({
          transcriptId: annotation.transcriptId,
          annotationId: annotation.id,
          content: annotation.content,
          timestamp: annotation.timestamp,
          role: annotation.role,
          highlight: highlights
        })
      }
    })

    searchResults.value = results
    return results
  }

  const startRecording = () => {
    if (!isRecording.value) {
      isRecording.value = true
      startTime.value = Date.now()
      currentTime.value = 0
    }
  }

  const stopRecording = () => {
    isRecording.value = false
    saveToStorage()
  }

  const setCurrentTime = (time: number) => {
    currentTime.value = Math.max(0, Math.min(time, totalDuration.value))
  }

  const jumpToTranscript = (id: string) => {
    const transcript = getTranscriptById(id)
    if (transcript) {
      setCurrentTime(transcript.timestamp)
      selectedTranscriptId.value = id
    }
  }

  const addQuickPhrase = (content: string, category: string) => {
    const phrase: QuickPhrase = {
      id: generateId(),
      content,
      category,
      usageCount: 0
    }
    quickPhrases.value.push(phrase)
    debouncedSave()
    return phrase
  }

  const useQuickPhrase = (id: string) => {
    const phrase = quickPhrases.value.find(p => p.id === id)
    if (phrase) {
      phrase.usageCount++
      debouncedSave()
      return phrase.content
    }
    return ''
  }

  const addCase = (caseNumber: string, caseName: string) => {
    const newCase: CourtCase = {
      id: generateId(),
      caseNumber,
      caseName,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    cases.value.unshift(newCase)
    settings.value.currentCaseId = newCase.id
    transcripts.value = []
    annotations.value = []
    saveToStorage()
    return newCase
  }

  const switchCase = (caseId: string) => {
    if (cases.value.find(c => c.id === caseId)) {
      saveToStorage()
      settings.value.currentCaseId = caseId
      transcripts.value = []
      annotations.value = []
      loadFromStorage()
    }
  }

  const updateSettings = (updates: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...updates }
    debouncedSave()
  }

  const stopPlayback = () => {
    if (playbackInterval.value) {
      clearInterval(playbackInterval.value)
      playbackInterval.value = null
    }
    isPlaybackMode.value = false
  }

  const setPlaybackSpeed = (speed: number) => {
    playbackSpeed.value = speed
    if (isPlaybackMode.value) {
      stopPlayback()
      startPlayback()
    }
  }

  const getTimelineEvents = () => {
    const events: Array<{
      timestamp: number
      type: 'transcript' | 'evidence' | 'annotation'
      data: any
    }> = []

    transcripts.value.forEach(t => {
      if (!t.isDeleted) {
        events.push({
          timestamp: t.timestamp,
          type: 'transcript',
          data: t
        })
      }
    })

    annotations.value.forEach(a => {
      events.push({
        timestamp: a.timestamp,
        type: 'annotation',
        data: a
      })
    })

    return events.sort((a, b) => a.timestamp - b.timestamp)
  }

  const playbackEventIndex = ref(0)
  const playbackOnAnnotationAdd = ref<((annotation: Annotation) => void) | null>(null)
  const playbackOnEvidenceSelect = ref<((evidenceId: string) => void) | null>(null)
  const playbackOnTranscriptAdd = ref<((transcript: TranscriptEntry) => void) | null>(null)

  const onPlaybackAnnotationAdd = (cb: (annotation: Annotation) => void) => {
    playbackOnAnnotationAdd.value = cb
  }

  const onPlaybackEvidenceSelect = (cb: (evidenceId: string) => void) => {
    playbackOnEvidenceSelect.value = cb
  }

  const onPlaybackTranscriptAdd = (cb: (transcript: TranscriptEntry) => void) => {
    playbackOnTranscriptAdd.value = cb
  }

  const startPlayback = (onTick?: (time: number) => void) => {
    if (playbackInterval.value) {
      clearInterval(playbackInterval.value)
    }
    isPlaybackMode.value = true
    playbackAnnotationIds.value.clear()
    playbackEventIndex.value = 0
    const timelineEvents = getTimelineEvents()

    playbackInterval.value = window.setInterval(() => {
      const newTime = currentTime.value + 1000 * playbackSpeed.value

      while (
        playbackEventIndex.value < timelineEvents.length &&
        timelineEvents[playbackEventIndex.value].timestamp <= newTime
      ) {
        const event = timelineEvents[playbackEventIndex.value]

        if (event.type === 'transcript') {
          const transcript = event.data as TranscriptEntry
          selectedTranscriptId.value = transcript.id
          playbackOnTranscriptAdd.value?.(transcript)

          if (transcript.evidenceIds.length > 0) {
            playbackOnEvidenceSelect.value?.(transcript.evidenceIds[transcript.evidenceIds.length - 1])
          }
        } else if (event.type === 'annotation') {
          const annotation = event.data as Annotation
          if (!playbackAnnotationIds.value.has(annotation.id)) {
            playbackAnnotationIds.value.add(annotation.id)
            playbackOnAnnotationAdd.value?.(annotation)
          }
        }

        playbackEventIndex.value++
      }

      if (newTime >= totalDuration.value) {
        stopPlayback()
      } else {
        setCurrentTime(newTime)
        onTick?.(newTime)
      }
    }, 1000)
  }

  const handleIncomingAction = (action: CollaborationAction) => {
    if (action.caseId !== settings.value.currentCaseId) return
    collaborationActions.value.push(action)

    switch (action.type) {
      case 'add-annotation':
        addAnnotation(action.payload, true)
        break
      case 'update-annotation':
        updateAnnotation(action.payload.id, action.payload.updates)
        break
      case 'delete-annotation':
        deleteAnnotation(action.payload)
        break
      case 'add-transcript':
        addTranscript(action.payload.content, action.payload.role, action.payload.speaker)
        break
      case 'update-transcript':
        updateTranscript(action.payload.id, action.payload.updates)
        break
      case 'add-evidence-annotation':
      case 'update-evidence-annotation':
      case 'delete-evidence-annotation':
        break
    }
  }

  const initCollaboration = async (userName?: string, wsUrl?: string): Promise<boolean> => {
    if (isCollaborating.value) return true

    try {
      const success = await collaboration.connect(
        settings.value.currentCaseId,
        settings.value.currentRole,
        userName,
        wsUrl
      )

      if (success) {
        unregisterActionHandler = collaboration.onAction(handleIncomingAction)
      }

      return success
    } catch (error) {
      console.error('Failed to init collaboration:', error)
      return false
    }
  }

  const broadcastCollaborationAction = (type: CollaborationAction['type'], payload: any) => {
    if (!isCollaborating.value) return

    collaboration.sendAction({
      type,
      payload
    })
  }

  const disconnectCollaboration = () => {
    if (unregisterActionHandler) {
      unregisterActionHandler()
      unregisterActionHandler = null
    }
    collaboration.disconnect()
  }

  watch(
    () => settings.value.currentCaseId,
    () => {
      saveToStorage()
    }
  )

  window.addEventListener('beforeunload', saveToStorage)

  return {
    transcripts,
    settings,
    cases,
    quickPhrases,
    annotations,
    isRecording,
    currentTime,
    startTime,
    searchQuery,
    searchResults,
    selectedTranscriptId,
    isSaving,
    lastSavedAt,
    isPlaybackMode,
    playbackSpeed,
    playbackAnnotationIds,
    collaborationUserId: collaboration.userId,
    collaborationActions,
    isCollaborating,
    connectedUsers,
    isConnecting,
    connectionError,
    currentCase,
    totalDuration,
    activeTranscripts,
    filteredTranscripts,
    getTranscriptById,
    getAnnotationsByTranscriptId,
    getAnnotationsByRole,
    loadFromStorage,
    saveToStorage,
    addTranscript,
    updateTranscript,
    deleteTranscript,
    addEvidenceToTranscript,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    searchTranscripts,
    startRecording,
    stopRecording,
    setCurrentTime,
    jumpToTranscript,
    addQuickPhrase,
    useQuickPhrase,
    addCase,
    switchCase,
    updateSettings,
    startPlayback,
    stopPlayback,
    setPlaybackSpeed,
    getTimelineEvents,
    onPlaybackAnnotationAdd,
    onPlaybackEvidenceSelect,
    onPlaybackTranscriptAdd,
    initCollaboration,
    disconnectCollaboration,
    broadcastCollaborationAction
  }
})
