# @stora/deployment

Deployment automation for iOS App Store Connect and Google Play Console.

> **Note:** This package is currently in development. API stubs are available for planning purposes.

## Installation

```bash
npm install @stora/deployment
```

## Planned Features

- Binary uploads (IPA, APK, AAB)
- Metadata management
- Screenshot uploads
- TestFlight distribution
- Play Store internal testing
- Review submission

## Usage (Planned)

```typescript
import { deploy } from '@stora/deployment';

const result = await deploy({
  platform: 'ios',
  projectDir: './my-app',
  version: '1.0.0',
  buildNumber: '1',
  dryRun: true,
});

console.log(`Success: ${result.success}`);
console.log(`Status: ${result.status}`);
```

## License

MIT
