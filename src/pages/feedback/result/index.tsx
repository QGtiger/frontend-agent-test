import { useState } from "react";
import { Spin, Result, Button, message } from "antd";
import { useRequest } from "ahooks";
import AnalyzeResult, {
  type AnalyzeResultData,
  type FeedbackRecord,
} from "../components/AnalyzeResult";
import FeedbackRecordDetailDrawer from "../components/FeedbackRecordDetailDrawer";
import { getAppConfig } from "../../../utils";
import { getServerUrl } from "@lightfish/server/api";

export default function FeedbackResultPage() {
  // 记录详情 Drawer
  const [recordDetailOpen, setRecordDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FeedbackRecord | null>(
    null,
  );

  const {
    data: uploadResult,
    loading,
    error,
  } = useRequest(
    async (): Promise<AnalyzeResultData> => {
      const resultUrl = getAppConfig().resultUrl;
      if (!resultUrl) {
        throw new Error("resultUrl 未配置");
      }

      // 通过服务端代理请求，避免跨域问题
      const res = await fetch(
        `${getServerUrl("/feedback/proxy")}?url=${encodeURIComponent(resultUrl)}`,
      );
      if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
      }
      const data: AnalyzeResultData = await res.json();

      console.log("从服务器获取的分析结果:", data);

      // 校验格式
      if (!data.analysis || !Array.isArray(data.topIssues)) {
        throw new Error(
          "JSON 格式不正确，需要包含 analysis(string) 和 topIssues(array)",
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
            "topIssues 中每个项需要包含 rank(number), title(string), count(number)",
          );
        }
        if (!Array.isArray(issue.recordIds)) {
          issue.recordIds = [];
        }
      }

      return {
        analysis: data.analysis,
        topIssues: data.topIssues,
        records: data.records || undefined,
        total: data.total || data.topIssues.length,
      };
    },
    {
      onError: (err: Error) => {
        message.error("加载数据失败: " + err.message);
      },
    },
  );

  const handleRecordClick = (recordId: string, record?: FeedbackRecord) => {
    if (!record) {
      message.info(`记录 ${recordId} 的详细数据未包含在 JSON 中`);
      return;
    }
    setSelectedRecord(record);
    setRecordDetailOpen(true);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" tip="正在加载分析结果..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Result
          status="error"
          title="加载失败"
          subTitle={error.message}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {uploadResult && (
        <AnalyzeResult
          result={uploadResult}
          onRecordClick={handleRecordClick}
        />
      )}

      {/* 记录详情 Drawer */}
      {recordDetailOpen && (
        <FeedbackRecordDetailDrawer
          record={selectedRecord}
          onClose={() => {
            setRecordDetailOpen(false);
            setSelectedRecord(null);
          }}
        />
      )}
    </div>
  );
}
