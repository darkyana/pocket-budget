# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live in the private repo `darkyana/planning` (label `product:pocket-budget`), never in this public repo. Agents only pick up issues labeled `ready-for-agent`; `stage:idea`/`stage:spec` means stop and ask the human. See `docs/agents/issue-tracker.md`.

### Implementation workflow

Code changes go through an implementation skill, never ad hoc unless the human explicitly asks so. Before building: fetch the ticket from `darkyana/planning` (see `docs/agents/issue-tracker.md`), then confirm which skill to run — ask the human when either is unclear. PRs stay short and product-facing: reference the issue as `darkyana/planning#<n>`, never paste the private spec, and list point-by-point how the issue was met.

### Triage labels

Five canonical triage labels, used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

`docs/audits/` holds dated, baseline-pinned snapshot audits. They are evidence of how the code behaved at the recorded commit — never current behavior, never spec. Before citing one, check applicability against its baseline (diff command is in each audit's header).

### Coding standards

Enforced when reviewing changes: neutral messages for privacy/security fixes, fictional vocabulary for sample data, no-comment defaults for code. See `docs/agents/CODING_STANDARDS.md`.
