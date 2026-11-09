// Allow-listed enrichment proxy for public endpoints that refuse cross-origin browser requests.
import { config } from './config.js';
import dns from 'node:dns/promises';
import net from 'node:net';

const err = (m, status = 400) => Object.assign(new Error(m), { status });
function allowed(hostname) { return config.proxyAllow.some(h => hostname === h || hostname.endsWith('.' + h)); }
function isPrivate(ip) {
  if (net.isIPv6(ip)) return /^(::1|fc|fd|fe80)/i.test(ip) || ip.startsWith('::ffff:') && isPrivate(ip.slice(7));
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}

export async function proxyFetch(rawUrl, { method = 'GET', body = null, contentType = '' } = {}) {
  let u; try { u = new URL(String(rawUrl || '')); } catch (e) { throw err('bad url'); }
  if (u.protocol !== 'https:') throw err('https only');
  if (!allowed(u.hostname)) throw err('host not on the proxy allow-list: ' + u.hostname, 403);
  if (u.username || u.password) throw err('credentials in url');
  // refuse anything that resolves to a private address (SSRF guard), even on the allow-list
  try { const addrs = await dns.lookup(u.hostname, { all: true }); if (addrs.some(a => isPrivate(a.address))) throw err('refused: private address', 403); } catch (e) { if (e.status) throw e; throw err('cannot resolve host', 502); }
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), config.proxyTimeoutMs);
  try {
    const r = await fetch(u, { method: method === 'POST' ? 'POST' : 'GET', body: method === 'POST' ? body : undefined, redirect: 'follow', signal: ctrl.signal,
      headers: { 'user-agent': 'cyber-investigation-board/1.0 (+enrichment proxy)', 'accept': 'application/json, text/plain, */*', ...(contentType ? { 'content-type': contentType } : {}) } });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > config.proxyMaxBytes) throw err('upstream response too large', 502);
    return { status: r.status, type: r.headers.get('content-type') || 'application/octet-stream', body: buf };
  } catch (e) { if (e.status) throw e; throw err('upstream fetch failed: ' + (e.name === 'AbortError' ? 'timeout' : e.message), 502); }
  finally { clearTimeout(t); }
}
