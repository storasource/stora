export * from './rule-engine';
export * from './app-store-rules';
export * from './play-store-rules';

import { ruleEngine } from './rule-engine';
import { APP_STORE_RULES } from './app-store-rules';
import { PLAY_STORE_RULES } from './play-store-rules';

ruleEngine.registerRules([...APP_STORE_RULES, ...PLAY_STORE_RULES]);

export { ruleEngine };
