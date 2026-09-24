# Text Spotify Player

*[Read this in English](README.md)*

テキストベースの Spotify プレイヤーです。複数行のテキスト（`アーティスト名 / 曲名` または `アーティスト名 - 曲名`）を貼り付けて、一括で再生したりキューに追加したりできます。

![スクリーンショット](public/screenshot.png)

## 基本的な使い方

1. ブラウザでアプリを開き、「Login with Spotify」ボタンからログインします。（※音楽の再生には **Spotify Premium** アカウントが必要です）
2. テキストエリアに以下のように再生したい曲を入力します。
   ```text
   The Beatles / Let It Be
   Queen - Bohemian Rhapsody
   ```
3. **「Play All」** で入力した曲の再生を開始します。
4. **「Queue All」** で入力した曲をすべてキューに追加します。
5. **「Copy Links」** で入力した曲の Spotify のリンクを一括でクリップボードにコピーできます。

## ローカル環境のセットアップ

ご自身のPCで動かすための手順です。

1. 本プロジェクトを手元にクローン、またはダウンロードします。
2. パッケージをインストールします。
   ```bash
   npm install
   ```
3. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) でアプリを作成し、Client ID を取得します。
   - Redirect URI には `http://127.0.0.1:5173/` を設定してください。
4. プロジェクトのルートディレクトリに `.env` ファイルを作成し、取得した Client ID を記述します。
   ```env
   VITE_SPOTIFY_CLIENT_ID=あなたの_Client_ID
   ```
5. 開発サーバーを起動します。
   ```bash
   npm run dev
   ```
6. ブラウザで `http://127.0.0.1:5173/` を開いて使用します。

## デプロイ

このプロジェクトは、Vercel などの静的サイトホスティングサービスに簡単にデプロイできます。ここでは Vercel を例に説明します。

1. **リポジトリの準備**:
   このリポジトリを自身の GitHub アカウントにフォーク（またはプッシュ）します。

2. **Spotify 側の設定**:
   [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にアクセスし、アプリケーションを作成します。
   - **Redirect URIs** に、デプロイ予定の URL (例: `https://your-project-name.vercel.app/`) を追加して保存します。
   - 設定画面から **Client ID** をコピーしておきます。

3. **Vercel でのデプロイ**:
   - Vercel のダッシュボードから `Add New...` > `Project` を選択し、準備したリポジトリをインポートします。
   - 「Environment Variables」の項目を開き、以下を追加します。
     - Name: `VITE_SPOTIFY_CLIENT_ID`
     - Value: (コピーした Client ID)
   - 「Deploy」をクリックします。

4. **動作確認**:
   デプロイが完了したら、発行された URL にアクセスし、ログインと再生ができるか確認してください。

## 技術スタック
- React 19 + TypeScript + Vite
- Tailwind CSS
- Spotify Web API TS SDK
