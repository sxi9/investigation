// Storyboard overlay: the case as scenes (what happened, what we found, what we assess, what we ask for), each backed by
// cards. Built from the timeline or drafted by the model, edited here, played full screen, printed one scene per page.
// Stored on the case document as cs.story = { scenes: [...] } so it syncs, versions and reaches the brief and the public page.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';

const F = { mono: "11px 'IBM Plex Mono', monospace", ui: "13px 'Archivo Narrow', sans-serif", head: "10px 'Archivo Narrow', sans-serif", title: "22px 'Special Elite', monospace" };
const KINDS = [['happened', 'What happened', '#e8a71c'], ['found', 'What we found', '#4ea1e8'], ['assess', 'What we assess', '#9b6bff'], ['ask', 'What we ask for', '#4bbf6b']];
const KIND = Object.fromEntries(KINDS.map(k => [k[0], k]));
const COLOR = { person: '#ff2a3c', indicator: '#e8a71c', link: '#4ea1e8', location: '#4bbf6b', event: '#f1ede2', doc: '#b9b3a6', note: '#f3e58c', photo: '#8c8cf0', ttp: '#9b6bff', tx: '#2fc4b2', target: '#e07a2f' };
const S = {
  wrap: { position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.78)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 24 },
  panel: { width: 'min(1240px, 100%)', display: 'grid', gridTemplateColumns: '300px 1fr', gridTemplateRows: 'auto 1fr', background: '#0e0e10', border: '1px solid #2c2c31', borderTop: '3px solid #e8a71c', color: '#e8e4da', fontFamily: "'Archivo Narrow', system-ui, sans-serif", boxShadow: '0 30px 60px rgba(0,0,0,.8)', minHeight: 0 },
  bar: { gridColumn: '1 / 3', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #232326', flexWrap: 'wrap' },
  h: { font: "13px 'Archivo Narrow', sans-serif", letterSpacing: '.22em', textTransform: 'uppercase', color: '#f3f1ea', marginRight: 8 },
  btn: { height: 28, padding: '0 10px', border: '1px solid #2c2c31', background: '#17171a', color: '#d8d3c7', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' },
  gold: { height: 28, padding: '0 12px', border: '1px solid #e8a71c', background: '#2a2110', color: '#ffe2a0', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' },
  list: { borderRight: '1px solid #232326', overflow: 'auto', minHeight: 0 },
  scene: (on, color) => ({ padding: '10px 12px', borderBottom: '1px solid #1c1c20', borderLeft: '3px solid ' + color, background: on ? '#1a1a1e' : 'transparent', cursor: 'pointer' }),
  editor: { padding: 16, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  lab: { font: F.head, letterSpacing: '.2em', color: '#8d877b', textTransform: 'uppercase' },
  inp: { height: 30, padding: '0 8px', border: '1px solid #2c2c31', background: '#0c0c0e', color: '#e8e4da', font: F.mono, minWidth: 0 },
  ta: { minHeight: 120, padding: 8, border: '1px solid #2c2c31', background: '#0c0c0e', color: '#e8e4da', font: "13px/1.5 'IBM Plex Mono', monospace", resize: 'vertical' },
  tile: (t) => ({ borderLeft: '4px solid ' + (COLOR[t] || '#b9b3a6'), background: '#f3f1ea', color: '#1b1a17', padding: '6px 8px', font: "12px/1.35 'Archivo Narrow', sans-serif", width: 200, boxShadow: '0 4px 10px rgba(0,0,0,.5)', position: 'relative' }),
  play: { position: 'fixed', inset: 0, zIndex: 80, background: '#0b0b0c', color: '#f3f1ea', display: 'flex', flexDirection: 'column', padding: '48px 72px', fontFamily: "'Archivo Narrow', system-ui, sans-serif" },
};
const uid = () => 's' + Math.random().toString(36).slice(2, 10);
const logic = () => window.CIBPage || null;
const cs = () => { const L = logic(); try { return L && L.cs ? L.cs() : null; } catch (e) { return null; } };
const toast = (m) => { const L = logic(); if (L && L.toast) L.toast(m); };
const labelOf = (i) => { const L = logic(); return (i.num ? 'E' + String(i.num).padStart(2, '0') + ' ' : '') + (L && L.itemLabel ? L.itemLabel(i) : (i.title || i.value || i.type)); };
const fmt = (d) => { const L = logic(); return d ? (L && L.fmtDate ? L.fmtDate(d) : d) : ''; };
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function Tile({ it, onRemove }) {
  return <div style={S.tile(it.type)} data-story-tile={it.id}>
    <div style={{ font: F.head, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6d675c' }}>{it.type}{it.kind && it.type === 'indicator' ? ' · ' + it.kind : ''}{it.date ? ' · ' + fmt(it.date) : ''}</div>
    <div style={{ font: "13px 'Special Elite', monospace" }}>{labelOf(it)}</div>
    {it.body ? <div style={{ color: '#3b3a36', overflow: 'hidden', maxHeight: 48 }}>{String(it.body).slice(0, 110)}</div> : null}
    {onRemove ? <button onClick={onRemove} title="Remove from the scene" style={{ position: 'absolute', top: 2, right: 4, border: 'none', background: 'transparent', color: '#9a2b2b', cursor: 'pointer', font: F.mono }}>×</button> : null}
  </div>;
}

function Play({ scenes, byId, start, onClose }) {
  const [i, setI] = useState(start || 0);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight' || e.key === ' ') setI(x => Math.min(scenes.length - 1, x + 1)); if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1)); }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, []);
  const sc = scenes[i]; if (!sc) return null; const kind = KIND[sc.kind] || KIND.happened;
  return <div style={S.play} data-story-stage="1">
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', font: F.mono, color: '#8d877b', letterSpacing: '.14em' }}><span style={{ color: kind[2] }}>■</span> SCENE {i + 1} / {scenes.length} · {kind[1].toUpperCase()}{sc.from ? ' · ' + fmt(sc.from) + (sc.to && sc.to !== sc.from ? ' → ' + fmt(sc.to) : '') : ''}<span style={{ flex: 1 }} /><button style={S.btn} onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>◀</button><button style={S.btn} onClick={() => setI(Math.min(scenes.length - 1, i + 1))} disabled={i === scenes.length - 1}>▶</button><button style={S.btn} onClick={onClose}>Esc · Close</button></div>
    <div style={{ font: "44px 'Special Elite', monospace", margin: '28px 0 12px', maxWidth: 1000 }}>{sc.title}</div>
    <div style={{ font: "20px/1.5 'Archivo Narrow', sans-serif", maxWidth: 980, whiteSpace: 'pre-wrap', color: '#e8e4da' }}>{sc.caption}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 'auto', paddingTop: 24 }}>{(sc.items || []).map(id => byId[id]).filter(Boolean).map(it => <Tile key={it.id} it={it} />)}</div>
  </div>;
}

function Panel({ onClose }) {
  const L = logic(); const c0 = cs();
  const [scenes, setScenes] = useState((c0 && c0.story && c0.story.scenes) || []);
  const [cur, setCur] = useState(0); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [playing, setPlaying] = useState(false); const [pick, setPick] = useState('');
  const c = cs() || c0; const items = (c.items || []).filter(i => i.pinned); const byId = Object.fromEntries((c.items || []).map(i => [i.id, i])); const canEdit = L && L.canEditCase ? L.canEditCase() : true;
  const save = (next) => { setScenes(next); if (L && L.upCase) L.upCase(x => ({ ...x, story: { scenes: next } })); };
  const sc = scenes[cur]; const set = (patch) => save(scenes.map((s, i) => i === cur ? { ...s, ...patch } : s));
  const add = () => { const n = { id: uid(), title: 'New scene', kind: 'happened', from: '', to: '', caption: '', items: [] }; save([...scenes, n]); setCur(scenes.length); };
  const del = () => { if (!sc || !window.confirm('Delete scene "' + sc.title + '"?')) return; const next = scenes.filter((_, i) => i !== cur); save(next); setCur(Math.max(0, cur - 1)); };
  const move = (d) => { const j = cur + d; if (j < 0 || j >= scenes.length) return; const next = [...scenes]; [next[cur], next[j]] = [next[j], next[cur]]; save(next); setCur(j); };
  const addSel = () => { const id = L && L.state.sel; if (!id || !byId[id]) return toast('Select a card on the board first'); if ((sc.items || []).includes(id)) return; set({ items: [...(sc.items || []), id] }); };
  const addPick = (id) => { if (!id || (sc.items || []).includes(id)) return; set({ items: [...(sc.items || []), id] }); setPick(''); };
  const fromDraft = (drafted, replace) => { const byNum = Object.fromEntries((c.items || []).filter(i => i.num).map(i => [i.num, i.id])); const next = drafted.map(d => ({ id: uid(), title: d.title, kind: d.kind, from: d.from || '', to: d.to || '', caption: d.caption || '', items: (d.exhibits || []).map(n => byNum[n]).filter(Boolean) })); save(replace ? next : [...scenes, ...next]); setCur(replace ? 0 : scenes.length); };
  const build = () => { const dated = items.filter(i => i.date && i.status !== 'false').sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))); if (!dated.length) return toast('No dated cards on the board yet'); const days = []; for (const i of dated) { const d = days[days.length - 1]; if (d && d.date === i.date) d.items.push(i); else days.push({ date: i.date, items: [i] }); } let groups = days; if (days.length > 8) { const per = Math.ceil(days.length / 8); groups = []; for (let k = 0; k < days.length; k += per) { const ch = days.slice(k, k + per); groups.push({ date: ch[0].date, to: ch[ch.length - 1].date, items: ch.flatMap(x => x.items) }); } }
    const drafted = groups.map(g => ({ title: labelOf(g.items[0]).replace(/^E\d+ /, '') + (g.items.length > 1 ? ' and ' + (g.items.length - 1) + ' more' : ''), kind: 'happened', from: g.date, to: g.to || g.date, caption: g.items.map(i => (i.time ? i.time + ' — ' : '') + labelOf(i).replace(/^E\d+ /, '') + (i.body ? ': ' + String(i.body).replace(/\s+/g, ' ').slice(0, 140) : '')).join('\n'), exhibits: g.items.map(i => i.num).filter(Boolean) }));
    const df = (i) => L.defang ? L.defang(i.value, i.kind) : i.value; const inds = items.filter(i => i.type === 'indicator' && i.status !== 'false'); const conf = inds.filter(i => i.status === 'confirmed'); const ttps = items.filter(i => i.type === 'ttp'); const actors = items.filter(i => i.type === 'person' && /actor/i.test(i.tags || ''));
    if (inds.length || ttps.length) drafted.push({ title: 'What the evidence shows', kind: 'found', caption: [inds.length ? inds.length + ' indicators (' + conf.length + ' confirmed)' + (conf.length ? ': ' + conf.slice(0, 6).map(df).join(', ') : '') : '', ttps.length ? 'Techniques: ' + ttps.map(t => labelOf(t).replace(/^E\d+ /, '')).slice(0, 6).join(', ') : ''].filter(Boolean).join('\n'), exhibits: [...conf.slice(0, 6), ...ttps.slice(0, 6)].map(i => i.num).filter(Boolean) });
    if ((c.judgement && c.judgement.text) || actors.length) drafted.push({ title: 'Assessment', kind: 'assess', caption: [(c.judgement && c.judgement.text) || '', actors.length ? 'Attributed to ' + actors.map(a2 => a2.title).join(', ') + (c.judgement && c.judgement.conf ? ' (' + c.judgement.conf + ' confidence)' : '') : ''].filter(Boolean).join('\n'), exhibits: actors.map(i => i.num).filter(Boolean) });
    const open = items.flatMap(i => (i.todo || []).filter(t => !t.done).map(t => t.text)); if (conf.length || open.length) drafted.push({ title: 'What we ask for', kind: 'ask', caption: [conf.length ? 'Block or take down: ' + conf.slice(0, 8).map(df).join(', ') : '', open.length ? 'Open actions: ' + open.slice(0, 5).join('; ') : ''].filter(Boolean).join('\n'), exhibits: conf.slice(0, 8).map(i => i.num).filter(Boolean) });
    fromDraft(drafted, !scenes.length || window.confirm('Replace the ' + scenes.length + ' existing scene(s)? Cancel appends instead.')); setMsg(drafted.length + ' scenes built from the timeline.'); };
  const ai = async () => { setBusy('Drafting…'); setMsg(''); try { const r = await api('POST', '/api/ai/draft', { case: c, kind: 'story' }); fromDraft(r.scenes, !scenes.length || window.confirm('Replace the ' + scenes.length + ' existing scene(s)? Cancel appends instead.')); setMsg(r.scenes.length + ' scenes drafted (' + r.engine + ').'); if (L && L.logEvt) L.logEvt('AI drafted ' + r.scenes.length + ' story scenes (' + r.engine + ')'); } catch (e) { setMsg(e.message); } setBusy(''); };
  const print = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print the storyboard');
    const tile = (it) => '<div class="tile" style="border-left-color:' + (COLOR[it.type] || '#b9b3a6') + '"><div class="k">' + esc(it.type) + (it.date ? ' · ' + esc(fmt(it.date)) : '') + '</div><div class="t">' + esc(labelOf(it)) + '</div>' + (it.body ? '<div class="b">' + esc(String(it.body).slice(0, 160)) + '</div>' : '') + '</div>';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(c.number + ' · Storyboard') + '</title><style>body{margin:0;background:#f4f2ec;color:#1b1a17;font:14px/1.5 "Archivo Narrow",sans-serif}.page{max-width:900px;margin:0 auto;padding:40px 48px;page-break-after:always;min-height:90vh}.meta{font:11px "IBM Plex Mono",monospace;color:#6d675c;letter-spacing:.08em}h1{font:30px "Special Elite",monospace;margin:4px 0 12px}h2{font:34px "Special Elite",monospace;margin:6px 0 14px}p{white-space:pre-wrap;font-size:16px}.tiles{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.tile{width:200px;background:#fff;border:1px solid #d9d6cd;border-left:4px solid #b9b3a6;padding:6px 8px;font-size:12px}.k{font:10px "Archivo Narrow",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6d675c}.t{font:13px "Special Elite",monospace}.b{color:#3b3a36}@media print{.page{min-height:auto}}</style></head><body>'
      + '<div class="page"><div class="meta">' + esc(c.number) + ' · STORYBOARD · ' + new Date().toISOString().slice(0, 10) + (c.tlp ? ' · TLP:' + esc(String(c.tlp).toUpperCase()) : '') + '</div><h1>' + esc(c.title) + '</h1><p>' + esc(c.judgement && c.judgement.text || '') + '</p><ol>' + scenes.map(s => '<li>' + esc(s.title) + ' <span class="meta">' + esc((KIND[s.kind] || KIND.happened)[1]) + '</span></li>').join('') + '</ol></div>'
      + scenes.map((s, n) => '<div class="page"><div class="meta">SCENE ' + (n + 1) + ' OF ' + scenes.length + ' · ' + esc((KIND[s.kind] || KIND.happened)[1].toUpperCase()) + (s.from ? ' · ' + esc(fmt(s.from)) + (s.to && s.to !== s.from ? ' → ' + esc(fmt(s.to)) : '') : '') + '</div><h2>' + esc(s.title) + '</h2><p>' + esc(s.caption) + '</p><div class="tiles">' + (s.items || []).map(id => byId[id]).filter(Boolean).map(tile).join('') + '</div></div>').join('') + '</body></html>';
    w.document.open(); w.document.write(html); w.document.close(); if (L && L.logEvt) L.logEvt('Storyboard printed (' + scenes.length + ' scenes)');
  };
  return <div style={S.wrap} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    {playing ? <Play scenes={scenes} byId={byId} start={cur} onClose={() => setPlaying(false)} /> : null}
    <div style={S.panel} role="dialog" aria-label="Storyboard">
      <div style={S.bar}>
        <span style={S.h}>Storyboard · {c.number}</span>
        <button data-story-build="1" style={S.gold} onClick={build} disabled={!canEdit}>Build from timeline</button>
        <button data-story-ai="1" style={S.gold} onClick={ai} disabled={!canEdit || !!busy}>{busy || 'Draft with AI'}</button>
        <button data-story-add="1" style={S.btn} onClick={add} disabled={!canEdit}>+ Scene</button>
        <span style={{ flex: 1, font: F.mono, color: '#8d877b' }}>{msg}</span>
        <button data-story-play="1" style={S.btn} onClick={() => setPlaying(true)} disabled={!scenes.length}>▶ Play</button>
        <button data-story-print="1" style={S.btn} onClick={print} disabled={!scenes.length}>Print</button>
        <button style={S.btn} onClick={onClose}>Close</button>
      </div>
      <div style={S.list} data-story-list="1">
        {scenes.map((s, i) => <div key={s.id} data-story-scene={s.id} style={S.scene(i === cur, (KIND[s.kind] || KIND.happened)[2])} onClick={() => setCur(i)}>
          <div style={{ font: F.head, letterSpacing: '.16em', color: '#8d877b', textTransform: 'uppercase' }}>{i + 1} · {(KIND[s.kind] || KIND.happened)[1]}{s.from ? ' · ' + fmt(s.from) : ''}</div>
          <div style={{ font: "14px 'Special Elite', monospace", color: '#f3f1ea' }}>{s.title || 'Untitled scene'}</div>
          <div style={{ font: F.mono, color: '#8d877b' }}>{(s.items || []).length} cards</div>
        </div>)}
        {!scenes.length ? <div style={{ padding: 14, font: F.ui, color: '#8d877b' }}>No scenes yet. Build them from the timeline, draft them with the model, or add one by hand.</div> : null}
      </div>
      <div style={S.editor} data-story-editor="1">
        {sc ? <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input data-story-title="1" value={sc.title} onChange={e => set({ title: e.target.value })} placeholder="Scene title" style={{ ...S.inp, flex: '1 1 300px', font: F.title, height: 40 }} disabled={!canEdit} />
            <select data-story-kind="1" value={sc.kind} onChange={e => set({ kind: e.target.value })} style={S.inp} disabled={!canEdit}>{KINDS.map(k => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</select>
            <input type="date" value={sc.from || ''} onChange={e => set({ from: e.target.value })} style={S.inp} disabled={!canEdit} /><span style={S.lab}>to</span><input type="date" value={sc.to || ''} onChange={e => set({ to: e.target.value })} style={S.inp} disabled={!canEdit} />
          </div>
          <textarea data-story-caption="1" value={sc.caption} onChange={e => set({ caption: e.target.value })} placeholder="What a reader should take from this scene. Cite exhibits by number (E12)." style={S.ta} disabled={!canEdit} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={S.lab}>Cards in this scene · {(sc.items || []).length}</span>
            <button data-story-addsel="1" style={S.btn} onClick={addSel} disabled={!canEdit}>Add selected card</button>
            <select data-story-pick="1" value={pick} onChange={e => addPick(e.target.value)} style={{ ...S.inp, maxWidth: 320 }} disabled={!canEdit}><option value="">add a card…</option>{items.filter(i => !(sc.items || []).includes(i.id)).map(i => <option key={i.id} value={i.id}>{labelOf(i).slice(0, 70)}</option>)}</select>
            <span style={{ flex: 1 }} />
            <button style={S.btn} onClick={() => move(-1)} disabled={cur === 0}>▲</button><button style={S.btn} onClick={() => move(1)} disabled={cur >= scenes.length - 1}>▼</button><button data-story-del="1" style={{ ...S.btn, borderColor: '#5a2a2e', color: '#ff8a94' }} onClick={del} disabled={!canEdit}>Delete</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{(sc.items || []).map(id => byId[id]).filter(Boolean).map(it => <Tile key={it.id} it={it} onRemove={canEdit ? () => set({ items: sc.items.filter(x => x !== it.id) }) : null} />)}</div>
        </> : <div style={{ font: F.ui, color: '#8d877b' }}>Pick a scene on the left, or build the story from the timeline.</div>}
      </div>
    </div>
  </div>;
}

function Host() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const on = () => setOpen(o => !o); window.addEventListener('cib:story', on); return () => window.removeEventListener('cib:story', on); }, []);
  return open ? <Panel onClose={() => setOpen(false)} /> : null;
}
export function mountStory() {
  if (document.getElementById('cib-story')) return;
  const el = document.createElement('div'); el.id = 'cib-story'; document.body.appendChild(el);
  createRoot(el).render(<Host />);
}
