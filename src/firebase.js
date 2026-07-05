import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FB_DATABASE_URL,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

export const configOk = Boolean(cfg.apiKey && cfg.databaseURL && cfg.projectId)

let app = null
let db = null
if (configOk) {
  app = initializeApp(cfg)
  db = getDatabase(app)
}
export { db }

// 匿名認証。uid が「同じ端末・ブラウザの同じ人」の識別子になり、
// 「自分の記入だけ取り消せる」をセキュリティルール側で強制するのに使う。
// Firebaseコンソールで Authentication > ログイン方法 > 匿名 を有効にしておくこと。
let authPromise = null
export function ensureAuth() {
  if (!configOk) return Promise.reject(new Error('Firebase設定がありません（.env を確認）'))
  if (!authPromise) {
    authPromise = new Promise((resolve, reject) => {
      const auth = getAuth(app)
      const off = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            off()
            resolve(user.uid)
          } else {
            signInAnonymously(auth).catch((e) => {
              off()
              authPromise = null
              reject(e)
            })
          }
        },
        (e) => {
          authPromise = null
          reject(e)
        }
      )
    })
  }
  return authPromise
}
