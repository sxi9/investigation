// Sharing and review: share links (TLP rule, expiry, revoke, views), the public projection, and the comment channel with moderation.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-share-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 'test.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
const { buildApp } = await import('../src/app.js');
const app = buildApp();
before(async () => { await app.ready(); });
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const H = { 'x-requested-with': 'CIB' }; const jar = {};
async function call(method, url, body, as, extraHeaders = {}) {
  const headers = { ...H, ...extraHeaders }; if (body !== undefined && !extraHeaders['content-type']) headers['content-type'] = 'application/json'; if (as && jar[as]) headers.cookie = jar[as];
  const r = await app.inject({ method, url, payload: body === undefined ? undefined : JSON.stringify(body), headers });
  const set = r.headers['set-cookie']; if (as && set) jar[as] = String(Array.isArray(set) ? set[0] : set).split(';')[0];
  let j = null; try { j = r.json(); } catch (e) {}
  return { status: r.statusCode, body: j };
}
const PW = 'Correct-Horse-Battery-9';
const CASE = { id: 'c-sh', number: 'CASE 0001', title: 'Harbor CU phishing', tlp: 'green', notes: 'INTERNAL working theory', judgement: { text: 'Credential phishing wave against members; Lantern kit rebrand.' }, items: [
  { id: 'i1', type: 'indicator', kind: 'domain', value: 'portal-secure-login[.]com', status: 'confirmed', num: 1, pinned: true, title: 'Lure domain', body: 'clone of the member login', todo: [{ text: 'secret task' }], comments: [{ by: 'Ana', text: 'internal comment', at: '2026-01-01' }], x: 10, y: 10 },
  { id: 'i2', type: 'indicator', kind: 'ip', value: '88.119.167.239', status: 'false', num: 2, pinned: true, x: 10, y: 10 },
  { id: 'i3', type: 'note', body: 'unpinned scratch', pinned: false, x: 0, y: 0 },
  { id: 'e1', type: 'event', title: 'First lure sent', date: '2026-03-14', time: '09:14', num: 3, pinned: true, x: 300, y: 10 },
], threads: [{ id: 't1', from: 'i1', to: 'e1', rel: 'linked', why: 'sent in the lure' }, { id: 't2', from: 'i2', to: 'e1', rel: 'linked' }], groups: [], log: [], dismissed: [], hypotheses: [{ id: 'h1', text: 'Lantern kit rebrand' }] };
let link = null;

