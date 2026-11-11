// window.CIBStore: keeps the pages' localStorage documents in sync with the server.
//  - pull() fills localStorage from the server before a page renders
//  - writes to the three keys are intercepted and pushed (debounced) as per-case changes
//  - server-sent events bring other people's changes back into localStorage and notify the page
//  - media blobs are mirrored to /api/files
import { api } from './api.js';

const KEY = 'cyber-investigation-board.v1', DESK = 'cyber-investigation-board.desk.v1', SETTINGS = 'cyber-investigation-board.settings.v1';
const SERVER_KEYS = ['rev', 'updatedAt', 'updatedBy'];
let snapshot = new Map(); // id -> JSON of the case as last known on the server
let pushTimer = null, pushing = false, dirty = false, es = null, enabled = false;
const listeners = new Set();
const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const origSet = Storage.prototype.setItem;
const rawSet = (k, v) => origSet.call(localStorage, k, v);
const stripServer = (c) => { const o = { ...c }; for (const k of SERVER_KEYS) delete o[k]; return o; };
const same = (a, b) => JSON.stringify(stripServer(a)) === JSON.stringify(stripServer(b));

const S = {
  status: { lastPush: null, lastPull: null, pending: 0, rejected: [], online: true },
  onRemote(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async pull() {
    const r = await api('GET', '/api/store');
    const local = readJson(KEY) || {};
    const localCases = Array.isArray(local.cases) ? local.cases : [];
    // server is authoritative for cases; keep local-only cases that are not on the server yet (they get pushed)
    const serverIds = new Set(r.cases.map(c => c.id));
    const keepLocal = localCases.filter(c => !serverIds.has(c.id) && !snapshot.has(c.id) && !local.enc);
    const cases = [...r.cases, ...keepLocal];
    snapshot = new Map(r.cases.map(c => [c.id, JSON.stringify(stripServer(c))]));
    const activeId = cases.some(c => c.id === local.activeId) ? local.activeId : (cases[0] && cases[0].id);
    // a brand-new installation (no cases on the server at all) lets the board seed its two sample cases once
    const seeded = r.total === 0 && !cases.length ? [] : ['c2', 'server'];
    rawSet(KEY, JSON.stringify({ ...(local.enc ? {} : local), cases, activeId, seeded }));
    if (r.desk) rawSet(DESK, JSON.stringify({ ...(readJson(DESK) || {}), ...r.desk }));
    if (r.settings) rawSet(SETTINGS, JSON.stringify({ ...(readJson(SETTINGS) || {}), ...r.settings }));
    S.status.lastPull = new Date().toISOString();
    enabled = true;
    if (keepLocal.length) S.schedule();
    return r;
  },
  schedule() { if (!enabled) return; dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(() => S.push().catch(() => {}), 600); },
  async push() {
    if (!enabled || pushing) return; dirty = false; pushing = true;
    try {
      const local = readJson(KEY) || {};
      if (local.enc) { S.status.pending = 0; return; } // encrypted at rest in the browser: nothing readable to sync
      const cases = Array.isArray(local.cases) ? local.cases : [];
      const changed = cases.filter(c => c && c.id && snapshot.get(c.id) !== JSON.stringify(stripServer(c)));
      const deleted = [...snapshot.keys()].filter(id => !cases.some(c => c.id === id));
      const body = { cases: changed, deleted };
      const desk = readJson(DESK); if (desk) body.desk = desk;
      const settings = readJson(SETTINGS); if (settings) body.settings = settings;
      if (!changed.length && !deleted.length && !desk && !settings) return;
      const r = await api('PUT', '/api/store', body);
      let patched = false;
      for (const a of r.accepted) { const c = cases.find(x => x.id === a.id); if (!c) continue; if (a.number && a.number !== c.number) { c.number = a.number; patched = true; } c.rev = a.rev; snapshot.set(a.id, JSON.stringify(stripServer(c))); }
      for (const id of r.deleted) snapshot.delete(id);
      for (const rj of r.rejected) { snapshot.delete(rj.id); }
      if (patched) rawSet(KEY, JSON.stringify({ ...local, cases }));
      S.status.rejected = r.rejected; S.status.lastPush = new Date().toISOString(); S.status.online = true;
      if (r.rejected.length && window.CIBAuth) window.CIBAuth.toast('Not saved on the server: ' + r.rejected.map(x => x.reason).filter((x, i, a) => a.indexOf(x) === i).join(' · '));
    } catch (e) { S.status.online = false; dirty = true; if (e.status === 401 && window.CIBAuth) window.CIBAuth.require('/'); }
    finally { pushing = false; if (dirty) S.schedule(); }
  },
  listen() {
    if (es || !window.EventSource) return;
    es = new EventSource('/api/events');
    const apply = async (id) => {
      try {
        const { case: c } = await api('GET', '/api/store/case/' + encodeURIComponent(id));
        const local = readJson(KEY) || {}; const cases = Array.isArray(local.cases) ? local.cases : [];
        const i = cases.findIndex(x => x.id === id);
        const mine = i >= 0 ? cases[i] : null;
        if (mine && snapshot.get(id) !== JSON.stringify(stripServer(mine))) { /* local unsaved edits win; they push next */ return; }
        if (i >= 0) cases[i] = c; else cases.push(c);
        snapshot.set(id, JSON.stringify(stripServer(c)));
        rawSet(KEY, JSON.stringify({ ...local, cases }));
        for (const f of listeners) { try { f({ type: 'case', id, case: c }); } catch (e) {} }
      } catch (e) { if (e.status === 404) removeLocal(id); }
    };
    const removeLocal = (id) => { const local = readJson(KEY) || {}; const cases = (local.cases || []).filter(x => x.id !== id); snapshot.delete(id); rawSet(KEY, JSON.stringify({ ...local, cases, activeId: local.activeId === id ? (cases[0] && cases[0].id) : local.activeId })); for (const f of listeners) { try { f({ type: 'case-deleted', id }); } catch (e) {} } };
    es.addEventListener('case', (ev) => { try { const d = JSON.parse(ev.data); apply(d.id); } catch (e) {} });
    es.addEventListener('case-deleted', (ev) => { try { const d = JSON.parse(ev.data); removeLocal(d.id); } catch (e) {} });
    es.addEventListener('comment', (ev) => { try { window.dispatchEvent(new CustomEvent('cib:comment', { detail: JSON.parse(ev.data) })); } catch (e) {} });
    es.addEventListener('presence', (ev) => { try { window.dispatchEvent(new CustomEvent('cib:presence', { detail: JSON.parse(ev.data) })); } catch (e) {} });
    es.addEventListener('notify', (ev) => { try { const d = JSON.parse(ev.data); window.dispatchEvent(new CustomEvent('cib:notify', { detail: d.notification })); if (window.CIBAuth && d.notification) window.CIBAuth.toast(d.notification.text); } catch (e) {} });
  },
  // ---- media mirror
  // patch fields of a local case (used by admin actions whose server write already happened) and tell the pages
  patchLocal(id, fields) { const local = readJson(KEY) || {}; const cases = Array.isArray(local.cases) ? local.cases : []; const i = cases.findIndex(x => x.id === id); if (i < 0) return false; cases[i] = { ...cases[i], ...fields }; rawSet(KEY, JSON.stringify({ ...local, cases })); for (const f of listeners) { try { f({ type: 'case', id, case: cases[i] }); } catch (e) {} } return true; },
  async putFile(id, blob, caseId) { await api('PUT', '/api/files/' + encodeURIComponent(id), blob, { headers: { 'content-type': blob.type || 'application/octet-stream', 'x-file-name': (blob.name || '').slice(0, 200), ...(caseId ? { 'x-case-id': String(caseId) } : {}) } }); },
  async getFile(id) { const r = await api('GET', '/api/files/' + encodeURIComponent(id), undefined, { raw: true }); if (!r.ok) return null; return await r.blob(); },
};
// intercept writes to the synced keys (the page code keeps using localStorage as before)
Storage.prototype.setItem = function (k, v) { origSet.call(this, k, v); if (this === localStorage && (k === KEY || k === DESK || k === SETTINGS)) S.schedule(); };
window.addEventListener('beforeunload', () => { if (dirty && enabled) { try { const local = readJson(KEY) || {}; const cases = (local.cases || []).filter(c => snapshot.get(c.id) !== JSON.stringify(stripServer(c))); if (cases.length) navigator.sendBeacon && fetch('/api/store', { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json', 'X-Requested-With': 'CIB' }, body: JSON.stringify({ cases }) }); } catch (e) {} } });
window.CIBStore = S;
export default S;
