// Research tests: source gathering with a mocked fetch, page reading, rule-based extraction, prompt and answer parsing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
const dnsMod = await import('node:dns/promises');
const R = await import('../src/research.js');

const realFetch = globalThis.fetch; const realLookup = dnsMod.default.lookup;
const page = (title, body) => `<html><head><title>${title}</title><script>junk()</script></head><body><nav>menu</nav><article><h1>${title}</h1><p>${body}</p></article><footer>f</footer></body></html>`;
before(() => {
  dnsMod.default.lookup = async (host) => host === 'intranet.local' ? [{ address: '10.0.0.5', family: 4 }] : [{ address: '93.184.216.34', family: 4 }];
  globalThis.fetch = async (url) => {
    const u = new URL(url); let body = '', type = 'application/json';
    if (u.host === 'en.wikipedia.org' && u.pathname === '/w/api.php') body = JSON.stringify({ query: { search: [{ title: 'SafePay ransomware', snippet: 'A <span>ransomware</span> group' }] } });
    else if (u.host === 'en.wikipedia.org' && u.pathname.startsWith('/api/rest_v1/page/summary/')) body = JSON.stringify({ extract: 'SafePay is a ransomware operation active since 2024 that uses the .SafePay extension. CVE-2024-40711 was exploited.', timestamp: '2026-10-21T00:00:00Z' });
    else if (u.host === 'api.gdeltproject.org') body = JSON.stringify({ articles: [{ title: 'Joint advisory on SafePay', url: 'https://news.example/safepay', seendate: '20261020T120000Z', domain: 'news.example', language: 'English' }] });
    else if (u.host === 'hn.algolia.com') body = JSON.stringify({ hits: [{ title: 'SafePay hits 600 victims', url: 'https://blog.example/post', points: 120, num_comments: 40, objectID: '1', created_at: '2026-10-22T10:00:00Z' }] });
    else if (u.host === 'services.nvd.nist.gov') body = JSON.stringify({ vulnerabilities: [{ cve: { id: 'CVE-2024-40711', published: '2024-09-07T00:00:00', descriptions: [{ lang: 'en', value: 'Deserialization in Veeam Backup & Replication allows RCE.' }], metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8, baseSeverity: 'CRITICAL' } }] }, cisaExploitAdd: '2024-10-17' } }] });
    else if (u.host === 'news.example') { type = 'text/html'; body = page('Joint advisory on SafePay', 'The FBI and CISA say SafePay actors used 88.119.167[.]239 for command and control and tool T1486. John Carter, a spokesman for Acme Bank Inc, commented from Vilnius.'); }
    else if (u.host === 'blog.example') { type = 'text/html'; body = page('SafePay hits 600 victims', 'Researchers count 600 victims. Hash 921df888aaabcd828a3723f4c9f5fe8b8379c6b7067d16b2ea10152300417eae was seen.'); }
    else return { ok: false, status: 404, headers: new Headers(), arrayBuffer: async () => Buffer.from('nope'), url };
    return { ok: true, status: 200, headers: new Headers({ 'content-type': type }), arrayBuffer: async () => Buffer.from(body), url };
  };
});
after(() => { globalThis.fetch = realFetch; dnsMod.default.lookup = realLookup; });

