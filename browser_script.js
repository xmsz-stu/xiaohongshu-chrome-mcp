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

        fetch('http://localhost:3333/update', {
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
      searchStore.$subscribe((mutation, state) => {
        const currentNotes = state.feeds || [];
        const freshNotes = currentNotes.filter(n => !seenIds.has(n.id || n.noteId || n.title));
        
        if (freshNotes.length > 0) {
          console.log(`🚀 [Browser Logic] 发现 ${freshNotes.length} 条新笔记，执行增量推送...`);
          sendUpdate(freshNotes);
        }
      });
      
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
