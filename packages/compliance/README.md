# @stora/compliance

AI-powered compliance checking for iOS App Store and Google Play.

## Features

- **Rule-Based Checks** - Validates Info.plist, AndroidManifest.xml, and common compliance issues
- **AI-Powered Analysis** - Uses Google Gemini to discover issues that rule-based checks might miss
- **Multi-Platform** - Supports iOS, Android, or both
- **Detailed Reporting** - Provides scores, grades, and prioritized recommendations

## Installation

```bash
npm install @stora/compliance
```

Or use the main CLI which includes this package:

```bash
npm install -g stora-sh
stora compliance ./my-app
```

## Usage

### Via Main CLI (Recommended)

```bash
# Install the main CLI
npm install -g stora-sh

# Check compliance
stora compliance ./my-app

# iOS only
stora compliance ./my-app --platform ios

# Disable AI analysis
stora compliance ./my-app --no-ai

# Strict mode
stora compliance ./my-app --strict
```

### Programmatic API

```typescript
import { analyzeCompliance } from '@stora/compliance';

const result = await analyzeCompliance('./my-app', {
  platform: 'ios',
  enableAI: true,
});

console.log(`Compliance score: ${result.score}/100`);
console.log(`Grade: ${result.grade}`);
console.log(`Pass likelihood: ${(result.passLikelihood * 100).toFixed(0)}%`);

for (const issue of result.issues) {
  console.log(`[${issue.severity}] ${issue.title}`);
  console.log(`  ${issue.message}`);
  if (issue.recommendation) {
    console.log(`  → ${issue.recommendation}`);
  }
}
```

### AI-Powered Analysis

When `GOOGLE_GENERATIVE_AI_API_KEY` is set, the compliance checker uses AI to:

1. Discover additional issues that rule-based checks might miss
2. Refine recommendations for existing issues
3. Provide an overall assessment
4. Estimate approval likelihood

```typescript
const result = await analyzeCompliance('./my-app', {
  platform: 'both',
  enableAI: true,
});

if (result.aiAnalysis) {
  console.log('AI Assessment:', result.aiAnalysis.overallAssessment);
  console.log('AI-discovered issues:', result.aiAnalysis.discoveredIssues.length);
  console.log('Approval likelihood:', result.aiAnalysis.estimatedApprovalLikelihood);
}
```

## API Reference

### `analyzeCompliance(projectDir, options)`

Analyze app compliance with store guidelines.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `platform` | 'ios' \| 'android' \| 'both' | required | Target platform(s) |
| `strictness` | 'strict' \| 'balanced' \| 'lenient' | 'balanced' | How strict to be |
| `enableAI` | boolean | true | Enable AI-powered analysis |
| `appName` | string | 'App' | App name for reporting |
| `version` | string | '1.0.0' | App version |
| `framework` | string | 'unknown' | Framework (react-native, flutter, native) |

**Returns:** `Promise<EnhancedComplianceResult>`

```typescript
interface EnhancedComplianceResult {
  score: number;           // 0-100
  grade: string;           // A+, A, A-, B+, etc.
  passLikelihood: number;  // 0-1
  issues: ComplianceIssue[];
  categories: Record<string, CategoryScore>;
  aiAnalysis?: AIComplianceResult;
}

interface ComplianceIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  message: string;
  recommendation?: string;
  autoFixable: boolean;
}
```

## Checks Performed

### iOS Checks
- Privacy usage descriptions (Camera, Photos, Location, Microphone, Contacts)
- App Transport Security configuration
- Info.plist validation

### Android Checks
- Target SDK version (minimum 34 required)
- AndroidManifest.xml validation
- Permission declarations

### Common Checks
- Privacy policy presence
- Legal compliance indicators

## Environment Variables

```bash
# Required for AI-powered analysis
export GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
```

## License

MIT
