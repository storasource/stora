#!/bin/bash

# Cloud Mac Provisioning Script
# Usage: ./setup-mac.sh
# This script installs all dependencies required to run the Stora Cloud Runner on a fresh macOS instance.

set -e

echo "🚀 Starting Stora Cloud Runner Provisioning..."

# 1. Install Homebrew (if not installed)
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Setup Homebrew in PATH for both Intel and Apple Silicon Macs
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew already installed"
fi

# 2. Install Java 17 (Required for Maestro)
if ! command -v java &> /dev/null || ! java -version 2>&1 | grep -q "version \"17"; then
    echo "📦 Installing Java 17..."
    brew install openjdk@17
    
    # Link Java 17 and set JAVA_HOME
    sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk || true
    
    # Add JAVA_HOME to shell profiles
    JAVA_HOME_LINE='export JAVA_HOME=$(/usr/libexec/java_home -v 17)'
    if ! grep -q "JAVA_HOME" ~/.zprofile 2>/dev/null; then
        echo "$JAVA_HOME_LINE" >> ~/.zprofile
    fi
    if ! grep -q "JAVA_HOME" ~/.bash_profile 2>/dev/null; then
        echo "$JAVA_HOME_LINE" >> ~/.bash_profile
    fi
    
    export JAVA_HOME=$(/usr/libexec/java_home -v 17)
    echo "✅ Java 17 installed: $JAVA_HOME"
else
    echo "✅ Java 17 already installed"
    export JAVA_HOME=$(/usr/libexec/java_home -v 17)
fi

# 3. Install Node.js (via Homebrew)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    brew install node
else
    echo "✅ Node.js already installed ($(node -v))"
fi

# 4. Install Maestro
if ! command -v maestro &> /dev/null; then
    echo "📦 Installing Maestro..."
    curl -Ls "https://get.maestro.mobile.dev" | bash
    
    # Add Maestro to PATH in shell profiles
    MAESTRO_PATH_LINE='export PATH="$PATH:$HOME/.maestro/bin"'
    if ! grep -q ".maestro/bin" ~/.zprofile 2>/dev/null; then
        echo "$MAESTRO_PATH_LINE" >> ~/.zprofile
    fi
    if ! grep -q ".maestro/bin" ~/.bash_profile 2>/dev/null; then
        echo "$MAESTRO_PATH_LINE" >> ~/.bash_profile
    fi
    
    export PATH="$PATH:$HOME/.maestro/bin"
    echo "✅ Maestro installed"
else
    echo "✅ Maestro already installed ($(maestro -v))"
fi

# 5. Install FFmpeg (Required for video processing)
if ! command -v ffmpeg &> /dev/null; then
    echo "📦 Installing FFmpeg..."
    brew install ffmpeg
else
    echo "✅ FFmpeg already installed"
fi

# 6. Install PM2 and global Node packages
echo "📦 Installing global Node packages..."
npm install -g pm2 typescript ts-node pnpm

# 7. Verify Xcode (Assumes Xcode is already installed on Mac EC2 images)
echo "🔍 Checking Xcode..."
if xcode-select -p &> /dev/null; then
    echo "✅ Xcode CLI tools installed"
else
    echo "⚠️  Xcode CLI tools missing! Installing..."
    xcode-select --install || echo "❌ Failed to install Xcode CLI tools. Please install manually."
fi

# 8. Setup Runner
echo "📂 Setting up Runner..."
# Assuming repo is cloned to ~/stora
RUNNER_DIR="${RUNNER_DIR:-$HOME/stora/apps/runner}"

if [ -d "$RUNNER_DIR" ]; then
    cd "$RUNNER_DIR"
    echo "📦 Installing dependencies..."
    pnpm install
    echo "🔨 Building runner..."
    pnpm build
    echo "✅ Runner built successfully"
else
    echo "⚠️  Runner directory not found at $RUNNER_DIR"
    echo "Please clone the repository first or set RUNNER_DIR environment variable"
fi

echo ""
echo "✅ Provisioning Complete!"
echo "================================"
echo "Environment Summary:"
echo "  - Homebrew: $(brew --version | head -n1)"
echo "  - Java: $(java -version 2>&1 | head -n1)"
echo "  - Node.js: $(node -v)"
echo "  - pnpm: $(pnpm -v)"
echo "  - Maestro: $(maestro -v 2>&1 || echo 'installed')"
echo "  - FFmpeg: $(ffmpeg -version | head -n1 | cut -d' ' -f3)"
echo "  - PM2: $(pm2 -v)"
echo ""
echo "Next Steps:"
echo "1. Create .env file in $RUNNER_DIR with:"
echo "   - API_URL=<your-api-url>"
echo "   - BLOB_TOKEN=<your-blob-token>"
echo "2. Start the runner: pm2 start dist/index.js --name 'stora-runner'"
echo "3. Save PM2 list: pm2 save"
echo "4. Setup PM2 startup: pm2 startup"
echo ""
echo "⚠️  IMPORTANT: Restart your terminal or run 'source ~/.zprofile' to load environment variables"
