# Walkthrough 8: the storyboard

A board is for the analyst; a story is for everyone else. This round turns a case into scenes: what happened, in order and with dates; what we found; what we assess, with confidence; what we ask for. Scenes are built from the timeline in one click or drafted by the model, edited in place with the cards that back them, played slide by slide for a briefing, printed one scene per page, printed as a chapter of the case brief, and shown on the public page from the share link. Screenshots come from `tools/capture/v8.cjs` against a fresh server; the checks are listed at the end.

| Feature | Where | What it does |
| --- | --- | --- |
| Story panel | board toolbar → Story | Scenes with title, kind, date range, caption and the cards that back them. Add, reorder, delete; "Add selected card" pins the board's selection to a scene. |
| Build from timeline | Story panel | One scene per day of dated cards (merged into spans when there are many), then *What the evidence shows*, *Assessment* and *What we ask for* from the indicators, judgement and open tasks. |
| Draft with AI | Story panel | The model writes scenes with captions citing exhibits; without a key the rules engine builds the same structure. Appends to or replaces the scenes you have. |
| Play | Story panel | Full-screen playback, one scene at a time, arrow keys or buttons; Esc returns. Made for a briefing room. |
| Print | Story panel | One scene per page with the exhibits as tiles, for a hand-over or a leadership pack. |
| Brief chapter | Case brief | A *Story* section before the timeline, with each scene's kind, dates, caption and exhibits. |
| Public page | share link | The storyboard appears at the top of the shared page, scene by scene, with the exhibits it rests on. |

## How to use it

1. Open the case on the board and press **Story** (next to Kill chain).
2. **Build from timeline** or **Draft with AI** to get a first set of scenes; then edit titles and captions, change a scene's kind, and add or remove cards.
3. **Play** to present it; **Print** for a PDF; the case brief and any share link pick the story up automatically.

