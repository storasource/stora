export type Platform = 'ios' | 'android';

export interface ASOConfig {
  targetKeywords?: string[];
}

export interface AppMetadata {
  name: string;
  description: string;
  keywords?: string;
}

export interface ASOResult {
  score: number;
  grade: string;
  titleScore: number;
  descriptionScore: number;
  keywordsScore: number;
  titleSuggestions: TitleSuggestion[];
  descriptionSuggestions: DescriptionSuggestion[];
  keywordSuggestions: KeywordSuggestion[];
  improvements: string[];
}

export interface TitleSuggestion {
  title: string;
  score: number;
  reason: string;
}

export interface DescriptionSuggestion {
  suggestion: string;
  reason: string;
}

export interface KeywordSuggestion {
  keyword: string;
  action: 'add' | 'remove';
  reason: string;
}

export interface OptimizeOptions {
  projectDir: string;
  platform: Platform;
  config?: ASOConfig;
  metadata: AppMetadata;
}

export async function optimizeASO(options: OptimizeOptions): Promise<ASOResult> {
  const { platform, metadata, config } = options;
  
  const titleAnalysis = analyzeTitle(metadata.name, platform);
  const descriptionAnalysis = analyzeDescription(metadata.description, platform);
  const keywordsAnalysis = analyzeKeywords(metadata.keywords || '', platform, config?.targetKeywords || []);
  
  const titleScore = titleAnalysis.score;
  const descriptionScore = descriptionAnalysis.score;
  const keywordsScore = keywordsAnalysis.score;
  
  const score = Math.round((titleScore * 0.3) + (descriptionScore * 0.4) + (keywordsScore * 0.3));
  const grade = getGrade(score);
  
  return {
    score,
    grade,
    titleScore,
    descriptionScore,
    keywordsScore,
    titleSuggestions: [],
    descriptionSuggestions: [],
    keywordSuggestions: [],
    improvements: [],
  };
}

function analyzeTitle(title: string, platform: Platform): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  const maxLength = platform === 'ios' ? 30 : 50;
  
  if (!title || title.length === 0) {
    score -= 50;
    issues.push('No title provided');
  } else if (title.length > maxLength) {
    score -= 20;
    issues.push(`Title exceeds ${maxLength} character limit`);
  }
  
  return { score: Math.max(0, score), issues };
}

function analyzeDescription(description: string, platform: Platform): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  const minLength = platform === 'ios' ? 100 : 80;
  
  if (!description || description.length === 0) {
    score -= 60;
    issues.push('No description provided');
  } else if (description.length < minLength) {
    score -= 30;
    issues.push(`Description is too short`);
  }
  
  return { score: Math.max(0, score), issues };
}

function analyzeKeywords(keywords: string, platform: Platform, targetKeywords: string[]): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  
  if (platform === 'ios' && (!keywords || keywords.length === 0)) {
    score -= 40;
    issues.push('No keywords provided');
  }
  
  return { score: Math.max(0, score), issues };
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export default optimizeASO;
