import type { Severity } from '../types';

export interface ComplianceRule {
  id: string;
  store: 'app_store' | 'play_store' | 'both';
  category: string;
  title: string;
  description: string;
  severity: Severity;
  policyReference: string;
  keywords: string[];
  visualIndicators?: string[];
}

export class RuleEngine {
  private rules: Map<string, ComplianceRule> = new Map();

  registerRule(rule: ComplianceRule): void {
    this.rules.set(rule.id, rule);
  }

  registerRules(rules: ComplianceRule[]): void {
    rules.forEach((rule) => this.registerRule(rule));
  }

  getRuleById(id: string): ComplianceRule | undefined {
    return this.rules.get(id);
  }

  getRulesByStore(store: 'app_store' | 'play_store' | 'both'): ComplianceRule[] {
    return Array.from(this.rules.values()).filter(
      (rule) => rule.store === store || rule.store === 'both'
    );
  }

  getRulesByCategory(category: string): ComplianceRule[] {
    return Array.from(this.rules.values()).filter(
      (rule) => rule.category === category
    );
  }

  searchRules(query: string): ComplianceRule[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.rules.values()).filter(
      (rule) =>
        rule.title.toLowerCase().includes(lowerQuery) ||
        rule.description.toLowerCase().includes(lowerQuery) ||
        rule.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
    );
  }

  getAllRules(): ComplianceRule[] {
    return Array.from(this.rules.values());
  }
}

export const ruleEngine = new RuleEngine();
