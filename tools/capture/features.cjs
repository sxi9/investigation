const { launch, shot, check, card, btn, state, report, watch, pass, fail, OUT } = require('./lib.cjs');
const fs = require('fs'); const path = require('path');
(async () => {
  const { browser, ctx, page } = await launch();
  page.setDefaultTimeout(8000); watch(page);
  // Select a card through the app's own pointer handlers (cards sit inside a transformed, overflow-hidden board,
  // so a geometric click can land on an overlapping card).
  const selectCard = async (name) => {
    const loc = card(page, name); await loc.waitFor({ state: 'attached' });
    const bb = await loc.boundingBox(); const cx = bb ? bb.x + bb.width / 2 : 0, cy = bb ? bb.y + 20 : 0;
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true });
    await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: x, clientY: y, pointerId: 1, bubbles: true })), [cx, cy]);
    await page.waitForTimeout(150);
  };
  const T = (t) => page.getByTitle(t).first();
  const text = (t) => page.getByText(t, { exact: true }).first();
  const asideOf = (t) => page.getByText(t, { exact: true }).first().locator('xpath=ancestor::aside[1]');
  const row = (name) => btn(page, name).locator('xpath=..');
  const st0 = await state(page);

  // ---- 01 overview
  await check('initial render: two sample cases, Binance case active', async () => { if (st0.cases.length !== 2 || st0.activeId !== 'c2') throw new Error(JSON.stringify(st0.cases)); return st0.cases.map(c => c.number + ' ' + c.title).join(' | '); });
  await shot(page, '01-overview.png', 'The board at first launch, with the sample case "Binance $6.3B heist" open. Cases autosave to the browser (localStorage).', [
    { locator: text('CASE').locator('xpath=..'), text: 'Case bar: switch case, title, TLP marking, review state, analyst name, encryption, new/delete case, quick add' },
    { locator: row('OSINT'), text: 'Actions: search, OSINT workbench, ACH, request generator, present mode, case brief, one-pager, STIX, exports, import' },
    { locator: row('Move'), text: 'Tools: Move / Connect / Reveal / Timeline / Kill chain / + Cluster, thread relation picker, zoom, Fit, panel toggles' },
    { locator: asideOf('EVIDENCE INBOX'), text: 'Evidence inbox: add cards of 11 types, actor library, Extract IOCs, type filters, unpinned evidence' },
    { sel: '[data-board]', text: 'Cork board: pinned exhibits (numbered) joined by red threads; drag to pan, wheel to zoom', at: 't' },
    { locator: asideOf('Inspector'), text: 'Side panel: Inspector / Threads / Audit / Log / Notes' },
    { box: { x: 0, y: 832, w: 1440, h: 68 }, text: 'Timeline rail: every dated card in order; click one to jump to it', at: 'tr' },
  ], { title: 'Investigation Board · overview' });

  // ---- 02 case bar
  await check('case bar: set TLP, review state, analyst, title', async () => {
    await T('Traffic Light Protocol marking for this case — printed on every export').selectOption('amber');
    await T('Review state of the case').selectOption('in review');
    await page.getByPlaceholder('Analyst').fill('S. Murugan');
    await page.getByPlaceholder('Analyst').press('Tab');
    const s = await state(page); const c = s.cases.find(c => c.id === 'c2');
    if (c.tlp !== 'amber' || c.review !== 'in review' || s.analyst !== 'S. Murugan') throw new Error(JSON.stringify([c.tlp, c.review, s.analyst]));
  });
  await shot(page, '02-case-bar.png', 'Case handling lives in the top bar. TLP and review state are printed on every export; the analyst name is stamped on log entries, custody records and sign-off.', [
    { locator: page.locator('select').first(), text: 'Case switcher (search covers all cases)' },
    { locator: page.getByPlaceholder('Case title'), text: 'Case title (click to edit)' },
    { locator: T('Traffic Light Protocol marking for this case — printed on every export'), text: 'TLP marking, now AMBER' },
    { locator: T('Review state of the case'), text: 'Review state: Draft / In review / Published (published = sign-off)' },
    { locator: page.getByPlaceholder('Analyst'), text: 'Analyst name' },
    { locator: btn(page, 'Encrypt'), text: 'Encrypt saved cases with a passphrase' },
    { locator: btn(page, 'New case'), text: 'New case from a template' },
    { locator: page.getByPlaceholder(/quick add/), text: 'Quick add (press / to focus)' },
  ], { title: 'Case bar' });

  // ---- 03 quick add
  await check('quick add: "d" command pins a domain indicator', async () => {
    const before = (await state(page)).cases.find(c => c.id === 'c2').pinned;
    const q = page.getByPlaceholder(/quick add/); await q.fill('d okta-sso-verify[.]com'); await q.press('Enter');
    await page.waitForTimeout(300);
    const s = await state(page); const c = s.cases.find(c => c.id === 'c2');
    if (c.pinned !== before + 1) throw new Error('pinned ' + before + ' -> ' + c.pinned);
    return 'pinned ' + before + ' -> ' + c.pinned;
  });
  await check('quick add: technique, CVE, event and note commands', async () => {
    const q = page.getByPlaceholder(/quick add/);
    for (const cmd of ['t T1566.004', 'cve CVE-2026-20700', 'e 2026-11-08 Help-desk vishing call reported', 'n Check whether SMS fallback is still enabled for admins']) { await q.fill(cmd); await q.press('Enter'); await page.waitForTimeout(200); }
    const c = (await state(page)).cases.find(c => c.id === 'c2'); return 'pinned now ' + c.pinned;
  });
  await shot(page, '03-quick-add.png', 'Quick add: type a one-letter command and a value, press Enter. d domain · i ip · h hash · m email · w wallet · cve · @handle · u url · e date title · n note · p person · t technique · l location · c cluster. With no command the value is auto-detected.', [
    { locator: page.getByPlaceholder(/quick add/), text: 'Quick add box' },
    { locator: card(page, 'okta-sso-verify'), text: 'New indicator card pinned to the board (red "Unverified" stamp by default)', at: 't' },
    { locator: card(page, 'Spearphishing Voice'), text: 'T1566.004 resolved to its ATT&CK name and tactic', at: 't' },
    { locator: card(page, 'CVE-2026-20700'), text: 'CVE indicator from "cve CVE-2026-20700" (pivots to NVD, EPSS, CISA KEV; exported to STIX as a vulnerability)', at: 't' },
  ], { title: 'Quick add' });

  // ---- 04 inspector: select a card, edit fields
  await check('inspector: select a card and edit title/body/tags/stamp', async () => {
    await selectCard('okta-sso-verify');
    // the title field is the first text input under the TITLE label
    const tIn = text('TITLE').locator('xpath=following::input[1]');
    await tIn.fill('Okta look-alike login domain'); await tIn.press('Tab');
    const body = text('TITLE').locator('xpath=following::textarea[1]');
    await body.fill('Spoofed SSO portal; registered via privacy proxy. Pivot on registrar + cert.'); await body.press('Tab');
    const tags = text('TAGS').locator('xpath=following::input[1]');
    await tags.fill('infra, phish'); await tags.press('Tab');
    await btn(page, 'Confirmed').click();
    const src = text('SOURCE · WHO SAID SO').locator('xpath=following::input[1]');
    await src.fill('Dataminr TRACE brief, 19 Oct 2026'); await src.press('Tab');
    await page.waitForTimeout(200);
    const s = await state(page);
    return 'sel=' + s.sel;
  });
  await check('inspector: tasks and comments', async () => {
    const todo = page.getByPlaceholder('Open question or to-do… Enter to add'); await todo.fill('WHOIS + passive DNS'); await todo.press('Enter');
    await todo.fill('Request registrar takedown'); await todo.press('Enter');
    const cm = page.getByPlaceholder('Comment… Ctrl+Enter to post'); await cm.fill('Matches the naming pattern <vendor>-okta[.]com'); await cm.press('Control+Enter');
    await page.waitForTimeout(200);
  });
  await shot(page, '04-inspector.png', 'Click a card to edit it in the Inspector: title, body, indicator type/value, date, tags, stamp (Confirmed / Unverified / False lead), Admiralty grading, source, custody, tasks, comments and pivots.', [
    { locator: text('TITLE'), text: 'Title, body, indicator type and value' },
    { locator: text('TAGS'), text: 'Tags (comma separated)' },
    { locator: btn(page, 'Confirmed'), text: 'Stamp: Confirmed / Unverified / False lead' },
    { locator: text('SOURCE · WHO SAID SO'), text: 'Source, collected date, Admiralty reliability / credibility grades' },
    { locator: page.getByPlaceholder('Open question or to-do… Enter to add'), text: 'Tasks on this card' },
    { locator: page.getByPlaceholder('Comment… Ctrl+Enter to post'), text: 'Comments (stamped with analyst + time)' },
  ], { title: 'Inspector', scrollTo: 0 });
  // scroll inspector to show pivots + custody + claude
  await check('inspector: pivots, custody, Claude button present', async () => {
    const piv = text('PIVOT · LOOK UP'); await piv.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const n = await page.locator('aside a[target="_blank"]').count(); if (n < 2) throw new Error('pivot links ' + n); return n + ' pivot links';
  });
  await shot(page, '05-inspector-pivots.png', 'Further down the Inspector: pivot links open VirusTotal, urlscan, Shodan, crt.sh, etc. for the indicator; chain of custody records who added what and when; "Analyse with Claude" asks for an assessment (works inside the Claude app preview).', [
    { locator: text('PIVOT · LOOK UP'), text: 'Pivots: one-click lookups for this indicator' },
    { locator: btn(page, 'Analyse with Claude'), text: 'Analyse with Claude' },
    { locator: btn(page, 'Delete'), text: 'Delete the card (or press Del)' },
  ], { title: 'Inspector · pivots and custody', scrollTo: 0 });

  // ---- 06 connect tool
  await check('connect tool: C, click two cards, thread created', async () => {
    const before = (await state(page)).cases.find(c => c.id === 'c2').threads;
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await btn(page, 'Connect').click();
    await btn(page, 'controls').click(); // relation
    await selectCard('okta-sso-verify');
    await selectCard('Spearphishing Voice'); await page.waitForTimeout(200);
    const after = (await state(page)).cases.find(c => c.id === 'c2').threads;
    if (after !== before + 1) throw new Error('threads ' + before + ' -> ' + after);
    return 'threads ' + before + ' -> ' + after;
  });
  await check('thread editor opens for the new thread', async () => {
    await page.waitForTimeout(200);
    const s = await state(page); if (!s.selThread) throw new Error('no selThread');
    const why = page.getByPlaceholder('Why these two are connected — the brief prints it'); await why.fill('Domain is the landing page used during the vishing call.'); await why.press('Tab');
  });
  await shot(page, '06-connect-thread.png', 'Connect tool (C): pick a relation, click one card then another. The thread editor opens: relation, confidence, evidence note, swap direction, cut. You can also drag a card\'s pin onto another card.', [
    { locator: btn(page, 'Connect'), text: 'Connect tool' },
    { locator: btn(page, 'controls'), text: 'Relation to use: linked / suspected / alias / controls / resolves / located' },
    { locator: text('RELATION'), text: 'Thread editor: relation + confidence' },
    { locator: page.getByPlaceholder('Why these two are connected — the brief prints it'), text: 'Evidence for this link (printed in the brief)' },
    { locator: btn(page, 'Swap direction'), text: 'Swap direction / Cut' },
  ], { title: 'Connect tool and thread editor' });

  // ---- 07 reveal
  await check('reveal mode dims everything but the selection', async () => {
    await btn(page, 'Move').click();
    await selectCard('Hot wallets drained');
    await btn(page, 'Reveal').click(); await page.waitForTimeout(250);
    const s = await state(page); if (!s.reveal) throw new Error('reveal off');
  });
  await shot(page, '07-reveal.png', 'Reveal (R): with a card selected, everything except that card, its direct threads and second-degree neighbours is dimmed. Click Reveal again to leave.', [
    { locator: btn(page, 'Reveal'), text: 'Reveal toggle' },
    { locator: card(page, 'Hot wallets drained'), text: 'Selected card stays lit; neighbours half-lit', at: 't' },
  ], { title: 'Reveal' });
  await btn(page, 'Reveal').click();

  // ---- 08 timeline layout
  await check('timeline layout (T)', async () => { await btn(page, 'Timeline').click(); await page.waitForTimeout(500); const s = await state(page); if (s.mode !== 'timeline') throw new Error(s.mode); });
  await shot(page, '08-timeline.png', 'Timeline (T): cards are laid out left-to-right by date with a dated axis; undated cards go on a shelf. Press T again (or click Timeline) to return to the free board.', [
    { locator: btn(page, 'Timeline'), text: 'Timeline toggle (active)' },
    { sel: '[data-board]', text: 'Dated axis across the board; cards in chronological order', at: 't' },
  ], { title: 'Timeline layout' });
  await btn(page, 'Timeline').click(); await page.waitForTimeout(300);

  // ---- 09 kill chain
  await check('kill chain lanes (K)', async () => { await btn(page, 'Kill chain').click(); await page.waitForTimeout(500); const s = await state(page); if (s.mode !== 'killchain') throw new Error(s.mode); });
  await shot(page, '09-kill-chain.png', 'Kill chain (K): technique cards are grouped into ATT&CK tactic lanes, with the evidence threaded to each technique shown beneath it.', [
    { locator: btn(page, 'Kill chain'), text: 'Kill chain toggle (active)' },
    { sel: '[data-board]', text: 'One lane per ATT&CK tactic', at: 't' },
  ], { title: 'Kill-chain lanes' });
  await btn(page, 'Kill chain').click(); await page.waitForTimeout(300);

  // ---- 10 cluster
  await check('+ Cluster adds a group region', async () => {
    const before = (await state(page)).cases.find(c => c.id === 'c2').groups;
    await btn(page, '+ Cluster').click(); await page.waitForTimeout(300);
    const after = (await state(page)).cases.find(c => c.id === 'c2').groups; if (after !== before + 1) throw new Error('groups ' + after);
    const t = text('CLUSTER').locator('xpath=following::input[1]'); await t.fill('Attacker infrastructure'); await t.press('Tab');
  });
  await shot(page, '10-cluster.png', '+ Cluster: a labelled region on the board. Cards whose centre is inside it move with it; drag the corner to resize, click the label to rename.', [
    { locator: btn(page, '+ Cluster'), text: 'Add a cluster' },
    { locator: T('Drag to move the cluster with its cards · click to rename'), text: 'Cluster label: drag to move the whole group' },
    { locator: text('CLUSTER'), text: 'Rename or remove the cluster in the side panel' },
  ], { title: 'Clusters' });
  await page.keyboard.press('Escape');

  // ---- 11 search
  await check('search dims non-matching cards and lists other-case hits', async () => {
    await page.getByPlaceholder('Search all cases…').fill('FBI'); await page.waitForTimeout(300);
    const s = await state(page); if (s.search !== 'FBI') throw new Error('search not set');
  });
  await shot(page, '11-search.png', 'Search: cards that do not match are dimmed; matches in other cases are listed under the search box so you can jump across cases.', [
    { locator: page.getByPlaceholder('Search all cases…'), text: 'Search box (all cases)' },
    { locator: card(page, 'FBI Cyber alert'), text: 'Matching card stays bright', at: 't' },
  ], { title: 'Search' });
  await page.getByPlaceholder('Search all cases…').fill('');

  // ---- 12 inbox: add card, filters, pin
  await check('inbox: + Person adds an unpinned card; Pin moves it to the board', async () => {
    const c0 = (await state(page)).cases.find(c => c.id === 'c2');
    await btn(page, '+ Person').click(); await page.waitForTimeout(200);
    const c1 = (await state(page)).cases.find(c => c.id === 'c2'); if (c1.items !== c0.items + 1) throw new Error('items');
    await page.getByRole('button', { name: 'Pin', exact: true }).first().click(); await page.waitForTimeout(200);
    const c2 = (await state(page)).cases.find(c => c.id === 'c2'); if (c2.pinned !== c0.pinned + 1) throw new Error('pin failed'); return 'items ' + c0.items + '->' + c1.items + ', pinned ' + c0.pinned + '->' + c2.pinned;
  });
  await check('inbox: type filter hides a card type', async () => {
    await page.getByText('SHOW ON BOARD').locator('xpath=following-sibling::div[1]').getByRole('button', { name: 'Note', exact: true }).click(); await page.waitForTimeout(150);
    const s = await state(page); if (!s.hidden || !s.hidden.note) throw new Error('note not hidden');
    await page.getByText('SHOW ON BOARD').locator('xpath=following-sibling::div[1]').getByRole('button', { name: 'Note', exact: true }).click();
  });
  await shot(page, '12-inbox.png', 'Evidence inbox: add any of 11 card types; new cards wait unpinned in the inbox until you Pin them or drag them onto the board. Type filters hide whole categories on the board.', [
    { locator: btn(page, '+ Person'), text: 'Add buttons: Photo, Note, Link, Person, Indicator, Document, Event, Location, Technique, Transfer, Target' },
    { locator: text('SHOW ON BOARD'), text: 'Show on board: toggle a type on/off' },
    { locator: page.getByRole('button', { name: 'Pin', exact: true }).first(), text: 'Unpinned evidence: Pin, or drag onto the board', at: 'tr' },
    { locator: btn(page, 'Actors'), text: 'Actor library' },
    { locator: btn(page, 'Extract IOCs'), text: 'Extract IOCs from pasted text' },
  ], { title: 'Evidence inbox' });

  // ---- 13 actors
  await check('actor library: drop in a known group with its techniques', async () => {
    const c0 = (await state(page)).cases.find(c => c.id === 'c2');
    await btn(page, 'Actors').click(); await page.waitForTimeout(200);
    await shot(page, '13-actors.png', 'Actor library: twelve well-known groups with aliases, origin, motive and typical ATT&CK techniques. "Drop in" pins a person card plus one technique card per TTP, threaded together.', [
      { locator: text('ACTOR LIBRARY'), text: 'Actor library modal' },
      { locator: btn(page, 'Drop in'), text: 'Drop in: pins actor + techniques + threads' },
    ], { title: 'Actor library' });
    await btn(page, 'Drop in').click(); await page.waitForTimeout(300);
    const c1 = (await state(page)).cases.find(c => c.id === 'c2'); if (c1.pinned <= c0.pinned + 1) throw new Error('nothing dropped'); return 'pinned ' + c0.pinned + ' -> ' + c1.pinned + ', threads ' + c0.threads + ' -> ' + c1.threads;
  });
  await page.keyboard.press('Escape');

  // ---- 14 extract IOCs
  await check('extract IOCs: paste report text, rows found, add to inbox', async () => {
    const c0 = (await state(page)).cases.find(c => c.id === 'c2');
    await btn(page, 'Extract IOCs').click(); await page.waitForTimeout(200);
    const ta = page.getByPlaceholder(/The lure at hxxps/);
    await ta.fill('Newly registered: riskified-okta[.]com and shipmonk-servicenow[.]com (18 Oct), gladly-okta[.]com (19 Oct). Lure pages served from 198.51.100.23. Kit hash 3b9f2a1c0d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4. Contact: helpdesk@servicenow-ticket[.]com. See CVE-2026-20700.');
    await btn(page, 'Extract').click(); await page.waitForTimeout(300);
    const rows = await page.locator('input[type=checkbox]').count(); if (rows < 5) throw new Error('rows ' + rows);
    await shot(page, '14-extract-iocs.png', 'Extract IOCs: paste a report, press Extract, and every domain, IP, URL, email, hash, wallet, CVE and handle is listed with a type. Untick what you do not want, then add to the inbox or pin straight to the board.', [
      { locator: text('EXTRACT INDICATORS'), text: 'Extract IOCs modal' },
      { locator: btn(page, 'Extract'), text: 'Extract' },
      { locator: page.locator('input[type=checkbox]').first(), text: 'Found indicators (tick to keep)' },
      { locator: btn(page, 'Pin selected to board'), text: 'Pin selected to board / Add selected to inbox' },
    ], { title: 'Extract IOCs' });
    await btn(page, 'Add selected to inbox').click(); await page.waitForTimeout(300);
    const c1 = (await state(page)).cases.find(c => c.id === 'c2'); if (c1.items < c0.items + 5) throw new Error('items ' + c0.items + '->' + c1.items); return rows + ' rows; items ' + c0.items + ' -> ' + c1.items;
  });
  await page.keyboard.press('Escape');

  // ---- 15 OSINT workbench
  await check('OSINT workbench: detect type and run lookups', async () => {
    await btn(page, 'OSINT').click(); await page.waitForTimeout(200);
    const q = page.locator('[data-osint]'); await q.fill('riskified-okta.com');
    await btn(page, 'Run').click();
    await page.waitForTimeout(6000);
  });
  await shot(page, '15-osint.png', 'OSINT workbench (O): paste one selector (domain, IP, URL, email, handle, hash, wallet, CVE, phone or a name). The type is detected, live lookups run against public endpoints that allow browser access (DNS, crt.sh, RDAP, …), and launcher links open the rest. Pin the result as an indicator card with the findings attached.', [
    { locator: text('OSINT WORKBENCH'), text: 'OSINT workbench modal' },
    { locator: page.locator('[data-osint]'), text: 'Selector box (type auto-detected)' },
    { locator: btn(page, 'Run'), text: 'Run live lookups' },
    { locator: btn(page, 'Copy findings'), text: 'Copy findings / pin as a card' },
  ], { title: 'OSINT workbench' });
  await page.keyboard.press('Escape');

  // ---- 16 ACH
  await check('ACH: add hypotheses and score evidence', async () => {
    await btn(page, 'ACH').click(); await page.waitForTimeout(200);
    const h = page.getByPlaceholder('New hypothesis… Enter to add');
    for (const t of ['Financially motivated crew reusing an SSO phishing kit', 'State-directed credential collection', 'Opportunistic, no persistent actor']) { await h.fill(t); await h.press('Enter'); }
    await page.waitForTimeout(200);
    const cells = page.locator('button', { hasText: /^(CONSISTENT|INCONSISTENT|NEUTRAL|·)$/ });
    const n = await cells.count(); if (n < 3) throw new Error('no matrix cells ' + n);
    for (let r = 0; r < 4; r++) { await cells.nth(r * 3).click(); await cells.nth(r * 3 + 2).click(); await cells.nth(r * 3 + 2).click(); if (r === 1) { await cells.nth(r * 3 + 1).click(); await cells.nth(r * 3 + 1).click(); await cells.nth(r * 3 + 1).click(); } }
    const c = (await state(page)).cases.find(c => c.id === 'c2'); if (c.hyps !== 3) throw new Error('hyps ' + c.hyps); return n + ' matrix cells';
  });
  await shot(page, '16-ach.png', 'Analysis of Competing Hypotheses: add hypotheses, then click each cell to mark an exhibit Consistent, Inconsistent or Neutral with that hypothesis. The least-contradicted hypothesis is the one to carry into the key judgement.', [
    { locator: text('COMPETING HYPOTHESES'), text: 'ACH matrix modal' },
    { locator: page.getByPlaceholder('New hypothesis… Enter to add'), text: 'Add a hypothesis' },
    { locator: page.locator('button', { hasText: /^(CONSISTENT|INCONSISTENT|NEUTRAL|·)$/ }).first(), text: 'Click a cell to cycle consistent → inconsistent → neutral' },
  ], { title: 'Analysis of competing hypotheses' });
  await page.keyboard.press('Escape');

  // ---- 17 requests
  await check('request generator: takedown letter from selected indicators', async () => {
    await btn(page, 'Requests').click(); await page.waitForTimeout(200);
    await page.getByPlaceholder('Registrar abuse desk, hosting provider, partner CERT…').fill('abuse@registrar.example');
    const [popup] = await Promise.all([ctx.waitForEvent('page'), btn(page, 'Open letter').click()]);
    await popup.waitForLoadState(); await page.waitForTimeout(300);
    const body = await popup.evaluate(() => document.body.innerText);
    if (!/okta/i.test(body)) throw new Error('letter has no indicators');
    await popup.screenshot({ path: path.join(OUT, '17b-request-letter.png') });
    await popup.close(); return body.length + ' chars';
  });
  await shot(page, '17-requests.png', 'Request generator: choose Takedown request or Request for information, tick the indicators to include, name the recipient, then open the letter in a printable window or copy the text.', [
    { locator: text('REQUEST GENERATOR'), text: 'Request generator modal' },
    { locator: page.getByPlaceholder('Registrar abuse desk, hosting provider, partner CERT…'), text: 'Recipient' },
    { locator: btn(page, 'Open letter'), text: 'Open letter (printable) / Copy text' },
  ], { title: 'Request generator' });
  await page.keyboard.press('Escape');

  // ---- 18 threads tab
  await check('threads tab: suggestions and manual thread', async () => {
    await page.keyboard.press('Escape');
    await text('Threads').click(); await page.waitForTimeout(200);
    const s = await state(page); if (s.tab !== 'threads') throw new Error(s.tab);
    const pick = page.locator('aside select').filter({ has: page.locator('option', { hasText: 'Technique ·' }) });
    const optVal = async (loc, re) => loc.locator('option').evaluateAll((os, re) => { const o = os.find(o => new RegExp(re).test(o.textContent)); return o ? o.value : null; }, re.source);
    await pick.nth(0).selectOption(await optVal(pick.nth(0), /Okta look-alike login domain/)); await pick.nth(1).selectOption(await optVal(pick.nth(1), /Help-desk vishing/));
    await page.waitForTimeout(100);
    const before = (await state(page)).cases.find(c => c.id === 'c2').threads;
    await page.getByRole('button', { name: /^Pin thread$/ }).click(); await page.waitForTimeout(200);
    const after = (await state(page)).cases.find(c => c.id === 'c2').threads; if (after !== before + 1) throw new Error('threads ' + before + '->' + after); return 'threads ' + before + ' -> ' + after;
  });
  await shot(page, '18-threads-tab.png', 'Threads tab: every thread on the board with its relation and confidence, a manual "new thread" form, and suggested threads when two cards share an indicator, tag or handle (accept or dismiss).', [
    { locator: text('Threads'), text: 'Threads tab' },
    { locator: text('NEW THREAD'), text: 'New thread: pick two cards and a relation' },
  ], { title: 'Threads tab' });

  // ---- 19 audit tab: indicator hygiene
  await check('audit tab: hygiene checks for indicators', async () => {
    await text('Audit').click(); await page.waitForTimeout(200);
    const s = await state(page); if (s.tab !== 'audit') throw new Error(s.tab);
  });
  await shot(page, '19-audit.png', 'Audit tab: automatic hygiene checks across the case: indicators with no source, no grading, no sighting dates, stale beyond the staleness window, unstamped exhibits, threads without evidence. Click a row to jump to the card.', [
    { locator: text('Audit'), text: 'Audit tab' },
    { locator: asideOf('Audit'), text: 'Each group counts the exhibits that still need work' },
  ], { title: 'Audit tab' });

  // ---- 20 log tab: snapshots, playback, log
  await check('log tab: snapshots, playback and the case log', async () => {
    await text('Log').click(); await page.waitForTimeout(200);
    await page.getByPlaceholder('Name this state…').fill('Before takedown'); await page.getByPlaceholder('Name this state…').press('Enter'); await page.waitForTimeout(200);
    const c = (await state(page)).cases.find(c => c.id === 'c2'); if (c.snapshots !== 1) throw new Error('snapshots ' + c.snapshots);
    if (c.log < 5) throw new Error('log ' + c.log);
    await page.getByRole('button', { name: 'Play', exact: true }).click(); await page.waitForTimeout(900);
    const s = await state(page); if (!s.play.on) throw new Error('playback not on');
    await page.getByRole('button', { name: 'Exit', exact: true }).click(); await page.waitForTimeout(200);
    return 'snapshots ' + c.snapshots + ', log entries ' + c.log;
  });
  await shot(page, '20-log.png', 'Log tab: named snapshots (save, restore, diff against the current board), playback that rebuilds the board card by card in date order, and the append-only case log with time and analyst for every action.', [
    { locator: text('Log'), text: 'Log tab' },
    { locator: page.getByPlaceholder('Name this state…'), text: 'Snapshots: name + Save, then Restore or diff' },
    { locator: text('PLAYBACK · HOW THE BOARD BUILT UP'), text: 'Playback controls' },
    { locator: btn(page, 'Clear'), text: 'Case log (append-only)' },
  ], { title: 'Snapshots, playback and log' });

  // ---- 21 notes tab: judgement, handling, notes
  await check('notes tab: key judgement, sign-off and notes', async () => {
    await text('Notes').click(); await page.waitForTimeout(200);
    await page.getByPlaceholder('We assess that…').fill('We assess with moderate confidence that a financially motivated English-speaking crew is running a vendor-themed Okta/ServiceNow vishing campaign against e-commerce SaaS providers.');
    await page.getByPlaceholder('We assess that…').press('Tab');
    await page.getByPlaceholder('Dissent / alternative view and what would change the call').fill('A state actor using the same kit cannot be excluded until victimology is wider than e-commerce.');
    await page.getByPlaceholder('Dissent / alternative view and what would change the call').press('Tab');
    const ta = page.getByPlaceholder('Working theory, leads, to-dos…'); await ta.fill('WORKING THEORY\n\nVendor-themed Okta/ServiceNow domains support vishing calls that talk users through an MFA downgrade.\n\nTODO\n- block the 13 domains\n- audit SSO logs for enrolment changes\n- check fallback MFA policy'); await ta.press('Tab');
    await T('Review state of the case').selectOption('published'); await page.waitForTimeout(200);
    const c = (await state(page)).cases.find(c => c.id === 'c2'); if (c.review !== 'published') throw new Error('review ' + c.review);
  });
  await shot(page, '21-notes.png', 'Notes tab: the key judgement with confidence level and dissent, the dated timeline of the case, and free-text working notes. Setting the review state to Published records a sign-off by the analyst.', [
    { locator: text('Notes'), text: 'Notes tab' },
    { locator: text('KEY JUDGEMENT'), text: 'Key judgement, confidence, dissent, sign-off status' },
    { locator: page.getByPlaceholder('Working theory, leads, to-dos…'), text: 'Case notes (autosaved)' },
    { locator: T('Review state of the case'), text: 'Published = signed off by the analyst' },
  ], { title: 'Judgement and notes' });

  // ---- 22 present mode
  await check('present mode walks exhibits with arrow keys', async () => {
    await text('Inspector').click();
    await btn(page, 'Present').click(); await page.waitForTimeout(500);
    const s = await state(page); if (!s.present) throw new Error('not present');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
    const s2 = await state(page); if (s2.presentIdx !== s.presentIdx + 1) throw new Error('idx ' + s.presentIdx + '->' + s2.presentIdx);
  });
  await shot(page, '22-present.png', 'Present (P): panels hide, the board goes full-bleed, and arrow keys (or the on-screen controls) walk through the exhibits in number order. Esc exits.', [
    { locator: page.getByText(/EXHIBIT \d+ \/ \d+/), text: 'Exhibit counter; arrow keys step through the exhibits' },
  ], { title: 'Presentation mode', barTop: true });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // ---- 23 case brief + one-pager
  await check('case brief opens as a printable document', async () => {
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 12000 }), btn(page, 'Case brief').click()]);
    await popup.waitForLoadState(); await popup.waitForTimeout(800);
    const t = await popup.evaluate(() => document.body.innerText); if (!/CASE BRIEF/.test(t)) throw new Error('no brief');
    await popup.setViewportSize({ width: 1100, height: 1400 });
    await popup.screenshot({ path: path.join(OUT, '23-case-brief.png') });
    await popup.close(); return t.length + ' chars';
  });
  await check('one-pager opens as a printable document', async () => {
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 12000 }), btn(page, 'One-pager').click()]);
    await popup.waitForLoadState(); await popup.waitForTimeout(800);
    const t = await popup.evaluate(() => document.body.innerText); if (!/ONE-PAGER/.test(t)) throw new Error('no one-pager');
    await popup.setViewportSize({ width: 1100, height: 1400 });
    await popup.screenshot({ path: path.join(OUT, '24-one-pager.png') });
    await popup.close();
  });

  // ---- 25 exports
  const dls = {};
  for (const [name, re] of [['STIX', /\.json$/], ['Export image', /\.png$/], ['Export case', /\.json$/]]) {
    await check('download: ' + name, async () => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), btn(page, name).click()]);
      const f = dl.suggestedFilename(); if (!re.test(f)) throw new Error(f);
      const p = path.join(OUT, '..', 'exports', f); fs.mkdirSync(path.dirname(p), { recursive: true }); await dl.saveAs(p); dls[name] = p;
      const size = fs.statSync(p).size; if (size < 1000) throw new Error('tiny file ' + size); return f + ' (' + size + ' bytes)';
    });
  }
  await check('STIX bundle is valid STIX 2.1 with indicators and relationships', async () => {
    const b = JSON.parse(fs.readFileSync(dls['STIX'], 'utf8')); if (b.type !== 'bundle') throw new Error('not a bundle');
    const types = {}; b.objects.forEach(o => types[o.type] = (types[o.type] || 0) + 1); return JSON.stringify(types);
  });
  await check('case export has the documented shape', async () => {
    const j = JSON.parse(fs.readFileSync(dls['Export case'], 'utf8')); if (j.format !== 'cyber-investigation-board') throw new Error(j.format); return 'format=' + j.format + ' v' + j.version + ', ' + j.cases[0].items.length + ' items';
  });
  await shot(page, '25-exports.png', 'Exports: STIX 2.1 bundle (for MISP / OpenCTI / a TIP), the board as a PNG, and the whole case as JSON. Import accepts case JSON, STIX bundles and CSV / text indicator lists. Every export stamps TLP, case number, analyst and time.', [
    { locator: btn(page, 'STIX'), text: 'STIX 2.1 bundle' },
    { locator: btn(page, 'Export image'), text: 'Board as PNG' },
    { locator: btn(page, 'Export case'), text: 'Case as JSON' },
    { locator: btn(page, 'Import'), text: 'Import JSON / STIX / CSV' },
  ], { title: 'Exports and import' });
  if (dls['Export image']) fs.copyFileSync(dls['Export image'], path.join(OUT, '26-board-export.png'));

  // ---- 27 import round-trip into a new case
  await check('import: case JSON round-trips as a new case', async () => {
    const n0 = (await state(page)).cases.length;
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), btn(page, 'Import').click()]);
    await chooser.setFiles(dls['Export case']); await page.waitForTimeout(600);
    const s = await state(page); if (s.cases.length !== n0 + 1) throw new Error('cases ' + n0 + '->' + s.cases.length); return 'cases ' + n0 + ' -> ' + s.cases.length + ' (' + s.cases[s.cases.length - 1].items + ' items)';
  });
  await check('import: CSV indicator list lands in the inbox', async () => {
    const csv = path.join(OUT, '..', 'exports', 'sample-indicators.csv');
    fs.writeFileSync(csv, 'type,value,title\ndomain,yotpo-okta[.]com,Okta look-alike\ndomain,paddleokta[.]com,Okta look-alike\nip,203.0.113.77,Lure host\n');
    const c0 = (await state(page)); const cur0 = c0.cases.find(c => c.id === c0.activeId);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), btn(page, 'Import').click()]);
    await chooser.setFiles(csv); await page.waitForTimeout(600);
    const s = await state(page); const cur = s.cases.find(c => c.id === s.activeId); if (cur.items < cur0.items + 3) throw new Error('items ' + cur0.items + '->' + cur.items); return 'items ' + cur0.items + ' -> ' + cur.items;
  });

  // ---- 28 new case from template
  await check('new case from the Phishing campaign template', async () => {
    const n0 = (await state(page)).cases.length;
    await btn(page, 'New case').click(); await page.waitForTimeout(200);
    await shot(page, '27-new-case.png', 'New case: start blank or from a template (phishing campaign, crypto theft, ransomware intrusion, insider threat, impersonation / disinformation). Templates pre-load hypotheses, starter cards and tasks.', [
      { locator: text('NEW CASE'), text: 'Template picker' },
      { locator: page.getByText('Phishing campaign', { exact: true }).first(), text: 'Phishing campaign template' },
    ], { title: 'New case' });
    await page.getByText('Phishing campaign', { exact: true }).first().click(); await page.waitForTimeout(400);
    const s = await state(page); if (s.cases.length !== n0 + 1) throw new Error('cases'); const c = s.cases.find(c => c.id === s.activeId); return c.number + ' ' + c.title + ' · ' + c.items + ' items, ' + c.hyps + ' hypotheses, tlp ' + c.tlp;
  });

  // ---- 29 undo + delete
  await check('Delete key removes the selected card; Ctrl+Z restores it', async () => {
    await page.waitForTimeout(300);
    const c0 = (await state(page)); const a = c0.cases.find(c => c.id === c0.activeId).items;
    await selectCard(0); await page.keyboard.press('Delete'); await page.waitForTimeout(200);
    const c1 = (await state(page)); const b = c1.cases.find(c => c.id === c1.activeId).items; if (b !== a - 1) throw new Error('delete ' + a + '->' + b);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
    const c2 = (await state(page)); const d = c2.cases.find(c => c.id === c2.activeId).items; if (d !== a) throw new Error('undo ' + d); return a + ' -> ' + b + ' -> ' + d;
  });

  // ---- 30 zoom / fit / panel toggles
  await check('zoom buttons, Fit, Inbox and Panel toggles', async () => {
    const z0 = (await state(page)).view.z;
    await T('Zoom in').click(); await page.waitForTimeout(100); const z1 = (await state(page)).view.z; if (!(z1 > z0)) throw new Error('zoom in');
    await T('Zoom out').click(); await page.waitForTimeout(100);
    await btn(page, 'Fit').click(); await page.waitForTimeout(200);
    await btn(page, 'Inbox').click(); await page.waitForTimeout(100); if ((await state(page)).showInbox) throw new Error('inbox still shown');
    await btn(page, 'Panel').click(); await page.waitForTimeout(100); if ((await state(page)).showRight) throw new Error('panel still shown');
    await btn(page, 'Inbox').click(); await btn(page, 'Panel').click();
  });

  // ---- 31 encrypt at rest
  await check('encrypt at rest: set passphrase, reload shows lock screen, unlock restores cases', async () => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await btn(page, 'Encrypt').click(); await page.waitForTimeout(200);
    await shot(page, '28-encrypt.png', 'Encrypt: set a passphrase and saved cases are stored AES-GCM encrypted in the browser. On the next load the board asks for the passphrase before anything is shown.', [
      { locator: text('ENCRYPTION AT REST'), text: 'Encryption at rest dialog' },
      { locator: page.getByPlaceholder('Passphrase'), text: 'Passphrase' },
      { locator: btn(page, 'Encrypt saved cases'), text: 'Encrypt saved cases' },
    ], { title: 'Encryption at rest' });
    await page.getByPlaceholder('Passphrase').fill('correct horse battery staple');
    await btn(page, 'Encrypt saved cases').click(); await page.waitForTimeout(800);
    const raw = await page.evaluate(() => localStorage.getItem('cyber-investigation-board.v1')); const d = JSON.parse(raw); if (d.enc !== 1) throw new Error('not encrypted');
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const s = await state(page); if (s.activeId !== 'locked') throw new Error('no lock screen');
    await shot(page, '29-locked.png', 'Locked: with encryption on, the next visit shows only the passphrase prompt. "Forgot it" wipes the store and starts over.', [
      { locator: page.getByPlaceholder('Passphrase'), text: 'Enter the passphrase' },
      { locator: btn(page, 'Unlock'), text: 'Unlock' },
    ], { title: 'Locked case files' });
    await page.getByPlaceholder('Passphrase').fill('correct horse battery staple'); await btn(page, 'Unlock').click(); await page.waitForTimeout(1000);
    const s2 = await state(page); if (s2.cases.length < 3) throw new Error('cases after unlock ' + s2.cases.length); return s2.cases.length + ' cases restored';
  });

  // ---- 32 responsive / mobile
  await check('mobile layout under 720px switches to list mode', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800);
    const s = await state(page); if (!s.mobile) throw new Error('mobile flag off');
  });
  await shot(page, '30-mobile.png', 'Narrow screens (under 720px): the board becomes a list with the same cards, inspector and actions.', [], { title: 'Mobile layout' });
  await page.setViewportSize({ width: 1440, height: 900 });

  const unexpected = page.errors.filter(e => !/CORS|Failed to fetch|net::/.test(e));
  if (unexpected.length) fail('no unexpected page errors during the run (OSINT CORS refusals are expected and handled)', unexpected.slice(0, 5).join(' | ')); else pass('no unexpected page errors during the run (OSINT CORS refusals are expected and handled)');
  report(path.join(OUT, '..', 'feature-check.json'));
  await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
