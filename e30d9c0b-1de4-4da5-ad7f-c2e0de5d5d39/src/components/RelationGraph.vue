<template>
  <div class="relation-graph">
    <div class="graph-container" ref="graphContainerRef">
      <svg ref="svgRef"></svg>
    </div>

    <div class="graph-legend">
      <h4>关联类型图例</h4>
      <div v-for="(label, type) in RELATION_TYPE_LABELS" :key="type" class="legend-item">
        <span class="legend-color" :style="{ background: RELATION_TYPE_COLORS[type] }"></span>
        <span>{{ label }}</span>
      </div>
    </div>

    <div v-if="selectedNode" class="detail-panel" :class="{ 'is-visible': !!selectedNode }">
      <div class="panel-header">
        <h3>{{ selectedNode.name }}</h3>
        <el-button size="small" text @click="selectedNode = null">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div class="panel-body">
        <div class="info-row">
          <span class="label">类别:</span>
          <span class="value">{{ HERITAGE_CATEGORY_LABELS[selectedNode.category] }}</span>
        </div>
        <div class="info-row">
          <span class="label">批次:</span>
          <span class="value">第{{ selectedNode.batch }}批</span>
        </div>
        <div class="info-row">
          <span class="label">地区:</span>
          <span class="value">{{ selectedNode.region }}</span>
        </div>
        <div class="info-row">
          <span class="label">传承人:</span>
          <span class="value">{{ selectedNode.inheritorCount }}人</span>
        </div>
        <div class="info-row description">
          <span class="label">描述:</span>
          <span class="value">{{ selectedNode.description }}</span>
        </div>

        <div class="relations-section">
          <h4>关联项目</h4>
          <div v-if="relatedProjects.length > 0" class="related-list">
            <div v-for="rel in relatedProjects" :key="rel.id" class="related-item">
              <div class="related-name">{{ rel.name }}</div>
              <div class="related-type" :style="{ color: RELATION_TYPE_COLORS[rel.relationType] }}">
                {{ RELATION_TYPE_LABELS[rel.relationType] }}
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无关联项目" />
        </div>

        <div class="panel-actions">
          <el-button type="primary" size="small" @click="goToEditor">
            编辑步骤
          </el-button>
          <el-button size="small" @click="goToShowcase">
            查看展示
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as d3 from 'd3'
import { Close } from '@element-plus/icons-vue'
import type { HeritageProject, ProjectRelation } from '@/types'
import {
  HERITAGE_CATEGORY_LABELS,
  RELATION_TYPE_LABELS,
  RELATION_TYPE_COLORS
} from '@/types'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  category: HeritageProject['category']
  batch: number
  region: string
  description: string
  inheritorCount: number
  radius: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  relationType: ProjectRelation['type']
  strength: number
}

const props = defineProps<{
  projects: HeritageProject[]
  relations: ProjectRelation[]
  filterCategory?: string
  filterRegion?: string
}>()

const emit = defineEmits<{
  (e: 'nodeClick', projectId: string): void
}>()

const router = useRouter()

const graphContainerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const selectedNode = ref<GraphNode | null>(null)

const width = ref(800)
const height = ref(600)

let simulation: d3.Simulation<GraphNode, GraphLink> | null = null
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let linkGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let labelGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null

const relatedProjects = computed(() => {
  if (!selectedNode.value) return []

  const projectRelations = props.relations.filter(
    r => r.sourceId === selectedNode.value!.id || r.targetId === selectedNode.value!.id
  )

  return projectRelations.map(rel => {
    const otherId = rel.sourceId === selectedNode.value!.id ? rel.targetId : rel.sourceId
    const otherProject = props.projects.find(p => p.id === otherId)
    return {
      id: otherId,
      name: otherProject?.name || '未知项目',
      relationType: rel.type
    }
  }).filter(r => r.name !== '未知项目')
})

const categoryColors: Record<string, string> = {
  traditional_skill: '#409EFF',
  traditional_music: '#67C23A',
  traditional_dance: '#E6A23C',
  traditional_drama: '#F56C6C',
  folk_custom: '#909399'
}

