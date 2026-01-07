# @stora/screenshots

AI-powered agentic screenshot automation for mobile apps using Maestro.

## Features

- **Agentic Exploration** - AI automatically explores your app and captures interesting screenshots
- **Smart Deduplication** - Avoids capturing duplicate or similar screens
- **Maestro Integration** - Built on top of the robust Maestro testing framework
- **Cross-Platform** - Works with iOS and Android apps
- **Programmatic API** - Use as a library in your own scripts

## Installation

```bash
npm install @stora/screenshots
```

Or use the main CLI which includes this package:

```bash
npm install -g stora-sh
stora screenshots com.example.app
```

## Prerequisites

1. **Maestro CLI** - Install from [maestro.mobile.dev](https://maestro.mobile.dev/getting-started/installing-maestro)
2. **Google AI API Key** - Set `GOOGLE_GENERATIVE_AI_API_KEY` environment variable
3. **Running Simulator/Emulator** - Have your app installed and device running

## Usage

### Via Main CLI (Recommended)

```bash
# Install the main CLI
npm install -g stora-sh

# Capture screenshots
stora screenshots com.example.app

# With options
stora screenshots com.example.app \
  --max-steps 30 \
  --max-screenshots 10 \
  --output ./screenshots
```

### Programmatic API

```typescript
import { captureScreenshots } from '@stora/screenshots';

const result = await captureScreenshots({
  bundleId: 'com.example.app',
  maxScreenshots: 10,
  maxSteps: 50,
  outputDir: './store-screenshots',
});

console.log(`Captured ${result.screenshotCount} screenshots`);
console.log('Files:', result.screenshots);
```

### Using Individual Components

```typescript
import { MaestroClient, VisionAgent, ScreenshotManager } from '@stora/screenshots';

// Direct Maestro control
const maestro = new MaestroClient('com.example.app');
await maestro.launch();
await maestro.tap(50, 50);
const screenshot = await maestro.screenshot();

// AI decision making
const agent = new VisionAgent(apiKey, 'gemini-2.0-flash', 10);
const decision = await agent.decide(screenshot, hierarchy, context);

// Screenshot management with deduplication
const manager = new ScreenshotManager('./output');
if (!manager.isDuplicate(screenshot, hierarchy)) {
  manager.save(screenshot, hierarchy);
}
```

## API Reference

### `captureScreenshots(options)`

Main function for AI-powered screenshot capture.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bundleId` | string | required | Bundle ID of the target app |
| `maxSteps` | number | 50 | Maximum exploration steps |
| `maxScreenshots` | number | 10 | Target number of screenshots |
| `outputDir` | string | ./store-screenshots | Output directory |
| `saveEvalScreens` | boolean | false | Save evaluation screenshots |
| `evalScreensDir` | string | ./eval-screens | Evaluation screenshots directory |
| `model` | string | gemini-2.0-flash | AI model to use |
| `googleApiKey` | string | env var | Google AI API key |

**Returns:** `Promise<ExecutionResult>`

```typescript
interface ExecutionResult {
  success: boolean;
  screenshotCount: number;
  totalSteps: number;
  screenshots: string[];
  duration: number;
  errors: string[];
}
```

### `MaestroClient`

Wrapper for Maestro UI automation.

```typescript
const maestro = new MaestroClient(bundleId);

await maestro.launch();           // Launch the app
await maestro.tap(x, y);          // Tap at percentage coordinates
await maestro.tapText(text);      // Tap element with text
await maestro.scroll();           // Scroll down
await maestro.back();             // Go back (Android)
await maestro.swipe(x1, y1, x2, y2);  // Swipe gesture
await maestro.inputText(text);    // Type text
await maestro.screenshot();       // Take screenshot (returns base64)
await maestro.hierarchy();        // Get UI hierarchy
```

### `VisionAgent`

AI agent for exploration decisions.

```typescript
const agent = new VisionAgent(apiKey, model, maxScreenshots);

const decision = await agent.decide(screenshot, hierarchy, context);
// Returns: { action, params, reasoning, shouldScreenshot }
```

### `ScreenshotManager`

Manages screenshot storage with deduplication.

```typescript
const manager = new ScreenshotManager(outputDir);

manager.isDuplicate(screenshot, hierarchy);  // Check if duplicate
manager.save(screenshot, hierarchy);         // Save screenshot
manager.count();                             // Get count
manager.getAll();                            // Get all paths
```

## How It Works

1. **Launch** - Launches your app using Maestro
2. **Observe** - Takes a screenshot and captures the UI hierarchy
3. **Decide** - AI analyzes the screen and decides the next action
4. **Act** - Executes the action (tap, scroll, etc.)
5. **Capture** - When interesting content is found, saves a screenshot
6. **Repeat** - Continues until target screenshots are captured or max steps reached

## Environment Variables

```bash
export GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
```

## License

MIT
