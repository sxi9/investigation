CYBER INVESTIGATION BOARD — BACKEND SPECIFICATION
=================================================
Purpose: give an AI coding agent (or a developer) everything needed to build the
backend that the browser app "Investigation Board.dc.html" is designed to plug
into. The front end currently stores everything in localStorage (key
"cyber-investigation-board.v1", optionally AES-GCM encrypted). The backend
replaces that store, adds multi-user sync, real enrichment pivots, scheduled
re-checks and sharing — the three things the browser cannot do alone.

Read the front end first. Every data shape below is already produced by its
"Export case" button (format "cyber-investigation-board", version 1) and its
STIX 2.1 export. Keep those shapes; do not redesign them.


1. GOALS (in priority order)
----------------------------
1. Multi-user cases: several analysts on one board, live, with presence and a
   per-change audit trail (who, when, what). Conflict-free merging.
2. Enrichment with real API keys, server-side: VirusTotal, Shodan, Censys,
   SecurityTrails / passive DNS, urlscan, AbuseIPDB, GreyNoise, crt.sh, RDAP,
   WHOIS history, NVD/EPSS/CISA KEV, MalwareBazaar/ThreatFox, chain analytics
   (Etherscan/Blockchair/Arkham/Chainalysis or TRM if licensed). Results land
   as cards in the inbox, never as free text.
3. Watchers: re-check selected indicators on a schedule; alert on change
   (new resolution, new certificate, listed on a blocklist, wallet moved funds).
4. Sharing and handling: TLP enforced on every read and export; read-only
   share links; RBAC per case; retention and legal hold.
5. File custody: uploads hashed server-side (SHA-256), virus-scanned, stored
   immutable, served through signed URLs.


2. DATA MODEL (JSON, mirrors the front end exactly)
---------------------------------------------------
Case {
  id, v, number ("CASE 0418"), title, notes,
  tlp: "" | "clear" | "green" | "amber" | "amber+strict" | "red",
  review: "draft" | "in review" | "published",
  signoff: { by, at } | null,
  judgement: { text, confidence: "low"|"moderate"|"high", dissent },
  hypotheses: [{ id, text }],
  ach: { "<itemId>|<hypothesisId>": "C" | "I" | "N" },
  items: [Item], threads: [Thread], groups: [Group],
  snapshots: [{ id, name, t, items, threads, groups }],
  reports: [{ id, t, mode: "full"|"exec", fp: {...fingerprint} }],
  log: [{ t, m }],            // append-only; server must make this authoritative
  dismissed: [ "<itemId>|<itemId>" ]
}
Item {
  id, type: "note"|"link"|"person"|"indicator"|"doc"|"event"|"location"|"ttp"|"tx"|"target"|"photo",
  num (exhibit number, assigned once, never reused),
  title, body, url, value, kind (indicator kind: domain|ip|url|hash|handle|email|wallet|cve|phone; ttp kind = ATT&CK tactic),
  date, tags (comma string), status: ""|"confirmed"|"unverified"|"false",
  chain, amount, txFrom, txTo,                 // tx cards
  sector, region, impact,                      // target cards
  source, collected, srcGrade (A-F), infoGrade (1-6), tlp (per-card override),
  firstSeen, lastSeen,
  fileName, fileHash (sha256), addedBy, addedAt,   // custody
  todo: [{ id, text, owner, due, done, at }],
  comments: [{ id, by, at, text }],
  image (data URL today -> becomes an asset reference, see §5),
  pinned (bool), x, y
}
Thread { id, num, from (itemId), to (itemId), rel: linked|suspected|alias|controls|resolves|located, conf: high|medium|low, why }
Group  { id, title, x, y, w, h }      // membership is geometric: card centre inside rect


3. ARCHITECTURE
---------------
- API: REST + WebSocket (or SSE). Postgres for cases (JSONB per case plus
  normalised tables for items, threads, indicators for cross-case search).
  Object storage (S3-compatible) for files. Redis for presence and job queue.
