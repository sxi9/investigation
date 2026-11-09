// Case, preference and file storage with access control and revisions.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { canSee, canEdit, canCreate, canReview, REVIEW_FIELDS, isAdmin } from './acl.js';
import { audit, sha256, uid } from './crypto.js';
import { users } from './users.js';
import { mergeCase } from './merge.js';
import { revisions, afterCaseWrite, publishAllowed } from './collab.js';
try { db.exec('ALTER TABLE files ADD COLUMN case_id TEXT'); } catch (e) {}

const q = {
  all: db.prepare('SELECT * FROM cases WHERE deleted_at IS NULL'),
  one: db.prepare('SELECT * FROM cases WHERE id = ?'),
  ins: db.prepare('INSERT INTO cases (id, number, title, tlp, public, archived, review, owner_id, rev, updated_at, updated_by, doc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)'),
  upd: db.prepare('UPDATE cases SET number = ?, title = ?, tlp = ?, public = ?, archived = ?, review = ?, rev = rev + 1, updated_at = ?, updated_by = ?, doc = ?, deleted_at = NULL WHERE id = ?'),
  del: db.prepare('UPDATE cases SET deleted_at = ?, rev = rev + 1, updated_by = ? WHERE id = ?'),
  maxNum: db.prepare("SELECT MAX(CAST(REPLACE(number, 'CASE ', '') AS INTEGER)) AS n FROM cases"),
  numTaken: db.prepare('SELECT id FROM cases WHERE number = ? AND id != ? AND deleted_at IS NULL'),
  pref: db.prepare('SELECT doc FROM prefs WHERE user_id = ? AND kind = ?'),
  prefUp: db.prepare('INSERT INTO prefs (user_id, kind, doc, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at'),
  fIns: db.prepare('INSERT OR REPLACE INTO files (id, owner_id, sha256, size, mime, name, created_at, path, case_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  purge: db.prepare('SELECT id, number, title, doc FROM cases WHERE deleted_at IS NOT NULL AND deleted_at <= ?'),
  hardDel: db.prepare('DELETE FROM cases WHERE id = ?'),
  allDocs: db.prepare('SELECT id, number, title, tlp, public, doc FROM cases WHERE deleted_at IS NULL'),
  fGet: db.prepare('SELECT * FROM files WHERE id = ?'),
  anyPublic: db.prepare("SELECT 1 FROM cases WHERE public = 1 AND deleted_at IS NULL AND tlp IN ('', 'clear', 'green') LIMIT 1"),
};
const meta = (r) => ({ id: r.id, tlp: r.tlp, public: !!r.public, archived: !!r.archived, review: r.review });
const withRev = (r) => { const d = JSON.parse(r.doc); d.rev = r.rev; d.updatedAt = r.updated_at; d.updatedBy = r.updated_by; d.id = r.id; return d; };
const err = (m, status = 400) => Object.assign(new Error(m), { status });

function docMeta(c) {
  return { number: String(c.number || ''), title: String(c.title || '').slice(0, 300), tlp: String(c.tlp || ''), pub: c.public ? 1 : 0, archived: c.archived ? 1 : 0, review: String(c.review || 'draft') };
}
function shallowDiffKeys(a, b) { const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); const out = []; for (const k of keys) { if (k === 'rev' || k === 'updatedAt' || k === 'updatedBy') continue; if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) out.push(k); } return out; }

