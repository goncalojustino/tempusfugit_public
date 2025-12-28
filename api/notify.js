// api/notify.js
// Nodemailer-backed notifications. Configure via env vars.
// Required env: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL

import nodemailer from 'nodemailer'

const ENABLED = /^(1|true|yes)$/i.test(process.env.NOTIFY_ENABLED || '1')

// Require SMTP configuration when notifications are enabled
if (ENABLED) {
  const required = ['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','FROM_EMAIL']
  const missing = required.filter(k => !String(process.env[k]||'').trim())
  if (missing.length) {
    console.error('[mail] missing required env:', missing.join(', '))
    process.exit(1)
  }
}

const FROM = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@example.com'

let transporter = null
function getTransport(){
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT)
  const secure = /^(1|true|yes)$/i.test(process.env.SMTP_SECURE)
  const user = process.env.SMTP_USER
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: process.env.SMTP_PASS },
  })
  // Log basic mail config on first use (without secrets)
  try{
    console.log('[mail] transport initialized', { host, port, secure, user, from: FROM, enabled: ENABLED })
  }catch(_){}
  return transporter
}

async function send(to, subject, text, bcc, html){
  if(!ENABLED){ console.warn('[mail] disabled (NOTIFY_ENABLED)'); return }
  const t = getTransport()
  const opts = { from: FROM, to, subject, text }
  if (html) opts.html = html
  if (Array.isArray(bcc) && bcc.length) opts.bcc = bcc
  try{
    const info = await t.sendMail(opts)
    console.log('[mail] sent', { to: opts.to, bcc: Array.isArray(opts.bcc)?opts.bcc.length:0, subject: opts.subject, messageId: info?.messageId })
  }catch(e){
    console.error('[mail] send failed', String(e?.message||e))
    throw e
  }
}

function fmtRes(res){
  return [
    `Reservation #${res.id}`,
    `User: ${res.user_email}`,
    `Resource: ${res.resource}`,
    `Experiment: ${res.experiment}`,
    `Probe: ${res.probe}`,
    `Start: ${new Date(res.start_ts).toLocaleString()}`,
    `End: ${new Date(res.end_ts).toLocaleString()}`,
    res.label? `Block: ${res.label}` : '',
  ].filter(Boolean).join('\n')
}

export async function notifyPending(res, staffEmails){
  const subject = `[Tempusfugit] Pending approval: ${res.resource} · ${res.experiment}`
  // Build body without price line
  const lines = [
    'A new reservation requires approval.',
    '',
    `Reservation #${res.id}`,
    `User: ${res.user_email}`,
    `Resource: ${res.resource}`,
    `Experiment: ${res.experiment}`,
    `Probe: ${res.probe}`,
    `Start: ${new Date(res.start_ts).toLocaleString()}`,
    `End: ${new Date(res.end_ts).toLocaleString()}`,
    res.label ? `Block: ${res.label}` : ''
  ].filter(Boolean)
  const text = lines.join('\n') + `\n\nVisit Admin → Approvals to review.`
  await send(FROM, subject, text, staffEmails)
}

export async function notifyApproved(res, staffEmails, approver){
  const subject = `[Tempusfugit] Approved: ${res.resource} · ${res.experiment}`
  const approverLine = approver && approver.email ? `Approved by: ${approver.email}` : ''
  const lines = [
    'Your reservation has been approved.',
    '',
    fmtRes(res),
    approverLine
  ].filter(Boolean)
  await send(res.user_email, subject, lines.join('\n'), staffEmails)
}

export async function notifyDenied(res, staffEmails){
  const subject = `[Tempusfugit] Denied: ${res.resource} · ${res.experiment}`
  const text = `Your reservation has been denied.\n\n${fmtRes(res)}`
  await send(res.user_email, subject, text, staffEmails)
}

export async function notifyBroadcastAll(subject, text, allEmails){
  // BCC all users to avoid exposing addresses. Send to FROM.
  await send(FROM, subject, text, allEmails)
}

// Simple direct test helper
export async function notifyTest(to, subject='[Tempusfugit] Mail test', text='This is a test message from Tempusfugit.'){
  await send(to, subject, text)
}

