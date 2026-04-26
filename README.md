# 俺の必殺技 — 写真と個性で作る格闘ゲーム

写真をアップロードしてClaude AIが必殺技を生成、ルームコードでオンライン対戦できる格闘ゲームWebアプリ。

## 技術スタック
- React 19 + TypeScript + Vite
- Phaser 4（ゲームエンジン）
- Tailwind CSS
- Firebase Realtime Database（オンライン対戦同期）
- Anthropic Claude API（必殺技生成・試合後実況）
- Vercel デプロイ想定

## 機能
- 写真＋自分の特徴を入れるとAIがオリジナル必殺技を3つ＋賭け技1つ生成
- 通常技70pt・賭け技30ptのポイント配分
- 3ステージ（STREET / DOJO / ROOFTOP）
- 4桁ルームコードで友達とオンライン対戦
- 賭け技：JACKPOT / HIT / OK / MISS / BACKFIRE 確率テーブル
- CPU対戦（EASY / NORMAL / HARD）
- AI実況コメント（試合後）
- スマホ対応：バーチャルパッド自動表示

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に Firebase と Anthropic API キーを設定
npm run dev
```

## 操作方法（PC）
- A/D: 移動
- J: パンチ / K: キック / L: ガード
- U/I/O: 必殺技1/2/3 / H: 賭け技

## デプロイ
```bash
npm run build
npx vercel --prod
```

## テスト
```bash
node smoke-test.mjs       # CPU対戦の全フロー
node online-test.mjs      # オンライン対戦の2クライアント同期
```
