// Scheduled STIX exports: token-protected feed URLs a TIP, SIEM or firewall can poll, plus optional pushes to a webhook on a schedule.
import crypto from 'node:crypto';
import { db } from './db.js';
import { config } from './config.js';
import { audit, sha256, uid } from './crypto.js';
import { caseToStix, bundle, refang } from './stix.js';
db.exec(`CREATE TABLE IF NOT EXISTS feeds (id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL, scope TEXT NOT NULL, webhook TEXT, every_h INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL, last_pull TEXT, last_push TEXT, pulls INTEGER NOT NULL DEFAULT 0)`);
const q = {
  ins: db.prepare('INSERT INTO feeds (id, name, token_hash, scope, webhook, every_h, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  all: db.prepare('SELECT * FROM feeds ORDER BY created_at DESC'), one: db.prepare('SELECT * FROM feeds WHERE id = ?'), del: db.prepare('DELETE FROM feeds WHERE id = ?'),
  pulled: db.prepare('UPDATE feeds SET last_pull = ?, pulls = pulls + 1 WHERE id = ?'), pushed: db.prepare('UPDATE feeds SET last_push = ? WHERE id = ?'),
  cases: db.prepare('SELECT id, number, title, tlp, public, doc, updated_at FROM cases WHERE deleted_at IS NULL'),
};
const TLP_RANK = { '': 0, clear: 0, green: 1, amber: 2, 'amber+strict': 3, red: 4 };
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const row = (r) => ({ id: r.id, name: r.name, scope: JSON.parse(r.scope), webhook: r.webhook || '', everyH: r.every_h, createdBy: r.created_by, createdAt: r.created_at, lastPull: r.last_pull, lastPush: r.last_push, pulls: r.pulls, url: '/api/feeds/' + r.id + '/stix.json' });
export const feeds = {
  create(by, { name, tlpMax = 'green', tags = '', caseIds = [], indicatorsOnly = true, confirmedOnly = false, webhook = '', everyH = 0 }) {
    if (!name) throw err('name required'); if (!(tlpMax in TLP_RANK)) throw err('bad tlpMax');
    if (webhook && !/^https:\/\//.test(webhook)) throw err('webhook must be https');
    const token = crypto.randomBytes(24).toString('base64url'); const id = uid('fd');
    q.ins.run(id, String(name).slice(0, 80), sha256(token), JSON.stringify({ tlpMax, tags: String(tags || '').split(',').map(s => s.trim()).filter(Boolean), caseIds: Array.isArray(caseIds) ? caseIds : [], indicatorsOnly: !!indicatorsOnly, confirmedOnly: !!confirmedOnly }), webhook || null, Math.max(0, Number(everyH) || 0), by, new Date().toISOString());
    audit(by, 'created STIX feed "' + name + '" (≤ TLP:' + tlpMax.toUpperCase() + ')');
    return { ...row(q.one.get(id)), token }; // token is shown once
  },
  list() { return q.all.all().map(row); },
  remove(by, id) { const r = q.one.get(id); if (!r) throw err('No such feed', 404); q.del.run(id); audit(by, 'removed STIX feed "' + r.name + '"'); },
  // which cases a feed covers
  casesFor(scope) {
    return q.cases.all().filter(r => TLP_RANK[r.tlp || ''] <= TLP_RANK[scope.tlpMax] && (!scope.caseIds.length || scope.caseIds.includes(r.id))).map(r => ({ ...JSON.parse(r.doc), id: r.id, number: r.number, title: r.title, tlp: r.tlp, updatedAt: r.updated_at }))
      .filter(c => !scope.tags.length || scope.tags.some(t => String(c.tags || '').toLowerCase().split(/[,\s]+/).includes(t.toLowerCase())));
  },
  objects(scope) {
    const out = [];
    for (const c of feeds.casesFor(scope)) { const items = (c.items || []).filter(i => !scope.confirmedOnly || i.status === 'confirmed'); out.push(...caseToStix({ ...c, items }, { indicatorsOnly: scope.indicatorsOnly })); }
    return out;
  },
  // token check: ?token= or Authorization: Bearer
  open(id, token) { const r = q.one.get(id); if (!r || !token || sha256(String(token)) !== r.token_hash) throw err('Not found', 404); return r; },
  pull(id, token, format = 'stix') {
    const r = feeds.open(id, token); const scope = JSON.parse(r.scope); q.pulled.run(new Date().toISOString(), id);
    if (format === 'stix') return { type: 'application/json', body: JSON.stringify(bundle(feeds.objects(scope)), null, 1) };
    const inds = []; for (const c of feeds.casesFor(scope)) for (const i of c.items || []) if (i.type === 'indicator' && i.value && i.status !== 'false' && (!scope.confirmedOnly || i.status === 'confirmed')) inds.push({ kind: i.kind, value: refang(i.value), status: i.status || '', case: c.number, firstSeen: i.firstSeen || '', lastSeen: i.lastSeen || '' });
    if (format === 'csv') return { type: 'text/csv', body: 'kind,value,status,case,first_seen,last_seen\n' + inds.map(i => [i.kind, i.value, i.status, i.case, i.firstSeen, i.lastSeen].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n' };
    return { type: 'text/plain', body: inds.map(i => i.value).filter((v, k, a) => a.indexOf(v) === k).join('\n') + '\n' };
  },
  async pushDue(force = false) {
    let n = 0;
    for (const r of q.all.all()) {
      if (!r.webhook || !r.every_h) continue;
      if (!force && r.last_push && Date.now() - new Date(r.last_push).getTime() < r.every_h * 3600e3) continue;
      try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000); await fetch(r.webhook, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'user-agent': 'investigation-board-feed/1' }, body: JSON.stringify(bundle(feeds.objects(JSON.parse(r.scope)))) }); clearTimeout(t); q.pushed.run(new Date().toISOString(), r.id); audit('(feeds)', 'pushed STIX feed "' + r.name + '" to its webhook'); n++; }
      catch (e) { audit('(feeds)', 'feed push failed for "' + r.name + '": ' + e.message); }
    }
    return n;
  },
};
export function startFeedScheduler() { const h = setInterval(() => { feeds.pushDue().catch(() => {}); }, 15 * 60e3); h.unref(); }
