FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash tzdata postgresql-client tar zip

# Copy backup script (from ops/backup_service when build context is ./ops)
COPY backup_service/backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# App deps and files (from ops/console_service when build context is ./ops)
COPY console_service/package.json ./package.json
RUN npm install --production
COPY console_service/server.js ./server.js
COPY console_service/public ./public

ENV NODE_ENV=production
EXPOSE 8081

CMD ["node","server.js"]
