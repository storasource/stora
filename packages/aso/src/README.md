# Stora ASO Optimizer

**AI-Powered Complete Metadata Generation for iOS App Store Connect & Google Play Developer Console**

## 🎯 Overview

The Stora ASO (App Store Optimization) module is a comprehensive system that automatically generates, analyzes, and optimizes ALL metadata fields required for publishing apps on iOS App Store and Google Play Store.

### Key Features

✅ **Complete Metadata Generation** - AI generates every field needed for app submission
✅ **Competitive Intelligence** - Real-time scraping and analysis of competitor apps
✅ **Keyword Research** - AI-powered keyword discovery with opportunity scoring
✅ **Market Analysis** - Understand trends, gaps, and opportunities
✅ **Platform Optimization** - Tailored for both iOS and Android constraints
✅ **Rate-Limited Scraping** - Built-in caching and rate limiting to avoid blocks
✅ **CLI Integration** - Easy-to-use commands integrated with `stora ship`

## 📦 Components

### AI Integration (`ai/`)

- **gemini-client.ts** - Gemini 2.0 Flash via Vercel AI SDK
- **schemas.ts** - Zod schemas for structured output
- **prompts/metadata-prompts.ts** - Comprehensive prompts for all metadata fields
- **prompts/keyword-prompts.ts** - Keyword research and gap analysis prompts

### Scrapers (`scrapers/`)

- **app-store-scraper.ts** - iOS App Store data scraping
- **google-play-scraper.ts** - Google Play Store data scraping
- **competitor-finder.ts** - Auto-discover competitors
- **rate-limiter.ts** - Rate limiting with caching

### Analyzers (`analyzers/`) - TO BE IMPLEMENTED

- **keyword-analyzer.ts** - Keyword research with competitive analysis
- **competitive-analyzer.ts** - SWOT analysis of competitors
- **metadata-analyzer.ts** - Analyze existing metadata quality
- **market-analyzer.ts** - Market trends and intelligence

### Generators (`generators/`) - TO BE IMPLEMENTED

- **metadata-generator.ts** - Generate ALL metadata fields
- **keyword-generator.ts** - Generate keyword suggestions
- **category-classifier.ts** - Auto-classify categories

### Scorers (`scorers/`) - TO BE IMPLEMENTED

- **aso-scorer.ts** - Calculate comprehensive ASO scores
- **opportunity-scorer.ts** - Score keyword opportunities

## 🏗️ Architecture

```
src/modules/aso/
├── types.ts                    ✅ Complete type definitions
├── ai/
│   ├── gemini-client.ts       ✅ Gemini API client
│   ├── schemas.ts             ✅ Zod validation schemas
│   └── prompts/
│       ├── metadata-prompts.ts ✅ All metadata generation prompts
│       └── keyword-prompts.ts  ✅ Keyword research prompts
├── scrapers/
│   ├── rate-limiter.ts        ✅ Rate limiting & caching
│   ├── app-store-scraper.ts   ✅ iOS scraper
│   ├── google-play-scraper.ts ✅ Android scraper
│   └── competitor-finder.ts   ✅ Auto-find competitors
├── analyzers/                  🚧 TO IMPLEMENT
├── generators/                 🚧 TO IMPLEMENT
├── scorers/                    🚧 TO IMPLEMENT
└── index.ts                    🚧 Main orchestrator

```

## 📋 Metadata Fields Covered

### iOS App Store Connect (ASC)

| Field | Limit | AI Generated |
|-------|-------|--------------|
| **App Name** | 30 chars | ✅ |
| **Subtitle** | 30 chars | ✅ |
| **Description** | 4000 chars | ✅ |
| **Promotional Text** | 170 chars | ✅ |
| **Keywords** | 100 chars | ✅ |
| **What's New** | 4000 chars | ✅ |
| **Primary Category** | - | ✅ |
| **Secondary Category** | - | ✅ |

### Google Play Developer Console (GPD)

