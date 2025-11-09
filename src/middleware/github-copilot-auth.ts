/**
 * GitHub Copilot Authentication Middleware
 * 
 * Handles OAuth token refresh and injection for GitHub Copilot provider
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { getValidAccessToken } from "../providers/github-copilot-auth";
import { isGitHubCopilotProvider } from "../providers/github-copilot-provider";
import { writeConfigFile } from "../utils";

/**
 * Middleware to handle GitHub Copilot OAuth authentication
 * Injects a valid access token into the provider config before requests
 */
export const githubCopilotAuth = (config: any) => {
  return async (req: FastifyRequest, reply: FastifyReply, done: () => void) => {
    // Skip if not a messages endpoint
    if (!req.url.startsWith("/v1/messages")) {
      return done();
    }

    try {
      // Find GitHub Copilot provider
      const copilotProvider = config.Providers?.find(isGitHubCopilotProvider);
      
      if (!copilotProvider || !copilotProvider.auth) {
        // No GitHub Copilot provider or no auth config, skip
        return done();
      }

      // Check if the request is using GitHub Copilot provider
      const requestBody = req.body as any;
      const modelString = requestBody?.model || "";
      
      // Check if the model is routed to GitHub Copilot
      const isUsingCopilot = 
        modelString.includes("github-copilot") ||
        copilotProvider.models?.some((m: string) => modelString.includes(m));

      if (!isUsingCopilot) {
        // Not using GitHub Copilot, skip
        return done();
      }

      // Get a valid access token (refresh if needed)
      const accessToken = await getValidAccessToken(copilotProvider.auth);
      
      // Inject the access token as api_key
      copilotProvider.api_key = accessToken;

      // If token was refreshed, update the config file
      if (copilotProvider.auth.access_token !== accessToken) {
        try {
          await writeConfigFile(config);
        } catch (error) {
          req.log?.error("Failed to update config with refreshed token:", error);
        }
      }

      done();
    } catch (error: any) {
      req.log?.error("GitHub Copilot authentication error:", error);
      reply.status(401).send({
        error: "GitHub Copilot authentication failed",
        message: error.message,
      });
    }
  };
};
