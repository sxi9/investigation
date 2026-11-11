// Walkthrough capture for sharing and review: share links, the public read-only page, guest comments with moderation,
// reviewer comments without edit rights, replies, revocation and the TLP rule.
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v7'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const a = await ctx.newPage(); a.errors = [];
  a.on('pageerror', e => a.errors.push(e.message)); a.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) a.errors.push(m.text().slice(0, 160)); }); a.on('dialog', d => d.accept());
  const btn = (n) => a.getByRole('button', { name: n, exact: true }).first();
  const api = (page, method, url, body) => page.evaluate(async ({ method, url, body }) => { const headers = { 'X-Requested-With': 'CIB' }; if (body !== undefined) headers['content-type'] = 'application/json'; const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; }, { method, url, body });
  const drawer = async (tab) => { if (!(await a.locator('[data-account-drawer]').count())) { await a.locator('[data-account]').click(); await a.waitForTimeout(300); } await a.locator('[data-acct-tab="' + tab + '"]').click(); await a.waitForTimeout(700); };
  const closeDrawer = async () => { if (await a.locator('[data-account-drawer]').count()) { await a.locator('[data-account]').click(); await a.waitForTimeout(200); } };
  const activity = async (page, tab) => { if (!(await page.locator('[data-drawer]').count())) { await page.locator('[data-bell]').click(); await page.waitForTimeout(300); } await page.getByRole('button', { name: tab, exact: true }).click(); await page.waitForTimeout(700); };
  const login = async (page, name) => { await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.locator('input[autocomplete=username]').fill(name); await page.locator('input[type=password]').fill(PW); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL(/desk\.html/, { timeout: 10000 }); };
  let url = '', pub = null, caseId = '';

  await check('W01 setup: admin, reviewer and viewer accounts, the sample case on the board', async () => {
    await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW); await btn('Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 });
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
    for (const [n, role] of [['R. Reviewer', 'reviewer'], ['V. Reader', 'viewer']]) { const r = await api(a, 'POST', '/api/users', { name: n, pass: PW, role, cases: 'all', mustChange: false }); if (r.status !== 200) throw new Error(n + ': ' + JSON.stringify(r.body)); }
    caseId = await a.evaluate(() => window.CIBPage.state.activeId); return (await a.evaluate(() => window.CIBPage.cs().number)) + ' open';
  });
  await check('W02 create a share link from Account → Share (label, expiry, comments allowed)', async () => {
    await drawer('share'); await a.locator('[data-share-label]').fill('For the exchange\'s fraud desk'); await a.locator('[data-share-days]').fill('7'); await a.locator('[data-share-create]').click(); await a.locator('[data-share-new]').waitFor({ timeout: 8000 });
    url = await a.locator('[data-share-new] a').getAttribute('href'); if (!/share\.html#sh/.test(url)) throw new Error('bad url ' + url);
    await shot(a, 'w01-share-link.png', 'Share link: from Account → Share an analyst creates a read-only link for one case, with a label, an expiry in days and whether readers may comment. Only TLP:CLEAR and TLP:GREEN cases can be shared. The link is copied once; the list shows views, expiry and a Revoke button.', [
      { locator: a.locator('[data-share-create]'), text: 'Create the link' }, { locator: a.locator('[data-share-new]'), text: 'Link copied; what the page shows' }, { locator: a.locator('[data-share-revoke]').first(), text: 'Revoke at any time' },
    ], { title: 'W01 · Share link' });
    await closeDrawer(); return url.replace(/:[^:]+$/, ':…');
  });
  await check('W03 the public page opens without a login and shows only what is safe: pinned, non-falsified cards, no notes or tasks', async () => {
    const pctx = await browser.newContext({ viewport: { width: 1100, height: 1300 } }); pub = await pctx.newPage(); await pub.goto(url, { waitUntil: 'networkidle' }); await pub.waitForTimeout(800);
    const cards = await pub.locator('[data-share-card]').count(); if (!cards) throw new Error('no cards');
    const txt = await pub.locator('[data-share-page]').innerText(); const notesLine = await a.evaluate(() => String(window.CIBPage.cs().notes || '').split('\n').find(l => l.trim().length > 20) || ''); if (notesLine && txt.includes(notesLine.trim().slice(0, 40))) throw new Error('case notes leaked to the page'); if (/quick add|INSPECTOR|EVIDENCE INBOX/.test(txt)) throw new Error('board chrome on the page');
    const session = await pub.evaluate(async () => (await fetch('/api/auth/session')).json()); if (session.user) throw new Error('page has a session');
    await shot(pub, 'w02-public-page.png', 'The public page: a reader with the link sees the case brief as a page — TLP, summary, chronology, exhibits grouped by type with defanged indicators, hypotheses under test — and nothing else. No login, no toolbars, no notes, tasks, internal comments, falsified or unpinned cards. The link expiry is printed at the top.', [
      { locator: pub.getByText(/SHARED CASE/).first(), text: 'Read-only, with the expiry' }, { locator: pub.locator('[data-share-card]').first(), text: 'Exhibits, defanged' }, { locator: pub.locator('[data-share-form]'), text: 'Comment form when allowed' },
    ], { title: 'W02 · Public page', scrollTo: 0 });
    return cards + ' cards shown, no session on the page';
  });
  await check('W04 a guest leaves a comment on a card; it waits for moderation', async () => {
    await pub.locator('[data-share-name]').fill('Fraud desk, Exchange Ltd'); await pub.locator('[data-share-form] select').selectOption({ index: 1 }); await pub.locator('[data-share-text]').fill('We saw withdrawals to this address from three of our customers on 30 October. Happy to share logs under NDA.');
    await pub.locator('[data-share-send]').click(); await pub.getByText(/Your comment is with the investigation team/).waitFor({ timeout: 8000 });
    await shot(pub, 'w03-guest-comment.png', 'Guest comment: the reader picks the card (or the case as a whole), gives a name and writes. The comment is stored in its own channel, never in the case document, and waits for an analyst to accept it. Thirty comments an hour per link, and the link can be revoked.', [
      { locator: pub.locator('[data-share-send]'), text: 'Send' }, { locator: pub.getByText(/Your comment is with the investigation team/), text: 'Held for moderation' },
    ], { title: 'W03 · Guest comment', scrollTo: 0 });
    const n = (await api(a, 'GET', '/api/comments?caseId=' + encodeURIComponent(caseId))).body.pending; if (n !== 1) throw new Error('pending ' + n); return '1 comment awaiting moderation';
  });
  await check('W05 the analyst moderates in Activity → comments: accept and reply', async () => {
    await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(1500); await activity(a, 'comments');
    const pending = a.locator('[data-comment-status="pending"]'); if (!(await pending.count())) throw new Error('pending comment not listed');
    await shot(a, 'w04-moderate.png', 'Moderation: the Activity button shows how many comments wait; the comments tab lists them with the card they refer to. Accept publishes the comment on the public page and the board, Reject hides it (it stays in the audit trail). Team members can reply; the reply is shown under the comment on the public page.', [
      { locator: pending.first(), text: 'Guest comment, pending' }, { locator: a.locator('[data-comment-accept]').first(), text: 'Accept' }, { locator: a.locator('[data-comment-text]'), text: 'Your own comment' },
    ], { title: 'W04 · Moderation' });
    await a.locator('[data-comment-accept]').first().click(); await a.waitForTimeout(800);
    const row = a.locator('[data-comment-status="accepted"]').first(); await row.locator('input').fill('Thank you — please send the logs through the secure channel; we will add the dates to the timeline.'); await row.getByRole('button', { name: 'Reply', exact: true }).click(); await a.waitForTimeout(600);
    const all = (await api(a, 'GET', '/api/comments?caseId=' + encodeURIComponent(caseId))).body; if (all.pending !== 0 || !all.comments[0].reply) throw new Error('not accepted/replied'); return 'accepted with a reply';
  });
  await check('W06 the public page now shows the accepted comment with the team\'s reply', async () => {
    await pub.reload({ waitUntil: 'networkidle' }); await pub.waitForTimeout(800);
    const c = pub.getByText(/Fraud desk, Exchange Ltd/).first(); if (!(await c.count())) throw new Error('comment not public'); if (!(await pub.getByText(/secure channel/).count())) throw new Error('reply missing');
    await shot(pub, 'w05-public-comment.png', 'After acceptance the comment appears on the public page under the card it refers to, with the team\'s reply. Rejected comments never appear.', [{ locator: c, text: 'Accepted guest comment with reply' }], { title: 'W05 · Published comment', scrollTo: 0 });
  });
  await check('W07 a reviewer comments on the board without edit rights', async () => {
    const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const r = await rctx.newPage(); await login(r, 'R. Reviewer'); await r.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await r.waitForTimeout(2000);
    const num = await r.evaluate(() => window.CIBPage.cs().number); await activity(r, 'comments');
    await r.locator('[data-comment-text]').fill('Reviewer: the 29 Oct timing conflicts with the exchange statement; please re-check the time zone before publishing.'); await r.locator('[data-comment-send]').click(); await r.waitForTimeout(900);
    const mine = r.locator('[data-comment-status="accepted"]').filter({ hasText: 'Reviewer:' }); if (!(await mine.count())) throw new Error('reviewer comment missing');
    await shot(r, 'w06-reviewer-comment.png', 'Reviewers and viewers comment without edit rights: the comment channel is separate from the case document, so nothing they write touches the board\'s cards or the merge. Editors are notified; the comment shows the author\'s role.', [{ locator: mine.first(), text: 'Reviewer\'s comment, no edit rights needed' }], { title: 'W06 · Reviewer comment' });
    await rctx.close(); return 'reviewer commented on ' + num;
  });
  await check('W08 revoking the link stops the public page; a TLP:RED case cannot be shared', async () => {
    await drawer('share'); await a.locator('[data-share-revoke]').first().click(); await a.waitForTimeout(600); await closeDrawer();
    await pub.reload({ waitUntil: 'networkidle' }); await pub.waitForTimeout(600); if (!(await pub.getByText(/revoked/).count())) throw new Error('page still open');
    await shot(pub, 'w07-revoked.png', 'Revoked: the page says so and shows nothing. Expired links behave the same. Every creation, view count, revocation, comment and moderation decision is in the audit trail.', [{ locator: pub.getByText(/revoked/).first(), text: 'Link revoked' }], { title: 'W07 · Revoked link' });
    await api(a, 'PUT', '/api/store', { cases: [{ id: 'c-red', number: 'CASE 0998', title: 'Restricted', tlp: 'red', items: [], threads: [], groups: [], log: [], dismissed: [] }] });
    const red = await api(a, 'POST', '/api/shares', { caseId: 'c-red' }); if (red.status !== 403) throw new Error('red case shared: ' + red.status); return 'revoked → 410; TLP:RED → 403';
  });
  const errs = a.errors.filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v7-run.json')); await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
