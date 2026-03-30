import * as fs from 'node:fs';
import * as path from 'node:path';
import type { XhsNote } from './types.js';

const STORAGE_DIR = path.join(process.cwd(), 'data');

/**
 * 将获取的小红书笔记数据以去重的方式保存到本地磁盘。
 * 文件名为 `关键词_list.json`。
 */
export function saveNotesWithDedupe(keyword: string, newNotes: XhsNote[]) {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // 过滤掉关键词中可能导致文件系统报错的特殊字符
    const safeKeyword = keyword.replace(/[\\\/:*?"<>|]/g, '_').trim();
    const fileName = `${safeKeyword}_list.json`;
    const SAVE_FILE = path.join(STORAGE_DIR, fileName);
    let existingNotes: XhsNote[] = [];

    // 1. 读取现有数据
    if (fs.existsSync(SAVE_FILE)) {
        try {
            existingNotes = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
        } catch (_e) {
            existingNotes = [];
        }
    }

    // 2. 使用 Map 进行去重
    const notesMap = new Map<string, XhsNote>();
    existingNotes.forEach(note => {
        const key = note.id || note.noteId || note.title || "";
        if (key) notesMap.set(key, note);
    });

    let addedCount = 0;
    newNotes.forEach(note => {
        const key = note.id || note.noteId || note.title || "";
        if (key && !notesMap.has(key)) {
            notesMap.set(key, note);
            addedCount++;
        }
    });

    // 3. 只有在有新增或更新时才写回文件
    if (addedCount > 0) {
        const allNotes = Array.from(notesMap.values());
        fs.writeFileSync(SAVE_FILE, JSON.stringify(allNotes, null, 2), 'utf8');
        console.log(`[磁盘保存] ✅ [${keyword}] 新增了 ${addedCount} 条笔记。本地总计: ${allNotes.length} 条。`);
    }
}

/**
 * 将获取的小红书笔记 “详情” 数据保存。
 * 文件名为 `关键词_details.json`。
 */
export function saveDetailsWithDedupe(keyword: string, newDetails: XhsNote[]) {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const safeKeyword = keyword.replace(/[\\\/:*?"<>|]/g, '_').trim();
    const fileName = `${safeKeyword}_details.json`;
    const SAVE_FILE = path.join(STORAGE_DIR, fileName);
    let existingDetails: XhsNote[] = [];

    if (fs.existsSync(SAVE_FILE)) {
        try {
            existingDetails = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
        } catch (_e) {
            existingDetails = [];
        }
    }

    const detailsMap = new Map<string, XhsNote>();
    existingDetails.forEach(detail => {
        const key = detail.id || detail.noteId || "";
        if (key) detailsMap.set(key, detail);
    });

    let changedCount = 0;
    newDetails.forEach(detail => {
        const key = detail.id || detail.noteId || "";
        if (key) {
            // 如果不存在，或者新数据包含更多信息（例如有了 desc），则更新
            const existing = detailsMap.get(key);
            if (!existing || JSON.stringify(detail).length > JSON.stringify(existing).length) {
                detailsMap.set(key, detail);
                changedCount++;
            }
        }
    });

    if (changedCount > 0) {
        const allDetails = Array.from(detailsMap.values());
        fs.writeFileSync(SAVE_FILE, JSON.stringify(allDetails, null, 2), 'utf8');
        console.log(`[磁盘保存] ✅ [${keyword}] 新增/更新了 ${changedCount} 条详情。本地总计: ${allDetails.length} 条。`);
    }
}
