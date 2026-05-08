import * as XLSX from "xlsx";

/**
 * 从飞书字段中提取文本
 */
export function extractText(field: any): string {
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

/**
 * 从飞书图片字段中提取图片 URL 字符串（"; " 分隔）
 */
export function extractImageUrls(field: any): string {
  if (!field) return "";
  if (Array.isArray(field)) {
    return field
      .filter((item: any) => item.file_token)
      .map((item: any) => item.url || item.tmp_url || "")
      .filter(Boolean)
      .join("; ");
  }
  if (typeof field === "object") {
    const rawUrl = field.url || field.tmp_url || "";
    if (rawUrl) {
      return rawUrl.split("; ").filter(Boolean).join("; ");
    }
  }
  return "";
}

/**
 * 从飞书图片字段中提取图片名称字符串（"; " 分隔）
 */
export function extractImageNames(field: any): string {
  if (!field) return "";
  if (Array.isArray(field)) {
    return field
      .filter((item: any) => item.file_token)
      .map((item: any) => item.name || "")
      .filter(Boolean)
      .join("; ");
  }
  if (typeof field === "object") {
    const rawName = field.name || "";
    if (rawName) {
      return rawName.split("; ").filter(Boolean).join("; ");
    }
  }
  return "";
}

/**
 * 飞书字段名常量
 */
export const FIELD_NAMES = [
  "描述(人、操作、现象)",
  "上传相关图片/GIF",
  "详细说明「现象、操作、问题」",
  "排查情况",
] as const;

/**
 * 将飞书 records 数据格式化为 xlsx 的行数据
 */
export function formatRecordsToRows(
  allRecords: Array<{
    record_id: string;
    fields: Record<string, any>;
  }>,
) {
  return allRecords.map((r, idx) => ({
    序号: idx + 1,
    "描述(人、操作、现象)": extractText(r.fields[FIELD_NAMES[0]]),
    "详细说明「现象、操作、问题」": extractText(
      r.fields[FIELD_NAMES[2]] || r.fields["详细说明「现象、操作、问题」"],
    ),
    排查情况: extractText(r.fields[FIELD_NAMES[3]] || r.fields["排查情况"]),
    图片链接: extractImageUrls(
      r.fields[FIELD_NAMES[1]] || r.fields["上传相关图片/GIF"],
    ),
    图片名称: extractImageNames(
      r.fields[FIELD_NAMES[1]] || r.fields["上传相关图片/GIF"],
    ),
    "记录 ID": r.record_id,
  }));
}

/**
 * 生成 xlsx 文件的 ArrayBuffer
 */
export function generateXlsxBuffer(
  rows: Array<Record<string, any>>,
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

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

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
