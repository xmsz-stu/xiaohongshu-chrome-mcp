// ==UserScript==
// @name         小红书助手 (XHS Helper) - 全能数据导出版
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  支持已读置灰、勾选高亮、详情抓取及评论采集，一键导出选中帖子的完整数据。
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
    // 1. 数据结构与初始化
    // ==========================================
    const GLOBAL_NOTES = new Map(); // 存储捕获的数据
    const SELECTED_IDS = new Set(); // 存储勾选 ID
    const readNotes = new Set();    // 内存已读

    function markAsRead(id) {
        if (!id || readNotes.has(id)) return;
        readNotes.add(id);
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) card.classList.add('is-read');
    }

    // ==========================================
    // 2. 数据处理逻辑
    // ==========================================
    function processListResponse(json) {
        if (!json?.data?.items) return;
        json.data.items.forEach(i => {
            const id = i.id || i.note_card?.id;
            if (id && !GLOBAL_NOTES.has(id)) {
                GLOBAL_NOTES.set(id, {
                    id: id,
                    title: i.note_card?.display_title || i.display_title || "无标题",
                    url: 'https://www.xiaohongshu.com/explore/' + id,
                    author: i.note_card?.user?.nickname || i.user?.nickname,
                    hasDetail: false,
                    commentsList: []
                });
            }
        });
        updateStats();
    }

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
            url: 'https://www.xiaohongshu.com/explore/' + id,
            author: note.user?.nickname || existing.author,
            tags: note.tag_list?.map(t => t.name) || [],
            images: note.image_list?.map(img => img.info_list?.[0]?.url || img.url) || [],
            hasDetail: true,
            commentsList: existing.commentsList || []
        });

        markAsRead(id);
        updateStats();
    }

    function processCommentsResponse(url, json) {
        try {
            const urlObj = new URL(url, location.origin);
            const noteId = urlObj.searchParams.get('note_id');
            if (!noteId || !json?.data?.comments) return;

            const existing = GLOBAL_NOTES.get(noteId);
            if (!existing) return;

            const newComments = json.data.comments.map(c => ({
                id: c.id,
                author: c.user_info?.nickname,
                content: c.content,
                likes: c.like_count,
                time: c.create_time
            }));

            const merged = existing.commentsList || [];
            const ids = new Set(merged.map(c => c.id));
            newComments.forEach(c => { if (!ids.has(c.id)) merged.push(c); });

            existing.commentsList = merged;
            console.log(`[XHS Helper] 捕获到评论: ${noteId}, 目前累计 ${merged.length} 条`);
        } catch (e) {
            console.error('[XHS Helper] 评论解析失败', e);
        }
    }

    // 注入拦截器
    (function() {
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, u, ...args) { 
            this.__url = u; 
            return origOpen.apply(this, [m, u, ...args]); 
        };
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(...args) {
            const x = this;
            const orig = x.onreadystatechange;
            x.onreadystatechange = function(...sArgs) {
                if (x.readyState === 4 && x.status === 200) {
                    try {
                        const json = JSON.parse(x.responseText);
                        const url = x.__url;
                        if (url?.includes('search/notes') || url?.includes('homefeed')) {
                            processListResponse(json);
                        } else if (url?.includes('/feed') || url?.includes('/note/detail')) {
                            processDetailResponse(json);
                        } else if (url?.includes('comment/page')) {
                            processCommentsResponse(url, json);
                        }
                    } catch (e) {}
                }
                if (orig) return orig.apply(this, sArgs);
            };
            return origSend.apply(this, args);
        };
    })();

    // ==========================================
    // 3. UI 注入与样式
    // ==========================================
    GM_addStyle(`
        .is-read { opacity: 0.6 !important; filter: grayscale(0.6); }
        .is-selected { box-shadow: 0 0 0 4px #ff2442 !important; border-radius: 12px; z-index: 5 !important; }

        .xhs-check-wrap {
            position: absolute; top: 12px; left: 12px; z-index: 100;
            background: rgba(255, 255, 255, 0.95); border-radius: 6px;
            padding: 6px; cursor: pointer; display: flex; align-items: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15); border: 1px solid #ff244233;
        }
        .xhs-check-wrap input { cursor: pointer; width: 18px; height: 18px; accent-color: #ff2442; margin: 0; }

        #xhs-helper-panel {
            position: fixed; bottom: 30px; right: 30px; z-index: 10000;
            background: #fff; border-radius: 16px; padding: 20px; width: 220px;
            box-shadow: 0 15px 50px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }
        .helper-title { font-size: 15px; font-weight: 800; color: #333; border-bottom: 2px solid #ff2442; padding-bottom: 8px; margin-bottom: 4px; }
        .helper-stat { font-size: 13px; color: #666; display: flex; justify-content: space-between; }
        .helper-stat b { color: #ff2442; font-family: monospace; font-size: 14px; }
        .helper-btn {
            background: #ff2442; color: #fff; border: none; padding: 12px;
            border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .helper-btn:hover { background: #e61b37; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255,36,66,0.3); }
        .helper-btn:active { transform: translateY(0); }
        .helper-btn:disabled { background: #f5f5f5; color: #ccc; cursor: not-allowed; box-shadow: none; }
        .helper-btn.secondary { background: #f0f0f0; color: #666; font-size: 12px; margin-top: 4px; }
        .helper-btn.export { background: #07c160; }
        .helper-btn.export:hover { background: #06ae56; box-shadow: 0 5px 15px rgba(7,193,96,0.3); }
    `);

    function getNoteId(el) {
        if (el.dataset.id) return el.dataset.id;
        const link = el.querySelector('a[href*="/explore/"]');
        if (link) {
            const m = link.href.match(/\/explore\/([a-zA-Z0-9]+)/);
            return m ? m[1] : null;
        }
        return null;
    }

    function injectUI(card) {
        if (card.querySelector('.xhs-check-wrap')) return;
        const id = getNoteId(card);
        if (!id) return;

        card.setAttribute('data-id', id);
        if (readNotes.has(id)) card.classList.add('is-read');
        if (SELECTED_IDS.has(id)) card.classList.add('is-selected');

        const wrap = document.createElement('div');
        wrap.className = 'xhs-check-wrap';
        wrap.onclick = e => e.stopPropagation();

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = SELECTED_IDS.has(id);
        input.addEventListener('change', (e) => {
            if (e.target.checked) {
                SELECTED_IDS.add(id);
                card.classList.add('is-selected');
            } else {
                SELECTED_IDS.delete(id);
                card.classList.remove('is-selected');
            }
            updateStats();
        });

        wrap.appendChild(input);
        card.appendChild(wrap);

        card.addEventListener('click', () => { setTimeout(() => markAsRead(id), 600); }, true);
    }

    const obs = new MutationObserver(() => {
        document.querySelectorAll('section.note-item, .note-item, .fe-note-item').forEach(item => { injectUI(item); });
    });

    // ==========================================
    // 4. 面板逻辑与导出
    // ==========================================
    function updateStats() {
        const s = document.querySelector('#xhs-s-cnt');
        const d = document.querySelector('#xhs-d-cnt');
        const b = document.querySelector('#xhs-exp');
        const detailCount = Array.from(GLOBAL_NOTES.values()).filter(n => n.hasDetail).length;
        if (s) s.innerText = SELECTED_IDS.size;
        if (d) d.innerText = detailCount;
        if (b) b.disabled = SELECTED_IDS.size === 0;
    }

    function createPanel() {
        if (document.querySelector('#xhs-helper-panel')) return;
        const p = document.createElement('div');
        p.id = 'xhs-helper-panel';
        p.innerHTML = `
            <div class="helper-title">小红书数据助手</div>
            <div class="helper-stat">当前已选中: <b id="xhs-s-cnt">0</b></div>
            <div class="helper-stat">详情已捕获: <b id="xhs-d-cnt">0</b></div>
            <button class="helper-btn export" id="xhs-exp" disabled>一键导出选中列表</button>
            <button class="helper-btn secondary" id="xhs-reset">清除全部缓存</button>
        `;
        document.body.appendChild(p);

        p.querySelector('#xhs-exp').onclick = () => {
            const data = Array.from(SELECTED_IDS).map(id => GLOBAL_NOTES.get(id)).filter(n => n?.hasDetail);
            if (data.length === 0) return alert('请先点击帖子详情以抓取完整内容后再导出！');
            
            const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const u = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = u;
            a.download = `xhs_full_export_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(u);
        };

        p.querySelector('#xhs-reset').onclick = () => {
            if (confirm('确认重置本次扫描的所有数据？')) {
                SELECTED_IDS.clear();
                readNotes.clear();
                GLOBAL_NOTES.clear();
                document.querySelectorAll('.is-read, .is-selected').forEach(el => el.classList.remove('is-read', 'is-selected'));
                document.querySelectorAll('.xhs-check-wrap input').forEach(el => el.checked = false);
                updateStats();
            }
        };
    }

    function init() {
        createPanel();
        obs.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('section.note-item, .note-item, .fe-note-item').forEach(i => { injectUI(i); });
    }

    window.addEventListener('load', () => setTimeout(init, 1000));
})();
