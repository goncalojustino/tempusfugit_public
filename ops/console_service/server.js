import Fastify from 'fastify'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import crypto from 'crypto'
import pkg from 'pg'
const { Pool } = pkg

const app = Fastify({ logger: true })
if(!process.env.SESSION_SECRET) {
  app.log.error('FATAL: SESSION_SECRET environment variable is not set.')
  process.exit(1)
}

// Database connection
const DB_HOST = process.env.DB_HOST || 'db'
const DB_PORT = process.env.DB_PORT || '5432'
const DB_USER = process.env.DB_USER || 'tempus'
const DB_NAME = process.env.DB_NAME || 'tempus'
const DB_PASS = process.env.PGPASSWORD
const DBURL = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
const pool = new Pool({ connectionString: DBURL })
const q = (text, params=[]) => pool.query(text, params)

// Token verification (same as API)
const SECRET = process.env.SESSION_SECRET
function sign(s){ return crypto.createHmac('sha256', SECRET).update(s).digest('hex') }
function parseToken(tok){
  if(!tok || !SECRET) return null
  try{
    const [b64,sig] = String(tok).split('.')
    const body = Buffer.from(b64,'base64').toString()
    if (sign(body)!==sig) return null
    const obj = JSON.parse(body)
    if (obj.exp < Math.floor(Date.now()/1000)) return null
    return obj
  }catch{ return null }
}
async function requireAdmin(req, reply){
  const tok = req.headers['authorization']?.replace(/^Bearer /,'')
  const obj = parseToken(tok)
  if(!obj || !obj.email) return reply.code(401).send({ error:'UNAUTHORIZED' })

  try {
    const { rows } = await q("select role from api.users where lower(email)=lower($1)", [obj.email])
    if(!rows.length) return reply.code(403).send({ error:'FORBIDDEN' })
    const role = String(rows[0].role || '').toUpperCase()
    if(!['STAFF','DANTE'].includes(role)) return reply.code(403).send({ error:'FORBIDDEN' })
    req.user = { ...obj, role } // Attach user with fresh role
  } catch (e) {
    app.log.error(e, 'Failed to check user role from DB')
    return reply.code(500).send({ error: 'DATABASE_ERROR' })
  }
}

// Static UI
app.get('/', async (_req, reply)=>{
  const file = path.join(process.cwd(), 'public', 'index.html')
  reply.header('Content-Type','text/html; charset=utf-8')
  return reply.send(fs.readFileSync(file, 'utf-8'))
})

// On-demand backup: runs the shared backup.sh
app.post('/backup/now', { preHandler: requireAdmin }, async (_req, reply)=>{
  const env = {
    ...process.env,
    BACKUP_ROOT: process.env.BACKUP_ROOT || '/backups',
    CODE_SRC: process.env.CODE_SRC || '/src',
    DB_HOST: process.env.DB_HOST || 'db',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_USER: process.env.DB_USER || 'tempus',
    DB_NAME: process.env.DB_NAME || 'tempus',
  }
  return new Promise((resolve) => {
    const child = spawn('/usr/local/bin/backup.sh', { env })
    let out = ''
    let err = ''
    child.stdout.on('data', d=> out += d.toString())
    child.stderr.on('data', d=> err += d.toString())
    child.on('close', (code)=>{
      const body = { ok: code===0, code, stdout: out.trim(), stderr: err.trim() }
      if(code===0) reply.send(body)
      else reply.code(500).send(body)
      resolve()
    })
  })
})

// Helpers for listing and validating files
const BACKUP_ROOT = process.env.BACKUP_ROOT || '/backups'
const CODE_DIR = path.join(BACKUP_ROOT, 'code')
const DB_DIR = path.join(BACKUP_ROOT, 'db')
const codePattern = /^tempus_code_\d{8}-\d{4}\.zip$/
const dbPattern   = /^tempus_db_\d{8}-\d{4}\.dump$/

async function listDirSafe(dir, pattern){
  try{
    const files = await fs.promises.readdir(dir);
    const filtered = files.filter(n => pattern.test(n));
    const stats = await Promise.all(filtered.map(async n => {
      const p = path.join(dir, n);
      const st = await fs.promises.stat(p);
      return { name: n, size: st.size, mtime: st.mtime.toISOString() };
    }));
    return stats.sort((a,b)=> b.mtime.localeCompare(a.mtime));
  }catch(_){ return [] }
}
function resolveBackupPath(type, name){
  const base = type==='code' ? CODE_DIR : DB_DIR
  const full = path.join(base, name)
  // Normalize to prevent traversal attacks like /../../
  if(path.resolve(full) !== full) return null;
  if(!full.startsWith(path.resolve(base))) return null
  const ok = (type==='code' ? codePattern : dbPattern).test(path.basename(full))
  return ok ? full : null
}

// List backups
app.get('/backups', { preHandler: requireAdmin }, async (_req) => {
  const [code, db] = await Promise.all([
    listDirSafe(CODE_DIR, codePattern),
    listDirSafe(DB_DIR, dbPattern)
  ]);
  return { code, db, schedule: process.env.BACKUP_SCHEDULE || null };
})

// Delete a backup
app.post('/backup/delete', { preHandler: requireAdmin }, async (req, reply) => {
  const b = req.body || {}
  const type = String(b.type||'')
  const name = String(b.file||'')
  if(!['code','db'].includes(type) || !name) return reply.code(400).send({ error:'BAD INPUT' })
  const p = resolveBackupPath(type, name)
  if (!p || !fs.existsSync(p)) return reply.code(404).send({ error: 'NOT FOUND' })
  try {
    fs.unlinkSync(p)
  } catch (e) {
    app.log.error(e, `Failed to delete backup file: ${name}`)
    return reply.code(500).send({ error: 'FAILED', detail: 'Could not delete the backup file.' })
  }
  return { ok:true }
})

// Download a backup
app.get('/backup/download', { preHandler: requireAdmin }, async (req, reply) => {
  const type = String(req.query.type||'')
  const name = String(req.query.file||'')
  const p = resolveBackupPath(type, name)
  if(!p || !fs.existsSync(p)) return reply.code(404).send({ error:'NOT FOUND' })
  const ct = type==='code' ? 'application/zip' : 'application/octet-stream'
  reply.header('Content-Type', ct)
  reply.header('Content-Disposition', `attachment; filename="${path.basename(p)}"`)
  return reply.send(fs.createReadStream(p))
})

const PORT = Number(process.env.PORT || 8081)
app.listen({ port: PORT, host: '0.0.0.0' })
  .then(()=> console.log(`[console] listening on ${PORT}`))
  .catch((e)=> { console.error(e); process.exit(1) })
