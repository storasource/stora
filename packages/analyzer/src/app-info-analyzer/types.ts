export interface AppAnalysisResult {
  metadata: AppMetadata;
  platforms: Platform[];
  features: Feature[];
  dependencies: Dependencies;
  compliance: Compliance;
  confidence: Confidence;
  deviceSupport: DeviceSupport;
  aiInsights?: AIInsights | null;
  warnings: Warning[];
  analyzedFiles: AnalyzedFile[];
}

export interface DeviceSupport {
  // iOS
  iPhone: boolean;
  iPad: boolean;
  iPadMini?: boolean;
  iPadPro?: boolean;

  // Android
  phone: boolean;
  tablet7inch: boolean;
  tablet10inch: boolean;
  chromebook: boolean;
  tv: boolean;
  wear: boolean;
  automotive: boolean;
  xr: boolean;
}

export interface AnalyzedFile {
  path: string;
  type: 'config' | 'source' | 'manifest' | 'asset' | 'other';
  purpose: string;
  exists: boolean;
}

export interface AppMetadata {
  displayName: string | null;
  bundleIdentifier: {
    ios: string | null;
    android: string | null;
  };
  version: {
    name: string | null;
    code: number | null;
  };
  framework: string | null;
  minSDKVersions?: Record<string, string | number>;
  targetSDKVersions?: Record<string, string | number>;
  description?: string | null;
  author?: string | null;
  license?: string | null;
  repository?: string | null;
  homepage?: string | null;
}

export interface Platform {
  platform: 'ios' | 'android';
  detected: boolean;
  ios?: {
    targets: string[];
    schemes: string[];
  };
  android?: {
    buildVariants: string[];
  };
}

export interface Feature {
  name: string;
  confidence: number;
  evidence: string[];
}

export interface Dependencies {
  direct: { name: string; version: string }[];
  sdks: {
    analytics: any[];
    ads: any[];
    payment: any[];
    social: any[];
  };
}

export interface Compliance {
  permissions: Permission[];
  privacyRelated: {
    tracksUsers: boolean;
    collectsPersonalData: boolean;
    thirdPartySDKs: string[];
  };
}

export interface Permission {
  name: string;
  platform: 'ios' | 'android';
  severity: 'info' | 'warning' | 'critical';
  justification?: string;
}

export interface Confidence {
  overall: number;
  metadata: number;
  platforms: number;
  features: number;
  uncertainAreas: string[];
}

export interface AIInsights {
  category: string;
  targetAudience: string;
  sellingPoints: string[];
  suggestedDescription: string;
  keywords: string[];
  complianceConcerns: string[];
}

export interface Warning {
  severity: 'error' | 'warning' | 'info';
  message: string;
}
