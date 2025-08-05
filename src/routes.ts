import { logger, type UUID } from "@elizaos/core";
import type { AuthService } from "./services/auth.service.js";
import type { ServiceName, TwitterCredentials } from "./types/auth.types.js";
import { TwitterApi } from "twitter-api-v2";

import { updateAndRegisterPlugin } from "./utils/plugin-loader.js";

/**
 * Consolidated routes for connection management and Twitter authentication
 */
export const routes = [
  // Test route to verify routes are working
  {
    name: "connections-test",
    path: "/connections/test",
    type: "GET" as const,
    handler: async (req: any, res: any) => {
      logger.info("🧪 Test route called successfully!");
      res.json({ message: "Connections routes are working!", timestamp: new Date() });
    },
  },

  // Get all connection statuses
  {
    name: "connections-list",
    path: "/connections",
    type: "GET" as const,
    handler: async (req: any, res: any) => {
      try {
        const { agentId } = req.query;

        if (!agentId) {
          return res.status(400).json({ error: "Agent ID is required" });
        }

        // Get auth service from runtime
        const authService = req.runtime?.getService("auth") as AuthService;
        if (!authService) {
          return res.status(500).json({ error: "Auth service not available" });
        }

        // Get status for all supported services
        const supportedServices: ServiceName[] = ["twitter"]; // Add more as implemented

        const connections = await Promise.all(
          supportedServices.map(async (service) => {
            const status = await authService.getConnectionStatus(
              agentId,
              service,
            );
            return {
              service,
              ...status,
              // Add service-specific metadata
              displayName: service === "twitter" ? "Twitter/X" : service,
              icon: service === "twitter" ? "twitter" : service,
              color: service === "twitter" ? "#1DA1F2" : "#6B7280",
              description:
                service === "twitter"
                  ? "Connect to post tweets and interact with your audience"
                  : `Connect to ${service}`,
            };
          }),
        );

        res.json({
          agentId,
          connections,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Connections list failed:", error);
        res.status(500).json({
          error: "Failed to fetch connections",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },

  // Get Twitter connection status  
  {
    name: "twitter-status",
    path: "/connections/twitter/status",
    type: "GET" as const,
    handler: async (req: any, res: any) => {
      try {
        const { agentId } = req.query;

        if (!agentId) {
          return res.status(400).json({ error: "Agent ID is required" });
        }

        // Get auth service from runtime
        const authService = req.runtime?.getService("auth") as AuthService;
        if (!authService) {
          return res.status(500).json({ error: "Auth service not available" });
        }

        // Get connection status
        const status = await authService.getConnectionStatus(agentId, "twitter");

        res.json(status);
      } catch (error) {
        logger.error("Twitter status check failed:", error);
        res.status(500).json({
          error: "Failed to check Twitter status",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },

  // TWITTER AUTHENTICATION ROUTES

  // Initiate Twitter OAuth connection
  {
    name: "twitter-connect",
    path: "/connections/twitter/connect",
    type: "POST" as const,
    handler: async (req: any, res: any) => {
      try {
        const { agentId, returnUrl } = req.body;

        if (!agentId) {
          return res.status(400).json({ error: "Agent ID is required" });
        }

        logger.info(`Initiating Twitter OAuth for agent: ${agentId}`);

        // Get auth service from runtime
        const authService = req.runtime?.getService("auth") as AuthService;
        if (!authService) {
          return res.status(500).json({ error: "Auth service not available" });
        }

        // Get Twitter API credentials from environment
        const consumerKey = process.env.TWITTER_API_KEY;
        const consumerSecret = process.env.TWITTER_API_SECRET_KEY;

        if (!consumerKey || !consumerSecret) {
          return res.status(500).json({
            error:
              "Twitter API credentials not configured. Please set TWITTER_API_KEY and TWITTER_API_SECRET_KEY.",
          });
        }

        // Initialize Twitter API client for OAuth
        const twitterApi = new TwitterApi({
          appKey: consumerKey,
          appSecret: consumerSecret,
        });

        // Generate callback URL
        const callbackUrl = `${req.protocol}://${req.get("host")}/api/connections/twitter/callback`;

        // Get request token
        logger.info(`🔗 Attempting to generate Twitter auth link with callback: ${callbackUrl}`);
        logger.info(`🔑 Using API key: ${consumerKey?.substring(0, 8)}...`);
        
        let authLink;
        try {
          authLink = await twitterApi.generateAuthLink(callbackUrl, {
            linkMode: "authorize", // Use 'authorize' for web apps
          });
          logger.info(`✅ Twitter auth link generated successfully: ${authLink.url}`);
        } catch (twitterError) {
          logger.error(`❌ Twitter API error:`, {
            error: twitterError,
            message: twitterError instanceof Error ? twitterError.message : String(twitterError),
            callbackUrl,
            consumerKey: consumerKey?.substring(0, 8) + '...'
          });
          throw twitterError;
        }

        // Generate state for security
        // Generate state for security
        const state = authService.generateOAuthState();

        // Store OAuth session
        await authService.createOAuthSession(
          agentId,
          "twitter",
          state,
          returnUrl,
        );

        // Store temporary credentials using oauth_token as key
        authService.storeTempCredentials(authLink.oauth_token, {
          oauth_token_secret: authLink.oauth_token_secret,
          agentId,
          state,
          returnUrl,
        });

        res.json({
          authUrl: authLink.url,
        });
      } catch (error) {
        logger.error("Twitter OAuth initiation failed:", error);
        res.status(500).json({
          error: "Failed to initiate Twitter authentication",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },

  // Handle Twitter OAuth callback
  {
    name: "twitter-callback",
    path: "/connections/twitter/callback",
    type: "GET" as const,
    handler: async (req: any, res: any) => {
      try {
        const { oauth_token, oauth_verifier } = req.query;

        if (!oauth_token || !oauth_verifier) {
          return res.status(400).json({
            error: "Missing required OAuth parameters",
          });
        }

        // Get auth service from runtime
        const authService = req.runtime?.getService("auth") as AuthService;
        if (!authService) {
          return res.status(500).json({ error: "Auth service not available" });
        }

        // Retrieve temporary credentials using oauth_token as key
        const tempCredentials = authService.getTempCredentials(oauth_token);
        if (!tempCredentials) {
          return res.status(400).json({
            error: "Invalid or expired OAuth session",
          });
        }

        const { oauth_token_secret, agentId, state, returnUrl } = tempCredentials;

        // Get Twitter API credentials
        const consumerKey = process.env.TWITTER_API_KEY;
        const consumerSecret = process.env.TWITTER_API_SECRET_KEY;

        if (!consumerKey || !consumerSecret) {
          return res.status(500).json({
            error: "Twitter API credentials not configured",
          });
        }

        // Initialize Twitter API client with temporary credentials
        const twitterApi = new TwitterApi({
          appKey: consumerKey,
          appSecret: consumerSecret,
          accessToken: oauth_token,
          accessSecret: oauth_token_secret,
        });

        // Exchange for access token
        const { accessToken, accessSecret } =
          await twitterApi.login(oauth_verifier);

        // Get user information
        const userApi = new TwitterApi({
          appKey: consumerKey,
          appSecret: consumerSecret,
          accessToken,
          accessSecret,
        });

        const user = await userApi.v2.me();

        // Prepare credentials for storage
        const credentials: TwitterCredentials = {
          apiKey: consumerKey,
          apiSecretKey: consumerSecret,
          accessToken,
          accessTokenSecret: accessSecret,
          userId: user.data.id,
          username: user.data.username,
        };

        

        // Store the credentials in the database
        await authService.storeCredentials(agentId, "twitter", credentials);

        // Dynamically load the twitter plugin
        await updateAndRegisterPlugin(
          req.runtime,
          {
            TWITTER_ACCESS_TOKEN: credentials.accessToken,
            TWITTER_ACCESS_TOKEN_SECRET: credentials.accessTokenSecret,
          },
          "@elizaos/plugin-twitter",
        );

        // Clean up temporary credentials
        authService.deleteTempCredentials(oauth_token);

        // Redirect to the original returnUrl with success indicator
        const redirectUrl = new URL(`${req.protocol}://${req.get('host')}/chat/${agentId}`);
        redirectUrl.searchParams.set("oauth", "success");
        redirectUrl.searchParams.set("service", "twitter");
        res.redirect(redirectUrl.toString());
      } catch (error) {
        logger.error("Twitter OAuth callback failed:", error);
        res.status(500).json({
          error: "Failed to complete Twitter authentication",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },

  // Disconnect from Twitter
  {
    name: "twitter-disconnect",
    path: "/connections/twitter/disconnect",
    type: "POST" as const,
    handler: async (req: any, res: any) => {
      try {
        logger.info(`🔌 Twitter disconnect route called for URL: ${req.url}, Method: ${req.method}`);
        logger.info(`🔌 Request body:`, req.body);
        
        const { agentId } = req.body;

        if (!agentId) {
          return res.status(400).json({ error: "Agent ID is required" });
        }

        logger.info(`Processing Twitter disconnect for agent: ${agentId}`);

        // Get auth service from runtime
        const authService = req.runtime?.getService("auth") as AuthService;
        if (!authService) {
          return res.status(500).json({ error: "Auth service not available" });
        }

        // Revoke credentials
        await authService.revokeCredentials(agentId, "twitter");

        // Also remove from agent settings
        await req.runtime.updateAgent(agentId, {
          settings: {
            secrets: {
              TWITTER_ACCESS_TOKEN: null,
              TWITTER_ACCESS_TOKEN_SECRET: null,
            },
          },
        });
        
        // Stop the Twitter service if it's running
        const twitterService = req.runtime.getService("twitter");
        if (twitterService && typeof twitterService.stop === 'function') {
          logger.warn("⚠️  Stopping Twitter service after disconnect");
          await twitterService.stop();
        }

        res.json({
          success: true,
          service: "twitter",
          message: "Twitter connection disconnected successfully",
        });
      } catch (error) {
        logger.error("Twitter disconnect failed:", error);
        res.status(500).json({
          error: "Failed to disconnect Twitter",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },

  // Test Twitter connection
  {
    name: "twitter-test",
    path: "/connections/twitter/test",
    type: "POST" as const,
    handler: async (req: any, res: any) => {
      try {
        const { agentId } = req.body;

        if (!agentId) {
          return res.status(400).json({ error: "Agent ID is required" });
        }

        logger.info(`Testing Twitter connection for agent: ${agentId}`);

        // Get auth service from runtime
        const authService = req.runtime?.getService("auth") as AuthService;
        if (!authService) {
          return res.status(500).json({ error: "Auth service not available" });
        }

        // Get credentials
        const credentials = await authService.getCredentials(agentId, "twitter");

        if (!credentials) {
          return res.status(404).json({
            error: "No credentials found for Twitter",
          });
        }

        // Test Twitter connection
        const testResult = await testTwitterConnection(credentials);

        res.json({
          success: true,
          service: "twitter",
          test: testResult,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Twitter connection test failed:", error);
        res.status(500).json({
          error: "Failed to test Twitter connection",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },
];

/**
 * Test Twitter connection
 */
async function testTwitterConnection(credentials: any): Promise<any> {
  try {
    const { TwitterApi } = await import("twitter-api-v2");

    const client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecretKey,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
    });

    // Test with a simple API call
    const user = await client.v2.me();

    return {
      success: true,
      user: {
        id: user.data.id,
        username: user.data.username,
        name: user.data.name,
      },
      rateLimit: {
        remaining: (user as any).rateLimit?.remaining,
        reset: (user as any).rateLimit?.reset,
      },
    };
  } catch (error) {
    logger.error("Twitter connection test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}