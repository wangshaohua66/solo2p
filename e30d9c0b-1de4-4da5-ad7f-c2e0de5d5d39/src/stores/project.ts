import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { HeritageProject, ProjectFilters, MediaItem, ProjectRelation, StepFlow } from '@/types'
import { validateImportData } from '@/utils/validator'

const STORAGE_KEY = 'ih_projects'
const MAX_STORAGE_SIZE = 50 * 1024 * 1024

const generateSampleData = (): HeritageProject[] => {
  const projectIds = {
    xuanzhi: uuidv4(),
    huimo: uuidv4(),
    kesi: uuidv4(),
    dage: uuidv4(),
    yangge: uuidv4(),
    kunqu: uuidv4(),
    chunjie: uuidv4(),
    taoci: uuidv4()
  }

  return [
    {
      id: projectIds.xuanzhi,
      name: '宣纸制作技艺',
      category: 'traditional_skill',
      batch: '第一批',
      region: '安徽省泾县',
      description: '宣纸是中国传统的书画用纸，原产于安徽泾县，质地绵韧、光洁如玉、不蛀不腐、墨韵万变，被誉为"纸寿千年"。',
      inheritors: [
        { id: uuidv4(), name: '邢春荣', age: 72, avatar: '', title: '国家级传承人' },
        { id: uuidv4(), name: '曹光华', age: 68, avatar: '', title: '省级传承人' }
      ],
      protectionUnit: '中国宣纸股份有限公司',
      createdAt: Date.now() - 86400000 * 30,
      updatedAt: Date.now() - 86400000 * 5,
      mediaLib: [],
      stepFlow: {
        nodes: [
          { id: 'start', type: 'start', position: { x: 100, y: 200 }, name: '开始', description: '', duration: 0, mediaIds: [], keyTechniques: [], notes: '' },
          { id: 'step1', type: 'normal', position: { x: 300, y: 200 }, name: '选料', description: '选用当地特有的青檀树皮和沙田稻草作为原料', duration: 3600, mediaIds: [], keyTechniques: ['原料挑选', '季节性采伐'], notes: '青檀树皮需选择3年生的枝条' },
          { id: 'step2', type: 'normal', position: { x: 550, y: 200 }, name: '浸泡', description: '将原料放入石灰池中浸泡软化', duration: 86400, mediaIds: [], keyTechniques: ['石灰比例', '浸泡时间控制'], notes: '浸泡时间随季节调整' },
          { id: 'step3', type: 'normal', position: { x: 800, y: 200 }, name: '蒸煮', description: '高温蒸煮去除杂质和木质素', duration: 43200, mediaIds: [], keyTechniques: ['温度控制', '蒸煮火候'], notes: '蒸煮需持续36小时以上' },
          { id: 'step4', type: 'normal', position: { x: 1050, y: 200 }, name: '打浆', description: '用石臼或机器将原料捣打成纸浆', duration: 7200, mediaIds: [], keyTechniques: ['浆水比例', '打浆细度'], notes: '传统工艺需人工捣打上千次' },
          { id: 'step5', type: 'normal', position: { x: 1300, y: 200 }, name: '抄纸', description: '用竹帘从纸浆槽中抄起形成湿纸', duration: 1800, mediaIds: [], keyTechniques: ['手势平衡', '抄纸速度'], notes: '这是最考验技术的工序' },
          { id: 'step6', type: 'normal', position: { x: 1550, y: 200 }, name: '压榨', description: '将湿纸叠放后压榨去除水分', duration: 3600, mediaIds: [], keyTechniques: ['压力均匀', '时间控制'], notes: '压力需逐渐增加' },
          { id: 'step7', type: 'normal', position: { x: 1800, y: 200 }, name: '焙干', description: '将湿纸贴在烘墙上烘干', duration: 1800, mediaIds: [], keyTechniques: ['温度控制', '贴纸平整'], notes: '烘墙温度保持在40-50度' },
          { id: 'end', type: 'end', position: { x: 2050, y: 200 }, name: '结束', description: '', duration: 0, mediaIds: [], keyTechniques: [], notes: '' }
        ],
        edges: [
          { id: 'e1-2', source: 'start', target: 'step1', type: 'sequence', label: '' },
          { id: 'e2-3', source: 'step1', target: 'step2', type: 'sequence', label: '' },
          { id: 'e3-4', source: 'step2', target: 'step3', type: 'sequence', label: '' },
          { id: 'e4-5', source: 'step3', target: 'step4', type: 'sequence', label: '' },
          { id: 'e5-6', source: 'step4', target: 'step5', type: 'sequence', label: '' },
          { id: 'e6-7', source: 'step5', target: 'step6', type: 'sequence', label: '' },
          { id: 'e7-8', source: 'step6', target: 'step7', type: 'sequence', label: '' },
          { id: 'e8-end', source: 'step7', target: 'end', type: 'sequence', label: '' }
        ]
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.xuanzhi, targetId: projectIds.huimo, type: 'cultural_origin', strength: 5, description: '同属文房四宝，文化同源' }
      ]
    },
    {
      id: projectIds.huimo,
      name: '徽墨制作技艺',
      category: 'traditional_skill',
      batch: '第一批',
      region: '安徽省黄山市',
      description: '徽墨是中国传统制墨技艺中的珍品，具有拈来轻、磨来清、嗅来馨、坚如玉、研无声、一点如漆、万载存真的特点。',
      inheritors: [
        { id: uuidv4(), name: '周美洪', age: 75, avatar: '', title: '国家级传承人' }
      ],
      protectionUnit: '中国歙县老胡开文墨厂',
      createdAt: Date.now() - 86400000 * 25,
      updatedAt: Date.now() - 86400000 * 3,
      mediaLib: [],
      stepFlow: {
        nodes: [
          { id: 'start', type: 'start', position: { x: 100, y: 200 }, name: '开始', description: '', duration: 0, mediaIds: [], keyTechniques: [], notes: '' },
          { id: 'step1', type: 'normal', position: { x: 350, y: 200 }, name: '炼烟', description: '烧制桐油或松烟制取炭黑', duration: 172800, mediaIds: [], keyTechniques: ['火候控制', '烟炱收集'], notes: '传统松烟需烧制七天七夜' },
          { id: 'step2', type: 'normal', position: { x: 600, y: 200 }, name: '和料', description: '将烟料与胶、香料、药材等混合', duration: 3600, mediaIds: [], keyTechniques: ['配料比例', '搅拌均匀'], notes: '名贵徽墨需添加麝香、冰片等药材' },
          { id: 'step3', type: 'normal', position: { x: 850, y: 200 }, name: '捣杵', description: '反复捶打墨泥使其均匀细腻', duration: 7200, mediaIds: [], keyTechniques: ['捶打力度', '捶打次数'], notes: '需捶打千锤以上' },
          { id: 'step4', type: 'normal', position: { x: 1100, y: 200 }, name: '制模', description: '将墨泥放入模具中压制成型', duration: 1800, mediaIds: [], keyTechniques: ['压力均匀', '脱模技巧'], notes: '模具多为梨木雕刻' },
          { id: 'step5', type: 'normal', position: { x: 1350, y: 200 }, name: '晾晒', description: '阴干墨锭，防止开裂', duration: 2592000, mediaIds: [], keyTechniques: ['环境湿度', '翻转时机'], notes: '需阴干数月甚至数年' },
          { id: 'step6', type: 'normal', position: { x: 1600, y: 200 }, name: '描金', description: '在墨锭上描金填彩', duration: 3600, mediaIds: [], keyTechniques: ['描金技法', '色彩搭配'], notes: '需细致耐心' },
          { id: 'end', type: 'end', position: { x: 1850, y: 200 }, name: '结束', description: '', duration: 0, mediaIds: [], keyTechniques: [], notes: '' }
        ],
        edges: [
          { id: 'e1-2', source: 'start', target: 'step1', type: 'sequence', label: '' },
          { id: 'e2-3', source: 'step1', target: 'step2', type: 'sequence', label: '' },
          { id: 'e3-4', source: 'step2', target: 'step3', type: 'sequence', label: '' },
          { id: 'e4-5', source: 'step3', target: 'step4', type: 'sequence', label: '' },
          { id: 'e5-6', source: 'step4', target: 'step5', type: 'sequence', label: '' },
          { id: 'e6-7', source: 'step5', target: 'step6', type: 'sequence', label: '' },
          { id: 'e7-end', source: 'step6', target: 'end', type: 'sequence', label: '' }
        ]
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.huimo, targetId: projectIds.xuanzhi, type: 'cultural_origin', strength: 5, description: '同属文房四宝，文化同源' }
      ]
    },
    {
      id: projectIds.kesi,
      name: '苏州缂丝织造技艺',
      category: 'traditional_skill',
      batch: '第一批',
      region: '江苏省苏州市',
      description: '缂丝又称"刻丝"，是中国传统丝绸艺术品中的精华，采用通经断纬的织法，使织物花纹图案如镂刻之象，有"一寸缂丝一寸金"之说。',
      inheritors: [
        { id: uuidv4(), name: '王金山', age: 80, avatar: '', title: '国家级传承人' },
        { id: uuidv4(), name: '马惠娟', age: 72, avatar: '', title: '国家级传承人' },
        { id: uuidv4(), name: '陈文', age: 65, avatar: '', title: '省级传承人' }
      ],
      protectionUnit: '苏州刺绣研究所',
      createdAt: Date.now() - 86400000 * 20,
      updatedAt: Date.now() - 86400000 * 7,
      mediaLib: [],
      stepFlow: {
        nodes: [],
        edges: []
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.kesi, targetId: projectIds.kunqu, type: 'regional', strength: 3, description: '同属苏州地区传统技艺' }
      ]
    },
    {
      id: projectIds.dage,
      name: '侗族大歌',
      category: 'traditional_music',
      batch: '第一批',
      region: '贵州省黎平县',
      description: '侗族大歌是中国侗族地区一种多声部、无指挥、无伴奏、自然合声的民间合唱形式，被列为世界非物质文化遗产。',
      inheritors: [
        { id: uuidv4(), name: '胡官美', age: 68, avatar: '', title: '国家级传承人' }
      ],
      protectionUnit: '黎平县文化馆',
      createdAt: Date.now() - 86400000 * 15,
      updatedAt: Date.now() - 86400000 * 2,
      mediaLib: [],
      stepFlow: {
        nodes: [],
        edges: []
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.dage, targetId: projectIds.chunjie, type: 'derived', strength: 4, description: '春节期间常有侗族大歌表演' }
      ]
    },
    {
      id: projectIds.yangge,
      name: '秧歌舞',
      category: 'traditional_dance',
      batch: '第二批',
      region: '陕西省延安市',
      description: '秧歌是中国北方广泛流传的一种极具群众性和代表性的民间舞蹈，通常在春节等重要节日表演，具有浓郁的乡土气息和地方特色。',
      inheritors: [
        { id: uuidv4(), name: '李增恒', age: 75, avatar: '', title: '国家级传承人' }
      ],
      protectionUnit: '延安市群众艺术馆',
      createdAt: Date.now() - 86400000 * 10,
      updatedAt: Date.now() - 86400000 * 1,
      mediaLib: [],
      stepFlow: {
        nodes: [],
        edges: []
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.yangge, targetId: projectIds.chunjie, type: 'derived', strength: 5, description: '春节期间重要的民俗表演活动' }
      ]
    },
    {
      id: projectIds.kunqu,
      name: '昆曲',
      category: 'traditional_drama',
      batch: '第一批',
      region: '江苏省苏州市',
      description: '昆曲是中国古老的戏曲声腔、剧种，现又被称为"昆剧"，被誉为"百戏之祖"，其唱腔华丽婉转、念白儒雅、表演细腻、舞蹈飘逸。',
      inheritors: [
        { id: uuidv4(), name: '王芳', age: 60, avatar: '', title: '国家级传承人' },
        { id: uuidv4(), name: '俞玖林', age: 55, avatar: '', title: '国家级传承人' }
      ],
      protectionUnit: '苏州昆剧院',
      createdAt: Date.now() - 86400000 * 18,
      updatedAt: Date.now() - 86400000 * 4,
      mediaLib: [],
      stepFlow: {
        nodes: [],
        edges: []
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.kunqu, targetId: projectIds.kesi, type: 'regional', strength: 3, description: '同属苏州地区传统文化' }
      ]
    },
    {
      id: projectIds.chunjie,
      name: '春节',
      category: 'folk_custom',
      batch: '第一批',
      region: '全国',
      description: '春节即中国农历新年，俗称新春、新岁、岁旦等，口头上又称过年、过大年，是中华民族最隆重的传统佳节。',
      inheritors: [],
      protectionUnit: '文化部',
      createdAt: Date.now() - 86400000 * 12,
      updatedAt: Date.now() - 86400000 * 1,
      mediaLib: [],
      stepFlow: {
        nodes: [],
        edges: []
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.chunjie, targetId: projectIds.yangge, type: 'derived', strength: 5, description: '春节期间秧歌表演' },
        { id: uuidv4(), sourceId: projectIds.chunjie, targetId: projectIds.dage, type: 'derived', strength: 4, description: '春节期间侗族大歌表演' }
      ]
    },
    {
      id: projectIds.taoci,
      name: '景德镇陶瓷烧制技艺',
      category: 'traditional_skill',
      batch: '第一批',
      region: '江西省景德镇市',
      description: '景德镇陶瓷历史悠久，素有"瓷都"之称，其烧制技艺工序繁杂，从选矿到成品需要经过七十二道工序，形成了独特的陶瓷文化。',
      inheritors: [
        { id: uuidv4(), name: '黄云鹏', age: 78, avatar: '', title: '国家级传承人' },
        { id: uuidv4(), name: '赖德全', age: 68, avatar: '', title: '国家级传承人' }
      ],
      protectionUnit: '景德镇陶瓷协会',
      createdAt: Date.now() - 86400000 * 22,
      updatedAt: Date.now() - 86400000 * 6,
      mediaLib: [],
      stepFlow: {
        nodes: [],
        edges: []
      },
      relations: [
        { id: uuidv4(), sourceId: projectIds.taoci, targetId: projectIds.xuanzhi, type: 'cultural_origin', strength: 4, description: '同属传统工艺，文化同源' }
      ]
    }
  ]
}

