// OIDC authorization-code sign-in with PKCE (Okta, Entra, Google, Keycloak, …). Discovery from the issuer,
// RS256 id_token verification against the provider's JWKS, users created on first sign-in.
import crypto from 'node:crypto';
import { config } from './config.js';
const env = process.env;
export const oidcConfig = () => env.OIDC_ISSUER && env.OIDC_CLIENT_ID ? { issuer: env.OIDC_ISSUER.replace(/\/$/, ''), clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET || '', scope: env.OIDC_SCOPE || 'openid profile email', label: env.OIDC_LABEL || 'Single sign-on', defaultRole: ['admin', 'analyst', 'reviewer', 'viewer'].includes(env.OIDC_DEFAULT_ROLE) ? env.OIDC_DEFAULT_ROLE : 'viewer', admins: (env.OIDC_ADMINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean), allowedDomains: (env.OIDC_ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean) } : null;
let disc = null, jwks = null, jwksAt = 0;
const b64u = (b) => Buffer.from(b).toString('base64url');
async function discovery() { const c = oidcConfig(); if (!c) throw Object.assign(new Error('OIDC not configured'), { status: 404 }); if (disc && disc.issuer === c.issuer) return disc; const r = await fetch(c.issuer + '/.well-known/openid-configuration'); if (!r.ok) throw Object.assign(new Error('OIDC discovery failed: HTTP ' + r.status), { status: 502 }); disc = await r.json(); return disc; }
async function keys(force = false) { const d = await discovery(); if (!jwks || force || Date.now() - jwksAt > 3600e3) { const r = await fetch(d.jwks_uri); if (!r.ok) throw Object.assign(new Error('JWKS fetch failed'), { status: 502 }); jwks = (await r.json()).keys || []; jwksAt = Date.now(); } return jwks; }
export async function startUrl(origin) {
  const c = oidcConfig(); const d = await discovery();
  const state = b64u(crypto.randomBytes(16)), nonce = b64u(crypto.randomBytes(16)), verifier = b64u(crypto.randomBytes(32));
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  const u = new URL(d.authorization_endpoint);
  u.search = new URLSearchParams({ response_type: 'code', client_id: c.clientId, redirect_uri: origin + '/api/auth/oidc/callback', scope: c.scope, state, nonce, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return { url: u.toString(), state, nonce, verifier };
}
export function verifyIdToken(token, nonce, keyList) {
  const c = oidcConfig(); const parts = String(token || '').split('.'); if (parts.length !== 3) throw Object.assign(new Error('bad id_token'), { status: 401 });
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (header.alg !== 'RS256') throw Object.assign(new Error('unsupported id_token alg ' + header.alg), { status: 401 });
  const jwk = keyList.find(k => k.kid === header.kid && (!k.alg || k.alg === 'RS256')) || keyList.find(k => k.kty === 'RSA'); if (!jwk) throw Object.assign(new Error('no matching JWK'), { status: 401 });
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw Object.assign(new Error('id_token signature invalid'), { status: 401 });
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== c.issuer && payload.iss !== c.issuer + '/') throw Object.assign(new Error('issuer mismatch'), { status: 401 });
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]; if (!aud.includes(c.clientId)) throw Object.assign(new Error('audience mismatch'), { status: 401 });
  if (!payload.exp || payload.exp < now - 60) throw Object.assign(new Error('id_token expired'), { status: 401 });
  if (nonce && payload.nonce !== nonce) throw Object.assign(new Error('nonce mismatch'), { status: 401 });
  return payload;
}
export async function exchange(code, verifier, origin) {
  const c = oidcConfig(); const d = await discovery();
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: origin + '/api/auth/oidc/callback', client_id: c.clientId, code_verifier: verifier }); if (c.clientSecret) body.set('client_secret', c.clientSecret);
  const r = await fetch(d.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body });
  if (!r.ok) throw Object.assign(new Error('token exchange failed: HTTP ' + r.status), { status: 502 });
  return r.json();
}
export async function identityFrom(tokens, nonce) {
  let keyList = await keys(); let payload;
  try { payload = verifyIdToken(tokens.id_token, nonce, keyList); } catch (e) { if (/no matching JWK/.test(e.message)) { keyList = await keys(true); payload = verifyIdToken(tokens.id_token, nonce, keyList); } else throw e; }
  let email = payload.email, name = payload.name || payload.preferred_username;
  if ((!email || !name) && tokens.access_token) { try { const d = await discovery(); const r = await fetch(d.userinfo_endpoint, { headers: { authorization: 'Bearer ' + tokens.access_token } }); if (r.ok) { const ui = await r.json(); email = email || ui.email; name = name || ui.name || ui.preferred_username; } } catch (e) {} }
  const c = oidcConfig(); email = String(email || '').toLowerCase();
  if (c.allowedDomains.length && !c.allowedDomains.includes(email.split('@')[1] || '')) throw Object.assign(new Error('Your account\'s domain is not allowed here'), { status: 403 });
  return { sub: payload.sub, email, name: String(name || email || payload.sub).slice(0, 64), admin: c.admins.includes(email) || c.admins.includes(String(payload.sub).toLowerCase()) };
}
export function resetDiscoveryCache() { disc = null; jwks = null; }