export const store = {
  hasPublic: () => !!q.anyPublic.get(),
  totalCases: () => q.all.all().length,
  visibleCases(u) { return q.all.all().filter(r => canSee(u, meta(r))).map(withRev); },
  getCase(u, id) { const r = q.one.get(id); if (!r || r.deleted_at) return null; if (!canSee(u, meta(r))) return null; return withRev(r); },
  // Apply a batch of client cases. Returns what was accepted (with new revs / numbers) and what was rejected.
  putCases(u, cases, by, ip) {
    const accepted = [], rejected = [];
    const tx = db.prepare('BEGIN'), commit = db.prepare('COMMIT'), rollback = db.prepare('ROLLBACK');
    tx.run();
    try {
      for (const c of cases || []) {
        if (!c || typeof c.id !== 'string' || c.id.length > 64) { rejected.push({ id: c && c.id, reason: 'bad id' }); continue; }
        const doc = JSON.stringify(c);
        if (doc.length > config.maxBodyBytes) { rejected.push({ id: c.id, reason: 'too large' }); continue; }
        const m = docMeta(c); const now = new Date().toISOString();
        const existing = q.one.get(c.id);
        if (!existing) {
          if (!canCreate(u)) { rejected.push({ id: c.id, reason: 'not allowed to create cases' }); continue; }
          if (c.tlp === 'red' || c.tlp === 'amber+strict') { if (!u.tlpRed && !isAdmin(u)) { rejected.push({ id: c.id, reason: 'no TLP:RED grant' }); continue; } }
          // server-assigned numbers: keep the client's if free, otherwise next
          let number = m.number; if (!/^CASE \d{4}$/.test(number) || q.numTaken.get(number, c.id)) { number = 'CASE ' + String((q.maxNum.get().n || 416) + 1).padStart(4, '0'); c.number = number; }
          q.ins.run(c.id, number, m.title, m.tlp, m.pub, m.archived, m.review, u.id, now, by, JSON.stringify(c));
          if (Array.isArray(u.cases)) users.grantCase(u.id, c.id);
          audit(by, 'created ' + number + ' — ' + m.title, ip);
          accepted.push({ id: c.id, rev: 1, number });
          continue;
        }
        const em = meta(existing);
        if (!canSee(u, em)) { rejected.push({ id: c.id, reason: 'not visible' }); continue; }
        const old = JSON.parse(existing.doc);
        if (!canEdit(u, em)) {
          const changed = shallowDiffKeys(old, c);
          if (!canReview(u, em) || changed.some(k => !REVIEW_FIELDS.has(k))) { rejected.push({ id: c.id, reason: 'read-only for your role' }); continue; }
        }
        if ((m.tlp === 'red' || m.tlp === 'amber+strict') && !u.tlpRed && !isAdmin(u)) { rejected.push({ id: c.id, reason: 'no TLP:RED grant' }); continue; }
        if (!!c.legalHold !== !!old.legalHold && !isAdmin(u)) { rejected.push({ id: c.id, reason: 'only an admin can set or clear a legal hold' }); continue; }
        let incoming = c, merged = false;
        if (typeof c.rev === 'number' && c.rev < existing.rev) {
          // stale write: three-way merge against the revision the client started from, so both analysts' work survives
          const base = revisions.get(c.id, c.rev);
          incoming = mergeCase(base, old, c); merged = true;
          audit(by, 'merged ' + em.id + ': client rev ' + c.rev + ' into server rev ' + existing.rev + (base ? '' : ' (no common base kept; client fields won)'), ip);
        }
        if (JSON.stringify({ ...old, rev: 0, updatedAt: 0, updatedBy: 0 }) === JSON.stringify({ ...incoming, rev: 0, updatedAt: 0, updatedBy: 0 }) && !existing.deleted_at) { accepted.push({ id: c.id, rev: existing.rev, number: existing.number, unchanged: true }); continue; }
        if ((incoming.review || 'draft') === 'in review' && (old.review || 'draft') !== 'in review') incoming.reviewRequestedBy = by;
        const pub = publishAllowed(old, incoming, by); if (!pub.ok) { rejected.push({ id: c.id, reason: pub.reason }); continue; }
        const mm = docMeta(incoming); let number = mm.number; if (!/^CASE \d{4}$/.test(number)) number = existing.number;
        revisions.record(c.id, existing.rev, existing.doc, existing.updated_by);
        q.upd.run(number, mm.title, mm.tlp, mm.pub, mm.archived, mm.review, now, by, JSON.stringify({ ...incoming, number }), c.id);
        const r = q.one.get(c.id); accepted.push({ id: c.id, rev: r.rev, number: r.number, merged });
        try { afterCaseWrite(old, { ...incoming, id: c.id, number, updatedAt: now, updatedBy: by }, by, { id: c.id, tlp: mm.tlp, public: !!mm.pub }); } catch (e) { console.error('notification scan failed', e); }
      }
      commit.run();
    } catch (e) { rollback.run(); throw e; }
    return { accepted, rejected };
  },
  // legal hold (admin): the case cannot be deleted or purged while it is held
  setLegalHold(u, id, on, by, ip) {
    if (!isAdmin(u)) throw err('Admins only', 403);
    const r = q.one.get(id); if (!r || r.deleted_at) throw err('Not found', 404);
    const doc = JSON.parse(r.doc); if (!!doc.legalHold === !!on) return withRev(r);
    revisions.record(id, r.rev, r.doc, r.updated_by);
    const now = new Date().toISOString(); const next = { ...doc, legalHold: !!on, legalHoldBy: on ? by : undefined, legalHoldAt: on ? now : undefined, log: [...(doc.log || []), { t: now, m: (on ? 'Legal hold set by ' : 'Legal hold cleared by ') + by }] };
    const m = docMeta(next); q.upd.run(r.number, m.title, m.tlp, m.pub, m.archived, m.review, now, by, JSON.stringify(next), id);
    audit(by, (on ? 'set legal hold on ' : 'cleared legal hold on ') + r.number, ip);
    return withRev(q.one.get(id));
  },
  listHolds(u) { if (!isAdmin(u)) throw err('Admins only', 403); return q.allDocs.all().map(r => ({ id: r.id, number: r.number, title: r.title, tlp: r.tlp, legalHold: !!JSON.parse(r.doc).legalHold })); },
  restoreRevision(u, id, rev, by, ip) {
    const r = q.one.get(id); if (!r || r.deleted_at || !canEdit(u, meta(r))) throw err('Not found', 404);
    const doc = revisions.get(id, rev); if (!doc) throw err('No such revision', 404);
    revisions.record(id, r.rev, r.doc, r.updated_by);
    const m = docMeta(doc); const now = new Date().toISOString();
    q.upd.run(r.number, m.title, m.tlp, m.pub, m.archived, m.review, now, by, JSON.stringify({ ...doc, number: r.number }), id);
    audit(by, 'restored ' + r.number + ' to revision ' + rev, ip);
    return withRev(q.one.get(id));
  },
  listRevisions(u, id) { const r = q.one.get(id); if (!r || r.deleted_at || !canSee(u, meta(r))) throw err('Not found', 404); return revisions.list(id); },
  getRevision(u, id, rev) { const r = q.one.get(id); if (!r || r.deleted_at || !canSee(u, meta(r))) throw err('Not found', 404); const d = revisions.get(id, rev); if (!d) throw err('No such revision', 404); return d; },
  deleteCases(u, ids, by, ip) {
    const out = [];
    for (const id of ids || []) {
      const r = q.one.get(id); if (!r || r.deleted_at) continue;
      if (!canEdit(u, meta(r))) continue;
      if (JSON.parse(r.doc).legalHold) { audit(by, 'refused to delete ' + r.number + ': legal hold', ip); continue; }
      q.del.run(new Date().toISOString(), by, id); audit(by, 'deleted ' + r.number + ' — ' + r.title + ' (30-day retention)', ip); out.push(id);
    }
    return out;
  },
  getPref(u, kind) { const r = q.pref.get(u.id, kind); return r ? JSON.parse(r.doc) : null; },
  setPref(u, kind, doc) { const s = JSON.stringify(doc ?? {}); if (s.length > 2e6) throw err('preferences too large'); q.prefUp.run(u.id, kind, s, new Date().toISOString()); },
  // ---- files
  putFile(u, id, buf, mime, name, caseId) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(id)) throw err('bad file id');
    if (buf.length > config.maxFileBytes) throw err('file too large', 413);
    const dir = path.join(config.dataDir, 'files'); fs.mkdirSync(dir, { recursive: true });
    const hash = sha256(buf); const p = path.join(dir, hash);
    if (!fs.existsSync(p)) fs.writeFileSync(p, buf, { flag: 'wx' }); // content-addressed, immutable
    if (caseId) { const c = q.one.get(caseId); if (!c || !canEdit(u, meta(c))) throw err('Not found', 404); }
    q.fIns.run(id, u.id, hash, buf.length, String(mime || 'application/octet-stream').slice(0, 100), String(name || '').slice(0, 200), new Date().toISOString(), p, caseId || null);
    audit(u.name, 'stored file ' + id + ' sha256:' + hash.slice(0, 16) + '… (' + buf.length + ' bytes)');
    return { id, sha256: hash, size: buf.length };
  },
  getFile(u, id) { const r = q.fGet.get(id); if (!r) return null; if (r.case_id) { const c = q.one.get(r.case_id); if (!c || c.deleted_at || !canSee(u, meta(c))) return null; } return { ...r, data: fs.readFileSync(r.path) }; },
  // retention: hard-delete soft-deleted cases after CIB_RETENTION_DAYS unless on legal hold
  purgeDeleted(days) {
    const cutoff = new Date(Date.now() - days * 86400e3).toISOString(); let n = 0;
    for (const r of q.purge.all(cutoff)) { if (JSON.parse(r.doc).legalHold) continue; q.hardDel.run(r.id); audit('(retention)', 'purged ' + r.number + ' — ' + r.title + ' after ' + days + ' days in the wastebasket'); n++; }
    return n;
  },
  // personal data about a named person across every case (admin): person cards, comments by them, mentions
  personData(name) {
    const needle = String(name || '').trim().toLowerCase(); if (!needle) throw err('name required'); const out = { name, cases: [] };
    for (const r of q.allDocs.all()) {
      const d = JSON.parse(r.doc); const hits = { id: r.id, number: r.number, title: r.title, tlp: r.tlp, personCards: [], comments: [], tasks: [], logLines: [] };
      for (const it of d.items || []) { if (it.type === 'person' && String(it.title || '').toLowerCase().includes(needle)) hits.personCards.push({ id: it.id, title: it.title, body: it.body, tags: it.tags, image: !!it.image }); for (const c of it.comments || []) if (String(c.by || '').toLowerCase() === needle || String(c.text || '').toLowerCase().includes(needle)) hits.comments.push({ item: it.id, by: c.by, at: c.at, text: c.text }); for (const t of it.todo || []) if (String(t.owner || '').toLowerCase() === needle) hits.tasks.push({ item: it.id, text: t.text, due: t.due, done: !!t.done }); }
      for (const l of d.log || []) if (String(l.m || '').toLowerCase().includes(needle)) hits.logLines.push(l);
      if (hits.personCards.length || hits.comments.length || hits.tasks.length || hits.logLines.length) out.cases.push(hits);
    }
    return out;
  },
};
