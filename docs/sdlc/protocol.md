# DevBus/1 — quick reference for agents

Send every bus message with the `bus_send` tool (DevBus mod). `bus_board` shows your role, task budget and the roster.
The raw SendMessage tool is refused unless the text is an envelope. Never paste code, diffs or
logs into a message. Cite `#issue`, `#pr`, SHAs and `path:line` instead.

```
[DEVBUS/1] id=<ulid> type=<TYPE> from=<role> to=<role|*> task=#<issue> pr=#<pr|-> sha=<short|-> reply=<id|->
<summary, at most 600 chars: what happened / what you need>
```

| Type | When to send it |
|---|---|
| `TASK` | Lead assigns an issue. Includes spec path and branch name |
| `ACK` | Automatic (mod). Don't send it by hand |
| `ROSTER`, `HEARTBEAT` | Automatic (mod) |
| `STATUS` | Milestones only: PR opened, ready for review, done |
| `BLOCKED` | You need a decision. Give options **A / B** and your recommendation |
| `REVIEW_REQ` | Dev → QA: PR is ready (CI green, self-reviewed) |
| `REVIEW_RESULT` | QA → Dev (cc Lead): `approve` or `changes`. Details go in PR review comments |
| `CI_FAIL` | Ops → Dev: job name, failing test, log line range |
| `ESCALATE` | Next tier up the path: ops → dev → lead → human |
| `DONE` | Task merged and closed |
| `BUDGET` | Automatic (mod) |

Rules
1. GitHub is the source of truth. If it isn't in an issue or PR, it didn't happen.
2. One message per milestone. Don't send a chatty play-by-play.
3. Reply to a message by setting `reply=<id>`.
4. If a message is unclear, check the referenced issue or PR before asking.
