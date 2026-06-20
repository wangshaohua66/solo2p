package com.insurance.claim.sharding;

import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.sql.Connection;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@Intercepts({@Signature(type = StatementHandler.class, method = "prepare",
        args = {Connection.class, Integer.class})})
public class TableShardingInterceptor implements Interceptor {

    @Value("${claim.sharding.enabled:true}")
    private boolean shardingEnabled;

    @Value("${claim.sharding.threshold:1000000}")
    private long shardingThreshold;

    @Value("${claim.sharding.table-count:16}")
    private int tableCount;

    private static final Pattern TABLE_NAME_PATTERN = Pattern.compile(
            "\\b(claim|survey|loss_assessment|payment)\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern SHARDABLE_PATTERN = Pattern.compile(
            "\\b(claim|survey|loss_assessment|payment)\\b", Pattern.CASE_INSENSITIVE);

    private final ConcurrentHashMap<String, Long> tableRowCountCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Boolean> shardingEnabledCache = new ConcurrentHashMap<>();

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        if (!shardingEnabled) {
            return invocation.proceed();
        }

        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        MetaObject metaObject = SystemMetaObject.forObject(statementHandler);

        MappedStatement mappedStatement = (MappedStatement) metaObject.getValue("delegate.mappedStatement");
        BoundSql boundSql = (BoundSql) metaObject.getValue("delegate.boundSql");

        String originalSql = boundSql.getSql();
        String shardedSql = applySharding(originalSql, mappedStatement, boundSql);

        if (!shardedSql.equals(originalSql)) {
            if (log.isDebugEnabled()) {
                log.debug("分表路由: {} -> {}", originalSql.substring(0, Math.min(100, originalSql.length())),
                        shardedSql.substring(0, Math.min(100, shardedSql.length())));
            }
            metaObject.setValue("delegate.boundSql.sql", shardedSql);
        }

        return invocation.proceed();
    }

    public String applySharding(String sql, MappedStatement mappedStatement, BoundSql boundSql) {
        if (!SHARDABLE_PATTERN.matcher(sql).find()) {
            return sql;
        }

        SqlCommandType commandType = mappedStatement != null ? mappedStatement.getSqlCommandType() : null;

        String result = sql;
        Matcher matcher = TABLE_NAME_PATTERN.matcher(sql);
        StringBuffer sb = new StringBuffer();

        while (matcher.find()) {
            String tableName = matcher.group(1).toLowerCase();
            String shardedTableName = resolveShardedTableName(tableName, commandType, boundSql, mappedStatement);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(shardedTableName));
        }
        matcher.appendTail(sb);
        result = sb.toString();

        return result;
    }

    private String resolveShardedTableName(String baseTableName, SqlCommandType commandType,
                                           BoundSql boundSql, MappedStatement mappedStatement) {
        boolean shouldShard = shouldEnableSharding(baseTableName);
        if (!shouldShard) {
            return baseTableName;
        }

        Long shardKey = extractShardKey(boundSql, mappedStatement, baseTableName);

        if (shardKey != null) {
            int tableIndex = computeTableIndex(shardKey);
            String sharded = baseTableName + "_" + String.format("%02d", tableIndex);
            log.debug("分表路由: {} -> {} (key={}, index={})", baseTableName, sharded, shardKey, tableIndex);
            return sharded;
        }

        if (commandType == SqlCommandType.INSERT) {
            long autoKey = System.currentTimeMillis() / 1000;
            int tableIndex = computeTableIndex(autoKey);
            String sharded = baseTableName + "_" + String.format("%02d", tableIndex);
            log.debug("插入自动分表: {} -> {} (autoKey={}, index={})", baseTableName, sharded, autoKey, tableIndex);
            return sharded;
        }

        log.debug("未找到分表键，使用主表查询（可能跨分表）: {}", baseTableName);
        return buildUnionAllView(baseTableName);
    }

    private boolean shouldEnableSharding(String tableName) {
        Boolean cached = shardingEnabledCache.get(tableName);
        if (cached != null) return cached;

        Long rowCount = tableRowCountCache.get(tableName);
        if (rowCount == null) {
            rowCount = estimateRowCount(tableName);
            tableRowCountCache.put(tableName, rowCount);
        }

        boolean enabled = rowCount >= shardingThreshold;
        shardingEnabledCache.put(tableName, enabled);

        log.info("分表状态检查: 表{} 估算行数={}, 阈值={}, 启用分表={}",
                tableName, rowCount, shardingThreshold, enabled);
        return enabled;
    }

    private Long extractShardKey(BoundSql boundSql, MappedStatement mappedStatement, String tableName) {
        if (boundSql == null || boundSql.getParameterObject() == null) {
            return null;
        }

        Object param = boundSql.getParameterObject();

        try {
            if (param instanceof java.util.Map) {
                java.util.Map<?, ?> paramMap = (java.util.Map<?, ?>) param;
                Object id = paramMap.get("id");
                if (id instanceof Number) return ((Number) id).longValue();

                Object claimId = paramMap.get("claimId");
                if (claimId instanceof Number) return ((Number) claimId).longValue();

                Object etlDate = paramMap.get("createdAt");
                if (etlDate != null) return null;
            }

            MetaObject metaObject = SystemMetaObject.forObject(param);
            if (metaObject.hasGetter("id")) {
                Object id = metaObject.getValue("id");
                if (id instanceof Number) return ((Number) id).longValue();
            }
            if (metaObject.hasGetter("claimId")) {
                Object claimId = metaObject.getValue("claimId");
                if (claimId instanceof Number) return ((Number) claimId).longValue();
            }
        } catch (Exception e) {
            log.trace("提取分表键失败，表={}: {}", tableName, e.getMessage());
        }

        return null;
    }

    private int computeTableIndex(Long shardKey) {
        if (shardKey == null) return 0;
        return Math.abs((int) (shardKey % tableCount));
    }

    private String buildUnionAllView(String baseTableName) {
        StringBuilder sb = new StringBuilder("(");
        for (int i = 0; i < tableCount; i++) {
            if (i > 0) sb.append(" UNION ALL ");
            sb.append("SELECT * FROM ").append(baseTableName).append("_").append(String.format("%02d", i));
        }
        sb.append(") ").append(baseTableName);
        return sb.toString();
    }

    private long estimateRowCount(String tableName) {
        long base = 500000L;
        switch (tableName) {
            case "claim": return base * 2;
            case "survey": return base;
            case "loss_assessment": return base * 3;
            case "payment": return base;
            default: return base;
        }
    }

    public void refreshTableStats(String tableName, long actualRowCount) {
        tableRowCountCache.put(tableName, actualRowCount);
        shardingEnabledCache.remove(tableName);
        log.info("刷新表统计: {}, 实际行数={}", tableName, actualRowCount);
    }

    public String getTableNameForId(String baseTableName, Long id) {
        boolean shouldShard = shouldEnableSharding(baseTableName);
        if (!shouldShard) return baseTableName;
        int tableIndex = computeTableIndex(id);
        return baseTableName + "_" + String.format("%02d", tableIndex);
    }

    @Override
    public Object plugin(Object target) {
        if (target instanceof StatementHandler) {
            return Plugin.wrap(target, this);
        }
        return target;
    }

    @Override
    public void setProperties(Properties properties) {
    }
}
