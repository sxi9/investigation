// Walkthrough capture for reporting and integrations: weighted ACH, AI drafts, document ingestion, quick-add fixes,
// timeline by time of day, pushes to MISP/TheHive/Jira (stand-in server on 9797), STIX feeds, the brief, Esc and placement.
const fs = require('fs'); const path = require('path'); const http = require('http');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v6'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';
const get = (url) => new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => res({ status: r.statusCode, body: b, type: r.headers['content-type'] })); }).on('error', rej));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const a = await ctx.newPage(); a.errors = [];
  a.on('pageerror', e => a.errors.push(e.message)); a.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) a.errors.push(m.text().slice(0, 160)); }); a.on('dialog', d => d.accept());
  const btn = (n) => a.getByRole('button', { name: n, exact: true }).first();
  const api = (method, url, body) => a.evaluate(async ({ method, url, body }) => { const headers = { 'X-Requested-With': 'CIB' }; if (body !== undefined) headers['content-type'] = 'application/json'; const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; }, { method, url, body });
  const item = (pred) => a.evaluate((src) => { const L = window.CIBPage; const f = new Function('i', 'return ' + src); return L.cs().items.filter(i => f(i)).map(i => ({ id: i.id, kind: i.kind, value: i.value, tags: i.tags, title: i.title, type: i.type, x: i.x, y: i.y, pinned: i.pinned, date: i.date, time: i.time })); }, pred);
  const state = (k) => a.evaluate((k) => { const v = window.CIBPage.state[k]; return v === undefined ? null : JSON.parse(JSON.stringify(v)); }, k);
  const quick = async (cmd) => { const q = a.getByPlaceholder(/quick add/); await q.fill(cmd); await q.press('Enter'); await a.waitForTimeout(250); };
  const openResearch = async (mode) => { if (!(await a.locator('[data-research-mode]').count())) { await a.locator('[data-research-open]').click(); await a.waitForTimeout(400); } await a.locator('[data-research-mode="' + mode + '"]').click(); await a.waitForTimeout(300); };
  const drawer = async (tab) => { if (!(await a.locator('[data-account-drawer]').count())) { await a.locator('[data-account]').click(); await a.waitForTimeout(300); } await a.locator('[data-acct-tab="' + tab + '"]').click(); await a.waitForTimeout(700); };
  const reset = async () => { try { if (await a.locator('[role=dialog][aria-label="AI research"]').count()) { await a.getByRole('dialog', { name: 'AI research' }).getByRole('button', { name: 'Close', exact: true }).click(); await a.waitForTimeout(200); } } catch (e) {} try { await a.keyboard.press('Escape'); } catch (e) {} await a.waitForTimeout(150); };
  const closeDrawer = async () => { if (await a.locator('[data-account-drawer]').count()) { await a.locator('[data-account]').click(); await a.waitForTimeout(200); } };

  await check('Z01 setup: admin, sample case on the board', async () => {
    await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW); await btn('Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 });
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
    const n = (await item('true')).length; if (n < 10) throw new Error('board not seeded: ' + n); return n + ' exhibits on ' + (await a.evaluate(() => window.CIBPage.cs().number));
  });
  await reset(); await check('Z02 ACH: hypotheses, cells and evidence weights (×1 → ×2) change the score', async () => {
    await btn('ACH').click(); await a.waitForTimeout(400);
    const inp = a.getByPlaceholder('New hypothesis… Enter to add'); for (const h of ['Compromised signer key, insider-assisted', 'External crew with stolen approver credentials']) { await inp.fill(h); await inp.press('Enter'); await a.waitForTimeout(200); }
    const cells = a.locator('button', { hasText: /^·$/ }); const n = await cells.count(); if (n < 4) throw new Error('no ACH cells: ' + n);
    await cells.nth(0).click(); await cells.nth(0).click(); // consistent → inconsistent
    await a.locator('button', { hasText: /^·$/ }).nth(0).click(); // next row: consistent
    await a.locator('button', { hasText: /^·$/ }).nth(0).click(); await a.locator('button', { hasText: /^·$/ }).nth(0).click();
    const w = a.locator('[data-ach-weight]').first(); await w.click(); await a.waitForTimeout(300);
    const txt = await a.getByText(/weighted inconsistency/).first().innerText(); const achW = await a.evaluate(() => window.CIBPage.cs().achW); if (!Object.values(achW || {}).some(v => v === 2)) throw new Error('weight not stored');
    await shot(a, 'z01-ach-weights.png', 'Competing hypotheses with weighted evidence: click a cell to cycle consistent / inconsistent / neutral, and click the ×1 on a row to weight that evidence ×2 or ×3 when it is more diagnostic. The score per hypothesis is the weighted inconsistency; the case brief prints it and names the leading hypothesis.', [
      { locator: w, text: 'Evidence weight ×2' }, { locator: a.getByText(/weighted inconsistency/).first(), text: 'Weighted score per hypothesis' },
    ], { title: 'Z01 · Weighted ACH' });
    await a.keyboard.press('Escape'); await a.waitForTimeout(200); return txt;
  });
  await reset(); await check('Z03 AI drafts: competing hypotheses proposed from the case and added to the ACH grid', async () => {
    await openResearch('drafts'); await a.locator('[data-draft-kind="hypotheses"]').click(); await a.locator('[data-draft-run]').click(); await a.locator('[data-draft-result]').waitFor({ timeout: 70000 });
    const before = (await a.evaluate(() => window.CIBPage.cs().hypotheses)).length;
    await shot(a, 'z02-draft-hypotheses.png', 'Drafts: the model (or the rules engine when no key is set) proposes competing hypotheses from the whole case, each with the evidence that would discriminate it, including a benign or misattribution option. "Add to the ACH grid" puts them next to your own.', [
      { locator: a.locator('[data-draft-kind="hypotheses"]'), text: 'Choose a draft type' }, { locator: a.locator('[data-draft-apply]'), text: 'Add to the ACH grid' },
    ], { title: 'Z02 · AI hypotheses' });
    await a.locator('[data-draft-apply]').click(); await a.waitForTimeout(600);
    const after = (await a.evaluate(() => window.CIBPage.cs().hypotheses)).length; if (after <= before) throw new Error('nothing added'); await a.keyboard.press('Escape'); return before + ' → ' + after + ' hypotheses';
  });
  await reset(); await check('Z04 AI drafts: executive summary appended to the case notes', async () => {
    await openResearch('drafts'); await a.locator('[data-draft-kind="summary"]').click(); await a.locator('[data-draft-run]').click(); await a.locator('[data-draft-result]').waitFor({ timeout: 70000 });
    const eng = await a.locator('[data-draft-result]').innerText();
    await shot(a, 'z03-draft-summary.png', 'Executive summary drafted from notes, exhibits, threads and hypotheses, citing exhibit numbers. "Append to case notes" stamps it with the date and the engine that wrote it, so a reviewer can tell a model\'s words from the analyst\'s.', [
      { locator: a.locator('[data-draft-apply]'), text: 'Append to the notes' },
    ], { title: 'Z03 · AI case summary' });
    await a.locator('[data-draft-apply]').click(); await a.waitForTimeout(600);
    const notes = await a.evaluate(() => window.CIBPage.cs().notes); if (!/AI SUMMARY/.test(notes)) throw new Error('summary not in notes'); return eng.split('\n')[0];
  });
  await reset(); await check('Z06 documents in: an .eml becomes event, sender, reply-to, relay, link, attachment hash and file-name cards', async () => {
    await openResearch('file'); await a.locator('[data-research-file]').setInputFiles(path.join(OUT, 'evidence', 'invoice-4471.eml')); await a.waitForTimeout(2500);
    const rows = await a.locator('[data-research-pin]').count(); if (!rows) throw new Error('no import button');
    await shot(a, 'z05-ingest-eml.png', 'From a file: the server parses the .eml (decoded headers, Received chain, links, attachments hashed) and proposes an event card for the message plus indicator cards for the sender, the mismatching Reply-To, the first external relay, every link and each attachment\'s SHA-256 and file name, threaded to the event. PDFs and text files go through entity extraction instead.', [
      { locator: a.locator('[data-research-file]'), text: 'Pick the .eml or .pdf' }, { locator: a.locator('[data-research-pin]').first(), text: 'Import the ticked cards' },
    ], { title: 'Z05 · Email ingestion' });
    await a.locator('[data-research-pin]').first().click(); await a.waitForTimeout(800);
    const fn = await item("i.type==='indicator' && i.kind==='filename'"); const hs = await item("i.type==='indicator' && i.kind==='hash' && /attachment/i.test(i.tags||'')"); const ev = await item("i.type==='event' && /Invoice 4471/.test(i.title||'')");
    if (!fn.length || !hs.length || !ev.length) throw new Error('cards missing: fn ' + fn.length + ' hash ' + hs.length + ' event ' + ev.length); return fn[0].value + ' · ' + hs[0].value.slice(0, 12) + '… · event ' + ev[0].date + ' ' + ev[0].time;
  });
  await reset(); await check('Z05 AI drafts: takedown letter from the case indicators', async () => {
    await openResearch('drafts'); await a.locator('[data-draft-kind="takedown"]').click(); await a.locator('[data-draft-to]').fill('abuse@registrar.example'); await a.locator('[data-draft-run]').click(); await a.locator('[data-draft-result]').waitFor({ timeout: 70000 });
    const t = await a.locator('[data-draft-result] textarea').inputValue(); if (!/takedown|Takedown|abuse/i.test(t)) throw new Error('not a letter');
    await shot(a, 'z04-draft-takedown.png', 'Takedown / abuse letter drafted for the recipient you name, listing the case\'s live indicators defanged, asking for suspension and log preservation. Open it as a page to print or copy it into your ticketing system.', [
      { locator: a.locator('[data-draft-to]'), text: 'Recipient' }, { locator: a.locator('[data-draft-apply]'), text: 'Open as a letter' },
    ], { title: 'Z04 · AI takedown draft' });
    await a.keyboard.press('Escape'); return t.split('\n')[0];
  });
  await reset(); await check('Z07 quick add: ? lists every command, unknown commands are refused, f and host kinds work', async () => {
    await quick('?'); const help = a.getByText(/quick add: d domain/).first(); if (!(await help.count())) throw new Error('no help toast');
    await shot(a, 'z06-quick-add-help.png', 'Quick add now explains itself: type ? for every command; an unknown command is refused with a hint instead of silently becoming a note; new kinds f (file name) and host (hostname) join the indicator set, and hash cards are labelled MD5 / SHA-1 / SHA-256 in the brief and letters.', [{ locator: help, text: 'Every quick-add command' }], { title: 'Z06 · Quick add' });
    await a.waitForTimeout(2800); await quick('zz something odd'); const bad = await a.getByText(/Unknown quick-add command/).count(); if (!bad) throw new Error('unknown command accepted');
    await quick('f dropper.pdf.exe'); await quick('host dc01.corp.local');
    const f = await item("i.kind==='filename' && i.value==='dropper.pdf.exe'"); const h = await item("i.kind==='hostname'"); if (!f.length || !h.length) throw new Error('kinds missing'); return 'filename + hostname cards, unknown command refused';
  });
  await reset(); await check('Z08 timeline: cards on the same day are ordered by time of day; new cards land in free spots', async () => {
    await quick('e 2026-11-03 Second wave of lures'); await quick('e 2026-11-03 First lure delivered');
    const [second] = await item("i.type==='event' && i.title==='Second wave of lures'"); const [first] = await item("i.type==='event' && /First lure delivered/.test(i.title)");
    await a.evaluate((id) => window.CIBPage.upItem(id, { time: '14:05' }), second.id); await a.waitForTimeout(150); await a.evaluate((id) => window.CIBPage.upItem(id, { time: '09:14' }), first.id); await a.waitForTimeout(150);
    const all = await item('i.pinned'); const dup = all.filter((x, i) => all.some((y, j) => j !== i && x.x === y.x && x.y === y.y)); if (dup.length) throw new Error('overlapping new cards: ' + dup.map(d => d.title).join(', '));
    await btn('Timeline').click(); await a.waitForTimeout(700);
    const pos = await a.evaluate(([s, f]) => { const L = window.CIBPage.lastLayout; return { s: L.pos[s], f: L.pos[f] }; }, [second.id, first.id]);
    if (!pos.s || !pos.f || pos.f.x !== pos.s.x || pos.f.y >= pos.s.y) throw new Error('time order wrong: ' + JSON.stringify(pos));
    await shot(a, 'z07-timeline-time.png', 'Timeline view: cards sharing a date are now stacked in time-of-day order (09:14 above 14:05), and the brief\'s chronology prints the time column. New cards added from quick add or an import land in a free spot beside the board rather than on a pile in the centre.', [
      { locator: a.locator('[data-card="' + first.id + '"][data-kind="card"]'), text: '09:14 first' }, { locator: a.locator('[data-card="' + second.id + '"][data-kind="card"]'), text: '14:05 after it' },
    ], { title: 'Z07 · Timeline by time' });
    await btn('Timeline').click(); await a.waitForTimeout(400); return 'same column, 09:14 above 14:05 · ' + all.length + ' pinned cards without overlap';
  });
  await reset(); await check('Z09 share: push the case to MISP, TheHive and Jira (stand-in server); link cards and log lines are added', async () => {
    await drawer('share'); if (!(await a.locator('[data-push="misp"]').count())) throw new Error('MISP button missing (server not started with MISP_URL?)');
    await a.locator('[data-push="misp"]').click(); await a.locator('[data-push-result]').waitFor({ timeout: 15000 });
    await shot(a, 'z08-share-misp.png', 'Share: with MISP, TheHive or Jira configured on the server, one click pushes the case: a MISP event with typed attributes (to_ids for confirmed indicators), a TheHive alert with observables and TLP, or a Jira issue. The result links back, a link card lands in the inbox and the case log records it. Falsified indicators are never sent.', [
      { locator: a.locator('[data-push="misp"]'), text: 'Push a MISP event' }, { locator: a.locator('[data-push-result]'), text: 'Created, with a link back' }, { locator: a.locator('[data-push="jira"]'), text: 'Open a Jira issue' },
    ], { title: 'Z08 · Push to MISP / TheHive / Jira' });
    await a.locator('[data-push="thehive"]').click(); await a.waitForTimeout(1200); await a.locator('[data-jira-summary]').fill('Block the lure domain at the perimeter'); await a.locator('[data-push="jira"]').click(); await a.waitForTimeout(1200);
    const seen = JSON.parse((await get('http://127.0.0.1:9797/seen')).body); const misp = seen.find(s => /misp/.test(s.url)), hive = seen.find(s => /hive/.test(s.url)), jira = seen.find(s => /jira/.test(s.url));
    if (!misp || !hive || !jira) throw new Error('pushes missing: ' + seen.map(s => s.url).join(','));
    const links = await item("i.type==='link' && /integration/.test(i.tags||'')"); if (links.length < 3) throw new Error('link cards: ' + links.length);
    return 'MISP ' + misp.body.Event.Attribute.length + ' attributes · TheHive ' + hive.body.observables.length + ' observables · Jira ' + jira.body.fields.summary;
  });
  await reset(); await check('Z10 STIX feed: create a token feed, pull it as STIX, CSV and plain text without a session', async () => {
    await drawer('share'); await a.locator('[data-feed-name]').fill('Perimeter blocklist'); await a.locator('[data-feed-create]').click(); await a.locator('[data-feed-token]').waitFor({ timeout: 8000 });
    const txt = await a.locator('[data-feed-token]').innerText(); const m = txt.match(/Pull URL:\s*(\S+)/); if (!m) throw new Error('no url in ' + txt);
    const url = m[1]; const stix = await get(url); if (stix.status !== 200) throw new Error('pull ' + stix.status); const b = JSON.parse(stix.body);
    const plain = await get(url.replace('stix.json', 'indicators.txt')); const csv = await get(url.replace('stix.json', 'indicators.csv')); const anon = await get(url.split('?')[0]); if (anon.status !== 404) throw new Error('feed served without token');
    await shot(a, 'z09-stix-feed.png', 'STIX feeds (admins): a feed is a token URL scoped by maximum TLP and, if you like, confirmed indicators only. A TIP imports stix.json, a SIEM takes indicators.csv, a firewall pulls indicators.txt. The token is shown once; remove the feed to revoke it. Add an https webhook and an interval to push the bundle on a schedule.', [
      { locator: a.locator('[data-feed-create]'), text: 'Create a feed' }, { locator: a.locator('[data-feed-token]'), text: 'One-time token and pull URL' },
    ], { title: 'Z09 · STIX feed' });
    await closeDrawer(); return b.objects.length + ' STIX objects · ' + plain.body.trim().split('\n').length + ' plain indicators · csv ' + csv.body.split('\n')[0];
  });
  await reset(); await check('Z11 case brief prints weighted ACH scores, the leading hypothesis, hash algorithms and times', async () => {
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 12000 }), btn('Case brief').click()]); await pop.waitForLoadState(); await pop.waitForTimeout(600);
    const html = await pop.content(); for (const needle of ['Weighted inconsistency', 'Leading hypothesis', 'SHA-256 hash', '<h2>Timeline</h2>']) if (!html.includes(needle)) throw new Error('brief lacks ' + needle);
    const tlSec = html.slice(html.indexOf('<h2>Timeline</h2>')); if (!/09:14/.test(tlSec)) throw new Error('time missing in the timeline table');
    await pop.setViewportSize({ width: 1100, height: 1400 });
    await shot(pop, 'z10-brief-ach.png', 'The case brief now ranks the hypotheses by weighted inconsistency and names the leading one, labels hash indicators by algorithm, and prints the time of day in the timeline table.', [
      { locator: pop.getByText('Competing hypotheses', { exact: true }).first(), text: 'Weighted ACH table' }, { locator: pop.getByText(/Leading hypothesis/).first(), text: 'Leading hypothesis named' },
    ], { title: 'Z10 · Brief with weighted ACH', scrollTo: 0 });
    await pop.close(); return 'weighted scores, leading hypothesis, SHA-256 label, 09:14 in the timeline table';
  });
  await reset(); await check('Z12 Esc closes a panel from inside a text box', async () => {
    await btn('ACH').click(); await a.waitForTimeout(300); const inp = a.getByPlaceholder('New hypothesis… Enter to add'); await inp.click(); await inp.type('half-typed'); await inp.press('Escape'); await a.waitForTimeout(300);
    if (await state('achOpen')) throw new Error('ACH still open'); return 'ACH closed by Esc while typing';
  });
  const errs = a.errors.filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v6-run.json')); await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
