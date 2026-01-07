# @stora/assets

App asset detection and analysis for iOS and Android.

> **Note:** This package is currently in development. Icon detection is available.

## Installation

```bash
npm install @stora/assets
```

## Current Features

- iOS icon detection and validation
- Android icon detection
- Transparency/alpha channel detection
- Default/placeholder icon detection

## Usage

```typescript
import { detectAppIcons, detectIOSIcons, detectAndroidIcons } from '@stora/assets';

// Detect icons for all platforms
const result = await detectAppIcons('./my-app', ['ios', 'android']);

console.log(`Has issues: ${result.hasIssues}`);
console.log(`Critical issues: ${result.criticalIssues.join(', ')}`);

// iOS-specific detection
const iosResult = await detectIOSIcons('./my-app');

if (iosResult.hasTransparency) {
  console.log('Warning: iOS icons have transparency (will be rejected)');
}

if (iosResult.isDefault) {
  console.log('Warning: Using default/placeholder icons');
}
```

## API Reference

### `detectAppIcons(projectDir, platforms)`

Detect app icons for specified platforms.

### `detectIOSIcons(projectDir)`

Detect and validate iOS app icons.

### `detectAndroidIcons(projectDir)`

Detect and validate Android app icons.

## Planned Features

- Icon generation
- Screenshot analysis
- Asset size validation

## License

MIT
