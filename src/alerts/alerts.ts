// Báo động khi người chơi đang ở tab/ứng dụng khác: đổi tiêu đề tab, một tiếng "tách" khẽ,
// và thông báo hệ thống nếu người chơi đã cho phép (xin quyền sau con cá đầu tiên, không xin lúc mở game).
// Timer nằm trong worker; tin nhắn từ worker tới trang không bị bóp như timer nên thông báo gửi từ trang.
import type { AlertKind, FromAlertWorker, ToAlertWorker } from './timer.worker'

const BASE_TITLE = 'Cần Thủ'

export class Alerts {
  private worker: Worker | undefined
  private audio: AudioContext | undefined
  private pending = 0
  private notify = typeof Notification !== 'undefined' && Notification.permission === 'granted'

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

  private sound = true

  setSound(on: boolean) {
    this.sound = on
  }

  setNotify(on: boolean) {
    this.notify = on
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
    if (this.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(kind === 'nibble' ? 'Phao đang động' : 'Có cá!', {
          body: kind === 'nibble' ? `Có cá quanh mồi ở ${this.locationName()}. Quay lại xem phao.` : 'Phao đang báo ăn thật, giật đi!',
          tag: 'can-thu-bite',
          silent: true,
        })
        n.onclick = () => {
          window.focus()
          n.close()
        }
      } catch {
        /* một số trình duyệt chỉ cho gửi qua service worker: vẫn còn tiêu đề tab và âm thanh */
      }
    }
  }

  private clearTitle() {
    this.pending = 0
    document.title = BASE_TITLE
  }

  private tap(freq: number) {
    const a = this.audio
    if (!this.sound || !a || a.state !== 'running') return
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
