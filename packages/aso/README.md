# @stora/aso

App Store Optimization (ASO) tools for iOS App Store and Google Play.

> **Note:** This package is currently in development. Basic ASO scoring is available, with full metadata generation coming soon.

## Installation

```bash
npm install @stora/aso
```

## Current Features

- Basic title analysis
- Description scoring
- Keyword analysis (iOS)
- ASO score calculation

## Usage

```typescript
import { optimizeASO } from '@stora/aso';

const result = await optimizeASO({
  projectDir: './my-app',
  platform: 'ios',
  metadata: {
    name: 'My App',
    description: 'A great app for...',
    keywords: 'productivity,tasks,todo',
  },
});

console.log(`ASO Score: ${result.score}/100`);
console.log(`Grade: ${result.grade}`);
```

## Planned Features

- AI-powered metadata generation
- Keyword research and analysis
- Competitor analysis
- A/B test variation suggestions

## License

MIT
