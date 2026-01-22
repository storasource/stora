/**
 * Claude AI Client using Vercel AI SDK
 * Replaces Gemini for ASO optimization tasks
 */

import { google } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

export interface ClaudeOptions {
  temperature?: number;
  maxTokens?: number;
  /** Use Claude Opus for maximum quality (default: false, uses Sonnet) */
  useOpus?: boolean;
}

export class ClaudeClient {
  private apiKey: string | undefined;
  private defaultUseOpus: boolean;

  constructor(apiKey?: string, useOpus: boolean = false) {
    this.apiKey = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    this.defaultUseOpus = useOpus;

    if (this.apiKey) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = this.apiKey;
    }
  }

  /**
   * Get the model to use
   */
  private getModel(useOpus?: boolean) {
    const shouldUseOpus = useOpus ?? this.defaultUseOpus;
    const modelId = shouldUseOpus ? 'gemini-1.5-pro' : 'gemini-2.0-flash-exp';
    return google(modelId);
  }

  /**
   * Get current model name for display
   */
  getModelName(useOpus?: boolean): string {
    const shouldUseOpus = useOpus ?? this.defaultUseOpus;
    return shouldUseOpus ? 'Gemini 1.5 Pro' : 'Gemini 1.5 Flash';
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
  async generateStructured<T>(prompt: string, schema: z.ZodType<T>, options?: ClaudeOptions): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY environment variable.');
    }

    try {
      const { object } = await generateObject({
        model: this.getModel(options?.useOpus) as any,
        schema,
        prompt,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens,
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
  async generateText(prompt: string, options?: ClaudeOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY environment variable.');
    }

    try {
      const { text } = await generateText({
        model: this.getModel(options?.useOpus) as any,
        prompt,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens,
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
    options?: ClaudeOptions
  ): Promise<T[]> {
    return Promise.all(prompts.map((p) => this.generateStructured(p.prompt, p.schema, options)));
  }

  /**
   * Set whether to use Opus by default
   */
  setUseOpus(useOpus: boolean): void {
    this.defaultUseOpus = useOpus;
  }
}

// Export a singleton instance
export const claude = new ClaudeClient();

export default ClaudeClient;
