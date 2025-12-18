// ログイン設定
export interface LoginConfig {
  url: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  usernameEnv: string;
  passwordEnv: string;
}

// 通知条件
export interface NotifyCondition {
  elementExists?: string;
  elementNotExists?: string;
  textContains?: string;
  textNotContains?: string;
  textMatchesRegex?: string;
  elementCountGreaterThan?: {
    selector: string;
    count: number;
  };
}

// サイト設定
export interface SiteConfig {
  name: string;
  url: string;
  login?: LoginConfig;
  notifyWhen: NotifyCondition;
  minDaysAhead?: number; // N日以降の空きのみ通知（直近の空きを無視）
}

// 設定ファイル全体
export interface Config {
  sites: SiteConfig[];
}

// サイトステータス
export type SiteStatus = 'available' | 'unavailable' | 'error';

// サイト状態
export interface SiteState {
  name: string;
  status: SiteStatus;
  lastChecked: string;
  lastNotified?: string;
  errorMessage?: string;
}

// ステータスファイル全体
export interface StatusData {
  lastUpdated: string;
  sites: SiteState[];
}

// チェック結果
export interface CheckResult {
  siteName: string;
  conditionMet: boolean;
  availableSlots?: string[];
  error?: string;
}
