<template>
  <div ref="mapContainer" class="w-full h-full"></div>
</template>

<script setup lang="ts">
import type { Pipe, MonitorNode, LeakEvent, RepairTeam, OutageZone, LeakCandidatePoint } from '~/types'
import { getPressureColor, getSeverityColor, getStatusColor } from '~/utils/api'
import { useDispatchStore } from '~/stores/dispatch'
import maplibregl from 'maplibre-gl'

const props = defineProps<{
  pipes?: Pipe[]
  nodes?: MonitorNode[]
  leakEvents?: LeakEvent[]
  teams?: RepairTeam[]
  outageZones?: OutageZone[]
  selectedLeakId?: string | null
  selectedWorkOrderId?: string | null
  showValves?: boolean
  valveIds?: string[]
  highlightLeakId?: string | null
  showHeatmap?: boolean
  heatmapPoints?: LeakCandidatePoint[]
  zoom?: number
  center?: [number, number]
}>()

const emit = defineEmits<{
  (e: 'nodeClick', node: MonitorNode): void
  (e: 'leakClick', leak: LeakEvent): void
  (e: 'teamClick', team: RepairTeam): void
  (e: 'pipeClick', pipe: Pipe): void
  (e: 'valveClick', lng: number, lat: number): void
}>()

const mapContainer = ref<HTMLDivElement>()
let map: maplibregl.Map | null = null
let mapReady = false

const dispatch = useDispatchStore()
const config = useRuntimeConfig()

watch(() => dispatch.mapStyle, () => {
  if (!mapReady || !map) return
  map.setStyle(dispatch.mapStyle === 'satellite'
    ? 'https://tiles.openfreemap.org/styles/hybrid'
    : 'https://tiles.openfreemap.org/styles/dark')
})

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: dispatch.mapStyle === 'satellite'
      ? 'https://tiles.openfreemap.org/styles/hybrid'
      : 'https://tiles.openfreemap.org/styles/dark',
    center: (props.center ?? config.public.mapCenter) as [number, number],
    zoom: props.zoom ?? (config.public.mapZoom as number)
  })

  map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }), 'bottom-left')

  map.on('load', () => {
    mapReady = true
    addLayers()
    updateAll()
  })

  map.on('click', 'leak-points', (e) => {
    if (!e.features || !e.features[0]) return
    const id = e.features[0].properties?.id
    const leak = props.leakEvents?.find(l => l.id === id)
    if (leak) emit('leakClick', leak)
  })

  map.on('click', 'team-points', (e) => {
    if (!e.features || !e.features[0]) return
    const id = e.features[0].properties?.id
    const team = props.teams?.find(t => t.id === id)
    if (team) emit('teamClick', team)
  })

  map.on('click', 'node-points', (e) => {
    if (!e.features || !e.features[0]) return
    const id = e.features[0].properties?.id
    const node = props.nodes?.find(n => n.id === id)
    if (node) emit('nodeClick', node)
  })

  for (const layer of ['leak-points', 'team-points', 'node-points', 'pipe-lines']) {
    map.on('mouseenter', layer, () => {
      if (map) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      if (map) map.getCanvas().style.cursor = ''
    })
  }
})

function addLayers() {
  if (!map) return
  const srcs = map.getStyle().sources
  if (!srcs['pipes']) map.addSource('pipes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  if (!srcs['nodes']) map.addSource('nodes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  if (!srcs['leaks']) map.addSource('leaks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  if (!srcs['leak-heatmap']) map.addSource('leak-heatmap', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  if (!srcs['teams']) map.addSource('teams', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  if (!srcs['outage-zones']) map.addSource('outage-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  if (!srcs['valves']) map.addSource('valves', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

  if (!map.getLayer('pipe-lines')) {
    map.addLayer({
      id: 'pipe-lines', type: 'line', source: 'pipes',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 4],
        'line-opacity': 0.8
      }
    })
  }

  if (!map.getLayer('outage-fills')) {
    map.addLayer({
      id: 'outage-fills', type: 'fill', source: 'outage-zones',
      paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.2 }
    })
    map.addLayer({
      id: 'outage-borders', type: 'line', source: 'outage-zones',
      paint: { 'line-color': '#ef4444', 'line-width': 2, 'line-dasharray': [3, 2] }
    })
  }

  if (!map.getLayer('heatmap-layer')) {
    map.addLayer({
      id: 'heatmap-layer', type: 'heatmap', source: 'leak-heatmap',
      maxzoom: 19,
      paint: {
        'heatmap-weight': ['*', ['get', 'probability'], 2],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 2],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(34,197,94,0)',
          0.2, 'rgba(234,179,8,0.4)',
          0.5, 'rgba(249,115,22,0.6)',
          0.8, 'rgba(239,68,68,0.8)',
          1, 'rgba(220,38,38,1)'
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 40],
        'heatmap-opacity': 0.85
      }
    })
  }

  if (!map.getLayer('node-points')) {
    map.addLayer({
      id: 'node-points', type: 'circle', source: 'nodes',
      paint: {
        'circle-radius': ['case', ['boolean', ['get', 'alarm'], false], 8, 5],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#0f172a',
        'circle-stroke-width': 1.5,
        'circle-opacity': ['case', ['boolean', ['get', 'alarm'], false], 1, 0.9]
      }
    })
  }

  if (!map.getLayer('valve-points')) {
    map.addLayer({
      id: 'valve-points', type: 'circle', source: 'valves',
      paint: { 'circle-radius': 6, 'circle-color': '#0ea5e9', 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 1.5 }
    })
  }

  if (!map.getLayer('leak-points')) {
    map.addLayer({
      id: 'leak-points', type: 'circle', source: 'leaks',
      paint: {
        'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 14, 10],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.95
      }
    })
  }

  if (!map.getLayer('team-points')) {
    map.addLayer({
      id: 'team-points', type: 'circle', source: 'teams',
      paint: {
        'circle-radius': 8,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#0f172a',
        'circle-stroke-width': 2
      }
    })
  }
}

