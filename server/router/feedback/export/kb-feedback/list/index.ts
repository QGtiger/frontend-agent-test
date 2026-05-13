import type { ContextWithDb } from "@lightfish/server";
import { kbFeedback } from "../../../../../schema/index.js";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/feedback/export/kb-feedback/list?kbCacheId=xxx
 *
 * 查询某条知识库查询结果的所有反馈（按时间倒序）。
 *
 * 查询参数：
 *   kbCacheId: number  - 知识库查询记录 ID
 *
 * 返回：
 * {
 *   list: Array<{
 *     id: number;
 *     group: string;
 *     score: number;
 *     reason: string | null;
 *     supplement: string | null;
 *     aiSuggestion: string | null;
 *     kbSuggestion: string | null;
 *     createdAt: string;
 *   }>
 * }
 */
export default async function kbFeedbackList(c: ContextWithDb) {
  const kbCacheId = c.req.query("kbCacheId");

  if (!kbCacheId?.trim()) {
    throw new Error("缺少必要参数 kbCacheId");
  }

  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const list = await db
    .select({
      id: kbFeedback.id,
      group: kbFeedback.group,
      score: kbFeedback.score,
      reason: kbFeedback.reason,
      supplement: kbFeedback.supplement,
      aiSuggestion: kbFeedback.aiSuggestion,
      kbSuggestion: kbFeedback.kbSuggestion,
      createdAt: kbFeedback.createdAt,
    })
    .from(kbFeedback)
    .where(eq(kbFeedback.kbCacheId, Number(kbCacheId)))
    .orderBy(desc(kbFeedback.createdAt))
    .limit(50);

  return { list };
}
