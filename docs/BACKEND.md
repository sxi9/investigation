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
| `CIB_RETENTION_DAYS` | `30` | Wastebasket cases older than this are hard-deleted every six hours (legal holds are skipped). |
| `CIB_BACKUP_HOURS`, `CIB_BACKUPS_KEEP` | `24`, `14` | Automatic `VACUUM INTO` snapshots under `CIB_DATA_DIR/backups`, and how many to keep. `0` hours disables the scheduler. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | unset | Single sign-on. Setting issuer and client id shows the SSO button; the redirect URI is `/api/auth/oidc/callback`. |
| `OIDC_LABEL`, `OIDC_DEFAULT_ROLE`, `OIDC_ADMINS`, `OIDC_ALLOWED_DOMAINS`, `OIDC_SCOPE` | `Single sign-on`, `viewer`, unset, unset, `openid profile email` | Button text, role for new SSO accounts, e-mails (or subjects) that are made admin, e-mail domains allowed in, scopes requested. |
| `MISP_URL`, `MISP_KEY` | unset | Push cases as MISP events (Account → Share). |
| `THEHIVE_URL`, `THEHIVE_KEY` | unset | Push cases as TheHive alerts with observables. |
| `JIRA_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE` | unset, `Task` | Open Jira issues from a case. |
| AI provider keys (see **AI providers** below) | unset | Any number of model providers; they are tried in order and the built-in engine answers when none is configured or all fail. |

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
- **Second factor**: TOTP per RFC 6238 (SHA-1, six digits, 30 s, one step of drift). Secrets are generated server-side and only enabled after a correct code; the password step returns a single-use five-minute challenge token instead of a session, and five wrong codes void it. Users turn it off with their password; admins can remove it.
- **Single sign-on**: OIDC authorization code with PKCE (S256) and a nonce, state kept in a short-lived HttpOnly cookie, discovery from the issuer, id_token verified as RS256 against the provider's JWKS with issuer, audience, expiry and nonce checks (`alg: none` and HS256 are refused). SSO accounts have an empty password hash and cannot sign in with a password. Domain allow-list and admin list are enforced on every sign-in.
- **Files follow their case**: uploads carry `X-Case-Id`; the server refuses uploads into cases the uploader cannot edit and serves a file only when the reader passes `canSee` for that case. Files without a case (older uploads) stay account-only.
- **Legal hold**: only admins can set or clear it (also when a case document arrives through the sync API); held cases cannot be soft-deleted and are skipped by retention; both transitions are logged on the case and audited.
- **Retention and backups**: hard deletion after `CIB_RETENTION_DAYS`; backups are consistent SQLite snapshots (`VACUUM INTO`) written by the scheduler, by `npm run backup`, or from Operations; each is audited with its size.
- **Personal data**: `GET /api/admin/person-data?name=` collects person cards, comments, tasks and log lines naming a person across all cases for access or erasure requests; every lookup is audited with the name queried.
- **AI gateway**: the browser never holds a model key. Prompts go to the server, which calls whichever providers are configured, in order, and falls back to the built-in engine.

### Not done here, and worth knowing

