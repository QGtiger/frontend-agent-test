import { Form, Select, Rate, Input, Button, message, Typography } from "antd";
import { useRequest } from "ahooks";
import { apiRequest } from "@lightfish/server/api";

const { Text } = Typography;
const { TextArea } = Input;

const GROUP_OPTIONS = ["测试组", "内容组", "售后组", "产研组"];

interface KbFeedbackFormProps {
  kbCacheId: number;
  /** 知识库查询的创建时间，用于显示在表单顶部 */
  kbCreatedAt: string;
  /** 知识库查询结果摘要，用于显示在表单顶部 */
  kbSummary: string;
  onSuccess: () => void;
}

export default function KbFeedbackForm({
  kbCacheId,
  kbCreatedAt,
  kbSummary,
  onSuccess,
}: KbFeedbackFormProps) {
  const [form] = Form.useForm();

  const { loading, run: submit } = useRequest(
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
        onSuccess();
      },
      onError: (err: any) => {
        message.error("反馈提交失败: " + (err.message || "未知错误"));
      },
    },
  );

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      submit(values);
    });
  };

  return (
    <div>
      {/* 顶部显示对应的知识库查询信息 */}
      <div
        style={{
          padding: "0 0 16px",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 16,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          反馈给: {new Date(kbCreatedAt).toLocaleString("zh-CN")}
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
          <Button type="primary" onClick={handleSubmit} loading={loading} block>
            提交反馈
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
