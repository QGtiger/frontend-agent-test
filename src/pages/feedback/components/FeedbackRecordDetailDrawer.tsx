import { useState, useMemo, useEffect } from "react";
import {
  Drawer,
  Descriptions,
  Tag,
  Space,
  Button,
  Image,
  Spin,
  message,
  List,
  Typography,
} from "antd";
import { InboxOutlined, CloseOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import { useRequest } from "ahooks";
import { apiRequest } from "@lightfish/server/api";
import type { FeedbackRecord } from "./AnalyzeResult";
import { hideLoading, showLoading } from "../../../utils/loading";
import KbQueryCard from "./KbQueryCard";
import KbFeedbackForm from "./KbFeedbackForm";
import KbFeedbackList from "./KbFeedbackList";

const { Text } = Typography;

interface FeedbackRecordDetailDrawerProps {
  record: FeedbackRecord | null;
  onClose: () => void;
  form?: FormInstance;
}

interface KbQueryItem {
  id: number;
  result: string;
  createdAt: string;
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
  onClose,
  form,
}: FeedbackRecordDetailDrawerProps) {
  const [convertingImages, setConvertingImages] = useState(false);
  const [convertedImages, setConvertedImages] = useState<
    FeedbackRecord["images"] | null
  >(null);

  // 展开后的图片
  const expandedImages = useMemo(
    () => (record ? expandImages(record.images) : []),
    [record],
  );

  // 是否需要转存
  const needsConversion = useMemo(
    () => record !== null && hasFeishuImages(expandedImages),
    [record, expandedImages],
  );

  // 最终展示的记录：有转存结果用转存后的，否则用原始展开的
  const displayRecord = useMemo(() => {
    if (!record) return null;
    if (convertedImages) {
      return { ...record, images: convertedImages };
    }
    if (!needsConversion) {
      return { ...record, images: expandedImages };
    }
    return null;
  }, [record, convertedImages, needsConversion, expandedImages]);

  // 获取知识库查询历史列表
  const {
    data: kbListData,
    loading: kbListLoading,
    run: runKbList,
  } = useRequest(
    async (recordId: string) => {
      const res = await apiRequest<{ list: KbQueryItem[] }>(
        `/feedback/export/kb-query/list?recordId=${encodeURIComponent(recordId)}`,
      );
      return res.data;
    },
    {
      manual: true,
    },
  );

  // 新增知识库查询
  const { loading: kbCreateLoading, run: runKbCreate } = useRequest(
    async (params: {
      recordId: string;
      description?: string;
      detail?: string;
      investigation?: string;
      images?: Array<{ url: string; name: string }>;
    }) => {
      const res = await apiRequest<KbQueryItem>("/feedback/export/kb-query", {
        method: "POST",
        data: params,
      });
      return res.data;
    },
    {
      manual: true,
      onSuccess: () => {
        // 查询成功后刷新列表
        if (displayRecord) {
          runKbList(displayRecord.recordId);
        }
      },
      onError: (err: any) => {
        message.error("知识库查询失败: " + (err.message || "未知错误"));
      },
    },
  );

  // 打开抽屉时自动加载历史列表
  useEffect(() => {
    if (!displayRecord) return;
    runKbList(displayRecord.recordId);
  }, [displayRecord?.recordId]);

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

    const timer = setTimeout(convertImages, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsConversion, convertedImages, expandedImages, form]);

  // 关闭时重置状态
  const handleClose = () => {
    setConvertedImages(null);
    onClose();
  };

  // 第三列模式：form = 反馈表单, list = 查看反馈列表, null = 不显示
  const [thirdColumn, setThirdColumn] = useState<{
    mode: "form" | "list";
    id: number;
    createdAt: string;
    result: string;
  } | null>(null);

  // 点击知识库查询按钮
  const handleKBQuery = () => {
    if (!displayRecord) return;

    runKbCreate({
      recordId: displayRecord.recordId,
      description: displayRecord.description,
      detail: displayRecord.detail,
      investigation: displayRecord.investigation,
      images: displayRecord.images,
    });
  };

  return (
    <Drawer
      title="📋 反馈记录详情"
      placement="right"
      width="78%"
      open
      onClose={handleClose}
      extra={
        <Space>
          <Button onClick={handleClose}>关闭</Button>
        </Space>
      }
    >
      <Spin spinning={convertingImages} tip="正在转存飞书图片...">
        {displayRecord && (
          <div style={{ display: "flex", gap: 24, height: "100%" }}>
            {/* 左侧：反馈详情 */}
            <div style={{ flex: 1, minWidth: 0 }}>
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
            </div>

            {/* 右侧：知识库查询列表 */}
            <div
              style={{
                width: 500,
                flexShrink: 0,
                borderLeft: "1px solid #f0f0f0",
                paddingLeft: 24,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Button
                type="primary"
                icon={<InboxOutlined />}
                onClick={handleKBQuery}
                loading={kbCreateLoading}
                block
                style={{ marginBottom: 16 }}
              >
                🔍 知识库查询
              </Button>

              <div style={{ flex: 1, overflow: "auto" }}>
                <List
                  loading={kbListLoading}
                  dataSource={kbListData?.list || []}
                  renderItem={(item) => (
                    <KbQueryCard
                      id={item.id}
                      result={item.result}
                      createdAt={item.createdAt}
                      onFeedback={(kbCacheId) => {
                        setThirdColumn({
                          mode: "form",
                          id: kbCacheId,
                          createdAt: item.createdAt,
                          result: item.result,
                        });
                      }}
                      onViewFeedback={(kbCacheId) => {
                        setThirdColumn({
                          mode: "list",
                          id: kbCacheId,
                          createdAt: item.createdAt,
                          result: item.result,
                        });
                      }}
                    />
                  )}
                />
              </div>
            </div>

            {/* 第三列：反馈表单 / 查看反馈列表（互斥） */}
            {thirdColumn && (
              <div
                style={{
                  width: 360,
                  flexShrink: 0,
                  borderLeft: "1px solid #f0f0f0",
                  paddingLeft: 24,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text strong style={{ fontSize: 14 }}>
                    {thirdColumn.mode === "form"
                      ? "💬 反馈评价"
                      : "📋 查看反馈"}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setThirdColumn(null)}
                  />
                </div>
                <div style={{ flex: 1, overflow: "auto" }}>
                  {thirdColumn.mode === "form" ? (
                    <KbFeedbackForm
                      kbCacheId={thirdColumn.id}
                      kbCreatedAt={thirdColumn.createdAt}
                      kbSummary={thirdColumn.result
                        .replace(/[#*`[\]]/g, "")
                        .slice(0, 200)}
                      onSuccess={() => {
                        // 提交成功后切换到查看反馈列表
                        setThirdColumn({
                          mode: "list",
                          id: thirdColumn.id,
                          createdAt: thirdColumn.createdAt,
                          result: thirdColumn.result,
                        });
                      }}
                    />
                  ) : (
                    <KbFeedbackList
                      kbCacheId={thirdColumn.id}
                      kbCreatedAt={thirdColumn.createdAt}
                      kbSummary={thirdColumn.result
                        .replace(/[#*`[\]]/g, "")
                        .slice(0, 200)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Spin>
    </Drawer>
  );
}
