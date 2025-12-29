import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "codex-specialized-subagents",
    version: "0.1.0",
  });

  await server.connect(new StdioServerTransport());
}

