// Thin fetch wrapper for the server API: same-origin, cookies, CSRF header, JSON errors.
export async function api(method, url, body, opts = {}) {
  const headers = { 'X-Requested-With': 'CIB', ...(opts.headers || {}) };
  let payload = body;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  if (opts.raw) return r;
  const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
  if (!r.ok) { const e = new Error((j && j.error) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return j;
}
