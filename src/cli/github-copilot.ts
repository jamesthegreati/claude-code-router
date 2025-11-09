/**
 * GitHub Copilot CLI Authentication Command
 * 
 * Provides an interactive device code flow for authenticating with GitHub Copilot.
 */

import { 
  requestDeviceCode, 
  pollForAuthorization,
  verifyGitHubCopilotAccess,
  type GitHubCopilotAuthConfig 
} from '../providers/github-copilot-auth';
import { 
  createGitHubCopilotProvider,
  updateProviderAuth 
} from '../providers/github-copilot-provider';
import { readConfigFile, writeConfigFile, backupConfigFile } from '../utils';
import * as readline from 'readline';

// ANSI color codes
const RESET = "\x1B[0m";
const BOLD = "\x1B[1m";
const DIM = "\x1B[2m";
const GREEN = "\x1B[32m";
const YELLOW = "\x1B[33m";
const CYAN = "\x1B[36m";
const BOLDGREEN = "\x1B[1m\x1B[32m";
const BOLDCYAN = "\x1B[1m\x1B[36m";
const BOLDYELLOW = "\x1B[1m\x1B[33m";

/**
 * Display the device code and verification URL to the user
 */
function displayDeviceCode(userCode: string, verificationUri: string): void {
  console.log(`\n${BOLDCYAN}════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLDCYAN}    GitHub Copilot Authentication${RESET}`);
  console.log(`${BOLDCYAN}════════════════════════════════════════════════${RESET}\n`);
  
  console.log(`${BOLD}Step 1:${RESET} Visit the following URL in your browser:\n`);
  console.log(`  ${CYAN}${verificationUri}${RESET}\n`);
  
  console.log(`${BOLD}Step 2:${RESET} Enter this code when prompted:\n`);
  console.log(`  ${BOLDYELLOW}${userCode}${RESET}\n`);
  
  console.log(`${DIM}Waiting for authorization...${RESET}\n`);
}

/**
 * Display progress messages during polling
 */
function displayProgress(message: string): void {
  console.log(`${DIM}${message}${RESET}`);
}

/**
 * Display success message
 */
function displaySuccess(): void {
  console.log(`\n${BOLDGREEN}✓ Successfully authenticated with GitHub Copilot!${RESET}\n`);
}

/**
 * Display error message
 */
function displayError(error: string): void {
  console.error(`\n${BOLDYELLOW}✗ Authentication failed:${RESET} ${error}\n`);
}

/**
 * Prompt user for input
 */