const createGraph = () => {
  if (!graphContainerRef.value || !svgRef.value) return

  width.value = graphContainerRef.value.clientWidth
  height.value = graphContainerRef.value.clientHeight

  const maxInheritors = Math.max(...props.projects.map(p => p.inheritors.length), 1)

  const nodes: GraphNode[] = props.projects.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    batch: p.batch,
    region: p.region,
    description: p.description,
    inheritorCount: p.inheritors.length,
    radius: 8 + (p.inheritors.length / maxInheritors) * 20
  }))

  const links: GraphLink[] = props.relations.map(r => ({
    id: r.id,
    source: r.sourceId,
    target: r.targetId,
    relationType: r.type,
    strength: r.strength
  }))

  svg = d3.select(svgRef.value)
  svg.attr('width', width.value).attr('height', height.value)

  svg.selectAll('*').remove()

  defs = svg.append('defs')

  Object.entries(RELATION_TYPE_COLORS).forEach(([type, color]) => {
    defs!.append('marker')
      .attr('id', `arrow-${type}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color)
  })

  g = svg.append('g')

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g!.attr('transform', event.transform)
    })

  svg.call(zoom)

  linkGroup = g.append('g').attr('class', 'links')
  nodeGroup = g.append('g').attr('class', 'nodes')
  labelGroup = g.append('g').attr('class', 'labels')

  const link = linkGroup.selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => RELATION_TYPE_COLORS[d.relationType])
    .attr('stroke-width', d => 1 + d.strength * 2)
    .attr('stroke-opacity', 0.6)
    .attr('marker-end', d => `url(#arrow-${d.relationType})`)

  const node = nodeGroup.selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => categoryColors[d.category])
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')
    .on('click', (_, d) => {
      selectedNode.value = d
      emit('nodeClick', d.id)
    })
    .on('mouseover', function(_, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', d.radius * 1.2)
        .attr('stroke-width', 3)

      label!.filter((ld: any) => ld.id === d.id)
        .transition()
        .style('font-weight', 'bold')
        .style('font-size', '14px')
    })
    .on('mouseout', function(_, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', d.radius)
        .attr('stroke-width', 2)

      label!.filter((ld: any) => ld.id === d.id)
        .transition()
        .style('font-weight', 'normal')
        .style('font-size', '12px')
    })
    .call(d3.drag<SVGCircleElement, GraphNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))

  const label = labelGroup.selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .text(d => d.name.length > 8 ? d.name.slice(0, 8) + '...' : d.name)
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.radius + 18)
    .attr('font-size', '12px')
    .attr('fill', '#333')
    .attr('pointer-events', 'none')
    .attr('font-family', 'system-ui, -apple-system, sans-serif')

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width.value / 2, height.value / 2))
    .force('collision', d3.forceCollide().radius(d => d.radius + 20))
    .on('tick', ticked)

  function ticked() {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)

    node
      .attr('cx', d => d.x || 0)
      .attr('cy', d => d.y || 0)

    label
      .attr('x', d => d.x || 0)
      .attr('y', d => d.y || 0)
  }

  function dragstarted(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
    if (!event.active) simulation!.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
    if (!event.active) simulation!.alphaTarget(0)
    d.fx = null
    d.fy = null
  }
}

const goToEditor = () => {
  if (selectedNode.value) {
    router.push(`/editor/${selectedNode.value.id}`)
  }
}

const goToShowcase = () => {
  if (selectedNode.value) {
    router.push(`/showcase/${selectedNode.value.id}`)
  }
}

const handleResize = () => {
  if (graphContainerRef.value) {
    width.value = graphContainerRef.value.clientWidth
    height.value = graphContainerRef.value.clientHeight
    if (svg) {
      svg.attr('width', width.value).attr('height', height.value)
      if (simulation) {
        simulation.force('center', d3.forceCenter(width.value / 2, height.value / 2))
        simulation.alpha(0.3).restart()
      }
    }
  }
}

watch(() => [props.projects, props.relations], () => {
  nextTick(() => {
    createGraph()
  })
}, { deep: true })

onMounted(() => {
  nextTick(() => {
    createGraph()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (simulation) {
    simulation.stop()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.relation-graph {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.graph-container {
  width: 100%;
  height: 100%;

  svg {
    display: block;
  }
}

.graph-legend {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.95);
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #303133;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    color: #606266;

    &:last-child {
      margin-bottom: 0;
    }

    .legend-color {
      width: 16px;
      height: 3px;
      border-radius: 2px;
    }
  }
}

.detail-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 320px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: all 0.3s ease;

  &.is-visible {
    transform: translateX(0);
    opacity: 1;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #f0f0f0;

    h3 {
      margin: 0;
      font-size: 16px;
      color: #303133;
    }
  }

  .panel-body {
    padding: 16px;

    .info-row {
      display: flex;
      margin-bottom: 12px;
      font-size: 13px;

      .label {
        width: 70px;
        color: #909399;
        flex-shrink: 0;
      }

      .value {
        flex: 1;
        color: #303133;
      }

      &.description .value {
        line-height: 1.6;
      }
    }

    .relations-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;

      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #303133;
      }

      .related-list {
        max-height: 150px;
        overflow-y: auto;

        .related-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f5f7fa;
          border-radius: 4px;
          margin-bottom: 8px;

          .related-name {
            font-size: 13px;
            color: #303133;
          }

          .related-type {
            font-size: 12px;
            font-weight: 500;
          }
        }
      }
    }

    .panel-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
  }
}

:deep(.circle-node) {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    filter: brightness(1.1);
  }
}

:deep(.link-line) {
  transition: stroke-opacity 0.2s ease;

  &:hover {
    stroke-opacity: 1;
  }
}
</style>
