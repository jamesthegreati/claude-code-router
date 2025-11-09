#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CONFIG_DIR="$HOME/.claude-code-router"
CONFIG_FILE="$CONFIG_DIR/config.json"
DEFAULT_PORT=3456

echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${CYAN}    Claude Code Router Quickstart${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -ge 18 ]; then
        return 0
    else
        return 1
    fi
}

# Check for runtime (prefer Bun if available, otherwise Node.js >= 18)
echo -e "${BLUE}Checking for runtime...${NC}"
RUNTIME=""
RUNTIME_CMD=""

if command_exists bun; then
    # Check if bunx is in ~/.bun/bin
    if [ -x "$HOME/.bun/bin/bunx" ]; then
        RUNTIME="bun"
        RUNTIME_CMD="$HOME/.bun/bin/bunx"
        echo -e "${GREEN}✓ Found Bun at $RUNTIME_CMD${NC}"
    elif command_exists bunx; then
        RUNTIME="bun"
        RUNTIME_CMD="bunx"
        echo -e "${GREEN}✓ Found Bun (bunx in PATH)${NC}"
    fi
elif command_exists node; then
    if check_node_version; then
        RUNTIME="node"
        RUNTIME_CMD="npx"
        echo -e "${GREEN}✓ Found Node.js >= 18${NC}"
    else
        echo -e "${RED}✗ Node.js version is too old (need >= 18)${NC}"
        echo -e "${YELLOW}Please upgrade Node.js or install Bun: https://bun.sh${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Neither Bun nor Node.js >= 18 found${NC}"
    echo -e "${YELLOW}Please install Node.js >= 18 or Bun${NC}"
    echo -e "  Node.js: https://nodejs.org"
    echo -e "  Bun: https://bun.sh"
    exit 1
fi

# Create config directory if it doesn't exist
if [ ! -d "$CONFIG_DIR" ]; then
    echo -e "${BLUE}Creating config directory at $CONFIG_DIR...${NC}"
    mkdir -p "$CONFIG_DIR"
    echo -e "${GREEN}✓ Config directory created${NC}"
fi

# Create or update config.json
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}Creating default config file...${NC}"
    cat > "$CONFIG_FILE" << 'EOF'
{
  "PORT": 3456,
  "LOG": true,
  "LOG_LEVEL": "debug",
  "NON_INTERACTIVE_MODE": false,
  "Providers": [],
  "Router": {
    "default": "",
    "background": "",
    "think": "",
    "longContext": "",
    "longContextThreshold": 60000,
    "webSearch": ""
  }
}
EOF
    echo -e "${GREEN}✓ Default config created at $CONFIG_FILE${NC}"
else
    echo -e "${YELLOW}Config file already exists at $CONFIG_FILE${NC}"
    
    # Check if config has Providers and Router sections, add if missing
    if ! grep -q '"Providers"' "$CONFIG_FILE"; then
        echo -e "${BLUE}Adding Providers section to config...${NC}"
        # Use a temporary file for safe JSON manipulation
        TEMP_FILE=$(mktemp)
        cat "$CONFIG_FILE" | jq '. + {"Providers": []}' > "$TEMP_FILE" 2>/dev/null && mv "$TEMP_FILE" "$CONFIG_FILE" || {
            # If jq is not available, skip JSON manipulation
            echo -e "${YELLOW}⚠ jq not found, skipping Providers section update${NC}"
            echo -e "${YELLOW}Please manually add Providers section to $CONFIG_FILE${NC}"
        }
    fi
    
    if ! grep -q '"Router"' "$CONFIG_FILE"; then
        echo -e "${BLUE}Adding Router section to config...${NC}"
        # Use a temporary file for safe JSON manipulation
        TEMP_FILE=$(mktemp)
        cat "$CONFIG_FILE" | jq '. + {"Router": {"default": "", "background": "", "think": "", "longContext": "", "longContextThreshold": 60000, "webSearch": ""}}' > "$TEMP_FILE" 2>/dev/null && mv "$TEMP_FILE" "$CONFIG_FILE" || {
            # If jq is not available, skip JSON manipulation
            echo -e "${YELLOW}⚠ jq not found, skipping Router section update${NC}"
            echo -e "${YELLOW}Please manually add Router section to $CONFIG_FILE${NC}"
        }
    fi
fi

echo ""
echo -e "${BLUE}Starting Claude Code Router...${NC}"

# Determine if we're using an installed ccr or npx
CCR_CMD=""
if command_exists ccr; then
    # ccr is installed globally or in PATH
    CCR_CMD="ccr"
    echo -e "${GREEN}✓ Using installed ccr command${NC}"
else
    # Use npx or bunx to run from GitHub
    if [ "$RUNTIME" = "bun" ]; then
        CCR_CMD="$RUNTIME_CMD @musistudio/claude-code-router"
    else
        CCR_CMD="$RUNTIME_CMD -y @musistudio/claude-code-router"
    fi
    echo -e "${GREEN}✓ Using $RUNTIME_CMD to run ccr${NC}"
fi

# Start the router
echo -e "${BLUE}Executing: $CCR_CMD start${NC}"
$CCR_CMD start &

# Wait a moment for the server to start
sleep 3

# Check if server is running
if curl -s "http://localhost:$DEFAULT_PORT/health" >/dev/null 2>&1 || \
   curl -s "http://localhost:$DEFAULT_PORT/" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Claude Code Router is running on http://localhost:$DEFAULT_PORT${NC}"
else
    echo -e "${YELLOW}⚠ Server may still be starting up. Check status with: $CCR_CMD status${NC}"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${CYAN}    Next Steps${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}1. Authenticate with GitHub Copilot:${NC}"
echo -e "   $CCR_CMD auth github-copilot"
echo ""
echo -e "${YELLOW}2. Select your model:${NC}"
echo -e "   $CCR_CMD model"
echo ""
echo -e "${YELLOW}3. Run Claude Code with the router:${NC}"
echo -e "   $CCR_CMD code"
echo ""
echo -e "${YELLOW}4. Open the web UI (optional):${NC}"
echo -e "   $CCR_CMD ui"
echo ""
echo -e "${BLUE}Other useful commands:${NC}"
echo -e "  $CCR_CMD status   - Check server status"
echo -e "  $CCR_CMD stop     - Stop the server"
echo -e "  $CCR_CMD restart  - Restart the server"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
echo ""
