# Render worker — Node 20 + repo-local Remotion + system FFmpeg
#
# The worker renders the repo's Remotion composition, so the image contains
# BOTH the repo dependencies (npm ci at repo root) and the worker deps.
# Build context is the REPO ROOT:
#   docker build -f render-worker/Dockerfile -t render-worker .

FROM node:20-bookworm-slim AS production

WORKDIR /repo

# ---- system deps: ffmpeg, fonts, and the shared libs Chrome-headless needs ----
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      fontconfig \
      fonts-dejavu-core \
      ca-certificates \
      python3 make g++ \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libdbus-1-3 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# ---- repo dependencies (remotion + @remotion/cli live here) ----
COPY package.json package-lock.json ./
RUN npm ci

# ---- worker dependencies ----
COPY render-worker/package.json render-worker/package-lock.json* ./render-worker/
RUN cd render-worker && npm ci

# ---- worker source + build ----
COPY render-worker/tsconfig.json ./render-worker/
COPY render-worker/src ./render-worker/src
RUN cd render-worker && npm run build

# ---- sources the Remotion bundle needs (composition + studio schema) ----
COPY remotion.config.ts ./
COPY remotion ./remotion
COPY src ./src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./

# ---- pre-bake Chromium so the image boots without network ----
RUN ./node_modules/.bin/remotion browser ensure

ENV NODE_ENV=production
ENV PORT=3010
ENV REPO_ROOT=/repo
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3010)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "render-worker/dist/index.js"]
