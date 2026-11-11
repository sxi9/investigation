// Reporting and integrations: STIX conversion, token feeds, MISP/TheHive/Jira pushes (mocked HTTP), ingestion, AI drafts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-rep-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 'test.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
process.env.MISP_URL = 'https://misp.example'; process.env.MISP_KEY = 'k'; process.env.THEHIVE_URL = 'https://hive.example'; process.env.THEHIVE_KEY = 'k';
process.env.JIRA_URL = 'https://jira.example'; process.env.JIRA_EMAIL = 'a@b.c'; process.env.JIRA_TOKEN = 't'; process.env.JIRA_PROJECT = 'SEC';
const { buildApp } = await import('../src/app.js');
const { caseToStix, pattern, hashAlgo } = await import('../src/stix.js');
const { setFetch } = await import('../src/integrations.js');
const { parseEml, emlToProposals } = await import('../src/ingest.js');
const app = buildApp();
before(async () => { await app.ready(); });
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const H = { 'x-requested-with': 'CIB' }; const jar = {};
async function call(method, url, body, as, extraHeaders = {}) {
  const headers = { ...H, ...extraHeaders }; if (body !== undefined && !extraHeaders['content-type']) headers['content-type'] = 'application/json'; if (as && jar[as]) headers.cookie = jar[as];
  const r = await app.inject({ method, url, payload: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)), headers });
  const set = r.headers['set-cookie']; if (as && set) jar[as] = String(Array.isArray(set) ? set[0] : set).split(';')[0];
  let j = null; try { j = r.json(); } catch (e) {}
  return { status: r.statusCode, body: j, text: r.body, raw: r };
}
const PW = 'Correct-Horse-Battery-9';
const CASE = { id: 'c-rep', number: 'CASE 0001', title: 'Harbor CU phishing', tlp: 'green', notes: 'Credential phishing wave against members.', items: [
  { id: 'i1', type: 'indicator', kind: 'domain', value: 'portal-secure-login[.]com', status: 'confirmed', num: 1, title: 'Lure domain', body: 'clone of the member login' },
  { id: 'i2', type: 'indicator', kind: 'ip', value: '88.119.167.239', status: 'unverified', num: 2, title: 'C2' },
  { id: 'i3', type: 'indicator', kind: 'hash', value: 'd41d8cd98f00b204e9800998ecf8427e', status: 'confirmed', num: 3 },
  { id: 'i4', type: 'indicator', kind: 'filename', value: 'invoice.pdf.exe', status: 'confirmed', num: 4 },
  { id: 'i5', type: 'indicator', kind: 'domain', value: 'false-positive.example', status: 'false', num: 5 },
  { id: 'e1', type: 'event', title: 'First lure sent', date: '2026-03-14', time: '09:14', num: 6 },
  { id: 'p1', type: 'person', title: 'Lantern crew', tags: 'actor', num: 7 }, { id: 't1', type: 'ttp', value: 'T1566.002', title: 'Spearphishing Link', num: 8 },
], threads: [{ id: 'th1', from: 'i1', to: 'e1', rel: 'linked', why: 'sent in the lure' }, { id: 'th2', from: 'p1', to: 't1', rel: 'linked' }], groups: [], log: [], dismissed: [], hypotheses: [{ id: 'h1', text: 'Lantern kit rebrand' }] };

test('STIX: stable ids, patterns per kind, falsified items dropped, relationships typed', () => {
  const a = caseToStix(CASE), b = caseToStix(CASE);
  assert.deepEqual(a.map(o => o.id), b.map(o => o.id), 'ids are deterministic');
  assert.equal(a[0].type, 'report'); assert.ok(!a.some(o => /false-positive/.test(o.pattern || '')));
  const ind = a.find(o => o.type === 'indicator' && /portal-secure/.test(o.pattern)); assert.equal(ind.pattern, "[domain-name:value = 'portal-secure-login.com']"); assert.equal(ind.confidence, 85);
  assert.equal(a.find(o => /file:hashes/.test(o.pattern || '')).pattern, "[file:hashes.'MD5' = 'd41d8cd98f00b204e9800998ecf8427e']");
  assert.equal(a.find(o => /file:name/.test(o.pattern || '')).pattern, "[file:name = 'invoice.pdf.exe']");
  assert.ok(a.some(o => o.type === 'relationship' && o.relationship_type === 'uses'), 'actor uses technique');
  assert.ok(a.some(o => o.type === 'relationship' && o.relationship_type === 'indicates'));
  assert.equal(pattern('hostname', 'dc01.corp.local'), "[domain-name:value = 'dc01.corp.local']"); assert.equal(hashAlgo('a'.repeat(64)), 'SHA-256');
  const only = caseToStix(CASE, { indicatorsOnly: true }); assert.ok(only.every(o => o.type === 'indicator'));
});

