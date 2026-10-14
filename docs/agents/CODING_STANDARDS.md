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
