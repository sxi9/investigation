// AI gateway tests: each provider adapter against a mocked fetch, the fallback chain, the cache and the local engine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const keys = { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', GEMINI_API_KEY: 'g', COHERE_API_KEY: 'c', MISTRAL_API_KEY: 'm', GROQ_API_KEY: 'q', OPENROUTER_API_KEY: 'r', DEEPSEEK_API_KEY: 'd', XAI_API_KEY: 'x', TOGETHER_API_KEY: 't', PERPLEXITY_API_KEY: 'p', FIREWORKS_API_KEY: 'f', AZURE_OPENAI_API_KEY: 'z', AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com', AZURE_OPENAI_DEPLOYMENT: 'dep', OLLAMA_MODEL: 'llama3.1', LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1', AI_CUSTOM_BASE_URL: 'https://llm.example/v1', AI_CUSTOM_API_KEY: 'k', AI_CUSTOM_MODEL: 'mine', AI_CACHE_TTL_S: '600' };
Object.assign(process.env, keys);
const ai = await import('../src/ai/index.js');

const calls = [];
let behaviour = {}; // host -> function(url, init) -> {status, body}
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = async (url, init) => {
    const u = new URL(url); calls.push({ host: u.host, path: u.pathname + u.search, body: JSON.parse(init.body), headers: init.headers });
    const f = behaviour[u.host] || behaviour['*']; const r = f ? f(u, init) : { status: 500, body: { error: 'no mock' } };
    return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.body) };
  };
});
after(() => { globalThis.fetch = realFetch; });
const okOpenAI = (text) => () => ({ status: 200, body: { choices: [{ message: { content: text } }] } });