test('setup and a case to export', async () => {
  await call('POST', '/api/auth/setup', { name: 'Admin', pass: PW }, 'admin');
  await call('POST', '/api/users', { name: 'Ana', pass: PW, role: 'analyst', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Ana', pass: PW }, 'ana');
  await call('POST', '/api/users', { name: 'Vic', pass: PW, role: 'viewer', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Vic', pass: PW }, 'vic');
  const r = await call('PUT', '/api/store', { cases: [CASE] }, 'ana'); assert.equal(r.body.accepted.length, 1);
  const s = await call('GET', '/api/store/case/c-rep/stix.json', undefined, 'vic'); assert.equal(s.status, 200); assert.equal(s.body.type, 'bundle'); assert.ok(s.body.objects.length > 5);
});

test('feeds: admin creates a token feed; it serves STIX, CSV and plain lists without a session; TLP scope and tokens are enforced', async () => {
  await call('PUT', '/api/store', { cases: [{ ...CASE, id: 'c-red', number: 'CASE 0002', title: 'Secret', tlp: 'red', items: [{ id: 'r1', type: 'indicator', kind: 'domain', value: 'red-only.example', status: 'confirmed' }] }] }, 'admin');
  assert.equal((await call('POST', '/api/feeds', { name: 'x' }, 'ana')).status, 403);
  const f = await call('POST', '/api/feeds', { name: 'Firewall blocklist', tlpMax: 'green', confirmedOnly: true }, 'admin'); assert.equal(f.status, 200); assert.ok(f.body.feed.token.length > 20);
  const { id, token } = f.body.feed;
  const list = await call('GET', '/api/feeds', undefined, 'admin'); assert.equal(list.body.feeds[0].id, id); assert.equal(list.body.feeds[0].token, undefined, 'token is shown once');
  const noTok = await app.inject({ method: 'GET', url: '/api/feeds/' + id + '/stix.json' }); assert.equal(noTok.statusCode, 404);
  const bad = await app.inject({ method: 'GET', url: '/api/feeds/' + id + '/stix.json?token=nope' }); assert.equal(bad.statusCode, 404);
  const stix = await app.inject({ method: 'GET', url: '/api/feeds/' + id + '/stix.json?token=' + token }); assert.equal(stix.statusCode, 200); const b = stix.json();
  assert.ok(b.objects.every(o => o.type === 'indicator')); assert.ok(b.objects.some(o => /portal-secure/.test(o.pattern))); assert.ok(!b.objects.some(o => /88\.119/.test(o.pattern)), 'unverified excluded by confirmedOnly'); assert.ok(!b.objects.some(o => /red-only/.test(o.pattern)), 'TLP:RED case excluded');
  const csv = await app.inject({ method: 'GET', url: '/api/feeds/' + id + '/indicators.csv', headers: { authorization: 'Bearer ' + token } }); assert.match(csv.headers['content-type'], /text\/csv/); assert.match(csv.body, /^kind,value,status/); assert.match(csv.body, /portal-secure-login\.com/);
  const txt = await app.inject({ method: 'GET', url: '/api/feeds/' + id + '/indicators.txt?token=' + token }); assert.match(txt.body, /invoice\.pdf\.exe/);
  const after = await call('GET', '/api/feeds', undefined, 'admin'); assert.equal(after.body.feeds[0].pulls, 3);
  await call('DELETE', '/api/feeds/' + id, undefined, 'admin'); assert.equal((await app.inject({ method: 'GET', url: '/api/feeds/' + id + '/stix.json?token=' + token })).statusCode, 404);
});

test('integrations: MISP event, TheHive alert and Jira issue are built from the case (HTTP mocked); viewers may not push', async () => {
  const calls = [];
  setFetch(async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body), auth: opts.headers.Authorization }); const ok = (j) => ({ ok: true, status: 200, text: async () => JSON.stringify(j) }); if (/misp/.test(url)) return ok({ Event: { id: '42' } }); if (/hive/.test(url)) return ok({ _id: '~81' }); return ok({ key: 'SEC-7' }); });
  const av = await call('GET', '/api/integrations', undefined, 'ana'); assert.deepEqual([av.body.misp, av.body.thehive, av.body.jira], [true, true, true]);
  const m = await call('POST', '/api/integrations/misp', { caseId: 'c-rep' }, 'ana'); assert.equal(m.status, 200); assert.equal(m.body.id, '42'); assert.equal(m.body.url, 'https://misp.example/events/view/42');
  const ev = calls[0].body.Event; assert.equal(calls[0].auth, 'k'); assert.equal(ev.Attribute.length, 4, 'falsified indicator left out'); assert.ok(ev.Attribute.some(a => a.type === 'md5' && a.to_ids === true)); assert.ok(ev.Attribute.some(a => a.type === 'domain' && a.value === 'portal-secure-login.com')); assert.ok(ev.Attribute.some(a => a.type === 'ip-dst' && a.to_ids === false));
  const h = await call('POST', '/api/integrations/thehive', { caseId: 'c-rep', ids: ['i1', 'i2'] }, 'ana'); assert.equal(h.body.id, '~81'); assert.equal(calls[1].body.observables.length, 2); assert.equal(calls[1].body.tlp, 1); assert.equal(calls[1].body.observables[0].dataType, 'domain');
  const j = await call('POST', '/api/integrations/jira', { caseId: 'c-rep', summary: 'Block lure domain', description: 'See E1' }, 'ana'); assert.equal(j.body.id, 'SEC-7'); assert.equal(j.body.url, 'https://jira.example/browse/SEC-7'); assert.equal(calls[2].body.fields.project.key, 'SEC'); assert.equal(calls[2].body.fields.summary, 'Block lure domain');
  assert.equal((await call('POST', '/api/integrations/misp', { caseId: 'c-rep' }, 'vic')).status, 403);
  setFetch(async () => ({ ok: false, status: 401, text: async () => '{"message":"bad key"}' })); const bad = await call('POST', '/api/integrations/misp', { caseId: 'c-rep' }, 'ana'); assert.equal(bad.status, 424); assert.match(bad.body.error, /401/);
  setFetch(null);
  const audit = (await call('GET', '/api/users', undefined, 'admin')).body.audit; assert.ok(audit.some(a => /pushed CASE 0001 to MISP/.test(a.what)));
});

