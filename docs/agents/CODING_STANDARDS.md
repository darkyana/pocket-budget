# Coding Standards

Enforced during review, not implementation. Two judgment-type rules; mechanical guarantees (sensitive-term scan) live in the pre-commit hook (`scripts/privacy-scan.mjs` + local `.privacy-blocklist`), not here.

## 1. Neutral messages for privacy and security fixes

When a commit repairs a privacy or security issue, the message describes the shape of the change, never the leak it repairs. Naming the removed data, its location, or the fix intent points readers at the diff and hands them the recovery recipe — the message itself becomes the leak's index.

- Bad: `fix: remove real bank card numbers from integration doc`
- Good: `docs: update sample data formats`

**Check**: read the commit message alone. If a reader could reconstruct what was leaked, or where, from the message text, it fails.

## 2. Fictional vocabulary for sample data

Seed data, fixtures, test data, doc examples, and placeholder copy use the fictional vocabulary only. Real-world specifics — actual bank names, account names, employers, household expenses — appear nowhere, not even as "realistic" flavor.

Canonical vocabulary (source of truth: `src/core/seed.ts`): 储蓄卡, 备用金, 宠物粮, 物业费, 家政服务, 会员年费, 电子钱包, 示例公司, 示例银行.

**Check**: grep any new sample data for real-world specificity. A name that identifies a real bank, company, or the owner's household fails. The pre-commit scan catches known terms; this rule covers terms nobody has leaked yet.

## 3. No comments in code

Default: no comments. No JSDoc/TSDoc that restates types, no TODOs, no section banners, no change-history notes. Clear names, types, and tests carry the "what". The "why" lives where it stays true: the commit message, the PR's point-by-point description, ADRs for architectural calls, `GLOSSARY.md` for vocabulary. Comments are a third copy of the truth — they drift from the code and then mislead every reader.

Allowed only when code cannot express it:

1. License / legal headers.
2. Public API contract docs.
3. A one-line why for a proven external/platform constraint or domain invariant.
4. An issue/ADR link.

Never narrate what the next line does, mark a change ("added for X"), or explain confusing code with a comment — rename, extract, or add a type instead.

**Check**: any new `//`, `/* */`, or `/** */` block in a diff fails unless it fits an allowed case. Test names (strings inside `describe`/`it`) are not comments and stay.

## 4. Migrations never delete records

流水是唯一事实源。Schema migration 只做字段级搬迁和设置结构调整，就地升级。任何删除、过滤或破坏性重建流水的迁移路径都不过 review。

**Check**: touched migration code drops/filters records → fail. Mechanical guard: the 「迁移不丢流水」 test in `src/storage/migrate.test.ts`.