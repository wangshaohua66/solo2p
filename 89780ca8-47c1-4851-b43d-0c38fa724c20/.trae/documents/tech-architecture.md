## 1. 架构设计

```mermaid
graph TB
    subgraph Frontend["前端层"]
        Vue["Vue 3.4 + TypeScript 5.3"]
        Router["Vue Router"]
        Pinia["Pinia 状态管理"]
        WS_Client["WebSocket 客户端"]
    end

    subgraph Backend["后端层 - FastAPI 0.109"]
        API_Gateway["API 网关 / main.py"]
        Collection_Route["藏品路由 / collection.py"]
        Trade_Route["交易路由 / trade.py"]
        Copyright_Route["版权路由 / copyright.py"]
        Royalty_Route["版税路由 / royalty.py"]
        Risk_Route["风控路由 / risk.py"]
        Match_Engine["撮合引擎 / match_engine.py"]
        Chain_Adapter["链适配器 / chain_adapter.py"]
        Cache_Service["缓存服务 / cache_service.py"]
    end

    subgraph Data["数据层"]
        Redis["Redis 7.2"]
        SQLite["SQLite 主数据库"]
    end

    subgraph External["外部服务"]
        IPFS["IPFS 存储"]
        Ethereum["以太坊侧链"]
        AntChain["蚂蚁链"]
    end

    Vue --> API_Gateway
    WS_Client --> Trade_Route
    API_Gateway --> Collection_Route
    API_Gateway --> Trade_Route
    API_Gateway --> Copyright_Route
    API_Gateway --> Royalty_Route
    API_Gateway --> Risk_Route
    Trade_Route --> Match_Engine
    Copyright_Route --> Chain_Adapter
    Collection_Route --> Cache_Service
    Trade_Route --> Cache_Service
    Match_Engine --> Redis
    Cache_Service --> Redis
    Chain_Adapter --> Ethereum
    Chain_Adapter --> AntChain
    Collection_Route --> IPFS
    Collection_Route --> SQLite
    Trade_Route --> SQLite
    Copyright_Route --> SQLite
    Royalty_Route --> SQLite
    Risk_Route --> SQLite
```

## 2. 技术说明

- **前端**：Vue 3.4 + TypeScript 5.3 + Vite 5 + Pinia + Vue Router + TailwindCSS 3
- **初始化工具**：vite-init (vue-ts 模板)
- **后端**：Python 3.11 + FastAPI 0.109 + Uvicorn
- **数据库**：SQLite（主存储）+ Redis 7.2（缓存/消息队列/订单簿）
- **外部服务**：IPFS（媒体存储）、以太坊侧链 + 蚂蚁链（版权存证）

## 3. 路由定义

| 路由路径 | 用途 |
|----------|------|
| `/` | 藏品市场首页，瀑布流展示 |
| `/trade/:id` | 交易页面，订单簿+K线+下单 |
| `/assets` | 我的资产，持有藏品列表 |
| `/assets/:id` | 藏品详情与溯源 |
| `/creator` | 创作者中心首页 |
| `/creator/publish` | 发行向导（多步骤） |
| `/creator/management` | 发行管理 |
| `/creator/royalty` | 版税收益 |
| `/statistics` | 数据统计仪表盘 |
| `/risk` | 风控管理 |

## 4. API 定义

### 4.1 藏品管理 API

```typescript
interface Collection {
  id: string
  name: string
  description: string
  rarity: "common" | "rare" | "epic" | "legendary"
  limited_count: number
  minted_count: number
  token_id: string | null
  media_url: string
  ipfs_cid: string
  creator_id: string
  creator_name: string
  royalty_rate: number
  status: "draft" | "pending" | "reviewing" | "approved" | "rejected" | "minted"
  created_at: string
  updated_at: string
}

interface CollectionListResponse {
  items: Collection[]
  total: number
  page: number
  page_size: number
}

interface CollectionPublishRequest {
  name: string
  description: string
  rarity: string
  limited_count: number
  royalty_rate: number
  media_file: File
}
```

### 4.2 交易 API

```typescript
interface Order {
  id: string
  collection_id: string
  user_id: string
  side: "buy" | "sell"
  type: "limit" | "market"
  price: number
  quantity: number
  filled_quantity: number
  status: "open" | "partial" | "filled" | "cancelled"
  created_at: string
}

interface Trade {
  id: string
  collection_id: string
  buyer_id: string
  seller_id: string
  price: number
  quantity: number
  royalty_amount: number
  created_at: string
}

interface OrderBookSnapshot {
  collection_id: string
  bids: Array<{ price: number; quantity: number; order_count: number }>
  asks: Array<{ price: number; quantity: number; order_count: number }>
  last_price: number
  timestamp: string
}
```

### 4.3 版权存证 API

```typescript
interface CopyrightRecord {
  id: string
  collection_id: string
  token_id: string
  chain: "ethereum" | "antchain"
  tx_hash: string
  operation: "create" | "mint" | "transfer" | "burn"
  operator_signature: string
  data_hash: string
  timestamp: string
}

interface ProvenanceResponse {
  token_id: string
  records: CopyrightRecord[]
}
```

### 4.4 版税 API

```typescript
interface RoyaltyAccount {
  creator_id: string
  pending_amount: number
  settled_amount: number
  threshold: number
}

interface RoyaltySettlement {
  id: string
  creator_id: string
  trade_id: string
  amount: number
  status: "pending" | "settled"
  settled_at: string | null
}
```

### 4.5 风控 API