test('readable(): strips chrome and keeps the article', () => {
  const r = R.readable(page('T', 'Body text here.')); assert.equal(r.title, 'T'); assert.match(r.text, /Body text here/); assert.ok(!/menu|junk/.test(r.text));
});
test('gather(): free sources are merged, de-duplicated and pages are read', async () => {
  const g = await R.gather({ query: 'SafePay ransomware CVE-2024-40711', sources: ['wikipedia', 'gdelt', 'hackernews', 'nvd'], urls: [] });
  const by = Object.fromEntries(g.sources.map(s => [s.provider, s]));
  assert.ok(by.wikipedia && by.gdelt && by.hackernews && by.nvd, Object.keys(by).join(','));
  assert.match(by.gdelt.text, /88\.119\.167/, 'news page was read'); assert.equal(by.gdelt.date, '2026-10-20'); assert.equal(by.nvd.grade, 'A'); assert.equal(by.nvd.kev, true);
  assert.deepEqual(g.errors, []);
});
test('gather(): pasted URLs are read, private hosts are refused', async () => {
  const g = await R.gather({ query: 'x', sources: [], urls: ['https://blog.example/post', 'https://intranet.local/secret'] });
  const ok = g.sources.find(s => s.url.includes('blog.example')); assert.match(ok.text, /600 victims/);
  const bad = g.sources.find(s => s.url.includes('intranet')); assert.match(bad.fetchError, /private address/);
});
test('localExtract(): indicators, entities, events, techniques become attributed cards with threads', async () => {
  const g = await R.gather({ query: 'SafePay ransomware CVE-2024-40711', sources: ['wikipedia', 'gdelt', 'hackernews', 'nvd'], urls: [] });
  const x = R.localExtract({ query: 'SafePay', sources: g.sources, existing: ['921df888aaabcd828a3723f4c9f5fe8b8379c6b7067d16b2ea10152300417eae'] });
  const kinds = x.cards.map(c => c.type + ':' + (c.value || c.title));
  assert.ok(kinds.some(k => k === 'indicator:88.119.167.239'), kinds.join(' | '));
  assert.ok(kinds.some(k => k === 'indicator:CVE-2024-40711'), kinds.join(' | '));
  assert.ok(!kinds.some(k => k.includes('921df888')), 'values already on the board are skipped');
  assert.ok(kinds.some(k => k === 'person:John Carter'), kinds.join(' | '));
  assert.ok(kinds.some(k => k === 'ttp:T1486'), kinds.join(' | '));
  assert.ok(kinds.some(k => k.startsWith('event:')), kinds.join(' | '));
  for (const c of x.cards) { assert.ok(c.source, 'every card has a source'); assert.ok(c.collected); }
  assert.ok(x.threads.length > 0); assert.ok(x.threads.every(t => x.cards[t.from] && x.cards[t.to]));
  assert.match(x.summary, /Rule-based/);
});
test('research(): end to end without a model falls back to the rule engine', async () => {
  const r = await R.research({ query: 'SafePay ransomware', sources: ['wikipedia', 'gdelt'], existing: [] });
  assert.equal(r.engine, 'local'); assert.ok(r.cards.length > 3); assert.ok(r.sources.every(s => s.url));
  await assert.rejects(R.research({ query: '' }), /query or urls required/);
});
test('buildPrompt() and parseAnswer(): the manual round-trip', () => {
  const g = { sources: [{ provider: 'gdelt', title: 'A', url: 'https://news.example/a', text: 'txt', grade: 'C', date: '2026-01-01' }] };
  const p = R.buildPrompt({ query: 'Q', sources: g.sources, existing: ['x'], context: 'ctx' });
  assert.match(p.prompt, /RESEARCH QUERY: Q/); assert.match(p.prompt, /\[0\] A/); assert.match(p.prompt, /ALREADY ON THE BOARD/); assert.match(p.system, /Never invent/);
  const ans = 'Sure! ```json\n{"summary":"s","sources":[{"title":"B","url":"https://b.example/x"}],"cards":[{"type":"indicator","kind":"domain","value":"evil.example","source_index":1,"confidence":"high"},{"type":"person","title":"Jane Doe","source_index":0},{"type":"bogus","title":"?"},{"type":"indicator","kind":"ip"}],"threads":[{"from":1,"to":0,"rel":"controls","why":"w"},{"from":0,"to":9}]}\n```';
  const r = R.parseAnswer(ans, g.sources);
  assert.equal(r.cards.length, 2, 'unknown type without a body and an empty indicator are dropped'); assert.equal(r.cards[0].url, 'https://b.example/x'); assert.equal(r.cards[0].source, 'B · b.example');
  assert.equal(r.threads.length, 1); assert.equal(r.threads[0].rel, 'controls');
  assert.throws(() => R.parseAnswer('no json here', []), /No JSON/);
});
