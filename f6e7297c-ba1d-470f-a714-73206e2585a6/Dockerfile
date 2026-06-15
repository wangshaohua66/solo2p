FROM python:3.11-slim

LABEL maintainer="Container Automation Platform"
LABEL description="铁路集装箱中心站跨系统自动化录入平台"
LABEL version="1.0.0"

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Shanghai \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DISPLAY=:99 \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-chi-sim \
        tesseract-ocr-eng \
        libglib2.0-0 \
        libsm6 \
        libxrender1 \
        libxext6 \
        libx11-6 \
        libxrandr2 \
        libxtst6 \
        libgtk-3-0 \
        libgdk-pixbuf2.0-0 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
        libdbus-1-3 \
        libnss3 \
        x11-utils \
        xauth \
        xvfb \
        scrot \
        wmctrl \
        xdotool \
        xclip \
        locales \
        fonts-wqy-microhei \
        fonts-wqy-zenhei \
        ttf-wqy-microhei \
        curl \
        ca-certificates \
    && echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen \
    && locale-gen zh_CN.UTF-8 \
    && update-locale LANG=zh_CN.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=zh_CN.UTF-8 \
    LANGUAGE=zh_CN:zh \
    LC_ALL=zh_CN.UTF-8

COPY requirements.txt /app/

RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install pyvirtualdisplay

COPY . /app/

RUN mkdir -p /app/logs /app/screenshots /app/templates /app/logs/dispatch /app/logs/customs

ENV APP_CONFIG_PATH=/app/config.yaml \
    APP_HEADLESS=true \
    APP_LOG_LEVEL=INFO

RUN chmod +x /app/docker-entrypoint.sh 2>/dev/null || true

EXPOSE 9222

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import os,sys; sys.exit(0 if os.path.exists('/app/logs') else 1)" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "-m", "src.main", "--config", "/app/config.yaml", "--headless", "--no-schedule"]
