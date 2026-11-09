// Walkthrough capture for the research panel, the multi-provider AI gateway and collaboration features.
// Usage: start the server with a fresh data dir, then: node tools/capture/v3.cjs [http://127.0.0.1:8787]
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v3'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';

(async () => {
  const browser = await chromium.launch();
  const mk = async (name) => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(name + ': ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) page.errors.push(name + ': ' + m.text().slice(0, 160)); }); page.on('dialog', d => d.accept()); return { ctx, page }; };
  const btn = (page, n) => page.getByRole('button', { name: n, exact: true }).first();
  const api = (page, method, url, body) => page.evaluate(async ({ method, url, body }) => { const headers = { 'X-Requested-With': 'CIB' }; if (body !== undefined) headers['content-type'] = 'application/json'; const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; }, { method, url, body });
  const st = (page) => page.evaluate(() => { const L = window.CIBPage; return L ? { activeId: L.state.activeId, sel: L.state.sel, cases: L.state.cases.map(c => ({ id: c.id, number: c.number, title: c.title, items: c.items.length, review: c.review, tlp: c.tlp })) } : null; });
  const login = async (page, name, pass) => { await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(300); await page.locator('input[autocomplete=username]').fill(name); await page.locator('input[type=password]').first().fill(pass); await btn(page, 'Sign in').click(); await page.waitForURL(/desk\.html/, { timeout: 10000 }); await page.waitForTimeout(600); };
  const openBoard = async (page, caseId) => { await page.goto(BASE + '/board.html' + (caseId ? '#case=' + caseId : ''), { waitUntil: 'networkidle' }); await page.waitForTimeout(1800); };
  const selectCard = async (page, idx) => { const loc = page.locator('[data-card][data-kind="card"]').nth(idx); const bb = await loc.boundingBox(); await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: bb.x + 5, clientY: bb.y + 20, pointerId: 1, isPrimary: true, bubbles: true }); await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 1, bubbles: true }))); await page.waitForTimeout(200); };

  // ---- setup: admin + analyst + reviewer with TLP:RED
  const A = await mk('admin'); const a = A.page;
  await check('W01 setup admin, create analyst and reviewer', async () => {
    await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW); await btn(a, 'Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 });
    await api(a, 'POST', '/api/users', { name: 'Ana Lyst', pass: PW, role: 'analyst', cases: 'all', tlpRed: true, mustChange: false });
    await api(a, 'POST', '/api/users', { name: 'Rev Iewer', pass: PW, role: 'reviewer', cases: 'all', tlpRed: true, mustChange: false });
    await openBoard(a); const s = await st(a); if (!s || s.cases.length < 2) throw new Error('no seeded cases');
  });

  // ---- AI providers
  await check('W02 the gateway reports its provider chain', async () => { const r = await api(a, 'GET', '/api/ai/providers'); if (!r.body.providers.some(p => p.id === 'local')) throw new Error(JSON.stringify(r.body)); return r.body.chain; });

  // ---- research panel, automatic
  await check('W03 research panel: automatic research on the Binance case', async () => {
    const s = await st(a); const c2 = s.cases.find(c => c.id === 'c2'); if (c2) { await a.locator('select').filter({ has: a.locator('option', { hasText: 'CASE 0418' }) }).first().selectOption('c2'); await a.waitForTimeout(400); }
    await a.locator('[data-research-open]').click(); await a.waitForTimeout(500);
    await a.locator('[data-research-query]').fill('2026 Binance hack TraderTraitor');
    await shot(a, 'w01-research-start.png', 'The ◆ AI research panel on the board. Type what to research (the case title is pre-filled), choose sources, optionally paste URLs, and keep "use case notes as context" on so the model knows what the case already says. Sources without a server key are greyed out.', [
      { locator: a.locator('[data-research-query]'), text: 'Query' }, { locator: a.getByRole('button', { name: 'wikipedia' }), text: 'Sources (free: Wikipedia, GDELT news, Hacker News, NVD/KEV; keyed: Tavily, Brave, Serper)' }, { locator: a.locator('[data-research-run]'), text: 'Research and propose cards' }, { locator: a.getByRole('button', { name: /Prompt for Claude/ }), text: 'Manual route: prompt for Claude, paste the answer' },
    ], { title: 'W01 · AI research: start' });
    await a.locator('[data-research-run]').click(); await a.waitForSelector('[data-research-inbox]', { timeout: 150000 }); await a.waitForTimeout(400);
    const txt = await a.locator('#cib-research').innerText(); const m = txt.match(/(\d+) sources · (\d+) cards · (\d+) threads · engine (\S+)/); if (!m || Number(m[2]) < 1) throw new Error('no cards: ' + txt.slice(0, 200)); return m[0];
  });
  await shot(a, 'w02-research-results.png', 'Results: a summary, the sources that were gathered and read, and proposed cards grouped by type with a confidence per card and the source it came from. Low-confidence cards start unticked. Every card keeps its source, URL, collection date and Admiralty grade.', [
    { locator: a.locator('#cib-research').getByText(/sources ·/).first(), text: 'Counts and the engine that extracted (rule engine here; a model when a key is set)' }, { locator: a.locator('#cib-research input[type=checkbox]').nth(1), text: 'Tick what to import' }, { locator: a.locator('[data-research-inbox]'), text: 'Add selected to inbox' }, { locator: a.locator('[data-research-pin]'), text: 'Pin selected to board' },
  ], { title: 'W02 · AI research: proposed cards' });
  await check('W04 import the proposed cards into the inbox', async () => { const s0 = await st(a); const before = s0.cases.find(c => c.id === s0.activeId).items; await a.locator('[data-research-inbox]').click(); await a.waitForTimeout(900); const s1 = await st(a); const after = s1.cases.find(c => c.id === s1.activeId).items; if (after <= before) throw new Error(before + '->' + after); return 'items ' + before + ' -> ' + after; });
  await shot(a, 'w03-research-imported.png', 'After import: the cards wait in the evidence inbox with their source and grade, plus a "Research:" document holding the summary and the source list. Pin what holds up; delete what does not. The case log records the import.', [
    { locator: a.getByText('EVIDENCE INBOX'), text: 'Imported research cards in the inbox' },
  ], { title: 'W03 · AI research: imported' });

  // ---- research panel, manual route
  await check('W05 manual route: build the prompt, paste a Claude answer, import', async () => {
    await a.locator('[data-research-open]').click(); await a.waitForTimeout(400); await a.getByRole('button', { name: /Prompt for Claude/ }).click();
    await a.locator('[data-research-query]').fill('2026 Binance hack TraderTraitor');
    await a.locator('[data-research-prompt]').click(); await a.waitForSelector('textarea[readonly]', { timeout: 150000 });
    const p = await a.locator('textarea[readonly]').inputValue(); if (!/RESEARCH QUERY/.test(p)) throw new Error('no prompt');
    await a.locator('[data-research-paste]').fill(JSON.stringify({ summary: 'Pasted from Claude: on 29 Oct 2026 about $6.3B left Binance hot wallets; the FBI attributes it to TraderTraitor (DPRK).', sources: [{ title: 'FBI alert', url: 'https://www.fbi.gov/investigate/cyber/alerts/2026/north-korea-responsible-for-6-billion-binance-attack' }], cards: [{ type: 'event', title: 'FBI attributes the Binance theft to DPRK', date: '2026-10-31', body: 'FBI Cyber alert names TraderTraitor and publishes attacker addresses.', source_index: 0, confidence: 'high', tags: 'attribution' }, { type: 'person', title: 'TraderTraitor', body: 'DPRK unit, Lazarus-linked, also behind Bybit 2025.', source_index: 0, confidence: 'high', tags: 'actor' }], threads: [{ from: 1, to: 0, rel: 'suspected', why: 'FBI attribution' }] }));
    await a.locator('[data-research-parse]').click(); await a.waitForSelector('[data-research-inbox]', { timeout: 10000 }); await a.waitForTimeout(300);
    return 'prompt ' + p.length + ' chars';
  });
  await shot(a, 'w04-research-manual.png', 'The manual route when the server has no model key or you prefer Claude in the app: step 1 gathers sources and copies a complete prompt (instructions, case context, what is already on the board, the sources, the exact JSON shape); step 2 you run it in Claude; step 3 paste the JSON answer and it is validated into the same review table.', [
    { locator: a.locator('[data-research-prompt]'), text: '1 · Build and copy the prompt' }, { locator: a.locator('textarea[readonly]'), text: 'The prompt (also on the clipboard)' }, { locator: a.locator('[data-research-paste]'), text: '2 · Paste Claude\'s JSON answer' }, { locator: a.locator('[data-research-parse]'), text: '3 · Check the answer' },
  ], { title: 'W04 · AI research: prompt for Claude, paste the answer', scrollTo: 0 });
  await a.locator('[data-research-pin]').click(); await a.waitForTimeout(800);

  // ---- collaboration: presence and soft locks
  const B = await mk('ana'); const b = B.page;
  await check('W06 presence: two analysts on the same case see each other; editing a card shows a soft lock', async () => {
    await login(b, 'Ana Lyst', PW); await openBoard(b, 'c1'); await openBoard(a, 'c1');
    await selectCard(b, 0); await b.locator('aside input').first().focus(); await b.waitForTimeout(2500);
    await selectCard(a, 0); await a.waitForTimeout(2500);
    const strip = await a.locator('[data-presence]').innerText(); if (!/Ana Lyst/.test(strip)) throw new Error('no presence: ' + strip);
    if (!(await a.locator('[data-softlock]').count())) throw new Error('no soft lock shown'); return strip.replace(/\n/g, ' ');
  });
  await shot(a, 'w05-presence.png', 'Presence: the strip at the top shows who else is on this case and which exhibit they are looking at; a pencil means they are typing in it. Selecting the same card shows a soft-lock notice. Edits are not blocked: concurrent saves are merged field by field on the server.', [
    { locator: a.locator('[data-presence]'), text: 'Who is here, and what they are on' }, { locator: a.locator('[data-softlock]'), text: 'Soft lock: someone is editing this card' },
  ], { title: 'W05 · Presence and soft locks' });

  // ---- merge of concurrent edits
  await check('W07 concurrent edits on the same case are merged, not overwritten', async () => {
    const t = 'Lantern (admin rename ' + Date.now().toString(36) + ')';
    const ta = a.getByPlaceholder('Case title'); await ta.fill(t); await ta.press('Tab');
    await b.locator('aside input').first().fill('Card edited by Ana'); await b.locator('aside input').first().press('Tab');
    await a.waitForTimeout(2500); await b.waitForTimeout(1500);
    const srv = (await api(a, 'GET', '/api/store/case/c1')).body.case; const edited = srv.items.find(i => i.title === 'Card edited by Ana');
    if (srv.title !== t) throw new Error('admin title lost: ' + srv.title); if (!edited) throw new Error('Ana\'s card edit lost');
    const revs = (await api(a, 'GET', '/api/store/case/c1/revisions')).body.revisions; return 'rev ' + srv.rev + ', ' + revs.length + ' revisions kept';
  });

  // ---- notifications: mention
  await check('W08 @mention in a comment notifies the named analyst', async () => {
    await selectCard(a, 1); const cm = a.getByPlaceholder('Comment… Ctrl+Enter to post'); await cm.fill('@Ana Lyst can you confirm the registrar for this one?'); await cm.press('Control+Enter'); await a.waitForTimeout(2500);
    const n = (await api(b, 'GET', '/api/notifications')).body; if (!n.items.some(x => x.type === 'mention')) throw new Error(JSON.stringify(n)); return n.unread + ' unread for Ana';
  });
  await b.locator('[data-bell]').click(); await b.waitForTimeout(400);
  await shot(b, 'w06-notifications.png', 'Activity drawer (◆ bottom right): mentions (@name in a comment), review requests, overdue tasks and watcher alerts, pushed live from the server. Click one to jump to the case and card. The History tab lists server revisions; Review sends the file to a reviewer.', [
    { locator: b.locator('[data-bell]'), text: 'Activity button with the unread count' }, { locator: b.locator('[data-drawer]'), text: 'Notifications · History · Review' },
  ], { title: 'W06 · Notifications' });

  // ---- revision history and restore
  await check('W09 history tab lists revisions and restores one', async () => {
    await b.getByRole('button', { name: 'history', exact: true }).click(); await b.waitForTimeout(600);
    const rows = await b.locator('[data-restore]').count(); if (rows < 1) throw new Error('no revisions listed');
    await shot(b, 'w07-history.png', 'History: every save by anyone is a server revision (who, when, size). Restore puts the board back to that revision and keeps the current state in the history, so nothing is lost.', [
      { locator: b.locator('[data-restore]').first(), text: 'Restore this revision' },
    ], { title: 'W07 · Revision history' });
    const oldest = b.locator('[data-restore]').last(); const rev = await oldest.getAttribute('data-restore'); await oldest.click(); await b.waitForTimeout(1200);
    const srv = (await api(b, 'GET', '/api/store/case/c1')).body.case; return 'restored rev ' + rev + ' → now rev ' + srv.rev + ' (' + srv.title + ')';
  });

  // ---- review rule for TLP:RED
  await check('W10 TLP:RED: the requester cannot publish; a second account can', async () => {
    await api(a, 'PUT', '/api/store', { cases: [{ id: 'red1', number: 'CASE 0900', title: 'Red file', tlp: 'red', review: 'draft', items: [], threads: [], groups: [], log: [], dismissed: [] }] });
    await openBoard(a, 'red1'); await a.locator('[data-bell]').click(); await a.waitForTimeout(300); await a.getByRole('button', { name: 'review', exact: true }).click(); await a.waitForTimeout(600);
    await a.locator('[data-reviewer]').selectOption({ label: /Rev Iewer/ }); 
    await shot(a, 'w08-request-review.png', 'Review tab: pick a reviewer and send the file for review. The reviewer is notified. For TLP:RED and AMBER+STRICT files the server refuses to let the same account that requested review also publish it.', [
      { locator: a.locator('[data-reviewer]'), text: 'Choose the reviewer' }, { locator: a.locator('[data-request-review]'), text: 'Send for review' },
    ], { title: 'W08 · Request review' });
    await a.locator('[data-request-review]').click(); await a.waitForTimeout(2000);
    let cur = (await api(a, 'GET', '/api/store/case/red1')).body.case; if (cur.review !== 'in review') throw new Error('review state ' + cur.review);
    const r = await api(a, 'PUT', '/api/store', { cases: [{ ...cur, review: 'published', signoff: { by: 'S. Murugan', at: new Date().toISOString() } }] }); if (!r.body.rejected.length) throw new Error('self-publish was accepted');
    const C = await mk('rev'); const c = C.page; await login(c, 'Rev Iewer', PW); const n = (await api(c, 'GET', '/api/notifications')).body; if (!n.items.some(x => x.type === 'review')) throw new Error('reviewer not notified');
    cur = (await api(c, 'GET', '/api/store/case/red1')).body.case; const ok = await api(c, 'PUT', '/api/store', { cases: [{ ...cur, review: 'published', signoff: { by: 'Rev Iewer', at: new Date().toISOString() } }] }); if (!ok.body.accepted.length) throw new Error(JSON.stringify(ok.body));
    await C.ctx.close(); return 'rejected: ' + r.body.rejected[0].reason;
  });

  const errs = [...a.errors, ...b.errors].filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v3-run.json'));
  await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
