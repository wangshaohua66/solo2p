import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Annotation,
  AnnotationConflict,
  AnnotationType,
  AnnotationStatus,
  AnnotationSeverity
} from '@/types/annotation'
import type { Document, DocumentVersion, VersionDiffSummary, VersionDiffRegion } from '@/types/document'
import type { ReviewWorkflow } from '@/types/review'
import { annotationApi } from '@/api/annotation'
import { documentApi } from '@/api/document'
import { reviewApi } from '@/api/review'
import { wsService, type WsMessage } from '@/utils/websocket'
import { useAuthStore } from './authStore'

export interface CanvasState {
  zoom: number
  panX: number
  panY: number
  currentPage: number
  activeTool: AnnotationType | 'select' | null
  isPanning: boolean
  showGrid: boolean
}

export interface DraftAnnotation {
  geometry: {
    type: AnnotationType
    points: { x: number; y: number }[]
    width?: number
    height?: number
    radius?: number
    color: string
    strokeWidth: number
  } | null
  pageNumber: number
}

export const useReviewStore = defineStore('review', () => {
  const authStore = useAuthStore()

  const currentDocument = ref<Document | null>(null)
  const currentVersion = ref<DocumentVersion | null>(null)
  const compareVersion = ref<DocumentVersion | null>(null)
  const annotations = ref<Annotation[]>([])
  const workflows = ref<ReviewWorkflow[]>([])
  const conflicts = ref<AnnotationConflict[]>([])
  const diffSummary = ref<VersionDiffSummary | null>(null)
  const selectedAnnotationId = ref<string | null>(null)
  const highlightAnnotationIds = ref<Set<string>>(new Set())

  const canvas = ref<CanvasState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    currentPage: 1,
    activeTool: null,
    isPanning: false,
    showGrid: false
  })

  const draftAnnotation = ref<DraftAnnotation>({
    geometry: null,
    pageNumber: 1
  })

  const isLoading = ref(false)
  const isCompareMode = ref(false)

  const currentPageAnnotations = computed(() => {
    return annotations.value.filter((a) => a.pageNumber === canvas.value.currentPage)
  })

  const currentPageDiffs = computed((): VersionDiffRegion[] => {
    return diffSummary.value?.regions.filter((r) => r.pageNumber === canvas.value.currentPage) || []
  })

  const sortedAnnotations = computed(() => {
    return [...annotations.value].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  })

  const openAnnotations = computed(() => annotations.value.filter((a) => a.status !== 'resolved'))
  const resolvedAnnotations = computed(() => annotations.value.filter((a) => a.status === 'resolved'))

  const annotationStats = computed(() => ({
    total: annotations.value.length,
    open: annotations.value.filter((a) => a.status === 'open').length,
    inProgress: annotations.value.filter((a) => a.status === 'in_progress').length,
    resolved: annotations.value.filter((a) => a.status === 'resolved').length,
    low: annotations.value.filter((a) => a.severity === 'low').length,
    medium: annotations.value.filter((a) => a.severity === 'medium').length,
    high: annotations.value.filter((a) => a.severity === 'high').length,
    critical: annotations.value.filter((a) => a.severity === 'critical').length
  }))

  const currentWorkflow = computed(() => {
    return workflows.value.find((w) => w.status === 'in_progress' || w.status === 'pending') || null
  })

  async function loadDocument(documentId: string) {
    isLoading.value = true
    try {
      const docResult = await documentApi.get(documentId)
      currentDocument.value = (docResult as any).data || docResult
      if (currentDocument.value) {
        const currentV = currentDocument.value.versions.find(
          (v) => v.id === currentDocument.value!.currentVersionId
        ) || currentDocument.value.versions[currentDocument.value.versions.length - 1]
        currentVersion.value = currentV || null
        await loadAnnotations(documentId, currentVersion.value?.id)
        await loadWorkflows(documentId)
      }
      return currentDocument.value
    } finally {
      isLoading.value = false
    }
  }

  async function loadAnnotations(documentId: string, versionId?: string) {
    try {
      const result = await annotationApi.list(documentId, { versionId })
      annotations.value = (result as any).data || result
    } catch (e) {
      console.error('Load annotations failed:', e)
    }
  }

  async function loadWorkflows(documentId: string) {
    try {
      const result = await reviewApi.listByDocument(documentId)
      workflows.value = (result as any).data || result
    } catch (e) {
      console.error('Load workflows failed:', e)
    }
  }

  async function switchVersion(versionId: string) {
    if (!currentDocument.value) return
    const version = currentDocument.value.versions.find((v) => v.id === versionId)
    if (version) {
      currentVersion.value = version
      canvas.value.currentPage = 1
      await loadAnnotations(currentDocument.value.id, versionId)
    }
  }

  async function enterCompareMode(compareVersionId: string) {
    if (!currentDocument.value || !currentVersion.value) return
    const version = currentDocument.value.versions.find((v) => v.id === compareVersionId)
    if (version) {
      compareVersion.value = version
      isCompareMode.value = true
      try {
        const result = await documentApi.compareVersions(
          currentDocument.value.id,
          currentVersion.value.id,
          compareVersionId
        )
        diffSummary.value = (result as any).data || result
      } catch (e) {
        console.error('Compare versions failed:', e)
      }
    }
  }

  function exitCompareMode() {
    isCompareMode.value = false
    compareVersion.value = null
    diffSummary.value = null
  }

  async function createAnnotation(data: {
    content: string
    severity: AnnotationSeverity
    assigneeId?: string
    mentions?: string[]
  }) {
    if (!currentDocument.value || !currentVersion.value || !draftAnnotation.value.geometry) return null

    try {
      const result = await annotationApi.create({
        documentId: currentDocument.value.id,
        versionId: currentVersion.value.id,
        pageNumber: canvas.value.currentPage,
        geometry: draftAnnotation.value.geometry,
        content: data.content,
        severity: data.severity,
        assigneeId: data.assigneeId,
        mentions: data.mentions
      })
      const annotation = (result as any).data || result
      annotations.value.push(annotation)
      clearDraft()
      return annotation
    } catch (e) {
      console.error('Create annotation failed:', e)
      return null
    }
  }

  async function updateAnnotation(
    id: string,
    data: { content?: string; status?: AnnotationStatus; severity?: AnnotationSeverity; assigneeId?: string }
  ) {
    const result = await annotationApi.update(id, data)
    const updated = (result as any).data || result
    const index = annotations.value.findIndex((a) => a.id === id)
    if (index !== -1) {
      annotations.value[index] = updated
    }
    return updated
  }

  async function deleteAnnotation(id: string) {
    await annotationApi.delete(id)
    annotations.value = annotations.value.filter((a) => a.id !== id)
    if (selectedAnnotationId.value === id) {
      selectedAnnotationId.value = null
    }
  }

  async function addReply(annotationId: string, content: string, mentions: string[] = []) {
    const result = await annotationApi.addReply(annotationId, content, mentions)
    const reply = (result as any).data || result
    const annotation = annotations.value.find((a) => a.id === annotationId)
    if (annotation) {
      annotation.replies.push(reply)
    }
    return reply
  }

  async function migrateAnnotations(annotationIds: string[], targetVersionId: string) {
    const result = await annotationApi.migrate(annotationIds, targetVersionId)
    const migrated = (result as any).data || result
    annotations.value = [...annotations.value, ...migrated]
    return migrated
  }

  async function detectConflict(geometry: any) {
    if (!currentDocument.value || !currentVersion.value) return []
    const result = await annotationApi.detectConflict({
      documentId: currentDocument.value.id,
      versionId: currentVersion.value.id,
      pageNumber: canvas.value.currentPage,
      geometry
    })
    conflicts.value = (result as any).data || result
    return conflicts.value
  }

  function setDraftGeometry(geometry: DraftAnnotation['geometry']) {
    draftAnnotation.value.geometry = geometry
    draftAnnotation.value.pageNumber = canvas.value.currentPage
  }

  function clearDraft() {
    draftAnnotation.value.geometry = null
    canvas.value.activeTool = null
  }

  function setActiveTool(tool: AnnotationType | 'select' | null) {
    canvas.value.activeTool = tool
  }

  function setZoom(zoom: number) {
    canvas.value.zoom = Math.max(0.1, Math.min(5, zoom))
  }

  function zoomIn() {
    setZoom(canvas.value.zoom * 1.2)
  }

  function zoomOut() {
    setZoom(canvas.value.zoom / 1.2)
  }

  function resetZoom() {
    canvas.value.zoom = 1
    canvas.value.panX = 0
    canvas.value.panY = 0
  }

  function setPan(x: number, y: number) {
    canvas.value.panX = x
    canvas.value.panY = y
  }

  function setCurrentPage(page: number) {
    if (currentVersion.value && page >= 1 && page <= currentVersion.value.pageCount) {
      canvas.value.currentPage = page
    }
  }

  function selectAnnotation(id: string | null) {
    selectedAnnotationId.value = id
    if (id) {
      highlightAnnotationIds.value.clear()
      highlightAnnotationIds.value.add(id)
      const annotation = annotations.value.find((a) => a.id === id)
      if (annotation) {
        canvas.value.currentPage = annotation.pageNumber
      }
    }
  }

  function highlightAnnotations(ids: string[]) {
    highlightAnnotationIds.value = new Set(ids)
  }

  function clearHighlights() {
    highlightAnnotationIds.value.clear()
  }

  function setupWebSocketListeners() {
    wsService.on('annotation.created', (msg: WsMessage) => {
      const annotation = msg.data as Annotation
      if (annotation.documentId === currentDocument.value?.id && !annotations.value.find((a) => a.id === annotation.id)) {
        annotations.value.push(annotation)
      }
    })

    wsService.on('annotation.updated', (msg: WsMessage) => {
      const updated = msg.data as Annotation
      const index = annotations.value.findIndex((a) => a.id === updated.id)
      if (index !== -1) {
        annotations.value[index] = updated
      }
    })

    wsService.on('annotation.deleted', (msg: WsMessage) => {
      const id = msg.data.id
      annotations.value = annotations.value.filter((a) => a.id !== id)
    })

    wsService.on('annotation.conflict', (msg: WsMessage) => {
      const conflict = msg.data as AnnotationConflict
      conflicts.value.push(conflict)
    })
  }

  function clearAll() {
    currentDocument.value = null
    currentVersion.value = null
    compareVersion.value = null
    annotations.value = []
    workflows.value = []
    conflicts.value = []
    diffSummary.value = null
    selectedAnnotationId.value = null
    highlightAnnotationIds.value.clear()
    canvas.value = {
      zoom: 1,
      panX: 0,
      panY: 0,
      currentPage: 1,
      activeTool: null,
      isPanning: false,
      showGrid: false
    }
    draftAnnotation.value = { geometry: null, pageNumber: 1 }
    isCompareMode.value = false
  }

  return {
    currentDocument,
    currentVersion,
    compareVersion,
    annotations,
    workflows,
    conflicts,
    diffSummary,
    selectedAnnotationId,
    highlightAnnotationIds,
    canvas,
    draftAnnotation,
    isLoading,
    isCompareMode,
    currentPageAnnotations,
    currentPageDiffs,
    sortedAnnotations,
    openAnnotations,
    resolvedAnnotations,
    annotationStats,
    currentWorkflow,
    loadDocument,
    loadAnnotations,
    loadWorkflows,
    switchVersion,
    enterCompareMode,
    exitCompareMode,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addReply,
    migrateAnnotations,
    detectConflict,
    setDraftGeometry,
    clearDraft,
    setActiveTool,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setPan,
    setCurrentPage,
    selectAnnotation,
    highlightAnnotations,
    clearHighlights,
    setupWebSocketListeners,
    clearAll
  }
})
