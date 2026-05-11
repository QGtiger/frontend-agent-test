import { useState, useMemo, useEffect } from "react";
import {
  Drawer,
  Descriptions,
  Tag,
  Space,
  Button,
  Image,
  Spin,
  Card,
  message,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import { apiRequest } from "@lightfish/server/api";
import type { FeedbackRecord } from "./AnalyzeResult";
import MarkdownRenderer from "../MarkdownRenderer";
import { hideLoading, showLoading } from "../../../utils/loading";

interface FeedbackRecordDetailDrawerProps {
  record: FeedbackRecord | null;
  open: boolean;
  onClose: () => void;
  form?: FormInstance;
}

/** 展开 images 中 "; " 分隔的多个 URL，拆成独立图片项 */
function expandImages(
  images: FeedbackRecord["images"],
): FeedbackRecord["images"] {
  return images.flatMap((img) => {
    const urls = img.url.split("; ").filter(Boolean);
    const names = img.name.split("; ").filter(Boolean);
    if (urls.length <= 1) {
      return [{ url: img.url, name: img.name || "图片" }];
    }
    return urls.map((url, idx) => ({
      url,
      name: names[idx] || `图片 ${idx + 1}`,
    }));
  });
}

/** 检查是否有飞书图片需要转存 */
function hasFeishuImages(images: FeedbackRecord["images"]): boolean {
  return images.some(
    (img) =>
      img.url.includes("open.feishu.cn") || img.url.includes("feishu.cn"),
  );
}

export default function FeedbackRecordDetailDrawer({
  record,
  open,
  onClose,
  form,
}: FeedbackRecordDetailDrawerProps) {
  const [convertingImages, setConvertingImages] = useState(false);
  const [convertedImages, setConvertedImages] = useState<
    FeedbackRecord["images"] | null
  >(null);
  const [kbResults, setKbResults] = useState<Record<string, string>>({});
  const [kbLoading, setKbLoading] = useState(false);

  // 展开后的图片
  const expandedImages = useMemo(
    () => (record ? expandImages(record.images) : []),
    [record],
  );

  // 是否需要转存
  const needsConversion = useMemo(
    () => record !== null && open && hasFeishuImages(expandedImages),
    [record, open, expandedImages],
  );

  // 最终展示的记录：有转存结果用转存后的，否则用原始展开的
  const displayRecord = useMemo(() => {
    if (!record || !open) return null;
    if (convertedImages) {
      return { ...record, images: convertedImages };
    }
    if (!needsConversion) {
      return { ...record, images: expandedImages };
    }
    return null;
  }, [record, open, convertedImages, needsConversion, expandedImages]);

  // 处理飞书图片转存
  useEffect(() => {
    if (!needsConversion || convertedImages) return;

    let cancelled = false;

    const convertImages = async () => {
      showLoading("正在转存飞书图片...");
      setConvertingImages(true);

      const result = [...expandedImages];
      let hasError = false;

      for (let i = 0; i < result.length; i++) {
        const img = result[i];
        if (
          !img.url.includes("open.feishu.cn") &&
          !img.url.includes("feishu.cn")
        ) {
          continue;
        }

        try {
          const values = form?.getFieldsValue();
          const res = await apiRequest<{ url: string }>(
            "/feedback/export/image-proxy",
            {
              method: "POST",
              data: {
                url: img.url,
                name: img.name,
                appId: values?.appId,
                appSecret: values?.appSecret,
              },
            },
          );
          const data = (res as any).data || res;
          result[i] = { ...img, url: data.url };
        } catch (err) {
          console.warn(`图片转存异常: ${img.name}`, err);
          hasError = true;
        }
      }

      if (!cancelled) {
        setConvertingImages(false);
        setConvertedImages(result);
        hideLoading();

        if (hasError) {
          message.warning("部分图片转存失败，已展示原始飞书链接");
        }
      }
    };

    // 使用 setTimeout 延迟执行，避免在 effect 中同步 setState
    const timer = setTimeout(convertImages, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsConversion, convertedImages, expandedImages, form]);

  // 关闭时重置状态
  const handleClose = () => {
    setConvertedImages(null);
    setKbResults({});
    setKbLoading(false);
    onClose();
  };

  const handleKBQuery = async () => {
    if (!displayRecord) return;

    const recordId = displayRecord.recordId;
    if (kbResults[recordId]) return;

    const parts: string[] = [];
    if (displayRecord.description) {
      parts.push(`描述(人、操作、现象)：${displayRecord.description}`);
    }
    if (displayRecord.detail) {
      parts.push(`详细说明「现象、操作、问题」：${displayRecord.detail}`);
    }
    if (displayRecord.investigation) {
      parts.push(`排查情况：${displayRecord.investigation}`);
    }
    if (displayRecord.images?.length > 0) {
      const imageInfo = displayRecord.images
        .map((img) => `[图片] ${img.name}: ${img.url}`)
        .join("\n");
      parts.push(`相关图片：\n${imageInfo}`);
    }
    const content = parts.join("\n\n");
    if (!content) {
      message.warning("没有可查询的内容");
      return;
    }

    setKbLoading(true);
    try {
      const res = await fetch(
        "https://test-yddoc.yingdao.com/api/agents/rpaQaAgent/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: "tgw_l7_route=7c8ae90f48839c29750e1ccc76081893",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content }],
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }

      const result = await res.json();
      setKbResults((prev) => ({
        ...prev,
        [recordId]: result.text || "无返回结果",
      }));
    } catch (err: any) {
      message.error("知识库查询失败: " + err.message);
    } finally {
      setKbLoading(false);
    }
  };

  return (
    <Drawer
      title="📋 反馈记录详情"
      placement="right"
      width="50%"
      open={open}
      onClose={handleClose}
      extra={
        <Space>
          <Button onClick={handleClose}>关闭</Button>
        </Space>
      }
    >
      <Spin spinning={convertingImages} tip="正在转存飞书图片...">
        {displayRecord && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="记录 ID">
                <Tag color="geekblue">{displayRecord.recordId}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="序号">
                #{displayRecord.index}
              </Descriptions.Item>
              <Descriptions.Item label="描述(人、操作、现象)">
                {displayRecord.description || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="详细说明「现象、操作、问题」">
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {displayRecord.detail || "-"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="排查情况">
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {displayRecord.investigation || "-"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="图片">
                {displayRecord.images?.length > 0 ? (
                  <Space direction="vertical" size={8}>
                    {displayRecord.images.map((img, idx) => (
                      <div key={idx}>
                        <Image
                          src={img.url}
                          alt={img.name}
                          style={{ maxWidth: 400, maxHeight: 300 }}
                          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                        />
                        <div
                          style={{
                            fontSize: 12,
                            color: "#999",
                            marginTop: 4,
                          }}
                        >
                          {img.name}
                        </div>
                      </div>
                    ))}
                  </Space>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
            </Descriptions>

            {/* 知识库查询区域 */}
            <div style={{ marginTop: 24 }}>
              <Button
                type="primary"
                icon={<InboxOutlined />}
                onClick={handleKBQuery}
                loading={kbLoading}
              >
                🔍 知识库查询
              </Button>

              {displayRecord && kbResults[displayRecord.recordId] && (
                <Card
                  title="📖 知识库匹配结果"
                  size="small"
                  style={{ marginTop: 16 }}
                >
                  <MarkdownRenderer
                    content={kbResults[displayRecord.recordId]}
                  />
                </Card>
              )}
            </div>
          </div>
        )}
      </Spin>
    </Drawer>
  );
}
