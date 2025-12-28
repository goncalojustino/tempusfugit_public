# Tempusfugit Specification

## Overview
Tempusfugit is a full-stack reservation and resource-management platform tailored for instrument scheduling (e.g., an NMR facility). It provides:
- A REST API built with Fastify/Node.js for authentication, booking logic, pricing, approvals, notifications, and administration.
- A Vite/React single-page application for desktop and mobile users, plus a public "display" view for wall boards.
- Operational tooling: database schema migrations, automated backups, and a Fastify-based backup console UI.
- Docker-based deployment for reproducible builds across services (database, API, web build, reverse proxy, backup worker, admin console).

## Core Capabilities
### Authentication & Accounts
- Email + passcode login with PBKDF2 hashing, session tokens signed by `SESSION_SECRET`.
- Role model: `USER`, `STAFF`, `DANTE` (super admin). Role controls UI visibility and API authorization.
- Self-service registration and password reset flows, with staff approval pipeline.

### Resource Scheduling
- Resource definitions (`api.resources`) with visibility toggles and configurable advance booking windows.
- Slot templates per resource/day defined in `api/server.js` to enforce allowable start/end combinations (weekday vs weekend, overnight slots, etc.).
- Booking constraints enforced server-side: overlapping reservations, maintenance windows, caps, approvals, and cancellation cutoffs.
- Support for experiments, probes, training sessions, maintenance events, and pricing records.

### Notifications & Reporting
- SMTP-backed notification module (`api/notify.js`) for approvals, denials, broadcasts, error alerts, and contact form submissions.
- Admin broadcast log and reporting endpoints (lab vs client billing, CSV exports, timezone mismatch reporting, login event capture).

### Administration
- Admin panels ("Nine Circles") covering resource configuration, probe management, approvals, bulletin, user impersonation, error alert toggles, maintenance/training scheduling, pricing, labs, experiments, clients, and backup console link.
- Backup console service (Fastify) with Bearer-token auth to trigger code/database backups, download/delete snapshots, and inspect schedules.

### Deployment & Ops
- Docker Compose orchestrates Postgres, API, SPA build step, Caddy reverse proxy, backup cron container, console UI, and Adminer.
- Environment variables injected via `.env` (not committed) configure database URLs, secrets, SMTP credentials, allowed origins, and backup settings.
- `db/init` SQL files bootstrap schema and seed sample data (labs/resources/pricing/admin account).
- `ops/backup_service/backup.sh` performs code + database snapshots with retention policies; `ops/backup.sh` offers a lightweight alternative using `docker exec`.

## Key Directory Map
- `api/`: Fastify server, email, timezone helpers, Dockerfile, package definitions.
- `web/`: React SPA (desktop, mobile, display). `web/dist/` holds build artifacts when bundled.
- `db/init/`: Schema creation, stored procedures, and seeds.
- `ops/`: Backup scripts, console service, Dockerfiles; also contains restore helpers.
- `docs/`: Palette reference and (now) formal documentation (spec, admin guide, user guide).
- `docker-compose.yml`: Multi-service definition, volumes, env wiring.

## External Dependencies
- Node.js (Fastify, pg, nodemailer) for the API.
- React 18, React Router, Ant Design components for the front-end.
- Postgres 16 for persistence (schemas under `api.*`).
- Caddy 2 for serving the SPA + reverse proxying `/api` routes.

## Data Considerations
- Do not ship production data or secrets. `.env` contains placeholders; actual deployments must supply real credentials privately.
- Seed data is illustrative; adapt lab/resource names as appropriate.
- Backups write to host volumes (`/opt/tf-bak`)—ensure Git ignores these directories.

## Future Enhancements (Optional)
- Parameterize branding (logo, footer text) via env or database settings to avoid code edits per deployment.
- Provide sample `.env.example` and `.dockerignore` entries for common scenarios.
- Expand automated test coverage for booking edge cases and API regression detection.
