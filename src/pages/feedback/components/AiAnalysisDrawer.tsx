import { useState, useEffect, useRef } from "react";
import type { FormInstance } from "antd";
import {
  Drawer,
  Button,
  Steps,
  message,
  Typography,
  Card,
  Spin,
  Space,
  Tag,
} from "antd";
import { apiRequest } from "@lightfish/server/api";
import { uploadFile } from "../../../utils/upload";

const { Title, Text } = Typography;

interface AiAnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  form: FormInstance;
}

type StepStatus = "pending" | "running" | "done" | "error";

interface StepState {
  uploadExcel: StepStatus;
  uploadPrompt: StepStatus;
  triggerPipeline: StepStatus;
  polling: StepStatus;
}

const PIPELINE_ID = 4838000;
const POLLING_INTERVAL = 3000; // 3 秒轮询

/**
 * AI 分析流程 Drawer
 *
 * 1. 上传 Excel 到 OSS → 拿到 ossUrl
 * 2. 拼装 prompt 并上传到 OSS → 拿到 promptUrl
 * 3. 触发流水线 → 拿到 runId
 * 4. 轮询流水线结果 → 展示最终结果
 */
export default function AiAnalysisDrawer({
  open,
  onClose,
  form,
}: AiAnalysisDrawerProps) {
  const [steps, setSteps] = useState<StepState>({
    uploadExcel: "pending",
    uploadPrompt: "pending",
    triggerPipeline: "pending",
    polling: "pending",
  });
  const [ossUrl, setOssUrl] = useState("");
  const [ossFileName, setOssFileName] = useState("");
  const [promptUrl, setPromptUrl] = useState("");
  const [runId, setRunId] = useState<number | null>(null);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 关闭时清理
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setSteps({
      uploadExcel: "pending",
      uploadPrompt: "pending",
      triggerPipeline: "pending",
      polling: "pending",
    });
    setOssUrl("");
    setOssFileName("");
    setPromptUrl("");
    setRunId(null);
    setPipelineResult(null);
    setRunning(false);
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  const updateStep = (step: keyof StepState, status: StepStatus) => {
    setSteps((prev) => ({ ...prev, [step]: status }));
  };

  const handleStart = async () => {
    const values = form.getFieldsValue();
    const { appId, appSecret, appToken, tableId, viewId, maxRecords } = values;

    if (!appId || !appSecret || !appToken || !tableId) {
      message.error("飞书配置不完整");
      return;
    }

    setRunning(true);
    resetState();

    try {
      // === 步骤 1：上传 Excel 到 OSS ===
      updateStep("uploadExcel", "running");
      const excelResult = await apiRequest<{ url: string; name: string }>(
        "/feedback/export/upload-oss",
        {
          method: "POST",
          data: {
            appId,
            appSecret,
            appToken,
            tableId,
            viewId: viewId || undefined,
            maxRecords: maxRecords ? Number(maxRecords) : undefined,
          },
        },
      );
      const excelData = (excelResult as any).data || excelResult;
      setOssUrl(excelData.url);
      setOssFileName(excelData.name);
      updateStep("uploadExcel", "done");
      message.success("Excel 已上传至 OSS");

      // === 步骤 2：拼装 prompt 并上传到 OSS ===
      updateStep("uploadPrompt", "running");
      const promptText = buildPrompt(excelData.url, excelData.name);
      const promptBlob = new Blob([promptText], { type: "text/plain" });
      const promptUrlResult = await uploadFile({
        blob: promptBlob,
        name: `prompt_${Date.now()}.txt`,
      });
      setPromptUrl(promptUrlResult);
      updateStep("uploadPrompt", "done");
      message.success("Prompt 已上传至 OSS");

      // === 步骤 3：触发流水线 ===
      updateStep("triggerPipeline", "running");
      const pipelineRes = await fetch(
        `https://test-front-gw.yingdao.com/gw-api/pipelines/${PIPELINE_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: "tgw_l7_route=2696d4cc5b54afb5fb084678b60bda59",
          },
          body: JSON.stringify({
            BRANCH: "feat/prompt",
            PROMPT_URL: promptUrlResult,
            TARGET_FILE_URL: "none",
          }),
        },
      );
      const pipelineData = await pipelineRes.json();
      if (!pipelineData.success) {
        throw new Error(
          `触发流水线失败: ${pipelineData.message || JSON.stringify(pipelineData)}`,
        );
      }
      const newRunId = pipelineData.data;
      setRunId(newRunId);
      updateStep("triggerPipeline", "done");
      message.success(`流水线已触发，Run ID: ${newRunId}`);

      // === 步骤 4：开始轮询 ===
      updateStep("polling", "running");
      startPolling(newRunId);
    } catch (err: any) {
      message.error("AI 分析流程失败: " + (err.message || "未知错误"));
      setRunning(false);
    }
  };

  const startPolling = (id: number) => {
    // 先立即查一次
    pollRun(id);

    // 再定时轮询
    pollingTimerRef.current = setInterval(() => {
      pollRun(id);
    }, POLLING_INTERVAL);
  };

  const pollRun = async (id: number) => {
    try {
      const res = await fetch(
        `https://test-front-gw.yingdao.com/gw-api/pipelines/${PIPELINE_ID}/run/${id}`,
        {
          headers: {
            Cookie: "tgw_l7_route=2696d4cc5b54afb5fb084678b60bda59",
          },
        },
      );
      const result = await res.json();

      if (result.success && result.data) {
        setPipelineResult(result.data);

        const status = result.data.status;
        if (status === "SUCCESS") {
          updateStep("polling", "done");
          setRunning(false);
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }
          message.success("AI 分析完成！");
        } else if (status === "FAIL") {
          updateStep("polling", "error");
          setRunning(false);
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }
          message.error("AI 分析流水线执行失败");
        }
        // 其他状态（RUNNING、WAITING 等）继续轮询
      }
    } catch (err) {
      console.warn("轮询流水线状态失败:", err);
    }
  };

  const stepItems = [
    {
      title: "上传 Excel",
      status: mapStepToStatus(steps.uploadExcel),
      description: getStepDesc("uploadExcel"),
    },
    {
      title: "上传 Prompt",
      status: mapStepToStatus(steps.uploadPrompt),
      description: getStepDesc("uploadPrompt"),
    },
    {
      title: "触发流水线",
      status: mapStepToStatus(steps.triggerPipeline),
      description: getStepDesc("triggerPipeline"),
    },
    {
      title: "等待分析结果",
      status: mapStepToStatus(steps.polling),
      description: getStepDesc("polling"),
    },
  ];

  function mapStepToStatus(
    status: StepStatus,
  ): "wait" | "process" | "finish" | "error" {
    switch (status) {
      case "pending":
        return "wait";
      case "running":
        return "process";
      case "done":
        return "finish";
      case "error":
        return "error";
    }
  }

  function getStepDesc(step: keyof StepState): string {
    switch (step) {
      case "uploadExcel":
        if (steps.uploadExcel === "running") return "正在上传...";
        if (steps.uploadExcel === "done") return ossFileName || "完成";
        if (steps.uploadExcel === "error") return "上传失败";
        return "等待开始";
      case "uploadPrompt":
        if (steps.uploadPrompt === "running") return "正在上传...";
        if (steps.uploadPrompt === "done") return "已上传";
        if (steps.uploadPrompt === "error") return "上传失败";
        return "等待开始";
      case "triggerPipeline":
        if (steps.triggerPipeline === "running") return "正在触发...";
        if (steps.triggerPipeline === "done") return `Run ID: ${runId}`;
        if (steps.triggerPipeline === "error") return "触发失败";
        return "等待开始";
      case "polling":
        if (steps.polling === "running") return "正在分析中...";
        if (steps.polling === "done") return "分析完成";
        if (steps.polling === "error") return "分析失败";
        return "等待开始";
    }
  }

  return (
    <Drawer
      title="🤖 AI 分析"
      placement="right"
      width="60%"
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>分析流程</Title>
        <Steps
          direction="vertical"
          current={getCurrentStep()}
          status={hasError() ? ("error" as const) : ("process" as const)}
          items={stepItems}
        />
      </div>

      {!running && steps.polling === "pending" && (
        <Button type="primary" onClick={handleStart} block size="large">
          🚀 开始 AI 分析
        </Button>
      )}

      {running && (
        <Card style={{ textAlign: "center", marginTop: 16 }}>
          <Spin tip="正在执行 AI 分析流程..." />
        </Card>
      )}

      {/* 展示流水线结果 */}
      {pipelineResult && (
        <Card title="📊 分析结果" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>状态：</Text>
            <Tag
              color={
                pipelineResult.status === "SUCCESS"
                  ? "success"
                  : pipelineResult.status === "FAIL"
                    ? "error"
                    : "processing"
              }
            >
              {pipelineResult.status}
            </Tag>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Run ID：</Text>
            <Text>{pipelineResult.pipelineRunId}</Text>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text strong>创建时间：</Text>
            <Text>
              {pipelineResult.createTime
                ? new Date(pipelineResult.createTime).toLocaleString()
                : "-"}
            </Text>
          </div>
          {pipelineResult.stages?.map((stage: any, idx: number) => (
            <Card
              key={idx}
              size="small"
              title={stage.name}
              style={{ marginTop: 8 }}
              extra={
                <Tag
                  color={
                    stage.stageInfo?.status === "SUCCESS"
                      ? "success"
                      : stage.stageInfo?.status === "FAIL"
                        ? "error"
                        : "processing"
                  }
                >
                  {stage.stageInfo?.status || "-"}
                </Tag>
              }
            >
              {stage.stageInfo?.jobs?.map((job: any, jIdx: number) => (
                <div key={jIdx} style={{ marginBottom: 4 }}>
                  <Text>
                    {job.name}:{" "}
                    <Tag
                      color={
                        job.status === "SUCCESS"
                          ? "success"
                          : job.status === "FAIL"
                            ? "error"
                            : "processing"
                      }
                    >
                      {job.status}
                    </Tag>
                  </Text>
                </div>
              ))}
            </Card>
          ))}
        </Card>
      )}

      {/* 关键信息展示 */}
      {ossUrl && (
        <Card title="🔗 资源链接" size="small" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>Excel OSS 地址：</Text>
            <div
              style={{
                fontSize: 12,
                wordBreak: "break-all",
                background: "#f5f5f5",
                padding: 8,
                borderRadius: 4,
                marginTop: 4,
              }}
            >
              {ossUrl}
            </div>
          </div>
          {promptUrl && (
            <div>
              <Text strong>Prompt OSS 地址：</Text>
              <div
                style={{
                  fontSize: 12,
                  wordBreak: "break-all",
                  background: "#f5f5f5",
                  padding: 8,
                  borderRadius: 4,
                  marginTop: 4,
                }}
              >
                {promptUrl}
              </div>
            </div>
          )}
        </Card>
      )}
    </Drawer>
  );
}

