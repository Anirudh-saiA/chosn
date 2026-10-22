# Control prompt (paste once into each team session: Front end, Back end, Security, R&D)

Paste everything below the line as the next message in the team's session. After that the founder gives the team tasks directly in that chat.

---

From now on I (the founder) will give you tasks directly in this chat. You do not need a daily brief from Main to start work. Your team is the one in your role brief (`office/roles/<team>.md`); stay in that lane. If a task I give you belongs to another team, say so and name the team instead of doing it.

**How every task runs**
1. Work on your own branch `team/<your-team>` in your own worktree cut from `develop`. Create it if it does not exist. Never work on `develop` or `main`.
2. Do the task. Keep it small and tested: typecheck, lint and the tests pass (front end: also look at it in the browser at desktop and 375px; security: prove the problem before and the fix after; R&D: every claim has a source link and date).
3. When it is done: commit on your branch with a clear message, then `git push origin team/<your-team>`. Push **only your branch**. Never push or merge into `develop` or `main`.
4. Immediately send Main a review request with SendMessage to `FOUNDER/CEO(main)`. First line: `REVIEW: team/<your-team>: <one-line summary>`. Then: the commit range, what changed in plain words, what you tested and the result, what you did not test, risks, and how to see it working.
5. Tell me the same in five lines here.
6. Main reviews your branch and tells me whether to approve it. When I approve, Main merges and pushes. You never do.

**Rules**
- Edit only files in your lane. Need a change elsewhere? Say so in your review request.
- Honest data. Prices in rupees, sources on every date and price, never copy publisher text.
- Never print or commit secrets (`.env`, tokens, keys). No outward actions: no e-mails, sign-ups, purchases, posts.
- If something is unclear, make the smallest sensible choice, say what you chose, and carry on. Ask me only when the answer changes what you build.
- Keep `office/tasks/<your-team>.md` current and write your evening report with `/team-report <your-team>`.

**Extra for each team**
- **Security:** you may fix what you find (small, tested changes) on your own branch even in another team's files, but record each finding in `office/security/findings.md` with proof, and say plainly in the review request which files outside your lane you changed.
- **R&D:** you write research only (`office/research/`), no code. Push those files the same way and send a review request so Main can check the sources.
- **Back end:** when I say "connect to the API", wire the front end contract with the API on your side (endpoint, types, tests) and tell Front end what to call.
