#!/bin/bash
set -e

echo "=================================================="
echo "  铁路集装箱跨系统自动化录入平台 - Docker 启动"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="

echo "[1/5] 配置中文字符集..."
export LANG=zh_CN.UTF-8
export LANGUAGE=zh_CN:zh
export LC_ALL=zh_CN.UTF-8
locale-gen zh_CN.UTF-8 >/dev/null 2>&1 || true
echo "      LANG=$LANG"

echo "[2/5] 启动 Xvfb 虚拟显示 ($DISPLAY)..."
if [ -n "$DISPLAY" ] && [ "$DISPLAY" = ":99" ]; then
    XVFB_W="${XVFB_W:-1920}"
    XVFB_H="${XVFB_H:-1080}"
    XVFB_D="${XVFB_D:-24}"
    echo "      分辨率: ${XVFB_W}x${XVFB_H}x${XVFB_D}"
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
    Xvfb "$DISPLAY" -screen 0 "${XVFB_W}x${XVFB_H}x${XVFB_D}" \
        -ac +extension RANDR +extension GLX \
        -nolisten tcp -nolisten unix &
    XVFB_PID=$!
    sleep 1
    if ! kill -0 "$XVFB_PID" 2>/dev/null; then
        echo "      警告: Xvfb 启动失败，尝试备用参数..."
        Xvfb "$DISPLAY" -screen 0 "1280x720x24" -ac &
        XVFB_PID=$!
        sleep 1
    fi
    export DISPLAY="$DISPLAY"
    echo "      Xvfb PID=$XVFB_PID"
else
    echo "      使用现有 DISPLAY=$DISPLAY"
fi

echo "[3/5] 验证 Tesseract OCR..."
if command -v tesseract >/dev/null 2>&1; then
    tesseract --version 2>&1 | head -n 1 || true
    echo "      语言包: $(tesseract --list-langs 2>/dev/null | tr '\n' ' ')"
else
    echo "      警告: tesseract 命令未找到"
fi

echo "[4/5] 检查模板文件..."
TEMPLATE_COUNT=$(find /app/templates -type f \( -name "*.png" -o -name "*.jpg" \) 2>/dev/null | wc -l)
echo "      templates/ 目录下有 $TEMPLATE_COUNT 个模板图片"
if [ "$TEMPLATE_COUNT" -eq 0 ]; then
    echo "      提示: 请将模板截图文件挂载到 /app/templates 目录"
fi

echo "[5/5] 准备运行参数..."
APP_CONFIG="${APP_CONFIG_PATH:-/app/config.yaml}"
export PYTHONPATH="/app:${PYTHONPATH}"

_setup_cleanup() {
    echo ""
    echo "收到停止信号，优雅关闭..."
    if [ -n "$XVFB_PID" ] && kill -0 "$XVFB_PID" 2>/dev/null; then
        kill -TERM "$XVFB_PID" 2>/dev/null || true
        wait "$XVFB_PID" 2>/dev/null || true
    fi
}
trap _setup_cleanup SIGINT SIGTERM SIGQUIT EXIT

echo ""
echo "=================================================="
echo "  命令: $*"
echo "=================================================="
echo ""

exec "$@"
