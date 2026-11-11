// Share links: a token URL that shows one case, read-only, without the login page; optional comments from the public.
// Only TLP:CLEAR and TLP:GREEN cases can be shared. Links expire, can be revoked, and count views.
import crypto from 'node:crypto';
import { db } from './db.js';
import { audit, sha256, uid } from './crypto.js';
import { canEdit, canSee } from './acl.js';
db.exec(`CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, token_hash TEXT NOT NULL, label TEXT, allow_comments INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL, expires_at TEXT, revoked_at TEXT, views INTEGER NOT NULL DEFAULT 0, last_view TEXT)`);
const q = {
  ins: db.prepare('INSERT INTO shares (id, case_id, token_hash, label, allow_comments, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  byCase: db.prepare('SELECT * FROM shares WHERE case_id = ? ORDER BY created_at DESC'), one: db.prepare('SELECT * FROM shares WHERE id = ?'),
  revoke: db.prepare('UPDATE shares SET revoked_at = ? WHERE id = ?'), viewed: db.prepare('UPDATE shares SET views = views + 1, last_view = ? WHERE id = ?'),
  kase: db.prepare('SELECT * FROM cases WHERE id = ?'),
};
const SHAREABLE = new Set(['', 'clear', 'green']);
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const meta = (r) => ({ id: r.id, tlp: r.tlp, public: !!r.public, archived: !!r.archived, review: r.review });
const row = (r) => ({ id: r.id, caseId: r.case_id, label: r.label || '', allowComments: !!r.allow_comments, createdBy: r.created_by, createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, views: r.views, lastView: r.last_view, active: !r.revoked_at && (!r.expires_at || r.expires_at > new Date().toISOString()), url: '/share.html#' + r.id });
// Public-safe projection of a case: pinned, non-falsified cards without internal fields; threads between them; no tasks, no internal comments, no handling notes.
export function publicCase(doc) {
  const keep = new Set((doc.items || []).filter(i => i.pinned && i.status !== 'false').map(i => i.id));
  const items = (doc.items || []).filter(i => keep.has(i.id)).map(i => ({ id: i.id, num: i.num, type: i.type, kind: i.kind, title: i.title, value: i.value, body: i.body, url: i.type === 'link' ? i.url : undefined, date: i.date, time: i.time, tags: i.tags, status: i.status, source: i.source, srcGrade: i.srcGrade, infoGrade: i.infoGrade, firstSeen: i.firstSeen, lastSeen: i.lastSeen, chain: i.chain, amount: i.amount, sector: i.sector, region: i.region, x: i.x, y: i.y }));
  const threads = (doc.threads || []).filter(t => keep.has(t.from) && keep.has(t.to)).map(t => ({ id: t.id, from: t.from, to: t.to, rel: t.rel, why: t.why, conf: t.conf }));
  const story = doc.story && Array.isArray(doc.story.scenes) ? { scenes: doc.story.scenes.map(s => ({ id: s.id, title: s.title, kind: s.kind, caption: s.caption, from: s.from, to: s.to, items: (s.items || []).filter(id => keep.has(id)) })) } : null;
  return { id: doc.id, number: doc.number, title: doc.title, tlp: doc.tlp || '', review: doc.review || 'draft', updatedAt: doc.updatedAt, summary: (doc.judgement && doc.judgement.text) || '', notes: '', items, threads, groups: (doc.groups || []).map(g => ({ id: g.id, title: g.title, x: g.x, y: g.y, w: g.w, h: g.h })), hypotheses: (doc.hypotheses || []).map(h => ({ id: h.id, text: h.text })), story, signoff: doc.signoff || '' };
}
export const shares = {
  create(u, { caseId, label = '', days = 14, allowComments = false }, ip) {
    const r = q.kase.get(caseId); if (!r || r.deleted_at || !canSee(u, meta(r))) throw err('Not found', 404); if (!canEdit(u, meta(r))) throw err('Analysts and admins create share links', 403);
    if (!SHAREABLE.has(r.tlp || '')) throw err('Only TLP:CLEAR or TLP:GREEN cases can be shared by link', 403);
    const d = Math.min(365, Math.max(1, Number(days) || 14)); const token = crypto.randomBytes(18).toString('base64url'); const id = uid('sh');
    q.ins.run(id, caseId, sha256(token), String(label || '').slice(0, 80), allowComments ? 1 : 0, u.name, new Date().toISOString(), new Date(Date.now() + d * 86400e3).toISOString());
    audit(u.name, 'created share link for ' + r.number + (label ? ' (' + label + ')' : '') + ', ' + d + ' days' + (allowComments ? ', comments allowed' : ''), ip);
    return { ...row(q.one.get(id)), token, url: '/share.html#' + id + ':' + token };
  },
  list(u, caseId) { const r = q.kase.get(caseId); if (!r || r.deleted_at || !canEdit(u, meta(r))) throw err('Not found', 404); return q.byCase.all(caseId).map(row); },
  revoke(u, id, ip) { const s = q.one.get(id); if (!s) throw err('No such link', 404); const r = q.kase.get(s.case_id); if (!r || !canEdit(u, meta(r))) throw err('Not found', 404); q.revoke.run(new Date().toISOString(), id); audit(u.name, 'revoked share link for ' + r.number, ip); },
  // open a link with its token: returns the share row and the case row, or throws 404 (never says why)
  open(id, token) {
    const s = q.one.get(id); if (!s || !token || sha256(String(token)) !== s.token_hash) throw err('This link is not valid', 404);
    if (s.revoked_at) throw err('This link was revoked', 410); if (s.expires_at && s.expires_at < new Date().toISOString()) throw err('This link has expired', 410);
    const r = q.kase.get(s.case_id); if (!r || r.deleted_at || !SHAREABLE.has(r.tlp || '')) throw err('This link is not valid', 404);
    return { share: row(s), raw: s, kase: r };
  },
  view(id, token) { const o = shares.open(id, token); q.viewed.run(new Date().toISOString(), id); const doc = JSON.parse(o.kase.doc); return { share: { id: o.share.id, label: o.share.label, allowComments: o.share.allowComments, expiresAt: o.share.expiresAt }, case: publicCase({ ...doc, id: o.kase.id, number: o.kase.number, title: o.kase.title, tlp: o.kase.tlp, updatedAt: o.kase.updated_at }) }; },
};
