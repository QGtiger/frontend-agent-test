import type { ContextWithDb } from "@lightfish/server";
import { kbCache } from "../../../../schema/index.js";

/**
 * POST /api/feedback/export/kb-query
 *
 * 新增知识库查询。
 * 每次调用都会调外部 API 查询，并将结果写入 kb_cache 表（新增一条记录）。
 *
 * 请求体：
 * {
 *   recordId: string;
 *   description?: string;
 *   detail?: string;
 *   investigation?: string;
 *   images?: Array<{ url: string; name: string }>;
 * }
 *
 * 返回：
 * {
 *   id: number;
 *   result: string;    // 知识库返回结果（Markdown）
 *   createdAt: string;
 * }
 */
export default async function kbQuery(c: ContextWithDb) {
  const body = await c.req.json<{
    recordId: string;
    description?: string;
    detail?: string;
    investigation?: string;
    images?: Array<{ url: string; name: string }>;
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

  // === 1. 拼接查询内容 ===
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

  // === 2. 调用外部知识库 API ===
  log("调用外部知识库 API, recordId:", body.recordId);
  const res = await fetch(
    "https://yddoc.yingdao.com/api/agents/rpaQaAgent/generate",
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

  // === 3. 写入数据库（新增一条记录） ===
  const [inserted] = await db
    .insert(kbCache)
    .values({
      recordId: body.recordId,
      queryContent: content,
      result: resultText,
    })
    .returning({
      id: kbCache.id,
      result: kbCache.result,
      createdAt: kbCache.createdAt,
    });

  log("知识库查询记录已写入, id:", inserted.id, "recordId:", body.recordId);

  return {
    id: inserted.id,
    result: inserted.result,
    createdAt: inserted.createdAt,
  };
}