function getCurrentStep(): number {
  // 这个函数由父组件通过 steps 状态动态计算，这里简单返回 0
  // 实际 Steps 组件通过 items 的 status 来控制显示
  return 0;
}

function hasError(): boolean {
  return false;
}

/**
 * 拼装 prompt 文本，将 ossUrl 和 ossFileName 嵌入到 prompt 中
 */
function buildPrompt(excelUrl: string, excelName: string): string {
  return `帮我分析这个 Excel 文件里的数据：${excelUrl}（文件名：${excelName}）

给我一份完整的分析报告，分析出30个高频问题。

交付产物为，一个 markdown 格式的分析报告

一个json 文档，格式为

\`\`\`json
// 高频问题
interface TopIssue {
  rank: number;
  title: string;
  count: number;
  description: string;
  // 对应 的几个 记录，不用全部，来 不多于五个的 具有代表性的
  recordIds: string[]
}

// 每一条记录
interface FeedbackRecord {
  recordId: string;
  index: number;
  description: string;
  detail: string;
  investigation: string;
  images: Array<{ url: string; name: string }>;
}

interface AnalyzeResultData {
  // 分析报告 markdown。 如果引用具体反馈时，必须使用 [反馈N](record://recordId) 格式，其中 N 是反馈序号，recordId 是反馈的唯一标识
  analysis: string;
  // 高频问题
  topIssues: TopIssue[];
  // 分析数据总数
  total: number;
  // 每一条解析记录
  records?: FeedbackRecord[];
}
\`\`\`

**注意** json文档的生成,  例如 analysis ，引用具体反馈时，必须使用 [反馈N](record://recordId) 格式 \`[反馈N](record://recordId)\` ，其中 N 是反馈序号，recordId 是反馈的唯一标识`;
}
