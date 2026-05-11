import type { ContextWithDb } from "@lightfish/server";
import { kbFeedback } from "../../../../schema/index.js";

/**
 * POST /api/feedback/export/kb-feedback
 *
 * 新增知识库查询反馈。
 *
 * 请求体：
 * {
 *   kbCacheId: number;
 *   group: string;       // "测试组" | "内容组" | "售后组" | "产研组"
 *   score: number;       // 1-10
 *   reason?: string;     // 打分理由和修改建议
 *   supplement?: string; // 其他增量补充
 * }
 *
 * 返回：
 * {
 *   id: number;
 *   createdAt: string;
 * }
 */
export default async function createKbFeedback(c: ContextWithDb) {
  const body = await c.req.json<{
    kbCacheId: number;
    group: string;
    score: number;
    reason?: string;
    supplement?: string;
  }>();

  if (!body.kbCacheId) {
    throw new Error("缺少必要参数 kbCacheId");
  }
  if (!body.group?.trim()) {
    throw new Error("缺少必要参数 group");
  }
  if (!body.score || body.score < 1 || body.score > 10) {
    throw new Error("score 必须在 1-10 之间");
  }

  const validGroups = ["测试组", "内容组", "售后组", "产研组"];
  if (!validGroups.includes(body.group)) {
    throw new Error(`group 必须是: ${validGroups.join("、")}`);
  }

  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const [inserted] = await db
    .insert(kbFeedback)
    .values({
      kbCacheId: body.kbCacheId,
      group: body.group,
      score: body.score,
      reason: body.reason || null,
      supplement: body.supplement || null,
    })
    .returning({
      id: kbFeedback.id,
      createdAt: kbFeedback.createdAt,
    });

  return {
    id: inserted.id,
    createdAt: inserted.createdAt,
  };
}
