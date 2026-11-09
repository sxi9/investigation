# Walkthrough 3: AI research, many model providers, and working together

This walkthrough covers what was added after the server: the **AI research** panel that turns a query into attributed cards (with a manual route through Claude), the **multi-provider AI gateway**, and the **collaboration** layer: presence and soft locks, merged concurrent edits, revision history with restore, @mention notifications, review requests and the second-account rule for TLP:RED files. Screenshots come from `tools/capture/v3.cjs` run against a fresh server; the checks it asserts are listed at the end.

## In short

| Feature | Where | What it does |
| --- | --- | --- |
| AI research | Board, ◆ AI research (Alt+A) | Gathers Wikipedia, GDELT news, Hacker News, NVD/KEV (and Tavily / Brave / Serper when keyed, plus pasted URLs), reads the pages on the server, proposes cards and threads with source, grade and confidence, imports what you tick into the inbox or onto the board. |
| Prompt for Claude, paste answer | Same panel, second tab | When the server has no model key: copies a complete prompt (instructions, case context, existing cards, sources, JSON shape) for Claude; the pasted answer is validated and imported the same way. |
| Model providers | Server environment | Anthropic, OpenAI, Azure OpenAI, Gemini, Cohere, Mistral, Groq, OpenRouter, DeepSeek, xAI, Together, Perplexity, Fireworks, Ollama, LM Studio, custom; tried in order with cooldown and cache; admins can list, test and disable them at runtime. The rule engine is the last resort. |
| Presence and soft locks | Board, top strip | Who is on the case, which exhibit they are on, who is typing in it; a notice when you select a card someone else is editing. |
| Merged edits | Server | A stale save is merged three ways against the revision the client started from: different fields and different cards from two analysts both survive; a deletion loses to a concurrent edit. |
| History | Activity drawer → History | Every save is a server revision; restore any of them, the current state stays in the history. |
| Notifications | Activity drawer | @mentions in comments, review requests, overdue tasks (hourly scan), watcher alerts; pushed live, with unread count; click to jump to the card. |
| Review requests and the TLP:RED rule | Activity drawer → Review | Send a file to a chosen reviewer; TLP:RED / AMBER+STRICT files must pass through review and be published by a different account than the requester. |

## Walkthrough