const loadFromStorage = (): HeritageProject[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load projects from localStorage:', e)
  }
  const sampleData = generateSampleData()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData))
  } catch (e) {
    console.error('Failed to save sample data:', e)
  }
  return sampleData
}

const saveToStorage = (projects: HeritageProject[]): void => {
  try {
    const data = JSON.stringify(projects)
    if (new Blob([data]).size > MAX_STORAGE_SIZE) {
      console.warn('Data size exceeds 50MB limit')
    }
    localStorage.setItem(STORAGE_KEY, data)
  } catch (e) {
    console.error('Failed to save projects to localStorage:', e)
  }
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<HeritageProject[]>(loadFromStorage())
  const currentProjectId = ref<string | null>(null)
  const filters = ref<ProjectFilters>({
    category: '',
    batch: '',
    region: '',
    keyword: '',
    inheritorName: ''
  })

  const currentProject = computed(() => {
    return projects.value.find(p => p.id === currentProjectId.value) || null
  })

  const filteredProjects = computed(() => {
    return projects.value.filter(project => {
      if (filters.value.category && project.category !== filters.value.category) {
        return false
      }
      if (filters.value.batch && project.batch !== filters.value.batch) {
        return false
      }
      if (filters.value.region && project.region !== filters.value.region) {
        return false
      }
      if (filters.value.inheritorName) {
        const hasInheritor = project.inheritors.some(i =>
          i.name.includes(filters.value.inheritorName!)
        )
        if (!hasInheritor) return false
      }
      if (filters.value.keyword) {
        const keyword = filters.value.keyword.toLowerCase()
        const matchName = project.name.toLowerCase().includes(keyword)
        const matchDesc = project.description.toLowerCase().includes(keyword)
        if (!matchName && !matchDesc) return false
      }
      return true
    })
  })

  const allRelations = computed(() => {
    const relations: ProjectRelation[] = []
    projects.value.forEach(project => {
      relations.push(...project.relations)
    })
    return relations
  })

  const setCurrentProject = (id: string | null) => {
    currentProjectId.value = id
  }

  const setFilters = (newFilters: Partial<ProjectFilters>) => {
    filters.value = { ...filters.value, ...newFilters }
  }

  const resetFilters = () => {
    filters.value = {
      category: '',
      batch: '',
      region: '',
      keyword: '',
      inheritorName: ''
    }
  }

  const createProject = (projectData: Omit<HeritageProject, 'id' | 'createdAt' | 'updatedAt' | 'stepFlow' | 'mediaLib' | 'relations'>): HeritageProject => {
    const newProject: HeritageProject = {
      ...projectData,
      id: uuidv4(),
      stepFlow: {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      mediaLib: [],
      relations: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    projects.value.push(newProject)
    saveToStorage(projects.value)
    return newProject
  }

  const updateProject = (id: string, updates: Partial<HeritageProject>) => {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = {
        ...projects.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      saveToStorage(projects.value)
    }
  }

  const deleteProject = (id: string) => {
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProjectId.value === id) {
      currentProjectId.value = null
    }
    projects.value.forEach(project => {
      project.relations = project.relations.filter(
        r => r.sourceId !== id && r.targetId !== id
      )
    })
    saveToStorage(projects.value)
  }

  const addMedia = (projectId: string, media: MediaItem) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.mediaLib.push(media)
      project.updatedAt = Date.now()
      saveToStorage(projects.value)
    }
  }

  const removeMedia = (projectId: string, mediaId: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.mediaLib = project.mediaLib.filter(m => m.id !== mediaId)
      project.stepFlow.nodes.forEach(node => {
        node.mediaIds = node.mediaIds.filter(id => id !== mediaId)
      })
      project.updatedAt = Date.now()
      saveToStorage(projects.value)
    }
  }

  const updateStepFlow = (projectId: string, stepFlow: StepFlow) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.stepFlow = stepFlow
      project.updatedAt = Date.now()
      saveToStorage(projects.value)
    }
  }

  const addRelation = (projectId: string, relation: Omit<ProjectRelation, 'id'>) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      const newRelation = { ...relation, id: uuidv4() }
      project.relations.push(newRelation)
      project.updatedAt = Date.now()
      saveToStorage(projects.value)
    }
  }

  const removeRelation = (projectId: string, relationId: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.relations = project.relations.filter(r => r.id !== relationId)
      project.updatedAt = Date.now()
      saveToStorage(projects.value)
    }
  }

  const exportData = (): string => {
    const exportObj = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      projects: projects.value
    }
    return JSON.stringify(exportObj, null, 2)
  }

  const importData = (jsonString: string): { success: boolean; errors: string[] } => {
    try {
      const data = JSON.parse(jsonString)
      const validation = validateImportData(data)
      if (!validation.valid) {
        return { success: false, errors: validation.errors }
      }

      projects.value = data.projects
      saveToStorage(projects.value)
      return { success: true, errors: [] }
    } catch (e) {
      return { success: false, errors: ['JSON解析失败：' + (e as Error).message] }
    }
  }

  const downloadExport = () => {
    const data = exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `非遗项目数据_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getProjectById = (id: string) => {
    return projects.value.find(p => p.id === id)
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    filters,
    filteredProjects,
    allRelations,
    setCurrentProject,
    setFilters,
    resetFilters,
    createProject,
    updateProject,
    deleteProject,
    addMedia,
    removeMedia,
    updateStepFlow,
    addRelation,
    removeRelation,
    exportData,
    importData,
    downloadExport,
    getProjectById
  }
})
