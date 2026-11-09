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

## Steps

