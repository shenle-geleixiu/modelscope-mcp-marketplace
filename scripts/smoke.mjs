import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const client = new Client({
  name: "modelscope-mcp-hub-smoke-test",
  version: "0.1.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["./mcp/server.mjs"],
  cwd: resolve(root, "plugins", "modelscope-mcp-hub"),
  env: process.env,
  stderr: "inherit",
});

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const result = await client.callTool({
    name: "modelscope_search_mcps",
    arguments: {
      query: "fetch",
      page_size: 3,
      sort: "calls",
    },
  });

  console.log(
    JSON.stringify(
      {
        tools: tools.tools.map((tool) => tool.name),
        search: JSON.parse(result.content[0].text),
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
