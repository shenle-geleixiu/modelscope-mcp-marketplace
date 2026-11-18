import assert from "node:assert/strict";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const sampleServer = {
  Id: 288,
  Name: "fetch",
  ChineseName: "Fetch网页内容抓取",
  Publisher: "@modelcontextprotocol/fetch",
  Hosted: true,
  Verifed: true,
  Category: ["browser-automation"],
  License: "MIT License",
  AbstractCN: "抓取网页内容并转换为 Markdown。",
  CallVolume: 123,
  Stars: 45,
  GmtUpdated: 1_795_000_000,
  FromSiteUrl:
    "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  EnvSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  Tools: [
    {
      name: "fetch",
      description: "Fetch a URL as Markdown.",
    },
  ],
  StreamableHTTPServerConfig: [],
  SSEServerConfig: [],
  ServerConfig: [
    {
      mcpServers: {
        fetch: {
          command: "uvx",
          args: ["mcp-server-fetch"],
        },
      },
    },
  ],
  ReadmeCN: "# Fetch\n\nFetch a URL as Markdown.",
  SupportedDeployTransportType: ["streamable_http", "sse"],
};

function samplePayload() {
  return {
    Code: 200,
    Success: true,
    Message: "success",
    Data: {
      FiledAgg: {
        Category: [{ Value: "browser-automation", Count: 1 }],
      },
      McpServer: {
        TotalCount: 1,
        McpServers: [sampleServer],
      },
    },
  };
}

test("stdio MCP server exposes and executes ModelScope tools", async () => {
  const requests = [];
  const apiServer = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(samplePayload()));
    });
  });

  await new Promise((resolvePromise) => {
    apiServer.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = apiServer.address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  const client = new Client({
    name: "modelscope-mcp-hub-test",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./mcp/server.mjs"],
    cwd: resolve(root, "plugins", "modelscope-mcp-hub"),
    env: {
      ...getDefaultEnvironment(),
      MODELSCOPE_API_BASE: `http://127.0.0.1:${address.port}`,
    },
    stderr: "pipe",
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      [
        "modelscope_get_install_config",
        "modelscope_get_mcp",
        "modelscope_list_categories",
        "modelscope_search_mcps",
      ],
    );

    const search = await client.callTool({
      name: "modelscope_search_mcps",
      arguments: {
        query: "fetch",
        page_size: 5,
      },
    });
    assert.equal(search.isError, undefined);
    const searchPayload = JSON.parse(search.content[0].text);
    assert.equal(searchPayload.totalCount, 1);
    assert.equal(searchPayload.servers[0].publisher, "@modelcontextprotocol/fetch");

    const install = await client.callTool({
      name: "modelscope_get_install_config",
      arguments: {
        publisher: "@modelcontextprotocol/fetch",
      },
    });
    assert.equal(install.isError, undefined);
    const installPayload = JSON.parse(install.content[0].text);
    assert.equal(installPayload.install.options[0].transport, "stdio");
    assert.equal(
      installPayload.install.options[0].config.mcpServers.fetch.command,
      "uvx",
    );

    assert.equal(requests.length >= 2, true);
    assert.equal(requests[0].method, "PUT");
    assert.equal(
      requests[0].url,
      "/api/v1/dolphin/mcpServers",
    );
    assert.equal(JSON.parse(requests[0].body).Query, "fetch");
  } finally {
    await client.close();
    await new Promise((resolvePromise) => apiServer.close(resolvePromise));
  }
});
