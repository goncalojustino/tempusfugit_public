# web/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
# use npm by default; fallback if lock not present
RUN npm ci || npm install
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM alpine
RUN apk add --no-cache bash coreutils
# keep artifact in image at /site
COPY --from=build /app/dist /site
# when container runs, copy /site -> mounted /out
CMD bash -lc 'mkdir -p /out && cp -a /site/. /out/ && ls -lah /out'