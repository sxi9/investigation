// Case, preference and file storage with access control and revisions.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { canSee, canEdit, canCreate, canReview, REVIEW_FIELDS, isAdmin } from './acl.js';
import { audit, sha256, uid } from './crypto.js';
import { users } from './users.js';

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
  fIns: db.prepare('INSERT OR REPLACE INTO files (id, owner_id, sha256, size, mime, name, created_at, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
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
        if (typeof c.rev === 'number' && c.rev < existing.rev && existing.updated_by !== by) {
          // stale write from another client: last writer still wins, but we say so
          audit(by, 'overwrote ' + em.id + ' rev ' + existing.rev + ' with a client at rev ' + c.rev, ip);
        }
        if (JSON.stringify({ ...old, rev: 0, updatedAt: 0, updatedBy: 0 }) === JSON.stringify({ ...c, rev: 0, updatedAt: 0, updatedBy: 0 }) && !existing.deleted_at) { accepted.push({ id: c.id, rev: existing.rev, number: existing.number, unchanged: true }); continue; }
        let number = m.number; if (!/^CASE \d{4}$/.test(number)) number = existing.number;
        q.upd.run(number, m.title, m.tlp, m.pub, m.archived, m.review, now, by, JSON.stringify({ ...c, number }), c.id);
        const r = q.one.get(c.id); accepted.push({ id: c.id, rev: r.rev, number: r.number });
      }
      commit.run();
    } catch (e) { rollback.run(); throw e; }
    return { accepted, rejected };
  },
  deleteCases(u, ids, by, ip) {
    const out = [];
    for (const id of ids || []) {
      const r = q.one.get(id); if (!r || r.deleted_at) continue;
      if (!canEdit(u, meta(r))) continue;
      q.del.run(new Date().toISOString(), by, id); audit(by, 'deleted ' + r.number + ' — ' + r.title + ' (30-day retention)', ip); out.push(id);
    }
    return out;
  },
  getPref(u, kind) { const r = q.pref.get(u.id, kind); return r ? JSON.parse(r.doc) : null; },
  setPref(u, kind, doc) { const s = JSON.stringify(doc ?? {}); if (s.length > 2e6) throw err('preferences too large'); q.prefUp.run(u.id, kind, s, new Date().toISOString()); },
  // ---- files
  putFile(u, id, buf, mime, name) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(id)) throw err('bad file id');
    if (buf.length > config.maxFileBytes) throw err('file too large', 413);
    const dir = path.join(config.dataDir, 'files'); fs.mkdirSync(dir, { recursive: true });
    const hash = sha256(buf); const p = path.join(dir, hash);
    if (!fs.existsSync(p)) fs.writeFileSync(p, buf, { flag: 'wx' }); // content-addressed, immutable
    q.fIns.run(id, u.id, hash, buf.length, String(mime || 'application/octet-stream').slice(0, 100), String(name || '').slice(0, 200), new Date().toISOString(), p);
    audit(u.name, 'stored file ' + id + ' sha256:' + hash.slice(0, 16) + '… (' + buf.length + ' bytes)');
    return { id, sha256: hash, size: buf.length };
  },
  getFile(u, id) { const r = q.fGet.get(id); if (!r) return null; return { ...r, data: fs.readFileSync(r.path) }; },
};
