// api/server.js
import Fastify from 'fastify'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import pkg from 'pg'
const { Pool } = pkg
import { notifyPending, notifyApproved, notifyDenied, notifyBroadcastAll, notifyTest, notifyWelcome, notifyContact, notifyContactOne, notifyCanceled, notifyCancelRequested, notifyCancelApproved, notifyCancelDenied, notifyBookingErrorAlert } from './notify.js'
import { notifyReset, notifyRegistrationNew, notifyRegistrationCopy, notifyRegistrationApproved } from './notify.js'
import { lisbonDateTimeToInstant, instantToLisbonDateTime, lisbonMidnightInstant, shiftLisbonDateParts, getLisbonWeekdayIndex } from './timezone.js'

const PORT  = process.env.PORT || 4000
const DBURL = process.env.DATABASE_URL
if (!DBURL) { console.error('DATABASE_URL env is required'); process.exit(1) }
const SECRET = process.env.SESSION_SECRET
if (!SECRET) { console.error('SESSION_SECRET env is required'); process.exit(1) }

const app  = Fastify({ logger: true }) // NOSONAR
const pool = new Pool({ connectionString: DBURL })
const q = (text, params=[]) => pool.query(text, params)

const VALID_ROLES = ['USER','STAFF','DANTE']
const normalizeRole = (role) => {
  const upper = String(role || '').trim().toUpperCase()
  return VALID_ROLES.includes(upper) ? upper : 'USER'
}

function buildResourceSlots(resource, dayInstant){
  const slots = []
  const dayParts = instantToLisbonDateTime(dayInstant)
  const weekday = getLisbonWeekdayIndex(dayInstant)

  const addSlot = (start, end, label) => slots.push({ start, end, label })

  const pushSeries = (h1, m1, h2, m2, label, stepMinutes) => {
    let cursor = lisbonDateTimeToInstant({ ...dayParts, hour: h1, minute: m1, second: 0 })
    let limit = lisbonDateTimeToInstant({ ...dayParts, hour: h2, minute: m2, second: 0 })
    if (h2 < h1 || (h2 === h1 && m2 < m1)){
      const nextDay = shiftLisbonDateParts(dayParts, 1)
      limit = lisbonDateTimeToInstant({ ...nextDay, hour: h2, minute: m2, second: 0 })
    }
    while (cursor < limit){
      const slotEnd = new Date(cursor.getTime() + stepMinutes * 60000)
      addSlot(cursor, slotEnd, label)
      cursor = slotEnd
    }
  }

  if (weekday === 6 || weekday === 0){
    const start = lisbonDateTimeToInstant({ ...dayParts, hour: 8, minute: 0, second: 0 })
    const nextDay = shiftLisbonDateParts(dayParts, 1)
    const end = lisbonDateTimeToInstant({ ...nextDay, hour: 8, minute: 0, second: 0 })
    addSlot(start, end, '24h')
    return slots
  }

  if (resource === 'NMR300'){
    pushSeries(8, 0, 14, 0, '30m', 30)
    pushSeries(14, 0, 20, 0, '3h', 180)
    const start = lisbonDateTimeToInstant({ ...dayParts, hour: 20, minute: 0, second: 0 })
    const nextDay = shiftLisbonDateParts(dayParts, 1)
    const end = lisbonDateTimeToInstant({ ...nextDay, hour: 8, minute: 0, second: 0 })
    addSlot(start, end, '12h')
  } else if (resource === 'NMR400'){
    pushSeries(8, 0, 11, 0, '3h', 180)
    pushSeries(11, 0, 14, 0, '30m', 30)
    pushSeries(14, 0, 20, 0, '3h', 180)
    const start = lisbonDateTimeToInstant({ ...dayParts, hour: 20, minute: 0, second: 0 })
    const nextDay = shiftLisbonDateParts(dayParts, 1)
    const end = lisbonDateTimeToInstant({ ...nextDay, hour: 8, minute: 0, second: 0 })
    addSlot(start, end, '12h')
  } else if (resource === 'NMR500'){
    pushSeries(8, 0, 20, 0, '3h', 180)
    const start = lisbonDateTimeToInstant({ ...dayParts, hour: 20, minute: 0, second: 0 })
    const nextDay = shiftLisbonDateParts(dayParts, 1)
    const end = lisbonDateTimeToInstant({ ...nextDay, hour: 8, minute: 0, second: 0 })
    addSlot(start, end, '12h')
  }

  return slots
}

function slotMatchesTemplate(resource, startInstant, endInstant){
  const dayStart = lisbonMidnightInstant(startInstant)
  const slots = buildResourceSlots(resource, dayStart)
  return slots.find(slot => slot.start.getTime() === startInstant.getTime() && slot.end.getTime() === endInstant.getTime()) || null
}

// Unified error sender with structured context
function sendError(reply, code, message, context={}){
  const body = { error: message||String(code||'ERROR'), code: code||'ERR_UNKNOWN' }
  if (context && typeof context === 'object') body.context = context
  return reply.code(400).send(body)
}

function clientIp(req){
  try{
    return String((req.headers['x-forwarded-for']||'').toString().split(',')[0].trim() || req.ip || '')
  }catch(_){ return '' }
}

// ---- Stronger passcode hashing & policy
const PASS_ITERS = 150000
function randomHex(bytes){ return crypto.randomBytes(bytes).toString('hex') }
function hashPBKDF2(pass, saltHex, iters=PASS_ITERS){
  const salt = Buffer.from(String(saltHex||''), 'hex')
  const dk = crypto.pbkdf2Sync(String(pass), salt, Number(iters||PASS_ITERS), 32, 'sha256')
  return dk.toString('hex')
}
function createPassRecord(pass){
  const salt = randomHex(16)
  const hash = hashPBKDF2(pass, salt, PASS_ITERS)
  return { salt, passcode_hash: hash, passcode_algo: 'pbkdf2-sha256', passcode_iters: PASS_ITERS }
}
function ensureUserPassColumns(){
  return Promise.all([
    q("alter table if exists api.users add column if not exists passcode_algo text not null default 'sha256'"),
    q("alter table if exists api.users add column if not exists passcode_iters int not null default 1")
  ]).catch(()=>{})
}
function validatePasscodeStrength(pass, email=''){
  const p = String(pass||'')
  if (p.length < 12) return { ok:false, error:'PASS TOO SHORT', code:'ERR_PASS_TOO_SHORT' }
  if (p.length > 256) return { ok:false, error:'PASS TOO LONG', code:'ERR_PASS_TOO_LONG' }
  const hasLower = /[a-z]/.test(p)
  const hasUpper = /[A-Z]/.test(p)
  const hasDigit = /\d/.test(p)
  const hasSymbol = /[^A-Za-z0-9]/.test(p)
  if(!(hasLower && hasUpper && hasDigit && hasSymbol)) return { ok:false, error:'WEAK PASS', code:'ERR_PASS_WEAK' }
  const e = String(email||'').toLowerCase()
  if (e && p.toLowerCase().includes(e)) return { ok:false, error:'PASS CONTAINS EMAIL', code:'ERR_PASS_CONTAINS_EMAIL' }
  return { ok:true }
}

// ---- Blocked users (best-effort table + helpers)
async function ensureAuditIpColumn(){
  try{ await q("alter table if exists api.audit add column if not exists ip text") }catch(e){ app.log.warn({ err:String(e?.message||e) }, 'ensureAuditIpColumn failed') }
}

async function ensureResOverlapConstraint(){
  try{
    await q("alter table if exists api.reservations drop constraint if exists res_overlap_excl")
  }catch(e){ app.log.warn({ err:String(e?.message||e) }, 'ensureResOverlapConstraint drop failed') }
  try{
    await q("alter table if exists api.reservations add constraint res_overlap_excl exclude using gist (resource with =, tstzrange(start_ts,end_ts,'[)') with &&) where (status in ('APPROVED','PENDING','CANCEL_PENDING'))")
  }catch(e){ app.log.warn({ err:String(e?.message||e) }, 'ensureResOverlapConstraint add failed') }
}

async function ensureReservationStatusCheck(){
  try{ await q("alter table if exists api.reservations drop constraint if exists reservations_status_check") }catch(e){ app.log.warn({ err:String(e?.message||e) }, 'ensureReservationStatusCheck drop failed') }
  try{ await q("alter table if exists api.reservations add constraint reservations_status_check check (status in ('APPROVED','CANCELED','PENDING','CANCEL_PENDING'))") }catch(e){ app.log.warn({ err:String(e?.message||e) }, 'ensureReservationStatusCheck add failed') }
}

async function ensureResetTable(){
  try{
    await q(`create table if not exists api.pass_reset_tokens(email citext primary key, token text not null, expires timestamptz not null, created_at timestamptz default now())`)
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'reset tokens ensure failed') }catch(_){} }
}

async function ensureBlockedTable(){
  try{
    await q(`
      create table if not exists api.blocked_users(
        email citext primary key,
        until timestamptz,
        reason text,
        created_at timestamptz default now()
      )`)
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'blocked_users ensure failed') }catch(_){} }
}

// ---- Login event capture (best-effort)
async function ensureLoginEventsTable(){
  try{
    await q(`
      create table if not exists api.login_events(
        id bigserial primary key,
        email citext not null,
        created_at timestamptz not null default now(),
        ip text,
        user_agent text,
        accept_language text,
        tz_offset_minutes int,
        tz_name text,
        client_time_iso text,
        payload jsonb default '{}'
      )`)
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'login_events ensure failed') }catch(_){} }
  try{
    await q("create index if not exists idx_login_events_email on api.login_events (lower(email))")
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'login_events index ensure failed') }catch(_){} }
}

async function ensureTrainingWindowsTable(){
  try{
    await q(`
      create table if not exists api.training_windows(
        id serial primary key,
        resource text not null references api.resources(name) on delete cascade,
        start_ts timestamptz not null,
        end_ts timestamptz not null,
        reason text not null default ''
      )`)
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'training_windows ensure failed') }catch(_){} }
  try{
    await q("create index if not exists idx_training_res on api.training_windows(resource,start_ts)")
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'training_windows index ensure failed') }catch(_){} }
}

async function isEmailBlocked(email){
  try{
    const { rows } = await q("select until from api.blocked_users where lower(email)=lower($1)",[email])
    if(!rows.length) return false
    const u = rows[0].until ? new Date(rows[0].until) : null
    return !u || u > new Date()
  }catch{ return false }
}

// ---- Settings and registration requests (best-effort)
async function ensureSettingsAndRegistration(){
  try{
    await q(`create table if not exists api.settings(key citext primary key, value text)`)
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'settings ensure failed') }catch(_){} }
  try{
    await q(`
      create table if not exists api.registration_requests(
        email citext primary key,
        name text,
        lab text,
        created_at timestamptz default now()
      )`)
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'registration_requests ensure failed') }catch(_){} }
}

// New tables for debug logging
async function ensureDebugLogTables(){
  try{
    // Table to list users for whom debug logging is active
    await q(`
      create table if not exists api.debug_users(
        email citext primary key,
        added_by citext,
        expires_at timestamptz,
        created_at timestamptz default now()
      )`);
    
    // Table to store the detailed logs
    await q(`
      create table if not exists api.debug_logs(
        id bigserial primary key,
        user_email citext not null,
        log_ts timestamptz not null default now(),
        ip text,
        user_agent text,
        action text,
        method text,
        path text,
        request_payload jsonb,
        response_payload jsonb,
        status_code int
      )`);
    await q("create index if not exists idx_debug_logs_user_email on api.debug_logs (user_email, log_ts desc)");
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'debug_logs ensure failed') }catch(_){} }
}
const getStaffEmails = async ()=>{
  try{ await q("alter table if exists api.users add column if not exists receive_mail boolean not null default true") }catch(_){ }
  const { rows } = await q("select email from api.users where role in ('STAFF','DANTE') and coalesce(receive_mail,true)=true order by email")
  return rows.map(r=>r.email)
}


const BOOKING_ERROR_KEY_ENABLED = 'booking_error_mail_enabled'
const BOOKING_ERROR_KEY_ROLES = 'booking_error_mail_roles'
const BOOKING_ERROR_KEY_SUBJECT = 'booking_error_mail_subject'
const BOOKING_ERROR_ALLOWED_ROLES = ['STAFF','DANTE']

async function getBookingErrorAlertSettings() {
  await ensureSettingsAndRegistration()
  let enabled = false
  let roles = []
  let subjectPrefix = 'tempusfugit UX error |'
  try {
    const { rows } = await q("select key, value from api.settings where key in ($1,$2,$3)", [BOOKING_ERROR_KEY_ENABLED, BOOKING_ERROR_KEY_ROLES, BOOKING_ERROR_KEY_SUBJECT])
    for (const row of rows) {
      if (row.key === BOOKING_ERROR_KEY_ENABLED) {
        enabled = /^(1|true|yes)$/i.test(String(row.value || ''))
      } else if (row.key === BOOKING_ERROR_KEY_ROLES) {
        roles = String(row.value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      } else if (row.key === BOOKING_ERROR_KEY_SUBJECT) {
        const val = String(row.value || '').trim()
        if (val) subjectPrefix = val
      }
    }
  } catch (_){ }
  roles = [...new Set(roles.filter(r => BOOKING_ERROR_ALLOWED_ROLES.includes(r)))]
  if (!subjectPrefix) subjectPrefix = 'tempusfugit UX error |'
  return { enabled, roles, subjectPrefix }
}

async function saveBookingErrorAlertSettings(enabled, roles, subjectPrefix){
  await ensureSettingsAndRegistration()
  const flag = enabled ? '1' : '0'
  const list = roles.filter(r => BOOKING_ERROR_ALLOWED_ROLES.includes(String(r || '').toUpperCase())).map(r => r.toUpperCase())
  const prefix = String(subjectPrefix || '').trim() || 'tempusfugit UX error |'
  await q("insert into api.settings(key,value) values($1,$2) on conflict(key) do update set value=excluded.value", [BOOKING_ERROR_KEY_ENABLED, flag])
  await q("insert into api.settings(key,value) values($1,$2) on conflict(key) do update set value=excluded.value", [BOOKING_ERROR_KEY_ROLES, list.join(',')])
  await q("insert into api.settings(key,value) values($1,$2) on conflict(key) do update set value=excluded.value", [BOOKING_ERROR_KEY_SUBJECT, prefix])
  return { enabled, roles: list, subjectPrefix: prefix }
}

async function resolveBookingErrorRecipients(){
  const settings = await getBookingErrorAlertSettings()
  if(!settings.enabled || settings.roles.length===0) return { settings, recipients: [] }
  try{ await q("alter table if exists api.users add column if not exists receive_mail boolean not null default true") }catch(_){ }
  let recipients = []
  try{
    const { rows } = await q("select email, role from api.users where role = any($1::text[]) and coalesce(receive_mail,true)=true order by role desc, email", [settings.roles])
    recipients = rows
  }catch(_){ }
  return { settings, recipients }
}

async function maybeSendBookingErrorAlert(payload){
  try{
    const { settings, recipients } = await resolveBookingErrorRecipients()
    if(!settings.enabled || recipients.length===0) return
    const emails = recipients.map(r=>r.email)
    await notifyBookingErrorAlert(emails, { ...payload, recipients, subjectPrefix: settings.subjectPrefix || 'tempusfugit UX error |' })
  }catch(err){
    try{ app.log.error({ err:String(err?.message||err) }, 'booking error alert failed') }catch(_){ }
  }
}

const getStaffList = async ()=>{
  const { rows } = await q("select email, coalesce(nullif(name,''),email) as name, coalesce(lab,'') as lab, role from api.users where role in ('STAFF','DANTE') order by role desc, name, email")
  return rows
}

// CORS (tighten via env ALLOWED_ORIGINS="http://localhost:8082,https://your.domain")
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',').map(s=>s.trim()).filter(Boolean)
const PUBLIC_URL = process.env.PUBLIC_URL || (ORIGINS.find(o=>o!=='*') || 'http://localhost:8082')
const pickOrigin = (incoming)=> {
  if (ORIGINS.includes('*')) return '*'
  if (!incoming) return ''
  return ORIGINS.includes(incoming) ? incoming : ''
}
app.addHook('onRequest', async (req, reply) => {
  // IP block (both auth/unauth)
  try{
    const ip = String((req.headers['x-forwarded-for']||'').toString().split(',')[0].trim() || req.ip || '')
    await q(`create table if not exists api.blocked_ips(ip cidr primary key, reason text, created_at timestamptz default now())`)
    if(ip){
      const { rows: ipr } = await q(`select 1 from api.blocked_ips where $1::inet <<= ip`, [ip])
      if(ipr.length) return reply.code(403).send({ error:'IP_BLOCKED' })
    }
  }catch(_){ }
  const origin = pickOrigin(req.headers.origin)
  if (origin) reply.header('Access-Control-Allow-Origin', origin)
  reply.header('Vary','Origin')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Email')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return reply.code(204).send()
})

