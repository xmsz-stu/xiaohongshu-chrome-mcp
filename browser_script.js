/**
 * 注入浏览器的独立核心脚本
 * 该函数会被转换成字符串后，通过 MCP 的 evaluate_script 注入控制台运行
 */
(keyword, maxCount) => {
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
      let isProcessing = false;
      const processedDetailIds = new Set(); // 专门记录已经点击过详情的 ID
      const pushedDetailInfo = new Map(); // id -> dataLength (移动到此处以便在自动化循环中判断计数)
      
      const maxDetails = maxCount || 200; // 详情最大获取数量，达到后自动停止
      
      // 增加速度倍率，数值越大越快 (1.0 是原速, 2.0 是双倍速) 1.5可能已经会爆频繁
      const speed = 1.25; 

      const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor((Math.random() * (max - min) + min) / speed)));

      const getNoteIdFromElement = (el) => {
        const href = el.querySelector('a.cover')?.getAttribute('href') || "";
        // 匹配 /explore/65f... 或者其他格式的 ID
        const match = href.match(/\/explore\/([a-zA-Z0-9]+)/);
        return match ? match[1] : href;
      };

      const startAutomation = async () => {
        if (isProcessing) return;
        isProcessing = true;
        console.log(`🚀 [Browser] 自动化循环启动 (目标上限: ${maxDetails})...`);

        let consecutiveNoNewCount = 0;

        while (true) {
          // 检查是否达到采集上限
          if (pushedDetailInfo.size >= maxDetails) {
            console.log(`🛑 [Browser] 采集详情数量已达标 (${pushedDetailInfo.size}/${maxDetails})，正在停止程序并关闭页面...`);
            window.close();
            return;
          }

          const notes = Array.from(document.querySelectorAll('.note-item'));
          
          // 找第一个没处理过的笔记
          let targetNote = null;
          let targetId = "";
          
          for (const note of notes) {
            const id = getNoteIdFromElement(note);
            if (id && !processedDetailIds.has(id)) {
              targetNote = note;
              targetId = id;
              break;
            }
          }

          if (!targetNote) {
            console.log("📍 [Browser] 当前视图中没有未处理的贴子，尝试滚动...");
            const oldHeight = document.documentElement.scrollHeight;
            window.scrollBy({ top: 1000, behavior: 'smooth' });
            await randomSleep(2000, 3000);
            
            if (document.documentElement.scrollHeight === oldHeight) {
              consecutiveNoNewCount++;
            } else {
              consecutiveNoNewCount = 0;
            }

            if (consecutiveNoNewCount > 5) {
                console.log("🛑 [Browser] 连续多次滚动没新内容，停止自动化。");
                break;
            }
            continue;
          }

          consecutiveNoNewCount = 0;
          const targetAnchor = targetNote.querySelector('a.cover');
          const targetImg = targetAnchor?.querySelector('img');
          
          if (!targetAnchor) {
            processedDetailIds.add(targetId); // 标记为跳过
            continue;
          }

          console.log(`🚀 [Browser] 正在处理笔记 ID: ${targetId} ...`);
          
          // 2. 模拟真人操作：滚动并定位
          targetNote.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await randomSleep(1000, 1500);

          // 3. 执行点击
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
          await randomSleep(3000, 5000);
          
          // 检查详情是否真的打开了 (通过是否存在 mask 或 close 按钮)
          const hasModal = () => document.querySelector('.note-detail-mask') || document.querySelector('.close-circle');
          
          if (hasModal()) {
            // 随机阅读逻辑
            const scroller = document.querySelector('.note-scroller');
            if (scroller) {
              console.log("阅读中...");
              for (let i = 0; i < 2; i++) {
                const scrollAmt = Math.floor(Math.random() * 200) + 50;
                scroller.scrollBy({ top: scrollAmt, behavior: 'smooth' });
                await randomSleep(1000, 2000);
              }
            }

            // 关闭弹窗
            const mask = document.querySelector('.note-detail-mask');
            const closeBtn = document.querySelector('.close-circle');
            console.log("✖️ [Browser] 关闭弹窗");
            (closeBtn || mask).click();
            await randomSleep(1000, 2000);
          } else {
            console.log("⚠️ [Browser] 弹窗似乎没打开，可能需要重试或检查点击逻辑");
          }

          // 标记已处理
          processedDetailIds.add(targetId);
          await randomSleep(1000, 2000);
        }
        
        isProcessing = false;
      };

      if (initialNotes.length > 0) {
        console.log("✅ [Browser] 启动自动化循环...");
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
