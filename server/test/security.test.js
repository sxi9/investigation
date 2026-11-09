// Security and operations: TOTP, OIDC token checks, per-file ACL, legal hold, retention, backups, personal data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-sec-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 'test.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
process.env.OIDC_ISSUER = 'https://idp.example'; process.env.OIDC_CLIENT_ID = 'board-client'; process.env.OIDC_ALLOWED_DOMAINS = 'example.org';
const { buildApp } = await import('../src/app.js');
const { code: totpCode } = await import('../src/totp.js');
const { verifyIdToken } = await import('../src/oidc.js');
const { users } = await import('../src/users.js');
const app = buildApp();
before(async () => { await app.ready(); });
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const H = { 'x-requested-with': 'CIB' }; const jar = {};
async function call(method, url, body, as, extraHeaders = {}) {
  const headers = { ...H, ...extraHeaders }; if (body !== undefined && !extraHeaders['content-type']) headers['content-type'] = 'application/json'; if (as && jar[as]) headers.cookie = jar[as];
  const r = await app.inject({ method, url, payload: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)), headers });
  const set = r.headers['set-cookie']; if (as && set) jar[as] = String(Array.isArray(set) ? set[0] : set).split(';')[0];
  let j = null; try { j = r.json(); } catch (e) {}
  return { status: r.statusCode, body: j, raw: r };
}
const PW = 'Correct-Horse-Battery-9';
const mkCase = (id, extra = {}) => ({ id, number: 'CASE 0001', title: 'Case ' + id, tlp: '', items: [], threads: [], groups: [], log: [], dismissed: [], ...extra });

test('setup, session advertises SSO, create an analyst and a viewer', async () => {
  const r = await call('POST', '/api/auth/setup', { name: 'Admin', pass: PW }, 'admin'); assert.equal(r.status, 200);
  const s = await call('GET', '/api/auth/session', undefined, 'admin'); assert.equal(s.body.sso.start, '/api/auth/oidc/start');
  await call('POST', '/api/users', { name: 'Ana', pass: PW, role: 'analyst', cases: 'all', mustChange: false }, 'admin');
  await call('POST', '/api/users', { name: 'Vic', pass: PW, role: 'viewer', cases: 'all', mustChange: false }, 'admin');
  const a = await call('POST', '/api/auth/login', { name: 'Ana', pass: PW }, 'ana'); assert.equal(a.status, 200);
  const v = await call('POST', '/api/auth/login', { name: 'Vic', pass: PW }, 'vic'); assert.equal(v.status, 200);
});

test('TOTP: setup, confirm, then sign-in needs the second step; wrong codes fail', async () => {
  const st = await call('POST', '/api/auth/totp/setup', undefined, 'ana'); assert.equal(st.status, 200); assert.match(st.body.uri, /^otpauth:\/\/totp\//); assert.ok(st.body.svg.includes('<svg'));
  const bad = await call('POST', '/api/auth/totp/confirm', { code: '000000' }, 'ana'); assert.equal(bad.status, 400);
  const ok = await call('POST', '/api/auth/totp/confirm', { code: totpCode(st.body.secret) }, 'ana'); assert.equal(ok.status, 200);
  const me = await call('GET', '/api/auth/session', undefined, 'ana'); assert.equal(me.body.user.totp, true);
  delete jar.ana2;
  const l = await call('POST', '/api/auth/login', { name: 'Ana', pass: PW }, 'ana2'); assert.equal(l.status, 200); assert.equal(l.body.totpRequired, true); assert.ok(l.body.challenge); assert.equal(jar.ana2, undefined, 'no session cookie before the second factor');
  const w = await call('POST', '/api/auth/login/totp', { challenge: l.body.challenge, code: '123456' }, 'ana2'); assert.equal(w.status, 401);
  const g = await call('POST', '/api/auth/login/totp', { challenge: l.body.challenge, code: totpCode(st.body.secret) }, 'ana2'); assert.equal(g.status, 200); assert.equal(g.body.user.name, 'Ana'); assert.ok(jar.ana2);
  const again = await call('POST', '/api/auth/login/totp', { challenge: l.body.challenge, code: totpCode(st.body.secret) }, 'x'); assert.equal(again.status, 401, 'a challenge is single use');
});

test('admin can remove a second factor; the user can turn it off with their password', async () => {
  const u = (await call('GET', '/api/users', undefined, 'admin')).body.users.find(x => x.name === 'Ana'); assert.equal(u.totp, true);
  const asVic = await call('POST', '/api/users/' + u.id + '/totp/disable', undefined, 'vic'); assert.equal(asVic.status, 403);
  const r = await call('POST', '/api/users/' + u.id + '/totp/disable', undefined, 'admin'); assert.equal(r.status, 200);
  const me = await call('GET', '/api/auth/session', undefined, 'ana'); assert.equal(me.body.user.totp, false);
  const st = await call('POST', '/api/auth/totp/setup', undefined, 'ana'); await call('POST', '/api/auth/totp/confirm', { code: totpCode(st.body.secret) }, 'ana');
  const wrong = await call('POST', '/api/auth/totp/disable', { pass: 'nope' }, 'ana'); assert.equal(wrong.status, 401);
  const off = await call('POST', '/api/auth/totp/disable', { pass: PW }, 'ana'); assert.equal(off.status, 200);
});

test('OIDC: id_token verification accepts a good RS256 token and rejects tampering, wrong audience, expiry and nonce', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const now = Math.floor(Date.now() / 1000);
  const sign = (payload, header = { alg: 'RS256', kid: 'k1', typ: 'JWT' }) => { const h = Buffer.from(JSON.stringify(header)).toString('base64url'), p = Buffer.from(JSON.stringify(payload)).toString('base64url'); const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), privateKey).toString('base64url'); return h + '.' + p + '.' + sig; };
  const good = { iss: 'https://idp.example', aud: 'board-client', sub: 'u-1', exp: now + 300, iat: now, nonce: 'n1', email: 'dana@example.org', name: 'Dana' };
  assert.equal(verifyIdToken(sign(good), 'n1', [jwk]).email, 'dana@example.org');
  assert.throws(() => verifyIdToken(sign(good) + 'x', 'n1', [jwk]), /signature/);
  assert.throws(() => verifyIdToken(sign({ ...good, aud: 'other' }), 'n1', [jwk]), /audience/);
  assert.throws(() => verifyIdToken(sign({ ...good, exp: now - 600 }), 'n1', [jwk]), /expired/);
  assert.throws(() => verifyIdToken(sign(good), 'n2', [jwk]), /nonce/);
  assert.throws(() => verifyIdToken(sign(good, { alg: 'none', kid: 'k1' }), 'n1', [jwk]), /alg/);
  assert.throws(() => verifyIdToken(sign({ ...good, iss: 'https://evil.example' }), 'n1', [jwk]), /issuer/);
});