// Welcome mail on user enrollment
export async function notifyWelcome(to, resetLink, labName='', allowed={}){
  const subject = `[Tempusfugit] Your account is ready`
  const allowedList = [
    allowed.allowed_nmr300 ? 'NMR300' : null,
    allowed.allowed_nmr400 ? 'NMR400' : null,
    allowed.allowed_nmr500 ? 'NMR500' : null,
  ].filter(Boolean)
  const allowedStr = allowedList.length ? allowedList.join(', ') : 'none'
  const lines = [
    'Welcome to Tempusfugit.',
    '',
    'Please set your passcode using the link below.',
    resetLink,
    '',
    `Email: ${to}`,
    labName ? `Lab: ${labName}` : null,
    `Allowed resources: ${allowedStr}`,
  ].filter(Boolean)
  const html = [
    '<p>Welcome to Tempusfugit.</p>',
    `<p>Please set your passcode by visiting this link: <a href="${resetLink}">Set Passcode</a></p>`,
    `<p>Email: <b>${to}</b><br/>${labName?`Lab: <b>${labName}</b><br/>`:''}Allowed resources: <b>${allowedStr}</b></p>`,
  ].join('\n')
  await send(to, subject, lines.join('\n'), undefined, html)
}

// Contact form to staff/dante
export async function notifyContact(toList, name, contact, message){
  const subject = `[Tempusfugit] Website contact`
  const lines = [
    `From: ${name||'Anonymous'}`,
    contact ? `Contact: ${contact}` : null,
    '',
    message||''
  ].filter(Boolean)
  const text = lines.join('\n')
  // Send to FROM, BCC staff list to avoid exposing addresses if needed
  await send(FROM, subject, text, Array.isArray(toList)? toList : [])
}

// Password reset link
export async function notifyReset(to, link){
  const subject = `[Tempusfugit] Set your passcode`
  const text = `Please set your passcode by visiting this link:\n\n${link}\n\nIf you did not request this, ignore this email.`
  const html = `<p>Please set your passcode by visiting this link:</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`
  await send(to, subject, text, undefined, html)
}

// New registration request notification to staff
export async function notifyRegistrationNew(toList, email, name, lab){
  const subject = `[Tempusfugit] New registration request`
  const text = `New user requested access.\n\nEmail: ${email}\nName: ${name||''}\nLab: ${lab||''}`
  await send(FROM, subject, text, Array.isArray(toList)? toList : [])
}

// Send a confirmation copy to the requester
export async function notifyRegistrationCopy(to, name, lab){
  const subject = `[Tempusfugit] We received your access request`
  const lines = [
    'Thank you. Your request was received and will be reviewed by staff.',
    '',
    `Email: ${to}`,
    name ? `Name: ${name}` : null,
    lab ? `Lab: ${lab}` : null
  ].filter(Boolean)
  await send(to, subject, lines.join('\n'))
}

// Contact a specific staff member (direct email, no BCC)
export async function notifyContactOne(to, name, contact, message){
  const subject = `[Tempusfugit] Website contact`
  const lines = [
    `From: ${name||'Anonymous'}`,
    contact ? `Contact: ${contact}` : null,
    '',
    message||''
  ].filter(Boolean)
  const text = lines.join('\n')
  await send(to, subject, text)
}

// Registration approved: includes allowed list and reset link (no BCC)
export async function notifyRegistrationApproved(to, link, allowed={}, role='USER'){
  const subject = `[Tempusfugit] Access approved`
  const list = [
    allowed.allowed_nmr300 ? 'NMR300' : null,
    allowed.allowed_nmr400 ? 'NMR400' : null,
    allowed.allowed_nmr500 ? 'NMR500' : null,
  ].filter(Boolean)
  const allowedStr = list.length ? list.join(', ') : 'none'
  const lines = [
    'Your registration has been approved.',
    '',
    `Role: ${role}`,
    `Allowed resources: ${allowedStr}`,
    '',
    'You can define/reset your password here:',
    link
  ]
  const html = [
    '<p>Your registration has been approved.</p>',
    `<p>Role: <b>${role}</b><br/>Allowed resources: <b>${allowedStr}</b></p>`,
    `<p>You can define/reset your password here: <a href="${link}">Define/reset your password</a></p>`
  ].join('\n')
  await send(to, subject, lines.join('\n'), undefined, html)
}

