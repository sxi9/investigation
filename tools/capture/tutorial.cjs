// Worked investigation: the vendor-themed Okta / ServiceNow vishing campaign reported by Dataminr TRACE (19 Oct 2026).
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'tutorial');
process.env.SHOT_DIR = OUT; fs.mkdirSync(OUT, { recursive: true });
const { launch, shot, check, card, btn, state, report, watch, pass, fail, logic } = require('./lib.cjs');
const BRIEF = 'https://www.dataminr.com/resources/intel-brief/okta-themed-phishing-campain-targets-e-commerce-providers/';
const DOMAINS = ['gladly-okta[.]com', 'riskified-okta[.]com', 'shipmonk-servicenow[.]com', 'yotpo-okta[.]com', 'paddleokta[.]com', 'moengageinc-okta[.]com', 'vzw-web-portal[.]com', 'listrak-okta[.]com', 'oktadialpad[.]com', 'servicenow-ticket2478[.]com', 'servicenow-ticket2829[.]com', 'servicenow-ticket[.]com', 'attentive-okta[.]com'];

(async () => {
  const { browser, ctx, page } = await launch();
  page.setDefaultTimeout(8000); watch(page);
  const T = (t) => page.getByTitle(t).first();
  const text = (t) => page.getByText(t, { exact: true }).first();
  const asideOf = (t) => text(t).locator('xpath=ancestor::aside[1]');
  const active = async () => { const s = await state(page); return { s, c: s.cases.find(c => c.id === s.activeId) }; };
  const selectCard = async (name) => {
    const loc = DOMAINS.includes(name) ? cardExact(name) : card(page, name); await loc.waitFor({ state: 'attached' });
    const bb = await loc.boundingBox(); const cx = bb ? bb.x + bb.width / 2 : 0, cy = bb ? bb.y + 20 : 0;
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true });
    await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: x, clientY: y, pointerId: 1, bubbles: true })), [cx, cy]);
    await page.waitForTimeout(120);
    const id = await loc.getAttribute('data-card'); const s = await state(page);
    if (s.tool === 'move' && s.sel !== id) throw new Error('selection failed for ' + name + ' (sel=' + s.sel + ', want ' + id + ')');
  };
  // Move a card to world coordinates by dragging it through the app's own pointer handlers.
  const dragTo = async (name, wx, wy) => {
    const { s } = await active(); const rf = x => String(x || '').replace(/\[\.\]/g, '.'); const it = s.items.find(i => rf(i.title).startsWith(rf(name)) || rf(i.value).startsWith(rf(name))) || s.items.find(i => rf(i.title).includes(rf(name)) || rf(i.value).includes(rf(name)) || rf(i.body).includes(rf(name)));
    if (!it) throw new Error('no item ' + name);
    const z = s.view.z; const loc = page.locator('[data-card="' + it.id + '"][data-kind="card"]');
    const bb = await loc.boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + 20;
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true });
    const tx = cx + (wx - it.x) * z, ty = cy + (wy - it.y) * z;
    await page.evaluate(([x, y, x2, y2]) => { window.dispatchEvent(new PointerEvent('pointermove', { clientX: (x + x2) / 2, clientY: (y + y2) / 2, buttons: 1, pointerId: 1, bubbles: true })); window.dispatchEvent(new PointerEvent('pointermove', { clientX: x2, clientY: y2, buttons: 1, pointerId: 1, bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: x2, clientY: y2, pointerId: 1, bubbles: true })); }, [cx, cy, tx, ty]);
    await page.waitForTimeout(60);
  };
  const fill = async (loc, v) => { await loc.fill(v); await loc.press('Tab'); await page.waitForTimeout(80); };
  // Inspector fields are looked up inside the side panel only: target cards print SECTOR / REGION labels on the board too.
  const panel = () => page.locator('aside').last();
  const field = (label, kind = 'input', n = 1) => panel().getByText(label, { exact: true }).first().locator('xpath=following::' + kind + '[' + n + ']');
  const cardExact = (txt) => page.locator('[data-card][data-kind="card"]').filter({ has: page.getByText(txt, { exact: true }) }).first();
  const quick = async (cmd) => { const q = page.getByPlaceholder(/quick add/); await q.fill(cmd); await q.press('Enter'); await page.waitForTimeout(150); };
  const connect = async (a, b, rel) => { await btn(page, 'Connect').click(); await btn(page, rel).click(); await selectCard(a); await selectCard(b); await page.waitForTimeout(100); await btn(page, 'Move').click(); await page.keyboard.press('Escape'); };
  const fit = async () => { await btn(page, 'Fit').click(); await page.waitForTimeout(300); };
  const closeModal = async () => { const c = page.getByRole('button', { name: 'Close', exact: true }); if (await c.count()) await c.first().click(); else await page.keyboard.press('Escape'); await page.waitForTimeout(150); };

  // ---- Step 1: new case from the template
  await check('step 1: create the case from the Phishing campaign template', async () => {
    await btn(page, 'New case').click(); await page.waitForTimeout(200);
    await shot(page, 't01-new-case.png', 'Click New case and choose the Phishing campaign template. It pre-loads three hypotheses, seven starter cards and four tasks, and sets TLP:AMBER.', [
      { locator: btn(page, 'New case'), text: 'New case' },
      { locator: page.getByText('Phishing campaign', { exact: true }).first(), text: 'Choose "Phishing campaign"' },
    ], { title: 'Step 1 · Start the case' });
    await page.getByText('Phishing campaign', { exact: true }).first().click(); await page.waitForTimeout(400);
    await fill(page.getByPlaceholder('Case title'), 'Vendor-themed Okta vishing wave');
    await fill(page.getByPlaceholder('Analyst'), 'S. Murugan');
    await T('Traffic Light Protocol marking for this case — printed on every export').selectOption('green');
    const { c } = await active(); if (!/Okta vishing/.test(c.title)) throw new Error(c.title); return c.number + ' · ' + c.items + ' starter cards';
  });
  await fit();
  await shot(page, 't02-template-board.png', 'The new case opens with the template\'s starter cards pinned. Rename the case in the title box, type your name in Analyst (it is stamped on every log entry), and set the TLP. Public reporting goes in as TLP:GREEN.', [
    { locator: page.getByPlaceholder('Case title'), text: 'Case title' },
    { locator: page.getByPlaceholder('Analyst'), text: 'Analyst name' },
    { locator: T('Traffic Light Protocol marking for this case — printed on every export'), text: 'TLP:GREEN' },
    { sel: '[data-board]', text: 'Starter cards from the template: lure domain, sender, landing page, technique, operator, target, first event', at: 't' },
  ], { title: 'Step 1 · The empty case' });

  // ---- Step 2: source document + extract IOCs
  await check('step 2: add the source link and pull the 13 domains with Extract IOCs', async () => {
    await quick('u ' + BRIEF);
    await selectCard('dataminr.com');
    await fill(field('TITLE'), 'Dataminr TRACE brief — Okta-themed phishing targets e-commerce providers');
    await fill(field('TITLE', 'textarea'), 'Published 19 Oct 2026. Waves of look-alike Okta / ServiceNow domains since late July 2026; September targeting pattern against e-commerce SaaS and infrastructure providers. Domains support vishing calls that walk users through an MFA downgrade (SMS / email code) to get past YubiKeys.');
    await fill(field('DATE'), '2026-10-19');
    await fill(field('TAGS'), 'source, reporting');
    await fill(field('SOURCE · WHO SAID SO'), 'Dataminr TRACE');
    await btn(page, 'Confirmed').click();
    await page.keyboard.press('Escape');
    await btn(page, 'Extract IOCs').click(); await page.waitForTimeout(200);
    const ta = page.getByPlaceholder(/The lure at hxxps/);
    await ta.fill('Indicators from the Dataminr TRACE brief (19 Oct 2026): ' + DOMAINS.join(', ') + '. Newly registered 18 Oct: riskified-okta[.]com, shipmonk-servicenow[.]com; 19 Oct: gladly-okta[.]com.');
    await btn(page, 'Extract').click(); await page.waitForTimeout(300);
    const rows = await page.locator('input[type=checkbox]').count();
    await shot(page, 't03-extract.png', 'Paste the brief\'s indicator list into Extract IOCs and press Extract. Every defanged domain is recognised and typed. Leave them all ticked and press "Pin selected to board".', [
      { locator: btn(page, 'Extract'), text: 'Extract' },
      { locator: page.locator('input[type=checkbox]').first(), text: rows + ' indicators found, all ticked' },
      { locator: btn(page, 'Pin selected to board'), text: 'Pin selected to board' },
    ], { title: 'Step 2 · Pull the indicators out of the report' });
    await btn(page, 'Pin selected to board').click(); await page.waitForTimeout(400);
    const { c } = await active(); if (rows !== 13) throw new Error('rows ' + rows); return rows + ' domains pinned; pinned now ' + c.pinned;
  });

  // ---- Step 3: remove the template placeholders we do not need, flesh out the actor and target
  await check('step 3: delete unused placeholders, edit the operator and target cards', async () => {
    for (const n of ['Sender address', 'Landing page', 'Lure domain', 'Spearphishing Link']) { await selectCard(n); await page.keyboard.press('Delete'); await page.waitForTimeout(120); }
    await selectCard('Unknown operator');
    await fill(field('TITLE'), 'English-speaking cybercrime crew (unnamed)');
    await fill(field('TITLE', 'textarea'), 'Dataminr links the domains with high confidence to earlier English-language cybercrime activity with the same targeting. No group name published. Tradecraft: vendor-themed SSO lures + live vishing + MFA downgrade.');
    await fill(field('TAGS'), 'actor, vishing');
    await fill(field('SOURCE · WHO SAID SO'), 'Dataminr TRACE');
    await btn(page, 'Unverified').click();
    await selectCard('Targeted organisation');
    await fill(field('TITLE'), 'B2B e-commerce SaaS & infrastructure providers');
    await fill(field('TITLE', 'textarea'), 'Marketing / customer-engagement platforms, logistics partners, payment and fraud-prevention providers. Several hit more than once. Likely chosen for downstream third-party breach leverage.');
    await fill(field('SECTOR'), 'E-commerce SaaS');
    await fill(field('REGION'), 'US (global customer base)');
    await fill(field('WHAT WAS TAKEN / IMPACT'), 'Credentials + MFA bypass → SSO access; data-extortion leverage over the providers\' customers');
    await fill(field('TAGS'), 'target');
    await btn(page, 'Confirmed').click();
    await selectCard('First lure delivered');
    await fill(field('TITLE'), 'Vishing calls using the look-alike SSO pages');
    await fill(field('DATE'), '2026-09-15');
    await fill(field('TITLE', 'textarea'), 'September 2026: targeting pattern against e-commerce SaaS providers observed. Callers direct users to the fake Okta page and talk them into a fallback MFA method.');
    await btn(page, 'Confirmed').click();
    await page.keyboard.press('Escape');
    const { c } = await active(); return c.pinned + ' pinned';
  });
  await shot(page, 't04-edit-cards.png', 'Click any card to edit it in the Inspector. Give the operator and target cards real titles and bodies, stamp what the source confirms, and record where each fact came from under SOURCE. Select a placeholder you do not need and press Delete.', [
    { locator: card(page, 'English-speaking cybercrime crew'), text: 'Operator card (stamped Unverified: no named group)', at: 't' },
    { locator: card(page, 'B2B e-commerce SaaS'), text: 'Target card with sector, region, impact', at: 't' },
    { locator: asideOf('Inspector'), text: 'Inspector: title, body, stamp, tags, source' },
  ], { title: 'Step 3 · Flesh out the actors and victims' });

  // ---- Step 4: techniques, events, notes via quick add
  await check('step 4: quick-add techniques, events and a note', async () => {
    for (const cmd of ['t T1583.001', 't T1566.004', 't T1621', 't T1078',
      'e 2026-07-28 First wave of look-alike domain registrations', 'e 2026-10-18 riskified-okta[.]com and shipmonk-servicenow[.]com registered', 'e 2026-10-19 gladly-okta[.]com registered (~20h later)',
      'n MFA downgrade: where policy allows SMS or email codes as fallback, the caller gets the user to enrol or use one, bypassing the YubiKey.',
      'n Naming pattern: <vendor>-okta[.]com, okta<vendor>[.]com, <vendor>-servicenow[.]com, servicenow-ticket<n>[.]com. Monitor new registrations matching it.']) await quick(cmd);
    const { c } = await active(); return c.pinned + ' pinned';
  });

  // ---- Step 5: lay the board out (drag) — events in a top row, domains in a grid, techniques right
  await check('step 5: arrange the board by dragging cards', async () => {
    await fit();
    const L = await logic(page);
    await page.evaluate(L => L.setState({ view: { x: 40, y: 40, z: 0.5 } }), L); await page.waitForTimeout(200);
    const place = [
      ['Dataminr TRACE brief', 40, 40], ['First wave of look-alike', 40, 460], ['Vishing calls using', 40, 680], ['riskified-okta[.]com and shipmonk', 40, 920], ['gladly-okta[.]com registered', 40, 1140],
      ['English-speaking cybercrime crew', 340, 40], ['B2B e-commerce SaaS', 340, 440], ['MFA downgrade', 340, 800], ['Naming pattern', 340, 1080], ['Case plan', 640, 1200],
      ['Acquire Infrastructure: Domains', 1460, 40], ['Spearphishing Voice', 1460, 330], ['Multi-Factor Authentication Request', 1460, 620], ['Valid Accounts', 1460, 940],
    ];
    DOMAINS.forEach((d, i) => place.push([d, 640 + (i % 3) * 270, 40 + Math.floor(i / 3) * 230]));
    for (const [n, x, y] of place) await dragTo(n, x, y);
    await fit();
  });
  await shot(page, 't05-arranged.png', 'Drag cards to arrange them: dated events down the left, actor / victim / analyst notes next, the thirteen domains as a grid, ATT&CK techniques on the right. Drag empty board to pan, use the mouse wheel to zoom, press F to fit.', [
    { locator: card(page, 'First wave of look-alike'), text: 'Event cards (red edge) carry the date', at: 't' },
    { locator: cardExact('gladly-okta[.]com'), text: 'Domain indicators from Extract IOCs', at: 't' },
    { locator: card(page, 'Spearphishing Voice'), text: 'ATT&CK techniques added with "t T1566.004"', at: 't' },
  ], { title: 'Step 5 · Arrange the evidence' });

  // ---- Step 6: threads
  await check('step 6: connect the evidence with threads', async () => {
    await fit();
    const before = (await active()).c.threads;
    await connect('English-speaking cybercrime crew', 'gladly-okta[.]com', 'controls');
    await connect('English-speaking cybercrime crew', 'riskified-okta[.]com', 'controls');
    await connect('English-speaking cybercrime crew', 'shipmonk-servicenow[.]com', 'controls');
    await connect('English-speaking cybercrime crew', 'Spearphishing Voice', 'linked to');
    await connect('Spearphishing Voice', 'Vishing calls using', 'linked to');
    await connect('Vishing calls using', 'B2B e-commerce SaaS', 'linked to');
    await connect('Multi-Factor Authentication Request', 'MFA downgrade', 'linked to');
    await connect('Valid Accounts', 'MFA downgrade', 'linked to');
    await connect('Acquire Infrastructure: Domains', 'First wave of look-alike', 'linked to');
    await connect('gladly-okta[.]com registered', 'gladly-okta[.]com', 'linked to');
    await connect('riskified-okta[.]com and shipmonk', 'riskified-okta[.]com', 'linked to');
    await connect('Dataminr TRACE brief', 'English-speaking cybercrime crew', 'suspected');
    await connect('vzw-web-portal[.]com', 'B2B e-commerce SaaS', 'suspected');
    const after = (await active()).c.threads; if (after < before + 12) throw new Error('threads ' + before + '->' + after);
    // add evidence to one thread
    await selectCard('Dataminr TRACE brief');
    return 'threads ' + before + ' -> ' + after;
  });
  await check('step 6b: thread editor — record why two cards are linked', async () => {
    await page.getByTitle('Click to edit this thread').first().click({ force: true }); await page.waitForTimeout(200);
    const s = await state(page); if (!s.selThread) throw new Error('no thread selected');
    await fill(page.getByPlaceholder('Why these two are connected — the brief prints it'), 'Dataminr: high-confidence link to earlier English-language cybercrime activity with the same targeting.');
  });
  await shot(page, 't06-threads.png', 'Press C (Connect), pick a relation on the toolbar, then click one card and another. "controls" for operator → infrastructure, "linked to" for evidence, "suspected" where the source hedges. Click a thread label to open the thread editor and write down why the two are connected; the case brief prints it.', [
    { locator: btn(page, 'Connect'), text: 'Connect tool (C)' },
    { locator: btn(page, 'controls'), text: 'Relation picker' },
    { locator: page.getByPlaceholder('Why these two are connected — the brief prints it'), text: 'Evidence for this link' },
  ], { title: 'Step 6 · Thread the evidence' });
  await page.keyboard.press('Escape');

  // ---- Step 7: OSINT on one domain
  await check('step 7: OSINT workbench on a domain', async () => {
    await selectCard('riskified-okta[.]com');
    await btn(page, 'OSINT').click(); await page.waitForTimeout(200);
    const q = page.locator('[data-osint]'); if (!(await q.inputValue())) await q.fill('riskified-okta.com');
    await btn(page, 'Run').click(); await page.waitForTimeout(7000);
  });
  await shot(page, 't07-osint.png', 'Select a domain card and press O (or OSINT). The selector is pre-filled; press Run. Live lookups that allow browser access (Google DNS, crt.sh, RDAP, …) return inline; the others are one-click launchers (VirusTotal, urlscan, Shodan, Wayback). "Copy findings" puts the results on the clipboard; pinning writes them into the card.', [
    { locator: page.locator('[data-osint]'), text: 'Selector, type auto-detected as Domain' },
    { locator: btn(page, 'Run'), text: 'Run' },
    { locator: btn(page, 'Copy findings'), text: 'Copy findings' },
  ], { title: 'Step 7 · Pivot on an indicator' });
  await closeModal();

  // ---- Step 8: grade the indicators + tasks
  await check('step 8: stamp and grade the indicators, add tasks', async () => {
    await btn(page, 'Move').click(); await fit();
    for (const d of ['gladly-okta[.]com', 'riskified-okta[.]com', 'shipmonk-servicenow[.]com']) {
      await selectCard(d);
      await btn(page, 'Confirmed').click();
      await fill(field('SOURCE · WHO SAID SO'), 'Dataminr TRACE brief');
      await fill(field('COLLECTED'), '2026-10-19');
      await field('SOURCE · WHO SAID SO', 'select').selectOption('B');
      await field('SOURCE · WHO SAID SO', 'select', 2).selectOption('2');
      await fill(field('FIRST SEEN'), d.startsWith('gladly') ? '2026-10-19' : '2026-10-18');
    }
    const todo = page.getByPlaceholder('Open question or to-do… Enter to add');
    for (const t of ['Block all 13 domains at proxy + mail gateway', 'Search SSO logs for logins from VPN/proxy IPs + MFA enrolment changes', 'Registrar abuse report for the -okta / -servicenow domains']) { await todo.fill(t); await todo.press('Enter'); }
    const cm = page.getByPlaceholder('Comment… Ctrl+Enter to post'); await cm.fill('Registered 18 Oct, flagged by TRACE within a day. Treat as live until the registrar confirms suspension.'); await cm.press('Control+Enter');
    await page.waitForTimeout(200);
  });
  await shot(page, 't08-grade.png', 'For each key indicator: stamp it Confirmed, name the source, set the collection date and the Admiralty grade (B2 = usually reliable source, probably true). First seen / last seen feed the staleness check in the Audit tab.', [
    { locator: btn(page, 'Confirmed'), text: 'Stamp: Confirmed' },
    { locator: panel().getByText('SOURCE · WHO SAID SO', { exact: true }).first(), text: 'Source, collected date, grade B2' },
    { locator: panel().getByText('FIRST SEEN', { exact: true }).first(), text: 'First seen 18 Oct 2026' },
  ], { title: 'Step 8 · Grade the evidence', scrollTo: 0 });
  await shot(page, 't08b-tasks.png', 'Further down the same card: the follow-up tasks (block, hunt in SSO logs, registrar abuse report) and a dated comment. Open tasks are listed in the Audit tab until they are ticked off.', [
    { locator: page.getByPlaceholder('Open question or to-do… Enter to add'), text: 'Tasks on this indicator (3 open)' },
    { locator: page.getByPlaceholder('Comment… Ctrl+Enter to post'), text: 'Comments, stamped with analyst and time' },
  ], { title: 'Step 8 · Tasks and comments', scrollTo: 0 });
  await page.keyboard.press('Escape');

  // ---- Step 9: ACH
  await check('step 9: score the template hypotheses in ACH', async () => {
    await btn(page, 'ACH').click(); await page.waitForTimeout(300);
    const cells = page.locator('button', { hasText: /^(CONSISTENT|INCONSISTENT|NEUTRAL|·)$/ }); const n = await cells.count(); if (n < 9) throw new Error('cells ' + n);
    // columns: [crew reusing kit, state-directed, opportunistic]; one click = consistent, two = inconsistent, three = neutral
    const rows = Math.min(10, Math.floor(n / 3));
    for (let r = 0; r < rows; r++) {
      await cells.nth(r * 3).click();                                   // consistent with an organised crew
      await cells.nth(r * 3 + 1).click(); await cells.nth(r * 3 + 1).click(); await cells.nth(r * 3 + 1).click(); // neutral for state-directed
      await cells.nth(r * 3 + 2).click(); await cells.nth(r * 3 + 2).click(); // inconsistent with opportunistic
    }
    return n + ' cells';
  });
  await shot(page, 't09-ach.png', 'ACH: the template seeded three hypotheses. Click each cell to mark an exhibit Consistent (C) or Inconsistent (I) with a hypothesis. Repeated targeting, vendor-specific domains and live vishing are consistent with an organised crew and inconsistent with an opportunistic actor.', [
    { locator: text('COMPETING HYPOTHESES'), text: 'Three hypotheses from the template' },
    { locator: page.locator('button', { hasText: /^(CONSISTENT|INCONSISTENT|NEUTRAL|·)$/ }).first(), text: 'Click a cell to cycle consistent → inconsistent → neutral' },
  ], { title: 'Step 9 · Test the hypotheses' });
  await closeModal();

  // ---- Step 10: judgement, notes, snapshot, review
  await check('step 10: key judgement, notes, snapshot, review state', async () => {
    await text('Notes').click(); await page.waitForTimeout(200);
    await fill(page.getByPlaceholder('We assess that…'), 'We assess with moderate confidence that an English-speaking cybercrime crew is running a vendor-themed Okta / ServiceNow vishing campaign against B2B e-commerce SaaS providers, using look-alike SSO pages to drive an MFA downgrade past hardware keys. Motive is most likely data-extortion leverage over the providers\' downstream customers.');
    await btn(page, 'Moderate').click();
    await fill(page.getByPlaceholder('Dissent / alternative view and what would change the call'), 'State-directed collection is not excluded: the same kit and call centre could serve an espionage tasking. Victimology outside e-commerce, or attribution of the voice operators, would change the call.');
    await fill(page.getByPlaceholder('Working theory, leads, to-dos…'), 'WORKING THEORY\nWaves of <vendor>-okta / -servicenow domains since late July support live vishing: the caller sends the target to the look-alike SSO page and talks them through a fallback MFA method.\n\nOPEN\n- any of the 13 domains resolving / serving a page today?\n- registrar + nameserver overlap between waves\n- which of our vendors appear in the pattern\n\nSOURCES\n- Dataminr TRACE brief, 19 Oct 2026\n- Okta reporting on MFA enrolment weaknesses (referenced by the brief)');
    await text('Log').click(); await page.waitForTimeout(200);
    await page.getByPlaceholder('Name this state…').fill('Initial triage complete'); await page.getByPlaceholder('Name this state…').press('Enter'); await page.waitForTimeout(200);
    await T('Review state of the case').selectOption('in review');
    const { c } = await active(); if (c.snapshots !== 1) throw new Error('snapshot'); return 'review=' + c.review;
  });
  await text('Notes').click(); await page.waitForTimeout(200);
  await shot(page, 't10-judgement.png', 'Write the key judgement in the Notes tab with a confidence level and the dissenting view. Keep the working theory and open questions in the notes. Save a named snapshot in the Log tab so you can diff the board later, and move the review state to "In review".', [
    { locator: text('KEY JUDGEMENT'), text: 'Key judgement + confidence + dissent' },
    { locator: page.getByPlaceholder('Working theory, leads, to-dos…'), text: 'Working notes' },
    { locator: T('Review state of the case'), text: 'Review state: In review' },
  ], { title: 'Step 10 · Write the judgement' });

  // ---- Step 11: timeline + kill chain
  await check('step 11: timeline and kill-chain views', async () => {
    await text('Inspector').click();
    await btn(page, 'Timeline').click(); await page.waitForTimeout(500);
    await shot(page, 't11-timeline.png', 'Press T for the timeline view: the dated cards line up from the July registration wave to the 19 Oct brief; undated cards sit on the shelf. The rail at the bottom lists the same events.', [
      { locator: btn(page, 'Timeline'), text: 'Timeline view' },
      { box: { x: 0, y: 832, w: 1440, h: 68 }, text: 'Timeline rail', at: 'tr' },
    ], { title: 'Step 11 · Timeline' });
    await btn(page, 'Timeline').click(); await page.waitForTimeout(300);
    await btn(page, 'Kill chain').click(); await page.waitForTimeout(500);
    await shot(page, 't12-kill-chain.png', 'Press K for kill-chain lanes: Resource Development (acquire domains) → Initial Access (vishing) → Credential Access (MFA request generation) → Valid Accounts, with the evidence threaded to each technique shown beneath it.', [
      { locator: btn(page, 'Kill chain'), text: 'Kill-chain lanes' },
    ], { title: 'Step 11 · Kill chain' });
    await btn(page, 'Kill chain').click(); await page.waitForTimeout(300);
  });

  // ---- Step 12: takedown request
  await check('step 12: generate a takedown request', async () => {
    await btn(page, 'Requests').click(); await page.waitForTimeout(200);
    await fill(page.getByPlaceholder('Registrar abuse desk, hosting provider, partner CERT…'), 'Registrar abuse desk');
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 12000 }), btn(page, 'Open letter').click()]);
    await popup.waitForLoadState(); await popup.waitForTimeout(400);
    await popup.setViewportSize({ width: 900, height: 1100 });
    await popup.screenshot({ path: path.join(OUT, 't13b-takedown-letter.png') });
    const t = await popup.evaluate(() => document.body.innerText); await popup.close();
    if (!/gladly-okta/.test(t)) throw new Error('letter missing domains');
  });
  await shot(page, 't13-requests.png', 'Requests → Takedown request. All indicators are pre-ticked; name the recipient and open the letter. It lists the domains defanged, the case number, TLP and your name, ready to paste into an abuse report.', [
    { locator: text('REQUEST GENERATOR'), text: 'Takedown request / RFI' },
    { locator: btn(page, 'Open letter'), text: 'Open letter' },
  ], { title: 'Step 12 · Ask for the takedown' });
  await closeModal();

  // ---- Step 13: exports
  await check('step 13: case brief, STIX and case export', async () => {
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), btn(page, 'Case brief').click()]);
    await popup.waitForLoadState(); await popup.waitForTimeout(800);
    await popup.setViewportSize({ width: 1100, height: 1500 });
    await popup.screenshot({ path: path.join(OUT, 't14-case-brief.png') });
    await popup.close();
    const ex = path.join(OUT, '..', 'exports');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), btn(page, 'STIX').click()]); await dl.saveAs(path.join(ex, dl.suggestedFilename()));
    const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), btn(page, 'Export case').click()]); await dl2.saveAs(path.join(ex, dl2.suggestedFilename()));
    const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), btn(page, 'Export image').click()]); await dl3.saveAs(path.join(OUT, 't16-board-export.png'));
    return dl.suggestedFilename() + ', ' + dl2.suggestedFilename();
  });
  await fit();
  await shot(page, 't15-final-board.png', 'The finished board. Case brief prints everything (judgement, exhibits, threads with their evidence, timeline, tasks) for PDF; STIX exports the indicators, techniques and relationships for MISP / OpenCTI; Export case saves the JSON you can re-import later.', [
    { locator: btn(page, 'Case brief'), text: 'Case brief (printable)' },
    { locator: btn(page, 'STIX'), text: 'STIX 2.1 bundle' },
    { locator: btn(page, 'Export case'), text: 'Case JSON' },
    { sel: '[data-board]', text: 'Finished board', at: 't' },
  ], { title: 'Step 13 · Report and share' });

  if (page.errors.filter(e => !/CORS|Failed to fetch|net::/.test(e)).length) fail('no unexpected page errors', page.errors.filter(e => !/CORS|Failed to fetch|net::/.test(e)).slice(0, 5).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'tutorial-run.json'));
  await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
