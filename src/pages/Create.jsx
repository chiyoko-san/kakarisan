import React, { useState } from 'react'
import { createEvent } from '../api.js'
import { eventUrl, adminUrl, copyText, rememberMyEvent } from '../lib.js'
import { ShareBox } from '../components.jsx'

const TEMPLATES = [
  {
    key: 'sports',
    label: '運動会・行事の係',
    slots: [
      { name: '受付', when: '8:00〜9:00', capacity: 2, note: '' },
      { name: '用具準備', when: '前日 15:00〜', capacity: 4, note: '' },
      { name: '児童誘導', when: '午前', capacity: 4, note: '' },
      { name: '駐輪場整理', when: '終日', capacity: 2, note: '' },
      { name: '片付け', when: '終了後', capacity: 6, note: '' },
    ],
  },
  {
    key: 'hata',
    label: '旗振り・見守り当番',
    slots: ['月', '火', '水', '木', '金'].map((d) => ({
      name: `${d}曜日`,
      when: '7:45〜8:15 ○○交差点',
      capacity: 1,
      note: '',
    })),
  },
  {
    key: 'potluck',
    label: '持ち寄りパーティー',
    slots: [
      { name: 'メイン料理', when: '', capacity: 3, note: '' },
      { name: 'サラダ・副菜', when: '', capacity: 2, note: '' },
      { name: 'デザート', when: '', capacity: 3, note: '' },
      { name: '飲み物', when: '', capacity: 2, note: '' },
      { name: '紙皿・紙コップ', when: '', capacity: 1, note: '' },
    ],
  },
  {
    key: 'mendan',
    label: '個人面談の時間枠',
    slots: ['14:00', '14:20', '14:40', '15:00', '15:20', '15:40', '16:00', '16:20'].map((t) => ({
      name: `${t}〜`,
      when: '各20分',
      capacity: 1,
      note: '',
    })),
  },
]

const emptySlot = () => ({ name: '', when: '', capacity: 2, note: '' })

