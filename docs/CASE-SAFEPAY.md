# Case file: SafePay ransomware (CISA AA26-293A), every feature in use

A second worked case, chosen to exercise **every function of the board** on one real incident: pictures on cards, OSINT lookups, VirusTotal and the other pivots, clusters, merges, snapshots, playback, STIX round trip, encryption and the rest. Each screenshot was captured from the running app by `tools/capture/safepay.cjs`; the yellow numbers mark the controls named under each picture. The automated run asserts that each step actually changed the case (see `docs/case-safepay/case-run.json`).

## The event

On 20 October 2026 the FBI, CISA, the US Secret Service, Germany's LKA Rheinland-Pfalz, the UK National Crime Agency and the UK North West ROCU published the joint **#StopRansomware advisory AA26-293A on SafePay ransomware**. From that advisory:

- **Who and where:** active since August 2024 against businesses and critical infrastructure in North America, South America, Europe and Australia; at least 600 victims; among the most active ransomware groups of 2026.
- **Initial access:** stolen, guessed or brute-forced VPN credentials (often through Mullvad VPN exits) and edge-device vulnerabilities CVE-2020-3259, CVE-2023-20269, CVE-2023-27532, CVE-2024-40711 and CVE-2024-40766.
- **Inside the network:** admin on existing or new accounts, UAC bypass through a COM elevated process, token impersonation; PsExec, WinRM, RDP and RMM tools; ShareFinder.ps1, SharpShares.exe, netscan and NetExec for enumeration; AnyDesk or TeamViewer installed to push the locker.
- **Exfiltration and impact:** data staged with 7-Zip or WinRAR and moved with RClone, FileZilla, WinSCP, Backblaze b2.exe or OneDrive; Volume Shadow Copies stopped and NAS backups factory-reset; a ChaCha20 / RSA locker writes the `.SafePay` extension and deletes itself. The ransom note points to a TOR chat portal and a "representative" also phones the victim; unpaid victims are posted on a leak site.
- **Indicators used on the board:** the advisory's nine IP addresses (for example `88.119.167[.]239`, the soc.dll command-and-control address; `5.255.11[.]134` and `37.10.71[.]188` used in exfiltration; `167.235.225[.]149` hosting client login panels), six SHA-256 and four SHA-1 file hashes (locker.dll, soc.dll, SharpShares.exe, nxc and others), the five CVEs, and the hostnames WIN-SBOE3CPNAL, WIN-3IUUOFVTQAR, WIN-DK18BI83M0S, WIN-I1HRRJHCEIV.

