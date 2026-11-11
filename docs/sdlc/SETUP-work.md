# Setup: work setup (terminals + Session Bus)

This file turns [`DESIGN-work.md`](DESIGN-work.md) into a runnable setup. **You** start a few
terminals and paste one prompt. Then the **Lead (Opus)** reviews the design and sends every
remaining setup task to the session that should do it, over Session Bus. You approve the plan
and the PRs, and do the few steps only a person can do.

**Your steps:** step 0 (copy the kit) and step 1 (start four terminals), then answer the Lead
when it asks for approvals, a `START_SESSION`, or one of the person-only steps marked 👤 in the task list.

---

## 0. Copy the kit into the work repo 👤 (once, ~2 minutes)

From the work repo's root, on a new branch:

```bash
git checkout -b sdlc-setup
git clone --depth 1 -b claude/multi-session-workflow-design-5iqytw https://github.com/ghazamu/mycode /tmp/sdlc-kit
mkdir -p docs/sdlc .sessions
cp -r /tmp/sdlc-kit/docs/sdlc/{DESIGN-work.md,SETUP-work.md,protocol.md,sdlc.config.json,roles,templates} docs/sdlc/
cp /tmp/sdlc-kit/docs/lessons.md docs/
cp -r /tmp/sdlc-kit/.sessions/. .sessions/
mkdir -p docs/sdlc/reference && cp -r /tmp/sdlc-kit/tools/devbus/hooks/lib docs/sdlc/reference/devbus-lib
git add docs .sessions && git commit -m "Add multi-session SDLC kit"
```

- Don't copy `tools/devbus/`, `.claude-plugin/` or `.claude/settings.json` from the kit. DevBus
  must not run alongside Session Bus. `docs/sdlc/reference/devbus-lib` is only reference code for porting.
- If your network can't reach GitHub, download the branch as a zip on another machine and copy the same files.
- Don't copy the kit's `docs/sdlc/repo-map/`. It describes the personal repo. Setup task S4 writes maps for the work repo.

## 1. Start the terminals 👤

The Lead runs in the repo folder itself (on `sdlc-setup`). Give each worker its own worktree
and branch so terminals don't switch branches under each other:

```bash
git worktree add -b sdlc-setup-dev-core    ../<repo>-dev-core    sdlc-setup
git worktree add -b sdlc-setup-dev-utility ../<repo>-dev-utility sdlc-setup
git worktree add -b sdlc-setup-ops         ../<repo>-ops         sdlc-setup
```

Workers create a branch per task from there; the worktree branch is only their starting point.

| Terminal | Folder | Command | Then |
|---|---|---|---|
| Lead | the repo folder | `claude --model claude-opus-5-5` | Assign role `lead` in Session Bus, paste **Prompt L** |
| Dev-Core | `../<repo>-dev-core` | `claude --model claude-sonnet-5-5` | Assign role `dev-core`, paste **Prompt W** |
| Dev-Utility | `../<repo>-dev-utility` | `claude --model claude-haiku-5-5` | Assign role `dev-utility`, paste **Prompt W** |
| Ops | `../<repo>-ops` | `claude --model claude-haiku-5-5` | Assign role `ops`, paste **Prompt W** |

QA and Dev-Edge aren't needed until the Lead asks (`START_SESSION`). QA reviews the Session Bus
code in S8, and Dev-Edge is only needed after setup. Use the model names your organization shows in `/model`.

Before pasting, replace **`<SEND_TOOL>`** with the tool or command your Session Bus uses to send a
message, and **`<ASSIGN_ROLE>`** with how it assigns a role. Those are the only two names the
sessions need from you. Everything else is mapped during setup (S2).

### Prompt L (Lead, Opus)

