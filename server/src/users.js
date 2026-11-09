// User and session persistence.
import { db } from './db.js';
import { config } from './config.js';
import { hashPassword, verifyPassword, newToken, sha256, uid, checkPassword, audit } from './crypto.js';
import { ROLES } from './acl.js';

const row2user = (r) => r && ({ id: r.id, name: r.name, role: r.role, tlpRed: !!r.tlp_red, cases: JSON.parse(r.cases), mustChange: !!r.must_change, createdAt: r.created_at, lastLogin: r.last_login, locked: r.locked_until > Date.now() });
const q = {
  byName: db.prepare('SELECT * FROM users WHERE name_lc = ?'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  all: db.prepare('SELECT * FROM users ORDER BY created_at'),
  count: db.prepare('SELECT COUNT(*) AS n FROM users'),
  admins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
  ins: db.prepare('INSERT INTO users (id, name, name_lc, role, salt, hash, tlp_red, cases, must_change, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  setPass: db.prepare('UPDATE users SET salt = ?, hash = ?, must_change = ?, failed = 0, locked_until = 0 WHERE id = ?'),
  upd: db.prepare('UPDATE users SET role = ?, tlp_red = ?, cases = ? WHERE id = ?'),
  del: db.prepare('DELETE FROM users WHERE id = ?'),
  fail: db.prepare('UPDATE users SET failed = failed + 1, locked_until = CASE WHEN failed + 1 >= ? THEN ? ELSE locked_until END WHERE id = ?'),
  ok: db.prepare("UPDATE users SET failed = 0, locked_until = 0, last_login = ? WHERE id = ?"),
  sIns: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, seen_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  sGet: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
  sTouch: db.prepare('UPDATE sessions SET seen_at = ? WHERE token_hash = ?'),
  sDel: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  sDelUser: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  sPurge: db.prepare('DELETE FROM sessions WHERE expires_at < ? OR seen_at < ?'),
  audit: db.prepare('SELECT t, who, what FROM audit ORDER BY seq DESC LIMIT ?'),
};
const err = (m, status = 400) => Object.assign(new Error(m), { status });

export const users = {
  count: () => q.count.get().n,
  list: () => q.all.all().map(row2user),
  get: (id) => row2user(q.byId.get(id)),
  auditTail: (n = 300) => q.audit.all(n).reverse(),
  create({ name, pass, role, tlpRed, cases, mustChange }, by, ip) {
    name = String(name || '').trim();
    if (!name || name.length > 64 || !/^[\p{L}\p{N} ._@'-]+$/u.test(name)) throw err('A name is required (letters, digits, space . _ @ \' -)');
    checkPassword(pass, name, config.minPassword);
    if (q.byName.get(name.toLowerCase())) throw err('That name is taken', 409);
    const first = q.count.get().n === 0;
    role = first ? 'admin' : (ROLES.includes(role) ? role : 'analyst');
    const h = hashPassword(pass);
    const id = uid('u');
    const scope = cases === 'all' || first ? 'all' : (Array.isArray(cases) ? cases.filter(x => typeof x === 'string').slice(0, 500) : 'all');
    q.ins.run(id, name, name.toLowerCase(), role, h.salt, h.hash, tlpRed ? 1 : 0, JSON.stringify(scope), mustChange ? 1 : 0, new Date().toISOString());
    audit(by || name, 'created user ' + name + ' (' + role + ')', ip);
    return users.get(id);
  },
  setPassword(id, pass, mustChange, by, ip) {
    const u = q.byId.get(id); if (!u) throw err('No such user', 404);
    checkPassword(pass, u.name, config.minPassword);
    const h = hashPassword(pass);
    q.setPass.run(h.salt, h.hash, mustChange ? 1 : 0, id);
    if (!mustChange) {/* user chose it; keep other sessions */} else q.sDelUser.run(id); // admin reset: sign the user out everywhere
    audit(by || u.name, 'password ' + (mustChange ? 'reset for ' : 'changed for ') + u.name, ip);
  },
  update(id, patch, by, ip) {
    const u = q.byId.get(id); if (!u) throw err('No such user', 404);
    const role = patch.role !== undefined ? patch.role : u.role;
    if (!ROLES.includes(role)) throw err('Unknown role');
    if (u.role === 'admin' && role !== 'admin' && q.admins.get().n === 1) throw err('Keep at least one admin');
    const tlpRed = patch.tlpRed !== undefined ? !!patch.tlpRed : !!u.tlp_red;
    let cases = patch.cases !== undefined ? patch.cases : JSON.parse(u.cases);
    if (cases !== 'all' && !Array.isArray(cases)) throw err('cases must be "all" or a list of case ids');
    if (Array.isArray(cases)) cases = cases.filter(x => typeof x === 'string').slice(0, 500);
    q.upd.run(role, tlpRed ? 1 : 0, JSON.stringify(cases), id);
    audit(by || u.name, 'updated ' + u.name + ': ' + Object.keys(patch).join(', '), ip);
    return users.get(id);
  },
  remove(id, by, ip) {
    const u = q.byId.get(id); if (!u) throw err('No such user', 404);
    if (u.role === 'admin' && q.admins.get().n === 1) throw err('Keep at least one admin');
    q.del.run(id); q.sDelUser.run(id);
    audit(by, 'removed user ' + u.name, ip);
  },
  grantCase(id, caseId) {
    const u = q.byId.get(id); if (!u) return;
    const cases = JSON.parse(u.cases); if (cases === 'all' || cases.includes(caseId)) return;
    q.upd.run(u.role, u.tlp_red, JSON.stringify([...cases, caseId]), id);
  },
  // ---- authentication
  login(name, pass, ip, ua) {
    name = String(name || '').trim();
    const u = q.byName.get(name.toLowerCase());
    if (u && u.locked_until > Date.now()) { audit(name, 'FAILED sign-in (locked)', ip); throw err('Account locked after too many failures. Try again in ' + Math.ceil((u.locked_until - Date.now()) / 60e3) + ' min', 423); }
    const ok = !!u && verifyPassword(pass || '', u.salt, u.hash);
    if (!ok) {
      if (u) q.fail.run(config.loginMaxFailures, Date.now() + config.lockoutMs, u.id); else hashPassword(pass || '', '00'.repeat(16)); // equalise timing for unknown names
      audit(name || '(blank)', 'FAILED sign-in', ip); throw err('Wrong name or password', 401);
    }
    q.ok.run(new Date().toISOString(), u.id);
    audit(u.name, 'signed in', ip);
    return { user: users.get(u.id), token: users.newSession(u.id, ip, ua) };
  },
  newSession(userId, ip, ua) {
    const token = newToken(), now = Date.now();
    q.sPurge.run(now, now - config.sessionIdleMs);
    q.sIns.run(sha256(token), userId, now, now + config.sessionLifeMs, now, ip || '', String(ua || '').slice(0, 200));
    return token;
  },
  // Returns the user for a session token, applying absolute and idle expiry. Touches seen_at.
  bySession(token) {
    if (!token) return null;
    const s = q.sGet.get(sha256(token)); if (!s) return null;
    const now = Date.now();
    if (now > s.expires_at || now - s.seen_at > config.sessionIdleMs) { q.sDel.run(s.token_hash); audit('(session)', 'expired', ''); return null; }
    if (now - s.seen_at > 15e3) q.sTouch.run(now, s.token_hash);
    if (s.user_id === 'guest') return 'guest';
    const u = users.get(s.user_id); if (!u) { q.sDel.run(s.token_hash); return null; }
    return u;
  },
  logout(token, who, ip) { if (token) q.sDel.run(sha256(token)); audit(who || '(unknown)', 'signed out', ip); },
  guestSession(ip, ua) { audit('guest', 'public access', ip); return users.newSession('guest', ip, ua); },
};