- TLS is terminated by Caddy in `docker-compose.yml` (automatic certificates for `CIB_DOMAIN`); the Node server itself speaks plain HTTP behind it and trusts the proxy's `X-Forwarded-*` headers only with `CIB_TRUST_PROXY=1`.
- The OIDC flow has been exercised against a signed test token, not against a live provider from this environment; the first real login against your provider is the moment to check the claims (`email`, `name`) it actually sends.
- Erasure is manual: the personal-data export tells you where a person appears; removing them is an edit on each case (which is then a revision).
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
| `POST /auth/login/totp` | — | Second step: `{challenge, code}` → session cookie. `POST /auth/login` returns `{totpRequired, challenge}` for accounts with a second factor. |
| `POST /auth/totp/setup`, `POST /auth/totp/confirm`, `POST /auth/totp/disable` | account | Start (secret, `otpauth://` URI, QR SVG), confirm with a code, turn off with the password. `POST /users/:id/totp/disable` for admins. |
| `GET /auth/oidc/start?next=`, `GET /auth/oidc/callback` | anyone | Single sign-on redirect and callback (PKCE, nonce, JWKS verification); 404 when OIDC is not configured. |
| `POST /admin/backup`, `GET /admin/backups` | admin | Write a consistent SQLite snapshot; list the ones kept. |
| `POST /admin/purge` | admin | `{days}` → hard-delete wastebasket cases older than that (legal holds skipped). |
| `GET /admin/holds`, `POST /admin/holds/:id` | admin | List cases with their hold state; `{on}` sets or clears a legal hold and broadcasts the change. |
| `GET /admin/person-data?name=` | admin | Personal-data export for a named person across all cases. |
| `POST /shares`, `GET /shares?caseId=`, `DELETE /shares/:id` | editors of the case | Create (`{caseId, label, days, allowComments}` → token once, 403 for TLP above GREEN), list with views and expiry, revoke. |
| `GET /share/:id?token=` | anyone with the link | Sanitised case (pinned, non-falsified cards; no notes, tasks or internal comments) plus accepted comments; 404 for a bad token, 410 when revoked or expired. Counts a view. |
| `POST /share/:id/comments?token=` | anyone with the link | `{name, text, itemId?}` → pending comment; 403 when the link disallows comments; 30 per link per hour. |
| `GET /comments?caseId=`, `POST /comments` | readers of the case | List (editors see pending and rejected too) and write `{caseId, itemId?, text}`; accepted at once for signed-in accounts. |
| `POST /comments/:id/accept\|reject\|reply` | editors | Moderate a pending comment or reply to an accepted one (`{text}`). |
| `POST /ingest` | account | Raw file body with `X-File-Name`: `.eml`, `.pdf`, text/HTML → `{summary, cards, threads, sources, kind}` in the research-result shape. |
| `POST /ai/draft` | account | `{caseId or case, kind: summary\|takedown\|rfi\|hypotheses, to, ids}` → `{text or hypotheses, engine}`. |
| `GET /store/case/:id/stix.json` | readers of the case | STIX 2.1 bundle of the case with stable ids. |
| `GET\|POST /feeds`, `DELETE /feeds/:id`, `POST /feeds/push` | admin | Manage token feeds (name, `tlpMax`, `confirmedOnly`, `indicatorsOnly`, `tags`, `caseIds`, `webhook`, `everyH`); the token is returned once. |
| `GET /feeds/:id/stix.json\|indicators.csv\|indicators.txt?token=` | token (no session) | Poll a feed; also `Authorization: Bearer <token>`. 404 for a wrong token. |
| `GET /integrations`, `POST /integrations/misp\|thehive\|jira` | account / analysts and admins | Which systems are configured; push `{caseId, ids?, summary?, description?}`. Upstream failures come back as 424 with the upstream status. |
| `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/password`, `DELETE /users/:id` | admin | Manage accounts, roles, TLP:RED grant and case scope; reset passwords (user must change on next sign-in). |
| `GET /store` | signed in | Visible cases (with `rev`), the user's desk and settings documents. |
| `GET /store/case/:id` | signed in | One case (404 when hidden). |
| `PUT /store` | account | `{cases:[…], deleted:[ids], desk, settings}`. Returns accepted (`id`, `rev`, server `number`) and rejected (`id`, `reason`). Identical writes do not bump revisions; stale writes are applied last-writer-wins and audited. |
| `PUT /files/:id`, `GET /files/:id` | editors / readers of the case | Media mirror; body is the raw file with `X-Case-Id`, response carries `sha256`. Served only to people who may see the file's case. |
| `GET\|POST /proxy?url=` | account | Fetch an allow-listed HTTPS URL on the browser's behalf. |
| `POST /ai/complete` | account | `{system, messages, max_tokens}` → `{text, engine}`. |
| `GET /events` | signed in | Server-sent events: `case`, `case-deleted`, `presence`, `notify`, filtered by what the listener may see. |

