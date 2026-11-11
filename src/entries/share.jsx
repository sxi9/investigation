// Public, read-only page for a shared case: opened from a share link (share.html#id:token), no login.
// Shows the brief-style summary, the storyboard when there is one, the exhibits by type, the chronology,
// and accepted comments; guests may leave a comment when the link allows it (it waits for moderation).
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const TLP = { '': ['TLP: unset', '#8d877b', '#fff'], clear: ['TLP:CLEAR', '#f3f1ea', '#1b1a17'], green: ['TLP:GREEN', '#3fae63', '#fff'], amber: ['TLP:AMBER', '#e8a71c', '#1b1a17'], 'amber+strict': ['TLP:AMBER+STRICT', '#e8a71c', '#1b1a17'], red: ['TLP:RED', '#ff2a3c', '#fff'] };
const TYPE = { photo: 'Photo', note: 'Note', link: 'Link', person: 'Person', indicator: 'Indicator', doc: 'Document', event: 'Event', location: 'Location', ttp: 'Technique', tx: 'Transfer', target: 'Target', video: 'Video', audio: 'Audio', pdf: 'PDF', email: 'Email', code: 'Log / code', feed: 'Live feed', monitor: 'Monitor', vehicle: 'Vehicle', object: 'Object', statement: 'Statement' };
const KIND = { domain: 'Domain', hostname: 'Hostname', ip: 'IP address', url: 'URL', hash: 'File hash', filename: 'File name', handle: 'Handle', email: 'Email', wallet: 'Wallet', cve: 'CVE', phone: 'Phone' };
const SCENE = { happened: 'What happened', found: 'What we found', assess: 'What we assess', ask: 'What we ask for' };
const COLOR = { indicator: '#ff2a3c', person: '#4ea1e8', event: '#e8a71c', location: '#4bbf6b', ttp: '#9b6bff', tx: '#2fc4b2', target: '#e07a2f', doc: '#b9b3a6', link: '#b9b3a6', note: '#f3e9a8' };
const F = { head: "11px 'Archivo Narrow', sans-serif", mono: "12px 'IBM Plex Mono', monospace", body: "14px/1.55 'Archivo Narrow', sans-serif", title: "30px 'Special Elite', monospace" };
const S = {
  page: { maxWidth: 920, margin: '0 auto', padding: '36px 28px 80px', color: '#1b1a17', fontFamily: "'Archivo Narrow', system-ui, sans-serif" },
  h2: { font: "12px 'Archivo Narrow', sans-serif", letterSpacing: '.22em', textTransform: 'uppercase', color: '#9a2b2b', borderBottom: '1px solid #1b1a17', paddingBottom: 4, margin: '30px 0 10px' },
  meta: { font: F.mono, color: '#6d675c', letterSpacing: '.06em' },
  tlp: (t) => ({ display: 'inline-block', padding: '3px 8px', background: TLP[t][1], color: TLP[t][2], font: F.head, letterSpacing: '.18em', textTransform: 'uppercase', marginRight: 10 }),
  card: (type) => ({ borderLeft: '4px solid ' + (COLOR[type] || '#b9b3a6'), background: '#fff', border: '1px solid #d9d6cd', padding: '8px 10px', marginBottom: 6 }),
  tag: { display: 'inline-block', padding: '0 6px', border: '1px solid #c9c4b6', font: F.head, letterSpacing: '.1em', color: '#6d675c', marginRight: 4 },
  input: { height: 32, padding: '0 8px', border: '1px solid #c9c4b6', background: '#fff', font: F.mono, width: '100%', boxSizing: 'border-box' },
  ta: { minHeight: 80, padding: 8, border: '1px solid #c9c4b6', background: '#fff', font: F.mono, width: '100%', boxSizing: 'border-box', resize: 'vertical' },
  btn: { height: 32, padding: '0 14px', border: '1px solid #1b1a17', background: '#1b1a17', color: '#f3f1ea', font: "11px 'Archivo Narrow', sans-serif", letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer' },
  scene: { border: '1px solid #1b1a17', background: '#fff', padding: '14px 16px', marginBottom: 12 },
  cm: { borderBottom: '1px solid #d9d6cd', padding: '8px 0', font: F.body },
};
const fmt = (d) => d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const defang = (v, kind) => kind === 'url' ? String(v || '').replace(/^http/i, 'hxxp').replace(/\./g, '[.]') : /^(domain|hostname|ip|email)$/.test(kind || '') ? String(v || '').replace(/\./g, '[.]') : String(v || '');

function Page() {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [form, setForm] = useState({ name: '', text: '', itemId: '' }); const [sent, setSent] = useState(''); const [busy, setBusy] = useState(false);
  const [id, token] = String(location.hash || '').slice(1).split(':');
  const load = async () => { try { const r = await fetch('/api/share/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token || '')); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); setState({ loading: false, error: '', data: j }); document.title = j.case.number + ' · ' + j.case.title; } catch (e) { setState({ loading: false, error: e.message, data: null }); } };
  useEffect(() => { if (!id) setState({ loading: false, error: 'No share link in the address', data: null }); else load(); }, []);
  const send = async () => { setBusy(true); setSent(''); try { const r = await fetch('/api/share/' + encodeURIComponent(id) + '/comments?token=' + encodeURIComponent(token || ''), { method: 'POST', headers: { 'content-type': 'application/json', 'X-Requested-With': 'CIB' }, body: JSON.stringify({ name: form.name, text: form.text, itemId: form.itemId || undefined }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); setSent('Thank you. Your comment is with the investigation team and appears here once accepted.'); setForm({ ...form, text: '' }); } catch (e) { setSent(e.message); } setBusy(false); };
  if (state.loading) return <div style={S.page}><div style={S.meta}>Opening the shared case…</div></div>;
  if (state.error) return <div style={S.page}><h1 style={{ font: F.title }}>Not available</h1><p style={{ font: F.body }}>{state.error}. Ask the person who sent you the link for a new one.</p></div>;
  const { share, case: c, comments } = state.data; const by = Object.fromEntries(c.items.map(i => [i.id, i]));
  const types = {}; for (const i of c.items) (types[i.type] = types[i.type] || []).push(i);
  const order = ['indicator', 'event', 'person', 'target', 'location', 'ttp', 'tx', 'doc', 'link', 'note'].concat(Object.keys(types).filter(t => !['indicator', 'event', 'person', 'target', 'location', 'ttp', 'tx', 'doc', 'link', 'note'].includes(t)));
  const dated = c.items.filter(i => i.date).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const label = (i) => (i.num ? 'E' + String(i.num).padStart(2, '0') + ' ' : '') + (i.title || (i.value ? defang(i.value, i.kind) : TYPE[i.type] || i.type));
  const cmFor = (itemId) => comments.filter(x => x.itemId === itemId);
  return <div style={S.page} data-share-page="1">
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={S.tlp(c.tlp in TLP ? c.tlp : '')}>{TLP[c.tlp in TLP ? c.tlp : ''][0]}</span><span style={S.meta}>{c.number} · SHARED CASE · {c.review.toUpperCase()} · updated {fmt((c.updatedAt || '').slice(0, 10))}{share.expiresAt ? ' · link expires ' + fmt(share.expiresAt.slice(0, 10)) : ''}</span></div>
    <h1 style={{ font: F.title, margin: '8px 0 6px' }}>{c.title}</h1>
    {c.summary ? <p style={{ font: F.body, margin: 0 }}>{c.summary}</p> : null}
    <div style={{ ...S.meta, marginTop: 6 }}>{c.items.length} exhibits · {c.threads.length} threads{c.signoff ? ' · signed ' + c.signoff : ''} · read-only view prepared by the investigation team</div>
    {c.story && c.story.scenes.length ? <>
      <h2 style={S.h2}>Storyboard</h2>
      {c.story.scenes.map((sc, n) => <div key={sc.id} style={S.scene} data-share-scene="1">
        <div style={S.meta}>SCENE {n + 1} · {SCENE[sc.kind] || sc.kind}{sc.from ? ' · ' + fmt(sc.from) + (sc.to && sc.to !== sc.from ? ' → ' + fmt(sc.to) : '') : ''}</div>
        <div style={{ font: "18px 'Special Elite', monospace", margin: '4px 0' }}>{sc.title}</div>
        <div style={{ font: F.body, whiteSpace: 'pre-wrap' }}>{sc.caption}</div>
        {sc.items.length ? <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{sc.items.map(iid => by[iid] ? <span key={iid} style={{ ...S.tag, borderColor: COLOR[by[iid].type] || '#c9c4b6' }}>{label(by[iid])}</span> : null)}</div> : null}
      </div>)}
    </> : null}
    {dated.length ? <><h2 style={S.h2}>Chronology</h2><table style={{ width: '100%', borderCollapse: 'collapse', font: F.body }}><tbody>{dated.map(i => <tr key={i.id} style={{ borderBottom: '1px solid #d9d6cd' }}><td style={{ ...S.meta, padding: '4px 6px', whiteSpace: 'nowrap' }}>{fmt(i.date)}{i.time ? ' ' + i.time : ''}</td><td style={{ padding: '4px 6px' }}>{label(i)}</td><td style={{ ...S.meta, padding: '4px 6px' }}>{TYPE[i.type] || i.type}</td></tr>)}</tbody></table></> : null}
    {order.filter(t => types[t]).map(t => <div key={t}>
      <h2 style={S.h2}>{TYPE[t] || t} · {types[t].length}</h2>
      {types[t].sort((a, b) => (a.num || 0) - (b.num || 0)).map(i => <div key={i.id} style={S.card(i.type)} data-share-card={i.id}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}><span style={{ font: "15px 'Special Elite', monospace" }}>{label(i)}</span>{i.type === 'indicator' && i.kind ? <span style={S.tag}>{KIND[i.kind] || i.kind}</span> : null}{i.status ? <span style={{ ...S.tag, color: i.status === 'confirmed' ? '#3fae63' : '#6d675c' }}>{i.status}</span> : null}{i.date ? <span style={S.meta}>{fmt(i.date)}{i.time ? ' ' + i.time : ''}</span> : null}</div>
        {i.value && i.title && (i.type === 'indicator' || i.type === 'ttp' || i.type === 'tx') ? <div style={S.meta}>{defang(i.value, i.kind)}</div> : null}
        {i.body ? <div style={{ font: F.body, whiteSpace: 'pre-wrap', marginTop: 4 }}>{i.body}</div> : null}
        {i.url ? <div style={S.meta}><a href={i.url} target="_blank" rel="noreferrer noopener" style={{ color: '#9a2b2b' }}>{i.url}</a></div> : null}
        <div style={{ marginTop: 4 }}>{String(i.tags || '').split(/[,\s]+/).filter(Boolean).map(tg => <span key={tg} style={S.tag}>#{tg}</span>)}{i.source ? <span style={S.meta}>source: {i.source}{i.srcGrade ? ' · ' + i.srcGrade + (i.infoGrade || '') : ''}</span> : null}</div>
        {cmFor(i.id).length ? <div style={{ marginTop: 6, borderTop: '1px dashed #d9d6cd', paddingTop: 4 }}>{cmFor(i.id).map(x => <div key={x.id} style={{ font: F.body }}><b>{x.author}</b> <span style={S.meta}>{fmt(x.createdAt.slice(0, 10))}</span> · {x.text}{x.reply ? <div style={{ ...S.meta, paddingLeft: 10 }}>↳ team: {x.reply}</div> : null}</div>)}</div> : null}
      </div>)}
    </div>)}
    {c.hypotheses.length ? <><h2 style={S.h2}>Hypotheses under test</h2><ul style={{ font: F.body }}>{c.hypotheses.map(h => <li key={h.id}>{h.text}</li>)}</ul></> : null}
    <h2 style={S.h2}>Comments · {comments.length}</h2>
    {comments.filter(x => !x.itemId).map(x => <div key={x.id} style={S.cm} data-share-comment="1"><b>{x.author}</b> <span style={S.meta}>{x.authorKind === 'guest' ? 'guest' : 'team'} · {fmt(x.createdAt.slice(0, 10))}</span><div>{x.text}</div>{x.reply ? <div style={{ ...S.meta, paddingLeft: 10 }}>↳ team: {x.reply}</div> : null}</div>)}
    {!comments.length ? <div style={S.meta}>No comments yet.</div> : null}
    {share.allowComments ? <div style={{ marginTop: 14, background: '#fff', border: '1px solid #d9d6cd', padding: 12 }} data-share-form="1">
      <div style={{ ...S.meta, marginBottom: 6 }}>LEAVE A COMMENT · it is read by the team before it appears here</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}><input data-share-name="1" placeholder="your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} /><select value={form.itemId} onChange={e => setForm({ ...form, itemId: e.target.value })} style={S.input}><option value="">about the case as a whole</option>{c.items.map(i => <option key={i.id} value={i.id}>{label(i).slice(0, 60)}</option>)}</select></div>
      <textarea data-share-text="1" placeholder="what you know, what looks wrong, what you can add" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} style={S.ta} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}><button data-share-send="1" style={S.btn} disabled={busy || !form.name.trim() || !form.text.trim()} onClick={send}>Send</button><span style={S.meta}>{sent}</span></div>
    </div> : <div style={S.meta}>This link is read-only.</div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<Page />);
