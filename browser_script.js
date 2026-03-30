/**
 * 注入浏览器的独立核心脚本
 * 该函数会被转换成字符串后，通过 MCP 的 evaluate_script 注入控制台运行
 */
(keyword) => {
  const tryHook = () => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia;
    const searchStore = pinia?._s?.get('search');

    if (searchStore) {
      console.log(`✅ [Browser] 注入 Webhook 成功 (关键词: ${keyword})，同步已激活...`);
      
      const seenIds = new Set();
      
      const sendUpdate = (freshNotes) => {
        if (freshNotes.length === 0) return;
        
        freshNotes.forEach(n => seenIds.add(n.id || n.noteId || n.title));

        fetch('http://localhost:3333/update/notes', {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, notes: freshNotes })
        }).catch(e => console.error('Webhook Error:', e));
      };

      // 1. 初次同步
      const initialNotes = (searchStore.feeds || []).filter(n => !seenIds.has(n.id || n.noteId || n.title));
      sendUpdate(initialNotes);

      // 2. 订阅后续 Pinia 更新
      searchStore.$subscribe((_mutation, state) => {
        const currentNotes = state.feeds || [];
        const freshNotes = currentNotes.filter(n => !seenIds.has(n.id || n.noteId || n.title));
        
        if (freshNotes.length > 0) {
          console.log(`🚀 [Browser Logic] 发现 ${freshNotes.length} 条新笔记，执行增量推送...`);
          sendUpdate(freshNotes);
        }
      });

      // 3. 订阅 Note 详情更新
      const noteStore = pinia?._s?.get('note');
      if (noteStore) {
        console.log("✅ [Browser] 详情监控已激活...");
        const pushedDetailInfo = new Map(); // id -> dataLength
        
        noteStore.$subscribe((_mutation, state) => {
          const detailMap = state.noteDetailMap || {};
          const newDetails = [];
          
          Object.entries(detailMap).forEach(([id, detail]) => {
            if (!id || id === "undefined" || id === "") return;

            // 基本的笔记数据，必须包含正文(desc)才算是“详情”
            if (detail?.note?.desc) {
              const currentDataLength = JSON.stringify(detail).length;
              const lastPushedLength = pushedDetailInfo.get(id) || 0;

              // 只有当是新 ID，或者数据体量明显增大（可能是评论加载了）时才推送
              if (currentDataLength > lastPushedLength) {
                pushedDetailInfo.set(id, currentDataLength);
                newDetails.push({
                  noteId: id,
                  ...detail.note,
                  comments: detail.comments // 捕获评论
                });
              }
            }
          });

          if (newDetails.length > 0) {
             console.log(`🚀 [Browser Logic] 发现 ${newDetails.length} 条新详情，向 Webhook 推送...`);
             fetch('http://localhost:3333/update/details', {
               method: 'POST',
               mode: 'cors',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ keyword, details: newDetails })
             }).catch(e => console.error('Detail Webhook Error:', e));
          }
        });
      }
      
      return "SUCCESS";
    }
    return null;
  };

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (tryHook()) {
        clearInterval(timer);
        resolve("Webhook Active");
      }
    }, 1000);
  });
}
