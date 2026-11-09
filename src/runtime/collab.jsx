// Collaboration overlay: presence (who is here, who edits what), notifications, revision history, review requests.
// Mounted beside the generated pages; talks to the server and to the page logic through window.CIBPage.
import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';

const F = { mono: "11px 'IBM Plex Mono', monospace", ui: "12px 'Archivo Narrow', sans-serif", head: "10px 'Archivo Narrow', sans-serif" };
const S = {
  strip: { position: 'fixed', right: 316, top: 6, zIndex: 58, display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'none' },
  stripDesk: { position: 'fixed', right: 16, top: 112, zIndex: 58, display: 'flex', gap: 6, alignItems: 'center' },
  dot: (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', border: '1px solid #2c2c31', background: '#0e0e10', color: '#d8d3c7', font: F.mono, pointerEvents: 'auto', borderLeft: '3px solid ' + c }),
  bell: { position: 'fixed', right: 16, bottom: 56, zIndex: 60, height: 32, minWidth: 32, padding: '0 10px', border: '1px solid #2c2c31', background: '#17171a', color: '#d8d3c7', font: F.head, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 6px 14px rgba(0,0,0,.6)' },
  drawer: { position: 'fixed', right: 16, bottom: 96, zIndex: 61, width: 380, maxHeight: '60vh', overflow: 'auto', background: '#0e0e10', border: '1px solid #2c2c31', borderTop: '3px solid #ff2a3c', color: '#e8e4da', fontFamily: "'Archivo Narrow', system-ui, sans-serif", boxShadow: '0 30px 60px rgba(0,0,0,.8)' },
  h: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #232326', font: "12px 'Archivo Narrow', sans-serif", letterSpacing: '.2em', textTransform: 'uppercase', color: '#f3f1ea' },
  btn: { height: 24, padding: '0 8px', border: '1px solid #2c2c31', background: '#17171a', color: '#d8d3c7', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' },
  item: (unread) => ({ padding: '8px 12px', borderBottom: '1px solid #1c1c20', font: F.ui, background: unread ? '#141416' : 'transparent', cursor: 'pointer' }),
  lab: { font: F.head, letterSpacing: '.2em', color: '#8d877b', textTransform: 'uppercase' },
  lock: { position: 'fixed', right: 16, top: 228, zIndex: 59, padding: '6px 10px', border: '1px solid #e8a71c', background: '#2a2110', color: '#ffe2a0', font: F.mono, maxWidth: 280 },
};
const COLORS = ['#ff2a3c', '#4ea1e8', '#4bbf6b', '#e8a71c', '#9b6bff', '#2fc4b2', '#e07a2f'];
const colorFor = (id) => COLORS[[...String(id)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length];
const TYPE_ICON = { mention: '@', review: '✎', overdue: '⏰', watcher: '◉', system: '•' };

function usePage() { return window.CIBPage || null; }
function activeCase() { const L = usePage(); try { return L && L.cs ? L.cs() : null; } catch (e) { return null; } }

function Presence({ page }) {
  const [people, setPeople] = useState([]);
  const me = window.CIBAuth && window.CIBAuth.user();
  useEffect(() => {
    let editing = null, lastSel = null;
    const focusIn = (e) => { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.closest('aside')) editing = (window.CIBPage && window.CIBPage.state && window.CIBPage.state.sel) || null; };
    const focusOut = () => { editing = null; };
    document.addEventListener('focusin', focusIn); document.addEventListener('focusout', focusOut);
    const beat = async () => { const L = window.CIBPage; const st = L && L.state; const caseId = page === 'board' ? (st && st.activeId) : null; const sel = st && st.sel; try { const r = await api('POST', '/api/presence', { caseId, sel, editing, tab: page }); setPeople(r.people || []); } catch (e) {} };
    const onEvt = (e) => { const d = e.detail; const L = window.CIBPage; const caseId = page === 'board' ? (L && L.state && L.state.activeId) : null; if (!caseId || d.caseId === caseId) setPeople(d.people || []); };
    window.addEventListener('cib:presence', onEvt);
    beat(); const h = setInterval(beat, 10000);
    const quick = setInterval(() => { const L = window.CIBPage; const s = L && L.state && L.state.sel; if (s !== lastSel) { lastSel = s; beat(); } }, 1500);
    window.addEventListener('beforeunload', () => { try { navigator.sendBeacon && fetch('/api/presence', { method: 'DELETE', keepalive: true, headers: { 'X-Requested-With': 'CIB' } }); } catch (e) {} });
    return () => { clearInterval(h); clearInterval(quick); document.removeEventListener('focusin', focusIn); document.removeEventListener('focusout', focusOut); window.removeEventListener('cib:presence', onEvt); };
  }, [page]);
  const others = people.filter(p => !me || p.user.id !== me.id);
  const L = usePage(); const mySel = L && L.state && L.state.sel;
  const lockers = others.filter(p => p.editing && mySel && p.editing === mySel);
  const label = (p) => { const cs = activeCase(); const it = cs && cs.items && p.sel ? cs.items.find(i => i.id === p.sel) : null; return it ? (it.num ? 'E' + String(it.num).padStart(2, '0') : it.title || it.value || it.type) : ''; };
  return <>
    <div data-presence="1" style={page === 'board' ? S.strip : S.stripDesk}>
      {others.map(p => <span key={p.key} style={S.dot(colorFor(p.user.id))} title={p.user.name + ' · ' + p.user.role + (p.editing ? ' · editing' : p.sel ? ' · looking at ' + label(p) : '')}>● {p.user.name}{p.editing ? ' ✎ ' + label(p) : p.sel ? ' · ' + label(p) : ''}</span>)}
    </div>
    {lockers.length ? <div data-softlock="1" style={S.lock}>✎ {lockers.map(p => p.user.name).join(', ')} {lockers.length > 1 ? 'are' : 'is'} editing this card right now. Your changes merge field by field; wait a moment to avoid crossing edits.</div> : null}
  </>;
}

function Bell({ page }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const [tab, setTab] = useState('notifications');
  const [revs, setRevs] = useState([]);
  const [names, setNames] = useState([]);
  const [reviewer, setReviewer] = useState('');
  const load = () => api('GET', '/api/notifications').then(setData).catch(() => {});
  useEffect(() => { load(); const on = (e) => { setData(d => ({ unread: d.unread + 1, items: [e.detail, ...d.items].slice(0, 200) })); }; window.addEventListener('cib:notify', on); const h = setInterval(load, 60000); return () => { window.removeEventListener('cib:notify', on); clearInterval(h); }; }, []);
  useEffect(() => { if (!open) return; if (tab === 'history') { const cs = activeCase(); if (cs) api('GET', '/api/store/case/' + encodeURIComponent(cs.id) + '/revisions').then(r => setRevs(r.revisions)).catch(() => setRevs([])); } if (tab === 'review') api('GET', '/api/users/names').then(r => setNames(r.users)).catch(() => {}); }, [open, tab]);
  const markAll = () => api('POST', '/api/notifications/read', { ids: 'all' }).then(setData).catch(() => {});
  const openItem = (n) => { api('POST', '/api/notifications/read', { ids: [n.id] }).then(setData).catch(() => {}); if (n.caseId) { if (page === 'board' && window.CIBPage) { const L = window.CIBPage; if (L.state.activeId !== n.caseId) L.setState({ activeId: n.caseId, sel: null, selThread: null }); if (n.itemId && L.focusItem) setTimeout(() => L.focusItem(n.itemId), 150); } else location.href = '/board.html#case=' + encodeURIComponent(n.caseId); } };
  const restore = async (rev) => { const cs = activeCase(); if (!cs || !window.confirm('Restore ' + cs.number + ' to revision ' + rev + '? The current state is kept in the history.')) return; const r = await api('POST', '/api/store/case/' + encodeURIComponent(cs.id) + '/restore/' + rev, {}); if (window.CIBPage && window.CIBPage.applyRemote) window.CIBPage.applyRemote({ type: 'case', case: r.case }); setRevs(await api('GET', '/api/store/case/' + encodeURIComponent(cs.id) + '/revisions').then(x => x.revisions)); };
  const requestReview = () => { const L = window.CIBPage; const cs = activeCase(); if (!L || !cs) return; L.upCase(c => ({ ...c, reviewer: reviewer || '', review: 'in review' })); if (L.logEvt) L.logEvt('Review requested' + (reviewer ? ' from ' + reviewer : '')); if (L.toast) L.toast('Sent for review' + (reviewer ? ' to ' + reviewer : '')); setOpen(false); };
  const cs = activeCase();
  return <>
    <button data-bell="1" style={{ ...S.bell, borderColor: data.unread ? '#ff2a3c' : '#2c2c31', color: data.unread ? '#fff' : '#d8d3c7' }} onClick={() => setOpen(o => !o)} title="Notifications, history and review">◆ {data.unread ? data.unread + ' new' : 'Activity'}</button>
    {open ? <div data-drawer="1" style={S.drawer}>
      <div style={S.h}>
        {['notifications', ...(page === 'board' ? ['history', 'review'] : [])].map(t => <button key={t} style={{ ...S.btn, borderColor: tab === t ? '#ff2a3c' : '#2c2c31', color: tab === t ? '#fff' : '#8d877b' }} onClick={() => setTab(t)}>{t}</button>)}
        <span style={{ flex: 1 }} />
        {tab === 'notifications' ? <button style={S.btn} onClick={markAll}>Mark all read</button> : null}
        <button style={S.btn} onClick={() => setOpen(false)}>×</button>
      </div>
      {tab === 'notifications' ? (data.items.length ? data.items.map(n => <div key={n.id} style={S.item(!n.read)} onClick={() => openItem(n)}><span style={{ color: '#ff2a3c', marginRight: 6 }}>{TYPE_ICON[n.type] || '•'}</span>{n.text}<div style={{ font: F.mono, color: '#8d877b', marginTop: 2 }}>{new Date(n.t).toLocaleString()}</div></div>) : <div style={{ padding: 12, font: F.ui, color: '#8d877b' }}>Nothing yet. Mentions (@name in a comment), review requests, overdue tasks and watcher alerts land here.</div>) : null}
      {tab === 'history' ? <div>
        <div style={{ padding: '8px 12px', font: F.ui, color: '#8d877b' }}>Server revisions of {cs ? cs.number : 'this case'}. Each save by anyone is a revision; concurrent edits are merged field by field. Restore keeps the current state in the history.</div>
        {revs.length ? revs.map(r => <div key={r.rev} style={{ ...S.item(false), display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ font: F.mono, color: '#9a2b2b' }}>rev {r.rev}</span><span style={{ flex: 1 }}>{r.by || '—'}<div style={{ font: F.mono, color: '#8d877b' }}>{new Date(r.t).toLocaleString()} · {(r.size / 1024).toFixed(0)} KB</div></span><button data-restore={r.rev} style={S.btn} onClick={() => restore(r.rev)}>Restore</button></div>) : <div style={{ padding: 12, font: F.ui, color: '#8d877b' }}>No earlier revisions yet.</div>}
      </div> : null}
      {tab === 'review' ? <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={S.lab}>Request review of {cs ? cs.number : ''}</div>
        <select data-reviewer="1" value={reviewer} onChange={e => setReviewer(e.target.value)} style={{ height: 30, padding: '0 8px', border: '1px solid #2c2c31', background: '#0c0c0e', color: '#e8e4da', font: F.ui, colorScheme: 'dark' }}>
          <option value="">Any reviewer or admin</option>
          {names.filter(n => n.role === 'reviewer' || n.role === 'admin').map(n => <option key={n.id} value={n.name}>{n.name} · {n.role}</option>)}
        </select>
        <div style={{ font: F.ui, color: '#8d877b' }}>Moves the file to <b>In review</b> and notifies the reviewer. TLP:RED and AMBER+STRICT files can only be published by a different account than the one that requested review.</div>
        <button data-request-review="1" style={{ ...S.btn, borderColor: '#ff2a3c', background: '#ff2a3c', color: '#fff', height: 30 }} onClick={requestReview}>Send for review</button>
      </div> : null}
    </div> : null}
  </>;
}

export function mountCollab(page) {
  const u = window.CIBAuth && window.CIBAuth.user(); if (!u || u.guest) return;
  const el = document.createElement('div'); el.id = 'cib-collab'; document.body.appendChild(el);
  createRoot(el).render(<><Presence page={page} /><Bell page={page} /></>);
}
