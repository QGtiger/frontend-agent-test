import { useRequest } from "ahooks";
import {
  Form,
  Input,
  Button,
  Card,
  Table,
  Tag,
  Typography,
  message,
  Spin,
  Space,
  Collapse,
  Select,
} from "antd";
import { apiRequest } from "@lightfish/server/api";

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface FeedbackRecord {
  recordId: string;
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
  apiKey: "sk-642c13edbffc4ca389da304aff0eb331",
  model: "deepseek-chat",
  systemPrompt:
    "你是一个专业的用户反馈分析助手，请根据用户反馈数据分析出高频问题。",
};

export default function FeedbackPage() {
  const [form] = Form.useForm();

  const {
    run: handleAnalyze,
    loading,
    data: result,
  } = useRequest(
    async () => {
      const values = await form.validateFields();
      const res = await apiRequest<{
        success: boolean;
        data: AnalyzeResult;
        message?: string;
      }>("/api/feedback/analyze", {
        method: "POST",
        data: {
          feishu: {
            appId: values.appId,
            appSecret: values.appSecret,
            appToken: values.appToken,
            tableId: values.tableId,
            viewId: values.viewId || undefined,
            fieldNames: values.fieldNames || undefined,
          },
          deepseek: {
            apiKey: values.apiKey,
            model: values.model || "deepseek-chat",
          },
          systemPrompt: values.systemPrompt,
        },
      });
      if (!res.success) {
        throw new Error(res.message || "分析失败");
      }
      message.success(`分析完成，共获取 ${res.data.total} 条反馈`);
      return res.data;
    },
    { manual: true }
  );

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
            loading={loading}
            block
            size="large"
            style={{ marginTop: 24 }}
          >
            {loading ? "分析中..." : "🚀 同步并分析"}
          </Button>
        </Form>
      </div>

      {/* 右侧结果面板 */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", paddingTop: 200 }}>
            <Spin size="large" tip="正在从飞书拉取数据并调用 AI 分析..." />
          </div>
        ) : result ? (
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
                    <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                      {result.analysis}
                    </Paragraph>
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
        ) : (
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
        )}
      </div>
    </div>
  );
}
