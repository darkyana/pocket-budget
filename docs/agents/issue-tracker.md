# Issue tracker: local spec files

Issues and specs live as local files in the repo root: `spec-issue-<n>-<slug>.md`. They stay local — `.gitignore` covers `spec-issue-*.md`; never commit or push one (specs may summarize real usage).

## Conventions

- **Create**: add `spec-issue-<n>-<slug>.md` in the repo root. `n` = highest number used anywhere + 1 (GitHub history holds #1–#2; #3 shipped as d004fb5, spec since removed).
- **Format**: follow the section skeleton of `spec-issue-1-pace.md` (repo root) — Problem Statement / Solution / User Stories / Implementation Decisions / Testing Decisions / Out of Scope / Further Notes — adapting sections to the need. Open with a status line declaring the file the single design source; on completion, record the commit hash there.
- **Privacy**: validation against real exports records pass/fail only, no figures — CODING_STANDARDS rule 2 applies to specs even though they never leave the machine.

## GitHub Issues: read-only history

#1–#2 exist on GitHub as history. Do not create, comment, or close issues there; `gh issue view`/`list` reads history only.

## When a skill says "publish to the issue tracker"

Create a local spec file (see **Create**).

## When a skill says "fetch the relevant ticket"

Read the matching `spec-issue-*.md` in the repo root.
