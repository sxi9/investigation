// Enrichment on pin: when an indicator lands on the board, ask the server once and write the result onto the card
// (body, dates, tags). Shared infrastructure (CDN, cloud, code hosting) is flagged so it is not blocklisted blindly.
import { api } from './api.js';
const KINDS = new Set(['ip', 'domain', 'url', 'email', 'cve', 'hash', 'wallet']);
const queue = new Map(); let running = 0;
function fmt(r) {
  const head = 'ENRICHMENT · ' + r.at.slice(0, 10) + (r.cached ? ' (cached)' : '');
  const warn = r.warnings.length ? '\n! ' + r.warnings.join('\n! ') : '';
  return head + '\n' + r.lines.join('\n') + warn;
}
function patchFor(it, r) {
  const body = String(it.body || '');
  const stripped = body.replace(/\n?\n?ENRICHMENT · [\s\S]*$/m, '').trimEnd();
  const p = { body: (stripped ? stripped + '\n\n' : '') + fmt(r), enrich: { at: r.at, shared: r.shared, asn: r.fields.asn, org: r.fields.asOrg || r.fields.org, country: r.fields.country, registrar: r.fields.registrar, created: r.fields.created, vt: r.fields.vt, kev: r.fields.kev, cvss: r.fields.cvss, algorithm: r.fields.algorithm } };
  const tags = new Set(String(it.tags || '').split(',').map(s => s.trim()).filter(Boolean));
  if (r.shared) tags.add('shared-infra'); if (r.fields.kev) tags.add('kev'); if (r.fields.algorithm) tags.add(r.fields.algorithm.toLowerCase().replace('-', ''));
  if (r.fields.vt && r.fields.vt.malicious > 0) tags.add('vt-flagged');
  p.tags = [...tags].join(', ');
  if (!it.firstSeen && r.fields.created) p.firstSeen = r.fields.created;
  if (!it.source && r.sources.length) p.source = 'enrichment: ' + r.sources.map(s => s.name).join(', ');
  if (!it.collected) p.collected = r.at.slice(0, 10);
  return p;
}
async function run(L, id, fresh) {
  const it = L.cs().items.find(i => i.id === id); if (!it || it.type !== 'indicator' || !KINDS.has(it.kind) || !String(it.value || '').trim()) return null;
  const r = await api('POST', '/api/enrich', { kind: it.kind, value: it.value, fresh: !!fresh });
  const cur = L.cs().items.find(i => i.id === id); if (!cur) return r;
  L.upItem(id, patchFor(cur, r));
  if (r.shared && L.toast) L.toast('Shared infrastructure: ' + (r.fields.asOrg || r.fields.org || 'CDN / cloud') + ' — do not blocklist on this alone');
  if (L.logEvt) L.logEvt('Enriched ' + it.kind + ' ' + it.value + (r.shared ? ' (shared infrastructure)' : '') + (r.fields.vt ? ' · VT ' + r.fields.vt.malicious + '/' + r.fields.vt.total : ''));
  return r;
}
const E = {
  enabled: true,
  schedule(id) {
    if (!E.enabled || !window.CIBPage) return; const L = window.CIBPage;
    clearTimeout(queue.get(id)); queue.set(id, setTimeout(async () => { queue.delete(id); if (running > 3) return E.schedule(id); running++; try { await run(L, id); } catch (e) { console.warn('enrich', e); } finally { running--; } }, 1200));
  },
  async enrichNow(id, fresh) { const L = window.CIBPage; if (!L) return null; return run(L, id, fresh); },
  pending() { const L = window.CIBPage; if (!L) return []; return L.cs().items.filter(i => i.type === 'indicator' && KINDS.has(i.kind) && String(i.value || '').trim() && !(i.enrich && i.enrich.at)); },
  async enrichAll(onProgress) { const list = E.pending(); let n = 0; for (const it of list) { try { await run(window.CIBPage, it.id); } catch (e) {} n++; if (onProgress) onProgress(n, list.length); } return n; },
};
window.CIBEnrich = E;
export default E;
