# Walkthrough 6: reporting, integrations and AI beyond the buttons

The last round of the roadmap takes the case out of the board and brings documents in. Cases push to MISP, TheHive and Jira in one click; token-protected STIX feeds let a TIP, SIEM or firewall poll the indicators on a schedule; emails and PDFs become proposed cards; the model (or the rules engine when there is none) drafts the executive summary, the takedown letter and the competing hypotheses from the whole case; the analysis-of-competing-hypotheses grid gains evidence weights that the brief prints; the timeline orders a day by time; and the small irritations noted in `docs/IMPROVEMENTS.md` are fixed. Screenshots come from `tools/capture/v6.cjs` against a fresh server with a stand-in MISP/TheHive/Jira (`tools/capture/mock-tip.cjs`); the checks are listed at the end.

| Feature | Where | What it does |
| --- | --- | --- |
| Push to MISP / TheHive / Jira | Account → Share | MISP event with typed attributes (`to_ids` for confirmed), TheHive alert with observables and TLP, Jira issue with the case reference. A link card and a log line are added to the case. Keys live in the server environment. |
| STIX feeds | Account → Share (admin) | Token URLs serving a STIX 2.1 bundle, CSV or plain indicator list, scoped by maximum TLP and confirmed-only, with pull counts; optional https webhook push every N hours. Per-case bundle at `/api/store/case/:id/stix.json`. |
| Documents in | AI research → From a file | `.eml`: event card plus sender, reply-to mismatch, first external relay, links, attachments (SHA-256 and file name) with threads between them. `.pdf` and text: entity and indicator extraction, with the model when one is configured. Nothing lands until you import. |
| AI drafts | AI research → Drafts | Executive summary appended to the notes; takedown or RFI letter opened as a page; competing hypotheses added to the ACH grid. Every draft cites exhibits and is logged with the engine that wrote it. |
| ACH weights | ACH grid, Case brief | Click ×1 on a row to weight that evidence ×2 or ×3. Scores become weighted inconsistency; the brief prints them and names the leading hypothesis. |
| Timeline time of day | Timeline view, brief | Cards on the same day are ordered by their time; the chronology table prints it. |
| Quick add | board | `f file.exe` and `host name` kinds, `?` lists every command, unknown commands are refused instead of becoming notes, hash cards say MD5 / SHA-1 / SHA-256 in the brief and letters. |
| Placement and Esc | board | New pinned cards land in a free spot next to the board instead of a pile in the centre; Esc closes a panel even while the cursor is in a text box. |

## How to use it

1. **Share a case**: open the case on the board, **Account → Share**. Buttons appear for each system configured on the server (`MISP_URL`/`MISP_KEY`, `THEHIVE_URL`/`THEHIVE_KEY`, `JIRA_URL`/`JIRA_EMAIL`/`JIRA_TOKEN`/`JIRA_PROJECT`). Falsified indicators are never sent.
2. **Feed a firewall or TIP**: as admin, create a feed in the same tab, copy the one-time token, and point the consumer at `…/indicators.txt?token=…` (or `.csv`, or `stix.json`). Remove the feed to revoke.
3. **Bring a document in**: **AI research → From a file**, pick the `.eml` or `.pdf`, review the proposals, untick what you do not want, import to the inbox or straight to the board.
4. **Let the model write**: **AI research → Drafts**, choose Summary, Takedown, RFI or Hypotheses, *Draft it*, read, then apply. With no model key the rules engine writes a plain but factual version from the case.

