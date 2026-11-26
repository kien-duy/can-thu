/// <reference lib="webworker" />
// Worker của spike M0: giữ lịch sự kiện bằng Timeline, bắn đúng giờ, thử gửi Notification ngay từ worker.
import { delayUntil, Timeline } from '../sim/timeline'
import type { FromWorker, ScheduleItem, ToWorker } from './protocol'

declare const self: DedicatedWorkerGlobalScope

let timeline = new Timeline<ScheduleItem & { kind: 'probe' }>([])
let timer: ReturnType<typeof setTimeout> | undefined
let notify = false

const post = (m: FromWorker) => self.postMessage(m)

function tryNotify(id: string): { ok: boolean; error?: string } {
  if (!notify) return { ok: false }
  if (typeof Notification === 'undefined') return { ok: false, error: 'Notification không có trong worker' }
  if (Notification.permission !== 'granted') return { ok: false, error: `permission=${Notification.permission}` }
  try {
    new Notification('Cần Thủ · phao đang động', { body: `Mốc thử ${id}`, tag: 'can-thu-spike' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

function tick() {
  timer = undefined
  const now = Date.now()
  for (const e of timeline.drain(now)) {
    const n = tryNotify(e.id)
    post({ type: 'fired', id: e.id, at: e.at, firedAt: now, notifiedFromWorker: n.ok, notifyError: n.error })
  }
  arm()
}

function arm() {
  // Trần 1 s: worker tự tỉnh lại thường xuyên, nên dù một setTimeout dài bị bóp thì độ trễ vẫn đo được sát.
  const d = delayUntil(timeline.nextAt(), Date.now(), 1_000)
  if (d !== undefined) timer = setTimeout(tick, d)
}

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const m = ev.data
  if (timer) clearTimeout(timer)
  if (m.type === 'reset') {
    timeline = new Timeline([])
    return
  }
  notify = m.notify
  timeline = new Timeline(m.items.map((i) => ({ ...i, kind: 'probe' as const })))
  arm()
}

post({ type: 'ready', workerNotification: typeof Notification !== 'undefined' })
