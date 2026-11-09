// Server-side STIX 2.1 conversion of a case document, with stable ids (UUIDv5 of case+item) so feeds re-export the same objects.
import crypto from 'node:crypto';
const NS = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
export function uuid5(name) { const h = crypto.createHash('sha1').update(Buffer.from(NS.replace(/-/g, ''), 'hex')).update(name).digest(); h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80; const x = h.toString('hex'); return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20, 32); }
export const refang = (v) => String(v || '').replace(/\[\.\]/g, '.').replace(/\(\.\)/g, '.').replace(/hxxp/gi, 'http').replace(/\[:\]/g, ':').replace(/\[@\]/g, '@').trim();
export function hashAlgo(v) { const n = String(v || '').length; return n === 32 ? 'MD5' : n === 40 ? 'SHA-1' : n === 64 ? 'SHA-256' : n === 128 ? 'SHA-512' : 'SHA-256'; }
export function pattern(kind, value) {
  const v = refang(value).replace(/'/g, "\\'"); if (!v) return '';
  switch (kind) {
    case 'domain': case 'hostname': return "[domain-name:value = '" + v + "']";
    case 'ip': return (v.includes(':') ? "[ipv6-addr:value = '" : "[ipv4-addr:value = '") + v + "']";
    case 'url': return "[url:value = '" + v + "']";
    case 'email': return "[email-addr:value = '" + v + "']";
    case 'handle': return "[user-account:account_login = '" + v.replace(/^@/, '') + "']";
    case 'hash': return "[file:hashes.'" + hashAlgo(v) + "' = '" + v.toLowerCase() + "']";
    case 'filename': return "[file:name = '" + v + "']";
    case 'wallet': return "[x-cryptocurrency-wallet:address = '" + v + "']";
    case 'phone': return "[x-phone-number:value = '" + v + "']";
    default: return "[x-indicator:value = '" + v + "']";
  }
}
const conf = (i) => i.status === 'confirmed' ? 85 : i.status === 'false' ? 10 : 40;
export function caseToStix(cs, { indicatorsOnly = false } = {}) {
  const now = new Date().toISOString(), objs = [], ids = {}; const sid = (type, key) => type + '--' + uuid5(cs.id + '|' + key);
  const base = (type, i) => ({ type, spec_version: '2.1', id: ids[i.id] = sid(type, i.id), created: i.collected ? new Date(i.collected).toISOString() : now, modified: cs.updatedAt || now });
  const desc = (i) => [i.body, i.tags ? 'tags: ' + i.tags : '', i.num ? 'exhibit E' + i.num : '', cs.number].filter(Boolean).join('\n');
  const label = (i) => i.title || i.value || i.type;
  for (const i of cs.items || []) {
    if (i.status === 'false') continue;
    const v = refang(i.value), d = desc(i);
    if (i.type === 'indicator') {
      if (i.kind === 'cve') { if (!indicatorsOnly) objs.push({ ...base('vulnerability', i), name: v.toUpperCase(), description: d, external_references: [{ source_name: 'cve', external_id: v.toUpperCase() }] }); continue; }
      const pat = pattern(i.kind, v); if (!pat) continue;
      objs.push({ ...base('indicator', i), name: i.title || v, description: d, pattern: pat, pattern_type: 'stix', valid_from: i.firstSeen ? new Date(i.firstSeen).toISOString() : now, confidence: conf(i), labels: [i.kind, 'malicious-activity'], ...(i.tlp ? { object_marking_refs: [] } : {}) });
      continue;
    }
    if (indicatorsOnly) continue;
    if (i.type === 'ttp') { const id = String(i.value || '').toUpperCase(); objs.push({ ...base('attack-pattern', i), name: i.title || id, description: d, external_references: id ? [{ source_name: 'mitre-attack', external_id: id, url: 'https://attack.mitre.org/techniques/' + id.replace('.', '/') + '/' }] : [] }); }
    else if (i.type === 'person') { const actor = /\bactor\b/i.test(i.tags || ''); objs.push(actor ? { ...base('threat-actor', i), name: i.title || 'Unknown actor', description: d, confidence: conf(i) } : { ...base('identity', i), name: i.title || 'Unknown subject', identity_class: 'individual', description: d }); }
    else if (i.type === 'location') objs.push({ ...base('location', i), name: i.title || 'Unknown location', description: d, ...(i.lat && i.lng ? { latitude: Number(i.lat), longitude: Number(i.lng) } : {}) });
    else if (i.type === 'target') objs.push({ ...base('identity', i), name: i.title || 'Target', identity_class: 'organization', description: d });
    else if (i.type === 'tx') objs.push({ ...base('x-cryptocurrency-transaction', i), name: label(i), chain: i.chain || '', amount: i.amount || '', from_address: i.txFrom || '', to_address: i.txTo || '', tx_hash: v, description: d, confidence: conf(i) });
    else objs.push({ ...base('note', i), abstract: label(i), content: [i.url, i.body, i.date ? 'date: ' + i.date + (i.time ? ' ' + i.time : '') : ''].filter(Boolean).join('\n') || label(i), object_refs: [sid('report', 'report')] });
  }
  if (!indicatorsOnly) {
    const RT = { resolves: 'resolves-to', located: 'located-at', controls: 'controls', alias: 'related-to', suspected: 'related-to', linked: 'related-to' };
    for (const t of cs.threads || []) {
      const A = (cs.items || []).find(i => i.id === t.from), B = (cs.items || []).find(i => i.id === t.to); if (!A || !B || !ids[t.from] || !ids[t.to]) continue;
      let rt = RT[t.rel] || 'related-to'; if (A.type === 'person' && /actor/i.test(A.tags || '') && B.type === 'ttp') rt = 'uses'; if (A.type === 'indicator' && rt === 'related-to') rt = 'indicates';
      objs.push({ type: 'relationship', spec_version: '2.1', id: sid('relationship', t.id || (t.from + '>' + t.to)), created: now, modified: now, relationship_type: rt, source_ref: ids[t.from], target_ref: ids[t.to], description: t.why || '', confidence: t.conf === 'high' ? 85 : t.conf === 'low' ? 25 : 55 });
    }
    objs.unshift({ type: 'report', spec_version: '2.1', id: sid('report', 'report'), created: now, modified: now, name: cs.number + ' — ' + cs.title, description: cs.notes || '', published: now, report_types: ['threat-report'], object_refs: objs.map(o => o.id) });
  }
  return objs;
}
export const bundle = (objects) => ({ type: 'bundle', id: 'bundle--' + crypto.randomUUID(), objects });
