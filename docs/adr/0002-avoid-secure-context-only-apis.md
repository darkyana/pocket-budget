# 0002 非 HTTPS 环境约束：不使用 secure-context-only API

部分 Web 平台 API 仅在安全上下文（HTTPS 或 localhost）可用。本应用的调试形态包含非 HTTPS 的局域网访问（如真机访问开发服务器），该形态下页面不是安全上下文，`crypto.randomUUID()` 会直接抛错。因此流水 id 生成不使用 `crypto.randomUUID`，采用本地合成方案（`src/app/store.ts` 的 `uid`：时间戳 + 序号 + 随机数）。后续引入任何 secure-context-only API（`crypto.subtle`、Clipboard、Notification、getUserMedia 等）时，同样必须确认生产源为 HTTPS，并为非安全上下文提供降级或禁用路径。

## Consequences

- `uid` 的唯一性保证对单设备个人账本足够（同毫秒内靠序号区分），不追求全局唯一。
- 这是**一类约束**而非单点 workaround：安全上下文 API 清单会随功能增长，新增前先查此约束。
