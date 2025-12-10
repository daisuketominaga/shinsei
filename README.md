# 神奈川県 有料老人ホーム設置申請ガイド

Next.js (App Router)、TypeScript、Tailwind CSS、Shadcn UIを使用した有料老人ホーム申請窓口・要件検索アプリケーションです。

## 機能

- 市町村名を入力して申請窓口の管轄を確認
- Perplexity APIを使用した最新の申請手続き情報の検索
- 申請手順、必要書類、概要の表示

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

Perplexity APIキーは [https://www.perplexity.ai/](https://www.perplexity.ai/) で取得できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認できます。

## プロジェクト構造

```
.
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts      # Perplexity APIを使用した検索エンドポイント
│   ├── globals.css           # グローバルスタイル
│   ├── layout.tsx            # ルートレイアウト
│   └── page.tsx              # メインページ
├── components/
│   └── ui/                   # Shadcn UIコンポーネント
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── label.tsx
├── lib/
│   ├── constants.ts          # 政令指定都市・中核市のリスト
│   └── utils.ts              # ユーティリティ関数
└── package.json
```

## 技術スタック

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn UI**
- **Perplexity API** (sonar-proモデル)

## ライセンス

MIT

