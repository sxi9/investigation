// Fastify application: security headers, cookies, rate limits, auth, and the API routes.
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { users } from './users.js';
import { store } from './store.js';
import { GUEST, canSee, isAdmin } from './acl.js';
import { audit, verifyAuditChain } from './crypto.js';
import { proxyFetch } from './proxy.js';
import { complete } from './ai/index.js';
import { subscribe, broadcast, keepAlive } from './events.js';

const COOKIE = 'cib_session';
const err = (m, status = 400) => Object.assign(new Error(m), { status });

export function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: config.trustProxy, bodyLimit: config.maxBodyBytes });
  app.register(cookie);
  app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'blob:', 'data:', 'https:'],
        'connect-src': ["'self'", 'https:', 'wss:'],
        'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com', 'https://platform.twitter.com', 'https://www.tiktok.com', 'https://t.me', 'https://telegram.org'],
        'worker-src': ["'self'", 'blob:'],
        'object-src': ["'none'"], 'base-uri': ["'self'"], 'form-action': ["'self'"], 'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' }, hsts: config.secureCookies ? { maxAge: 15552000, includeSubDomains: true } : false,
  });
  app.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute' });
  app.removeContentTypeParser('text/plain');
  app.addContentTypeParser(/^(?!application\/json)(?!multipart).*/i, { parseAs: 'buffer', bodyLimit: config.maxFileBytes }, (req, body, done) => done(null, body));

  const cookieOpts = () => ({ path: '/', httpOnly: true, sameSite: 'strict', secure: config.secureCookies, maxAge: Math.floor(config.sessionLifeMs / 1000) });
  const ip = (req) => req.ip;

  // ---- authentication for every /api route: cookie → user; CSRF: same-site cookie + custom header + Origin check on writes
  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', '');
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const tok = req.cookies[COOKIE];
    const u = users.bySession(tok);
    req.user = u === 'guest' ? GUEST : u; req.sessionToken = u ? tok : '';
    // a temporary password (admin reset) only unlocks the password change itself
    if (req.user && req.user.mustChange && !/^\/api\/auth\/(password|session|logout|touch)(\?|$)/.test(req.url)) throw err('Change your password first', 403);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.headers['x-requested-with'] !== 'CIB') throw err('missing X-Requested-With header', 403);
      const origin = req.headers.origin; const host = req.headers.host;
      if (origin && host && new URL(origin).host !== host) throw err('cross-origin request refused', 403);
    }
  });
  app.setErrorHandler((e, req, reply) => {
    const status = e.status || e.statusCode || 500;
    if (status >= 500) app.log.error(e);
    reply.code(status).send({ error: status >= 500 ? 'Server error' : e.message });
  });
  const need = (req) => { if (!req.user) throw err('Sign in first', 401); return req.user; };
  const needAccount = (req) => { const u = need(req); if (u.guest) throw err('Guests cannot do that', 403); return u; };
  const needAdmin = (req) => { const u = needAccount(req); if (!isAdmin(u)) throw err('Admins only', 403); return u; };
  const publicUser = (u) => u && ({ id: u.id, name: u.name, role: u.role, tlpRed: !!u.tlpRed, cases: u.cases, mustChange: !!u.mustChange, guest: !!u.guest, createdAt: u.createdAt, lastLogin: u.lastLogin, locked: !!u.locked });

  // ---- health
  app.get('/api/health', async () => ({ ok: true, users: users.count(), audit: verifyAuditChain(), ai: config.anthropicKey ? config.anthropicModel : 'local' }));

  // ---- auth
  app.get('/api/auth/session', async (req) => ({ user: publicUser(req.user), hasUsers: users.count() > 0, hasPublic: store.hasPublic(), ai: config.anthropicKey ? 'model' : 'local' }));
  app.post('/api/auth/setup', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    if (users.count() > 0) throw err('Setup is already done', 409);
    const { name, pass } = req.body || {};
    const u = users.create({ name, pass, role: 'admin' }, name, ip(req));
    const token = users.newSession(u.id, ip(req), req.headers['user-agent']);
    reply.setCookie(COOKIE, token, cookieOpts());
    return { user: publicUser(u) };
  });
  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { name, pass } = req.body || {};
    const { user, token } = users.login(name, pass, ip(req), req.headers['user-agent']);
    reply.setCookie(COOKIE, token, cookieOpts());
    return { user: publicUser(user) };
  });
  app.post('/api/auth/guest', { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (req, reply) => {
    if (!store.hasPublic()) throw err('No public case files', 404);
    reply.setCookie(COOKIE, users.guestSession(ip(req), req.headers['user-agent']), cookieOpts());
    return { user: publicUser(GUEST) };
  });
  app.post('/api/auth/logout', async (req, reply) => { users.logout(req.sessionToken, req.user && req.user.name, ip(req)); reply.clearCookie(COOKIE, { path: '/' }); return { ok: true }; });
  app.post('/api/auth/password', async (req) => { const u = needAccount(req); users.setPassword(u.id, (req.body || {}).pass, false, u.name, ip(req)); return { ok: true }; });
  app.post('/api/auth/touch', async (req) => ({ user: publicUser(req.user) }));

  // ---- users (admin)
  app.get('/api/users', async (req) => { needAdmin(req); return { users: users.list().map(publicUser), audit: users.auditTail(300) }; });
  app.post('/api/users', async (req) => { const me = needAdmin(req); const b = req.body || {}; return { user: publicUser(users.create({ name: b.name, pass: b.pass, role: b.role, tlpRed: b.tlpRed, cases: b.cases, mustChange: b.mustChange !== false }, me.name, ip(req))) }; });
  app.patch('/api/users/:id', async (req) => { const me = needAdmin(req); const b = req.body || {}; const patch = {}; for (const k of ['role', 'tlpRed', 'cases']) if (b[k] !== undefined) patch[k] = b[k]; return { user: publicUser(users.update(req.params.id, patch, me.name, ip(req))) }; });
  app.post('/api/users/:id/password', async (req) => { const me = needAdmin(req); users.setPassword(req.params.id, (req.body || {}).pass, true, me.name, ip(req)); return { ok: true }; });
  app.delete('/api/users/:id', async (req) => { const me = needAdmin(req); if (req.params.id === me.id) throw err('Use another admin account to remove yourself'); users.remove(req.params.id, me.name, ip(req)); return { ok: true }; });

  // ---- store: cases + per-user preferences
  app.get('/api/store', async (req) => {
    const u = need(req);
    return { cases: store.visibleCases(u), total: store.totalCases(), desk: u.guest ? null : store.getPref(u, 'desk'), settings: u.guest ? null : store.getPref(u, 'settings'), serverTime: new Date().toISOString() };
  });
  app.get('/api/store/case/:id', async (req) => { const u = need(req); const c = store.getCase(u, req.params.id); if (!c) throw err('Not found', 404); return { case: c }; });
  app.put('/api/store', async (req) => {
    const u = need(req); if (u.guest) throw err('Guests are read-only', 403);
    const b = req.body || {};
    const res = store.putCases(u, Array.isArray(b.cases) ? b.cases : [], u.name, ip(req));
    const deleted = store.deleteCases(u, Array.isArray(b.deleted) ? b.deleted : [], u.name, ip(req));
    if (b.desk !== undefined) store.setPref(u, 'desk', b.desk);
    if (b.settings !== undefined) store.setPref(u, 'settings', b.settings);
    for (const a of res.accepted) if (!a.unchanged) { const c = store.getCase(u, a.id); broadcast({ type: 'case', id: a.id, rev: a.rev, by: u.name }, c ? { id: c.id, tlp: c.tlp, public: !!c.public } : null, req.sessionToken); }
    for (const id of deleted) broadcast({ type: 'case-deleted', id, by: u.name }, null, req.sessionToken);
    return { ...res, deleted };
  });

  // ---- files (media mirror)
  app.put('/api/files/:id', async (req) => { const u = needAccount(req); if (!(u.role === 'admin' || u.role === 'analyst')) throw err('Read-only role', 403); const buf = Buffer.isBuffer(req.body) ? req.body : typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body || '')); return store.putFile(u, req.params.id, buf, req.headers['content-type'], req.headers['x-file-name']); });
  app.get('/api/files/:id', async (req, reply) => { needAccount(req); const f = store.getFile(req.user, req.params.id); if (!f) throw err('Not found', 404); reply.header('content-type', f.mime || 'application/octet-stream').header('x-sha256', f.sha256).header('cache-control', 'private, max-age=86400').header('content-disposition', 'inline'); return reply.send(f.data); });

  // ---- enrichment proxy
  app.all('/api/proxy', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    needAccount(req);
    const url = req.query.url; if (!url) throw err('url required');
    const r = await proxyFetch(url, { method: req.method, body: req.method === 'POST' ? (Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body || {})) : null, contentType: req.method === 'POST' ? (req.headers['content-type'] || 'application/json') : '' });
    reply.code(r.status).header('content-type', r.type).header('cache-control', 'private, max-age=300');
    return reply.send(r.body);
  });

  // ---- AI gateway
  app.post('/api/ai/complete', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const u = needAccount(req); const b = req.body || {};
    const out = await complete({ system: b.system, messages: b.messages, max_tokens: b.max_tokens });
    audit(u.name, 'AI request (' + out.engine + ')', ip(req));
    return out;
  });

  // ---- live events
  app.get('/api/events', async (req, reply) => {
    const u = need(req);
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    reply.raw.write('event: hello\ndata: {}\n\n');
    const c = subscribe(reply, u); c.sessionKey = req.sessionToken;
    await new Promise(res => reply.raw.on('close', res));
    return reply;
  });
  keepAlive();

  // ---- static site (the built pages) when dist exists
  if (fs.existsSync(path.join(config.distDir, 'index.html'))) {
    app.register(fastifyStatic, { root: config.distDir, prefix: '/', maxAge: '1h', immutable: false, setHeaders: (res, p) => { if (/\/assets\//.test(p)) res.setHeader('cache-control', 'public, max-age=31536000, immutable'); else res.setHeader('cache-control', 'no-cache'); } });
  }
  return app;
}
