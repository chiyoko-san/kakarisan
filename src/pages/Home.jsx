import React from 'react'
import { APP_NAME, TAGLINE } from '../appConfig.js'
import { myEvents, adminUrl, fmtDate } from '../lib.js'

export default function Home() {
  const mine = myEvents()

  return (
    <div className="page home">
      <section className="hero">
        <h1 className="hero-title">{TAGLINE}</h1>
        <p className="hero-sub">
          運動会の係、旗振り当番、持ち寄り、個人面談の時間枠。
          <br />
          「どなたかお願いします…」のかわりに、埋まっていく記名シートを配りましょう。
        </p>
        <a className="btn primary big" href="#/new">
          募集ページを作る（無料・登録不要）
        </a>

        {/* デモ: このアプリの中身そのものを見せる */}
        <div className="card paper demo" aria-hidden="true">
          <div className="slot-head">
            <span className="slot-name">運動会 前日準備</span>
            <span className="slot-count">
              <b>2</b>
              <span className="slash">/</span>3<span className="unit">名</span>
            </span>
          </div>
          <p className="slot-when">10/10（土）15:00〜 体育館</p>
          <ul className="entry-lines">
            <li className="entry-line filled">
              <span className="line-no">1</span>
              <span className="entry-name">佐藤</span>
              <span className="entry-memo">2-1 はるの母</span>
            </li>
            <li className="entry-line filled">
              <span className="line-no">2</span>
              <span className="entry-name">田中</span>
            </li>
            <li className="entry-line empty">
              <span className="line-no">3</span>
              <span className="write-btn as-text">＋ ここに名前を書く</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="steps">
        <h2 className="section-title">使い方は3ステップ</h2>
        <ol className="step-list">
          <li>
            <b>枠と定員を決めて作成。</b>テンプレートを選べば1分で終わります。
          </li>
          <li>
            <b>URLをLINEで送る。</b>紙のおたよりにはQRコードを貼れます。
          </li>
          <li>
            <b>あとは埋まるのを見るだけ。</b>定員になった枠は自動で締め切られます。
          </li>
        </ol>
      </section>

      <section className="features">
        <h2 className="section-title">{APP_NAME}のいいところ</h2>
        <ul className="feature-list">
          <li>
            <b>会員登録・アプリ不要。</b>作る人も書く人も、URLを開くだけ。
          </li>
          <li>
            <b>名前の公開範囲を選べる。</b>「人数だけ公開、名簿は幹事のみ」にもできます。
          </li>
          <li>
            <b>締切と受付停止。</b>日時で自動締切、手動でのロックもできます。
          </li>
          <li>
            <b>紙とも仲良し。</b>A4印刷ビューとCSV出力つき。集計は自動です。
          </li>
        </ul>
      </section>

      {mine.length > 0 && (
        <section className="my-events">
          <h2 className="section-title">この端末で作った募集</h2>
          <ul className="my-event-list">
            {mine.map((e) => (
              <li key={e.eventId}>
                <a href={adminUrl(e.eventId, e.adminKey)}>{e.title}</a>
                <span className="muted small">（{fmtDate(e.createdAt)} 作成・管理ページ）</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
