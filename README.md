# Xiaohongshu Chrome MCP 🚀

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Enabled-blue.svg)](https://modelcontextprotocol.io)

一个小红书（Xiaohongshu/XHS）自动化采集助手。通过注入浏览器脚本并结合本地 [Hono](https://hono.dev/) 服务器，实现对笔记列表及详情数据的实时抓取、持久化存储及导出。

## ✨ 核心特性

- **自动化控制**：基于 `chrome-devtools-mcp` 自动打开 Chrome 并导航至搜索结果页。
- **动态脚本注入**：实时向页面注入采集逻辑，模拟人类行为进行滚动和点击。
- **深度详情采集**：包括笔记标题、正文、点赞/收藏数、互动量以及多层级评论。
- **实时数据同步**：浏览器端抓取到数据后立即推送至本地 3333 端口的 Webhook 接口。
- **本地去重存储**：数据自动保存至 `data/` 目录，支持按关键词汇总并自动过滤重复记录。
- **Markdown 导出**：提供专用工具脚本，可按点赞量降序导出精美的 Markdown 报告。

## 🛠️ 技术栈

- **Runtime**: [Bun v1.3.11+](https://bun.com)
- **Backend**: Hono (极简且类型安全的 Web 框架)
- **MCP Client**: @modelcontextprotocol/sdk
- **Browser Automation**: chrome-devtools-mcp
- **Storage**: 本地 JSON 文件 (去重持久化)

## 🚀 快速开始

### 1. 前置准备

确保您的本地已安装 [Bun](https://bun.sh/)，并且 Chrome 浏览器正在运行。

> [!IMPORTANT]
> 必须开启 Chrome 的远程调试模式。
> macOS 启动命令示例：
> `open -a "Google Chrome" --args --remote-debugging-port=9222`

### 2. 安装依赖

```bash
bun install
```

### 3. 启动采集服务器

```bash
# 使用默认配置 (采集上限 200 条)
bun run app.ts

# 或者指定最大采集详情数
bun run app.ts --max 500
```

### 4. 触发采集任务

访问以下接口即可触发自动化采集：
`http://localhost:3333/search?keyword=您的搜索词&max=100`

## 📂 项目结构

```text
├── app.ts              # 应用入口（Hono 服务端）
├── browser_script.js   # 浏览器端注入逻辑（数据抓取与自动化交互）
├── src/
│   ├── handlers.ts     # 业务路由处理
│   ├── mcp_client.ts   # MCP 客户端封装
│   ├── storage.ts      # 数据持久化逻辑（去重存储）
│   └── config.ts       # 全局配置解析
├── scripts/
│   └── export_md.ts   # 数据导出工具
└── data/               # 采集结果存储目录
```

## 📊 数据导出

采集完成后，您可以使用脚本将 JSON 数据转化为 Markdown 格式：

```bash
# 自动读取 data/ 目录下的详情文件并生成 Markdown
bun run scripts/export_md.ts
```

## 📝 许可证

ISC
