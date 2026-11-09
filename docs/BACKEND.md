# Backend: accounts, storage, enrichment and AI

The server under `server/` replaces the browser-only prototype (`auth.js`, `localStorage`) with a small, secured service. It serves the built pages and the API from one origin.

## Run

```bash
npm install && npm run build
```

```bash
cd server && npm install && npm start
```

Open `http://127.0.0.1:8787/`. The first visit asks for the administrator account; add analysts, reviewers and viewers from the desk's **Users** panel afterwards.

Development with hot reload: run the server as above and `npm run dev` in the root; Vite proxies `/api` to the server.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT`, `HOST` | `8787`, `127.0.0.1` | Listen address. Put a TLS-terminating reverse proxy in front for anything beyond localhost and set `CIB_TRUST_PROXY=1`. |
| `CIB_DATA_DIR` | `server/data` | SQLite database and the file store. Back this directory up. |
| `CIB_SECURE_COOKIES` | `1` when `NODE_ENV=production` | Mark the session cookie `Secure` (HTTPS only). |
| `CIB_SESSION_HOURS`, `CIB_IDLE_MINUTES` | `12`, `15` | Absolute and idle session limits (spec §10). |
| `CIB_LOCKOUT_FAILURES`, `CIB_LOCKOUT_MINUTES` | `10`, `15` | Failed sign-ins before an account locks, and for how long. |
| `CIB_MIN_PASSWORD` | `8` | Minimum password length (a common-password list and "not your name" are always enforced). |
| `CIB_MAX_FILE_MB` | `50` | Largest media file accepted by the file store. |
| `CIB_PROXY_ALLOW` | see `server/src/config.js` | Comma-separated hosts the enrichment proxy may reach. |
| `THREATFOX_AUTH_KEY`, `VT_API_KEY`, `SHODAN_API_KEY`, `GREYNOISE_API_KEY`, `ABUSEIPDB_API_KEY`, `URLSCAN_API_KEY` | unset | Provider keys the proxy attaches server-side. A host is added to the proxy allow-list only when its key is set; the browser never sees the key. abuse.ch (ThreatFox, URLhaus, MalwareBazaar) now requires an `Auth-Key` even for free use. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | unset, `claude-sonnet-5-5` | When set, "Analyse with Claude", translate, stance and entity extraction use the model. When unset, the built-in rule-based engine answers (see below). |

## What is secured, and how

- **Passwords**: scrypt (N=2^15, r=8, p=1, 64-byte key, 16-byte salt), constant-time comparison. Minimum length plus a common-password list, "not one repeated character" and "not containing your name". Unknown user names take the same time to reject as wrong passwords.
- **Sessions**: 256-bit random token, stored hashed; cookie `cib_session` is `HttpOnly`, `SameSite=Strict`, `Secure` in production, 12 h absolute and 15 min idle expiry. Logout and admin password resets invalidate sessions.
- **Brute force**: per-route rate limits (20 sign-ins per 15 min per IP, 10 setups, 600 API calls per minute) and a per-account lock after 10 failures for 15 minutes. Every failure is in the audit log.
- **CSRF**: `SameSite=Strict` cookie, a required `X-Requested-With: CIB` header on every write, and an `Origin`/`Host` match check.
- **Headers**: Helmet with a content-security policy (`script-src 'self'`; images, media and connections to `https:` for OSINT lookups, maps and embeds; frames only for known players), `frame-ancestors 'none'`, no referrer, HSTS when cookies are secure.
- **Authorisation** (BACKEND-SPEC §10): the same four checks the pages use, evaluated server-side on every request and on every live event: `canSee` (role, per-user case list, TLP:RED / AMBER+STRICT grant, public + CLEAR/GREEN for guests), `canEdit` (admin, analyst), `canReview` (reviewers may only change `review`, `signoff`, `archived`, `desk`, `color`, `tags`, `log`), `canCreate`, `isAdmin`. Hidden cases return 404, not 403.
- **Audit**: append-only table where each row hashes the previous one; `/api/health` reports whether the chain verifies. Sign-ins, failures, lockouts, user changes, resets, case creation, deletion and stale overwrites are recorded with the client IP.
- **Files**: content-addressed (SHA-256) immutable store under `CIB_DATA_DIR/files`, written once, served only to signed-in accounts with the hash in a response header. Sizes are capped.
- **Enrichment proxy**: HTTPS only, explicit host allow-list, no credentials in URLs, DNS resolution checked against private ranges before each request (SSRF guard), 12 s timeout, 4 MB cap, rate-limited, accounts only. Replaces the third-party `allorigins.win` proxy the design used.
- **AI gateway**: the browser never holds a model key. Prompts go to the server, which calls Anthropic only if a key is configured.

### Not done here, and worth knowing

- TLS, backups and an identity provider (OIDC) are deployment concerns; the spec's OIDC flow can replace `/api/auth/*` without touching the pages.
- Media files are stored per upload, not per case, so file reads are allowed to any signed-in account; TLP enforcement applies to cases, not to individual files.
- Client-side encryption at rest (the board's **Encrypt** button) still works locally but an encrypted browser store cannot be synced; the server is the system of record.

## API

All routes are under `/api`. Writes need the `X-Requested-With: CIB` header. Errors are `{ "error": "message" }`.

| Method and path | Who | Purpose |
| --- | --- | --- |
| `GET /health` | anyone | Liveness, user count, audit chain status, AI engine. |
| `GET /auth/session` | anyone | Current user, whether setup is done, whether public files exist. |
| `POST /auth/setup` | nobody yet | First-run: create the admin (409 afterwards). |
| `POST /auth/login`, `POST /auth/logout`, `POST /auth/touch` | — | Sign in (sets the cookie), sign out, refresh idle timer. |
| `POST /auth/guest` | anyone | Read-only guest session, only while a public CLEAR/GREEN case exists. |
| `POST /auth/password` | account | Change own password (clears "must change"). |
| `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/password`, `DELETE /users/:id` | admin | Manage accounts, roles, TLP:RED grant and case scope; reset passwords (user must change on next sign-in). |
| `GET /store` | signed in | Visible cases (with `rev`), the user's desk and settings documents. |
| `GET /store/case/:id` | signed in | One case (404 when hidden). |
| `PUT /store` | account | `{cases:[…], deleted:[ids], desk, settings}`. Returns accepted (`id`, `rev`, server `number`) and rejected (`id`, `reason`). Identical writes do not bump revisions; stale writes are applied last-writer-wins and audited. |
| `PUT /files/:id`, `GET /files/:id` | editors / accounts | Media mirror; body is the raw file, response carries `sha256`. |
| `GET\|POST /proxy?url=` | account | Fetch an allow-listed HTTPS URL on the browser's behalf. |
| `POST /ai/complete` | account | `{system, messages, max_tokens}` → `{text, engine}`. |
| `GET /events` | signed in | Server-sent events: `case` (`id`, `rev`, `by`) and `case-deleted`, filtered by what the listener may see. |

## How the pages use it

`src/runtime/` holds the glue, none of it in the generated page code:

- `auth.js` exposes `window.CIBAuth` with the same methods the design's `auth.js` had. Synchronous reads come from a cache filled by `init()` before the page renders; writes call the API and update the cache optimistically.
- `store.js` pulls the user's cases into the pages' `localStorage` documents before render, intercepts writes to those keys, pushes changed cases (debounced, per case, with revisions) and applies other people's changes from the event stream unless the same case has unsaved local edits.
- `claude.js` makes `window.claude.complete` call the gateway. `proxy.js` sends CORS-blocked hosts through `/api/proxy`. Media `putBlob`/`getBlob` are mirrored to `/api/files`.

## The built-in analyst engine

Without a model key the gateway still answers the board's four prompts, from rules, and says so in its text:

- **Assess**: parses the prompt the board sends (card, other cards, threads, notes), stamps from the card's status or source, suggests threads to cards that share identifiers (relation chosen from the card types), and proposes next steps per indicator kind.
- **Entities**: regex and pattern extraction for emails, phones, money, dates, CVEs, IPs, hashes, organisations, people, places, vehicles and plates.
- **Stance**: cue-word sentiment and support/oppose phrases, with the most repeated capitalised phrase as the narrative.
- **Translate**: language detection by script and stop-words; the text is returned unchanged with a note, since no translation model is available offline.

Set `ANTHROPIC_API_KEY` to replace all four with the model.

## Tests

```bash
cd server && npm test
```

Covers setup, CSRF and origin checks, weak passwords, roles and scopes, lockout and reset, server-assigned numbers and revisions, reviewer and viewer limits, guests, files, proxy guards, the local AI shapes, logout and the audit chain. The end-to-end browser run is `node tools/capture/v2.cjs` (see `docs/V2.md`).
