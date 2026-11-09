// Collaboration: revision history, presence, notifications (mentions, review, overdue tasks), review rules.
import { db } from './db.js';
import { canSee, canReview, isAdmin } from './acl.js';
import { audit, uid } from './crypto.js';
import { broadcastTo } from './events.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS case_revisions (case_id TEXT NOT NULL, rev INTEGER NOT NULL, t TEXT NOT NULL, by TEXT, doc TEXT NOT NULL, PRIMARY KEY (case_id, rev));
  CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, t TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, case_id TEXT, item_id TEXT, dedupe TEXT, read INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications(user_id, dedupe);
`);
const q = {
  revIns: db.prepare('INSERT OR REPLACE INTO case_revisions (case_id, rev, t, by, doc) VALUES (?, ?, ?, ?, ?)'),
  revGet: db.prepare('SELECT doc FROM case_revisions WHERE case_id = ? AND rev = ?'),
  revList: db.prepare('SELECT rev, t, by, length(doc) AS size FROM case_revisions WHERE case_id = ? ORDER BY rev DESC LIMIT 100'),
  revPrune: db.prepare('DELETE FROM case_revisions WHERE case_id = ? AND rev < (SELECT MAX(rev) FROM case_revisions WHERE case_id = ?) - ?'),
  nIns: db.prepare('INSERT OR IGNORE INTO notifications (id, user_id, t, type, text, case_id, item_id, dedupe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  nList: db.prepare('SELECT id, t, type, text, case_id AS caseId, item_id AS itemId, read FROM notifications WHERE user_id = ? ORDER BY t DESC LIMIT 200'),
  nUnread: db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0'),
  nRead: db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?'),
  nReadAll: db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?'),
  users: db.prepare('SELECT id, name, role, tlp_red, cases FROM users'),
};
const KEEP = Number(process.env.CIB_REVISIONS_KEEP || 50);

export const revisions = {
  record(caseId, rev, doc, by) { q.revIns.run(caseId, rev, new Date().toISOString(), by || '', typeof doc === 'string' ? doc : JSON.stringify(doc)); q.revPrune.run(caseId, caseId, KEEP); },
  get(caseId, rev) { const r = q.revGet.get(caseId, rev); return r ? JSON.parse(r.doc) : null; },
  list(caseId) { return q.revList.all(caseId); },
};

// ---- presence: in memory, per session
const presence = new Map(); // sessionKey -> { user: {id,name,role}, caseId, sel, editing, at }
export function setPresence(sessionKey, user, p) {
  presence.set(sessionKey, { user: { id: user.id, name: user.name, role: user.role }, caseId: p.caseId || null, sel: p.sel || null, editing: p.editing || null, at: Date.now(), tab: p.tab || '' });
  for (const [k, v] of presence) if (Date.now() - v.at > 45000) presence.delete(k);
  const list = listPresence(p.caseId);
  broadcastTo((c) => c.user && (c.user.role === 'admin' || true), { type: 'presence', caseId: p.caseId, people: list }, null, (c) => !c.caseId || c.caseId === p.caseId);
  return list;
}
export function clearPresence(sessionKey) { const v = presence.get(sessionKey); presence.delete(sessionKey); if (v) broadcastTo(() => true, { type: 'presence', caseId: v.caseId, people: listPresence(v.caseId) }); }
export function listPresence(caseId) { const now = Date.now(); const out = []; for (const [k, v] of presence) if (now - v.at < 45000 && (!caseId || v.caseId === caseId)) out.push({ key: k.slice(0, 8), user: v.user, sel: v.sel, editing: now - v.at < 25000 ? v.editing : null, at: v.at }); return out; }

// ---- notifications
const allUsers = () => q.users.all().map(r => ({ id: r.id, name: r.name, role: r.role, tlpRed: !!r.tlp_red, cases: JSON.parse(r.cases) }));
export function notify(userId, type, text, caseId, itemId, dedupe) {
  const id = uid('n'); const t = new Date().toISOString();
  const res = q.nIns.run(id, userId, t, type, String(text).slice(0, 300), caseId || null, itemId || null, dedupe || id);
  if (res.changes) broadcastTo((c) => c.user && c.user.id === userId, { type: 'notify', notification: { id, t, type, text, caseId, itemId, read: 0 } });
  return !!res.changes;
}
export const notifications = {
  list: (userId) => ({ items: q.nList.all(userId), unread: q.nUnread.get(userId).n }),
  read: (userId, id) => { if (id === 'all') q.nReadAll.run(userId); else q.nRead.run(userId, String(id)); },
};
// Mentions: "@Ana Lyst" or "@Ana" in new comments; longest matching known name wins.
export function findMentions(text, users) {
  const out = new Set(); const t = String(text || '');
  for (const u of [...users].sort((a, b) => b.name.length - a.name.length)) { const re = new RegExp('@' + u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s_]+') + '(?![\\p{L}\\p{N}])', 'iu'); if (re.test(t)) out.add(u.id); else { const first = u.name.split(/\s+/)[0]; if (first.length >= 3 && new RegExp('@' + first + '(?![\\p{L}\\p{N}])', 'iu').test(t) && users.filter(x => x.name.split(/\s+/)[0].toLowerCase() === first.toLowerCase()).length === 1) out.add(u.id); } }
  return [...out];
}
// Called after a case write: new comments → mentions; review transitions → reviewer / owner / admins.
export function afterCaseWrite(prevDoc, doc, by, caseMeta) {
  const users = allUsers(); const label = (doc.number || '') + ' ' + (doc.title || '');
  const prevComments = new Set(); for (const it of (prevDoc && prevDoc.items) || []) for (const c of it.comments || []) prevComments.add(c.id || (c.at + '|' + c.text));
  for (const it of doc.items || []) for (const c of it.comments || []) {
    const key = c.id || (c.at + '|' + c.text); if (prevComments.has(key)) continue;
    for (const uid_ of findMentions(c.text, users)) { const u = users.find(x => x.id === uid_); if (!u || u.name === by || !canSee(u, caseMeta)) continue; notify(u.id, 'mention', by + ' mentioned you on ' + label.trim() + ': ' + String(c.text).slice(0, 140), doc.id, it.id, 'mention:' + key + ':' + u.id); }
  }
  const prevReview = (prevDoc && prevDoc.review) || 'draft', review = doc.review || 'draft';
  if (review !== prevReview) {
    if (review === 'in review') {
      const targets = doc.reviewer ? users.filter(u => u.name.toLowerCase() === String(doc.reviewer).toLowerCase()) : users.filter(u => (u.role === 'reviewer' || u.role === 'admin') && u.name !== by);
      for (const u of targets) if (canReview(u, caseMeta) && u.name !== by) notify(u.id, 'review', by + ' asked for review of ' + label.trim(), doc.id, null, 'review:' + doc.id + ':' + (doc.updatedAt || Date.now()) + ':' + u.id);
    }
    if (review === 'published' || review === 'draft') { const owner = users.find(u => u.name === (prevDoc && prevDoc.updatedBy)) ; for (const u of users) if (u.name !== by && (u.role === 'admin' || (owner && owner.id === u.id)) && canSee(u, caseMeta)) notify(u.id, 'review', label.trim() + (review === 'published' ? ' was published and signed off by ' : ' was sent back to draft by ') + by, doc.id, null, 'review:' + doc.id + ':' + review + ':' + (doc.updatedAt || Date.now()) + ':' + u.id); }
  }
}
// TLP:RED / AMBER+STRICT cases need a second account to publish: the publisher may not be the person who sent it for review.
export function publishAllowed(prevDoc, doc, by) {
  const strict = doc.tlp === 'red' || doc.tlp === 'amber+strict';
  if (!strict || doc.review !== 'published' || (prevDoc && prevDoc.review === 'published')) return { ok: true };
  const requestedBy = prevDoc && prevDoc.reviewRequestedBy;
  if (requestedBy && requestedBy === by) return { ok: false, reason: 'TLP:' + doc.tlp.toUpperCase() + ' files need a second account to publish (you sent it for review)' };
  if (!requestedBy && prevDoc && (prevDoc.review || 'draft') === 'draft') return { ok: false, reason: 'TLP:' + doc.tlp.toUpperCase() + ' files must go through review before publishing' };
  return { ok: true };
}
// Overdue tasks: once per task, to the task owner (by name) or the case's last editor.
export function scanOverdue() {
  const users = allUsers(); const today = new Date().toISOString().slice(0, 10); let n = 0;
  for (const r of db.prepare('SELECT id, number, title, tlp, public, updated_by, doc FROM cases WHERE deleted_at IS NULL').all()) {
    const doc = JSON.parse(r.doc); const meta = { id: r.id, tlp: r.tlp, public: !!r.public };
    for (const it of doc.items || []) for (const t of it.todo || []) {
      if (t.done || !t.due || t.due >= today) continue;
      const target = users.find(u => u.name === t.owner) || users.find(u => u.name === r.updated_by); if (!target || !canSee(target, meta)) continue;
      if (notify(target.id, 'overdue', 'Overdue since ' + t.due + ' on ' + r.number + ': ' + String(t.text).slice(0, 120), r.id, it.id, 'overdue:' + r.id + ':' + (t.id || t.text) + ':' + t.due)) n++;
    }
  }
  return n;
}
export function startSchedulers() { const h = setInterval(() => { try { scanOverdue(); } catch (e) { console.error('overdue scan failed', e); } }, 60 * 60 * 1000); h.unref(); setTimeout(() => { try { scanOverdue(); } catch (e) {} }, 15000).unref(); }
