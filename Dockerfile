# Investigation Board: build the pages, then run the API server that also serves them.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8787 CIB_DATA_DIR=/data CIB_DIST_DIR=/app/dist
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=build /app/dist /app/dist
RUN addgroup -S cib && adduser -S cib -G cib && mkdir -p /data && chown cib:cib /data
USER cib
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
