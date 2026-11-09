// AI research panel: an overlay on the board (not part of the generated template). Gathers sources on the
// server, proposes cards, and imports the ones you tick into the inbox or onto the board. Also offers the
// manual route: copy a prompt, run it in Claude (or any model) yourself, paste the answer, import.
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';

const F = { mono: "12px 'IBM Plex Mono', monospace", ui: "12px 'Archivo Narrow', sans-serif", head: "11px 'Archivo Narrow', sans-serif" };
const S = {
  fab: { position: 'fixed', right: 16, bottom: 92, zIndex: 60, height: 32, padding: '0 12px', border: '1px solid #5a2a2e', background: '#17171a', color: '#ff2a3c', font: F.head, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 6px 14px rgba(0,0,0,.6)' },
  wrap: { position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflow: 'auto' },
  panel: { width: 'min(1100px, 100%)', background: '#0e0e10', border: '1px solid #2c2c31', borderTop: '3px solid #ff2a3c', color: '#e8e4da', fontFamily: "'Archivo Narrow', system-ui, sans-serif", boxShadow: '0 30px 60px rgba(0,0,0,.8)' },
  bar: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #232326' },
  h: { font: "13px 'Archivo Narrow', sans-serif", letterSpacing: '.22em', textTransform: 'uppercase', color: '#f3f1ea' },
  btn: { height: 28, padding: '0 10px', border: '1px solid #2c2c31', background: '#17171a', color: '#d8d3c7', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' },
  red: { height: 30, padding: '0 14px', border: '1px solid #ff2a3c', background: '#ff2a3c', color: '#fff', font: F.head, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' },
  input: { height: 30, padding: '0 8px', border: '1px solid #2c2c31', background: '#0c0c0e', color: '#e8e4da', font: F.mono },
  ta: { width: '100%', minHeight: 90, padding: 8, border: '1px solid #2c2c31', background: '#0c0c0e', color: '#e8e4da', font: F.mono, resize: 'vertical' },
  lab: { font: "10px 'Archivo Narrow', sans-serif", letterSpacing: '.2em', color: '#8d877b', textTransform: 'uppercase' },
  chip: (on) => ({ height: 24, padding: '0 8px', border: '1px solid ' + (on ? '#ff2a3c' : '#2c2c31'), background: on ? '#2a1113' : 'transparent', color: on ? '#fff' : '#8d877b', font: F.head, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }),
  row: { display: 'grid', gridTemplateColumns: '24px 90px 1fr 170px 70px', gap: 8, alignItems: 'start', padding: '6px 8px', borderBottom: '1px solid #1c1c20', font: F.ui },
};
const TYPE_LABEL = { indicator: 'Indicator', person: 'Person', target: 'Target', location: 'Location', event: 'Event', ttp: 'Technique', doc: 'Document', link: 'Link', note: 'Note', tx: 'Transfer' };
const CONF_COLOR = { high: '#3fae63', medium: '#e8a71c', low: '#8d877b' };

function Panel({ onClose }) {
  const logic = window.CIBPage;
  const cs = () => (logic && logic.cs && logic.cs()) || { title: '', notes: '', items: [] };
  const [query, setQuery] = useState(cs().title || '');
  const [useNotes, setUseNotes] = useState(true);
  const [urls, setUrls] = useState('');
  const [avail, setAvail] = useState({ free: ['wikipedia', 'gdelt', 'hackernews', 'nvd'], keyed: {} });
  const [sources, setSources] = useState(['wikipedia', 'gdelt', 'hackernews', 'nvd']);
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [picked, setPicked] = useState({});
  const [mode, setMode] = useState('auto'); // auto | manual
  const [prompt, setPrompt] = useState(null);
  const [pasted, setPasted] = useState('');
  const [msg, setMsg] = useState('');
  const [engine, setEngine] = useState('');
  useEffect(() => { api('GET', '/api/research/sources').then(a => { setAvail(a); setSources(s => [...s, ...Object.keys(a.keyed).filter(k => a.keyed[k])]); }).catch(() => {}); api('GET', '/api/ai/providers').then(p => setEngine(p.chain)).catch(() => {}); }, []);
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const existing = () => cs().items.map(i => (i.value || i.title || '').trim()).filter(Boolean);
  const context = () => useNotes ? ('CASE ' + cs().number + ' — ' + cs().title + '\n' + String(cs().notes || '')).slice(0, 1500) : '';
  const urlList = () => urls.split(/\s+/).map(x => x.trim()).filter(x => /^https:\/\//i.test(x));
  const setResult = (r) => { setRes(r); const p = {}; (r.cards || []).forEach((c, i) => { p[i] = c.confidence !== 'low'; }); setPicked(p); };
  const run = async () => {
    setBusy('Gathering sources and reading them… this can take up to a minute'); setMsg('');
    try { setResult(await api('POST', '/api/research', { query, sources, urls: urlList(), existing: existing(), context: context() })); }
    catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };
  const makePrompt = async () => {
    setBusy('Gathering sources for the prompt…'); setMsg('');
    try { const p = await api('POST', '/api/research/prompt', { query, sources, urls: urlList(), existing: existing(), context: context() }); setPrompt(p); try { await navigator.clipboard.writeText(p.text); setMsg('Prompt copied to the clipboard (' + p.sources.length + ' sources attached). Paste it into Claude, then paste the JSON answer below.'); } catch (e) { setMsg('Prompt ready below; copy it into Claude, then paste the JSON answer.'); } }
    catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };
  const parse = async () => {
    setBusy('Checking the answer…'); setMsg('');
    try { const r = await api('POST', '/api/research/parse', { text: pasted, sources: prompt ? prompt.sources : [] }); setResult({ ...r, query, sources: r.sources, errors: [] }); setMsg(r.cards.length + ' cards recognised.'); }
    catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };
  const doImport = (pin) => {
    if (!logic || !res) return;
    const idx = Object.keys(picked).filter(k => picked[k]).map(Number);
    if (!idx.length) return setMsg('Tick at least one card.');
    const K = logic.constructor.K; const ids = {};
    const have = new Set(existing().map(x => x.toLowerCase()));
    let n = 0, skipped = 0;
    for (const i of idx) {
      const c = res.cards[i]; const key = String(c.value || c.title).toLowerCase(); if (have.has(key)) { skipped++; continue; }
      const type = K.TYPES[c.type] ? c.type : 'note';
      const f = { title: c.title, body: c.body, tags: c.tags, date: c.date, source: c.source, url: c.url, collected: c.collected, srcGrade: c.srcGrade, infoGrade: c.infoGrade, status: '' };
      if (type === 'indicator') { f.kind = c.kind; f.value = c.value; f.status = 'unverified'; }
      if (type === 'ttp') { f.value = c.value; f.kind = c.kind || ''; }
      if (type === 'target') { f.sector = c.sector; f.region = c.region; f.impact = c.impact; }
      if (type === 'tx') { f.chain = c.chain; f.amount = c.amount; f.txFrom = c.txFrom; f.txTo = c.txTo; }
      const at = pin && typeof logic.freeSpot === 'function' ? (() => { const w = K.TYPES[type].w; const s = logic.freeSpot(w, 170); return { x: s.x + w / 2, y: s.y + 10 }; })() : null;
      ids[i] = logic.addItem(type, f, !!pin, at); have.add(key); n++;
    }
    let t = 0;
    for (const th of res.threads || []) { if (ids[th.from] && ids[th.to]) { logic.addThread(ids[th.from], ids[th.to], th.rel, th.why); t++; } }
    if (res.summary && picked.__summary !== false) {
      const srcs = (res.sources || []).map(s => '- ' + (s.title || s.url) + ' — ' + s.url).join('\n');
      logic.addItem('doc', { title: 'Research: ' + query, body: res.summary + '\n\nSOURCES\n' + srcs, tags: 'research, ai', source: 'AI research (' + (res.engine || 'model') + ')', collected: new Date().toISOString().slice(0, 10), date: new Date().toISOString().slice(0, 10) }, !!pin, null);
    }
    if (logic.logEvt) logic.logEvt('AI research imported: ' + n + ' cards, ' + t + ' threads for "' + query + '" (' + (res.engine || 'pasted') + ')');
    if (logic.toast) logic.toast(n + ' cards ' + (pin ? 'pinned' : 'added to the inbox') + (t ? ', ' + t + ' threads' : '') + (skipped ? ', ' + skipped + ' already on the board' : ''));
    if (!pin && logic.setState) logic.setState({ showInbox: true });
    onClose();
  };
  const grouped = useMemo(() => { const g = {}; (res && res.cards || []).forEach((c, i) => { (g[c.type] = g[c.type] || []).push([i, c]); }); return g; }, [res]);
  const toggleAll = (on) => { const p = {}; (res.cards || []).forEach((c, i) => { p[i] = on; }); setPicked(p); };
  const allSources = [...avail.free.filter(x => x !== 'urls'), ...Object.keys(avail.keyed)];
  return (
    <div style={S.wrap} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.panel} role="dialog" aria-label="AI research">
        <div style={S.bar}>
          <div style={S.h}>AI research</div>
          <div style={{ font: F.mono, color: '#8d877b', flex: 1 }}>{engine ? 'engine chain: ' + engine : ''}</div>
          <button style={S.chip(mode === 'auto')} onClick={() => setMode('auto')}>Automatic</button>
          <button style={S.chip(mode === 'manual')} onClick={() => setMode('manual')}>Prompt for Claude · paste answer</button>
          <button style={S.btn} onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={S.lab}>Research</span>
            <input data-research-query="1" value={query} onChange={e => setQuery(e.target.value)} placeholder="Case, actor, incident, CVE, company, person…" style={{ ...S.input, flex: '1 1 320px' }} onKeyDown={e => { if (e.key === 'Enter' && mode === 'auto') run(); }} />
            <label style={{ ...S.lab, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={useNotes} onChange={e => setUseNotes(e.target.checked)} /> use case notes as context</label>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={S.lab}>Sources</span>
            {allSources.map(s => <button key={s} style={S.chip(sources.includes(s))} disabled={avail.keyed[s] === false} title={avail.keyed[s] === false ? 'Needs an API key on the server' : ''} onClick={() => setSources(x => x.includes(s) ? x.filter(y => y !== s) : [...x, s])}>{s}{avail.keyed[s] === false ? ' · no key' : ''}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ ...S.lab, paddingTop: 8 }}>URLs</span>
            <textarea value={urls} onChange={e => setUrls(e.target.value)} placeholder="Optional: one https:// URL per line (advisories, articles, vendor reports). They are read on the server." style={{ ...S.ta, minHeight: 48, flex: 1 }} />
          </div>
          {mode === 'auto' ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button data-research-run="1" style={S.red} onClick={run} disabled={!!busy}>{busy ? 'Working…' : 'Research and propose cards'}</button>
              <span style={{ font: F.mono, color: '#8d877b' }}>{busy || msg}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button data-research-prompt="1" style={S.red} onClick={makePrompt} disabled={!!busy}>1 · Build and copy the prompt</button>
                <span style={{ font: F.mono, color: '#8d877b' }}>{busy || msg}</span>
              </div>
              {prompt ? <textarea readOnly value={prompt.text} style={{ ...S.ta, minHeight: 120, color: '#a39d90' }} onFocus={e => e.target.select()} /> : null}
              <div style={S.lab}>2 · Run it in Claude (claude.ai or the app), then paste the JSON answer here</div>
              <textarea data-research-paste="1" value={pasted} onChange={e => setPasted(e.target.value)} placeholder='{"summary": "...", "cards": [...], "threads": [...]}' style={S.ta} />
              <div><button data-research-parse="1" style={S.btn} onClick={parse} disabled={!pasted.trim() || !!busy}>3 · Check the answer</button></div>
            </div>
          )}
          {res ? (
            <div style={{ borderTop: '1px solid #232326', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ font: "13px/1.5 'Special Elite', monospace", color: '#f3f1ea', background: '#141416', padding: 10, border: '1px solid #232326' }}>{res.summary}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', font: F.mono, color: '#8d877b' }}>
                <span>{(res.sources || []).length} sources · {(res.cards || []).length} cards · {(res.threads || []).length} threads · engine {res.engine}</span>
                {(res.errors || []).map((e, i) => <span key={i} style={{ color: '#e8a71c' }}>{e}</span>)}
              </div>
              <details><summary style={{ ...S.lab, cursor: 'pointer' }}>Sources</summary>
                <ul style={{ margin: '6px 0 0 16px', padding: 0, font: F.mono }}>{(res.sources || []).map((s, i) => <li key={i} style={{ margin: '2px 0' }}><span style={{ color: '#8d877b' }}>[{i}] {s.provider} {s.date ? '· ' + s.date : ''} {s.read ? '· read' : ''}</span> <a href={s.url} target="_blank" rel="noopener" style={{ color: '#4ea1e8' }}>{s.title || s.url}</a>{s.error ? <span style={{ color: '#e8a71c' }}> · {s.error}</span> : null}</li>)}</ul>
              </details>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={S.lab}>Proposed cards</span>
                <button style={S.btn} onClick={() => toggleAll(true)}>All</button>
                <button style={S.btn} onClick={() => toggleAll(false)}>None</button>
                <label style={{ ...S.lab, display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', cursor: 'pointer' }}><input type="checkbox" checked={picked.__summary !== false} onChange={e => setPicked(p => ({ ...p, __summary: e.target.checked }))} /> also add a summary document with the source list</label>
              </div>
              <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #232326' }}>
                {Object.entries(grouped).map(([type, list]) => (
                  <div key={type}>
                    <div style={{ ...S.lab, padding: '8px 8px 4px', background: '#141416' }}>{TYPE_LABEL[type] || type} · {list.length}</div>
                    {list.map(([i, c]) => (
                      <label key={i} style={S.row}>
                        <input type="checkbox" checked={!!picked[i]} onChange={e => setPicked(p => ({ ...p, [i]: e.target.checked }))} />
                        <span style={{ font: F.mono, color: '#9a2b2b' }}>{c.kind || (c.date || '')}</span>
                        <span><b style={{ font: "13px 'Special Elite', monospace", color: '#f3f1ea' }}>{c.value || c.title}</b>{c.title && c.value ? ' · ' + c.title : ''}<div style={{ color: '#a39d90' }}>{c.body}</div></span>
                        <span style={{ font: F.mono, color: '#8d877b', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.url}>{c.source}</span>
                        <span style={{ font: F.mono, color: CONF_COLOR[c.confidence] }}>{c.confidence}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button data-research-inbox="1" style={S.red} onClick={() => doImport(false)}>Add selected to inbox</button>
                <button data-research-pin="1" style={S.btn} onClick={() => doImport(true)}>Pin selected to board</button>
                <span style={{ font: F.mono, color: '#8d877b', alignSelf: 'center' }}>Every card keeps its source, collection date and grade; review before stamping.</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Fab() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const k = e => { const t = e.target && e.target.tagName; if ((e.key === 'a' || e.key === 'A') && e.altKey && t !== 'INPUT' && t !== 'TEXTAREA') setOpen(true); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return <>
    <button data-research-open="1" style={S.fab} title="AI research: gather sources and propose cards for this case (Alt+A)" onClick={() => setOpen(true)}>◆ AI research</button>
    {open ? <Panel onClose={() => setOpen(false)} /> : null}
  </>;
}

export function mountResearch() {
  if (!window.CIBAuth || !window.CIBAuth.user() || window.CIBAuth.user().role === 'viewer' || window.CIBAuth.user().guest) return;
  const el = document.createElement('div'); el.id = 'cib-research'; document.body.appendChild(el);
  createRoot(el).render(<Fab />);
}
