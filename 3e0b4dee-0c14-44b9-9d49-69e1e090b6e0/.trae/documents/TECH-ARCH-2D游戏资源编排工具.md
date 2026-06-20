## 1. 架构设计

```mermaid
flowchart LR
    subgraph "表现层 Views"
        V1["项目列表 ProjectList.vue"]
        V2["精灵编辑 SpriteEditor.vue"]
        V3["动画编排 AnimationEditor.vue"]
        V4["地图编辑 TilemapEditor.vue"]
        V5["音效管理 AudioManager.vue"]
        V6["全局布局 AppLayout.vue<br/>(资源树+工具栏+属性面板)"]
    end

    subgraph "组件层 Components"
        C1["canvas/SpriteCanvas.vue<br/>精灵切割画布"]
        C2["canvas/AnimationPlayer.vue<br/>动画预览播放器"]
        C3["canvas/TilemapEditor.vue<br/>瓦片编辑画布"]
        C4["common/ResourceTree.vue<br/>资源树面板"]
        C5["common/PropertyPanel.vue<br/>属性检查器"]
        C6["common/Timeline.vue<br/>时间轴轨道"]
        C7["common/WaveformViewer.vue<br/>波形可视化"]
    end

    subgraph "状态层 Stores (Pinia)"
        S1["project.ts<br/>项目索引+版本快照"]
        S2["sprite.ts<br/>精灵帧+切割数据"]
        S3["animation.ts<br/>动画序列+时间轴"]
        S4["tilemap.ts<br/>地图图层+碰撞"]
        S5["audio.ts<br/>音效片段+参数"]
    end

    subgraph "工具层 Utils"
        U1["packer.ts<br/>精灵图打包算法"]
        U2["exporter.ts<br/>JSON导出器+模板"]
        U3["canvas-helper.ts<br/>Canvas封装"]
        U4["audio-helper.ts<br/>Web Audio封装"]
        U5["diff.ts<br/>快照差异对比"]
        U6["storage.ts<br/>LocalStorage持久化"]
    end

    subgraph "类型层 Types"
        T1["types/index.ts<br/>全局TS接口定义"]
    end

    subgraph "路由层 Router"
        R1["router/index.ts<br/>5个页面路由"]
    end

    subgraph "入口 Bootstrap"
        E1["main.ts<br/>Vue+Pinia+Router挂载"]
    end

    E1 --> R1
    R1 --> V6
    V6 --> V1 & V2 & V3 & V4 & V5
    V2 --> C1
    V3 --> C2 & C6
    V4 --> C3
    V5 --> C7
    V6 --> C4 & C5
    V1 & V2 & V3 & V4 & V5 --> S1 & S2 & S3 & S4 & S5
    S1 & S2 & S3 & S4 & S5 --> U1 & U2 & U3 & U4 & U5 & U6
    S1 & S2 & S3 & S4 & S5 --> T1
```

## 2. 技术栈说明

- **前端框架**：Vue@3.4 + TypeScript@5.3 + Vite@5.0
- **状态管理**：Pinia@2.1 + Pinia Plugin Undo（撤销重做）
- **路由**：Vue Router@4.3
- **渲染引擎**：Canvas 2D API（原生）+ OffscreenCanvas（精灵缓存）
- **音频处理**：Web Audio API（AudioContext + OfflineAudioContext）
- **持久化存储**：localStorage（元数据） + IndexedDB（二进制资源Blob）
- **开发规范**：ESLint + Prettier + Husky + lint-staged
- **CSS方案**：原生CSS变量 + CSS Modules（scoped），不引入Tailwind
- **图标方案**：内联SVG组件（src/components/icons/）

## 3. 路由定义

| 路由路径 | 页面组件 | 布局 | 说明 |
|---------|---------|-----|------|
| `/` | Redirect → `/projects` | - | 根路径重定向 |
| `/projects` | views/ProjectList.vue | 无（全屏） | 项目列表、新建/打开/删除 |
| `/projects/:projectId/sprites` | views/SpriteEditor.vue | AppLayout三栏 | 精灵图切割与帧标注 |
| `/projects/:projectId/animations` | views/AnimationEditor.vue | AppLayout三栏 | 动画编排与预览 |
| `/projects/:projectId/tilemaps` | views/TilemapEditor.vue | AppLayout三栏 | 瓦片地图编辑 |
| `/projects/:projectId/audio` | views/AudioManager.vue | AppLayout三栏 | 音效管理与挂载 |

