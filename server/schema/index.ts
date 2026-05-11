import {
  pgSchema,
  integer,
  varchar,
  timestamp,
  text,
  jsonb,
} from "drizzle-orm/pg-core";

// 使用应用名称作为schema前缀
const appSchema = pgSchema("frontend-agent-test");

/**
 * 分析会话表
 * 存储每次分析的完整快照，包括左侧表单配置和右侧分析结果
 */
export const analysisSessions = appSchema.table("analysis_sessions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // === 左侧表单配置（JSON 快照） ===
  feishuConfig: jsonb("feishu_config")
    .$type<{
      appId: string;
      appSecret: string;
      appToken: string;
      tableId: string;
      viewId?: string;
      fieldNames?: string;
      maxRecords?: number;
    }>()
    .notNull(),

  aiConfig: jsonb("ai_config")
    .$type<{
      aiProvider: string;
      aiUrl: string;
      aiChannel: string;
      aiModel: string;
    }>()
    .notNull(),

  systemPrompt: text("system_prompt").notNull(),

  // === 右侧分析结果（JSON 快照） ===
  analysis: text("analysis"),
  topIssues:
    jsonb("top_issues").$type<
      { rank: number; title: string; count: number; description: string }[]
    >(),
  total: integer("total").notNull().default(0),
  records: jsonb("records").$type<
    {
      recordId: string;
      index: number;
      description: string;
      detail: string;
      investigation: string;
      images: Array<{ url: string; name: string }>;
    }[]
  >(),

  // === 元信息 ===
  status: varchar("status", { length: 20 }).notNull().default("completed"), // completed | error
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * 飞书图片映射表
 * 缓存飞书图片 URL 到 OSS URL 的映射，避免重复下载上传
 */
export const feishuImageMapping = appSchema.table("feishu_image_mapping", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // 飞书图片 URL（唯一）
  feishuUrl: text("feishu_url").notNull().unique(),

  // OSS 图片 URL
  ossUrl: text("oss_url").notNull(),

  // 文件名
  fileName: varchar("file_name", { length: 500 }),

  // 创建时间
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * 知识库查询记录表
 * 每次知识库查询都会新增一条记录，一个反馈记录对应多次查询（一对多）
 */
export const kbCache = appSchema.table("kb_cache", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // 反馈记录 ID
  recordId: text("record_id").notNull(),

  // 查询时拼接的内容
  queryContent: text("query_content").notNull(),

  // 知识库返回结果（Markdown）
  result: text("result").notNull(),

  // 等效 curl 命令（用于研发调试）
  curlCommand: text("curl_command"),

  // 创建时间
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * 知识库查询反馈表
 * 每条知识库查询结果可以有多个反馈评价（一对多）
 */
export const kbFeedback = appSchema.table("kb_feedback", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // 关联的知识库查询记录 ID
  kbCacheId: integer("kb_cache_id").notNull(),

  // 反馈人员所属组
  group: varchar("group", { length: 20 }).notNull(),

  // 打分 1-10
  score: integer("score").notNull(),

  // 打分理由和修改建议
  reason: text("reason"),

  // 其他增量补充
  supplement: text("supplement"),

  // 创建时间
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
