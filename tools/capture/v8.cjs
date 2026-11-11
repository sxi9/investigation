// Walkthrough capture for the storyboard: build from the timeline, edit scenes and cards, draft with the model,
// play, print, the brief's Story chapter, the public page, and persistence across reloads.
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v8'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const a = await ctx.newPage(); a.errors = [];
  a.on('pageerror', e => a.errors.push(e.message)); a.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) a.errors.push(m.text().slice(0, 160)); });
  a.on('dialog', d => /Replace the/.test(d.message()) ? d.dismiss() : d.accept()); // "Replace?" → Cancel means append
  const btn = (n) => a.getByRole('button', { name: n, exact: true }).first();
  const api = (method, url, body) => a.evaluate(async ({ method, url, body }) => { const headers = { 'X-Requested-With': 'CIB' }; if (body !== undefined) headers['content-type'] = 'application/json'; const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; }, { method, url, body });
  const scenesOf = () => a.evaluate(() => ((window.CIBPage.cs().story || {}).scenes || []).map(s => ({ id: s.id, title: s.title, kind: s.kind, n: (s.items || []).length })));
  const openStory = async () => { if (!(await a.locator('[data-story-list]').count())) { await a.locator('[data-story-btn]').click(); await a.waitForTimeout(400); } };
  const closeStory = async () => { if (await a.locator('[data-story-list]').count()) { await a.getByRole('dialog', { name: 'Storyboard' }).getByRole('button', { name: 'Close', exact: true }).click(); await a.waitForTimeout(200); } };

  await check('V01 setup: admin and the sample case on the board', async () => {
    await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW); await btn('Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 });
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500); if (!(await a.locator('[data-story-btn]').count())) throw new Error('Story button missing'); return (await a.evaluate(() => window.CIBPage.cs().number)) + ' open';
  });
  await check('V02 build the story from the timeline: one scene per day, then evidence, assessment and asks', async () => {
    await openStory(); await a.locator('[data-story-build]').click(); await a.waitForTimeout(600);
    const sc = await scenesOf(); if (sc.length < 4) throw new Error('scenes ' + sc.length); if (!sc.some(s => s.kind === 'happened') || !sc.some(s => s.kind !== 'happened')) throw new Error('kinds: ' + sc.map(s => s.kind).join(','));
    await shot(a, 'v01-build-from-timeline.png', 'Storyboard: press Story on the toolbar and "Build from timeline". Every day with dated cards becomes a "what happened" scene (many days are merged into spans), then "what the evidence shows" from confirmed indicators, "assessment" from the judgement, and "what we ask for". Each scene carries the cards that back it.', [
      { locator: a.locator('[data-story-build]'), text: 'Build from the timeline' }, { locator: a.locator('[data-story-scene]').first(), text: 'Scenes in order, by kind' }, { locator: a.locator('[data-story-editor]'), text: 'Scene editor with its cards' },
    ], { title: 'V01 · Build from timeline' });
    return sc.length + ' scenes: ' + sc.map(s => s.kind).join(', ');
  });
  await check('V03 edit a scene: caption, kind and the cards it rests on', async () => {
    await a.locator('[data-story-scene]').nth(1).click(); await a.waitForTimeout(200);
    await a.locator('[data-story-caption]').fill('The drain itself: signatures obtained in advance through EIP-7702 delegation were executed in a single burst across ten chains in about twenty minutes (E17, E18, E25). Issuers began freezing within the hour (E13).');
    const before = (await scenesOf())[1].n; await a.locator('[data-story-pick]').selectOption({ index: 1 }); await a.waitForTimeout(300); const after = (await scenesOf())[1].n; if (after !== before + 1) throw new Error('card not added ' + before + '→' + after);
    await shot(a, 'v02-edit-scene.png', 'Editing a scene: the title, the kind (what happened, what we found, what we assess, what we ask for), the date range and a caption that cites exhibits. Add the board\'s selected card or pick any pinned card; remove with ×; reorder with the arrows. Everything is saved on the case, so it syncs and versions like the rest.', [
      { locator: a.locator('[data-story-caption]'), text: 'Caption citing exhibits' }, { locator: a.locator('[data-story-pick]'), text: 'Add a card to the scene' }, { locator: a.locator('[data-story-tile]').last(), text: 'Card tile in the scene' },
    ], { title: 'V02 · Edit a scene' });
    return 'caption set, ' + after + ' cards in scene 2';
  });
  await check('V04 draft with AI appends scenes written from the whole case (rules engine without a key)', async () => {
    const before = (await scenesOf()).length; await a.locator('[data-story-ai]').click(); await a.getByText(/scenes drafted/).waitFor({ timeout: 70000 }); await a.waitForTimeout(300);
    const after = (await scenesOf()).length; if (after <= before) throw new Error('no scenes appended');
    await shot(a, 'v03-draft-ai.png', 'Draft with AI: the model (or the rules engine when no key is configured) writes scenes from the whole case — notes, exhibits, threads, hypotheses — with captions citing exhibit numbers that are checked against the board. Replace your scenes or append to them.', [
      { locator: a.locator('[data-story-ai]'), text: 'Draft with AI' }, { locator: a.getByText(/scenes drafted/), text: 'Appended, engine named' },
    ], { title: 'V03 · AI-drafted scenes' });
    return before + ' → ' + after + ' scenes';
  });
  await check('V05 play the story full screen, one scene at a time', async () => {
    await a.locator('[data-story-scene]').first().click(); await a.locator('[data-story-play]').click(); await a.locator('[data-story-stage]').waitFor({ timeout: 5000 }); await a.waitForTimeout(300);
    await shot(a, 'v04-play.png', 'Play: a full-screen view of one scene at a time — kind and dates, title, caption, the cards as tiles. Arrow keys or the buttons move between scenes; Esc returns to the editor. Made for the briefing room.', [
      { locator: a.getByText(/SCENE 1 \//).first(), text: 'Scene counter and kind' }, { locator: a.locator('[data-story-stage] [data-story-tile]').first(), text: 'Backing cards' },
    ], { title: 'V04 · Play' });
    await a.keyboard.press('ArrowRight'); await a.waitForTimeout(200); if (!(await a.getByText(/SCENE 2 \//).count())) throw new Error('arrow did not advance'); await a.keyboard.press('Escape'); await a.waitForTimeout(200);
    if (await a.locator('[data-story-stage]').count()) throw new Error('play did not close'); return 'advanced with →, closed with Esc';
  });
  await check('V06 print: one scene per page with its exhibits', async () => {
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 12000 }), a.locator('[data-story-print]').click()]); await pop.waitForLoadState(); await pop.waitForTimeout(500);
    const html = await pop.content(); const pages = (html.match(/class="page"/g) || []).length; const n = (await scenesOf()).length; if (pages !== n + 1) throw new Error('pages ' + pages + ' for ' + n + ' scenes'); if (!/STORYBOARD/.test(html)) throw new Error('no cover');
    await pop.setViewportSize({ width: 1000, height: 1300 });
    await shot(pop, 'v05-print.png', 'Print: a cover with the scene list, then one page per scene with the kind, dates, caption and the exhibits as tiles. Save as PDF from the browser for a hand-over or a leadership pack.', [{ locator: pop.getByText(/SCENE 1 OF/).first(), text: 'One scene per page' }], { title: 'V05 · Printed storyboard', scrollTo: 0 });
    await pop.close(); return pages + ' pages for ' + n + ' scenes';
  });
  await check('V07 the case brief gains a Story chapter before the timeline', async () => {
    await closeStory(); const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 12000 }), btn('Case brief').click()]); await pop.waitForLoadState(); await pop.waitForTimeout(600);
    const html = await pop.content(); if (!html.includes('<h2>Story</h2>') || !/SCENE 1 ·/.test(html)) throw new Error('no story chapter'); if (html.indexOf('<h2>Story</h2>') > html.indexOf('<h2>Timeline</h2>')) throw new Error('story after timeline');
    await pop.setViewportSize({ width: 1000, height: 1300 });
    await shot(pop, 'v06-brief-story.png', 'The case brief prints the storyboard as a chapter before the timeline: every scene with its kind, dates, caption and the exhibits it cites, so the narrative and the evidence tables travel together.', [{ locator: pop.getByText('Story', { exact: true }).first(), text: 'Story chapter in the brief' }], { title: 'V06 · Brief chapter', scrollTo: 0 });
    await pop.close(); return 'Story chapter present before Timeline';
  });
  await check('V08 the public share page shows the storyboard first', async () => {
    const caseId = await a.evaluate(() => window.CIBPage.state.activeId); await a.waitForTimeout(1200);
    const r = await api('POST', '/api/shares', { caseId, label: 'Board briefing', days: 7 }); if (r.status !== 200) throw new Error('share: ' + JSON.stringify(r.body));
    const pctx = await browser.newContext({ viewport: { width: 1100, height: 1300 } }); const pub = await pctx.newPage(); await pub.goto(BASE + r.body.share.url, { waitUntil: 'networkidle' }); await pub.waitForTimeout(800);
    const n = await pub.locator('[data-share-scene]').count(); if (!n) throw new Error('no scenes on the public page');
    await shot(pub, 'v07-public-story.png', 'On the public page the storyboard comes first: scene by scene, with the exhibits each one rests on as chips. Readers get the narrative before the tables, and only the cards the team pinned.', [{ locator: pub.locator('[data-share-scene]').first(), text: 'Scene on the public page' }], { title: 'V07 · Storyboard on the share page', scrollTo: 0 });
    await pctx.close(); return n + ' scenes on the public page';
  });
  await check('V09 the story survives a reload and is part of the case document', async () => {
    const before = (await scenesOf()).length; await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(2000); const after = (await scenesOf()).length; if (after !== before || !after) throw new Error(before + ' → ' + after);
    const srv = await api('GET', '/api/store/case/' + encodeURIComponent(await a.evaluate(() => window.CIBPage.state.activeId))); if (((srv.body.case.story || {}).scenes || []).length !== after) throw new Error('server copy differs'); return after + ' scenes on the server';
  });
  const errs = a.errors.filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v8-run.json')); await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
