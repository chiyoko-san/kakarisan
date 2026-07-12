import React, { useEffect, useState } from 'react'
import { claimAdmin, saveMeta, saveSlot, deleteSlot, recountEvent, saveRoster, setDeleted } from '../api.js'
import { useUid, useEvent, EventView, ShareBox, PrintSheet, NotFoundCard } from '../components.jsx'
import { eventUrl, adminUrl, copyText, toLocalInput, fmtDate, downloadCsv, parseRoster } from '../lib.js'

export default function AdminPage({ eventId, adminKey }) {
  const uid = useUid()
  const data = useEvent(eventId)
  const [claim, setClaim] = useState('checking') // checking | ok | bad

  useEffect(() => {
    let alive = true
    setClaim('checking')
    claimAdmin(eventId, adminKey)
      .then(() => alive && setClaim('ok'))
      .catch(() => alive && setClaim('bad'))
    return () => {
      alive = false
    }
  }, [eventId, adminKey])

  if (data.meta === null) return <NotFoundCard />
  if (claim === 'checking' || data.meta === undefined)
    return <p className="muted center">管理ページを確認中…</p>
  if (claim === 'bad')
    return (
      <div className="card paper center-card">
        <h2>管理用URLが正しくありません</h2>
        <p className="muted">
          URLが途中で切れていないか確認してください。参加用URLでは管理ページを開けません。
        </p>
        <a className="btn subtle" href={'#/e/' + eventId}>
          参加ページを開く
        </a>
      </div>
    )

  const { meta, slots, roster, entries } = data
  const rosterCount = Object.keys(roster || {}).length

  function exportCsv() {
    const slotList = Object.entries(slots || {})
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const rows = [['枠名', '日時', '名前', 'メモ', '記入日時']]
    slotList.forEach((slot) => {
      const es = Object.values(entries?.[slot.id] || {}).sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
      )
      es.forEach((e) => rows.push([slot.name, slot.when || '', e.name, e.memo || '', fmtDate(e.createdAt)]))
    })
    downloadCsv(`${meta.title}.csv`, rows)
  }

  async function recount() {
    try {
      await recountEvent(eventId)
      alert('再集計しました。')
    } catch {
      alert('再集計に失敗しました。')
    }
  }

  return (
    <div className="page">
      <div className="admin-banner screen-only">管理ページ（このURLは幹事専用）</div>

      {meta.deleted === true ? (
        <div className="card paper screen-only warn-card">
          <h2 className="section-title">この募集は削除済みです</h2>
          <p className="warn-text">
            参加者からは「募集が見つかりません」と表示され、新しい記入もできません。ページ下部の「募集を復旧する」ボタンから、いつでも元に戻せます。
          </p>
        </div>
      ) : null}

      <div className="card paper screen-only">
        <h2 className="section-title">参加用リンクを配る</h2>
        <ShareBox url={eventUrl(eventId)} title={meta.title} label="このリンク/QRを参加者に共有してください" />
      </div>

      <MetaForm eventId={eventId} meta={meta} rosterCount={rosterCount} />

      {meta.entryMode === 'roster' || rosterCount > 0 ? (
        <RosterManager eventId={eventId} roster={roster} />
      ) : null}

      <SlotManager eventId={eventId} slots={slots} entries={entries} />

      <div className="screen-only">
        <h2 className="section-title on-bg">参加状況（幹事ビュー）</h2>
        <EventView eventId={eventId} data={data} uid={uid} isAdmin={true} />
      </div>

      <div className="card paper screen-only">
        <h2 className="section-title">出力・メンテナンス</h2>
        <div className="btn-row">
          <button className="btn subtle" onClick={exportCsv}>
            CSVダウンロード
          </button>
          <button className="btn subtle" onClick={() => window.print()}>
            印刷（A4シート）
          </button>
          <button className="btn subtle" onClick={recount}>
            人数を再集計
          </button>
        </div>
        <p className="muted small">
          「再集計」は、通信の中断などで枠の人数表示と実際の記入がずれたときの修復用です。
        </p>
        <AdminUrlNote url={adminUrl(eventId, adminKey)} />
      </div>

      {/* 削除／復旧ゾーン（募集自体の論理削除） */}
      <DangerZone eventId={eventId} meta={meta} />

      {/* 印刷時のみ表示されるシート */}
      <PrintSheet meta={meta} slots={slots} roster={roster} entries={entries} />
    </div>
  )
}