| Field | Limit | AI Generated |
|-------|-------|--------------|
| **App Name** | 50 chars | ✅ |
| **Short Description** | 80 chars | ✅ |
| **Full Description** | 4000 chars | ✅ |
| **What's New** | 500 chars | ✅ |
| **Primary Category** | - | ✅ |

## 🚀 Usage

### CLI Commands (Planned)

```bash
# Full ASO analysis
stora aso analyze

# Keyword research
stora aso keywords

# Generate descriptions
stora aso describe

# Competitor analysis
stora aso compete

# Generate all metadata
stora aso generate

# Quick optimize
stora aso optimize
```

### Integration with `stora ship`

```bash
# ASO runs automatically in Phase 4
stora ship

# Skip ASO
stora ship --skip-aso

# Analysis only (no deployment)
stora ship --analyze-only
```

### Programmatic Usage (Planned)

```typescript
import { MetadataGenerator, KeywordAnalyzer, CompetitorFinder } from '@stora/aso';

// Generate all metadata
const generator = new MetadataGenerator(process.env.GOOGLE_API_KEY);
const metadata = await generator.generateAll({
  appName: 'TaskFlow',
  description: 'A powerful task management app',
  category: 'Productivity',
  platform: 'both',
  features: ['Task lists', 'Calendar sync', 'Reminders'],
});

// Research keywords
const analyzer = new KeywordAnalyzer(process.env.GOOGLE_API_KEY);
const keywords = await analyzer.researchKeywords({
  appName: 'TaskFlow',
  description: 'Task management',
  category: 'Productivity',
  platform: 'ios',
});

// Find competitors
const finder = new CompetitorFinder();
const competitors = await finder.findCompetitors({
  platform: 'ios',
  appName: 'TaskFlow',
  category: 'Productivity',
  limit: 10,
});
```

## 🔑 Configuration

### Environment Variables

```bash
# Required: Gemini API Key (supports both variable names)
GOOGLE_API_KEY=your_key_here
# OR
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here

# Optional: Model selection (default: gemini-2.0-flash-exp)
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Rate Limiting

- **iOS App Store**: 20 requests/minute (configurable)
- **Google Play Store**: 30 requests/minute (configurable)
- **Caching**: 1 hour default TTL, configurable per request

## 📊 AI Prompts Design

All prompts follow best practices for ASO:

- **Context-Aware**: Understands app category, platform, and competition
- **Constraint-Enforced**: Strictly adheres to character limits
- **Strategic**: Balances keyword optimization with readability
- **Platform-Specific**: Tailored guidelines for iOS vs Android
- **Competitive**: Leverages competitor data for validation

## 🎯 Next Steps

### Immediate (High Priority)

1. ✅ Complete scrapers implementation
2. 🚧 Implement keyword analyzer
3. 🚧 Implement metadata generator
4. 🚧 Create CLI commands
5. 🚧 Integrate with `stora ship`

### Short Term

6. 🚧 Add ASO scoring system
7. 🚧 Implement A/B test variation generator
8. 🚧 Add market intelligence analyzer
9. 🚧 Create comprehensive test suite

### Long Term

10. 📅 Add keyword tracking over time
11. 📅 Integrate with App Store Connect API for live data
12. 📅 Add screenshot text extraction and analysis
13. 📅 Machine learning for keyword prediction

## 📚 Dependencies

```json
{
  "@ai-sdk/google": "^1.0.0",
  "ai": "^5.0.0",
  "zod": "^3.0.0",
  "app-store-scraper": "^2.2.0",
  "google-play-scraper": "^9.1.0",
  "compromise": "^14.10.0",
  "natural": "^6.10.0",
  "keyword-extractor": "^0.0.28"
}
```

## 🤝 Contributing

This module is designed for maximum flexibility to handle ANY type of app on App Store or Play Store. Contributions welcome!

## 📄 License

MIT

---

**Status**: 🚧 In Development
**Last Updated**: 2025-01-02
**Built with**: Gemini 2.0 Flash, Vercel AI SDK, TypeScript
