package db

import (
	"fmt"
	"hash/fnv"
	"strings"
)

const (
	DefaultShardCount   = 4
	DefaultTableShards  = 8
	ShardTablePrefix    = "clear_flow_"
	ShardResultPrefix   = "match_result_"
	ShardUnilateralPrefix = "unilateral_flow_"
)

type ShardingManager struct {
	ShardCount  int
	TableShards int
}

func NewShardingManager() *ShardingManager {
	return &ShardingManager{
		ShardCount:  DefaultShardCount,
		TableShards: DefaultTableShards,
	}
}

func hashString(s string) uint32 {
	h := fnv.New32a()
	h.Write([]byte(strings.ToLower(strings.TrimSpace(s))))
	return h.Sum32()
}

func (sm *ShardingManager) GetDBShard(instID string) int {
	if instID == "" {
		return 0
	}
	return int(hashString(instID)) % sm.ShardCount
}

func (sm *ShardingManager) GetTableShard(instID string) int {
	if instID == "" {
		return 0
	}
	return int(hashString(instID)) % sm.TableShards
}

func (sm *ShardingManager) GetFlowTableName(instID string) string {
	return fmt.Sprintf("%s%02d", ShardTablePrefix, sm.GetTableShard(instID))
}

func (sm *ShardingManager) GetResultTableName(instID string) string {
	return fmt.Sprintf("%s%02d", ShardResultPrefix, sm.GetTableShard(instID))
}

func (sm *ShardingManager) GetUnilateralTableName(instID string) string {
	return fmt.Sprintf("%s%02d", ShardUnilateralPrefix, sm.GetTableShard(instID))
}

func (sm *ShardingManager) GetDBFilePath(instID string, basePath string) string {
	shard := sm.GetDBShard(instID)
	ext := ".db"
	if idx := strings.LastIndex(basePath, ".db"); idx > 0 {
		base := basePath[:idx]
		ext = basePath[idx:]
		return fmt.Sprintf("%s_shard_%02d%s", base, shard, ext)
	}
	return fmt.Sprintf("%s_shard_%02d.db", basePath, shard)
}

func (sm *ShardingManager) AllFlowTableNames() []string {
	names := make([]string, sm.TableShards)
	for i := 0; i < sm.TableShards; i++ {
		names[i] = fmt.Sprintf("%s%02d", ShardTablePrefix, i)
	}
	return names
}

func (sm *ShardingManager) AllDBFilePaths(basePath string) []string {
	paths := make([]string, sm.ShardCount)
	for i := 0; i < sm.ShardCount; i++ {
		ext := ".db"
		if idx := strings.LastIndex(basePath, ".db"); idx > 0 {
			base := basePath[:idx]
			ext = basePath[idx:]
			paths[i] = fmt.Sprintf("%s_shard_%02d%s", base, i, ext)
		} else {
			paths[i] = fmt.Sprintf("%s_shard_%02d.db", basePath, i)
		}
	}
	return paths
}

func (sm *ShardingManager) GenerateShardDDL() string {
	var sb strings.Builder
	for i := 0; i < sm.TableShards; i++ {
		flowTbl := fmt.Sprintf("%s%02d", ShardTablePrefix, i)
		sb.WriteString(fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS %s (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	biz_no TEXT,
	biz_type TEXT,
	biz_date TEXT,
	src_inst_id TEXT,
	dst_inst_id TEXT,
	amount TEXT,
	currency TEXT,
	direction TEXT,
	payer_account TEXT,
	payer_name TEXT,
	payee_account TEXT,
	payee_name TEXT,
	summary TEXT,
	ref_no TEXT,
	status TEXT,
	source_file TEXT,
	line_no INTEGER,
	parse_time TEXT,
	raw_data TEXT,
	match_status TEXT,
	match_result_id INTEGER,
	abnormal_flag INTEGER DEFAULT 0,
	abnormal_reason TEXT,
	audit_trail TEXT
);
CREATE INDEX IF NOT EXISTS idx_%s_biz ON %s(biz_no, biz_date);
CREATE INDEX IF NOT EXISTS idx_%s_inst ON %s(src_inst_id, dst_inst_id);
`, flowTbl, flowTbl, flowTbl, flowTbl, flowTbl))

		resultTbl := fmt.Sprintf("%s%02d", ShardResultPrefix, i)
		sb.WriteString(fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS %s (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	biz_date TEXT,
	flow_id1 INTEGER,
	flow_id2 INTEGER,
	match_score INTEGER,
	match_fields TEXT,
	amount_diff TEXT,
	tolerance_used INTEGER,
	match_time TEXT,
	status TEXT,
	biz_type TEXT
);
CREATE INDEX IF NOT EXISTS idx_%s_date ON %s(biz_date);
`, resultTbl, resultTbl, resultTbl))

		unilateralTbl := fmt.Sprintf("%s%02d", ShardUnilateralPrefix, i)
		sb.WriteString(fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS %s (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	flow_id INTEGER,
	biz_date TEXT,
	inst_id TEXT,
	direction TEXT,
	pending_reason TEXT,
	status TEXT,
	pending_time TEXT,
	resolve_time TEXT
);
CREATE INDEX IF NOT EXISTS idx_%s_date ON %s(biz_date, inst_id);
`, unilateralTbl, unilateralTbl, unilateralTbl))
	}
	return sb.String()
}
