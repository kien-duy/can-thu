/** Tin nhắn giữa trang spike và worker. */
export interface ScheduleItem {
  id: string
  at: number
}

export type ToWorker =
  | { type: 'schedule'; items: ScheduleItem[]; notify: boolean }
  | { type: 'reset' }

export type FromWorker =
  | { type: 'ready'; workerNotification: boolean }
  | {
      type: 'fired'
      id: string
      at: number
      firedAt: number
      notifiedFromWorker: boolean
      notifyError?: string
    }
