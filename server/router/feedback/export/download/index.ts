import type { ContextWithDb } from "@lightfish/server";
import * as XLSX from "xlsx";

/**
 * POST /api/feedback/export/download
 * 从飞书拉取数据，在服务端生成 xlsx 并直接返回文件流下载。
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
 * 返回：xlsx 文件流（Content-Disposition: attachment）
 */
export default async function exportDownload(c: ContextWithDb) {
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
    console.log(`[feedback/export/download] ${msg}`, ...args);

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
    if (pageToken) {
      searchUrl.searchParams.set("page_token", pageToken);
    }

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

  // === 阶段 3：格式化数据并生成 xlsx ===
  const records = allRecords.map((r, idx) => ({
    序号: idx + 1,
    "描述(人、操作、现象)": extractText(r.fields[fieldNames[0]]),
    "详细说明「现象、操作、问题」": extractText(
      r.fields[fieldNames[2]] || r.fields["详细说明「现象、操作、问题」"]
    ),
    排查情况: extractText(r.fields[fieldNames[3]] || r.fields["排查情况"]),
    图片链接: extractImageUrls(
      r.fields[fieldNames[1]] || r.fields["上传相关图片/GIF"]
    ),
    图片名称: extractImageNames(
      r.fields[fieldNames[1]] || r.fields["上传相关图片/GIF"]
    ),
    "记录 ID": r.record_id,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(records);

  // 设置列宽
  ws["!cols"] = [
    { wch: 6 }, // 序号
    { wch: 40 }, // 描述
    { wch: 50 }, // 详细说明
    { wch: 30 }, // 排查情况
    { wch: 60 }, // 图片链接
    { wch: 30 }, // 图片名称
    { wch: 30 }, // 记录 ID
  ];

  XLSX.utils.book_append_sheet(wb, ws, "反馈数据");

  // 生成 xlsx 二进制数据
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  const filename = `飞书反馈数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const encodedFilename = encodeURIComponent(filename);

  // 返回文件流（使用 Hono 的 newResponse）
  return c.newResponse(wbout, 200, {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
    "Content-Length": String(wbout.byteLength),
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

function extractImageUrls(field: any): string {
