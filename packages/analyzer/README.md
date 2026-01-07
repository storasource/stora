# @stora/analyzer

Mobile app project analyzer for detecting framework, platforms, and features.

> **Note:** This package is currently in development. Basic project scanning is available.

## Installation

```bash
npm install @stora/analyzer
```

## Current Features

- Framework detection (Flutter, React Native, Expo, Capacitor, Cordova)
- Platform detection (iOS, Android)
- Basic project structure analysis

## Usage

```typescript
import { deepScan } from '@stora/analyzer';

const result = await deepScan('./my-app');

console.log(`Framework: ${result.framework}`);
console.log(`Platforms: ${result.platforms.join(', ')}`);
console.log(`Confidence: ${(result.confidence.overall * 100).toFixed(0)}%`);
```

## API Reference

### `deepScan(projectDir)`

Scans a project directory and returns information about the app.

**Returns:** `Promise<AppScanResult>`

```typescript
interface AppScanResult {
  name: string | null;
  framework: Framework;
  version: string | null;
  platforms: Platform[];
  ios?: { bundleId: string | null };
  android?: { packageName: string | null };
  features: DetectedFeature[];
  dependencies: DependencyInfo;
  warnings: Warning[];
  confidence: ConfidenceScore;
}
```

## Planned Features

- Deep feature detection
- Dependency analysis
- SDK detection (analytics, ads, payments)
- Build configuration analysis

## License

MIT
