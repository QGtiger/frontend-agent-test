import { useState } from "react";
import type { FormInstance } from "antd";
import { Button, message, Modal } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { apiRequest } from "@lightfish/server/api";

interface UploadToOssButtonProps {
  /** Ant Design Form 实例，点击按钮时实时获取表单值 */
  form: FormInstance;
}

/**
 * 服务端上传至 OSS 按钮组件
 *
 * 点击后调用服务端接口生成 xlsx 并上传到 OSS，
 * 返回 OSS 地址后通过 Modal 展示给用户复制。
 */
export default function UploadToOssButton({ form }: UploadToOssButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [ossUrl, setOssUrl] = useState("");
  const [ossFileName, setOssFileName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const handleUpload = async () => {
    const values = form.getFieldsValue();
    const { appId, appSecret, appToken, tableId, viewId, maxRecords } = values;

    if (!appId || !appSecret || !appToken || !tableId) {
      message.error(
        "飞书配置不完整，请填写 App ID、App Secret、App Token 和 Table ID",
      );
      return;
    }

    setUploading(true);
    try {
      const result = await apiRequest<{ url: string; name: string }>(
        "/feedback/export/upload-oss",
        {
          method: "POST",
          data: {
            appId,
            appSecret,
            appToken,
            tableId,
            viewId: viewId || undefined,
            maxRecords: maxRecords ? Number(maxRecords) : undefined,
          },
        },
      );

      const data = (result as any).data || result;
      setOssUrl(data.url);
      setOssFileName(data.name);
      setModalOpen(true);
      message.success("文件已上传至 OSS");
    } catch (err: any) {
      message.error("上传至 OSS 失败: " + (err.message || "未知错误"));
    } finally {
      setUploading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(ossUrl);
    message.success("OSS 地址已复制到剪贴板");
  };

  return (
    <>
      <Button
        type="dashed"
        onClick={handleUpload}
        loading={uploading}
        block
        size="large"
        style={{ marginTop: 12 }}
      >
        {uploading ? "正在生成并上传至 OSS..." : "⬆️ 服务端上传至 OSS"}
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
        <div style={{ marginBottom: 12 }}>
          <strong>文件名：</strong>
          <span>{ossFileName}</span>
        </div>
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
