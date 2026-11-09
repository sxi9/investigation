// Shared helpers for the feature drive + screenshots.
// Playwright + Chromium are required (npm i -D playwright && npx playwright install chromium).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.SHOT_DIR || path.resolve(__dirname, '..', '..', 'docs', 'screenshots');
const results = []; const shots = [];
function pass(name, detail) { results.push({ ok: true, name, detail }); console.log('PASS ' + name + (detail ? ' — ' + detail : '')); }
function fail(name, detail) { results.push({ ok: false, name, detail }); console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
let watched = null, seenErrs = 0;
function watch(page) { watched = page; seenErrs = 0; }
async function check(name, fn) {
  try { const d = await fn(); pass(name, typeof d === 'string' ? d : ''); return true; }
  catch (e) {
    let extra = '';
    if (watched) { try { const f = path.join(OUT, 'debug-' + results.length + '.png'); await watched.screenshot({ path: f }); const st = await watched.evaluate(() => { const el = document.querySelector('#root'); const k = Object.keys(el).find(k => k.startsWith('__reactContainer')); let f = el[k]; while (f && !(f.stateNode && f.stateNode.logic)) f = f.child; const s = f && f.stateNode.logic.state; return s ? { sel: s.sel, tool: s.tool, mode: s.mode, osintOpen: s.osintOpen, achOpen: s.achOpen, reqOpen: s.reqOpen, tplOpen: s.tplOpen, extractOpen: s.extract && s.extract.open, present: s.present, tab: s.tab } : null; }).catch(() => null); extra += ' | state: ' + JSON.stringify(st) + ' | debug shot ' + f; } catch (e) {} }
    if (watched && watched.errors.length > seenErrs) { extra = ' | page errors: ' + watched.errors.slice(seenErrs).join(' || ').slice(0, 600); seenErrs = watched.errors.length; }
    fail(name, e.message.split('\n')[0].slice(0, 200) + extra); return false;
  }
}

async function launch(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'], ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource/.test(m.text())) page.errors.push(m.text().slice(0, 200)); });
  page.on('dialog', d => d.accept());
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { browser, ctx, page };
}

// Draws numbered callouts over elements + a caption strip, screenshots, removes the overlay.
// marks: [{ sel | locator | box:{x,y,w,h}, text, at?: 'tl'|'tr'|'bl'|'br'|'t' }]
async function shot(page, file, caption, marks = [], opts = {}) {
  const boxes = [];
  const vp = page.viewportSize();
  if (opts.scrollTo != null && marks[opts.scrollTo]) { const m = marks[opts.scrollTo]; const loc = m.locator || page.locator(m.sel).first(); try { await loc.evaluate(el => el.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); } catch (e) {} }
  for (const m of marks) {
    let b = m.box;
    if (!b) {
      const loc = m.locator || page.locator(m.sel).first();
      try { await loc.waitFor({ state: 'visible', timeout: 3000 }); } catch (e) {}
      const bb = await loc.boundingBox().catch(() => null);
      if (!bb) { console.log('  (no box for mark: ' + m.text + ')'); continue; }
      b = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
      // an element scrolled out of its panel cannot be labelled honestly: skip it
      const clip = await loc.evaluate(el => { let p = el.parentElement; while (p) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflowY + cs.overflow)) { const r = p.getBoundingClientRect(), e = el.getBoundingClientRect(); if (e.bottom < r.top + 4 || e.top > r.bottom - 4) return true; } p = p.parentElement; } return false; }).catch(() => false);
      if (clip || b.y + b.h < 0 || b.y > vp.height - (opts.barTop ? 0 : 60) || b.x + b.w < 0 || b.x > vp.width) { console.log('  (mark off-screen, skipped: ' + m.text + ')'); continue; }
    }
    boxes.push({ ...b, text: m.text, at: m.at || 'tl' });
  }
  await page.evaluate(({ boxes, caption, title, barTop }) => {
    const ov = document.createElement('div'); ov.id = '__labels'; ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:Archivo Narrow,system-ui,sans-serif';
    boxes.forEach((b, i) => {
      const r = document.createElement('div');
      r.style.cssText = `position:absolute;left:${b.x - 3}px;top:${b.y - 3}px;width:${b.w + 6}px;height:${b.h + 6}px;border:2px solid #ffd21e;border-radius:3px;box-shadow:0 0 0 2px rgba(0,0,0,.55)`;
      ov.appendChild(r);
      const n = document.createElement('div');
      const size = 22;
      let lx = b.x - 3 - size / 2, ly = b.y - 3 - size / 2;
      if (b.at === 'tr') lx = b.x + b.w + 3 - size / 2;
      if (b.at === 'bl') ly = b.y + b.h + 3 - size / 2;
      if (b.at === 'br') { lx = b.x + b.w + 3 - size / 2; ly = b.y + b.h + 3 - size / 2; }
      if (b.at === 't') { lx = b.x + b.w / 2 - size / 2; }
      lx = Math.max(2, Math.min(window.innerWidth - size - 2, lx)); ly = Math.max(2, Math.min(window.innerHeight - size - 2, ly));
      n.textContent = String(i + 1);
      n.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${size}px;height:${size}px;border-radius:50%;background:#ffd21e;color:#111;font:700 13px/${size}px Archivo Narrow,system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.7)`;
      ov.appendChild(n);
    });
    if (caption || boxes.length) {
      const bar = document.createElement('div');
      bar.style.cssText = (barTop ? 'position:absolute;left:0;right:0;top:0;border-bottom:2px solid #ffd21e;' : 'position:absolute;left:0;right:0;bottom:0;border-top:2px solid #ffd21e;') + 'background:rgba(10,10,11,.94);color:#f3f1ea;padding:8px 14px;font:13px/1.45 Archivo Narrow,system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:4px 18px;align-items:baseline';
      if (title) { const t = document.createElement('div'); t.textContent = title; t.style.cssText = 'flex-basis:100%;font:700 14px Archivo Narrow,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffd21e'; bar.appendChild(t); }
      if (caption) { const c = document.createElement('div'); c.textContent = caption; c.style.cssText = 'flex-basis:100%;color:#d8d3c7'; bar.appendChild(c); }
      boxes.forEach((b, i) => { const d = document.createElement('div'); d.innerHTML = `<b style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#ffd21e;color:#111;text-align:center;font:700 11px/18px Archivo Narrow,system-ui,sans-serif;margin-right:6px">${i + 1}</b>${b.text}`; bar.appendChild(d); });
      ov.appendChild(bar);
    }
    document.body.appendChild(ov);
  }, { boxes, caption, title: opts.title || '', barTop: !!opts.barTop });
  await page.waitForTimeout(120);
  const p = path.join(OUT, file);
  await page.screenshot({ path: p, fullPage: false });
  await page.evaluate(() => document.getElementById('__labels')?.remove());
  shots.push({ file, title: opts.title || '', caption, marks: boxes.map(b => b.text) });
  console.log('  shot ' + file);
  return p;
}