## How the pages use it

`src/runtime/` holds the glue, none of it in the generated page code:

- `auth.js` exposes `window.CIBAuth` with the same methods the design's `auth.js` had. Synchronous reads come from a cache filled by `init()` before the page renders; writes call the API and update the cache optimistically.
- `store.js` pulls the user's cases into the pages' `localStorage` documents before render, intercepts writes to those keys, pushes changed cases (debounced, per case, with revisions) and applies other people's changes from the event stream unless the same case has unsaved local edits.
- `claude.js` makes `window.claude.complete` call the gateway. `proxy.js` sends CORS-blocked hosts through `/api/proxy`. Media `putBlob`/`getBlob` are mirrored to `/api/files`.

## Working together: merge, history, presence, notifications, review

- **Merged saves.** Every case write carries the revision the client started from. If the server has moved on, the write is merged three ways against that revision: fields the client changed win over fields it did not; cards, threads, groups, snapshots and hypotheses merge per element and per field; an element deleted by one side but edited by the other is kept; the log is a union. Two analysts can work on one board without overwriting each other. The audit line says when a merge happened.
- **Revision history.** Each save stores the previous document (`case_revisions`, last `CIB_REVISIONS_KEEP` = 50 per case). `GET /api/store/case/:id/revisions` lists them, `GET …/revisions/:rev` returns one, `POST …/restore/:rev` (editors) makes it current and keeps the current state in the history.
- **Presence.** Pages post `{caseId, sel, editing}` to `POST /api/presence` every 10 s and on selection change; `GET /api/presence?caseId=` lists who is on a case; `DELETE /api/presence` clears on leave. Updates are pushed as `presence` events. The board shows the strip and a soft-lock notice when someone else is typing in the selected card; nothing is blocked.
- **Notifications.** `GET /api/notifications` (`items`, `unread`), `POST /api/notifications/read` `{ids: [...]|"all"}`. Created by the server for @mentions in new comments (`@Full Name`, `@first_name`, or a unique first name), review requests (to the chosen reviewer, else all reviewers and admins), publish / send-back (to admins and the previous editor) and overdue tasks (hourly scan, once per task, to the task owner by name or the last editor). Pushed as `notify` events to the user's open tabs. `GET /api/users/names` gives every account the names needed for mentions and reviewer selection.
- **Review rule.** When a case moves to *in review* the server records who asked. TLP:RED and AMBER+STRICT files cannot be published from draft, and cannot be published by the account that requested the review; a reviewer or admin with the TLP:RED grant publishes. The board's Activity drawer → Review sends a file to a chosen reviewer.

## Enrichment, watchers, ATT&CK and actors

- **`POST /api/enrich`** `{kind, value, fresh?}`: one lookup per indicator, cached 24 h (`CIB_ENRICH_TTL_H`). IP: RDAP, ASN and geo (ipapi.co), VirusTotal when keyed. Domain / URL / email: Google DNS (A, NS, MX), RDAP registrar and creation date (warns under 30 days), crt.sh certificate count and names, VirusTotal when keyed. CVE: NVD CVSS, publication date, CISA KEV. Hash: algorithm by length, VirusTotal and MalwareBazaar when keyed. Wallet: Bitcoin (blockchain.info) and Ethereum (BlockCypher) balance and transaction count. The response carries `shared: true` and a warning when the owner is a CDN, cloud or code-hosting provider. The board calls it automatically when an indicator is pinned and writes the result onto the card.
- **Watchers**: `GET /api/watchers?caseId=`, `POST /api/watchers` `{caseId, itemId, kind, value, checks:[dns|cert|blocklist|wallet|nvd], interval:1h|6h|24h|7d, webhook?}`, `POST /api/watchers/:id/run`, `PATCH /api/watchers/:id` `{enabled}`, `DELETE`. A scheduler runs due watchers every minute; the first run records a baseline, later runs compare. On change: an unpinned event card is appended to the case (new revision, live event), the watcher's owner is notified, and the watcher's webhook or `CIB_WEBHOOK_URL` receives `{type:"watcher.change", watcher, changes, at}` by HTTPS POST.
- **ATT&CK**: `GET /api/attack` returns the compact matrix `[[id, name, tactic], …]` once an admin has run `POST /api/attack/refresh` (downloads `enterprise-attack.json` from the MITRE CTI repository, `ATTACK_STIX_URL` to override, cached under `CIB_DATA_DIR/attack.json`). The board merges it into its built-in list at load.
- **Actors**: `GET /api/actors`; `POST /api/actors` (upsert by name; analysts and admins), `PATCH /api/actors/:id`, `DELETE /api/actors/:id` (admin), `POST /api/actors/import` with a STIX 2.1 bundle (intrusion-set / threat-actor, `uses` → attack-pattern ids) or a MISP galaxy (`values[]`). Merged into the board's Actor library at load.

