/**
 * Rate Limiter with Caching
 * Prevents API rate limiting and caches results
 */

import { CacheEntry } from '../types.js';

export class RateLimiter {
  private cache: Map<string, CacheEntry<any>>;
  private requestQueue: Array<() => Promise<any>>;
  private processing: boolean;
  private requestsPerMinute: number;
  private minDelay: number;
  private lastRequestTime: number;
  
  constructor(requestsPerMinute: number = 20) {
    this.cache = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.requestsPerMinute = requestsPerMinute;
    this.minDelay = (60 * 1000) / requestsPerMinute; // ms between requests
    this.lastRequestTime = 0;
  }
  
  /**
   * Execute a request with rate limiting and caching
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options?: {
      cacheTTL?: number; // Cache for X milliseconds (default: 1 hour)
      skipCache?: boolean;
      priority?: boolean; // Execute immediately if possible
    }
  ): Promise<T> {
    // Check cache first
    if (!options?.skipCache) {
      const cached = this.getFromCache<T>(key);
      if (cached !== null) {
        return cached;
      }
    }
    
    // Add to queue
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          // Wait if needed to respect rate limit
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minDelay) {
            await this.delay(this.minDelay - timeSinceLastRequest);
          }
          
          this.lastRequestTime = Date.now();
          const result = await fn();
          
          // Cache the result
          const ttl = options?.cacheTTL ?? (60 * 60 * 1000); // Default 1 hour
          this.addToCache(key, result, ttl);
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      if (options?.priority) {
        this.requestQueue.unshift(execute);
      } else {
        this.requestQueue.push(execute);
      }
      
      this.processQueue();
    });
  }
  
  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Add to cache
   */
  private addToCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  /**
   * Clear all cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      // Clear cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Get cache stats
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: Track hits/misses
    };
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.requestQueue.length;
  }
  
  /**
   * Check if processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
}

// Singleton instances for different stores
// App Store: More conservative rate limiting (20 req/min)
export const appStoreRateLimiter = new RateLimiter(20);

// Google Play: Slightly more permissive (30 req/min)
export const playStoreRateLimiter = new RateLimiter(30);

export default RateLimiter;