```
You are the LEAD of a multi-session Claude dev team for this repository, running in its own terminal. Other sessions run in their own terminals and talk over Session Bus: send with <SEND_TOOL>; roles are assigned with <ASSIGN_ROLE>. Running now: lead, dev-core (Sonnet), dev-utility (Haiku), ops (Haiku). You cannot start sessions: ask me with START_SESSION role=<role> model=<model> reason=<task id>.

Your job now is to implement docs/sdlc/DESIGN-work.md by running the setup in docs/sdlc/SETUP-work.md.

1. Read docs/sdlc/SETUP-work.md fully, then docs/sdlc/DESIGN-work.md. Don't read other files unless a task needs them.
2. Task S0 (yours): review DESIGN-work.md. Write docs/sdlc/setup-review.md as a findings list (section, problem, severity, proposed fix), not a rewrite, then tell me it's ready. Wait for my approval before changing anything or dispatching tasks.
3. After I approve: create docs/sdlc/setup-status.md from section 3 of SETUP-work.md (one row per task: id, owner, status, PR, tokens). Dispatch tasks in dependency order with <SEND_TOOL>: type=TASK, from=lead, to=<owner>, task=<id>, and a summary of at most 600 characters that points to the task's row in SETUP-work.md section 3. Never paste the task text; the owner reads it from the file.
4. Track replies, update setup-status.md, unblock with decisions, and send me APPROVAL_REQ for each PR and for each step marked 👤.
5. Keep your context small: read diffs only for the review checkpoints listed in section 3. Write .sessions/lead/handoff.md at each milestone.

Never merge, never push to the protected branch, never bypass my approvals. Ask me only for decisions or approvals, with options A/B and a recommendation.
```

### Prompt W (workers: Dev-Core, Dev-Utility, Ops; later QA, Dev-Edge)

```
You are the <ROLE> session of a multi-session Claude dev team for this repository, running in its own terminal. Sessions talk over Session Bus: send with <SEND_TOOL>. The Lead (Opus) coordinates.

1. Read docs/sdlc/roles/<role>.md and follow it for this entire session. Where it says DevBus or bus_send, use Session Bus and <SEND_TOOL> until task S3 updates the files.
2. Read docs/sdlc/protocol.md, and .sessions/<role>/handoff.md and memory.md if they have content.
3. Wait for a TASK from the Lead. Each TASK names a setup task id (S1, S2, ...). Read only that task's row in docs/sdlc/SETUP-work.md section 3, plus the files it lists as inputs.
4. Work on your own branch, open a PR for your output, then reply to the Lead with <SEND_TOOL>: type=DONE (or BLOCKED with options A/B), task=<id>, pr=<number>, plus a summary of at most 600 characters with your tokens used. Pointers only, no pasted content.
5. Stay within the task's token budget. At the budget, write .sessions/<role>/handoff.md, send BUDGET to the Lead and stop.

Reply only: "<role> ready".
```

---

## 2. What happens next (no action from you except approvals)

1. The Lead writes `docs/sdlc/setup-review.md` (task S0) and asks you to approve it. Read it, approve or comment.
2. The Lead dispatches S1–S10 in order, tracks them in `docs/sdlc/setup-status.md`, and sends you an
   `APPROVAL_REQ` for each PR and each 👤 step.
3. When S10 passes, the setup is done. The pilot (DESIGN-work.md §5.5) starts with real requests.

---

## 3. Setup tasks (the Lead dispatches these)

Budgets are per task, in tokens. "Review" means who checks the output before you get the PR.

