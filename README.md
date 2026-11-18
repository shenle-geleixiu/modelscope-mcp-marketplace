# ModelScope MCP Marketplace

A Codex plugin marketplace that exposes the live [ModelScope MCP catalog](https://modelscope.cn/mcp) through a local stdio MCP server.

## What it provides

The `modelscope-mcp-hub` plugin includes four read-only tools:

- `modelscope_search_mcps` searches and filters the live catalog.
- `modelscope_get_mcp` returns metadata, tools, README content, and transport details.
- `modelscope_get_install_config` returns the server's published installation configuration.
- `modelscope_list_categories` lists catalog categories and counts.

The ModelScope catalog is queried live. No API key is required for catalog access.

## Add the marketplace in Codex

Open **Add plugin marketplace** and enter:

| Field | Value |
| --- | --- |
| Source | `shenle-geleixiu/modelscope-mcp-marketplace` |
| Git ref | `main` |
| Sparse path | Leave empty |

After the marketplace is added, install **ModelScope MCP Hub** from the marketplace.

## Add with the Codex CLI

```bash
codex plugin marketplace add shenle-geleixiu/modelscope-mcp-marketplace --ref main
codex plugin add modelscope-mcp-hub@shenle-modelscope-mcp
```

## Local development

```bash
npm install
npm run check
```

The checked-in `plugins/modelscope-mcp-hub/mcp/server.mjs` is a self-contained bundle. Consumers of the plugin do not need to run `npm install`.

## Data source

The server calls:

```text
PUT https://modelscope.cn/api/v1/dolphin/mcpServers
```

This project is independent from ModelScope. MCP listings and their licenses remain the responsibility of their respective publishers.

## License

MIT
