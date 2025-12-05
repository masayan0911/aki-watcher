import { chromium, Browser, Page } from 'playwright';
import { SiteConfig, NotifyCondition, CheckResult } from './types';

export class Scraper {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async checkSite(site: SiteConfig): Promise<CheckResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000); // 60秒に延長

    try {
      // ログインが必要な場合
      if (site.login) {
        await this.performLogin(page, site);
      }

      // 対象ページに移動
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // 条件チェック
      const conditionMet = await this.checkCondition(page, site.notifyWhen);

      return {
        siteName: site.name,
        conditionMet,
      };
    } catch (error) {
      // デバッグ用スクリーンショット保存
      const screenshotPath = `debug-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Debug screenshot saved: ${screenshotPath}`);

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error checking site ${site.name}:`, errorMessage);
      return {
        siteName: site.name,
        conditionMet: false,
        error: errorMessage,
      };
    } finally {
      await context.close();
    }
  }

  private async performLogin(page: Page, site: SiteConfig): Promise<void> {
    const login = site.login!;

    // 環境変数から認証情報を取得
    const username = process.env[login.usernameEnv];
    const password = process.env[login.passwordEnv];

    if (!username || !password) {
      throw new Error(
        `Missing credentials. Set ${login.usernameEnv} and ${login.passwordEnv} environment variables.`
      );
    }

    // ログインページに移動
    await page.goto(login.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // ログインフォームが表示されるまで待機
    await page.waitForSelector(login.usernameSelector, { timeout: 30000 });

    // 認証情報を入力
    await page.fill(login.usernameSelector, username);
    await page.fill(login.passwordSelector, password);

    // ログインボタンをクリック
    await page.click(login.submitSelector);

    // ログイン完了を待機
    await page.waitForLoadState('domcontentloaded');
  }

  private async checkCondition(page: Page, condition: NotifyCondition): Promise<boolean> {
    // elementExists: 指定セレクターの要素が存在したら通知
    if (condition.elementExists) {
      const element = await page.$(condition.elementExists);
      return element !== null;
    }

    // elementNotExists: 指定セレクターの要素が存在しなければ通知
    if (condition.elementNotExists) {
      const element = await page.$(condition.elementNotExists);
      return element === null;
    }

    // textContains: ページに指定テキストが含まれたら通知
    if (condition.textContains) {
      const content = await page.textContent('body');
      return content !== null && content.includes(condition.textContains);
    }

    // textNotContains: ページに指定テキストが含まれなければ通知
    if (condition.textNotContains) {
      const content = await page.textContent('body');
      return content === null || !content.includes(condition.textNotContains);
    }

    // textMatchesRegex: 正規表現にマッチしたら通知
    if (condition.textMatchesRegex) {
      const content = await page.textContent('body');
      if (content === null) return false;
      const regex = new RegExp(condition.textMatchesRegex);
      return regex.test(content);
    }

    // elementCountGreaterThan: 要素数が指定値より多ければ通知
    if (condition.elementCountGreaterThan) {
      const elements = await page.$$(condition.elementCountGreaterThan.selector);
      return elements.length > condition.elementCountGreaterThan.count;
    }

    // 条件が指定されていない場合はfalse
    console.warn('No valid condition specified');
    return false;
  }
}
