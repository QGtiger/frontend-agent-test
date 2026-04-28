import type { ContextWithDb } from "@lightfish/server";
import { feishuImageMapping } from "../../../../schema/index.js";
import { eq } from "drizzle-orm";

const UPLOAD_URL = "https://logs.yingdao.com/report-api/upload/file";

/**
 * POST /api/feedback/export/image-proxy
 * 飞书图片转存接口。
 *
 * 请求体：
 * {
 *   url: string;        // 飞书图片下载 URL
 *   name: string;       // 图片文件名
 *   appId: string;      // 飞书 App ID
 *   appSecret: string;  // 飞书 App Secret
 * }
 *
 * 返回：
 * {
 *   url: string;  // 转存后的图片 URL
 *   name: string;
 * }
 */
export default async function imageProxy(c: ContextWithDb) {
  const body = await c.req.json<{
    url: string;
    name: string;
    appId: string;
    appSecret: string;
  }>();

  if (!body.url || !body.appId || !body.appSecret) {
    throw new Error("缺少必要参数 url、appId 或 appSecret");
  }

  const log = (msg: string, ...args: any[]) =>
    console.log(`[feedback/export/image-proxy] ${msg}`, ...args);

  log("开始转存图片:", body.url.slice(0, 100), body.name);

  // === 1. 先查数据库缓存 ===
  const db = c.get("db");
  if (db) {
    const existing = await db
      .select({ ossUrl: feishuImageMapping.ossUrl })
      .from(feishuImageMapping)
      .where(eq(feishuImageMapping.feishuUrl, body.url))
      .limit(1);

    if (existing.length > 0) {
      log("缓存命中, ossUrl:", existing[0].ossUrl);
      return {
        url: existing[0].ossUrl,
        name: body.name,
      };
    }
    log("缓存未命中，开始下载上传");
  } else {
    log("数据库未配置，跳过缓存查询");
  }

  // === 2. 获取飞书 token ===
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
  const feishuToken = tokenData.tenant_access_token;

  // === 3. 从飞书下载图片 ===
  const response = await fetch(body.url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${feishuToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `飞书图片下载失败: ${response.status} ${response.statusText}`
    );
  }

  const blob = await response.blob();

  log("图片下载成功, size:", blob.size, "type:", blob.type);

  // === 4. 上传到 OSS ===
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("filename", body.name);

  const uploadRes = await fetch(UPLOAD_URL, {
    headers: {
      domain: "front-gw.yingdao.com",
    },
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(
      `上传文件失败: ${uploadRes.status} ${uploadRes.statusText}`
    );
  }

  const uploadData = (await uploadRes.json()) as {
    code?: number;
    msg?: string;
    data?: { readUrl?: string };
  };

  const ossUrl = uploadData?.data?.readUrl;
  if (!ossUrl) {
    throw new Error(`上传文件返回格式异常: ${JSON.stringify(uploadData)}`);
  }

  log("图片转存成功, ossUrl:", ossUrl);

  // === 5. 写入数据库缓存 ===
  if (db) {
    try {
      await db.insert(feishuImageMapping).values({
        feishuUrl: body.url,
        ossUrl,
        fileName: body.name,
      });
      log("缓存写入成功");
    } catch (err) {
      // 唯一键冲突等错误忽略（并发场景下可能已存在）
      log("缓存写入失败（可能已存在）:", err);
    }
  }

  return {
    url: ossUrl,
    name: body.name,
  };
}
