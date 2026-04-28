import { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Steps,
  InputNumber,
  Drawer,
  Upload,
  Space,
  Tag,
  Descriptions,
  Image,
  Spin,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { getAppConfig } from "../../../utils";
import * as XLSX from "xlsx";
import AnalyzeResult, {
  type AnalyzeResultData,
  type TopIssue,
  type FeedbackRecord,
} from "../components/AnalyzeResult";
import { hideLoading, showLoading } from "../../../utils/loading";
import MarkdownRenderer from "../MarkdownRenderer";

const { Title, Text } = Typography;
const { Dragger } = Upload;

type ProgressStep = "idle" | "token" | "fetching" | "done" | "error";

const DEFAULT_VALUES = {
  appId: "cli_a7a6ca3bf7dad00b",
  appSecret: "sZq2GflDZ0OVNhbqbNyhybeCfStGYoel",
  appToken: "GhgNbqLihaYvs8sUtmkc9MZdnPc",
  tableId: "tblMqq16QOGraL2C",
  viewId: "vewQpaj4oq",
  maxRecords: 100,
};

export default function FeedbackExportPage() {
  const [form] = Form.useForm();
  const [progress, setProgress] = useState<ProgressStep>("idle");
  const [fetchProgress, setFetchProgress] = useState({ page: 0, total: 0 });
  const [downloading, setDownloading] = useState(false);

  // 上传 JSON 相关
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<AnalyzeResultData | null>(
    null
  );
  const [uploadError, setUploadError] = useState<string>("");

  // 记录详情 Drawer
  const [recordDetailOpen, setRecordDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FeedbackRecord | null>(
    null
  );
  const [convertingImages, setConvertingImages] = useState(false);

  // 知识库查询结果缓存：recordId -> text
  const [kbResults, setKbResults] = useState<Record<string, string>>({});
  const [kbLoading, setKbLoading] = useState(false);

  const handleKBQuery = async () => {
    if (!selectedRecord) return;

    const recordId = selectedRecord.recordId;
    // 如果已有缓存，直接展示
    if (kbResults[recordId]) return;

    const parts: string[] = [];
    if (selectedRecord.description) {
      parts.push(`描述(人、操作、现象)：${selectedRecord.description}`);
    }
    if (selectedRecord.detail) {
      parts.push(`详细说明「现象、操作、问题」：${selectedRecord.detail}`);
    }
    if (selectedRecord.investigation) {
      parts.push(`排查情况：${selectedRecord.investigation}`);
    }
    if (selectedRecord.images?.length > 0) {
      const imageInfo = selectedRecord.images
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
        }
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

  const handleExport = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }

    setProgress("token");
    setFetchProgress({ page: 0, total: 0 });

    const values = form.getFieldsValue();

    try {
      const { SERVER_API, version, appName } = getAppConfig();
      const response = await fetch(SERVER_API + "/api/feedback/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Name": appName,
          "X-Version": version,
        },
        body: JSON.stringify({
          appId: values.appId,
          appSecret: values.appSecret,
          appToken: values.appToken,
          tableId: values.tableId,
          viewId: values.viewId || undefined,
          maxRecords: values.maxRecords ? Number(values.maxRecords) : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `请求失败 (${response.status})`);
      }

      const json = await response.json();
      // @lightfish/server 框架会自动包装为 { success: true, data: ... }
      const resultData = json.data || json;
      const records: FeedbackRecord[] = resultData.records || [];
      const total = resultData.total || 0;

      setProgress("done");
      setFetchProgress({ page: 0, total });

      if (records.length === 0) {
        message.warning("没有获取到数据");
        return;
      }

      // 生成 Excel 并下载
      setDownloading(true);
      try {
        generateExcel(records);
        message.success(`下载成功，共 ${total} 条数据`);
      } catch (err: any) {
        message.error("生成 Excel 失败: " + err.message);
      } finally {
        setDownloading(false);
      }
    } catch (err: any) {
      setProgress("error");
      message.error(err.message || "导出失败");
    }
  };

  /** 解析上传的 JSON 文件 */
  const handleFileUpload = (file: File) => {
    setUploadError("");
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        // 校验格式
        if (!data.analysis || !Array.isArray(data.topIssues)) {
          throw new Error(
            "JSON 格式不正确，需要包含 analysis(string) 和 topIssues(array)"
          );
        }

        // 校验 topIssues 中的每个项
        for (const issue of data.topIssues) {
          if (
            typeof issue.rank !== "number" ||
            !issue.title ||
            typeof issue.count !== "number"
          ) {
            throw new Error(
              "topIssues 中每个项需要包含 rank(number), title(string), count(number)"
            );
          }
          // 确保 recordIds 存在
          if (!Array.isArray(issue.recordIds)) {
            issue.recordIds = [];
          }
        }

        const result: AnalyzeResultData = {
          analysis: data.analysis,
          topIssues: data.topIssues as TopIssue[],
          records: data.records || undefined,
          total: data.total || data.topIssues.length,
        };

        setUploadResult(result);
        message.success("JSON 解析成功");
      } catch (err: any) {
        setUploadError(err.message || "文件解析失败");
        message.error("文件解析失败: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleRecordClick = async (
    recordId: string,
    record?: FeedbackRecord
  ) => {
    if (!record) {
      message.info(`记录 ${recordId} 的详细数据未包含在 JSON 中`);
      return;
    }

    // 先展开 images 中 "; " 分隔的多个 URL，拆成独立图片项
    const expandedImages: FeedbackRecord["images"] = record.images.flatMap(
      (img) => {
        const urls = img.url.split("; ").filter(Boolean);
        const names = img.name.split("; ").filter(Boolean);
        if (urls.length <= 1) {
          return [{ url: img.url, name: img.name || "图片" }];
        }
        return urls.map((url, idx) => ({
          url,
          name: names[idx] || `图片 ${idx + 1}`,
        }));
      }
    );

    // 检查是否有飞书图片需要转存
    const hasFeishuImages = expandedImages.some(
      (img) =>
        img.url.includes("open.feishu.cn") || img.url.includes("feishu.cn")
    );

    if (!hasFeishuImages) {
      // 没有飞书图片，直接打开 Drawer
      setSelectedRecord({ ...record, images: expandedImages });
      setRecordDetailOpen(true);
      return;
    }

    showLoading("正在转存飞书图片...");
    // 有飞书图片，先转存再打开 Drawer
    setConvertingImages(true);
    const values = form.getFieldsValue();
    const { SERVER_API } = getAppConfig();

    const convertedImages = [...expandedImages];
    let hasError = false;

    for (let i = 0; i < convertedImages.length; i++) {
      const img = convertedImages[i];
      if (
        !img.url.includes("open.feishu.cn") &&
        !img.url.includes("feishu.cn")
      ) {
        continue; // 非飞书图片跳过
      }

      try {
        const res = await fetch(
          SERVER_API + "/api/feedback/export/image-proxy",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: img.url,
              name: img.name,
              appId: values.appId,
              appSecret: values.appSecret,
            }),
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn(`图片转存失败: ${img.name}`, errData);
          hasError = true;
          continue;
        }

        const result = await res.json();
        const data = result.data || result;
        convertedImages[i] = { ...img, url: data.url };
      } catch (err) {
        console.warn(`图片转存异常: ${img.name}`, err);
        hasError = true;
      }
    }

    setConvertingImages(false);
    hideLoading();
    // 转存完成后，再打开 Drawer
    setSelectedRecord({ ...record, images: convertedImages });
    setRecordDetailOpen(true);

    if (hasError) {
      message.warning("部分图片转存失败，已展示原始飞书链接");
    }
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setUploadResult(null);
    setUploadError("");
  };

  const progressStepMap: Record<ProgressStep, number> = {
    idle: 0,
    token: 1,
    fetching: 1,
    done: 2,
    error: 2,
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
          📥 飞书数据导出
        </Title>

        <Form form={form} layout="vertical" initialValues={DEFAULT_VALUES}>
          <Card title="飞书配置" style={{ marginBottom: 16 }}>
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
              <InputNumber
                min={0}
                placeholder="0 表示不限制"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Card>

          <Card title="导出字段" style={{ marginBottom: 16 }}>
            <Text type="secondary">默认导出以下字段：</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20, color: "#666" }}>
              <li>描述(人、操作、现象)</li>
              <li>上传相关图片/GIF</li>
              <li>详细说明「现象、操作、问题」</li>
              <li>排查情况</li>
            </ul>
          </Card>

          <Button
            type="primary"
            onClick={handleExport}
            loading={
              progress === "token" || progress === "fetching" || downloading
            }
            block
            size="large"
          >
            {progress === "idle" && "📥 拉取并下载 Excel"}
            {progress === "token" && "获取飞书授权中..."}
            {progress === "fetching" &&
              `拉取数据中 (第${fetchProgress.page}页)...`}
            {progress === "done" && "🔄 重新下载"}
            {progress === "error" && "🔄 重试"}
          </Button>

          <Button
            type="default"
            onClick={() => setDrawerOpen(true)}
            block
            size="large"
            style={{ marginTop: 12 }}
            icon={<InboxOutlined />}
          >
            📤 上传 AI 分析结果
          </Button>
        </Form>
      </div>

      {/* 右侧状态面板 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {progress !== "idle" && (
          <Card style={{ width: "100%", maxWidth: 500, marginBottom: 24 }}>
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
                      : progressStepMap[progress] >= 1
                      ? `共 ${fetchProgress.total} 条`
                      : "等待中",
                },
                {
                  title: "下载",
                  description:
                    progress === "done"
                      ? "Excel 已生成"
                      : progress === "error"
                      ? "导出失败"
                      : "等待中",
                },
              ]}
            />
          </Card>
        )}

        {progress === "idle" && (
          <div style={{ textAlign: "center", color: "#999" }}>
            <Title level={4} type="secondary">
              填写飞书配置后点击"拉取并下载 Excel"
            </Title>
            <Text type="secondary">
              系统将从飞书多维表格拉取数据，生成 xlsx 文件供下载
            </Text>
          </div>
        )}

        {progress === "done" && (
          <Card style={{ width: "100%", maxWidth: 500 }}>
            <div style={{ textAlign: "center" }}>
              <Title level={4} type="success">
                ✅ 导出完成
              </Title>
              <Text>
                共导出 <Text strong>{fetchProgress.total}</Text> 条数据
              </Text>
            </div>
          </Card>
        )}

        {progress === "error" && (
          <Card
            style={{ width: "100%", maxWidth: 500, borderColor: "#ff4d4f" }}
          >
            <div style={{ textAlign: "center" }}>
              <Title level={4} type="danger">
                ❌ 导出失败
              </Title>
              <Text type="danger">请检查配置后重试</Text>
            </div>
          </Card>
        )}
      </div>

      {/* 上传 AI 分析结果 Drawer */}
      <Drawer
        title="📤 上传 AI 分析结果"
        placement="right"
        width="80%"
        open={drawerOpen}
        onClose={handleDrawerClose}
        extra={
          <Space>
            <Button onClick={handleDrawerClose}>关闭</Button>
          </Space>
        }
      >
        {!uploadResult ? (
          <div>
            <Dragger
              accept=".json"
              beforeUpload={(file) => {
                handleFileUpload(file);
                return false; // 阻止自动上传
              }}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽 JSON 文件到此区域</p>
              <p className="ant-upload-hint">
                上传本地 AI 分析生成的 JSON 文件，格式需包含 analysis 和
                topIssues 字段
              </p>
            </Dragger>

            {uploadError && (
              <Card
                style={{
                  marginTop: 16,
                  borderColor: "#ff4d4f",
                }}
                size="small"
              >
                <Text type="danger">{uploadError}</Text>
              </Card>
            )}

            <Card title="JSON 格式说明" size="small" style={{ marginTop: 16 }}>
              <pre
                style={{
                  fontSize: 12,
                  background: "#f5f5f5",
                  padding: 12,
                  borderRadius: 4,
                  overflow: "auto",
                }}
              >
                {`{
  "analysis": "Markdown 分析报告...",
  "topIssues": [
    {
      "rank": 1,
      "title": "问题标题",
      "count": 10,
      "description": "问题描述",
      "recordIds": ["rec123", "rec456"]
    }
  ],
  "total": 100
}`}
              </pre>
            </Card>
          </div>
        ) : (
          <div>
            <AnalyzeResult
              result={uploadResult}
              onRecordClick={handleRecordClick}
            />
          </div>
        )}
      </Drawer>

      {/* 记录详情 Drawer */}
      <Drawer
        title="📋 反馈记录详情"
        placement="right"
        width="50%"
        open={recordDetailOpen}
        onClose={() => {
          setRecordDetailOpen(false);
          setSelectedRecord(null);
        }}
        extra={
          <Space>
            <Button
              onClick={() => {
                setRecordDetailOpen(false);
                setSelectedRecord(null);
              }}
            >
              关闭
            </Button>
          </Space>
        }
      >
        <Spin spinning={convertingImages} tip="正在转存飞书图片...">
          {selectedRecord && (
            <div>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="记录 ID">
                  <Tag color="geekblue">{selectedRecord.recordId}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="序号">
                  #{selectedRecord.index}
                </Descriptions.Item>
                <Descriptions.Item label="描述(人、操作、现象)">
                  {selectedRecord.description || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="详细说明「现象、操作、问题」">
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {selectedRecord.detail || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="排查情况">
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {selectedRecord.investigation || "-"}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="图片">
                  {selectedRecord.images?.length > 0 ? (
                    <Space direction="vertical" size={8}>
                      {selectedRecord.images.map((img, idx) => (
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

                {selectedRecord && kbResults[selectedRecord.recordId] && (
                  <Card
                    title="📖 知识库匹配结果"
                    size="small"
                    style={{ marginTop: 16 }}
                  >
                    <MarkdownRenderer
                      content={kbResults[selectedRecord.recordId]}
                    />
                  </Card>
                )}
              </div>
            </div>
          )}
        </Spin>
      </Drawer>
    </div>
  );
}

/**
 * 将 records 数据生成 xlsx 并触发下载
 */
function generateExcel(records: FeedbackRecord[]) {
  // 准备数据行
  const data = records.map((r) => ({
    序号: r.index,
    "描述(人、操作、现象)": r.description,
    "详细说明「现象、操作、问题」": r.detail,
    排查情况: r.investigation,
    图片链接: r.images.map((img) => img.url).join("; "),
    图片名称: r.images.map((img) => img.name).join("; "),
    "记录 ID": r.recordId,
  }));

  // 创建工作簿
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

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

  // 生成并下载
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `飞书反馈数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
