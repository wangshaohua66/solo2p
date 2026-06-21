<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search as SearchIcon,
  Star,
  History,
  Refresh,
  DocumentChecked,
  Collection,
  CollectionTag,
  Warning
} from '@element-plus/icons-vue'
import type { HSCode, HSChapter } from '@/types'

const searchKeyword = ref('')
const activeTab = ref<'search' | 'favorites'>('search')
const currentDetail = ref<HSCode | null>(null)
const selectedCode = ref<string>('')
const showRecommendations = ref(false)

const chapterTree: HSChapter[] = reactive([
  {
    code: '01',
    name: '第1类 活动物;动物产品',
    children: [
      { code: '01', name: '第01章 活动物' },
      { code: '02', name: '第02章 肉及食用杂碎' },
      { code: '03', name: '第03章 鱼、甲壳动物等' },
      { code: '04', name: '第04章 乳品;蛋品' },
      { code: '05', name: '第05章 其他动物产品' }
    ]
  },
  {
    code: '06',
    name: '第2类 植物产品',
    children: [
      { code: '06', name: '第06章 活植物;茎、根' },
      { code: '07', name: '第07章 食用蔬菜' },
      { code: '08', name: '第08章 食用水果' },
      { code: '09', name: '第09章 咖啡、茶、马黛茶' },
      { code: '10', name: '第10章 谷物' }
    ]
  },
  {
    code: '11',
    name: '第3类 动植物油脂',
    children: [
      { code: '15', name: '第15章 动植物油脂及其分解产品' }
    ]
  },
  {
    code: '16',
    name: '第4类 食品;饮料、酒及醋',
    children: [
      { code: '16', name: '第16章 肉、鱼等的制品' },
      { code: '17', name: '第17章 糖及糖食' },
      { code: '18', name: '第18章 可可及可可制品' },
      { code: '19', name: '第19章 谷物制品' },
      { code: '20', name: '第20章 蔬菜、水果制品' },
      { code: '21', name: '第21章 杂项食品' },
      { code: '22', name: '第22章 饮料、酒及醋' }
    ]
  },
  {
    code: '30',
    name: '第6类 化学工业产品',
    children: [
      { code: '30', name: '第30章 药品' },
      { code: '33', name: '第33章 精油及香膏' },
      { code: '34', name: '第34章 肥皂、洗涤剂' }
    ]
  },
  {
    code: '38',
    name: '第7类 塑料及其制品',
    children: [
      { code: '39', name: '第39章 塑料及其制品' },
      { code: '40', name: '第40章 橡胶及其制品' }
    ]
  },
  {
    code: '41',
    name: '第8类 皮革;毛皮及其制品',
    children: [
      { code: '41', name: '第41章 生皮、皮革' },
      { code: '42', name: '第42章 皮革制品' }
    ]
  },
  {
    code: '44',
    name: '第9类 木及木制品;木炭',
    children: [
      { code: '44', name: '第44章 木及木制品' },
      { code: '46', name: '第46章 稻草、秸秆制品' }
    ]
  },
  {
    code: '47',
    name: '第10类 木浆及纸制品',
    children: [
      { code: '47', name: '第47章 木浆' },
      { code: '48', name: '第48章 纸及纸板' },
      { code: '49', name: '第49章 印刷品' }
    ]
  },
  {
    code: '50',
    name: '第11类 纺织原料及纺织制品',
    children: [
      { code: '50', name: '第50章 蚕丝' },
      { code: '51', name: '第51章 羊毛等' },
      { code: '52', name: '第52章 棉花' },
      { code: '54', name: '第54章 化学纤维长丝' },
      { code: '55', name: '第55章 化学纤维短纤' },
      { code: '60', name: '第60章 针织物及钩编织物' },
      { code: '61', name: '第61章 针织服装' },
      { code: '62', name: '第62章 非针织服装' },
      { code: '63', name: '第63章 其他纺织制品' }
    ]
  },
  {
    code: '64',
    name: '第12类 鞋、帽、伞等',
    children: [
      { code: '64', name: '第64章 鞋靴' },
      { code: '65', name: '第65章 帽类' },
      { code: '66', name: '第66章 雨伞、手杖等' }
    ]
  },
  {
    code: '68',
    name: '第13类 石料、陶瓷、玻璃',
    children: [
      { code: '68', name: '第68章 石料制品' },
      { code: '69', name: '第69章 陶瓷产品' },
      { code: '70', name: '第70章 玻璃及其制品' }
    ]
  },
  {
    code: '71',
    name: '第14类 天然或养殖珍珠、宝石',
    children: [
      { code: '71', name: '第71章 珠宝、贵金属' }
    ]
  },
  {
    code: '72',
    name: '第15类 贱金属及其制品',
    children: [
      { code: '72', name: '第72章 钢铁' },
      { code: '73', name: '第73章 钢铁制品' },
      { code: '74', name: '第74章 铜及其制品' },
      { code: '76', name: '第76章 铝及其制品' },
      { code: '82', name: '第82章 贱金属工具' },
      { code: '83', name: '第83章 贱金属杂项制品' }
    ]
  },
  {
    code: '84',
    name: '第16类 机器、机械器具',
    children: [
      { code: '84', name: '第84章 核反应堆、锅炉、机器' },
      { code: '85', name: '第85章 电机、电气设备' }
    ]
  },
  {
    code: '86',
    name: '第17类 车辆、航空器、船舶',
    children: [
      { code: '86', name: '第86章 铁道车辆' },
      { code: '87', name: '第87章 车辆及其零件' },
      { code: '88', name: '第88章 航空器' },
      { code: '89', name: '第89章 船舶' }
    ]
  },
  {
    code: '90',
    name: '第18类 光学、照相、医疗设备',
    children: [
      { code: '90', name: '第90章 光学、医疗设备' },
      { code: '91', name: '第91章 钟表' },
      { code: '92', name: '第92章 乐器' }
    ]
  },
  {
    code: '93',
    name: '第19类 武器、弹药',
    children: [
      { code: '93', name: '第93章 武器、弹药' }
    ]
  },
  {
    code: '94',
    name: '第20类 杂项制品',
    children: [
      { code: '94', name: '第94章 家具;寝具等' },
      { code: '95', name: '第95章 玩具、游戏品' },
      { code: '96', name: '第96章 杂项制品' }
    ]
  },
  {
    code: '97',
    name: '第21类 艺术品、收藏品',
    children: [
      { code: '97', name: '第97章 艺术品、收藏品' }
    ]
  }
])

