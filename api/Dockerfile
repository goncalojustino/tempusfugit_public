FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile || pnpm install
# Include server entrypoint plus helper modules used by server.js
COPY server.js notify.js timezone.js ./
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","server.js"]
