# Version 2: sign-in, the case-files desk, and the board with a server behind it

The second design package added three pages around the board and a long list of board features. This document shows the whole thing running on the new backend (see `BACKEND.md`): accounts and roles, the desk, live sync between analysts, guest access, lockout, and the AI gateway without a key. Every screenshot was taken by `tools/capture/v2.cjs` against a freshly started server; the checks it asserts are listed at the end.

## Pages

| Page | URL | What it does |
| --- | --- | --- |
| Sign in | `/` | First run creates the administrator. Afterwards: name + password, forced password change after an admin reset, "Continue as a guest" when a public case exists, theme picker shared with the other pages. |
| Case files (the desk) | `/desk.html` | Every case the account may see as a manila folder: drawers by state (active, in review, published, archived), drag a folder onto a drawer to move it, flip for the key judgement and open tasks, needs-attention badges, red string between folders that share indicators, morning brief, evidence drop zone, quick add and OSINT hand-off, wastebasket with 30-day restore, colour tabs and tags, export / import, and the **Users & access** panel for admins. |
| Investigation board | `/board.html` | The board from version 1 plus: case modes (investigation, homicide, heist, missing person, KYC, fraud & AML, journalism, litigation, M&A, competitive intel, supply chain, HR/insider, genealogy, plot board, UX research, post-mortem, sales account map), the built-in Whitechapel 1888 worked example, Geo view on a Leaflet map, video / audio / PDF / email / code-log / live-feed / monitor / vehicle / object / statement cards, suspect matrix, court brief, hand-over pack (zip with manifest and hashes), walkthrough recording, radio, notifications, settings, thread styles and custom relations. |

## What the server changes for the user

- **Accounts are real.** Passwords are hashed with scrypt on the server, sessions are HttpOnly cookies that expire after 12 hours or 15 idle minutes, ten wrong passwords lock the account for 15 minutes, and every sign-in, failure and change is in a tamper-evident audit log.
- **Roles are enforced where it matters.** Admin, analyst, reviewer and viewer, with per-user case scope and a separate TLP:RED grant, are checked on every request. A viewer's edit is rejected by the server, not just hidden in the UI; a hidden case is a 404.
- **Cases live on the server.** The pages still read and write their local store, but it is filled from the server before render, every change is pushed per case with a revision, and other people's changes arrive over a live event stream. Two analysts can work on the same board.
- **OSINT works for more sources.** Hosts that refuse browser requests (crt.sh, urlscan, ThreatFox, URLhaus, MalwareBazaar, Wayback, Nominatim, Reddit, …) are fetched by the server through an allow-listed proxy with an SSRF guard; the third-party proxy the design used is gone.
- **The AI buttons work without a key.** "Analyse with Claude", translate, stance and entities go to the server's gateway, which uses the Anthropic API when `ANTHROPIC_API_KEY` is set and a built-in rule-based engine otherwise. The engine labels its answers.
- **Media is kept.** Video, audio, PDF and image blobs are mirrored to a content-addressed file store, so a case opened on another machine still has its files.

## Walkthrough

