# Model Context Protocol (MCP)

> 📊 原文: [MCP Introduction - modelcontextprotocol.io](https://modelcontextprotocol.io/introduction)

## 概述

Model Context Protocol（MCP）是一个开放标准协议，用于连接 AI 助手与外部数据源和工具。由 Anthropic 主导开发，旨在解决 AI 应用中的"连接器碎片化"问题——每个工具都需要单独的集成。

## 核心问题

在 MCP 出现之前，AI 助手要使用外部工具面临：
1. **每次集成成本高**: 每个新工具都需要写专门的 connector
2. **标准化缺失**: 不同工具的 API 格式各异
3. **上下文窗口限制**: 如何高效地将外部信息注入 LLM
4. **安全边界不清**: 工具调用的权限控制不统一

## MCP 架构

### 三层角色
- **Host（宿主）**: Claude Desktop、IDE 等 AI 应用
- **Client（客户端）**: Host 启动的服务器进程
- **Server（服务端）**: 暴露资源和工具的程序

### 核心能力
1. **Resources（资源）**: 数据源（文件、数据库、API 响应）
2. **Tools（工具）**: 可执行的操作（函数调用）
3. **Prompts（提示词模板）**: 预定义的交互模板
4. **Sampling（采样）**: 通过 LLM 生成文本

### 通信协议
- 基于 JSON-RPC 2.0
- 支持 stdio 和 Streamable HTTP 传输
- 双向通信：Client ↔ Server

## 关键概念

### Server 类型
- **Local Server**: 本地运行的进程（如文件系统访问）
- **Remote Server**: 远程服务（如 GitHub API、数据库）

### Capabilities（能力声明）
Server 声明自己支持的能力：
```json
{
  "capabilities": {
    "tools": {},
    "resources": { "subscribe": true },
    "prompts": {}
  }
}
```

## 生态系统

### 已有 Server 实现
- **Filesystem**: 本地文件读写
- **GitHub**: 仓库管理、PR、Issues
- **PostgreSQL/SQLite**: 数据库查询
- **Puppeteer**: 浏览器自动化
- **Google Drive**: 云存储访问

### SDK 支持
- TypeScript/JavaScript（官方）
- Python（社区）
- Go、Rust、Java（社区）

## 对 KnowFlow 的启示

- **KnowFlow 可以作为 MCP Server**: 将 Wiki 知识库暴露为 MCP Resource
- **Ingest 管线可以封装为 MCP Tool**: `knowflow_ingest(url)` 
- **Query 功能天然对应 MCP Resource + Tool**
- 统一协议意味着 KnowFlow 可以被任何 MCP 兼容的 AI 应用使用

## 相关链接
[[entities/Anthropic]] | [[entities/OpenClaw]] | [[concepts/llm-wiki-methodology]] | [[concepts/distributed-brain]]