## AI providers

The gateway behind `POST /api/ai/complete` (and therefore behind "Analyse with Claude", translate, stance and entities) can use as many model providers as you give it keys for. They are tried in order; a provider that fails (bad key, quota, timeout, empty answer) is skipped and the next one answers, with the failure recorded in the audit line and returned to the client as `tried`. A provider that failed is rested for `AI_COOLDOWN_S` (default 120 s) unless the failure was a 429. Identical prompts are served from a short cache (`AI_CACHE_TTL_S`, default 600 s). The built-in rule engine is always last, so the buttons never dead-end.

| Provider | Configure | Default model (override with the `_MODEL` variable) |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` = `claude-sonnet-5-5` |
| OpenAI | `OPENAI_API_KEY` (`OPENAI_BASE_URL` optional) | `OPENAI_MODEL` = `gpt-4.1-mini` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` (`AZURE_OPENAI_API_VERSION`) | the deployment |
| Google Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `GEMINI_MODEL` = `gemini-2.5-flash` |
| Cohere | `COHERE_API_KEY` | `COHERE_MODEL` = `command-a-03-2025` |
| Mistral | `MISTRAL_API_KEY` | `MISTRAL_MODEL` = `mistral-small-latest` |
| Groq | `GROQ_API_KEY` | `GROQ_MODEL` = `llama-3.3-70b-versatile` |
| OpenRouter (any model behind it) | `OPENROUTER_API_KEY` (`OPENROUTER_SITE`) | `OPENROUTER_MODEL` = `anthropic/claude-sonnet-4` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` = `deepseek-chat` |
| xAI | `XAI_API_KEY` | `XAI_MODEL` = `grok-3-mini` |
| Together | `TOGETHER_API_KEY` | `TOGETHER_MODEL` = `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Perplexity | `PERPLEXITY_API_KEY` | `PERPLEXITY_MODEL` = `sonar` |
| Fireworks | `FIREWORKS_API_KEY` | `FIREWORKS_MODEL` = `accounts/fireworks/models/llama-v3p3-70b-instruct` |
| Ollama (local, no key) | `OLLAMA_MODEL` (`OLLAMA_BASE_URL` = `http://127.0.0.1:11434`) | the model you pulled |
| LM Studio (local, no key) | `LMSTUDIO_BASE_URL` (`LMSTUDIO_MODEL`) | loaded model |
| Any OpenAI-compatible endpoint | `AI_CUSTOM_BASE_URL`, `AI_CUSTOM_API_KEY`, `AI_CUSTOM_MODEL`, `AI_CUSTOM_NAME` | as given |

Order: `AI_PROVIDERS=gemini,anthropic,ollama` puts those first (others follow unless `AI_PROVIDERS_STRICT=1`); `AI_DISABLED=openai` removes one; `AI_TIMEOUT_MS` (default 60000) bounds each call. Model names change often; the defaults are a starting point, not a guarantee that a given account has access to them.

