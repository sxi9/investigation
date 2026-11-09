// Which hosts the board should reach through /api/proxy (they refuse cross-origin browser requests).
const HOSTS = ['crt.sh', 'urlscan.io', 'threatfox-api.abuse.ch', 'urlhaus-api.abuse.ch', 'mb-api.abuse.ch', 'bazaar.abuse.ch', 'archive.org', 'web.archive.org', 'otx.alienvault.com', 'www.reddit.com', 'nominatim.openstreetmap.org', 'blockchain.info', 'api.blockcypher.com', 'www.cisa.gov', 'api.ransomware.live', 'www.ransomware.live'];
window.CIBProxy = { hosts: HOSTS, needs(url) { try { const h = new URL(url, location.href).hostname; return HOSTS.some(x => h === x || h.endsWith('.' + x)); } catch (e) { return false; } } };
// Patch global fetch for those hosts too, so feeds and monitors that call fetch() directly also work.
const origFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && /^https:\/\//i.test(url) && window.CIBProxy.needs(url) && !(init && init.mode === 'no-cors')) {
      const h = new Headers((init && init.headers) || {}); h.set('X-Requested-With', 'CIB');
      return origFetch('/api/proxy?url=' + encodeURIComponent(url), { ...(init || {}), headers: h, credentials: 'same-origin' });
    }
  } catch (e) {}
  return origFetch(input, init);
};
