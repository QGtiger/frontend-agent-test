import type { ContextWithDb } from "@lightfish/server";

/**
 * POST /api/feedback/export
 * 从飞书拉取数据并返回，用于前端下载 Excel。
 *
 * 请求体：
 * {
 *   appId: string;
 *   appSecret: string;
 *   appToken: string;
 *   tableId: string;
 *   viewId?: string;
 *   maxRecords?: number;
 * }
 *
 * 返回：
 * {
 *   records: Array<{
 *     recordId: string;
 *     index: number;
 *     description: string;
 *     detail: string;
 *     investigation: string;
 *     images: Array<{ url: string; name: string }>;
 *   }>;
 *   total: number;
 * }
 */
export default async function exportFeedback(c: ContextWithDb) {
  const body = await c.req.json<{
    appId: string;
    appSecret: string;
    appToken: string;
    tableId: string;
    viewId?: string;
    maxRecords?: number;
  }>();

  if (!body.appId || !body.appSecret || !body.appToken || !body.tableId) {
    throw new Error(
      "飞书配置不完整，请填写 App ID、App Secret、App Token 和 Table ID"
    );
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/export] ${msg}`, ...args);

  // === 阶段 1：获取飞书 token ===
  log("获取飞书 token...");
  const tokenRes = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: body.appId,
        app_secret: body.appSecret,
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
  // 固定字段名
  const fieldNames = [
    "描述(人、操作、现象)",
    "上传相关图片/GIF",
    "详细说明「现象、操作、问题」",
    "排查情况",
  ];

  const maxRecords = body.maxRecords || 0;
  const allRecords: Array<{
    record_id: string;
    fields: Record<string, any>;
  }> = [];
  let pageToken: string | null = null;
  let pageNum = 0;

  do {
    pageNum++;

    const remaining = maxRecords > 0 ? maxRecords - allRecords.length : 500;
    const pageSize = Math.min(500, remaining);

    if (pageSize <= 0) break;

    const searchUrl = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${body.appToken}/tables/${body.tableId}/records/search`
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
        view_id: body.viewId || undefined,
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

    if (maxRecords > 0 && allRecords.length >= maxRecords) {
      log(`已达到最大拉取数量 ${maxRecords} 条，停止拉取`);
      break;
    }

    pageToken = searchData.data?.has_more
      ? searchData.data?.page_token ?? null
      : null;
  } while (pageToken);

  log(`飞书数据拉取完成，共 ${allRecords.length} 条`);

  // === 阶段 3：格式化数据 ===
  const records = allRecords.map((r, idx) => ({
    recordId: r.record_id,
    index: idx + 1,
    description: extractText(r.fields[fieldNames[0]]),
    detail: extractText(
      r.fields[fieldNames[2]] || r.fields["详细说明「现象、操作、问题」"]
    ),
    investigation: extractText(r.fields[fieldNames[3]] || r.fields["排查情况"]),
    images: extractImages(
      r.fields[fieldNames[1]] || r.fields["上传相关图片/GIF"]
    ),
  }));

  return {
    records,
    total: allRecords.length,
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
  if (!field) return [];

  console.log(
    "[extractImages] field type:",
    typeof field,
    "isArray:",
    Array.isArray(field)
  );
  console.log(
    "[extractImages] field value:",
    JSON.stringify(field).slice(0, 800)
  );

  // 飞书 search API 返回的附件字段可能是数组（每个文件一个对象）
  if (Array.isArray(field)) {
    const result = field
      .filter((item: any) => item.file_token)
      .map((item: any) => ({
        url: item.url || item.tmp_url || "",
        name: item.name || "",
      }));
    console.log(
      "[extractImages] array result:",
      JSON.stringify(result).slice(0, 500)
    );
    return result;
  }

  // 也可能是对象，url/name 用 "; " 拼接
  if (typeof field === "object") {
    const rawUrl = field.url || field.tmp_url || "";
    const rawName = field.name || "";
    console.log(
      "[extractImages] object rawUrl:",
      rawUrl.slice(0, 200),
      "rawName:",
      rawName.slice(0, 200)
    );
    if (rawUrl) {
      const urls = rawUrl.split("; ").filter(Boolean);
      const names = rawName.split("; ").filter(Boolean);
      const result = urls.map((url: string, idx: number) => ({
        url,
        name: names[idx] || `图片 ${idx + 1}`,
      }));
      console.log(
        "[extractImages] object result:",
        JSON.stringify(result).slice(0, 500)
      );
      return result;
    }
  }

  return [];
}
