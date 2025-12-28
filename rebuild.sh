#!/bin/bash
# rebuild.sh
docker compose up -d --build api webbuild caddy backup console
# do not touch service / container db (tempus_db); database