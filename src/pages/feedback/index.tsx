import { useState, useRef, useCallback } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Steps,
  Modal,
  Select,
  Collapse,
} from "antd";
import { getAppConfig } from "../../utils";
import AnalyzeResult, {
  type AnalyzeResultData,
  type FeedbackRecord,
} from "./components/AnalyzeResult";

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

type ProgressStep =
  | "idle"
  | "token"
  | "fetching"
  | "analyzing"
  | "done"
  | "error";

const CHANNEL_OPTIONS = [
  { label: "Azure", value: "azure" },
  { label: "Ernie (文心)", value: "ernie" },
  { label: "Sensenova (商汤)", value: "sensenova" },
  { label: "SparkAI (讯飞)", value: "sparkai" },
  { label: "Claude", value: "claude" },
  { label: "Baichuan (百川)", value: "baichuan" },
  { label: "Qwen (通义千问)", value: "qwen" },
  { label: "ChatGLM (智谱)", value: "chatglm" },
  { label: "Moonshot (月之暗面)", value: "moonshot" },
  { label: "DeepSeek", value: "deepseek" },
  { label: "Doubao (豆包)", value: "doubao" },
  { label: "Gemini", value: "gemini" },
  { label: "Morph", value: "morph" },
  { label: "MiniMax", value: "minimax" },
];

