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
 * Run the GitHub Copilot authentication flow
 */
export async function authenticateGitHubCopilot(): Promise<void> {
  try {
    console.clear();
    
    // Step 1: Request device code
    console.log(`${CYAN}Requesting device code from GitHub...${RESET}`);
    const deviceCodeResponse = await requestDeviceCode();
    
    // Step 2: Display device code to user
    displayDeviceCode(deviceCodeResponse.user_code, deviceCodeResponse.verification_uri);
    
    // Step 3: Poll for authorization
    const tokenResponse = await pollForAuthorization(
      deviceCodeResponse.device_code,
      deviceCodeResponse.interval,
      undefined,
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
    
    console.log(`\n${BOLD}Usage:${RESET}`);
    console.log(`  ${DIM}Set as default model:${RESET}`);
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
