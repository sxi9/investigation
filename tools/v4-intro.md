# Walkthrough 4: enrichment that runs itself

Indicators used to be looked up by hand, one at a time, in the OSINT workbench. This round makes the board do the routine work: every indicator is enriched when it is pinned, watchers re-check indicators on a schedule and raise the alarm when something changes, duplicates are found and merged in one click, and the technique and actor libraries can be as complete as MITRE's. Screenshots come from `tools/capture/v4.cjs` against a fresh server; the checks are listed at the end.

| Feature | Where | What it does |
| --- | --- | --- |
| Enrichment on pin | automatic; Activity drawer → Enrich | RDAP owner, ASN, country; DNS, registrar, domain age, certificate log; CVSS and CISA KEV; wallet balance; VirusTotal / MalwareBazaar when keyed. Written onto the card; 24 h server cache; `shared-infra` tag and warning for CDN, cloud and code-hosting ranges. "Enrich all pending" and "Refresh selected" for existing boards. |
| Watchers | Activity drawer → Watch | Per indicator: interval (1 h to 7 days), checks (DNS, certificate, blocklist, wallet, NVD), optional webhook. On change: event card in the case inbox, notification, webhook. "Run now" for an immediate check. |
| Duplicate finder | Activity drawer → Dupes | Same indicator value, technique id or title grouped; merge into one keeps the pinned card, re-points threads, unions tags, tasks, comments. |
| ATT&CK matrix | Activity drawer → Actors (admin) | Downloads the full MITRE Enterprise matrix once; every `T-id` typed into quick add then resolves to its name and tactic, and the kill-chain view lanes it. |
| Actor library | Activity drawer → Actors | Add or update actors, import STIX intrusion sets / threat actors or a MISP galaxy; merged into the board's Actor library (Drop in works for them). |

## Walkthrough

