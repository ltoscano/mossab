#!/usr/bin/env node

/**
 * Mossab CLI - Cross-platform entry point
 * Works on Linux, macOS, and Windows
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function showHelp() {
  console.log(`
${colors.bright}Mossab - Your AI Developer${colors.reset}

${colors.cyan}Usage:${colors.reset}
  mossab [workspace-path] [options]

${colors.cyan}Arguments:${colors.reset}
  workspace-path    Path to your project workspace (default: current directory)

${colors.cyan}Options:${colors.reset}
  -h, --help        Show this help message
  -v, --version     Show version
  -p, --port PORT   Specify server port (default: 3000)
  --no-open         Don't open browser automatically

${colors.cyan}Examples:${colors.reset}
  mossab                          # Use current directory
  mossab /path/to/project         # Use specific directory
  mossab . --port 8080            # Custom port
  mossab ~/my-app --no-open       # Don't open browser

${colors.cyan}Environment Variables:${colors.reset}
  ANTHROPIC_API_KEY    Your Anthropic API key (required)
  MOSSAB_PORT          Server port (default: 3000)
`);
}

function showVersion() {
  const packageJson = require('../package.json');
  console.log(`Mossab v${packageJson.version}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let workspaceArg = null;
let port = process.env.MOSSAB_PORT || process.env.PORT || 3000;
let shouldOpenBrowser = true;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '-h' || arg === '--help') {
    showHelp();
    process.exit(0);
  } else if (arg === '-v' || arg === '--version') {
    showVersion();
    process.exit(0);
  } else if (arg === '-p' || arg === '--port') {
    port = args[++i];
    if (!port || isNaN(port)) {
      log('❌', 'Invalid port number', colors.red);
      process.exit(1);
    }
  } else if (arg === '--no-open') {
    shouldOpenBrowser = false;
  } else if (!arg.startsWith('-') && !workspaceArg) {
    workspaceArg = arg;
  } else {
    log('❌', `Unknown argument: ${arg}`, colors.red);
    showHelp();
    process.exit(1);
  }
}

// Resolve workspace path
const workspace = workspaceArg
  ? path.resolve(workspaceArg)
  : process.cwd();

// Validate workspace exists
if (!fs.existsSync(workspace)) {
  log('❌', `Workspace directory does not exist: ${workspace}`, colors.red);
  process.exit(1);
}

// Check if it's a directory
const stats = fs.statSync(workspace);
if (!stats.isDirectory()) {
  log('❌', `Workspace path is not a directory: ${workspace}`, colors.red);
  process.exit(1);
}

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  log('⚠️', 'ANTHROPIC_API_KEY environment variable not set', colors.yellow);
  log('📝', 'Mossab will run with limited capabilities', colors.yellow);
  log('💡', 'Set your API key: export ANTHROPIC_API_KEY=your-key-here', colors.cyan);
  console.log('');
}

// Print startup info
console.log('');
log('🚀', `${colors.bright}Starting Mossab...${colors.reset}`, colors.green);
log('📁', `Workspace: ${workspace}`, colors.blue);
log('🌐', `Server: http://localhost:${port}`, colors.blue);
console.log('');

// Set environment variables
const serverEnv = {
  ...process.env,
  MOSSAB_WORKSPACE: workspace,
  PORT: port
};

// Start server
const serverPath = path.join(__dirname, '../server/index.js');
const server = spawn('node', [serverPath], {
  env: serverEnv,
  stdio: 'inherit',
  // Ensure the process doesn't detach on Windows
  detached: false
});

// Open browser after server starts
if (shouldOpenBrowser) {
  setTimeout(() => {
    const url = `http://localhost:${port}`;

    // Cross-platform browser opening
    const openCommand = process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';

    const openProcess = spawn(openCommand, [url], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32' // Windows needs shell for 'start'
    });

    openProcess.unref(); // Allow parent to exit independently

    log('🌐', `Opening browser at ${url}`, colors.cyan);
  }, 2000);
}

// Handle graceful shutdown
function cleanup() {
  console.log('');
  log('👋', 'Shutting down Mossab...', colors.yellow);
  server.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Handle server exit
server.on('close', (code) => {
  if (code !== 0 && code !== null) {
    log('❌', `Server exited with code ${code}`, colors.red);
    process.exit(code);
  }
  process.exit(0);
});

server.on('error', (error) => {
  log('❌', `Failed to start server: ${error.message}`, colors.red);
  process.exit(1);
});
