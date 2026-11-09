// Collaboration tests: three-way merge, revision history + restore, review rule, mentions and presence.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-collab-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 't.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
const { mergeCase } = await import('../src/merge.js');
const { buildApp } = await import('../src/app.js');
const { findMentions } = await import('../src/collab.js');
const app = buildApp(); before(() => app.ready()); after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const H = { 'x-requested-with': 'CIB' }; const jar = {};
async function call(method, url, body, as) { const headers = { ...H }; if (body !== undefined) headers['content-type'] = 'application/json'; if (as && jar[as]) headers.cookie = jar[as]; const r = await app.inject({ method, url, payload: body === undefined ? undefined : JSON.stringify(body), headers }); const set = r.headers['set-cookie']; if (as && set) jar[as] = String(Array.isArray(set) ? set[0] : set).split(';')[0]; let j = null; try { j = r.json(); } catch (e) {} return { status: r.statusCode, body: j }; }
const PW = 'Correct-Horse-Battery-9';
const base = () => ({ id: 'm1', number: 'CASE 0500', title: 'Merge case', tlp: '', review: 'draft', notes: 'n', items: [{ id: 'i1', type: 'note', body: 'one', x: 0, y: 0 }, { id: 'i2', type: 'note', body: 'two', x: 10, y: 10 }], threads: [], groups: [], log: [{ t: '2026-01-01T00:00:00Z', m: 'opened' }], dismissed: [] });

