// ATT&CK matrix and actor library tests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cib-lib-'));
process.env.CIB_DATA_DIR = tmp; process.env.CIB_DB_FILE = path.join(tmp, 't.sqlite'); process.env.CIB_DIST_DIR = path.join(tmp, 'nodist');
const { buildApp } = await import('../src/app.js');
const { compactAttack } = await import('../src/attack.js');
const app = buildApp(); before(() => app.ready()); after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const H = { 'x-requested-with': 'CIB' }; const jar = {};
const call = async (method, url, body, as) => { const headers = { ...H }; if (body !== undefined) headers['content-type'] = 'application/json'; if (as && jar[as]) headers.cookie = jar[as]; const r = await app.inject({ method, url, payload: body === undefined ? undefined : JSON.stringify(body), headers }); const set = r.headers['set-cookie']; if (as && set) jar[as] = String(set).split(';')[0]; let j = null; try { j = r.json(); } catch (e) {} return { status: r.statusCode, body: j }; };
const bundle = { type: 'bundle', objects: [
  { id: 'attack-pattern--1', type: 'attack-pattern', name: 'Phishing', external_references: [{ source_name: 'mitre-attack', external_id: 'T1566' }], kill_chain_phases: [{ kill_chain_name: 'mitre-attack', phase_name: 'initial-access' }] },
  { id: 'attack-pattern--2', type: 'attack-pattern', name: 'Old', revoked: true, external_references: [{ source_name: 'mitre-attack', external_id: 'T9999' }] },
  { id: 'attack-pattern--3', type: 'attack-pattern', name: 'Data Encrypted for Impact', external_references: [{ source_name: 'mitre-attack', external_id: 'T1486' }], kill_chain_phases: [{ kill_chain_name: 'mitre-attack', phase_name: 'impact' }] },
  { id: 'intrusion-set--1', type: 'intrusion-set', name: 'SafePay', aliases: ['SafePay Ransomware'], description: 'Ransomware operation active since 2024.', primary_motivation: 'financial-gain' },
  { id: 'relationship--1', type: 'relationship', relationship_type: 'uses', source_ref: 'intrusion-set--1', target_ref: 'attack-pattern--3' },
  { id: 'relationship--2', type: 'relationship', relationship_type: 'uses', source_ref: 'intrusion-set--1', target_ref: 'attack-pattern--1' },
] };
test('compactAttack keeps live techniques with their tactic', () => { const t = compactAttack(bundle); assert.deepEqual(t, [['T1486', 'Data Encrypted for Impact', 'Impact'], ['T1566', 'Phishing', 'Initial Access']]); });
test('actors: add, import from STIX, merge on re-import, roles', async () => {
  await call('POST', '/api/auth/setup', { name: 'Admin', pass: 'Correct-Horse-Battery-9' }, 'admin');
  await call('POST', '/api/users', { name: 'Vera View', pass: 'Correct-Horse-Battery-9', role: 'viewer', cases: 'all', mustChange: false }, 'admin'); await call('POST', '/api/auth/login', { name: 'Vera View', pass: 'Correct-Horse-Battery-9' }, 'vera');
  let r = await call('GET', '/api/attack', undefined, 'admin'); assert.equal(r.body.count, 0); assert.match(r.body.note, /refresh/);
  r = await call('POST', '/api/actors', { name: 'Akira', aliases: 'Storm-1567, GOLD SAHARA', origin: 'RaaS', motive: 'ransomware', techniques: 'T1133, t1486, nope', summary: 'Affiliate operation.' }, 'admin'); assert.equal(r.status, 200); assert.deepEqual(r.body.actor.techniques, ['T1133', 'T1486']); assert.deepEqual(r.body.actor.aliases, ['Storm-1567', 'GOLD SAHARA']);
  r = await call('POST', '/api/actors/import', bundle, 'admin'); assert.equal(r.body.added, 1);
  r = await call('GET', '/api/actors', undefined, 'vera'); const sp = r.body.actors.find(a => a.name === 'SafePay'); assert.deepEqual(sp.techniques.sort(), ['T1486', 'T1566']); assert.equal(sp.motive, 'financial-gain');
  r = await call('POST', '/api/actors/import', bundle, 'admin'); assert.equal(r.body.updated, 1, 're-import merges');
  r = await call('POST', '/api/actors', { name: 'X' }, 'vera'); assert.equal(r.status, 403);
  r = await call('DELETE', '/api/actors/' + sp.id, undefined, 'vera'); assert.equal(r.status, 403);
  r = await call('PATCH', '/api/actors/' + sp.id, { origin: 'Russian-speaking' }, 'admin'); assert.equal(r.body.actor.origin, 'Russian-speaking');
  r = await call('POST', '/api/actors/import', { name: 'Threat Actor', values: [{ value: 'Scattered Spider', description: 'Help-desk social engineering', meta: { synonyms: ['UNC3944', 'Octo Tempest'], country: 'US/UK' } }] }, 'admin'); assert.equal(r.body.added, 1);
  r = await call('GET', '/api/actors', undefined, 'admin'); assert.ok(r.body.actors.some(a => a.name === 'Scattered Spider' && a.aliases.includes('UNC3944')));
});
