// Three-way merge of a case document: base (what the client last saw), server (current), incoming (client's edit).
// Arrays of objects with ids merge per element and per field; scalars take the client's value only when the
// client changed it; the log is a union. The result keeps both analysts' work instead of last-writer-wins.
const J = (x) => JSON.stringify(x);
const ID_ARRAYS = ['items', 'threads', 'groups', 'snapshots', 'reports', 'hypotheses', 'customRels'];
const SKIP = new Set(['rev', 'updatedAt', 'updatedBy', 'id']);

function mergeObject(base, server, incoming) {
  const out = { ...server };
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(server || {}), ...Object.keys(incoming || {})]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const b = base ? base[k] : undefined, s = server ? server[k] : undefined, i = incoming ? incoming[k] : undefined;
    const clientChanged = J(b) !== J(i), serverChanged = J(b) !== J(s);
    if (!clientChanged) { if (s === undefined) delete out[k]; else out[k] = s; continue; }
    if (!serverChanged) { if (i === undefined) delete out[k]; else out[k] = i; continue; }
    // both changed the same field: nested plain objects merge recursively, otherwise the client's edit wins
    if (b && s && i && typeof b === 'object' && !Array.isArray(b) && typeof s === 'object' && !Array.isArray(s) && typeof i === 'object' && !Array.isArray(i)) out[k] = mergeObject(b, s, i);
    else if (i === undefined) delete out[k]; else out[k] = i;
  }
  return out;
}
function mergeIdArray(base = [], server = [], incoming = []) {
  const by = (arr) => new Map((arr || []).filter(x => x && x.id).map(x => [x.id, x]));
  const B = by(base), S = by(server), I = by(incoming);
  const order = []; const seen = new Set();
  for (const x of [...(server || []), ...(incoming || [])]) if (x && x.id && !seen.has(x.id)) { seen.add(x.id); order.push(x.id); }
  const out = [];
  for (const id of order) {
    const b = B.get(id), s = S.get(id), i = I.get(id);
    if (s && i) out.push(b ? mergeObject(b, s, i) : mergeObject(s, s, i));
    else if (s && !i) { if (b && J(b) === J(s)) continue; /* client deleted an unchanged element */ out.push(s); /* server changed it: keep */ }
    else if (!s && i) { if (b && J(b) === J(i)) continue; /* server deleted, client left it alone */ out.push(i); /* client added or edited: keep */ }
  }
  return out;
}
export function mergeCase(base, server, incoming) {
  if (!base) return { ...server, ...incoming }; // no common ancestor known: client wins field by field
  const out = mergeObject(base, server, incoming);
  for (const k of ID_ARRAYS) if (Array.isArray(server[k]) || Array.isArray(incoming[k]) || Array.isArray(base[k])) out[k] = mergeIdArray(base[k], server[k], incoming[k]);
  // append-only log: union, ordered by time
  const logKey = (e) => (e && (e.t + '|' + e.m)) || '';
  const seen = new Set(); out.log = [...(server.log || []), ...(incoming.log || [])].filter(e => { const k = logKey(e); if (!k || seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0).slice(-400);
  if (Array.isArray(server.dismissed) || Array.isArray(incoming.dismissed)) out.dismissed = [...new Set([...(server.dismissed || []), ...(incoming.dismissed || [])])];
  return out;
}