| ID | Task | Owner (model) | Depends on | Inputs | Output / done when | Budget | Review |
|---|---|---|---|---|---|---|---|
| **S0** | Review the design: gaps, contradictions, risks for this repo and Session Bus | lead (Opus) | — | `DESIGN-work.md` | `docs/sdlc/setup-review.md`, a findings list approved by you 👤 | 300k | you |
| **S1** | Audit Session Bus against R1–R9: what it already does, the tool or command names, and what's missing | dev-core (Sonnet) | S0 | Session Bus source or docs; DESIGN-work.md §4 | `docs/sdlc/session-bus-audit.md`: one row per R with *has / partial / missing*, the name, and evidence (file:line) | 400k | lead |
| **S2** | Fill in Appendix A for this repo: A.1–A.3 from the repo's conventions, A.4 from the S1 audit | dev-core (Sonnet) | S1 | DESIGN-work.md Appendix A; S1 audit; repo layout (labels, branches, docs folders) | Appendix A **Your setup** column filled; open questions listed for the Lead | 300k | lead decides open questions; you approve the PR 👤 |
| **S3** | Apply the mapping: rename paths, labels, tools and commands across the kit | dev-utility (Haiku) | S2 merged | Appendix A (filled); `docs/sdlc/roles/*.md`, `protocol.md`, `sdlc.config.json`, `templates/`, `SETUP-work.md` prompts | Every old name replaced; `grep` for each old name returns nothing (list the commands in the PR) | 300k | lead (skim) |
| **S4** | Write lane repo maps for this repo: `core.md`, `edge.md`, `utility.md` + `README.md`, ≤ 60 lines each; set `lanePaths` in config | dev-core (Sonnet) writes core + edge; dev-utility (Haiku) writes utility | S2 merged | Repo tree; `docs/sdlc/roles/dev-*.md`; old maps as format examples (kit `docs/sdlc/repo-map/`) | Maps committed; every top-level folder belongs to exactly one lane | 400k (core+edge), 150k (utility) | lead |
| **S5** | Repo plumbing: create the labels (DESIGN-work §6), add Claude Code permission rules denying merge, force-push and protected-branch push, add `CHANGELOG.md` if missing, keep `.sessions/` and templates | ops (Haiku) | S3 merged | DESIGN-work §6, §7 step 5; Appendix A.2–A.3 | Labels exist (`gh label list`); `.claude/settings.json` deny rules in a PR | 200k | lead |
| **S6** 👤 | Protect the main branch: 1 human approval, required CI, no force push | **you** | — | DESIGN-work §6 | Branch protection on | — | — |
| **S7** | Close Session Bus gaps: for each R marked *partial/missing* in S1 that the Lead decides to build, port from `docs/sdlc/reference/devbus-lib` (`envelope.ts`, `policy.ts`) into Session Bus, with tests | dev-core (Sonnet) | S1, Lead's build list | S1 audit; reference lib; Session Bus source | One PR per requirement; tests pass; requirements not built have their fallback noted in DESIGN-work §4 | 600k per requirement | QA (S8) |
| **S8** | Review the Session Bus changes from S7: correctness, tests, guard bypasses | qa (Sonnet), Lead sends `START_SESSION qa` | S7 PR | S7 diff; DESIGN-work §4 | `REVIEW_RESULT` approve or changes per PR | 250k per PR | lead (Opus deep review only if a guard (R5) or release approval (R8) changed) |
| **S9** | Finish the kit docs: remove the "use Session Bus in place of DevBus" substitution notes, make the setup prompts final, record the fallbacks in use | ops (Haiku) | S3, S7 decided | DESIGN-work.md; SETUP-work.md; S1 audit | Docs consistent with the audit and the mapping | 200k | lead (skim) |
| **S10** | Dry run: 6 small labelled sample issues (one per request type in §2A), routed and finished end to end; measure tokens | lead (Opus) coordinates; each owner does its sample | S3–S9 | DESIGN-work §2A, §5.5 | Every sample reaches the right session and finishes within budget; tokens recorded in `setup-status.md`; problems become lessons in `docs/lessons.md` | 50k (lead) + each sample's normal budget | you approve the result 👤 |

**Order:** S0 → S1 → S2 → (S3, S4, S6 in parallel) → S5 → S7 → S8 → S9 → S10. S7 and S8 are skipped
for any requirement where Session Bus already passes, or where the Lead chooses the fallback.

**Expected setup cost** (estimate): ~4–7M tokens in total, roughly 10% on Opus (S0, reviews, S10
coordination), 70% Sonnet (S1, S2, S4, S7, S8), 20% Haiku (S3, S4 utility, S5, S9).

---

## 4. If something goes wrong

| Problem | What to do |
|---|---|
| A worker doesn't answer | Check its terminal. If it's closed, restart it in its worktree (`claude --continue`, or a new session plus Prompt W); it resumes from its handoff |
| Session Bus can't address a role yet | Until S1/S7 sort it out, forward the Lead's `TASK` text to the worker's terminal yourself |
| A task goes over budget | The worker writes its handoff and sends `BUDGET`; the Lead splits the task or reassigns it |
| The Lead's review finds a blocking design problem | Decide on the Lead's options; it updates DESIGN-work.md in a small PR before dispatching |
