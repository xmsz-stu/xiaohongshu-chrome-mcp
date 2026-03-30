import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleStatusCheck, handleUpdate, handleSearch } from './src/handlers.js';

const app = new Hono();
const PORT = 3333;

/**
 * --- 全局中间件 ---
 */
app.use('*', cors());

/**
 * --- 路由定义 ---
 */

// 1. 基础状态检查
app.get('/', handleStatusCheck);

// 2. Webhook 接口：接收来自浏览器脚本推送的数据
app.post('/update', handleUpdate);

// 3. 搜索接口：自动打开搜索页面并注入脚本
app.get('/search', handleSearch);

/**
 * --- 启动服务 (Bun 模式) ---
 */
console.log(`[Hono Server] 🚀 服务已启动：http://localhost:${PORT}`);

export default {
    port: PORT,
    fetch: app.fetch,
};
