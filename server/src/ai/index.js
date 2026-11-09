// AI gateway: Anthropic Messages API when a key is configured, the local engine otherwise.
import { config } from '../config.js';
import { localComplete } from './local.js';

export async function complete({ system, messages, max_tokens }) {
  const msgs = (Array.isArray(messages) ? messages : []).filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')).slice(0, 20).map(m => ({ role: m.role, content: m.content.slice(0, 60000) }));
  if (!config.anthropicKey) return { text: localComplete({ system, messages: msgs }), engine: 'local' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.anthropicModel, max_tokens: Math.min(Number(max_tokens) || 1200, 4000), system: String(system || '').slice(0, 20000), messages: msgs }),
    });
    if (!r.ok) { const txt = await r.text().catch(() => ''); throw Object.assign(new Error('Model gateway error ' + r.status + (txt ? ': ' + txt.slice(0, 200) : '')), { status: 502 }); }
    const j = await r.json();
    return { text: (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n'), engine: config.anthropicModel };
  } finally { clearTimeout(t); }
}
