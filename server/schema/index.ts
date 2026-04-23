import { pgSchema, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

// 使用应用名称作为schema前缀
const appSchema = pgSchema('frontend-agent-test');

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
