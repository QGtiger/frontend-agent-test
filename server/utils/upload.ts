const UPLOAD_URL = "https://logs.yingdao.com/report-api/upload/file";

/**
 * 服务端上传文件到 OSS
 * @param blob 文件二进制数据
 * @param name 文件名
 * @returns OSS 访问 URL
 */
export async function uploadFileToOss(
  blob: Blob,
  name: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("filename", name);

  const res = await fetch(UPLOAD_URL, {
    headers: {
      domain: "front-gw.yingdao.com",
    },
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`上传文件失败: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: { readUrl?: string };
  };

  const ossUrl = data?.data?.readUrl;
  if (!ossUrl) {
    throw new Error(`上传文件返回格式异常: ${JSON.stringify(data)}`);
  }

  return ossUrl;
}