test('the chain lists every configured provider in the documented order, local last', () => {
  const ids = ai.listProviders().map(p => p.id);
  assert.deepEqual(ids, ['anthropic', 'openai', 'azure', 'gemini', 'cohere', 'mistral', 'groq', 'openrouter', 'deepseek', 'xai', 'together', 'perplexity', 'fireworks', 'ollama', 'lmstudio', 'custom', 'local']);
  assert.match(ai.chainLabel(), /^anthropic:.* → .* → local$/);
});
test('each adapter speaks its provider\'s format', async () => {
  behaviour = {
    'api.anthropic.com': () => ({ status: 200, body: { content: [{ type: 'text', text: 'from anthropic' }] } }),
    'api.openai.com': okOpenAI('from openai'),
    'example.openai.azure.com': okOpenAI('from azure'),
    'generativelanguage.googleapis.com': () => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: 'from gemini' }] } }] } }),
    'api.cohere.com': () => ({ status: 200, body: { message: { content: [{ type: 'text', text: 'from cohere' }] } } }),
    'api.mistral.ai': okOpenAI('from mistral'), 'api.groq.com': okOpenAI('from groq'), 'openrouter.ai': okOpenAI('from openrouter'), 'api.deepseek.com': okOpenAI('from deepseek'),
    'api.x.ai': okOpenAI('from xai'), 'api.together.xyz': okOpenAI('from together'), 'api.perplexity.ai': okOpenAI('from perplexity'), 'api.fireworks.ai': okOpenAI('from fireworks'),
    '127.0.0.1:11434': okOpenAI('from ollama'), '127.0.0.1:1234': okOpenAI('from lmstudio'), 'llm.example': okOpenAI('from custom'),
  };
  const req = { system: 'sys', messages: [{ role: 'user', content: 'hello' }], max_tokens: 100 };
  for (const p of ai.listProviders().filter(p => p.id !== 'local')) {
    const r = await ai.complete({ ...req, messages: [{ role: 'user', content: 'hello ' + p.id }] }, { provider: p.id });
    assert.equal(r.text, 'from ' + p.id, p.id); assert.equal(r.provider, p.id);
  }
  // wire-format spot checks
  const an = calls.find(c => c.host === 'api.anthropic.com'); assert.equal(an.headers['x-api-key'], 'a'); assert.equal(an.body.system, 'sys'); assert.equal(an.body.messages[0].role, 'user');
  const oa = calls.find(c => c.host === 'api.openai.com'); assert.equal(oa.headers.authorization, 'Bearer o'); assert.equal(oa.body.messages[0].role, 'system'); assert.equal(oa.body.model, 'gpt-4.1-mini');
  const ge = calls.find(c => c.host === 'generativelanguage.googleapis.com'); assert.match(ge.path, /gemini-2\.5-flash:generateContent\?key=g$/); assert.equal(ge.body.systemInstruction.parts[0].text, 'sys'); assert.equal(ge.body.contents[0].role, 'user');
  const az = calls.find(c => c.host === 'example.openai.azure.com'); assert.match(az.path, /\/openai\/deployments\/dep\/chat\/completions\?api-version=/); assert.equal(az.headers['api-key'], 'z');
  const co = calls.find(c => c.host === 'api.cohere.com'); assert.equal(co.path, '/v2/chat'); assert.equal(co.body.model, 'command-a-03-2025');
  const ol = calls.find(c => c.host === '127.0.0.1:11434'); assert.equal(ol.headers.authorization, undefined, 'local servers need no key');
  const orr = calls.find(c => c.host === 'openrouter.ai'); assert.equal(orr.headers['x-title'], 'Cyber Investigation Board');
});
test('fallback: a failing provider is skipped, the next one answers, and the failure is reported', async () => {
  behaviour = { 'api.anthropic.com': () => ({ status: 429, body: { error: { message: 'rate limited' } } }), 'api.openai.com': () => ({ status: 401, body: { error: { message: 'bad key' } } }), 'example.openai.azure.com': okOpenAI('azure answers') };
  const r = await ai.complete({ system: 's', messages: [{ role: 'user', content: 'fallback please' }], max_tokens: 50 });
  assert.equal(r.text, 'azure answers'); assert.equal(r.provider, 'azure');
  assert.deepEqual(r.tried.map(t => t.id), ['anthropic', 'openai']); assert.match(r.tried[1].error, /401.*bad key/);
  const st = ai.listProviders().find(p => p.id === 'openai'); assert.equal(st.ok, false); assert.equal(st.failures, 1);
});
test('cooldown: a provider that just failed is skipped without a network call (except on 429)', async () => {
  const n = calls.length;
  const r = await ai.complete({ system: 's', messages: [{ role: 'user', content: 'second request' }], max_tokens: 50 });
  assert.equal(r.provider, 'azure');
  const hosts = calls.slice(n).map(c => c.host); assert.ok(hosts.includes('api.anthropic.com'), '429 is retried'); assert.ok(!hosts.includes('api.openai.com'), '401 provider is cooling down');
  assert.ok(r.tried.some(t => t.id === 'openai' && t.skipped));
});
test('identical prompts are served from the cache', async () => {
  const n = calls.length;
  const r = await ai.complete({ system: 's', messages: [{ role: 'user', content: 'second request' }], max_tokens: 50 });
  assert.equal(r.cached, true); assert.equal(calls.length, n);
});
test('when every provider fails the local engine answers and says so', async () => {
  behaviour = { '*': () => ({ status: 503, body: { error: 'down' } }) };
  const r = await ai.complete({ system: 'You extract entities for an investigator.', messages: [{ role: 'user', content: 'From the text list entities as {"entities": []}\n\nTEXT:\nI met Jane Doe at Berlin Hauptbahnhof.' }], max_tokens: 50 });
  assert.equal(r.provider, 'local'); assert.ok(r.tried.length >= 1); const j = JSON.parse(r.text); assert.ok(j.entities.some(e => e.name === 'Jane Doe'));
});
test('asking for an unknown provider is a 404; disabling removes a provider from the chain', async () => {
  await assert.rejects(ai.complete({ messages: [{ role: 'user', content: 'x' }] }, { provider: 'nope' }), /not configured/);
  ai.setDisabled('anthropic', true); assert.ok(!ai.chainLabel().startsWith('anthropic')); ai.setDisabled('anthropic', false); assert.ok(ai.chainLabel().startsWith('anthropic'));
});
