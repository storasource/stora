# @stora/shared

Shared utilities and types for Stora packages.

## Installation

```bash
npm install @stora/shared
```

## Usage

### Logger

```typescript
import { Logger } from '@stora/shared';

const logger = new Logger({ prefix: '[MyApp]', level: 'info' });

logger.debug('Debug message');     // Only shown if level is 'debug'
logger.info('Info message');
logger.success('Success message'); // Green with checkmark
logger.warn('Warning message');    // Yellow with warning icon
logger.error('Error message');     // Red with X icon
logger.step(1, 5, 'Step message'); // [1/5] Step message
```

### Error Classes

```typescript
import { StoraError, ConfigError, ValidationError, APIError } from '@stora/shared';

throw new ConfigError('Invalid configuration', { field: 'bundleId' });
throw new ValidationError('Validation failed');
throw new APIError('Request failed', 401);
```

### Utility Functions

```typescript
import { sleep, retry, formatBytes, formatDuration, truncate } from '@stora/shared';

// Sleep
await sleep(1000); // Wait 1 second

// Retry with exponential backoff
const result = await retry(
  () => fetchData(),
  { retries: 3, delay: 1000, backoff: 2 }
);

// Format bytes
formatBytes(1024);       // "1 KB"
formatBytes(1048576);    // "1 MB"

// Format duration
formatDuration(1500);    // "1.5s"
formatDuration(65000);   // "1m 5s"

// Truncate string
truncate('Hello World', 8); // "Hello..."
```

### Types

```typescript
import type { Platform, Framework, AppInfo, LogLevel } from '@stora/shared';

const platform: Platform = 'ios';  // 'ios' | 'android' | 'both'
const framework: Framework = 'react-native';

const appInfo: AppInfo = {
  name: 'My App',
  version: '1.0.0',
  bundleId: 'com.example.app',
  platform: 'ios',
  framework: 'flutter',
};
```

## API Reference

### Logger

| Method | Description |
|--------|-------------|
| `debug(message)` | Log debug message (gray) |
| `info(message)` | Log info message |
| `success(message)` | Log success message (green checkmark) |
| `warn(message)` | Log warning message (yellow) |
| `error(message)` | Log error message (red) |
| `step(n, total, message)` | Log step progress |

### Error Classes

| Class | Description |
|-------|-------------|
| `StoraError` | Base error class with code and details |
| `ConfigError` | Configuration errors |
| `ValidationError` | Validation errors |
| `APIError` | API/network errors with status code |

### Utility Functions

| Function | Description |
|----------|-------------|
| `sleep(ms)` | Promise that resolves after ms milliseconds |
| `retry(fn, options)` | Retry function with exponential backoff |
| `formatBytes(bytes)` | Format bytes to human readable (KB, MB, etc.) |
| `formatDuration(ms)` | Format milliseconds to human readable |
| `truncate(str, max)` | Truncate string with ellipsis |

## License

MIT