test('ingest: an .eml becomes an event plus sender, reply-to, relay, link and attachment cards with threads', async () => {
  const eml = 'From: =?UTF-8?B?QWNjb3VudHM=?= <billing@secure-pay-portal.com>\r\nReply-To: refunds@pay-verify.net\r\nTo: finance@example.org\r\nSubject: Invoice overdue\r\nDate: Mon, 03 Nov 2026 09:14:00 +0000\r\nReceived: from mail.relay.example (mail.relay.example [88.119.167.239]) by mx.example.org\r\nReceived: from [10.0.0.5] by mail.relay.example\r\nContent-Type: multipart/mixed; boundary="XYZ"\r\n\r\n--XYZ\r\nContent-Type: text/plain\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nPlease pay at https://pay-verify.net/invoice/1 today =E2=80=94 thanks.\r\n--XYZ\r\nContent-Type: application/pdf; name="invoice.pdf"\r\nContent-Disposition: attachment; filename="invoice.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERi0xLjQK\r\n--XYZ--\r\n';
  const e = parseEml(eml); assert.equal(e.subject, 'Invoice overdue'); assert.deepEqual(e.received, ['88.119.167.239']); assert.match(e.text, /today — thanks/); assert.equal(e.attachments[0].name, 'invoice.pdf');
  const p = emlToProposals(e, 'invoice.eml'); const kinds = p.cards.map(c => c.type + ':' + (c.kind || '')); assert.ok(kinds.includes('event:')); assert.ok(kinds.filter(k => k === 'indicator:email').length === 2); assert.ok(kinds.includes('indicator:ip')); assert.ok(kinds.includes('indicator:url')); assert.ok(kinds.includes('indicator:hash')); assert.ok(kinds.includes('indicator:filename'));
  assert.equal(p.cards[0].time, '09:14'); assert.ok(p.threads.length >= 5);
  const r = await app.inject({ method: 'POST', url: '/api/ingest', payload: Buffer.from(eml), headers: { ...H, cookie: jar.ana, 'content-type': 'message/rfc822', 'x-file-name': 'invoice.eml' } }); assert.equal(r.statusCode, 200); assert.equal(r.json().kind, 'eml'); assert.equal(r.json().cards[0].type, 'event');
  const t = await app.inject({ method: 'POST', url: '/api/ingest', payload: Buffer.from('Incident: beacons to 88.119.167[.]239 and evil-domain[.]net; CVE-2024-3400 exploited.'), headers: { ...H, cookie: jar.ana, 'content-type': 'text/plain', 'x-file-name': 'notes.txt', 'x-use-model': '0' } });
  assert.equal(t.statusCode, 200); const tv = t.json().cards.map(c => c.value || c.title); assert.ok(tv.some(v => /88\.119/.test(v))); assert.ok(tv.includes('CVE-2024-3400')); assert.equal(t.json().kind, 'text');
  const g = await app.inject({ method: 'POST', url: '/api/ingest', payload: Buffer.from('x'), headers: { ...H, cookie: jar.vic, 'content-type': 'text/plain', 'x-file-name': 'a.txt' } }); assert.equal(g.statusCode, 200, 'viewers may propose; import is blocked by the page');
});

