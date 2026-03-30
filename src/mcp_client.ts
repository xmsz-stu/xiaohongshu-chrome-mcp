import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * 通用的 MCP 执行器，管理连接生命周期、捕获错误。
 */
export async function runMcpAction(task: (client: Client) => Promise<void>) {
    const transport = new StdioClientTransport({
        command: "npx",
        args: [
            "-y",
            "chrome-devtools-mcp",
            "--autoConnect",
            "--no-usage-statistics"
        ]
    });

    const client = new Client({
        name: "xhs-hono-agent",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    try {
        await client.connect(transport);
        await task(client);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("ECONNREFUSED")) {
            console.error("\n[错误] 无法连接到 Chrome。请确保：\n1. Chrome 正在运行\n2. 开启了远程调试 (chrome://inspect/#remote-debugging)");
        } else {
            console.error(`\n[MCP] 任务执行失败:`, errorMessage);
        }
        throw err;
    } finally {
        await transport.close();
    }
}

/**
 * 注入指定关键词的监听脚本到新的搜索页面。
 */
export async function setupSearchTab(keyword: string) {
    const targetUrl = `https://www.xiaohongshu.com/search_result/?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes&type=51`;
    const injectionScriptPath = path.join(process.cwd(), 'browser_script.js');
    const injectionScript = fs.readFileSync(injectionScriptPath, 'utf8');

    // 异步启动，防止 Hono 阻塞
    runMcpAction(async (client) => {
        console.log(`[MCP] 正在为关键词 "${keyword}" 打开新页面...`);
        await client.callTool({ name: "new_page", arguments: { url: targetUrl } });
        
        console.log("[MCP] 等待页面加载并注入监听脚本...");
        // 等待 3 秒确保页面部分渲染
        await new Promise<void>(r => setTimeout(r, 3000));
        
        await client.callTool({
            name: "evaluate_script",
            arguments: { function: `(${injectionScript})("${keyword}")` }
        });
        console.log("[MCP] 脚本注入成功。");
    }).catch(err => {
        console.error("[MCP Error]", err);
    });

    return targetUrl;
}