- Sync model: operation log per case. The client sends operations
  (addItem, upItem, removeItem, addThread, …, exactly the method names in the
  front end's logic class); the server applies them, assigns a monotonic
  version, broadcasts to subscribers. Clients reconcile with last-writer-wins
  per field, except: numbers (`num`) are server-assigned; the log is
  append-only; positions (x, y) are LWW with the moving user's clock.
- Offline: client queues ops and replays; server rejects ops whose base
  version is older than 500 ops and asks for a full case reload.


4. API (v1)
-----------
Auth: OIDC (Okta/Entra/Google) -> short-lived JWT; API keys for integrations.
Roles per case: owner, editor, reviewer, viewer. TLP:RED cases also require
explicit per-user grant.

Cases
  GET    /v1/cases                      list (id, number, title, tlp, review, updatedAt, members)
  POST   /v1/cases                      body: Case (import shape) or { template: "phish"|"crypto"|... }
  GET    /v1/cases/{id}                 full Case
  PATCH  /v1/cases/{id}                 fields: title, notes, tlp, review, judgement, hypotheses, ach
  DELETE /v1/cases/{id}                 soft delete; 30-day retention
  POST   /v1/cases/{id}/ops             [{ op, args, baseVersion, clientId, ts }] -> { version, applied[], rejected[] }
  WS     /v1/cases/{id}/stream          events: op, presence, lock, enrichment, watcher
  GET    /v1/cases/{id}/export?format=json|stix|brief|onepager|png
  POST   /v1/cases/{id}/import          multipart: case JSON, STIX bundle, CSV, MISP event
  GET    /v1/cases/{id}/log             paged audit log (server-authoritative)
  POST   /v1/cases/{id}/snapshots       { name } ; GET list ; POST /{snapId}/restore
  POST   /v1/cases/{id}/share           { expiresAt, tlpCeiling } -> read-only link token

Items / threads (sugar over ops; same validation)
  POST /v1/cases/{id}/items, PATCH /items/{itemId}, DELETE
  POST /v1/cases/{id}/threads, PATCH /threads/{threadId}, DELETE
  POST /v1/cases/{id}/items/{itemId}/merge   { into: itemId }  (re-point threads, union tags/tasks/comments, keep target)

Files
  POST /v1/files                        multipart; returns { assetId, sha256, size, mime, scanned: clean|flagged }
  GET  /v1/files/{assetId}              signed URL, TLP enforced; EXIF stripped for images unless role >= editor

Search
  GET /v1/search?q=…&type=indicator&cases=all   full-text + exact indicator match across all cases the user can read

Enrichment
  POST /v1/enrich                       { indicator: { kind, value }, providers: [...], caseId }
                                        -> job id; results stream over WS and are written as inbox cards
                                        (source = provider name, collected = now, srcGrade from provider map)
  GET  /v1/enrich/providers             which providers have keys and quota left
  Provider mapping (minimum): domain -> VT, urlscan, SecurityTrails(pDNS, WHOIS history), crt.sh, RDAP
                              ip -> VT, Shodan, Censys, AbuseIPDB, GreyNoise, RDAP
                              hash -> VT, MalwareBazaar, Hybrid Analysis
                              url -> VT, urlscan
                              email -> HIBP (licensed), EmailRep
                              wallet -> Etherscan/Blockchair + chain analytics if licensed
                              cve -> NVD, EPSS, CISA KEV
  Keys live in a vault (never in the client). Cache responses 24h keyed by provider+value.
  Rate-limit per org; expose remaining quota.

Watchers
  POST /v1/watchers                     { caseId, itemId, interval: "6h"|"24h"|"7d", checks: ["dns","cert","blocklist","wallet"] }
  GET  /v1/watchers, DELETE /{id}
  Worker runs checks; on change: append log entry, create an "event" card in the inbox
  ("DNS changed: old -> new"), bump item.lastSeen, emit WS event, optional webhook/Slack/email.

Presence
  WS message { type: "presence", user, cursor: {x, y}, sel: itemId } every 2s; server fans out.
  Soft locks: editing a card's text takes a 20s renewable lock; other users see it.

Claude / AI (optional)
  POST /v1/ai/assess                    { caseId, itemId } -> same JSON the front end expects
                                        ({ summary, assessment, threads[], next_steps[] }); keep the
                                        system prompt from the front end ("senior threat-intelligence analyst…").
  Never send TLP:RED case content to a third-party model without an org setting allowing it.


5. MIGRATION OF THE CLIENT
--------------------------
Replace these front-end methods with API calls (names are the real ones):
  initState()  -> GET /v1/cases + GET /v1/cases/{active}
  save()       -> debounced POST /ops (do not post whole cases)
  logEvt(m)    -> stop writing locally; server writes the log from ops
  readImage/fileMeta -> POST /v1/files; store assetId in item.image
  pivots()/osintLookups() -> keep the launchers; add "Enrich" -> POST /v1/enrich
  exportStix/openBrief -> GET /export?format=…
Numbering: `Component.numbered()` becomes server-side; client treats `num` as read-only.
Encryption at rest in the browser becomes unnecessary once data lives server-side;
keep it only for an offline mode.


6. SECURITY AND COMPLIANCE
--------------------------
- TLP is a hard filter: a user without TLP:RED grant never receives RED cases or
  RED-marked cards in search, export or WS broadcasts.
- Every export stamps TLP, case number, user and timestamp; keep an export log.
- Audit log is append-only, hashed in a chain (prev-hash) for tamper evidence.
- Retention: configurable per org; legal hold flag on a case freezes deletion.
- Secrets: provider keys in a vault; rotate; per-org quotas.
- Uploads: AV scan, strip EXIF on export of images unless user opts in,
  immutable storage, SHA-256 verified on write and read.
- PII: person cards are personal data; support export/erasure per subject.


7. NON-FUNCTIONAL
-----------------
- 50 concurrent editors per case, op latency < 300 ms p95.
- Cases up to 5,000 items; search across 10,000 cases < 1 s.
- Backups nightly, point-in-time restore 30 days.
- Observability: per-provider error rates, queue depth, watcher drift.


8. SUGGESTED STACK (not mandatory)
----------------------------------
TypeScript + Fastify (or NestJS) · Postgres 16 (JSONB + pg_trgm) · Redis + BullMQ
for jobs · S3 · WebSocket via ws or Socket.IO · OpenTelemetry. Python workers are
fine for enrichment if the team prefers the security-tooling ecosystem.


9. DELIVERABLES FOR THE AGENT
-----------------------------
1. OpenAPI 3.1 spec for everything in §4.
2. Migrations and schema for §2 with normalised indicator table (kind, value_norm, case_id, item_id) and unique index on (case_id, kind, value_norm).
3. The ops reducer, shared as a package the front end can import, with the exact method names and argument shapes used in the logic class.
4. Enrichment adapters behind one interface: enrich(kind, value) -> Card[] with source, collected, srcGrade.
5. Watcher worker and alert fan-out.
6. Seed script that loads the two sample cases from the front end (Component.sample / sample2).
7. A test that round-trips: Export case JSON -> POST /import -> GET -> deep-equal (ignoring ids).
