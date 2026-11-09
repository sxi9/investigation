// Watchers: re-check indicators on a schedule; on change, drop an event card into the case inbox, notify the
// owner and call a webhook. Checks: dns (A records), cert (crt.sh count), blocklist (VT / ThreatFox when keyed),
// wallet (balance / tx count), nvd (KEV status, CVSS).
import { db } from './db.js';
import { config } from './config.js';
import { enrichIndicator } from './enrich.js';
import { uid, audit } from './crypto.js';
import { notify } from './collab.js';
import { broadcast } from './events.js';

db.exec(`CREATE TABLE IF NOT EXISTS watchers (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, item_id TEXT, kind TEXT NOT NULL, value TEXT NOT NULL, checks TEXT NOT NULL, interval_s INTEGER NOT NULL, owner_id TEXT NOT NULL, owner_name TEXT, webhook TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_run TEXT, next_run INTEGER NOT NULL, last_state TEXT, last_error TEXT, changes INTEGER NOT NULL DEFAULT 0)`);
const q = {
  ins: db.prepare('INSERT INTO watchers (id, case_id, item_id, kind, value, checks, interval_s, owner_id, owner_name, webhook, created_at, next_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  byCase: db.prepare('SELECT * FROM watchers WHERE case_id = ? ORDER BY created_at'),
  all: db.prepare('SELECT * FROM watchers'),
  one: db.prepare('SELECT * FROM watchers WHERE id = ?'),
  del: db.prepare('DELETE FROM watchers WHERE id = ?'),
  due: db.prepare('SELECT * FROM watchers WHERE enabled = 1 AND next_run <= ? ORDER BY next_run LIMIT 20'),
  ran: db.prepare('UPDATE watchers SET last_run = ?, next_run = ?, last_state = ?, last_error = ?, changes = changes + ? WHERE id = ?'),
  toggle: db.prepare('UPDATE watchers SET enabled = ? WHERE id = ?'),
  caseRow: db.prepare('SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL'),
  caseUpd: db.prepare('UPDATE cases SET rev = rev + 1, updated_at = ?, updated_by = ?, doc = ? WHERE id = ?'),
};
const INTERVALS = { '1h': 3600, '6h': 6 * 3600, '24h': 86400, '7d': 7 * 86400 };
const CHECKS = ['dns', 'cert', 'blocklist', 'wallet', 'nvd'];
const row = (r) => ({ id: r.id, caseId: r.case_id, itemId: r.item_id, kind: r.kind, value: r.value, checks: JSON.parse(r.checks), interval: Object.keys(INTERVALS).find(k => INTERVALS[k] === r.interval_s) || r.interval_s + 's', owner: r.owner_name, webhook: r.webhook ? '(set)' : '', enabled: !!r.enabled, createdAt: r.created_at, lastRun: r.last_run, nextRun: new Date(r.next_run).toISOString(), lastState: r.last_state ? JSON.parse(r.last_state) : null, lastError: r.last_error, changes: r.changes });
const err = (m, status = 400) => Object.assign(new Error(m), { status });

export const watchers = {
  list: (caseId) => q.byCase.all(caseId).map(row),
  create({ caseId, itemId, kind, value, checks, interval, webhook }, user) {
    if (!caseId || !kind || !value) throw err('caseId, kind and value are required');
    const iv = INTERVALS[interval] || INTERVALS['24h']; const ch = (Array.isArray(checks) ? checks : CHECKS).filter(c => CHECKS.includes(c)); if (!ch.length) throw err('no valid checks');
    if (webhook && !/^https:\/\//.test(webhook)) throw err('webhook must be https');
    const id = uid('w'); q.ins.run(id, caseId, itemId || null, kind, String(value).slice(0, 300), JSON.stringify(ch), iv, user.id, user.name, webhook || null, new Date().toISOString(), Date.now());
    audit(user.name, 'watcher added on ' + kind + ' ' + value + ' (' + ch.join(',') + ' every ' + (interval || '24h') + ')');
    return row(q.one.get(id));
  },
  remove(id, user) { const r = q.one.get(id); if (!r) throw err('Not found', 404); q.del.run(id); audit(user.name, 'watcher removed on ' + r.kind + ' ' + r.value); },
  toggle(id, on) { q.toggle.run(on ? 1 : 0, id); return row(q.one.get(id)); },
  get: (id) => { const r = q.one.get(id); return r ? row(r) : null; },
};

// Reduce an enrichment result to the comparable state for the selected checks.
function stateOf(kind, checks, e) {
  const s = {};
  if (checks.includes('dns') && e.fields.a) s.dns = [...e.fields.a].sort();
  if (checks.includes('cert') && e.fields.certs != null) s.cert = e.fields.certs;
  if (checks.includes('blocklist') && e.fields.vt) s.blocklist = e.fields.vt.malicious;
  if (checks.includes('blocklist') && e.fields.mbSignature) s.blocklistSig = e.fields.mbSignature;
  if (checks.includes('wallet') && e.fields.txs != null) { s.walletTxs = e.fields.txs; s.walletBalance = e.fields.balance; }
  if (checks.includes('nvd') && kind === 'cve') { s.kev = !!e.fields.kev; s.cvss = e.fields.cvss; }
  return s;
}
function describe(prev, cur) {
  const out = [];
  for (const k of new Set([...Object.keys(prev || {}), ...Object.keys(cur || {})])) { const a = JSON.stringify(prev ? prev[k] : undefined), b = JSON.stringify(cur[k]); if (a !== b) out.push({ dns: 'DNS changed', cert: 'certificate count changed', blocklist: 'VirusTotal detections changed', blocklistSig: 'malware signature changed', walletTxs: 'wallet transactions changed', walletBalance: 'wallet balance changed', kev: 'CISA KEV status changed', cvss: 'CVSS changed' }[k] + ': ' + (a === undefined ? '—' : a) + ' → ' + b); }
  return out;
}
async function webhook(url, payload) { try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000); await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'user-agent': 'cyber-investigation-board/1.0 (+watcher)' }, body: JSON.stringify(payload) }); clearTimeout(t); return true; } catch (e) { return false; } }