const mockHSCodes: HSCode[] = reactive([
  {
    code: '85171210',
    name: '蓝牙耳机（无线）',
    chapter: '第85章',
    section: '第16类',
    description: '用于移动通信的蓝牙耳机，采用蓝牙无线技术，支持免提通话和音乐播放功能。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true, description: '1:自主品牌, 2:境外品牌, 3:无品牌' },
      { key: 'brandName', label: '品牌中文名称', required: true },
      { key: 'brandEnName', label: '品牌外文名称', required: false },
      { key: 'model', label: '型号', required: true },
      { key: 'func', label: '功能', required: true, description: '如：蓝牙连接、通话、音乐播放等' },
      { key: 'connect', label: '连接方式', required: true, description: '如：蓝牙/WiFi/有线' },
      { key: 'spec', label: '规格', required: true },
      { key: 'material', label: '材质', required: false }
    ],
    unit: ['个', '副', '台'],
    notes: '归入8517.1210需符合《商品及品目注释》关于蓝牙耳机的规定。'
  },
  {
    code: '85176290',
    name: '智能手表（可穿戴设备）',
    chapter: '第85章',
    section: '第16类',
    description: '集心率监测、运动跟踪、消息通知等功能于一体的智能可穿戴设备。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'func', label: '功能', required: true },
      { key: 'screen', label: '显示屏类型', required: false },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['个', '台', '只']
  },
  {
    code: '85258013',
    name: '网络摄像头',
    chapter: '第85章',
    section: '第16类',
    description: '用于视频拍摄和图像采集的网络摄像机，支持WiFi连接和远程监控。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B', 'O'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'resolution', label: '分辨率', required: true },
      { key: 'func', label: '功能', required: true },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['台', '个']
  },
  {
    code: '85044099',
    name: '无线充电器',
    chapter: '第85章',
    section: '第16类',
    description: '利用电磁感应原理为电子设备进行无线充电的装置。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'power', label: '功率', required: true },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['个', '台']
  },
  {
    code: '61091000',
    name: '棉质针织T恤衫',
    chapter: '第61章',
    section: '第11类',
    description: '由棉纤维制成的针织T恤衫，适合日常穿着。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'style', label: '款式', required: true, description: '如：套头/开襟/翻领' },
      { key: 'category', label: '类别', required: true, description: '如：男式/女式/童式' },
      { key: 'composition', label: '成分含量', required: true, description: '如：100%棉' },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['件', '打'],
    notes: '注意棉含量需达到相应标准方可归入本品目。'
  },
  {
    code: '94052000',
    name: 'LED台灯',
    chapter: '第94章',
    section: '第20类',
    description: '使用LED作为光源的台灯，具有节能、护眼等特点。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'lightSource', label: '光源类型', required: true, description: 'LED/白炽灯/荧光灯' },
      { key: 'power', label: '功率', required: true },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['台', '个']
  },
  {
    code: '95030031',
    name: '积木玩具（益智类）',
    chapter: '第95章',
    section: '第20类',
    description: '通过搭建组合培养儿童动手能力和空间想象力的益智积木玩具。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'material', label: '材质', required: true, description: '如：塑料/木质' },
      { key: 'pcs', label: '套件数量', required: true },
      { key: 'age', label: '适用年龄', required: false },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['套', '盒']
  },
  {
    code: '33041000',
    name: '口红（化妆品）',
    chapter: '第33章',
    section: '第6类',
    description: '用于唇部上色和修饰的化妆品，含有色素、油脂等成分。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B', 'V'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号/色号', required: true },
      { key: 'usage', label: '用途', required: true },
      { key: 'packing', label: '包装规格', required: true },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['支', '盒', '个'],
    notes: '化妆品类需提供食药监备案凭证方可进出口。'
  },
  {
    code: '85287222',
    name: '彩色液晶显示器',
    chapter: '第85章',
    section: '第16类',
    description: '采用TFT液晶显示技术的彩色显示器，用于计算机或其他设备。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B', 'O'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'size', label: '屏幕尺寸', required: true },
      { key: 'resolution', label: '分辨率', required: true },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['台']
  },
  {
    code: '64029929',
    name: '运动鞋（橡胶底）',
    chapter: '第64章',
    section: '第12类',
    description: '鞋面采用纺织材料、鞋底采用橡胶或塑料制成的运动鞋。',
    taxRate: 0.13,
    refundRate: 0.13,
    supervisionConditions: ['A', 'B'],
    declareElements: [
      { key: 'name', label: '商品名称', required: true },
      { key: 'brandType', label: '品牌类型', required: true },
      { key: 'brandName', label: '品牌名称', required: true },
      { key: 'model', label: '型号', required: true },
      { key: 'upperMaterial', label: '鞋面材质', required: true },
      { key: 'soleMaterial', label: '鞋底材质', required: true },
      { key: 'category', label: '类别', required: true, description: '如：男式/女式/童式' },
      { key: 'spec', label: '规格', required: true }
    ],
    unit: ['双', '打']
  }
])

