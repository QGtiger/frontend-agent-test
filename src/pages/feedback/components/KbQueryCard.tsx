import { useState } from "react";
import { Card, Typography, Dropdown, message } from "antd";
import copy from "copy-to-clipboard";
import {
  DownOutlined,
  UpOutlined,
  EllipsisOutlined,
  MessageOutlined,
  EyeOutlined,
  BugOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import MarkdownRenderer from "../MarkdownRenderer";

const { Text } = Typography;

interface KbQueryCardProps {
  id: number;
  result: string;
  createdAt: string;
  curlCommand?: string | null;
  onFeedback?: (kbCacheId: number) => void;
  onViewFeedback?: (kbCacheId: number) => void;
}

export default function KbQueryCard({
  id,
  result,
  createdAt,
  curlCommand,
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
    {
      key: "debug",
      icon: <BugOutlined />,
      label: "调试反馈",
      onClick: (e) => {
        e.domEvent.stopPropagation();
        if (curlCommand) {
          copy(curlCommand);
          message.success("已复制 curl 命令，可发给产研调试");
        } else {
          message.warning("暂无 curl 命令");
        }
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
        <div
          style={{ display: "flex", alignItems: "center", gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <span
              style={{
                fontSize: 16,
                color: "#999",
                cursor: "pointer",
                padding: "0 4px",
              }}
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
