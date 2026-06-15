# 水务管网漏损监测与抢修指挥调度系统

## 项目概述

某市级水务集团管网漏损监测与抢修指挥调度系统，覆盖3200余公里供水管网、46座加压泵站及8座水厂的运行调度与应急抢修。

## 技术栈

### 后端
- .NET 8 / ASP.NET Core Web API
- Entity Framework Core 8.0 + MySQL 8.0
- SignalR (WebSocket 实时通信)
- 三层架构: Core / Infrastructure / API

### 前端
- Nuxt 3.14 + TypeScript 5.6
- Pinia 2.2 状态管理
- Vue Router 4
- MapLibre GL JS 地图组件
- @microsoft/signalr 实时通信客户端

## 项目结构

```
/
├── server/                          # 后端
│   ├── Core/                        # 核心领域层
│   │   ├── Entities/                # 数据实体
│   │   ├── Interfaces/              # 仓储接口
│   │   └── Services/                # 业务服务 (漏损定位/停水推演/调度)
│   ├── Infrastructure/              # 基础设施层
│   │   └── Data/                    # EF Core DbContext 与仓储实现
│   └── API/                         # 应用层
│       ├── Controllers/             # Web API 控制器
│       └── Hubs/                    # SignalR Hub
│
└── client/                          # 前端
    ├── assets/css/                  # 全局样式 (暗色主题)
    ├── components/                  # 可复用组件
    ├── layouts/                     # 全局布局
    ├── pages/                       # 页面路由
    │   ├── index.vue                # 主监控看板
    │   ├── leak/index.vue           # 漏损事件管理
    │   ├── repair/index.vue         # 工单调度面板
    │   └── inspection/index.vue     # 巡检任务管理
    ├── stores/                      # Pinia 状态管理
    ├── types/                       # TypeScript 类型定义
    └── utils/                       # 工具函数与 API 封装
```

## 核心功能

1. **实时压力监测** - SCADA 节点数据 WebSocket 秒级推送，地图色阶渲染压力分布
2. **漏损智能定位** - 基于压力梯度反演算法，定位误差 < 200m，概率热力图展示
3. **抢修工单全流程** - 六状态流转，超时自动升级告警，WebSocket 实时推送
4. **停水区域推演** - 管网拓扑 + 关阀方案自动计算影响范围与用户数
5. **抢修资源态势** - 抢修队位置/状态/工单实时展示，支持跨区调度
6. **管网健康评估** - 材质/埋深/管龄/维修频次综合评分，预防性维护建议
7. **巡检任务管理** - 按健康评分自动生成计划，移动端异常上报关联漏损事件

## 启动方式

### 后端 (端口 5000)
```bash
cd server/API
dotnet restore
dotnet run
```

### 前端 (端口 3000)
```bash
cd client
npm install
npm run dev
```

## 性能指标

| 指标 | 目标 |
|------|------|
| 压力数据推送延迟 | < 2s |
| 漏损定位算法响应 | < 5s |
| 停水推演计算 | < 3s |
| WebSocket 并发 | ≥ 200 |
| 抢修队位置更新 | 5s/次 |
| 首屏加载 | ≤ 1.8s |
