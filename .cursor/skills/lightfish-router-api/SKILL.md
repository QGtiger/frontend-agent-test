---
name: lightfish-router-api
description: 在 lightfish-server 的 server/router 下按文件式路由编写或生成 API，Drizzle + ContextWithDb；成功 return 作为 data、错误 throw。于用户要加接口、改 router、api 路径如 user/create 或 user/:id、或询问 router/请求/响应格式时使用。
---

# lightfish 文件式路由 API

## 配置与前提

- `lightfish-server.config.js` 中 `apiDir` 指向 `server/router` 时，该目录为**文件式路由**根目录（见下表）。
- 数据库表在 `server/schema`（如 `index.ts`）用 drizzle 定义；PostgreSQL 使用以应用名为名的 `pgSchema` 前缀，与表定义一致。
- Handler 的 `ContextWithDb` 来自 `@lightfish/server`；通过 `c.get('db')` 取 Drizzle 实例。

## 路径 → 文件映射

| 希望暴露的 API 路径   | 相对 `server/router` 的文件                                        |
| --------------------- | ------------------------------------------------------------------ |
| `.../api/hello`       | `hello.ts`（文件名 = 段名）                                        |
| `.../api/user/create` | `user/create.ts`（多段 = 子目录 + 文件）                           |
| `.../api/user/:id`    | `user/[id]/index.ts`（动态段用 `[param]` 目录，入口为 `index.ts`） |

新增文件后，以实际运行的 API 基址为准（若全局前缀为 `/api`，则上表中的 `.../api/...` 为完整路径）。

## Handler 基本形态

- **默认导出**一个 `async function`，**第一个参数**为 `ContextWithDb`（命名常用 `c`）。
- 需要读 body：`await c.req.json<YourType>()`，并对字段做校验（空值、trim 等）。
- 需要数据库时：

```ts
import type { ContextWithDb } from "@lightfish/server";
import { eq } from "drizzle-orm";
// 从 server/schema 导入表时路径随文件深度变化，见下「import schema 的相对路径」
import { usersTable } from "../schema";

export default async function example(c: ContextWithDb) {
  const db = c.get("db");
  if (!db) {
    throw new Error("Database not configured");
  }
  // select / insert / update / delete …
  return { id: 1 };
}
```

- **动态路由参数**（如 `user/[id]/index.ts`）：在 `@lightfish/server` / Hono 系 API 上通常通过 `c.req.param('id')` 读取；若类型或运行时 API 不同，以 `ContextWithDb` 的类型提示与项目已有 router 为准。

- **Drizzle**：`import { eq, and, ... } from 'drizzle-orm'`；条件查询用 `where(eq(table.col, value))`；`insert`/`update` 时字段名须与 `server/schema` 中**实际列**一致，勿照搬其它项目的示例列名。

## 成功与错误约定

- **成功**：`return` 的**可序列化对象/值**会作为响应体里 **`data` 字段** 的内容，外层形如 `{ success: true, data: … }`（由框架或统一层包装）。
- **失败**：直接 **`throw new Error('说明')`（或框架认可的 Error）**；会被解析为 **`{ success: false, message: … }`** 一类结构，**不要在业务里自己拼 `success: false` 的完整响应体**，除非项目另有明文规定。

## 与现有文件对齐

- 参考同目录下已有实现，例如 `server/router/hello.ts` 的导出名、`ContextWithDb` 与 `c.get('db')` 用法。
- **import schema 的相对路径**（以 `server/schema/index.ts` 为终点）：`server/router/foo.ts` → `../schema`；`server/router/user/create.ts` → `../../schema`；`server/router/user/[id]/index.ts` 多一层目录 → `../../../schema`。原则：从当前文件**逐级 `..` 到 `server/` 再进 `schema`**。

- 从子目录访问 schema 时，数清层数再写，避免写错层数导致模块找不到。

## 浏览器端请求：`apiRequest`

前端（浏览器）通过 `@lightfish/server/api` 提供的 `apiRequest` 发起请求。

```ts
import { apiRequest } from "@lightfish/server/api";
```

### 基本用法

```ts
import { apiRequest } from "@lightfish/server/api";

// GET 请求
const res = await apiRequest("/api/hello");
// res 形如 { success: true, data: { message: "..." } }

// POST 请求（带 body）
const res = await apiRequest("/api/user/create", {
  method: "POST",
  data: { email: "test@example.com", displayName: "Test" },
});
// res 形如 { success: true, data: { id: 1, email: "..." } }

// 动态路径参数（URL 中的 :id 段由后端路由处理，前端只需传实际值）
const res = await apiRequest(`/api/user/${userId}`);
```

### 响应结构

`apiRequest` 返回的是**完整的响应 JSON**（axios 的 `res.data`），即后端返回的整个对象。  
后端 handler `return` 的内容会包装在 `data` 字段中，因此前端拿到的结构形如：

```json
// 成功
{ "success": true, "data": { "id": 1, "email": "..." } }

// 失败（后端 throw new Error）
{ "success": false, "message": "错误说明" }
```

**不需要额外解构 `.data`**，直接使用返回值的 `success` 判断即可：

```ts
const res = await apiRequest('/api/user/create', { method: 'POST', data: { ... } })
if (res.success) {
  // res.data 即 handler return 的内容
  console.log(res.data)
} else {
  // res.message 即错误信息
  console.error(res.message)
}
```

## 检查清单

- [ ] 文件路径是否对应目标 URL（含 `[param]` 与 `index.ts` 规则）
- [ ] 默认导出函数 + `ContextWithDb`
- [ ] 使用 DB 时校验 `db` 存在
- [ ] 返回体为**业务 data**；错误**抛错**而非手搓失败 envelope
- [ ] Schema 中的列名与 `insert`/`select` 字段一致
- [ ] 前端用 `import { apiRequest } from '@lightfish/server/api'` 发起请求
