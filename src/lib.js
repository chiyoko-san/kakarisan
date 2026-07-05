// 紛らわしい文字（0/O, 1/l/I）を除いたID用文字セット
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function randomId(len) {
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  let s = ''
  for (const b of buf) s += ALPHA[b % ALPHA.length]
  return s
}

export function fmtDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// datetime-local の value（ローカル時刻文字列）とエポックmsの相互変換
export function toLocalInput(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function baseUrl() {
  return window.location.href.split('#')[0]
}
export function eventUrl(eventId) {
  return `${baseUrl()}#/e/${eventId}`
}
export function adminUrl(eventId, adminKey) {
  return `${baseUrl()}#/a/${eventId}/${adminKey}`
}

export function lineShareUrl(text) {
  return 'https://line.me/R/share?text=' + encodeURIComponent(text)
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // http配信や古いブラウザ向けフォールバック
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

// Excel(日本語)で文字化けしないよう BOM 付き UTF-8
export function downloadCsv(filename, rows) {
  const csv =
    '\uFEFF' +
    rows
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* private mode などは黙って諦める */
    }
  },
}

// この端末で作った募集（管理URLのなくしもの防止）
export function rememberMyEvent(rec) {
  const list = store.get('bts_my_events', []).filter((e) => e.eventId !== rec.eventId)
  list.unshift(rec)
  store.set('bts_my_events', list.slice(0, 20))
}
export function myEvents() {
  return store.get('bts_my_events', [])
}
