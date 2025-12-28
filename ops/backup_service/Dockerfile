FROM alpine:3.20

RUN apk add --no-cache bash tzdata postgresql-client zip

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /entrypoint.sh
COPY crontab /etc/crontabs/root

RUN chmod +x /usr/local/bin/backup.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
