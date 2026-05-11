import { useState } from "react";
import { Card, Typography, Button } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import MarkdownRenderer from "../MarkdownRenderer";

const { Text } = Typography;

interface KbQueryCardProps {
  id: number;
  result: string;
  createdAt: string;
}

export default function KbQueryCard({
  id,
  result,
  createdAt,
}: KbQueryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card key={id} size="small" style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(createdAt).toLocaleString("zh-CN")}
        </Text>
        <Button
          type="text"
          size="small"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
        />
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
