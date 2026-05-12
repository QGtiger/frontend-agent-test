import { useState } from "react";
import { FloatButton } from "antd";
import { MessageOutlined, CloseOutlined } from "@ant-design/icons";

export default function FloatAgent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 浮动按钮 */}
      <FloatButton
        icon={<MessageOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24, zIndex: 1060 }}
        onClick={() => setOpen(true)}
        tooltip="智能助手"
      />

      {/* 弹出面板 - 模拟手机端窗口 */}
      {open && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 88,
            zIndex: 1050,
            width: 375,
            height: 600,
            maxWidth: "calc(100vw - 48px)",
            maxHeight: "calc(100vh - 120px)",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 30px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "floatAgentSlideUp 0.3s ease-out",
          }}
        >
          {/* 标题栏 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid #f0f0f0",
              background: "#fafafa",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15 }}>智能助手</span>
            <CloseOutlined
              style={{ cursor: "pointer", fontSize: 16, color: "#999" }}
              onClick={() => setOpen(false)}
            />
          </div>

          {/* iframe 内容区 */}
          <div style={{ flex: 1, position: "relative" }}>
            <iframe
              src="https://test-web.yingdao.com/documentAgent/rpaQaAgent"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
              title="智能助手"
            />
          </div>
        </div>
      )}

      {/* 动画样式 */}
      <style>{`
        @keyframes floatAgentSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
