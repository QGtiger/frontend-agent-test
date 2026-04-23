import {
  pgSchema,
  integer,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";

// 使用应用名称作为schema前缀
const appSchema = pgSchema("frontend-agent-test");

/**
 * 用户表
 */
export const usersTable = appSchema.table("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
  displayName: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 50 }),
  remark: varchar({ length: 500 }),
  active: boolean().notNull().default(true),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

/**
 * 飞书反馈原始记录表
 */
export const feedbackRecords = appSchema.table("feedback_records", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  recordId: varchar("record_id", { length: 255 }).notNull().unique(),
  description: text("description"),
  detail: text("detail"),
  images:
    jsonb("images").$type<
      { file_token: string; name: string; url: string; tmp_url: string }[]
    >(),
  investigation: text("investigation"),
  rawData: jsonb("raw_data"),
  analyzed: boolean("analyzed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

/**
 * 系统配置表（飞书配置、DeepSeek配置等）
 */
export const systemConfigs = appSchema.table("system_configs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  configKey: varchar("config_key", { length: 255 }).notNull().unique(),
  configValue: text("config_value").notNull(),
  description: varchar("description", { length: 500 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * AI 分析提示词配置表
 */
export const analysisPrompts = appSchema.table("analysis_prompts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: varchar({ length: 100 }).notNull().default("deepseek-chat"),
  temperature: doublePrecision().notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(4096),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * AI 分析结果表
 */
export const analysisResults = appSchema.table("analysis_results", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  promptId: integer("prompt_id").notNull(),
  analysisMode: varchar("analysis_mode", { length: 50 })
    .notNull()
    .default("full"),
  summary: text("summary"),
  topIssues:
    jsonb("top_issues").$type<
      { rank: number; title: string; count: number; description: string }[]
    >(),
  totalAnalyzed: integer("total_analyzed").notNull().default(0),
  rawResponse: text("raw_response"),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
});
