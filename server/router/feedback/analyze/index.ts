import type { ContextWithDb } from "@lightfish/server";
import { analysisSessions } from "../../../schema/index.js";

/**
 * POST /api/feedback/analyze
 * SSE 流式返回分析进度和结果。
 *
 * 事件：
 *   progress  { step: "token" | "fetching" | "analyzing", page?, total? }
 *   result    { records, analysis, topIssues, total }
 *   error     { message }
 */
export default async function analyzeFeedback(c: ContextWithDb) {
  const body = await c.req.json<{
    feishu: {
      appId: string;
      appSecret: string;
      appToken: string;
      tableId: string;
      viewId?: string;
      fieldNames?: string;
      maxRecords?: number;
    };
    ai: {
      url: string;
      headers: string;
      channel: string;
      model: string;
      body: string;
    };
    systemPrompt: string;
  }>();

  if (
    !body.feishu?.appId ||
    !body.feishu?.appSecret ||
    !body.feishu?.appToken ||
    !body.feishu?.tableId
  ) {
    throw new Error(
      "飞书配置不完整，请填写 App ID、App Secret、App Token 和 Table ID"
    );
  }
  if (!body.ai?.url) {
    throw new Error("请填写 AI API URL");
  }
  if (!body.systemPrompt) {
    throw new Error("请填写 System Prompt");
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/analyze] ${msg}`, ...args);

  const encoder = new TextEncoder();

  // 获取数据库实例
  const db = c.get("db");

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 保存分析结果到数据库
      const saveSession = async (data: {
        status: "completed" | "error";
        analysis?: string;
        topIssues?: any[];
        total?: number;
        records?: any[];
        errorMessage?: string;
      }) => {
        if (!db) {
          log("数据库未配置，跳过保存");
          return;
        }
        try {
          await db.insert(analysisSessions).values({
            feishuConfig: {
              appId: body.feishu.appId,
              appSecret: body.feishu.appSecret,
              appToken: body.feishu.appToken,
              tableId: body.feishu.tableId,
              viewId: body.feishu.viewId,
              fieldNames: body.feishu.fieldNames,
              maxRecords: body.feishu.maxRecords,
            },
            aiConfig: {
              aiProvider: "",
              aiUrl: body.ai.url,
              aiChannel: body.ai.channel,
              aiModel: body.ai.model,
            },
            systemPrompt: body.systemPrompt,
            analysis: data.analysis || null,
            topIssues: data.topIssues || null,
            total: data.total || 0,
            records: data.records || null,
            status: data.status,
            errorMessage: data.errorMessage || null,
          });
          log("分析结果已保存到数据库");
        } catch (err: any) {
          log("保存分析结果失败:", err.message);
        }
      };

      try {
        // === 阶段 1：获取飞书 token ===
        log("获取飞书 token...");
        send("progress", { step: "token" });

        const tokenRes = await fetch(
          "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
          {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
              app_id: body.feishu.appId,
              app_secret: body.feishu.appSecret,
            }),
          }
        );
        const tokenData = (await tokenRes.json()) as {
          code: number;
          msg: string;
          tenant_access_token?: string;
        };
        if (tokenData.code !== 0 || !tokenData.tenant_access_token) {
          throw new Error(`获取飞书 token 失败: ${tokenData.msg}`);
        }
        const token = tokenData.tenant_access_token;
        log("飞书 token 获取成功");

        // === 阶段 2：全量拉取飞书数据 ===
        log("开始拉取飞书数据...");
        const fieldNames = body.feishu.fieldNames
          ? body.feishu.fieldNames
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [
              "描述(人、操作、现象)",
              "上传相关图片/GIF",
              "详细说明「现象、操作、问题」",
              "排查情况",
            ];

        const maxRecords = body.feishu.maxRecords || 0;
        const allRecords: Array<{
          record_id: string;
          fields: Record<string, any>;
        }> = [];
        let pageToken: string | null = null;
        let pageNum = 0;

        do {
          pageNum++;

          // 计算本次需要拉取的数量：最多 500，但不能超过剩余需要的数量
          const remaining =
            maxRecords > 0 ? maxRecords - allRecords.length : 500;
          const pageSize = Math.min(500, remaining);

          if (pageSize <= 0) break;

          const searchUrl = new URL(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${body.feishu.appToken}/tables/${body.feishu.tableId}/records/search`
          );
          searchUrl.searchParams.set("page_size", String(pageSize));

          const searchRes = await fetch(searchUrl.toString(), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              automatic_fields: false,
              field_names: fieldNames,
              sort: [],
              view_id: body.feishu.viewId || undefined,
              page_token: pageToken,
            }),
          });
          const searchData = (await searchRes.json()) as {
            code: number;
            msg: string;
            data?: {
              items: Array<{ record_id: string; fields: Record<string, any> }>;
              has_more?: boolean;
              page_token?: string;
            };
          };
          if (searchData.code !== 0) {
            throw new Error(`飞书查询失败: ${searchData.msg}`);
          }

          const items = searchData.data?.items || [];
          allRecords.push(...items);
          log(
            `第 ${pageNum} 页，本页 ${items.length} 条，累计 ${allRecords.length} 条`
          );

          send("progress", {
            step: "fetching",
            page: pageNum,
            total: allRecords.length,
          });

          // 达到最大拉取数量则停止
          if (maxRecords > 0 && allRecords.length >= maxRecords) {
            log(`已达到最大拉取数量 ${maxRecords} 条，停止拉取`);
            break;
          }

          pageToken = searchData.data?.has_more
            ? searchData.data?.page_token ?? null
            : null;
        } while (pageToken);

        log(`飞书数据拉取完成，共 ${allRecords.length} 条`);

        if (allRecords.length === 0) {
          send("result", {
            records: [],
            analysis: "暂无反馈数据",
            topIssues: [],
            total: 0,
          });
          controller.close();
          return;
        }

        // === 阶段 3：调用 AI 分析 ===
        log("开始调用 AI 分析...");
        send("progress", { step: "analyzing" });

        const feedbackTexts = allRecords
          .map((r, i) => {
            const fields = r.fields;
            const desc = extractText(fields[fieldNames[0]]);
            const detail = extractText(
              fields[fieldNames[2]] || fields["详细说明「现象、操作、问题」"]
            );
            const investigation = extractText(
              fields[fieldNames[3]] || fields["排查情况"]
            );
            return `【反馈 ${i + 1}】\nrecordId: ${r.record_id}\n描述: ${
              desc || "无"
            }\n详细说明: ${detail || "无"}\n排查情况: ${investigation || "无"}`;
          })
          .join("\n\n");

        const userContent = `以下是用户反馈数据，共 ${allRecords.length} 条，请分析下面这段数据\n\n${feedbackTexts}`;

        const aiContent = await callAI({
          url: body.ai.url,
          headers: body.ai.headers,
          channel: body.ai.channel,
          model: body.ai.model,
          body: body.ai.body,
          systemPrompt: body.systemPrompt,
          userContent,
          log,
        });

        log("AI 分析完成");

        // === 阶段 4：解析 JSON 结果 ===
        let analysis = "";
        let topIssues: Array<{
          rank: number;
          title: string;
          count: number;
          description: string;
        }> = [];

        // 尝试从 AI 返回内容中提取 JSON
        // AI 可能会在 Markdown 代码块中返回 JSON，如：
        // 好的，分析如下...\n\n```json\n{\n  "analysis": "...",\n  "topIssues": [...]\n}\n```
        // 也可能直接返回纯 JSON 字符串
        const parsed = extractJsonFromContent(aiContent);
        if (parsed) {
          analysis = parsed.analysis || aiContent;
          topIssues = parsed.topIssues || [];
        } else {
          // JSON 解析失败，直接使用原文
          analysis = aiContent;
        }

        const records = allRecords.map((r, idx) => ({
          recordId: r.record_id,
          index: idx + 1,
          description: extractText(r.fields[fieldNames[0]]),
          detail: extractText(
            r.fields[fieldNames[2]] || r.fields["详细说明「现象、操作、问题」"]
          ),
          investigation: extractText(
            r.fields[fieldNames[3]] || r.fields["排查情况"]
          ),
          images: extractImages(
            r.fields[fieldNames[1]] || r.fields["上传相关图片/GIF"]
          ),
        }));

        log("分析完成，返回结果");
        // 先发 result（不含 records，数据量小）
        send("result", {
          analysis,
          topIssues,
          total: allRecords.length,
        });
        // 再分批发送 records（避免单次 JSON 太大导致截断）
        const BATCH_SIZE = 50;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          send("records", records.slice(i, i + BATCH_SIZE));
        }
        controller.close();

        // 保存成功结果到数据库
        await saveSession({
          status: "completed",
          analysis,
          topIssues,
          total: allRecords.length,
          records,
        });
      } catch (err: any) {
        log("分析出错:", err.message);
        send("error", { message: err.message });
        controller.close();

        // 保存错误结果到数据库
        await saveSession({
          status: "error",
          errorMessage: err.message,
          total: 0,
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * 调用 AI API
 *
 * 请求体完全由用户配置的 body 控制，只动态注入 messages 字段。
 * 支持两种响应格式：
 * 1. 标准 OpenAI 协议：{ choices: [{ message: { content } }] }
 * 2. 内部 API 格式：{ code: 200, success: true, data: { choices: [{ message: { content } }] } }
 */
async function callAI(options: {
  url: string;
  headers: string;
  channel: string;
  model: string;
  body: string;
  systemPrompt: string;
  userContent: string;
  log: (msg: string, ...args: any[]) => void;
}): Promise<string> {
  const {
    url,
    headers: headersStr,
    channel,
    model,
    body: bodyStr,
    systemPrompt,
    userContent,
    log,
  } = options;

  // 解析自定义 headers（JSON 格式）
  let extraHeaders: Record<string, string> = {};
  if (headersStr) {
    try {
      extraHeaders = JSON.parse(headersStr);
    } catch {
      log("解析 AI Headers 失败，使用默认 headers");
    }
  }

  // 构建请求体：以用户配置的 body 为基础，只注入 messages
  let requestBody: Record<string, any> = {};

  // 先解析用户配置的 body 作为基础
  if (bodyStr) {
    try {
      requestBody = JSON.parse(bodyStr);
    } catch {
      log("解析 AI Body 失败，使用默认 body");
    }
  }

  // 注入 messages（始终覆盖，因为这是动态生成的）
  requestBody.messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  // 如果 body 中没有 model，用配置的 model 兜底
  if (!requestBody.model) {
    requestBody.model = model || "deepseek-chat";
  }

  // 如果 body 中没有 channel，用配置的 channel 兜底
  if (!requestBody.channel && channel) {
    requestBody.channel = channel;
  }

  // 如果 body 中没有 stream，默认 false
  if (requestBody.stream === undefined) {
    requestBody.stream = false;
  }

  log("AI 请求 URL:", url);
  log("AI 请求 Headers:", JSON.stringify(extraHeaders));
  // 打印请求体（排除 messages，避免日志太长）
  const logBody = { ...requestBody };
  delete logBody.messages;
  log("AI 请求 Body (不含 messages):", JSON.stringify(logBody));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(requestBody),
  });

  log("AI 响应状态:", res.status, res.statusText);

  const responseText = await res.text();
  log("AI 响应原文:", responseText);

  // 尝试解析 JSON
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `AI API 返回非 JSON 格式 (状态 ${res.status}): ${responseText.slice(
        0,
        500
      )}`
    );
  }

  // 判断是否为内部 API 格式（有 code/success/data 外层包装）
  const isInternalApi = data.code !== undefined || data.success !== undefined;

  if (isInternalApi) {
    // 内部 API 格式：{ code: 200, success: true, data: { choices: [...] } }
    if (data.code !== 200 || !data.success) {
      throw new Error(
        `AI API 业务错误: code=${data.code}, success=${data.success}, msg=${data.msg}`
      );
    }
    if (!data.data?.choices?.[0]?.message?.content) {
      throw new Error(
        `AI API 返回格式异常: ${JSON.stringify(data).slice(0, 500)}`
      );
    }
    return data.data.choices[0].message.content;
  }

  // 标准 OpenAI 协议格式：{ choices: [{ message: { content } }] }
  if (data.error) {
    throw new Error(`AI API 错误: ${JSON.stringify(data.error)}`);
  }

  if (!data.choices?.[0]?.message?.content) {
    throw new Error(
      `AI API 返回格式异常: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  return data.choices[0].message.content;
}

function extractText(field: any): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    return field
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (item.text) return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(field);
}

function extractImages(field: any): Array<{ url: string; name: string }> {
  if (!field || !Array.isArray(field)) return [];
  return field
    .filter((item: any) => item.file_token)
    .map((item: any) => ({
      url: item.url || item.tmp_url || "",
      name: item.name || "",
    }));
}

/**
 * 从 AI 返回内容中提取 JSON 对象。
 *
 * AI 有时会在 Markdown 代码块中返回 JSON，例如：
 *   好的，分析如下...\n\n```json\n{\n  "analysis": "...",\n  "topIssues": [...]\n}\n```
 * 也可能直接返回纯 JSON 字符串，或者 JSON 前面/后面有额外文本。
 *
 * 此函数会依次尝试：
 * 1. 提取 ```json ... ``` 代码块中的 JSON
 * 2. 提取 ``` ... ``` 代码块中的 JSON
 * 3. 直接对整个内容尝试 JSON.parse
 * 4. 尝试从内容中查找第一个 { 到最后一个 } 之间的子串
 */
function extractJsonFromContent(content: string): {
  analysis?: string;
  topIssues?: Array<{
    rank: number;
    title: string;
    count: number;
    description: string;
  }>;
} | null {
  if (!content) return null;

  // 尝试 1：提取 ```json ... ``` 代码块
  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // 继续尝试其他方式
    }
  }

  // 尝试 2：提取 ``` ... ``` 代码块（没有 json 标记）
  const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // 继续尝试其他方式
    }
  }

  // 尝试 3：直接对整个内容尝试 JSON.parse
  try {
    return JSON.parse(content.trim());
  } catch {
    // 继续尝试其他方式
  }

  // 尝试 4：从内容中查找第一个 { 到最后一个 } 之间的子串
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1));
    } catch {
      // 无法解析
    }
  }

  return null;
}