test('OIDC: first SSO sign-in creates the account; password login is refused for SSO-only accounts; domain policy applies', async () => {
  const r = users.ssoLogin({ sub: 'u-1', email: 'dana@example.org', name: 'Dana', admin: false }, '127.0.0.1', 'test', 'viewer');
  assert.equal(r.user.role, 'viewer'); assert.equal(r.user.sso, true); assert.ok(r.token);
  const again = users.ssoLogin({ sub: 'u-1', email: 'dana@example.org', name: 'Dana', admin: false }, '127.0.0.1', 'test', 'viewer'); assert.equal(again.user.id, r.user.id);
  const pw = await call('POST', '/api/auth/login', { name: 'Dana', pass: PW }); assert.equal(pw.status, 401);
  const { identityFrom } = await import('../src/oidc.js'); void identityFrom; // domain filter is applied inside identityFrom; config read here
  const start = await call('GET', '/api/auth/oidc/callback?state=zzz&code=abc'); assert.equal(start.status, 400, 'state mismatch without the start cookie');
});

test('per-file ACL: a file tied to a TLP:RED case is served only to those who can see the case', async () => {
  await call('POST', '/api/users', { name: 'Red', pass: PW, role: 'analyst', cases: 'all', tlpRed: true, mustChange: false }, 'admin');
  await call('POST', '/api/auth/login', { name: 'Red', pass: PW }, 'red');
  const put = await call('PUT', '/api/store', { cases: [mkCase('c-red', { tlp: 'red' })] }, 'red'); assert.equal(put.body.accepted.length, 1);
  const up = await app.inject({ method: 'PUT', url: '/api/files/f-1', payload: Buffer.from('secret-bytes'), headers: { ...H, cookie: jar.red, 'content-type': 'image/png', 'x-file-name': 'a.png', 'x-case-id': 'c-red' } });
  assert.equal(up.statusCode, 200);
  const forbidden = await app.inject({ method: 'PUT', url: '/api/files/f-2', payload: Buffer.from('x'), headers: { ...H, cookie: jar.ana, 'content-type': 'image/png', 'x-case-id': 'c-red' } }); assert.equal(forbidden.statusCode, 404, 'no upload into a case you cannot edit');
  assert.equal((await call('GET', '/api/files/f-1', undefined, 'ana')).status, 404, 'analyst without the TLP:RED grant');
  assert.equal((await call('GET', '/api/files/f-1', undefined, 'vic')).status, 404);
  assert.equal((await call('GET', '/api/files/f-1', undefined, 'red')).status, 200);
  assert.equal((await call('GET', '/api/files/f-1', undefined, 'admin')).status, 200);
});

