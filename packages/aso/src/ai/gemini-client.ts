/**
 * Gemini AI Client using Vercel AI SDK
 */

import { google } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

export interface GeminiOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export class GeminiClient {
  private model: string;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    // Support both API key environment variables
    this.apiKey = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

    if (this.apiKey) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = this.apiKey;
    }

    // Use Gemini 2.0 Flash Experimental for speed, can be overridden
    this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
  }

  /**
   * Check if client is configured with API key
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate structured output using Zod schema
   */
  async generateStructured<T>(prompt: string, schema: z.ZodType<T>, options?: GeminiOptions): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error(
        'Gemini API key not configured. Set GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable.'
      );
    }

    try {
      const { object } = await generateObject({
        model: google(this.model) as any,
        schema,
        prompt,
        temperature: options?.temperature ?? 0.7,
      });

      return object as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate free-form text
   */
  async generateText(prompt: string, options?: GeminiOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Gemini API key not configured. Set GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable.'
      );
    }

    try {
      const { text } = await generateText({
        model: google(this.model) as any,
        prompt,
        temperature: options?.temperature ?? 0.7,
        topP: options?.topP,
      });

      return text;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate multiple structured outputs in parallel (batch processing)
   */
  async generateMultiple<T>(
    prompts: Array<{ prompt: string; schema: z.ZodType<T> }>,
    options?: GeminiOptions
  ): Promise<T[]> {
    return Promise.all(prompts.map((p) => this.generateStructured(p.prompt, p.schema, options)));
  }

  /**
   * Set a different model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }
}

// Export a singleton instance
export const gemini = new GeminiClient();

export default GeminiClient;
