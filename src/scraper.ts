import { SiteConfig, NotifyCondition, CheckResult, ProductInfo } from './types';

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

      // 商品スキャンモードの場合
      if (site.notifyWhen.productScan) {
        const { productNameRegex, productUrlRegex, baseUrl, excludeProducts } = site.notifyWhen.productScan;
        const products = this.extractProductsWithUrls(html, productNameRegex, productUrlRegex, baseUrl);
        const excludeList = excludeProducts || [];
        const newProducts = products.filter(p => !excludeList.includes(p.name));

        return {
          siteName: site.name,
          conditionMet: newProducts.length > 0,
          availableSlots: newProducts.map(p => p.name),
          products: newProducts,
        };
      }

      // 条件チェック
      const conditionMet = this.checkCondition(html, site.notifyWhen);

      // 空き枠情報を抽出（minDaysAhead指定時は直近の空きをフィルタ）
      const availableSlots = conditionMet ? this.extractAvailableSlots(html, site.minDaysAhead) : [];

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

  private extractAvailableSlots(html: string, minDaysAhead?: number): string[] {
    const slots: string[] = [];
    // aタグ内のテキストから空き枠情報を抽出: 「12月14日(日) セルフプレープラン（空き枠：1組）」
    const regex = /<a[^>]*>([^<]*\d{1,2}月\d{1,2}日[^<]*空き枠[^<]*)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      // 改行やスペースを整理
      const text = match[1].replace(/\s+/g, ' ').trim();
      if (text) {
        // minDaysAhead指定時は日付をチェック
        if (minDaysAhead !== undefined) {
          const daysAhead = this.getDaysAhead(text);
          if (daysAhead !== null && daysAhead >= minDaysAhead) {
            slots.push(text);
          }
        } else {
          slots.push(text);
        }
      }
    }
    return slots;
  }

  private getDaysAhead(slotText: string): number | null {
    // 「12月14日」のような日付を抽出
    const dateMatch = slotText.match(/(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) return null;

    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 年の決定：現在12月で空きが1-3月なら翌年
    let year = currentYear;
    if (currentMonth >= 10 && month <= 3) {
      year = currentYear + 1;
    }

    const slotDate = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = slotDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
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

  private extractProductsWithUrls(
    html: string,
    nameRegex: string,
    urlRegex?: string,
    baseUrl?: string
  ): ProductInfo[] {
    const products: ProductInfo[] = [];
    const seenNames = new Set<string>();

    // 商品名を抽出
    const namePattern = new RegExp(nameRegex, 'g');
    let nameMatch;
    while ((nameMatch = namePattern.exec(html)) !== null) {
      const productName = (nameMatch[1] || nameMatch[0]).trim();
      if (productName && !seenNames.has(productName)) {
        seenNames.add(productName);

        let productUrl: string | undefined;
        if (urlRegex) {
          // 商品名の位置から後方を検索してURLを探す（次の商品名が出るまで）
          const startPos = nameMatch.index + nameMatch[0].length;
          const searchArea = html.substring(startPos, startPos + 2000);
          const urlPattern = new RegExp(urlRegex);
          const urlMatch = searchArea.match(urlPattern);
          if (urlMatch) {
            productUrl = urlMatch[1] || urlMatch[0];
            if (baseUrl && productUrl.startsWith('/')) {
              productUrl = baseUrl + productUrl;
            }
          }
        }

        products.push({ name: productName, url: productUrl });
      }
    }
    return products;
  }
}
