#!/bin/bash

# Cloud Mac Provisioning Script
# Usage: ./setup-mac.sh
# This script installs all dependencies required to run the Stora Cloud Runner on a fresh macOS instance.

set -e

echo "🚀 Starting Stora Cloud Runner Provisioning..."

# 1. Install Homebrew (if not missing)
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    echo "✅ Homebrew already installed"
fi

# 2. Install Node.js (via nvm or brew)
echo "📦 Installing Node.js..."
brew install node

# 3. Install Maestro
echo "📦 Installing Maestro..."
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"

# 4. Install FFmpeg (Required for video processing sometimes)
brew install ffmpeg

# 5. Install PM2 (Process Manager to keep runner alive)
echo "📦 Installing PM2..."
npm install -g pm2 typescript ts-node pnpm

# 6. Verify Xcode (Assumes Xcode is already installed on Mac EC2 images)
echo "Checking Xcode..."
xcode-select -p || echo "⚠️ Xcode CLI tools missing! Run 'xcode-select --install'"

# 7. Setup Runner
echo "📂 Setting up Runner..."
# Assuming repo is cloned to ~/stora
cd ~/stora/apps/runner
pnpm install
pnpm build

echo "✅ Provisioning Complete!"
echo "--------------------------------"
echo "Next Steps:"
echo "1. Create .env file with API_URL and BLOB_TOKEN"
echo "2. Start the runner: pm2 start dist/index.js --name 'stora-runner'"
echo "3. Save PM2 list: pm2 save"
