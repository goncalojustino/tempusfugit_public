# Tempusfugit User Guide

This guide targets end users booking instruments through the Tempusfugit web/mobile apps.

## 1. Accessing the App
- Visit the deployment URL supplied by your facility.
- Supported browsers: recent Chrome, Edge, Firefox, Safari.
- Mobile users can opt into the responsive `/mobile` experience (the login screen offers a toggle).

### Accounts & Login
1. Enter your registered email and passcode.
2. On successful login, the dashboard shows current status, bulletin entries, and shortcuts.
3. Sessions auto-expire after ~10 minutes of inactivity; sign back in to continue.
4. Forgot your passcode? Use the "Forgot passcode?" link to request a reset token, then set a new passcode via the emailed link.
5. Need access? Use "Request access" to submit email, name, and lab. Staff will review and follow up.

## 2. Home Dashboard
- **Bulletin**: displays staff announcements, timestamps, and resource highlights.
- **Resource cards**: one per instrument with status (OK/Limited/Down), notes, and booking shortcuts.
- **Current usage**: jump to the live display board showing the day's schedule per instrument.
- **Staff contacts**: click a name to prefill the contact form or send a general message to the team.

## 3. Booking Resources
Navigate to **Book** or use a resource shortcut.

### Grid Basics
- Weekly view (Monday–Sunday) aligned to Lisbon time; timezone mismatches trigger a warning banner.
- Slot colors differentiate available, pending, maintenance, and blocked segments.
- Use Week arrows or "Today" to navigate.

### Creating a Booking
1. Choose an instrument from the dropdown.
2. Select experiment and probe. Some probes may trigger extra approval steps (e.g., non-default probes on certain instruments).
3. Click an empty slot. The confirmation modal summarizes resource, experiment, probe, start/end, and pricing code (if applicable).
4. Provide optional notes/labels if enabled.
5. Submit. Success reloads the week; errors display readable text plus JSON details for staff debugging.

### Approval Workflow
- Certain experiments/probes require staff approval. These bookings enter `PENDING` state and are highlighted; you will receive an email when approved/denied.
- Pending requests count toward booking caps until resolved.

### Cancelling
- Use **My bookings** to cancel future reservations. Cutoffs vary by slot type (short slots: ~60 min before start; 24h slots: 12h; resource-specific rules apply). Pending cancellations may require staff review (`CANCEL_PENDING`).

## 4. My Bookings
- Table of recent reservations (approved, pending, canceled, cancel-pending).
- Sortable columns (resource, date, experiment, status, probe, bill-to info if applicable).
- Use the action column to cancel eligible bookings or export filtered data.

## 5. Account Settings
- Update passcode by providing current and new values (UI enforces complexity rules from the backend).
- View your role, lab, permissions (which instruments you're allowed to book), and login metadata.

## 6. Additional Tools
### Display Board
- `/display` shows a kiosk-friendly timeline per instrument with current/next bookings, probe indicators, and pending states. Refreshes automatically.

### Training & Maintenance
- Depending on role, you may view scheduled training sessions or maintenance windows to plan around downtime.

### Contacting Staff
- Available from the login screen, dashboard, and Nine Circles (for admins). Provide name, contact info, and message; you can optionally target a specific staff member.

## 7. Mobile Experience
- `/mobile` mirrors core functionality in a compact UI: login, home cards, booking grid, My bookings, admin subsets (for STAFF/DANTE).
- The mobile login banner reminds admins that full capabilities remain on desktop.
- Device preference is stored (`tf_view`) so returning users go straight to their chosen interface.

## 8. Notifications
- Emails are sent for: registration requests (user + staff copy), approvals/denials, cancellation actions, broadcast announcements, and password resets.
- Check spam folders if messages are missing; contact staff via the in-app form if necessary.

## 9. Tips & Best Practices
- Keep your browser clock/timezone accurate for smoother booking conversions.
- Book only within allowed windows. Attempting to go beyond the advance limit results in immediate API errors.
- Use labels to help staff distinguish maintenance vs. user bookings when available.
- Respect maintenance blocks—do not attempt to override them; contact staff if an urgent run is required.
- For multi-day planning, export bookings or leverage the Reports (if your role permits) to understand lab usage.

## 10. Getting Help
- Contact facility staff through the built-in forms.
- If you suspect an account/permission issue, mention your email and the exact error text.
- For technical glitches, note browser/OS information and approximate time to assist debugging via login/booking logs.
