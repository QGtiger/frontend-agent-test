import type { ContextWithDb } from "@lightfish/server";

/**
 * 通用代理接口
 *
 * GET /api/feedback/proxy?url=https://xxx
 * POST /api/feedback/proxy?url=https://xxx
 *
 * 将请求透传给目标 URL，method、headers、body 均保持与当前请求一致。
 * 用于解决前端跨域问题。
 */
export default async function proxy(c: ContextWithDb) {
  const targetUrl = c.req.query("url");
  if (!targetUrl) {
    throw new Error("缺少 url 参数");
  }

  // 复制请求头，删除可能导致问题的头
  const headers = new Headers(c.req.raw.headers);
  headers.delete("Origin");
  headers.delete("Referer");

  // 转发请求
  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers,
    body:
      c.req.method !== "GET" && c.req.method !== "HEAD"
        ? c.req.raw.body
        : undefined,
    redirect: "follow",
  });

  // 添加 CORS 头
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  newHeaders.set("Access-Control-Allow-Headers", "*");

  // 删除可能导致编码问题的头（fetch 已自动解压，但 headers 中还保留着）
  newHeaders.delete("Content-Encoding");
  newHeaders.delete("Content-Length");

  // 处理预检请求
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: newHeaders });
  }

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
