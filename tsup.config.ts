import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: false,
  format: ["esm"],
  external: [
    "dotenv",
    "fs",
    "path",
    "@elizaos/core",
    "@elizaos/plugin-sql",
    "drizzle-orm",
  ],
  loader: {
    ".json": "json",
  },
  dts: true,
});