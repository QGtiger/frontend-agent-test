import { useState, useRef, useCallback } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Table,
  Tag,
  Typography,
  message,
  Space,
  Collapse,
  Select,
  Steps,
  Modal,
} from "antd";
import { getAppConfig } from "../../utils";
import MarkdownRenderer from "./MarkdownRenderer";

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface FeedbackRecord {
  recordId: string;
  index: number;
  description: string;
  detail: string;
  investigation: string;
  images: Array<{ url: string; name: string }>;
}

interface AnalyzeResult {
  records: FeedbackRecord[];
  analysis: string;
  topIssues: Array<{
    rank: number;
    title: string;
    count: number;
    description: string;
  }>;
  total: number;
}

type ProgressStep =
  | "idle"
  | "token"
  | "fetching"
  | "analyzing"
  | "done"
  | "error";

const DEFAULT_VALUES = {
  appId: "cli_a7a6ca3bf7dad00b",
  appSecret: "sZq2GflDZ0OVNhbqbNyhybeCfStGYoel",
  appToken: "GhgNbqLihaYvs8sUtmkc9MZdnPc",
  tableId: "tblMqq16QOGraL2C",
  viewId: "vewQpaj4oq",
  fieldNames: [
    "描述(人、操作、现象)",
    "上传相关图片/GIF",
    "详细说明「现象、操作、问题」",
    "排查情况",
  ].join(","),
  maxRecords: 100,
  apiKey: "sk-642c13edbffc4ca389da304aff0eb331",
  model: "deepseek-chat",
  systemPrompt: `你是一个专业的用户反馈分析助手。请根据用户反馈数据分析出高频问题，并以 JSON 格式返回。

返回格式：
{
  "analysis": "完整的 Markdown 分析报告，包含问题分类、详细分析、改进建议等，引用具体反馈时，必须使用 [反馈N](record://recordId) 格式，其中 N 是反馈序号，recordId 是反馈的唯一标识",
  "topIssues": [
    { "rank": 1, "title": "问题标题", "count": 10, "description": "问题描述" }
  ]
}

要求：
1. analysis 字段用 Markdown 编写，内容详实，引用具体反馈时，必须使用 [反馈N](record://recordId) 格式，其中 N 是反馈序号，recordId 是反馈的唯一标识
2. topIssues 按出现次数从高到低排序`,
};