function updateAll() {
  if (!mapReady || !map) return
  updatePipes()
  updateNodes()
  updateLeaks()
  updateTeams()
  updateOutageZones()
  updateHeatmap()
}

function updatePipes() {
  if (!mapReady || !map || !props.pipes) return
  const features = props.pipes.map(p => ({
    type: 'Feature',
    properties: {
      id: p.id,
      color: p.healthScore >= 80 ? '#22c55e' : p.healthScore >= 60 ? '#eab308' : p.healthScore >= 40 ? '#f97316' : '#ef4444'
    },
    geometry: { type: 'LineString', coordinates: p.geometry.map(pt => [pt.longitude, pt.latitude]) }
  }))
  map.getSource('pipes')?.setData({ type: 'FeatureCollection', features })
}

function updateNodes() {
  if (!mapReady || !map || !props.nodes) return
  const features = props.nodes.map(n => ({
    type: 'Feature',
    properties: {
      id: n.id,
      code: n.code,
      name: n.name,
      alarm: n.hasAlarm,
      pressure: n.currentPressure ?? 0,
      color: !n.isOnline ? '#6b7280' : getPressureColor(n.currentPressure ?? 0.3, n.normalPressureMin, n.normalPressureMax)
    },
    geometry: { type: 'Point', coordinates: [n.longitude, n.latitude] }
  }))
  map.getSource('nodes')?.setData({ type: 'FeatureCollection', features })
}

function updateLeaks() {
  if (!mapReady || !map || !props.leakEvents) return
  const features = props.leakEvents
    .filter(l => l.status !== 'Resolved' && l.status !== 'FalseAlarm')
    .map(l => ({
      type: 'Feature',
      properties: {
        id: l.id,
        eventNo: l.eventNo,
        severity: l.severity,
        confidence: l.confidence,
        selected: l.id === props.selectedLeakId,
        color: getSeverityColor(l.severity)
      },
      geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] }
    }))
  map.getSource('leaks')?.setData({ type: 'FeatureCollection', features })
}

function updateTeams() {
  if (!mapReady || !map || !props.teams) return
  const features = props.teams
    .filter(t => t.currentLongitude != null && t.currentLatitude != null)
    .map(t => ({
      type: 'Feature',
      properties: {
        id: t.id,
        name: t.teamName,
        status: t.status,
        color: getStatusColor(t.status)
      },
      geometry: { type: 'Point', coordinates: [t.currentLongitude!, t.currentLatitude!] }
    }))
  map.getSource('teams')?.setData({ type: 'FeatureCollection', features })
}

function updateOutageZones() {
  if (!mapReady || !map || !props.outageZones) return
  const features = props.outageZones.map(z => ({
    type: 'Feature',
    properties: { id: z.id, name: z.zoneName },
    geometry: { type: 'Polygon', coordinates: [z.polygon.map(p => [p.longitude, p.latitude])] }
  }))
  map.getSource('outage-zones')?.setData({ type: 'FeatureCollection', features })
}

function updateHeatmap() {
  if (!mapReady || !map) return
  const points = props.showHeatmap && props.heatmapPoints ? props.heatmapPoints : []
  const features = points.map(p => ({
    type: 'Feature',
    properties: { probability: p.probability },
    geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
  }))
  map.getSource('leak-heatmap')?.setData({ type: 'FeatureCollection', features })
  if (map.getLayer('heatmap-layer')) {
    map.setLayoutProperty('heatmap-layer', 'visibility', points.length > 0 ? 'visible' : 'none')
  }
}

watch(() => props.pipes, updatePipes, { deep: true })
watch(() => props.nodes, updateNodes, { deep: true })
watch(() => props.leakEvents, updateLeaks, { deep: true })
watch(() => props.teams, updateTeams, { deep: true })
watch(() => props.outageZones, updateOutageZones, { deep: true })
watch(() => props.showHeatmap, updateHeatmap)
watch(() => props.heatmapPoints, updateHeatmap, { deep: true })
watch(() => props.selectedLeakId, updateLeaks)

function flyTo(lng: number, lat: number, zoom?: number) {
  map?.flyTo({ center: [lng, lat], zoom: zoom ?? 15, speed: 1.2 })
}

defineExpose({ flyTo })
</script>

<style scoped>
.w-full { width: 100%; }
.h-full { height: 100%; }
</style>
