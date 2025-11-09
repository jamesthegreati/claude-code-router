/**
 * GitHub Copilot OAuth2 Device Code Flow Authentication
 * 
 * Handles authentication with GitHub Copilot using OAuth2 device code flow.
 * Supports token refresh and secure storage in configuration.
 */

export interface GitHubCopilotAuthConfig {
  type?: 'oauth' | 'pat';
  client_id?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // GitHub Copilot public client ID

/**
 * Request a device code from GitHub
 */
export async function requestDeviceCode(clientId?: string): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId || GITHUB_COPILOT_CLIENT_ID,
      scope: 'read:user',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Poll GitHub for authorization completion
 */
export async function pollForAuthorization(
  deviceCode: string,
  interval: number,
  clientId?: string,
  onProgress?: (message: string) => void
): Promise<AccessTokenResponse> {
  const startTime = Date.now();
  const timeout = 15 * 60 * 1000; // 15 minutes

  while (Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    try {
      const response = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId || GITHUB_COPILOT_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.error) {
        if (data.error === 'authorization_pending') {
          onProgress?.('Waiting for authorization...');
          continue;
        } else if (data.error === 'slow_down') {
          onProgress?.('Slowing down polling...');
          interval += 5;
          continue;
        } else if (data.error === 'expired_token') {
          throw new Error('Device code expired. Please try again.');
        } else if (data.error === 'access_denied') {
          throw new Error('Authorization was denied.');
        } else {
          throw new Error(`Authorization error: ${data.error_description || data.error}`);
        }
      }

      if (data.access_token) {
        return data;
      }
    } catch (error: any) {
      if (error.message.includes('Authorization') || error.message.includes('expired')) {
        throw error;
      }
      // Continue polling on network errors
      onProgress?.(`Error during polling: ${error.message}`);
    }
  }

  throw new Error('Authorization timeout. Please try again.');
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId?: string
): Promise<AccessTokenResponse> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId || GITHUB_COPILOT_CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Token refresh error: ${data.error_description || data.error}`);
  }

  return data;
}

/**
 * Check if the access token is expired or about to expire
 */
export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) {
    return true;
  }

  // Consider token expired if it expires within the next 5 minutes
  const bufferTime = 5 * 60 * 1000;
  return Date.now() >= (expiresAt - bufferTime);
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(
  authConfig: GitHubCopilotAuthConfig
): Promise<string> {
  if (!authConfig.access_token) {
    throw new Error('No access token available. Please authenticate first.');
  }

  // PAT tokens don't expire, return immediately
  if (authConfig.type === 'pat') {
    return authConfig.access_token;
  }

  // For OAuth tokens, check expiry
  if (!isTokenExpired(authConfig.expires_at)) {
    return authConfig.access_token;
  }

  if (!authConfig.refresh_token) {
    throw new Error('Access token expired and no refresh token available. Please re-authenticate.');
  }

  // Refresh the token
  const tokenResponse = await refreshAccessToken(
    authConfig.refresh_token,
    authConfig.client_id
  );

  // Update the auth config (caller should save this)
  authConfig.access_token = tokenResponse.access_token;
  authConfig.refresh_token = tokenResponse.refresh_token;
  authConfig.expires_at = Date.now() + (tokenResponse.expires_in * 1000);
  authConfig.token_type = tokenResponse.token_type;

  return tokenResponse.access_token;
}

/**
 * Verify GitHub Copilot access with the given token
 */
export async function verifyGitHubCopilotAccess(accessToken: string): Promise<boolean> {
  try {
    // Try to access the GitHub Copilot API to verify access
    const response = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
        model: 'gpt-4o',
        max_tokens: 1,
      }),
    });

    // If we get 401, the token is invalid or doesn't have Copilot access
    // If we get 400 or other errors, the token is valid but the request format might be wrong
    return response.status !== 401 && response.status !== 403;
  } catch (error) {
    console.error('Error verifying GitHub Copilot access:', error);
    return false;
  }
}
