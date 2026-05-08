import type { ContextWithDb } from "@lightfish/server";
import {
  FIELD_NAMES,
  formatRecordsToRows,
  generateXlsxBuffer,
} from "../../../../utils/excel.js";
import { uploadFileToOss } from "../../../../utils/upload.js";

/**
 * POST /api/feedback/export/upload-oss
 * 从飞书拉取数据，在服务端生成 xlsx 并上传到 OSS，返回 OSS 地址。
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
 *   url: string;  // OSS 上的文件访问地址
 *   name: string; // 文件名
 * }
 */
export default async function exportUploadOss(c: ContextWithDb) {
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
      "飞书配置不完整，请填写 App ID、App Secret、App Token 和 Table ID",
    );
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/export/upload-oss] ${msg}`, ...args);

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
    },
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
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${body.appToken}/tables/${body.tableId}/records/search`,
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
        field_names: [...FIELD_NAMES],
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
      `第 ${pageNum} 页，本页 ${items.length} 条，累计 ${allRecords.length} 条`,
    );

    if (maxRecords > 0 && allRecords.length >= maxRecords) {
      log(`已达到最大拉取数量 ${maxRecords} 条，停止拉取`);
      break;
    }

    pageToken = searchData.data?.has_more
      ? (searchData.data?.page_token ?? null)
      : null;
  } while (pageToken);

  log(`飞书数据拉取完成，共 ${allRecords.length} 条`);

  // === 阶段 3：生成 xlsx ===
  log("生成 xlsx...");
  const rows = formatRecordsToRows(allRecords);
  const buffer = generateXlsxBuffer(rows);

  // === 阶段 4：上传到 OSS ===
  const fileName = `飞书反馈数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  log("开始上传到 OSS...");
  const ossUrl = await uploadFileToOss(blob, fileName);
  log("上传成功, ossUrl:", ossUrl);

  return {
    url: ossUrl,
    name: fileName,
  };
}
