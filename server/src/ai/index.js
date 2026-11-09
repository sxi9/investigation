// AI gateway: tries the configured providers in order, falls back to the next on failure, caches identical
// prompts briefly, and always has the built-in rule-based engine as the last resort.
import crypto from 'node:crypto';
import { buildProviders } from './providers.js';
import { localComplete } from './local.js';

const TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 60000);
const CACHE_TTL = Number(process.env.AI_CACHE_TTL_S || 600) * 1000;
const RETRY_AFTER_FAIL = Number(process.env.AI_COOLDOWN_S || 120) * 1000; // skip a provider for a while after it failed
let providers = buildProviders();
const status = {}; // id -> { ok, error, latencyMs, at, calls, failures }
const cache = new Map(); // key -> { at, value }
const disabled = new Set((process.env.AI_DISABLED || '').split(',').map(s => s.trim()).filter(Boolean));

export function reloadProviders() { providers = buildProviders(); return providers; }
export function listProviders() {
  return providers.map(p => ({ id: p.id, name: p.name, model: p.model(), configured: p.configured(), disabled: disabled.has(p.id), ...(status[p.id] || {}) }))
    .concat([{ id: 'local', name: 'Built-in rule engine', model: 'rules', configured: true, disabled: false, ok: true }]);
}
export function setDisabled(id, off) { if (off) disabled.add(id); else disabled.delete(id); }
export const chainLabel = () => providers.filter(p => !disabled.has(p.id)).map(p => p.id + ':' + p.model()).concat('local').join(' → ');

function sanitize({ system, messages, max_tokens }) {
  const msgs = (Array.isArray(messages) ? messages : []).filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')).slice(0, 20).map(m => ({ role: m.role, content: m.content.slice(0, 60000) }));
  if (!msgs.length) msgs.push({ role: 'user', content: '' });
  return { system: String(system || '').slice(0, 20000), messages: msgs, max_tokens: Math.min(Math.max(Number(max_tokens) || 1200, 64), 4000) };
}

export async function complete(input, opts = {}) {
  const req = sanitize(input);
  const key = crypto.createHash('sha256').update(JSON.stringify([req, opts.provider || ''])).digest('hex');
  const hit = cache.get(key); if (hit && Date.now() - hit.at < CACHE_TTL) return { ...hit.value, cached: true };
  const tried = [];
  const chain = opts.provider ? providers.filter(p => p.id === opts.provider) : providers.filter(p => !disabled.has(p.id));
  for (const p of chain) {
    const st = status[p.id] || (status[p.id] = { calls: 0, failures: 0 });
    if (!opts.provider && st.ok === false && Date.now() - st.at < RETRY_AFTER_FAIL && st.lastErrorStatus !== 429) { tried.push({ id: p.id, skipped: 'cooling down after: ' + st.error }); continue; }
    const t0 = Date.now(); st.calls++;
    try {
      const text = await p.complete(req, opts.timeoutMs || TIMEOUT);
      Object.assign(st, { ok: true, error: null, latencyMs: Date.now() - t0, at: Date.now() });
      const value = { text, engine: p.id + ':' + p.model(), provider: p.id, tried };
      cache.set(key, { at: Date.now(), value }); if (cache.size > 500) cache.delete(cache.keys().next().value);
      return value;
    } catch (e) {
      st.failures++; Object.assign(st, { ok: false, error: String(e.message || e).slice(0, 200), lastErrorStatus: e.status || 0, latencyMs: Date.now() - t0, at: Date.now() });
      tried.push({ id: p.id, error: st.error });
      if (opts.provider) throw Object.assign(new Error(p.name + ': ' + st.error), { status: 502 });
    }
  }
  if (opts.provider && opts.provider !== 'local') throw Object.assign(new Error('Provider not configured: ' + opts.provider), { status: 404 });
  return { text: localComplete(req), engine: 'local', provider: 'local', tried };
}
