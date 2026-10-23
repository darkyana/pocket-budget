# Unicon

豁免登记表：游离于 token 体系之外的实现例外，规则依据见 `docs/design/design-rules.md`（G1、G3）。每条豁免注明对象、理由与登记日期；豁免失效时删除条目。颜色豁免由本表登记，机器护栏（`scripts/design-scan.mjs`）的内置放行清单与本表保持同步；阶梯的功能性让位登记于 design-scan 的 `SCALE_EXEMPT`。

## 已登记豁免

- **expe-tag（实验版标签）** —— `src/styles.css` 的 `.expe-tag`：一次性实验横幅，终将移除；色值 `#a05a2c` / `#f7ecd9` 特意游离于 token 体系。登记日期：2026-10-23。

## 功能性让位

阶梯维度的功能性让位：为常驻界面元素让出空间，取值不进阶梯。此处登记事实与理由，机器放行在 design-scan 的 `SCALE_EXEMPT`。

- **.phone 底部 padding 130px** —— 内容滚到底也不被固定底栏遮住。登记日期：2026-10-23。
- **.toast bottom 92px** —— 悬浮于固定底栏上方。登记日期：2026-10-23。
