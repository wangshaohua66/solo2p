import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { StepNode, StepEdge, StepFlow, MediaItem } from '@/types'

export const useStepEditorStore = defineStore('stepEditor', () => {
  const nodes = ref<StepNode[]>([])
  const edges = ref<StepEdge[]>([])
  const selectedNodeId = ref<string | null>(null)
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  const isDraggingMedia = ref(false)
  const draggedMedia = ref<MediaItem | null>(null)

  const selectedNode = computed(() => {
    return nodes.value.find(n => n.id === selectedNodeId.value) || null
  })

  const nodeMap = computed(() => {
    const map = new Map<string, StepNode>()
    nodes.value.forEach(node => map.set(node.id, node))
    return map
  })

  const startNodes = computed(() => {
    return nodes.value.filter(n => n.type === 'start')
  })

  const endNodes = computed(() => {
    return nodes.value.filter(n => n.type === 'end')
  })

  const loadFlow = (flow: StepFlow) => {
    nodes.value = flow.nodes || []
    edges.value = flow.edges || []
    viewport.value = flow.viewport || { x: 0, y: 0, zoom: 1 }
    selectedNodeId.value = null
  }

  const getFlow = (): StepFlow => {
    return {
      nodes: nodes.value,
      edges: edges.value,
      viewport: viewport.value
    }
  }

  const addNode = (nodeData: Omit<StepNode, 'id'>) => {
    const newNode: StepNode = {
      ...nodeData,
      id: uuidv4()
    }
    nodes.value.push(newNode)
    return newNode
  }

  const updateNode = (id: string, updates: Partial<StepNode>) => {
    const index = nodes.value.findIndex(n => n.id === id)
    if (index !== -1) {
      nodes.value[index] = { ...nodes.value[index], ...updates }
    }
  }

  const removeNode = (id: string) => {
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (selectedNodeId.value === id) {
      selectedNodeId.value = null
    }
  }

  const selectNode = (id: string | null) => {
    selectedNodeId.value = id
  }

  const addEdge = (edgeData: Omit<StepEdge, 'id'>) => {
    const exists = edges.value.some(
      e => e.source === edgeData.source && e.target === edgeData.target
    )
    if (!exists) {
      const newEdge: StepEdge = {
        ...edgeData,
        id: uuidv4()
      }
      edges.value.push(newEdge)
      return newEdge
    }
    return null
  }

  const updateEdge = (id: string, updates: Partial<StepEdge>) => {
    const index = edges.value.findIndex(e => e.id === id)
    if (index !== -1) {
      edges.value[index] = { ...edges.value[index], ...updates }
    }
  }

  const removeEdge = (id: string) => {
    edges.value = edges.value.filter(e => e.id !== id)
  }

  const setViewport = (vp: { x: number; y: number; zoom: number }) => {
    viewport.value = vp
  }

  const autoLayout = () => {
    const levelWidth = 250
    const nodeHeight = 120
    const startX = 50
    const startY = 50

    const visited = new Set<string>()
    const levels: string[][] = []

    const queue: { id: string; level: number }[] = []
    startNodes.value.forEach(node => {
      queue.push({ id: node.id, level: 0 })
    })

    while (queue.length > 0) {
      const { id, level } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      if (!levels[level]) levels[level] = []
      levels[level].push(id)

      const outgoing = edges.value.filter(e => e.source === id)
      outgoing.forEach(edge => {
        queue.push({ id: edge.target, level: level + 1 })
      })
    }

    const unvisited = nodes.value.filter(n => !visited.has(n.id))
    if (unvisited.length > 0 && levels.length === 0) {
      levels.push(unvisited.map(n => n.id))
    } else if (unvisited.length > 0) {
      levels.push(unvisited.map(n => n.id))
    }

    levels.forEach((levelNodes, levelIndex) => {
      levelNodes.forEach((nodeId, nodeIndex) => {
        updateNode(nodeId, {
          position: {
            x: startX + levelIndex * levelWidth,
            y: startY + nodeIndex * nodeHeight
          }
        })
      })
    })

    setViewport({ x: 0, y: 0, zoom: 1 })
  }

  const addMediaToNode = (nodeId: string, mediaId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && !node.mediaIds.includes(mediaId)) {
      node.mediaIds.push(mediaId)
    }
  }

  const removeMediaFromNode = (nodeId: string, mediaId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.mediaIds = node.mediaIds.filter(id => id !== mediaId)
    }
  }

  const addKeyTechnique = (nodeId: string, technique: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && technique.trim() && !node.keyTechniques.includes(technique.trim())) {
      node.keyTechniques.push(technique.trim())
    }
  }

  const removeKeyTechnique = (nodeId: string, techniqueIndex: number) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && techniqueIndex >= 0 && techniqueIndex < node.keyTechniques.length) {
      node.keyTechniques.splice(techniqueIndex, 1)
    }
  }

  const setDraggingMedia = (media: MediaItem | null) => {
    isDraggingMedia.value = !!media
    draggedMedia.value = media
  }

  const clearAll = () => {
    nodes.value = []
    edges.value = []
    selectedNodeId.value = null
    viewport.value = { x: 0, y: 0, zoom: 1 }
  }

  return {
    nodes,
    edges,
    selectedNodeId,
    selectedNode,
    nodeMap,
    startNodes,
    endNodes,
    viewport,
    isDraggingMedia,
    draggedMedia,
    loadFlow,
    getFlow,
    addNode,
    updateNode,
    removeNode,
    selectNode,
    addEdge,
    updateEdge,
    removeEdge,
    setViewport,
    autoLayout,
    addMediaToNode,
    removeMediaFromNode,
    addKeyTechnique,
    removeKeyTechnique,
    setDraggingMedia,
    clearAll
  }
})
