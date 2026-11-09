// MITRE ATT&CK Enterprise matrix: downloaded once from the MITRE CTI repository, reduced to [id, name, tactic]
// triples and cached under data/attack.json. The board merges it into its built-in short list.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
const FILE = () => path.join(config.dataDir, 'attack.json');
const SRC = process.env.ATTACK_STIX_URL || 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';
const TACTIC = { 'reconnaissance': 'Reconnaissance', 'resource-development': 'Resource Development', 'initial-access': 'Initial Access', 'execution': 'Execution', 'persistence': 'Persistence', 'privilege-escalation': 'Privilege Escalation', 'defense-evasion': 'Defense Evasion', 'credential-access': 'Credential Access', 'discovery': 'Discovery', 'lateral-movement': 'Lateral Movement', 'collection': 'Collection', 'command-and-control': 'Command and Control', 'exfiltration': 'Exfiltration', 'impact': 'Impact' };
let cache = null;

export function compactAttack(bundle) {
  const out = []; const seen = new Set();
  for (const o of bundle.objects || []) {
    if (o.type !== 'attack-pattern' || o.revoked || o.x_mitre_deprecated) continue;
    const ref = (o.external_references || []).find(r => r.source_name === 'mitre-attack' && /^T\d{4}(\.\d{3})?$/.test(r.external_id || '')); if (!ref || seen.has(ref.external_id)) continue;
    const phase = (o.kill_chain_phases || []).find(p => p.kill_chain_name === 'mitre-attack'); seen.add(ref.external_id);
    out.push([ref.external_id, o.name, phase ? (TACTIC[phase.phase_name] || phase.phase_name) : '']);
  }
  out.sort((a, b) => a[0] < b[0] ? -1 : 1);
  return out;
}
export function loadAttack() { if (cache) return cache; try { cache = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch (e) { cache = null; } return cache; }
export async function refreshAttack() {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(SRC, { signal: ctrl.signal, headers: { 'user-agent': 'cyber-investigation-board/1.0 (+attack refresh)' } });
    if (!r.ok) throw Object.assign(new Error('MITRE download failed: HTTP ' + r.status), { status: 502 });
    const bundle = await r.json();
    const techniques = compactAttack(bundle);
    if (techniques.length < 100) throw Object.assign(new Error('unexpected ATT&CK bundle (' + techniques.length + ' techniques)'), { status: 502 });
    cache = { fetchedAt: new Date().toISOString(), source: SRC, version: (bundle.objects || []).find(o => o.type === 'x-mitre-collection')?.x_mitre_version || '', techniques };
    fs.mkdirSync(path.dirname(FILE()), { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(cache));
    return cache;
  } finally { clearTimeout(t); }
}
