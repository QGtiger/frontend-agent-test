import { Card, Table, Tag, Typography, Space, Collapse } from "antd";
import MarkdownRenderer from "../MarkdownRenderer";

const { Text, Paragraph } = Typography;

export interface FeedbackRecord {
  recordId: string;
  index: number;
  description: string;
  detail: string;
  investigation: string;
  images: Array<{ url: string; name: string }>;
}

export interface TopIssue {
  rank: number;
  title: string;
  count: number;
  description: string;
  /** 对应不多于五个的具有代表性的记录 ID */
  recordIds: string[];
}

export interface AnalyzeResultData {
  records?: FeedbackRecord[];
  analysis: string;
  topIssues: TopIssue[];
  total: number;
}

interface AnalyzeResultProps {
  result: AnalyzeResultData;
  onRecordClick?: (recordId: string, record?: FeedbackRecord) => void;
}

const recordColumns = [
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

export default function AnalyzeResult({
  result,
  onRecordClick,
}: AnalyzeResultProps) {
  const handleRecordClick = (recordId: string) => {
    console.log("handleRecordClick", recordId, result);
    const record = result.records?.find((r) => r.recordId === recordId);
    onRecordClick?.(recordId, record);
  };
  return (
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
        defaultActiveKey={["analysis"]}
      />

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
                    color={count >= 10 ? "red" : count >= 5 ? "orange" : "blue"}
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
              {
                title: "代表性反馈",
                dataIndex: "recordIds",
                key: "recordIds",
                width: 200,
                render: (recordIds: string[]) =>
                  recordIds?.length > 0 ? (
                    <Space wrap size={4}>
                      {recordIds.map((id) => (
                        <Tag
                          key={id}
                          color="geekblue"
                          style={{
                            cursor: onRecordClick ? "pointer" : "default",
                          }}
                          onClick={() => handleRecordClick(id)}
                        >
                          {id.slice(0, 8)}...
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    "-"
                  ),
              },
            ]}
            rowKey="rank"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 反馈列表（仅在 records 存在时展示） */}
      {result.records && (
        <Card title="📋 反馈列表">
          <Table
            dataSource={result.records}
            columns={recordColumns}
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
                            <a href={img.url} target="_blank" rel="noreferrer">
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
      )}
    </div>
  );
}
