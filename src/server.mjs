import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  buildInstallOptions,
  findMcp,
  listCategories,
  normalizeMcpServer,
  searchMcps,
} from "./modelscope.mjs";

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(error) {
  return {
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
}

const server = new McpServer({
  name: "modelscope-mcp-hub",
  version: "0.1.0",
});

server.registerTool(
  "modelscope_list_categories",
  {
    title: "List ModelScope MCP categories",
    description:
      "List the categories and server counts in the ModelScope MCP catalog.",
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async () => {
    try {
      return jsonResult({ categories: await listCategories() });
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "modelscope_search_mcps",
  {
    title: "Search ModelScope MCP servers",
    description:
      "Search the live ModelScope MCP catalog. Supports keyword, category, Hosted/Local filtering, verification filtering, pagination, and sorting.",
    inputSchema: {
      query: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Keyword matched against ModelScope MCP names and metadata."),
      category: z
        .string()
        .trim()
        .max(100)
        .optional()
        .describe("ModelScope category slug, such as browser-automation."),
      hosted: z
        .boolean()
        .optional()
        .describe("true for hosted servers, false for local servers."),
      verified_only: z
        .boolean()
        .optional()
        .default(false)
        .describe("Return only servers marked as verified by ModelScope."),
      page: z
        .number()
        .int()
        .min(1)
        .max(1_000)
        .optional()
        .default(1)
        .describe("One-based result page number."),
      page_size: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .default(10)
        .describe("Number of results to return, up to 30."),
      sort: z
        .enum(["relevance", "calls", "stars", "updated"])
        .optional()
        .default("relevance")
        .describe("Sort order."),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async ({
    query = "",
    category,
    hosted,
    verified_only = false,
    page = 1,
    page_size = 10,
    sort = "relevance",
  }) => {
    try {
      return jsonResult(
        await searchMcps({
          query,
          category,
          hosted,
          verifiedOnly: verified_only,
          page,
          pageSize: page_size,
          sort,
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "modelscope_get_mcp",
  {
    title: "Get a ModelScope MCP server",
    description:
      "Get detailed metadata, tools, README, environment schema, and transport configuration for one ModelScope MCP server.",
    inputSchema: {
      id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ModelScope MCP server ID."),
      publisher: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Publisher path, such as @modelcontextprotocol/fetch."),
      name: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Server name exactly as listed by ModelScope."),
      query: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Fallback search keyword when an exact identifier is unknown."),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async ({ id, publisher, name, query }) => {
    try {
      if (!id && !publisher && !name && !query) {
        return errorResult(
          new Error("Provide id, publisher, name, or query."),
        );
      }
      const match = await findMcp({ id, publisher, name, query });
      if (!match) {
        return errorResult(new Error("No matching ModelScope MCP server was found."));
      }
      return jsonResult(normalizeMcpServer(match, { includeDetails: true }));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "modelscope_get_install_config",
  {
    title: "Get MCP install configuration",
    description:
      "Return ready-to-use ModelScope MCP transport and installation configuration, including required environment variables.",
    inputSchema: {
      id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("ModelScope MCP server ID."),
      publisher: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Publisher path, such as @modelcontextprotocol/fetch."),
      name: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Server name exactly as listed by ModelScope."),
      query: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Fallback search keyword when an exact identifier is unknown."),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async ({ id, publisher, name, query }) => {
    try {
      if (!id && !publisher && !name && !query) {
        return errorResult(
          new Error("Provide id, publisher, name, or query."),
        );
      }
      const match = await findMcp({ id, publisher, name, query });
      if (!match) {
        return errorResult(new Error("No matching ModelScope MCP server was found."));
      }
      return jsonResult({
        server: normalizeMcpServer(match),
        install: buildInstallOptions(match),
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `modelscope-mcp-hub failed: ${
      error instanceof Error ? error.stack || error.message : String(error)
    }\n`,
  );
  process.exitCode = 1;
});
