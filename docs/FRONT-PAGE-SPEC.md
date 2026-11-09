CASE FILES — FRONT PAGE SPEC (standalone)
=========================================
Files in this folder
  Case Files.dc.html   the desk (open directly in a browser; keep support.js beside it)
  CaseFolder.dc.html   the folder component the desk imports (keep beside it)
  support.js           runtime the pages load
  FRONT-PAGE-SPEC.txt  this note

What it is
  A landing screen that lists every saved case as a manila folder on a dark desk,
  and opens the board for the chosen case. It reads and writes the SAME browser
  storage as the board (localStorage key "cyber-investigation-board.v1"), so no
  extra storage or API is needed.

Storage shape it reads (written by the board)
  { cases: [Case], activeId, tool, rel, tab, showInbox, showRight, analyst, seeded }
  Case: { id, number "CASE 0418", title, notes, tlp, review, signoff, judgement,
          items[], threads[], groups[], log[{t, m}], snapshots[], reports[] ... }
  If the payload is { enc: 1, salt, iv, data } the cases are encrypted (AES-GCM);
  the page shows a notice and lists nothing until the board has been unlocked.

Navigation contract
  Open  -> writes activeId, then location.href = "<boardFile>#case=<id>"
           boardFile is a prop (default "Investigation Board.dc.html").
           The board reads #case=<id> on load, opens that case and clears the hash.
  Back  -> the board's "← Case files" button sets screen = 'home' (built-in page),
           or link it to "Case Files.dc.html" if you keep the pages separate.

Per-folder data shown
  tab: case number · cover: title, CASE FILE label, review/sign-off meta,
  TLP strip top-right (colour by TLP), stamp Draft / In review / Published,
  counts (exhibits · threads · inbox), last activity (last log entry),
  three latest pinned exhibits as paper sheets peeking out.

Animation
  hover: folder lifts 8px, cover swings open rotateY(-34deg) around its left edge
         (perspective 1100px), papers rise 14px, shadows deepen.
  open:  cover to -70deg, lift + scale 1.08, fade out, then navigate after 460ms.
  entrance: folders fade/slide in staggered 70ms; stamps "slam" in.
  background: lamp pulse 6s; grain overlay.

Actions
  per folder: Open, Rename (inline), Duplicate (new number, review reset to draft),
              Export (case JSON), Delete (confirm).
  global:     Analyst name (persisted), Save now (shows last saved time),
              Load / Import (case JSON: single case or { cases: [...] }),
              Export all (one JSON), New case (blank; the board's template picker
              is the richer path).

Integration notes for the backend build
  - Replace load()/save() with GET /v1/cases and the ops API; everything else
    is presentation.
  - Keep case numbers server-assigned ("CASE nnnn", next = max + 1).
  - Deleting is soft on the server (30-day retention); the page just removes
    the folder.


Added in v2 (the desk)
  Drawers by state: ACTIVE (draft) / IN REVIEW / PUBLISHED / ARCHIVED. Click the
    drawer bar to open or close; drag a folder onto a drawer to change its state
    (sets case.review / case.archived, publishing signs with the analyst name).
  On my desk: case.desk = true pins a folder to the top row.
  Sort and filter: text filter, sort select, TLP chips. Preferences persist in
    localStorage key "cyber-investigation-board.desk.v1" together with
    visits (per-case last-opened time), trash, lamp, drawer open state.
  Colour tabs (case.color) and tags (case.tags) per folder.
  Flip: the back cover shows key judgement, confidence and top three open tasks.
  Thumbnail: SVG mini-board (cards as rects by type colour, threads as red lines)
    replaces the paper sheets when a case has 2+ pinned cards; toggle to sheets.
  Needs-attention badges: overdue tasks, stale indicators (>30 days), unstamped
    indicators, awaiting review.
  Activity sparkline: log entries per day, last 30 days.
  Red string: hovering a folder draws string to every folder sharing an indicator
    value or an actor; unrelated folders dim.
  Seen in more than one file: strip of indicators present in 2+ cases.
  Morning brief: per case, log entries newer than the last time it was opened
    from the desk; Mark all read stores the visit time.
  Evidence drop zone: drop files / text / paste anywhere on the desk, choose the
    file, items land in that case's inbox (photo, doc, link, indicator, note).
  Quick add + OSINT: the input files an auto-detected item under the chosen case;
    OSINT opens the board with #osint=<selector>, which the board honours.
  Wastebasket: deleted cases wait 30 days with Restore / Destroy.
  Atmosphere: desk calendar, coffee ring, lamp switch (noir / bright),
    CLASSIFIED cover sheet when opening TLP:RED or AMBER+STRICT, zoom + fade
    into the board.
