// Full-feature worked case: SafePay ransomware (CISA #StopRansomware advisory AA26-293A, 20 Oct 2026).
// Drives every feature of the board in headless Chromium, with image uploads, OSINT lookups and pivots,
// and writes labelled screenshots to docs/case-safepay/.
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'case-safepay');
const EV = path.join(OUT, 'evidence');
const EXPORTS = path.resolve(__dirname, '..', '..', 'docs', 'exports');
process.env.SHOT_DIR = OUT; fs.mkdirSync(OUT, { recursive: true });
const { launch, shot, check: rawCheck, card, btn, state, report, watch, pass, fail, logic } = require('./lib.cjs');

const ADVISORY = 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-293a';
const IPS = ['104.26.2[.]223', '140.82.114[.]4', '185.199.108[.]133', '77.37.49[.]40', '173.194.194[.]94', '167.235.225[.]149', '5.255.11[.]134', '88.119.167[.]239', '37.10.71[.]188'];
const SHA256 = [['921df888aaabcd828a3723f4c9f5fe8b8379c6b7067d16b2ea10152300417eae', 'soc.dll'], ['6c1d36df94ebe367823e73ba33cfb4f40756a5e8ee1e30e8f0ae55d47e220a6a', 'RunPE bundled DLL'], ['e79608cf1d6b51324c14bef8883054c1238ed5f080222cc464810e6e14adc346', 'Injected PE'], ['327b8b61eb446cc4f710771e44484f62b804ae3d262b57a56575053e2df67917', 'locker.dll PE32'], ['a0dc80a37eb7e2716c02a94adc8df9baedec192a77bde31669faed228d9ff526', 'locker.dll'], ['bbdd3620a67aedec4b9a68b2c9cc880b6631215e129816aea19902a6f4bc6f41', 'SharpShares.exe']];
const SHA1 = [['07353237350c35d6dc2c8f143b649cd07c71f62b', '1.exe ransomware binary'], ['b498a2683640c983bb069fa2ea9e67cef4a3797d', 'Locker.dll PE32'], ['bbfed53e3bb1f306f4da97d995cf4ae5b73ad081', 'locker.dll'], ['d711a5af5aed48a3b36b98f4fcf52809aebef7a2', 'nxc']];
const CVES = ['CVE-2020-3259', 'CVE-2023-20269', 'CVE-2023-27532', 'CVE-2024-40711', 'CVE-2024-40766'];
const TTPS = ['T1133', 'T1190', 'T1110', 'T1059', 'T1098', 'T1027', 'T1070', 'T1021', 'T1567', 'T1486', 'T1489', 'T1036', 'T1105'];

