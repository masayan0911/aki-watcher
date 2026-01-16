# Aki Watcher

予約サイト・ECサイトの空き状況や新商品を監視し、LINE通知するシステム。

## アーキテクチャ

```
cron-job.org (1分間隔)
    ↓ POST (workflow_dispatch)
GitHub Actions
    ↓ npm run check
Node.js スクリプト
    ↓ fetch
監視対象サイト → 条件判定 → LINE通知
```

## ディレクトリ構成

```
├── config/
│   └── sites.yml          # 監視サイト設定
├── src/
│   ├── index.ts           # エントリポイント
│   ├── scraper.ts         # サイトスクレイピング
│   ├── notifier.ts        # LINE通知
│   ├── state.ts           # 状態管理
│   └── types.ts           # 型定義
├── docs/
│   └── status.json        # 実行状態（自動更新）
└── .github/workflows/
    └── check.yml          # GitHub Actions定義
```

## 監視サイト設定 (config/sites.yml)

### 通常モード（テキスト条件）
```yaml
- name: "サイト名"
  url: "https://example.com"
  notifyWhen:
    textNotContains: "空きなし"  # このテキストがなければ通知
    # textContains: "空きあり"   # このテキストがあれば通知
  minDaysAhead: 7  # N日以降の空きのみ通知（オプション）
```

### 商品スキャンモード
```yaml
- name: "ECサイト名"
  url: "https://example.com/products"
  notifyWhen:
    productScan:
      productNameRegex: '"title":"([^"]+)"'  # 商品名抽出
      productUrlRegex: '"url":"(/product/[^"]+)"'  # URL抽出
      baseUrl: "https://example.com"
      excludeProducts:  # 通知不要な商品
        - "商品名A"
        - "商品名B"
```

## 環境変数 (GitHub Secrets)

| 変数名 | 説明 |
|--------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging APIのアクセストークン |
| `LINE_USER_ID` | 通知先のLINEユーザーID |

## 実行トリガー

cron-job.org から GitHub Actions の `workflow_dispatch` を1分間隔で呼び出し。

### cron-job.org 設定
- **URL**: `https://api.github.com/repos/{owner}/{repo}/actions/workflows/check.yml/dispatches`
- **Method**: POST
- **Headers**:
  - `Authorization: Bearer {GitHub PAT}`
  - `Accept: application/vnd.github+json`
  - `Content-Type: application/json`
- **Body**: `{"ref":"main"}`

### GitHub PAT 必要権限
- Repository permissions → Actions: Read and write

## 開発コマンド

```bash
npm install      # 依存関係インストール
npm run dev      # ローカル実行（ts-node）
npm run check    # ビルド＆実行
```

## 状態管理

- `docs/status.json` に各サイトの状態を保存
- 商品スキャンモードでは通知済み商品を記録し、重複通知を防止
- GitHub Actions実行時に自動コミット
