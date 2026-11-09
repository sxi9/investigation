# Cyber Investigation Board — full package

Open **Login.dc.html** first (keep every file in this folder together; `support.js`, `auth.js` and `foley.js` are loaded by the pages).

## Files
- Login.dc.html            sign-in / first-run admin setup (auth.js: browser-local accounts, roles, sessions)
- Case Files.dc.html       the desk: case folders, drawers, morning brief, drop zone, users & access (admin)
- CaseFolder.dc.html       folder component used by the desk
- Investigation Board.dc.html  the board: cards, threads, OSINT workbench, media, maps, feeds, analysis, exports
- auth.js                  accounts / roles / sessions (replace with OIDC per BACKEND-SPEC.txt §4, §10)
- foley.js                 synthesised sound effects (no audio files)
- support.js               runtime the pages need
- BACKEND-SPEC.txt         what the backend must provide (data model, API, roles, sync, integrations)
- frontpage/FRONT-PAGE-SPEC.txt  desk behaviour spec
- github.md, README.md     project notes

## Keys on the board
V move · C connect · T timeline · K kill chain · G geo · R reveal · P present · F fit · O OSINT · / quick add · Del · Ctrl+Z

## Modes
Investigation, Homicide, Heist/robbery, Missing person, KYC, Fraud & AML, Journalism, Litigation, M&A, Competitive intel, Supply chain, HR/insider, Genealogy, Plot board, UX research, Post-mortem, Sales account map. "▶ Example: Whitechapel 1888" seeds a worked homicide case.

## Notes for the build
- Everything persists in localStorage (cases, desk, settings, users) and IndexedDB (media blobs). The backend spec maps each store to a server resource.
- Claude-powered tools (analyse, translate, stance, entities) call window.claude.complete; route them through your LLM gateway.
- Live lookups use public endpoints that allow browser access; move them server-side with keys (VirusTotal, Shodan, passive DNS, chain analytics).
