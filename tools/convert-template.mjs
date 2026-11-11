// Converts the Claude Design pages (design/*.dc.html) into the React pages under src/pages/.
//
// The design files use a small template dialect on top of HTML:
//   {{ path }}                 value lookup against the logic class's renderVals()
//   <sc-if value="…">          conditional block
//   <sc-for list="…" as="x">   loop (adds the loop var and $index to scope)
//   <dc-import name="X" …>     nested component (another .dc.html page) with props
//   style-hover / style-focus  pseudo-class styles (compiled to !important rules)
//   <helmet>                   head content: fonts, scripts, global style (may contain {{ }})
//   camelCase attributes       (onClick, onPointerDown, tabIndex, …)
// This script reproduces those semantics as plain JSX so the pages run on stock React
// without the design runtime. Logic classes are carried over verbatim, with a few
// string patches (routes, proxy, media mirror) listed in PATCHES below.
//
// Usage: node tools/convert-template.mjs            (reads tools/pages.json)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'pages.json'), 'utf8'));

// Logic patches: [description, find, replace, {all?:bool, pages?:[names]}]
const ROUTES = cfg.routes;
const PATCHES = [
  ['desk/login/board routes', /'Login\.dc\.html'/g, JSON.stringify(ROUTES['Login.dc.html']), {}],
  ['desk route', /'Case Files\.dc\.html'/g, JSON.stringify(ROUTES['Case Files.dc.html']), {}],
  ['board route', /'Investigation Board\.dc\.html'/g, JSON.stringify(ROUTES['Investigation Board.dc.html']), {}],
  ['desk route (bookmarklet string)', /\+ 'Case Files\.dc\.html#dr/g, "+ 'desk.html#dr", {}],
  ['login copy reflects the server-side accounts', "'Accounts, roles and sessions live in this browser for now; the production build authenticates against your identity provider.'", "'Accounts, roles and sessions are kept on the server. Passwords are hashed with scrypt and never stored in the browser.'", { pages: ['login'] }],
  ['login footer reflects scrypt + server sessions', "'Passwords are hashed (PBKDF2-SHA256, 150k rounds) before they touch storage. There is no recovery without another admin.'", "'Passwords are hashed with scrypt on the server and never stored in the browser. There is no recovery without another admin.'", { pages: ['login'] }],
  ['login: second step when the account has TOTP enabled', "      const u = await A.login(s.name, s.pass);\n      if (u.mustChange)", "      const u = await A.login(s.name, s.pass);\n      if (u.totpRequired) return this.setState({ mode: 'totp', challenge: u.challenge, pass: '', busy: false });\n      if (u.mustChange)", { pages: ['login'] }],
  ['login: submit the authenticator code', "      if (s.mode === 'change') {", "      if (s.mode === 'totp') { const u2 = await A.loginTotp(s.challenge, s.pass); if (u2.mustChange) return this.setState({ mode: 'change', user: u2, pass: '', pass2: '', busy: false }); return this.go(); }\n      if (s.mode === 'change') {", { pages: ['login'] }],
  ['login: copy for the TOTP step', "    const s = this.state, setup = s.mode === 'setup', change = s.mode === 'change';\n    return {\n      title: setup ? 'Open the office.' : change ? 'Choose a new password.' : 'Sign in.',", "    const s = this.state, setup = s.mode === 'setup', change = s.mode === 'change', totp = s.mode === 'totp';\n    return {\n      hasSso: !setup && !change && !totp && !!(window.CIBAuth && window.CIBAuth.sso()), ssoLabel: (window.CIBAuth && window.CIBAuth.sso() || {}).label || 'Single sign-on', sso: () => { const o = window.CIBAuth.sso(); if (o) location.href = o.start + '?next=' + encodeURIComponent(this.next()); },\n      title: setup ? 'Open the office.' : change ? 'Choose a new password.' : totp ? 'Second factor.' : 'Sign in.',", { pages: ['login'] }],
  ['login: TOTP blurb and labels', "      askName: !change, askConfirm: setup || change, passLabel: setup || change ? 'PASSWORD · 8+ CHARACTERS' : 'PASSWORD', passAuto: setup || change ? 'new-password' : 'current-password',", "      askName: !change && !totp, askConfirm: setup || change, passLabel: setup || change ? 'PASSWORD · 8+ CHARACTERS' : totp ? 'AUTHENTICATOR CODE · 6 DIGITS' : 'PASSWORD', passAuto: setup || change ? 'new-password' : totp ? 'one-time-code' : 'current-password',", { pages: ['login'] }],
  ['login: TOTP submit label', "submitLabel: s.busy ? 'Checking…' : setup ? 'Create admin account' : change ? 'Save and continue' : 'Sign in',", "submitLabel: s.busy ? 'Checking…' : setup ? 'Create admin account' : change ? 'Save and continue' : totp ? 'Verify code' : 'Sign in',", { pages: ['login'] }],
  ['login: TOTP blurb', "change ? 'Your password was reset by an administrator. Set your own before continuing.' : 'Accounts, rol", "change ? 'Your password was reset by an administrator. Set your own before continuing.' : totp ? 'This account has two-factor authentication on. Enter the six-digit code from your authenticator app.' : 'Accounts, rol", { pages: ['login'] }],
  ['login footer: session policy', "'Sessions last 12 hours and lock after 15 minutes idle. Forgotten password: ask an administrator to reset it.'", "'Sessions last 12 hours and lock after 15 minutes idle; ten wrong passwords lock the account for 15 minutes. Forgotten password: ask an administrator to reset it.'", { pages: ['login'] }],
  ['server mode: an empty visible set does not re-seed the sample cases',
    "else if (d && Array.isArray(d.cases) && d.cases.length) saved = d; } } catch (e) {} }\n    if (lockedPayload)",
    "else if (d && Array.isArray(d.cases) && (d.cases.length || (Array.isArray(d.seeded) && d.seeded.includes('server')))) saved = d; } } catch (e) {} }\n    if (lockedPayload)", { pages: ['board'] }],
  ['server mode: start a blank case instead of the sample when the user has none',
    "let cases = this.migrate(saved ? saved.cases : [Component.sample()]);",
    "let cases = this.migrate(saved && saved.cases.length ? saved.cases : saved ? [{ id: Component.uid(), v: 3, number: 'CASE 0417', title: 'Untitled case', notes: '', items: [], threads: [], groups: [], dismissed: [], review: 'draft', log: [] }] : [Component.sample()]);", { pages: ['board'] }],
  ['board applies other people\'s changes arriving from the server',
    "  componentDidMount() {\n",
    "  applyRemote(ev) {\n    if (!ev) return;\n    if (ev.type === 'case-deleted') { this.setState(s => { const cases = s.cases.filter(c => c.id !== ev.id); return cases.length ? { cases, activeId: s.activeId === ev.id ? cases[0].id : s.activeId, sel: s.activeId === ev.id ? null : s.sel } : {}; }); return; }\n    const c = ev.case; if (!c || !c.id) return;\n    this.setState(s => ({ cases: s.cases.some(x => x.id === c.id) ? s.cases.map(x => x.id === c.id ? Component.numbered(c) : x) : [...s.cases, Component.numbered(c)] }));\n    if (this.state.activeId === c.id && c.updatedBy) this.toast('Updated by ' + c.updatedBy);\n  }\n  componentDidMount() {\n    if (window.CIBStore && window.CIBStore.onRemote) window.CIBStore.onRemote(ev => this.applyRemote(ev));\n", { pages: ['board'] }],
  ['desk re-reads the store when other people\'s changes arrive',
    "  componentDidMount() {\n",
    "  componentDidMount() {\n    if (window.CIBStore && window.CIBStore.onRemote) window.CIBStore.onRemote(() => this.setState({ saved: this.load().saved }));\n", { pages: ['desk'] }],
  ['legal hold: the board refuses to delete a held case', "deleteCaseById(id) { const c = this.state.cases.find(x => x.id === id); if (!c) return;", "deleteCaseById(id) { const c = this.state.cases.find(x => x.id === id); if (!c) return; if (c.legalHold) return this.toast(c.number + ' is under legal hold and cannot be deleted');", { pages: ['board'] }],
  ['legal hold: the desk refuses to delete a held case', "deleteCase(id) { const c = this.state.saved.cases.find(x => x.id === id); if (!c) return;", "deleteCase(id) { const c = this.state.saved.cases.find(x => x.id === id); if (!c) return; if (c.legalHold) return this.toast(c.number + ' is under legal hold and cannot be deleted');", { pages: ['desk'] }],
  ['users panel: second factor and SSO shown per account', "u.mustChange ? 'must change password' : ''].filter(Boolean).join(' · ')", "u.mustChange ? 'must change password' : '', u.totp ? '2FA on' : '', u.sso ? 'single sign-on' : ''].filter(Boolean).join(' · ')", { pages: ['desk'] }],
  ['legal hold shown on the folder tab', "onDup: e => { e.stopPropagation(); this.dupCase(c.id); }, onExport: e => { e.stopPropagation(); this.exportCase(c.id); }, onDelete: e => { e.stopPropagation(); this.deleteCase(c.id); },", "onDup: e => { e.stopPropagation(); this.dupCase(c.id); }, onExport: e => { e.stopPropagation(); this.exportCase(c.id); }, onDelete: e => { e.stopPropagation(); this.deleteCase(c.id); }, legalHold: !!c.legalHold,", { pages: ['desk'] }],
  ['UX: Esc works from inside a text box (closes panels, drops the selection) instead of being swallowed', "    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;\n    const s = this.state;", "    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) { if (e.key !== 'Escape') return; t.blur(); }\n    const s = this.state;", { pages: ['board'] }],
  ['UX: unknown quick-add commands are refused with help instead of becoming a note', "      else { const f = this.extractIocs(rest); if (f.length === 1 && this.refang(rest).toLowerCase().replace(/^@/, '') === f[0].value.toLowerCase().replace(/^@/, '')) { type = 'indicator'; kind = f[0].kind; } else type = 'note'; }", "      else { const f = this.extractIocs(rest); if (f.length === 1 && this.refang(rest).toLowerCase().replace(/^@/, '') === f[0].value.toLowerCase().replace(/^@/, '')) { type = 'indicator'; kind = f[0].kind; } else if (m && m[1].length <= 4 && /^[a-z]+$/i.test(m[1]) && !/^(a|an|the|to|of|in|on|at|is|it|by|for|and|or|we|he|she|re|fw|if|no|so|as|do|be|up|my|me|us|ok|vs|this|that|with|from|our|his|her|its|new|old|two|one|all|any|not|but|has|had|was|are|were|who|why|how|see|also|will|can|may|per|via|re)$/i.test(m[1])) { this.toast('Unknown quick-add command \"' + m[1] + '\". Type ? for the list.'); return; } else type = 'note'; }", { pages: ['board'] }],
  ['UX: ? in quick add shows every command', "  quickAdd(text) {\n    text = String(text || '').trim(); if (!text) return;", "  quickAdd(text) {\n    text = String(text || '').trim(); if (!text) return;\n    if (text === '?' || text === 'help') { this.setState({ quick: '' }); return this.toast('quick add: d domain · host hostname · i ip · u url · h hash · f filename · m email · w wallet · cve CVE · @ handle · e date title · n note · p person · t T1566 · l location · doc · x transfer · org target · c cluster · v video · a audio · pdf · mail · code · log · feed · mon · car · obj · st statement'); }", { pages: ['board'] }],
  ['UX: four-letter quick-add commands (host, file, mail, code, feed) are recognised', "const m = text.match(/^(@|[a-z]{1,3})\\s+(.+)$/i); let cmd = m ? m[1].toLowerCase() : '', rest = m ? m[2].trim() : text, type, kind;", "const m = text.match(/^(@|[a-z]{1,4})\\s+(.+)$/i); let cmd = m ? m[1].toLowerCase() : '', rest = m ? m[2].trim() : text, type, kind;", { pages: ['board'] }],
  ['UX: hostname and file-name indicator kinds in quick add', "const K = Component.K, CMD = { d: ['indicator', 'domain'], i: ['indicator', 'ip'], h: ['indicator', 'hash'],", "const K = Component.K, CMD = { d: ['indicator', 'domain'], host: ['indicator', 'hostname'], f: ['indicator', 'filename'], file: ['indicator', 'filename'], i: ['indicator', 'ip'], h: ['indicator', 'hash'],", { pages: ['board'] }],
  ['hostname and file-name kinds in the kinds table', "KINDS: { domain: 'Domain', ip: 'IP address', url: 'URL', hash: 'File hash', handle: 'Handle', email: 'Email', wallet: 'Wallet', cve: 'CVE', phone: 'Phone' },", "KINDS: { domain: 'Domain', hostname: 'Hostname', ip: 'IP address', url: 'URL', hash: 'File hash', filename: 'File name', handle: 'Handle', email: 'Email', wallet: 'Wallet', cve: 'CVE', phone: 'Phone' },", { pages: ['board'] }],
  ['hash algorithm shown in the brief and letters', "      exportStix: this.exportStix,", "      kindLabel: this.kindLabel, exportStix: this.exportStix,", { pages: ['board'] }],
  ['kindLabel helper: hash length → algorithm', "  exportStix = () => {", "  kindLabel(i) { const K = Component.K; if (i.kind === 'hash') { const n = String(i.value || '').replace(/\\s/g, '').length; return (n === 32 ? 'MD5' : n === 40 ? 'SHA-1' : n === 64 ? 'SHA-256' : n === 128 ? 'SHA-512' : 'File') + ' hash'; } return K.KINDS[i.kind] || i.kind; }\n  exportStix = () => {", { pages: ['board'] }],
  ['brief: indicator type column uses the algorithm label', "table(['№', 'Type', 'Value', 'Status', 'Source', 'Seen', 'Context'], inds.map(i => [num('E', i.num), esc(K.KINDS[i.kind] || i.kind),", "table(['№', 'Type', 'Value', 'Status', 'Source', 'Seen', 'Context'], inds.map(i => [num('E', i.num), esc(this.kindLabel(i)),", { pages: ['board'] }],
  ['letters: algorithm label', "const lines = inds.map(i => '  - ' + (K.KINDS[i.kind] || i.kind) + ': '", "const lines = inds.map(i => '  - ' + this.kindLabel(i) + ': '", { pages: ['board'] }],
  ['brief: timeline table prints the time of day', "'<h2>Timeline</h2>' + table(['Date', 'Event', 'Type'], tl.map(i => [mono(this.fmtDate(i.date)), label(i), esc(K.TYPES[i.type].label)]))", "'<h2>Timeline</h2>' + table(['Date', 'Event', 'Type'], tl.map(i => [mono(this.fmtDate(i.date) + (i.time ? ' ' + i.time : '')), label(i), esc(K.TYPES[i.type].label)]))", { pages: ['board'] }],
  ['timeline: cards on the same day are ordered by time of day', "const dated = pinned.filter(i => i.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.num || 0) - (b.num || 0))", "const dated = pinned.filter(i => i.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : (a.num || 0) - (b.num || 0))", { pages: ['board'] }],
  ['ACH: evidence weights (×1 ×2 ×3) and weighted scores', "const hypVals = hyps.map(hy => { const n = achItems.filter(i => (cs.ach || {})[i.id + '|' + hy.id] === 'I').length; return { id: hy.id, text: hy.text, score: n + ' inconsistent',", "const achW = cs.achW || {}; const wOf = (i) => Number(achW[i.id]) || 1; const hypVals = hyps.map(hy => { const cells = achItems.filter(i => (cs.ach || {})[i.id + '|' + hy.id] === 'I'); const n = cells.reduce((a, i) => a + wOf(i), 0); return { id: hy.id, text: hy.text, score: n + ' weighted inconsistency' + (cells.length !== n ? ' (' + cells.length + ' cells)' : ''),", { pages: ['board'] }],
  ['ACH: weight button on each evidence row', "const achRows = hyps.length ? achItems.map(i => ({ numText: Component.numText('E', i.num), label: label(i), cells:", "const achRows = hyps.length ? achItems.map(i => ({ numText: Component.numText('E', i.num), label: label(i), weight: '×' + wOf(i), weightColor: wOf(i) > 1 ? '#e8a71c' : '#3a3a40', onWeight: () => this.upCase(c => ({ ...c, achW: { ...(c.achW || {}), [i.id]: (Number((c.achW || {})[i.id]) || 1) % 3 + 1 } })), cells:", { pages: ['board'] }],
  ['brief: weighted ACH scores and the leading hypothesis', "'<p class=\"muted\">Inconsistencies: ' + hyps.map(hy => esc(hy.text) + ' = ' + cs.items.filter(i => i.pinned && ach[i.id + '|' + hy.id] === 'I').length).join(' · ') + '</p>'", "(() => { const W = cs.achW || {}; const sc = hyps.map(hy => ({ hy, n: cs.items.filter(i => i.pinned && ach[i.id + '|' + hy.id] === 'I').reduce((a, i) => a + (Number(W[i.id]) || 1), 0), cells: cs.items.filter(i => i.pinned && ach[i.id + '|' + hy.id] === 'I').length })).sort((a, b) => a.n - b.n); const weighted = Object.values(W).some(w => Number(w) > 1); return '<p class=\"muted\">' + (weighted ? 'Weighted inconsistency (evidence weights ×1–×3): ' : 'Inconsistencies: ') + sc.map(x => esc(x.hy.text) + ' = ' + x.n + (weighted && x.cells !== x.n ? ' (' + x.cells + ' cells)' : '')).join(' · ') + (sc.length > 1 ? '. Leading hypothesis: <b>' + esc(sc[0].hy.text) + '</b>' + (sc[1].n === sc[0].n ? ' (tied)' : '') : '') + '</p>'; })()", { pages: ['board'] }],
  ['free spot fills gaps and then rows under the board instead of a staircase', "    return (x1 - x0) >= (y1 - y0) ? { x: Math.round(x0), y: Math.round(y1 + 90) } : { x: Math.round(x1 + 90), y: Math.round(y0) };\n  }", "    const hit = (x, y) => items.some(i => x < i.x + K.TYPES[i.type].w + 30 && x + w + 30 > i.x && y < i.y + this.h(i.id) + 30 && y + h + 30 > i.y) || groups.some(g => x < g.x + g.w + 30 && x + w + 30 > g.x && y < g.y + g.h + 30 && y + h + 30 > g.y - 34);\n    const stepY = h + 40, stepX = w + 40; const X1 = Math.max(x1, x0 + 5 * stepX);\n    for (let y = y0; y < y1 + 80 * stepY; y += stepY) for (let x = x0; x <= X1 - w; x += stepX) if (!hit(x, y)) return { x: Math.round(x), y: Math.round(y) };\n    return { x: Math.round(x0), y: Math.round(y1 + 90) };\n  }", { pages: ['board'] }],
  ['new cards from the inbox and quick add land in a free spot instead of the centre', "  addItem(type, extra = {}, pinned = false, at = null) {\n    this.sfx(pinned ? 'pin' : 'paper');\n    const K = Component.K, id = Component.uid(), w = K.TYPES[type].w;", "  addItem(type, extra = {}, pinned = false, at = null) {\n    this.sfx(pinned ? 'pin' : 'paper');\n    const K = Component.K, id = Component.uid(), w = K.TYPES[type].w;\n    if (pinned && !at && this.cs().items.some(i => i.pinned)) { const sp = this.freeSpot(w, 170); at = { x: sp.x + w / 2, y: sp.y + 10 }; }", { pages: ['board'] }],
  ['storyboard: Story button opens the overlay', "      toggleTimeline: this.toggleTimeline, isTimeline: hasLay,", "      toggleStory: () => { window.dispatchEvent(new CustomEvent('cib:story')); }, toggleTimeline: this.toggleTimeline, isTimeline: hasLay,", { pages: ['board'] }],
  ['storyboard: scenes become a chapter of the case brief', "    const hyps = cs.hypotheses || [], ach = cs.ach || {};", "    const hyps = cs.hypotheses || [], ach = cs.ach || {};\n    const SCENE_KIND = { happened: 'What happened', found: 'What we found', assess: 'What we assess', ask: 'What we ask for' };\n    const storyHtml = cs.story && (cs.story.scenes || []).length ? '<h2>Story</h2>' + cs.story.scenes.map((sc, n) => '<div class=\"scene\"><div class=\"meta\">SCENE ' + (n + 1) + ' · ' + (SCENE_KIND[sc.kind] || esc(sc.kind || '')) + (sc.from ? ' · ' + esc(this.fmtDate(sc.from)) + (sc.to && sc.to !== sc.from ? ' → ' + esc(this.fmtDate(sc.to)) : '') : '') + '</div><h3>' + esc(sc.title || '') + '</h3><p>' + esc(sc.caption || '').replace(/\\n/g, '<br>') + '</p>' + ((sc.items || []).map(id => byId[id]).filter(Boolean).length ? '<p class=\"muted\">Exhibits: ' + (sc.items || []).map(id => byId[id]).filter(Boolean).map(i => label(i)).join(' · ') + '</p>' : '') + '</div>').join('') : '';", { pages: ['board'] }],
  ['storyboard: brief prints the story before the timeline', "        + '<h2>Timeline</h2>' + table(['Date', 'Event', 'Type'],", "        + storyHtml + '<h2>Timeline</h2>' + table(['Date', 'Event', 'Type'],", { pages: ['board'] }],
  ['enrichment on pin: indicators added to the board are looked up once',
    "    this.logEvt((pinned ? 'Pinned ' : 'Added to inbox: ') + K.TYPES[type].label.toLowerCase() + (this.itemLabel(it) ? ' — ' + this.itemLabel(it) : ''));\n    return id;",
    "    this.logEvt((pinned ? 'Pinned ' : 'Added to inbox: ') + K.TYPES[type].label.toLowerCase() + (this.itemLabel(it) ? ' — ' + this.itemLabel(it) : ''));\n    if (pinned && type === 'indicator' && it.value && window.CIBEnrich) window.CIBEnrich.schedule(id);\n    return id;", { pages: ['board'] }],
  ['enrichment when an inbox indicator is pinned',
    "    this.upItem(id, { pinned: true, ...pos });\n    this.setState({ sel: id, selThread: null, selGroup: null, tab: 'inspector' });\n    this.logEvt('Pinned to board: ' + this.itemLabel(it));",
    "    this.upItem(id, { pinned: true, ...pos });\n    this.setState({ sel: id, selThread: null, selGroup: null, tab: 'inspector' });\n    this.logEvt('Pinned to board: ' + this.itemLabel(it));\n    if (it.type === 'indicator' && it.value && window.CIBEnrich) window.CIBEnrich.schedule(id);", { pages: ['board'] }],
  ['CORS proxy goes through our own allow-listed server endpoint instead of allorigins.win',
    "proxy(u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); }",
    "proxy(u) { return '/api/proxy?url=' + encodeURIComponent(u); }", { pages: ['board'] }],
  ['jget routes CORS-blocked hosts through the proxy',
    "async jget(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }",
    "async jget(url, opts) { const u = (window.CIBProxy && window.CIBProxy.needs(url)) ? this.proxy(url) : url; const r = await fetch(u, opts); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }", { pages: ['board'] }],
  ['media blobs are mirrored to the server file store',
    "putBlob(id, blob) { return this.idb().then(db => new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id); tx.oncomplete = () => res();",
    "putBlob(id, blob) { if (window.CIBStore && window.CIBStore.putFile) window.CIBStore.putFile(id, blob, this.state.activeId).catch(() => {}); return this.idb().then(db => new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id); tx.oncomplete = () => res();", { pages: ['board'] }],
  ['media blobs missing locally are fetched from the server',
    "getBlob(id) { return this.idb().then(db => new Promise((res, rej) => { const q = db.transaction('blobs').objectStore('blobs').get(id); q.onsuccess = () => res(q.result || null);",
    "getBlob(id) { return this.idb().then(db => new Promise((res, rej) => { const q = db.transaction('blobs').objectStore('blobs').get(id); q.onsuccess = () => { if (q.result) return res(q.result); if (window.CIBStore && window.CIBStore.getFile) window.CIBStore.getFile(id).then(b => { if (b) this.putBlob(id, b); res(b || null); }).catch(() => res(null)); else res(null); };",
    { pages: ['board'] }],
];

// Template text patches (applied before parsing): [description, find, replace, pages]
const TEMPLATE_PATCHES = [
  ['storyboard: Story button beside Kill chain', 'cursor:pointer; white-space:nowrap; flex:none">Kill chain</button>', 'cursor:pointer; white-space:nowrap; flex:none">Kill chain</button><button data-story-btn="1" onClick="{{ toggleStory }}" title="Storyboard: the case as scenes for the brief, the public page and a slide-by-slide playback" style="height:26px; padding:0 10px; border:1px solid #2c2c31; background:#17171a; color:#d8d3c7; font:12px \'Archivo Narrow\',sans-serif; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; white-space:nowrap; flex:none" style-hover="background:#222226; color:#fff">Story</button>', ['board']],
  ['quick-add placeholder names the new kinds and the ? help', 'placeholder="/ quick add — d domain · i ip · h hash · u url · e date title · n note · p person · t T1566 · c cluster"', 'placeholder="/ quick add — d domain · i ip · h hash · f filename · u url · e date title · p person · t T1566 · ? for all"', ['board']],
  ['ACH: weight toggle in the evidence cell', '<span style="font:10px \'IBM Plex Mono\',monospace; color:#8d877b; flex:none">{{ ar.numText }}</span>', '<span style="font:10px \'IBM Plex Mono\',monospace; color:#8d877b; flex:none">{{ ar.numText }}</span><button data-ach-weight="1" onClick="{{ ar.onWeight }}" title="Weight of this evidence: click to cycle ×1 ×2 ×3 (diagnosticity)" style="border:1px solid #2c2c31; background:transparent; color:{{ ar.weightColor }}; font:10px \'IBM Plex Mono\',monospace; cursor:pointer; padding:0 4px; flex:none">{{ ar.weight }}</button>', ['board']],
  ['ACH: explain weights', 'Click a cell to cycle: consistent · inconsistent · neutral. The hypothesis with the fewest inconsistencies survives; the one you favour is not the test.', 'Click a cell to cycle: consistent · inconsistent · neutral. Click ×1 on a row to weight that evidence ×2 or ×3 (how diagnostic it is). The hypothesis with the lowest weighted inconsistency survives; the one you favour is not the test.', ['board']],
  ['users panel caption reflects server accounts', 'browser-local accounts · the production build uses your identity provider', 'server accounts · scrypt-hashed passwords · every change audited', ['desk']],
  ['folder: legal-hold stamp next to the public stamp', '<sc-if value="{{ f.isPublic }}" hint-placeholder-val="{{ false }}"><span style="padding:2px 6px; background:#3fae63;', '<sc-if value="{{ f.legalHold }}" hint-placeholder-val="{{ false }}"><span data-hold-stamp="1" title="Legal hold: cannot be deleted or purged" style="padding:2px 6px; background:#e8a71c; color:#1b1a17; font:9px \'Archivo Narrow\',sans-serif; letter-spacing:.12em; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,.5)">legal hold</span></sc-if><sc-if value="{{ f.isPublic }}" hint-placeholder-val="{{ false }}"><span style="padding:2px 6px; background:#3fae63;', ['folder']],
  ['login: single sign-on button when OIDC is configured', '<sc-if value="{{ hasPublic }}" hint-placeholder-val="{{ false }}">', '<sc-if value="{{ hasSso }}" hint-placeholder-val="{{ false }}"><button data-sso="1" onClick="{{ sso }}" style="width:100%; height:36px; margin-top:10px; border:1px solid #1b1a17; background:transparent; color:#1b1a17; font:11px \'Archivo Narrow\',sans-serif; letter-spacing:.18em; text-transform:uppercase; cursor:pointer" style-hover="background:#1b1a17; color:#f3f1ea">{{ ssoLabel }}</button></sc-if><sc-if value="{{ hasPublic }}" hint-placeholder-val="{{ false }}">', ['login']],
];
function readDc(file, pageName) {
  let html = fs.readFileSync(file, 'utf8');
  for (const [, find, rep, pages] of TEMPLATE_PATCHES) if (!pages || pages.includes(pageName)) html = html.split(find).join(rep);
  const open = html.indexOf('<x-dc>'), close = html.lastIndexOf('</x-dc>');
  if (open < 0 || close < 0) throw new Error('no <x-dc> block in ' + file);
  const template = html.slice(open + 6, close);
  const m = html.match(/<script type="text\/x-dc" data-dc-script data-props="([^"]*)"\s*>([\s\S]*?)<\/script>\s*<\/body>/);
  const propsRaw = m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '{}';
  let props = {}; try { props = JSON.parse(propsRaw); } catch (e) {}
  const script = m ? m[2] : '';
  return { template, props, script };
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function convert(pg) {
  const { template, props, script } = readDc(path.join(root, pg.file), pg.name);
  const out = await page.evaluate(({ template, imports, clsPrefix }) => {
    // ---------- pre-encoding (mirrors the runtime) ----------
    const CAMEL = 'sc-camel-';
    const RAW_WRAP = { select: 'sc-raw-select', table: 'sc-raw-table', tbody: 'sc-raw-tbody', thead: 'sc-raw-thead', tfoot: 'sc-raw-tfoot', tr: 'sc-raw-tr', td: 'sc-raw-td', th: 'sc-raw-th', caption: 'sc-raw-caption' };
    const RAW_UNWRAP = Object.fromEntries(Object.entries(RAW_WRAP).map(([k, v]) => [v, k]));
    const EVENT_MAP = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onkeypress: 'onKeyPress', onmousedown: 'onMouseDown', onmouseup: 'onMouseUp', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', ondoubleclick: 'onDoubleClick', oncontextmenu: 'onContextMenu', onmousemove: 'onMouseMove', onmouseover: 'onMouseOver', onmouseout: 'onMouseOut', onpointerdown: 'onPointerDown', onpointerup: 'onPointerUp', onpointermove: 'onPointerMove', onpointerenter: 'onPointerEnter', onpointerleave: 'onPointerLeave', onpointercancel: 'onPointerCancel', onpointerover: 'onPointerOver', onpointerout: 'onPointerOut', ongotpointercapture: 'onGotPointerCapture', onlostpointercapture: 'onLostPointerCapture', ontouchstart: 'onTouchStart', ontouchend: 'onTouchEnd', ontouchmove: 'onTouchMove', ontouchcancel: 'onTouchCancel', ondragstart: 'onDragStart', ondragend: 'onDragEnd', ondragenter: 'onDragEnter', ondragleave: 'onDragLeave', ondragover: 'onDragOver', ondrop: 'onDrop', onscroll: 'onScroll', onwheel: 'onWheel', onload: 'onLoad', onerror: 'onError', onended: 'onEnded', onplay: 'onPlay', onpause: 'onPause', ontimeupdate: 'onTimeUpdate', onloadedmetadata: 'onLoadedMetadata', onanimationstart: 'onAnimationStart', onanimationend: 'onAnimationEnd', onanimationiteration: 'onAnimationIteration', ontransitionend: 'onTransitionEnd' };
    const HTML_ATTR = { spellcheck: 'spellCheck', autocomplete: 'autoComplete', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', autofocus: 'autoFocus', crossorigin: 'crossOrigin', enctype: 'encType', contenteditable: 'contentEditable', srcset: 'srcSet', novalidate: 'noValidate', colspan: 'colSpan', rowspan: 'rowSpan', datetime: 'dateTime', accesskey: 'accessKey', 'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv', autoplay: 'autoPlay', playsinline: 'playsInline', allowfullscreen: 'allowFullScreen', frameborder: 'frameBorder', referrerpolicy: 'referrerPolicy', srcdoc: 'srcDoc' };
    const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    function encodeCase(h) {
      h = h.replace(/<helmet(\s|>)/gi, '<sc-helmet$1').replace(/<\/helmet\s*>/gi, '</sc-helmet>');
      h = h.replace(/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g, (_, sp, name, eq) => sp + CAMEL + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + eq);
      for (const [real, alias] of Object.entries(RAW_WRAP)) h = h.replace(new RegExp('(</?)' + real + '(?=[\\s>])', 'gi'), '$1' + alias);
      return h;
    }
    const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    // ---------- pseudo classes ----------
    const pseudoRules = []; const pseudoCache = new Map(); let pn = 0;
    const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
    function importantify(css) {
      css = stripComments(css); const decls = []; let start = 0, depth = 0, quote = '';
      for (let i = 0; i < css.length; i++) { const c = css[i]; if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; } else if (c === "'" || c === '"') quote = c; else if (c === '(') depth++; else if (c === ')') depth = Math.max(0, depth - 1); else if (c === ';' && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; } }
      decls.push(css.slice(start));
      return decls.map(d => d.trim()).filter(Boolean).map(d => /!\s*important$/i.test(d) ? d : d + ' !important').join(';');
    }
    function pseudoClass(pseudo, css) {
      const k = pseudo + '|' + css; if (pseudoCache.has(k)) return pseudoCache.get(k);
      const cls = clsPrefix + (pn++).toString(36); const pe = pseudo === 'before' || pseudo === 'after';
      // declarations with {{ }} holes cannot be static CSS; the browser dropped them as invalid in the original too
      const clean = css.split(';').filter(d => !d.includes('{{')).join(';');
      pseudoRules.push('.' + cls + (pe ? '::' : ':') + pseudo + '{' + (pe ? clean : importantify(clean)) + '}');
      pseudoCache.set(k, cls); return cls;
    }
    // ---------- expressions ----------
    const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/, NUMBER_RE = /^-?\d+(\.\d+)?$/;
    function parensWrapWhole(e) { let d = 0; for (let i = 0; i < e.length - 1; i++) { if (e[i] === '(') d++; else if (e[i] === ')') { d--; if (d === 0) return false; } } return true; }
    function findEq(e) { let d = 0; for (let i = 0; i < e.length; i++) { const c = e[i]; if (c === '[' || c === '(') d++; else if (c === ']' || c === ')') d--; else if (d === 0 && (c === '=' || c === '!') && e[i + 1] === '=') { if (i > 0 && (e[i - 1] === '=' || e[i - 1] === '!')) continue; if (!e.slice(0, i).trim()) continue; return { index: i, op: e[i + 2] === '=' ? c + '==' : c + '=' }; } } return null; }
    function compileExpr(srcExpr, scope) {
      const e = String(srcExpr).trim(); if (!e) return 'undefined';
      if (e[0] === '(' && e[e.length - 1] === ')' && parensWrapWhole(e)) return compileExpr(e.slice(1, -1), scope);
      const eq = findEq(e); if (eq) return '(' + compileExpr(e.slice(0, eq.index), scope) + ' ' + eq.op + ' ' + compileExpr(e.slice(eq.index + eq.op.length), scope) + ')';
      if (e[0] === '!') return '!' + compileExpr(e.slice(1), scope);
      if (e === 'true' || e === 'false' || e === 'null' || e === 'undefined' || NUMBER_RE.test(e)) return e;
      if (e.length >= 2 && (e[0] === '"' || e[0] === "'") && e[e.length - 1] === e[0]) return JSON.stringify(e.slice(1, -1));
      return compilePath(e, scope);
    }
    function compilePath(e, scope) {
      const head = e.match(IDENT_RE); if (!head) return 'undefined'; const name = head[0];
      let code = name === '$index' ? (scope.indexVar || 'undefined') : scope.vars.has(name) ? name : 'v.' + name; let i = name.length;
      while (i < e.length) {
        if (e[i] === '.') { const m = e.slice(i + 1).match(IDENT_RE) || e.slice(i + 1).match(/^\d+/); if (!m) return 'undefined'; code += /^\d/.test(m[0]) ? '?.[' + m[0] + ']' : '?.' + m[0]; i += 1 + m[0].length; }
        else if (e[i] === '[') { let d = 1, j = i + 1; while (j < e.length && d > 0) { if (e[j] === '[') d++; else if (e[j] === ']') { d--; if (d === 0) break; } j++; } if (d !== 0) return 'undefined'; code += '?.[' + compileExpr(e.slice(i + 1, j), scope) + ']'; i = j + 1; }
        else return 'undefined';
      }
      return code;
    }
    const tplEsc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    function compileAttr(raw, scope) {
      const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/); if (whole) return { kind: 'expr', code: compileExpr(whole[1], scope) };
      if (raw.includes('{{')) { const parts = raw.split(/\{\{([\s\S]+?)\}\}/g); return { kind: 'tpl', code: '`' + parts.map((p, i) => i & 1 ? '${' + compileExpr(p, scope) + ' ?? ""}' : tplEsc(p)).join('') + '`' }; }
      return { kind: 'static', value: raw };
    }
    const propKey = p => p.startsWith('--') ? JSON.stringify(p) : (/^[A-Za-z_$][\w$]*$/.test(kebabToCamel(p)) ? kebabToCamel(p) : JSON.stringify(kebabToCamel(p)));
    function styleObjCode(raw, scope) {
      const entries = new Map();
      for (const decl of raw.split(';')) { const i = decl.indexOf(':'); if (i < 0) continue; const prop = decl.slice(0, i).trim(); const val = decl.slice(i + 1).trim(); if (!prop) continue; let code; if (val.includes('{{')) { const parts = val.split(/\{\{([\s\S]+?)\}\}/g); code = '`' + parts.map((p, k) => k & 1 ? '${' + compileExpr(p, scope) + ' ?? ""}' : tplEsc(p)).join('') + '`'; } else code = JSON.stringify(val); entries.delete(propKey(prop)); entries.set(propKey(prop), code); }
      return '{' + [...entries].map(([k, c]) => k + ': ' + c).join(', ') + '}';
    }
    // ---------- walker ----------
    const ind = n => '  '.repeat(n); const jsxText = s => '{' + JSON.stringify(s) + '}';
    let helmet = null; const usedImports = new Set();
    function walkText(node, scope, depth) {
      const txt = node.nodeValue ?? '';
      if (!txt.includes('{{')) { if (!txt.trim() && !txt.includes(' ')) return ''; return ind(depth) + jsxText(txt) + '\n'; }
      const parts = txt.split(/\{\{([\s\S]+?)\}\}/g);
      return ind(depth) + parts.map((p, i) => i & 1 ? '{' + compileExpr(p, scope) + '}' : (p ? jsxText(p) : '')).join('') + '\n';
    }
    const SKIP_WS_IN = new Set(['select', 'datalist', 'svg', 'g', 'table', 'tbody', 'thead', 'tr']);
    function walkChildren(node, scope, depth) {
      const tag = node.nodeType === Node.ELEMENT_NODE ? (RAW_UNWRAP[node.localName] || node.localName) : '';
      return [...node.childNodes].filter(c => !(SKIP_WS_IN.has(tag) && c.nodeType === Node.TEXT_NODE && !c.nodeValue.trim())).map(c => walk(c, scope, depth)).join('');
    }
    function walk(node, scope, depth) {
      if (node.nodeType === Node.TEXT_NODE) return walkText(node, scope, depth);
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'sc-for') return walkFor(node, scope, depth);
      if (tag === 'sc-if') return walkIf(node, scope, depth);
      if (tag === 'sc-helmet') { helmet = node; return ''; }
      if (tag === 'dc-import') return walkImport(node, scope, depth);
      return walkElement(node, scope, depth);
    }
    let loopN = 0;
    function walkFor(el, scope, depth) {
      const list = compileAttr(el.getAttribute('list') || '', scope); const as = el.getAttribute('as') || 'item'; const idx = 'i' + (loopN++);
      const sub = { vars: new Set([...scope.vars, as]), indexVar: idx };
      const listCode = list.kind === 'static' ? JSON.stringify(list.value) : list.code;
      return ind(depth) + '{(Array.isArray(' + listCode + ') ? ' + listCode + ' : []).map((' + as + ', ' + idx + ') => (\n' + ind(depth + 1) + '<React.Fragment key={' + idx + '}>\n' + walkChildren(el, sub, depth + 2) + ind(depth + 1) + '</React.Fragment>\n' + ind(depth) + '))}\n';
    }
    function walkIf(el, scope, depth) {
      const val = compileAttr(el.getAttribute('value') || '', scope); const cond = val.kind === 'static' ? JSON.stringify(val.value) : val.code;
      return ind(depth) + '{' + cond + ' ? (\n' + ind(depth + 1) + '<>\n' + walkChildren(el, scope, depth + 2) + ind(depth + 1) + '</>\n' + ind(depth) + ') : null}\n';
    }
    function attrValueCode(key, a) {
      if (a.kind === 'static') return /^[^"\n\\{}]*$/.test(a.value) ? '"' + a.value + '"' : '{' + JSON.stringify(a.value) + '}';
      if (key === 'value') return '{' + a.code + ' ?? ""}'; if (key === 'checked') return '{' + a.code + ' ?? false}'; return '{' + a.code + '}';
    }
    function walkImport(el, scope, depth) {
      const name = el.getAttribute('name') || el.getAttribute('component') || ''; const comp = imports[name];
      if (!comp) return ind(depth) + '{/* dc-import ' + name + ' not configured */}\n';
      usedImports.add(name); const props = [];
      for (const { name: an, value } of [...el.attributes]) {
        if (an === 'name' || an === 'component' || an === 'hint-size' || an === 'data-dc-tpl') continue;
        let key = an; if (key.startsWith(CAMEL)) key = kebabToCamel(key.slice(CAMEL.length)); if (key.includes('-') && !key.startsWith('aria-') && !key.startsWith('data-')) key = kebabToCamel(key);
        props.push(key + '=' + attrValueCode(key, compileAttr(value, scope)));
      }
      const kids = el.childNodes.length ? walkChildren(el, scope, depth + 1) : '';
      return ind(depth) + '<' + name + (props.length ? ' ' + props.join(' ') : '') + (kids.trim() ? '>\n' + kids + ind(depth) + '</' + name + '>\n' : ' />\n');
    }
    function walkElement(el, scope, depth) {
      const tag = RAW_UNWRAP[el.localName] || el.localName; const props = []; const pseudo = [];
      for (const { name, value } of [...el.attributes]) {
        if (name === 'sc-name' || name === 'data-dc-tpl' || name === 'hint-size') continue;
        let key = name; if (key.startsWith(CAMEL)) key = kebabToCamel(key.slice(CAMEL.length));
        if (key.startsWith('style-')) { pseudo.push(pseudoClass(key.slice(6), value)); continue; }
        if (key === 'class') key = 'className'; else if (key === 'for') key = 'htmlFor';
        else if (key.startsWith('on')) key = EVENT_MAP[key] || 'on' + key[2].toUpperCase() + key.slice(3);
        else if (HTML_ATTR[key]) key = HTML_ATTR[key];
        else if (key.includes('-') && !key.startsWith('data-') && !key.startsWith('aria-') && !key.startsWith('xmlns')) key = kebabToCamel(key);
        if (key === 'style') { const a = compileAttr(value, scope); props.push('style=' + (a.kind === 'expr' ? '{sx(' + a.code + ')}' : '{' + styleObjCode(value, scope) + '}')); continue; }
        props.push(key + '=' + attrValueCode(key, compileAttr(value, scope)));
      }
      if (pseudo.length) { const ci = props.findIndex(p => p.startsWith('className=')); if (ci >= 0) { const m = props[ci].match(/^className="([^"]*)"$/); if (m) props[ci] = 'className="' + (m[1] + ' ' + pseudo.join(' ')).trim() + '"'; else props[ci] = 'className={[' + props[ci].slice(10).replace(/^\{|\}$/g, '') + ', ' + JSON.stringify(pseudo.join(' ')) + '].filter(Boolean).join(" ")}'; } else props.push('className="' + pseudo.join(' ') + '"'); }
      const openTag = '<' + tag + (props.length ? ' ' + props.join(' ') : '');
      if (VOID.has(tag) || !el.childNodes.length) return ind(depth) + openTag + ' />\n';
      if (tag === 'textarea' && props.some(p => p.startsWith('value='))) return ind(depth) + openTag + ' />\n';
      const kids = walkChildren(el, scope, depth + 1); if (!kids.trim()) return ind(depth) + openTag + ' />\n';
      return ind(depth) + openTag + '>\n' + kids + ind(depth) + '</' + tag + '>\n';
    }
    const tpl = document.createElement('template'); tpl.innerHTML = encodeCase(template);
    const jsx = walkChildren(tpl.content, { vars: new Set(), indexVar: null }, 3);
    let helmetStyle = '', helmetLinks = [], helmetScripts = [], helmetDynamic = false;
    if (helmet) {
      for (const c of [...helmet.children]) {
        const t = c.tagName.toLowerCase();
        if (t === 'style') helmetStyle += c.textContent + '\n';
        else if (t === 'link') helmetLinks.push(c.outerHTML);
        else if (t === 'script') helmetScripts.push(c.getAttribute('src') || '');
      }
      helmetDynamic = helmetStyle.includes('{{');
    }
    let helmetCode = null;
    if (helmetDynamic) helmetCode = '`' + helmetStyle.split(/\{\{([\s\S]+?)\}\}/g).map((p, i) => i & 1 ? '${' + compileExpr(p, { vars: new Set(), indexVar: null }) + ' ?? ""}' : tplEsc(p)).join('') + '`';
    return { jsx, pseudoCss: pseudoRules.join('\n'), helmetStyle, helmetLinks, helmetScripts, helmetDynamic, helmetCode, usedImports: [...usedImports] };
  }, { template, imports: pg.imports || {}, clsPrefix: 'sc' + pg.name[0] });

  const dir = path.join(root, 'src', 'pages', pg.name); fs.mkdirSync(dir, { recursive: true });
  const imports = (out.usedImports || []).map(n => `import ${n} from '../${pg.imports[n]}/index.jsx';`).join('\n');
  const helmetJsx = out.helmetDynamic ? `      <style dangerouslySetInnerHTML={{ __html: ${out.helmetCode} }} />\n` : '';
  fs.writeFileSync(path.join(dir, 'App.jsx'), `// GENERATED by tools/convert-template.mjs from ${pg.file}. Do not edit; edit the design file and re-run.
/* eslint-disable */
import React from 'react';
import { sx } from '../../dc.js';
${imports}

export default function render(v) {
  return (
    <>
${helmetJsx}${out.jsx}    </>
  );
}
`);
  fs.writeFileSync(path.join(dir, 'pseudo.css'), '/* GENERATED: style-hover / style-focus rules from ' + pg.file + ' */\n' + out.pseudoCss + '\n');
  if (!out.helmetDynamic && out.helmetStyle.trim()) fs.writeFileSync(path.join(dir, 'helmet.css'), '/* GENERATED: <helmet> styles from ' + pg.file + ' */\n' + out.helmetStyle.trim() + '\n');
  // logic
  let logic = script.trim();
  const applied = [];
  for (const [desc, find, rep, o] of PATCHES) {
    if (o.pages && !o.pages.includes(pg.name)) continue;
    const before = logic; logic = typeof find === 'string' ? logic.split(find).join(rep) : logic.replace(find, rep);
    if (logic !== before) applied.push(desc);
  }
  if (logic) fs.writeFileSync(path.join(dir, 'logic.js'), `// Logic for the ${pg.name} page, carried over from ${pg.file} with the runtime base
// class swapped for the shim in src/dc.js.${applied.length ? ' Patches applied by the converter: ' + applied.join('; ') + '.' : ''}
/* eslint-disable */
import React from 'react';
import { DCLogic } from '../../dc.js';

${logic}

export default Component;
`);
  // settings from data-props (defaults), with routes mapped
  const settings = {}; for (const [k, p] of Object.entries(props)) { if (k.startsWith('$')) continue; let d = p.default; if (typeof d === 'string' && ROUTES[d]) d = ROUTES[d]; settings[k] = d; }
  fs.writeFileSync(path.join(dir, 'settings.js'), `// Defaults from the design's property panel for ${pg.file}.\nexport const SETTINGS = ${JSON.stringify(settings, null, 2)};\n`);
  // index.jsx: the component (for dc-import) or the page root
  fs.writeFileSync(path.join(dir, 'index.jsx'), `import { createHost } from '../../dc.js';
import render from './App.jsx';
${logic ? "import Component from './logic.js';" : "import { DCLogic } from '../../dc.js';\nconst Component = DCLogic;"}
import './pseudo.css';
${!out.helmetDynamic && out.helmetStyle.trim() ? "import './helmet.css';" : ''}
export default createHost(Component, render);
`);
  console.log(`${pg.name}: App.jsx ${(fs.statSync(path.join(dir, 'App.jsx')).size / 1024).toFixed(0)} KB, logic ${(logic.length / 1024).toFixed(0)} KB, pseudo rules ${out.pseudoCss.split('\n').filter(Boolean).length}, helmet ${out.helmetDynamic ? 'dynamic' : 'static'}; links: ${out.helmetLinks.length}, scripts: ${out.helmetScripts.join(', ') || '-'}${applied.length ? '; patches: ' + applied.length : ''}`);
  return out;
}

// components first so pages can import them
const order = [...cfg.pages.filter(p => p.component), ...cfg.pages.filter(p => !p.component)];
for (const pg of order) await convert(pg);
await browser.close();