Source: CISA, [#StopRansomware: SafePay Ransomware (AA26-293A)](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-293a), 20 October 2026. Enrichment shown in the screenshots (RDAP registrations, VirusTotal detections, NVD text) was fetched live on 9 November 2026 and is dated on the cards.

## Pictures used as evidence

| File (`docs/case-safepay/evidence/`) | What it is | Card |
| --- | --- | --- |
| `cisa-advisory-aa26-293a.png` | Capture of the advisory page on cisa.gov | Photo |
| `attack-path-diagram.png` | Analyst-drawn intrusion-path diagram from the advisory text (not an original artefact) | Photo |
| `operator-placeholder.png` | Placeholder portrait: no individual is identified | Person |
| `map-lithuania-baltics.png` | OpenStreetMap view of the Baltics; UAB Bacloud (LT) hosts the C2 address | Location |
| `map-falkenstein-de.png` | OpenStreetMap view around Falkenstein; Hetzner CLOUD-FSN1 hosts the login panels | Location |
| `nvd-cve-2024-40711.png` | Capture of the NVD entry for one exploited CVE | reference |

## Feature coverage

| Feature | Where it is used |
| --- | --- |
| Templates, case bar (title, TLP, review, analyst) | S01, S19 |
| Import case JSON / STIX / CSV | S01, S22 |
| Extract IOCs (IPs, hashes, CVEs) → pin / inbox | S02 |
| Evidence inbox: drag to board, Pin, type filters | S03, S14 |
| Paste handler (text → note, URL → link) | S04 |
| Quick add: techniques, events, person, transfer, locations, notes | S05 |
| Photo cards, image upload, chain of custody (SHA-256) | S06 |
| Person / location / target / transfer / document cards with images and fields | S06 |
| Drag to arrange, clusters (create, rename, move, resize) | S07 |
| Connect tool, pin-drag connect, all six relations, thread editor (evidence, confidence, swap, cut) | S08 |
| OSINT workbench: IP (live DNS / RDAP), hash, CVE (live NVD), Pin as card, Copy findings | S09 |
| Pivots (VirusTotal and others in a new tab), Copy defanged, Analyse with Claude | S10 |
| Stamps, Admiralty grading, collected / first / last seen, per-card TLP, tasks with due dates, comments | S11 |
| Actor library drop-in, False lead stamp, Merge duplicates | S12 |
| Threads tab: suggestions accept / dismiss, manual thread | S13 |
| Cross-case search, type filters, Reveal | S14 |
| Timeline and kill-chain layouts | S15 |
| Analysis of competing hypotheses | S16 |
| Audit tab (stale indicators, overdue tasks, unsourced cards, inbox) | S17 |
| Snapshots: save, diff, restore; playback; case log | S18 |
| Key judgement, confidence, dissent, notes, review → published sign-off | S19 |
| Request generator (RFI letter) | S20 |
| Present mode | S21 |
| Case brief, one-pager, STIX export and re-import, board PNG, case JSON, Delete case | S22 |
| Delete + undo, zoom, Fit, panel toggles, encryption at rest, mobile list mode | S23 |

**Verification:** 37 of 37 checks passed.

<details><summary>Check list</summary>

| Result | Check | Detail |
| --- | --- | --- |
| PASS | S01 import an earlier case (JSON) so cross-case search has something to find |  |
| PASS | S01 new case from the Ransomware intrusion template | CASE 0420 · TLP:red · 9 starter cards |
| PASS | S02 Extract IOCs: IPs, SHA-256 hashes and CVEs from the advisory text → pin | 20 pinned → 29 |
| PASS | S02b Extract IOCs again: SHA-1 hashes → inbox (unpinned) | 4 in inbox |
| PASS | S03 inbox: drag one card onto the board, Pin another | drag-and-drop worked; pinned 29 -> 31 |
| PASS | S04 paste text onto the board → note card; paste a URL → link card | note + link pinned |
| PASS | S05 quick add techniques, events, person, target, transfer, document, location | 54 pinned |
| PASS | S06 photo cards with uploaded images (custody hash recorded) |  |
| PASS | S06b person, locations, target, transfer and document cards |  |
| PASS | S07 arrange the board and add three clusters | 3 clusters |
| PASS | S08 threads with every relation type, plus a pin-drag connection | threads 0 -> 18 (pin-drag worked) |
| PASS | S08b thread editor: evidence, confidence, swap, cut; thread label |  |
| PASS | S09 OSINT workbench on the C2 IP (live DNS / RDAP + launchers) |  |
| PASS | S09b OSINT on the soc.dll hash and on CVE-2024-40711 (live NVD) |  |
| PASS | S10 Inspector pivots: open VirusTotal for the C2 IP in a new tab |  |
| PASS | S10b Copy defanged, Analyse with Claude (falls back to a toast outside the Claude app) |  |
| PASS | S11 stamp, Admiralty grade, dates, per-card TLP, tasks with due dates, comments |  |
| PASS | S12 actor library: drop in LockBit for playbook comparison, then merge duplicate technique cards | pinned 57 -> 60 after drop-in and merges |
| PASS | S13 Threads tab: accept one suggestion, dismiss one, add a manual thread | suggestions: 8; threads 22 -> 24 |
| PASS | S14 search across cases, type filters, Reveal |  |
| PASS | S15 timeline and kill-chain layouts |  |
| PASS | S16 ACH on the template hypotheses |  |
| PASS | S17 Audit tab lists stale indicators, overdue tasks, unsourced cards, inbox leftovers |  |
| PASS | S18 snapshot → change → diff → restore; playback; log | log entries 102 |
| PASS | S19 key judgement, dissent, notes, review → published (sign-off) |  |
| PASS | S20 request generator: RFI to the hosting provider |  |
| PASS | S21 present mode |  |
| PASS | S22 case brief and one-pager |  |
| PASS | S22 download: STIX | case-0420-safepay-ransomware-aa26-293a-triage.stix.json |
| PASS | S22 download: Export image | case-0420-safepay-ransomware-aa26-293a-triage.png |
| PASS | S22 download: Export case | case-0420-safepay-ransomware-aa26-293a-triage.json |
| PASS | S22 STIX bundle re-imports as a new case (round trip), then Delete that case | {"report":1,"note":14,"attack-pattern":17,"threat-actor":2,"vulnerability":6,"indicator":19,"x-cryptocurrency-transaction":1,"location":2,"relationship":24,"grouping":4} |
| PASS | S22 CSV import into the inbox | items 62 -> 66 (values already on the board are skipped by the importer) |
| PASS | S23 Delete + undo, zoom, Fit, Inbox / Panel toggles |  |
| PASS | S23b encrypt at rest and unlock |  |
| PASS | S23c mobile list mode |  |
| PASS | no unexpected page errors (OSINT CORS refusals are expected) |  |

</details>

## Steps


### S01 · Start the case

![S01 · Start the case](case-safepay/s01-template.png)

New case → Ransomware intrusion. The template sets TLP:RED, seeds three hypotheses (exposed service, bought credentials, phishing loader), eight starter cards and four tasks. The case is named after the CISA alert code; the analyst name is stamped on everything from here on.

1. New case
2. TLP:RED from the template
3. Case switcher: the imported Okta case is also here
4. Starter cards

### S02 · Pull the IOCs out of the advisory

![S02 · Pull the IOCs out of the advisory](case-safepay/s02-extract.png)

Extract IOCs with the advisory's indicator tables pasted in: nine IP addresses, six SHA-256 hashes and five CVEs are recognised and typed automatically. "Pin selected to board" creates one indicator card each.

1. Extract
2. 20 indicators found

### S03 · Evidence inbox

![S03 · Evidence inbox](case-safepay/s03-inbox.png)

The SHA-1 hashes wait in the evidence inbox. Drag a card onto the board or press Pin; the remaining two stay unpinned (they still count in the Audit tab under "Still in the inbox").

1. Inbox with unpinned evidence
2. Pin (or drag the card onto the board)
3. Type filters

### S06 · Photos and custody

![S06 · Photos and custody](case-safepay/s06-photo-custody.png)

Photo cards: "+ Photo" in the inbox, Pin, then Upload image in the Inspector. The file name, its SHA-256, who added it and when are recorded under Chain of custody. Here the analyst's own attack-path diagram; the other photo is a capture of the CISA advisory page.

1. Upload image (also: drop a file on the board, or paste a screenshot)
2. Chain of custody: file name, SHA-256, added by, added at
3. Photo card on the board

### S06 · Cards with images

![S06 · Cards with images](case-safepay/s06b-cards-with-images.png)

Cards with pictures: the person card shows the uploaded placeholder (no photo on file), location cards carry map captures of the hosting regions found through RDAP, photo cards hold the advisory capture and the analyst diagram. Target and transfer cards print sector, region, impact, amount, from and to.

1. Person card with image
2. Location card with map
3. Transfer card (chain, amount, from, to)
4. Target card

### S07 · Arrange and cluster

![S07 · Arrange and cluster](case-safepay/s07-clusters.png)

The board arranged: dated events and sources down the left, actor / victim / ransom / tooling next, then three clusters: Infrastructure (the nine IPs with the two location cards), Malware & exploited CVEs (hashes and CVEs), and the ATT&CK playbook. Clusters are created with "+ Cluster", renamed in the panel, moved by their label and resized from the corner; cards inside move with them.

1. + Cluster
2. Cluster label: drag to move the group
3. Three clusters

### S08 · Thread the evidence

![S08 · Thread the evidence](case-safepay/s08-threads.png)

Threads: Connect (C) with a relation picked on the toolbar, or drag a card's pin onto another card. Relations used here: controls (affiliate → infrastructure), located at (IP → map), resolves to (soc.dll → its C2), alias of (two locker.dll builds), linked to, suspected. The thread editor records the evidence, confidence, direction, and can cut the thread.

1. Connect tool
2. Relation picker
3. Evidence for this link
4. Confidence
5. Swap direction / Cut

### S09 · OSINT on the C2 IP

![S09 · OSINT on the C2 IP](case-safepay/s09-osint-ip.png)

OSINT on the C2 address 88.119.167[.]239: reverse DNS and RDAP come back live (UAB Bacloud, Lithuania, AS61272); AbuseIPDB, Shodan, Censys, GreyNoise, VirusTotal and the rest open as launchers. "Pin as card" writes the findings into the indicator card.

1. Selector detected as IP
2. Run
3. Copy findings

### S09 · OSINT on a hash

![S09 · OSINT on a hash](case-safepay/s09b-osint-hash.png)

The same workbench with the soc.dll SHA-256: hash lookups go to VirusTotal, MalwareBazaar, Hybrid Analysis and others. Services that refuse browser requests are marked "blocked" with an Open link.

1. Detected as a file hash

### S09 · OSINT on a CVE

![S09 · OSINT on a CVE](case-safepay/s09c-osint-cve.png)

CVE-2024-40711 (Veeam Backup & Replication, exploited by SafePay per CISA): the NVD lookup returns the description and CVSS live; launchers go to CVE.org, CISA KEV, EPSS and vendor advisories. Pin as card keeps the NVD text with the CVE.

1. Detected as a CVE
2. Pin as card

### S10 · Pivots

![S10 · Pivots](case-safepay/s10-pivots.png)

Pivots on the selected indicator open VirusTotal, AbuseIPDB, Shodan, Censys, GreyNoise, urlscan and more in a new tab (the VirusTotal result for this IP is in the next picture: 14 of 92 vendors flag it). "Copy defanged" copies 88.119.167[.]239 for reports. "Analyse with Claude" asks for an assessment when the board runs inside the Claude app; elsewhere it says so.

1. Pivots
2. VirusTotal (opens in a new tab)
3. Analyse with Claude

### S11 · Grade and handle

![S11 · Grade and handle](case-safepay/s11-grading.png)

Grading the C2 address: stamped Confirmed, source A1 (completely reliable, confirmed), collected and first/last seen dates (last seen Aug 2026, so the Audit tab will list it as stale), a per-card TLP:AMBER override on a TLP:RED case, two tasks with due dates (the first is already overdue) and a dated comment.

1. Source + Admiralty grade A1
2. Per-card TLP override
3. First / last seen → staleness

### S11 · Tasks and comments

![S11 · Tasks and comments](case-safepay/s11b-tasks.png)

Tasks with due dates and comments on the same card. Overdue tasks are flagged in the Audit tab.

1. Tasks with due date
2. Comments

### S12 · Actor library

![S12 · Actor library](case-safepay/s12-actors.png)

Actor library. SafePay is not in it, so LockBit (the closest RaaS playbook: exposed services, valid accounts, remote services, encryption) is dropped in as a comparison. Drop in pins the actor plus a technique card per TTP, threaded together.

1. Drop in LockBit

### S12 · Merge duplicates

![S12 · Merge duplicates](case-safepay/s12b-merge.png)

Merge: LockBit's "Exploit Public-Facing Application" duplicates the technique already on the board. Select the duplicate, pick the card to keep under MERGE, press Merge: threads are re-pointed, tags / tasks / comments are unioned and the duplicate is removed (Ctrl+Z undoes it).

1. Merge this card into…
2. Merge

### S13 · Threads tab

![S13 · Threads tab](case-safepay/s13-threads-tab.png)

Threads tab: suggested threads appear when two cards share a tag, indicator or handle (accept or dismiss each), a manual form pins a thread between any two cards, and every thread is listed with its relation and confidence.

1. Threads tab
2. Manual thread

### S14 · Cross-case search

![S14 · Cross-case search](case-safepay/s14-search.png)

Search covers every case: "okta" dims this board (nothing here matches) and lists the hits from the imported Okta vishing case under the search box so you can jump across.

1. Search box

### S14 · Reveal

![S14 · Reveal](case-safepay/s14b-reveal.png)

Reveal (R) with the affiliate card selected: only its direct threads (infrastructure it controls, victims, tools) and second-degree neighbours stay lit.

1. Reveal
2. Selected card

### S15 · Timeline

![S15 · Timeline](case-safepay/s15-timeline.png)

Timeline (T): from first SafePay activity in August 2024 through the IOC window to the advisory on 20 October 2026 and the analyst captures of 9 November; undated cards sit on the shelf.

1. Timeline view
2. Timeline rail

### S15 · Kill chain

![S15 · Kill chain](case-safepay/s15b-kill-chain.png)

Kill chain (K): the thirteen techniques from the advisory fall into their ATT&CK tactic lanes, Initial Access through Impact, with threaded evidence under each.

1. Kill-chain lanes

### S16 · Competing hypotheses

![S16 · Competing hypotheses](case-safepay/s16-ach.png)

ACH with the template's hypotheses: affiliate through an exposed service, credential bought from a broker, phishing with a loader. CISA reports both exposed-service CVEs and stolen credentials, so the first two stay consistent and the phishing-loader hypothesis collects the inconsistencies.

1. ACH matrix

### S17 · Audit

![S17 · Audit](case-safepay/s17-audit.png)

Audit tab: the hygiene backlog. Unconnected cards, indicators without a stamp, events without a date, threads without evidence, stale indicators (last seen beyond 30 days), cards without a source, open and overdue tasks, and what is still in the inbox. Click a row to jump to the card.

1. Audit tab
2. Backlog by category

### S18 · Snapshots and log

![S18 · Snapshots and log](case-safepay/s18-snapshot-diff.png)

Log tab: a named snapshot was saved, then a note was added and a CVE card deleted. Diff lists exactly what changed since the snapshot; Restore puts the board back. Below: playback rebuilds the board card by card in date order, and the append-only log records every action with time and analyst.

1. Snapshots: Save / Diff / Restore
2. Diff against the current board
3. Playback

### S18 · Playback

![S18 · Playback](case-safepay/s18b-playback.png)

Playback running: cards appear in chronological order so you can walk a reviewer through how the picture built up. Pause, scrub with the slider, or Exit.

1. Playback controls

### S19 · Judgement and sign-off

![S19 · Judgement and sign-off](case-safepay/s19-judgement.png)

Notes tab: the key judgement with High confidence and the dissent (several IPs sit in CDN / GitHub / Google ranges and should not be blocklisted blindly). Setting the review state to Published records "Signed off by S. Murugan" with the time; it prints on the brief.

1. Key judgement + confidence + dissent + sign-off
2. Published → signed off
3. Working notes

### S20 · Request for information

![S20 · Request for information](case-safepay/s20-requests.png)

Request generator switched to Request for information, addressed to the Bacloud abuse desk, with the indicators ticked. Open letter renders a printable RFI (next picture) that lists them defanged with the case number, TLP and analyst.

1. Takedown request / RFI
2. Open letter

### S21 · Present

![S21 · Present](case-safepay/s21-present.png)

Present (P): panels hidden, exhibit counter at the bottom, arrow keys step through the numbered exhibits. Esc returns to the board.

1. Exhibit counter

### S22 · STIX round trip

![S22 · STIX round trip](case-safepay/s22d-stix-reimport.png)

The exported STIX 2.1 bundle imported back through Import: indicators, vulnerabilities, attack patterns, threat actor, identities, locations, the transaction, notes, relationships and groupings all come back as a new case (laid out on a grid). The same path accepts bundles from MISP / OpenCTI / vendor feeds.

1. Import (JSON / STIX / CSV)
2. New case created from the bundle

### S23 · Finished board

![S23 · Finished board](case-safepay/s23-focus.png)

Inbox and Panel toggled off for a clean view of the finished board; zoom with the wheel or the − / + buttons, F to fit.

1. Inbox toggle
2. Panel toggle
3. Fit (F)

### S23 · Encrypted at rest

![S23 · Encrypted at rest](case-safepay/s23b-locked.png)

Encrypt saved cases with a passphrase (TLP:RED material should not sit in plain localStorage). The next visit asks for it before anything is shown.

1. Passphrase prompt

### S23 · Mobile

![S23 · Mobile](case-safepay/s23c-mobile.png)

On a phone the same case is a list; Board / List and Panel toggles sit in the top bar.

## Generated documents

### VirusTotal pivot result

![VirusTotal pivot result](case-safepay/s10b-virustotal.png)

What the VirusTotal pivot opened for 88.119.167[.]239 on 9 November 2026: 14 of 92 vendors flag the address; AS61272 UAB Bacloud, Lithuania.

### The RFI letter

![The RFI letter](case-safepay/s20b-rfi-letter.png)

Request for information to the hosting provider, as opened by the request generator.

### The case brief

![The case brief](case-safepay/s22-case-brief.png)

Printable brief: judgement, sign-off, exhibits with stamps and grades, threads with evidence, timeline, tasks, board image.

### The executive one-pager

![The executive one-pager](case-safepay/s22b-one-pager.png)

Judgement, confidence, what happened, next actions.

### The board as exported

![The board as exported](case-safepay/s22c-board-export.png)

What "Export image" downloads for this case.

## Outputs

- `docs/exports/case-04xx-safepay-ransomware-aa26-293a-triage.json` and `.stix.json`: the case and its STIX 2.1 bundle as exported at S22. Import the JSON to get the board back exactly; import the STIX bundle to see the round trip.
- `docs/exports/safepay-hostnames.csv`: the CSV used at S22 to show list import.
- `docs/case-safepay/evidence/`: the pictures uploaded to the cards.

## Reading the result

The finished board separates what CISA attributes to the actor (Bacloud C2, exfiltration hosts, the locker and soc.dll hashes, the five CVEs) from what is only context (CDN, GitHub and Google addresses that appear in the IOC table), carries the analyst's judgement with its dissent, and is signed off. The RFI to the hosting provider and the two overdue tasks are the open items; the Audit tab shows them until they are closed.