test('mergeCase keeps both sides: different fields, different items, deletions and additions', () => {
  const b = base();
  const server = { ...b, title: 'Renamed by Ana', items: [{ ...b.items[0], body: 'one (Ana)' }, b.items[1], { id: 'i3', type: 'note', body: 'added by Ana' }], log: [...b.log, { t: '2026-01-02T00:00:00Z', m: 'ana edit' }] };
  const incoming = { ...b, notes: 'notes by Bob', items: [{ ...b.items[0], x: 99 }, { id: 'i4', type: 'note', body: 'added by Bob' }], log: [...b.log, { t: '2026-01-03T00:00:00Z', m: 'bob edit' }] }; // Bob moved i1, deleted i2, added i4
  const m = mergeCase(b, server, incoming);
  assert.equal(m.title, 'Renamed by Ana'); assert.equal(m.notes, 'notes by Bob');
  const by = Object.fromEntries(m.items.map(i => [i.id, i]));
  assert.equal(by.i1.body, 'one (Ana)', 'Ana\'s body edit kept'); assert.equal(by.i1.x, 99, 'Bob\'s move kept');
  assert.ok(!by.i2, 'Bob deleted an item Ana did not touch'); assert.ok(by.i3 && by.i4, 'both additions kept');
  assert.deepEqual(m.log.map(l => l.m), ['opened', 'ana edit', 'bob edit']);
});
test('mergeCase: a deletion loses to a concurrent edit; same-field conflicts go to the client', () => {
  const b = base();
  const server = { ...b, items: [{ ...b.items[0], body: 'edited on server' }, b.items[1]] };
  const incoming = { ...b, items: [b.items[1]], title: 'client title' };
  const m = mergeCase(b, server, incoming);
  assert.ok(m.items.find(i => i.id === 'i1'), 'server edit survives the client\'s delete'); assert.equal(m.title, 'client title');
  const m2 = mergeCase(b, { ...b, title: 'S' }, { ...b, title: 'C' }); assert.equal(m2.title, 'C');
});
test('stale writes are merged on the server and the history keeps every revision', async () => {
  await call('POST', '/api/auth/setup', { name: 'Admin', pass: PW }, 'admin');
  await call('POST', '/api/users', { name: 'Bob Builder', pass: PW, role: 'analyst', cases: 'all', mustChange: false }, 'admin');
  await call('POST', '/api/auth/login', { name: 'Bob Builder', pass: PW }, 'bob');
  let r = await call('PUT', '/api/store', { cases: [base()] }, 'admin'); assert.equal(r.body.accepted[0].rev, 1);
  const v1 = (await call('GET', '/api/store/case/m1', undefined, 'admin')).body.case; assert.equal(v1.rev, 1);
  // Ana (admin) renames from rev 1
  r = await call('PUT', '/api/store', { cases: [{ ...v1, title: 'Ana title' }] }, 'admin'); assert.equal(r.body.accepted[0].rev, 2);
  // Bob still at rev 1 edits notes and adds an item
  r = await call('PUT', '/api/store', { cases: [{ ...v1, notes: 'Bob notes', items: [...v1.items, { id: 'i9', type: 'note', body: 'bob' }] }] }, 'bob');
  assert.equal(r.body.accepted[0].merged, true); assert.equal(r.body.accepted[0].rev, 3);
  const v3 = (await call('GET', '/api/store/case/m1', undefined, 'admin')).body.case;
  assert.equal(v3.title, 'Ana title'); assert.equal(v3.notes, 'Bob notes'); assert.equal(v3.items.length, 3);
  const revs = (await call('GET', '/api/store/case/m1/revisions', undefined, 'bob')).body.revisions; assert.deepEqual(revs.map(x => x.rev), [2, 1]);
  const old = (await call('GET', '/api/store/case/m1/revisions/1', undefined, 'bob')).body.case; assert.equal(old.title, 'Merge case');
  r = await call('POST', '/api/store/case/m1/restore/1', {}, 'bob'); assert.equal(r.body.case.title, 'Merge case'); assert.equal(r.body.case.rev, 4);
  await call('POST', '/api/users', { name: 'Vera View', pass: PW, role: 'viewer', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Vera View', pass: PW }, 'vera');
  r = await call('POST', '/api/store/case/m1/restore/2', {}, 'vera'); assert.equal(r.status, 404, 'viewers cannot restore');
});
test('TLP:RED publishing needs a second account', async () => {
  await call('POST', '/api/users', { name: 'Red Rev', pass: PW, role: 'reviewer', cases: 'all', tlpRed: true, mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Red Rev', pass: PW }, 'rev');
  const red = { ...base(), id: 'r1', number: 'CASE 0501', tlp: 'red' };
  await call('PUT', '/api/store', { cases: [red] }, 'admin');
  let cur = (await call('GET', '/api/store/case/r1', undefined, 'admin')).body.case;
  let r = await call('PUT', '/api/store', { cases: [{ ...cur, review: 'published', signoff: { by: 'Admin', at: 'x' } }] }, 'admin'); assert.match(r.body.rejected[0].reason, /must go through review/);
  r = await call('PUT', '/api/store', { cases: [{ ...cur, review: 'in review' }] }, 'admin'); assert.equal(r.body.accepted.length, 1);
  cur = (await call('GET', '/api/store/case/r1', undefined, 'admin')).body.case; assert.equal(cur.reviewRequestedBy, 'Admin');
  r = await call('PUT', '/api/store', { cases: [{ ...cur, review: 'published', signoff: { by: 'Admin', at: 'x' } }] }, 'admin'); assert.match(r.body.rejected[0].reason, /second account/);
  cur = (await call('GET', '/api/store/case/r1', undefined, 'rev')).body.case;
  r = await call('PUT', '/api/store', { cases: [{ ...cur, review: 'published', signoff: { by: 'Red Rev', at: 'x' } }] }, 'rev'); assert.equal(r.body.accepted.length, 1, 'a reviewer with the grant publishes');
  const n = (await call('GET', '/api/notifications', undefined, 'rev')).body; assert.ok(n.items.some(x => x.type === 'review' && /asked for review/.test(x.text)), JSON.stringify(n.items));
});
test('mentions in new comments notify the named user once; mark read works', async () => {
  const users = [{ id: 'a', name: 'Ana Lyst' }, { id: 'b', name: 'Bob Builder' }, { id: 'c', name: 'Bo' }];
  assert.deepEqual(findMentions('ping @Ana Lyst and @bob_builder please', users).sort(), ['a', 'b']);
  assert.deepEqual(findMentions('@Ana can you look', users), ['a'], 'unique first names work');
  assert.deepEqual(findMentions('mail @analyst.example.com', users), []);
  const cur = (await call('GET', '/api/store/case/m1', undefined, 'admin')).body.case;
  const item = { ...cur.items[0], comments: [{ id: 'cm1', by: 'Admin', at: 'now', text: 'Hey @Bob Builder, check this IP' }] };
  await call('PUT', '/api/store', { cases: [{ ...cur, items: [item, ...cur.items.slice(1)] }] }, 'admin');
  let n = (await call('GET', '/api/notifications', undefined, 'bob')).body; const m = n.items.filter(x => x.type === 'mention'); assert.equal(m.length, 1); assert.match(m[0].text, /Admin mentioned you/); assert.equal(n.unread >= 1, true);
  const cur2 = (await call('GET', '/api/store/case/m1', undefined, 'admin')).body.case; await call('PUT', '/api/store', { cases: [{ ...cur2, notes: 'touch' }] }, 'admin');
  n = (await call('GET', '/api/notifications', undefined, 'bob')).body; assert.equal(n.items.filter(x => x.type === 'mention').length, 1, 'not notified twice for the same comment');
  const after_ = (await call('POST', '/api/notifications/read', { ids: 'all' }, 'bob')).body; assert.equal(after_.unread, 0);
  const g = await call('GET', '/api/notifications', undefined, 'vera'); assert.equal(g.status, 200);
});
test('presence lists who is on a case and what they edit', async () => {
  let r = await call('POST', '/api/presence', { caseId: 'm1', sel: 'i1', editing: 'i1' }, 'bob'); assert.equal(r.body.people.length, 1); assert.equal(r.body.people[0].user.name, 'Bob Builder'); assert.equal(r.body.people[0].editing, 'i1');
  r = await call('POST', '/api/presence', { caseId: 'm1' }, 'admin'); assert.equal(r.body.people.length, 2);
  r = await call('GET', '/api/presence?caseId=r1', undefined, 'admin'); assert.equal(r.body.people.length, 0);
  r = await call('DELETE', '/api/presence', undefined, 'bob'); r = await call('GET', '/api/presence?caseId=m1', undefined, 'admin'); assert.equal(r.body.people.length, 1);
});
