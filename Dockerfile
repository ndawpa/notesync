# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

LABEL org.opencontainers.image.title="NoteSync" \
      org.opencontainers.image.description="Treinamento vocal no navegador com avaliação de afinação e ritmo" \
      org.opencontainers.image.source="https://github.com/ndawpa/notesync"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

USER 101
CMD ["nginx", "-g", "daemon off;"]
