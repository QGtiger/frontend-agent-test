import { useState, useEffect } from "react";
import { List, Tag, Rate, Typography, Spin } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useRequest } from "ahooks";
import { apiRequest } from "@lightfish/server/api";

const { Text } = Typography;

const GROUP_COLORS: Record<string, string> = {
  测试组: "blue",
  内容组: "green",
  售后组: "orange",
  产研组: "purple",
};

interface FeedbackItem {
  id: number;
  group: string;
  score: number;
  reason: string | null;
  supplement: string | null;
  createdAt: string;
}

interface KbFeedbackListProps {
  kbCacheId: number;
  kbCreatedAt: string;
  kbSummary: string;
}

export default function KbFeedbackList({
  kbCacheId,
  kbCreatedAt,
  kbSummary,
}: KbFeedbackListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data, loading, run } = useRequest(
    async (id: number) => {
      const res = await apiRequest<{ list: FeedbackItem[] }>(
        `/feedback/export/kb-feedback/list?kbCacheId=${id}`,
      );
      return res.data;
    },
    { manual: true },
  );

  useEffect(() => {
    run(kbCacheId);
  }, [kbCacheId]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      {/* 顶部显示对应的知识库查询信息 */}
      <div
        style={{
          padding: "0 0 16px",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 16,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          查看反馈: {new Date(kbCreatedAt).toLocaleString("zh-CN")}
        </Text>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#999",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {kbSummary}
        </div>
      </div>

      <Spin spinning={loading}>
        <List
          dataSource={data?.list || []}
          locale={{ emptyText: "暂无反馈" }}
          renderItem={(item) => {
            const isExpanded = expandedIds.has(item.id);
            return (
              <div
                key={item.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #f5f5f5",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 4,
                  }}
                  onClick={() => toggleExpand(item.id)}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Tag color={GROUP_COLORS[item.group] || "default"}>
                      {item.group}
                    </Tag>
                    <Rate
                      disabled
                      value={item.score}
                      count={10}
                      style={{ fontSize: 14 }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "#999" }}>
                    {isExpanded ? <UpOutlined /> : <DownOutlined />}
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    {item.reason && (
                      <div style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 12 }}>
                          理由/建议：
                        </Text>
                        <Text style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                          {item.reason}
                        </Text>
                      </div>
                    )}
                    {item.supplement && (
                      <div>
                        <Text strong style={{ fontSize: 12 }}>
                          补充：
                        </Text>
                        <Text style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                          {item.supplement}
                        </Text>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
      </Spin>
    </div>
  );
}
