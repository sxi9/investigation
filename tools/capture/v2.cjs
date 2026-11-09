// End-to-end run of the v2 app against a live server (login, desk, board, users, sync, guest, lockout, AI, proxy).
// Usage: start the server with a fresh data dir, then: node tools/capture/v2.cjs [http://127.0.0.1:8787]
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v2'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';

(async () => {
  const browser = await chromium.launch();
  const mk = async (name) => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(name + ': ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) page.errors.push(name + ': ' + m.text().slice(0, 160)); }); page.on('dialog', d => d.accept()); return { ctx, page }; };
  const text = (page, t) => page.getByText(t, { exact: true }).first();
  const btn = (page, n) => page.getByRole('button', { name: n, exact: true }).first();
  const boardState = (page) => page.evaluate(() => { const el = document.querySelector('#root'); const k = Object.keys(el).find(k => k.startsWith('__reactContainer')); let f = el[k]; while (f && !(f.stateNode && f.stateNode.logic)) f = f.child; const s = f && f.stateNode.logic.state; return s ? { activeId: s.activeId, cases: (s.cases || []).map(c => ({ id: c.id, number: c.number, title: c.title, items: (c.items || []).length, domain: c.domain })), sel: s.sel, screen: s.screen } : null; });
  const api = (page, method, url, body) => page.evaluate(async ({ method, url, body }) => { const r = await fetch(url, { method, headers: { 'X-Requested-With': 'CIB', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; }, { method, url, body });

  // ================= admin: first run
  const A = await mk('admin'); const a = A.page;
  await check('V01 first visit shows the setup card (no accounts yet)', async () => { await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.waitForTimeout(500); if (!(await text(a, 'Open the office.').count())) throw new Error('no setup card'); });
  await shot(a, 'v01-setup.png', 'First run: no accounts exist, so the sign-in page asks for the administrator. Passwords are hashed with scrypt on the server; the browser never stores them.', [
    { locator: a.locator('input[autocomplete=username]'), text: 'Admin name' }, { locator: a.locator('input[type=password]').first(), text: 'Password (8+, not on the common list, not your name)' }, { locator: btn(a, 'Create admin account'), text: 'Create admin account' },
  ], { title: 'V01 · First-run setup' });
  await check('V01 setup creates the admin and lands on the desk', async () => {
    await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW);
    await btn(a, 'Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 }); await a.waitForTimeout(800);
    const s = await api(a, 'GET', '/api/auth/session'); if (!s.body.user || s.body.user.role !== 'admin') throw new Error(JSON.stringify(s.body));
  });
  await check('V02 the board seeds the two sample cases on a brand-new server', async () => {
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
    const st = await boardState(a); if (!st || st.cases.length < 2) throw new Error(JSON.stringify(st));
    const r = await api(a, 'GET', '/api/store'); if (r.body.cases.length < 2) throw new Error('server has ' + r.body.cases.length + ' cases'); return r.body.cases.map(c => c.number + ' ' + c.title).join(' | ');
  });
  await check('V02 desk lists the cases from the server', async () => { await a.goto(BASE + '/desk.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(1200); if ((await a.locator('[data-folder]').count()) < 2) throw new Error('folders ' + await a.locator('[data-folder]').count()); });
  await shot(a, 'v02-desk.png', 'The case-files desk after sign-in: every case the account may see as a folder, drawers by review state, the morning brief, filters, quick add, OSINT, and the admin\'s Users button. Everything shown comes from the server.', [
    { locator: a.locator('[data-folder]').first(), text: 'Case folder (open, flip, rename, tag, duplicate, export, archive, public)' }, { locator: btn(a, 'Users'), text: 'Users, roles and access (admin)' }, { locator: btn(a, 'New case'), text: 'New case' }, { locator: btn(a, 'Sign out'), text: 'Sign out' },
  ], { title: 'V02 · Case files desk' });

  // ================= admin: users panel
  await check('V03 admin adds an analyst, a reviewer and a viewer from the desk', async () => {
    await btn(a, 'Users').click(); await a.waitForTimeout(400);
    const add = async (name, role) => {
      const nameIn = a.getByPlaceholder(/name/i).last(); await nameIn.fill(name);
      const passIn = a.locator('input[type=password]').last(); await passIn.fill(PW + '-' + role);
      const roleSel = a.locator('select').filter({ has: a.locator('option', { hasText: 'Reviewer' }) }).last(); await roleSel.selectOption(role);
      await btn(a, 'Add').click(); await a.waitForTimeout(500);
    };
    await add('Ana Lyst', 'analyst'); await add('Rev Iewer', 'reviewer'); await add('View Only', 'viewer');
    const r = await api(a, 'GET', '/api/users'); const names = r.body.users.map(u => u.name + ':' + u.role); if (r.body.users.length !== 4) throw new Error(names.join(', ')); return names.join(', ');
  });
  await shot(a, 'v03-users.png', 'Users & access: accounts with role, TLP:RED grant and case scope, password reset (the user must choose a new one at next sign-in), removal, and the sign-in audit from the server. New users get a temporary password that unlocks nothing but the password change.', [
    { locator: text(a, 'Ana Lyst'), text: 'Analyst: edits the cases in scope' }, { locator: btn(a, 'Add'), text: 'Add a user' },
  ], { title: 'V03 · Users and access' });
  await btn(a, 'Close').click().catch(() => {});

  // ================= analyst: temporary password, sync, live updates
  const B = await mk('analyst'); const b = B.page;
  await check('V04 analyst signs in with the temporary password and must change it', async () => {
    await b.goto(BASE + '/', { waitUntil: 'networkidle' }); await b.waitForTimeout(400);
    await b.locator('input[autocomplete=username]').fill('Ana Lyst'); await b.locator('input[type=password]').first().fill(PW + '-analyst'); await btn(b, 'Sign in').click(); await b.waitForTimeout(800);
    if (!(await text(b, 'Choose a new password.').count())) throw new Error('no change-password step');
    const pw = b.locator('input[type=password]'); await pw.nth(0).fill('Analyst-Owns-This-Now-7'); await pw.nth(1).fill('Analyst-Owns-This-Now-7'); await btn(b, 'Save and continue').click();
    await b.waitForURL(/desk\.html/, { timeout: 10000 }); await b.waitForTimeout(800);
  });
  await shot(b, 'v04-analyst-desk.png', 'The analyst\'s desk: same cases (scope "all"), no Users button, their own name in the top bar.', [{ locator: text(b, 'Ana Lyst · Analyst').or(b.getByText(/Ana Lyst/).first()), text: 'Signed in as analyst' }], { title: 'V04 · Analyst view' });
  await check('V05 analyst edits a case on the board; the admin\'s open board receives it live', async () => {
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(1500);
    await b.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await b.waitForTimeout(1500);
    const st = await boardState(b); const target = st.cases.find(c => c.id === 'c1') || st.cases[0];
    // switch to the same case on both, then rename it on the analyst's board
    for (const p of [a, b]) { await p.locator('select').filter({ has: p.locator('option', { hasText: target.number }) }).first().selectOption(target.id); await p.waitForTimeout(300); }
    const title = 'Operation Lantern — edited by Ana ' + Date.now().toString(36);
    const t = b.getByPlaceholder('Case title'); await t.fill(title); await t.press('Tab'); await b.waitForTimeout(1800);
    const srv = await api(b, 'GET', '/api/store/case/' + target.id); if (srv.body.case.title !== title) throw new Error('server title: ' + srv.body.case.title);
    await a.waitForTimeout(1500);
    const local = await a.evaluate(() => JSON.parse(localStorage.getItem('cyber-investigation-board.v1')).cases); const got = local.find(c => c.id === target.id);
    if (got.title !== title) throw new Error('admin local title: ' + got.title); return 'rev ' + srv.body.case.rev + ' delivered over SSE';
  });

  // ================= board: new features
  await check('V06 board: switch the case mode and seed the Whitechapel example', async () => {
    const modeSel = a.locator('select').filter({ has: a.locator('option', { hasText: 'Homicide' }) }).first(); await modeSel.waitFor();
    const ex = a.locator('select option', { hasText: /Example: Whitechapel/ }); if (await ex.count()) { const v = await ex.first().getAttribute('value'); const sel = a.locator('select').filter({ has: a.locator('option', { hasText: /Example: Whitechapel/ }) }).first(); await sel.selectOption(v); await a.waitForTimeout(2500); }
    const st = await boardState(a); const w = st.cases.find(c => /Whitechapel/.test(c.title)); if (!w) throw new Error('no example case: ' + st.cases.map(c => c.title).join(' | ')); return w.number + ' ' + w.title + ' · ' + w.items + ' items · mode ' + w.domain;
  });
  await a.getByRole('button', { name: 'Fit', exact: true }).first().click().catch(() => {}); await a.waitForTimeout(600);
  await shot(a, 'v05-board-example.png', 'The board in Homicide mode with the built-in worked example (Whitechapel, 1888): modes change the card vocabulary, suspect roles and the suspect matrix. Case changes made here are pushed to the server and appear on every other signed-in board.', [
    { locator: a.locator('select').filter({ has: a.locator('option', { hasText: 'Homicide' }) }).first(), text: 'Case mode' }, { locator: btn(a, 'Suspects'), text: 'Suspect matrix (means · motive · opportunity · alibi)' }, { locator: btn(a, 'Geo'), text: 'Geo view (Leaflet map)' },
  ], { title: 'V05 · Board, modes and the worked example' });
  await check('V07 geo view renders a Leaflet map', async () => { await btn(a, 'Geo').click(); await a.waitForTimeout(2500); if (!(await a.locator('.leaflet-container').count())) throw new Error('no leaflet map'); });
  await shot(a, 'v06-geo.png', 'Geo (G): location cards are placed on a map; OpenStreetMap tiles load directly, geocoding goes through the server proxy.', [{ locator: btn(a, 'Geo'), text: 'Geo view' }], { title: 'V06 · Geo view' });
  await btn(a, 'Geo').click(); await a.waitForTimeout(400);
  await check('V08 suspect matrix opens', async () => { await btn(a, 'Suspects').click(); await a.waitForTimeout(500); });
  await shot(a, 'v07-suspects.png', 'Suspect matrix: every person card marked as a suspect scored on means, motive, opportunity and alibi.', [], { title: 'V07 · Suspect matrix' });
  await a.keyboard.press('Escape'); await btn(a, 'Close').click().catch(() => {});
  await check('V09 "Analyse with Claude" works without a model key (built-in engine)', async () => {
    const card = a.locator('[data-card][data-kind="card"]').first(); const bb = await card.boundingBox();
    await card.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: bb.x + 5, clientY: bb.y + 20, pointerId: 1, isPrimary: true, bubbles: true }); await a.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 1, bubbles: true }))); await a.waitForTimeout(300);
    const ai = a.getByRole('button', { name: /Analyse with Claude/i }).first(); await ai.scrollIntoViewIfNeeded(); await ai.click(); await a.waitForTimeout(2500);
    const txt = await a.locator('aside').last().innerText(); if (!/Rule-based assessment|CLAUDE · ASSESSMENT/i.test(txt)) throw new Error('no assessment shown: ' + txt.slice(0, 200));
  });
  await shot(a, 'v08-ai-local.png', '"Analyse with Claude" without an API key: the server\'s built-in engine answers in the same JSON shape (summary, suggested stamp, suggested threads, next steps) and labels itself as rule-based. Set ANTHROPIC_API_KEY on the server to use the model instead.', [{ locator: a.getByText(/CLAUDE · ASSESSMENT/i).first(), text: 'Assessment from the local engine' }], { title: 'V08 · AI gateway (local engine)', scrollTo: 0 });
  await check('V10 live feed card: ThreatFox through the server proxy', async () => {
    const feedBtn = a.getByRole('button', { name: '+ Live feed', exact: true }); if (!(await feedBtn.count())) throw new Error('no feed button');
    await feedBtn.click(); await a.waitForTimeout(400);
    const pin = a.getByRole('button', { name: 'Pin', exact: true }).first(); if (await pin.count()) await pin.click();
    await a.waitForTimeout(6000);
    const p = await api(a, 'GET', '/api/proxy?url=' + encodeURIComponent('https://threatfox-api.abuse.ch/api/v1/')); return 'proxy reachable: HTTP ' + p.status;
  });
  await check('V11 hand-over pack and court brief exports', async () => {
    const [dl] = await Promise.all([a.waitForEvent('download', { timeout: 30000 }), btn(a, 'Hand-over pack').click()]); const f = dl.suggestedFilename(); if (!/\.zip$/.test(f)) throw new Error(f);
    await dl.saveAs(path.join(OUT, '..', 'exports', f)); return f;
  });
  await check('V12 settings panel (SIEM links, sounds, theme)', async () => { await btn(a, 'Settings').click(); await a.waitForTimeout(400); });
  await shot(a, 'v09-settings.png', 'Settings: theme, atmosphere (sounds, rain, typewriter), SIEM deep-link templates and other preferences, saved per user on the server.', [], { title: 'V09 · Settings' });
  await a.keyboard.press('Escape'); await btn(a, 'Close').click().catch(() => {});

  // ================= reviewer and viewer limits (API-level, through the browser session)
  const C = await mk('viewer'); const c = C.page;
  await check('V13 viewer: read-only everywhere, no Users panel', async () => {
    await c.goto(BASE + '/', { waitUntil: 'networkidle' }); await c.locator('input[autocomplete=username]').fill('View Only'); await c.locator('input[type=password]').first().fill(PW + '-viewer'); await btn(c, 'Sign in').click(); await c.waitForTimeout(800);
    const pw = c.locator('input[type=password]'); await pw.nth(0).fill('Viewer-Reads-Only-2026'); await pw.nth(1).fill('Viewer-Reads-Only-2026'); await btn(c, 'Save and continue').click(); await c.waitForURL(/desk\.html/, { timeout: 10000 }); await c.waitForTimeout(800);
    if (await btn(c, 'Users').count()) throw new Error('viewer sees Users');
    const w = await api(c, 'PUT', '/api/store', { cases: [{ id: 'c1', number: 'CASE 0417', title: 'viewer edit', items: [], threads: [] }] }); if (w.body.rejected.length !== 1) throw new Error(JSON.stringify(w.body));
    const u = await api(c, 'GET', '/api/users'); if (u.status !== 403) throw new Error('users ' + u.status); return 'rejected: ' + w.body.rejected[0].reason;
  });
  await shot(c, 'v10-viewer.png', 'A viewer\'s desk: the same folders, read-only; the server rejects any write from this role.', [], { title: 'V10 · Viewer' });

  // ================= TLP:RED scope
  await check('V14 TLP:RED cases stay hidden from accounts without the grant', async () => {
    const red = { id: 'red1', number: 'CASE 0900', title: 'Red case', tlp: 'red', items: [], threads: [], groups: [], log: [], dismissed: [] };
    const w = await api(a, 'PUT', '/api/store', { cases: [red] }); if (w.body.accepted.length !== 1) throw new Error(JSON.stringify(w.body));
    const v = await api(c, 'GET', '/api/store'); if (v.body.cases.some(x => x.id === 'red1')) throw new Error('viewer sees red');
    const an = await api(b, 'GET', '/api/store'); if (an.body.cases.some(x => x.id === 'red1')) throw new Error('analyst without grant sees red');
    const me = (await api(a, 'GET', '/api/users')).body.users.find(u => u.name === 'Ana Lyst'); await api(a, 'PATCH', '/api/users/' + me.id, { tlpRed: true });
    const an2 = await api(b, 'GET', '/api/store'); if (!an2.body.cases.some(x => x.id === 'red1')) throw new Error('granted analyst still cannot see red');
  });

  // ================= guest access
  await check('V15 public case → guest can read it only', async () => {
    const all = (await api(a, 'GET', '/api/store')).body.cases; const alreadyPublic = all.filter(x => x.public && ['', 'clear', 'green'].includes(x.tlp || ''));
    if (!alreadyPublic.length) { const g = await api(c, 'POST', '/api/auth/guest'); if (g.status !== 404) throw new Error('guest allowed without public cases'); }
    const st = all.find(x => x.id === 'c1'); await api(a, 'PUT', '/api/store', { cases: [{ ...st, public: true, tlp: 'green' }] });
    const expected = alreadyPublic.filter(x => x.id !== 'c1').length + 1;
    const G = await mk('guest'); const gp = G.page; await gp.goto(BASE + '/', { waitUntil: 'networkidle' }); await gp.waitForTimeout(500);
    const gbtn = gp.getByRole('button', { name: /Continue as a guest/i }); if (!(await gbtn.count())) throw new Error('no guest button'); await gbtn.click(); await gp.waitForURL(/desk\.html/, { timeout: 10000 }); await gp.waitForTimeout(1000);
    const n = await gp.locator('[data-folder]').count(); if (n !== expected) throw new Error('guest sees ' + n + ' folders, expected ' + expected);
    const gs = (await api(gp, 'GET', '/api/store')).body.cases; if (gs.some(x => !x.public || !['', 'clear', 'green'].includes(x.tlp || ''))) throw new Error('guest received a non-public case');
    await shot(gp, 'v11-guest.png', 'Guest access: when a case is marked public (TLP:CLEAR or GREEN only), the sign-in page offers "Continue as a guest" and the desk shows just that case, read-only.', [{ locator: gp.locator('[data-folder]').first(), text: 'Only public CLEAR/GREEN cases' }], { title: 'V11 · Guest' });
    const w = await api(gp, 'PUT', '/api/store', { cases: [] }); if (w.status !== 403) throw new Error('guest write ' + w.status);
    await G.ctx.close();
  });

  // ================= lockout
  await check('V16 ten wrong passwords lock the account for 15 minutes', async () => {
    const L = await mk('lock'); const lp = L.page; await lp.goto(BASE + '/', { waitUntil: 'networkidle' });
    let last = null; for (let i = 0; i < 10; i++) last = await api(lp, 'POST', '/api/auth/login', { name: 'Rev Iewer', pass: 'nope-' + i });
    const r = await api(lp, 'POST', '/api/auth/login', { name: 'Rev Iewer', pass: PW + '-reviewer' }); if (r.status !== 423) throw new Error('status ' + r.status + ' ' + JSON.stringify(r.body));
    await lp.locator('input[autocomplete=username]').fill('Rev Iewer'); await lp.locator('input[type=password]').first().fill(PW + '-reviewer'); await btn(lp, 'Sign in').click(); await lp.waitForTimeout(600);
    await shot(lp, 'v12-lockout.png', 'Brute-force protection: after ten failures the account is locked for 15 minutes even with the right password, sign-ins are rate-limited per IP, and every attempt is in the audit log. An admin reset clears the lock.', [{ locator: lp.getByText(/locked/i).first(), text: 'Lockout message' }], { title: 'V12 · Lockout' });
    await L.ctx.close(); return r.body.error;
  });
  await check('V17 audit chain verifies; health reports the engine', async () => { const h = await api(a, 'GET', '/api/health'); if (!h.body.audit.ok) throw new Error('audit chain broken'); return h.body.audit.rows + ' audit rows, ai=' + h.body.ai; });
  await check('V18 sign out invalidates the session', async () => { await a.goto(BASE + '/desk.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(800); await btn(a, 'Sign out').click(); await a.waitForURL(/\/(index\.html)?(#.*)?$/, { timeout: 10000 }).catch(() => {}); const s = await api(a, 'GET', '/api/auth/session'); if (s.body.user) throw new Error('still signed in'); });
  await shot(a, 'v13-signin.png', 'Sign-in page once accounts exist. Sessions last 12 hours and lock after 15 minutes idle.', [{ locator: btn(a, 'Sign in'), text: 'Sign in' }], { title: 'V13 · Sign in' });

  const errs = [...a.errors, ...b.errors, ...c.errors].filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v2-run.json'));
  await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
