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
 *   content: string;       // 查询内容（前端已拼接好，可二次编辑）
 *   env?: string;          // 环境：staging | online，默认 staging
 *   system?: string;       // 系统提示词（可选，默认使用内置提示词）
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
    content: string;
    env?: string;
    system?: string;
  }>();

  if (!body.recordId?.trim()) {
    throw new Error("缺少必要参数 recordId");
  }

  if (!body.content?.trim()) {
    throw new Error("缺少查询内容 content");
  }

  const db = c.get("db");
  if (!db) {
    throw new Error("数据库未配置");
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/export/kb-query] ${msg}`, ...args);

  const content = body.content;
  const systemPrompt = body.system;

  // 知识库 API 地址映射（按环境）
  const KB_API_URLS: Record<string, string> = {
    staging: "https://staging-yddoc.yingdao.com/custom/chat/rpaQaAgent",
    online: "https://yddoc.yingdao.com/custom/chat/rpaQaAgent",
  };
  const apiUrl = KB_API_URLS[body.env || "staging"] || KB_API_URLS.staging;

  // === 1. 生成等效 curl 命令 ===
  const curlCommand = `curl -X POST '${apiUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify({ system: systemPrompt, messages: [{ role: "user", content }] })}'`;
  log("等效 curl 命令:\n", curlCommand);

  // === 2. 调用外部知识库 API ===
  log(
    "调用外部知识库 API, recordId:",
    body.recordId,
    "env:",
    body.env || "staging",
  );
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system: systemPrompt,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    throw new Error(`知识库查询失败 (${res.status})`);
  }

  const { data: result } = await res.json();
  log("调用外部知识库 API, 返回结果:", result.text);
  const resultText = result.text || "无返回结果";

  const traceId = result.traceId;

  const traceUrl = `https://langfuse.shadow-rpa.net/project/cmjzfpet700440z07gpp9mv1u/traces?search=${traceId}`;

  // === 3. 写入数据库（新增一条记录） ===
  const [inserted] = await db
    .insert(kbCache)
    .values({
      recordId: body.recordId,
      queryContent: content,
      result: resultText,
      curlCommand,
      traceUrl,
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
