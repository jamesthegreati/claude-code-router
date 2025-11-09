/**
 * GitHub Copilot Provider Configuration
 * 
 * Handles API requests to GitHub Copilot and transforms requests/responses
 * to match Claude API format.
 */

import { getValidAccessToken, type GitHubCopilotAuthConfig } from './github-copilot-auth';

export interface GitHubCopilotProviderConfig {
  name: string;
  api_base_url?: string;
  auth?: GitHubCopilotAuthConfig;
  models: string[];
  transformer?: {
    use: string[];
  };
}

const GITHUB_COPILOT_API_BASE = 'https://api.githubcopilot.com';
const GITHUB_COPILOT_COMPLETIONS_ENDPOINT = '/chat/completions';

/**
 * Available GitHub Copilot models
 */
export const GITHUB_COPILOT_MODELS = [
  'claude-sonnet-4',
  'claude-haiku-4',
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o1-mini',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
];

/**
 * Create a GitHub Copilot provider configuration
 */
export function createGitHubCopilotProvider(
  authConfig: GitHubCopilotAuthConfig
): GitHubCopilotProviderConfig {
  return {
    name: 'github-copilot',
    api_base_url: `${GITHUB_COPILOT_API_BASE}${GITHUB_COPILOT_COMPLETIONS_ENDPOINT}`,
    auth: authConfig,
    models: GITHUB_COPILOT_MODELS,
    transformer: {
      use: ['anthropic'], // Use anthropic transformer for compatibility
    },
  };
}

/**
 * Get the Authorization header value for GitHub Copilot API
 */
export async function getAuthHeader(
  providerConfig: GitHubCopilotProviderConfig,
  updateConfig?: (config: GitHubCopilotProviderConfig) => void
): Promise<string> {
  if (!providerConfig.auth) {
    throw new Error('GitHub Copilot provider is not authenticated');
  }

  const accessToken = await getValidAccessToken(providerConfig.auth);

  // If the token was refreshed, update the config
  if (updateConfig) {
    updateConfig(providerConfig);
  }

  return `Bearer ${accessToken}`;
}

/**
 * Transform GitHub Copilot model name to internal format
 */
export function normalizeModelName(model: string): string {
  // GitHub Copilot uses model names directly
  // Map Claude model names to GitHub Copilot format if needed
  const modelMappings: Record<string, string> = {
    'claude-sonnet-4': 'claude-sonnet-4',
    'claude-3.5-sonnet': 'gpt-4o', // Fallback mapping
    'claude-haiku-4': 'claude-haiku-4',
    'claude-3-haiku': 'claude-haiku-4', // Fallback mapping
  };

  return modelMappings[model] || model;
}

/**
 * Check if a provider is a GitHub Copilot provider
 */
export function isGitHubCopilotProvider(provider: any): boolean {
  if (provider.name === 'github-copilot') {
    return true;
  }
  
  // Validate that the URL is actually a GitHub Copilot API URL
  if (provider.api_base_url) {
    try {
      const url = new URL(provider.api_base_url);
      // Check that the hostname is exactly api.githubcopilot.com
      return url.hostname === 'api.githubcopilot.com';
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Update GitHub Copilot provider authentication in config
 */
export function updateProviderAuth(
  config: any,
  authConfig: GitHubCopilotAuthConfig
): void {
  const copilotProvider = config.Providers?.find(isGitHubCopilotProvider);
  
  if (copilotProvider) {
    copilotProvider.auth = authConfig;
  } else {
    // Create new provider if it doesn't exist
    if (!config.Providers) {
      config.Providers = [];
    }
    
    config.Providers.push(createGitHubCopilotProvider(authConfig));
  }
}
