import {
  ref,
  set,
  get,
  update,
  push,
  remove,
  onValue,
  runTransaction,
} from 'firebase/database'
import { db, ensureAuth } from './firebase.js'
import { randomId } from './lib.js'

// ---------------------------------------------------------------
// イベント作成
// 書き込み順序が重要: secret → meta → slots → roster
// （slots / roster の書き込み権限判定が meta/ownerUid を参照するため、meta が先に必要。
//   secret/adminKey は「未存在なら誰でも1回だけ書ける」ルールなので、
//   eventId が推測不能な乱数であることが前提）
// ---------------------------------------------------------------
export async function createEvent({
  title,
  description,
  deadline,
  cancelUntil,
  displayMode,
  entryMode,
  roster,
  slots,
}) {
  const uid = await ensureAuth()
  const eventId = randomId(14)
  const adminKey = randomId(26)
  const base = `events/${eventId}`

  await set(ref(db, `${base}/secret/adminKey`), adminKey)

  const meta = {
    title,
    description: description || '',
    displayMode,
    entryMode: entryMode === 'roster' ? 'roster' : 'free',
    locked: false,
    ownerUid: uid,
    createdAt: Date.now(),
  }
  if (deadline) meta.deadline = deadline
  if (cancelUntil) meta.cancelUntil = cancelUntil
  await set(ref(db, `${base}/meta`), meta)

  const slotsObj = {}
  slots.forEach((s, i) => {
    const key = push(ref(db, `${base}/slots`)).key
    slotsObj[key] = {
      name: s.name,
      capacity: s.capacity,
      when: s.when || '',
      note: s.note || '',
      order: i,
    }
  })
  await set(ref(db, `${base}/slots`), slotsObj)

  if (meta.entryMode === 'roster' && Array.isArray(roster) && roster.length > 0) {
    const rosterObj = {}
    roster.forEach((name, i) => {
      const key = push(ref(db, `${base}/roster`)).key
      rosterObj[key] = { name, order: i }
    })
    await set(ref(db, `${base}/roster`), rosterObj)
  }

  return { eventId, adminKey }
}

// ---------------------------------------------------------------
// 購読: meta / slots / roster / counts / entries を個別に listen して合成
// （event ルート一括読みにすると secret まで読めるルールが必要になるため分割）
// meta === undefined: 読み込み中, meta === null: 存在しない
// ---------------------------------------------------------------
export function subscribeEvent(eventId, cb) {
  const state = { meta: undefined, slots: {}, roster: {}, counts: {}, entries: {} }
  const listen = (path, key, emptyValue) =>
    onValue(
      ref(db, `events/${eventId}/${path}`),
      (snap) => {
        const v = snap.val()
        state[key] = v === null ? emptyValue : v
        cb({ ...state })
      },
      () => {
        // 読み取りエラー時も落とさない
        state[key] = emptyValue
        cb({ ...state, error: true })
      }
    )
  const offs = [
    listen('meta', 'meta', null),
    listen('slots', 'slots', {}),
    listen('roster', 'roster', {}),
    listen('counts', 'counts', {}),
    listen('entries', 'entries', {}),
  ]
  return () => offs.forEach((off) => off())
}

// ---------------------------------------------------------------
// 記入（このアプリの心臓部）
// 1) counts/{slotId} をトランザクションでインクリメント（定員チェック）
//    → 「残り1枠に同時タップ」の競合をここで潰す。ルール側でも二重に強制。
// 2) 成功したら entries に push（名簿モードでは memberId 必須・名前一致をルールが強制）
// 3) entries 書き込みに失敗したら counts を戻す（ベストエフォート）
//    失敗して戻せなかった場合の「幽霊枠」は管理画面の再集計で修復できる。
// ---------------------------------------------------------------
export async function joinSlot(eventId, slotId, capacity, { name, memo, memberId }) {
  const uid = await ensureAuth()
  const countRef = ref(db, `events/${eventId}/counts/${slotId}`)

  const res = await runTransaction(countRef, (cur) => {
    const c = cur || 0
    if (c >= capacity) return // undefined を返すと中断
    return c + 1
  })
  if (!res.committed) {
    const e = new Error('この枠は満員です')
    e.code = 'FULL'
    throw e
  }

  try {
    const entryRef = push(ref(db, `events/${eventId}/entries/${slotId}`))
    const entry = {
      name,
      memo: memo || '',
      uid,
      createdAt: Date.now(),
    }
    if (memberId) entry.memberId = memberId
    await set(entryRef, entry)
    return entryRef.key
  } catch (err) {
    await runTransaction(countRef, (c) => Math.max(0, (c || 0) - 1)).catch(() => {})
    throw err
  }
}

