FROM mcr.microsoft.com/playwright:v1.48.0-jammy

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --production && \
    npx playwright install --with-deps chromium && \
    npm cache clean --force

COPY . .

RUN mkdir -p /app/db /app/evidence /app/reports

RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["node", "scraper/main.js"]
CMD ["schedule"]
