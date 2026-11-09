// Walkthrough capture for self-running enrichment: enrichment on pin, watchers, duplicate finder, ATT&CK matrix, actor library.
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v4'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }); const a = await ctx.newPage(); a.errors = [];
  a.on('pageerror', e => a.errors.push(e.message)); a.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) a.errors.push(m.text().slice(0, 160)); }); a.on('dialog', d => d.accept());
  const btn = (n) => a.getByRole('button', { name: n, exact: true }).first();
  const api = (method, url, body) => a.evaluate(async ({ method, url, body }) => { const headers = { 'X-Requested-With': 'CIB' }; if (body !== undefined) headers['content-type'] = 'application/json'; const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; }, { method, url, body });
  const item = (pred) => a.evaluate((src) => { const L = window.CIBPage; const f = new Function('i', 'return ' + src); return L.cs().items.filter(i => f(i)).map(i => ({ id: i.id, kind: i.kind, value: i.value, tags: i.tags, body: i.body, enrich: i.enrich, firstSeen: i.firstSeen, pinned: i.pinned, num: i.num, type: i.type, title: i.title })); }, pred);
  const selectId = async (id) => { const loc = a.locator('[data-card="' + id + '"][data-kind="card"]'); const bb = await loc.boundingBox(); await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: bb.x + 5, clientY: bb.y + 20, pointerId: 1, isPrimary: true, bubbles: true }); await a.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 1, bubbles: true }))); await a.waitForTimeout(200); };
  const quick = async (cmd) => { const q = a.getByPlaceholder(/quick add/); await q.fill(cmd); await q.press('Enter'); await a.waitForTimeout(200); };
  const drawerTab = async (t) => { if (!(await a.locator('[data-drawer]').count())) { await a.locator('[data-bell]').click(); await a.waitForTimeout(300); } await a.getByRole('button', { name: t, exact: true }).click(); await a.waitForTimeout(500); };

  await check('X01 setup and open the board', async () => {
    await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW); await btn('Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 });
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
    const n = await a.evaluate(() => window.CIBAttack && window.CIBAttack.count); return 'ATT&CK techniques known at start: ' + n;
  });
  await check('X02 enrichment on pin: a quick-added IP gets RDAP/ASN written onto the card; a Cloudflare IP is flagged shared', async () => {
    await quick('i 88.119.167[.]239'); await a.waitForTimeout(9000);
    const [it] = await item("i.type==='indicator' && /88\\.119\\.167/.test(i.value)"); if (!it || !it.enrich || !it.enrich.at) throw new Error('not enriched: ' + JSON.stringify(it));
    await quick('i 104.26.2[.]223'); await a.waitForTimeout(9000);
    const [cf] = await item("i.type==='indicator' && /104\\.26\\.2/.test(i.value)"); if (!cf || !/shared-infra/.test(cf.tags || '')) throw new Error('shared flag missing: ' + JSON.stringify(cf && cf.tags));
    await selectId(cf.id); return 'ASN ' + it.enrich.asn + ' ' + it.enrich.org + ' · Cloudflare tagged ' + cf.tags;
  });
  await shot(a, 'x01-enrich-on-pin.png', 'Enrichment on pin: the moment an indicator lands on the board the server looks it up once (RDAP owner, ASN, country; for domains DNS, registrar and age, certificate log; for CVEs CVSS and KEV; for wallets balance; VirusTotal and MalwareBazaar when keyed). The result is written into the card body and tags. A CDN or cloud address is tagged shared-infra with a warning, so it is not blocklisted on its own.', [
    { locator: a.locator('aside').last().getByText(/shared infrastructure/i).first(), text: 'Shared-infrastructure warning written on the card' },
    { locator: a.locator('aside').last().getByText(/ENRICHMENT ·/).first(), text: 'Enrichment block: RDAP, ASN, country, dates' },
  ], { title: 'X01 · Enrichment on pin', scrollTo: 1 });
  await check('X03 watcher: watch the C2 IP, run it now, see it in the list', async () => {
    const [it] = await item("i.type==='indicator' && /88\\.119\\.167/.test(i.value)"); await selectId(it.id);
    await drawerTab('watch'); await a.locator('[data-add-watcher]').click(); await a.waitForTimeout(800);
    const w = (await api('GET', '/api/watchers?caseId=' + encodeURIComponent(await a.evaluate(() => window.CIBPage.state.activeId)))).body.watchers; if (!w.length) throw new Error('no watcher');
    await a.locator('[data-run-watcher]').first().click(); await a.waitForTimeout(6000);
    return w[0].kind + ' ' + w[0].value + ' every ' + w[0].interval + ' (' + w[0].checks.join(', ') + ')';
  });
  await shot(a, 'x02-watchers.png', 'Watchers: pick an indicator, choose the interval and the checks (DNS, certificate log, blocklist, wallet, NVD), optionally a webhook, and "Watch it". The server re-checks on schedule; when something changes an event card lands in the case inbox, you are notified, and the webhook is called. "Run now" checks immediately.', [
    { locator: a.locator('[data-add-watcher]'), text: 'Watch the selected indicator' }, { locator: a.locator('[data-run-watcher]').first(), text: 'Run now' },
  ], { title: 'X02 · Watchers' });
  await check('X04 duplicate finder merges two cards for the same indicator', async () => {
    await quick('i 88.119.167.239'); await a.waitForTimeout(500);
    await drawerTab('dupes'); const n = await a.locator('[data-merge-dupes]').count(); if (n < 1) throw new Error('no duplicates listed');
    await shot(a, 'x03-duplicates.png', 'Duplicate finder: cards with the same indicator value, technique id or title are grouped; "Merge into one" keeps the pinned card, re-points threads and unions tags, tasks and comments.', [{ locator: a.locator('[data-merge-dupes]').first(), text: 'Merge the group into one card' }], { title: 'X03 · Duplicates' });
    await a.locator('[data-merge-dupes]').first().click(); await a.waitForTimeout(600);
    const left = await item("i.type==='indicator' && /88\\.119\\.167/.test(i.value)"); if (left.length !== 1) throw new Error('still ' + left.length + ' cards'); return 'merged to one card';
  });
  await check('X05 actor library: add an actor on the server; it is available to the board\'s Drop in after reload', async () => {
    await drawerTab('actors');
    const f = (k, v) => a.locator('[data-actors] input[placeholder^="' + k + '"]').fill(v);
    await f('name', 'SafePay'); await f('aliases', 'SafePay Ransomware'); await f('origin', 'Russian-speaking'); await f('motive', 'ransomware'); await f('techniques', 'T1133, T1190, T1486, T1490'); await f('summary', 'Ransomware operation active since 2024; stolen VPN credentials and edge CVEs; ChaCha20/RSA locker.');
    await a.locator('[data-add-actor]').click(); await a.waitForTimeout(800);
    const r = await api('GET', '/api/actors'); if (!r.body.actors.some(x => x.name === 'SafePay')) throw new Error('actor not stored');
    return r.body.actors.length + ' actor(s) on the server';
  });
  await shot(a, 'x04-actors.png', 'Actor library and ATT&CK: add or update actors (name, aliases, origin, motive, techniques, summary) or import a STIX bundle / MISP galaxy; they merge into the board\'s Actor library. Admins can download the full MITRE Enterprise matrix so every technique id resolves to a name and tactic.', [
    { locator: a.locator('[data-add-actor]'), text: 'Add or update an actor' }, { locator: a.locator('[data-attack-refresh]'), text: 'Download the full ATT&CK matrix (admin)' },
  ], { title: 'X04 · Actors and ATT&CK' });
  await check('X06 full ATT&CK matrix download from MITRE (needs internet; skipped gracefully if blocked)', async () => {
    const r = await api('POST', '/api/attack/refresh', {}); if (r.status !== 200) return 'download not possible from this network: ' + (r.body && r.body.error);
    await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
    const n = await a.evaluate(() => window.CIBAttack && window.CIBAttack.count); if (!n || n < 100) throw new Error('matrix not merged: ' + n);
    await quick('t T1569.002'); await a.waitForTimeout(400); const [t] = await item("i.type==='ttp' && i.value==='T1569.002'"); if (!t || !/Service Execution/i.test(t.title)) throw new Error('T1569.002 not resolved: ' + JSON.stringify(t));
    return r.body.count + ' techniques (ATT&CK ' + r.body.version + '); T1569.002 → ' + t.title;
  });
  await check('X07 drop in a server-defined actor from the Actor library', async () => {
    await btn('Actors').click(); await a.waitForTimeout(400);
    const row = a.getByText('SafePay', { exact: true }).first(); if (!(await row.count())) throw new Error('SafePay not in the library');
    await shot(a, 'x05-actor-library.png', 'The board\'s Actor library now lists the server-defined SafePay entry next to the built-in groups; Drop in pins the actor with its techniques threaded.', [{ locator: row, text: 'Actor from the server' }], { title: 'X05 · Actor library with server actors' });
    await a.keyboard.press('Escape');
  });
  const errs = a.errors.filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v4-run.json')); await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