// 自分の記入の取り消し（ルールが uid 一致と取り消し期限を強制）
export async function cancelEntry(eventId, slotId, entryId) {
  await ensureAuth()
  await remove(ref(db, `events/${eventId}/entries/${slotId}/${entryId}`))
  await runTransaction(ref(db, `events/${eventId}/counts/${slotId}`), (c) =>
    Math.max(0, (c || 0) - 1)
  )
}

// ---------------------------------------------------------------
// 管理者クレーム:
// adminProof/{自分のuid} に adminKey を書く。ルール側で
// 「secret/adminKey と一致する値しか書けない」ため、
// 書き込みが成功した uid = 正しい管理URLを知っている人、と証明される。
// 以降のルール判定は adminProof/{uid} の存在チェックで行う。
// ---------------------------------------------------------------
export async function claimAdmin(eventId, adminKey) {
  const uid = await ensureAuth()
  await set(ref(db, `events/${eventId}/adminProof/${uid}`), adminKey)
  return uid
}

export async function adminDeleteEntry(eventId, slotId, entryId) {
  await ensureAuth()
  await remove(ref(db, `events/${eventId}/entries/${slotId}/${entryId}`))
  await runTransaction(ref(db, `events/${eventId}/counts/${slotId}`), (c) =>
    Math.max(0, (c || 0) - 1)
  )
}

export async function saveMeta(eventId, patch) {
  await ensureAuth()
  await update(ref(db, `events/${eventId}/meta`), patch)
}

// 削除／復旧（論理削除）
// 参加者からは「募集が見つかりません」に見え、記入・カウント増加もルールでブロックされる。
// 管理URL保持者は復旧できる。物理削除ではないので誤操作耐性がある。
export async function setDeleted(eventId, deleted) {
  await ensureAuth()
  await update(ref(db, `events/${eventId}/meta`), { deleted: deleted === true })
}

// 名簿の保存（丸ごと置き換え。記入済みエントリーは名前のスナップショットを持つため影響なし）
export async function saveRoster(eventId, names) {
  await ensureAuth()
  const rosterObj = {}
  names.forEach((name, i) => {
    const key = push(ref(db, `events/${eventId}/roster`)).key
    rosterObj[key] = { name, order: i }
  })
  await set(ref(db, `events/${eventId}/roster`), rosterObj)
}

// slotId が null なら新規追加
export async function saveSlot(eventId, slotId, data) {
  await ensureAuth()
  if (slotId) {
    await update(ref(db, `events/${eventId}/slots/${slotId}`), data)
    return slotId
  }
  const key = push(ref(db, `events/${eventId}/slots`)).key
  await set(ref(db, `events/${eventId}/slots/${key}`), data)
  return key
}

// 枠削除は 枠・記入・カウント を1回のマルチパス更新でまとめて消す
export async function deleteSlot(eventId, slotId) {
  await ensureAuth()
  await update(ref(db), {
    [`events/${eventId}/slots/${slotId}`]: null,
    [`events/${eventId}/entries/${slotId}`]: null,
    [`events/${eventId}/counts/${slotId}`]: null,
  })
}

// counts を entries の実数から作り直す（幽霊枠の修復）。管理者のみルールが許可。
export async function recountEvent(eventId) {
  await ensureAuth()
  const [slotsSnap, entriesSnap] = await Promise.all([
    get(ref(db, `events/${eventId}/slots`)),
    get(ref(db, `events/${eventId}/entries`)),
  ])
  const slots = slotsSnap.val() || {}
  const entries = entriesSnap.val() || {}
  const patch = {}
  Object.keys(slots).forEach((slotId) => {
    patch[`events/${eventId}/counts/${slotId}`] = Object.keys(entries[slotId] || {}).length
  })
  if (Object.keys(patch).length > 0) await update(ref(db), patch)
}
