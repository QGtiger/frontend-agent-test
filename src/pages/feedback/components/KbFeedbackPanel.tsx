import { useState, useEffect } from "react";
import {
  List,
  Tag,
  Rate,
  Typography,
  Spin,
  Form,
  Select,
  Input,
  Button,
  message,
  Divider,
} from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useRequest } from "ahooks";
import { apiRequest } from "@lightfish/server/api";

const { Text } = Typography;
const { TextArea } = Input;

const GROUP_OPTIONS = ["测试组", "内容组", "售后组", "产研组"];
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

interface KbFeedbackPanelProps {
  kbCacheId: number;
  kbCreatedAt: string;
  kbSummary: string;
}

export default function KbFeedbackPanel({
  kbCacheId,
  kbCreatedAt,
  kbSummary,
}: KbFeedbackPanelProps) {
  const [form] = Form.useForm();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // 获取反馈列表
  const {
    data,
    loading: listLoading,
    run: runList,
  } = useRequest(
    async (id: number) => {
      const res = await apiRequest<{ list: FeedbackItem[] }>(
        `/feedback/export/kb-feedback/list?kbCacheId=${id}`,
      );
      return res.data;
    },
    { manual: true },
  );

  // 提交反馈
  const { loading: submitLoading, run: submit } = useRequest(
    async (values: {
      group: string;
      score: number;
      reason?: string;
      supplement?: string;
    }) => {
      const res = await apiRequest("/feedback/export/kb-feedback", {
        method: "POST",
        data: { kbCacheId, ...values },
      });
      return res.data;
    },
    {
      manual: true,
      onSuccess: () => {
        message.success("反馈提交成功");
        form.resetFields();
        runList(kbCacheId);
      },
      onError: (err: any) => {
        message.error("反馈提交失败: " + (err.message || "未知错误"));
      },
    },
  );

  useEffect(() => {
    runList(kbCacheId);
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

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      submit(values);
    });
  };

  return (
    <div>
      {/* 顶部：知识库查询信息 */}
      <div
        style={{
          padding: "0 0 16px",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 16,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          知识库查询: {new Date(kbCreatedAt).toLocaleString("zh-CN")}
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

      {/* 已有反馈列表 */}
      <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        已有反馈
      </Text>
      <Spin spinning={listLoading}>
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

      <Divider />

      {/* 提交反馈表单 */}
      <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        提交反馈
      </Text>
      <Form form={form} layout="vertical">
        <Form.Item
          name="group"
          label="所属组别"
          rules={[{ required: true, message: "请选择组别" }]}
        >
          <Select placeholder="请选择组别">
            {GROUP_OPTIONS.map((g) => (
              <Select.Option key={g} value={g}>
                {g}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="score"
          label="评分"
          rules={[{ required: true, message: "请评分" }]}
        >
          <Rate count={10} />
        </Form.Item>

        <Form.Item name="reason" label="打分理由和修改建议">
          <TextArea rows={3} placeholder="请输入打分理由和修改建议" />
        </Form.Item>

        <Form.Item name="supplement" label="其他增量补充">
          <TextArea rows={3} placeholder="请输入其他补充内容" />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={submitLoading}
            block
          >
            提交反馈
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
