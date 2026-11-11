# Cyber Investigation Board

A noir-style investigation board for intelligence work: pinned evidence cards, red-thread links, IOC extraction, ATT&CK techniques, an OSINT workbench, analysis of competing hypotheses, case briefs and STIX 2.1 export, plus (version 2) a sign-in page, a case-files desk, case modes, maps, media cards, live feeds and a suspect matrix. A small secured server holds accounts, roles, cases, files, an enrichment proxy and the AI gateway.

![Investigation Board](docs/screenshots/01-overview.png)

- **[Walkthrough 8](docs/V8.md)** — the storyboard: scenes built from the timeline or drafted by the model, played, printed, in the brief and on the public page.
- **[Walkthrough 7](docs/V7.md)** — share links with a public read-only page, guest comments with moderation, reviewer comments without edit rights.
- **[Walkthrough 6](docs/V6.md)** — push to MISP, TheHive and Jira, scheduled STIX feeds, email and PDF ingestion, AI drafts (summary, takedown, hypotheses), weighted ACH, timeline by time of day, quick-add and placement fixes.
- **[Walkthrough 5](docs/V5.md)** — two-factor sign-in, OIDC single sign-on, per-file TLP access, legal hold, retention, backups, personal-data export, Docker + Caddy TLS deployment.
- **[Walkthrough 4](docs/V4.md)** — enrichment on pin, watchers with webhooks, duplicate finder, the full ATT&CK matrix and an editable actor library.
- **[Walkthrough 3](docs/V3.md)** — AI research (query → attributed cards, manual Claude route), the multi-provider gateway, presence and soft locks, merged edits, revision history, mentions and review rules.
- **[Version 2 walkthrough](docs/V2.md)** — sign-in, the desk, roles, live sync between analysts, guest access, lockout, AI without a key, with screenshots.
- **[Backend](docs/BACKEND.md)** — how to run the server, what is secured and how, the API, the multi-provider AI gateway, **AI research** (query → sources → cards, with a manual Claude round-trip), the built-in analyst engine, tests.

- **[Feature guide](docs/FEATURES.md)** — every function with a labelled screenshot.
- **[Worked investigation](docs/TUTORIAL.md)** — a real October 2026 campaign (vendor-themed Okta / ServiceNow vishing against e-commerce SaaS providers) built up step by step, with instructions.
- **[Case file: SafePay ransomware](docs/CASE-SAFEPAY.md)** — a second real case (CISA advisory AA26-293A) that uses every feature: pictures on cards, OSINT on IPs / hashes / CVEs, VirusTotal and other pivots, clusters, merges, snapshots, playback, STIX round trip, encryption.
- **[Improvements log](docs/IMPROVEMENTS.md)** — problems met while building the cases, and the features or data that would fix them.
- **PDFs:** [CASE-SAFEPAY.pdf](docs/CASE-SAFEPAY.pdf) (the case process, one step per page), [TUTORIAL.pdf](docs/TUTORIAL.pdf), [IMPROVEMENTS.pdf](docs/IMPROVEMENTS.pdf). Rebuild any of them with `node tools/make-pdf.mjs docs/<file>.md`.
- **[Backend specification](docs/BACKEND-SPEC.md)** — data model and API for a multi-user server behind this front end.
- **[Verification report](docs/feature-check.json)** — the automated run that produced the screenshots, with a pass/fail line per feature.

## Run it

```bash
npm install && npm run build
```

```bash
cd server && npm install && npm start
```

Open `http://127.0.0.1:8787/`. The first visit creates the administrator account; add analysts, reviewers and viewers from the desk's **Users** panel. For development run the server and `npm run dev` in the root (Vite proxies `/api`). Configuration, security notes and the API are in [docs/BACKEND.md](docs/BACKEND.md). Fonts load from Google Fonts; map tiles from OpenStreetMap.

## Keys

`V` move · `C` connect · `T` timeline · `K` kill chain · `R` reveal · `P` present · `F` fit · `O` OSINT · `/` quick add · `Del` remove · `Ctrl+Z` undo · `Esc` close / deselect

