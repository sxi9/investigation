// Server configuration from the environment (see docs/BACKEND.md).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
export const config = {
  port: Number(env.PORT || 8787),
  host: env.HOST || '127.0.0.1',
  dataDir: path.resolve(env.CIB_DATA_DIR || path.join(here, '..', 'data')),
  distDir: path.resolve(env.CIB_DIST_DIR || path.join(here, '..', '..', 'dist')),
  // Set CIB_SECURE_COOKIES=1 behind HTTPS (the default when NODE_ENV=production).
  secureCookies: env.CIB_SECURE_COOKIES ? env.CIB_SECURE_COOKIES === '1' : env.NODE_ENV === 'production',
  sessionLifeMs: Number(env.CIB_SESSION_HOURS || 12) * 3600e3,
  sessionIdleMs: Number(env.CIB_IDLE_MINUTES || 15) * 60e3,
  loginWindowMs: 15 * 60e3,
  loginMaxFailures: Number(env.CIB_LOCKOUT_FAILURES || 10),
  lockoutMs: Number(env.CIB_LOCKOUT_MINUTES || 15) * 60e3,
  minPassword: Number(env.CIB_MIN_PASSWORD || 8),
  maxBodyBytes: 25 * 1024 * 1024,
  maxFileBytes: Number(env.CIB_MAX_FILE_MB || 50) * 1024 * 1024,
  proxyTimeoutMs: 12000,
  proxyMaxBytes: 4 * 1024 * 1024,
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  trustProxy: env.CIB_TRUST_PROXY === '1',
  // Provider API keys the proxy attaches server-side (the browser never sees them). Hosts are added to the
  // allow-list only when their key is configured.
  providerKeys: {
    'threatfox-api.abuse.ch': env.THREATFOX_AUTH_KEY ? { 'Auth-Key': env.THREATFOX_AUTH_KEY } : null,
    'urlhaus-api.abuse.ch': env.THREATFOX_AUTH_KEY ? { 'Auth-Key': env.THREATFOX_AUTH_KEY } : null,
    'mb-api.abuse.ch': env.THREATFOX_AUTH_KEY ? { 'Auth-Key': env.THREATFOX_AUTH_KEY } : null,
    'www.virustotal.com': env.VT_API_KEY ? { 'x-apikey': env.VT_API_KEY } : null,
    'api.shodan.io': env.SHODAN_API_KEY ? { query: { key: env.SHODAN_API_KEY } } : null,
    'api.greynoise.io': env.GREYNOISE_API_KEY ? { key: env.GREYNOISE_API_KEY } : null,
    'api.abuseipdb.com': env.ABUSEIPDB_API_KEY ? { Key: env.ABUSEIPDB_API_KEY, Accept: 'application/json' } : null,
    'urlscan.io': env.URLSCAN_API_KEY ? { 'API-Key': env.URLSCAN_API_KEY } : null,
  },
  // Hosts the enrichment proxy may reach. Everything else is refused.
  proxyAllow: (env.CIB_PROXY_ALLOW || [
    'crt.sh', 'urlscan.io', 'threatfox-api.abuse.ch', 'urlhaus-api.abuse.ch', 'mb-api.abuse.ch', 'bazaar.abuse.ch',
    'archive.org', 'web.archive.org', 'otx.alienvault.com', 'api.greynoise.io', 'www.reddit.com', 'public.api.bsky.app',
    'nominatim.openstreetmap.org', 'ipapi.co', 'ipinfo.io', 'blockchain.info', 'api.blockcypher.com', 'rdap.org',
    'dns.google', 'services.nvd.nist.gov', 'www.cisa.gov', 'api.ransomware.live', 'www.ransomware.live', 'feeds.feedburner.com',
  ].join(',')).split(',').map(s => s.trim()).filter(Boolean),
};
for (const [h, k] of Object.entries(config.providerKeys)) if (k && !config.proxyAllow.includes(h)) config.proxyAllow.push(h);
