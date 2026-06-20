import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { EvidenceItem, EvidenceType, EvidenceAnnotation } from '@/types'
import { storage, generateId, debounce, fileToDataUrl, fileToBlobUrl } from '@/utils/storage'

const STORAGE_KEY = 'evidence'

export const useEvidenceStore = defineStore('evidence', () => {
  const evidenceList = ref<EvidenceItem[]>([])
  const selectedEvidenceId = ref<string | null>(null)
  const isLoading = ref(false)
  const uploadProgress = ref(0)
  const currentCaseId = ref('')

  const selectedEvidence = computed(() => {
    if (!selectedEvidenceId.value) return null
    return evidenceList.value.find(e => e.id === selectedEvidenceId.value) || null
  })

  const evidenceByType = computed(() => {
    const grouped: Record<EvidenceType, EvidenceItem[]> = {
      pdf: [],
      image: [],
      video: [],
      audio: [],
      document: []
    }
    evidenceList.value.forEach(e => {
      grouped[e.type].push(e)
    })
    return grouped
  })

  const getEvidenceById = (id: string) => {
    return evidenceList.value.find(e => e.id === id)
  }

  const getEvidenceTypeFromMime = (mimeType: string): EvidenceType => {
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    return 'document'
  }

  const loadFromStorage = async (caseId: string) => {
    currentCaseId.value = caseId
    isLoading.value = true
    try {
      const stored = await storage.getItem<EvidenceItem[]>(`${STORAGE_KEY}-${caseId}`)
      if (stored) {
        evidenceList.value = stored
      } else {
        evidenceList.value = []
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
      evidenceList.value = []
    } finally {
      isLoading.value = false
    }
  }

  const saveToStorage = async () => {
    try {
      await storage.setItem(`${STORAGE_KEY}-${currentCaseId.value}`, evidenceList.value)
    } catch (error) {
      console.error('Failed to save evidence:', error)
    }
  }

  const debouncedSave = debounce(saveToStorage, 1000)

  const uploadEvidence = async (file: File): Promise<EvidenceItem> => {
    isLoading.value = true
    uploadProgress.value = 0

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        uploadProgress.value = Math.min(uploadProgress.value + 10, 90)
      }, 100)

      Promise.all([fileToDataUrl(file), fileToBlobUrl(file)])
        .then(([dataUrl, blobUrl]) => {
          clearInterval(interval)
          uploadProgress.value = 100

          const type = getEvidenceTypeFromMime(file.type)
          const evidence: EvidenceItem = {
            id: generateId(),
            name: file.name,
            type,
            fileSize: file.size,
            mimeType: file.type,
            dataUrl,
            blobUrl,
            rotation: 0,
            scale: 1,
            annotations: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }

          if (type === 'video' || type === 'audio') {
            const media = document.createElement(type === 'video' ? 'video' : 'audio')
            media.preload = 'metadata'
            media.onloadedmetadata = () => {
              evidence.duration = media.duration * 1000
              evidence.currentTime = 0
              evidenceList.value.unshift(evidence)
              selectedEvidenceId.value = evidence.id
              debouncedSave()
              isLoading.value = false
              resolve(evidence)
            }
            media.onerror = () => {
              evidenceList.value.unshift(evidence)
              selectedEvidenceId.value = evidence.id
              debouncedSave()
              isLoading.value = false
              resolve(evidence)
            }
            media.src = blobUrl
          } else {
            evidenceList.value.unshift(evidence)
            selectedEvidenceId.value = evidence.id
            debouncedSave()
            isLoading.value = false
            resolve(evidence)
          }
        })
        .catch(error => {
          clearInterval(interval)
          isLoading.value = false
          reject(error)
        })
    })
  }

  const uploadMultipleEvidence = async (files: File[]): Promise<EvidenceItem[]> => {
    const results: EvidenceItem[] = []
    for (const file of files) {
      try {
        const evidence = await uploadEvidence(file)
        results.push(evidence)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
      }
    }
    return results
  }

  const updateEvidence = (id: string, updates: Partial<EvidenceItem>) => {
    const index = evidenceList.value.findIndex(e => e.id === id)
    if (index !== -1) {
      evidenceList.value[index] = {
        ...evidenceList.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      debouncedSave()
    }
  }

  const deleteEvidence = (id: string) => {
    const evidence = getEvidenceById(id)
    if (evidence?.blobUrl) {
      URL.revokeObjectURL(evidence.blobUrl)
    }
    evidenceList.value = evidenceList.value.filter(e => e.id !== id)
    if (selectedEvidenceId.value === id) {
      selectedEvidenceId.value = evidenceList.value[0]?.id || null
    }
    debouncedSave()
  }

  const selectEvidence = (id: string | null) => {
    selectedEvidenceId.value = id
  }

  const rotateEvidence = (id: string, angle: number = 90) => {
    const evidence = getEvidenceById(id)
    if (evidence) {
      updateEvidence(id, { rotation: (evidence.rotation + angle) % 360 })
    }
  }

  const scaleEvidence = (id: string, scale: number) => {
    updateEvidence(id, { scale: Math.max(0.5, Math.min(3, scale)) })
  }

  const setEvidenceTime = (id: string, time: number) => {
    updateEvidence(id, { currentTime: time })
  }

  const addEvidenceAnnotation = (
    evidenceId: string,
    annotation: Omit<EvidenceAnnotation, 'id' | 'createdAt'>
  ) => {
    const evidence = getEvidenceById(evidenceId)
    if (evidence) {
      const newAnnotation: EvidenceAnnotation = {
        ...annotation,
        id: generateId(),
        createdAt: Date.now()
      }
      updateEvidence(evidenceId, {
        annotations: [...evidence.annotations, newAnnotation]
      })
      return newAnnotation
    }
    return null
  }

  const deleteEvidenceAnnotation = (evidenceId: string, annotationId: string) => {
    const evidence = getEvidenceById(evidenceId)
    if (evidence) {
      updateEvidence(evidenceId, {
        annotations: evidence.annotations.filter(a => a.id !== annotationId)
      })
    }
  }

  const searchEvidence = (query: string): EvidenceItem[] => {
    if (!query.trim()) return evidenceList.value
    const lowerQuery = query.toLowerCase()
    return evidenceList.value.filter(e =>
      e.name.toLowerCase().includes(lowerQuery) ||
      e.type.toLowerCase().includes(lowerQuery)
    )
  }

  watch(
    () => currentCaseId.value,
    (newCaseId) => {
      if (newCaseId) {
        loadFromStorage(newCaseId)
      }
    }
  )

  const evidenceItems = computed(() => evidenceList.value)

  return {
    evidenceList,
    evidenceItems,
    selectedEvidenceId,
    isLoading,
    uploadProgress,
    currentCaseId,
    selectedEvidence,
    evidenceByType,
    getEvidenceById,
    loadFromStorage,
    saveToStorage,
    uploadEvidence,
    uploadMultipleEvidence,
    updateEvidence,
    deleteEvidence,
    selectEvidence,
    rotateEvidence,
    scaleEvidence,
    setEvidenceTime,
    addEvidenceAnnotation,
    deleteEvidenceAnnotation,
    searchEvidence
  }
})
