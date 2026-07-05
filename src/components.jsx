import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { subscribeEvent, joinSlot, cancelEntry, adminDeleteEntry } from './api.js'
import { ensureAuth } from './firebase.js'
import { fmtDate, lineShareUrl, copyText, store } from './lib.js'

// ---------------- hooks ----------------

export function useUid() {
  const [uid, setUid] = useState(null)
  useEffect(() => {
    let alive = true
    ensureAuth()
      .then((u) => alive && setUid(u))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return uid
}

export function useEvent(eventId) {
  const [data, setData] = useState({ meta: undefined, slots: {}, counts: {}, entries: {} })
  useEffect(() => {
    setData({ meta: undefined, slots: {}, counts: {}, entries: {} })
    let unsub = () => {}
    let alive = true
    ensureAuth()
      .then(() => {
        if (alive) unsub = subscribeEvent(eventId, setData)
      })
      .catch(() => alive && setData((d) => ({ ...d, meta: null, error: true })))
    return () => {
      alive = false
      unsub()
    }
  }, [eventId])
  return data
}

export function useNow(interval = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}

// ---------------- small parts ----------------

export function DeadlineBadge({ meta, closed }) {
  if (meta.locked) return <p className="badge closed">受付停止中</p>
  if (!meta.deadline) return null
  if (closed) return <p className="badge closed">受付終了（締切: {fmtDate(meta.deadline)}）</p>
  return <p className="badge open">締切: {fmtDate(meta.deadline)}</p>
}

function Meter({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="meter" role="presentation">
      <div className={'meter-fill' + (pct >= 100 ? ' full' : '')} style={{ width: pct + '%' }} />
    </div>
  )
}

export function NotFoundCard() {
  return (
    <div className="card paper center-card">
      <h2>募集が見つかりません</h2>
      <p className="muted">URLが間違っているか、削除された可能性があります。</p>
      <a className="btn subtle" href="#/">トップへ戻る</a>
    </div>
  )
}

// ---------------- 記入ダイアログ ----------------

export function NameDialog({ slot, busy, onSubmit, onClose }) {
  const saved = store.get('kks_profile', {})
  const [name, setName] = useState(saved.name || '')
  const [memo, setMemo] = useState(saved.memo || '')

  function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    onSubmit(n, memo.trim())
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="dialog-title">「{slot.name}」に記入する</h3>
        <label className="field">
          <span>
            お名前 <em className="req">必須</em>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="山田 花子"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span>メモ（任意）</span>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={60}
            placeholder="3年2組 太郎の母 など"
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn subtle" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {busy ? '書き込み中…' : '名前を書く'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------- 枠カード（記名欄UI） ----------------

export function SlotCard({
  slot,
  entries,
  uid,
  isAdmin,
  closed,
  mode,
  onJoinClick,
  onCancel,
  onAdminDelete,
}) {
  const list = Object.entries(entries)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const remaining = Math.max(0, (slot.capacity || 0) - list.length)
  const full = list.length >= (slot.capacity || 0)
  const hideNames = mode === 'anonymous' && !isAdmin

  return (
    <section className={'card paper slot-card' + (full ? ' is-full' : '')}>
      {full && (
        <span className="stamp" aria-label="満員">
          満員
        </span>
      )}
      <div className="slot-head">
        <h2 className="slot-name">{slot.name}</h2>
        <span className="slot-count">
          <b>{list.length}</b>
          <span className="slash">/</span>
          {slot.capacity}
          <span className="unit">名</span>
        </span>
      </div>
      {slot.when ? <p className="slot-when">{slot.when}</p> : null}
      {slot.note ? <p className="slot-note">{slot.note}</p> : null}
      <Meter value={list.length} max={slot.capacity} />
      <ul className="entry-lines">
        {list.map((e, i) => {
          const mine = uid && e.uid === uid
          const shown = !hideNames || mine
          return (
            <li key={e.id} className={'entry-line filled' + (mine ? ' mine' : '')}>
              <span className="line-no">{i + 1}</span>
              <span className={'entry-name' + (shown ? '' : ' ghost')}>
                {shown ? e.name : '記入済み'}
              </span>
              {shown && e.memo ? <span className="entry-memo">{e.memo}</span> : null}
              {mine ? <span className="chip you">あなた</span> : null}
              <span className="line-spacer" />
              {mine ? (
                <button className="link-btn" onClick={() => onCancel(slot.id, e.id)}>
                  取り消す
                </button>
              ) : null}
              {isAdmin && !mine ? (
                <button className="link-btn danger" onClick={() => onAdminDelete(slot.id, e.id)}>
                  削除
                </button>
              ) : null}
            </li>
          )
        })}
        {Array.from({ length: remaining }).map((_, i) => (
          <li key={'empty' + i} className="entry-line empty">
            <span className="line-no">{list.length + i + 1}</span>
            {closed ? (
              <span className="muted">受付終了</span>
            ) : (
              <button className="write-btn" onClick={() => onJoinClick(slot)}>
                ＋ ここに名前を書く
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------- イベント本体（参加者/管理者 共用） ----------------

export function EventView({ eventId, data, uid, isAdmin }) {
  const { meta, slots, counts, entries } = data
  const now = useNow(30000)
  const [dialogSlot, setDialogSlot] = useState(null)
  const [busy, setBusy] = useState(false)

  if (meta === undefined) return <p className="muted center">読み込み中…</p>
  if (meta === null) return <NotFoundCard />

  const deadlinePassed = meta.deadline ? now > meta.deadline : false
  const closed = meta.locked === true || deadlinePassed
  const slotList = Object.entries(slots || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  function openJoin(slot) {
    const es = entries?.[slot.id] || {}
    const already = uid && Object.values(es).some((e) => e.uid === uid)
    if (already && !confirm('この枠にはすでに記入済みです。もう1名分（ご家族など）を追加しますか？'))
      return
    setDialogSlot(slot)
  }

  async function handleJoin(name, memo) {
    if (!dialogSlot) return
    setBusy(true)
    try {
      await joinSlot(eventId, dialogSlot.id, dialogSlot.capacity, { name, memo })
      store.set('kks_profile', { name, memo })
      setDialogSlot(null)
    } catch (e) {
      if (e && e.code === 'FULL') {
        alert('すみません、直前にこの枠は満員になりました。')
        setDialogSlot(null)
      } else {
        alert('書き込めませんでした。締切を過ぎたか、受付停止中の可能性があります。')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(slotId, entryId) {
    if (!confirm('この記入を取り消しますか？')) return
    try {
      await cancelEntry(eventId, slotId, entryId)
    } catch {
      alert('取り消せませんでした。記入したときと同じ端末・ブラウザからのみ取り消せます。')
    }
  }

  async function handleAdminDelete(slotId, entryId) {
    if (!confirm('この記入を削除しますか？（幹事権限）')) return
    try {
      await adminDeleteEntry(eventId, slotId, entryId)
    } catch {
      alert('削除できませんでした。')
    }
  }

  return (
    <div className="event-view">
      <div className="card paper event-head">
        <h1 className="event-title">{meta.title}</h1>
        {meta.description ? <p className="event-desc">{meta.description}</p> : null}
        <DeadlineBadge meta={meta} closed={closed} />
        {meta.displayMode === 'anonymous' && !isAdmin ? (
          <p className="mode-note">参加者名は幹事のみに表示されます（自分の記入は見えます）。</p>
        ) : null}
      </div>

      {slotList.length === 0 ? (
        <p className="muted center">枠がまだありません。</p>
      ) : (
        slotList.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            entries={entries?.[slot.id] || {}}
            uid={uid}
            isAdmin={isAdmin}
            closed={closed}
            mode={meta.displayMode}
            onJoinClick={openJoin}
            onCancel={handleCancel}
            onAdminDelete={handleAdminDelete}
          />
        ))
      )}

      {dialogSlot && (
        <NameDialog
          slot={dialogSlot}
          busy={busy}
          onSubmit={handleJoin}
          onClose={() => setDialogSlot(null)}
        />
      )}
    </div>
  )
}

// ---------------- 共有ボックス ----------------

export function ShareBox({ url, title, label }) {
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const text = `【${title}】\n参加できる枠に名前の記入をお願いします。\n${url}`
  const canWebShare = typeof navigator !== 'undefined' && 'share' in navigator

  async function doCopy() {
    if (await copyText(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="share-box">
      {label ? <p className="share-label">{label}</p> : null}
      <div className="share-row">
        <input className="share-url" readOnly value={url} onFocus={(e) => e.target.select()} />
        <button className="btn subtle" onClick={doCopy}>
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
      <div className="share-actions">
        <a className="btn line" href={lineShareUrl(text)} target="_blank" rel="noreferrer">
          LINEで送る
        </a>
        {canWebShare ? (
          <button
            className="btn subtle"
            onClick={() => navigator.share({ title, text, url }).catch(() => {})}
          >
            共有…
          </button>
        ) : null}
        <button className="btn subtle" onClick={() => setShowQr((v) => !v)}>
          {showQr ? 'QRを隠す' : 'QRコード'}
        </button>
      </div>
      {showQr && <QrBlock url={url} />}
    </div>
  )
}

function QrBlock({ url }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, { width: 240, margin: 1 })
      .then((d) => alive && setSrc(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [url])
  return (
    <div className="qr-block">
      {src ? <img src={src} alt="参加用QRコード" width="180" height="180" /> : 'QR生成中…'}
      <p className="muted small">おたより・プリントに貼れます（長押し / 右クリックで保存）</p>
    </div>
  )
}

// ---------------- 印刷用シート（管理画面から window.print） ----------------

export function PrintSheet({ meta, slots, entries }) {
  if (!meta) return null
  const slotList = Object.entries(slots || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return (
    <div className="print-only print-sheet">
      <h1>{meta.title}</h1>
      {meta.description ? <p className="print-desc">{meta.description}</p> : null}
      {meta.deadline ? <p className="print-desc">締切: {fmtDate(meta.deadline)}</p> : null}
      {slotList.map((slot) => {
        const list = Object.values(entries?.[slot.id] || {}).sort(
          (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
        )
        const remaining = Math.max(0, (slot.capacity || 0) - list.length)
        return (
          <div key={slot.id} className="print-slot">
            <h2>
              {slot.name}
              {slot.when ? `（${slot.when}）` : ''} — {list.length}/{slot.capacity}名
            </h2>
            {slot.note ? <p className="print-desc">{slot.note}</p> : null}
            <table>
              <tbody>
                {list.map((e, i) => (
                  <tr key={i}>
                    <td className="no">{i + 1}</td>
                    <td>{e.name}</td>
                    <td className="memo">{e.memo || ''}</td>
                  </tr>
                ))}
                {Array.from({ length: remaining }).map((_, i) => (
                  <tr key={'e' + i}>
                    <td className="no">{list.length + i + 1}</td>
                    <td className="blank"></td>
                    <td className="memo blank"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
      <p className="print-desc">出力: このシートはWeb上でリアルタイムに更新されています。</p>
    </div>
  )
}