test('drafts: summary, takedown, RFI and hypotheses come back from the rules engine with case facts', async () => {
  const s = await call('POST', '/api/ai/draft', { caseId: 'c-rep', kind: 'summary' }, 'ana'); assert.equal(s.status, 200); assert.equal(s.body.engine, 'rules'); assert.match(s.body.text, /CASE 0001/); assert.match(s.body.text, /2026-03-14 09:14/); assert.match(s.body.text, /Lantern crew/); assert.match(s.body.text, /Blockable now: portal-secure-login\.com/);
  const t = await call('POST', '/api/ai/draft', { caseId: 'c-rep', kind: 'takedown', to: 'abuse@registrar.example', ids: ['i1'] }, 'ana'); assert.match(t.body.text, /takedown request — 1 resource/); assert.match(t.body.text, /portal-secure-login\[\.\]com/); assert.ok(!/88\.119/.test(t.body.text)); assert.match(t.body.text, /abuse@registrar\.example/);
  const r = await call('POST', '/api/ai/draft', { caseId: 'c-rep', kind: 'rfi' }, 'ana'); assert.match(r.body.text, /Request for information/);
  const h = await call('POST', '/api/ai/draft', { caseId: 'c-rep', kind: 'hypotheses' }, 'ana'); assert.ok(h.body.hypotheses.length >= 3); assert.ok(h.body.hypotheses.some(x => /phishing/i.test(x.text))); assert.ok(h.body.hypotheses.some(x => /Misattribution/.test(x.text))); assert.ok(!h.body.hypotheses.some(x => /Lantern kit rebrand/i.test(x.text)), 'existing hypothesis not repeated');
  assert.equal((await call('POST', '/api/ai/draft', { caseId: 'c-rep', kind: 'poem' }, 'ana')).status, 400);
  assert.equal((await call('POST', '/api/ai/draft', { caseId: 'c-red', kind: 'summary' }, 'ana')).status, 404, 'cannot draft from a case you cannot see');
});

test('drafts: a storyboard from the chronology, with exhibit numbers, assessment and asks', async () => {
  const r = await call('POST', '/api/ai/draft', { caseId: 'c-rep', kind: 'story' }, 'ana'); assert.equal(r.status, 200); assert.equal(r.body.engine, 'rules');
  const sc = r.body.scenes; assert.ok(sc.length >= 3); assert.equal(sc[0].kind, 'happened'); assert.equal(sc[0].from, '2026-03-14'); assert.match(sc[0].caption, /09:14 — First lure sent/);
  assert.ok(sc.some(x => x.kind === 'found' && x.exhibits.includes(1))); assert.ok(sc.some(x => x.kind === 'ask' && /portal-secure-login\.com/.test(x.caption)));
  assert.ok(sc.some(x => x.kind === 'assess' && /Lantern crew/.test(x.caption)));
});
