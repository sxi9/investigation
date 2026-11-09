// Password hashing (scrypt), session tokens, hash-chained audit log.
import crypto from 'node:crypto';
import { db } from './db.js';

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function hashPassword(pass, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pass), salt, 64, SCRYPT);
  return { salt: salt.toString('hex'), hash: key.toString('hex') };
}
export function verifyPassword(pass, saltHex, hashHex) {
  const { hash } = hashPassword(pass, saltHex);
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(String(hashHex || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
export const uid = (p = 'u') => p + crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'x') + Date.now().toString(36);

// Common passwords that a policy of "8 characters" would otherwise let through.
const WEAK = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', 'iloveyou', 'letmein1', 'welcome1', 'admin123', 'administrator', 'changeme', 'passw0rd', 'p@ssw0rd', 'sunshine', 'football', 'baseball', 'princess', 'dragon123', 'monkey123', 'trustno1', 'master123', 'abc12345', '11111111', '00000000', 'investigation', 'investigator', 'cyberboard']);
export function checkPassword(pass, name, min) {
  const p = String(pass || '');
  if (p.length < min) throw Object.assign(new Error('Password: at least ' + min + ' characters'), { status: 400 });
  if (p.length > 256) throw Object.assign(new Error('Password: at most 256 characters'), { status: 400 });
  if (WEAK.has(p.toLowerCase())) throw Object.assign(new Error('That password is on the common-passwords list'), { status: 400 });
  if (name && p.toLowerCase().includes(String(name).toLowerCase()) && name.length >= 4) throw Object.assign(new Error('Password must not contain your name'), { status: 400 });
  if (/^(.)\1+$/.test(p)) throw Object.assign(new Error('Password must not be one repeated character'), { status: 400 });
}

// Append-only audit log: each row carries the hash of the previous row (tamper evidence, spec §6).
const lastRow = db.prepare('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1');
const insAudit = db.prepare('INSERT INTO audit (t, who, what, ip, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?)');
export function audit(who, what, ip = '') {
  const prev = lastRow.get()?.hash || '0'.repeat(64);
  const t = new Date().toISOString();
  const h = sha256(prev + '|' + t + '|' + who + '|' + what + '|' + ip);
  insAudit.run(t, String(who || '(system)'), String(what || ''), ip, prev, h);
}
export function verifyAuditChain() {
  let prev = '0'.repeat(64), ok = true, n = 0;
  for (const r of db.prepare('SELECT * FROM audit ORDER BY seq').all()) {
    n++;
    if (r.prev_hash !== prev || r.hash !== sha256(prev + '|' + r.t + '|' + r.who + '|' + r.what + '|' + (r.ip || ''))) { ok = false; break; }
    prev = r.hash;
  }
  return { ok, rows: n };
}
