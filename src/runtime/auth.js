// window.CIBAuth, server-backed. Same surface as the design's browser-local auth.js:
// synchronous reads come from a cache filled by init(); writes go to the API and update the cache optimistically.
import { api } from './api.js';

const ROLES = [['admin', 'Admin', 'Everything, plus users and settings'], ['analyst', 'Analyst', 'Edits the cases assigned to them'], ['reviewer', 'Reviewer', 'Reads, comments, moves files through review'], ['viewer', 'Viewer', 'Read-only']];
const PUBLIC_TLPS = ['', 'clear', 'green'];
const cache = { user: null, hasUsers: false, hasPublic: false, users: [], audit: [], ai: 'local', sso: null, ready: false };
const listeners = new Set();
const notify = () => { for (const f of listeners) { try { f(); } catch (e) {} } };

const A = {
  ROLES,
  get ready() { return cache.ready; },
  async init() {
    try { const s = await api('GET', '/api/auth/session'); cache.user = s.user; cache.hasUsers = !!s.hasUsers; cache.hasPublic = !!s.hasPublic; cache.ai = s.ai || 'local'; cache.sso = s.sso || null; } catch (e) { cache.user = null; }
    cache.ready = true; return cache.user;
  },
  async refreshUsers() { if (!cache.user || cache.user.role !== 'admin') return; try { const r = await api('GET', '/api/users'); cache.users = r.users; cache.audit = r.audit; notify(); } catch (e) {} },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // ---- synchronous reads (from the cache)
  load() { return { users: cache.users, session: cache.user ? { userId: cache.user.id } : null, audit: cache.audit }; },
  save() {},
  hasUsers() { return cache.hasUsers; },
  hasPublic() { return cache.hasPublic; },
  user() { return cache.user; },
  touch() { api('POST', '/api/auth/touch').then(r => { if (!r.user) { cache.user = null; notify(); } }).catch(e => { if (e.status === 401) { cache.user = null; notify(); } }); },
  require(loginFile) {
    const u = A.user();
    if (!u) { const here = location.pathname.split('/').pop() + location.hash; location.replace((loginFile || '/') + '#next=' + encodeURIComponent(here || 'desk.html')); return null; }
    return u;
  },
  canSee(u, c) { if (!u || !c) return false; if (u.guest) return !!c.public && PUBLIC_TLPS.includes(c.tlp || ''); if (u.role === 'admin') return true; if ((c.tlp === 'red' || c.tlp === 'amber+strict') && !u.tlpRed) return false; return u.cases === 'all' || (Array.isArray(u.cases) && u.cases.includes(c.id)); },
  canEdit(u, c) { return !!u && (u.role === 'admin' || u.role === 'analyst') && A.canSee(u, c); },
  canReview(u, c) { return !!u && (u.role === 'admin' || u.role === 'reviewer' || u.role === 'analyst') && A.canSee(u, c); },
  canCreate(u) { return !!u && (u.role === 'admin' || u.role === 'analyst'); },
  isAdmin(u) { return !!u && u.role === 'admin'; },
  roleLabel(r) { const x = ROLES.find(y => y[0] === r); return x ? x[1] : r; },
  // ---- writes
  async createUser(o) {
    const first = !cache.hasUsers;
    const r = first ? await api('POST', '/api/auth/setup', { name: o.name, pass: o.pass }) : await api('POST', '/api/users', { name: o.name, pass: o.pass, role: o.role, tlpRed: o.tlpRed, cases: o.cases, mustChange: o.mustChange });
    cache.hasUsers = true; if (first) cache.user = r.user; else cache.users = [...cache.users, r.user];
    A.refreshUsers(); notify(); return r.user;
  },
  async login(name, pass) { const r = await api('POST', '/api/auth/login', { name, pass }); if (r.totpRequired) return { totpRequired: true, challenge: r.challenge }; cache.user = r.user; notify(); return r.user; },
  async loginTotp(challenge, code) { const r = await api('POST', '/api/auth/login/totp', { challenge, code }); cache.user = r.user; notify(); return r.user; },
  sso() { return cache.sso; },
  async totpSetup() { return api('POST', '/api/auth/totp/setup'); },
  async totpConfirm(code) { await api('POST', '/api/auth/totp/confirm', { code }); cache.user = { ...cache.user, totp: true }; notify(); },
  async totpDisable(pass) { await api('POST', '/api/auth/totp/disable', { pass }); cache.user = { ...cache.user, totp: false }; notify(); },
  async adminTotpDisable(id) { await api('POST', '/api/users/' + encodeURIComponent(id) + '/totp/disable'); A.refreshUsers(); },
  async guest() { const r = await api('POST', '/api/auth/guest'); cache.user = r.user; notify(); return r.user; },
  logout() { api('POST', '/api/auth/logout').catch(() => {}); cache.user = null; cache.users = []; notify(); },
  async setPassword(id, pass, mustChange, by) {
    if (cache.user && id === cache.user.id && !mustChange) { await api('POST', '/api/auth/password', { pass }); cache.user = { ...cache.user, mustChange: false }; }
    else await api('POST', '/api/users/' + encodeURIComponent(id) + '/password', { pass });
    A.refreshUsers(); notify();
  },
  update(id, patch) {
    cache.users = cache.users.map(u => u.id === id ? { ...u, ...patch } : u); notify();
    return api('PATCH', '/api/users/' + encodeURIComponent(id), patch).then(() => A.refreshUsers()).catch(e => { A.refreshUsers(); A.toast(e.message); });
  },
  remove(id) {
    const prev = cache.users; cache.users = cache.users.filter(u => u.id !== id); notify();
    return api('DELETE', '/api/users/' + encodeURIComponent(id)).then(() => A.refreshUsers()).catch(e => { cache.users = prev; notify(); A.toast(e.message); throw e; });
  },
  toast(msg) { if (!msg) return; const el = document.createElement('div'); el.textContent = msg; el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);background:#f3f1ea;color:#1b1a17;padding:8px 14px;font:12px "Special Elite",monospace;box-shadow:0 6px 14px rgba(0,0,0,.7);z-index:2147483000'; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); },
  aiEngine() { return cache.ai; },
};
window.CIBAuth = A;
export default A;
