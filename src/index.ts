import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config } from './types';
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

export async function runCheck(): Promise<void> {
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

  // 各サイトをチェック
  for (const site of config.sites) {
    console.log(`\nChecking: ${site.name}`);

    const result = await scraper.checkSite(site);

    if (result.error) {
      console.error(`  Error: ${result.error}`);
      stateManager.updateSiteState(result, false);
      continue;
    }

    console.log(`  Condition met: ${result.conditionMet}`);
    if (result.availableSlots && result.availableSlots.length > 0) {
      console.log(`  Available slots: ${result.availableSlots.join(', ')}`);
    }

    // 通知判定
    const shouldNotify = stateManager.shouldNotify(site.name, result.conditionMet);
    console.log(`  Should notify: ${shouldNotify}`);

    if (shouldNotify && notifier) {
      try {
        await notifier.sendNotification(site.name, site.url, result.availableSlots);
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
}

// CLIから直接実行された場合
runCheck().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
