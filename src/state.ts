import fs from 'fs';
import path from 'path';
import { StatusData, SiteState, SiteStatus, CheckResult } from './types';

const STATUS_FILE_PATH = path.join(process.cwd(), 'docs', 'status.json');

export class StateManager {
  private statusData: StatusData;

  constructor() {
    this.statusData = this.loadStatus();
  }

  private loadStatus(): StatusData {
    try {
      if (fs.existsSync(STATUS_FILE_PATH)) {
        const content = fs.readFileSync(STATUS_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load status file, starting fresh:', error);
    }

    return {
      lastUpdated: new Date().toISOString(),
      sites: [],
    };
  }

  getSiteState(siteName: string): SiteState | undefined {
    return this.statusData.sites.find((s) => s.name === siteName);
  }

  shouldNotify(siteName: string, currentConditionMet: boolean): boolean {
    const previousState = this.getSiteState(siteName);

    // 前回の状態がない場合（初回チェック）
    if (!previousState) {
      return currentConditionMet;
    }

    // 前回: 条件満たさない → 今回: 条件満たす = 通知する
    // 前回: 条件満たす → 今回: 条件満たす = 通知しない（重複防止）
    const wasAvailable = previousState.status === 'available';
    return !wasAvailable && currentConditionMet;
  }

  updateSiteState(result: CheckResult, notified: boolean): void {
    const now = new Date().toISOString();
    const status: SiteStatus = result.error
      ? 'error'
      : result.conditionMet
        ? 'available'
        : 'unavailable';

    const existingIndex = this.statusData.sites.findIndex(
      (s) => s.name === result.siteName
    );

    const newState: SiteState = {
      name: result.siteName,
      status,
      lastChecked: now,
      ...(notified && { lastNotified: now }),
      ...(result.error && { errorMessage: result.error }),
    };

    // 既存の状態がある場合は一部フィールドを保持
    if (existingIndex >= 0) {
      const existing = this.statusData.sites[existingIndex];
      // 通知していない場合は前回の通知時刻を保持
      if (!notified && existing.lastNotified) {
        newState.lastNotified = existing.lastNotified;
      }
      // 通知済み商品リストを保持
      if (existing.notifiedProducts) {
        newState.notifiedProducts = existing.notifiedProducts;
      }
    }

    if (existingIndex >= 0) {
      this.statusData.sites[existingIndex] = newState;
    } else {
      this.statusData.sites.push(newState);
    }

    this.statusData.lastUpdated = now;
  }

  saveStatus(): void {
    try {
      const dirPath = path.dirname(STATUS_FILE_PATH);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(this.statusData, null, 2));
      console.log('Status saved to', STATUS_FILE_PATH);
    } catch (error) {
      console.error('Failed to save status file:', error);
      throw error;
    }
  }

  getStatusData(): StatusData {
    return this.statusData;
  }

  // 通知済み商品リストを取得
  getNotifiedProducts(siteName: string): string[] {
    const state = this.getSiteState(siteName);
    return state?.notifiedProducts || [];
  }

  // 通知済み商品を追加
  addNotifiedProducts(siteName: string, products: string[]): void {
    const existingIndex = this.statusData.sites.findIndex(
      (s) => s.name === siteName
    );

    if (existingIndex >= 0) {
      const existing = this.statusData.sites[existingIndex].notifiedProducts || [];
      this.statusData.sites[existingIndex].notifiedProducts = [...new Set([...existing, ...products])];
    }
  }

  // 新商品のみをフィルタリング（通知済み商品を除く）
  filterNewProducts(siteName: string, products: string[]): string[] {
    // 24時間経過していたらnotifiedProductsをクリア
    this.clearExpiredNotifiedProducts(siteName);
    const notified = this.getNotifiedProducts(siteName);
    return products.filter(p => !notified.includes(p));
  }

  // 最終通知から24時間経過していたらnotifiedProductsをクリア
  private clearExpiredNotifiedProducts(siteName: string, hoursToExpire: number = 24): void {
    const state = this.getSiteState(siteName);
    if (!state?.lastNotified || !state?.notifiedProducts?.length) {
      return;
    }

    const lastNotified = new Date(state.lastNotified).getTime();
    const now = Date.now();
    const hoursPassed = (now - lastNotified) / (1000 * 60 * 60);

    if (hoursPassed >= hoursToExpire) {
      const existingIndex = this.statusData.sites.findIndex(s => s.name === siteName);
      if (existingIndex >= 0) {
        console.log(`  Clearing notifiedProducts for ${siteName} (${hoursPassed.toFixed(1)}h since last notification)`);
        this.statusData.sites[existingIndex].notifiedProducts = [];
      }
    }
  }
}
