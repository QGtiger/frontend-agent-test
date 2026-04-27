import type { ContextWithDb } from "@lightfish/server";
import { analysisSessions } from "../../../schema/index.js";
import { desc } from "drizzle-orm";

/**
 * GET /api/feedback/sessions → 分析记录列表
 */
export default async function listSessions(c: ContextWithDb) {
  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const sessions = await db
    .select({
      id: analysisSessions.id,
      total: analysisSessions.total,
      status: analysisSessions.status,
      errorMessage: analysisSessions.errorMessage,
      createdAt: analysisSessions.createdAt,
    })
    .from(analysisSessions)
    .orderBy(desc(analysisSessions.createdAt))
    .limit(100);

  return sessions;
}
