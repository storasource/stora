/**
 * iOS App Store Scraper
 * Scrapes app data from App Store using app-store-scraper library
 */

import appStoreScraper from 'app-store-scraper';
import { CompetitorApp, ScraperOptions, SearchOptions, AppDetailsOptions, TopAppsOptions } from '../types.js';
import { appStoreRateLimiter } from './rate-limiter.js';

export class AppStoreScraper {
  private country: string;
  
  constructor(country: string = 'us') {
    this.country = country;
  }
  
  /**
   * Search for apps by query
   */
  async searchApps(options: SearchOptions): Promise<CompetitorApp[]> {
    const cacheKey = `ios:search:${options.query}:${options.country || this.country}:${options.limit || 10}`;
    
    return appStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const results = await appStoreScraper.search({
            term: options.query,
            num: options.limit || 10,
            country: options.country || this.country,
            lang: options.language || 'en',
          });
          
          return results.map(app => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`App Store search failed for "${options.query}":`, error);
          return [];
        }
      },
      {
        cacheTTL: options.cacheTTL || (60 * 60 * 1000), // 1 hour
        skipCache: options.cache === false,
      }
    );
  }
  
  /**
   * Get detailed app information
   */
  async getAppDetails(options: AppDetailsOptions): Promise<CompetitorApp | null> {
    const cacheKey = `ios:app:${options.appId}:${options.country || this.country}`;
    
    return appStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const app = await appStoreScraper.app({
            id: options.appId,
            country: options.country || this.country,
            lang: options.language || 'en',
          });
          
          return this.mapToCompetitorApp(app);
        } catch (error) {
          console.error(`Failed to fetch App Store app ${options.appId}:`, error);
          return null;
        }
      },
      {
        cacheTTL: options.cacheTTL || (60 * 60 * 1000), // 1 hour
        skipCache: options.cache === false,
      }
    );
  }
  
  /**
   * Get similar/related apps
   */
  async getSimilarApps(appId: string, options?: ScraperOptions): Promise<CompetitorApp[]> {
    const cacheKey = `ios:similar:${appId}:${options?.country || this.country}`;
    
    return appStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const similar = await appStoreScraper.similar({
            id: appId,
            country: options?.country || this.country,
            lang: options?.language || 'en',
          });
          
          return similar
            .slice(0, options?.limit || 10)
            .map(app => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`Failed to fetch similar apps for ${appId}:`, error);
          return [];
        }
      },
      {
        cacheTTL: options?.cacheTTL || (60 * 60 * 1000),
        skipCache: options?.cache === false,
      }
    );
  }
  
  /**
   * Get top apps in category
   */
  async getTopApps(options: TopAppsOptions): Promise<CompetitorApp[]> {
    const collection = this.mapCollection(options.collection);
    const cacheKey = `ios:top:${collection}:${options.category || 'all'}:${options.country || this.country}`;
    
    return appStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const apps = await appStoreScraper.list({
            collection,
            category: this.mapCategory(options.category),
            country: options.country || this.country,
            num: options.limit || 50,
            lang: options.language || 'en',
          });
          
          return apps.map(app => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`Failed to fetch top apps:`, error);
          return [];
        }
      },
      {
        cacheTTL: options.cacheTTL || (2 * 60 * 60 * 1000), // 2 hours (top charts change less frequently)
        skipCache: options.cache === false,
      }
    );
  }
  
  /**
   * Get developer apps
   */
  async getDeveloperApps(developerId: string, options?: ScraperOptions): Promise<CompetitorApp[]> {
    const cacheKey = `ios:developer:${developerId}:${options?.country || this.country}`;
    
    return appStoreRateLimiter.execute(
      cacheKey,
      async () => {
        try {
          const apps = await appStoreScraper.developer({
            devId: developerId,
            country: options?.country || this.country,
            lang: options?.language || 'en',
          });
          
          return apps.map(app => this.mapToCompetitorApp(app));
        } catch (error) {
          console.error(`Failed to fetch developer apps for ${developerId}:`, error);
          return [];
        }
      },
      {
        cacheTTL: options?.cacheTTL || (24 * 60 * 60 * 1000), // 24 hours
        skipCache: options?.cache === false,
      }
    );
  }
  
  /**
   * Map app-store-scraper data to CompetitorApp format
   */
  private mapToCompetitorApp(app: any): CompetitorApp {
    return {
      id: app.id?.toString() || app.trackId?.toString() || app.bundleId,
      title: app.title || app.trackName,
      subtitle: app.subtitle,
      description: app.description,
      rating: app.score || app.averageUserRating || 0,
      reviews: app.ratings || app.userRatingCount || 0,
      category: app.primaryGenre || app.genres?.[0] || 'Unknown',
      price: app.price || (app.free ? 0 : null) || 0,
      screenshots: app.screenshots || [],
      icon: app.icon || app.artworkUrl512 || app.artworkUrl100,
      url: app.url || app.trackViewUrl,
      platform: 'ios',
      releaseDate: app.released || app.releaseDate,
      currentVersion: app.currentVersionReleaseDate || app.version,
      developer: app.developer || app.artistName,
      developerWebsite: app.developerWebsite || app.sellerUrl,
    };
  }
  
  /**
   * Map collection type
   */
  private mapCollection(collection?: string): any {
    const collections: Record<string, any> = {
      'top_free': appStoreScraper.collection.TOP_FREE_IOS,
      'top_paid': appStoreScraper.collection.TOP_PAID_IOS,
      'top_grossing': appStoreScraper.collection.TOP_GROSSING_IOS,
    };
    
    return collections[collection || 'top_free'] || appStoreScraper.collection.TOP_FREE_IOS;
  }
  
  /**
   * Map category name to app-store-scraper category ID
   */
  private mapCategory(category?: string): any {
    if (!category) return undefined;
    
    const categories: Record<string, any> = {
      'Books': appStoreScraper.category.BOOKS,
      'Business': appStoreScraper.category.BUSINESS,
      'Education': appStoreScraper.category.EDUCATION,
      'Entertainment': appStoreScraper.category.ENTERTAINMENT,
      'Finance': appStoreScraper.category.FINANCE,
      'Food & Drink': appStoreScraper.category.FOOD_AND_DRINK,
      'Games': appStoreScraper.category.GAMES,
      'Health & Fitness': appStoreScraper.category.HEALTH_AND_FITNESS,
      'Lifestyle': appStoreScraper.category.LIFESTYLE,
      'Medical': appStoreScraper.category.MEDICAL,
      'Music': appStoreScraper.category.MUSIC,
      'Navigation': appStoreScraper.category.NAVIGATION,
      'News': appStoreScraper.category.NEWS,
      'Photo & Video': appStoreScraper.category.PHOTO_AND_VIDEO,
      'Productivity': appStoreScraper.category.PRODUCTIVITY,
      'Reference': appStoreScraper.category.REFERENCE,
      'Shopping': appStoreScraper.category.SHOPPING,
      'Social Networking': appStoreScraper.category.SOCIAL_NETWORKING,
      'Sports': appStoreScraper.category.SPORTS,
      'Travel': appStoreScraper.category.TRAVEL,
      'Utilities': appStoreScraper.category.UTILITIES,
      'Weather': appStoreScraper.category.WEATHER,
    };
    
    return categories[category];
  }
}

export default AppStoreScraper;
