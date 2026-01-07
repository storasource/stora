/**
 * Google Play Store Scraper
 */

import gplay from 'google-play-scraper';
import { CompetitorApp, ScraperOptions, SearchOptions, AppDetailsOptions, TopAppsOptions } from '../types.js';
import { playStoreRateLimiter } from './rate-limiter.js';

export class GooglePlayScraper {
  private country: string;
  
  constructor(country: string = 'us') {
    this.country = country;
  }
  
  async searchApps(options: SearchOptions): Promise<CompetitorApp[]> {
    const cacheKey = `android:search:${options.query}:${options.country || this.country}`;
    
    return playStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const results = await gplay.search({
            term: options.query,
            num: options.limit || 10,
            lang: options.language || 'en',
            country: options.country || this.country,
          });
          
          return results.map(app => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`Play Store search failed for "${options.query}":`, error);
          return [];
        }
      },
      { cacheTTL: options.cacheTTL || (60 * 60 * 1000), skipCache: options.cache === false }
    );
  }
  
  async getAppDetails(options: AppDetailsOptions): Promise<CompetitorApp | null> {
    const cacheKey = `android:app:${options.appId}`;
    
    return playStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const app = await gplay.app({
            appId: options.appId,
            lang: options.language || 'en',
            country: options.country || this.country,
          });
          
          return this.mapToCompetitorApp(app);
        } catch (error) {
          console.error(`Failed to fetch Play Store app ${options.appId}:`, error);
          return null;
        }
      },
      { cacheTTL: options.cacheTTL || (60 * 60 * 1000), skipCache: options.cache === false }
    );
  }
  
  async getSimilarApps(appId: string, options?: ScraperOptions): Promise<CompetitorApp[]> {
    const cacheKey = `android:similar:${appId}`;
    
    return playStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const similar = await gplay.similar({
            appId,
            lang: options?.language || 'en',
            num: options?.limit || 10,
          });
          
          return similar.map(app => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`Failed to fetch similar apps for ${appId}:`, error);
          return [];
        }
      },
      { cacheTTL: options?.cacheTTL || (60 * 60 * 1000), skipCache: options?.cache === false }
    );
  }
  
  async getTopApps(options: TopAppsOptions): Promise<CompetitorApp[]> {
    const collection = options.collection || 'TOP_FREE';
    const cacheKey = `android:top:${collection}:${options.category || 'all'}`;

    return playStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const apps = await (gplay as any).list({
            collection,
            category: options.category || undefined,
            num: options.limit || 50,
            lang: options.language || 'en',
            country: options.country || this.country,
          });

          return apps.map((app: any) => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`Failed to fetch top apps:`, error);
          return [];
        }
      },
      { cacheTTL: options.cacheTTL || (2 * 60 * 60 * 1000), skipCache: options.cache === false }
    );
  }
  
  private mapToCompetitorApp(app: any): CompetitorApp {
    return {
      id: app.appId,
      title: app.title,
      description: app.description || app.summary,
      rating: app.score || 0,
      reviews: app.reviews || 0,
      installs: app.installs || app.minInstalls,
      category: app.genre || app.genreId || 'Unknown',
      price: app.price || (app.free ? 0 : null) || 0,
      screenshots: app.screenshots || [],
      icon: app.icon,
      url: app.url,
      platform: 'android',
      releaseDate: app.released,
      currentVersion: app.version,
      developer: app.developer,
      developerWebsite: app.developerWebsite,
    };
  }
  

}

export default GooglePlayScraper;
