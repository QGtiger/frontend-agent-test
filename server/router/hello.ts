import type { ContextWithDb } from '@lightfish/server'

export default async function hello(c: ContextWithDb) {
  // 获取数据库实例
  const db = c.get('db');

  if (!db) {
    return { message: 'Database not configured' };
  }

  // 示例查询（需要导入对应的 schema）
  // import { usersTable } from '../schema/users.js';
  // const allUsers = await db.select().from(usersTable);

  return {
    message: 'Hello from lightfish-server!',
    timestamp: new Date().toISOString(),
    database: db ? 'Connected' : 'Not connected',
  };
}