const card = (page, textOrIdx) => typeof textOrIdx === 'number' ? page.locator('[data-card][data-kind="card"]').nth(textOrIdx) : page.locator('[data-card][data-kind="card"]', { hasText: textOrIdx }).first();
const btn = (page, name) => page.getByRole('button', { name, exact: true }).first();
const state = (page) => page.evaluate(() => { const el = document.querySelector('#root'); const k = Object.keys(el).find(k => k.startsWith('__reactContainer')); let f = el[k]; while (f && !(f.stateNode && f.stateNode.logic)) f = f.child; return f ? JSON.parse(JSON.stringify({ ...f.stateNode.logic.state, cases: f.stateNode.logic.state.cases.map(c => ({ id: c.id, number: c.number, title: c.title, items: c.items.length, pinned: c.items.filter(i => i.pinned).length, threads: c.threads.length, groups: (c.groups || []).length, snapshots: (c.snapshots || []).length, log: (c.log || []).length, tlp: c.tlp, review: c.review, hyps: (c.hypotheses || []).length })), items: (() => { const c = f.stateNode.logic.state.cases.find(c => c.id === f.stateNode.logic.state.activeId); return c ? c.items.map(i => ({ id: i.id, type: i.type, title: i.title, value: i.value, body: (i.body || '').slice(0, 120), x: i.x, y: i.y, pinned: i.pinned, num: i.num })) : []; })() })) : null; });
const logic = (page) => page.evaluateHandle(() => { const el = document.querySelector('#root'); const k = Object.keys(el).find(k => k.startsWith('__reactContainer')); let f = el[k]; while (f && !(f.stateNode && f.stateNode.logic)) f = f.child; return f.stateNode.logic; });

function report(file) {
  const ok = results.filter(r => r.ok).length;
  fs.writeFileSync(file, JSON.stringify({ checks: results, shots }, null, 2));
  console.log(`\n${ok}/${results.length} checks passed`);
  return results;
}
module.exports = { watch, launch, shot, check, pass, fail, card, btn, state, logic, report, OUT };