export default function FeedbackPage() {
  const [form] = Form.useForm();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [progress, setProgress] = useState<ProgressStep>("idle");
  const [fetchProgress, setFetchProgress] = useState({ page: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    record: FeedbackRecord | null;
  }>({ open: false, record: null });
  const abortRef = useRef<AbortController | null>(null);

  const handleRecordClick = useCallback(
    (recordId: string) => {
      const record = result?.records.find((r) => r.recordId === recordId);
      if (record) {
        setDetailModal({ open: true, record });
      }
    },
    [result]
  );

  const handleAnalyze = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }

    // 重置状态
    setResult(null);
    setErrorMsg("");
    setFetchProgress({ page: 0, total: 0 });

    const values = form.getFieldsValue();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { SERVER_API, version, appName } = getAppConfig();
      const response = await fetch(SERVER_API + "/api/feedback/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Name": appName,
          "X-Version": version,
        },
        body: JSON.stringify({
          feishu: {
            appId: values.appId,
            appSecret: values.appSecret,
            appToken: values.appToken,
            tableId: values.tableId,
            viewId: values.viewId || undefined,
            fieldNames: values.fieldNames || undefined,
            maxRecords: values.maxRecords
              ? Number(values.maxRecords)
              : undefined,
          },
          deepseek: {
            apiKey: values.apiKey,
            model: values.model || "deepseek-chat",
          },
          systemPrompt: values.systemPrompt,
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent === "progress") {
                if (data.step === "token") setProgress("token");
                else if (data.step === "fetching") {
                  setProgress("fetching");
                  setFetchProgress({ page: data.page, total: data.total });
                } else if (data.step === "analyzing") setProgress("analyzing");
              } else if (currentEvent === "result") {
                // 先设置统计和分析结果（数据量小），UI 立即更新
                setResult((prev) => ({
                  records: prev?.records || [],
                  analysis: data.analysis,
                  topIssues: data.topIssues,
                  total: data.total,
                }));
                setProgress("done");
                message.success(`分析完成，共获取 ${data.total} 条反馈`);
              } else if (currentEvent === "records") {
                // 分批累加 records
                setResult((prev) =>
                  prev ? { ...prev, records: [...prev.records, ...data] } : null
                );
              } else if (currentEvent === "error") {
                setErrorMsg(data.message);
                setProgress("error");
                message.error(data.message);
              }
            } catch {
              // JSON 解析失败，可能是跨 chunk 截断，忽略
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setErrorMsg(err.message);
        setProgress("error");
        message.error(err.message || "分析失败");
      }
    }
  };

  const columns = [
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      width: 250,
    },
    {
      title: "详细说明",
      dataIndex: "detail",
      key: "detail",
      ellipsis: true,
      width: 250,
    },
    {
      title: "排查情况",
      dataIndex: "investigation",
      key: "investigation",
      ellipsis: true,
    },
    {
      title: "图片",
      dataIndex: "images",
      key: "images",
      width: 80,
      render: (images: any[]) =>
        images?.length ? <Tag color="blue">{images.length} 张</Tag> : "-",
    },
  ];

  const progressStepMap: Record<ProgressStep, number> = {
    idle: 0,
    token: 1,
    fetching: 1,
    analyzing: 2,
    done: 3,
    error: 3,
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* 左侧配置面板 */}
      <div
        style={{
          width: 480,
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid #f0f0f0",
          overflow: "auto",
          padding: 24,
        }}
      >
        <Title level={4} style={{ marginBottom: 24 }}>
          ⚙️ 配置
        </Title>

        <Form form={form} layout="vertical" initialValues={DEFAULT_VALUES}>
          <Collapse
            defaultActiveKey={["feishu", "deepseek", "prompt"]}
            items={[
              {
                key: "feishu",
                label: "飞书配置",
                children: (
                  <>
                    <Form.Item
                      name="appId"
                      label="App ID"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Input placeholder="cli_xxxxxxxx" />
                    </Form.Item>
                    <Form.Item
                      name="appSecret"
                      label="App Secret"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Input.Password placeholder="请输入" />
                    </Form.Item>
                    <Form.Item
                      name="appToken"
                      label="多维表格 App Token"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Input placeholder="可从飞书表格 URL 获取" />
                    </Form.Item>
                    <Form.Item
                      name="tableId"
                      label="Table ID"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Input placeholder="tblxxxxxxxx" />
                    </Form.Item>
                    <Form.Item name="viewId" label="View ID">
                      <Input placeholder="vewxxxxxxxx（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="fieldNames"
                      label="字段名（逗号分隔）"
                      tooltip="默认：描述(人、操作、现象),上传相关图片/GIF,详细说明「现象、操作、问题」,排查情况"
                    >
                      <Input placeholder="可选，默认使用常见字段名" />
                    </Form.Item>
                    <Form.Item name="maxRecords" label="最大拉取数量">
                      <Input type="number" placeholder="0 表示不限制" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "deepseek",
                label: "DeepSeek 配置",
                children: (
                  <>
                    <Form.Item
                      name="apiKey"
                      label="API Key"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Input.Password placeholder="sk-xxxxxxxx" />
                    </Form.Item>
                    <Form.Item name="model" label="模型">
                      <Select
                        options={[
                          { value: "deepseek-chat", label: "deepseek-chat" },
                          {
                            value: "deepseek-reasoner",
                            label: "deepseek-reasoner",
                          },
                        ]}
                      />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "prompt",
                label: "AI 分析提示词",
                children: (
                  <Form.Item
                    name="systemPrompt"
                    label="System Prompt"
                    rules={[{ required: true, message: "必填" }]}
                  >
                    <TextArea
                      rows={8}
                      placeholder="你是一个专业的用户反馈分析助手..."
                    />
                  </Form.Item>
                ),
              },
            ]}
          />

          <Button
            type="primary"
            onClick={handleAnalyze}
            loading={
              progress !== "idle" && progress !== "done" && progress !== "error"
            }
            block
            size="large"
            style={{ marginTop: 24 }}
          >
            {progress === "idle" && "🚀 同步并分析"}
            {progress === "token" && "获取飞书授权中..."}
            {progress === "fetching" &&
              `拉取数据中 (第${fetchProgress.page}页)...`}
            {progress === "analyzing" && "AI 分析中..."}
            {(progress === "done" || progress === "error") && "🔄 重新分析"}
          </Button>
        </Form>
      </div>

      {/* 右侧结果面板 */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {/* 进度条 */}
        {progress !== "idle" && (
          <Card style={{ marginBottom: 16 }}>
            <Steps
              current={progressStepMap[progress]}
              status={progress === "error" ? "error" : "process"}
              items={[
                {
                  title: "获取授权",
                  description:
                    progress === "token" ? "获取飞书 token..." : "完成",
                },
                {
                  title: "拉取数据",
                  description:
                    progress === "fetching"
                      ? `第 ${fetchProgress.page} 页，已获取 ${fetchProgress.total} 条`
                      : progressStepMap[progress] > 1
                      ? `共 ${fetchProgress.total} 条`
                      : "等待中",
                },
                {
                  title: "AI 分析",
                  description:
                    progress === "analyzing"
                      ? "调用 DeepSeek 分析中..."
                      : progressStepMap[progress] > 2
                      ? "完成"
                      : "等待中",
                },
                {
                  title: "完成",
                  description:
                    progress === "done"
                      ? "分析完成"
                      : progress === "error"
                      ? "分析出错"
                      : "等待中",
                },
              ]}
            />
          </Card>
        )}

        {/* 错误信息 */}
        {progress === "error" && (
          <Card style={{ marginBottom: 16, borderColor: "#ff4d4f" }}>
            <Text type="danger">{errorMsg}</Text>
          </Card>
        )}

        {/* 结果展示 */}
        {result ? (
          <div>
            {/* 统计信息 */}
            <Card style={{ marginBottom: 16 }}>
              <Space size="large">
                <Text strong>总反馈数：{result.total} 条</Text>
                {result.topIssues.length > 0 && (
                  <Text strong type="success">
                    识别出 {result.topIssues.length} 个高频问题
                  </Text>
                )}
              </Space>
            </Card>

            {/* 高频问题 TOP */}
            {result.topIssues.length > 0 && (
              <Card title="📊 高频问题 TOP" style={{ marginBottom: 16 }}>
                <Table
                  dataSource={result.topIssues}
                  columns={[
                    { title: "#", dataIndex: "rank", key: "rank", width: 50 },
                    { title: "问题标题", dataIndex: "title", key: "title" },
                    {
                      title: "出现次数",
                      dataIndex: "count",
                      key: "count",
                      width: 100,
                      render: (count: number) => (
                        <Tag
                          color={
                            count >= 10 ? "red" : count >= 5 ? "orange" : "blue"
                          }
                        >
                          {count} 次
                        </Tag>
                      ),
                    },
                    {
                      title: "描述",
                      dataIndex: "description",
                      key: "description",
                    },
                  ]}
                  rowKey="rank"
                  pagination={false}
                  size="small"
                />
              </Card>
            )}

            {/* AI 分析原文 */}
            <Collapse
              items={[
                {
                  key: "analysis",
                  label: "📝 AI 分析原文",
                  children: (
                    <MarkdownRenderer
                      content={result.analysis}
                      onRecordClick={handleRecordClick}
                    />
                  ),
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            {/* 反馈列表 */}
            <Card title="📋 反馈列表">
              <Table
                dataSource={result.records}
                columns={columns}
                rowKey="recordId"
                size="small"
                pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
                expandable={{
                  expandedRowRender: (record) => (
                    <div style={{ padding: "8px 0" }}>
                      <Text strong>详细说明：</Text>
                      <Paragraph>{record.detail || "无"}</Paragraph>
                      <Text strong>排查情况：</Text>
                      <Paragraph>{record.investigation || "无"}</Paragraph>
                      {record.images?.length > 0 && (
                        <>
                          <Text strong>图片：</Text>
                          <div style={{ marginTop: 4 }}>
                            {record.images.map((img, idx) => (
                              <div key={idx}>
                                <a
                                  href={img.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {img.name || `图片 ${idx + 1}`}
                                </a>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ),
                  rowExpandable: (record) =>
                    !!record.detail ||
                    !!record.investigation ||
                    record.images?.length > 0,
                }}
              />
            </Card>
          </div>
        ) : progress === "idle" ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 200,
              color: "#999",
            }}
          >
            <Title level={4} type="secondary">
              请在左侧填写配置后点击"同步并分析"
            </Title>
            <Text type="secondary">
              系统将从飞书多维表格拉取反馈数据，调用 DeepSeek AI 进行分析
            </Text>
          </div>
        ) : null}
      </div>

      {/* 反馈详情弹窗 */}
      <Modal
        title={`反馈详情 #${detailModal.record?.index}`}
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, record: null })}
        footer={null}
        width={640}
      >
        {detailModal.record && (
          <div>
            <Paragraph>
              <Text strong>描述：</Text>
              <div>{detailModal.record.description || "无"}</div>
            </Paragraph>
            <Paragraph>
              <Text strong>详细说明：</Text>
              <div>{detailModal.record.detail || "无"}</div>
            </Paragraph>
            <Paragraph>
              <Text strong>排查情况：</Text>
              <div>{detailModal.record.investigation || "无"}</div>
            </Paragraph>
            {detailModal.record.images?.length > 0 && (
              <Paragraph>
                <Text strong>图片：</Text>
                <div style={{ marginTop: 4 }}>
                  {detailModal.record.images.map((img, idx) => (
                    <div key={idx}>
                      <a href={img.url} target="_blank" rel="noreferrer">
                        {img.name || `图片 ${idx + 1}`}
                      </a>
                    </div>
                  ))}
                </div>
              </Paragraph>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
