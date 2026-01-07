# Stora

The intelligent mobile app deployment tool.

[![CI](https://github.com/storasource/stora/actions/workflows/ci.yml/badge.svg)](https://github.com/storasource/stora/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/stora-sh.svg)](https://www.npmjs.com/package/stora-sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **AI-Powered Screenshots** - Agentic exploration of your app to capture App Store-ready screenshots
- **Compliance Checking** - Validate your app against App Store and Play Store guidelines
- **AI Analysis** - Uses Google Gemini for intelligent automation
- **Cross-Platform** - Works with iOS and Android apps
- **Modular** - Use individual packages or the full CLI

## Quick Start

```bash
# Install globally
npm install -g stora-sh

# Capture screenshots (requires Maestro CLI and running simulator)
stora screenshots com.example.app --max-screenshots 10

# Check compliance
stora compliance ./my-app --platform ios

# Verify setup
stora doctor
```

## Requirements

- **Node.js 18+**
- **Maestro CLI** - [Install Maestro](https://maestro.mobile.dev/getting-started/installing-maestro)
- **Google AI API Key** - Set `GOOGLE_GENERATIVE_AI_API_KEY` environment variable
- **Running iOS Simulator or Android Emulator** with your app installed

## CLI Commands

### `stora screenshots <bundleId>`

Capture App Store-ready screenshots using AI-powered exploration.

```bash
stora screenshots com.example.app
stora screenshots com.example.app --max-screenshots 10 --output ./screenshots
stora screenshots com.example.app --max-steps 30 --model gemini-2.0-flash
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--max-steps <n>` | 50 | Maximum exploration steps |
| `--max-screenshots <n>` | 10 | Target number of screenshots |
| `--output <path>` | ./store-screenshots | Output directory |
| `--save-eval` | false | Save evaluation screenshots for debugging |
| `--model <model>` | gemini-2.0-flash | AI model to use |

### `stora compliance [path]`

Check your app for compliance issues before submission.

```bash
stora compliance ./my-app
stora compliance ./my-app --platform ios
stora compliance ./my-app --platform android --no-ai
stora compliance --strict
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `-p, --platform <platform>` | both | Target platform (ios, android, both) |
| `--no-ai` | false | Disable AI-powered analysis |
| `--strict` | false | Use strict checking mode |

### `stora doctor`

Check if all dependencies are installed correctly.

```bash
stora doctor
```

## Packages

Use the CLI for the full experience, or install individual packages for programmatic use:

| Package | Description | Install |
|---------|-------------|---------|
| [`stora-sh`](./apps/cli) | Main CLI tool | `npm i -g stora-sh` |
| [`@stora/screenshots`](./packages/screenshots) | AI screenshot automation | `npm i @stora/screenshots` |
| [`@stora/compliance`](./packages/compliance) | Compliance checking | `npm i @stora/compliance` |
| [`@stora/shared`](./packages/shared) | Shared utilities | `npm i @stora/shared` |

## Environment Variables

```bash
# Required for AI features
export GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
```

## Development

```bash
# Clone the repo
git clone https://github.com/storasource/stora.git
cd stora

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode
pnpm dev
```

## Project Structure

```
stora/
├── apps/
│   └── cli/              # stora-sh CLI package
├── packages/
│   ├── screenshots/      # @stora/screenshots
│   ├── compliance/       # @stora/compliance
│   ├── shared/           # @stora/shared
│   ├── aso/              # @stora/aso (in development)
│   ├── analyzer/         # @stora/analyzer (in development)
│   ├── deployment/       # @stora/deployment (in development)
│   ├── build/            # @stora/build (in development)
│   └── assets/           # @stora/assets (in development)
├── docs/                 # Documentation
└── .github/workflows/    # CI/CD
```

## License

MIT
