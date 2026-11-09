// Enrichment and watcher tests with a mocked proxy fetch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-enrich-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 't.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
const dnsMod = await import('node:dns/promises');
const { buildApp } = await import('../src/app.js');
const { enrichIndicator } = await import('../src/enrich.js');
const { runWatcher } = await import('../src/watchers.js');
const app = buildApp(); before(() => app.ready()); after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const realFetch = globalThis.fetch, realLookup = dnsMod.default.lookup;
let dnsAnswer = ['203.0.113.10'];
before(() => {
  dnsMod.default.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  globalThis.fetch = async (url, init) => {
    const u = new URL(url); let body = {};
    if (u.host === 'rdap.org' && u.pathname.startsWith('/ip/')) body = { name: 'TEST-NET', country: 'LT', startAddress: '203.0.113.0', endAddress: '203.0.113.255', entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'Example Hosting']]] }] };
    else if (u.host === 'rdap.org' && u.pathname.startsWith('/domain/')) body = { events: [{ eventAction: 'registration', eventDate: new Date(Date.now() - 5 * 86400e3).toISOString() }], entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Eranet']]] }], status: ['client transfer prohibited'] };
    else if (u.host === 'ipapi.co') body = u.pathname.startsWith('/104.') ? { asn: 'AS13335', org: 'Cloudflare, Inc.', country_name: 'US', city: 'SF' } : { asn: 'AS64500', org: 'Example Hosting', country_name: 'Lithuania', city: 'Vilnius' };
    else if (u.host === 'dns.google') { const type = u.searchParams.get('type'); body = type === 'A' ? { Answer: dnsAnswer.map(d => ({ data: d })) } : type === 'NS' ? { Answer: [{ data: 'ns1.example.' }] } : {}; }
    else if (u.host === 'crt.sh') body = [{ name_value: 'a.example' }, { name_value: 'b.example' }];
    else if (u.host === 'services.nvd.nist.gov') body = { vulnerabilities: [{ cve: { id: 'CVE-2024-40711', published: '2024-09-07T00:00:00', descriptions: [{ lang: 'en', value: 'RCE' }], metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8, baseSeverity: 'CRITICAL' } }] }, cisaExploitAdd: '2024-10-17' } }] };
    else if (u.host === 'blockchain.info') body = { final_balance: 150000000, total_received: 300000000, n_tx: 7 };
    else if (u.host === 'hooks.example') { globalThis.__hook = JSON.parse(init.body); body = { ok: true }; }
    else return { ok: false, status: 404, headers: new Headers(), arrayBuffer: async () => Buffer.from('{}'), text: async () => '{}' };
    const buf = Buffer.from(JSON.stringify(body)); return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), arrayBuffer: async () => buf, text: async () => buf.toString() };
  };
});
after(() => { globalThis.fetch = realFetch; dnsMod.default.lookup = realLookup; });

