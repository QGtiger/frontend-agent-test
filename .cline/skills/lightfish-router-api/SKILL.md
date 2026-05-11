---
name: lightfish-router-api
description: 本项目的 API 采用约定式路由（Convention-based Routing），通过文件系统目录结构自动映射为 URL 路径。只有目录下的 index.ts 或 index.js 会被识别为路由入口文件。动态路由参数使用 [paramName] 格式的目录名表示。Handler 使用 ContextWithDb 类型，通过 c.get('db') 获取 Drizzle 实例。成功 return 业务数据、错误 throw ServerError。
---

# lightfish-server API 路由约定

## 概述

本项目采用**约定式路由**（Convention-based Routing），通过文件系统目录结构自动映射为 URL 路径。开发者只需按照约定的目录和文件命名规则创建文件，路由系统会自动扫描并注册路由。

## 核心规则

### 1. 路由入口文件

只有目录下的 **`index.ts`** 或 **`index.js`** 才会被识别为路由文件。其他 `.ts` / `.js` 文件（如 `helper.ts`、`utils.ts`、`service.ts` 等）不会被扫描为路由。

### 2. 目录结构映射 URL 路径

```
routes/                    # apiDir 配置指向的目录
  index.ts              →  /              （根路由）
  users/
    index.ts            →  /users
    [id]/
      index.ts          →  /users/:id
  posts/
    index.ts            →  /posts
    [postId]/
      index.ts          →  /posts/:postId
      comments/
        index.ts        →  /posts/:postId/comments
```

### 3. 动态路由参数

使用 `[paramName]` 格式的目录名表示动态参数：

- `[id]/index.ts` → `/:id`
- `[slug]/index.ts` → `/:slug`
- `[userId]/posts/index.ts` → `/users/:userId/posts`

动态参数值通过 `c.get('params')` 获取，例如 `c.get('params').id`。

## Handler 基本形态

### 类型导入

```typescript
import type { ContextWithDb } from "@lightfish/server";
```

`ContextWithDb` 是 `Context<AppEnv>` 的别名，其 `Variables` 包含：

- `db?: NodePgDatabase` — Drizzle ORM 实例
- `params: Record<string, string>` — 动态路由参数

### 基础 Handler

```typescript
// routes/hello/index.ts
import type { ContextWithDb } from "@lightfish/server";

export default async function hello(c: ContextWithDb) {
  return { message: "Hello World" };
}
```

### 读取请求体

```typescript
// routes/user/create/index.ts
import type { ContextWithDb } from "@lightfish/server";

export default async function createUser(c: ContextWithDb) {
  const body = await c.req.json<{ name: string; email: string }>();
  // 校验字段
  if (!body.name?.trim()) {
    throw new Error("Name is required");
  }
  // ... 业务逻辑
  return { id: 1 };
}
```

### 使用数据库

```typescript
// routes/user/create/index.ts
import type { ContextWithDb } from "@lightfish/server";
import { eq } from "drizzle-orm";
import { usersTable } from "../../schema";

export default async function createUser(c: ContextWithDb) {
  const db = c.get("db");
  if (!db) {
    throw new Error("Database not configured");
  }

  const body = await c.req.json<{ name: string; email: string }>();

  const [user] = await db
    .insert(usersTable)
    .values({
      name: body.name,
      email: body.email,
    })
    .returning();

  return user;
}
```

### 动态路由参数

```typescript
// routes/user/[id]/index.ts
import type { ContextWithDb } from "@lightfish/server";
import { eq } from "drizzle-orm";
import { usersTable } from "../../../schema";

export default async function getUser(c: ContextWithDb) {
  const db = c.get("db");
  if (!db) {
    throw new Error("Database not configured");
  }

  const { id } = c.get("params");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, Number(id)));
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
```

### HTTP 方法约束

路由文件可以导出 `method` 字段来限制允许的请求方法：

```typescript
// 仅允许 GET 请求
export const method = "GET";

// 允许多种方法
export const method = ["GET", "POST"];

export default async function handler(c: ContextWithDb) {
  // ...
}
```

## 服务端请求其他 API（apiRequest）

在 Handler 中如果需要请求当前项目或其他项目的 API，可以使用 `@lightfish/server/api` 提供的 `apiRequest` 方法。

```typescript
import { apiRequest } from "@lightfish/server/api";

// 请求当前项目的其他路由，注意路径不要带 /api 前缀
const users = await apiRequest("/users");
const user = await apiRequest(`/users/${id}`);

// POST 请求
const newUser = await apiRequest("/users", {
  method: "POST",
  data: { name: "Alice", email: "alice@example.com" },
});
```

`apiRequest` 会自动拼接 `SERVER_API` 和 `appName`，因此只需传入相对于当前 app 的路径即可（以 `/` 开头，不带 `/api` 前缀）。

## 成功与错误约定

### 成功响应

`return` 的**可序列化对象/值**会作为响应体里 **`data` 字段**的内容，外层由框架统一包装：

```json
{
  "success": true,
  "data": { "id": 1, "name": "Alice" },
  "code": 200
}
```

### 错误响应

直接 **`throw new Error('说明')`** 或 **`throw new ServerError('说明', code?)`**：

```typescript
import { ServerError } from "@lightfish/server/shared";

// 默认 400 业务错误
throw new ServerError("用户不存在");

// 自定义业务码
throw new ServerError("余额不足", 1001);
```

会被框架统一捕获并返回：

```json
{
  "success": false,
  "message": "用户不存在",
  "code": 400
}
```

**不要在业务里自己拼 `success: false` 的完整响应体**，除非项目另有明文规定。

## import schema 的相对路径

以 `server/schema/index.ts` 为终点，从当前文件**逐级 `..` 到 `server/` 再进 `schema`**：

| 路由文件位置                         | import 路径       |
| ------------------------------------ | ----------------- |
| `server/routes/foo/index.ts`         | `../schema`       |
| `server/routes/user/create/index.ts` | `../../schema`    |
| `server/routes/user/[id]/index.ts`   | `../../../schema` |

## 完整示例

```
routes/
  index.ts                    →  GET /
  users/
    index.ts                  →  GET /users
    [id]/
      index.ts                →  GET /users/:id
  posts/
    index.ts                  →  GET /posts
    [id]/
      index.ts                →  GET /posts/:id
      comments/
        index.ts              →  GET /posts/:id/comments
```

## 检查清单

- [ ] 文件路径是否对应目标 URL（仅 `index.ts`/`index.js` 被识别，`[param]` 目录表示动态参数）
- [ ] 默认导出函数 + `ContextWithDb` 类型
- [ ] 使用 DB 时校验 `db` 存在（`c.get('db')`）
- [ ] 动态参数通过 `c.get('params')` 获取
- [ ] 返回体为**业务 data**；错误**抛错**（`throw new Error()` 或 `throw new ServerError()`）而非手搓失败 envelope
- [ ] Schema 中的列名与 `insert`/`select` 字段一致
- [ ] HTTP 方法约束通过 `export const method` 声明

## 注意事项

1. **不要**在路由目录下放置同级的非 `index.ts`/`index.js` 文件作为路由，它们不会被识别
2. 辅助工具类文件可以放在目录下任意位置，不会被误扫为路由
3. 动态参数目录名必须使用方括号 `[]` 包裹，如 `[id]`、`[slug]`
4. 路由路径区分大小写，目录名即 URL 路径名
5. `ServerError` 从 `@lightfish/server/shared` 导入（即 `@lightfish/server` 的 `shared` 子路径导出）