```typescript
interface RiskAlert {
  id: string
  user_id: string
  alert_type: "wash_trade" | "price_manipulation" | "volume_anomaly" | "correlated_accounts"
  severity: "low" | "medium" | "high"
  detail: string
  status: "active" | "frozen" | "resolved"
  created_at: string
}

interface RiskRule {
  id: string
  name: string
  description: string
  params: Record<string, number>
  enabled: boolean
}
```

## 5. 服务端架构图

```mermaid
graph LR
    subgraph Controllers["路由层"]
        C1["collection.py"]
        C2["trade.py"]
        C3["copyright.py"]
        C4["royalty.py"]
        C5["risk.py"]
    end

    subgraph Services["服务层"]
        S1["match_engine.py"]
        S2["chain_adapter.py"]
        S3["cache_service.py"]
        S4["royalty_service.py"]
        S5["risk_service.py"]
    end

    subgraph Repositories["数据层"]
        R1["SQLite ORM"]
        R2["Redis 客户端"]
    end

    C1 --> S3
    C2 --> S1
    C2 --> S3
    C3 --> S2
    C4 --> S4
    C5 --> S5
    S1 --> R2
    S3 --> R2
    S1 --> R1
    S2 --> R1
    S4 --> R1
    S5 --> R1
    S5 --> R2
```

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    COLLECTION ||--o{ ORDER : "has"
    COLLECTION ||--o{ TRADE : "has"
    COLLECTION ||--o{ COPYRIGHT_RECORD : "has"
    COLLECTION }o--|| CREATOR : "created_by"
    ORDER }o--|| USER : "placed_by"
    TRADE }o--|| USER : "buyer"
    TRADE }o--|| USER : "seller"
    TRADE ||--o{ ROYALTY_SETTLEMENT : "generates"
    USER ||--o{ ASSET : "owns"
    COLLECTION ||--o{ ASSET : "tokenized_as"
    USER ||--o{ RISK_ALERT : "triggered_by"

    COLLECTION {
        string id PK
        string name
        string description
        string rarity
        int limited_count
        int minted_count
        string token_id
        string media_url
        string ipfs_cid
        string creator_id FK
        float royalty_rate
        string status
        datetime created_at
    }

    ORDER {
        string id PK
        string collection_id FK
        string user_id FK
        string side
        string type
        float price
        int quantity
        int filled_quantity
        string status
        datetime created_at
    }

    TRADE {
        string id PK
        string collection_id FK
        string buyer_id FK
        string seller_id FK
        float price
        int quantity
        float royalty_amount
        datetime created_at
    }

    COPYRIGHT_RECORD {
        string id PK
        string collection_id FK
        string token_id
        string chain
        string tx_hash
        string operation
        string operator_signature
        string data_hash
        datetime timestamp
    }

    CREATOR {
        string id PK
        string name
        string type
        float pending_royalty
        float settled_royalty
    }

    USER {
        string id PK
        string name
        string email
        string role
        string status
    }

    ASSET {
        string id PK
        string user_id FK
        string collection_id FK
        string token_id
        datetime acquired_at
    }

    ROYALTY_SETTLEMENT {
        string id PK
        string creator_id FK
        string trade_id FK
        float amount
        string status
        datetime settled_at
    }

    RISK_ALERT {
        string id PK
        string user_id FK
        string alert_type
        string severity
        string detail
        string status
        datetime created_at
    }
```

### 6.2 数据定义语言

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'collector',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE creators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'individual',
    pending_royalty REAL NOT NULL DEFAULT 0,
    settled_royalty REAL NOT NULL DEFAULT 0,
    user_id TEXT REFERENCES users(id)
);

CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rarity TEXT NOT NULL,
    limited_count INTEGER NOT NULL,
    minted_count INTEGER NOT NULL DEFAULT 0,
    token_id TEXT,
    media_url TEXT,
    ipfs_cid TEXT,
    creator_id TEXT NOT NULL REFERENCES creators(id),
    royalty_rate REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    current_price REAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    side TEXT NOT NULL,
    type TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    filled_quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trades (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    buyer_id TEXT NOT NULL REFERENCES users(id),
    seller_id TEXT NOT NULL REFERENCES users(id),
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    royalty_amount REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE copyright_records (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    token_id TEXT,
    chain TEXT NOT NULL,
    tx_hash TEXT,
    operation TEXT NOT NULL,
    operator_signature TEXT,
    data_hash TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    collection_id TEXT NOT NULL REFERENCES collections(id),
    token_id TEXT,
    acquired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE royalty_settlements (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creators(id),
    trade_id TEXT NOT NULL REFERENCES trades(id),
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    settled_at DATETIME
);

CREATE TABLE risk_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    detail TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collections_status ON collections(status);
CREATE INDEX idx_orders_collection_status ON orders(collection_id, status);
CREATE INDEX idx_trades_collection ON trades(collection_id, created_at);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_risk_alerts_status ON risk_alerts(status, severity);
CREATE INDEX idx_copyright_collection ON copyright_records(collection_id, chain);
```

## 7. 性能架构说明

| 指标 | 目标 | 实现方案 |
|------|------|----------|
| API响应时间 | P99 < 200ms | Redis缓存热点数据，SQLite索引优化 |
| 撮合引擎吞吐量 | ≥5000 TPS | Redis Sorted Set实现订单簿，内存撮合 |
| 元数据缓存命中率 | ≥95% | Redis缓存藏品元数据，TTL 30分钟 |
| WebSocket并发 | ≥10000 | FastAPI WebSocket + Redis Pub/Sub |
| 版税批量结算 | 1000笔 < 30秒 | 批量SQL + Redis队列异步处理 |
| 日数据增量 | ≤50GB | 数据分区归档，日志轮转 |
| Redis内存 | ≤8GB | LRU淘汰策略，合理设置TTL |
