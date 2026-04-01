// ==UserScript==
// @name         小红书搜索助手 (XHS Search Helper)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  利用 Pinia Store API 实现高效、稳定的搜索结果抓取，支持批量导出。
// @author       Antigravity
// @match        https://www.xiaohongshu.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @icon         https://www.xiaohongshu.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. 核心逻辑：全局持续拦截器与数据存储
    // ==========================================
    const GLOBAL_NOTES = new Map();

    // 处理列表数据 (搜索/瀑布流)
    function processListResponse(json) {
        if (!json?.data?.items) return;
        let count = 0;
        json.data.items.forEach(i => {
            if (i.id && !GLOBAL_NOTES.has(i.id)) {
                GLOBAL_NOTES.set(i.id, {
                    id: i.id,
                    xsec_token: i.xsec_token,
                    title: i.note_card?.display_title || i.display_title || "无标题",
                    type: i.note_card?.type || i.type,
                    url: 'https://www.xiaohongshu.com/explore/' + i.id,
                    author: i.note_card?.user?.nickname || i.user?.nickname,
                    likes: i.note_card?.interact_info?.liked_count || i.interact_info?.liked_count,
                    cover: i.note_card?.cover?.url_default || i.cover?.url_default,
                    hasDetail: false // 标记是否已抓取详情
                });
                count++;
            }
        });
        if (count > 0) updateUICount();
    }

    // 处理详情数据 (点开笔记时触发的 /feed 或 /note)
    function processDetailResponse(json) {
        const item = json?.data?.items?.[0];
        const note = item?.note_card || item?.note;
        if (!note) return;

        const id = note.id || item.id;
        if (!id) return;

        const existing = GLOBAL_NOTES.get(id) || {};
        GLOBAL_NOTES.set(id, {
            ...existing,
            id: id,
            title: note.title || existing.title,
            desc: note.desc || "",
            type: note.type || existing.type,
            url: 'https://www.xiaohongshu.com/explore/' + id,
            author: note.user?.nickname || existing.author,
            author_id: note.user?.user_id || existing.author_id,
            likes: note.interact_info?.liked_count || existing.likes,
            comments: note.interact_info?.comment_count,
            collects: note.interact_info?.collected_count,
            shares: note.interact_info?.share_count,
            tags: note.tag_list?.map(t => t.name) || [],
            images: note.image_list?.map(img => img.info_list?.[0]?.url || img.url) || [],
            created_time: note.time,
            hasDetail: true // 标记详情已补充
        });

        console.log(`[XHS-Search] 详情已补充: ${id}`);
        updateUICount();
    }

    // 处理评论数据
    function processCommentsResponse(url, json) {
        const urlObj = new URL(url, location.origin);
        const noteId = urlObj.searchParams.get('note_id');
        if (!noteId || !json?.data?.comments) return;

        const existing = GLOBAL_NOTES.get(noteId);
        if (!existing) return;

        // 获取新评论并转换格式
        const newComments = json.data.comments.map(c => ({
            id: c.id,
            author: c.user_info?.nickname,
            author_id: c.user_info?.user_id,
            content: c.content,
            likes: c.like_count,
            sub_comment_count: c.sub_comment_count,
            created_time: c.create_time
        }));

        // 合并评论 (简单去重)
        const commentsList = existing.commentsList || [];
        const existingIds = new Set(commentsList.map(c => c.id));
        newComments.forEach(c => {
            if (!existingIds.has(c.id)) commentsList.push(c);
        });

        GLOBAL_NOTES.set(noteId, {
            ...existing,
            commentsList: commentsList,
            commentsCount: commentsList.length
        });

        console.log(`[XHS-Search] 收到评论: ${noteId}, 累计 ${commentsList.length} 条`);
        updateUICount();
    }

    // 全局 XHR 拦截 (长期运行)
    (function() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(m, u) {
            this.__url = u;
            return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function(b) {
            const x = this;
            const orig = x.onreadystatechange;
            x.onreadystatechange = function() {
                if (x.readyState === 4 && x.status === 200) {
                    try {
                        const json = JSON.parse(x.responseText);
                        if (x.__url?.includes('search/notes')) {
                            processListResponse(json);
                        } else if (x.__url?.includes('/feed') || x.__url?.includes('/note/detail')) {
                            processDetailResponse(json);
                        } else if (x.__url?.includes('comment/page')) {
                            processCommentsResponse(x.__url, json);
                        }
                    } catch (e) {}
                }
                if (orig) orig.apply(this, arguments);
            };
            return origSend.apply(this, arguments);
        };
    })();

    async function triggerSearch(keyword) {
        if (!keyword) return {error: '请输入关键词'};
        const app = document.querySelector('#app')?.__vue_app__;
        const pinia = app?.config?.globalProperties?.$pinia;
        if (!pinia?._s) return {error: '页面未就绪', hint: '请确保已登录'};

        const searchStore = pinia._s.get('search');
        if (!searchStore) return {error: '未找到搜索存储，请先在搜索结果页进行一次手动搜索'};

        try {
            searchStore.mutateSearchValue(keyword);
            await searchStore.loadMore();
            return {success: true};
        } catch (e) {
            return {error: '触发加载失败: ' + e.message};
        }
    }

    // ==========================================
    // 2. 极致简化的 UI
    // ==========================================
    GM_addStyle(`
        #xhs-search-mini-panel {
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #fff; border: 1px solid #ff2442; border-radius: 8px;
            padding: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            font-family: sans-serif; display: flex; align-items: center; gap: 8px;
        }
        .mini-input { border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; width: 100px; font-size: 13px; }
        .mini-btn { background: #ff2442; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; }
        .mini-count { font-size: 13px; color: #666; min-width: 80px; }
        .mini-export { background: #00b85c; }
    `);

    function updateUICount() {
        const totalEl = document.querySelector('#xhs-total');
        const detailEl = document.querySelector('#xhs-detail-count');
        const notes = Array.from(GLOBAL_NOTES.values());
        const detailsWithData = notes.filter(n => n.hasDetail || (n.commentsList && n.commentsList.length > 0)).length;
        if (totalEl) totalEl.innerText = GLOBAL_NOTES.size;
        if (detailEl) detailEl.innerText = detailsWithData;
    }

    function createUI() {
        const div = document.createElement('div');
        div.id = 'xhs-search-mini-panel';
        div.innerHTML = `
            <input type="text" class="mini-input" id="xhs-kw" placeholder="搜索词" />
            <button class="mini-btn" id="xhs-run">抓取</button>
            <span class="mini-count">列表:<b id="xhs-total">0</b> | 已详情:<b id="xhs-detail-count">0</b></span>
            <button class="mini-btn mini-export" id="xhs-dl">导出</button>
            <button class="mini-btn" id="xhs-clear" style="background:#666">清空</button>
        `;
        document.body.appendChild(div);

        const input = div.querySelector('#xhs-kw');
        const runBtn = div.querySelector('#xhs-run');
        const dlBtn = div.querySelector('#xhs-dl');
        const clearBtn = div.querySelector('#xhs-clear');

        runBtn.onclick = async () => {
            const kw = input.value.trim();
            if (!kw) return alert('请输入关键词');
            runBtn.disabled = true;
            runBtn.innerText = '...';
            const res = await triggerSearch(kw);
            runBtn.disabled = false;
            runBtn.innerText = '抓取';
            if (res.error) alert(res.error);
        };

        dlBtn.onclick = () => {
            const data = Array.from(GLOBAL_NOTES.values());
            if (data.length === 0) return alert('无数据');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xhs_data_${input.value || 'export'}_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        clearBtn.onclick = () => {
            if(confirm('清空所有已捕获数据？')){
                GLOBAL_NOTES.clear();
                updateUICount();
            }
        };
    }

    window.addEventListener('load', () => setTimeout(createUI, 1000));

})();
