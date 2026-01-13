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
  // 商品一覧スキャン（除外リスト以外の商品があれば通知）
  productScan?: {
    productNameRegex: string;  // 商品名を抽出する正規表現
    productUrlRegex?: string;  // 商品URLを抽出する正規表現（商品名の後に続くURL）
    baseUrl?: string;          // 相対URLを絶対URLに変換するためのベースURL
    excludeProducts: string[]; // 除外する商品名のリスト
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
  notifiedProducts?: string[]; // 通知済み商品リスト（商品スキャンモード用）
}

// ステータスファイル全体
export interface StatusData {
  lastUpdated: string;
  sites: SiteState[];
}

// 商品情報（商品スキャンモード用）
export interface ProductInfo {
  name: string;
  url?: string;
}

// チェック結果
export interface CheckResult {
  siteName: string;
  conditionMet: boolean;
  availableSlots?: string[];
  products?: ProductInfo[]; // 商品スキャンモード用
  error?: string;
}
