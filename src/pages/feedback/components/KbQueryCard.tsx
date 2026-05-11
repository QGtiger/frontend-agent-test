import { useState } from "react";
import { Card, Typography, Dropdown } from "antd";
import {
  DownOutlined,
  UpOutlined,
  EllipsisOutlined,
  MessageOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import MarkdownRenderer from "../MarkdownRenderer";

const { Text } = Typography;

interface KbQueryCardProps {
  id: number;
  result: string;
  createdAt: string;
  onFeedback?: (kbCacheId: number) => void;
  onViewFeedback?: (kbCacheId: number) => void;
}

export default function KbQueryCard({
  id,
  result,
  createdAt,
  onFeedback,
  onViewFeedback,
}: KbQueryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const menuItems: MenuProps["items"] = [
    {
      key: "feedback",
      icon: <MessageOutlined />,
      label: "反馈",
      onClick: (e) => {
        e.domEvent.stopPropagation();
        onFeedback?.(id);
      },
    },
    {
      key: "view-feedback",
      icon: <EyeOutlined />,
      label: "查看反馈",
      onClick: (e) => {
        e.domEvent.stopPropagation();
        onViewFeedback?.(id);
      },
    },
  ];

  return (
    <Card key={id} size="small" style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(createdAt).toLocaleString("zh-CN")}
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <span
              style={{
                fontSize: 16,
                color: "#999",
                cursor: "pointer",
                padding: "0 4px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisOutlined />
            </span>
          </Dropdown>
          <span style={{ fontSize: 12, color: "#999" }}>
            {expanded ? <UpOutlined /> : <DownOutlined />}
          </span>
        </div>
      </div>
      <div
        style={{
          marginTop: 4,
          maxHeight: expanded ? "none" : 60,
          overflow: "hidden",
          fontSize: 13,
        }}
      >
        {expanded ? (
          <MarkdownRenderer content={result} />
        ) : (
          <div
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {result.replace(/[#*`[\]]/g, "").slice(0, 200)}
          </div>
        )}
      </div>
    </Card>
  );
}
