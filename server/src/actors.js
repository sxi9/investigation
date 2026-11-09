// Editable actor library on the server, importable from STIX 2.1 bundles (intrusion-set / threat-actor + uses →
// attack-pattern) and MISP galaxy clusters. The board merges it into its built-in list.
import { db } from './db.js';
import { uid, audit } from './crypto.js';
db.exec(`CREATE TABLE IF NOT EXISTS actors (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_lc TEXT NOT NULL UNIQUE, aliases TEXT NOT NULL, origin TEXT, motive TEXT, summary TEXT, techniques TEXT NOT NULL, source TEXT, updated_at TEXT NOT NULL, updated_by TEXT)`);
const q = {
  all: db.prepare('SELECT * FROM actors ORDER BY name'), one: db.prepare('SELECT * FROM actors WHERE id = ?'), byName: db.prepare('SELECT * FROM actors WHERE name_lc = ?'),
  ins: db.prepare('INSERT INTO actors (id, name, name_lc, aliases, origin, motive, summary, techniques, source, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  upd: db.prepare('UPDATE actors SET name = ?, name_lc = ?, aliases = ?, origin = ?, motive = ?, summary = ?, techniques = ?, source = ?, updated_at = ?, updated_by = ? WHERE id = ?'),
  del: db.prepare('DELETE FROM actors WHERE id = ?'),
};
const row = (r) => r && ({ id: r.id, name: r.name, aliases: JSON.parse(r.aliases), origin: r.origin || '', motive: r.motive || '', summary: r.summary || '', techniques: JSON.parse(r.techniques), source: r.source || '', updatedAt: r.updated_at, updatedBy: r.updated_by });
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const clean = (a) => {
  const name = String(a.name || '').trim().slice(0, 120); if (!name) throw err('name required');
  const list = (x) => (Array.isArray(x) ? x : String(x || '').split(',')).map(s => String(s).trim()).filter(Boolean).slice(0, 40);
  const tech = list(a.techniques).map(t => t.toUpperCase()).filter(t => /^T\d{4}(\.\d{3})?$/.test(t));
  return { name, aliases: list(a.aliases).slice(0, 20), origin: String(a.origin || '').slice(0, 80), motive: String(a.motive || '').slice(0, 80), summary: String(a.summary || '').slice(0, 1500), techniques: tech, source: String(a.source || '').slice(0, 200) };
};
export const actors = {
  list: () => q.all.all().map(row),
  upsert(a, by) {
    const c = clean(a); const now = new Date().toISOString(); const ex = q.byName.get(c.name.toLowerCase());
    if (ex) { const merged = { ...c, aliases: [...new Set([...JSON.parse(ex.aliases), ...c.aliases])], techniques: [...new Set([...JSON.parse(ex.techniques), ...c.techniques])], summary: c.summary || ex.summary, origin: c.origin || ex.origin, motive: c.motive || ex.motive }; q.upd.run(merged.name, merged.name.toLowerCase(), JSON.stringify(merged.aliases), merged.origin, merged.motive, merged.summary, JSON.stringify(merged.techniques), merged.source || ex.source, now, by, ex.id); return { actor: row(q.one.get(ex.id)), updated: true }; }
    const id = uid('a'); q.ins.run(id, c.name, c.name.toLowerCase(), JSON.stringify(c.aliases), c.origin, c.motive, c.summary, JSON.stringify(c.techniques), c.source, now, by); return { actor: row(q.one.get(id)), updated: false };
  },
  update(id, patch, by) { const ex = q.one.get(id); if (!ex) throw err('Not found', 404); const c = clean({ ...row(ex), ...patch }); q.upd.run(c.name, c.name.toLowerCase(), JSON.stringify(c.aliases), c.origin, c.motive, c.summary, JSON.stringify(c.techniques), c.source, new Date().toISOString(), by, id); audit(by, 'actor updated: ' + c.name); return row(q.one.get(id)); },
  remove(id, by) { const ex = q.one.get(id); if (!ex) throw err('Not found', 404); q.del.run(id); audit(by, 'actor removed: ' + ex.name); },
  // STIX bundle or MISP galaxy → actors
  importBundle(json, by) {
    let items = [];
    if (json && Array.isArray(json.objects)) {
      const byId = Object.fromEntries(json.objects.map(o => [o.id, o]));
      const techOf = (ref) => json.objects.filter(r => r.type === 'relationship' && r.relationship_type === 'uses' && r.source_ref === ref).map(r => byId[r.target_ref]).filter(t => t && t.type === 'attack-pattern').map(t => ((t.external_references || []).find(x => x.source_name === 'mitre-attack') || {}).external_id).filter(Boolean);
      for (const o of json.objects) if ((o.type === 'intrusion-set' || o.type === 'threat-actor') && !o.revoked) items.push({ name: o.name, aliases: o.aliases || [], origin: (o.x_mitre_contributors && '') || '', motive: (o.primary_motivation || (o.goals || [])[0] || ''), summary: o.description || '', techniques: techOf(o.id), source: 'STIX ' + (o.id || '') });
    } else if (json && Array.isArray(json.values)) {
      for (const v of json.values) items.push({ name: v.value, aliases: (v.meta && v.meta.synonyms) || [], origin: (v.meta && (v.meta.country || (v.meta['attribution-confidence'] ? '' : ''))) || '', motive: (v.meta && (v.meta.cfr_type_of_incident || [])[0]) || '', summary: v.description || '', techniques: [], source: 'MISP galaxy ' + (json.name || '') });
    } else throw err('Expected a STIX 2.1 bundle (objects[]) or a MISP galaxy (values[])');
    let added = 0, updated = 0; for (const a of items.slice(0, 500)) { try { const r = actors.upsert(a, by); if (r.updated) updated++; else added++; } catch (e) {} }
    audit(by, 'actor import: ' + added + ' added, ' + updated + ' updated'); return { added, updated, total: items.length };
  },
};
