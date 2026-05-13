import { useState, useMemo } from "react";
import { marked } from "marked";
import { Button, Space } from "antd";

interface MarkdownRendererProps {
  content: string;
  onRecordClick?: (recordId: string) => void;
}

export type { MarkdownRendererProps };

// 配置 marked 支持 GFM（默认已支持）
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownRenderer({
  content,
  onRecordClick,
}: MarkdownRendererProps) {
  const [showRaw, setShowRaw] = useState(false);

  // 预处理：将 [反馈N](record://recordId) 替换为带特殊标记的链接
  // 使用 data-record-id 属性标记，后续在渲染后通过 DOM 操作绑定点击事件
  const processedContent = useMemo(() => {
    // 先替换 record:// 链接为带 data 属性的 HTML
    let html = content.replace(
      /\[([^\]]+)\]\(record:\/\/([^)]+)\)/g,
      (_, text, recordId) => {
        return `<a href="#" data-record-id="${recordId}" class="record-link">${text}</a>`;
      },
    );

    // 使用 marked 渲染 Markdown 为 HTML
    html = marked.parse(html, { async: false }) as string;

    // 给所有非 record-link 的 <a> 标签加上 target="_blank"
    html = html.replace(
      /<a\s+(?!([^>]*\s)data-record-id)/gi,
      '<a target="_blank" rel="noopener noreferrer" ',
    );

    return html;
  }, [content]);

  // 渲染后绑定点击事件
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const recordLink = target.closest("a[data-record-id]");
    if (recordLink) {
      e.preventDefault();
      const recordId = recordLink.getAttribute("data-record-id");
      if (recordId) {
        onRecordClick?.(recordId);
      }
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Button
            size="small"
            type={showRaw ? "default" : "primary"}
            onClick={() => setShowRaw(false)}
          >
            渲染视图
          </Button>
          <Button
            size="small"
            type={showRaw ? "primary" : "default"}
            onClick={() => setShowRaw(true)}
          >
            原始数据
          </Button>
        </Space>
      </div>

      {showRaw ? (
        <pre
          style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: 16,
            borderRadius: 8,
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.6,
            maxHeight: 600,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {content}
        </pre>
      ) : (
        <div
          className="markdown-content"
          onClick={handleContainerClick}
          style={{
            lineHeight: 1.8,
            fontSize: 14,
          }}
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />
      )}

      {/* 注入样式 */}
      <style>{`
        .markdown-content h1 { font-size: 22px; font-weight: 600; margin: 16px 0 8px; }
        .markdown-content h2 { font-size: 18px; font-weight: 600; margin: 14px 0 6px; }
        .markdown-content h3 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; }
        .markdown-content p { margin: 8px 0; }
        .markdown-content ul, .markdown-content ol { padding-left: 24px; margin: 8px 0; }
        .markdown-content ul { list-style: disc; }
        .markdown-content li { margin: 4px 0; }
        .markdown-content code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: Menlo, Monaco, "Courier New", monospace;
        }
        .markdown-content pre {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 16px;
          border-radius: 8px;
          overflow: auto;
          font-size: 13px;
          line-height: 1.6;
          margin: 12px 0;
        }
        .markdown-content pre code {
          background: none;
          padding: 0;
          border-radius: 0;
        }
        .markdown-content blockquote {
          border-left: 4px solid #1890ff;
          padding: 8px 16px;
          margin: 12px 0;
          background: #f6f8fa;
          border-radius: 0 4px 4px 0;
        }
        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          font-size: 13px;
          margin: 12px 0;
        }
        .markdown-content th {
          border: 1px solid #e8e8e8;
          padding: 8px 12px;
          background: #fafafa;
          font-weight: 600;
          text-align: left;
        }
        .markdown-content td {
          border: 1px solid #e8e8e8;
          padding: 8px 12px;
        }
        .markdown-content hr {
          border: none;
          border-top: 1px solid #e8e8e8;
          margin: 16px 0;
        }
        .markdown-content a {
          color: #1890ff;
        }
        .markdown-content a.record-link {
          color: #1890ff;
          text-decoration: underline;
          cursor: pointer;
        }
        .markdown-content a.record-link:hover {
          color: #40a9ff;
        }
        .markdown-content strong {
          font-weight: 600;
        }
        .markdown-content table {
          display: block;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}
