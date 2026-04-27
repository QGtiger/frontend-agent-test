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