const searchHistory = ref<string[]>(['85171210', '蓝牙耳机', '智能手表', '61091000', '玩具'])
const favorites = ref<string[]>([])
const filteredHSCodes = ref<HSCode[]>([...mockHSCodes])

function handleSearch() {
  if (!searchKeyword.value.trim()) {
    filteredHSCodes.value = [...mockHSCodes]
    return
  }
  const kw = searchKeyword.value.trim().toLowerCase()
  filteredHSCodes.value = mockHSCodes.filter(
    h => h.code.toLowerCase().includes(kw) || h.name.toLowerCase().includes(kw)
  )
  if (!searchHistory.value.includes(searchKeyword.value.trim())) {
    searchHistory.value.unshift(searchKeyword.value.trim())
    if (searchHistory.value.length > 10) searchHistory.value.pop()
  }
  if (filteredHSCodes.value.length > 0) {
    handleSelectCode(filteredHSCodes.value[0])
  } else {
    ElMessage.info('未找到匹配的HS编码')
  }
}

function handleNodeClick(data: HSChapter) {
  if (data.children && data.children.length > 0) return
  const kw = data.code
  filteredHSCodes.value = mockHSCodes.filter(h => h.code.startsWith(kw))
  if (filteredHSCodes.value.length === 0) {
    ElMessage.info(`第${kw}章暂无数据`)
  } else {
    handleSelectCode(filteredHSCodes.value[0])
  }
}

