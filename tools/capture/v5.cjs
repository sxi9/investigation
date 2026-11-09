// Walkthrough capture for security and operations: TOTP second factor, SSO button, backups, retention, legal hold,
// personal-data export, per-file TLP access control. Run against a fresh server started with OIDC_* set (see v5-intro.md).
const fs = require('fs'); const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'v5'); fs.mkdirSync(OUT, { recursive: true });
process.env.SHOT_DIR = OUT;
const { shot, check, pass, fail, report } = require('./lib.cjs');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const PW = 'Correct-Horse-Battery-9';
(async () => {
  const totp = await import(path.resolve(__dirname, '..', '..', 'server', 'src', 'totp.js'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const a = await ctx.newPage(); a.errors = [];
  a.on('pageerror', e => a.errors.push(e.message)); a.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource|CORS/.test(m.text())) a.errors.push(m.text().slice(0, 160)); }); a.on('dialog', d => d.accept());
  const btn = (n) => a.getByRole('button', { name: n, exact: true }).first();
  const api = (page, method, url, body, raw) => page.evaluate(async ({ method, url, body, raw }) => { const headers = { 'X-Requested-With': 'CIB' }; if (body !== undefined && !raw) headers['content-type'] = 'application/json'; if (raw) { headers['content-type'] = raw.type; headers['x-file-name'] = raw.name; if (raw.caseId) headers['x-case-id'] = raw.caseId; } const r = await fetch(url, { method, headers, body: raw ? body : (body !== undefined ? JSON.stringify(body) : undefined) }); let j = null; try { j = await r.clone().json(); } catch (e) {} return { status: r.status, body: j }; }, { method, url, body, raw });
  const drawer = async (tab) => { if (!(await a.locator('[data-account-drawer]').count())) { await a.locator('[data-account]').click(); await a.waitForTimeout(300); } if (tab) { await a.locator('[data-acct-tab="' + tab + '"]').click(); await a.waitForTimeout(600); } };
  const closeDrawer = async () => { if (await a.locator('[data-account-drawer]').count()) { await a.locator('[data-account]').click(); await a.waitForTimeout(200); } };
  let secret = '', caseId = '';

  await check('Y01 setup: first admin, sample case, a viewer account', async () => {
    await a.goto(BASE + '/', { waitUntil: 'networkidle' }); await a.locator('input[autocomplete=username]').fill('S. Murugan'); const pw = a.locator('input[type=password]'); await pw.nth(0).fill(PW); await pw.nth(1).fill(PW); await btn('Create admin account').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 });
    await a.goto(BASE + '/board.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
    const r = await api(a, 'POST', '/api/users', { name: 'V. Reader', pass: PW, role: 'viewer', cases: 'all', mustChange: false }); if (r.status !== 200) throw new Error('viewer: ' + JSON.stringify(r.body));
    const s = await api(a, 'GET', '/api/store'); caseId = s.body.cases[0].id; return s.body.cases.length + ' case(s) seeded · viewer created';
  });
  await check('Y02 two-factor setup from Account → Security: QR and secret shown, code confirmed', async () => {
    await a.goto(BASE + '/desk.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(1200);
    await drawer('security'); await a.locator('[data-totp-setup]').click(); await a.waitForTimeout(1200);
    if (!(await a.locator('[data-totp-qr] svg').count())) throw new Error('no QR code rendered');
    const text = await a.locator('[data-account-drawer]').innerText(); const m = text.match(/([A-Z2-7]{4}(?: [A-Z2-7]{4}){7})/); if (!m) throw new Error('secret not shown'); secret = m[1].replace(/ /g, '');
    await shot(a, 'y01-totp-setup.png', 'Two-factor authentication: open Account → Security and "Set up two-factor authentication". Scan the QR code with any TOTP app (Google Authenticator, Authy, 1Password) or type the secret, then enter the six digits the app shows and confirm. From then on every password sign-in asks for a code. Admins can remove a lost second factor from Operations.', [
      { locator: a.locator('[data-totp-qr]'), text: 'Scan with an authenticator app' }, { locator: a.locator('[data-totp-code]'), text: 'Type the six-digit code' }, { locator: a.locator('[data-totp-confirm]'), text: 'Confirm and turn on' },
    ], { title: 'Y01 · Two-factor setup' });
    await a.locator('[data-totp-code]').fill(totp.code(secret)); await a.locator('[data-totp-confirm]').click(); await a.waitForTimeout(800);
    const s = await api(a, 'GET', '/api/auth/session'); if (!s.body.user.totp) throw new Error('TOTP not enabled'); return 'secret ' + secret.length + ' chars · enabled';
  });
  await check('Y03 sign-in now has a second step: password, then the authenticator code; a wrong code is refused', async () => {
    await closeDrawer(); await btn('Sign out').click(); await a.waitForURL(/\/($|index|#)/, { timeout: 8000 }).catch(() => {}); await a.goto(BASE + '/', { waitUntil: 'networkidle' });
    await a.locator('input[autocomplete=username]').fill('S. Murugan'); await a.locator('input[type=password]').fill(PW); await btn('Sign in').click(); await a.waitForTimeout(900);
    if (!(await a.getByText('Second factor.').count())) throw new Error('second step not shown');
    await a.locator('input[type=password]').fill('000000'); await btn('Verify code').click(); await a.waitForTimeout(700);
    const err = await a.getByText(/Wrong code/).count(); if (!err) throw new Error('wrong code accepted or no error');
    await shot(a, 'y02-totp-login.png', 'Signing in with a second factor: after the password the page asks for the authenticator code. The server only issues a session cookie once the code checks out; five wrong codes void the challenge and you start again. SSO accounts sign in through the identity provider button instead.', [
      { locator: a.locator('input[type=password]'), text: 'Six-digit code from the app' }, { locator: btn('Verify code'), text: 'Verify' }, { locator: a.getByText(/Wrong code/).first(), text: 'A wrong code is refused' },
    ], { title: 'Y02 · Second factor at sign-in' });
    await a.locator('input[type=password]').fill(totp.code(secret)); await btn('Verify code').click(); await a.waitForURL(/desk\.html/, { timeout: 10000 }); return 'session issued after the right code';
  });
  await check('Y04 single sign-on button appears when an OIDC provider is configured', async () => {
    const s = await api(a, 'GET', '/api/auth/session'); if (!s.body.sso) return 'server started without OIDC_ISSUER; button hidden (expected on this run)';
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx2.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    if (!(await p.locator('[data-sso]').count())) throw new Error('SSO button missing');
    await shot(p, 'y03-sso-button.png', 'Single sign-on: with OIDC_ISSUER, OIDC_CLIENT_ID (and optionally a client secret) set on the server, the login page offers the identity provider. The flow is authorization code with PKCE; the id_token is verified against the provider\'s JWKS (RS256, issuer, audience, expiry, nonce). First sign-in creates the account with OIDC_DEFAULT_ROLE; OIDC_ADMINS become admins; OIDC_ALLOWED_DOMAINS restricts who may enter.', [
      { locator: p.locator('[data-sso]'), text: 'Sign in through the identity provider' }, { locator: p.getByRole('button', { name: 'Sign in', exact: true }), text: 'Local account with password (and TOTP)' },
    ], { title: 'Y03 · Single sign-on' });
    await ctx2.close(); return 'button "' + s.body.sso.label + '" → ' + s.body.sso.start;
  });
  await check('Y05 operations: back up now writes a SQLite snapshot and lists it', async () => {
    await a.goto(BASE + '/desk.html', { waitUntil: 'networkidle' }); await a.waitForTimeout(1200);
    await drawer('ops'); await a.locator('[data-backup-now]').click(); await a.waitForTimeout(1500);
    const l = await api(a, 'GET', '/api/admin/backups'); if (!l.body.backups.length) throw new Error('no backup listed'); return l.body.backups[0].name + ' · ' + l.body.backups[0].size + ' bytes';
  });
  await check('Y06 legal hold: set from Operations, stamped on the folder, delete refused', async () => {
    await a.locator('[data-hold="' + caseId + '"]').click(); await a.waitForTimeout(900);
    const h = await api(a, 'GET', '/api/admin/holds'); if (!h.body.cases.find(c => c.id === caseId).legalHold) throw new Error('hold not set');
    await shot(a, 'y04-operations.png', 'Operations (admins, Account → Operations): write a backup now and see the last ones; run the retention purge for the wastebasket; set or release legal holds per case; look up and download everything the cases hold about a named person; remove a lost second factor.', [
      { locator: a.locator('[data-backup-now]'), text: 'Back up now' }, { locator: a.locator('[data-purge-now]'), text: 'Retention purge' }, { locator: a.locator('[data-hold="' + caseId + '"]'), text: 'Legal hold set on this case' }, { locator: a.locator('[data-person-find]'), text: 'Personal-data lookup' },
    ], { title: 'Y04 · Operations' });
    await closeDrawer(); await a.waitForTimeout(600);
    if (!(await a.locator('[data-hold-stamp]').count())) throw new Error('folder stamp missing');
    const del = a.getByRole('button', { name: 'Delete', exact: true }).first(); await del.dispatchEvent('click'); await a.waitForTimeout(500);
    const toast = await a.getByText(/under legal hold/).count(); if (!toast) throw new Error('no refusal toast');
    await shot(a, 'y05-legal-hold.png', 'A held case carries a LEGAL HOLD stamp on its folder. Delete is refused on the desk and on the board, the server ignores delete requests for it, and retention never purges it. The hold and its release are logged on the case and in the audit trail.', [
      { locator: a.locator('[data-hold-stamp]').first(), text: 'Legal hold stamp' }, { locator: a.getByText(/under legal hold/).first(), text: 'Delete refused' },
    ], { title: 'Y05 · Legal hold' });
    const s = await api(a, 'GET', '/api/store'); if (!s.body.cases.some(c => c.id === caseId)) throw new Error('case vanished'); return 'case kept; stamp shown; delete refused';
  });
  await check('Y07 retention: a deleted case is purged on demand; held cases are skipped', async () => {
    const r = await api(a, 'PUT', '/api/store', { cases: [{ id: 'c-tmp', number: 'CASE 0999', title: 'Throwaway', tlp: '', items: [], threads: [], groups: [], log: [], dismissed: [] }] }); if (!r.body.accepted.length) throw new Error('create failed');
    await api(a, 'PUT', '/api/store', { cases: [], deleted: ['c-tmp'] });
    const p = await api(a, 'POST', '/api/admin/purge', { days: 0 }); if (p.status !== 200 || p.body.purged < 1) throw new Error('purge: ' + JSON.stringify(p.body));
    const s = await api(a, 'GET', '/api/store'); if (!s.body.cases.some(c => c.id === caseId)) throw new Error('held case was purged'); return p.body.purged + ' purged · held case kept';
  });
  await check('Y08 personal data: find everything about a named person across cases and download it', async () => {
    await a.reload({ waitUntil: 'networkidle' }); await a.waitForTimeout(1000); await drawer('ops');
    const s = await api(a, 'GET', '/api/store'); const person = (s.body.cases.flatMap(c => c.items || []).find(i => i.type === 'person') || {}).title || 'Richard Teng';
    await a.locator('[data-person]').fill(person); await a.locator('[data-person-find]').click(); await a.waitForTimeout(1200);
    if (!(await a.locator('[data-person-dl]').count())) throw new Error('no result');
    await shot(a, 'y06-personal-data.png', 'Subject access: type a person\'s name; the server collects their person cards, comments by or about them, tasks assigned to them and log lines that name them, across every case. Download the JSON to answer an access or erasure request. Every lookup is written to the audit trail.', [
      { locator: a.locator('[data-person]'), text: 'Name to look up' }, { locator: a.locator('[data-person-dl]'), text: 'Download the JSON' },
    ], { title: 'Y06 · Personal data export' });
    const r = await api(a, 'GET', '/api/admin/person-data?name=' + encodeURIComponent(person)); return '"' + person + '" in ' + r.body.cases.length + ' case(s)';
  });
  await check('Y09 per-file access: a photo in a TLP:RED case is not served to a viewer without the grant', async () => {
    await api(a, 'PUT', '/api/store', { cases: [{ id: 'c-red', number: 'CASE 0998', title: 'Restricted', tlp: 'red', items: [], threads: [], groups: [], log: [], dismissed: [] }] });
    const up = await a.evaluate(async () => { const r = await fetch('/api/files/f-red-1', { method: 'PUT', headers: { 'X-Requested-With': 'CIB', 'content-type': 'image/png', 'x-file-name': 'id-card.png', 'x-case-id': 'c-red' }, body: new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])]) }); return r.status; }); if (up !== 200) throw new Error('upload ' + up);
    const ctx3 = await browser.newContext(); const v = await ctx3.newPage(); await v.goto(BASE + '/', { waitUntil: 'networkidle' });
    await v.locator('input[autocomplete=username]').fill('V. Reader'); await v.locator('input[type=password]').fill(PW); await v.getByRole('button', { name: 'Sign in', exact: true }).click(); await v.waitForURL(/desk\.html/, { timeout: 10000 });
    const asViewer = await v.evaluate(async () => (await fetch('/api/files/f-red-1', { headers: { 'X-Requested-With': 'CIB' } })).status);
    const asAdmin = await a.evaluate(async () => (await fetch('/api/files/f-red-1', { headers: { 'X-Requested-With': 'CIB' } })).status);
    await ctx3.close(); if (asViewer !== 404 || asAdmin !== 200) throw new Error('viewer ' + asViewer + ' admin ' + asAdmin); return 'viewer → 404 · admin → 200';
  });
  await check('Y10 users panel shows second factors and SSO per account', async () => {
    await closeDrawer(); await btn('Users').click(); await a.waitForTimeout(600);
    const row = a.getByText(/2FA on/).first(); if (!(await row.count())) throw new Error('2FA badge missing');
    await shot(a, 'y07-users-2fa.png', 'The Users panel now shows who has a second factor and who signs in through SSO. Admins reset passwords here and remove a lost second factor from Operations; SSO-only accounts have no password to reset.', [{ locator: row, text: '2FA on for this account' }], { title: 'Y07 · Users panel' });
    await a.keyboard.press('Escape');
  });
  await check('Y11 deployment files: Dockerfile, compose with Caddy TLS, env example, backup script', async () => {
    const root = path.resolve(__dirname, '..', '..'); for (const f of ['Dockerfile', 'docker-compose.yml', 'deploy/Caddyfile', '.env.example', '.dockerignore']) if (!fs.existsSync(path.join(root, f))) throw new Error('missing ' + f);
    const pk = JSON.parse(fs.readFileSync(path.join(root, 'server', 'package.json'), 'utf8')); if (!pk.scripts.backup) throw new Error('no backup script');
    return 'present (docker build itself is not run by this capture)';
  });
  const errs = a.errors.filter(e => !/CORS|Failed to fetch|net::|ERR_BLOCKED|tile|leaflet|AudioContext/.test(e));
  if (errs.length) fail('no unexpected page errors', errs.slice(0, 6).join(' | ')); else pass('no unexpected page errors');
  report(path.join(OUT, 'v5-run.json')); await browser.close();
})().catch(e => { console.error('SCRIPT CRASH', e); process.exit(1); });
