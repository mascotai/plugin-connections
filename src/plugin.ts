import type { Plugin, IAgentRuntime } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { schema } from "./schema";
import { routes } from "./routes";
import { AuthService } from "./services/auth.service";
import { DatabaseService } from "./services/database.service";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the path to the frontend distribution directory
// Use the plugin's built location to find the frontend files (same level as the built JS)
const frontendDist = path.resolve(__dirname, "frontend");

const frontPagePath = path.resolve(frontendDist, "index.html");
const assetsPath = path.resolve(frontendDist, "assets");

console.log("*** Using frontendDist:", frontendDist);
console.log("*** frontPagePath", frontPagePath);
console.log("*** assetsPath", assetsPath);



import { updateAndRegisterPlugin, getCredentials } from "./utils";

const plugin: Plugin = {
  name: "connections",
  description:
    "Connection management plugin for Twitter authentication and other services",
  dependencies: ["@elizaos/plugin-sql"],
  schema,

  async init(config: Record<string, string>, runtime: IAgentRuntime) {
    console.log("Connections Plugin: Initializing...");
    const credentials = await getCredentials(runtime, "twitter");
    if (credentials) {
      await updateAndRegisterPlugin(
        runtime,
        {
          TWITTER_ACCESS_TOKEN: credentials.accessToken,
          TWITTER_ACCESS_TOKEN_SECRET: credentials.accessTokenSecret,
        },
        "@elizaos/plugin-twitter",
      );
    }
  },
  routes: [
    // Frontend routes
    {
      type: "GET",
      path: "/panels/connections",
      name: "Connections",
      public: true,
      handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
        const connectionsHtmlPath = path.resolve(frontendDist, "index.html");
        console.log("*** Checking for HTML file at:", connectionsHtmlPath);
        console.log("*** File exists:", fs.existsSync(connectionsHtmlPath));
        if (fs.existsSync(connectionsHtmlPath)) {
          let htmlContent = fs.readFileSync(connectionsHtmlPath, "utf-8");

          // Inject the actual agent ID from the runtime
          const agentId = runtime.agentId;
          const config = {
            agentId: agentId,
            apiBase: `http://localhost:3000`, // This could be configurable
          };

          // Replace the test config with the actual config
          htmlContent = htmlContent.replace(
            /window\.ELIZA_CONFIG = \{[^}]+\};/,
            `window.ELIZA_CONFIG = ${JSON.stringify(config)};`,
          );

          // Set headers to allow framing from ElizaOS dashboard
          res.setHeader("Content-Type", "text/html");
          res.setHeader("X-Frame-Options", "SAMEORIGIN");
          res.setHeader("Content-Security-Policy", "frame-ancestors 'self' http://localhost:* https://localhost:*");
          res.send(htmlContent);
        } else {
          res.status(404).send("Connections HTML file not found");
        }
      },
    },
    {
      type: "GET",
      path: "/panels/connections/assets/*",
      public: true,
      handler: async (req: any, res: any, _runtime: IAgentRuntime) => {
        const fullPath = req.path;
        const assetRelativePath = fullPath.replace(/^\/api\/panels\/connections\/assets\//, "").replace(/^\/panels\/connections\/assets\//, "");
        console.log("*** Connections assets - fullPath:", fullPath);
        console.log("*** Connections assets - assetRelativePath:", assetRelativePath);
        if (!assetRelativePath) {
          return res.status(400).send("Invalid asset path");
        }

        const filePath = path.resolve(assetsPath, assetRelativePath);

        console.log("*** Connections assets - filePath:", filePath);
        if (!filePath.startsWith(assetsPath)) {
          return res.status(403).send("Forbidden");
        }

        if (fs.existsSync(filePath)) {
          // Set headers to allow assets to be loaded in frames
          res.setHeader("X-Frame-Options", "SAMEORIGIN");
          res.setHeader("Content-Security-Policy", "frame-ancestors 'self' http://localhost:* https://localhost:*");
          res.sendFile(filePath);
        } else {
          res.status(404).send("Asset not found");
        }
      },
    },
    {
      type: "GET", 
      path: "/assets/*",
      public: true,
      handler: async (req: any, res: any, _runtime: IAgentRuntime) => {
        const fullPath = req.path;
        const assetRelativePath = fullPath.replace(/^\/api\/assets\//, "").replace(/^\/assets\//, "");
        console.log("*** Direct assets - fullPath:", fullPath);
        console.log("*** Direct assets - assetRelativePath:", assetRelativePath);
        if (!assetRelativePath) {
          return res.status(400).send("Invalid asset path");
        }

        const filePath = path.resolve(assetsPath, assetRelativePath);

        console.log("*** Direct assets - filePath:", filePath);
        if (!filePath.startsWith(assetsPath)) {
          return res.status(403).send("Forbidden");
        }

        if (fs.existsSync(filePath)) {
          // Set headers to allow assets to be loaded in frames
          res.setHeader("X-Frame-Options", "SAMEORIGIN");
          res.setHeader("Content-Security-Policy", "frame-ancestors 'self' http://localhost:* https://localhost:*");
          res.sendFile(filePath);
        } else {
          res.status(404).send("Asset not found");
        }
      },
    },
    // All connection and authentication routes
    ...routes.map((route) => ({
      ...route,
      handler: async (req: any, res: any, runtime: IAgentRuntime) => {
        req.runtime = runtime;
        return route.handler(req, res);
      },
    })),
  ],
  services: [DatabaseService, AuthService],
};

export default plugin;