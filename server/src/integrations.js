// Push a case to MISP (event + attributes), TheHive (alert + observables) or open a Jira issue. Keys stay in the environment.
import { audit } from './crypto.js';
import { refang, hashAlgo } from './stix.js';
const env = process.env;
let fetchImpl = (...a) => fetch(...a); export const setFetch = (f) => { fetchImpl = f || ((...a) => fetch(...a)); };
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const strip = (u) => String(u || '').replace(/\/$/, '');
export function available() {
  return {
    misp: !!(env.MISP_URL && env.MISP_KEY), thehive: !!(env.THEHIVE_URL && env.THEHIVE_KEY), jira: !!(env.JIRA_URL && env.JIRA_EMAIL && env.JIRA_TOKEN && env.JIRA_PROJECT),
    labels: { misp: env.MISP_URL ? new URL(env.MISP_URL).hostname : '', thehive: env.THEHIVE_URL ? new URL(env.THEHIVE_URL).hostname : '', jira: env.JIRA_URL ? new URL(env.JIRA_URL).hostname + ' · ' + (env.JIRA_PROJECT || '') : '' },
  };
}
async function call(url, opts, timeoutMs = 15000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { const r = await fetchImpl(url, { ...opts, signal: ctrl.signal }); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {} if (!r.ok) throw err('Upstream answered HTTP ' + r.status + (j && (j.message || j.errors || j.error) ? ': ' + JSON.stringify(j.message || j.errors || j.error).slice(0, 200) : ''), 424); return j; }
  catch (e) { if (e.name === 'AbortError') throw err('Upstream timed out', 424); throw e; } finally { clearTimeout(t); }
}
const indicators = (cs, ids) => (cs.items || []).filter(i => i.type === 'indicator' && i.value && i.status !== 'false' && (!ids || ids.includes(i.id)));
const TLP_NUM = { '': 2, clear: 0, green: 1, amber: 2, 'amber+strict': 2, red: 3 };
// ---- MISP
const MISP_TYPE = (i) => { const v = refang(i.value); switch (i.kind) { case 'domain': case 'hostname': return ['domain', 'Network activity']; case 'ip': return ['ip-dst', 'Network activity']; case 'url': return ['url', 'Network activity']; case 'email': return ['email-src', 'Payload delivery']; case 'hash': return [hashAlgo(v).toLowerCase().replace('-', ''), 'Payload delivery']; case 'filename': return ['filename', 'Payload delivery']; case 'cve': return ['vulnerability', 'External analysis']; case 'wallet': return [/^(1|3|bc1)/.test(v) ? 'btc' : 'text', 'Financial fraud']; case 'phone': return ['phone-number', 'Person']; default: return ['text', 'Other']; } };
export async function pushMisp(cs, { ids, by } = {}) {
  if (!env.MISP_URL || !env.MISP_KEY) throw err('MISP is not configured (MISP_URL, MISP_KEY)', 404);
  const inds = indicators(cs, ids); if (!inds.length) throw err('No indicators to push');
  const Attribute = inds.map(i => { const [type, category] = MISP_TYPE(i); return { type, category, value: refang(i.value), to_ids: i.status === 'confirmed', comment: [i.title, i.body, i.num ? 'E' + i.num : ''].filter(Boolean).join(' — ').slice(0, 250) }; });
  const body = { Event: { info: cs.number + ' — ' + cs.title, distribution: 0, threat_level_id: cs.tlp === 'red' ? 1 : cs.tlp === 'amber' || cs.tlp === 'amber+strict' ? 2 : 3, analysis: cs.review === 'published' ? 2 : 1, date: new Date().toISOString().slice(0, 10), Tag: [{ name: 'tlp:' + (cs.tlp || 'amber').replace('+strict', '+strict') }, { name: 'source:investigation-board' }], Attribute } };
  const r = await call(strip(env.MISP_URL) + '/events', { method: 'POST', headers: { Authorization: env.MISP_KEY, Accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ev = r && r.Event ? r.Event : r || {}; const out = { system: 'misp', id: ev.id || ev.uuid || '', url: ev.id ? strip(env.MISP_URL) + '/events/view/' + ev.id : strip(env.MISP_URL), count: Attribute.length };
  audit(by || '(system)', 'pushed ' + cs.number + ' to MISP as event ' + (out.id || '?') + ' (' + out.count + ' attributes)'); return out;
}
// ---- TheHive
const HIVE_TYPE = { domain: 'domain', hostname: 'hostname', ip: 'ip', url: 'url', email: 'mail', hash: 'hash', filename: 'filename', cve: 'other', wallet: 'other', phone: 'other', handle: 'other' };
export async function pushTheHive(cs, { ids, by } = {}) {
  if (!env.THEHIVE_URL || !env.THEHIVE_KEY) throw err('TheHive is not configured (THEHIVE_URL, THEHIVE_KEY)', 404);
  const inds = indicators(cs, ids);
  const body = { type: 'investigation', source: 'investigation-board', sourceRef: cs.id + ':' + Date.now().toString(36), title: cs.number + ' — ' + cs.title, description: (cs.judgement && cs.judgement.text) || (cs.notes || '').slice(0, 2000) || cs.title, severity: cs.tlp === 'red' ? 3 : 2, tlp: TLP_NUM[cs.tlp || ''], pap: 2, tags: ['investigation-board', cs.number, ...String(cs.tags || '').split(/[,\s]+/).filter(Boolean)], observables: inds.map(i => ({ dataType: HIVE_TYPE[i.kind] || 'other', data: refang(i.value), message: [i.title, i.body].filter(Boolean).join(' — ').slice(0, 250), ioc: i.status === 'confirmed', tags: [i.kind] })) };
  const r = await call(strip(env.THEHIVE_URL) + '/api/v1/alert', { method: 'POST', headers: { Authorization: 'Bearer ' + env.THEHIVE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const out = { system: 'thehive', id: (r && (r._id || r.id)) || '', url: strip(env.THEHIVE_URL) + '/alerts', count: inds.length };
  audit(by || '(system)', 'pushed ' + cs.number + ' to TheHive as alert ' + (out.id || '?') + ' (' + out.count + ' observables)'); return out;
}
// ---- Jira
const adf = (text) => ({ type: 'doc', version: 1, content: String(text || '').split(/\n{2,}/).map(p => ({ type: 'paragraph', content: [{ type: 'text', text: p.slice(0, 4000) || ' ' }] })) });
export async function createJira(cs, { summary, description, by, issueType } = {}) {
  if (!env.JIRA_URL || !env.JIRA_EMAIL || !env.JIRA_TOKEN || !env.JIRA_PROJECT) throw err('Jira is not configured (JIRA_URL, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT)', 404);
  const s = String(summary || (cs.number + ' — ' + cs.title)).slice(0, 250);
  const body = { fields: { project: { key: env.JIRA_PROJECT }, summary: s, issuetype: { name: issueType || env.JIRA_ISSUE_TYPE || 'Task' }, description: adf((description || '') + '\n\nCase ' + cs.number + ' — ' + cs.title + (cs.tlp ? '\nTLP:' + cs.tlp.toUpperCase() : '')), labels: ['investigation-board', cs.number.replace(/\s+/g, '-')] } };
  const r = await call(strip(env.JIRA_URL) + '/rest/api/3/issue', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(env.JIRA_EMAIL + ':' + env.JIRA_TOKEN).toString('base64'), Accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const out = { system: 'jira', id: (r && r.key) || '', url: r && r.key ? strip(env.JIRA_URL) + '/browse/' + r.key : strip(env.JIRA_URL) };
  audit(by || '(system)', 'opened Jira issue ' + (out.id || '?') + ' for ' + cs.number + ': ' + s); return out;
}
