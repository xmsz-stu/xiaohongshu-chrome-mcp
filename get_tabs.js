/**
 * 使用 chrome-devtools-mcp 自動連接到您當前實際使用的瀏覽器分頁列表
 * 獲取您當前開啟的所有分頁資訊
 */

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

async function getTabs() {
  // 配置 MCP 伺服器使用 --autoConnect 參數
  // 這會嘗試連接到本地正在運行的 Chrome 實體 (通常需要 Chrome 144+)
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y", 
      "chrome-devtools-mcp", 
      "--autoConnect",             // 啟用自動連接
      "--no-usage-statistics"      // 關閉統計收集
    ]
  });

  // 建立 MCP client
  const client = new Client({
    name: "tab-lister-autoconnect",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  try {
    console.log("正在嘗試自動連接到您當前開啟的瀏覽器...");
    console.log("提示：如果這是第一次連接，請查看瀏覽器視窗上方是否出現「允許偵錯連線」的提示對話框，並點擊「允許」。");
    
    await client.connect(transport);
    
    console.log("正在呼叫 list_pages 工具...");
    const response = await client.callTool({
      name: "list_pages",
      arguments: {}
    });

    if (response.isError) {
      console.error("MCP 工具呼叫出錯：", response.content);
    } else {
      console.log("\n✅ 成功獲取分頁列表：");
      // 輸出 Markdown 格式的分頁列表
      const contentText = response.content[0].text;
      console.log(contentText);
    }
  } catch (err) {
    console.error("連接發生錯誤：", err.message);
    console.log("\n發生錯誤的可能原因：");
    console.log("1. 瀏覽器未開啟遠端偵錯功能：請到 chrome://inspect/#remote-debugging 開啟。");
    console.log("2. Chrome 版本過低：--autoConnect 需要較新版本的 Chrome。");
    console.log("3. 瀏覽器未授權：請確保已在瀏覽器彈出的提示中點擊「允許」。");
  } finally {
    // 關閉傳輸通道
    await transport.close();
  }
}

getTabs().catch(console.error);
