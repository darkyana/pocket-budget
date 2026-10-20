# AGENTS.md

## Agent skills

### Issue tracker

Issues are local spec files (`spec-issue-*.md`, repo root, never committed); GitHub Issues is read-only history. See `docs/agents/issue-tracker.md`.

### Implementation workflow

Code changes go through an implementation skill, never ad hoc unless the human explicitly asks so. Before building: check for a ticket or spec (`spec-issue-*.md`, repo root), then confirm which skill to run — ask the human when either is unclear.

### Triage labels

Five canonical triage labels, used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Coding standards

Enforced when reviewing changes: neutral messages for privacy/security fixes, fictional vocabulary for sample data. See `docs/agents/CODING_STANDARDS.md`.