function handleSelectCode(code: HSCode) {
  selectedCode.value = code.code
  currentDetail.value = code
  showRecommendations.value = true
}

function handleHistoryClick(kw: string) {
  searchKeyword.value = kw
  handleSearch()
}

function handleClearHistory() {
  searchHistory.value = []
  ElMessage.success('已清空历史记录')
}

function toggleFavorite(code: string) {
  const idx = favorites.value.indexOf(code)
  if (idx === -1) {
    favorites.value.push(code)
    ElMessage.success('已加入收藏')
  } else {
    favorites.value.splice(idx, 1)
    ElMessage.info('已取消收藏')
  }
}

function isFavorite(code: string) {
  return favorites.value.includes(code)
}

function copyCode(code: string) {
  navigator.clipboard?.writeText(code)
  ElMessage.success(`已复制：${code}`)
}

const favoriteList = computed(() =>
  mockHSCodes.filter(h => favorites.value.includes(h.code))
)

function handleRefresh() {
  searchKeyword.value = ''
  filteredHSCodes.value = [...mockHSCodes]
  currentDetail.value = null
  selectedCode.value = ''
  showRecommendations.value = false
}

watch(activeTab, (tab) => {
  if (tab === 'favorites' && favoriteList.value.length === 0) {
    ElMessage.info('暂无收藏的编码')
  }
})
</script>

