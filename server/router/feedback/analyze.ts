import type { ContextWithDb } from "@lightfish/server";

/**
 * POST /api/feedback/analyze
 * SSE 流式返回分析进度和结果。
 * 框架 toResponse 检测到 Response 实例会直接透传。
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
    deepseek: {
      apiKey: string;
      model?: string;
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
  if (!body.deepseek?.apiKey) {
    throw new Error("请填写 DeepSeek API Key");
  }
  if (!body.systemPrompt) {
    throw new Error("请填写 System Prompt");
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/analyze] ${msg}`, ...args);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
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
          const searchUrl = new URL(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${body.feishu.appToken}/tables/${body.feishu.tableId}/records/search`
          );
          searchUrl.searchParams.set("page_size", "50");

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

        // === 阶段 3：调用 DeepSeek 分析 ===
        log("开始调用 DeepSeek 分析...");
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
            return `【反馈 ${i + 1}】\n描述: ${desc || "无"}\n详细说明: ${
              detail || "无"
            }\n排查情况: ${investigation || "无"}`;
          })
          .join("\n\n");

        const userContent = `以下是用户反馈数据，共 ${allRecords.length} 条，请分析并提取出高频问题：\n\n${feedbackTexts}`;

        const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${body.deepseek.apiKey}`,
          },
          body: JSON.stringify({
            model: body.deepseek.model || "deepseek-chat",
            messages: [
              { role: "system", content: body.systemPrompt },
              { role: "user", content: userContent },
            ],
            stream: false,
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });
        const aiData = (await aiRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message: string };
        };
        if (aiData.error) {
          throw new Error(`DeepSeek API 错误: ${aiData.error.message}`);
        }

        const analysis = aiData.choices?.[0]?.message?.content || "";
        log("DeepSeek 分析完成");

        // === 阶段 4：解析结果 ===
        let topIssues: Array<{
          rank: number;
          title: string;
          count: number;
          description: string;
        }> = [];
        try {
          const jsonMatch = analysis.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) topIssues = parsed;
            else if (parsed.topIssues) topIssues = parsed.topIssues;
          }
        } catch {
          // 解析失败则只返回原始文本
        }

        const records = allRecords.map((r) => ({
          recordId: r.record_id,
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
      } catch (err: any) {
        log("分析出错:", err.message);
        send("error", { message: err.message });
        controller.close();
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
