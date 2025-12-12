import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SiteConfig {
  name: string;
  url: string;
  notifyWhen: {
    textContains?: string;
    textNotContains?: string;
    textMatchesRegex?: string;
  };
}

interface Config {
  sites: SiteConfig[];
}

// 設定（Vercelではファイルシステムが使えないのでハードコード）
const config: Config = {
  sites: [
    {
      name: '若洲ゴルフリンクス（補充予約）',
      url: 'https://www.jgo-os.com/wrlo/opening.php',
      notifyWhen: {
        textNotContains: '空き枠はございません',
      },
    },
  ],
};

function extractAvailableSlots(html: string): string[] {
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

async function checkSite(site: SiteConfig): Promise<{ conditionMet: boolean; availableSlots: string[]; error?: string }> {
  try {
    const response = await fetch(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // デバッグ用: HTMLの一部をログ出力
    console.log('HTML length:', html.length);
    console.log('HTML snippet (first 2000 chars):', html.substring(0, 2000));

    // 条件チェック
    let conditionMet = false;
    if (site.notifyWhen.textNotContains) {
      conditionMet = !html.includes(site.notifyWhen.textNotContains);
    } else if (site.notifyWhen.textContains) {
      conditionMet = html.includes(site.notifyWhen.textContains);
    } else if (site.notifyWhen.textMatchesRegex) {
      conditionMet = new RegExp(site.notifyWhen.textMatchesRegex).test(html);
    }

    // 空き枠情報を抽出
    const availableSlots = conditionMet ? extractAvailableSlots(html) : [];

    return { conditionMet, availableSlots };
  } catch (error) {
    return { conditionMet: false, availableSlots: [], error: String(error) };
  }
}

async function sendLineNotification(siteName: string, siteUrl: string, availableSlots: string[]): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  if (!token || !userId) {
    throw new Error('LINE credentials not configured');
  }

  let message = `🎉 空き枠が見つかりました！\n\n${siteName}`;

  if (availableSlots.length > 0) {
    message += `\n\n📅 空き日程:\n${availableSlots.join('\n')}`;
  }

  message += `\n\n${siteUrl}`;

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!response.ok) {
    throw new Error(`LINE API error: ${response.status}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Aki Watcher Cron ===');
  console.log(`Time: ${new Date().toISOString()}`);

  const results: { site: string; conditionMet: boolean; notified: boolean; availableSlots?: string[]; error?: string }[] = [];

  for (const site of config.sites) {
    console.log(`Checking: ${site.name}`);

    const { conditionMet, availableSlots, error } = await checkSite(site);

    if (error) {
      console.error(`Error: ${error}`);
      results.push({ site: site.name, conditionMet: false, notified: false, error });
      continue;
    }

    console.log(`Condition met: ${conditionMet}`);
    if (availableSlots.length > 0) {
      console.log(`Available slots: ${availableSlots.join(', ')}`);
    }

    let notified = false;
    if (conditionMet) {
      try {
        await sendLineNotification(site.name, site.url, availableSlots);
        console.log('Notification sent!');
        notified = true;
      } catch (notifyError) {
        console.error(`Notification failed: ${notifyError}`);
      }
    }

    results.push({ site: site.name, conditionMet, notified, availableSlots });
  }

  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
