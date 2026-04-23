import type { ContextWithDb } from "@lightfish/server";

/**
 * POST /api/feedback/analyze
 * 从飞书拉取反馈数据，调用 DeepSeek AI 分析，返回筛选结果
 *
 * Body:
 * {
 *   feishu: { appId, appSecret, appToken, tableId, viewId?, fieldNames? },
 *   deepseek: { apiKey, model? },
 *   systemPrompt: string
 * }
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
    };
    deepseek: {
      apiKey: string;
      model?: string;
    };
    systemPrompt: string;
  }>();

  // 校验必填字段
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

  // 1. 获取飞书 tenant_access_token
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

  // 2. 从飞书多维表格搜索记录
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

  const searchUrl = new URL(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${body.feishu.appToken}/tables/${body.feishu.tableId}/records/search`
  );
  searchUrl.searchParams.set("page_size", "100");

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
    }),
  });
  const searchData = (await searchRes.json()) as {
    code: number;
    msg: string;
    data?: {
      items: Array<{ record_id: string; fields: Record<string, any> }>;
      total?: number;
    };
  };
  if (searchData.code !== 0) {
    throw new Error(`飞书查询失败: ${searchData.msg}`);
  }

  const records = searchData.data?.items || [];
  if (records.length === 0) {
    return { records: [], analysis: "暂无反馈数据" };
  }

  // 3. 构建分析内容
  const feedbackTexts = records
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

  const userContent = `以下是用户反馈数据，共 ${records.length} 条，请分析并提取出高频问题：\n\n${feedbackTexts}`;

  // 4. 调用 DeepSeek API
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

  // 5. 尝试解析 AI 返回的结构化数据
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

  return {
    records: records.map((r) => ({
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
    })),
    analysis,
    topIssues,
    total: records.length,
  };
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
