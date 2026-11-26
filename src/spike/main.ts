// Spike M0: báo động khi tab ẩn có tới đúng giờ không?
// Đo 3 đường song song cho mỗi mốc: timer trong Dedicated Worker, timer ở main thread (đối chứng),
// cùng trạng thái tab, AudioContext và Notification lúc sự kiện tới.
import type { FromWorker, ScheduleItem, ToWorker } from './protocol'

type Path = 'worker' | 'main'

interface Row {
  id: string
  path: Path
  at: number
  firedAt?: number
  receivedAt?: number
  hidden?: boolean
  audio?: AudioContextState | 'none'
  notified?: 'worker' | 'main' | 'no'
  notifyError?: string
}

const PRESETS: Record<string, number[]> = {
  nhanh: [5, 15, 30],
  day_du: [30, 120, 600],
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const STORAGE_KEY = 'can-thu-spike-results'
const baseTitle = document.title

let rows: Row[] = []
let audio: AudioContext | undefined
let workerHasNotification = false
let firedCount = 0
const mainTimers: ReturnType<typeof setTimeout>[] = []

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
worker.onmessage = (ev: MessageEvent<FromWorker>) => {
  const m = ev.data
  if (m.type === 'ready') {
    workerHasNotification = m.workerNotification
    $('#env').textContent = envText()
    return
  }
  const row = rows.find((r) => r.id === m.id && r.path === 'worker')
  if (!row) return
  row.firedAt = m.firedAt
  row.receivedAt = Date.now()
  row.notified = m.notifiedFromWorker ? 'worker' : 'no'
  row.notifyError = m.notifyError
  alertUser(row, !m.notifiedFromWorker)
}

function envText(): string {
  const perm = typeof Notification === 'undefined' ? 'không hỗ trợ' : Notification.permission
  return `UA: ${navigator.userAgent}\nNotification ở trang: ${perm} · Notification trong worker: ${workerHasNotification ? 'có' : 'không'}`
}

function beep() {
  if (!audio || audio.state !== 'running') return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.4)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.45)
}

function alertUser(row: Row, notifyFromMain: boolean) {
  row.hidden = document.hidden
  row.audio = audio ? audio.state : 'none'
  if (row.path === 'worker') {
    firedCount++
    document.title = `• Phao động (${firedCount}) · ${baseTitle}`
    beep()
    if (notifyFromMain && $<HTMLInputElement>('#notify').checked && Notification.permission === 'granted') {
      try {
        new Notification('Cần Thủ · phao đang động', { body: `Mốc thử ${row.id} (gửi từ trang)`, tag: 'can-thu-spike' })
        row.notified = 'main'
      } catch (e) {
        row.notifyError = String(e)
      }
    }
  }
  render()
  save()
}

function lateness(r: Row): string {
  return r.receivedAt === undefined ? '…' : `${r.receivedAt - r.at} ms`
}

function render() {
  const tbody = $('#rows')
  tbody.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr')
      tr.dataset.testid = `row-${r.path}-${r.id}`
      tr.dataset.done = String(r.receivedAt !== undefined)
      const cells = [
        r.id,
        r.path,
        new Date(r.at).toLocaleTimeString('vi-VN'),
        lateness(r),
        r.hidden === undefined ? '' : r.hidden ? 'ẩn' : 'hiện',
        r.audio ?? '',
        r.notified ?? '',
        r.notifyError ?? '',
      ]
      for (const c of cells) {
        const td = document.createElement('td')
        td.textContent = c
        tr.append(td)
      }
      return tr
    }),
  )
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ua: navigator.userAgent, rows }))
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
}

async function start(preset: string) {
  // Cú click này là "cử chỉ người dùng": mở khoá âm thanh và xin quyền thông báo.
  audio ??= new AudioContext()
  await audio.resume().catch(() => undefined)
  const wantNotify = $<HTMLInputElement>('#notify').checked
  if (wantNotify && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => undefined)
  }
  $('#env').textContent = envText()

  mainTimers.splice(0).forEach(clearTimeout)
  firedCount = 0
  document.title = baseTitle
  const now = Date.now()
  const items: ScheduleItem[] = (PRESETS[preset] ?? PRESETS.nhanh!).map((s) => ({ id: `${s}s`, at: now + s * 1000 }))
  rows = items.flatMap((i) => [
    { id: i.id, path: 'worker' as const, at: i.at },
    { id: i.id, path: 'main' as const, at: i.at },
  ])
  worker.postMessage({ type: 'schedule', items, notify: wantNotify } satisfies ToWorker)
  for (const i of items) {
    mainTimers.push(
      setTimeout(() => {
        const row = rows.find((r) => r.id === i.id && r.path === 'main')
        if (!row) return
        row.firedAt = row.receivedAt = Date.now()
        alertUser(row, false)
      }, i.at - now),
    )
  }
  render()
  $('#status').textContent = `Đã lên lịch ${items.map((i) => i.id).join(', ')}. Giờ chuyển sang tab/ứng dụng khác và đợi.`
}

$('#start-fast').addEventListener('click', () => void start('nhanh'))
$('#start-full').addEventListener('click', () => void start('day_du'))
$('#copy').addEventListener('click', () => {
  const text = JSON.stringify({ ua: navigator.userAgent, rows }, null, 2)
  void navigator.clipboard.writeText(text).then(
    () => ($('#status').textContent = 'Đã chép kết quả.'),
    () => ($('#status').textContent = text),
  )
})
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) document.title = baseTitle
})

$('#env').textContent = envText()
