# DevBus

DevBus is a Claude Code mod for a multi-session Claude dev team. It sits on the native session bus
and makes the sessions' communication structured, cheap and safe:

- **Envelopes.** Messages carry pointers (#issue, #pr, sha, path), capped at 600 chars, with secrets scrubbed.
- **No model turn for routine traffic.** ACK, HEARTBEAT, ROSTER, STATUS and duplicates are handled by the mod.
- **Deterministic routing.** The Lead's mod polls GitHub for `state:planned` issues and sends each one to the
  session that owns it by `type:*` / `size:*` / `lane:*` labels, batching `size:S` work. It can spawn
  missing sessions on their configured model.
- **Guardrails.** No merging, no force-push, no push to main. Tags and releases need Ops plus the person's
  `/devbus-approve-release`. Write scopes apply per role, and dev lanes warn on out-of-lane edits.
- **Token budgets.** Usage is tracked per request from every model response. The session gets a warning at 80%,
  and at 100% its tool calls are blocked until it reports `BUDGET`.
- **Board.** A pane, a status line (`devbus · role · #task · tokens/budget`) and `/devbus-usage` for the pilot.

Design: [`docs/sdlc/DESIGN.md`](../../docs/sdlc/DESIGN.md) §2A and §4. Config: [`docs/sdlc/sdlc.config.json`](../../docs/sdlc/sdlc.config.json) (`devbus` section).

## Install

Sessions that clone this repository get it automatically: `.claude/settings.json` adds the marketplace
and enables `devbus@mycode-devbus`. That marketplace is read from the repository's default branch, so
this works once the mod is merged to `main`. To install by hand, at the prompt of a terminal session:

```
/plugin install devbus --marketplace ghazamu/mycode
```

From a shell: `claude plugin install devbus --marketplace ghazamu/mycode`. For development, run from the
folder: `claude --plugin-dir tools/devbus`.

## Roles

Each session needs a role: `lead`, `dev-core`, `dev-edge`, `dev-utility`, `qa` or `ops`. It's set by one of:
1. a `ROSTER` message from the Lead addressed to that role (normal case, after the Lead spawns the session);
2. the model calling `bus_set_role` once (role prompts say to);
3. the person typing `/devbus-role <role>`;
4. the `DEVBUS_ROLE` environment variable.

After a role is set, only the person can change it.

## Model tools

| Tool | Who | What |
|---|---|---|
| `bus_send` | all | Send `TASK`, `STATUS`, `BLOCKED`, `REVIEW_REQ`, `REVIEW_RESULT`, `CI_FAIL`, `ESCALATE`, `APPROVAL_REQ`, `DONE`, `BUDGET` to a role or `*` |
| `bus_board` | all | Role, current task and tokens, roster with staleness, items needing attention |
| `bus_set_role` | all | Set the role once |
| `bus_roster_set` | Lead | Record `role → session_id` after `create_session`, then broadcast the roster |
| `bus_route` | Lead | Route planned issues now instead of waiting for the next poll |

## Commands (for the person)

`/devbus` (board), `/devbus-role <role>`, `/devbus-roster <role> <session_id>`,
`/devbus-approve-release vX.Y.Z` (person only), `/devbus-usage` (tokens per request by kind vs. the 464k baseline),
`/devbus-route`.

## Develop

```
claude plugin validate tools/devbus
claude plugin test tools/devbus
```

The routing, budget and guard rules are pure functions in `hooks/lib/policy.ts`. The envelope format is in
`hooks/lib/envelope.ts`. Hooks and UI are in `hooks/register.tsx`.

## Known limits (check during the pilot)

- **Cloud addressing.** Messages go out through `$.session.send({ sessionId })`. If the native bus refuses
  a cloud session id, the mod falls back to the remote-session server's `send_message`.
- **GitHub tool schemas.** The router calls the GitHub MCP server's `list_issues` and `issue_write` (method
  `update`). If that server's argument names differ, routing reports the error on the board and leaves
  issues `state:planned`.
- **Usage logs.** Each session writes `.devbus/usage.jsonl` in its own container (gitignored). The Lead also
  collects totals from `DONE` messages, so `/devbus-usage` in the Lead session covers the whole team.
