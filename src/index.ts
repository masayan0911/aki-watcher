import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config, SiteConfig } from './types';
import { Scraper } from './scraper';
import { LineNotifier } from './notifier';
import { StateManager } from './state';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'config', 'sites.yml');

function loadConfig(): Config {
  try {
    const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const config = yaml.load(content) as Config;

    if (!config.sites || !Array.isArray(config.sites)) {
      throw new Error('Invalid config: sites array is required');
    }

    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('=== Aki Watcher Starting ===');
  console.log(`Time: ${new Date().toISOString()}`);

  // 設定読み込み
  const config = loadConfig();
  console.log(`Loaded ${config.sites.length} site(s) to check`);

  // 各コンポーネント初期化
  const scraper = new Scraper();
  const stateManager = new StateManager();

  let notifier: LineNotifier | null = null;
  try {
    notifier = new LineNotifier();
  } catch (error) {
    console.warn('LINE notifier not configured:', error);
    console.warn('Notifications will be skipped.');
  }

  try {
    await scraper.init();

    // 各サイトをチェック
    for (const site of config.sites) {
      console.log(`\nChecking: ${site.name}`);

      const result = await scraper.checkSite(site);

      if (result.error) {
        console.error(`  Error: ${result.error}`);
        stateManager.updateSiteState(result, false);

        // エラー通知（オプション）
        if (notifier) {
          try {
            await notifier.sendErrorNotification(site.name, result.error);
          } catch (notifyError) {
            console.error('  Failed to send error notification:', notifyError);
          }
        }
        continue;
      }

      console.log(`  Condition met: ${result.conditionMet}`);

      // 通知判定
      const shouldNotify = stateManager.shouldNotify(site.name, result.conditionMet);
      console.log(`  Should notify: ${shouldNotify}`);

      if (shouldNotify && notifier) {
        try {
          await notifier.sendNotification(site.name, site.url);
          console.log('  Notification sent!');
          stateManager.updateSiteState(result, true);
        } catch (notifyError) {
          console.error('  Failed to send notification:', notifyError);
          stateManager.updateSiteState(result, false);
        }
      } else {
        stateManager.updateSiteState(result, false);
      }
    }

    // ステータス保存
    stateManager.saveStatus();
    console.log('\n=== Aki Watcher Complete ===');
  } finally {
    await scraper.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