const MODEL_OPTIONS: Record<string, string[]> = {
  azure: [
    "gpt-35",
    "gpt-4",
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "o-mini",
    "o3",
    "gpt-5.2",
  ],
  ernie: ["ernie-lite-8k", "ernie-3.5", "ernie-speed-128k", "ernie-4"],
  sensenova: ["nova-ptc-xl-v1", "nova-ptc-xs-v1", "SenseChat-5"],
  sparkai: ["general", "generalv3.5", "pro-128k", "4.0Ultra"],
  claude: [
    "claude-v3-haiku",
    "claude-v3.5-haiku",
    "claude-v3.5-sonnet",
    "claude-v3.7-sonnet",
    "claude-sonnet-4",
    "claude-opus-4",
  ],
  baichuan: [
    "Baichuan2-Turbo",
    "Baichuan2-Turbo-192k",
    "Baichuan4",
    "Baichuan3-Turbo",
    "Baichuan3-Turbo-128k",
  ],
  qwen: [
    "qwen-turbo",
    "qwen-plus",
    "qwen-max",
    "qwen2.5-14b-instruct",
    "qwen2.5-32b-instruct",
    "qwen2.5-72b-instruct",
    "qwq-plus",
  ],
  chatglm: [
    "glm-3-turbo",
    "glm-4",
    "glm-4-long",
    "glm-4-flash",
    "glm-4.7",
    "glm-4.6v",
  ],
  moonshot: [
    "moonshot-v1-8k",
    "moonshot-v1-32k",
    "moonshot-v1-128k",
    "kimi-k2",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  doubao: [
    "Doubao-1.5-pro-256k",
    "Doubao-1.5-vision-lite",
    "Doubao-1.5-vision-pro",
    "Doubao-1.5-thinking-pro",
    "Doubao-1.5-lite-32k",
    "Doubao-1-5-ui-tars",
    "Doubao-seed-1.6",
    "Doubao-seed-1.6-thinking",
    "Doubao-seed-1.6-flash",
    "Doubao-seed-1.8",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-3-flash",
  ],
  morph: ["morph-v2"],
  minimax: ["MiniMax-M2.1"],
};

const AI_PROVIDER_OPTIONS = [
  { label: "DeepSeek", value: "deepseek" },
  { label: "内部 API", value: "internal" },
];

/** 各 AI 提供商的请求头和请求体（写死，用户不可配置） */
const AI_PROVIDER_FIXED_CONFIG: Record<
  string,
  {
    headers: Record<string, string>;
    body: Record<string, any>;
  }
> = {
  deepseek: {
    headers: {
      Authorization: "Bearer sk-642c13edbffc4ca389da304aff0eb331",
    },
    body: {},
  },
  internal: {
    headers: {
      "xybot-user": JSON.stringify({
        organizationUuid: "your-org-uuid",
        tenantUuid: "your-tenant-uuid",
        uuid: "your-uuid",
      }),
    },
    body: {
      bizId: "274335384338436",
      bizCode: "ai-power",
      bizType: "ai_search",
      temperature: 0.0,
      timeout: 180,
    },
  },
};

const DEFAULT_VALUES = {
  appId: "cli_a7a6ca3bf7dad00b",
  appSecret: "sZq2GflDZ0OVNhbqbNyhybeCfStGYoel",
  appToken: "GhgNbqLihaYvs8sUtmkc9MZdnPc",
  tableId: "tblMqq16QOGraL2C",
  viewId: "vewQpaj4oq",
  maxRecords: 100,
  aiProvider: "internal",
  aiUrl: "https://api.deepseek.com/chat/completions",
  aiChannel: "deepseek",
  aiModel: "deepseek-chat",
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
  const [selectedChannel, setSelectedChannel] = useState(
    DEFAULT_VALUES.aiChannel
  );
  const [result, setResult] = useState<AnalyzeResultData | null>(null);
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

    // 根据选中的 AI 提供商获取写死的 headers 和 body
    const provider = values.aiProvider || "deepseek";
    const fixed =
      AI_PROVIDER_FIXED_CONFIG[provider] || AI_PROVIDER_FIXED_CONFIG.deepseek;

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
            maxRecords: values.maxRecords
              ? Number(values.maxRecords)
              : undefined,
          },
          ai: {
            url: values.aiUrl,
            headers: JSON.stringify(fixed.headers),
            channel: values.aiChannel || "",
            model: values.aiModel || "deepseek-chat",
            body: JSON.stringify(fixed.body),
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
                setResult((prev) => ({
                  records: prev?.records || [],
                  analysis: data.analysis,
                  topIssues: data.topIssues,
                  total: data.total,
                }));
                setProgress("done");
                message.success(`分析完成，共获取 ${data.total} 条反馈`);
              } else if (currentEvent === "records") {
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
            defaultActiveKey={["feishu", "ai", "prompt"]}
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
                    <Form.Item name="maxRecords" label="最大拉取数量">
                      <Input type="number" placeholder="0 表示不限制" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "ai",
                label: "AI 平台配置",
                children: (
                  <>
                    <Form.Item
                      name="aiProvider"
                      label="AI 提供商"
                      rules={[{ required: true, message: "必选" }]}
                      tooltip="切换提供商时自动切换对应的请求头和请求体"
                    >
                      <Select
                        options={AI_PROVIDER_OPTIONS}
                        onChange={(val) => {
                          // 切换提供商时自动更新 URL、channel、model 的默认值
                          const defaults: Record<string, any> = {
                            deepseek: {
                              aiUrl:
                                "https://api.deepseek.com/chat/completions",
                              aiChannel: "deepseek",
                              aiModel: "deepseek-chat",
                            },
                            internal: {
                              aiUrl:
                                "http://xybot-appreciation:8080/api/appreciation/v1/inner/completions/conversation",
                              aiChannel: "qwen",
                              aiModel: "qwen-turbo",
                            },
                          };
                          const d = defaults[val];
                          if (d) {
                            form.setFieldsValue(d);
                            setSelectedChannel(d.aiChannel);
                          }
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="aiUrl"
                      label="API URL"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Input placeholder="https://api.deepseek.com/chat/completions" />
                    </Form.Item>
                    <Form.Item
                      name="aiChannel"
                      label="平台 (Channel)"
                      tooltip="选择 AI 平台，channel 会通过请求体中的 channel 字段发送"
                    >
                      <Select
                        options={CHANNEL_OPTIONS}
                        onChange={(val) => {
                          setSelectedChannel(val);
                          // 切换平台时自动设置第一个模型
                          const models = MODEL_OPTIONS[val];
                          if (models?.length) {
                            form.setFieldValue("aiModel", models[0]);
                          }
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="aiModel"
                      label="模型"
                      rules={[{ required: true, message: "必填" }]}
                    >
                      <Select
                        options={(MODEL_OPTIONS[selectedChannel] || []).map(
                          (m) => ({ value: m, label: m })
                        )}
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
                      ? "AI 分析中..."
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

        {/* 结果展示 - 使用 AnalyzeResult 组件 */}
        {result ? (
          <AnalyzeResult result={result} onRecordClick={handleRecordClick} />
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
              系统将从飞书多维表格拉取反馈数据，调用 AI 进行分析
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
