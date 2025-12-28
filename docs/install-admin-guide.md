# Tempusfugit Install & Admin Guide

## 1. Prerequisites
- Docker Engine + Docker Compose plugin (v2+) on the target host.
- Node.js/npm if you intend to build the React app outside Docker (optional).
- Access to an SMTP account for outbound notifications.
- TLS certificates handled by Caddy or external ingress (not covered here).

## 2. Repository Layout
Refer to `docs/specification.md` for component descriptions. Key paths:
- `.env` (not committed): secrets + environment variables.
- `docker-compose.yml`: orchestrates all services.
- `db/init/`: schema + seed SQL executed on first database start.
- `ops/`: operational scripts (backups, console, restore).
- `web/`: React SPA (desktop/mobile) + `web/dist/` build artifacts.

## 3. Configuration
1. Copy `.env` from the template below and fill real values:
   ```ini
   POSTGRES_PASSWORD=...
   DATABASE_URL=postgresql://tempus:...@db:5432/tempus
   SESSION_SECRET=...
   SMTP_HOST=...
   SMTP_PORT=...
   SMTP_SECURE=true
   SMTP_USER=...
   SMTP_PASS=...
   FROM_EMAIL=...
   PGPASSWORD=...
   ```
2. Update `docker-compose.yml` placeholders:
   - `ALLOWED_ORIGINS`: comma-separated scheme/host[:port] list allowed by CORS.
   - `PUBLIC_URL`: canonical HTTPS base used in notification links.
   - `ADMIN_EMAILS`: CSV list for broadcast/error alerts.
3. (Optional) Adjust timezone (`TZ`) and backup schedule in the `backup`/`console` service definitions.
4. Seed data (`db/init/003_seed.sql`) contains placeholder labs/resources; modify as needed *before* first database start. After initialization, manage labs/resources via the admin UI or SQL migrations.

## 4. Deployment
1. Build & start the stack:
   ```bash
   docker compose up -d --build
   ```
   This builds API + web images, runs Postgres migrations, and starts supporting services.
2. Watch logs for readiness:
   ```bash
   docker compose logs -f api caddy
   ```
3. Access the site via `PUBLIC_URL`. Initial admin credentials correspond to the seeded email in `003_seed.sql`; use the password reset flow to create a passcode.

### Redeploying Code Changes
- Front-end only: `docker compose build webbuild && docker compose up -d webbuild caddy`.
- API changes: `docker compose up -d --build api`.
- Confirm healthy containers with `docker compose ps`.

## 5. Backup & Restore
### Automated Backups
- `backup` service runs `/ops/backup_service/backup.sh` at the cron specified via `BACKUP_SCHEDULE`. Snapshots go to `/opt/tf-bak` (bind mount) under `code/` and `db/`.
- The `console` service exposes a web UI (default port 8081) for listing, downloading, deleting, or triggering on-demand backups. Restrict access (VPN/firewall) and protect with staff/DANTE credentials.

### Manual Backup Script
- `ops/backup.sh` performs a database-only dump via `docker exec`; outputs to `backups/` in the repo. Ensure this directory is Git-ignored.

### Restore
1. Copy the desired `.dump` file to the host.
2. Run `ops/restore.sh /path/to/file.dump` to stream into the Postgres container (service must be running).
3. Restart API (`docker compose restart api`) to clear connection state if necessary.

## 6. Admin Operations
- **User Management**: Admin UI → Users. Approve registrations, edit roles/labs, block/unblock. Impersonation tools (Nine Circles) let STAFF/DANTE troubleshoot user accounts.
- **Resources/Pricing/Experiments**: Manage via dedicated admin panels; changes persist in the database (details below under "New Facility Setup").
- **Maintenance & Training**: Schedule time blocks to block bookings using the admin modules.
- **Bulletin & Broadcasts**: Update announcement text, staff list, and send global emails. Configure default broadcast subject in Admin Broadcast or via backend settings.
- **Error Alerts**: Nine Circles → Booking error alerts to toggle SMTP notifications and recipients.
- **Logs**: Use `docker compose logs -f <service>` for runtime issues. API logs include structured error context.

