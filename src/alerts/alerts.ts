// Báo động khi người chơi đang ở tab/ứng dụng khác: đổi tiêu đề tab + một tiếng "tách" khẽ.
// Thông báo hệ thống (Notification) để M2, sau con cá đầu tiên mới xin quyền.
import type { AlertKind, FromAlertWorker, ToAlertWorker } from './timer.worker'

const BASE_TITLE = 'Cần Thủ'

export class Alerts {
  private worker: Worker | undefined
  private audio: AudioContext | undefined
  private pending = 0

  constructor(private readonly locationName: () => string) {
    try {
      this.worker = new Worker(new URL('./timer.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (ev: MessageEvent<FromAlertWorker>) => this.fire(ev.data.kind)
    } catch {
      this.worker = undefined // không có worker: vẫn chơi được khi tab đang mở
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clearTitle()
    })
  }

  /** Gọi trong một cử chỉ người dùng (click, phím) để trình duyệt cho phép phát âm thanh về sau. */
  unlockAudio() {
    try {
      this.audio ??= new AudioContext()
      void this.audio.resume().catch(() => undefined)
    } catch {
      this.audio = undefined
    }
  }

  schedule(events: { at: number; kind: AlertKind }[]) {
    this.worker?.postMessage({ type: 'schedule', events } satisfies ToAlertWorker)
  }

  clear() {
    this.worker?.postMessage({ type: 'clear' } satisfies ToAlertWorker)
    this.clearTitle()
  }

  private fire(kind: AlertKind) {
    if (!document.hidden) return
    this.pending++
    document.title = kind === 'nibble' ? `• Phao đang động · ${this.locationName()}` : `• Có cá! · ${BASE_TITLE}`
    this.tap(kind === 'nibble' ? 660 : 880)
  }

  private clearTitle() {
    this.pending = 0
    document.title = BASE_TITLE
  }

  private tap(freq: number) {
    const a = this.audio
    if (!a || a.state !== 'running') return
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, a.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, a.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.25)
    osc.connect(gain).connect(a.destination)
    osc.start()
    osc.stop(a.currentTime + 0.3)
  }
}