## 4. 数据模型定义

### 4.1 ER 图

```mermaid
erDiagram
    PROJECT ||--o{ SPRITE_SHEET : "包含"
    PROJECT ||--o{ ANIMATION : "包含"
    PROJECT ||--o{ TILEMAP : "包含"
    PROJECT ||--o{ AUDIO_CLIP : "包含"
    PROJECT ||--o{ SNAPSHOT : "产生"
    SPRITE_SHEET ||--o{ SPRITE_FRAME : "切割出"
    ANIMATION ||--o{ ANIMATION_TRACK : "拥有"
    ANIMATION_TRACK ||--o{ ANIMATION_KEYFRAME : "包含"
    ANIMATION_KEYFRAME }o--|| SPRITE_FRAME : "引用"
    ANIMATION_KEYFRAME }o--o| AUDIO_CLIP : "触发"
    TILEMAP ||--o{ TILE_LAYER : "包含"
    TILE_LAYER ||--o{ TILE_CELL : "由...组成"
    TILE_CELL }o--|| SPRITE_FRAME : "引用瓦片"
    TILEMAP ||--o{ TRIGGER_ZONE : "标注"
    TRIGGER_ZONE }o--o| AUDIO_CLIP : "触发"

    PROJECT {
        string id PK
        string name
        string description
        number createdAt
        number updatedAt
    }

    SPRITE_SHEET {
        string id PK
        string projectId FK
        string name
        string imageDataUrl
        number width
        number height
        string cutMode
        object gridConfig
        object frames
    }

    SPRITE_FRAME {
        string id PK
        string sheetId FK
        string name
        number x
        number y
        number width
        number height
        object anchor
        object hitbox
        object triggerArea
    }

    ANIMATION {
        string id PK
        string projectId FK
        string name
        number loopCount
        number frameRate
    }

    ANIMATION_TRACK {
        string id PK
        string animId FK
        string name
        number zIndex
    }

    ANIMATION_KEYFRAME {
        string id PK
        string trackId FK
        string frameId FK
        number durationMs
        number offsetX
        number offsetY
        number rotation
        string eventType
        string audioClipId FK
    }

    TILEMAP {
        string id PK
        string projectId FK
        string name
        number cols
        number rows
        number tileWidth
        number tileHeight
    }

    TILE_LAYER {
        string id PK
        string tilemapId FK
        string name
        number zIndex
        boolean visible
        number cells
    }

    TRIGGER_ZONE {
        string id PK
        string tilemapId FK
        string type
        number x
        number y
        number w
        number h
        string audioClipId FK
    }

    AUDIO_CLIP {
        string id PK
        string projectId FK
        string name
        string type
        string audioDataUrl
        number duration
        number volume
        number fadeIn
        number fadeOut
        boolean loop
        number startTime
        number endTime
    }

    SNAPSHOT {
        string id PK
        string projectId FK
        string name
        number timestamp
        object payload
    }
```

## 5. 核心算法说明

### 5.1 精灵图切割算法（packer.ts）

```typescript
// 等分网格切割
function gridCut(img: HTMLImageElement, cols: number, rows: number): SpriteFrame[];

// 阈值轮廓检测切割（基于alpha通道连通域）
// 1. 遍历像素alpha > 阈值标记为前景
// 2. BFS搜索8邻域连通域得到每个精灵外接矩形
// 3. NMS合并重叠矩形，输出最终帧列表
function contourCut(img: HTMLImageElement, alphaThreshold: number, padding: number): SpriteFrame[];
```

### 5.2 快照差异对比算法（diff.ts）

```typescript
// 基于JSON深度递归对比，输出增删改节点列表
interface DiffNode { type: 'add'|'remove'|'update'; path: string[]; old?: any; new?: any; }
function diffSnapshots(oldSnap: Snapshot, newSnap: Snapshot): DiffNode[];
```

### 5.3 Canvas渲染优化策略

- **精灵画布**：OffscreenCanvas预缓存精灵表原图，切割线DOM overlay，缩放矩阵CSS transform实现，避免每帧重绘
- **动画播放器**：双缓冲（前后Canvas切换），requestAnimationFrame + performance.now()时间戳插值，帧资源预加载到ImageBitmap池
- **瓦片地图**：仅渲染视口可见区域（viewport culling），每层使用离屏Canvas缓存静态内容，改动时局部重绘

