/**
 * Competitor Finder
 * Automatically finds and analyzes competitor apps
 */

import { AppStoreScraper } from './app-store-scraper.js';
import { GooglePlayScraper } from './google-play-scraper.js';
import { CompetitorApp, Platform } from '../types.js';

export class CompetitorFinder {
  private appStoreScraper: AppStoreScraper;
  private googlePlayScraper: GooglePlayScraper;
  
  constructor() {
    this.appStoreScraper = new AppStoreScraper();
    this.googlePlayScraper = new GooglePlayScraper();
  }
  
  async findCompetitors(options: {
    platform: Platform;
    appName: string;
    category?: string;
    keywords?: string[];
    appId?: string;
    limit?: number;
  }): Promise<CompetitorApp[]> {
    const scraper = options.platform === 'ios' ? this.appStoreScraper : this.googlePlayScraper;
    const competitors = new Map<string, CompetitorApp>();
    
    // Strategy 1: Search by app name (find similar apps)
    try {
      const nameResults = await scraper.searchApps({
        query: options.appName,
        limit: Math.min(options.limit || 20, 50),
      });
      nameResults.forEach(app => competitors.set(app.id, app));
    } catch (error) {
      console.warn('Name search failed:', error);
    }
    
    // Strategy 2: Search by keywords (if provided)
    if (options.keywords && options.keywords.length > 0) {
      for (const keyword of options.keywords.slice(0, 3)) {
        try {
          const keywordResults = await scraper.searchApps({
            query: keyword,
            limit: 10,
          });
          keywordResults.forEach(app => {
            if (!competitors.has(app.id)) {
              competitors.set(app.id, app);
            }
          });
        } catch (error) {
          console.warn(`Keyword search failed for "${keyword}":`, error);
        }
      }
    }
    
    // Strategy 3: Get similar apps (if appId provided)
    if (options.appId) {
      try {
        const similarApps = await scraper.getSimilarApps(options.appId, { limit: 10 });
        similarApps.forEach(app => {
          if (!competitors.has(app.id)) {
            competitors.set(app.id, app);
          }
        });
      } catch (error) {
        console.warn('Similar apps search failed:', error);
      }
    }
    
    // Strategy 4: Get top apps in category
    if (options.category) {
      try {
        const topApps = await scraper.getTopApps({
          category: options.category,
          collection: 'top_free',
          limit: 20,
        });
        topApps.forEach(app => {
          if (!competitors.has(app.id)) {
            competitors.set(app.id, app);
          }
        });
      } catch (error) {
        console.warn('Category top apps search failed:', error);
      }
    }
    
    // Filter out our own app and sort by relevance
    const allCompetitors = Array.from(competitors.values())
      .filter(app => !this.isSameApp(app.title, options.appName))
      .sort((a, b) => this.calculateRelevanceScore(b) - this.calculateRelevanceScore(a));
    
    return allCompetitors.slice(0, options.limit || 10);
  }
  
  private isSameApp(appTitle: string, ourAppName: string): boolean {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalize(appTitle) === normalize(ourAppName);
  }
  
  private calculateRelevanceScore(app: CompetitorApp): number {
    // Score based on rating, review count, and presence of data
    const ratingScore = (app.rating || 0) * 15;
    const reviewScore = Math.min(Math.log(app.reviews + 1) * 5, 30);
    const dataQualityScore = (app.description ? 20 : 0) + (app.screenshots.length > 0 ? 10 : 0);
    
    return ratingScore + reviewScore + dataQualityScore;
  }
}

export default CompetitorFinder;