### 6.1 New Facility Setup Checklist
When onboarding a completely new facility/center, walk through the following sequence:

1. **Labs/Groups**
   - Navigate to Admin → Labs.
   - Add each lab/group name that will appear in registrations and bookings.
   - Optionally set lab contact info for future billing exports.

2. **Resources (Instruments)**
   - Admin → Resources controls visibility, display name, daily slot colors, and booking window (`advance_days`).
   - For each instrument specify:
     - Friendly name (e.g., "NMR300").
     - Status (OK/Limited/Down) + optional note (appears on dashboard/display board).
     - Default probe and color theme.
   - Toggle visibility when ready for production; hidden resources stay out of user grids.

3. **Slot Templates & Rules**
   - Default templates live in `api/server.js` (the `buildResourceSlots` function). If your facility uses different day-part schedules, update that logic and redeploy.
   - Server-side constraints (advance limits, caps, maintenance guards, approval triggers) live in `db/init/V010_rules.sql` and related views. Adjust or extend the SQL if your policies differ (e.g., change cap hours, weekend rules, cancellation cutoffs), then run migrations.

4. **Probes**
   - Admin → Probes lists all probes per resource.
   - Define each probe’s code, description, whether it requires approval on certain instruments, and which resource it belongs to.
   - Set the default/active probe for each instrument; NMR500, for example, can display the active probe on the display board.

5. **Experiments & Pricing**
   - Admin → Experiments: add experiment codes, descriptions, approval requirements, and default probes.
   - Admin → Pricing: define rate codes, hourly rates, probe surcharges, and bill-to defaults (LAB vs CLIENT). These map directly to the `api.pricing` table used in billing exports.

6. **Training & Maintenance Defaults**
   - Admin → Training: configure templates for training blocks (resource, duration, required instructor).
   - Admin → Maintenance: define block labels (e.g., "Calibration", "Service Visit") and default colors for the grid.

7. **Bulletin & Staff Directory**
   - Admin → Bulletin: compose the home-page announcement, list staff contacts, and attach resource callouts. Encourage new facilities to include onboarding instructions here.

8. **Notifications & Broadcasts**
   - Nine Circles → Booking error alerts: enable/disable emails and pick recipient roles.
   - Admin → Broadcast: set a default subject prefix that reflects the facility (e.g., "FacilityName Update").

9. **Backups & Console Access**
   - Verify `BACKUP_SCHEDULE`, retention env vars, and console reachability.
   - Add STAFF/DANTE user emails to the `ADMIN_EMAILS` env var so they receive operational alerts.

Document each of these steps for the facility’s SOP so future admins know how to add new instruments or adjust policies.

## 7. Security Recommendations
- Keep `.env` outside version control (already in `.gitignore`).
- Rebuild `web/dist` after any text changes to avoid stale branding strings.
- Limit console/backup ports (8081) to trusted networks or behind VPN.
- Rotate `SESSION_SECRET`, SMTP credentials, and Postgres passwords regularly.
- Monitor backups for disk usage; adjust retention env variables if necessary (`CODE_RETENTION_DAYS`, `DB_RETENTION_DAYS`).

## 8. Troubleshooting
| Symptom | Check |
| --- | --- |
| API exits with "SESSION_SECRET env is required" | Ensure `.env` is loaded and referenced in Compose. |
| Front-end stuck loading | Confirm `web/dist` exists and Caddy sees built assets; rebuild `webbuild`. |
| Emails fail | Verify SMTP env vars, firewall access, and that `NOTIFY_ENABLED` is set appropriately. |
| Backup console cannot log in | Only STAFF/DANTE roles can access; ensure JWT token is valid and clock skew is reasonable. |
| Booking creation rejected | Inspect API response (UI shows JSON details) and admin Nine Circles logs; often due to caps or maintenance windows. |

## 9. Maintenance Checklist
- [ ] Keep dependencies updated (Node, React, Docker images).
- [ ] Periodically prune old backups and validate restore procedure.
- [ ] Review admin panels for stale labs/resources.
- [ ] Audit user roles and registration requests.
- [ ] Refresh documentation (`docs/`) when workflows change.
