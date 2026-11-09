// User and session persistence.
import { db } from './db.js';
import { config } from './config.js';
import { hashPassword, verifyPassword, newToken, sha256, uid, checkPassword, audit } from './crypto.js';
import { newSecret as totpSecret, verify as totpVerify, uri as totpUri } from './totp.js';
import { ROLES } from './acl.js';
for (const col of ['totp_secret TEXT', 'totp_enabled INTEGER NOT NULL DEFAULT 0', 'totp_pending TEXT', 'oidc_sub TEXT', 'email TEXT']) { try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch (e) {} }

const row2user = (r) => r && ({ id: r.id, name: r.name, role: r.role, tlpRed: !!r.tlp_red, cases: JSON.parse(r.cases), mustChange: !!r.must_change, createdAt: r.created_at, lastLogin: r.last_login, locked: r.locked_until > Date.now(), totp: !!r.totp_enabled, sso: !!r.oidc_sub, email: r.email || '' });
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
  totpPending: db.prepare('UPDATE users SET totp_pending = ? WHERE id = ?'),
  totpEnable: db.prepare('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = 1 WHERE id = ?'),
  totpDisable: db.prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_enabled = 0 WHERE id = ?'),
  bySub: db.prepare('SELECT * FROM users WHERE oidc_sub = ?'), byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  insSso: db.prepare('INSERT INTO users (id, name, name_lc, role, salt, hash, tlp_red, cases, must_change, created_at, oidc_sub, email) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)'),
  linkSso: db.prepare('UPDATE users SET oidc_sub = ?, email = COALESCE(email, ?) WHERE id = ?'),
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
    const ok = !!u && !!u.hash && verifyPassword(pass || '', u.salt, u.hash);
    if (!ok) {
      if (u) q.fail.run(config.loginMaxFailures, Date.now() + config.lockoutMs, u.id); else hashPassword(pass || '', '00'.repeat(16)); // equalise timing for unknown names
      audit(name || '(blank)', 'FAILED sign-in', ip); throw err('Wrong name or password', 401);
    }
    if (u.totp_enabled) { audit(u.name, 'password accepted, TOTP required', ip); return { user: users.get(u.id), totpRequired: true, challenge: users.challenge(u.id) }; }
    q.ok.run(new Date().toISOString(), u.id);
    audit(u.name, 'signed in', ip);
    return { user: users.get(u.id), token: users.newSession(u.id, ip, ua) };
  },
  // short-lived second-factor challenges (in memory)
  _challenges: new Map(),
  challenge(userId) { const t = newToken(); users._challenges.set(t, { userId, exp: Date.now() + 5 * 60e3, tries: 0 }); return t; },
  finishTotp(challenge, code_, ip, ua) {
    const c = users._challenges.get(challenge); if (!c || c.exp < Date.now()) { users._challenges.delete(challenge); throw err('Sign in again', 401); }
    const u = q.byId.get(c.userId); if (!u) throw err('Sign in again', 401);
    if (!totpVerify(u.totp_secret, code_)) { c.tries++; audit(u.name, 'FAILED TOTP', ip); if (c.tries >= 5) users._challenges.delete(challenge); throw err('Wrong code', 401); }
    users._challenges.delete(challenge); q.ok.run(new Date().toISOString(), u.id); audit(u.name, 'signed in (TOTP)', ip);
    return { user: users.get(u.id), token: users.newSession(u.id, ip, ua) };
  },
  totpSetup(id) { const u = q.byId.get(id); if (!u) throw err('No such user', 404); const secret = totpSecret(); q.totpPending.run(secret, id); return { secret, uri: totpUri(secret, u.name) }; },
  totpConfirm(id, code_, ip) { const u = q.byId.get(id); if (!u || !u.totp_pending) throw err('Start TOTP setup first'); if (!totpVerify(u.totp_pending, code_)) throw err('Wrong code; scan the QR again and retry', 400); q.totpEnable.run(id); audit(u.name, 'enabled TOTP', ip); },
  totpDisable(id, pass, ip, by) { const u = q.byId.get(id); if (!u) throw err('No such user', 404); if (pass !== null && !verifyPassword(pass || '', u.salt, u.hash)) throw err('Wrong password', 401); q.totpDisable.run(id); audit(by || u.name, 'disabled TOTP for ' + u.name, ip); },
  // OIDC: find by subject, then by email, else create
  ssoLogin(identity, ip, ua, defaultRole) {
    let u = q.bySub.get(identity.sub) || (identity.email ? q.byEmail.get(identity.email) : null);
    if (!u) {
      let name = identity.name; let n = 2; while (q.byName.get(name.toLowerCase())) name = identity.name + ' ' + (n++);
      const id = uid('u'); const first = q.count.get().n === 0; const role = first || identity.admin ? 'admin' : defaultRole;
      q.insSso.run(id, name, name.toLowerCase(), role, '', '', JSON.stringify(first ? 'all' : (role === 'viewer' ? 'all' : [])), new Date().toISOString(), identity.sub, identity.email || null);
      audit(name, 'created via SSO (' + role + ')', ip); u = q.byId.get(id);
    } else if (!u.oidc_sub) { q.linkSso.run(identity.sub, identity.email || null, u.id); audit(u.name, 'linked to SSO identity', ip); u = q.byId.get(u.id); }
    if (identity.admin && u.role !== 'admin') { q.upd.run('admin', u.tlp_red, u.cases, u.id); audit(u.name, 'promoted to admin by SSO policy', ip); }
    q.ok.run(new Date().toISOString(), u.id); audit(u.name, 'signed in (SSO)', ip);
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