Endpoints: `GET /api/ai/providers` lists the chain (admins also see last status, error and latency); `POST /api/ai/providers/:id/test` (admin) sends a one-word health check through one provider; `PATCH /api/ai/providers/:id` with `{"disabled": true|false}` toggles it at runtime. A request may pin a provider with `"provider": "gemini"`. In the browser `window.claude.preferred = 'gemini'` pins it for that tab, and a toast says which engine answered whenever the gateway fell back.

Keys never leave the server; the pages only ever call `/api/ai/complete`.

## AI research: from a query to cards

The board's **◆ AI research** button (bottom right; Alt+A) opens a panel that researches a case and proposes cards.

1. **Gather.** The server searches Wikipedia, GDELT (world news), Hacker News and, for any CVE in the query, NVD with its CISA KEV status. With keys it also uses Tavily (`TAVILY_API_KEY`), Brave Search (`BRAVE_SEARCH_API_KEY`) or Serper / Google (`SERPER_API_KEY`). URLs you paste (advisories, vendor reports) are read too. Pages are fetched server-side with the same SSRF guard as the proxy, reduced to readable text, de-duplicated and capped.
2. **Extract.** The sources go to the AI gateway with a strict prompt: only state what the sources say, attribute every card to a source index, never invent indicators or dates. The answer is validated (types, kinds, dates, lengths) and each card gets its source, URL, collection date and an Admiralty grade (A for NVD/CISA, B for Wikipedia, C for news). Without a model the rule engine proposes cards from the indicators, named entities, dated sources and ATT&CK ids it finds, and says so.
3. **Review and import.** Cards are grouped by type with confidence; low-confidence ones start unticked. "Add selected to inbox" or "Pin selected to board" creates the cards through the board's own logic (so numbering, custody and the log behave as usual), re-creates the suggested threads, and optionally adds a summary document with the source list. Values already on the board are skipped.

**Manual route (no key on the server, or you prefer Claude in the app):** switch the panel to *Prompt for Claude · paste answer*. Step 1 gathers the sources and copies a complete prompt (system instructions, case context, what is already on the board, the sources, and the exact JSON shape) to the clipboard. Run it in Claude, paste the JSON back, step 3 validates it the same way, and the import works exactly as above. The audit log records both routes.

Endpoints: `POST /api/research` `{query, sources, urls, existing, context}`; `POST /api/research/prompt` (same input, returns `system`, `prompt`, `text`, `sources`); `POST /api/research/parse` `{text, sources}`; `GET /api/research/sources`. Viewers and guests cannot use them; research calls are rate-limited to 10 per minute. `RESEARCH_FETCH_TIMEOUT_MS` (default 15000) bounds each source.

## The built-in analyst engine

Without a model key the gateway still answers the board's four prompts, from rules, and says so in its text:

- **Assess**: parses the prompt the board sends (card, other cards, threads, notes), stamps from the card's status or source, suggests threads to cards that share identifiers (relation chosen from the card types), and proposes next steps per indicator kind.
- **Entities**: regex and pattern extraction for emails, phones, money, dates, CVEs, IPs, hashes, organisations, people, places, vehicles and plates.
- **Stance**: cue-word sentiment and support/oppose phrases, with the most repeated capitalised phrase as the narrative.
- **Translate**: language detection by script and stop-words; the text is returned unchanged with a note, since no translation model is available offline.

Configure any provider above to replace all four with a model.

## Sharing and review

