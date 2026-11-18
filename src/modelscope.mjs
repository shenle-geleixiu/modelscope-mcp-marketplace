const DEFAULT_BASE_URL = "https://modelscope.cn";
const CATALOG_PATH = "/api/v1/dolphin/mcpServers";

function getBaseUrl() {
  return (
    process.env.MODELSCOPE_API_BASE?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

function trimText(value, limit) {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n\n[content truncated at ${limit} characters]`;
}

function asArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export async function queryCatalog({
  query = "",
  page = 1,
  pageSize = 10,
  hosted,
  category,
  signal,
} = {}) {
  const criterion = [];
  if (typeof hosted === "boolean") {
    criterion.push({
      Category: "Hosted",
      Predicate: "contains",
      BoolValues: [hosted],
    });
  }
  if (category) {
    criterion.push({
      Category: "Category",
      Predicate: "contains",
      StringValues: [category],
    });
  }

  const response = await fetch(`${getBaseUrl()}${CATALOG_PATH}`, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-modelscope-accept-language": "zh_CN",
      "user-agent": "modelscope-mcp-hub/0.1.0",
    },
    body: JSON.stringify({
      PageSize: pageSize,
      PageNumber: page,
      Query: query,
      Criterion: criterion,
    }),
    signal: signal ?? AbortSignal.timeout(20_000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.Success !== true || !payload?.Data) {
    const detail = payload?.Message || payload?.Code || response.statusText;
    throw new Error(`ModelScope catalog request failed: ${detail}`);
  }
  return payload.Data;
}

export function normalizeMcpServer(server, { includeDetails = false } = {}) {
  const publisher = server.Publisher || `${server.Path || ""}/${server.Name || ""}`;
  const normalized = {
    id: server.Id,
    name: server.Name,
    displayName: server.ChineseName || server.NickName || server.Name,
    publisher,
    hosted: Boolean(server.Hosted),
    verified: Boolean(server.Verifed),
    categories: asArray(server.Category),
    license: server.License || null,
    abstract:
      server.AbstractCN ||
      server.TranslatedAbstract ||
      server.Abstract ||
      "",
    calls: Number(server.CallVolume || 0),
    stars: Number(server.Stars || 0),
    updatedAt: server.GmtUpdated
      ? new Date(server.GmtUpdated * 1000).toISOString()
      : null,
    sourceUrl: server.FromSiteUrl || null,
    pageUrl: `https://modelscope.cn/mcp/servers/${publisher}`,
    tools: asArray(server.Tools).map((tool) => ({
      name: tool.name,
      description: tool.description || "",
    })),
  };

  if (!includeDetails) {
    return normalized;
  }

  const streamableHttp = asArray(server.StreamableHTTPServerConfig);
  const sse = asArray(server.SSEServerConfig);
  const stdio = asArray(server.ServerConfig);

  return {
    ...normalized,
    abstract: normalized.abstract || trimText(server.ReadmeCN, 8_000),
    readme: trimText(server.ReadmeCN || server.Readme, 30_000),
    envSchema: server.EnvSchema || { type: "object", properties: {} },
    supportedTransports: asArray(server.SupportedDeployTransportType),
    transportConfigs: {
      streamableHttp,
      sse,
      stdio,
    },
  };
}

export async function searchMcps(options = {}) {
  const data = await queryCatalog(options);
  const mcpServers = data.McpServer?.McpServers ?? [];
  return {
    totalCount: Number(data.McpServer?.TotalCount || 0),
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 10,
    categories: (data.FiledAgg?.Category || []).map((item) => ({
      name: item.Value,
      count: Number(item.Count || 0),
    })),
    servers: mcpServers
      .map((server) => normalizeMcpServer(server))
      .filter((server) => !options.verifiedOnly || server.verified)
      .sort((left, right) => {
        if (options.sort === "calls") {
          return right.calls - left.calls;
        }
        if (options.sort === "stars") {
          return right.stars - left.stars;
        }
        if (options.sort === "updated") {
          return (right.updatedAt || "").localeCompare(left.updatedAt || "");
        }
        return 0;
      }),
  };
}

export async function listCategories() {
  const data = await queryCatalog({ page: 1, pageSize: 1 });
  return (data.FiledAgg?.Category || [])
    .map((item) => ({
      name: item.Value,
      count: Number(item.Count || 0),
    }))
    .sort((left, right) => right.count - left.count);
}

export async function findMcp({ id, publisher, name, query }) {
  const candidateQueries = [query, publisher, id, name].filter(
    (value) => value != null && String(value).trim() !== "",
  );

  for (const candidateQuery of [...new Set(candidateQueries.map(String))]) {
    const data = await queryCatalog({
      query: candidateQuery,
      page: 1,
      pageSize: 30,
    });
    const matches = data.McpServer?.McpServers ?? [];
    const exact = matches.find((server) => {
      if (id != null && String(server.Id) !== String(id)) {
        return false;
      }
      if (
        publisher &&
        server.Publisher?.toLowerCase() !== String(publisher).toLowerCase()
      ) {
        return false;
      }
      if (name && server.Name?.toLowerCase() !== String(name).toLowerCase()) {
        return false;
      }
      return id != null || Boolean(publisher) || Boolean(name);
    });
    if (exact) {
      return exact;
    }
  }

  if (!id && !publisher && !name && query) {
    const data = await queryCatalog({ query, page: 1, pageSize: 30 });
    return data.McpServer?.McpServers?.[0] ?? null;
  }

  return null;
}

export function buildInstallOptions(server) {
  const transportConfigs = {
    streamableHttp: asArray(server.StreamableHTTPServerConfig),
    sse: asArray(server.SSEServerConfig),
    stdio: asArray(server.ServerConfig),
  };

  return {
    requiredEnv: server.EnvSchema?.required || [],
    envSchema: server.EnvSchema || { type: "object", properties: {} },
    options: [
      ...transportConfigs.streamableHttp.map((config) => ({
        transport: "streamable_http",
        config,
      })),
      ...transportConfigs.sse.map((config) => ({
        transport: "sse",
        config,
      })),
      ...transportConfigs.stdio.map((config) => ({
        transport: "stdio",
        config,
      })),
    ],
  };
}