### 5.4 音频波形渲染优化

```typescript
// 1. OfflineAudioContext.decodeAudioData后台解码
// 2. 降采样：将原始PCM数据通过取峰值+RMS混合压缩至目标点数(2000点)
// 3. 分时绘制：requestIdleCallback分块绘制Canvas不阻塞UI
```

## 6. 导出 JSON 格式规范

```json
{
  "version": "1.0.0",
  "project": { "id": "...", "name": "..." },
  "spriteSheets": [{
    "id": "...", "name": "...",
    "image": "data:image/png;base64,...",
    "frames": [{
      "id": "...", "name": "idle_001",
      "rect": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "anchor": { "x": 32, "y": 48 },
      "hitbox": { "x": 8, "y": 8, "w": 48, "h": 56 }
    }]
  }],
  "animations": [{
    "id": "...", "name": "player_idle",
    "frameRate": 24, "loop": true,
    "tracks": [{
      "name": "body", "zIndex": 0,
      "keyframes": [{ "frameId": "...", "duration": 83, "offset": [0,0], "rotation": 0 }]
    }],
    "events": [{ "frame": 5, "type": "audio", "clipId": "..." }]
  }],
  "tilemaps": [{
    "id": "...", "name": "level_01",
    "size": { "cols": 128, "rows": 128, "tileW": 32, "tileH": 32 },
    "layers": [{ "name": "ground", "zIndex": 0, "data": "base64-rle-compressed-grid" }],
    "triggers": [{ "type": "audio", "rect": {...}, "clipId": "..." }]
  }],
  "audioClips": [{
    "id": "...", "name": "jump",
    "src": "data:audio/wav;base64,...",
    "volume": 0.8, "fadeIn": 0.01, "fadeOut": 0.05, "loop": false,
    "range": { "start": 0.2, "end": 0.8 }
  }],
  "manifest": { "spriteCount": 320, "animationCount": 45, "tilemapCount": 8, "audioCount": 36 }
}
```

## 7. 性能预算指标

| 指标项 | 目标值 | 测量方式 |
|-------|-------|---------|
| 精灵切割响应（4096²图） | <100ms | Performance.now()计时 |
| 动画预览帧率 | 稳定60fps | rAF回调计数器 |
| 256×256×8图层地图渲染 | ≥30fps | FPS面板实测 |
| 100MB音频波形渲染 | ≤3s | 解码+绘制总耗时 |
| 快照保存 | ≤2s | 序列化+IndexedDB写入 |
| 资源树1000节点展开/折叠 | 无感知卡顿（<16ms） | 虚拟滚动 Vue Virtual Scroller |
| 首屏加载（热启动） | <2s | Lighthouse Performance |
| 构建产物体积 | <500KB gzip | Vite build --report |

## 8. 目录结构

```
src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts
├── stores/
│   ├── project.ts
│   ├── sprite.ts
│   ├── animation.ts
│   ├── tilemap.ts
│   └── audio.ts
├── views/
│   ├── ProjectList.vue
│   ├── SpriteEditor.vue
│   ├── AnimationEditor.vue
│   ├── TilemapEditor.vue
│   └── AudioManager.vue
├── components/
│   ├── layout/
│   │   ├── AppLayout.vue
│   │   ├── TopToolbar.vue
│   │   ├── LeftResizer.vue
│   │   └── RightResizer.vue
│   ├── canvas/
│   │   ├── SpriteCanvas.vue
│   │   ├── AnimationPlayer.vue
│   │   └── TilemapEditor.vue
│   ├── common/
│   │   ├── ResourceTree.vue
│   │   ├── PropertyPanel.vue
│   │   ├── Timeline.vue
│   │   ├── WaveformViewer.vue
│   │   └── SnapshotDiff.vue
│   └── icons/
│       ├── IconProject.vue
│       └── ...
├── utils/
│   ├── packer.ts
│   ├── exporter.ts
│   ├── canvas-helper.ts
│   ├── audio-helper.ts
│   ├── diff.ts
│   ├── storage.ts
│   └── id.ts
├── types/
│   └── index.ts
└── styles/
    ├── variables.css
    ├── reset.css
    ├── layout.css
    └── components.css
```