- **Share links** (`server/src/shares.js`): token hashed at rest, expiry and revocation checked on every open, view counter, the case's TLP re-checked on every open so raising a case to AMBER or RED closes its links. The projection in `publicCase()` is the only thing the page receives: pinned, non-falsified cards with their public fields, threads between them, groups, hypotheses, the storyboard, the judgement as summary. Notes, tasks, internal card comments, handling fields and unpinned cards never leave the server.
- **Comments** (`server/src/comments.js`): their own table, never part of the case document, so they do not enter revisions or the three-way merge. Signed-in comments are accepted at once and carry the author's role; guest comments carry the share id and wait for moderation. Editors are notified (`comment` type) and a `comment` server-sent event refreshes open boards. Every write, acceptance, rejection and reply is audited.
- **Public page** (`share.html`): a static page that reads the hash (`id:token`), fetches the projection, and renders without any session. `noindex` is set; the page has no links back into the application.

## Reporting, feeds and integrations

- **STIX** (`server/src/stix.js`): the same mapping the board's export uses, but with ids derived from case and item ids (UUIDv5) so repeated exports and feeds describe the same objects. Falsified items are dropped; hash patterns name the algorithm by length; `hostname` maps to `domain-name`, `filename` to `file:name`.
- **Feeds** (`server/src/feeds.js`): token hashed at rest, scope checked per pull (maximum TLP, confirmed-only, optional case ids or case tags), pull counter and last-pull time; webhook pushes run every 15 minutes for feeds whose interval has elapsed.
- **Integrations** (`server/src/integrations.js`): MISP `POST /events` (attribute types by kind, `to_ids` for confirmed, TLP tag), TheHive `POST /api/v1/alert` (observables with `dataType`, numeric TLP, `ioc` flag), Jira `POST /rest/api/3/issue` (ADF description, labels). Fifteen-second timeout; every push is audited; the page adds a link card and a log line.
- **Ingestion** (`server/src/ingest.js`): a dependency-free MIME parser for `.eml` (encoded words, quoted-printable and base64 parts, Received chain with private ranges skipped, attachments hashed), `pdfjs-dist` for the text layer of PDFs, and the research extractor (model or rules) for text.
- **Drafts** (`server/src/drafts.js`): a digest of the case (notes, judgement, exhibits with numbers, threads, hypotheses) goes to the model with a task-specific prompt; without a model the rules engine writes a factual summary, a letter from the indicator list, or hypothesis candidates from the evidence types present. The engine is returned and logged on the case.

## Deployment

```bash
cp .env.example .env        # set CIB_DOMAIN, optional OIDC_* and provider keys
docker compose up -d        # builds the pages, runs the server as a non-root user, Caddy terminates TLS
```

The image is multi-stage (`Dockerfile`): Vite builds the pages, then a slim Node 22 image runs `server/src/index.js` with `CIB_DATA_DIR=/data` on a named volume and a health check on `/api/health`. `deploy/Caddyfile` proxies to the container and adds HSTS and the usual headers; for a LAN host add `tls internal`. Back up the `cib-data` volume (database snapshots under `/data/backups`, files under `/data/files`). The compose file was not built on the capture machine (no Docker daemon there), so run it once on yours before relying on it.

## Tests

```bash
cd server && npm test
```

`test/sharing.test.js` covers share-link rules (roles, TLP, token once, views, revoke, expiry), the public projection, guest comments with moderation and replies, and team comments without edit rights. `test/reporting.test.js` covers STIX conversion, feed creation, scoping, token checks and the three output formats, the MISP/TheHive/Jira payloads against a mocked HTTP layer, `.eml` and text ingestion, and the four draft kinds. `test/security.test.js` covers TOTP setup, the two-step login, challenge reuse, admin and self disable, RS256 id_token verification (tampering, audience, issuer, expiry, nonce, `alg: none`), SSO account creation and password refusal, per-file access on a TLP:RED case, legal hold through the API and the sync path, retention purge, backups (the snapshot opens as a database) and the personal-data export. The older suites cover setup, CSRF and origin checks, weak passwords, roles and scopes, lockout and reset, server-assigned numbers and revisions, reviewer and viewer limits, guests, files, proxy guards, the local AI shapes, logout and the audit chain. The end-to-end browser run is `node tools/capture/v2.cjs` (see `docs/V2.md`).
