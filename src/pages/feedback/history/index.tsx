import { useState } from "react";
import {
  Table,
  Tag,
  Typography,
  Button,
  Modal,
  message,
  Space,
  Popconfirm,
} from "antd";
import { useRequest } from "ahooks";
import { apiRequest } from "@lightfish/server/api";
import AnalyzeResult, {
  type AnalyzeResultData,
} from "../components/AnalyzeResult";

const { Title, Text } = Typography;

interface SessionItem {
  id: number;
  total: number;
  status: "success" | "error";
  errorMessage: string | null;
  createdAt: string;
}

/** 获取分析记录列表 */
async function fetchSessions(): Promise<SessionItem[]> {
  const res = await apiRequest<{ success: boolean; data: SessionItem[] }>(
    "/feedback/sessions"
  );
  if (!res.success) {
    throw new Error("获取列表失败");
  }
  return res.data;
}

/** 获取单条分析详情 */
async function fetchSessionDetail(id: number): Promise<AnalyzeResultData> {
  const res = await apiRequest<{ success: boolean; data: AnalyzeResultData }>(
    `/feedback/sessions/${id}`
  );
  if (!res.success) {
    throw new Error("获取详情失败");
  }
  return res.data;
}

/** 删除分析记录 */
async function deleteSession(id: number): Promise<void> {
  const res = await apiRequest<{ success: boolean; data: { id: number } }>(
    `/feedback/sessions/${id}`,
    { method: "DELETE" }
  );
  if (!res.success) {
    throw new Error("删除失败");
  }
}

export default function FeedbackHistoryPage() {
  const [selectedSession, setSelectedSession] =
    useState<AnalyzeResultData | null>(null);

  // 列表请求
  const { data: sessions, loading, refresh } = useRequest(fetchSessions);

  // 详情请求
  const { run: loadDetail, loading: detailLoading } = useRequest(
    fetchSessionDetail,
    {
      manual: true,
      onSuccess: (data) => {
        setSelectedSession(data);
      },
      onError: (err) => {
        message.error(err.message);
      },
    }
  );

  // 删除请求
  const { run: removeSession } = useRequest(deleteSession, {
    manual: true,
    onSuccess: () => {
      message.success("删除成功");
      refresh();
    },
    onError: (err) => {
      message.error(err.message);
    },
  });

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 50,
    },
    {
      title: "反馈数",
      dataIndex: "total",
      key: "total",
      width: 70,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 60,
      render: (status: string) =>
        status === "completed" ? (
          <Tag color="success" style={{ margin: 0 }}>
            成功
          </Tag>
        ) : (
          <Tag color="error" style={{ margin: 0 }}>
            失败
          </Tag>
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: any, record: SessionItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => loadDetail(record.id)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除这条分析记录吗？"
            onConfirm={() => removeSession(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* 左侧分析列表 */}
      <div
        style={{
          width: 420,
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid #f0f0f0",
          overflow: "auto",
          padding: 24,
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
          <Title level={4} style={{ margin: 0 }}>
            📋 分析记录
          </Title>
          <Button onClick={refresh} loading={loading}>
            刷新
          </Button>
        </div>

        <Table
          dataSource={sessions}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 430 }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: "8px 0" }}>
                <div style={{ marginBottom: 4 }}>
                  <Text strong>分析时间：</Text>
                  <Text>
                    {new Date(record.createdAt).toLocaleString("zh-CN")}
                  </Text>
                </div>
                {record.errorMessage && (
                  <div>
                    <Text strong type="danger">
                      错误信息：
                    </Text>
                    <Text type="danger">{record.errorMessage}</Text>
                  </div>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* 右侧详情面板 */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {selectedSession ? (
          <AnalyzeResult result={selectedSession} />
        ) : (
          <div
            style={{
              textAlign: "center",
              paddingTop: 200,
              color: "#999",
            }}
          >
            <Title level={4} type="secondary">
              请从左侧列表选择一条分析记录
            </Title>
            <Text type="secondary">点击"查看"按钮查看详细分析结果</Text>
          </div>
        )}
      </div>

      {/* 加载中弹窗 */}
      <Modal
        title="加载中"
        open={detailLoading}
        footer={null}
        closable={false}
        width={300}
        centered
      >
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Text>正在加载分析详情...</Text>
        </div>
      </Modal>
    </div>
  );
}
