// Model providers behind one interface: complete({system, messages, max_tokens}) -> text.
// Each adapter maps the board's prompt to the provider's wire format. Keys and models come from the
// environment (see docs/BACKEND.md, "AI providers"); a provider is "configured" when its key is present.
const env = process.env;
const DEF = {
  anthropic: 'claude-sonnet-5-5', openai: 'gpt-4.1-mini', gemini: 'gemini-2.5-flash', groq: 'llama-3.3-70b-versatile',
  openrouter: 'anthropic/claude-sonnet-4', mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', xai: 'grok-3-mini',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', cohere: 'command-a-03-2025', perplexity: 'sonar', fireworks: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  azure: '', ollama: env.OLLAMA_MODEL || 'llama3.1', lmstudio: env.LMSTUDIO_MODEL || 'local-model', custom: env.AI_CUSTOM_MODEL || '',
};
const model = (id) => env[id.toUpperCase() + '_MODEL'] || DEF[id];

async function post(url, headers, body, timeoutMs) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!r.ok) { const msg = (j && (j.error?.message || j.message || j.error)) || text.slice(0, 200); const e = new Error('HTTP ' + r.status + (msg ? ': ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 200) : '')); e.status = r.status; throw e; }
    return j;
  } catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('timeout after ' + timeoutMs + ' ms'), { status: 504 }); throw e; }
  finally { clearTimeout(t); }
}
const sysFirst = (system, messages) => (system ? [{ role: 'system', content: system }] : []).concat(messages);

// ---- OpenAI-compatible chat completions (OpenAI, Groq, OpenRouter, Mistral, DeepSeek, xAI, Together, Perplexity, Fireworks, Ollama, LM Studio, custom)
function openaiCompatible(id, name, base, key, extraHeaders = {}) {
  return {
    id, name, model: () => model(id), configured: () => !!key || /127\.0\.0\.1|localhost/.test(base),
    async complete({ system, messages, max_tokens }, timeoutMs) {
      const j = await post(base.replace(/\/$/, '') + '/chat/completions', { ...(key ? { authorization: 'Bearer ' + key } : {}), ...extraHeaders }, { model: model(id), messages: sysFirst(system, messages), max_tokens, temperature: 0.2 }, timeoutMs);
      const c = j.choices && j.choices[0]; const text = c && c.message && (typeof c.message.content === 'string' ? c.message.content : (c.message.content || []).map(p => p.text || '').join(''));
      if (!text) throw new Error('empty completion'); return text;
    },
  };
}