// ---------------- 削除／復旧 ----------------

function DangerZone({ eventId, meta }) {
  const deleted = meta.deleted === true
  const [confirmTitle, setConfirmTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function doDelete() {
    if (confirmTitle.trim() !== meta.title.trim()) {
      alert('入力されたタイトルが募集タイトルと一致しません。')
      return
    }
    if (!confirm('本当に削除しますか？この操作は取り消しできますが、参加者からは見えなくなります。')) return
    setBusy(true)
    try {
      await setDeleted(eventId, true)
      setConfirmTitle('')
      alert('削除しました。参加者からはこのページは見えません。管理URLからいつでも復旧できます。')
    } catch {
      alert('削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  async function doRestore() {
    if (!confirm('この募集を復旧して、参加者から再び見えるようにしますか？')) return
    setBusy(true)
    try {
      await setDeleted(eventId, false)
      alert('復旧しました。参加者から再び見えるようになりました。')
    } catch {
      alert('復旧に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  if (deleted) {
    return (
      <div className="card paper screen-only warn-card">
        <h2 className="section-title">この募集は削除済みです</h2>
        <p className="warn-text">
          参加者からは「募集が見つかりません」と表示され、新しい記入もできません。管理URLからのみ、この画面を見ることができます。
        </p>
        <button className="btn primary" onClick={doRestore} disabled={busy} type="button">
          {busy ? '復旧中…' : '募集を復旧する'}
        </button>
      </div>
    )
  }

  return (
    <div className="card paper screen-only danger-zone">
      <h2 className="section-title">この募集を削除する</h2>
      <p className="muted small">
        削除すると参加者からはこの募集は見えなくなり、新規記入もできなくなります。管理URLからいつでも復旧できます。
      </p>
      <label className="field">
        <span>
          確認のため、募集タイトル <b>「{meta.title}」</b> を下の欄に入力してください
        </span>
        <input
          value={confirmTitle}
          onChange={(e) => setConfirmTitle(e.target.value)}
          placeholder={meta.title}
        />
      </label>
      <button
        className="btn danger"
        onClick={doDelete}
        disabled={busy || confirmTitle.trim() !== meta.title.trim()}
        type="button"
      >
        {busy ? '削除中…' : 'この募集を削除する'}
      </button>
    </div>
  )
}

function AdminUrlNote({ url }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="admin-url-note">
      <p className="muted small">管理用URL（再表示）:</p>
      <div className="share-row">
        <input className="share-url" readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          className="btn subtle"
          onClick={async () => {
            if (await copyText(url)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }
          }}
        >
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
    </div>
  )
}

// ---------------- イベント設定 ----------------

function MetaForm({ eventId, meta, rosterCount }) {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (meta && form === null) {
      setForm({
        title: meta.title,
        description: meta.description || '',
        deadline: meta.deadline ? toLocalInput(meta.deadline) : '',
        cancelUntil: meta.cancelUntil ? toLocalInput(meta.cancelUntil) : '',
        displayMode: meta.displayMode || 'public',
        entryMode: meta.entryMode === 'roster' ? 'roster' : 'free',
        locked: meta.locked === true,
      })
    }
  }, [meta, form])

  if (!form) return null

  async function save(e) {
    e.preventDefault()
    const t = form.title.trim()
    if (!t) return alert('タイトルを入力してください。')
    if (form.entryMode === 'roster' && rosterCount === 0)
      return alert('「名簿から選択」にするには、先に下の「名簿」を保存してください。')
    setBusy(true)
    try {
      await saveMeta(eventId, {
        title: t,
        description: form.description.trim(),
        displayMode: form.displayMode,
        entryMode: form.entryMode,
        locked: form.locked,
        deadline: form.deadline ? new Date(form.deadline).getTime() : null,
        cancelUntil: form.cancelUntil ? new Date(form.cancelUntil).getTime() : null,
      })
      alert('保存しました。')
    } catch {
      alert('保存に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card paper screen-only" onSubmit={save}>
      <h2 className="section-title">募集の設定</h2>
      <label className="field">
        <span>タイトル</span>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={100}
          required
        />
      </label>
      <label className="field">
        <span>説明</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={2000}
          rows={3}
        />
      </label>
      <label className="field">
        <span>締切（空欄で締切なし）</span>
        <input
          type="datetime-local"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </label>
      <label className="field">
        <span>取り消し期限（空欄で制限なし）</span>
        <input
          type="datetime-local"
          value={form.cancelUntil}
          onChange={(e) => setForm({ ...form, cancelUntil: e.target.value })}
        />
        <span className="muted small">
          これ以降、本人による取り消しはできなくなります（幹事はいつでも削除できます）。
        </span>
      </label>
      <fieldset className="field">
        <span>名前の記入方法</span>
        <label className="radio">
          <input
            type="radio"
            checked={form.entryMode === 'free'}
            onChange={() => setForm({ ...form, entryMode: 'free' })}
          />
          自由記入
        </label>
        <label className="radio">
          <input
            type="radio"
            checked={form.entryMode === 'roster'}
            onChange={() => setForm({ ...form, entryMode: 'roster' })}
          />
          名簿から選択（下の「名簿」に登録した人だけが記入できます）
        </label>
      </fieldset>
      <fieldset className="field">
        <span>名前の公開範囲</span>
        <label className="radio">
          <input
            type="radio"
            checked={form.displayMode === 'public'}
            onChange={() => setForm({ ...form, displayMode: 'public' })}
          />
          みんなに公開
        </label>
        <label className="radio">
          <input
            type="radio"
            checked={form.displayMode === 'anonymous'}
            onChange={() => setForm({ ...form, displayMode: 'anonymous' })}
          />
          人数のみ公開（名簿は幹事だけ）
        </label>
      </fieldset>
      <label className="radio">
        <input
          type="checkbox"
          checked={form.locked}
          onChange={(e) => setForm({ ...form, locked: e.target.checked })}
        />
        受付を停止する（締切前でも新規記入を止める）
      </label>
      <div className="btn-row">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '保存中…' : '設定を保存'}
        </button>
      </div>
    </form>
  )
}

// ---------------- 名簿の管理 ----------------

function RosterManager({ eventId, roster }) {
  const [text, setText] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (text === null) {
      const names = Object.values(roster || {})
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((m) => m.name)
      setText(names.join('\n'))
    }
  }, [roster, text])

  if (text === null) return null
  const count = parseRoster(text).length

  async function save() {
    const names = parseRoster(text)
    if (names.length === 0) return alert('メンバーを1名以上入力してください（1行に1名）。')
    if (names.length > 300) return alert('名簿は300名までにしてください。')
    setBusy(true)
    try {
      await saveRoster(eventId, names)
      alert(`名簿を保存しました（${names.length}名）。`)
    } catch {
      alert('保存に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card paper screen-only">
      <h2 className="section-title">名簿（{count}名）</h2>
      <p className="muted small">
        1行に1名。保存すると名簿は丸ごと置き換わります（記入済みの名前はそのまま残ります）。
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={save} disabled={busy} type="button">
          {busy ? '保存中…' : '名簿を保存'}
        </button>
      </div>
    </div>
  )
}

// ---------------- 枠の管理 ----------------

function SlotManager({ eventId, slots, entries }) {
  const slotList = Object.entries(slots || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const maxOrder = slotList.reduce((m, s) => Math.max(m, s.order ?? 0), -1)

  return (
    <div className="card paper screen-only">
      <h2 className="section-title">枠の管理</h2>
      {slotList.map((slot) => (
        <SlotRow
          key={slot.id}
          eventId={eventId}
          slot={slot}
          count={Object.keys(entries?.[slot.id] || {}).length}
        />
      ))}
      <NewSlotRow eventId={eventId} nextOrder={maxOrder + 1} />
    </div>
  )
}

function SlotRow({ eventId, slot, count }) {
  const [form, setForm] = useState({
    name: slot.name,
    when: slot.when || '',
    capacity: slot.capacity,
    note: slot.note || '',
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    const name = form.name.trim()
    const capacity = Math.max(1, Math.min(999, Number(form.capacity) || 1))
    if (!name) return alert('枠の名前を入力してください。')
    if (capacity < count)
      return alert(`定員（${capacity}名）が現在の記入数（${count}名）より少なくなっています。先に記入を削除してください。`)
    setBusy(true)
    try {
      await saveSlot(eventId, slot.id, {
        name,
        when: form.when.trim(),
        note: form.note.trim(),
        capacity,
      })
    } catch {
      alert('保存に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`枠「${slot.name}」を削除しますか？この枠の記入（${count}件）も消えます。`)) return
    try {
      await deleteSlot(eventId, slot.id)
    } catch {
      alert('削除に失敗しました。')
    }
  }

  return (
    <div className="slot-editor">
      <div className="slot-editor-row">
        <input
          className="grow"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={60}
        />
        <input
          className="cap"
          type="number"
          min={1}
          max={999}
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          aria-label="定員"
        />
        <span className="unit">名</span>
      </div>
      <div className="slot-editor-row">
        <input
          className="grow"
          value={form.when}
          onChange={(e) => setForm({ ...form, when: e.target.value })}
          maxLength={60}
          placeholder="日時・場所ラベル（任意）"
        />
        <input
          className="grow"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          maxLength={200}
          placeholder="備考（任意）"
        />
        <button className="btn subtle small" onClick={save} disabled={busy} type="button">
          保存
        </button>
        <button className="link-btn danger" onClick={remove} type="button">
          削除
        </button>
      </div>
      <p className="muted small">現在 {count} 名が記入済み</p>
    </div>
  )
}

function NewSlotRow({ eventId, nextOrder }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', when: '', capacity: 2, note: '' })
  const [busy, setBusy] = useState(false)

  if (!open)
    return (
      <button className="btn subtle" type="button" onClick={() => setOpen(true)}>
        ＋ 枠を追加
      </button>
    )

  async function add() {
    const name = form.name.trim()
    if (!name) return alert('枠の名前を入力してください。')
    setBusy(true)
    try {
      await saveSlot(eventId, null, {
        name,
        when: form.when.trim(),
        note: form.note.trim(),
        capacity: Math.max(1, Math.min(999, Number(form.capacity) || 1)),
        order: nextOrder,
      })
      setForm({ name: '', when: '', capacity: 2, note: '' })
      setOpen(false)
    } catch {
      alert('追加に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="slot-editor new">
      <div className="slot-editor-row">
        <input
          className="grow"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={60}
          placeholder="枠の名前"
          autoFocus
        />
        <input
          className="cap"
          type="number"
          min={1}
          max={999}
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          aria-label="定員"
        />
        <span className="unit">名</span>
      </div>
      <div className="slot-editor-row">
        <input
          className="grow"
          value={form.when}
          onChange={(e) => setForm({ ...form, when: e.target.value })}
          maxLength={60}
          placeholder="日時・場所ラベル（任意）"
        />
        <input
          className="grow"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          maxLength={200}
          placeholder="備考（任意）"
        />
        <button className="btn primary small" onClick={add} disabled={busy} type="button">
          追加
        </button>
        <button className="link-btn" onClick={() => setOpen(false)} type="button">
          やめる
        </button>
      </div>
    </div>
  )
}
