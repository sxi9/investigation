// AI case research: gather public sources for a query, read them, and turn them into board cards.
// Sources without keys: Wikipedia, GDELT news, Hacker News, NVD + CISA KEV (for CVEs), pasted URLs.
// With keys: Tavily, Brave Search, Serper (Google). Extraction: the AI gateway, or the rule engine.
import dns from 'node:dns/promises';
import net from 'node:net';
import { complete } from './ai/index.js';
import { extractEntities, detectLanguage } from './ai/local.js';

const env = process.env;
const TIMEOUT = Number(env.RESEARCH_FETCH_TIMEOUT_MS || 15000);
const MAX_TEXT = 6000, MAX_SOURCES = 12, MAX_READ = 6;
const err = (m, status = 400) => Object.assign(new Error(m), { status });
const TYPES = new Set(['note', 'link', 'person', 'indicator', 'doc', 'event', 'location', 'ttp', 'tx', 'target']);
const KINDS = new Set(['domain', 'ip', 'url', 'hash', 'handle', 'email', 'wallet', 'cve', 'phone']);
const RELS = new Set(['linked', 'suspected', 'alias', 'controls', 'resolves', 'located']);

function isPrivate(ip) {
  if (net.isIPv6(ip)) return /^(::1|fc|fd|fe80)/i.test(ip) || (ip.startsWith('::ffff:') && isPrivate(ip.slice(7)));
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
async function guard(u) {
  if (u.protocol !== 'https:') throw err('https only');
  if (u.username || u.password) throw err('credentials in url');
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => { throw err('cannot resolve ' + u.hostname, 502); });
  if (addrs.some(a => isPrivate(a.address))) throw err('refused: private address', 403);
}
async function get(url, headers = {}, timeoutMs = TIMEOUT, opts = {}) {
  const u = new URL(url); await guard(u);
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { method: opts.method || 'GET', body: opts.body, signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'cyber-investigation-board/1.0 (+research)', accept: 'application/json, text/html;q=0.9, text/plain;q=0.8, */*;q=0.1', ...headers } });
    const type = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 1.5e6) throw err('too large', 502);
    if (!r.ok) throw err('HTTP ' + r.status, 502);
    return { type, text: buf.toString('utf8'), url: r.url || url };
  } finally { clearTimeout(t); }
}
const json = async (url, headers, timeoutMs, opts) => { const r = await get(url, headers, timeoutMs, opts); try { return JSON.parse(r.text); } catch (e) { throw err('bad json from ' + new URL(url).hostname, 502); } };
const decode = s => String(s || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n));

// HTML → readable text: drop scripts, styles, nav, ads; prefer <article>/<main>.
export function readable(html) {
  let h = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|svg|iframe|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
  const title = decode((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).trim().slice(0, 200);
  const pick = (re) => { const m = h.match(re); return m ? m[1] : null; };
  const body = pick(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) || pick(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) || pick(/<body[\s\S]*?>([\s\S]*?)<\/body>/i) || h;
  const text = decode(body.replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const date = (h.match(/datePublished"?\s*[:=]\s*"?(\d{4}-\d{2}-\d{2})/) || h.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})/) || [, ''])[1];
  return { title, text: text.slice(0, MAX_TEXT), date };
}

