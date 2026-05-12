import { useRef, useState } from "react";
import { Button, message, Modal } from "antd";
import { UploadOutlined, CopyOutlined } from "@ant-design/icons";
import { uploadFile } from "../../../utils/upload";

/**
 * 上传 JSON 文件到 OSS 按钮组件
 *
 * 点击后选择文件，上传到 OSS，成功后弹出 Modal 显示 OSS 地址。
 */
export default function UploadJsonToOssButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [ossUrl, setOssUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFile({
        blob: file,
        name: file.name,
      });
      setOssUrl(url);
      setModalOpen(true);
      message.success("文件上传成功");
    } catch (err: any) {
      message.error("文件上传失败: " + (err.message || "未知错误"));
    } finally {
      setUploading(false);
      // 重置 input，允许重复选择同一文件
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(ossUrl);
    message.success("OSS 地址已复制到剪贴板");
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <Button
        type="dashed"
        onClick={handleClick}
        loading={uploading}
        block
        size="large"
        style={{ marginTop: 12 }}
        icon={<UploadOutlined />}
      >
        {uploading ? "正在上传至 OSS..." : "☁️ 上传 JSON 到 OSS"}
      </Button>

      <Modal
        title="✅ 文件已上传至 OSS"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={
          <Button
            type="primary"
            onClick={handleCopyUrl}
            icon={<CopyOutlined />}
          >
            复制 OSS 地址
          </Button>
        }
      >
        <div>
          <strong>OSS 地址：</strong>
          <div
            style={{
              marginTop: 4,
              padding: 8,
              background: "#f5f5f5",
              borderRadius: 4,
              wordBreak: "break-all",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            {ossUrl}
          </div>
        </div>
      </Modal>
    </>
  );
}
