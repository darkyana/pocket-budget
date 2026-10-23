# Unicon

豁免登记表：游离于 token 体系之外的实现例外，规则依据见 `docs/design/design-rules.md`（G1、G3）。每条豁免注明对象、理由与登记日期；豁免失效时删除条目。机器护栏（`scripts/design-scan.mjs`）按本表放行。

## 已登记豁免

- **expe-tag（实验版标签）** —— `src/styles.css` 的 `.expe-tag`：一次性实验横幅，终将移除；色值 `#a05a2c` / `#f7ecd9` 特意游离于 token 体系。登记日期：2026-10-23。