test('setup, accounts, a green case and a red case', async () => {
  await call('POST', '/api/auth/setup', { name: 'Admin', pass: PW }, 'admin');
  await call('POST', '/api/users', { name: 'Ana', pass: PW, role: 'analyst', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Ana', pass: PW }, 'ana');
  await call('POST', '/api/users', { name: 'Vic', pass: PW, role: 'viewer', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Vic', pass: PW }, 'vic');
  await call('POST', '/api/users', { name: 'Rev', pass: PW, role: 'reviewer', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Rev', pass: PW }, 'rev');
  const r = await call('PUT', '/api/store', { cases: [CASE, { ...CASE, id: 'c-red', number: 'CASE 0002', tlp: 'red', title: 'Restricted' }] }, 'admin'); assert.equal(r.body.accepted.length, 2);
});

test('share links: editors only, TLP:CLEAR/GREEN only, token shown once, listed with views', async () => {
  assert.equal((await call('POST', '/api/shares', { caseId: 'c-sh' }, 'vic')).status, 403, 'viewers cannot share');
  const red = await call('POST', '/api/shares', { caseId: 'c-red' }, 'admin'); assert.equal(red.status, 403); assert.match(red.body.error, /TLP:CLEAR or TLP:GREEN/);
  const r = await call('POST', '/api/shares', { caseId: 'c-sh', label: 'For the bank', days: 7, allowComments: true }, 'ana'); assert.equal(r.status, 200); link = r.body.share;
  assert.match(link.url, /^\/share\.html#sh[A-Za-z0-9]+:[A-Za-z0-9_-]{20,}$/); assert.ok(link.token); assert.equal(link.allowComments, true);
  const l = await call('GET', '/api/shares?caseId=c-sh', undefined, 'ana'); assert.equal(l.body.shares.length, 1); assert.equal(l.body.shares[0].token, undefined); assert.equal(l.body.shares[0].views, 0); assert.equal(l.body.shares[0].active, true);
  assert.equal((await call('GET', '/api/shares?caseId=c-sh', undefined, 'vic')).status, 404);
});

test('the public page gets a sanitised case: pinned non-falsified cards, no notes, tasks or internal comments; views are counted', async () => {
  const bad = await app.inject({ method: 'GET', url: '/api/share/' + link.id + '?token=nope' }); assert.equal(bad.statusCode, 404);
  const r = await app.inject({ method: 'GET', url: '/api/share/' + link.id + '?token=' + link.token }); assert.equal(r.statusCode, 200); const j = r.json();
  assert.equal(j.case.number, 'CASE 0001'); assert.equal(j.case.notes, ''); assert.match(j.case.summary, /Credential phishing/);
  assert.deepEqual(j.case.items.map(i => i.id).sort(), ['e1', 'i1'], 'falsified and unpinned cards left out');
  const i1 = j.case.items.find(i => i.id === 'i1'); assert.equal(i1.todo, undefined); assert.equal(i1.comments, undefined); assert.equal(i1.status, 'confirmed');
  assert.equal(j.case.threads.length, 1, 'threads to hidden cards dropped'); assert.equal(j.case.hypotheses.length, 1); assert.equal(j.share.allowComments, true); assert.deepEqual(j.comments, []);
  const l = await call('GET', '/api/shares?caseId=c-sh', undefined, 'ana'); assert.equal(l.body.shares[0].views, 1);
});

test('guest comments wait for moderation; accepted ones appear on the public page; replies are shown', async () => {
  const noName = await app.inject({ method: 'POST', url: '/api/share/' + link.id + '/comments?token=' + link.token, payload: { text: 'hi' }, headers: { ...H, 'content-type': 'application/json' } }); assert.equal(noName.statusCode, 400);
  const g = await app.inject({ method: 'POST', url: '/api/share/' + link.id + '/comments?token=' + link.token, payload: { name: 'Bank fraud desk', text: 'We saw this domain in customer reports on 12 March.', itemId: 'i1' }, headers: { ...H, 'content-type': 'application/json' } });
  assert.equal(g.statusCode, 200); const gc = g.json().comment; assert.equal(gc.status, 'pending'); assert.equal(gc.authorKind, 'guest');
  const hidden = await app.inject({ method: 'POST', url: '/api/share/' + link.id + '/comments?token=' + link.token, payload: { name: 'x', text: 'about a hidden card', itemId: 'i2' }, headers: { ...H, 'content-type': 'application/json' } }); assert.equal(hidden.statusCode, 404, 'cannot comment on a card the page does not show');
  const pub0 = (await app.inject({ method: 'GET', url: '/api/share/' + link.id + '?token=' + link.token })).json(); assert.equal(pub0.comments.length, 0, 'pending comments are not public');
  const asViewer = await call('GET', '/api/comments?caseId=c-sh', undefined, 'vic'); assert.equal(asViewer.body.comments.length, 0, 'viewers do not see pending comments');
  const asEditor = await call('GET', '/api/comments?caseId=c-sh', undefined, 'ana'); assert.equal(asEditor.body.pending, 1); assert.equal(asEditor.body.comments[0].id, gc.id);
  assert.equal((await call('POST', '/api/comments/' + gc.id + '/accept', undefined, 'vic')).status, 404, 'viewers cannot moderate');
  const acc = await call('POST', '/api/comments/' + gc.id + '/accept', undefined, 'ana'); assert.equal(acc.body.comment.status, 'accepted'); assert.equal(acc.body.comment.moderatedBy, 'Ana');
  await call('POST', '/api/comments/' + gc.id + '/reply', { text: 'Thank you, added to the timeline.' }, 'ana');
  const pub1 = (await app.inject({ method: 'GET', url: '/api/share/' + link.id + '?token=' + link.token })).json(); assert.equal(pub1.comments.length, 1); assert.equal(pub1.comments[0].itemId, 'i1'); assert.match(pub1.comments[0].reply, /added to the timeline/);
  const n = await call('GET', '/api/notifications', undefined, 'admin'); assert.ok(n.body.items.some(x => x.type === 'comment' && /awaiting moderation/.test(x.text)), 'editors were notified');
});

test('signed-in reviewers and viewers comment without edit rights; rejected comments stay private', async () => {
  const v = await call('POST', '/api/comments', { caseId: 'c-sh', text: 'Viewer note: the date looks wrong' }, 'vic'); assert.equal(v.status, 200); assert.equal(v.body.comment.status, 'accepted'); assert.equal(v.body.comment.authorKind, 'viewer');
  const rv = await call('POST', '/api/comments', { caseId: 'c-sh', itemId: 'e1', text: 'Reviewer: confirm the time zone' }, 'rev'); assert.equal(rv.status, 200);
  assert.equal((await call('POST', '/api/comments', { caseId: 'c-red', text: 'x' }, 'vic')).status, 404, 'cannot comment on a case you cannot see');
  assert.equal((await call('POST', '/api/comments', { caseId: 'c-sh', itemId: 'nope', text: 'x' }, 'vic')).status, 404);
  const g = await app.inject({ method: 'POST', url: '/api/share/' + link.id + '/comments?token=' + link.token, payload: { name: 'Troll', text: 'spam' }, headers: { ...H, 'content-type': 'application/json' } });
  const rej = await call('POST', '/api/comments/' + g.json().comment.id + '/reject', undefined, 'admin'); assert.equal(rej.body.comment.status, 'rejected');
  const pub = (await app.inject({ method: 'GET', url: '/api/share/' + link.id + '?token=' + link.token })).json(); assert.equal(pub.comments.length, 3); assert.ok(!pub.comments.some(c => c.author === 'Troll'));
  const all = await call('GET', '/api/comments?caseId=c-sh', undefined, 'admin'); assert.equal(all.body.comments.length, 4); assert.ok(all.body.comments.some(c => c.status === 'rejected'));
  const audit = (await call('GET', '/api/users', undefined, 'admin')).body.audit; assert.ok(audit.some(a => /rejected a comment by Troll/.test(a.what)));
});

test('revoked and expired links stop working; comments are off when the link says so', async () => {
  const ro = await call('POST', '/api/shares', { caseId: 'c-sh', label: 'read only', allowComments: false }, 'admin'); const l2 = ro.body.share;
  const c = await app.inject({ method: 'POST', url: '/api/share/' + l2.id + '/comments?token=' + l2.token, payload: { name: 'x', text: 'y' }, headers: { ...H, 'content-type': 'application/json' } }); assert.equal(c.statusCode, 403);
  assert.equal((await call('DELETE', '/api/shares/' + link.id, undefined, 'vic')).status, 404);
  await call('DELETE', '/api/shares/' + link.id, undefined, 'ana');
  const gone = await app.inject({ method: 'GET', url: '/api/share/' + link.id + '?token=' + link.token }); assert.equal(gone.statusCode, 410); assert.match(gone.json().error, /revoked/);
  const { db } = await import('../src/db.js'); db.prepare("UPDATE shares SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(l2.id);
  const exp = await app.inject({ method: 'GET', url: '/api/share/' + l2.id + '?token=' + l2.token }); assert.equal(exp.statusCode, 410); assert.match(exp.json().error, /expired/);
  const list = await call('GET', '/api/shares?caseId=c-sh', undefined, 'ana'); assert.ok(list.body.shares.every(s => !s.active));
});
