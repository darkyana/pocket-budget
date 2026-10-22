# Issue tracker: GitHub — private planning repo

Issues and specs for this repo live in the **private** repo `darkyana/planning`, labeled `product:pocket-budget`. Use the `gh` CLI for all operations — always with `-R darkyana/planning`, because the working directory's default remote is this **public** repo and a bare `gh issue …` would hit the wrong place.

## Where tickets live

- Specs and tickets for this repo live in the private repo `darkyana/planning`, labeled `product:pocket-budget`. Read the issue you're given from there.
- **Never create issues, comments, or spec text in this public repo.** Issues #1–#2 here are read-only history; leave them alone.
- Only work on issues labeled `ready-for-agent`. If an issue is `stage:idea` or `stage:spec`, stop and ask the human; don't guess the requirements.
- PR title and description stay short and product-facing; reference the issue only as `darkyana/planning#6`. Don't paste the private spec.
- In the PR, list how each point of the issue was met so the human can check it.

## Conventions

- **Create an issue**: `gh issue create -R darkyana/planning --label product:pocket-budget --title "..." --body "..."`. Use a heredoc for multi-line bodies. Add `type:*` and `stage:*` labels as they fit.
- **Read an issue**: `gh issue view <number> -R darkyana/planning --comments`.
- **List issues**: `gh issue list -R darkyana/planning --state open --label product:pocket-budget --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> -R darkyana/planning --body "..."`.
- **Apply / remove labels**: `gh issue edit <number> -R darkyana/planning --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> -R darkyana/planning --comment "..."`.

## Labels

Two vocabularies, both defined in `darkyana/planning`:

- **Triage roles** (see `docs/agents/triage-labels.md`): `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. The `ready-for-agent` label is the gate: no label, no build.
- **Lifecycle**: `stage:idea` → `stage:spec` → `stage:ready` → `stage:building` → `stage:done`, plus `type:bug` / `type:feature` / `type:refinement` and `product:<repo>` scoping.

## Privacy boundary

`darkyana/planning` stays private indefinitely. That privacy ends at the planning repo: nothing from an issue body — figures, account names, spec text — appears in this public repo (commits, PR text, code comments, ADRs). CODING_STANDARDS rules 1–2 still apply to everything public-facing.

## Pull requests

PRs target this public repo only. Keep title and description short and product-facing; reference the issue as `darkyana/planning#<n>`; never paste the private spec; include a point-by-point list of how each point of the issue was met.

**PRs as a triage surface: no.** _(Set to `yes` if this repo starts treating external PRs as feature requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create an issue in `darkyana/planning` (see **Create an issue**).

## When a skill says "fetch the relevant ticket"

`gh issue view <number> -R darkyana/planning --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets. All operations below target `darkyana/planning`.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create -R darkyana/planning --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api -R darkyana/planning` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's native issue dependencies, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/darkyana/planning/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/darkyana/planning/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list -R darkyana/planning --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> -R darkyana/planning --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> -R darkyana/planning --body "<answer>"`, then `gh issue close <n> -R darkyana/planning`, then append a context pointer (gist + link) to the map's Decisions-so-far.
