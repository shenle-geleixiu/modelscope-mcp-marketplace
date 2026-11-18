import { build } from "esbuild";

await build({
  entryPoints: ["src/server.mjs"],
  outfile: "plugins/modelscope-mcp-hub/mcp/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
  sourcemap: false,
});
