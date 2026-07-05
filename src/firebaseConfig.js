// ============================================================
// Firebaseの設定をここに貼る（GitHubのWebエディタで編集してOK）
//
// 取得場所: Firebaseコンソール → プロジェクトの設定（歯車）→ 全般
//          → マイアプリ → SDKの設定と構成
//
// メモ: WebアプリのAPIキーは「公開してよい識別子」で、秘密ではありません。
//       防御線は database.rules.json のセキュリティルールです。
//       それでも公開リポジトリに置きたくない場合は、ここを空のままにして
//       GitHubリポジトリの Settings → Secrets and variables → Actions に
//       VITE_FB_API_KEY 等を登録する方法も使えます（どちらでも動きます）。
// ============================================================
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',   // 例: kakarisan-xxxxx.firebaseapp.com
  databaseURL: '',  // 例: https://kakarisan-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app
  projectId: '',    // 例: kakarisan-xxxxx
  appId: '',
}