// Admin-canceled reservation notice to the reservation owner
export async function notifyCanceled(res, canceledByEmail=null, reason=''){
  const subject = `[Tempusfugit] Reservation canceled: ${res.resource}`
  const lines = [
    'Your reservation has been canceled by staff.',
    '',
    fmtRes(res),
    canceledByEmail ? `Canceled by: ${canceledByEmail}` : null,
    reason ? `Reason: ${reason}` : null
  ].filter(Boolean)
  await send(res.user_email, subject, lines.join('\n'))
}

// User requested cancel of an approved, approval-requiring booking
export async function notifyCancelRequested(res, staffEmails){
  const subject = `[Tempusfugit] Cancel request: ${res.resource} · ${res.experiment}`
  const lines = [
    'A user requested to cancel an already approved reservation that requires approval to cancel.',
    '',
    fmtRes(res)
  ]
  await send(FROM, subject, lines.join('\n'), staffEmails)
}

export async function notifyCancelApproved(res, approver){
  const subject = `[Tempusfugit] Cancellation approved: ${res.resource}`
  const approverLine = approver && approver.email ? `Approved by: ${approver.email}` : ''
  const lines = [
    'Your cancellation request has been approved.',
    '',
    fmtRes(res),
    approverLine
  ].filter(Boolean)
  await send(res.user_email, subject, lines.join('\n'))
}

export async function notifyCancelDenied(res, approver){
  const subject = `[Tempusfugit] Cancellation denied: ${res.resource}`
  const approverLine = approver && approver.email ? `Reviewed by: ${approver.email}` : ''
  const lines = [
    'Your cancellation request has been denied. The booking remains active.',
    '',
    fmtRes(res),
    approverLine
  ].filter(Boolean)
  await send(res.user_email, subject, lines.join('\n'))
}



export async function notifyBookingErrorAlert(recipients, payload = {}) {
  if (!Array.isArray(recipients) || recipients.length === 0) return
  const prefix = String(payload.subjectPrefix || 'tempusfugit UX error |').trim() || 'tempusfugit UX error |'
  let generated = payload.timestamp || payload.generatedAt || new Date().toISOString()
  let stampDate = new Date(generated)
  if (Number.isNaN(stampDate.getTime())) {
    stampDate = new Date()
    generated = stampDate.toISOString()
  }
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${stampDate.getFullYear()}${pad(stampDate.getMonth() + 1)}${pad(stampDate.getDate())}${pad(stampDate.getHours())}${pad(stampDate.getMinutes())}${pad(stampDate.getSeconds())}`
  const subject = `${prefix} ${stamp}`
  const lines = [
    'A booking attempt failed.',
    '',
    `Timestamp: ${generated}`,
    payload.userEmail ? `User: ${payload.userEmail}` : null,
    payload.userRole ? `Role: ${payload.userRole}` : null,
    payload.actor ? `Actor: ${payload.actor}` : null,
    payload.impersonator ? `Impersonator: ${payload.impersonator}` : null,
    payload.ip ? `Client IP: ${payload.ip}` : null,
    '',
    'Request payload:',
    JSON.stringify(payload.requestBody || {}, null, 2),
    '',
    'Derived booking data:',
    JSON.stringify(payload.normalized || {}, null, 2),
    '',
    'Error context:',
    JSON.stringify(payload.context || {}, null, 2),
    '',
    `Error shown to user: ${payload.errorMessage || 'Unknown'}`
  ].filter(Boolean)
  if (payload.errorCode) lines.push(`Internal code: ${payload.errorCode}`)
  if (payload.rawError) lines.push(`Raw error: ${payload.rawError}`)
  if (Array.isArray(payload.recipients) && payload.recipients.length) {
    lines.push('', 'Recipients (roles):', JSON.stringify(payload.recipients, null, 2))
  }
  await send(FROM, subject, lines.join('\n'), recipients)
}