<template>
  <div class="hs-search-page">
    <div class="page-header">
      <div class="page-title">HS编码智能检索</div>
      <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
    </div>

    <div class="search-bar card">
      <el-input
        v-model="searchKeyword"
        placeholder="请输入HS编码、商品名称或关键词进行搜索"
        size="large"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon style="color: #909399"><SearchIcon /></el-icon>
        </template>
        <template #append>
          <el-button type="primary" @click="handleSearch">
            <el-icon style="margin-right: 4px"><SearchIcon /></el-icon>搜索
          </el-button>
        </template>
      </el-input>

      <div v-if="searchHistory.length > 0" class="search-history">
        <div class="history-header">
          <span class="history-label"><el-icon><History /></el-icon> 搜索历史</span>
          <el-button link type="primary" size="small" @click="handleClearHistory">清空</el-button>
        </div>
        <div class="history-tags">
          <el-tag
            v-for="(h, idx) in searchHistory"
            :key="idx"
            class="history-tag"
            effect="plain"
            @click="handleHistoryClick(h)"
          >
            {{ h }}
          </el-tag>
        </div>
      </div>
    </div>

    <div class="content-container">
      <div class="sidebar-panel card">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="类章导航" name="search">
            <el-tree
              :data="chapterTree"
              :props="{ label: 'name', children: 'children' }"
              node-key="code"
              :expand-on-click-node="false"
              @node-click="handleNodeClick"
              class="chapter-tree"
            />
          </el-tab-pane>
          <el-tab-pane label="我的收藏" name="favorites">
            <div v-if="favoriteList.length === 0" class="empty-favorites">
              <el-empty description="暂无收藏" :image-size="60" />
            </div>
            <div v-else class="favorite-list">
              <div
                v-for="h in favoriteList"
                :key="h.code"
                class="favorite-item"
                :class="{ active: selectedCode === h.code }"
                @click="handleSelectCode(h)"
              >
                <div class="code-row">
                  <span class="code">{{ h.code }}</span>
                  <el-icon :color="'#faad14'"><Star /></el-icon>
                </div>
                <div class="name">{{ h.name }}</div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <div class="main-panel">
        <div class="code-list card">
          <div class="list-header">
            <span class="list-title">
              <el-icon><CollectionTag /></el-icon>
              编码列表
              <el-tag type="info" size="small" style="margin-left: 8px">
                {{ activeTab === 'favorites' ? favoriteList.length : filteredHSCodes.length }} 条
              </el-tag>
            </span>
          </div>
          <div class="code-table">
            <div
              v-for="h in (activeTab === 'favorites' ? favoriteList : filteredHSCodes)"
              :key="h.code"
              class="code-row-item"
              :class="{ active: selectedCode === h.code }"
              @click="handleSelectCode(h)"
            >
              <div class="code-main">
                <div class="code-value">{{ h.code }}</div>
                <div class="code-name">{{ h.name }}</div>
              </div>
              <div class="code-meta">
                <el-tag size="small" type="warning">退税率 {{ (h.refundRate * 100).toFixed(0) }}%</el-tag>
                <el-button
                  link
                  @click.stop="toggleFavorite(h.code)"
                >
                  <el-icon :color="isFavorite(h.code) ? '#faad14' : '#909399'">
                    <component :is="isFavorite(h.code) ? Star : Collection" />
                  </el-icon>
                </el-button>
                <el-button link @click.stop="copyCode(h.code)">
                  复制
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-panel card">
          <template v-if="currentDetail">
            <div class="detail-header">
              <div>
                <span class="detail-code">{{ currentDetail.code }}</span>
                <span class="detail-name">{{ currentDetail.name }}</span>
              </div>
              <div style="display: flex; gap: 8px">
                <el-tag size="small" type="warning">退税率 {{ (currentDetail.refundRate * 100).toFixed(0) }}%</el-tag>
                <el-tag size="small" type="info">税率 {{ (currentDetail.taxRate * 100).toFixed(0) }}%</el-tag>
                <el-button
                  size="small"
                  :type="isFavorite(currentDetail.code) ? 'warning' : 'default'"
                  :icon="isFavorite(currentDetail.code) ? Star : Collection"
                  @click="toggleFavorite(currentDetail.code)"
                >
                  {{ isFavorite(currentDetail.code) ? '已收藏' : '收藏' }}
                </el-button>
              </div>
            </div>

            <el-descriptions :column="2" border size="small" style="margin-top: 16px">
              <el-descriptions-item label="类">{{ currentDetail.section }}</el-descriptions-item>
              <el-descriptions-item label="章">{{ currentDetail.chapter }}</el-descriptions-item>
              <el-descriptions-item label="法定计量单位" :span="2">
                {{ currentDetail.unit.join(' / ') }}
              </el-descriptions-item>
              <el-descriptions-item label="监管条件" :span="2">
                <el-tag
                  v-for="c in currentDetail.supervisionConditions"
                  :key="c"
                  size="small"
                  type="danger"
                  style="margin-right: 6px"
                >
                  {{ c }}
                </el-tag>
                <span v-if="currentDetail.supervisionConditions.length === 0" style="color: #909399">无</span>
              </el-descriptions-item>
              <el-descriptions-item label="商品描述" :span="2">
                {{ currentDetail.description }}
              </el-descriptions-item>
              <el-descriptions-item v-if="currentDetail.notes" label="归类注释" :span="2">
                <div class="notes-box">
                  <el-icon style="color: #e6a23c; margin-right: 6px"><Warning /></el-icon>
                  {{ currentDetail.notes }}
                </div>
              </el-descriptions-item>
            </el-descriptions>

            <h4 style="margin-top: 20px; margin-bottom: 10px">
              <el-icon style="margin-right: 6px"><DocumentChecked /></el-icon>
              申报要素
            </h4>
            <el-table :data="currentDetail.declareElements" size="small" border>
              <el-table-column prop="key" label="要素编号" width="100" />
              <el-table-column prop="label" label="要素名称" width="140" />
              <el-table-column label="是否必填" width="100" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.required ? 'danger' : 'info'">
                    {{ row.required ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
            </el-table>

            <h4 v-if="showRecommendations" style="margin-top: 20px; margin-bottom: 10px">
              相似商品编码推荐
            </h4>
            <div v-if="showRecommendations" class="recommendation-list">
              <div
                v-for="r in mockHSCodes.filter(x => x.chapter === currentDetail?.chapter && x.code !== currentDetail?.code).slice(0, 3)"
                :key="r.code"
                class="rec-item"
                @click="handleSelectCode(r)"
              >
                <span class="rec-code">{{ r.code }}</span>
                <span class="rec-name">{{ r.name }}</span>
              </div>
            </div>
          </template>
          <el-empty v-else description="请选择左侧编码查看详情" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-search-page {
  padding: 20px;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
  }
}

.search-bar {
  margin-bottom: 16px;
  padding: 20px;

  .search-history {
    margin-top: 14px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .history-label {
    font-size: $font-size-sm;
    color: $text-secondary;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .history-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .history-tag {
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: $primary-color;
      border-color: $primary-color;
    }
  }
}

.content-container {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.sidebar-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;

  .chapter-tree {
    padding: 4px 8px;
  }

  .empty-favorites {
    padding: 40px 0;
  }

  .favorite-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 8px;
  }

  .favorite-item {
    padding: 10px;
    border-radius: $border-radius-sm;
    cursor: pointer;
    border: 1px solid transparent;

    &:hover {
      background-color: $bg-color;
    }

    &.active {
      background-color: rgba(30, 111, 255, 0.06);
      border-color: $primary-color;
    }

    .code-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .code {
      font-family: monospace;
      font-weight: 600;
      color: $primary-color;
    }

    .name {
      font-size: $font-size-sm;
      color: $text-regular;
    }
  }
}

.main-panel {
  flex: 1;
  display: flex;
  gap: 16px;
  min-width: 0;
}

.code-list {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;

  .list-header {
    padding-bottom: 12px;
    border-bottom: 1px solid $border-light;
    margin-bottom: 8px;
  }

  .list-title {
    font-weight: 600;
    display: flex;
    align-items: center;
  }

  .code-table {
    flex: 1;
    overflow-y: auto;
  }

  .code-row-item {
    padding: 12px;
    border-radius: $border-radius-sm;
    cursor: pointer;
    margin-bottom: 4px;
    border: 1px solid transparent;
    transition: all 0.2s;

    &:hover {
      background-color: $bg-color;
    }

    &.active {
      background-color: rgba(30, 111, 255, 0.08);
      border-color: $primary-color;
    }

    .code-main {
      margin-bottom: 8px;
    }

    .code-value {
      font-family: monospace;
      font-size: 15px;
      font-weight: 700;
      color: $primary-color;
    }

    .code-name {
      font-size: $font-size-sm;
      color: $text-regular;
      margin-top: 2px;
    }

    .code-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
    }
  }
}

.detail-panel {
  flex: 1;
  overflow-y: auto;
  min-width: 0;

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid $border-light;
  }

  .detail-code {
    font-family: monospace;
    font-size: 22px;
    font-weight: 700;
    color: $primary-color;
    margin-right: 12px;
  }

  .detail-name {
    font-size: $font-size-lg;
    font-weight: 600;
    color: $text-primary;
  }

  .notes-box {
    display: flex;
    align-items: flex-start;
    background-color: #fdf6ec;
    padding: 8px 12px;
    border-radius: $border-radius-sm;
    color: #e6a23c;
    font-size: $font-size-sm;
  }

  .recommendation-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rec-item {
    padding: 10px 12px;
    background-color: $bg-color;
    border-radius: $border-radius-sm;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.2s;

    &:hover {
      background-color: rgba(30, 111, 255, 0.06);
    }

    .rec-code {
      font-family: monospace;
      font-weight: 600;
      color: $primary-color;
      min-width: 100px;
    }

    .rec-name {
      color: $text-regular;
      font-size: $font-size-sm;
    }
  }
}
</style>
