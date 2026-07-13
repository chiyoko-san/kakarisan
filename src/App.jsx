import React, { useEffect, useState } from 'react'
import { APP_NAME, CONTACT_URL } from './appConfig.js'
import { configOk } from './firebase.js'
import Home from './pages/Home.jsx'
import Create from './pages/Create.jsx'
import EventPage from './pages/EventPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

// GitHub Pages でも 404 にならないよう、ルーティングはハッシュ方式
//   #/            トップ
//   #/new         募集ページ作成
//   #/e/{id}      参加ページ
//   #/a/{id}/{key} 管理ページ
function parseRoute() {
  const raw = window.location.hash.replace(/^#/, '')
  const parts = raw.split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'home' }
  if (parts[0] === 'new') return { page: 'new' }
  if (parts[0] === 'privacy') return { page: 'privacy' }
  if (parts[0] === 'e' && parts[1]) return { page: 'event', id: parts[1] }
  if (parts[0] === 'a' && parts[1] && parts[2]) return { page: 'admin', id: parts[1], key: parts[2] }
  return { page: 'notfound' }
}

export default function App() {
  const [route, setRoute] = useState(parseRoute())

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!configOk) return <SetupNotice />

  return (
    <div className="app">
      <header className="site-header screen-only">
        <a href="#/" className="brand">
          <span className="brand-mark">係</span>
          {APP_NAME}
          <span className="beta">β</span>
        </a>
      </header>
      <main className="main">
        {route.page === 'home' && <Home />}
        {route.page === 'new' && <Create />}
        {route.page === 'event' && <EventPage eventId={route.id} />}
        {route.page === 'admin' && <AdminPage eventId={route.id} adminKey={route.key} />}
        {route.page === 'privacy' && <Privacy />}
        {route.page === 'notfound' && <NotFound />}
      </main>
      <footer className="site-footer screen-only">
        <p>
          {APP_NAME}は個人運営の無料ツールです（ベータ版）。{' '}
          <a href="/guide/">お役立ちコラム</a>
          {' ／ '}
          <a href="#/privacy">プライバシーについて</a>
          {' ／ '}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer">
            お問い合わせ・削除依頼
          </a>
        </p>
      </footer>
    </div>
  )
}

function SetupNotice() {
  return (
    <div className="app">
      <main className="main">
        <div className="card paper center-card">
          <h2>セットアップが必要です</h2>
          <p className="muted">
            Firebaseの設定が見つかりません。<code>.env.example</code> を <code>.env</code>{' '}
            にコピーして、Firebaseコンソールの値を入れてから再起動してください。手順はREADMEにあります。
          </p>
        </div>
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="card paper center-card">
      <h2>ページが見つかりません</h2>
      <a className="btn subtle" href="#/">トップへ戻る</a>
    </div>
  )
}

function Privacy() {
  return (
    <div className="card paper prose">
      <h1>プライバシーについて</h1>
      <p>
        {APP_NAME}
        は、募集ページの作成者と参加者が入力した情報（募集タイトル・枠名・お名前・メモ）を、ページの表示のためだけに保存します。メールアドレスや電話番号の登録は不要で、収集もしません。
      </p>
      <p>
        募集ページはURLを知っている人だけが閲覧できます。URLは推測が困難なランダムな文字列ですが、URL自体が合鍵になるため、参加者以外への転送はお控えください。特に管理用URLは幹事以外に共有しないでください。
      </p>
      <p>
        入力された名前は、本名である必要はありません。ニックネームやイニシャルでの記入も可能です（幹事の運用ルールに従ってください）。
      </p>
      <p>
        役目を終えた募集ページは、管理ページの「この募集を削除する」ボタンからいつでも削除できます。管理URLを紛失してしまった場合や、記入した本人として名前の削除を希望される場合は、
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          お問い合わせフォーム
        </a>
        からご連絡ください。
      </p>
    </div>
  )
}
