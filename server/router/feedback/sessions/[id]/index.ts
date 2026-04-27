import type { ContextWithDb } from "@lightfish/server";
import { analysisSessions } from "../../../../schema/index.js";
import { eq } from "drizzle-orm";

/**
 * GET /api/feedback/sessions/:id → 分析详情
 * DELETE /api/feedback/sessions/:id → 删除记录
 */
export default async function sessionDetail(c: ContextWithDb) {
  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const params = c.get("params");
  const id = params?.id ? parseInt(params.id, 10) : NaN;

  if (isNaN(id)) {
    throw new Error("无效的 ID");
  }

  const method = c.req.method;

  // DELETE /api/feedback/sessions/:id
  if (method === "DELETE") {
    const [session] = await db
      .delete(analysisSessions)
      .where(eq(analysisSessions.id, id))
      .returning({ id: analysisSessions.id });

    if (!session) {
      throw new Error("分析记录不存在");
    }

    return { id: session.id };
  }

  // GET /api/feedback/sessions/:id
  const [session] = await db
    .select()
    .from(analysisSessions)
    .where(eq(analysisSessions.id, id))
    .limit(1);

  if (!session) {
    throw new Error("分析记录不存在");
  }

  return session;
}