async function promptForInput(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Set default model from environment variable if provided
 */
async function setDefaultModelFromEnv(config: any): Promise<void> {
  const defaultModel = process.env.CCR_GITHUB_COPILOT_MODEL;
  
  if (defaultModel) {
    if (!config.Router) {
      config.Router = {};
    }
    config.Router.default = defaultModel;
    console.log(`${DIM}Set default model to ${CYAN}${defaultModel}${RESET}${DIM} from CCR_GITHUB_COPILOT_MODEL${RESET}`);
  }
}

/**
 * Authenticate using Personal Access Token (PAT)
 */
async function authenticateWithPAT(): Promise<void> {
  console.log(`\n${BOLDCYAN}════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLDCYAN}    GitHub Copilot Authentication (PAT)${RESET}`);
  console.log(`${BOLDCYAN}════════════════════════════════════════════════${RESET}\n`);
  
  console.log(`${BOLD}Personal Access Token (PAT) Authentication${RESET}\n`);
  console.log(`${DIM}To use GitHub Copilot, you need a GitHub Personal Access Token with the following scopes:${RESET}`);
  console.log(`  ${CYAN}• copilot${RESET}`);
  console.log(`  ${CYAN}• read:user${RESET}\n`);
  
  console.log(`${BOLD}To create a PAT:${RESET}`);
  console.log(`  ${DIM}1. Visit: ${CYAN}https://github.com/settings/tokens/new${RESET}`);
  console.log(`  ${DIM}2. Select scopes: ${CYAN}copilot, read:user${RESET}`);
  console.log(`  ${DIM}3. Generate and copy the token${RESET}\n`);
  
  // Check for non-interactive mode
  const nonInteractive = process.env.NON_INTERACTIVE_MODE === 'true';
  const envToken = process.env.CCR_GITHUB_COPILOT_PAT;
  
  let token: string;
  
  if (nonInteractive) {
    if (!envToken) {
      throw new Error('CCR_GITHUB_COPILOT_PAT environment variable is required in non-interactive mode');
    }
    token = envToken;
    console.log(`${DIM}Using token from CCR_GITHUB_COPILOT_PAT environment variable${RESET}`);
  } else {
    token = await promptForInput(`${BOLD}Enter your GitHub Personal Access Token:${RESET} `);
    
    if (!token) {
      throw new Error('Personal Access Token is required');
    }
  }
  
  // Verify token has GitHub Copilot access
  console.log(`\n${CYAN}Verifying GitHub Copilot access...${RESET}`);
  const hasAccess = await verifyGitHubCopilotAccess(token);
  
  if (!hasAccess) {
    throw new Error('The provided token does not have access to GitHub Copilot or is invalid. Please ensure you have an active GitHub Copilot subscription and the token has the required scopes.');
  }
  
  // Create auth config for PAT
  const authConfig: GitHubCopilotAuthConfig = {
    type: 'pat',
    access_token: token,
  };
  
  // Read existing config
  const config = await readConfigFile();
  
  // Backup existing config
  const backupPath = await backupConfigFile();
  if (backupPath) {
    console.log(`${DIM}Backed up existing configuration to ${backupPath}${RESET}`);
  }
  
  // Update config with GitHub Copilot provider
  updateProviderAuth(config, authConfig);
  
  // Set default model from environment variable if provided
  await setDefaultModelFromEnv(config);
  
  // Write updated config
  await writeConfigFile(config);
  
  // Display success
  displaySuccess();
  
  console.log(`${GREEN}GitHub Copilot has been configured successfully with PAT!${RESET}`);
  console.log(`${YELLOW}⚠️  Note: Token is stored in plain text. Keep your config file secure.${RESET}`);
  console.log(`${DIM}You can now use GitHub Copilot models with Claude Code Router.${RESET}\n`);
  
  console.log(`${BOLD}Available models:${RESET}`);
  const provider = createGitHubCopilotProvider(authConfig);
  provider.models.forEach(model => {
    console.log(`  ${CYAN}•${RESET} ${model}`);
  });
  
  console.log(`\n${BOLD}Next step:${RESET}`);
  console.log(`  ${DIM}Set default model:${RESET}`);
  console.log(`    ${CYAN}ccr model${RESET}\n`);
}

/**
 * Run the GitHub Copilot authentication flow
 */
export async function authenticateGitHubCopilot(): Promise<void> {
  try {
    console.clear();
    
    // Check for CLIENT_ID from environment or config
    const clientId = process.env.CCR_GITHUB_CLIENT_ID;
    
    // If no client ID, fall back to PAT authentication
    if (!clientId) {
      console.log(`${DIM}No OAuth client ID found. Falling back to Personal Access Token (PAT) authentication.${RESET}\n`);
      await authenticateWithPAT();
      return;
    }
    
    // Step 1: Request device code
    console.log(`${CYAN}Requesting device code from GitHub...${RESET}`);
    const deviceCodeResponse = await requestDeviceCode(clientId);
    
    // Step 2: Display device code to user
    displayDeviceCode(deviceCodeResponse.user_code, deviceCodeResponse.verification_uri);
    
    // Step 3: Poll for authorization
    const tokenResponse = await pollForAuthorization(
      deviceCodeResponse.device_code,
      deviceCodeResponse.interval,
      clientId,
      displayProgress
    );
    
    // Step 4: Verify GitHub Copilot access
    console.log(`${CYAN}Verifying GitHub Copilot access...${RESET}`);
    const hasAccess = await verifyGitHubCopilotAccess(tokenResponse.access_token);
    
    if (!hasAccess) {
      displayError('The authenticated GitHub account does not have access to GitHub Copilot. Please ensure you have an active GitHub Copilot subscription.');
      process.exit(1);
    }
    
    // Step 5: Save authentication to config
    const authConfig: GitHubCopilotAuthConfig = {
      type: 'oauth',
      client_id: clientId,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: Date.now() + (tokenResponse.expires_in * 1000),
      token_type: tokenResponse.token_type,
    };
    
    // Read existing config
    const config = await readConfigFile();
    
    // Backup existing config
    const backupPath = await backupConfigFile();
    if (backupPath) {
      console.log(`${DIM}Backed up existing configuration to ${backupPath}${RESET}`);
    }
    
    // Update config with GitHub Copilot provider
    updateProviderAuth(config, authConfig);
    
    // Set default model from environment variable if provided
    await setDefaultModelFromEnv(config);
    
    // Write updated config
    await writeConfigFile(config);
    
    // Display success
    displaySuccess();
    
    console.log(`${GREEN}GitHub Copilot has been configured successfully!${RESET}`);
    console.log(`${DIM}You can now use GitHub Copilot models with Claude Code Router.${RESET}\n`);
    
    console.log(`${BOLD}Available models:${RESET}`);
    const provider = createGitHubCopilotProvider(authConfig);
    provider.models.forEach(model => {
      console.log(`  ${CYAN}•${RESET} ${model}`);
    });
    
    console.log(`\n${BOLD}Next step:${RESET}`);
    console.log(`  ${DIM}Set default model:${RESET}`);
    console.log(`    ${CYAN}ccr model${RESET}\n`);
    
  } catch (error: any) {
    displayError(error.message);
    process.exit(1);
  }
}

/**
 * Export the CLI command handler
 */
export async function runGitHubCopilotAuth(): Promise<void> {
  await authenticateGitHubCopilot();
}

/**
 * List stored authentication entries
 */
export async function listAuthEntries(): Promise<void> {
  try {
    const config = await readConfigFile();
    
    console.log(`\n${BOLDCYAN}════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLDCYAN}    Stored Authentication Entries${RESET}`);
    console.log(`${BOLDCYAN}════════════════════════════════════════════════${RESET}\n`);
    
    if (!config.Providers || config.Providers.length === 0) {
      console.log(`${DIM}No authentication entries found.${RESET}\n`);
      console.log(`${BOLD}To add authentication:${RESET}`);
      console.log(`  ${CYAN}ccr auth github-copilot${RESET}\n`);
      return;
    }
    
    // Find authenticated providers
    const authenticatedProviders = config.Providers.filter((p: any) => p.auth);
    
    if (authenticatedProviders.length === 0) {
      console.log(`${DIM}No authenticated providers found.${RESET}\n`);
      console.log(`${BOLD}To add authentication:${RESET}`);
      console.log(`  ${CYAN}ccr auth github-copilot${RESET}\n`);
      return;
    }
    
    authenticatedProviders.forEach((provider: any, index: number) => {
      const authType = provider.auth.type || 'oauth';
      const isExpired = provider.auth.expires_at && Date.now() >= provider.auth.expires_at;
      
      console.log(`${BOLD}${index + 1}. ${provider.name || 'Unknown Provider'}${RESET}`);
      console.log(`   ${DIM}Type:${RESET} ${authType.toUpperCase()}`);
      
      if (authType === 'oauth') {
        const expiryDate = provider.auth.expires_at 
          ? new Date(provider.auth.expires_at).toLocaleString()
          : 'Unknown';
        console.log(`   ${DIM}Status:${RESET} ${isExpired ? YELLOW + '⚠ Expired' + RESET : GREEN + '✓ Valid' + RESET}`);
        console.log(`   ${DIM}Expires:${RESET} ${expiryDate}`);
        console.log(`   ${DIM}Has Refresh Token:${RESET} ${provider.auth.refresh_token ? 'Yes' : 'No'}`);
      } else if (authType === 'pat') {
        console.log(`   ${DIM}Status:${RESET} ${GREEN}✓ Valid${RESET}`);
        console.log(`   ${DIM}Token:${RESET} ${provider.auth.access_token?.substring(0, 8)}...`);
      }
      
      if (provider.models && provider.models.length > 0) {
        console.log(`   ${DIM}Models:${RESET} ${provider.models.slice(0, 3).join(', ')}${provider.models.length > 3 ? ` (+${provider.models.length - 3} more)` : ''}`);
      }
      
      console.log('');
    });
    
    console.log(`${BOLD}To re-authenticate:${RESET}`);
    console.log(`  ${CYAN}ccr auth github-copilot${RESET}\n`);
    
  } catch (error: any) {
    displayError(error.message);
    process.exit(1);
  }
}
