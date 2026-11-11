# Walkthrough 7: sharing and review

Cases used to leave the board only as files. This round lets people outside the team read a case and talk back, without ever touching the case document: a share link opens a clean read-only page for one case, readers may comment through it, and those comments wait for an analyst's decision. Reviewers and viewers inside the team get the same comment channel on the board, so review no longer needs edit rights or email. Screenshots come from `tools/capture/v7.cjs` against a fresh server; the checks are listed at the end.

| Feature | Where | What it does |
| --- | --- | --- |
| Share link | Account → Share (analysts, admins) | Token URL for one case, with label, expiry (1–365 days) and a comments switch. Only TLP:CLEAR and TLP:GREEN cases. Views are counted; Revoke ends it at once. |
| Public page | `share.html#id:token` | Brief-style page: TLP, summary, chronology, exhibits by type (defanged), hypotheses, accepted comments, the storyboard when there is one. No login, no notes, tasks, internal comments, falsified or unpinned cards. |
| Guest comments | public page | Name plus text, about the case or one visible card. Stored in their own table, rate-limited per link, pending until accepted. Editors are notified. |
| Team comments | Activity → comments (board) | Anyone who can see the case comments without edit rights; comments appear at once with the author's role. Nothing is written into the case document, so the three-way merge never sees them. |
| Moderation | Activity → comments (editors) | Accept, Reject, Reply. Accepted comments and replies show on the public page; rejected ones stay private; every decision is audited. |

## How to use it

1. **Share**: open the case on the board, **Account → Share**, give the link a label and expiry, tick *allow comments* if you want to hear back, *Create link*. It is copied to the clipboard; paste it to the recipient.
2. **Read**: the recipient opens the link in any browser. If the case is later set to TLP:AMBER or RED, the link stops working.
3. **Comment**: readers write under *Leave a comment*; team members use **Activity → comments** on the board. Select a card first to attach the comment to it.
4. **Moderate**: the Activity button shows how many comments wait. Accept, reject or reply from the comments tab.
5. **Close**: *Revoke* in Account → Share. The page then says the link was revoked.

