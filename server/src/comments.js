// Review comments as their own channel: anyone who can see a case may comment without edit rights; the public may comment
// through a share link that allows it. Guest comments wait for moderation; accepted comments appear on the public page too.
import { db } from './db.js';
import { audit, uid } from './crypto.js';
import { canSee, canEdit } from './acl.js';
import { notify } from './collab.js';
import { broadcast } from './events.js';
db.exec(`CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, item_id TEXT, scene_id TEXT, author TEXT NOT NULL, author_kind TEXT NOT NULL, share_id TEXT, text TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL, moderated_by TEXT, moderated_at TEXT, reply TEXT)`);
db.exec('CREATE INDEX IF NOT EXISTS comments_case ON comments (case_id, created_at)');
const q = {
  ins: db.prepare('INSERT INTO comments (id, case_id, item_id, scene_id, author, author_kind, share_id, text, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  byCase: db.prepare('SELECT * FROM comments WHERE case_id = ? ORDER BY created_at DESC LIMIT 500'), one: db.prepare('SELECT * FROM comments WHERE id = ?'),
  moderate: db.prepare('UPDATE comments SET status = ?, moderated_by = ?, moderated_at = ? WHERE id = ?'), reply: db.prepare('UPDATE comments SET reply = ? WHERE id = ?'),
  countShare: db.prepare("SELECT COUNT(*) AS n FROM comments WHERE share_id = ? AND created_at > ?"),
  kase: db.prepare('SELECT * FROM cases WHERE id = ?'), users: db.prepare('SELECT id, name, role, tlp_red, cases FROM users'),
};
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const meta = (r) => ({ id: r.id, tlp: r.tlp, public: !!r.public, archived: !!r.archived, review: r.review });
const row = (r) => ({ id: r.id, caseId: r.case_id, itemId: r.item_id, sceneId: r.scene_id, author: r.author, authorKind: r.author_kind, shareId: r.share_id, text: r.text, createdAt: r.created_at, status: r.status, moderatedBy: r.moderated_by, moderatedAt: r.moderated_at, reply: r.reply || '' });
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
function tellEditors(caseRow, text, exceptName, caseId, itemId, dedupe) {
  for (const r of q.users.all()) { const u = { id: r.id, name: r.name, role: r.role, tlpRed: !!r.tlp_red, cases: JSON.parse(r.cases) }; if (u.name === exceptName) continue; if (canEdit(u, meta(caseRow))) notify(u.id, 'comment', text, caseId, itemId, dedupe); }
}
export const comments = {
  // signed-in comment: visible straight away; the audit and the editors' notifications record it
  add(u, { caseId, itemId, sceneId, text }, ip) {
    const r = q.kase.get(caseId); if (!r || r.deleted_at || !canSee(u, meta(r))) throw err('Not found', 404); if (u.guest) throw err('Guests comment through a share link', 403);
    const t = clean(text); if (!t) throw err('Say something');
    const doc = JSON.parse(r.doc); if (itemId && !(doc.items || []).some(i => i.id === itemId)) throw err('No such card', 404);
    const id = uid('cm'); q.ins.run(id, caseId, itemId || null, sceneId || null, u.name, u.role, null, t, new Date().toISOString(), 'accepted');
    audit(u.name, 'commented on ' + r.number + (itemId ? ' (card)' : ''), ip);
    tellEditors(r, u.name + ' commented on ' + r.number + ': ' + t.slice(0, 120), u.name, caseId, itemId, 'comment:' + id);
    broadcast({ type: 'comment', id, caseId, by: u.name, status: 'accepted' }, meta(r), null);
    return row(q.one.get(id));
  },
  // guest comment through a share link: pending until an editor accepts it
  addPublic(share, kase, { name, text, itemId, sceneId }, ip) {
    if (!share.allow_comments) throw err('Comments are off for this link', 403);
    const n = clean(name).slice(0, 60); const t = clean(text); if (!n) throw err('Your name, please'); if (!t) throw err('Say something');
    if (q.countShare.get(share.id, new Date(Date.now() - 3600e3).toISOString()).n >= 30) throw err('Too many comments from this link in the last hour; try later', 429);
    const doc = JSON.parse(kase.doc); if (itemId) { const it = (doc.items || []).find(i => i.id === itemId); if (!it || !it.pinned || it.status === 'false') throw err('No such card', 404); }
    const id = uid('cm'); q.ins.run(id, kase.id, itemId || null, sceneId || null, n, 'guest', share.id, t, new Date().toISOString(), 'pending');
    audit('(share ' + share.id + ')', 'guest "' + n + '" commented on ' + kase.number + ' — awaiting moderation', ip);
    tellEditors(kase, 'Guest ' + n + ' commented on ' + kase.number + ' (awaiting moderation): ' + t.slice(0, 100), null, kase.id, itemId, 'comment:' + id);
    broadcast({ type: 'comment', id, caseId: kase.id, by: n, status: 'pending' }, meta(kase), null);
    return row(q.one.get(id));
  },
  list(u, caseId) { const r = q.kase.get(caseId); if (!r || r.deleted_at || !canSee(u, meta(r))) throw err('Not found', 404); const editor = canEdit(u, meta(r)); return q.byCase.all(caseId).map(row).filter(c => editor || c.status === 'accepted' || c.author === u.name); },
  listPublic(caseId) { return q.byCase.all(caseId).map(row).filter(c => c.status === 'accepted').map(c => ({ id: c.id, itemId: c.itemId, sceneId: c.sceneId, author: c.author, authorKind: c.authorKind, text: c.text, createdAt: c.createdAt, reply: c.reply })); },
  moderate(u, id, accept, ip) {
    const c = q.one.get(id); if (!c) throw err('No such comment', 404); const r = q.kase.get(c.case_id); if (!r || !canEdit(u, meta(r))) throw err('Not found', 404);
    q.moderate.run(accept ? 'accepted' : 'rejected', u.name, new Date().toISOString(), id); audit(u.name, (accept ? 'accepted' : 'rejected') + ' a comment by ' + c.author + ' on ' + r.number, ip);
    broadcast({ type: 'comment', id, caseId: c.case_id, by: u.name, status: accept ? 'accepted' : 'rejected' }, meta(r), null); return row(q.one.get(id));
  },
  reply(u, id, text, ip) { const c = q.one.get(id); if (!c) throw err('No such comment', 404); const r = q.kase.get(c.case_id); if (!r || !canEdit(u, meta(r))) throw err('Not found', 404); q.reply.run(clean(text).slice(0, 600), id); audit(u.name, 'replied to a comment by ' + c.author + ' on ' + r.number, ip); return row(q.one.get(id)); },
  pendingCount(caseId) { return q.byCase.all(caseId).filter(c => c.status === 'pending').length; },
};