export default function Create() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [displayMode, setDisplayMode] = useState('public')
  const [slots, setSlots] = useState([emptySlot()])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { eventId, adminKey }
  const [copiedAdmin, setCopiedAdmin] = useState(false)

  function applyTemplate(tpl) {
    const dirty = slots.some((s) => s.name.trim() !== '')
    if (dirty && !confirm('入力中の枠をテンプレートで置き換えますか？')) return
    setSlots(tpl.slots.map((s) => ({ ...s })))
  }

  function setSlot(i, patch) {
    setSlots((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function removeSlot(i) {
    setSlots((list) => list.filter((_, idx) => idx !== i))
  }
  function addSlot() {
    setSlots((list) => [...list, emptySlot()])
  }

  async function submit(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return alert('タイトルを入力してください。')
    const cleaned = slots
      .map((s) => ({
        name: s.name.trim(),
        when: s.when.trim(),
        note: s.note.trim(),
        capacity: Math.max(1, Math.min(999, Number(s.capacity) || 1)),
      }))
      .filter((s) => s.name !== '')
    if (cleaned.length === 0) return alert('枠を1つ以上入力してください。')

    setBusy(true)
    try {
      const res = await createEvent({
        title: t,
        description: description.trim(),
        deadline: deadline ? new Date(deadline).getTime() : null,
        displayMode,
        slots: cleaned,
      })
      rememberMyEvent({ eventId: res.eventId, adminKey: res.adminKey, title: t, createdAt: Date.now() })
      setDone(res)
      window.scrollTo(0, 0)
    } catch (err) {
      console.error(err)
      alert('作成に失敗しました。通信環境を確認して、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const aUrl = adminUrl(done.eventId, done.adminKey)
    return (
      <div className="page">
        <div className="card paper">
          <h1 className="section-title">募集ページができました 🎉</h1>
          <p className="muted">
            参加してほしい人には下の<b>参加用リンク</b>を送ってください。
          </p>
          <ShareBox url={eventUrl(done.eventId)} title={title} label="参加用リンク（みんなに配る）" />
        </div>

        <div className="card paper warn-card">
          <h2 className="section-title">管理用URL（あなた専用）</h2>
          <div className="share-row">
            <input className="share-url" readOnly value={aUrl} onFocus={(e) => e.target.select()} />
            <button
              className="btn subtle"
              onClick={async () => {
                if (await copyText(aUrl)) {
                  setCopiedAdmin(true)
                  setTimeout(() => setCopiedAdmin(false), 1600)
                }
              }}
            >
              {copiedAdmin ? 'コピーしました' : 'コピー'}
            </button>
          </div>
          <p className="warn-text">
            ⚠️ この管理用URLは<b>必ず控えてください</b>（メモアプリ・自分宛LINEなど）。
            紛失すると枠の編集や締切変更ができなくなります。この端末のトップページにも一覧が残ります。
          </p>
          <a className="btn primary" href={aUrl}>
            管理ページを開く
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">募集ページを作る</h1>
      <form onSubmit={submit}>
        <div className="card paper">
          <label className="field">
            <span>
              タイトル <em className="req">必須</em>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="例: ○○小 運動会 お手伝い募集"
              required
            />
          </label>
          <label className="field">
            <span>説明（任意）</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="集合場所、持ち物、連絡先など"
            />
          </label>
          <label className="field">
            <span>締切（任意）</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <fieldset className="field">
            <span>名前の公開範囲</span>
            <label className="radio">
              <input
                type="radio"
                name="displayMode"
                checked={displayMode === 'public'}
                onChange={() => setDisplayMode('public')}
              />
              みんなに公開（誰がどの枠か全員に見える）
            </label>
            <label className="radio">
              <input
                type="radio"
                name="displayMode"
                checked={displayMode === 'anonymous'}
                onChange={() => setDisplayMode('anonymous')}
              />
              人数のみ公開（名簿は幹事だけが見られる）
            </label>
          </fieldset>
        </div>

        <div className="card paper">
          <h2 className="section-title">枠</h2>
          <p className="muted small">テンプレートから始めると早いです:</p>
          <div className="tpl-row">
            {TEMPLATES.map((tpl) => (
              <button type="button" key={tpl.key} className="btn subtle small" onClick={() => applyTemplate(tpl)}>
                {tpl.label}
              </button>
            ))}
          </div>

          {slots.map((s, i) => (
            <div className="slot-editor" key={i}>
              <div className="slot-editor-row">
                <input
                  className="grow"
                  value={s.name}
                  onChange={(e) => setSlot(i, { name: e.target.value })}
                  maxLength={60}
                  placeholder={`枠の名前（例: 受付）`}
                />
                <input
                  className="cap"
                  type="number"
                  min={1}
                  max={999}
                  value={s.capacity}
                  onChange={(e) => setSlot(i, { capacity: e.target.value })}
                  aria-label="定員"
                />
                <span className="unit">名</span>
              </div>
              <div className="slot-editor-row">
                <input
                  className="grow"
                  value={s.when}
                  onChange={(e) => setSlot(i, { when: e.target.value })}
                  maxLength={60}
                  placeholder="日時・場所ラベル（任意。例: 10/10 8:00〜）"
                />
                <input
                  className="grow"
                  value={s.note}
                  onChange={(e) => setSlot(i, { note: e.target.value })}
                  maxLength={200}
                  placeholder="備考（任意）"
                />
                <button
                  type="button"
                  className="link-btn danger"
                  onClick={() => removeSlot(i)}
                  disabled={slots.length <= 1}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn subtle" onClick={addSlot}>
            ＋ 枠を追加
          </button>
        </div>

        <button className="btn primary big full" type="submit" disabled={busy}>
          {busy ? '作成中…' : 'この内容で募集ページを作る'}
        </button>
        <p className="muted small center">
          作成すると、参加用URLとあなた専用の管理用URLが発行されます。
        </p>
      </form>
    </div>
  )
}