// ---- source adapters: each returns [{ provider, title, url, snippet, date, text?, grade }]
const S = {
  async wikipedia(q) {
    const r = await json('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=' + encodeURIComponent(q));
    const hits = (r.query && r.query.search) || [];
    return Promise.all(hits.map(async h => { const s = await json('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(h.title.replace(/ /g, '_'))).catch(() => null); return { provider: 'wikipedia', title: h.title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(h.title.replace(/ /g, '_')), snippet: decode(h.snippet.replace(/<[^>]+>/g, '')), date: s && s.timestamp ? s.timestamp.slice(0, 10) : '', text: s ? s.extract : '', grade: 'B' }; }));
  },
  async gdelt(q) {
    const r = await json('https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&maxrecords=8&format=json&sort=datedesc&query=' + encodeURIComponent('"' + q.replace(/"/g, '') + '"'));
    return ((r && r.articles) || []).map(a => ({ provider: 'gdelt', title: a.title, url: a.url, snippet: a.domain + (a.language && a.language !== 'English' ? ' · ' + a.language : ''), date: a.seendate ? a.seendate.slice(0, 4) + '-' + a.seendate.slice(4, 6) + '-' + a.seendate.slice(6, 8) : '', grade: 'C' }));
  },
  async hn(q) {
    const r = await json('https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=5&query=' + encodeURIComponent(q));
    return (r.hits || []).filter(h => h.url).map(h => ({ provider: 'hackernews', title: h.title, url: h.url, snippet: h.points + ' points · ' + h.num_comments + ' comments · https://news.ycombinator.com/item?id=' + h.objectID, date: (h.created_at || '').slice(0, 10), grade: 'C' }));
  },
  async nvd(q) {
    const cves = [...new Set((q.match(/CVE-\d{4}-\d{4,7}/gi) || []).map(x => x.toUpperCase()))].slice(0, 5); if (!cves.length) return [];
    const out = [];
    for (const id of cves) {
      const r = await json('https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=' + id).catch(() => null); const v = r && r.vulnerabilities && r.vulnerabilities[0] && r.vulnerabilities[0].cve; if (!v) continue;
      const d = (v.descriptions || []).find(x => x.lang === 'en'); const m = v.metrics && (v.metrics.cvssMetricV31 || v.metrics.cvssMetricV30 || v.metrics.cvssMetricV2); const score = m && m[0] && m[0].cvssData ? m[0].cvssData.baseScore + ' ' + m[0].cvssData.baseSeverity : '';
      out.push({ provider: 'nvd', title: id + (score ? ' · CVSS ' + score : ''), url: 'https://nvd.nist.gov/vuln/detail/' + id, snippet: d ? d.value.slice(0, 300) : '', date: (v.published || '').slice(0, 10), text: (d ? d.value : '') + (v.cisaExploitAdd ? '\nIn CISA KEV since ' + v.cisaExploitAdd + (v.cisaRequiredAction ? ': ' + v.cisaRequiredAction : '') : ''), grade: 'A', cve: id, kev: !!v.cisaExploitAdd });
    }
    return out;
  },
  async tavily(q) { if (!env.TAVILY_API_KEY) return []; const r = await json('https://api.tavily.com/search', { 'content-type': 'application/json' }, TIMEOUT, { method: 'POST', body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: q, max_results: 8, search_depth: 'basic' }) }); return (r.results || []).map(x => ({ provider: 'tavily', title: x.title, url: x.url, snippet: (x.content || '').slice(0, 300), date: (x.published_date || '').slice(0, 10), text: x.content, grade: 'C' })); },
  async brave(q) { if (!env.BRAVE_SEARCH_API_KEY) return []; const r = await json('https://api.search.brave.com/res/v1/web/search?count=8&q=' + encodeURIComponent(q), { 'x-subscription-token': env.BRAVE_SEARCH_API_KEY }); return (((r.web || {}).results) || []).map(x => ({ provider: 'brave', title: x.title, url: x.url, snippet: decode((x.description || '').replace(/<[^>]+>/g, '')), date: (x.page_age || x.age || '').slice(0, 10), grade: 'C' })); },
  async serper(q) { if (!env.SERPER_API_KEY) return []; const r = await json('https://google.serper.dev/search', { 'x-api-key': env.SERPER_API_KEY, 'content-type': 'application/json' }, TIMEOUT, { method: 'POST', body: JSON.stringify({ q, num: 8 }) }); return (r.organic || []).map(x => ({ provider: 'serper', title: x.title, url: x.link, snippet: x.snippet || '', date: (x.date || '').slice(0, 10), grade: 'C' })); },
};
export const availableSources = () => ({ free: ['wikipedia', 'gdelt', 'hackernews', 'nvd', 'urls'], keyed: { tavily: !!env.TAVILY_API_KEY, brave: !!env.BRAVE_SEARCH_API_KEY, serper: !!env.SERPER_API_KEY } });

async function readPage(src) {
  try { const r = await get(src.url); if (!/html|text/.test(r.type)) return src; const rd = readable(r.text); return { ...src, title: src.title || rd.title, text: rd.text || src.text || '', date: src.date || rd.date || '' }; }
  catch (e) { return { ...src, fetchError: e.message }; }
}

export async function gather({ query, sources, urls }) {
  const want = new Set(sources && sources.length ? sources : ['wikipedia', 'gdelt', 'hackernews', 'nvd', 'tavily', 'brave', 'serper']);
  const jobs = [];
  for (const [name, fn] of Object.entries(S)) { const key = name === 'hn' ? 'hackernews' : name; if (want.has(key)) jobs.push(fn(query).then(list => list.map(x => ({ ...x, provider: key })), e => [{ provider: key, error: e.message }])); }
  for (const u of (urls || []).slice(0, MAX_READ)) jobs.push(Promise.resolve([{ provider: 'url', title: '', url: u, snippet: '', date: '', grade: 'C', pasted: true }]));
  const results = (await Promise.all(jobs)).flat();
  const errors = results.filter(r => r.error).map(r => r.provider + ': ' + r.error);
  const seen = new Set(); const list = [];
  for (const r of results) { if (r.error || !r.url) continue; const k = r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); if (seen.has(k)) continue; seen.add(k); list.push(r); if (list.length >= MAX_SOURCES) break; }
  // read the pages that have no text yet (pasted URLs first, then news)
  const toRead = list.filter(s => !s.text).slice(0, MAX_READ);
  const read = await Promise.all(toRead.map(readPage));
  for (const r of read) { const i = list.findIndex(s => s.url === r.url); if (i >= 0) list[i] = r; }
  return { sources: list, errors };
}

// ---- extraction
const today = () => new Date().toISOString().slice(0, 10);
function cleanCard(c, sources) {
  if (!c || typeof c !== 'object') return null;
  const type = TYPES.has(c.type) ? c.type : 'note';
  const si = Number.isInteger(c.source_index) ? c.source_index : (Number.isInteger(c.source) ? c.source : -1);
  const src = sources[si];
  const out = { type, title: String(c.title || '').slice(0, 140), body: String(c.body || '').slice(0, 1200), tags: String(c.tags || '').slice(0, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(c.date || '') ? c.date : '', confidence: ['high', 'medium', 'low'].includes(c.confidence) ? c.confidence : 'medium', source: src ? (src.title || src.provider) + ' · ' + new URL(src.url).hostname : String(c.source_name || 'AI research').slice(0, 140), url: src ? src.url : (type === 'link' && /^https?:\/\//.test(c.url || '') ? c.url : ''), collected: today(), srcGrade: src ? src.grade : 'C', infoGrade: c.confidence === 'high' ? '2' : c.confidence === 'low' ? '4' : '3', sourceIndex: si };
  if (type === 'indicator') { out.kind = KINDS.has(c.kind) ? c.kind : 'domain'; out.value = String(c.value || '').trim().slice(0, 300); if (!out.value) return null; if (out.kind === 'cve') out.value = out.value.toUpperCase(); }
  if (type === 'ttp') { const m = String(c.value || c.title || '').match(/T\d{4}(\.\d{3})?/i); out.value = m ? m[0].toUpperCase() : ''; out.kind = String(c.kind || '').slice(0, 40); }
  if (type === 'link' && !out.url && src) out.url = src.url;
  if (type === 'target') { out.sector = String(c.sector || '').slice(0, 80); out.region = String(c.region || '').slice(0, 80); out.impact = String(c.impact || '').slice(0, 200); }
  if (type === 'tx') { out.chain = String(c.chain || '').slice(0, 30); out.amount = String(c.amount || '').slice(0, 60); out.txFrom = String(c.from || c.txFrom || '').slice(0, 120); out.txTo = String(c.to || c.txTo || '').slice(0, 120); }
  if (!out.title && type !== 'note' && type !== 'indicator') return null;
  if (type === 'note' && !out.body) return null;
  return out;
}

export function localExtract({ query, sources, existing }) {
  const cards = [], threads = [];
  const have = new Set((existing || []).map(x => String(x).toLowerCase()));
  const pushCard = (c) => { const k = (c.type + '|' + (c.value || c.title)).toLowerCase(); if (have.has(k) || have.has(String(c.value || c.title).toLowerCase())) return -1; have.add(k); cards.push(c); return cards.length - 1; };
  sources.forEach((s, i) => {
    const text = (s.title || '') + '\n' + (s.snippet || '') + '\n' + (s.text || '');
    const docIdx = pushCard(cleanCard({ type: s.provider === 'nvd' ? 'indicator' : 'link', kind: 'cve', value: s.cve, title: s.title || s.url, body: (s.text || s.snippet || '').slice(0, 600), date: s.date, tags: 'source, ' + s.provider, source_index: i, confidence: s.grade === 'A' ? 'high' : 'medium' }, sources));
    if (s.provider === 'nvd' && docIdx >= 0 && s.kev) cards[docIdx].tags += ', kev';
    // indicators
    const ioc = [];
    for (const [kind, re] of [['ip', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\[\.\]|\.)){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g], ['hash', /\b[a-f0-9]{64}\b|\b[a-f0-9]{40}\b|\b[a-f0-9]{32}\b/gi], ['cve', /\bCVE-\d{4}-\d{4,7}\b/gi], ['email', /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi], ['domain', /\b(?:[a-z0-9-]{1,63}\[\.\])+[a-z]{2,24}\b/gi]]) for (const v of text.match(re) || []) ioc.push([kind, v]);
    for (const [kind, v] of ioc.slice(0, 12)) { const j = pushCard(cleanCard({ type: 'indicator', kind, value: v.replace(/\[\.\]/g, '.'), title: '', body: 'Mentioned in: ' + (s.title || s.url), tags: 'research', source_index: i, confidence: 'medium' }, sources)); if (j >= 0 && docIdx >= 0) threads.push({ from: j, to: docIdx, rel: 'linked', why: 'mentioned in the source' }); }
    // entities
    for (const e of extractEntities(text).slice(0, 10)) {
      const type = e.type === 'person' ? 'person' : e.type === 'org' ? 'target' : e.type === 'place' ? 'location' : null; if (!type) continue;
      if (type === 'person' && !/^[A-Z][\p{L}'’-]+ [A-Z][\p{L}'’-]+$/u.test(e.name)) continue; // first + last name only
      if (type === 'target' && e.note === 'capitalised phrase') continue;
      const j = pushCard(cleanCard({ type, title: e.name, body: e.note + ' — ' + (s.title || s.url), tags: 'research, ' + e.type, source_index: i, confidence: 'low' }, sources));
      if (j >= 0 && docIdx >= 0) threads.push({ from: j, to: docIdx, rel: type === 'person' ? 'suspected' : 'linked', why: 'named in the source' });
    }
    // dated event from the source itself
    if (s.date && s.title) pushCard(cleanCard({ type: 'event', title: s.title.slice(0, 100), body: (s.snippet || '').slice(0, 300), date: s.date, tags: 'reporting, ' + s.provider, source_index: i, confidence: 'medium' }, sources));
    // techniques
    for (const t of new Set((text.match(/\bT1\d{3}(?:\.\d{3})?\b/g) || []).slice(0, 6))) pushCard(cleanCard({ type: 'ttp', value: t, title: t, body: 'Referenced in ' + (s.title || s.url), source_index: i, confidence: 'medium' }, sources));
  });
  const summary = 'Rule-based research (no language model configured): ' + sources.length + ' sources gathered for "' + query + '"; ' + cards.length + ' cards proposed from the indicators, named entities, dates and techniques found in them. Review each card against its source before pinning.';
  return { summary, cards: cards.filter(Boolean).slice(0, 80), threads, engine: 'local' };
}

export function buildPrompt({ query, sources, existing, context }) {
  const corpus = sources.map((s, i) => `[${i}] ${s.title || s.url}\nURL: ${s.url}\nDATE: ${s.date || 'unknown'} · PROVIDER: ${s.provider}\n${(s.text || s.snippet || '').slice(0, Math.floor(14000 / Math.max(1, sources.length)))}`).join('\n\n');
  const system = 'You are a senior investigations analyst building an evidence board. You only state what the sources say and you attribute every card to a source index. Never invent indicators, names, dates or amounts. Answer with one JSON object and nothing else.';
  const prompt = `RESEARCH QUERY: ${query}\n${context ? 'CASE CONTEXT: ' + String(context).slice(0, 1500) + '\n' : ''}${existing && existing.length ? 'ALREADY ON THE BOARD (do not repeat): ' + existing.slice(0, 80).join(' | ') + '\n' : ''}\nSOURCES:\n${corpus || '(none gathered — research the query yourself and cite each source as a new index with its URL in a "sources" array)'}\n\nReturn JSON: {"summary": "<=120 words: what happened, who, when, how, and what is uncertain", "sources": [{"title": "...", "url": "https://..."}] (only if you add sources), "cards": [{"type": "event|person|target|location|indicator|ttp|doc|link|note|tx", "title": "...", "body": "<=60 words, facts only", "date": "YYYY-MM-DD or empty", "kind": "domain|ip|url|hash|email|wallet|cve|handle|phone (indicators only)", "value": "indicator value or ATT&CK id", "tags": "comma list", "source_index": <index>, "confidence": "high|medium|low", "sector": "", "region": "", "impact": ""}], "threads": [{"from": <card index>, "to": <card index>, "rel": "linked|suspected|alias|controls|resolves|located", "why": "<=15 words"}]}\nRules: at most 30 cards; one event card per dated development; person cards for named individuals; target cards for victim organisations; indicator cards only for values that literally appear in a source; a doc card summarising each important source is welcome.`;
  return { system, prompt };
}
// Validate a model answer (from the gateway or pasted by the analyst) into cards and threads.
export function parseAnswer(text, sources) {
  const a = String(text || '').indexOf('{'), b = String(text || '').lastIndexOf('}'); if (a < 0 || b < 0) throw err('No JSON object found in the answer');
  let out; try { out = JSON.parse(String(text).slice(a, b + 1)); } catch (e) { throw err('The answer is not valid JSON: ' + e.message); }
  const srcs = [...(sources || [])];
  for (const s of Array.isArray(out.sources) ? out.sources : []) if (s && /^https?:\/\//.test(s.url || '')) srcs.push({ provider: 'model', title: String(s.title || '').slice(0, 200), url: s.url, grade: 'C', date: '' });
  const cards = (Array.isArray(out.cards) ? out.cards : []).map(c => cleanCard(c, srcs)).filter(Boolean).slice(0, 60);
  const threads = (Array.isArray(out.threads) ? out.threads : []).filter(t => Number.isInteger(t.from) && Number.isInteger(t.to) && cards[t.from] && cards[t.to] && t.from !== t.to).map(t => ({ from: t.from, to: t.to, rel: RELS.has(t.rel) ? t.rel : 'linked', why: String(t.why || '').slice(0, 140) })).slice(0, 80);
  return { summary: String(out.summary || '').slice(0, 1500), cards, threads, sources: srcs.map(s => ({ provider: s.provider, title: s.title, url: s.url, date: s.date, grade: s.grade })) };
}

export async function extract({ query, sources, existing, context }) {
  if (!sources.length) return { summary: 'No sources could be gathered for that query.', cards: [], threads: [], engine: 'none' };
  const { system, prompt } = buildPrompt({ query, sources, existing, context });
  let r;
  try { r = await complete({ system, messages: [{ role: 'user', content: prompt }], max_tokens: 4000 }, { timeoutMs: 90000 }); }
  catch (e) { const l = localExtract({ query, sources, existing }); l.summary = 'Model extraction failed (' + e.message + '); ' + l.summary; return l; }
  if (r.provider === 'local') return localExtract({ query, sources, existing });
  try { return { ...parseAnswer(r.text, sources), engine: r.engine }; }
  catch (e) { const l = localExtract({ query, sources, existing }); l.summary = 'The model answer could not be parsed (' + e.message + '); ' + l.summary; return l; }
}

export async function research({ query, sources, urls, existing, context }) {
  query = String(query || '').trim(); if (!query && !(urls && urls.length)) throw err('query or urls required');
  if (query.length > 300) throw err('query too long');
  const cleanUrls = (Array.isArray(urls) ? urls : []).map(u => String(u).trim()).filter(u => /^https:\/\/\S+$/i.test(u)).slice(0, MAX_READ);
  const g = await gather({ query: query || cleanUrls[0], sources, urls: cleanUrls });
  const x = await extract({ query: query || cleanUrls[0], sources: g.sources, existing, context });
  return { query, sources: g.sources.map(s => ({ provider: s.provider, title: s.title, url: s.url, snippet: s.snippet, date: s.date, grade: s.grade, read: !!s.text, error: s.fetchError })), errors: g.errors, ...x, language: detectLanguage(g.sources.map(s => s.text || s.snippet).join(' ')) };
}
