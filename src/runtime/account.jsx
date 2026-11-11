// Account and operations overlay: two-factor setup for the signed-in person; for admins backups, retention,
// legal holds, personal-data export and second-factor resets. Mounted beside the generated pages.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';

const F = { mono: "11px 'IBM Plex Mono', monospace", ui: "12px 'Archivo Narrow', sans-serif", head: "10px 'Archivo Narrow', sans-serif" };
const S = {
  pill: (page) => ({ position: 'fixed', right: page === 'desk' ? 16 : 128, bottom: 56, zIndex: 60, height: 32, padding: '0 10px', border: '1px solid #2c2c31', background: '#17171a', color: '#d8d3c7', font: F.head, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 6px 14px rgba(0,0,0,.6)' }),
  drawer: { position: 'fixed', right: 16, bottom: 96, zIndex: 62, width: 420, maxHeight: '70vh', overflow: 'auto', background: '#0e0e10', border: '1px solid #2c2c31', borderTop: '3px solid #e8a71c', color: '#e8e4da', fontFamily: "'Archivo Narrow', system-ui, sans-serif", boxShadow: '0 30px 60px rgba(0,0,0,.8)' },
  h: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #232326', font: "12px 'Archivo Narrow', sans-serif", letterSpacing: '.2em', textTransform: 'uppercase', color: '#f3f1ea' },
  tab: (on) => ({ height: 24, padding: '0 8px', border: '1px solid ' + (on ? '#e8a71c' : '#2c2c31'), background: on ? '#2a2110' : '#17171a', color: on ? '#ffe2a0' : '#d8d3c7', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }),
  btn: { height: 24, padding: '0 8px', border: '1px solid #2c2c31', background: '#17171a', color: '#d8d3c7', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' },
  danger: { height: 24, padding: '0 8px', border: '1px solid #ff2a3c', background: '#2a1012', color: '#ffb3b9', font: F.head, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' },
  inp: { height: 26, padding: '0 8px', border: '1px solid #2c2c31', background: '#141416', color: '#e8e4da', font: F.mono, flex: 1, minWidth: 0 },
  row: { display: 'flex', gap: 6, alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #1c1c20', font: F.ui },
  lab: { font: F.head, letterSpacing: '.2em', color: '#8d877b', textTransform: 'uppercase', padding: '10px 12px 4px' },
  note: { padding: '6px 12px', font: F.mono, color: '#8d877b', lineHeight: 1.5 },
  code: { font: "13px 'IBM Plex Mono', monospace", letterSpacing: '.12em', color: '#ffe2a0', wordBreak: 'break-all' },
};
const toast = (m) => window.CIBAuth && window.CIBAuth.toast(m);
const when = (t) => { try { return new Date(t).toLocaleString(); } catch (e) { return t; } };
const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';

function Security() {
  const A = window.CIBAuth; const [me, setMe] = useState(A.user());
  const [setup, setSetup] = useState(null); const [code, setCode] = useState(''); const [pass, setPass] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => A.onChange(() => setMe(A.user())), []);
  if (!me || me.guest) return <div style={S.note}>Guests have no account settings.</div>;
  const start = async () => { setBusy(true); try { setSetup(await A.totpSetup()); } catch (e) { toast(e.message); } setBusy(false); };
  const confirm = async () => { setBusy(true); try { await A.totpConfirm(code); setSetup(null); setCode(''); toast('Two-factor authentication is on'); } catch (e) { toast(e.message); } setBusy(false); };
  const disable = async () => { if (!window.confirm('Turn off two-factor authentication for your account?')) return; setBusy(true); try { await A.totpDisable(pass); setPass(''); toast('Two-factor authentication is off'); } catch (e) { toast(e.message); } setBusy(false); };
  return <div>
    <div style={S.lab}>Signed in as</div>
    <div style={S.row}><span>{me.name}</span><span style={{ color: '#8d877b' }}>· {me.role}{me.email ? ' · ' + me.email : ''}{me.sso ? ' · single sign-on' : ''}</span></div>
    <div style={S.lab}>Two-factor authentication (TOTP)</div>
    {me.sso && !me.totp ? <div style={S.note}>Your identity provider handles sign-in for this account; set a second factor there.</div> : null}
    {me.totp ? <div>
      <div style={S.note}>On. Every sign-in asks for a six-digit code from your authenticator app after the password.</div>
      <div style={S.row}><input type="password" placeholder="current password to turn it off" value={pass} onChange={e => setPass(e.target.value)} style={S.inp} autoComplete="current-password" /><button data-totp-off="1" style={S.danger} onClick={disable} disabled={busy}>Turn off</button></div>
    </div> : setup ? <div>
      <div style={S.note}>Scan the code with Google Authenticator, Authy, 1Password or any TOTP app, or type the secret by hand. Then enter the six digits it shows to confirm.</div>
      <div style={{ padding: '4px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {setup.svg ? <div data-totp-qr="1" style={{ width: 150, height: 150, background: '#fff', padding: 4, flex: 'none' }} dangerouslySetInnerHTML={{ __html: setup.svg }} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}><div style={S.lab.font ? { ...S.lab, padding: '0 0 4px' } : {}}>Secret</div><div style={S.code}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</div><div style={{ ...S.note, padding: '6px 0 0' }}>SHA-1 · 6 digits · 30 seconds</div></div>
      </div>
      <div style={S.row}><input data-totp-code="1" inputMode="numeric" placeholder="123456" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirm(); }} style={S.inp} autoComplete="one-time-code" /><button data-totp-confirm="1" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} onClick={confirm} disabled={busy || code.length < 6}>Confirm and turn on</button><button style={S.btn} onClick={() => setSetup(null)}>Cancel</button></div>
    </div> : <div>
      <div style={S.note}>Off. A second factor protects the account if the password leaks. Recommended for every admin.</div>
      <div style={S.row}><button data-totp-setup="1" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} onClick={start} disabled={busy}>Set up two-factor authentication</button></div>
    </div>}
    <div style={S.lab}>Session</div>
    <div style={S.note}>Sessions last 12 hours and lock after 15 minutes idle. Signing out on any page ends the server session; the cookie is HttpOnly and SameSite=Strict.</div>
  </div>;
}

function Operations() {
  const A = window.CIBAuth;
  const [backups, setBackups] = useState([]); const [holds, setHolds] = useState([]); const [users, setUsers] = useState([]);
  const [person, setPerson] = useState(''); const [pd, setPd] = useState(null); const [days, setDays] = useState('30'); const [busy, setBusy] = useState('');
  const load = async () => { try { const [b, h, u] = await Promise.all([api('GET', '/api/admin/backups'), api('GET', '/api/admin/holds'), api('GET', '/api/users')]); setBackups(b.backups); setHolds(h.cases); setUsers(u.users); } catch (e) { toast(e.message); } };
  useEffect(() => { load(); }, []);
  const backup = async () => { setBusy('backup'); try { const r = await api('POST', '/api/admin/backup'); toast('Backup written: ' + r.name); await load(); } catch (e) { toast(e.message); } setBusy(''); };
  const purge = async () => { if (!window.confirm('Permanently delete wastebasket cases older than ' + days + ' days (legal holds are skipped)?')) return; setBusy('purge'); try { const r = await api('POST', '/api/admin/purge', { days: Number(days) }); toast(r.purged + ' case(s) purged'); } catch (e) { toast(e.message); } setBusy(''); };
  const hold = async (c) => { try { const r = await api('POST', '/api/admin/holds/' + encodeURIComponent(c.id), { on: !c.legalHold }); if (window.CIBStore && window.CIBStore.patchLocal) window.CIBStore.patchLocal(c.id, { legalHold: r.case.legalHold, rev: r.case.rev }); toast((c.legalHold ? 'Legal hold cleared on ' : 'Legal hold set on ') + c.number); await load(); } catch (e) { toast(e.message); } };
  const lookup = async () => { setBusy('person'); try { setPd(await api('GET', '/api/admin/person-data?name=' + encodeURIComponent(person))); } catch (e) { toast(e.message); } setBusy(''); };
  const download = () => { const blob = new Blob([JSON.stringify(pd, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'personal-data-' + pd.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const resetTotp = async (u) => { if (!window.confirm('Turn off two-factor authentication for ' + u.name + '? They can set it up again after signing in.')) return; try { await A.adminTotpDisable(u.id); toast('Second factor removed for ' + u.name); await load(); } catch (e) { toast(e.message); } };
  const count = (h) => h.personCards.length + h.comments.length + h.tasks.length + h.logLines.length;
  return <div>
    <div style={S.lab}>Backups · data/backups</div>
    <div style={S.row}><button data-backup-now="1" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} onClick={backup} disabled={busy === 'backup'}>{busy === 'backup' ? 'Writing…' : 'Back up now'}</button><span style={{ color: '#8d877b', font: F.mono }}>consistent SQLite snapshot · nightly by default · last 14 kept</span></div>
    {backups.slice(0, 5).map(b => <div key={b.name} style={S.row}><span style={{ font: F.mono, flex: 1 }}>{b.name}</span><span style={{ color: '#8d877b', font: F.mono }}>{kb(b.size)}</span></div>)}
    {!backups.length ? <div style={S.note}>No backups yet.</div> : null}
    <div style={S.lab}>Retention</div>
    <div style={S.row}><span>Purge wastebasket cases older than</span><input data-purge-days="1" value={days} onChange={e => setDays(e.target.value.replace(/\D/g, ''))} style={{ ...S.inp, flex: 'none', width: 48 }} /><span>days</span><button data-purge-now="1" style={S.danger} onClick={purge} disabled={busy === 'purge'}>Run now</button></div>
    <div style={S.note}>Runs every six hours on the server (CIB_RETENTION_DAYS, default 30). Cases on legal hold are never purged.</div>
    <div style={S.lab}>Legal hold</div>
    {holds.map(c => <div key={c.id} style={S.row}><span style={{ font: F.mono, color: '#8d877b' }}>{c.number}</span><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>{c.legalHold ? <span style={{ font: F.head, letterSpacing: '.12em', color: '#ffe2a0' }}>HELD</span> : null}<button data-hold={c.id} style={c.legalHold ? S.btn : { ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} onClick={() => hold(c)}>{c.legalHold ? 'Release' : 'Hold'}</button></div>)}
    <div style={S.note}>A held case cannot be deleted from the desk or the board, is skipped by retention, and the hold is logged on the case and in the audit trail.</div>
    <div style={S.lab}>Personal data · subject access</div>
    <div style={S.row}><input data-person="1" placeholder="person's name" value={person} onChange={e => setPerson(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookup(); }} style={S.inp} /><button data-person-find="1" style={S.btn} onClick={lookup} disabled={busy === 'person' || !person.trim()}>Find</button>{pd ? <button data-person-dl="1" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} onClick={download}>Download JSON</button> : null}</div>
    {pd ? (pd.cases.length ? pd.cases.map(h => <div key={h.id} style={S.row}><span style={{ font: F.mono, color: '#8d877b' }}>{h.number}</span><span style={{ flex: 1 }}>{h.title}</span><span style={{ font: F.mono, color: '#8d877b' }}>{h.personCards.length} card · {h.comments.length} comment · {h.tasks.length} task · {h.logLines.length} log</span></div>) : <div style={S.note}>Nothing about "{pd.name}" in any case.</div>) : <div style={S.note}>Collects person cards, comments, tasks and log lines that name the person across every case, for access or erasure requests. Each lookup is audited.</div>}
    <div style={S.lab}>Second factors</div>
    {users.filter(u => u.totp).map(u => <div key={u.id} style={S.row}><span style={{ flex: 1 }}>{u.name}</span><span style={{ font: F.mono, color: '#8d877b' }}>TOTP on</span><button data-totp-reset={u.id} style={S.danger} onClick={() => resetTotp(u)}>Remove</button></div>)}
    {!users.some(u => u.totp) ? <div style={S.note}>Nobody has a second factor yet. People turn it on from Account → Security.</div> : null}
  </div>;
}

function Integrations() {
  const A = window.CIBAuth; const me = A.user(); const [av, setAv] = useState(null); const [feedsL, setFeeds] = useState([]); const [busy, setBusy] = useState(''); const [last, setLast] = useState(null);
  const [jira, setJira] = useState({ summary: '', description: '' }); const [nf, setNf] = useState({ name: '', tlpMax: 'green', confirmedOnly: true, indicatorsOnly: true, webhook: '', everyH: 0 }); const [newTok, setNewTok] = useState(null);
  const admin = me && me.role === 'admin'; const page = window.CIBPage; const cs = () => { try { return page && page.cs ? page.cs() : null; } catch (e) { return null; } };
  const load = async () => { try { setAv(await api('GET', '/api/integrations')); if (admin) setFeeds((await api('GET', '/api/feeds')).feeds); } catch (e) { toast(e.message); } };
  useEffect(() => { load(); }, []);
  const c = cs(); const canPush = c && me && ['admin', 'analyst'].includes(me.role);
  const [links, setLinks] = useState([]); const [lf, setLf] = useState({ label: '', days: 14, allowComments: true }); const [newLink, setNewLink] = useState(null);
  const shareable = c && ['', 'clear', 'green'].includes(c.tlp || '');
  const loadLinks = async () => { if (!c || !canPush || !shareable) return; try { setLinks((await api('GET', '/api/shares?caseId=' + encodeURIComponent(c.id))).shares); } catch (e) {} };
  useEffect(() => { loadLinks(); }, [c && c.id]);
  const mkLink = async () => { setBusy('link'); try { const r = await api('POST', '/api/shares', { caseId: c.id, label: lf.label, days: Number(lf.days) || 14, allowComments: lf.allowComments }); setNewLink({ ...r.share, full: location.origin + r.share.url }); try { await navigator.clipboard.writeText(location.origin + r.share.url); } catch (e) {} toast('Share link created and copied'); if (page && page.logEvt) page.logEvt('Share link created' + (lf.label ? ' (' + lf.label + ')' : '') + ', ' + (Number(lf.days) || 14) + ' days'); await loadLinks(); } catch (e) { toast(e.message); } setBusy(''); };
  const revoke = async (l) => { if (!window.confirm('Revoke this link? Anyone holding it loses access now.')) return; try { await api('DELETE', '/api/shares/' + l.id); if (newLink && newLink.id === l.id) setNewLink(null); await loadLinks(); } catch (e) { toast(e.message); } };
  const push = async (system) => { if (!c) return; setBusy(system); try { const r = await api('POST', '/api/integrations/' + system, { caseId: c.id, ...(system === 'jira' ? { summary: jira.summary || undefined, description: jira.description } : {}) }); setLast(r); toast((system === 'jira' ? 'Issue ' : system === 'misp' ? 'MISP event ' : 'TheHive alert ') + (r.id || '') + ' created'); if (page && page.addItem) page.addItem('link', { title: (system === 'misp' ? 'MISP event ' : system === 'thehive' ? 'TheHive alert ' : 'Jira ') + (r.id || ''), url: r.url, body: 'Pushed from this case on ' + new Date().toISOString().slice(0, 10) + (r.count ? ' · ' + r.count + ' indicators' : ''), tags: 'integration, ' + system, source: system }, false, null); if (page && page.logEvt) page.logEvt('Pushed to ' + system + ': ' + (r.id || r.url)); } catch (e) { toast(e.message); } setBusy(''); };
  const mkFeed = async () => { setBusy('feed'); try { const r = await api('POST', '/api/feeds', { ...nf, everyH: Number(nf.everyH) || 0 }); setNewTok(r.feed); setNf({ ...nf, name: '' }); await load(); } catch (e) { toast(e.message); } setBusy(''); };
  const rmFeed = async (f) => { if (!window.confirm('Remove feed "' + f.name + '"? Consumers lose access immediately.')) return; try { await api('DELETE', '/api/feeds/' + f.id); await load(); } catch (e) { toast(e.message); } };
  const stixUrl = c ? '/api/store/case/' + encodeURIComponent(c.id) + '/stix.json' : '';
  return <div>
    <div style={S.lab}>Share link · read-only public page{c ? ' for ' + c.number : ''}</div>
    {!c ? <div style={S.note}>Open a case on the board first.</div> : !canPush ? <div style={S.note}>Analysts and admins create share links.</div> : !shareable ? <div style={S.note}>Only TLP:CLEAR or TLP:GREEN cases can be shared by link. This case is TLP:{String(c.tlp).toUpperCase()}.</div> : <div>
      <div style={{ ...S.row, flexWrap: 'wrap' }}><input data-share-label="1" placeholder="label (who it is for)" value={lf.label} onChange={e => setLf({ ...lf, label: e.target.value })} style={S.inp} /><span style={{ font: F.mono, color: '#8d877b' }}>expires in</span><input data-share-days="1" value={lf.days} onChange={e => setLf({ ...lf, days: e.target.value.replace(/\D/g, '') })} style={{ ...S.inp, flex: 'none', width: 36 }} /><span style={{ font: F.mono, color: '#8d877b' }}>days</span><label style={{ font: F.mono, color: '#d8d3c7', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={lf.allowComments} onChange={e => setLf({ ...lf, allowComments: e.target.checked })} /> allow comments</label><button data-share-create="1" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} disabled={busy === 'link'} onClick={mkLink}>Create link</button></div>
      {newLink ? <div data-share-new="1" style={{ ...S.note, color: '#ffe2a0' }}>Copied to the clipboard: <a href={newLink.full} target="_blank" rel="noreferrer" style={{ color: '#ffe2a0', wordBreak: 'break-all' }}>{newLink.full}</a><br />Shows pinned, non-falsified cards only; tasks, internal comments and notes stay private. Guest comments wait for moderation in Activity → comments.</div> : null}
      {links.map(l => <div key={l.id} style={S.row}><span style={{ flex: 1 }}>{l.label || 'link'}{!l.active ? <span style={{ font: F.head, letterSpacing: '.12em', color: '#8d877b' }}> · {l.revokedAt ? 'REVOKED' : 'EXPIRED'}</span> : null}</span><span style={{ font: F.mono, color: '#8d877b' }}>{l.views} views{l.expiresAt ? ' · until ' + when(l.expiresAt).split(',')[0] : ''}{l.allowComments ? ' · comments' : ''}</span>{l.active ? <button data-share-revoke={l.id} style={S.danger} onClick={() => revoke(l)}>Revoke</button> : null}</div>)}
    </div>}
    <div style={S.lab}>Push this case{c ? ' → ' + c.number : ''}</div>
    {!av ? <div style={S.note}>Loading…</div> : <div>
      <div style={S.row}><span style={{ flex: 1 }}>MISP {av.labels.misp ? <span style={{ color: '#8d877b', font: F.mono }}>· {av.labels.misp}</span> : null}</span>{av.misp ? <button data-push="misp" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} disabled={!canPush || busy === 'misp'} onClick={() => push('misp')}>Push event</button> : <span style={{ font: F.mono, color: '#8d877b' }}>set MISP_URL + MISP_KEY</span>}</div>
      <div style={S.row}><span style={{ flex: 1 }}>TheHive {av.labels.thehive ? <span style={{ color: '#8d877b', font: F.mono }}>· {av.labels.thehive}</span> : null}</span>{av.thehive ? <button data-push="thehive" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} disabled={!canPush || busy === 'thehive'} onClick={() => push('thehive')}>Create alert</button> : <span style={{ font: F.mono, color: '#8d877b' }}>set THEHIVE_URL + THEHIVE_KEY</span>}</div>
      <div style={{ ...S.row, flexWrap: 'wrap' }}><span style={{ flex: '1 0 100%' }}>Jira {av.labels.jira ? <span style={{ color: '#8d877b', font: F.mono }}>· {av.labels.jira}</span> : null}</span>{av.jira ? <><input data-jira-summary="1" placeholder="issue summary (default: case title)" value={jira.summary} onChange={e => setJira({ ...jira, summary: e.target.value })} style={S.inp} /><button data-push="jira" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} disabled={!canPush || busy === 'jira'} onClick={() => push('jira')}>Open issue</button></> : <span style={{ font: F.mono, color: '#8d877b' }}>set JIRA_URL, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT</span>}</div>
      {last ? <div data-push-result="1" style={S.note}>Created <a href={last.url} target="_blank" rel="noreferrer" style={{ color: '#ffe2a0' }}>{last.system} {last.id}</a>{last.count ? ' with ' + last.count + ' indicators' : ''}; a link card was added to the inbox and the case log.</div> : null}
      <div style={S.note}>Falsified indicators are never pushed; confirmed ones are flagged for detection (to_ids / ioc). OpenCTI and other TIPs can poll the STIX feed below or import <a href={stixUrl} style={{ color: '#ffe2a0' }}>this case's STIX bundle</a>.</div>
    </div>}
    {admin ? <div>
      <div style={S.lab}>STIX feeds · scheduled exports</div>
      <div style={S.note}>A feed is a token URL that a TIP, SIEM or firewall polls: <span style={S.code}>…/stix.json</span>, <span style={S.code}>…/indicators.csv</span> or <span style={S.code}>…/indicators.txt</span>. Scope by maximum TLP, optionally confirmed indicators only; add an https webhook to push the bundle every N hours.</div>
      <div style={{ ...S.row, flexWrap: 'wrap' }}>
        <input data-feed-name="1" placeholder="feed name (e.g. perimeter blocklist)" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} style={S.inp} />
        <select value={nf.tlpMax} onChange={e => setNf({ ...nf, tlpMax: e.target.value })} style={{ ...S.inp, flex: 'none' }}>{['clear', 'green', 'amber', 'amber+strict', 'red'].map(t => <option key={t} value={t}>≤ TLP:{t.toUpperCase()}</option>)}</select>
        <label style={{ font: F.mono, color: '#d8d3c7', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={nf.confirmedOnly} onChange={e => setNf({ ...nf, confirmedOnly: e.target.checked })} /> confirmed only</label>
      </div>
      <div style={{ ...S.row, flexWrap: 'wrap' }}>
        <input placeholder="optional https:// webhook to push to" value={nf.webhook} onChange={e => setNf({ ...nf, webhook: e.target.value })} style={S.inp} />
        <span style={{ font: F.mono, color: '#8d877b' }}>every</span><input value={nf.everyH} onChange={e => setNf({ ...nf, everyH: e.target.value.replace(/\D/g, '') })} style={{ ...S.inp, flex: 'none', width: 40 }} /><span style={{ font: F.mono, color: '#8d877b' }}>h</span>
        <button data-feed-create="1" style={{ ...S.btn, borderColor: '#e8a71c', color: '#ffe2a0' }} disabled={!nf.name.trim() || busy === 'feed'} onClick={mkFeed}>Create feed</button>
      </div>
      {newTok ? <div data-feed-token="1" style={{ ...S.note, color: '#ffe2a0' }}>Token for "{newTok.name}" (shown once): <span style={S.code}>{newTok.token}</span><br />Pull URL: <span style={S.code}>{location.origin + newTok.url}?token={newTok.token}</span></div> : null}
      {feedsL.map(f => <div key={f.id} style={S.row}><span style={{ flex: 1 }}>{f.name}</span><span style={{ font: F.mono, color: '#8d877b' }}>≤ {f.scope.tlpMax.toUpperCase()}{f.scope.confirmedOnly ? ' · confirmed' : ''} · {f.pulls} pulls{f.lastPull ? ' · last ' + when(f.lastPull) : ''}{f.everyH ? ' · push every ' + f.everyH + 'h' : ''}</span><button style={S.danger} onClick={() => rmFeed(f)}>Remove</button></div>)}
    </div> : null}
  </div>;
}

function Account({ page }) {
  const A = window.CIBAuth; const [open, setOpen] = useState(false); const [tab, setTab] = useState('security'); const [me, setMe] = useState(A && A.user());
  useEffect(() => A ? A.onChange(() => setMe(A.user())) : undefined, []);
  if (!me) return null;
  const admin = me.role === 'admin';
  return <>
    <button data-account="1" title="Account and operations" style={S.pill(page)} onClick={() => setOpen(o => !o)}>{me.totp ? '◆ ' : ''}Account</button>
    {open ? <div data-account-drawer="1" style={S.drawer}>
      <div style={S.h}><span style={{ flex: 1 }}>Account</span>
        <button data-acct-tab="security" style={S.tab(tab === 'security')} onClick={() => setTab('security')}>Security</button>
        {admin ? <button data-acct-tab="ops" style={S.tab(tab === 'ops')} onClick={() => setTab('ops')}>Operations</button> : null}
        {!me.guest ? <button data-acct-tab="share" style={S.tab(tab === 'share')} onClick={() => setTab('share')}>Share</button> : null}
        <button style={S.btn} onClick={() => setOpen(false)}>×</button></div>
      {tab === 'ops' && admin ? <Operations /> : tab === 'share' ? <Integrations /> : <Security />}
    </div> : null}
  </>;
}

export function mountAccount(page) {
  if (document.getElementById('cib-account')) return;
  const el = document.createElement('div'); el.id = 'cib-account'; document.body.appendChild(el);
  createRoot(el).render(<Account page={page} />);
}
