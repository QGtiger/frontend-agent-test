import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Space } from "antd";

interface MarkdownRendererProps {
  content: string;
  onRecordClick?: (recordId: string) => void;
}

export default function MarkdownRenderer({
  content,
  onRecordClick,
}: MarkdownRendererProps) {
  const [showRaw, setShowRaw] = useState(false);

  // 在渲染前将 [反馈N](record://recordId) 替换为 http://record/recordId 格式
  // remark-gfm 会丢弃 record:// 这种非标准协议，所以用 http://record/ 代替
  const processedContent = content.replace(
    /\[([^\]]+)\]\(record:\/\/([^)]+)\)/g,
    "[$1](http://record/$2)"
  );

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
          style={{
            lineHeight: 1.8,
            fontSize: 14,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm as any]}
            components={{
              h1: ({ children }) => (
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    margin: "16px 0 8px",
                  }}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    margin: "14px 0 6px",
                  }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    margin: "12px 0 4px",
                  }}
                >
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p style={{ margin: "8px 0" }}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul
                  style={{
                    paddingLeft: 24,
                    margin: "8px 0",
                    listStyle: "disc",
                  }}
                >
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol
                  style={{
                    paddingLeft: 24,
                    margin: "8px 0",
                  }}
                >
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li style={{ margin: "4px 0" }}>{children}</li>
              ),
              code: ({ children, className }) => {
                const isInline = !className;
                return isInline ? (
                  <code
                    style={{
                      background: "#f5f5f5",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    }}
                  >
                    {children}
                  </code>
                ) : (
                  <pre
                    style={{
                      background: "#1e1e1e",
                      color: "#d4d4d4",
                      padding: 16,
                      borderRadius: 8,
                      overflow: "auto",
                      fontSize: 13,
                      lineHeight: 1.6,
                      margin: "12px 0",
                    }}
                  >
                    <code>{children}</code>
                  </pre>
                );
              },
              blockquote: ({ children }) => (
                <blockquote
                  style={{
                    borderLeft: "4px solid #1890ff",
                    padding: "8px 16px",
                    margin: "12px 0",
                    background: "#f6f8fa",
                    borderRadius: "0 4px 4px 0",
                  }}
                >
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div style={{ overflow: "auto", margin: "12px 0" }}>
                  <table
                    style={{
                      borderCollapse: "collapse",
                      width: "100%",
                      fontSize: 13,
                    }}
                  >
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th
                  style={{
                    border: "1px solid #e8e8e8",
                    padding: "8px 12px",
                    background: "#fafafa",
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td
                  style={{
                    border: "1px solid #e8e8e8",
                    padding: "8px 12px",
                  }}
                >
                  {children}
                </td>
              ),
              hr: () => (
                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid #e8e8e8",
                    margin: "16px 0",
                  }}
                />
              ),
              a: ({ href, children }) => {
                // 拦截 http://record/recordId 格式，渲染为可点击的反馈链接
                if (href?.startsWith("http://record/")) {
                  const recordId = href.slice(14);
                  return (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onRecordClick?.(recordId);
                      }}
                      style={{
                        color: "#1890ff",
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      {children}
                    </a>
                  );
                }
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#1890ff" }}
                  >
                    {children}
                  </a>
                );
              },
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600 }}>{children}</strong>
              ),
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