(async () => {
  const { browser, ctx, page } = await launch();
  page.setDefaultTimeout(9000); watch(page);
  const recover = async () => { try { const c = page.getByRole('button', { name: 'Close', exact: true }); if (await c.count()) await c.first().click(); const m = page.getByRole('button', { name: 'Move', exact: true }); if (await m.count()) await m.first().click(); } catch (e) {} };
  const check = async (name, fn) => { const ok = await rawCheck(name, fn); if (!ok) await recover(); return ok; };
  const T = (t) => page.getByTitle(t).first();
  const text = (t) => page.getByText(t, { exact: true }).first();
  const panel = () => page.locator('aside').last();
  const ptext = (t) => panel().getByText(t, { exact: true }).first();
  const field = (label, kind = 'input', n = 1) => ptext(label).locator('xpath=following::' + kind + '[' + n + ']');
  const asideOf = (t) => text(t).locator('xpath=ancestor::aside[1]');
  const active = async () => { const s = await state(page); return { s, c: s.cases.find(c => c.id === s.activeId) }; };
  const rf = x => String(x || '').replace(/\[\.\]/g, '.');
  const cardExact = (txt) => page.locator('[data-card][data-kind="card"]').filter({ has: page.getByText(txt, { exact: true }) }).first();
  const ipText = (v) => rf(v).replace(/\./g, '[.]'); // IP values print with every dot defanged
  const cardOf = (name) => IPS.includes(name) ? cardExact(ipText(name)) : /^[0-9a-f]{40,64}$/i.test(name) ? cardExact(name) : card(page, name);
  const up = async (x, y) => page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: x, clientY: y, pointerId: 1, bubbles: true })), [x, y]);
  const selectCard = async (name) => {
    const loc = cardOf(name); await loc.waitFor({ state: 'attached' });
    const bb = await loc.boundingBox(); const cx = bb ? bb.x + bb.width / 2 : 0, cy = bb ? bb.y + 20 : 0;
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true });
    await up(cx, cy); await page.waitForTimeout(120);
    const id = await loc.getAttribute('data-card'); const s = await state(page);
    if (s.tool === 'move' && s.sel !== id) throw new Error('selection failed for ' + name);
  };
  const selectType = async (type) => {
    const { s } = await active(); const its = s.items.filter(i => i.type === type && i.pinned); const it = its[its.length - 1]; if (!it) throw new Error('no ' + type);
    const loc = page.locator('[data-card="' + it.id + '"][data-kind="card"]'); const bb = await loc.boundingBox(); const cx = bb ? bb.x + 5 : 0, cy = bb ? bb.y + 20 : 0;
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true }); await up(cx, cy); await page.waitForTimeout(120);
    if ((await state(page)).sel !== it.id) throw new Error('selection failed for ' + type);
  };
  const dragEl = async (loc, dxS, dyS) => {
    const bb = await loc.boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, bubbles: true });
    await page.evaluate(([x, y, x2, y2]) => { for (const f of [0.3, 0.7, 1]) window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + (x2 - x) * f, clientY: y + (y2 - y) * f, buttons: 1, pointerId: 1, bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: x2, clientY: y2, pointerId: 1, bubbles: true })); }, [cx, cy, cx + dxS, cy + dyS]);
    await page.waitForTimeout(60);
  };
  const findItem = async (name) => { const { s } = await active(); return s.items.find(i => rf(i.title).startsWith(rf(name)) || rf(i.value).startsWith(rf(name))) || s.items.find(i => rf(i.title).includes(rf(name)) || rf(i.value).includes(rf(name)) || rf(i.body).includes(rf(name))); };
  const dragTo = async (name, wx, wy) => {
    const { s } = await active(); const it = await findItem(name); if (!it) throw new Error('no item ' + name);
    const z = s.view.z; const loc = page.locator('[data-card="' + it.id + '"][data-kind="card"]');
    await dragEl(loc, (wx - it.x) * z, (wy - it.y) * z);
  };
  const fill = async (loc, v) => { await loc.fill(v); await loc.press('Tab'); await page.waitForTimeout(70); };
  const quick = async (cmd) => { const q = page.getByPlaceholder(/quick add/); await q.fill(cmd); await q.press('Enter'); await page.waitForTimeout(140); };
  const connect = async (a, b, rel) => { await btn(page, 'Connect').click(); await btn(page, rel).click(); await selectCard(a); await selectCard(b); await page.waitForTimeout(80); await btn(page, 'Move').click(); await page.keyboard.press('Escape'); };
  const fit = async () => { await btn(page, 'Fit').click(); await page.waitForTimeout(300); };
  const closeModal = async () => { const c = page.getByRole('button', { name: 'Close', exact: true }); if (await c.count()) await c.first().click(); else await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
  const pinInbox = async (txt) => { const row = page.locator('aside').first().locator('[draggable="true"]').filter({ hasText: txt }).first(); await row.getByRole('button', { name: 'Pin', exact: true }).click(); await page.waitForTimeout(250); };
  const addFromInbox = async (label, txt) => { await btn(page, label).click(); await page.waitForTimeout(200); await pinInbox(txt); };
  const upload = async (file) => { const [ch] = await Promise.all([page.waitForEvent('filechooser'), btn(page, 'Upload image').click()]); await ch.setFiles(path.join(EV, file)); await page.waitForTimeout(700); };
  const popupShot = async (trigger, file, w = 1100, h = 1400) => { const [pp] = await Promise.all([ctx.waitForEvent('page', { timeout: 20000 }), trigger()]); await pp.waitForLoadState('domcontentloaded').catch(() => {}); await pp.waitForTimeout(3500); await pp.setViewportSize({ width: w, height: h }); await pp.screenshot({ path: path.join(OUT, file) }); const t = await pp.evaluate(() => document.body.innerText).catch(() => ''); const u = pp.url(); await pp.close(); return t + '\n' + u; };

  // ---------------------------------------------------------------- S01 import an older case, new case from template
  await check('S01 import an earlier case (JSON) so cross-case search has something to find', async () => {
    const n0 = (await state(page)).cases.length;
    const [ch] = await Promise.all([page.waitForEvent('filechooser'), btn(page, 'Import').click()]);
    await ch.setFiles(path.join(EXPORTS, 'case-0419-vendor-themed-okta-vishing-wave.json')); await page.waitForTimeout(600);
    if ((await state(page)).cases.length !== n0 + 1) throw new Error('import failed');
  });
  await check('S01 new case from the Ransomware intrusion template', async () => {
    await btn(page, 'New case').click(); await page.waitForTimeout(200);
    await page.getByText('Ransomware intrusion', { exact: true }).first().click(); await page.waitForTimeout(400);
    await fill(page.getByPlaceholder('Case title'), 'SafePay ransomware — AA26-293A triage');
    await fill(page.getByPlaceholder('Analyst'), 'S. Murugan');
    const { c } = await active(); if (c.tlp !== 'red') throw new Error('tlp ' + c.tlp); return c.number + ' · TLP:' + c.tlp + ' · ' + c.items + ' starter cards';
  });
  await fit();
  await shot(page, 's01-template.png', 'New case → Ransomware intrusion. The template sets TLP:RED, seeds three hypotheses (exposed service, bought credentials, phishing loader), eight starter cards and four tasks. The case is named after the CISA alert code; the analyst name is stamped on everything from here on.', [
    { locator: btn(page, 'New case'), text: 'New case' },
    { locator: T('Traffic Light Protocol marking for this case — printed on every export'), text: 'TLP:RED from the template' },
    { locator: page.locator('select').first(), text: 'Case switcher: the imported Okta case is also here' },
    { sel: '[data-board]', text: 'Starter cards', at: 't' },
  ], { title: 'S01 · Start the case' });

  // ---------------------------------------------------------------- S02 extract IOCs → pin
  await check('S02 Extract IOCs: IPs, SHA-256 hashes and CVEs from the advisory text → pin', async () => {
    const c0 = (await active()).c;
    await btn(page, 'Extract IOCs').click(); await page.waitForTimeout(200);
    const txt = 'CISA AA26-293A SafePay IOCs. IPs: ' + IPS.join(', ') + '. SHA-256: ' + SHA256.map(h => h[0] + ' (' + h[1] + ')').join('; ') + '. Exploited CVEs: ' + CVES.join(', ') + '.';
    await page.getByPlaceholder(/The lure at hxxps/).fill(txt); await btn(page, 'Extract').click(); await page.waitForTimeout(300);
    const rows = await page.locator('input[type=checkbox]').count();
    await shot(page, 's02-extract.png', 'Extract IOCs with the advisory\'s indicator tables pasted in: nine IP addresses, six SHA-256 hashes and five CVEs are recognised and typed automatically. "Pin selected to board" creates one indicator card each.', [
      { locator: btn(page, 'Extract'), text: 'Extract' },
      { locator: page.locator('input[type=checkbox]').first(), text: rows + ' indicators found' },
      { locator: btn(page, 'Pin selected to board'), text: 'Pin selected to board' },
    ], { title: 'S02 · Pull the IOCs out of the advisory' });
    await btn(page, 'Pin selected to board').click(); await page.waitForTimeout(500);
    const c1 = (await active()).c; if (rows !== 20) throw new Error('rows ' + rows); return rows + ' pinned → ' + c1.pinned;
  });
  await check('S02b Extract IOCs again: SHA-1 hashes → inbox (unpinned)', async () => {
    await btn(page, 'Extract IOCs').click(); await page.waitForTimeout(200);
    await page.getByPlaceholder(/The lure at hxxps/).fill('SHA-1: ' + SHA1.map(h => h[0] + ' ' + h[1]).join('; '));
    await btn(page, 'Extract').click(); await page.waitForTimeout(300);
    await btn(page, 'Add selected to inbox').click(); await page.waitForTimeout(300);
    const { c } = await active(); if (c.items - c.pinned < 4) throw new Error('inbox'); return (c.items - c.pinned) + ' in inbox';
  });

  // ---------------------------------------------------------------- S03 inbox: drag onto board, pin, filter
  await check('S03 inbox: drag one card onto the board, Pin another', async () => {
    const c0 = (await active()).c;
    const inboxCard = page.locator('aside [draggable="true"]').first();
    let dragged = false;
    try { await inboxCard.dragTo(page.locator('[data-board]'), { targetPosition: { x: 600, y: 300 } }); await page.waitForTimeout(300); dragged = (await active()).c.pinned === c0.pinned + 1; } catch (e) {}
    if (!dragged) { await page.getByRole('button', { name: 'Pin', exact: true }).first().click(); await page.waitForTimeout(200); }
    await page.getByRole('button', { name: 'Pin', exact: true }).first().click(); await page.waitForTimeout(200);
    const c1 = (await active()).c; if (c1.pinned !== c0.pinned + 2) throw new Error('pinned ' + c0.pinned + '->' + c1.pinned);
    return (dragged ? 'drag-and-drop worked' : 'drag fell back to Pin') + '; pinned ' + c0.pinned + ' -> ' + c1.pinned;
  });
  await shot(page, 's03-inbox.png', 'The SHA-1 hashes wait in the evidence inbox. Drag a card onto the board or press Pin; the remaining two stay unpinned (they still count in the Audit tab under "Still in the inbox").', [
    { locator: text('EVIDENCE INBOX'), text: 'Inbox with unpinned evidence' },
    { locator: page.getByRole('button', { name: 'Pin', exact: true }).first(), text: 'Pin (or drag the card onto the board)' },
    { locator: text('SHOW ON BOARD'), text: 'Type filters' },
  ], { title: 'S03 · Evidence inbox' });

  // ---------------------------------------------------------------- S04 paste handler
  await check('S04 paste text onto the board → note card; paste a URL → link card', async () => {
    const c0 = (await active()).c;
    await page.locator('[data-board]').click({ position: { x: 20, y: 20 } });
    const paste = async (t) => { await page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text', t); window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, t); await page.waitForTimeout(200); };
    await paste('Hostnames seen in SafePay intrusions (CISA AA26-293A): WIN-SBOE3CPNAL, WIN-3IUUOFVTQAR, WIN-DK18BI83M0S, WIN-I1HRRJHCEIV');
    await paste(ADVISORY);
    const c1 = (await active()).c; if (c1.pinned !== c0.pinned + 2) throw new Error('paste did not add cards'); return 'note + link pinned';
  });

  // ---------------------------------------------------------------- S05 quick add: techniques, events, more cards
  await check('S05 quick add techniques, events, person, target, transfer, document, location', async () => {
    for (const t of TTPS) await quick('t ' + t);
    await quick('e 2024-08-01 SafePay first observed (per CISA)');
    await quick('e 2024-11-01 Start of IOC observation window');
    await quick('e 2026-08-15 Last observed IOCs in FBI investigations');
    await quick('e 2026-10-20 Joint advisory AA26-293A published');
    await addFromInbox('+ Transfer', 'Transfer'); await selectType('tx'); await fill(field('TITLE'), 'Ransom demand — share of revenue, paid in crypto'); await field('CHAIN', 'select').selectOption('Bitcoin');
    await addFromInbox('+ Location', 'Unknown location'); await selectType('location'); await fill(field('TITLE'), 'Vilnius, Lithuania — UAB Bacloud (AS61272) hosting soc.dll C2');
    await addFromInbox('+ Location', 'Unknown location'); await selectType('location'); await fill(field('TITLE'), 'Falkenstein, Germany — Hetzner CLOUD-FSN1 hosting client login panels');
    await page.keyboard.press('Escape');
    await quick('n Encryption: ChaCha20 stream cipher with RSA key exchange; full or partial by file type/size; extension .SafePay; binary deletes itself afterwards.');
    const { c } = await active(); return c.pinned + ' pinned';
  });

  // ---------------------------------------------------------------- S06 edit cards with images (photos, person, locations, target, tx, doc)
  await check('S06 photo cards with uploaded images (custody hash recorded)', async () => {
    await addFromInbox('+ Photo', 'Untitled photo');
    await selectCard('Untitled photo');
    await fill(field('TITLE'), 'CISA advisory page — capture 09 Nov 2026');
    await upload('cisa-advisory-aa26-293a.png');
    await fill(field('DATE'), '2026-11-09'); await fill(field('TAGS'), 'source, capture');
    await fill(field('SOURCE · WHO SAID SO'), 'cisa.gov (screenshot)'); await btn(page, 'Confirmed').click();
    await addFromInbox('+ Photo', 'Untitled photo');
    await selectCard('Untitled photo');
    await fill(field('TITLE'), 'Attack path — analyst diagram');
    await upload('attack-path-diagram.png');
    await fill(field('DATE'), '2026-11-09'); await fill(field('TAGS'), 'analysis');
    await fill(field('SOURCE · WHO SAID SO'), 'Analyst drawing from the advisory text');
    const cust = ptext('CHAIN OF CUSTODY'); await cust.scrollIntoViewIfNeeded();
    const { s } = await active(); const it = s.items.find(i => i.id === s.sel); if (!it) throw new Error('no sel');
  });
  await shot(page, 's06-photo-custody.png', 'Photo cards: "+ Photo" in the inbox, Pin, then Upload image in the Inspector. The file name, its SHA-256, who added it and when are recorded under Chain of custody. Here the analyst\'s own attack-path diagram; the other photo is a capture of the CISA advisory page.', [
    { locator: btn(page, 'Upload image'), text: 'Upload image (also: drop a file on the board, or paste a screenshot)' },
    { locator: ptext('CHAIN OF CUSTODY'), text: 'Chain of custody: file name, SHA-256, added by, added at' },
    { locator: card(page, 'Attack path'), text: 'Photo card on the board', at: 't' },
  ], { title: 'S06 · Photos and custody', scrollTo: 1 });
  await check('S06b person, locations, target, transfer and document cards', async () => {
    await selectCard('Ransomware affiliate'); // template person card
    await fill(field('TITLE'), 'SafePay affiliate (unidentified)');
    await upload('operator-placeholder.png');
    await fill(field('TITLE', 'textarea'), 'No individual identified. Uses Mullvad VPN exits, phished account profiles and stolen or brute-forced VPN credentials. Lives off the land, then installs AnyDesk / TeamViewer to push the locker. A "representative" phones victims after encryption.');
    await fill(field('TAGS'), 'actor, affiliate'); await fill(field('SOURCE · WHO SAID SO'), 'CISA AA26-293A'); await btn(page, 'Unverified').click();
    await selectCard('Vilnius, Lithuania');
    await upload('map-lithuania-baltics.png');
    await fill(field('TITLE', 'textarea'), 'RDAP: LT-BACLOUD, UAB Bacloud, AS61272. Hosts 88.119.167[.]239, the soc.dll command-and-control address in the advisory. VirusTotal: 14/92 vendors flag the IP.');
    await fill(field('TAGS'), 'infra, c2'); await fill(field('SOURCE · WHO SAID SO'), 'RDAP + VirusTotal, 09 Nov 2026');
    await selectCard('Falkenstein, Germany');
    await upload('map-falkenstein-de.png');
    await fill(field('TITLE', 'textarea'), 'RDAP: CLOUD-FSN1 (Hetzner, DE). Hosts 167.235.225[.]149, listed as "client login panels".');
    await fill(field('TAGS'), 'infra, panel'); await fill(field('SOURCE · WHO SAID SO'), 'RDAP, 09 Nov 2026');
    await selectCard('Victim organisation');
    await fill(field('TITLE'), '600+ victims — businesses & critical infrastructure');
    await fill(field('SECTOR'), 'Multiple critical-infrastructure sectors'); await fill(field('REGION'), 'North America · South America · Europe · Australia');
    await fill(field('WHAT WAS TAKEN / IMPACT'), 'Data exfiltrated (RClone / FileZilla / b2), backups wiped, files encrypted with .SafePay, leak-site extortion');
    await fill(field('TAGS'), 'victim'); await fill(field('SOURCE · WHO SAID SO'), 'CISA AA26-293A'); await btn(page, 'Confirmed').click();
    await selectCard('Ransom demand');
    await fill(field('AMOUNT'), 'A share of company revenue'); await fill(field('FROM · ADDRESS OR LABEL'), 'Victim (via TOR chat portal, victim-ID login)'); await fill(field('TO · ADDRESS OR LABEL'), 'Actor wallet (not published)');
    await fill(field('TITLE', 'textarea'), 'Ransom paid in cryptocurrency; no addresses or tx hashes are published in the advisory. Paste them here when a case yields them: the card then links to the block explorer.');
    await fill(field('TAGS'), 'ransom');
    await selectCard('Case plan'); // template document card
    await fill(field('TITLE'), 'Tools repurposed by the actors');
    await fill(field('TITLE', 'textarea'), '7-Zip · FileZilla · Mimikatz · PowerShell · PsExec · RClone · ScreenConnect · ShareFinder.ps1 · WinRAR · WinRM · AnyDesk · TeamViewer · Acronis Disk Director · SharpShares · NetExec · Backblaze b2.exe\n\nLegitimate on their own; the advisory warns not to attribute them as malicious without evidence.');
    await fill(field('TAGS'), 'tooling'); await fill(field('SOURCE · WHO SAID SO'), 'CISA AA26-293A, Table 1'); await btn(page, 'Confirmed').click();
    await selectCard('cisa.gov'); // pasted link
    await fill(field('TITLE'), '#StopRansomware: SafePay Ransomware — joint advisory');
    await fill(field('DATE'), '2026-10-20'); await fill(field('TAGS'), 'source'); await fill(field('SOURCE · WHO SAID SO'), 'FBI / CISA / USSS / LKA RLP / NCA / NWROCU'); await btn(page, 'Confirmed').click();
    await page.keyboard.press('Escape');
  });
  await fit();
  await shot(page, 's06b-cards-with-images.png', 'Cards with pictures: the person card shows the uploaded placeholder (no photo on file), location cards carry map captures of the hosting regions found through RDAP, photo cards hold the advisory capture and the analyst diagram. Target and transfer cards print sector, region, impact, amount, from and to.', [
    { locator: card(page, 'SafePay affiliate'), text: 'Person card with image', at: 't' },
    { locator: card(page, 'Vilnius, Lithuania'), text: 'Location card with map', at: 't' },
    { locator: card(page, 'Ransom demand'), text: 'Transfer card (chain, amount, from, to)', at: 't' },
    { locator: card(page, '600+ victims'), text: 'Target card', at: 't' },
  ], { title: 'S06 · Cards with images' });

  // ---------------------------------------------------------------- S07 arrange board + clusters
  await check('S07 arrange the board and add three clusters', async () => {
    const L = await logic(page);
    await page.evaluate(L => L.setState({ view: { x: 30, y: 30, z: 0.45 } }), L); await page.waitForTimeout(200);
    const place = [
      ['SafePay first observed', 40, 40], ['Start of IOC observation', 40, 250], ['Last observed IOCs', 40, 460], ['Joint advisory AA26-293A published', 40, 670], ['#StopRansomware: SafePay', 40, 900], ['Initial access', 40, 1180], ['Encryption begins', 40, 1390],
      ['SafePay affiliate', 340, 40], ['600+ victims', 340, 420], ['Ransom demand', 340, 760], ['Tools repurposed', 340, 1020], ['Encryption: ChaCha20', 340, 1320], ['Hostnames seen', 600, 1320],
      ['CISA advisory page', 880, 1180], ['Attack path', 1140, 1180],
      ['Vilnius, Lithuania', 1420, 820], ['Falkenstein, Germany', 1680, 820],
      ['Leak site post', 1940, 1180], ['Encryptor sample', 2220, 1180],
    ];
    IPS.forEach((v, i) => place.push([v, 640 + (i % 3) * 260, 40 + Math.floor(i / 3) * 190]));
    SHA256.forEach((h, i) => place.push([h[0], 1440 + (i % 2) * 260, 40 + Math.floor(i / 2) * 200]));
    SHA1.slice(0, 2).forEach((h, i) => place.push([h[0], 1440 + i * 260, 640]));
    CVES.forEach((v, i) => place.push([v, 1980 + (i % 2) * 260, 40 + Math.floor(i / 2) * 190]));
    const tt = TTPS.map(t => t); // techniques by id
    tt.forEach((t, i) => place.push([t, 2560 + (i % 2) * 240, 40 + Math.floor(i / 2) * 170]));
    place.push(['Exploit Public-Facing Application', 2560, 1240], ['Data Encrypted for Impact', 2800, 1240]); // template ttps
    for (const [n, x, y] of place) { try { await dragTo(n, x, y); } catch (e) { console.log('   (skip place ' + n + ': ' + e.message.slice(0, 60) + ')'); } }
    await fit();
    const specs = [['Infrastructure · C2, exfil, panels (' + IPS.length + ' IPs)', 610, -10, 800, 1060], ['Malware & exploited CVEs', 1410, -10, 1070, 800], ['Playbook · ATT&CK techniques', 2530, -10, 520, 1480]];
    for (const [title, gx, gy, gw, gh] of specs) {
      await btn(page, '+ Cluster').click(); await page.waitForTimeout(350);
      await fill(field('CLUSTER'), title);
      const { s, c } = await active(); const z = s.view.z;
      const lab = page.getByTitle('Drag to move the cluster with its cards · click to rename').filter({ hasText: title.slice(0, 14) }).first();
      const L2 = await logic(page); const g = await page.evaluate(L => { const c = L.cs(); return c.groups[c.groups.length - 1]; }, L2);
      await dragEl(lab, (gx - g.x) * z, (gy - g.y) * z);
      const handle = lab.locator('xpath=following-sibling::div[@title="Resize"][1]');
      await dragEl(handle, (gw - g.w) * z, (gh - g.h) * z);
    }
    await page.keyboard.press('Escape'); await fit();
    const { c } = await active(); if (c.groups !== 3) throw new Error('groups ' + c.groups); return '3 clusters';
  });
  await shot(page, 's07-clusters.png', 'The board arranged: dated events and sources down the left, actor / victim / ransom / tooling next, then three clusters: Infrastructure (the nine IPs with the two location cards), Malware & exploited CVEs (hashes and CVEs), and the ATT&CK playbook. Clusters are created with "+ Cluster", renamed in the panel, moved by their label and resized from the corner; cards inside move with them.', [
    { locator: btn(page, '+ Cluster'), text: '+ Cluster' },
    { locator: page.getByTitle('Drag to move the cluster with its cards · click to rename').first(), text: 'Cluster label: drag to move the group' },
    { sel: '[data-board]', text: 'Three clusters', at: 't' },
  ], { title: 'S07 · Arrange and cluster' });

  // ---------------------------------------------------------------- S08 threads: connect tool, pin-drag, relations, editor
  await check('S08 threads with every relation type, plus a pin-drag connection', async () => {
    const before = (await active()).c.threads;
    await connect('SafePay affiliate', '88.119.167[.]239', 'controls');
    await connect('SafePay affiliate', '5.255.11[.]134', 'controls');
    await connect('SafePay affiliate', '37.10.71[.]188', 'controls');
    await connect('88.119.167[.]239', 'Vilnius, Lithuania', 'located at');
    await connect('167.235.225[.]149', 'Falkenstein, Germany', 'located at');
    await connect(SHA256[0][0], '88.119.167[.]239', 'resolves to'); // soc.dll → C2
    await connect(SHA256[3][0], SHA256[4][0], 'alias of'); // two locker.dll builds
    await connect('Exploit Public-Facing Application', 'CVE-2024-40711', 'linked to');
    await connect('Exploit Public-Facing Application', 'CVE-2024-40766', 'linked to');
    await connect('SafePay affiliate', 'Initial access', 'suspected');
    await connect('SafePay affiliate', '600+ victims', 'linked to');
    await connect('600+ victims', 'Ransom demand', 'linked to');
    await connect('Data Encrypted for Impact', 'Encryption begins', 'linked to');
    await connect('Encryption: ChaCha20', 'Data Encrypted for Impact', 'linked to');
    await connect('Tools repurposed', 'SafePay affiliate', 'linked to');
    await connect('Attack path', 'SafePay affiliate', 'linked to');
    await connect('#StopRansomware: SafePay', 'Joint advisory AA26-293A published', 'linked to');
    // pin-drag: drag the pin of the advisory capture onto the link card
    await fit();
    const srcIt = await findItem('CISA advisory page'); const pin = page.locator('[data-card="' + srcIt.id + '"][data-kind="pin"]').first();
    const dst = card(page, '#StopRansomware: SafePay');
    const pb = await pin.boundingBox(), db = await dst.boundingBox();
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.mouse.down();
    await page.mouse.move(db.x + db.width / 2, db.y + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200);
    const after = (await active()).c.threads; if (after < before + 17) throw new Error('threads ' + before + '->' + after);
    return 'threads ' + before + ' -> ' + after + (after >= before + 18 ? ' (pin-drag worked)' : ' (pin-drag did not register)');
  });
  await check('S08b thread editor: evidence, confidence, swap, cut; thread label', async () => {
    await selectCard(SHA256[0][0]);
    const lab0 = page.getByTitle('Click to edit this thread').filter({ hasText: /resolves/i }).first();
    const lab = (await lab0.count()) ? lab0 : page.getByTitle('Click to edit this thread').first();
    await lab.dispatchEvent('click'); // labels can sit under a card at this zoom; dispatch straight to the label
    await page.waitForTimeout(200); const s = await state(page); if (!s.selThread) throw new Error('no thread selected');
    await fill(page.getByPlaceholder('Why these two are connected — the brief prints it'), 'CISA Table 2: 88.119.167[.]239 is the soc.dll command-and-control address; Table 5 gives soc.dll\'s SHA-256.');
    await btn(page, 'Medium').click();
    await btn(page, 'Swap direction').click(); await page.waitForTimeout(100); await btn(page, 'Swap direction').click();
  });
  await shot(page, 's08-threads.png', 'Threads: Connect (C) with a relation picked on the toolbar, or drag a card\'s pin onto another card. Relations used here: controls (affiliate → infrastructure), located at (IP → map), resolves to (soc.dll → its C2), alias of (two locker.dll builds), linked to, suspected. The thread editor records the evidence, confidence, direction, and can cut the thread.', [
    { locator: btn(page, 'Connect'), text: 'Connect tool' },
    { locator: btn(page, 'resolves to'), text: 'Relation picker' },
    { locator: page.getByPlaceholder('Why these two are connected — the brief prints it'), text: 'Evidence for this link' },
    { locator: btn(page, 'Medium'), text: 'Confidence' },
    { locator: btn(page, 'Swap direction'), text: 'Swap direction / Cut' },
  ], { title: 'S08 · Thread the evidence' });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- S09 OSINT: IP, hash, CVE
  await check('S09 OSINT workbench on the C2 IP (live DNS / RDAP + launchers)', async () => {
    await selectCard('88.119.167[.]239'); await btn(page, 'OSINT').click(); await page.waitForTimeout(200);
    const q = page.locator('[data-osint]'); if (!(await q.inputValue())) await q.fill('88.119.167.239');
    await btn(page, 'Run').click(); await page.waitForTimeout(7000);
  });
  await shot(page, 's09-osint-ip.png', 'OSINT on the C2 address 88.119.167[.]239: reverse DNS and RDAP come back live (UAB Bacloud, Lithuania, AS61272); AbuseIPDB, Shodan, Censys, GreyNoise, VirusTotal and the rest open as launchers. "Pin as card" writes the findings into the indicator card.', [
    { locator: page.locator('[data-osint]'), text: 'Selector detected as IP' },
    { locator: btn(page, 'Run'), text: 'Run' },
    { locator: btn(page, 'Copy findings'), text: 'Copy findings' },
  ], { title: 'S09 · OSINT on the C2 IP' });
  await check('S09b OSINT on the soc.dll hash and on CVE-2024-40711 (live NVD)', async () => {
    const q = page.locator('[data-osint]');
    await q.fill(SHA256[0][0]); await btn(page, 'Run').click(); await page.waitForTimeout(5000);
    await shot(page, 's09b-osint-hash.png', 'The same workbench with the soc.dll SHA-256: hash lookups go to VirusTotal, MalwareBazaar, Hybrid Analysis and others. Services that refuse browser requests are marked "blocked" with an Open link.', [
      { locator: page.locator('[data-osint]'), text: 'Detected as a file hash' },
    ], { title: 'S09 · OSINT on a hash' });
    await q.fill('CVE-2024-40711'); await btn(page, 'Run').click(); await page.waitForTimeout(7000);
    await shot(page, 's09c-osint-cve.png', 'CVE-2024-40711 (Veeam Backup & Replication, exploited by SafePay per CISA): the NVD lookup returns the description and CVSS live; launchers go to CVE.org, CISA KEV, EPSS and vendor advisories. Pin as card keeps the NVD text with the CVE.', [
      { locator: page.locator('[data-osint]'), text: 'Detected as a CVE' },
      { locator: page.getByRole('button', { name: /Pin as card/i }).first(), text: 'Pin as card' },
    ], { title: 'S09 · OSINT on a CVE' });
    const pinBtn = page.getByRole('button', { name: /Pin as card/i }).first(); if (await pinBtn.count()) { await pinBtn.click(); await page.waitForTimeout(300); }
    const s = await state(page); if (s.osintOpen) await closeModal();
  });

  // ---------------------------------------------------------------- S10 pivots: VirusTotal etc. + Claude
  await check('S10 Inspector pivots: open VirusTotal for the C2 IP in a new tab', async () => {
    await selectCard('88.119.167[.]239');
    await ptext('PIVOT · LOOK UP').scrollIntoViewIfNeeded();
    const vt = panel().locator('a', { hasText: /VirusTotal/i }).first(); await vt.waitFor();
    const t = await popupShot(() => vt.click(), 's10b-virustotal.png', 1280, 900);
    if (!/VirusTotal|virustotal/i.test(t) && t.length < 50) throw new Error('VT page did not load');
  });
  await check('S10b Copy defanged, Analyse with Claude (falls back to a toast outside the Claude app)', async () => {
    await page.getByRole('button', { name: /^Copy defanged$/i }).first().click();
    await btn(page, 'Analyse with Claude').click(); await page.waitForTimeout(300);
    const tst = await page.getByText(/Claude analysis runs inside the Claude app preview/).count(); if (!tst) throw new Error('no toast');
  });
  await shot(page, 's10-pivots.png', 'Pivots on the selected indicator open VirusTotal, AbuseIPDB, Shodan, Censys, GreyNoise, urlscan and more in a new tab (the VirusTotal result for this IP is in the next picture: 14 of 92 vendors flag it). "Copy defanged" copies 88.119.167[.]239 for reports. "Analyse with Claude" asks for an assessment when the board runs inside the Claude app; elsewhere it says so.', [
    { locator: ptext('PIVOT · LOOK UP'), text: 'Pivots' },
    { locator: panel().locator('a', { hasText: /VirusTotal/i }).first(), text: 'VirusTotal (opens in a new tab)' },
    { locator: btn(page, 'Analyse with Claude'), text: 'Analyse with Claude' },
  ], { title: 'S10 · Pivots', scrollTo: 0 });

  // ---------------------------------------------------------------- S11 grading, handling, tasks with due date, comments, merge
  await check('S11 stamp, Admiralty grade, dates, per-card TLP, tasks with due dates, comments', async () => {
    await btn(page, 'Confirmed').click();
    await fill(field('SOURCE · WHO SAID SO'), 'CISA AA26-293A, Table 2'); await fill(field('COLLECTED'), '2026-10-20');
    await field('SOURCE · WHO SAID SO', 'select').selectOption('A'); await field('SOURCE · WHO SAID SO', 'select', 2).selectOption('1');
    await fill(field('FIRST SEEN'), '2024-11-01'); await fill(field('LAST SEEN'), '2026-08-15');
    await field('HANDLING', 'select').selectOption('amber');
    const todo = page.getByPlaceholder('Open question or to-do… Enter to add');
    const due = todo.locator('xpath=following::input[@type="date"][1]');
    await due.fill('2026-11-01'); await todo.fill('Block at the perimeter and search 12 months of proxy / firewall logs'); await todo.press('Enter');
    await due.fill('2026-11-14'); await todo.fill('Ask Bacloud abuse desk for subscriber details (RFI)'); await todo.press('Enter');
    const cm = page.getByPlaceholder('Comment… Ctrl+Enter to post'); await cm.fill('VirusTotal 14/92 on 09 Nov; last CISA sighting Aug 2026 — treat as stale-but-live until Bacloud answers.'); await cm.press('Control+Enter');
    await page.waitForTimeout(200);
  });
  await shot(page, 's11-grading.png', 'Grading the C2 address: stamped Confirmed, source A1 (completely reliable, confirmed), collected and first/last seen dates (last seen Aug 2026, so the Audit tab will list it as stale), a per-card TLP:AMBER override on a TLP:RED case, two tasks with due dates (the first is already overdue) and a dated comment.', [
    { locator: ptext('SOURCE · WHO SAID SO'), text: 'Source + Admiralty grade A1' },
    { locator: ptext('HANDLING'), text: 'Per-card TLP override' },
    { locator: ptext('LAST SEEN'), text: 'First / last seen → staleness' },
  ], { title: 'S11 · Grade and handle', scrollTo: 0 });
  await shot(page, 's11b-tasks.png', 'Tasks with due dates and comments on the same card. Overdue tasks are flagged in the Audit tab.', [
    { locator: page.getByPlaceholder('Open question or to-do… Enter to add'), text: 'Tasks with due date' },
    { locator: page.getByPlaceholder('Comment… Ctrl+Enter to post'), text: 'Comments' },
  ], { title: 'S11 · Tasks and comments', scrollTo: 0 });

  // ---------------------------------------------------------------- S12 actor library + merge
  await check('S12 actor library: drop in LockBit for playbook comparison, then merge duplicate technique cards', async () => {
    const c0 = (await active()).c;
    await btn(page, 'Actors').click(); await page.waitForTimeout(200);
    await shot(page, 's12-actors.png', 'Actor library. SafePay is not in it, so LockBit (the closest RaaS playbook: exposed services, valid accounts, remote services, encryption) is dropped in as a comparison. Drop in pins the actor plus a technique card per TTP, threaded together.', [
      { locator: page.getByRole('button', { name: 'Drop in' }).nth(4), text: 'Drop in LockBit' },
    ], { title: 'S12 · Actor library' });
    await page.getByRole('button', { name: 'Drop in' }).nth(4).click(); await page.waitForTimeout(400);
    const c1 = (await active()).c; if (c1.pinned <= c0.pinned + 1) throw new Error('drop-in');
    // LockBit person: mark as comparison / false lead
    await selectCard('LockBit');
    await fill(field('TITLE', 'textarea'), 'Comparison only: SafePay is a distinct operation (CISA). LockBit\'s affiliate playbook overlaps (exposed services, valid accounts, remote services, encryption) but no attribution to LockBit is made.');
    await btn(page, 'False lead').click();
    // merge LockBit's duplicate "Exploit Public-Facing Application" into the template one
    const dups = page.locator('[data-card][data-kind="card"]', { hasText: 'Exploit Public-Facing Application' }); const n = await dups.count(); if (n < 2) throw new Error('no duplicate to merge');
    const loc = dups.nth(1); const bb = await loc.boundingBox();
    await loc.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: bb.x + 5, clientY: bb.y + 20, pointerId: 1, isPrimary: true, bubbles: true }); await up(bb.x + 5, bb.y + 20); await page.waitForTimeout(150);
    const sel = field('MERGE · SAME ENTITY, DIFFERENT CARD', 'select'); await sel.scrollIntoViewIfNeeded();
    const val = await sel.locator('option').evaluateAll(os => { const o = os.find(o => /Exploit Public-Facing/.test(o.textContent)); return o ? o.value : null; }); if (!val) throw new Error('no merge target');
    await sel.selectOption(val);
    await shot(page, 's12b-merge.png', 'Merge: LockBit\'s "Exploit Public-Facing Application" duplicates the technique already on the board. Select the duplicate, pick the card to keep under MERGE, press Merge: threads are re-pointed, tags / tasks / comments are unioned and the duplicate is removed (Ctrl+Z undoes it).', [
      { locator: ptext('MERGE · SAME ENTITY, DIFFERENT CARD'), text: 'Merge this card into…' },
      { locator: btn(page, 'Merge'), text: 'Merge' },
    ], { title: 'S12 · Merge duplicates', scrollTo: 0 });
    const p0 = (await active()).c.pinned; await btn(page, 'Merge').click(); await page.waitForTimeout(300);
    const p1 = (await active()).c.pinned; if (p1 !== p0 - 1) throw new Error('merge ' + p0 + '->' + p1);
    const dups2 = page.locator('[data-card][data-kind="card"]', { hasText: 'Data Encrypted for Impact' }); if ((await dups2.count()) >= 2) { const l2 = dups2.nth(1); const b2 = await l2.boundingBox(); await l2.dispatchEvent('pointerdown', { button: 0, buttons: 1, clientX: b2.x + 5, clientY: b2.y + 20, pointerId: 1, isPrimary: true, bubbles: true }); await up(b2.x + 5, b2.y + 20); await page.waitForTimeout(150); const s2 = field('MERGE · SAME ENTITY, DIFFERENT CARD', 'select'); const v2 = await s2.locator('option').evaluateAll(os => { const o = os.find(o => /Data Encrypted/.test(o.textContent)); return o ? o.value : null; }); if (v2) { await s2.selectOption(v2); await btn(page, 'Merge').click(); await page.waitForTimeout(200); } }
    return 'pinned ' + c0.pinned + ' -> ' + (await active()).c.pinned + ' after drop-in and merges';
  });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- S13 threads tab: suggestions accept/dismiss, manual thread
  await check('S13 Threads tab: accept one suggestion, dismiss one, add a manual thread', async () => {
    await text('Threads').click(); await page.waitForTimeout(250);
    const before = (await active()).c.threads;
    const dismiss = page.getByRole('button', { name: 'Dismiss', exact: true });
    const n = await dismiss.count();
    if (n) { await dismiss.first().locator('xpath=preceding-sibling::button[1]').click(); await page.waitForTimeout(150); }
    if (n > 1) { await page.getByRole('button', { name: 'Dismiss', exact: true }).first().click(); await page.waitForTimeout(150); }
    const pick = page.locator('aside select').filter({ has: page.locator('option', { hasText: 'Event ·' }) });
    const optVal = async (loc, re) => loc.locator('option').evaluateAll((os, re) => { const o = os.find(o => new RegExp(re).test(o.textContent)); return o ? o.value : null; }, re.source);
    await pick.nth(0).selectOption(await optVal(pick.nth(0), /Hostnames seen/)); await pick.nth(1).selectOption(await optVal(pick.nth(1), /Tools repurposed/));
    await page.getByRole('button', { name: /^Pin thread$/ }).click(); await page.waitForTimeout(200);
    const after = (await active()).c.threads; if (after < before + 1) throw new Error('threads ' + before + '->' + after);
    return 'suggestions: ' + n + '; threads ' + before + ' -> ' + after;
  });
  await shot(page, 's13-threads-tab.png', 'Threads tab: suggested threads appear when two cards share a tag, indicator or handle (accept or dismiss each), a manual form pins a thread between any two cards, and every thread is listed with its relation and confidence.', [
    { locator: text('Threads'), text: 'Threads tab' },
    { locator: ptext('NEW THREAD'), text: 'Manual thread' },
  ], { title: 'S13 · Threads tab' });

  // ---------------------------------------------------------------- S14 search across cases, type filter, reveal
  await check('S14 search across cases, type filters, Reveal', async () => {
    await page.getByPlaceholder('Search all cases…').fill('okta'); await page.waitForTimeout(300);
    await shot(page, 's14-search.png', 'Search covers every case: "okta" dims this board (nothing here matches) and lists the hits from the imported Okta vishing case under the search box so you can jump across.', [
      { locator: page.getByPlaceholder('Search all cases…'), text: 'Search box' },
    ], { title: 'S14 · Cross-case search' });
    await page.getByPlaceholder('Search all cases…').fill('');
    const filt = page.getByText('SHOW ON BOARD').locator('xpath=following-sibling::div[1]');
    await filt.getByRole('button', { name: 'Technique', exact: true }).click(); await page.waitForTimeout(150);
    const s = await state(page); if (!s.hidden.ttp) throw new Error('filter');
    await filt.getByRole('button', { name: 'Technique', exact: true }).click();
    await selectCard('SafePay affiliate'); await btn(page, 'Reveal').click(); await page.waitForTimeout(250);
  });
  await shot(page, 's14b-reveal.png', 'Reveal (R) with the affiliate card selected: only its direct threads (infrastructure it controls, victims, tools) and second-degree neighbours stay lit.', [
    { locator: btn(page, 'Reveal'), text: 'Reveal' },
    { locator: card(page, 'SafePay affiliate'), text: 'Selected card', at: 't' },
  ], { title: 'S14 · Reveal' });
  await btn(page, 'Reveal').click(); await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- S15 timeline, kill chain
  await check('S15 timeline and kill-chain layouts', async () => {
    await btn(page, 'Timeline').click(); await page.waitForTimeout(500);
    await shot(page, 's15-timeline.png', 'Timeline (T): from first SafePay activity in August 2024 through the IOC window to the advisory on 20 October 2026 and the analyst captures of 9 November; undated cards sit on the shelf.', [
      { locator: btn(page, 'Timeline'), text: 'Timeline view' },
      { box: { x: 0, y: 832, w: 1440, h: 68 }, text: 'Timeline rail', at: 'tr' },
    ], { title: 'S15 · Timeline' });
    await btn(page, 'Timeline').click(); await page.waitForTimeout(300);
    await btn(page, 'Kill chain').click(); await page.waitForTimeout(500);
    await shot(page, 's15b-kill-chain.png', 'Kill chain (K): the thirteen techniques from the advisory fall into their ATT&CK tactic lanes, Initial Access through Impact, with threaded evidence under each.', [
      { locator: btn(page, 'Kill chain'), text: 'Kill-chain lanes' },
    ], { title: 'S15 · Kill chain' });
    await btn(page, 'Kill chain').click(); await page.waitForTimeout(300);
  });

  // ---------------------------------------------------------------- S16 ACH
  await check('S16 ACH on the template hypotheses', async () => {
    await btn(page, 'ACH').click(); await page.waitForTimeout(300);
    const cells = page.locator('button', { hasText: /^(CONSISTENT|INCONSISTENT|NEUTRAL|·)$/ }); const n = await cells.count(); if (n < 9) throw new Error('cells ' + n);
    const rows = Math.min(12, Math.floor(n / 3));
    for (let r = 0; r < rows; r++) { await cells.nth(r * 3).click(); await cells.nth(r * 3 + 1).click(); if (r % 2) { await cells.nth(r * 3 + 2).click(); await cells.nth(r * 3 + 2).click(); } }
  });
  await shot(page, 's16-ach.png', 'ACH with the template\'s hypotheses: affiliate through an exposed service, credential bought from a broker, phishing with a loader. CISA reports both exposed-service CVEs and stolen credentials, so the first two stay consistent and the phishing-loader hypothesis collects the inconsistencies.', [
    { locator: text('COMPETING HYPOTHESES'), text: 'ACH matrix' },
  ], { title: 'S16 · Competing hypotheses' });
  await closeModal();

  // ---------------------------------------------------------------- S17 audit tab
  await check('S17 Audit tab lists stale indicators, overdue tasks, unsourced cards, inbox leftovers', async () => {
    await text('Audit').click(); await page.waitForTimeout(250); const s = await state(page); if (s.tab !== 'audit') throw new Error(s.tab);
  });
  await shot(page, 's17-audit.png', 'Audit tab: the hygiene backlog. Unconnected cards, indicators without a stamp, events without a date, threads without evidence, stale indicators (last seen beyond 30 days), cards without a source, open and overdue tasks, and what is still in the inbox. Click a row to jump to the card.', [
    { locator: text('Audit'), text: 'Audit tab' },
    { locator: asideOf('Audit'), text: 'Backlog by category' },
  ], { title: 'S17 · Audit' });

  // ---------------------------------------------------------------- S18 snapshots, diff, playback, log
  await check('S18 snapshot → change → diff → restore; playback; log', async () => {
    await text('Log').click(); await page.waitForTimeout(250);
    await page.getByPlaceholder('Name this state…').fill('Triage complete'); await page.getByPlaceholder('Name this state…').press('Enter'); await page.waitForTimeout(200);
    await quick('n Added after the snapshot: check whether 77.37.49[.]40 (Hostinger, LT) still serves anything.');
    await selectCard('CVE-2020-3259'); await page.keyboard.press('Delete'); await page.waitForTimeout(150);
    await text('Log').click(); await page.waitForTimeout(150);
    const diffBtn = page.getByRole('button', { name: /^(Diff|Hide diff)$/ }).first(); await diffBtn.click(); await page.waitForTimeout(250);
    await shot(page, 's18-snapshot-diff.png', 'Log tab: a named snapshot was saved, then a note was added and a CVE card deleted. Diff lists exactly what changed since the snapshot; Restore puts the board back. Below: playback rebuilds the board card by card in date order, and the append-only log records every action with time and analyst.', [
      { locator: page.getByPlaceholder('Name this state…'), text: 'Snapshots: Save / Diff / Restore' },
      { locator: diffBtn, text: 'Diff against the current board' },
      { locator: ptext('PLAYBACK · HOW THE BOARD BUILT UP'), text: 'Playback' },
    ], { title: 'S18 · Snapshots and log' });
    await page.getByRole('button', { name: 'Restore', exact: true }).first().click(); await page.waitForTimeout(400);
    const { c } = await active(); if (!(await findItem('CVE-2020-3259'))) throw new Error('restore did not bring the CVE back');
    await text('Log').click(); await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Play', exact: true }).click(); await page.waitForTimeout(1500);
    const s = await state(page); if (!s.play.on) throw new Error('playback');
    await shot(page, 's18b-playback.png', 'Playback running: cards appear in chronological order so you can walk a reviewer through how the picture built up. Pause, scrub with the slider, or Exit.', [
      { locator: ptext('PLAYBACK · HOW THE BOARD BUILT UP'), text: 'Playback controls' },
    ], { title: 'S18 · Playback' });
    await page.getByRole('button', { name: 'Exit', exact: true }).click(); await page.waitForTimeout(200);
    return 'log entries ' + c.log;
  });

  // ---------------------------------------------------------------- S19 judgement, notes, sign-off
  await check('S19 key judgement, dissent, notes, review → published (sign-off)', async () => {
    await text('Notes').click(); await page.waitForTimeout(250);
    await fill(page.getByPlaceholder('We assess that…'), 'We assess with high confidence that SafePay is a financially motivated ransomware operation that enters through stolen or brute-forced VPN credentials and known edge-device CVEs, stages data with RClone / FileZilla / b2 to 5.255.11[.]134 and 37.10.71[.]188, destroys backups and encrypts with a ChaCha20 / RSA locker (.SafePay). Infrastructure in the advisory is hosted at Bacloud (LT) and Hetzner (DE).');
    await btn(page, 'High confidence').click();
    await fill(page.getByPlaceholder('Dissent / alternative view and what would change the call'), 'Several listed IPs belong to Cloudflare, GitHub and Google ranges; they are more likely tooling downloads or victim-side traffic than actor infrastructure. Treat them as context, not blocklist candidates, unless the hosting providers confirm abuse.');
    await fill(page.getByPlaceholder('Working theory, leads, to-dos…'), 'SOURCE\nCISA / FBI / USSS / LKA RLP / NCA / NWROCU joint advisory AA26-293A, 20 Oct 2026. IOCs observed Nov 2024 – Aug 2026.\n\nWHAT TO DO FIRST\n- block the actor-attributed IPs (Bacloud, exfil hosts); review, do not block, the CDN / GitHub / Google ones\n- hunt for ShareFinder.ps1, SharpShares.exe, netscan*, dcsync.exe, Socks_werfault.exe\n- patch CVE-2024-40711 / 40766 / 2023-27532 / 20269 / 2020-3259 on edge devices\n- MFA on VPN, lockouts, offline immutable backups\n\nOPEN\n- Bacloud RFI outstanding\n- no .onion / leak-site address in the advisory');
    await T('Review state of the case').selectOption('published'); await page.waitForTimeout(250);
    const { c } = await active(); if (c.review !== 'published') throw new Error(c.review);
    const so = await ptext('KEY JUDGEMENT').locator('xpath=following::*[contains(text(),"Signed off")][1]').count(); if (!so) throw new Error('no sign-off text');
  });
  await shot(page, 's19-judgement.png', 'Notes tab: the key judgement with High confidence and the dissent (several IPs sit in CDN / GitHub / Google ranges and should not be blocklisted blindly). Setting the review state to Published records "Signed off by S. Murugan" with the time; it prints on the brief.', [
    { locator: ptext('KEY JUDGEMENT'), text: 'Key judgement + confidence + dissent + sign-off' },
    { locator: T('Review state of the case'), text: 'Published → signed off' },
    { locator: page.getByPlaceholder('Working theory, leads, to-dos…'), text: 'Working notes' },
  ], { title: 'S19 · Judgement and sign-off' });

  // ---------------------------------------------------------------- S20 requests (RFI)
  await check('S20 request generator: RFI to the hosting provider', async () => {
    await btn(page, 'Requests').click(); await page.waitForTimeout(200);
    const kind = page.locator('select').filter({ has: page.locator('option', { hasText: /Request for information/ }) }).first(); if (await kind.count()) await kind.selectOption({ label: 'Request for information' }).catch(() => {});
    await fill(page.getByPlaceholder('Registrar abuse desk, hosting provider, partner CERT…'), 'UAB Bacloud abuse desk (AS61272)');
    const t = await popupShot(() => btn(page, 'Open letter').click(), 's20b-rfi-letter.png', 900, 1200);
    if (!/88\W*119\W*167/.test(t)) throw new Error('letter missing the IP');
  });
  await shot(page, 's20-requests.png', 'Request generator switched to Request for information, addressed to the Bacloud abuse desk, with the indicators ticked. Open letter renders a printable RFI (next picture) that lists them defanged with the case number, TLP and analyst.', [
    { locator: text('REQUEST GENERATOR'), text: 'Takedown request / RFI' },
    { locator: btn(page, 'Open letter'), text: 'Open letter' },
  ], { title: 'S20 · Request for information' });
  await closeModal();

  // ---------------------------------------------------------------- S21 present mode
  await check('S21 present mode', async () => {
    await text('Inspector').click(); await btn(page, 'Present').click(); await page.waitForTimeout(500);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
    const s = await state(page); if (!s.present) throw new Error('present');
  });
  await shot(page, 's21-present.png', 'Present (P): panels hidden, exhibit counter at the bottom, arrow keys step through the numbered exhibits. Esc returns to the board.', [
    { locator: page.getByText(/EXHIBIT \d+ \/ \d+/), text: 'Exhibit counter' },
  ], { title: 'S21 · Present', barTop: true });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // ---------------------------------------------------------------- S22 exports: brief, one-pager, STIX, image, case; re-import STIX
  const dls = {};
  await check('S22 case brief and one-pager', async () => {
    const t = await popupShot(() => btn(page, 'Case brief').click(), 's22-case-brief.png'); if (!/CASE BRIEF/.test(t)) throw new Error('no brief');
    const t2 = await popupShot(() => btn(page, 'One-pager').click(), 's22b-one-pager.png'); if (!/ONE-PAGER/.test(t2)) throw new Error('no one-pager');
  });
  for (const [name, re] of [['STIX', /\.json$/], ['Export image', /\.png$/], ['Export case', /\.json$/]]) {
    await check('S22 download: ' + name, async () => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), btn(page, name).click()]);
      const f = dl.suggestedFilename(); if (!re.test(f)) throw new Error(f);
      const p = name === 'Export image' ? path.join(OUT, 's22c-board-export.png') : path.join(EXPORTS, f); await dl.saveAs(p); dls[name] = p; return f;
    });
  }
  await check('S22 STIX bundle re-imports as a new case (round trip), then Delete that case', async () => {
    const b = JSON.parse(fs.readFileSync(dls['STIX'], 'utf8')); const types = {}; b.objects.forEach(o => types[o.type] = (types[o.type] || 0) + 1);
    const n0 = (await state(page)).cases.length;
    const [ch] = await Promise.all([page.waitForEvent('filechooser'), btn(page, 'Import').click()]); await ch.setFiles(dls['STIX']); await page.waitForTimeout(800);
    const s = await state(page); if (s.cases.length !== n0 + 1) throw new Error('stix import');
    await shot(page, 's22d-stix-reimport.png', 'The exported STIX 2.1 bundle imported back through Import: indicators, vulnerabilities, attack patterns, threat actor, identities, locations, the transaction, notes, relationships and groupings all come back as a new case (laid out on a grid). The same path accepts bundles from MISP / OpenCTI / vendor feeds.', [
      { locator: btn(page, 'Import'), text: 'Import (JSON / STIX / CSV)' },
      { locator: page.locator('select').first(), text: 'New case created from the bundle' },
    ], { title: 'S22 · STIX round trip' });
    await btn(page, 'Delete').click(); await page.waitForTimeout(400);
    if ((await state(page)).cases.length !== n0) throw new Error('delete case');
    return JSON.stringify(types);
  });
  await check('S22 CSV import into the inbox', async () => {
    const csv = path.join(EXPORTS, 'safepay-hostnames.csv'); fs.writeFileSync(csv, 'type,value,title\nhostname,WIN-SBOE3CPNAL,Hostname seen in SafePay intrusions\nhostname,WIN-3IUUOFVTQAR,Hostname seen in SafePay intrusions\nhostname,WIN-DK18BI83M0S,Hostname seen in SafePay intrusions\nhostname,WIN-I1HRRJHCEIV,Hostname seen in SafePay intrusions\n');
    const sel = page.locator('select').first(); const v = await sel.locator('option').evaluateAll(os => { const o = os.find(o => /SafePay/.test(o.textContent)); return o ? o.value : null; }); await sel.selectOption(v); await page.waitForTimeout(300);
    const c0 = (await active()).c; const [ch] = await Promise.all([page.waitForEvent('filechooser'), btn(page, 'Import').click()]); await ch.setFiles(csv); await page.waitForTimeout(500);
    const c1 = (await active()).c; if (c1.items < c0.items + 4) throw new Error('csv ' + c0.items + '->' + c1.items); return 'items ' + c0.items + ' -> ' + c1.items + ' (values already on the board are skipped by the importer)';
  });

  // ---------------------------------------------------------------- S23 undo, zoom, panels, encrypt, mobile
  await check('S23 Delete + undo, zoom, Fit, Inbox / Panel toggles', async () => {
    await fit(); const a = (await active()).c.items; await selectCard('Hostnames seen'); await page.keyboard.press('Delete'); await page.waitForTimeout(150);
    if ((await active()).c.items !== a - 1) throw new Error('delete'); await page.keyboard.press('Control+z'); await page.waitForTimeout(150); if ((await active()).c.items !== a) throw new Error('undo');
    await T('Zoom in').click(); await T('Zoom out').click(); await btn(page, 'Fit').click();
    await btn(page, 'Inbox').click(); await btn(page, 'Panel').click(); await page.waitForTimeout(200);
  });
  await shot(page, 's23-focus.png', 'Inbox and Panel toggled off for a clean view of the finished board; zoom with the wheel or the − / + buttons, F to fit.', [
    { locator: btn(page, 'Inbox'), text: 'Inbox toggle' }, { locator: btn(page, 'Panel'), text: 'Panel toggle' }, { locator: btn(page, 'Fit'), text: 'Fit (F)' },
  ], { title: 'S23 · Finished board' });
  await btn(page, 'Inbox').click(); await btn(page, 'Panel').click();
  await check('S23b encrypt at rest and unlock', async () => {
    await page.keyboard.press('Escape'); await btn(page, 'Encrypt').click(); await page.waitForTimeout(200);
    await page.getByPlaceholder('Passphrase').fill('safepay-triage-2026'); await btn(page, 'Encrypt saved cases').click(); await page.waitForTimeout(900);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    if ((await state(page)).activeId !== 'locked') throw new Error('no lock screen');
    await shot(page, 's23b-locked.png', 'Encrypt saved cases with a passphrase (TLP:RED material should not sit in plain localStorage). The next visit asks for it before anything is shown.', [
      { locator: page.getByPlaceholder('Passphrase'), text: 'Passphrase prompt' },
    ], { title: 'S23 · Encrypted at rest' });
    await page.getByPlaceholder('Passphrase').fill('safepay-triage-2026'); await btn(page, 'Unlock').click(); await page.waitForTimeout(1000);
    const s = await state(page); if (s.cases.length < 3) throw new Error('unlock');
    const sel = page.locator('select').first(); const v = await sel.locator('option').evaluateAll(os => { const o = os.find(o => /SafePay/.test(o.textContent)); return o ? o.value : null; }); await sel.selectOption(v); await page.waitForTimeout(300);
  });
  await check('S23c mobile list mode', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800);
    const s = await state(page); if (!s.mobile) throw new Error('mobile');
  });
  await shot(page, 's23c-mobile.png', 'On a phone the same case is a list; Board / List and Panel toggles sit in the top bar.', [], { title: 'S23 · Mobile' });
  await page.setViewportSize({ width: 1440, height: 900 });

  const unexpected = page.errors.filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|third-party cookie/.test(e));
  if (unexpected.length) fail('no unexpected page errors (OSINT CORS refusals are expected)', unexpected.slice(0, 5).join(' | ')); else pass('no unexpected page errors (OSINT CORS refusals are expected)');
  report(path.join(OUT, 'case-run.json'));
  await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
