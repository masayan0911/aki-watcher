import { SiteConfig, NotifyCondition, CheckResult } from './types';

export class Scraper {
  async checkSite(site: SiteConfig): Promise<CheckResult> {
    try {
      // fetchでHTMLを取得
      const response = await fetch(site.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 条件チェック
      const conditionMet = this.checkCondition(html, site.notifyWhen);

      // 空き枠情報を抽出
      const availableSlots = conditionMet ? this.extractAvailableSlots(html) : [];

      return {
        siteName: site.name,
        conditionMet,
        availableSlots,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error checking site ${site.name}:`, errorMessage);
      return {
        siteName: site.name,
        conditionMet: false,
        error: errorMessage,
      };
    }
  }

  private extractAvailableSlots(html: string): string[] {
    const slots: string[] = [];
    // aタグ内のテキストから空き枠情報を抽出: 「12月14日(日) セルフプレープラン（空き枠：1組）」
    const regex = /<a[^>]*>([^<]*\d{1,2}月\d{1,2}日[^<]*空き枠[^<]*)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      // 改行やスペースを整理
      const text = match[1].replace(/\s+/g, ' ').trim();
      if (text) {
        slots.push(text);
      }
    }
    return slots;
  }

  private checkCondition(html: string, condition: NotifyCondition): boolean {
    // textContains: ページに指定テキストが含まれたら通知
    if (condition.textContains) {
      return html.includes(condition.textContains);
    }

    // textNotContains: ページに指定テキストが含まれなければ通知
    if (condition.textNotContains) {
      return !html.includes(condition.textNotContains);
    }

    // textMatchesRegex: 正規表現にマッチしたら通知
    if (condition.textMatchesRegex) {
      const regex = new RegExp(condition.textMatchesRegex);
      return regex.test(html);
    }

    // 条件が指定されていない場合はfalse
    console.warn('No valid condition specified');
    return false;
  }
}
