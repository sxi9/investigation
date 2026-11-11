// AI drafts from the whole case: executive summary, takedown / RFI letter, competing hypotheses. Model when configured, rules otherwise.
import { complete } from './ai/index.js';
import { refang } from './stix.js';
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const KIND = { domain: 'domain', hostname: 'hostname', ip: 'IP address', url: 'URL', hash: 'file hash', handle: 'handle', email: 'email address', wallet: 'wallet', cve: 'CVE', phone: 'phone number', filename: 'file name' };
export function caseDigest(cs, max = 6000) {
  const items = (cs.items || []).filter(i => i.status !== 'false');
  const line = (i) => '- [' + (i.num ? 'E' + i.num + ' ' : '') + i.type + (i.kind ? '/' + i.kind : '') + (i.status ? ' ' + i.status : '') + '] ' + [i.title, i.value ? refang(i.value) : '', i.date ? i.date + (i.time ? ' ' + i.time : '') : '', (i.body || '').replace(/\s+/g, ' ').slice(0, 160)].filter(Boolean).join(' · ');
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const threads = (cs.threads || []).map(t => { const a = byId[t.from], b = byId[t.to]; return a && b ? '- ' + (a.title || a.value) + ' —' + t.rel + '→ ' + (b.title || b.value) + (t.why ? ' (' + t.why + ')' : '') : ''; }).filter(Boolean);
  let text = 'CASE ' + cs.number + ' — ' + cs.title + (cs.tlp ? ' · TLP:' + cs.tlp.toUpperCase() : '') + '\n' + (cs.notes ? 'NOTES:\n' + cs.notes.slice(0, 1500) + '\n' : '') + (cs.judgement && cs.judgement.text ? 'JUDGEMENT: ' + cs.judgement.text + '\n' : '') + 'EXHIBITS (' + items.length + '):\n' + items.map(line).join('\n') + (threads.length ? '\nTHREADS:\n' + threads.join('\n') : '') + ((cs.hypotheses || []).length ? '\nHYPOTHESES SO FAR:\n' + cs.hypotheses.map(h => '- ' + h.text).join('\n') : '');
  return text.length > max ? text.slice(0, max) + '\n…' : text;
}
const SYSTEM = 'You are an experienced cyber threat intelligence analyst writing for an investigation board. Be concrete, cite exhibit numbers (E12) where you rely on them, never invent facts that are not in the case, keep indicators defanged as given, and write in plain English.';
function localSummary(cs) {
  const items = (cs.items || []).filter(i => i.status !== 'false'); const n = (t) => items.filter(i => i.type === t).length; const inds = items.filter(i => i.type === 'indicator'); const conf = inds.filter(i => i.status === 'confirmed');
  const dated = items.filter(i => i.date).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))); const actors = items.filter(i => i.type === 'person' && /actor/i.test(i.tags || '')); const ttps = items.filter(i => i.type === 'ttp'); const targets = items.filter(i => i.type === 'target');
  const p = [];
  p.push(cs.number + ' — ' + cs.title + '. ' + (cs.judgement && cs.judgement.text ? cs.judgement.text : (cs.notes || '').split('\n').find(l => l.trim()) || 'No working theory recorded yet.'));
  if (dated.length) p.push('Chronology: ' + dated.slice(0, 5).map(i => i.date + (i.time ? ' ' + i.time : '') + ' ' + (i.title || i.value)).join('; ') + (dated.length > 5 ? '; and ' + (dated.length - 5) + ' further dated exhibits' : '') + '.');
  p.push('Evidence: ' + items.length + ' exhibits — ' + inds.length + ' indicators (' + conf.length + ' confirmed), ' + n('event') + ' events, ' + n('person') + ' people, ' + n('doc') + ' documents, ' + ttps.length + ' techniques, ' + (cs.threads || []).length + ' threads between them.');
  if (actors.length) p.push('Attribution: ' + actors.map(a => a.title).join(', ') + (ttps.length ? ' — techniques in play: ' + ttps.map(t => (t.value || '') + (t.title ? ' ' + t.title : '')).slice(0, 6).join(', ') : '') + '.');
  if (targets.length) p.push('Affected: ' + targets.map(t => t.title + (t.sector ? ' (' + t.sector + ')' : '')).join(', ') + '.');
  if (conf.length) p.push('Blockable now: ' + conf.slice(0, 8).map(i => refang(i.value)).join(', ') + (conf.length > 8 ? ' and ' + (conf.length - 8) + ' more' : '') + '.');
  const open = items.flatMap(i => (i.todo || []).filter(t => !t.done).map(t => t.text)); if (open.length) p.push('Open tasks: ' + open.slice(0, 5).join('; ') + '.');
  return p.join('\n\n');
}
function localHypotheses(cs) {
  const items = (cs.items || []); const has = (re) => items.some(i => re.test([i.title, i.body, i.tags, i.type, i.kind].join(' ')));
  const out = [];
  if (has(/phish|lure|credential|login page|clone/i)) out.push('Credential phishing campaign by a financially motivated crew reusing a known kit', 'Targeted spear-phishing against named staff as the first stage of an intrusion');
  if (has(/ransom|encrypt|locker|leak site/i)) out.push('Ransomware affiliate intrusion via stolen VPN credentials or an edge-device CVE', 'Extortion-only data theft without encryption');
  if (has(/wallet|eth|btc|chain|bridge|drain/i) || items.some(i => i.type === 'tx')) out.push('Compromised signer or hot-wallet key followed by rapid laundering through mixers and bridges', 'Insider with signing authority acting with an external crew');
  if (has(/impersonat|fake account|disinfo|narrative|bot/i)) out.push('Coordinated inauthentic campaign run by a single operator', 'Organic spread amplified opportunistically by unrelated accounts');
  if (has(/insider|employee|contractor|badge/i)) out.push('Insider action, deliberate or negligent');
  out.push('Opportunistic, untargeted activity that happens to fit the pattern', 'Misattribution: the indicators belong to shared infrastructure or a research scanner, not to the suspected actor');
  const have = new Set((cs.hypotheses || []).map(h => h.text.toLowerCase()));
  return [...new Set(out)].filter(h => !have.has(h.toLowerCase())).slice(0, 6).map(text => ({ text, why: 'Suggested from the evidence types on the board; test it against the ACH grid.' }));
}
function localTakedown(cs, { to, ids, kind }) {
  const inds = (cs.items || []).filter(i => i.type === 'indicator' && i.value && i.status !== 'false' && (!ids || ids.includes(i.id)));
  const lines = inds.map(i => '  - ' + (KIND[i.kind] || i.kind) + ': ' + refang(i.value).replace(/\./g, '[.]').replace(/^http/i, 'hxxp') + (i.status ? ' [' + i.status + ']' : '') + (i.lastSeen ? ' — last seen ' + i.lastSeen : '') + (i.body ? ' — ' + i.body.replace(/\s+/g, ' ').slice(0, 100) : ''));
  const ctx = (cs.judgement && cs.judgement.text) || (cs.notes || '').split('\n').find(l => l.trim()) || cs.title;
  if (kind === 'rfi') return 'Subject: Request for information — ' + cs.title + '\n\nTo: ' + (to || '[recipient]') + '\n\nWe are investigating ' + cs.title + ' (our reference ' + cs.number + '). ' + ctx + '\n\nWe would value any information you hold on the following, including first and last seen dates, registrant or account details, associated infrastructure and related reporting:\n\n' + lines.join('\n') + '\n\nHandling: ' + (cs.tlp ? 'TLP:' + cs.tlp.toUpperCase() : 'as agreed') + '. Please reply through this channel.\n\nKind regards,\nInvestigations team';
  return 'Subject: Abuse report and takedown request — ' + inds.length + ' resource(s) used in ' + cs.title + '\n\nTo: ' + (to || '[abuse desk]') + '\n\nWe are investigating ' + cs.title + ' (our reference ' + cs.number + '). ' + ctx + '\n\nThe following resources under your control are being used in this activity. We ask that they be suspended or removed under your acceptable-use or abuse policy, and that any registrant, payment and access logs be preserved for ' + (cs.tlp === 'red' ? 'law-enforcement request' : 'a follow-up request') + '. Indicators are defanged: replace [.] with a dot and hxxp with http.\n\n' + lines.join('\n') + '\n\nWhat we observed: ' + (inds.filter(i => i.status === 'confirmed').length) + ' of these are confirmed from direct evidence on our side; the rest are linked by infrastructure or timing. Evidence (screenshots, headers, hashes) is available on request.\n\nPlease confirm the action taken and a reference number.\n\nKind regards,\nInvestigations team';
}
// Storyboard from the chronology: one scene per day (merged into spans when there are many), then what we assess and what we ask for.
export function localStory(cs) {
  const all = (cs.items || []).filter(i => i.status !== 'false'); const items = all.some(i => i.pinned) ? all.filter(i => i.pinned) : all; const label = (i) => i.title || (i.value ? refang(i.value) : i.type);
  const dated = items.filter(i => i.date).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const days = []; for (const i of dated) { const d = days[days.length - 1]; if (d && d.date === i.date) d.items.push(i); else days.push({ date: i.date, items: [i] }); }
  let groups = days; if (days.length > 8) { const per = Math.ceil(days.length / 8); groups = []; for (let k = 0; k < days.length; k += per) { const chunk = days.slice(k, k + per); groups.push({ date: chunk[0].date, to: chunk[chunk.length - 1].date, items: chunk.flatMap(c => c.items) }); } }
  const scenes = groups.map(g => ({ title: g.items.length === 1 ? label(g.items[0]) : label(g.items[0]) + (g.items.length > 1 ? ' and ' + (g.items.length - 1) + ' more' : ''), kind: 'happened', from: g.date, to: g.to || g.date, caption: g.items.map(i => (i.time ? i.time + ' — ' : '') + label(i) + (i.body ? ': ' + i.body.replace(/\s+/g, ' ').slice(0, 140) : '')).join('\n'), exhibits: g.items.map(i => i.num).filter(Boolean) }));
  const inds = items.filter(i => i.type === 'indicator'); const conf = inds.filter(i => i.status === 'confirmed'); const actors = items.filter(i => i.type === 'person' && /actor/i.test(i.tags || '')); const ttps = items.filter(i => i.type === 'ttp');
  if (inds.length || ttps.length) scenes.push({ title: 'What the evidence shows', kind: 'found', caption: [inds.length + ' indicators (' + conf.length + ' confirmed)' + (conf.length ? ': ' + conf.slice(0, 6).map(i => refang(i.value)).join(', ') : ''), ttps.length ? 'Techniques: ' + ttps.map(t => (t.value || '') + (t.title ? ' ' + t.title : '')).slice(0, 6).join(', ') : ''].filter(Boolean).join('\n'), exhibits: [...conf.slice(0, 6), ...ttps.slice(0, 6)].map(i => i.num).filter(Boolean) });
  if ((cs.judgement && cs.judgement.text) || actors.length) scenes.push({ title: 'Assessment', kind: 'assess', caption: [(cs.judgement && cs.judgement.text) || '', actors.length ? 'Attributed to ' + actors.map(a => a.title).join(', ') + (cs.judgement && cs.judgement.conf ? ' (' + cs.judgement.conf + ' confidence)' : '') : ''].filter(Boolean).join('\n'), exhibits: actors.map(a => a.num).filter(Boolean) });
  const open = items.flatMap(i => (i.todo || []).filter(t => !t.done).map(t => t.text));
  if (conf.length || open.length) scenes.push({ title: 'What we ask for', kind: 'ask', caption: [conf.length ? 'Block or take down: ' + conf.slice(0, 8).map(i => refang(i.value)).join(', ') : '', open.length ? 'Open actions: ' + open.slice(0, 5).join('; ') : ''].filter(Boolean).join('\n'), exhibits: conf.slice(0, 8).map(i => i.num).filter(Boolean) });
  return scenes;
}
export async function draft(cs, { kind, to, ids, letter } = {}) {
  if (!['summary', 'takedown', 'rfi', 'hypotheses', 'story'].includes(kind)) throw err('kind must be summary, takedown, rfi, hypotheses or story');
  const digest = caseDigest(cs);
  const prompts = {
    summary: 'Write an executive summary of this case in 4–6 short paragraphs: what happened (with dates), who was affected, what the evidence shows and how strong it is, attribution with confidence, what to do next. Cite exhibits.\n\n' + digest,
    takedown: 'Draft a takedown / abuse report to ' + (to || 'the hosting provider or registrar') + ' asking them to suspend the listed resources. Formal, specific, under 350 words, indicators defanged, mention that logs should be preserved. Only include indicators that are on the case.\n\n' + digest,
    rfi: 'Draft a request-for-information letter to ' + (to || 'a partner organisation') + ' about the indicators on this case: what we know, what we ask for (first/last seen, registrant, related infrastructure), handling instructions. Formal, under 300 words.\n\n' + digest,
    story: 'Turn this case into a storyboard of 4–8 scenes a reader can follow: what happened (in date order, with from/to dates), what we found, what we assess (with confidence), what we ask for. Each scene: a short title, a caption of 2–4 sentences citing exhibits by number, the exhibit numbers it rests on. Answer ONLY as JSON: {"scenes":[{"title":"…","kind":"happened|found|assess|ask","from":"YYYY-MM-DD","to":"YYYY-MM-DD","caption":"…","exhibits":[12,14]}]}\n\n' + digest,
    hypotheses: 'Propose 4–6 competing hypotheses for this case that an analysis-of-competing-hypotheses grid should test, including at least one benign or misattribution hypothesis. Answer ONLY as JSON: {"hypotheses":[{"text":"…","why":"one sentence on what evidence would discriminate it"}]}\n\n' + digest,
  };
  let r = null; try { r = await complete({ system: SYSTEM, messages: [{ role: 'user', content: prompts[kind] }], max_tokens: kind === 'hypotheses' ? 1200 : kind === 'story' ? 2500 : 1600 }, { timeoutMs: 60000 }); } catch (e) { r = null; }
  const model = r && r.provider !== 'local' && r.text;
  if (kind === 'story') {
    const KINDS = new Set(['happened', 'found', 'assess', 'ask']); const nums = new Set((cs.items || []).map(i => i.num).filter(Boolean));
    if (model) { try { const a = r.text.indexOf('{'), b = r.text.lastIndexOf('}'); const j = JSON.parse(r.text.slice(a, b + 1)); const sc = (j.scenes || []).map(x => ({ title: String(x.title || '').slice(0, 120), kind: KINDS.has(x.kind) ? x.kind : 'happened', from: /^\d{4}-\d{2}-\d{2}$/.test(x.from || '') ? x.from : '', to: /^\d{4}-\d{2}-\d{2}$/.test(x.to || '') ? x.to : '', caption: String(x.caption || '').slice(0, 1200), exhibits: (Array.isArray(x.exhibits) ? x.exhibits : []).map(Number).filter(n => nums.has(n)) })).filter(x => x.title).slice(0, 12); if (sc.length) return { kind, scenes: sc, engine: r.engine }; } catch (e) {} }
    return { kind, scenes: localStory(cs), engine: 'rules' };
  }
  if (kind === 'hypotheses') {
    if (model) { try { const a = r.text.indexOf('{'), b = r.text.lastIndexOf('}'); const j = JSON.parse(r.text.slice(a, b + 1)); const hs = (j.hypotheses || []).map(h => ({ text: String(h.text || '').slice(0, 200), why: String(h.why || '').slice(0, 240) })).filter(h => h.text); if (hs.length) return { kind, hypotheses: hs, engine: r.engine }; } catch (e) {} }
    return { kind, hypotheses: localHypotheses(cs), engine: 'rules' };
  }
  if (model) return { kind, text: r.text.trim(), engine: r.engine };
  return { kind, text: kind === 'summary' ? localSummary(cs) : localTakedown(cs, { to, ids, kind }), engine: 'rules' };
}
