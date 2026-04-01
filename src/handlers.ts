import type { Context } from 'hono';
import { saveNotesWithDedupe, saveDetailsWithDedupe } from './storage.js';
import { setupSearchTab } from './mcp_client.js';
import type { XhsNote } from './types.js';

/**
 * 状态检查处理器
 */
export const handleStatusCheck = (c: Context) => {
    return c.json({ status: 'running', service: 'Xiaohongshu Bun + Hono Scraper' });
};

/**
 * 实时笔记列表数据推送处理器
 */
export const handleNoteUpdate = async (c: Context) => {
    try {
        const { keyword, notes } = await c.req.json() as { keyword: string, notes: XhsNote[] };
        if (!keyword || !notes) {
            return c.text('Invalid payload', 400);
        }
        console.log(`[接收推送] 🚀 收到关键词 "${keyword}" 的笔记列表数据 (${notes.length} 条)`);
        saveNotesWithDedupe(keyword, notes);
        return c.text('Received');
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[解析错误]', errorMessage);
        return c.text('Invalid JSON', 400);
    }
};

/**
 * 实时笔记 “详情” 数据推送处理器
 */
export const handleDetailUpdate = async (c: Context) => {
    try {
        const { keyword, details } = await c.req.json() as { keyword: string, details: XhsNote[] };
        if (!keyword || !details) {
            return c.text('Invalid payload', 400);
        }
        console.log(`[接收推送] 🚀 收到关键词 "${keyword}" 的笔记详情数据 (${details.length} 条)`);
        saveDetailsWithDedupe(keyword, details);
        return c.text('Received');
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[解析错误]', errorMessage);
        return c.text('Invalid JSON', 400);
    }
};

import { GLOBAL_MAX_DETAILS } from './config.js';

/**
 * 搜索并监听处理器 (支持 ?keyword=...&max=500)
 */
export const handleSearch = async (c: Context) => {
    const keyword = c.req.query('keyword');
    const maxParam = c.req.query('max');
    
    if (!keyword) {
        return c.text('Missing keyword parameter', 400);
    }

    // 优先取 URL 参数，否则取全局默认值
    const maxCount = maxParam ? parseInt(maxParam, 10) : GLOBAL_MAX_DETAILS;

    try {
        const targetUrl = await setupSearchTab(keyword, maxCount);
        return c.json({
            message: `Search initiated for keyword: ${keyword}, max: ${maxCount}`,
            url: targetUrl
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return c.json({ error: errorMessage }, 500);
    }
};
