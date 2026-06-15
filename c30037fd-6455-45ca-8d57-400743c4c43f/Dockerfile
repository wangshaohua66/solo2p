# ============================================================
# 药品合规监控系统 - Dockerfile
# 基于 node:20-slim, 安装 Chrome 无头浏览器与 Xvfb
# ============================================================

# -------- 构建阶段 --------
FROM node:20-slim AS builder

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    curl \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 安装 Chrome (Selenium 4.18 / Chrome 122 兼容)
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    | tee /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends \
       google-chrome-stable=122.* 2>/dev/null || apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# 安装 Chromedriver
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
    && CHROME_VER=$(google-chrome --version | grep -oP '\d+\.\d+\.\d+') \
    && DRIVER_VER=$(curl -s https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VER%.*} 2>/dev/null || echo "122.0.6261.128") \
    && curl -sS -o /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${DRIVER_VER}/chromedriver_linux64.zip" \
    && unzip -o /tmp/chromedriver.zip chromedriver -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm /tmp/chromedriver.zip \
    && apt-get purge -y --auto-remove unzip \
    && rm -rf /var/lib/apt/lists/*

# 安装 Xvfb (虚拟显示服务)
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    dbus-x11 \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxtst6 \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcb-dri3-0 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖描述
COPY package*.json ./

# 安装生产依赖
RUN npm set progress=false \
    && npm config set depth 0 \
    && npm ci --production=false \
    && npm cache clean --force

# 复制源码
COPY . .

# 创建必要目录
RUN mkdir -p /app/logs /app/reports /app/config/cookies /tmp/downloads

# -------- 运行阶段 --------
FROM node:20-slim AS runtime

WORKDIR /app

# 从构建阶段复制系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    dbus-x11 \
    ca-certificates \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    libxss1 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxtst6 \
    libglib2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# 复制 Chrome 和 Chromedriver
COPY --from=builder /opt/google /opt/google
COPY --from=builder /usr/bin/google-chrome* /usr/bin/
COPY --from=builder /usr/local/bin/chromedriver /usr/local/bin/
RUN ln -sf /usr/bin/google-chrome /usr/bin/chromium-browser || true

# 复制应用
COPY --from=builder /app /app

# 创建入口脚本
RUN cat > /app/entrypoint.sh << 'ENTRY'
#!/bin/bash
set -e

# Xvfb 显示编号
export DISPLAY=:99
export CHROMEDRIVER_PATH=/usr/local/bin/chromedriver
export HEADLESS=${HEADLESS:-true}
export DBUS_SESSION_BUS_ADDRESS=/dev/null
export TZ=${TZ:-Asia/Shanghai}

echo "[entrypoint] 启动时间: $(date)"
echo "[entrypoint] HEADLESS=$HEADLESS DISPLAY=$DISPLAY TZ=$TZ"

# 清理可能存在的锁
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

# 启动 Xvfb 虚拟显示
echo "[entrypoint] 启动 Xvfb 虚拟显示..."
Xvfb :99 -screen 0 1920x1080x24 \
  -ac \
  -nolisten tcp \
  +extension RANDR \
  +render -noreset &
XVFB_PID=$!

# 等待 Xvfb 就绪
for i in $(seq 1 30); do
  if xdpyinfo -display :99 >/dev/null 2>&1; then
    echo "[entrypoint] Xvfb 就绪 (等待${i}次)"
    break
  fi
  sleep 0.2
done

# 启动 dbus (Chrome 需要)
dbus-launch > /dev/null 2>&1 || true

# 信号处理
cleanup() {
  echo "[entrypoint] 收到终止信号，关闭服务..."
  kill -TERM $APP_PID 2>/dev/null || true
  wait $APP_PID 2>/dev/null || true
  kill $XVFB_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# 启动采集引擎
echo "[entrypoint] 启动药品合规采集引擎..."
node src/launcher.js &
APP_PID=$!

# 健康检查循环
while kill -0 $APP_PID 2>/dev/null && kill -0 $XVFB_PID 2>/dev/null; do
  sleep 10
done

# 如果主进程意外退出
if kill -0 $APP_PID 2>/dev/null; then
  echo "[entrypoint] Xvfb 已退出，停止应用..."
  kill -TERM $APP_PID 2>/dev/null || true
else
  echo "[entrypoint] 应用已停止，清理 Xvfb..."
fi
kill $XVFB_PID 2>/dev/null || true
wait $APP_PID 2>/dev/null || true
EXIT_CODE=$?
echo "[entrypoint] 退出码: $EXIT_CODE"
exit $EXIT_CODE
ENTRY

RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/logs /app/reports /app/config/cookies /tmp/downloads \
    && chown -R node:node /app /tmp/downloads 2>/dev/null || true

# 环境变量
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV HEADLESS=true
ENV DISPLAY=:99
ENV CHROMEDRIVER_PATH=/usr/local/bin/chromedriver
ENV TZ=Asia/Shanghai
ENV MONGO_URI=mongodb://mongo:27017/drug_compliance
ENV REDIS_URI=redis://redis:6379
ENV ALLOW_NO_DB=false

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD ps aux | grep -v grep | grep -q "node src/launcher.js" && \
      ps aux | grep -v grep | grep -q "Xvfb" || exit 1

# 数据卷
VOLUME ["/app/config", "/app/logs", "/app/reports"]

# 工作用户
USER root

EXPOSE 9222

ENTRYPOINT ["/app/entrypoint.sh"]