// --- Debug Logging Hooks and Helpers

// A cache for users being debugged to avoid hitting the DB on every request.
const debugUserCache = new Map();
const DEBUG_CACHE_TTL = 60 * 1000; // 1 minute

async function isUserBeingDebugged(email) {
  const lowerEmail = String(email || '').toLowerCase();
  if (!lowerEmail) return false;

  if (debugUserCache.has(lowerEmail) && debugUserCache.get(lowerEmail).ts > Date.now()) {
    return debugUserCache.get(lowerEmail).is_debugging;
  }

  const { rows } = await q("select 1 from api.debug_users where email = $1 and (expires_at is null or expires_at > now())", [lowerEmail]);
  const is_debugging = rows.length > 0;
  debugUserCache.set(lowerEmail, { is_debugging, ts: Date.now() + DEBUG_CACHE_TTL });
  return is_debugging;
}

// This hook stashes the response payload so the onResponse hook can access it for logging.
app.addHook('preSerialization', (request, reply, payload, done) => {
  reply.raw.tempus_payload = payload; // Stash it on the raw response object
  done(null, payload);
});

// This hook logs the request/response details for users being debugged.
app.addHook('onResponse', async (req, reply) => {
  if (!req.user || !req.user.email) {
    return;
  }

  const should_log = await isUserBeingDebugged(req.user.email);
  if (!should_log) {
    return;
  }

  const sanitizePayload = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;
    const newPayload = { ...payload };
    const sensitiveKeys = ['passcode', 'password', 'current', 'next', 'token', 'data']; // 'data' for logo uploads
    for (const key of sensitiveKeys) {
      if (newPayload[key]) {
        if (typeof newPayload[key] === 'string' && newPayload[key].length > 50) {
            newPayload[key] = `***REDACTED (length: ${newPayload[key].length})***`;
        } else {
            newPayload[key] = '***REDACTED***';
        }
      }
    }
    return newPayload;
  };

  const request_payload = sanitizePayload(req.body);
  const response_payload = sanitizePayload(reply.raw.tempus_payload);

  try {
    await q(
      `insert into api.debug_logs(user_email, ip, user_agent, action, method, path, request_payload, response_payload, status_code)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ req.user.email, clientIp(req), req.headers['user-agent'] || '', req.routerPath || req.raw.url.split('?')[0], req.method, req.raw.url, request_payload ? JSON.stringify(request_payload) : null, response_payload ? JSON.stringify(response_payload) : null, reply.statusCode ]
    );
  } catch (e) {
    app.log.error({ err: e }, 'Failed to write to debug_logs');
  }
});

// auth helpers
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex')
const makeToken = (email, role, expSec=86400, extra={}) => {
  const exp = Math.floor(Date.now()/1000)+expSec
  const normalizedRole = normalizeRole(role)
  const body = JSON.stringify({email, role: normalizedRole, exp, ...extra})
  const sig  = sign(body)
  return Buffer.from(body).toString('base64') + '.' + sig
}
const parseToken = (tok) => {
  if(!tok) return null
  const [b64,sig] = String(tok).split('.')
  const body = Buffer.from(b64,'base64').toString()
  if (sign(body)!==sig) return null
  const obj = JSON.parse(body)
  if (obj.exp < Math.floor(Date.now()/1000)) return null
  return obj
}
const requireAuth = async (req, reply) => {
  const tok = req.headers['authorization']?.replace(/^Bearer /,'')
  const obj = parseToken(tok)
  if(!obj) return reply.code(401).send({error:'UNAUTHORIZED'})
  // If blocked, deny all authenticated access
  try{ if(await isEmailBlocked(obj.email)) return reply.code(403).send({ error:'BLOCKED', code:'BLOCKED' }) }catch(_){ }
  const normalizedRole = normalizeRole(obj.role)
  req.user = { ...obj, role: normalizedRole }
  if(obj.impersonator){
    req.user.impersonator = String(obj.impersonator)
  }
  req.user.actor = req.user.impersonator || req.user.email
}
const requireAdmin = async (req, reply) => {
  await requireAuth(req, reply)
  if (reply.sent) return
  const role = normalizeRole(req.user.role)
  req.user.role = role
  if(!['STAFF','DANTE'].includes(role)) return reply.code(403).send({error:'FORBIDDEN'})
}
const requireDante = async (req, reply) => {
  await requireAuth(req, reply)
  if (reply.sent) return
  const role = normalizeRole(req.user.role)
  req.user.role = role
  if(role !== 'DANTE') return reply.code(403).send({error:'FORBIDDEN'})
}

const normalizeEmail = (email) => String(email||'').trim().toLowerCase()
const roleError = (message) => {
  const err = new Error(message)
  err.httpStatus = 403
  err.clientMessage = message
  return err
}
const ensureRoleChangeAllowed = (actor, targetEmail, desiredRole, currentRole='USER') => {
  const actorRole = normalizeRole(actor?.role)
  const actorEmail = normalizeEmail(actor?.email)
  const target = normalizeEmail(targetEmail)
  const newRole = normalizeRole(desiredRole)
  const existingRole = normalizeRole(currentRole)

  if (actorRole === 'USER' && actorEmail && actorEmail === target && newRole !== existingRole) {
    throw roleError('USERS CANNOT CHANGE THEIR OWN ROLE')
  }

  if (newRole === 'DANTE' && actorRole !== 'DANTE') {
    throw roleError('ONLY DANTE CAN ASSIGN DANTE ROLE')
  }

  return newRole
}


// health
app.get('/ping', async () => {
  const { rows } = await q('select now() as ts'); return { pong: rows[0].ts }
})

// ---- Public: registration + reset flows
app.post('/public/register_request', async (req, reply)=>{
  const b=req.body||{}; const email=String(b.email||'').trim().toLowerCase(); const name=String(b.name||'').trim(); const lab=String(b.lab||'').trim()
  if(!email || !name || !lab) return reply.code(400).send({error:'MISSING FIELDS'})
  try{
    await ensureSettingsAndRegistration()
    await q("insert into api.registration_requests(email,name,lab) values ($1,$2,$3) on conflict do nothing",[email,name,lab])
    try{
      const staff = await getStaffEmails()
      // Send to FROM with BCC to staff+dante
      await notifyRegistrationNew(staff, email, name, lab)
      // Send a confirmation copy to requester
      await notifyRegistrationCopy(email, name, lab)
    }catch(_){ }
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

app.post('/public/forgot_password', async (req, reply)=>{
  const b=req.body||{}; const email=String(b.email||'').trim().toLowerCase()
  if(!email) return reply.code(400).send({error:'MISSING EMAIL'})
  try{
    await ensureResetTable()
    // Only issue if user exists
    const { rows } = await q("select 1 from api.users where lower(email)=lower($1)",[email])
    if(!rows.length) return { ok:true } // silent
    const token = randomToken(24)
    const { rows: ins } = await q("insert into api.pass_reset_tokens(email,token,expires) values ($1,$2, now()+ interval '1 day') on conflict (email) do update set token=excluded.token, expires=excluded.expires returning token",[email, token])
    const link = String(PUBLIC_URL).replace(/\/$/,'') + '/reset?token=' + encodeURIComponent(ins[0].token)
    try{ await notifyReset(email, link) }catch(_){ }
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

app.post('/public/reset_password', async (req, reply)=>{
  const b=req.body||{}; const token=String(b.token||'').trim(); const pass=String(b.passcode||''); const emailIn=String(b.email||'').trim().toLowerCase()
  if(!token || !pass || !emailIn) return reply.code(400).send({error:'MISSING FIELDS'})
  try{
    await ensureUserPassColumns()
    const { rows } = await q("select email, expires from api.pass_reset_tokens where token=$1",[token])
    if(!rows.length) return reply.code(400).send({error:'BAD TOKEN'})
    if(new Date(rows[0].expires) < new Date()) return reply.code(400).send({error:'TOKEN EXPIRED'})
    const email = rows[0].email
    if(String(email).toLowerCase() !== emailIn) return reply.code(400).send({error:'EMAIL MISMATCH'})
    // Read current role/lab for users_add
    const { rows: uu } = await q("select role, coalesce(lab,'') as lab from api.users where lower(email)=lower($1)",[email])
    const role = uu.length? uu[0].role : 'USER'
    const lab  = uu.length? uu[0].lab  : ''
    // Validate and set strong passcode using PBKDF2
    const chk = validatePasscodeStrength(pass, email)
    if(!chk.ok) return reply.code(400).send({ error: chk.error, code: chk.code })
    const rec = createPassRecord(pass)
    await q(
      "insert into api.users(email,role,lab,salt,passcode_hash,passcode_algo,passcode_iters) values (lower($1),$2,$3,$4,$5,$6,$7) on conflict (email) do update set role=excluded.role, lab=excluded.lab, salt=excluded.salt, passcode_hash=excluded.passcode_hash, passcode_algo=excluded.passcode_algo, passcode_iters=excluded.passcode_iters",
      [email, role, lab, rec.salt, rec.passcode_hash, rec.passcode_algo, rec.passcode_iters]
    )
    await q("delete from api.pass_reset_tokens where email=lower($1)",[email])
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

// Admin: registration requests list and approve
app.get('/admin/registration_requests', { preHandler: requireAdmin }, async ()=>{
  await ensureSettingsAndRegistration(); const { rows } = await q("select email,name,lab,created_at from api.registration_requests order by created_at desc"); return rows
})
app.post('/admin/registration_requests/approve', { preHandler: requireAdmin }, async (req, reply)=>{
  const b = req.body||{}
  const email = normalizeEmail(b.email)
  let role = normalizeRole(b.role)
  const lab  = String(b.lab||'').trim()
  const allowed_nmr300 = !!b.allowed_nmr300
  const allowed_nmr400 = !!b.allowed_nmr400
  const allowed_nmr500 = !!b.allowed_nmr500
  if(!email) return reply.code(400).send({error:'MISSING EMAIL'})
  try{
    let currentRole = 'USER'
    try{
      const { rows: existing } = await q("select role from api.users where lower(email)=lower($1)",[email])
      if(existing[0]?.role) currentRole = existing[0].role
    }catch(_){ }
    try{
      role = ensureRoleChangeAllowed(req.user, email, role, currentRole)
    }catch(err){
      return reply.code(err.httpStatus || 403).send({ error: err.clientMessage || 'FORBIDDEN' })
    }
    // Read name from registration request (if present)
    let name = ''
    try{
      const { rows: rr } = await q("select coalesce(nullif(name,''),'') as name from api.registration_requests where lower(email)=lower($1)",[email])
      name = (rr[0]?.name)||''
    }catch(_){ }
    // Create or update user with name, role, lab and allowed flags; blank passcode first (keep legacy columns consistent)
    await ensureUserPassColumns()
    await q(
      "insert into api.users(email,name,role,lab,allowed_nmr300,allowed_nmr400,allowed_nmr500,salt,passcode_hash,passcode_algo,passcode_iters) values (lower($1),$2,$3,$4,$5,$6,$7,'','','sha256',1) on conflict (email) do update set name=excluded.name, role=excluded.role, lab=excluded.lab, allowed_nmr300=excluded.allowed_nmr300, allowed_nmr400=excluded.allowed_nmr400, allowed_nmr500=excluded.allowed_nmr500",
      [email, name, role, lab, allowed_nmr300, allowed_nmr400, allowed_nmr500]
    )
    // Issue reset token and send approval link
    await ensureResetTable(); const token = randomToken(24)
    const { rows: ins } = await q("insert into api.pass_reset_tokens(email,token,expires) values ($1,$2, now()+ interval '7 days') on conflict (email) do update set token=excluded.token, expires=excluded.expires returning token",[email, token])
    const link = String(PUBLIC_URL).replace(/\/$/,'') + '/reset?token=' + encodeURIComponent(ins[0].token)
    try{ await notifyRegistrationApproved(email, link, { allowed_nmr300, allowed_nmr400, allowed_nmr500 }, role) }catch(_){ }
    await q("delete from api.registration_requests where lower(email)=lower($1)",[email])
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

// Deny (delete) a registration request
app.post('/admin/registration_requests/deny', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const email=String(b.email||'').trim().toLowerCase()
  if(!email) return reply.code(400).send({error:'MISSING EMAIL'})
  try{
    await q("delete from api.registration_requests where lower(email)=lower($1)",[email])
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

// Logo settings
app.post('/admin/settings/logo', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const data=String(b.data||'').trim(); const type=String(b.type||'image/png').trim()
  if(!data) return reply.code(400).send({error:'MISSING DATA'})
  try{
    await ensureSettingsAndRegistration()
    await q("insert into api.settings(key,value) values ('logo_data',$1) on conflict (key) do update set value=excluded.value",[data])
    await q("insert into api.settings(key,value) values ('logo_type',$1) on conflict (key) do update set value=excluded.value",[type])
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})
app.post('/admin/settings/logo_frontpage', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const data=String(b.data||'').trim(); const type=String(b.type||'image/png').trim()
  if(!data) return reply.code(400).send({error:'MISSING DATA'})
  try{
    await ensureSettingsAndRegistration()
    await q("insert into api.settings(key,value) values ('logo_frontpage_data',$1) on conflict (key) do update set value=excluded.value",[data])
    await q("insert into api.settings(key,value) values ('logo_frontpage_type',$1) on conflict (key) do update set value=excluded.value",[type])
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})
app.post('/admin/settings/logo/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  try{
    await q("delete from api.settings where key in ('logo_data', 'logo_type')")
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})
app.post('/admin/settings/logo_frontpage/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  try{
    await q("delete from api.settings where key in ('logo_frontpage_data', 'logo_frontpage_type')")
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})
app.get('/public/logo', async (req, reply)=>{
  try{
    const { rows: d } = await q("select value from api.settings where key='logo_data'")
    if(!d.length) return reply.code(404).send('')
    const { rows: t } = await q("select value from api.settings where key='logo_type'")
    const type = (t[0]?.value)||'image/png'
    const buf = Buffer.from(d[0].value, 'base64')
    reply.header('Content-Type', type)
    return reply.send(buf)
  }catch(e){ return reply.code(404).send('') }
})
app.get('/public/logo_frontpage', async (req, reply)=>{
  try{
    const { rows: d } = await q("select value from api.settings where key='logo_frontpage_data'")
    if(!d.length) return reply.code(404).send('')
    const { rows: t } = await q("select value from api.settings where key='logo_frontpage_type'")
    const type = (t[0]?.value)||'image/png'
    const buf = Buffer.from(d[0].value, 'base64')
    reply.header('Content-Type', type)
    return reply.send(buf)
  }catch(e){ return reply.code(404).send('') }
})

// me profile
app.get('/me', { preHandler: requireAuth }, async (req)=>{
  const { rows } = await q("select email, name, role, coalesce(lab,'') as lab from api.users where lower(email)=lower($1)",[req.user.email])
  return rows[0] || { email: req.user.email, name:'', role: req.user.role, lab:'' }
})

// auth
app.post('/auth/login', async (req, reply) => {
  const b=req.body||{}
  const email=String(b.email||'').trim().toLowerCase()
  const pass = String(b.passcode||'')
  if(!email || pass.length<1) return reply.code(400).send({error:'BAD INPUT'})
  // Blocked users cannot log in
  try{ if(await isEmailBlocked(email)) return reply.code(403).send({ error:'BLOCKED', code:'BLOCKED' }) }catch(_){ }
  await ensureUserPassColumns()
  const { rows } = await q("select email,role,salt,passcode_hash,coalesce(passcode_algo,'sha256') as passcode_algo, coalesce(passcode_iters,1) as passcode_iters from api.users where lower(email)=lower($1)", [email])
  if(!rows.length) return reply.code(401).send({error:'NO SUCH USER'})
  const u = rows[0]
  let ok = false
  if (String(u.passcode_algo||'sha256') === 'pbkdf2-sha256'){
    try{ ok = (hashPBKDF2(pass, u.salt, u.passcode_iters) === u.passcode_hash) }catch(_){ ok=false }
  } else {
    const legacy = crypto.createHash('sha256').update(String(u.salt||'')+pass).digest('hex')
    ok = (legacy === u.passcode_hash)
    // Opportunistic upgrade to PBKDF2 on successful legacy login
    if (ok){
      const rec = createPassRecord(pass)
      try{ await q("update api.users set salt=$2, passcode_hash=$3, passcode_algo=$4, passcode_iters=$5 where lower(email)=lower($1)",[u.email, rec.salt, rec.passcode_hash, rec.passcode_algo, rec.passcode_iters]) }catch(_){ }
    }
  }
  if(!ok) return reply.code(401).send({error:'BAD PASSCODE'})
  const normalizedRole = normalizeRole(u.role)
  const token = makeToken(u.email, normalizedRole)
  const meta = (b.meta && typeof b.meta === 'object') ? b.meta : {}
  const tzOffset = Number(meta.tz_offset_minutes)
  const tzName = typeof meta.tz_name === 'string' ? meta.tz_name : null
  const clientTimeIso = typeof meta.client_time_iso === 'string' ? meta.client_time_iso : null
  const ua = String(req.headers['user-agent']||'')
  const acceptLang = String(req.headers['accept-language']||'')
  try{
    await q(
      "insert into api.login_events(email, ip, user_agent, accept_language, tz_offset_minutes, tz_name, client_time_iso, payload) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        u.email,
        clientIp(req),
        ua,
        acceptLang,
        (tzOffset!=tzOffset) ? null : tzOffset,
        tzName,
        clientTimeIso,
        JSON.stringify(meta||{})
      ]
    )
  }catch(e){ try{ app.log.warn({ err:String(e?.message||e) }, 'login event insert failed') }catch(_){} }
  return { token, email: u.email, role: normalizedRole }
})

// public GETs
app.get('/resources', async () => {
  // Ensure optional color column exists
  try{ await q("alter table if exists api.resources add column if not exists color_hex text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists past_slot_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_30m_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_3h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_12h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_24h_color text") }catch(_){ }
  const { rows } = await q(
    `select name, visible, advance_days, status, limitation_note,
            coalesce(color_hex,'') as color_hex,
            coalesce(past_slot_color,'') as past_slot_color,
            coalesce(slot_30m_color,'') as slot_30m_color,
            coalesce(slot_3h_color,'') as slot_3h_color,
            coalesce(slot_12h_color,'') as slot_12h_color,
            coalesce(slot_24h_color,'') as slot_24h_color
       from api.resources
      where visible=true
      order by name`
  )
  return rows
})

// Public labs listing (names only)
app.get('/public/labs', async () => {
  try{
    const { rows } = await q("select id, name from api.labs order by name")
    return rows
  }catch(e){ return [] }
})
app.get('/resource-probes', async (req, reply) => {
  const r = String(req.query.resource||'').trim()
  if(!r) return reply.code(400).send({error:'MISSING RESOURCE'})
  const { rows } = await q("select probe from api.resource_probes where resource=$1 and active=true order by probe", [r])
  return rows.map(x=>x.probe)
})

// Public: resource probe metadata (active + default)
app.get('/resource-info', async (req, reply) => {
  const resource = String(req.query.resource||'').trim()
  if(!resource) return reply.code(400).send({ error:'MISSING RESOURCE' })
  // Ensure new columns exist (idempotent)
  try{ await q("alter table if exists api.resources add column if not exists active_probe text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists default_probe text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists color_hex text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists past_slot_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_30m_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_3h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_12h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_24h_color text") }catch(_){ }
  try{
    const { rows } = await q(
      `select active_probe,
              default_probe,
              coalesce(color_hex,'') as color_hex,
              coalesce(status,'') as status,
              coalesce(limitation_note,'') as limitation_note,
              coalesce(past_slot_color,'') as past_slot_color,
              coalesce(slot_30m_color,'') as slot_30m_color,
              coalesce(slot_3h_color,'') as slot_3h_color,
              coalesce(slot_12h_color,'') as slot_12h_color,
              coalesce(slot_24h_color,'') as slot_24h_color
         from api.resources
        where name=$1`,
      [resource]
    )
    const r = rows[0] || {}
    return {
      active_probe: r.active_probe || null,
      default_probe: r.default_probe || null,
      color_hex: r.color_hex || '',
      status: r.status || '',
      limitation_note: r.limitation_note || '',
      past_slot_color: r.past_slot_color || '',
      slot_30m_color: r.slot_30m_color || '',
      slot_3h_color: r.slot_3h_color || '',
      slot_12h_color: r.slot_12h_color || '',
      slot_24h_color: r.slot_24h_color || '',
    }
  }catch(_){
    return {
      active_probe:null,
      default_probe:null,
      color_hex:'',
      status:'',
      limitation_note:'',
      past_slot_color:'',
      slot_30m_color:'',
      slot_3h_color:'',
      slot_12h_color:'',
      slot_24h_color:'',
    }
  }
})

app.get('/maintenance', async (req, reply) => {
  const resource = String(req.query.resource || '').trim()
  const start = String(req.query.start || '').trim()
  const end = String(req.query.end || '').trim()
  if (!resource || !start || !end) return reply.code(400).send({ error: 'MISSING PARAMS' })
  try {
    const { rows } = await q(
      `select id, resource, start_ts, end_ts, reason
         from api.maintenance_windows
        where resource = $1
          and tstzrange(start_ts, end_ts, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        order by start_ts`,
      [resource, start, end]
    )
    return rows
  } catch (_){
    return []
  }
})

app.get('/training', async (req, reply) => {
  const resource = String(req.query.resource || '').trim()
  const start = String(req.query.start || '').trim()
  const end = String(req.query.end || '').trim()
  if (!resource || !start || !end) return reply.code(400).send({ error: 'MISSING PARAMS' })
  try {
    await ensureTrainingWindowsTable()
    const { rows } = await q(
      `select id, resource, start_ts, end_ts, reason
         from api.training_windows
        where resource = $1
          and tstzrange(start_ts, end_ts, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        order by start_ts`,
      [resource, start, end]
    )
    return rows
  } catch (_){
    return []
  }
})

app.get('/experiments', async () => {
  const { rows } = await q("select code from api.experiments order by code")
  return rows.map(r=>r.code)
})
app.get('/pricing', async () => {
  const { rows } = await q("select id,resource, experiment, probe, rate_code, rate_per_hour_eur, effective_from from api.pricing order by resource, experiment, probe, effective_from desc"); 
  return rows
})

// Public: check if a user email exists
app.get('/public/check_email', async (req) => {
  const email = String(req.query.email||'').trim().toLowerCase()
  if(!email) return { exists:false }
  try{
    const { rows } = await q("select 1 from api.users where lower(email)=lower($1) limit 1", [email])
    const exists = rows.length>0
    return { exists }
  }catch(_){ return { exists:false } }
})

app.post('/report/timezone-mismatch', { preHandler: requireAuth }, async (req) => {
  const b = req.body || {}
  const tzName = String(b.tz_name || '').trim() || 'Unknown'
  const userAgent = String(b.user_agent || '').trim().slice(0, 500)
  const offsetRaw = Number(b.offset_minutes)
  const offsetMinutes = Number.isFinite(offsetRaw) ? offsetRaw : null
  const noteLines = [
    'Timezone mismatch detected.',
    `User: ${req.user?.email || 'unknown'}`,
    `Role: ${req.user?.role || 'unknown'}`,
    `Device timezone: ${tzName}`,
    offsetMinutes == null ? null : `Offset minutes: ${offsetMinutes}`,
    `IP: ${clientIp(req) || 'unknown'}`,
    userAgent ? `User-Agent: ${userAgent}` : null,
    `Timestamp: ${new Date().toISOString()}`
  ].filter(Boolean)
  try {
    const staff = await getStaffEmails()
    if (staff.length){
      await notifyContact(staff, req.user?.name || req.user?.email || 'User', 'Timezone mismatch auto-alert', noteLines.join('\n'))
    }
  } catch (e){
    try{ app.log.warn({ err:String(e?.message||e) }, 'timezone mismatch notify failed') }catch(_){ }
  }
  return { ok:true }
})

// Public: CHANGES.txt contents for admin announcement
app.get('/public/changes', async (_req, reply) => {
  const candidates = [
    '/opt/tempusfugit/CHANGES.txt',
    path.resolve(process.cwd(), 'CHANGES.txt'),
    path.resolve(process.cwd(), '..', 'CHANGES.txt')
  ]
  for (const p of candidates){
    try{
      if(fs.existsSync(p)){
        const text = fs.readFileSync(p, 'utf-8')
        reply.header('Content-Type','text/plain; charset=utf-8')
        return reply.send(text)
      }
    }catch(_){ /* try next */ }
  }
  reply.header('Content-Type','text/plain; charset=utf-8')
  return reply.send('')
})
app.get('/me/upcoming', async (req, reply) => {
  const email = String(req.headers['x-user-email'] || '').trim().toLowerCase()
  if (!email) return reply.code(400).send({ error: 'MISSING EMAIL' })
  const sql = `
    select id, user_email, resource, start_ts, end_ts, experiment, probe, status, canceled_at, canceled_by
      from api.reservations
     where lower(user_email)=lower($1)
       and status in ('APPROVED','PENDING','CANCELED','CANCEL_PENDING')
     order by start_ts desc
     limit 500`;
  const { rows } = await q(sql, [email])
  return rows
})

// Allow users to change their own passcode
app.post('/me/passcode', { preHandler: requireAuth }, async (req, reply)=>{
  const b=req.body||{}
  const curr = String(b.current||'')
  const next = String(b.next||'')
  if(!curr || !next) return reply.code(400).send({error:'MISSING FIELDS'})
  try{
    await ensureUserPassColumns()
    const { rows } = await q("select email, role, coalesce(lab,'') as lab, salt, passcode_hash, coalesce(passcode_algo,'sha256') as passcode_algo, coalesce(passcode_iters,1) as passcode_iters from api.users where lower(email)=lower($1)",[req.user.email])
    if(!rows.length) return reply.code(404).send({error:'NOT FOUND'})
    const u = rows[0]
    // verify current
    let ok = false
    if (String(u.passcode_algo||'sha256') === 'pbkdf2-sha256'){
      try{ ok = (hashPBKDF2(curr, u.salt, u.passcode_iters) === u.passcode_hash) }catch(_){ ok=false }
    } else {
      const legacy = crypto.createHash('sha256').update(String(u.salt||'')+curr).digest('hex')
      ok = (legacy === u.passcode_hash)
    }
    if(!ok) return reply.code(401).send({error:'BAD PASSCODE'})
    const chk = validatePasscodeStrength(next, u.email)
    if(!chk.ok) return reply.code(400).send({ error: chk.error, code: chk.code })
    const rec = createPassRecord(next)
    await q("update api.users set salt=$2, passcode_hash=$3, passcode_algo=$4, passcode_iters=$5 where lower(email)=lower($1)",[u.email, rec.salt, rec.passcode_hash, rec.passcode_algo, rec.passcode_iters])
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

// helpers
const minutesBetween = (a,b)=> Math.round((new Date(b).getTime()-new Date(a).getTime())/60000)
const labelFromMinutes = (mins)=> mins===30?'30m':(mins===180?'3h':(mins===720?'12h':(mins>=1440?'24h':`${mins}m`)))

// advance window
async function checkAdvance(resource, startISO){
  const { rows } = await q("select advance_days from api.resources where name=$1",[resource])
  if(!rows.length) return { ok:false, msg:'UNKNOWN RESOURCE' }
  const adv = rows[0].advance_days||0
  const now = new Date(); const s = new Date(startISO)
  const days = (s - now) / 86400000
  if(days > adv + 1e-6) return { ok:false, code:'ERR_ADVANCE_WINDOW', msg:`Cannot book more than ${adv} days ahead` }
  return { ok:true }
}

// anti-stockpiling
async function checkCaps(email, resource, startISO, endISO, label){
  // Ensure new columns exist (idempotent)
  try{ await q("alter table if exists api.caps add column if not exists per_day_hours int") }catch(_){ }
  try{ await q("alter table if exists api.caps add column if not exists per_week_hours int") }catch(_){ }
  const { rows: caps } = await q("select coalesce(per_day_hours,0) as per_day_hours, coalesce(per_week_hours,0) as per_week_hours from api.caps where resource=$1 and block_label=$2",[resource,label])
  if(!caps.length) return { ok:true }
  const perDayH  = Number(caps[0].per_day_hours||0)
  const perWeekH = Number(caps[0].per_week_hours||0)
  if(perDayH<=0 && perWeekH<=0) return { ok:true }

  const blockMin = minutesBetween(startISO,endISO)
  const start = new Date(startISO)
  const dayISO = start.toISOString().slice(0,10)
  const weekAnchor = new Date(start); const day=(weekAnchor.getDay()+6)%7; weekAnchor.setDate(weekAnchor.getDate()-day); weekAnchor.setHours(0,0,0,0)
  const weekStartISO = weekAnchor.toISOString()
  const nextWeek = new Date(weekAnchor); nextWeek.setDate(nextWeek.getDate()+7)
  const weekEndISO = nextWeek.toISOString()

  const sqlBase = `
    select coalesce(sum(extract(epoch from (end_ts-start_ts)))/60,0) as mins
      from api.reservations
     where user_email=lower($1) and resource=$2 and status in ('APPROVED','PENDING') and end_ts > now()
       and (case when extract(epoch from (end_ts-start_ts))/60>=1440 then '24h'
                 when extract(epoch from (end_ts-start_ts))/60=720 then '12h'
                 when extract(epoch from (end_ts-start_ts))/60=180 then '3h'
                 when extract(epoch from (end_ts-start_ts))/60=30 then '30m'
                 else 'other' end) = $3`;

  const { rows: dHeld } = await q(sqlBase + ` and (start_ts at time zone 'UTC')::date = $4::date`, [email, resource, label, dayISO])
  const heldDay = Math.round(Number(dHeld[0].mins)||0)
  const { rows: wHeld } = await q(sqlBase + ` and start_ts >= $4::timestamptz and start_ts < $5::timestamptz`, [email, resource, label, weekStartISO, weekEndISO])
  const heldWeek = Math.round(Number(wHeld[0].mins)||0)

  const overDay  = perDayH  > 0 && (heldDay + blockMin) > perDayH*60
  const overWeek = perWeekH > 0 && (heldWeek + blockMin) > perWeekH*60
  if(overDay || overWeek){
    return { ok:false, code:'ERR_CAP', msg:'Cap exceeded', held_day_minutes: heldDay, held_week_minutes: heldWeek, add_minutes: blockMin, per_day_minutes: perDayH*60, per_week_minutes: perWeekH*60, resource, label }
  }
  return { ok:true, held_day_minutes: heldDay, held_week_minutes: heldWeek, add_minutes: blockMin, per_day_minutes: perDayH*60, per_week_minutes: perWeekH*60 }
}

// cancel cutoff
async function checkCancelCutoff(resource, id){
  const { rows } = await q("select start_ts, end_ts from api.reservations where id=$1",[id])
  if(!rows.length) return { ok:false, msg:'NOT FOUND' }
  const r = rows[0]
  // Prevent canceling past reservations entirely
  if (new Date(r.end_ts) < new Date()) return { ok:false, code:'ERR_PAST_CANCEL', msg:'Cannot cancel past reservations', context:{ ended_at: r.end_ts } }
  const mins = minutesBetween(new Date(), r.start_ts)
  const label = labelFromMinutes(minutesBetween(r.start_ts,r.end_ts))
  const { rows: rc } = await q("select cutoff_minutes from api.cancel_rules where resource=$1 and block_label=$2",[resource,label])
  const cutoff = rc.length? rc[0].cutoff_minutes : 0
  if(mins < cutoff) return { ok:false, code:'ERR_CUTOFF', msg:`Cannot cancel within ${cutoff} minutes of start`, context:{ minutes_until_start: mins, cutoff_minutes: cutoff, resource, label } }
  return { ok:true, context:{ minutes_until_start: mins, cutoff_minutes: cutoff, resource, label } }
}

// busy range
app.get('/reservations/range', async (req, reply) => {
  const r = String(req.query.resource||'').trim()
  const s = String(req.query.start||'').trim()
  const e = String(req.query.end||'').trim()
  if(!r || !s || !e) return reply.code(400).send({error:'MISSING PARAMS'})
  const { rows } = await q(
    `select r.id, r.user_email, coalesce(u.name,'') as user_name, coalesce(u.lab,'') as user_lab, r.resource, r.start_ts, r.end_ts, r.experiment, r.probe, r.label, r.status,
            coalesce(r.bill_to_type,'LAB') as bill_to_type,
            r.bill_to_client_id,
            coalesce(c.name,'') as client_name
       from api.reservations r
       left join api.users u on lower(u.email)=lower(r.user_email)
       left join api.clients c on c.id = r.bill_to_client_id
      where r.resource=$1 and r.status in ('APPROVED','PENDING','CANCEL_PENDING')
        and tstzrange(r.start_ts,r.end_ts,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)') 
      order by r.start_ts`, [r,s,e]
  )
  return rows
})

// create

app.post('/reservations/create', { preHandler: requireAuth }, async (req, reply) => {
  const b = req.body || {}
  const email = String(b.email || '').trim().toLowerCase()
  const resource = String(b.resource || '').trim()
  const start = String(b.start || '').trim()
  const end = String(b.end || '').trim()
  const experiment = String(b.experiment || 'REGULAR').trim()
  const probe = String(b.probe || 'BBO3').trim()
  let label = String(b.label || '30m').trim()
  let billToType = String(b.bill_to_type || 'LAB').trim().toUpperCase()
  const billToClientId = (b.bill_to_client_id == null ? null : Number(b.bill_to_client_id))
  const totalPrice = (b.total_price_eur == null ? null : Number(b.total_price_eur))
  if (!['LAB', 'CLIENT'].includes(billToType)) billToType = 'LAB'
  const isClientBill = ['STAFF', 'DANTE'].includes(req.user.role) && billToType === 'CLIENT'

  const normalizedAttempt = {
    email,
    resource,
    start,
    end,
    experiment,
    probe,
    label,
    bill_to_type: billToType,
    bill_to_client_id: billToClientId,
    total_price_eur: totalPrice,
    client_billed: isClientBill
  }

  const buildAlertPayload = (extra = {}) => ({
    resource,
    userEmail: req.user?.email || email,
    userRole: req.user?.role || null,
    actor: req.user?.actor || req.user?.email || null,
    impersonator: req.user?.impersonator || null,
    ip: clientIp(req),
    requestBody: b,
    normalized: normalizedAttempt,
    timestamp: new Date().toISOString(),
    ...extra
  })

  const sendBookingError = async (status, code, message, context = {}, rawMessage) => {
    await maybeSendBookingErrorAlert(buildAlertPayload({
      context,
      errorCode: code,
      errorMessage: message,
      rawError: rawMessage || message
    }))
    if (status === 400) {
      return sendError(reply, code, message, context)
    }
    const body = { error: message || String(code || 'ERROR'), code: code || 'ERR_UNKNOWN' }
    if (context && typeof context === 'object' && Object.keys(context).length) body.context = context
    return reply.code(status).send(body)
  }

  if (email !== req.user.email.toLowerCase() && !['STAFF', 'DANTE'].includes(req.user.role)) {
    return sendBookingError(403, 'FORBIDDEN', 'FORBIDDEN', { reason: 'EMAIL_MISMATCH', requested_email: email })
  }
  if (!email || !resource || !start || !end || !label) {
    return sendBookingError(400, 'MISSING_FIELDS', 'MISSING FIELDS', { email, resource, start, end, label })
  }

  let matchedSlotTemplate = null

  try {
    const now = new Date()
    const s = new Date(start)
    const e = new Date(end)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return sendBookingError(400, 'ERR_BAD_RANGE', 'BAD TIME RANGE', { start, end })
    }
    if (e <= now) {
      return sendBookingError(400, 'ERR_PAST_TIME', 'CANNOT BOOK IN THE PAST', { start, end, now: now.toISOString() })
    }
    if (e <= s) {
      return sendBookingError(400, 'ERR_BAD_RANGE', 'BAD TIME RANGE', { start, end })
    }
    matchedSlotTemplate = slotMatchesTemplate(resource, s, e)
    if(!matchedSlotTemplate){
      return sendBookingError(400, 'ERR_SLOT_ALIGNMENT', 'INVALID SLOT FOR RESOURCE', { resource, start, end })
    }
    label = matchedSlotTemplate.label
  } catch (_){ }

  if (matchedSlotTemplate){
    normalizedAttempt.label = matchedSlotTemplate.label
  }

  try { await q("alter table if exists api.reservations add column if not exists bill_to_type text") }catch(_){ }
  try { await q("alter table if exists api.reservations add column if not exists bill_to_client_id int") }catch(_){ }
  try { await q("alter table if exists api.reservations add column if not exists total_price_eur numeric") }catch(_){ }
  try { await q("alter table if exists api.reservations add column if not exists created_by citext") }catch(_){ }

  if (!isClientBill) {
    if (!['DANTE'].includes(req.user.role)) {
      const adv = await checkAdvance(resource, start)
      if (!adv.ok) {
        const { rows: rs } = await q("select advance_days from api.resources where name=$1", [resource])
        return sendBookingError(400, adv.code || 'ERR_ADVANCE_WINDOW', adv.msg, { resource, requested_start: start, advance_days: rs[0]?.advance_days || 0 }, adv.msg)
      }
    }
    const cap = await checkCaps(email, resource, start, end, label)
    if (!cap.ok) {
      return sendBookingError(400, cap.code || 'ERR_CAP', cap.msg, cap, cap.msg)
    }
  }

  try {
    let row
    if (isClientBill) {
      try { await q("create table if not exists api.clients(id serial primary key, name text unique not null, active boolean not null default true, created_at timestamptz default now())") }catch(_){ }
      try {
        const { rows: ok } = await q("select api._enforce_allowed($1,$2) as ok", [email, resource])
        if (!ok[0]?.ok) return sendBookingError(400, 'ERR_NOT_ALLOWED', 'USER NOT ALLOWED FOR THIS RESOURCE', { resource })
      } catch (_){ }
      try {
        const { rows: mw } = await q("select api._in_maint($1,$2::timestamptz,$3::timestamptz) as in_maint", [resource, start, end])
        if (mw[0]?.in_maint) return sendBookingError(400, 'ERR_MAINTENANCE', 'MAINTENANCE WINDOW', { resource, start, end })
      } catch (_){ }
      const ins = await q(
        `insert into api.reservations(user_email, resource, start_ts, end_ts, experiment, probe, label, status, price_eur, rate_code, created_by, bill_to_type, bill_to_client_id, total_price_eur)
         values ($1,$2,$3::timestamptz,$4::timestamptz,$5,$6,$7,'APPROVED',$8,'CLIENT',$9,'CLIENT',$10,$8)
         returning *`,
        [email, resource, start, end, experiment, probe, label, (totalPrice == null ? 0 : Number(totalPrice)), req.user.email, (billToClientId || null)]
      )
      row = ins.rows[0]
      try {
        await q("insert into api.audit(actor, action, reservation_id, payload) values ($1,'CREATE',$2,$3)", [req.user.actor, row.id, JSON.stringify({ email, resource, start, end, experiment, probe, label, client_billed: true, bill_to_client_id: billToClientId || null, total_price_eur: (totalPrice == null ? 0 : Number(totalPrice)) })])
      } catch (_){ }
    } else {
      const { rows } = await q("select * from api.create_reservation($1,$2,$3,$4,$5,$6,$7)", [email, resource, start, end, experiment, probe, label])
      row = rows[0]
    }
    try { await q("alter table if exists api.resources add column if not exists active_probe text") }catch(_){ }
    try { await q("alter table if exists api.resources add column if not exists default_probe text") }catch(_){ }
    if (!isClientBill) {
      try {
        if (row && row.resource === 'NMR400' && (row.probe || '').toUpperCase() === 'BBO10' && row.status !== 'PENDING') {
          const up = await q("update api.reservations set status='PENDING' where id=$1 returning *", [row.id])
          if (up.rows.length) row = up.rows[0]
        }
      } catch (_){ }
      try {
        if (row && row.resource === 'NMR500' && row.status !== 'PENDING') {
          const { rows: rr } = await q("select active_probe from api.resources where name='NMR500'")
          const ap = String(rr[0]?.active_probe || '').trim()
          if (ap && String(row.probe || '').trim() && String(row.probe || '').trim().toUpperCase() !== ap.toUpperCase()) {
            const up = await q("update api.reservations set status='PENDING' where id=$1 returning *", [row.id])
            if (up.rows.length) row = up.rows[0]
          }
        }
      } catch (_){ }

      try {
        if (row && row.status !== 'PENDING') {
          let requiresApproval = false;
          // Check for resource-specific experiment approval override
          const { rows: re } = await q("select requires_approval from api.resource_experiments where resource=$1 and experiment_code=$2", [row.resource, row.experiment]);
          if (re.length > 0) {
            requiresApproval = re[0].requires_approval;
          } else {
            // Check base experiment approval requirement
            const { rows: exp } = await q("select requires_approval from api.experiments where code=$1", [row.experiment]);
            if (exp.length > 0) {
              requiresApproval = exp[0].requires_approval;
            }
          }

          if (requiresApproval) {
            const up = await q("update api.reservations set status='PENDING' where id=$1 returning *", [row.id]);
            if (up.rows.length) row = up.rows[0];
          }
        }
      } catch (_) { }
    }
    if (row?.status === 'PENDING' && !isClientBill) {
      try { const staff = await getStaffEmails(); await notifyPending(row, staff) }catch(_){ }
    }
    return row
  } catch (e) {
    const raw = String(e.message || e)
    const map = {
      ERR_BAD_RANGE: 'BAD TIME RANGE',
      ERR_NOT_ALLOWED: 'USER NOT ALLOWED FOR THIS RESOURCE',
      ERR_ADVANCE_WINDOW: 'TOO FAR IN ADVANCE',
      ERR_MAINTENANCE: 'MAINTENANCE WINDOW',
      ERR_TRAINING: 'TRAINING WINDOW',
      ERR_WEEKEND_CAP: 'WEEKEND 24H LIMIT REACHED',
      'TIME ALREADY BOOKED': 'TIME ALREADY BOOKED',
      OVERLAP: 'TIME ALREADY BOOKED',
      RES_OVERLAP_EXCL: 'TIME ALREADY BOOKED',
      CAP: 'CAP LIMIT REACHED'
    }
    const code = Object.keys(map).find(k => raw.includes(k))
      || (/conflicting key value violates exclusion constraint/i.test(raw) ? 'RES_OVERLAP_EXCL' : 'ERR_UNKNOWN')
    const base = { resource, start, end, experiment, probe, label }
    if (code === 'RES_OVERLAP_EXCL' || code === 'OVERLAP' || code === 'TIME ALREADY BOOKED') {
      try {
        const { rows: ov } = await q(
          `select id, user_email, start_ts, end_ts, status from api.reservations
            where resource=$1 and status in ('APPROVED','PENDING')
              and tstzrange(start_ts,end_ts,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)')
            order by start_ts limit 5`, [resource, start, end])
        base.overlaps = ov
      } catch (_){ }
    }
    if (code === 'ERR_MAINTENANCE') {
      try {
        const { rows: mw } = await q(
          `select id, start_ts, end_ts, reason from api.maintenance_windows
            where resource=$1 and tstzrange(start_ts,end_ts,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)')
            order by start_ts`, [resource, start, end])
        base.maintenance = mw
      } catch (_){ }
    }
    if (code === 'ERR_TRAINING') {
      try {
        await ensureTrainingWindowsTable()
        const { rows: tw } = await q(
          `select id, start_ts, end_ts, reason from api.training_windows
            where resource=$1 and tstzrange(start_ts,end_ts,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)')
            order by start_ts`, [resource, start, end])
        base.training = tw
      } catch (_){ }
    }
    const clientMessage = map[code] || raw
    return sendBookingError(400, code, clientMessage, base, raw)
  }
})

// cancel
app.post('/reservations/cancel', { preHandler: requireAuth }, async (req, reply) => {
  const b = req.body || {}
  const email = String(b.email||'').trim().toLowerCase()
  const id = Number(b.id)
  if (!id) return reply.code(400).send({ error: 'MISSING FIELDS' })
  const { rows: rr } = await q("select resource, experiment, probe, status, user_email, coalesce(bill_to_type,'LAB') as bill_to_type from api.reservations where id=$1",[id])
  if(!rr.length) return reply.code(404).send({error:'NOT FOUND'})
  const resource = rr[0].resource
  const experiment = rr[0].experiment
  const probe = rr[0].probe
  const currStatus = rr[0].status
  const ownerEmail = String(rr[0].user_email||'').toLowerCase()
  // For non-pending bookings, enforce cutoff; allow pending bookings to be canceled by user without cutoff
  if(currStatus !== 'PENDING'){
    const cut = await checkCancelCutoff(resource,id); if(!cut.ok) return sendError(reply, cut.code||'ERR_CUTOFF', cut.msg, cut.context||{})
  }
  if (email !== req.user.email.toLowerCase() && !['STAFF','DANTE'].includes(req.user.role))
    return reply.code(403).send({error:'FORBIDDEN'})
  let cancelNeedsApproval = false
  try {
    const { rows: map } = await q("select requires_approval from api.resource_experiments where resource=$1 and experiment_code=$2", [resource, experiment])
    if(map.length){
      cancelNeedsApproval = !!map[0].requires_approval
    }else{
      const { rows: exp } = await q("select requires_approval from api.experiments where code=$1", [experiment])
      if(exp.length) cancelNeedsApproval = !!exp[0].requires_approval
    }
  } catch (_){ }
  try {
    // If a staff member is canceling on behalf of a user, record staff as canceled_by and audit with staff actor
    if(['STAFF','DANTE'].includes(req.user.role) && email !== req.user.email.toLowerCase()){
      const { rows } = await q("update api.reservations set status='CANCELED', canceled_at=now(), canceled_by=$2 where id=$1 and status in ('APPROVED','PENDING') returning *", [id, req.user.email])
      if(!rows.length) return reply.code(404).send({error:'NOT FOUND'});
      try{ await q("insert into api.audit(actor, action, reservation_id, payload) values ($1,'CANCEL',$2,$3)", [req.user.actor, id, JSON.stringify({ id, for_email: email })]) }catch(_){ }
      // Notify user of admin-canceled booking (skip for client-billed)
      try{ if(String(rows[0]?.bill_to_type||'LAB')!=='CLIENT') await notifyCanceled(rows[0], req.user.actor, 'Admin canceled on behalf') }catch(_){ }
      return rows[0]
    }
    // Regular self-cancel path
    // If booking is pending, cancel immediately. Otherwise, request cancellation.
    if(currStatus==='PENDING'){
      const { rows } = await q("select * from api.cancel_reservation($1,$2)", [email, id]);
      if(!rows.length) return reply.code(404).send({error:'NOT FOUND'});
      return rows[0]
    } else {
      if(cancelNeedsApproval){
        const { rows } = await q("update api.reservations set status='CANCEL_PENDING', canceled_by=$2 where id=$1 and status='APPROVED' returning *", [id, email])
        if(!rows.length) return reply.code(404).send({error:'NOT FOUND OR NOT APPROVED'})
        const row = rows[0]
        try{ if(String(row?.bill_to_type||'LAB')!=='CLIENT'){ const staff = await getStaffEmails(); await notifyCancelRequested(row, staff) } }catch(_){ }
        return row
      } else {
        const { rows } = await q("select * from api.cancel_reservation($1,$2)", [email, id]);
        if(!rows.length) return reply.code(404).send({error:'NOT FOUND'})
        return rows[0]
      }
    }
  } catch (e) { 
    return reply.code(400).send({ error: String(e.message||e).toUpperCase(), detail: String(e.message||e) }) 
  }
})

// ===== Admin


app.get('/admin/booking_error_alerts', { preHandler: requireAdmin }, async () => {
  const { settings, recipients } = await resolveBookingErrorRecipients()
  return {
    enabled: settings.enabled,
    roles: settings.roles,
    available_roles: BOOKING_ERROR_ALLOWED_ROLES,
    subject_prefix: settings.subjectPrefix || 'tempusfugit UX error |',
    recipients
  }
})

app.post('/admin/booking_error_alerts', { preHandler: requireAdmin }, async (req) => {
  const body = req.body || {}
  const enabled = !!body.enabled
  let roles = Array.isArray(body.roles) ? body.roles.map(r => String(r || '').toUpperCase()) : []
  roles = roles.filter(r => BOOKING_ERROR_ALLOWED_ROLES.includes(r))
  const subjectPrefix = String(body.subject_prefix || '').trim() || 'tempusfugit UX error |'
  await saveBookingErrorAlertSettings(enabled, roles, subjectPrefix)
  const { settings, recipients } = await resolveBookingErrorRecipients()
  return {
    enabled: settings.enabled,
    roles: settings.roles,
    available_roles: BOOKING_ERROR_ALLOWED_ROLES,
    subject_prefix: settings.subjectPrefix || 'tempusfugit UX error |',
    recipients
  }
})

// labs
app.get('/admin/labs', { preHandler: requireAdmin }, async ()=> {
  const { rows } = await q("select id,name from api.labs order by name"); return rows
})
app.post('/admin/labs/save', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=b.id?Number(b.id):null; const name=String(b.name||'').trim()
  if(!name) return reply.code(400).send({error:'MISSING NAME'})
  if(id){ await q("update api.labs set name=$2 where id=$1",[id,name]) }
  else{ await q("insert into api.labs(name) values ($1) on conflict do nothing",[name]) }
  return {ok:true}
})
app.post('/admin/labs/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.id) return reply.code(400).send({error:'MISSING ID'})
  await q("delete from api.labs where id=$1",[Number(b.id)]); return {ok:true}
})

// users
app.get('/admin/users', { preHandler: requireAdmin }, async ()=>{
  try{ await q("alter table if exists api.users add column if not exists receive_mail boolean not null default true") }catch(_){ }
  const { rows } = await q("select email, name, role, coalesce(lab,'') as lab, allowed_nmr300, allowed_nmr400, allowed_nmr500, coalesce(receive_mail,true) as receive_mail from api.users order by email"); return rows
})
app.post('/admin/users/add', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const email = normalizeEmail(b.email)
  const lab = String(b.lab||'').trim()
  const passcode = String(b.passcode||'')
  if(!email || !b.role || !lab || !passcode) return reply.code(400).send({error:'MISSING FIELDS'})
  let role = normalizeRole(b.role)
  let currentRole = 'USER'
  try{
    const { rows: existing } = await q("select role from api.users where lower(email)=lower($1)",[email])
    if(existing[0]?.role) currentRole = existing[0].role
  }catch(_){ }
  try{
    role = ensureRoleChangeAllowed(req.user, email, role, currentRole)
  }catch(err){
    return reply.code(err.httpStatus || 403).send({ error: err.clientMessage || 'FORBIDDEN' })
  }
  await ensureUserPassColumns()
  const chk = validatePasscodeStrength(passcode, email)
  if(!chk.ok) return reply.code(400).send({ error: chk.error, code: chk.code })
  const rec = createPassRecord(passcode)
  await q(
    "insert into api.users(email,name,role,lab,allowed_nmr300,allowed_nmr400,allowed_nmr500,salt,passcode_hash,passcode_algo,passcode_iters) values (lower($1),$2,$3,$4,false,false,false,$5,$6,$7,$8) on conflict (email) do update set name=excluded.name, role=excluded.role, lab=excluded.lab, salt=excluded.salt, passcode_hash=excluded.passcode_hash, passcode_algo=excluded.passcode_algo, passcode_iters=excluded.passcode_iters",
    [email, b.name||'', role, lab, rec.salt, rec.passcode_hash, rec.passcode_algo, rec.passcode_iters]
  )
  // Fire welcome mail (best-effort)
  try{
    const link = String(PUBLIC_URL).replace(/\/$/,'') + '/login'
    // read back current permissions and lab
    const { rows: uu } = await q("select name, role, coalesce(lab,'') as lab, allowed_nmr300, allowed_nmr400, allowed_nmr500 from api.users where lower(email)=lower($1)",[email])
    const u = uu[0] || { lab, allowed_nmr300:false, allowed_nmr400:false, allowed_nmr500:false }
    await notifyWelcome(email, passcode, link, u.lab, { allowed_nmr300:u.allowed_nmr300, allowed_nmr400:u.allowed_nmr400, allowed_nmr500:u.allowed_nmr500 })
  }catch(e){ app.log.warn({ err:String(e?.message||e) }, 'welcome mail failed') }
  return {ok:true}
})
app.post('/admin/users/update', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const email = normalizeEmail(b.email)
  if(!email) return reply.code(400).send({error:'MISSING EMAIL'})

  let currentRole = 'USER'
  try{
    const { rows: existing } = await q("select role from api.users where lower(email)=lower($1)",[email])
    if(existing[0]?.role) currentRole = existing[0].role
  }catch(_){ }

  const desiredRole = b.role==null ? currentRole : normalizeRole(b.role)
  let roleToAssign
  try{
    roleToAssign = ensureRoleChangeAllowed(req.user, email, desiredRole, currentRole)
  }catch(err){
    return reply.code(err.httpStatus || 403).send({ error: err.clientMessage || 'FORBIDDEN' })
  }

  if(b.passcode){
    await ensureUserPassColumns()
    const chk = validatePasscodeStrength(String(b.passcode||''), email)
    if(!chk.ok) return reply.code(400).send({ error: chk.error, code: chk.code })
    const rec = createPassRecord(String(b.passcode))
    await q("update api.users set role=$2, lab=$3, salt=$4, passcode_hash=$5, passcode_algo=$6, passcode_iters=$7 where lower(email)=lower($1)",[email, roleToAssign, b.lab||'', rec.salt, rec.passcode_hash, rec.passcode_algo, rec.passcode_iters])
  } else {
    try{ await q("alter table if exists api.users add column if not exists receive_mail boolean not null default true") }catch(_){ }
    await q(
      "update api.users set name=$2, role=$3, lab=$4, allowed_nmr300=$5, allowed_nmr400=$6, allowed_nmr500=$7, receive_mail=coalesce($8,receive_mail) where lower(email)=lower($1)",
      [email, b.name||'', roleToAssign, b.lab||'', !!b.allowed_nmr300, !!b.allowed_nmr400, !!b.allowed_nmr500, (b.receive_mail==null? null : !!b.receive_mail)]
    )
  }
  return {ok:true}
})
app.post('/admin/users/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const email=String(b.email||'').trim().toLowerCase()
  if(!email) return reply.code(400).send({error:'MISSING EMAIL'})
  try{
    // Refuse delete if user has any reservations (past or future)
    const { rows: rr } = await q("select count(*)::int as n from api.reservations where lower(user_email)=lower($1)",[email])
    if((rr[0]?.n||0) > 0){
      return reply.code(400).send({ error:'USER HAS BOOKINGS', code:'ERR_USER_HAS_BOOKINGS', count: rr[0].n })
    }
    // Clean up ancillary records
    try{ await q("delete from api.pass_reset_tokens where lower(email)=lower($1)",[email]) }catch(_){ }
    try{ await q("delete from api.blocked_users where lower(email)=lower($1)",[email]) }catch(_){ }
    // Delete user
    await q("delete from api.users where lower(email)=lower($1)",[email])
    return {ok:true}
  }catch(e){
    const msg = String(e.message||e)
    if(/foreign key|violates|restrict/i.test(msg)){
      return reply.code(400).send({ error:'USER HAS BOOKINGS', code:'ERR_USER_HAS_BOOKINGS' })
    }
    return reply.code(500).send({ error:'FAILED', detail: msg })
  }
})

// Block/unblock users (admin)
app.get('/admin/users/blocked', { preHandler: requireAdmin }, async (_req, _reply)=>{
  try{ await ensureBlockedTable() }catch(_){ }
  const { rows } = await q("select lower(email) as email, until, reason, created_at from api.blocked_users order by email")
  return rows
})
app.post('/admin/users/block', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const email=String(b.email||'').trim().toLowerCase(); const reason=String(b.reason||'').trim()
  if(!email) return reply.code(400).send({error:'MISSING EMAIL'})
  try{ await ensureBlockedTable() }catch(_){ }
  await q("insert into api.blocked_users(email, until, reason) values ($1, $2, $3) on conflict (email) do update set until=excluded.until, reason=excluded.reason", [email, null, reason||null])
  return { ok:true }
})
app.post('/admin/users/unblock', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const email=String(b.email||'').trim().toLowerCase(); if(!email) return reply.code(400).send({error:'MISSING EMAIL'})
  try{ await q("delete from api.blocked_users where lower(email)=lower($1)",[email]) }catch(_){ }
  return { ok:true }
})

// impersonation (DANTE only)
app.post('/admin/impersonate/start', { preHandler: requireDante }, async (req, reply)=>{
  const email = String(req.body?.email||'').trim().toLowerCase()
  if(!email) return reply.code(400).send({ error:'MISSING EMAIL' })
  if(email === req.user.email.toLowerCase()) return reply.code(400).send({ error:'CANNOT IMPERSONATE SELF' })
  try{
    const { rows } = await q("select email, role, coalesce(name,'') as name from api.users where lower(email)=lower($1)",[email])
    if(!rows.length) return reply.code(404).send({ error:'USER NOT FOUND' })
    const target = rows[0]
    const impersonationToken = makeToken(target.email, target.role, 2*60*60, { impersonator: req.user.email })
    try{
      await q("insert into api.audit(actor, action, ip, payload) values ($1,'IMPERSONATE_START',$2,$3)", [req.user.email, clientIp(req), JSON.stringify({ target: target.email })])
    }catch(_){ }
    return { token: impersonationToken, email: target.email, role: target.role, name: target.name, impersonator: req.user.email }
  }catch(e){
    return reply.code(500).send({ error:'FAILED' })
  }
})

app.post('/admin/impersonate/stop', { preHandler: requireAuth }, async (req, reply)=>{
  if(!req.user.impersonator) return reply.code(400).send({ error:'NOT IMPERSONATING' })
  try{
    await q("insert into api.audit(actor, action, ip, payload) values ($1,'IMPERSONATE_STOP',$2,$3)", [req.user.impersonator, clientIp(req), JSON.stringify({ target: req.user.email })])
  }catch(_){ }
  return { ok:true }
})

// pricing
app.get('/admin/pricing', { preHandler: requireAdmin }, async ()=> {
  const { rows } = await q("select id, resource, experiment, coalesce(nullif(probe,''),'GLOBAL') as probe, rate_code, rate_per_hour_eur, effective_from from api.pricing order by resource, experiment, coalesce(probe,''), effective_from desc")
  return rows
})
app.post('/admin/pricing/upsert', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const required=['resource','experiment','rate_code','rate_per_hour_eur','effective_from']
  for(const k of required){ if(b[k]==null||String(b[k]).trim()==='') return reply.code(400).send({error:`MISSING ${k.toUpperCase()}`}) }
  const price = Number(b.rate_per_hour_eur)
  if(isNaN(price)) return reply.code(400).send({error:'BAD PRICE'})
  const probe = String(b.probe ?? '').trim() || 'GLOBAL'
  try{
    const sql=`
      insert into api.pricing(resource,experiment,probe,rate_code,rate_per_hour_eur,effective_from)
      values ($1,$2,$3,$4,$5,$6::date)
      on conflict (resource,experiment,probe)
        do update set rate_code=excluded.rate_code, rate_per_hour_eur=excluded.rate_per_hour_eur, effective_from=excluded.effective_from
      returning *`
    const { rows } = await q(sql,[b.resource,b.experiment,probe,b.rate_code,price,b.effective_from])
    return rows[0]
  }catch(e){ return reply.code(400).send({ error:'PRICING_UPSERT_FAILED', detail:String(e.message||e) }) }
})
app.delete('/admin/pricing/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  if(!b.id) return reply.code(400).send({error:'MISSING ID'})
  await q("delete from api.pricing where id=$1",[Number(b.id)]); return {ok:true}
})

// IP blocklist admin
app.get('/admin/ips/blocked', { preHandler: requireAdmin }, async ()=>{
  try{ const { rows } = await q("select ip::text as ip, reason, created_at from api.blocked_ips order by created_at desc") ; return rows }catch(_){ return [] }
})
app.post('/admin/ips/block', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const ip=String(b.ip||'').trim(); const reason=String(b.reason||'').trim()
  if(!ip) return reply.code(400).send({error:'MISSING IP'})
  try{ await q("insert into api.blocked_ips(ip,reason) values ($1::cidr,$2) on conflict (ip) do update set reason=excluded.reason",[ip,reason||null]); return {ok:true} }catch(e){ return reply.code(400).send({error:'BAD IP'}) }
})
app.post('/admin/ips/unblock', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const ip=String(b.ip||'').trim(); if(!ip) return reply.code(400).send({error:'MISSING IP'})
  try{ await q("delete from api.blocked_ips where ip=$1::cidr",[ip]); return {ok:true} }catch(_){ return {ok:true} }
})

// resources (admin) with status + note
app.get('/admin/resources', { preHandler: requireAdmin }, async ()=> {
  // Ensure columns exist for probe metadata and color
  try{ await q("alter table if exists api.resources add column if not exists active_probe text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists default_probe text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists color_hex text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists past_slot_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_30m_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_3h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_12h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_24h_color text") }catch(_){ }
  const { rows } = await q(
    `select id,name,visible,advance_days,status,limitation_note,
            active_probe, default_probe,
            coalesce(color_hex,'') as color_hex,
            coalesce(past_slot_color,'') as past_slot_color,
            coalesce(slot_30m_color,'') as slot_30m_color,
            coalesce(slot_3h_color,'') as slot_3h_color,
            coalesce(slot_12h_color,'') as slot_12h_color,
            coalesce(slot_24h_color,'') as slot_24h_color
       from api.resources
      order by id`
  ); 
  return rows
})
app.post('/admin/resources/save', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const name=String(b.name||'').trim()
  if(!name) return reply.code(400).send({error:'MISSING NAME'})
  // Ensure columns exist
  try{ await q("alter table if exists api.resources add column if not exists active_probe text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists default_probe text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists color_hex text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists past_slot_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_30m_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_3h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_12h_color text") }catch(_){ }
  try{ await q("alter table if exists api.resources add column if not exists slot_24h_color text") }catch(_){ }
  // Build dynamic update to avoid wiping fields when not provided (e.g., from mobile admin)
  const sets = []
  const args = [ name ]
  let idx = 2
  if(Object.prototype.hasOwnProperty.call(b,'visible')){
    sets.push(`visible=$${idx++}`)
    args.push(!!b.visible)
  }
  if(Object.prototype.hasOwnProperty.call(b,'advance_days')){
    const adv = Number(b.advance_days)
    sets.push(`advance_days=$${idx++}`)
    args.push(Number.isFinite(adv) ? adv : 0)
  }
  if(Object.prototype.hasOwnProperty.call(b,'status')){
    const st = String(b.status||'').toUpperCase()
    const status = ['OK','LIMITED','DOWN'].includes(st) ? st : 'OK'
    sets.push(`status=$${idx++}`)
    args.push(status)
  }
  if(Object.prototype.hasOwnProperty.call(b,'limitation_note')){
    sets.push(`limitation_note=$${idx++}`)
    args.push(String(b.limitation_note||''))
  }
  if(Object.prototype.hasOwnProperty.call(b,'active_probe')){
    sets.push(`active_probe=$${idx++}`)
    const ap = String(b.active_probe||'').trim(); args.push(ap?ap:null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'default_probe')){
    sets.push(`default_probe=$${idx++}`)
    const dp = String(b.default_probe||'').trim(); args.push(dp?dp:null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'color_hex')){
    sets.push(`color_hex=$${idx++}`)
    const ch = String(b.color_hex||'').trim();
    // allow empty to clear
    args.push(ch||null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'past_slot_color')){
    sets.push(`past_slot_color=$${idx++}`)
    const val = String(b.past_slot_color||'').trim();
    args.push(val||null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'slot_30m_color')){
    sets.push(`slot_30m_color=$${idx++}`)
    const val = String(b.slot_30m_color||'').trim();
    args.push(val||null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'slot_3h_color')){
    sets.push(`slot_3h_color=$${idx++}`)
    const val = String(b.slot_3h_color||'').trim();
    args.push(val||null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'slot_12h_color')){
    sets.push(`slot_12h_color=$${idx++}`)
    const val = String(b.slot_12h_color||'').trim();
    args.push(val||null)
  }
  if(Object.prototype.hasOwnProperty.call(b,'slot_24h_color')){
    sets.push(`slot_24h_color=$${idx++}`)
    const val = String(b.slot_24h_color||'').trim();
    args.push(val||null)
  }
  if(!sets.length) return reply.code(400).send({ error:'NO FIELDS PROVIDED' })
  const sql = `update api.resources set ${sets.join(', ')} where name=$1`
  await q(sql, args)
  return { ok:true }
})

// caps & cancel rules (admin)
app.get('/admin/caps', { preHandler: requireAdmin }, async ()=> {
  // Ensure table and columns exist (for upgraded DBs)
  try{
    await q("create table if not exists api.caps(resource text not null, block_label text not null, per_day_hours int, per_week_hours int, primary key(resource,block_label))")
  }catch(_){ }
  try{ await q("alter table if exists api.caps add column if not exists per_day_hours int") }catch(_){ }
  try{ await q("alter table if exists api.caps add column if not exists per_week_hours int") }catch(_){ }
  const { rows } = await q("select resource,block_label,coalesce(per_day_hours,0) as per_day_hours, coalesce(per_week_hours,0) as per_week_hours from api.caps order by resource,block_label"); return rows
})
app.post('/admin/caps/upsert', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  if(!b.resource||!b.block_label||(b.per_day_hours==null && b.per_week_hours==null)) return reply.code(400).send({error:'MISSING FIELDS'})
  const day = (Number(b.per_day_hours)||0); const week=(Number(b.per_week_hours)||0)
  try{
    await q("create table if not exists api.caps(resource text not null, block_label text not null, per_day_hours int, per_week_hours int, primary key(resource,block_label))")
    // Ensure upgraded DBs have the new columns
    try{ await q("alter table if exists api.caps add column if not exists per_day_hours int") }catch(_){ }
    try{ await q("alter table if exists api.caps add column if not exists per_week_hours int") }catch(_){ }
    // Legacy column from older schema: make it nullable with default 0 to avoid insert failures
    try{ await q("alter table if exists api.caps add column if not exists max_future_minutes int") }catch(_){ }
    try{ await q("alter table api.caps alter column max_future_minutes drop not null") }catch(_){ }
    try{ await q("alter table api.caps alter column max_future_minutes set default 0") }catch(_){ }
    await q("insert into api.caps(resource,block_label,per_day_hours,per_week_hours,max_future_minutes) values ($1,$2,$3,$4,0) on conflict (resource,block_label) do update set per_day_hours=excluded.per_day_hours, per_week_hours=excluded.per_week_hours, max_future_minutes=excluded.max_future_minutes",
      [b.resource,b.block_label,day,week])
    return {ok:true}
  }catch(e){ return reply.code(500).send({ error:'FAILED', detail:String(e.message||e) }) }
})
app.post('/admin/caps/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  if(!b.resource||!b.block_label) return reply.code(400).send({error:'MISSING FIELDS'})
  try{ await q("delete from api.caps where resource=$1 and block_label=$2",[b.resource,b.block_label]); return {ok:true} }
  catch(e){ return reply.code(500).send({ error:'FAILED', detail:String(e.message||e) }) }
})

// Reset caps to default set (exactly the requested lines)
app.post('/admin/caps/reset_defaults', { preHandler: requireAdmin }, async (_req, reply)=>{
  try{
    await q("create table if not exists api.caps(resource text not null, block_label text not null, per_day_hours int, per_week_hours int, primary key(resource,block_label))")
    // Ensure legacy column will not interfere
    try{ await q("alter table if exists api.caps add column if not exists max_future_minutes int") }catch(_){ }
    try{ await q("alter table api.caps alter column max_future_minutes drop not null") }catch(_){ }
    try{ await q("alter table api.caps alter column max_future_minutes set default 0") }catch(_){ }
    await q("delete from api.caps")
    const rows = [
      ['NMR300','30m',2,4],
      ['NMR300','3h',6,12],
      ['NMR300','12h',0,0],
      ['NMR300','24h',0,0],
      ['NMR400','30m',1,2],
      ['NMR400','3h',6,12],
      ['NMR400','12h',0,0],
      ['NMR400','24h',0,0],
      ['NMR500','12h',0,0],
    ]
    for(const r of rows){ await q("insert into api.caps(resource,block_label,per_day_hours,per_week_hours,max_future_minutes) values ($1,$2,$3,$4,0)", r) }
    return { ok:true, inserted: rows.length }
  }catch(e){ return reply.code(500).send({ error:'FAILED', detail:String(e.message||e) }) }
})

app.get('/admin/cancel_rules', { preHandler: requireAdmin }, async ()=> {
  const { rows } = await q("select resource,block_label,cutoff_minutes from api.cancel_rules order by resource,block_label"); return rows
})
app.post('/admin/cancel_rules/upsert', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  if(!b.resource||!b.block_label||b.cutoff_minutes==null) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("insert into api.cancel_rules(resource,block_label,cutoff_minutes) values ($1,$2,$3) on conflict (resource,block_label) do update set cutoff_minutes=excluded.cutoff_minutes",
    [b.resource,b.block_label,Number(b.cutoff_minutes)])
  return {ok:true}
})
app.post('/admin/cancel_rules/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  if(!b.resource||!b.block_label) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("delete from api.cancel_rules where resource=$1 and block_label=$2",[b.resource,b.block_label])
  return {ok:true}
})

// Approvals
app.get('/admin/reservations/pending', { preHandler: requireAdmin }, async ()=>{
  const { rows } = await q(`
    select id, user_email, resource, start_ts, end_ts, experiment, probe, label, price_eur, rate_code, status
      from api.reservations
     where status in ('PENDING','CANCEL_PENDING')
     order by case when status='CANCEL_PENDING' then 0 else 1 end, start_ts`)
  return rows
})
app.post('/admin/reservations/approve', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id)
  if(!id) return reply.code(400).send({error:'MISSING ID'})
  // Approve booking request or approve cancellation request
  const { rows: cur } = await q("select * from api.reservations where id=$1",[id])
  if(!cur.length) return reply.code(404).send({error:'NOT FOUND'})
  let rows
  if(cur[0].status==='CANCEL_PENDING'){
    rows = (await q("update api.reservations set status='CANCELED', canceled_at=now(), canceled_by=$2 where id=$1 returning *",[id, req.user.email])).rows
  } else {
    rows = (await q("update api.reservations set status='APPROVED' where id=$1 and status='PENDING' returning *",[id])).rows
  }
  if(!rows.length) return reply.code(404).send({error:'NOT FOUND OR NOT PENDING'})
  const row = rows[0]
  await q("insert into api.audit(actor,action,ip,reservation_id,payload) values ($1,'APPROVE',$2,$3,$4)", [req.user.actor, clientIp(req), id, JSON.stringify({ id })])
  try{
    if(String(row?.bill_to_type||'LAB')!=='CLIENT'){
      const staff = await getStaffEmails()
      if(cur[0].status==='CANCEL_PENDING') await notifyCancelApproved(row, { email: req.user.actor })
      else await notifyApproved(row, staff, { email: req.user.actor })
    }
  }catch(_){ }
  return row
})
app.post('/admin/reservations/deny', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id)
  if(!id) return reply.code(400).send({error:'MISSING ID'})
  // Deny booking request or deny cancel request
  const { rows: cur } = await q("select * from api.reservations where id=$1",[id])
  if(!cur.length) return reply.code(404).send({error:'NOT FOUND'})
  let rows
  if(cur[0].status==='CANCEL_PENDING'){
    rows = (await q("update api.reservations set status='APPROVED' where id=$1 returning *",[id])).rows
  } else {
    rows = (await q("update api.reservations set status='CANCELED', canceled_at=now(), canceled_by=$2 where id=$1 and status='PENDING' returning *",[id, req.user.email])).rows
  }
  if(!rows.length) return reply.code(404).send({error:'NOT FOUND OR NOT PENDING'})
  const row = rows[0]
  await q("insert into api.audit(actor,action,ip,reservation_id,payload) values ($1,'DENY',$2,$3,$4)", [req.user.email, clientIp(req), id, JSON.stringify({ id })])
  try{
    if(String(row?.bill_to_type||'LAB')!=='CLIENT'){
      const staff = await getStaffEmails()
      if(cur[0].status==='CANCEL_PENDING') await notifyCancelDenied(row, { email: req.user.email })
      else await notifyDenied(row, staff)
    }
  }catch(_){ }
  return row
})

// Admin remove any reservation (including past), with mandatory reason
app.post('/admin/reservations/remove', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id); const reason=String(b.reason||'').trim()
  if(!id || !reason) return reply.code(400).send({error:'MISSING ID/REASON'})
  try{
    const { rows: chk } = await q("select 1 from api.reservations where id=$1",[id])
    if(!chk.length) return reply.code(404).send({error:'NOT FOUND'})
    const { rows } = await q("update api.reservations set status='CANCELED', canceled_at=now(), canceled_by=$2 where id=$1 returning *",[id, req.user.email])
    if(!rows.length) return reply.code(404).send({error:'NOT FOUND'})
    await q("insert into api.audit(actor,action,ip,reservation_id,payload) values ($1,'ADMIN_REMOVE',$2,$3,$4)", [req.user.email, clientIp(req), id, JSON.stringify({ reason })])
    try{ await notifyCanceled(rows[0], req.user.email, reason) }catch(_){ }
    return rows[0]
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})

// Admin broadcast mail to all users
app.post('/admin/notify/all', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const subject = String(b.subject||'').trim()
  const text    = String(b.text||'').trim()
  if(!subject || !text) return reply.code(400).send({error:'MISSING SUBJECT/TEXT'})
  const { rows } = await q("select email from api.users order by email")
  const emails = rows.map(r=>r.email)
  try{
    await notifyBroadcastAll(subject, text, emails)
    try{ await q("insert into api.audit(actor, action, ip, payload) values ($1,'BROADCAST',$2,$3)", [req.user.email, clientIp(req), JSON.stringify({ subject, recipients: emails.length })]) }catch(_){ }
    return { ok:true, recipients: emails.length }
  }catch(e){
    return reply.code(500).send({ error: 'MAIL_FAILED', detail: String(e.message||e) })
  }
})

// Admin: list broadcast mail log from audit
app.get('/admin/notify/log', { preHandler: requireAdmin }, async (_req, _reply)=>{
  const sql = `select id, ts, actor, payload->>'subject' as subject, (payload->>'recipients')::int as recipients
                 from api.audit where action='BROADCAST' order by ts desc limit 200`;
  const { rows } = await q(sql)
  return rows
})

// Admin: export audit log as CSV (ts, actor, action, ip, reservation_id, payload_json)
app.get('/admin/audit/export', { preHandler: requireAdmin }, async (req, reply)=>{
  const limit = Math.min(Math.max(parseInt(String(req.query.limit||'5000'),10)||5000, 1), 100000)
  const { rows } = await q("select ts, actor, action, coalesce(ip,'') as ip, coalesce(reservation_id,0) as reservation_id, payload from api.audit order by ts desc limit $1", [limit])
  const esc = (s)=> '"'+String(s).replaceAll('"','""')+'"'
  const header = ['ts','actor','action','ip','reservation_id','payload']
  const lines = [header.join(',')]
  for(const r of rows){
    lines.push([
      new Date(r.ts).toISOString(),
      r.actor||'',
      r.action||'',
      r.ip||'',
      r.reservation_id||'',
      JSON.stringify(r.payload||{})
    ].map(esc).join(','))
  }
  const csv = lines.join('\n')+'\n'
  reply.header('Content-Type','text/csv; charset=utf-8')
  reply.header('Content-Disposition', 'attachment; filename="audit.csv"')
  return reply.send(csv)
})

// Admin: list all reservations (recent first)
app.get('/admin/reservations/all', { preHandler: requireAdmin }, async (req, reply)=>{
  const limit = Math.min(Math.max(parseInt(String(req.query.limit||'500'),10)||500, 1), 5000)
  const email = String(req.query.email||'').trim().toLowerCase()
  const name = String(req.query.name||'').trim()
  const resource = String(req.query.resource||'').trim()
  const statusParam = String(req.query.status||'').trim().toUpperCase()

  const allowedStatuses = new Set(['APPROVED','PENDING','CANCEL_PENDING','CANCELED'])
  const statuses = statusParam
    ? statusParam.split(',').map(s=>s.trim()).filter(s=>allowedStatuses.has(s))
    : []

  const where = []
  const params = []
  let idx = 1

  if(email){
    where.push(`lower(b.user_email) like $${idx++}`)
    params.push(`%${email}%`)
  }
  if(name){
    where.push(`lower(coalesce(u.name,'') ) like $${idx++}`)
    params.push(`%${name.toLowerCase()}%`)
  }
  if(resource){
    where.push(`b.resource = $${idx++}`)
    params.push(resource)
  }
  if(statuses.length === 1){
    where.push(`b.status = $${idx++}`)
    params.push(statuses[0])
  }else if(statuses.length > 1){
    where.push(`b.status = ANY($${idx++}::text[])`)
    params.push(statuses)
  }

  params.push(limit)

  const sql = `
    with base as (
      select r.*,
             dur.hours as duration_hours,
             coalesce(pf.code, r.rate_code) as derived_rate_code,
             case
               when pf.rate is not null then round(dur.hours * pf.rate::numeric, 2)
               when r.total_price_eur is not null then round(r.total_price_eur::numeric, 2)
               else round(r.price_eur::numeric, 2)
             end as derived_price_eur
        from api.reservations r
        cross join lateral (
          select round(((extract(epoch from (r.end_ts - r.start_ts)) / 3600.0)::numeric), 4) as hours
        ) dur
        left join lateral (
          select p.rate_per_hour_eur as rate, p.rate_code as code
            from api.pricing p
           where p.resource = r.resource
             and p.experiment = r.experiment
             and (
               coalesce(btrim(p.probe),'') = coalesce(btrim(r.probe),'')
               or p.probe = '*'
               or upper(coalesce(btrim(p.probe),'')) = 'GLOBAL'
               or coalesce(btrim(p.probe),'') = ''
             )
             and coalesce(p.effective_from, date '1900-01-01') <= (r.start_ts at time zone 'UTC')::date
           order by
             case
               when coalesce(btrim(p.probe),'') = coalesce(btrim(r.probe),'') then 0
               when p.probe = '*' then 1
               when upper(coalesce(btrim(p.probe),'')) = 'GLOBAL' then 2
               when coalesce(btrim(p.probe),'') = '' then 3
               else 4
             end,
             p.effective_from desc
           limit 1
        ) pf on true
    )
    select b.id,
           b.user_email,
           coalesce(u.name,'') as user_name,
           b.resource,
           b.start_ts,
           b.end_ts,
           b.experiment,
           b.probe,
           b.label,
           b.status,
           b.derived_price_eur as price_eur,
           b.derived_rate_code as rate_code,
           b.created_at,
           b.canceled_at,
           b.canceled_by,
           adm.reason as admin_remove_reason,
           adm.ts     as admin_remove_ts
      from base b
      left join api.users u on lower(u.email) = lower(b.user_email)
      left join lateral (
        select a.payload->>'reason' as reason, a.ts
          from api.audit a
         where a.reservation_id = b.id and a.action = 'ADMIN_REMOVE'
         order by a.ts desc
         limit 1
      ) adm on true
      ${where.length ? 'where ' + where.join(' and ') : ''}
      order by b.id desc
      limit $${idx}
  `
  const { rows } = await q(sql, params)
  return rows
})

// Public: bulletin (latest published)
app.get('/public/bulletin', async ()=>{
  // Always include resource statuses
  let resources = []
  try{
    const { rows: res } = await q("select name, status, coalesce(limitation_note,'') as note from api.resources order by id")
    resources = res
  }catch(_){ resources = [] }

  // Latest admin bulletin text (if any)
  let text = ''
  let published_by = ''
  let published_at = ''
  try{
    const sql = `
      select a.action, a.payload, a.ts, a.actor, coalesce(nullif(u.name,''), a.actor) as actor_name
        from api.audit a
        left join api.users u on lower(u.email)=lower(a.actor)
       where a.action in ('BULLETIN_PUBLISH','BULLETIN_REMOVE')
       order by a.ts desc
       limit 1`;
    const { rows } = await q(sql)
    if(rows.length && rows[0].action==='BULLETIN_PUBLISH'){
      const p = rows[0].payload||{}
      text = String(p.text||'').trim()
      published_by = rows[0].actor_name || rows[0].actor || ''
      published_at = rows[0].ts
    }
  }catch(_){ }

  return { text, published_by, published_at, resources }
})

// Admin: publish/remove bulletin
app.post('/admin/bulletin/save', { preHandler: requireAdmin }, async (req)=>{
  const b=req.body||{}; const text=String(b.text||'').trim();
  await q("insert into api.audit(actor,action,ip,payload) values ($1,'BULLETIN_PUBLISH',$2,$3)", [req.user.email, clientIp(req), JSON.stringify({ text })])
  return { ok:true }
})
app.post('/admin/bulletin/remove', { preHandler: requireAdmin }, async (req)=>{
  await q("insert into api.audit(actor,action,ip,payload) values ($1,'BULLETIN_REMOVE',$2,$3)", [req.user.email, clientIp(req), JSON.stringify({})])
  return { ok:true }
})
app.get('/admin/bulletin/log', { preHandler: requireAdmin }, async ()=>{
  const sql = `
    with recent as (
      select *
        from (
          select a.ts, a.actor, a.action, a.payload,
                 coalesce(nullif(u.name,''), a.actor) as actor_name
            from api.audit a
            left join api.users u on lower(u.email)=lower(a.actor)
           where a.action in ('BULLETIN_PUBLISH','BULLETIN_REMOVE')
           order by a.ts desc
           limit 400
        ) sub
       order by sub.ts asc
    )
    select * from recent`;

  const { rows } = await q(sql)

  const history = []
  const findLatestOpen = () => {
    for(let i = history.length - 1; i >= 0; i -= 1){
      if(!history[i].removed_at) return history[i]
    }
    return null
  }

  for(const row of rows){
    const payload = row?.payload && typeof row.payload === 'object'
      ? row.payload
      : (()=>{ try{ return row?.payload ? JSON.parse(row.payload) : {} }catch(_){ return {} } })()
    const actorEmail = row?.actor ? String(row.actor).trim() : ''
    const actorName = row?.actor_name ? String(row.actor_name).trim() : actorEmail
    if(row.action === 'BULLETIN_PUBLISH'){
      const open = findLatestOpen()
      if(open && !open.removed_at){
        open.removed_at = row.ts
        open.removed_by = actorEmail || null
        open.removed_by_name = actorName
        open.removal_action = 'SUPERSEDED'
      }
      history.push({
        text: String(payload?.text || ''),
        published_at: row.ts,
        published_by: actorEmail || null,
        published_by_name: actorName,
        removed_at: null,
        removed_by: null,
        removed_by_name: null,
        removal_action: null,
      })
    }else if(row.action === 'BULLETIN_REMOVE'){
      const open = findLatestOpen()
      if(open && !open.removed_at){
        open.removed_at = row.ts
        open.removed_by = actorEmail || null
        open.removed_by_name = actorName
        open.removal_action = 'REMOVED'
      }
    }
  }

  history.sort((a, b)=> new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
  return history
})

// Public: list staff
app.get('/public/staff', async ()=>{ return await getStaffList() })

// Public: contact staff (optionally target one email)
app.post('/public/contact', async (req, reply)=>{
  const b=req.body||{}; const name=String(b.name||'').trim(); const contact=String(b.contact||'').trim(); const msg=String(b.message||'').trim();
  if(!msg) return reply.code(400).send({error:'MISSING MESSAGE'})
  const list = await getStaffEmails()
  const to = String(b.to||'').trim().toLowerCase()
  try{
    if(to && list.map(e=>String(e).toLowerCase()).includes(to)){
      await notifyContactOne(to, name, contact, msg)
    }else{
      // No valid target specified → contact all staff
      await notifyContact(list, name, contact, msg)
    }
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'MAIL_FAILED'}) }
})

// Admin: maintenance windows
app.get('/admin/maintenance', { preHandler: requireAdmin }, async ()=>{
  const { rows } = await q("select id, resource, start_ts, end_ts, reason from api.maintenance_windows order by start_ts desc")
  return rows
})
app.post('/admin/maintenance/add', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const resources=Array.isArray(b.resources)? b.resources.filter(Boolean):[]; const repeat=String(b.repeat||'once').toLowerCase();
  const start=String(b.start||'').trim(); const end=String(b.end||'').trim(); const untilStr=String(b.until||'').trim()
  if(!resources.length || !start || !end) return reply.code(400).send({error:'MISSING FIELDS'})
  const addOne = async (resource, s, e)=>{ await q("insert into api.maintenance_windows(resource,start_ts,end_ts,reason) values ($1,$2,$3,$4)",[resource,s,e,String(b.reason||'')]) }
  try{
    for(const rname of resources){
      if(repeat==='weekly' || repeat==='daily' || repeat==='biweekly'){
        let s=new Date(start), e=new Date(end)
        const stepDays = repeat==='weekly'? 7 : (repeat==='biweekly' ? 14 : 1)
        let count=0
        const maxIters = repeat==='weekly'? 26 : (repeat==='biweekly'? 13 : 60) // safety cap (~6/6/2 months)
        const until = untilStr ? new Date(untilStr) : null
        while(true){
          await addOne(rname, s.toISOString(), e.toISOString())
          count++
          if(until){ if(s >= until) break }
          if(!until && count>=maxIters) break
          s.setDate(s.getDate()+stepDays); e.setDate(e.getDate()+stepDays)
        }
      } else {
        await addOne(rname, start, end)
      }
    }
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})
app.post('/admin/maintenance/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id)
  if(!id) return reply.code(400).send({error:'MISSING ID'})
  await q("delete from api.maintenance_windows where id=$1",[id]); return { ok:true }
})

// Stop a recurring series from a given occurrence onward (best-effort heuristic)
app.post('/admin/maintenance/stop', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id)
  if(!id) return reply.code(400).send({error:'MISSING ID'})
  // Load the reference row
  const { rows } = await q("select id, resource, start_ts, end_ts from api.maintenance_windows where id=$1",[id])
  if(!rows.length) return reply.code(404).send({error:'NOT FOUND'})
  const row = rows[0]
  // Duration in seconds and time-of-day match to identify series
  const sql = `
    delete from api.maintenance_windows m
     where m.resource=$1
       and m.start_ts >= $2
       and extract(hour from m.start_ts)=extract(hour from $2::timestamptz)
       and extract(minute from m.start_ts)=extract(minute from $2::timestamptz)
       and extract(epoch from (m.end_ts-m.start_ts)) = extract(epoch from ($3::timestamptz - $2::timestamptz))
       returning id`;
  const res = await q(sql, [row.resource, row.start_ts, row.end_ts])
  return { ok:true, removed: res.rowCount }
})

// Admin: training windows (mirrors maintenance)
app.get('/admin/training', { preHandler: requireAdmin }, async ()=>{
  await ensureTrainingWindowsTable()
  const { rows } = await q("select id, resource, start_ts, end_ts, reason from api.training_windows order by start_ts desc")
  return rows
})
app.post('/admin/training/add', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const resources=Array.isArray(b.resources)? b.resources.filter(Boolean):[]; const repeat=String(b.repeat||'once').toLowerCase();
  const start=String(b.start||'').trim(); const end=String(b.end||'').trim(); const untilStr=String(b.until||'').trim()
  if(!resources.length || !start || !end) return reply.code(400).send({error:'MISSING FIELDS'})
  await ensureTrainingWindowsTable()
  const addOne = async (resource, s, e)=>{ await q("insert into api.training_windows(resource,start_ts,end_ts,reason) values ($1,$2,$3,$4)",[resource,s,e,String(b.reason||'')]) }
  try{
    for(const rname of resources){
      if(repeat==='weekly' || repeat==='daily' || repeat==='biweekly'){
        let s=new Date(start), e=new Date(end)
        const stepDays = repeat==='weekly'? 7 : (repeat==='biweekly' ? 14 : 1)
        let count=0
        const maxIters = repeat==='weekly'? 26 : (repeat==='biweekly'? 13 : 60) // safety cap (~6/6/2 months)
        const until = untilStr ? new Date(untilStr) : null
        while(true){
          await addOne(rname, s.toISOString(), e.toISOString())
          count++
          if(until){ if(s >= until) break }
          if(!until && count>=maxIters) break
          s.setDate(s.getDate()+stepDays); e.setDate(e.getDate()+stepDays)
        }
      } else {
        await addOne(rname, start, end)
      }
    }
    return { ok:true }
  }catch(e){ return reply.code(500).send({error:'FAILED'}) }
})
app.post('/admin/training/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id)
  if(!id) return reply.code(400).send({error:'MISSING ID'})
  await ensureTrainingWindowsTable()
  await q("delete from api.training_windows where id=$1",[id]); return { ok:true }
})

app.post('/admin/training/stop', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=Number(b.id)
  if(!id) return reply.code(400).send({error:'MISSING ID'})
  await ensureTrainingWindowsTable()
  const { rows } = await q("select id, resource, start_ts, end_ts from api.training_windows where id=$1",[id])
  if(!rows.length) return reply.code(404).send({error:'NOT FOUND'})
  const row = rows[0]
  const sql = `
    delete from api.training_windows t
     where t.resource=$1
       and t.start_ts >= $2
       and extract(hour from t.start_ts)=extract(hour from $2::timestamptz)
       and extract(minute from t.start_ts)=extract(minute from $2::timestamptz)
       and extract(epoch from (t.end_ts-t.start_ts)) = extract(epoch from ($3::timestamptz - $2::timestamptz))
       returning id`;
  const res = await q(sql, [row.resource, row.start_ts, row.end_ts])
  return { ok:true, removed: res.rowCount }
})

// Admin: send a test mail to verify SMTP
app.post('/admin/notify/test', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}
  const to = String(b.to||'').trim() || (process.env.FROM_EMAIL || process.env.SMTP_USER || '')
  if(!to) return reply.code(400).send({error:'MISSING RECIPIENT'})
  try{
    await notifyTest(to)
    return { ok:true, to }
  }catch(e){
    return reply.code(500).send({ error:'MAIL_FAILED', detail: String(e.message||e) })
  }
})

// Probes admin
app.get('/admin/probes', { preHandler: requireAdmin }, async ()=>{
  const { rows } = await q("select resource, probe, active from api.resource_probes order by resource, probe")
  return rows
})
app.post('/admin/probes/upsert', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.resource||!b.probe||b.active==null) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("insert into api.resource_probes(resource,probe,active) values ($1,$2,$3) on conflict (resource,probe) do update set active=excluded.active",
    [b.resource, b.probe, !!b.active])
  return {ok:true}
})
app.post('/admin/probes/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.resource||!b.probe) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("delete from api.resource_probes where resource=$1 and probe=$2", [b.resource,b.probe])
  return {ok:true}
})

// Experiments admin
app.get('/admin/experiments', { preHandler: requireAdmin }, async ()=>{
  const { rows: exps } = await q("select code,name,requires_approval from api.experiments order by code")
  const { rows: map }  = await q("select resource, experiment_code as code, requires_approval from api.resource_experiments order by resource, experiment_code")
  return { experiments: exps, resource_overrides: map }
})
app.post('/admin/experiments/upsert', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.code||!b.name||b.requires_approval==null) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("insert into api.experiments(code,name,requires_approval) values ($1,$2,$3) on conflict (code) do update set name=excluded.name, requires_approval=excluded.requires_approval",
    [b.code, b.name, !!b.requires_approval])
  return {ok:true}
})
app.post('/admin/experiments/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.code) return reply.code(400).send({error:'MISSING CODE'})
  try{
    // Remove per-resource overrides first to satisfy FK constraint
    await q("delete from api.resource_experiments where experiment_code=$1", [b.code])
    await q("delete from api.experiments where code=$1", [b.code])
    return {ok:true}
  }catch(e){ return reply.code(400).send({error:'DELETE FAILED', detail:String(e.message||e)}) }
})
app.post('/admin/resource_experiments/upsert', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.resource||!b.code||b.requires_approval==null) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("insert into api.resource_experiments(resource,experiment_code,requires_approval) values ($1,$2,$3) on conflict (resource,experiment_code) do update set requires_approval=excluded.requires_approval",
    [b.resource, b.code, !!b.requires_approval])
  return {ok:true}
})
app.post('/admin/resource_experiments/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.resource||!b.code) return reply.code(400).send({error:'MISSING FIELDS'})
  await q("delete from api.resource_experiments where resource=$1 and experiment_code=$2", [b.resource, b.code])
  return {ok:true}
})

// Pricing defaults reset
app.post('/admin/pricing/reset_defaults', { preHandler: requireAdmin }, async (req, reply)=>{
  // REGULAR = 1, VT = 2 €/h, for all resource × experiment; probe collapsed to '*'
  const { rows: resources } = await q("select name from api.resources order by name")
  const { rows: exps } = await q("select code from api.experiments order by code")
  let inserted = 0
  for(const r of resources){
    for(const e of exps){
      const rate = e.code==='VT' ? 2 : 1
      await q(
        `insert into api.pricing(resource,experiment,probe,rate_code,rate_per_hour_eur,effective_from)
         values ($1,$2,'*',$3,$4,current_date)
         on conflict (resource,experiment,probe)
           do update set rate_code=excluded.rate_code, rate_per_hour_eur=excluded.rate_per_hour_eur, effective_from=excluded.effective_from`,
        [r.name, e.code, rate===2?'VT':'REG', rate]
      )
      inserted++
    }
  }
  return { ok:true, updated: inserted }
})
// reports (admin)
app.get('/admin/reports/usage', { preHandler: requireAdmin }, async (req, reply)=>{
  const sql = `
    select user_email, resource,
           round(sum(extract(epoch from (end_ts-start_ts))/3600.0)::numeric, 2) as hours,
           round(sum(price_eur)::numeric, 2) as cost_eur
      from api.reservations
     where status='APPROVED' and end_ts >= now() - interval '30 days' and coalesce(bill_to_type,'LAB')='LAB'
     group by user_email, resource
     order by user_email, resource`;
  const { rows } = await q(sql)
  return rows
})

app.get('/admin/report', { preHandler: requireAdmin }, async (req, reply)=>{
  const start = String(req.query.start||'').trim()
  const end   = String(req.query.end||'').trim()
  const resource = String(req.query.resource||'').trim()
  const user     = String(req.query.user||'').trim()
  const format   = String(req.query.format||'json').trim().toLowerCase()
  const group    = String(req.query.group||'').trim().toLowerCase() // '' | 'lab'
  const billing  = String(req.query.billing||'ALL').trim().toUpperCase() // ALL | LAB | CLIENT

  if(!start || !end) return reply.code(400).send({error:'MISSING START/END'})

  const where = ["r.status='APPROVED'", 'r.start_ts >= $1', 'r.end_ts <= $2']
  const args = [start, end]
  if(resource){ where.push('r.resource=$' + (args.length+1)); args.push(resource) }
  if(user){ where.push('lower(r.user_email)=lower($' + (args.length+1) + ')'); args.push(user) }
  if(billing === 'LAB') where.push("coalesce(r.bill_to_type,'LAB')='LAB'")
  else if(billing === 'CLIENT') where.push("coalesce(r.bill_to_type,'LAB')='CLIENT'")

  // Per-lab aggregate CSV
  if(format==='csv' && group==='lab'){
    const sqlLab = `
      with base as (
        select coalesce(u.lab,'') as lab,
               dur.hours,
               case
                 when pf.rate is not null then round(dur.hours * pf.rate::numeric, 2)
                 when r.total_price_eur is not null then round(r.total_price_eur::numeric, 2)
                 else round(r.price_eur::numeric, 2)
               end as price_eur
          from api.reservations r
          left join api.users u on lower(u.email)=lower(r.user_email)
          cross join lateral (
            select round(((extract(epoch from (r.end_ts - r.start_ts)) / 3600.0)::numeric), 4) as hours
          ) dur
          left join lateral (
            select p.rate_per_hour_eur as rate, p.rate_code as code
              from api.pricing p
             where p.resource = r.resource
               and p.experiment = r.experiment
               and (
                 coalesce(btrim(p.probe),'') = coalesce(btrim(r.probe),'')
                 or p.probe = '*'
                 or upper(coalesce(btrim(p.probe),'')) = 'GLOBAL'
                 or coalesce(btrim(p.probe),'') = ''
               )
               and coalesce(p.effective_from, date '1900-01-01') <= (r.start_ts at time zone 'UTC')::date
             order by
               case
                 when coalesce(btrim(p.probe),'') = coalesce(btrim(r.probe),'') then 0
                 when p.probe = '*' then 1
                 when upper(coalesce(btrim(p.probe),'')) = 'GLOBAL' then 2
                 when coalesce(btrim(p.probe),'') = '' then 3
                 else 4
               end,
               p.effective_from desc
             limit 1
          ) pf on true
         where ${where.join(' and ')}
      )
      select lab,
             round(sum(hours)::numeric, 2) as hours,
             round(sum(price_eur)::numeric, 2) as cost_eur
        from base
        group by lab
        order by lab`;
    const { rows: labs } = await q(sqlLab, args)
    const header = ['lab','hours','cost_eur']
    const lines = [header.join(',')]
    for(const r of labs){
      const vals = [r.lab||'', Number(r.hours||0).toFixed(2), Number(r.cost_eur||0).toFixed(2)]
      lines.push(vals.map(v=> String(v).includes(',')? ('"'+String(v).replaceAll('"','""')+'"') : String(v)).join(','))
    }
    const total_hours = labs.reduce((s,r)=> s + Number(r.hours||0), 0)
    const total_eur   = labs.reduce((s,r)=> s + Number(r.cost_eur||0), 0)
    const csv = lines.join('\n') + `\nTOTAL_HOURS,${total_hours.toFixed(2)}\nTOTAL_EUR,${Number(total_eur).toFixed(2)}\n`
    reply.header('Content-Type','text/csv; charset=utf-8')
    return reply.send(csv)
  }

  // Detailed rows with lab column
  const sqlRows = `
    with base as (
      select r.id,
             r.user_email,
             coalesce(u.lab,'') as lab,
             r.resource,
             r.start_ts,
             r.end_ts,
             dur.hours,
             coalesce(pf.code, r.rate_code) as rate_code,
             case
               when pf.rate is not null then round(dur.hours * pf.rate::numeric, 2)
               when r.total_price_eur is not null then round(r.total_price_eur::numeric, 2)
               else round(r.price_eur::numeric, 2)
             end as price_eur
             ,coalesce(r.bill_to_type,'LAB') as bill_to_type
             ,r.bill_to_client_id
             ,coalesce(c.name,'') as client_name
        from api.reservations r
        left join api.users u on lower(u.email)=lower(r.user_email)
        left join api.clients c on c.id = r.bill_to_client_id
        cross join lateral (
          select round(((extract(epoch from (r.end_ts - r.start_ts)) / 3600.0)::numeric), 4) as hours
        ) dur
        left join lateral (
          select p.rate_per_hour_eur as rate, p.rate_code as code
            from api.pricing p
           where p.resource = r.resource
             and p.experiment = r.experiment
             and (
               coalesce(btrim(p.probe),'') = coalesce(btrim(r.probe),'')
               or p.probe = '*'
               or upper(coalesce(btrim(p.probe),'')) = 'GLOBAL'
               or coalesce(btrim(p.probe),'') = ''
             )
             and coalesce(p.effective_from, date '1900-01-01') <= (r.start_ts at time zone 'UTC')::date
           order by
             case
               when coalesce(btrim(p.probe),'') = coalesce(btrim(r.probe),'') then 0
               when p.probe = '*' then 1
               when upper(coalesce(btrim(p.probe),'')) = 'GLOBAL' then 2
               when coalesce(btrim(p.probe),'') = '' then 3
               else 4
             end,
             p.effective_from desc
           limit 1
        ) pf on true
       where ${where.join(' and ')}
    )
    select id, user_email, lab, resource, start_ts, end_ts, hours, rate_code, price_eur
      from base
     order by start_ts`;
  const { rows } = await q(sqlRows, args)

  const total_hours = rows.reduce((s,r)=> s + Number(r.hours||0), 0)
  const total_eur   = rows.reduce((s,r)=> s + Number(r.price_eur||0), 0)

  if(format === 'csv'){
    const header = ['id','user_email','lab','resource','start_ts','end_ts','hours','rate_code','price_eur','bill_to_type','bill_to_client_id','client_name']
    const lines = [header.join(',')]
    for(const r of rows){
      const vals = [r.id, r.user_email, r.lab||'', r.resource, new Date(r.start_ts).toISOString(), new Date(r.end_ts).toISOString(), Number(r.hours).toFixed(2), r.rate_code||'', r.price_eur, r.bill_to_type||'', r.bill_to_client_id||'', r.client_name||'']
      lines.push(vals.map(v=> String(v).includes(',')? ('"'+String(v).replaceAll('"','""')+'"') : String(v)).join(','))
    }
    const csv = lines.join('\n') + `\nTOTAL_HOURS,,${total_hours.toFixed(2)}\nTOTAL_EUR,,${Number(total_eur).toFixed(2)}\n`
    reply.header('Content-Type','text/csv; charset=utf-8')
    return reply.send(csv)
  }

  return { rows, total_hours, total_eur }
})

// Clients (catalog and reporting)
app.get('/clients', { preHandler: requireAuth }, async (req, reply)=>{
  if(!['STAFF','DANTE'].includes(req.user.role)) return []
  try{ await q("create table if not exists api.clients(id serial primary key, name text unique not null, active boolean not null default true, created_at timestamptz default now())") }catch(_){ }
  try{ const { rows } = await q("select id,name,active from api.clients where active=true order by name"); return rows }catch(_){ return [] }
})
app.get('/admin/clients', { preHandler: requireAdmin }, async ()=>{
  try{ await q("create table if not exists api.clients(id serial primary key, name text unique not null, active boolean not null default true, created_at timestamptz default now())") }catch(_){ }
  try{ const { rows } = await q("select id,name,active from api.clients order by name"); return rows }catch(_){ return [] }
})
app.post('/admin/clients/save', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; const id=b.id?Number(b.id):null; const name=String(b.name||'').trim(); const active = (b.active==null? true : !!b.active)
  if(!name) return reply.code(400).send({error:'MISSING NAME'})
  try{ await q("create table if not exists api.clients(id serial primary key, name text unique not null, active boolean not null default true, created_at timestamptz default now())") }catch(_){ }
  if(id){ await q("update api.clients set name=$2, active=$3 where id=$1",[id,name,active]) }
  else{ await q("insert into api.clients(name,active) values ($1,$2) on conflict (name) do update set active=excluded.active",[name,active]) }
  return {ok:true}
})
app.post('/admin/clients/delete', { preHandler: requireAdmin }, async (req, reply)=>{
  const b=req.body||{}; if(!b.id) return reply.code(400).send({error:'MISSING ID'})
  await q("delete from api.clients where id=$1",[Number(b.id)]); return {ok:true}
})

// Client-only reports
app.get('/admin/client_report', { preHandler: requireAdmin }, async (req, reply)=>{
  const start = String(req.query.start||'').trim()
  const end   = String(req.query.end||'').trim()
  const resource = String(req.query.resource||'').trim()
  const format   = String(req.query.format||'json').trim().toLowerCase()
  const group    = String(req.query.group||'').trim().toLowerCase() // '' | 'client'
  if(!start || !end) return reply.code(400).send({error:'MISSING START/END'})
  try{ await q("create table if not exists api.clients(id serial primary key, name text unique not null, active boolean not null default true, created_at timestamptz default now())") }catch(_){ }
  // Ensure columns exist
  try{ await q("alter table if exists api.reservations add column if not exists bill_to_type text") }catch(_){ }
  try{ await q("alter table if exists api.reservations add column if not exists bill_to_client_id int") }catch(_){ }
  try{ await q("alter table if exists api.reservations add column if not exists total_price_eur numeric") }catch(_){ }

  const where = ["r.status='APPROVED'", 'r.start_ts >= $1', 'r.end_ts <= $2', "coalesce(r.bill_to_type,'LAB')='CLIENT'"]
  const args = [start, end]
  if(resource){ where.push('r.resource=$' + (args.length+1)); args.push(resource) }

  // Aggregate per client (CSV)
  if(format==='csv' && group==='client'){
    const sqlAgg = `
      select coalesce(c.name,'') as client,
             round(sum(extract(epoch from (r.end_ts-r.start_ts))/3600.0)::numeric, 2) as hours,
             round(sum(coalesce(r.total_price_eur, r.price_eur))::numeric, 2) as total_price_eur
        from api.reservations r
        left join api.clients c on c.id = r.bill_to_client_id
       where ${where.join(' and ')}
       group by coalesce(c.name,'')
       order by client`;
    const { rows: agg } = await q(sqlAgg, args)
    const header = ['client','hours','total_price_eur']
    const lines = [header.join(',')]
    for(const r of agg){
      const vals = [r.client||'', Number(r.hours||0).toFixed(2), Number(r.total_price_eur||0).toFixed(2)]
      lines.push(vals.map(v=> String(v).includes(',')? ('"'+String(v).replaceAll('"','""')+'"') : String(v)).join(','))
    }
    const total_hours = agg.reduce((s,r)=> s + Number(r.hours||0), 0)
    const total_eur   = agg.reduce((s,r)=> s + Number(r.total_price_eur||0), 0)
    const csv = lines.join('\n') + `\nTOTAL_HOURS,${total_hours.toFixed(2)}\nTOTAL_EUR,${Number(total_eur).toFixed(2)}\n`
    reply.header('Content-Type','text/csv; charset=utf-8')
    return reply.send(csv)
  }

  const sql = `
    select r.id, r.user_email as created_by, coalesce(c.name,'') as client, r.resource, r.start_ts, r.end_ts,
           extract(epoch from (r.end_ts-r.start_ts))/3600.0 as hours,
           coalesce(r.total_price_eur, r.price_eur) as total_price_eur
      from api.reservations r
      left join api.clients c on c.id = r.bill_to_client_id
     where ${where.join(' and ')}
     order by r.start_ts`;
  const { rows } = await q(sql, args)
  const total_hours = rows.reduce((s,r)=> s + Number(r.hours||0), 0)
  const total_eur   = rows.reduce((s,r)=> s + Number(r.total_price_eur||0), 0)
  if(format==='csv'){
    const header = ['id','created_by','client','resource','start_ts','end_ts','hours','total_price_eur']
    const lines = [header.join(',')]
    for(const r of rows){
      const vals = [r.id, r.created_by, r.client||'', r.resource, new Date(r.start_ts).toISOString(), new Date(r.end_ts).toISOString(), Number(r.hours).toFixed(2), r.total_price_eur]
      lines.push(vals.map(v=> String(v).includes(',')? ('"'+String(v).replaceAll('"','""')+'"') : String(v)).join(','))
    }
    const csv = lines.join('\n') + `\nTOTAL_HOURS,,${total_hours.toFixed(2)}\nTOTAL_EUR,,${Number(total_eur).toFixed(2)}\n`
    reply.header('Content-Type','text/csv; charset=utf-8')
    return reply.send(csv)
  }
  return { rows, total_hours, total_eur }
})


// ===== Admin Debug Panel (DANTE only)

// List users currently being debugged
app.get('/admin/debug/users', { preHandler: requireDante }, async () => {
  const { rows } = await q("select email, added_by, expires_at, created_at from api.debug_users order by created_at desc");
  return rows;
});

// Start debugging a user
app.post('/admin/debug/start', { preHandler: requireDante }, async (req, reply) => {
  const { email: rawEmail, duration_hours = 24 } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return reply.code(400).send({ error: 'MISSING EMAIL' });

  const expires_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
  
  await q(
    "insert into api.debug_users(email, added_by, expires_at) values ($1, $2, $3) on conflict (email) do update set added_by = excluded.added_by, expires_at = excluded.expires_at",
    [email, req.user.email, expires_at]
  );
  
  // Invalidate cache for this user to ensure change is picked up immediately
  debugUserCache.delete(email);

  return { ok: true, email, expires_at };
});

// Stop debugging a user
app.post('/admin/debug/stop', { preHandler: requireDante }, async (req, reply) => {
  const { email: rawEmail } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return reply.code(400).send({ error: 'MISSING EMAIL' });

  await q("delete from api.debug_users where email = $1", [email]);
  
  // Invalidate cache for this user
  debugUserCache.delete(email);

  return { ok: true, email };
});

// Get debug logs for a user
app.get('/admin/debug/logs', { preHandler: requireDante }, async (req, reply) => {
  const { email: rawEmail, limit = 100, offset = 0 } = req.query || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return reply.code(400).send({ error: 'MISSING EMAIL' });

  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), 500);
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  const logsPromise = q(
    "select * from api.debug_logs where user_email = $1 order by log_ts desc limit $2 offset $3",
    [email, safeLimit, safeOffset]
  );
  
  const countPromise = q(
    "select count(*)::int as total from api.debug_logs where user_email = $1",
    [email]
  );

  const loginMetaPromise = q(
    `select created_at, ip, user_agent, accept_language, tz_offset_minutes, tz_name, client_time_iso, payload
       from api.login_events
      where lower(email) = lower($1)
      order by created_at desc
      limit 1`,
    [email]
  );

  const [logsResult, countResult, loginMetaResult] = await Promise.all([logsPromise, countPromise, loginMetaPromise]);

  return {
    logs: logsResult.rows,
    total: countResult.rows[0]?.total || 0,
    limit: safeLimit,
    offset: safeOffset,
    latest_login: loginMetaResult.rows[0] || null
  };
});

// Clear debug logs for a user
app.post('/admin/debug/logs/clear', { preHandler: requireDante }, async (req, reply) => {
  const { email: rawEmail } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return reply.code(400).send({ error: 'MISSING EMAIL' });

  const { rowCount } = await q("delete from api.debug_logs where user_email = $1", [email]);

  return { ok: true, email, cleared_count: rowCount };
});

async function start() {
  try {
    await ensureAuditIpColumn();
    await ensureResOverlapConstraint();
    await ensureReservationStatusCheck();
    await ensureBlockedTable();
    await ensureLoginEventsTable();
    await ensureSettingsAndRegistration();
    await ensureDebugLogTables();
    await ensureResetTable();
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
start();

function randomToken(n=24){ try{ return crypto.randomBytes(n).toString('hex') }catch{ return Math.random().toString(36).slice(2) } }