Quick-add commands: `d` domain · `i` ip · `h` hash · `m` email · `w` wallet · `cve` · `@` handle · `u` url · `e <date> <title>` event · `n` note · `p` person · `t T1566.004` technique · `l` location · `c` cluster. Without a command the value is auto-detected.

## How the code is organised

| Path | What it is |
| --- | --- |
| `design/*.dc.html`, `design/auth.js`, `design/foley.js` | The version-2 design files (Claude Design export): Login, Case Files, CaseFolder, Investigation Board, the browser-only auth prototype (replaced by the server) and the sound module. `design/v1/` keeps the first board. |
| `tools/convert-template.mjs`, `tools/pages.json` | Converts the design pages' template dialect (`{{ }}`, `sc-if`, `sc-for`, `dc-import`, `style-hover`) into plain JSX, one folder per page, with the route and runtime patches listed in the script header. Re-run after editing a design file. |
| `src/pages/<page>/` | **Generated** per page: `App.jsx` (template), `logic.js` (the design's logic class), `settings.js` (property-panel defaults), styles, and `index.jsx` (the React host). |
| `src/runtime/` | The glue to the server: `auth.js` (`window.CIBAuth`), `store.js` (localStorage ↔ server sync, live events, media mirror), `claude.js` (AI gateway), `proxy.js` (CORS-blocked hosts), `boot.jsx`. |
| `src/dc.js` | The logic base class, the style helper and the React host that renders a template from `renderVals()`. |
| `index.html`, `desk.html`, `board.html` | The three pages. |
| `server/` | Fastify + SQLite backend: accounts, sessions, roles, case store, files, proxy, AI gateway, events. `npm test` runs its API tests. |
| `docs/` | Guides, specs, screenshots, sample exports, PDFs. |

### Regenerating from the design files

```bash
node tools/convert-template.mjs
```

The converter needs Playwright's Chromium (it parses the templates with a real DOM). It rewrites everything under `src/pages/`. The logic classes are the design files' scripts with the patches listed in the converter's header (routes, the enrichment proxy, media mirroring, server-mode seeding, login copy).

### Fixes applied to the first design's logic

Found while exercising every feature of version 1 in a browser (the version-2 design file already contains them): board export / case brief / one-pager crashed when the case had a cluster, and the passphrase lock screen crashed on load. See `docs/IMPROVEMENTS.md`.

## Regenerating the screenshots and guides

The feature guide and the tutorial are produced by scripts that drive the built app in headless Chromium, assert each feature worked, and draw the labels on the captures. They need Playwright with Chromium available to `require('playwright')`.

```bash
npm run build
npx vite preview --port 4173
```

```bash
node tools/capture/features.cjs
```

```bash
node tools/capture/tutorial.cjs
```

```bash
node tools/capture/safepay.cjs
```

```bash
python3 tools/capture/compress.py
```

```bash
node tools/write-docs.mjs
```

The first script writes `docs/screenshots/*.png` and `docs/feature-check.json`; the second writes `docs/tutorial/*.png`, `docs/tutorial/tutorial-run.json` and the sample exports in `docs/exports/`; the third writes `docs/case-safepay/` (it uploads the pictures in `docs/case-safepay/evidence/`); the last two shrink the PNGs and rebuild `docs/FEATURES.md`, `docs/TUTORIAL.md` and `docs/CASE-SAFEPAY.md` from the captions recorded during the runs.

## Notes

- "Analyse with Claude", translate, stance and entities go through the server's AI gateway, which can chain Anthropic, OpenAI, Azure OpenAI, Gemini, Cohere, Mistral, Groq, OpenRouter, DeepSeek, xAI, Together, Perplexity, Fireworks, Ollama, LM Studio or any OpenAI-compatible endpoint, falling back in order and ending with a built-in rule-based engine (see `docs/BACKEND.md`, AI providers).
- OSINT sources that refuse browser requests are fetched through the server's allow-listed proxy; anything not on the list stays a launcher link.
- On a brand-new server the first board opened seeds the two sample cases ("Operation Lantern", "Binance $6.3B heist"); later users start with a blank case.
- The feature guide, tutorial and SafePay case documents were captured on version 1 of the board; every function shown there is still present in version 2.
