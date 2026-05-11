import type { ContextWithDb } from "@lightfish/server";
import { kbCache } from "../../../../schema/index.js";
import { eq } from "drizzle-orm";

/**
 * POST /api/feedback/export/kb-query
 *
 * 知识库查询接口。
 * - 如果只有 recordId（无完整内容），则仅查缓存，返回 { cached: true/false, result: string|null }
 * - 如果有完整内容（description/detail/investigation/images），则调外部 API 查询并更新缓存
 *
 * 请求体：
 * {
 *   recordId: string;
 *   description?: string;
 *   detail?: string;
 *   investigation?: string;
 *   images?: Array<{ url: string; name: string }>;
 *   forceRefresh?: boolean;  // 是否强制重新生成
 * }
 *
 * 返回：
 * {
 *   cached: boolean;   // 是否命中缓存
 *   result: string;    // 知识库返回结果（Markdown）
 * }
 */
export default async function kbQuery(c: ContextWithDb) {
  const body = await c.req.json<{
    recordId: string;
    description?: string;
    detail?: string;
    investigation?: string;
    images?: Array<{ url: string; name: string }>;
    forceRefresh?: boolean;
  }>();

  if (!body.recordId?.trim()) {
    throw new Error("缺少必要参数 recordId");
  }

  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/export/kb-query] ${msg}`, ...args);

  // === 1. 先查数据库缓存 ===
  const existing = await db
    .select({ result: kbCache.result, queryContent: kbCache.queryContent })
    .from(kbCache)
    .where(eq(kbCache.recordId, body.recordId))
    .limit(1);

  // 如果不需要强制刷新，且有缓存，直接返回
  if (!body.forceRefresh && existing.length > 0) {
    log("缓存命中, recordId:", body.recordId);
    return {
      cached: true,
      result: existing[0].result,
    };
  }

  // 如果没有完整内容且不是强制刷新，说明只是查缓存
  if (
    !body.forceRefresh &&
    !body.description &&
    !body.detail &&
    !body.investigation
  ) {
    log("缓存未命中, recordId:", body.recordId);
    return {
      cached: false,
      result: null,
    };
  }

  // === 2. 拼接查询内容 ===
  const parts: string[] = [];
  if (body.description) {
    parts.push(`描述(人、操作、现象)：${body.description}`);
  }
  if (body.detail) {
    parts.push(`详细说明「现象、操作、问题」：${body.detail}`);
  }
  if (body.investigation) {
    parts.push(`排查情况：${body.investigation}`);
  }
  const images = body.images;
  if (images && images.length > 0) {
    const imageInfo = images
      .map((img) => `[图片] ${img.name}: ${img.url}`)
      .join("\n");
    parts.push(`相关图片：\n${imageInfo}`);
  }
  const content = parts.join("\n\n");

  if (!content) {
    throw new Error("没有可查询的内容");
  }

  // === 3. 调用外部知识库 API ===
  log("调用外部知识库 API, recordId:", body.recordId);
  const res = await fetch(
    "https://test-yddoc.yingdao.com/api/agents/rpaQaAgent/generate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "tgw_l7_route=7c8ae90f48839c29750e1ccc76081893",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content }],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`知识库查询失败 (${res.status})`);
  }

  const result = await res.json();
  const resultText = result.text || "无返回结果";

  // === 4. 写入/更新数据库缓存 ===
  if (existing.length > 0) {
    // 更新已有缓存
    await db
      .update(kbCache)
      .set({
        queryContent: content,
        result: resultText,
        updatedAt: new Date(),
      })
      .where(eq(kbCache.recordId, body.recordId));
    log("缓存已更新, recordId:", body.recordId);
  } else {
    // 插入新缓存
    await db.insert(kbCache).values({
      recordId: body.recordId,
      queryContent: content,
      result: resultText,
    });
    log("缓存已写入, recordId:", body.recordId);
  }

  return {
    cached: false,
    result: resultText,
  };
}
