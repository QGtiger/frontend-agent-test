const uploadUrl = "https://logs.yingdao.com/report-api/upload/file";

export async function uploadFile(config: {
  blob: Blob;
  name: string;
}): Promise<string> {
  if (!uploadUrl) {
    throw new Error("未配置上传文件的 URL");
  }

  const formData = new FormData();
  formData.append("file", config.blob);
  formData.append("filename", config.name);

  return fetch(uploadUrl, {
    headers: {
      domain: "front-gw.yingdao.com",
      ContentType: "multipart/form-data",
    },
    method: "POST",
    body: formData,
  })
    .then((r) => r.json())
    .then((r) => r.data.readUrl);
}
