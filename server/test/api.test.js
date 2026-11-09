// API tests: run with `npm test` (node:test, in-process Fastify, temporary SQLite file).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-test-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 'test.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
const { buildApp } = await import('../src/app.js');
const { verifyAuditChain } = await import('../src/crypto.js');
const app = buildApp();
before(async () => { await app.ready(); });
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const H = { 'x-requested-with': 'CIB', 'content-type': 'application/json' };
const jar = {}; // name -> cookie
async function call(method, url, body, as, extraHeaders = {}) {
  const headers = { ...H, ...extraHeaders }; if (as && jar[as]) headers.cookie = jar[as];
  const r = await app.inject({ method, url, payload: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)), headers });
  const set = r.headers['set-cookie']; if (as && set) jar[as] = String(Array.isArray(set) ? set[0] : set).split(';')[0];
  let j = null; try { j = r.json(); } catch (e) {}
  return { status: r.statusCode, body: j, raw: r };
}
const PW = 'Correct-Horse-Battery-9';
const mkCase = (id, extra = {}) => ({ id, number: 'CASE 0001', title: 'Case ' + id, tlp: '', items: [], threads: [], groups: [], log: [], dismissed: [], ...extra });

test('health and empty state', async () => {
  const r = await call('GET', '/api/health'); assert.equal(r.status, 200); assert.equal(r.body.users, 0); assert.equal(r.body.ai, 'local');
  const s = await call('GET', '/api/auth/session'); assert.equal(s.body.user, null); assert.equal(s.body.hasUsers, false);
});
test('writes without the CSRF header are refused', async () => {
  const r = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { name: 'x', pass: PW }, headers: { 'content-type': 'application/json' } });
  assert.equal(r.statusCode, 403);
});
test('cross-origin writes are refused', async () => {
  const r = await call('POST', '/api/auth/setup', { name: 'x', pass: PW }, null, { origin: 'https://evil.example', host: 'board.example' });
  assert.equal(r.status, 403);
});
test('first-run setup creates the admin; weak passwords are refused', async () => {
  let r = await call('POST', '/api/auth/setup', { name: 'Admin One', pass: 'password1' }, 'admin'); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/setup', { name: 'Admin One', pass: 'short' }, 'admin'); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/setup', { name: 'Admin One', pass: PW }, 'admin'); assert.equal(r.status, 200); assert.equal(r.body.user.role, 'admin');
  assert.ok(jar.admin, 'session cookie set'); assert.match(jar.admin, /^cib_session=/);
  r = await call('POST', '/api/auth/setup', { name: 'Again', pass: PW }); assert.equal(r.status, 409, 'setup is one-shot');
  const set = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { name: 'Admin One', pass: PW }, headers: H })).headers['set-cookie'];
  assert.match(String(set), /HttpOnly/i); assert.match(String(set), /SameSite=Strict/i);
});
test('admin creates users with roles and scopes; non-admins cannot', async () => {
  let r = await call('POST', '/api/users', { name: 'Ana Lyst', pass: PW, role: 'analyst', cases: [], mustChange: false }, 'admin'); assert.equal(r.status, 200); assert.equal(r.body.user.role, 'analyst');
  r = await call('POST', '/api/users', { name: 'Rev Iewer', pass: PW, role: 'reviewer', cases: 'all', mustChange: false }, 'admin'); assert.equal(r.status, 200);
  r = await call('POST', '/api/users', { name: 'View Only', pass: PW, role: 'viewer', cases: 'all', mustChange: false }, 'admin'); assert.equal(r.status, 200);
  r = await call('POST', '/api/users', { name: 'Red Clear', pass: PW, role: 'analyst', cases: 'all', tlpRed: true, mustChange: false }, 'admin'); assert.equal(r.status, 200);
  r = await call('POST', '/api/auth/login', { name: 'ana lyst', pass: PW }, 'ana'); assert.equal(r.status, 200, 'names are case-insensitive');
  await call('POST', '/api/auth/login', { name: 'Rev Iewer', pass: PW }, 'rev');
  await call('POST', '/api/auth/login', { name: 'View Only', pass: PW }, 'view');
  await call('POST', '/api/auth/login', { name: 'Red Clear', pass: PW }, 'red');
  r = await call('GET', '/api/users', undefined, 'ana'); assert.equal(r.status, 403);
  r = await call('POST', '/api/users', { name: 'Nope', pass: PW }, 'ana'); assert.equal(r.status, 403);
});
test('wrong passwords are counted and the account locks', async () => {
  for (let i = 0; i < 10; i++) { const r = await call('POST', '/api/auth/login', { name: 'View Only', pass: 'wrong-' + i }); assert.equal(r.status, 401); }
  const r = await call('POST', '/api/auth/login', { name: 'View Only', pass: PW }); assert.equal(r.status, 423, 'locked even with the right password');
  const u = (await call('GET', '/api/users', undefined, 'admin')).body.users.find(x => x.name === 'View Only'); assert.equal(u.locked, true);
  // an admin reset clears the lock
  await call('POST', '/api/users/' + u.id + '/password', { pass: PW + 'x' }, 'admin');
  const r2 = await call('POST', '/api/auth/login', { name: 'View Only', pass: PW + 'x' }, 'view'); assert.equal(r2.status, 200); assert.equal(r2.body.user.mustChange, true);
});
test('store: admin creates cases, numbers are server-assigned, revisions increase', async () => {
  let r = await call('PUT', '/api/store', { cases: [mkCase('a1'), mkCase('a2', { number: 'CASE 0001', tlp: 'red' })] }, 'admin');
  assert.equal(r.status, 200); assert.equal(r.body.accepted.length, 2); assert.equal(r.body.rejected.length, 0);
  const nums = r.body.accepted.map(a => a.number); assert.notEqual(nums[0], nums[1], 'duplicate client numbers are reassigned');
  r = await call('PUT', '/api/store', { cases: [{ ...mkCase('a1'), title: 'Renamed' }] }, 'admin'); assert.equal(r.body.accepted[0].rev, 2);
  r = await call('PUT', '/api/store', { cases: [{ ...mkCase('a1'), title: 'Renamed' }] }, 'admin'); assert.equal(r.body.accepted[0].unchanged, true, 'identical writes do not bump the revision');
});
test('store: scope and TLP decide what each role can see', async () => {
  let r = await call('GET', '/api/store', undefined, 'ana'); assert.deepEqual(r.body.cases.map(c => c.id), [], 'analyst with an empty scope sees nothing');
  r = await call('GET', '/api/store', undefined, 'rev'); assert.deepEqual(r.body.cases.map(c => c.id).sort(), ['a1'], 'reviewer with cases=all but no TLP:RED grant does not see the red case');
  r = await call('GET', '/api/store', undefined, 'red'); assert.deepEqual(r.body.cases.map(c => c.id).sort(), ['a1', 'a2']);
  r = await call('GET', '/api/store/case/a2', undefined, 'rev'); assert.equal(r.status, 404, 'hidden cases are not found, not forbidden');
});
test('store: analysts create (and are granted) their own cases; viewers and reviewers are limited', async () => {
  let r = await call('PUT', '/api/store', { cases: [mkCase('b1')] }, 'ana'); assert.equal(r.body.accepted.length, 1);
  r = await call('GET', '/api/store', undefined, 'ana'); assert.deepEqual(r.body.cases.map(c => c.id), ['b1'], 'creator is granted the new case');
  r = await call('PUT', '/api/store', { cases: [mkCase('b1', { tlp: 'red' })] }, 'ana'); assert.equal(r.body.rejected[0].reason, 'no TLP:RED grant');
  r = await call('PUT', '/api/store', { cases: [mkCase('v1')] }, 'view'); assert.equal(r.status, 403, 'a temporary password only unlocks the password change');
  r = await call('GET', '/api/store', undefined, 'view'); assert.equal(r.status, 403);
  await call('POST', '/api/auth/password', { pass: PW + 'y' }, 'view');
  r = await call('PUT', '/api/store', { cases: [mkCase('v1')] }, 'view'); assert.equal(r.body.rejected[0].reason, 'not allowed to create cases');
  r = await call('PUT', '/api/store', { cases: [{ ...mkCase('a1'), title: 'Viewer edit' }] }, 'view'); assert.equal(r.body.rejected[0].reason, 'read-only for your role');
  r = await call('PUT', '/api/store', { cases: [{ ...mkCase('a1'), title: 'Renamed', review: 'in review' }] }, 'rev'); assert.equal(r.body.accepted.length, 1, 'reviewer may move a file through review');
  r = await call('PUT', '/api/store', { cases: [{ ...mkCase('a1'), title: 'Reviewer rename' }] }, 'rev'); assert.equal(r.body.rejected[0].reason, 'read-only for your role');
  r = await call('PUT', '/api/store', { deleted: ['a1'] }, 'view'); assert.deepEqual(r.body.deleted, []);
});
test('guests: only when a public CLEAR/GREEN case exists, read-only', async () => {
  let r = await call('POST', '/api/auth/guest', {}, 'guest'); assert.equal(r.status, 404);
  await call('PUT', '/api/store', { cases: [mkCase('p1', { public: true, tlp: 'green' }), mkCase('p2', { public: true, tlp: 'amber' })] }, 'admin');
  r = await call('POST', '/api/auth/guest', {}, 'guest'); assert.equal(r.status, 200); assert.equal(r.body.user.guest, true);
  r = await call('GET', '/api/store', undefined, 'guest'); assert.deepEqual(r.body.cases.map(c => c.id), ['p1'], 'amber public case stays hidden from guests');
  r = await call('PUT', '/api/store', { cases: [mkCase('p1', { title: 'guest edit' })] }, 'guest'); assert.equal(r.status, 403);
  r = await call('GET', '/api/users', undefined, 'guest'); assert.equal(r.status, 403);
  r = await call('POST', '/api/ai/complete', { messages: [] }, 'guest'); assert.equal(r.status, 403);
});
test('files: stored by hash, readable by accounts only', async () => {
  const buf = Buffer.from('hello evidence');
  let r = await call('PUT', '/api/files/item1', buf, 'ana', { 'content-type': 'text/plain', 'x-file-name': 'note.txt' }); assert.equal(r.status, 200); assert.equal(r.body.size, 14); assert.match(r.body.sha256, /^[a-f0-9]{64}$/);
  r = await call('GET', '/api/files/item1', undefined, 'rev'); assert.equal(r.status, 200); assert.equal(r.raw.body, 'hello evidence'); assert.equal(r.raw.headers['x-sha256'].length, 64);
  r = await call('PUT', '/api/files/item2', buf, 'view', { 'content-type': 'text/plain' }); assert.equal(r.status, 403);
  r = await call('GET', '/api/files/item1', undefined, 'guest'); assert.equal(r.status, 403);
  r = await call('PUT', '/api/files/../etc', buf, 'ana', { 'content-type': 'text/plain' }); assert.notEqual(r.status, 200);
});
test('proxy: allow-list, https only, no private addresses, accounts only', async () => {
  let r = await call('GET', '/api/proxy?url=https://evil.example/x', undefined, 'ana'); assert.equal(r.status, 403);
  r = await call('GET', '/api/proxy?url=http://crt.sh/?q=x', undefined, 'ana'); assert.equal(r.status, 400);
  r = await call('GET', '/api/proxy?url=https://crt.sh/?q=x', undefined, 'guest'); assert.equal(r.status, 403);
  r = await call('GET', '/api/proxy?url=https://user:pw@crt.sh/', undefined, 'ana'); assert.equal(r.status, 400);
  const { proxyFetch, providerHeaders } = await import('../src/proxy.js');
  await assert.rejects(proxyFetch('https://localhost/'), /allow-list/);
  const { config } = await import('../src/config.js');
  config.providerKeys['threatfox-api.abuse.ch'] = { 'Auth-Key': 'k1' }; config.providerKeys['api.shodan.io'] = { query: { key: 'sk' } };
  assert.deepEqual(providerHeaders(new URL('https://threatfox-api.abuse.ch/api/v1/')), { 'Auth-Key': 'k1' });
  const su = new URL('https://api.shodan.io/shodan/host/1.1.1.1'); providerHeaders(su); assert.equal(su.searchParams.get('key'), 'sk');
});
test('AI gateway: local engine answers in the shapes the board expects', async () => {
  const assessPrompt = 'CASE: CASE 0420 — SafePay\nCASE NOTES:\nsoc.dll beacons to 88.119.167.239\n\nCARD UNDER REVIEW:\n{"type":"Indicator","number":"E5","value":"88.119.167.239","kind":"ip","status":"confirmed","source":"CISA"}\n\nOTHER CARDS ON THE BOARD:\nE1 [Document] soc.dll hash 921df8 — C2 88.119.167.239\nE2 [Location] Vilnius, Lithuania — Bacloud AS61272 hosts 88.119.167.239\n\nEXISTING THREADS:\n(none)\n\nReturn JSON with exactly these keys:\n{"summary": ...}';
  let r = await call('POST', '/api/ai/complete', { system: 'You are a senior threat-intelligence analyst helping with an investigation board.', messages: [{ role: 'user', content: assessPrompt }] }, 'ana');
  assert.equal(r.status, 200); assert.equal(r.body.engine, 'local'); const a = JSON.parse(r.body.text);
  assert.ok(a.summary && Array.isArray(a.threads) && Array.isArray(a.next_steps)); assert.equal(a.assessment, 'confirmed'); const byTo = Object.fromEntries(a.threads.map(t => [t.to, t.rel])); assert.equal(byTo.E1, 'linked', 'shares the IP with the document'); assert.equal(byTo.E2, 'located', 'location cards get located-at'); assert.ok(a.next_steps.some(x => /RDAP|ASN/.test(x)));
  r = await call('POST', '/api/ai/complete', { system: 'You extract entities for an investigator. Reply with JSON only.', messages: [{ role: 'user', content: 'From the text list entities as {"entities": [...]}\n\nTEXT:\nOn 18 Oct 2026 Riskified Inc paid $2.5 million to John Carter in Vilnius; call +370 600 12345 or j.carter@example.com. Plate AB12 CDE.' }] }, 'ana');
  const e = JSON.parse(r.body.text).entities; const types = new Set(e.map(x => x.type));
  for (const t of ['org', 'money', 'person', 'place', 'phone', 'email', 'date', 'vehicle']) assert.ok(types.has(t), 'entity type ' + t + ' found in ' + JSON.stringify(e));
  r = await call('POST', '/api/ai/complete', { system: 'You analyse posts for a disinformation / crime investigator. Reply with JSON only.', messages: [{ role: 'user', content: 'For this text give {"sentiment": ..., "stance": ...}\n\nTEXT:\nWe must stop this corrupt scam, boycott them, they lie and hack their users.' }] }, 'ana');
  const s = JSON.parse(r.body.text); assert.equal(s.sentiment, 'negative'); assert.equal(s.stance, 'oppose');
  r = await call('POST', '/api/ai/complete', { system: 'You translate evidence for an investigator. Reply with JSON only.', messages: [{ role: 'user', content: 'Detect the language of this text and translate it to English faithfully. Return {"lang": ..., "translation": ...}\n\nTEXT:\nLa cuenta fue comprometida por los atacantes con una contraseña robada.' }] }, 'ana');
  const t = JSON.parse(r.body.text); assert.equal(t.lang, 'Spanish'); assert.match(t.translation, /No translation model/);
});
test('sessions: logout invalidates the cookie; audit chain verifies', async () => {
  let r = await call('POST', '/api/auth/logout', {}, 'ana'); assert.equal(r.status, 200);
  r = await call('GET', '/api/store', undefined, 'ana'); assert.equal(r.status, 401);
  const chain = verifyAuditChain(); assert.equal(chain.ok, true); assert.ok(chain.rows > 20);
  const h = await call('GET', '/api/health'); assert.equal(h.body.audit.ok, true);
});