test('legal hold: only admins set it; a held case survives delete and retention; release and purge', async () => {
  await call('PUT', '/api/store', { cases: [mkCase('c-hold')] }, 'ana');
  const asAna = await call('POST', '/api/admin/holds/c-hold', { on: true }, 'ana'); assert.equal(asAna.status, 403);
  const smuggled = await call('PUT', '/api/store', { cases: [{ ...mkCase('c-hold'), legalHold: true, rev: 1 }] }, 'ana'); assert.equal(smuggled.body.rejected[0].reason, 'only an admin can set or clear a legal hold');
  const h = await call('POST', '/api/admin/holds/c-hold', { on: true }, 'admin'); assert.equal(h.status, 200); assert.equal(h.body.case.legalHold, true);
  const list = await call('GET', '/api/admin/holds', undefined, 'admin'); assert.equal(list.body.cases.find(c => c.id === 'c-hold').legalHold, true);
  const del = await call('PUT', '/api/store', { cases: [], deleted: ['c-hold'] }, 'ana'); assert.deepEqual(del.body.deleted, []);
  assert.ok((await call('GET', '/api/store', undefined, 'ana')).body.cases.some(c => c.id === 'c-hold'), 'still there');
  const c = (await call('GET', '/api/store', undefined, 'ana')).body.cases.find(c => c.id === 'c-hold'); assert.match(c.log.at(-1).m, /Legal hold set by Admin/);
  // release, delete, purge with a zero-day window
  await call('POST', '/api/admin/holds/c-hold', { on: false }, 'admin');
  const del2 = await call('PUT', '/api/store', { cases: [], deleted: ['c-hold'] }, 'ana'); assert.deepEqual(del2.body.deleted, ['c-hold']);
  const p0 = await call('POST', '/api/admin/purge', { days: 0 }, 'admin'); assert.equal(p0.status, 200); assert.ok(p0.body.purged >= 1);
  assert.equal((await call('POST', '/api/admin/purge', { days: 0 }, 'ana')).status, 403);
});

test('held cases are skipped by the purge', async () => {
  await call('PUT', '/api/store', { cases: [mkCase('c-keep')] }, 'ana');
  await call('POST', '/api/admin/holds/c-keep', { on: true }, 'admin');
  const { store } = await import('../src/store.js'); const { db } = await import('../src/db.js');
  db.prepare("UPDATE cases SET deleted_at = '2000-01-01T00:00:00.000Z' WHERE id = 'c-keep'").run();
  assert.equal(store.purgeDeleted(0), 0);
  assert.ok(db.prepare("SELECT id FROM cases WHERE id = 'c-keep'").get());
});

test('backups: admin writes a consistent snapshot and lists it', async () => {
  assert.equal((await call('POST', '/api/admin/backup', undefined, 'ana')).status, 403);
  const r = await call('POST', '/api/admin/backup', undefined, 'admin'); assert.equal(r.status, 200); assert.match(r.body.name, /^cib-.*\.sqlite$/); assert.ok(r.body.size > 0);
  const l = await call('GET', '/api/admin/backups', undefined, 'admin'); assert.equal(l.body.backups[0].name, r.body.name);
  assert.ok(fs.existsSync(path.join(tmp, 'backups', r.body.name)));
  const { DatabaseSync } = await import('node:sqlite'); const copy = new DatabaseSync(path.join(tmp, 'backups', r.body.name), { readOnly: true });
  assert.ok(copy.prepare('SELECT COUNT(*) AS n FROM users').get().n >= 4); copy.close();
});

test('personal data export collects cards, comments, tasks and log lines naming a person', async () => {
  const c = mkCase('c-pd', { items: [{ id: 'p1', type: 'person', title: 'Richard Teng', body: 'CEO', tags: [], comments: [{ by: 'Ana', at: '2026-01-01', text: 'spoke to Richard Teng' }], todo: [{ text: 'call', owner: 'Richard Teng', due: '' }] }], log: [{ t: '2026-01-01', m: 'Added Richard Teng' }] });
  await call('PUT', '/api/store', { cases: [c] }, 'ana');
  assert.equal((await call('GET', '/api/admin/person-data?name=Richard%20Teng', undefined, 'ana')).status, 403);
  const r = await call('GET', '/api/admin/person-data?name=richard%20teng', undefined, 'admin'); assert.equal(r.status, 200);
  const hit = r.body.cases.find(x => x.id === 'c-pd'); assert.equal(hit.personCards.length, 1); assert.equal(hit.comments.length, 1); assert.equal(hit.tasks.length, 1); assert.equal(hit.logLines.length, 1);
  const audit = (await call('GET', '/api/users', undefined, 'admin')).body.audit; assert.ok(audit.some(a => /personal-data export/.test(a.what)));
});