export async function runWatcher(r, { force = false } = {}) {
  const w = typeof r === 'string' ? q.one.get(r) : r; if (!w) throw err('Not found', 404);
  const checks = JSON.parse(w.checks); let state, error = null, changes = [];
  try {
    const e = await enrichIndicator(w.kind, w.value, { fresh: true });
    state = stateOf(w.kind, checks, e);
    const prev = w.last_state ? JSON.parse(w.last_state) : null;
    if (prev) changes = describe(prev, state);
  } catch (e) { error = e.message; }
  q.ran.run(new Date().toISOString(), Date.now() + w.interval_s * 1000, state ? JSON.stringify(state) : w.last_state, error, changes.length ? 1 : 0, w.id);
  if (changes.length) {
    const text = w.kind.toUpperCase() + ' ' + w.value + ': ' + changes.join('; ');
    // event card in the case inbox
    const c = q.caseRow.get(w.case_id);
    if (c) {
      const doc = JSON.parse(c.doc); const now = new Date().toISOString();
      const item = { id: uid('i'), type: 'event', title: 'Watcher: ' + changes[0].split(':')[0] + ' — ' + w.value, body: changes.join('\n'), date: now.slice(0, 10), tags: 'watcher, change', source: 'watcher (' + checks.join(', ') + ')', collected: now.slice(0, 10), srcGrade: 'B', infoGrade: '2', status: 'unverified', pinned: false, x: 0, y: 0, value: '', url: '', kind: 'domain' };
      doc.items = [...(doc.items || []), item]; doc.log = [...(doc.log || []), { t: now, m: 'watcher · ' + text }].slice(-400);
      q.caseUpd.run(now, 'watcher', JSON.stringify(doc), w.case_id);
      broadcast({ type: 'case', id: w.case_id, rev: c.rev + 1, by: 'watcher' }, { id: c.id, tlp: c.tlp, public: !!c.public }, null);
      notify(w.owner_id, 'watcher', text, w.case_id, item.id, 'watcher:' + w.id + ':' + now);
    }
    const hook = w.webhook || config.webhookUrl; if (hook) await webhook(hook, { type: 'watcher.change', watcher: row(q.one.get(w.id)), changes, at: new Date().toISOString() });
    audit('watcher', text.slice(0, 200));
  }
  return { state, changes, error };
}
export async function runDue() { const due = q.due.all(Date.now()); let n = 0; for (const w of due) { try { await runWatcher(w); n++; } catch (e) { q.ran.run(new Date().toISOString(), Date.now() + w.interval_s * 1000, w.last_state, e.message, 0, w.id); } } return n; }
export function startWatcherScheduler() { const h = setInterval(() => { runDue().catch(() => {}); }, 60 * 1000); h.unref(); }
export const WATCH_INTERVALS = Object.keys(INTERVALS); export const WATCH_CHECKS = CHECKS;