export function buildProviders() {
  const P = [];
  if (env.ANTHROPIC_API_KEY) P.push({
    id: 'anthropic', name: 'Anthropic', model: () => model('anthropic'), configured: () => true,
    async complete({ system, messages, max_tokens }, timeoutMs) {
      const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, { model: model('anthropic'), max_tokens, system: system || undefined, messages }, timeoutMs);
      const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n'); if (!text) throw new Error('empty completion'); return text;
    },
  });
  if (env.OPENAI_API_KEY) P.push(openaiCompatible('openai', 'OpenAI', env.OPENAI_BASE_URL || 'https://api.openai.com/v1', env.OPENAI_API_KEY));
  if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT) P.push({
    id: 'azure', name: 'Azure OpenAI', model: () => env.AZURE_OPENAI_DEPLOYMENT, configured: () => true,
    async complete({ system, messages, max_tokens }, timeoutMs) {
      const url = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '') + '/openai/deployments/' + encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT) + '/chat/completions?api-version=' + (env.AZURE_OPENAI_API_VERSION || '2024-10-21');
      const j = await post(url, { 'api-key': env.AZURE_OPENAI_API_KEY }, { messages: sysFirst(system, messages), max_tokens, temperature: 0.2 }, timeoutMs);
      const text = j.choices?.[0]?.message?.content; if (!text) throw new Error('empty completion'); return text;
    },
  });
  const gkey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (gkey) P.push({
    id: 'gemini', name: 'Google Gemini', model: () => model('gemini'), configured: () => true,
    async complete({ system, messages, max_tokens }, timeoutMs) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model('gemini')) + ':generateContent?key=' + encodeURIComponent(gkey);
      const body = { contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: max_tokens, temperature: 0.2 } };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      const j = await post(url, {}, body, timeoutMs);
      const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''); if (!text) throw new Error('empty completion'); return text;
    },
  });
  if (env.COHERE_API_KEY) P.push({
    id: 'cohere', name: 'Cohere', model: () => model('cohere'), configured: () => true,
    async complete({ system, messages, max_tokens }, timeoutMs) {
      const j = await post('https://api.cohere.com/v2/chat', { authorization: 'Bearer ' + env.COHERE_API_KEY }, { model: model('cohere'), messages: sysFirst(system, messages), max_tokens, temperature: 0.2 }, timeoutMs);
      const text = (j.message?.content || []).map(c => c.text || '').join(''); if (!text) throw new Error('empty completion'); return text;
    },
  });
  if (env.MISTRAL_API_KEY) P.push(openaiCompatible('mistral', 'Mistral', 'https://api.mistral.ai/v1', env.MISTRAL_API_KEY));
  if (env.GROQ_API_KEY) P.push(openaiCompatible('groq', 'Groq', 'https://api.groq.com/openai/v1', env.GROQ_API_KEY));
  if (env.OPENROUTER_API_KEY) P.push(openaiCompatible('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', env.OPENROUTER_API_KEY, { 'http-referer': env.OPENROUTER_SITE || 'https://github.com/sxi9/investigation', 'x-title': 'Cyber Investigation Board' }));
  if (env.DEEPSEEK_API_KEY) P.push(openaiCompatible('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', env.DEEPSEEK_API_KEY));
  if (env.XAI_API_KEY) P.push(openaiCompatible('xai', 'xAI', 'https://api.x.ai/v1', env.XAI_API_KEY));
  if (env.TOGETHER_API_KEY) P.push(openaiCompatible('together', 'Together', 'https://api.together.xyz/v1', env.TOGETHER_API_KEY));
  if (env.PERPLEXITY_API_KEY) P.push(openaiCompatible('perplexity', 'Perplexity', 'https://api.perplexity.ai', env.PERPLEXITY_API_KEY));
  if (env.FIREWORKS_API_KEY) P.push(openaiCompatible('fireworks', 'Fireworks', 'https://api.fireworks.ai/inference/v1', env.FIREWORKS_API_KEY));
  if (env.OLLAMA_BASE_URL || env.OLLAMA_MODEL) P.push(openaiCompatible('ollama', 'Ollama (local)', (env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434') + '/v1', ''));
  if (env.LMSTUDIO_BASE_URL) P.push(openaiCompatible('lmstudio', 'LM Studio (local)', env.LMSTUDIO_BASE_URL, ''));
  if (env.AI_CUSTOM_BASE_URL) P.push(openaiCompatible('custom', env.AI_CUSTOM_NAME || 'Custom (OpenAI-compatible)', env.AI_CUSTOM_BASE_URL, env.AI_CUSTOM_API_KEY || ''));
  // explicit order wins; otherwise the order above (Anthropic first)
  const order = (env.AI_PROVIDERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (order.length) { const by = Object.fromEntries(P.map(p => [p.id, p])); return order.map(id => by[id]).filter(Boolean).concat(P.filter(p => !order.includes(p.id) && env.AI_PROVIDERS_STRICT !== '1')); }
  return P;
}
export const KNOWN = ['anthropic', 'openai', 'azure', 'gemini', 'cohere', 'mistral', 'groq', 'openrouter', 'deepseek', 'xai', 'together', 'perplexity', 'fireworks', 'ollama', 'lmstudio', 'custom'];