test('ip enrichment: RDAP + ASN, shared-infrastructure flag for CDN ranges', async () => {
  const r = await enrichIndicator('ip', '203.0.113.10'); assert.equal(r.fields.asn, 'AS64500'); assert.equal(r.fields.country, 'LT'); assert.equal(r.shared, false); assert.match(r.lines.join(' '), /Example Hosting/);
  const c = await enrichIndicator('ip', '104.26.2.223'); assert.equal(c.shared, true); assert.match(c.warnings[0], /shared infrastructure \(Cloudflare/);
  const again = await enrichIndicator('ip', '203.0.113.10'); assert.equal(again.cached, true, 'second call comes from the cache');
});
test('domain enrichment: DNS, registrar, age warning, certificate count; cve: CVSS and KEV; hash: algorithm; wallet: balance', async () => {
  const d = await enrichIndicator('domain', 'riskified-okta[.]com'); assert.deepEqual(d.fields.a, ['203.0.113.10']); assert.equal(d.fields.registrar, 'Eranet'); assert.ok(d.warnings.some(w => /less than 30 days/.test(w))); assert.equal(d.fields.certs, 2);
  const c = await enrichIndicator('cve', 'cve-2024-40711'); assert.equal(c.fields.cvss, 9.8); assert.equal(c.fields.kev, true); assert.match(c.lines[0], /CISA KEV/);
  const h = await enrichIndicator('hash', '921df888aaabcd828a3723f4c9f5fe8b8379c6b7067d16b2ea10152300417eae'); assert.equal(h.fields.algorithm, 'SHA-256'); assert.ok(h.warnings.some(w => /no hash provider key/.test(w)));
  const w = await enrichIndicator('wallet', '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'); assert.equal(w.fields.chain, 'Bitcoin'); assert.equal(w.fields.txs, 7);
});
test('API: enrichment needs an account; watchers detect a DNS change, add an inbox card, notify and call the webhook', async () => {
  const H = { 'x-requested-with': 'CIB' }; const jar = {};
  const call = async (method, url, body, as) => { const headers = { ...H }; if (body !== undefined) headers['content-type'] = 'application/json'; if (as && jar[as]) headers.cookie = jar[as]; const r = await app.inject({ method, url, payload: body === undefined ? undefined : JSON.stringify(body), headers }); const set = r.headers['set-cookie']; if (as && set) jar[as] = String(set).split(';')[0]; let j = null; try { j = r.json(); } catch (e) {} return { status: r.statusCode, body: j }; };
  let r = await call('POST', '/api/enrich', { kind: 'ip', value: '203.0.113.10' }); assert.equal(r.status, 401);
  await call('POST', '/api/auth/setup', { name: 'Admin', pass: 'Correct-Horse-Battery-9' }, 'admin');
  r = await call('POST', '/api/enrich', { kind: 'ip', value: '203.0.113.10' }, 'admin'); assert.equal(r.status, 200); assert.equal(r.body.fields.asn, 'AS64500');
  r = await call('POST', '/api/enrich', { kind: 'nope', value: 'x' }, 'admin'); assert.equal(r.status, 400);
  await call('PUT', '/api/store', { cases: [{ id: 'w1', number: 'CASE 0700', title: 'Watch', tlp: '', items: [{ id: 'd1', type: 'indicator', kind: 'domain', value: 'riskified-okta.com', pinned: true, x: 0, y: 0 }], threads: [], groups: [], log: [], dismissed: [] }] }, 'admin');
  r = await call('POST', '/api/watchers', { caseId: 'w1', itemId: 'd1', kind: 'domain', value: 'riskified-okta.com', checks: ['dns', 'cert'], interval: '1h', webhook: 'https://hooks.example/cib' }, 'admin'); assert.equal(r.status, 200); const w = r.body.watcher; assert.equal(w.interval, '1h');
  r = await call('POST', '/api/watchers/' + w.id + '/run', {}, 'admin'); assert.deepEqual(r.body.changes, [], 'first run only records the baseline'); assert.deepEqual(r.body.state.dns, ['203.0.113.10']);
  dnsAnswer = ['198.51.100.7'];
  const run2 = await runWatcher(w.id); assert.equal(run2.changes.length, 1); assert.match(run2.changes[0], /DNS changed/);
  const c = (await call('GET', '/api/store/case/w1', undefined, 'admin')).body.case; const ev = c.items.find(i => i.type === 'event' && /Watcher/.test(i.title)); assert.ok(ev, 'event card added to the inbox'); assert.equal(ev.pinned, false); assert.equal(c.rev, 2);
  const n = (await call('GET', '/api/notifications', undefined, 'admin')).body; assert.ok(n.items.some(x => x.type === 'watcher'));
  assert.equal(globalThis.__hook.type, 'watcher.change'); assert.match(globalThis.__hook.changes[0], /DNS changed/);
  r = await call('GET', '/api/watchers?caseId=w1', undefined, 'admin'); assert.equal(r.body.watchers[0].changes, 1);
  r = await call('DELETE', '/api/watchers/' + w.id, undefined, 'admin'); assert.equal(r.status, 200);
  r = await call('POST', '/api/watchers', { caseId: 'w1', kind: 'domain', value: 'x.example', webhook: 'http://plain.example' }, 'admin'); assert.equal(r.status, 400, 'https webhooks only');
});
