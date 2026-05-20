import { useState } from "react";
import { Card, Typography, message } from "antd";
import copy from "copy-to-clipboard";
import {
  DownOutlined,
  UpOutlined,
  MessageOutlined,
  BugOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import MarkdownRenderer from "../MarkdownRenderer";

const { Text } = Typography;

interface KbQueryCardProps {
  id: number;
  result: string;
  createdAt: string;
  curlCommand?: string | null;
  traceUrl?: string | null;
  onFeedback?: (kbCacheId: number) => void;
}

export default function KbQueryCard({
  id,
  result,
  createdAt,
  curlCommand,
  traceUrl,
  onFeedback,
}: KbQueryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleDebug = () => {
    if (curlCommand) {
      copy(curlCommand);
      message.success("已复制 curl 命令，可发给产研调试");
    } else {
      message.warning("暂无 curl 命令");
    }
  };

  const handleTrace = () => {
    if (traceUrl) {
      window.open(traceUrl, "_blank");
    } else {
      message.warning("暂无追踪链接");
    }
  };

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
        <div className="flex gap-2 ">
          <div
            className="flex gap-2 items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 追踪 */}
            {traceUrl && (
              <LinkOutlined
                title="追踪"
                style={{ fontSize: 14, color: "#52c41a", cursor: "pointer" }}
                onClick={handleTrace}
              />
            )}
            {/* 反馈 */}
            <MessageOutlined
              title="反馈"
              style={{ fontSize: 14, color: "#1677ff", cursor: "pointer" }}
              onClick={() => onFeedback?.(id)}
            />
            {/* 调试反馈 */}
            <BugOutlined
              title="调试反馈"
              style={{ fontSize: 14, color: "#faad14", cursor: "pointer" }}
              onClick={handleDebug}
            />
          </div>
          {/* 展开/收起 */}
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
