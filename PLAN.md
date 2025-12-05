# 予約サイト空きチェック＆通知システム 設計プラン

## 要件
- 予約サイトの空き状況を **5分おき** にチェック
- 認証（ログイン）が必要なサイトに対応
- 空きがあれば **LINE** で通知
- インフラ管理不要（AWS/GCP以外）

---

## 技術構成

| 項目 | 選定 | 理由 |
|------|------|------|
| **実行環境** | GitHub Actions | 無料（パブリックリポジトリ無制限）、管理不要 |
| **スクレイピング** | Playwright | SPA対応、ログイン操作可能 |
| **言語** | TypeScript | 型安全、Playwrightと相性良い |
| **通知** | LINE Messaging API | LINE Notifyの代替、無料枠1000通/月 |

### 注意点
- **リポジトリはパブリックに設定**（プライベートだと月$88程度かかる）
- 認証情報はGitHub Secretsに格納（コードには含めない）

---

## ディレクトリ構成

```
aki-watcher/
├── src/
│   ├── index.ts          # メイン処理
│   ├── scraper.ts        # Playwrightスクレイピング
│   ├── notifier.ts       # LINE通知
│   ├── state.ts          # 状態管理（重複通知防止）
│   └── types.ts          # 型定義
├── config/
│   └── sites.yml         # 監視サイト設定
├── docs/                  # GitHub Pages（ステータスページ）
│   ├── index.html        # ダッシュボードUI
│   └── status.json       # 稼働状況データ
├── .github/
│   └── workflows/
│       └── check.yml     # 5分おきcron
├── package.json
└── tsconfig.json
```

---

## 重複通知の防止

GitHub Actions Cacheを使って前回の状態を保持します。

**仕組み:**
```
[前回] 条件満たさない → [今回] 条件満たす = 通知する ✅
[前回] 条件満たす     → [今回] 条件満たす = 通知しない（スキップ）
[前回] 条件満たす     → [今回] 条件満たさない = 通知しない（復活通知はオプション）
```

---

## 稼働状況ページ（GitHub Pages）

GitHub Pagesで静的ページをホスティングし、稼働状況を確認できるようにします。

**URL:** `https://<username>.github.io/aki-watcher/`

**表示内容:**
- 各サイトの最終チェック日時
- 現在の状態（空きあり/なし）
- 通知履歴（直近の数件）
- エラー発生時のメッセージ

**status.json の例:**
```json
{
  "lastUpdated": "2025-12-05T10:05:00Z",
  "sites": [
    {
      "name": "レストランA予約",
      "status": "available",
      "lastChecked": "2025-12-05T10:05:00Z",
      "lastNotified": "2025-12-05T09:30:00Z"
    }
  ]
}
```

---

## 設定ファイル例 (config/sites.yml)

```yaml
sites:
  - name: "レストランA予約"
    url: "https://example.com/reserve"
    # ログイン設定（必要な場合）
    login:
      url: "https://example.com/login"
      usernameSelector: "#email"
      passwordSelector: "#password"
      submitSelector: "#login-btn"
      usernameEnv: "SITE_A_USERNAME"  # GitHub Secretsの変数名
      passwordEnv: "SITE_A_PASSWORD"
    # 通知条件
    notifyWhen:
      elementExists: ".available-slot"

  - name: "病院B予約"
    url: "https://hospital-b.com/yoyaku"
    notifyWhen:
      textContains: "予約可能"
```

### 通知条件のオプション

| 条件 | 説明 |
|------|------|
| `elementExists` | 指定セレクターの要素が存在したら通知 |
| `elementNotExists` | 指定セレクターの要素が存在しなければ通知 |
| `textContains` | ページに指定テキストが含まれたら通知 |
| `textNotContains` | ページに指定テキストが含まれなければ通知 |
| `elementCountGreaterThan` | 要素数が指定値より多ければ通知 |

---

## 実装ステップ

1. プロジェクト初期化（package.json, tsconfig.json, Playwright）
2. スクレイピング機能（ログイン→空き状況チェック）
3. LINE通知機能（Messaging API）
4. GitHub Actions設定（5分おきcron）
5. ステータスページ作成
6. 動作確認・調整

---

## 事前準備

### LINE Messaging API

1. [LINE Developers](https://developers.line.biz/) でアカウント作成
2. 新規チャネル作成（Messaging API）
3. チャネルアクセストークン取得
4. 自分のLINEアカウントで公式アカウントを友だち追加
5. GitHub Secretsに `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_USER_ID` を設定

### GitHub Pages

1. リポジトリ Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main`, Folder: `/docs`
4. Save → `https://<username>.github.io/aki-watcher/` でアクセス可能

---

## 作成するファイル

| ファイル | 内容 |
|----------|------|
| `src/index.ts` | メイン処理（設定読込→チェック→通知→ステータス更新） |
| `src/scraper.ts` | Playwright（ログイン・条件判定） |
| `src/notifier.ts` | LINE Messaging API通知 |
| `src/state.ts` | 状態管理（重複通知防止） |
| `src/types.ts` | 設定ファイルの型定義 |
| `config/sites.yml` | 監視サイト・条件設定 |
| `docs/index.html` | ステータスページUI |
| `docs/status.json` | 稼働状況データ（自動更新） |
| `.github/workflows/check.yml` | 5分おきcron + ステータスコミット |
| `package.json` | 依存関係 |
| `tsconfig.json` | TypeScript設定 |
