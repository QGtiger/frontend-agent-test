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
  Modal,
  Input,
  Select,
} from "antd";
import {
  InboxOutlined,
  CloseOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import type { FormInstance } from "antd";
import { useRequest } from "ahooks";
import { apiRequest } from "@lightfish/server/api";
import copy from "copy-to-clipboard";
import type { FeedbackRecord } from "./AnalyzeResult";
import { FEISHU_DEFAULT_VALUES } from "../constants";
import { hideLoading, showLoading } from "../../../utils/loading";
import KbQueryCard from "./KbQueryCard";
import KbFeedbackPanel from "./KbFeedbackPanel";

const { Text } = Typography;

interface FeedbackRecordDetailDrawerProps {
  record: FeedbackRecord | null;
  onClose: () => void;
  form?: FormInstance;
}

interface KbQueryItem {
  id: number;
  result: string;
  curlCommand?: string | null;
  traceUrl?: string | null;
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

const DefaultSystemPrompt = `你是影刀RPA的产品文档助手。你只基于文档知识库回答问题，不编造信息。

## 核心原则
- 知之为知之，不知为不知。没有可靠依据时，坦诚说"根据现有文档未找到相关信息"，并给出可能有帮助的参考文档链接。
- 绝不基于猜测或通用知识编造影刀产品相关的具体功能描述、操作步骤或API用法。
- 回答简洁直接，控制在3-5句话以内。用户需要细节时会追问。

## 工作流程
1. 收到问题后，用 documentSearchTool 搜索知识库。
2. 判断搜索结果与问题的相关性：
   - 高相关：直接基于结果回答。
   - 低相关或无结果：告知用户未找到准确答案，列出可能相关的文档链接供参考。
   - 工具报错：告知用户"文档搜索暂时不可用，请稍后再试"。

## 回答格式
固定结构，缺省则跳过：

**结论**（1-3句话直接回答问题）

关键细节或步骤（仅在必要时展开，不超过5点）

相关图片/视频（如果搜索结果的 media 字段中有）
- 图片：![描述](URL)
- 视频：<video src="URL" controls></video>

参考文档：
- [文档名称](docUrl)

## 媒体资源
搜索结果的 media 字段包含 images 和 videos 数组。如果非空，在回答相关位置展示，不要遗漏。

## 文档链接
- 每次回答末尾必须附上参考文档链接（来自搜索结果的 metadata.docUrl）。
- 格式：Markdown 链接 [文档名称](URL)。
- 即使回答"未找到相关信息"，也要列出搜索到的最相关文档链接供用户自行查阅。

## 边界
- 只回答影刀产品相关问题。无关问题礼貌拒绝。
- 不要把多个搜索结果全部堆砌，只用最相关的1-2条。
- 使用中文回答。`;

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
      onSuccess: (data) => {
        // 列表加载完成后，默认选中第一个
        if (data?.list?.length > 0) {
          const first = data.list[0];
          setFeedbackPanel({
            id: first.id,
            createdAt: first.createdAt,
            result: first.result,
          });
        }
      },
    },
  );

  // 新增知识库查询
  const { loading: kbCreateLoading, run: runKbCreate } = useRequest(
    async (params: {
      recordId: string;
      content: string;
      env?: string;
      system?: string;
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
                appId: values?.appId || FEISHU_DEFAULT_VALUES.appId,
                appSecret: values?.appSecret || FEISHU_DEFAULT_VALUES.appSecret,
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

  // 第三列：反馈面板（列表 + 表单）
  const [feedbackPanel, setFeedbackPanel] = useState<{
    id: number;
    createdAt: string;
    result: string;
  } | null>(null);

  // 知识库查询配置弹窗
  const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DefaultSystemPrompt);
  const [kbEnv, setKbEnv] = useState("staging");
  const [kbContent, setKbContent] = useState("");

  // 点击知识库查询按钮
  const handleKBQuery = () => {
    if (!displayRecord) return;

    // 前端拼接查询内容
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
    const images = displayRecord.images;
    if (images && images.length > 0) {
      const imageInfo = images
        .map((img) => `[图片] ${img.name}: ${img.url}`)
        .join("\n");
      parts.push(`相关图片：\n${imageInfo}`);
    }
    const content = parts.join("\n\n");

    setKbContent(content);
    // 弹出配置弹窗
    setSystemPromptModalOpen(true);
  };

  // 确认查询
  const handleConfirmQuery = () => {
    if (!displayRecord) return;
    if (!kbContent?.trim()) {
      message.warning("请输入查询内容");
      return;
    }
    setSystemPromptModalOpen(false);
    runKbCreate({
      recordId: displayRecord.recordId,
      content: kbContent,
      env: kbEnv,
      system: systemPrompt,
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
          <Button
            icon={<ShareAltOutlined />}
            onClick={() => {
              copy(window.location.href);
              message.success("链接已复制");
            }}
          >
            分享
          </Button>
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
                      curlCommand={item.curlCommand}
                      traceUrl={item.traceUrl}
                      onFeedback={(kbCacheId) => {
                        setFeedbackPanel({
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

            {/* 第三列：反馈面板（列表 + 表单） */}
            {feedbackPanel && (
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
                    💬 反馈
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setFeedbackPanel(null)}
                  />
                </div>
                <div style={{ flex: 1, overflow: "auto" }}>
                  <KbFeedbackPanel
                    kbCacheId={feedbackPanel.id}
                    kbCreatedAt={feedbackPanel.createdAt}
                    kbSummary={feedbackPanel.result
                      .replace(/[#*`[\]]/g, "")
                      .slice(0, 200)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Spin>

      {/* 知识库查询配置弹窗 */}
      <Modal
        title="🔍 知识库查询配置"
        open={systemPromptModalOpen}
        onOk={handleConfirmQuery}
        onCancel={() => setSystemPromptModalOpen(false)}
        okText="开始查询"
        cancelText="取消"
        width={700}
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text strong>环境选择：</Text>
          <Select
            value={kbEnv}
            onChange={setKbEnv}
            style={{ width: 160 }}
            options={[
              { value: "staging", label: "Staging" },
              { value: "online", label: "Online" },
            ]}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>查询内容（Content）</Text>
        </div>
        <Input.TextArea
          value={kbContent}
          onChange={(e) => setKbContent(e.target.value)}
          rows={8}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        <div style={{ marginBottom: 8, marginTop: 16 }}>
          <Text strong>系统提示词（System Prompt）</Text>
        </div>
        <Input.TextArea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={20}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
      </Modal>
    </Drawer>
  );
}
