#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "破产案件监控 - 性能 Benchmark"
echo "目标: 验证 5000 条公告在 30 分钟内完成抓取"
echo "=========================================="

BINARY="./bankrupt-monitor"
CONFIG="./config.yaml"
RESULTS_DIR="./data/benchmark_results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$RESULTS_DIR/benchmark_$TIMESTAMP.md"

echo "开始时间: $(date)" | tee "$RESULT_FILE"
echo "==========================================" | tee -a "$RESULT_FILE"

echo "## 环境信息" | tee -a "$RESULT_FILE"
echo "- Go 版本: $(go version 2>/dev/null || echo 'N/A')" | tee -a "$RESULT_FILE"
echo "- OS: $(uname -a)" | tee -a "$RESULT_FILE"
echo "- CPU 核心数: $(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 'N/A')" | tee -a "$RESULT_FILE"
echo "- 内存总量: $(sysctl -n hw.memsize 2>/dev/null || free -h 2>/dev/null || echo 'N/A')" | tee -a "$RESULT_FILE"
echo "- Worker count: $(grep 'worker_count' $CONFIG 2>/dev/null | head -1 | awk '{print $2}' || echo 'N/A')" | tee -a "$RESULT_FILE"
echo "" | tee -a "$RESULT_FILE"

echo "## 测试 1: 编译速度" | tee -a "$RESULT_FILE"
echo "编译中..."
BUILD_START=$(date +%s)
go build -o /tmp/bankrupt-monitor-bench . 2>/dev/null
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
echo "- 编译耗时: ${BUILD_DURATION}s" | tee -a "$RESULT_FILE"
echo "" | tee -a "$RESULT_FILE"

echo "## 测试 2: 数据库查询性能 (模拟 5000 条数据)" | tee -a "$RESULT_FILE"
echo "运行查询基准测试..."
QUERY_START=$(date +%s)
for i in 1 2 3; do
    echo "  第 $i 轮查询..."
    if [ -f "./data/bankrupt.db" ]; then
        go test -run=^$ -bench=BenchmarkQuery -benchtime=3s ./internal/store/ 2>&1 | tee -a "$RESULT_FILE" || echo "  (无 benchmark 测试，跳过)"
    else
        echo "  数据库不存在，跳过"
        break
    fi
done
QUERY_END=$(date +%s)
QUERY_DURATION=$((QUERY_END - QUERY_START))
echo "- 查询测试耗时: ${QUERY_DURATION}s" | tee -a "$RESULT_FILE"
echo "" | tee -a "$RESULT_FILE"

echo "## 测试 3: 抓取吞吐量估算" | tee -a "$RESULT_FILE"
WORKER_COUNT=$(grep 'worker_count' $CONFIG 2>/dev/null | head -1 | awk '{print $2}' || echo '10')
REQUEST_DELAY_MIN=$(grep -A2 'request_delay' $CONFIG 2>/dev/null | tail -2 | head -1 | awk '{print $2}' | tr -d '- ')
REQUEST_DELAY_MAX=$(grep -A2 'request_delay' $CONFIG 2>/dev/null | tail -1 | awk '{print $2}')
AVG_DELAY=$(( (REQUEST_DELAY_MIN + REQUEST_DELAY_MAX) / 2 ))
echo "- Worker count: $WORKER_COUNT" | tee -a "$RESULT_FILE"
echo "- 平均请求延迟: ~${AVG_DELAY}ms" | tee -a "$RESULT_FILE"
REQUESTS_PER_SECOND=$(echo "scale=2; $WORKER_COUNT * 1000 / $AVG_DELAY" | bc 2>/dev/null || echo "N/A")
echo "- 理论最大 RPS: ${REQUESTS_PER_SECOND}/s" | tee -a "$RESULT_FILE"
TARGET_ANN=5000
TARGET_TIME=1800
REQUIRED_RPS=$(echo "scale=2; $TARGET_ANN / $TARGET_TIME" | bc 2>/dev/null || echo "2.78")
echo "- 5000 条/30 分钟所需 RPS: ${REQUIRED_RPS}/s" | tee -a "$RESULT_FILE"

if [ "$REQUESTS_PER_SECOND" != "N/A" ]; then
    RPS_OK=$(echo "$REQUESTS_PER_SECOND >= $REQUIRED_RPS" | bc 2>/dev/null || echo "1")
    if [ "$RPS_OK" -eq 1 ]; then
        echo "- 结论: ✅ 理论吞吐量满足需求" | tee -a "$RESULT_FILE"
    else
        echo "- 结论: ⚠️  理论吞吐量不足，建议增加 worker 或降低延迟" | tee -a "$RESULT_FILE"
    fi
fi
echo "" | tee -a "$RESULT_FILE"

echo "## 测试 4: 实际抓取测试 (可选，需联网)" | tee -a "$RESULT_FILE"
read -p "是否运行实际抓取测试? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "运行增量抓取测试 1 分钟..."
    CRAWL_START=$(date +%s)
    timeout 60 "$BINARY" collect --config "$CONFIG" 2>&1 | tee -a "$RESULT_FILE" || true
    CRAWL_END=$(date +%s)
    CRAWL_DURATION=$((CRAWL_END - CRAWL_START))
    echo "- 实际抓取耗时: ${CRAWL_DURATION}s" | tee -a "$RESULT_FILE"
fi
echo "" | tee -a "$RESULT_FILE"

echo "## 测试 5: 内存占用" | tee -a "$RESULT_FILE"
if [ -f "$BINARY" ]; then
    "$BINARY" serve --config "$CONFIG" --port 17890 > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 3
    MEM_USAGE=$(ps -o rss= -p $SERVER_PID 2>/dev/null || echo "N/A")
    if [ "$MEM_USAGE" != "N/A" ]; then
        MEM_MB=$((MEM_USAGE / 1024))
        echo "- 启动后内存占用: ~${MEM_MB} MB" | tee -a "$RESULT_FILE"
    fi
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
else
    echo "- 二进制不存在，跳过" | tee -a "$RESULT_FILE"
fi
echo "" | tee -a "$RESULT_FILE"

echo "==========================================" | tee -a "$RESULT_FILE"
echo "结束时间: $(date)" | tee -a "$RESULT_FILE"
echo "结果已保存: $RESULT_FILE"
echo "=========================================="
