import type { ContextWithDb } from "@lightfish/server";
import { kbCache } from "../../../../../schema/index.js";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/feedback/export/kb-query/list?recordId=xxx
 *
 * 查询某反馈记录的知识库查询历史列表（按时间倒序）。
 *
 * 查询参数：
 *   recordId: string  - 反馈记录 ID
 *
 * 返回：
 * {
 *   list: Array<{
 *     id: number;
 *     result: string;
 *     createdAt: string;
 *   }>
 * }
 */
export default async function kbQueryList(c: ContextWithDb) {
  const recordId = c.req.query("recordId");

  if (!recordId?.trim()) {
    throw new Error("缺少必要参数 recordId");
  }

  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const list = await db
    .select({
      id: kbCache.id,
      result: kbCache.result,
      curlCommand: kbCache.curlCommand,
      createdAt: kbCache.createdAt,
    })
    .from(kbCache)
    .where(eq(kbCache.recordId, recordId))
    .orderBy(desc(kbCache.createdAt))
    .limit(50);

  return { list };
}
