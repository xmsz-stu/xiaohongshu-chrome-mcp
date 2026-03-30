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
        
        freshNotes.forEach(n => {
          seenIds.add(n.id || n.noteId || n.title);
        });

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

      // --- [Step 2: 自动化循环系统] ---
      let currentIndex = 0;
      let isProcessing = false;

      const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));

      const startAutomation = async () => {
        if (isProcessing) return;
        isProcessing = true;

        while (true) {
          const notes = document.querySelectorAll('.note-item');
          if (currentIndex >= notes.length) {
            console.log("📍 [Browser] 当前页已处理完，滚动加载更多...");
            window.scrollBy({ top: 800, behavior: 'smooth' });
            await randomSleep(2000, 3000);
            // 重新获取 notes，如果还是没有更多，就跳出
            if (document.querySelectorAll('.note-item').length <= notes.length) {
                console.log("🛑 [Browser] 没有更多贴子了，停止。");
                break;
            }
            continue;
          }

          const targetNote = notes[currentIndex];
          const targetAnchor = targetNote.querySelector('a.cover');
          const targetImg = targetAnchor?.querySelector('img');
          
          if (!targetAnchor) {
            currentIndex++;
            continue;
          }

          console.log(`🚀 [Browser] 正在处理第 ${currentIndex + 1} 个贴子...`);
          
          // 2. 模拟真人操作：滚动并定位
          targetAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await randomSleep(1000, 1500);

          // 3. 执行点击：点击图片而非链接本身，防止触发 href 跳转
          const clickTarget = targetImg || targetAnchor;
          const rect = clickTarget.getBoundingClientRect();
          
          if (rect.width > 0 && rect.height > 0) {
            const x = rect.left + rect.width / 2 + (Math.random() * 20 - 10);
            const y = rect.top + rect.height / 2 + (Math.random() * 20 - 10);
            
            console.log(`🖱️ [Browser] 模拟点击图片位置 (${Math.round(x)}, ${Math.round(y)})...`);
            clickTarget.dispatchEvent(new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y
            }));
          } else {
            console.log("⚠️ [Browser] 目标元素不可见，尝试直接点击锚点...");
            targetAnchor.click();
          }
          
          // 4. 等待弹窗加载
          await randomSleep(2500, 4000);
          
          // 随机滚动弹窗内容
          const scroller = document.querySelector('.note-scroller');
          if (scroller) {
            console.log("🖱️ [Browser] 在弹窗内模拟阅读（随机滚动）...");
            for (let i = 0; i < 3; i++) {
              const scrollAmt = Math.floor(Math.random() * 300) + 100;
              scroller.scrollBy({ top: scrollAmt, behavior: 'smooth' });
              await randomSleep(800, 1500);
            }
          }

          // 如果有右箭头切换，可以点一下模拟翻页
          const nextBtn = document.querySelector('.arrow-controller.right');
          if (nextBtn && Math.random() > 0.5) {
            console.log("➡️ [Browser] 点击右箭头查看下一张...");
            nextBtn.click();
            await randomSleep(1500, 2500);
          }

          // 4. 关闭弹窗
          const mask = document.querySelector('.note-detail-mask');
          const closeBtn = document.querySelector('.close-circle');
          if (mask || closeBtn) {
            console.log("✖️ [Browser] 关闭弹窗，进入下一个...");
            (closeBtn || mask).click();
            await randomSleep(1000, 2000);
          }

          currentIndex++;
          await randomSleep(1000, 2000);
        }
        
        isProcessing = false;
      };

      if (initialNotes.length > 0) {
        console.log("✅ [Browser] 初始数据已就绪，启动自动化循环...");
        startAutomation();
      }
      // --- [Step 2 End] ---

      // 2. 订阅后续 Pinia 更新
      searchStore.$subscribe((_mutation, state) => {
        const currentNotes = state.feeds || [];
        const freshNotes = currentNotes.filter(n => !seenIds.has(n.id || n.noteId || n.title));
        
        if (freshNotes.length > 0) {
          console.log(`🚀 [Browser Logic] 发现 ${freshNotes.length} 条新笔记，执行增量推送...`);
          sendUpdate(freshNotes);
          
          // 如果之前没启动，现在启动
          if (!isProcessing) startAutomation();
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
