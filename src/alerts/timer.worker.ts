/// <reference lib="webworker" />
// Giữ lịch báo động trong Dedicated Worker: timer ở đây ít bị bóp hơn main thread khi tab ẩn (đo ở spike M0).
import { delayUntil, Timeline } from '../sim/timeline'

declare const self: DedicatedWorkerGlobalScope

export type AlertKind = 'nibble' | 'window'
export type ToAlertWorker = { type: 'schedule'; events: { at: number; kind: AlertKind }[] } | { type: 'clear' }
export type FromAlertWorker = { type: 'fire'; kind: AlertKind; at: number; firedAt: number }

let timeline = new Timeline<{ at: number; kind: AlertKind }>([])
let timer: ReturnType<typeof setTimeout> | undefined

function arm() {
  if (timer) clearTimeout(timer)
  const d = delayUntil(timeline.nextAt(), Date.now(), 1_000)
  timer = d === undefined ? undefined : setTimeout(tick, d)
}

function tick() {
  const now = Date.now()
  for (const e of timeline.drain(now)) self.postMessage({ type: 'fire', kind: e.kind, at: e.at, firedAt: now } satisfies FromAlertWorker)
  arm()
}

self.onmessage = (ev: MessageEvent<ToAlertWorker>) => {
  timeline = new Timeline(ev.data.type === 'schedule' ? ev.data.events : [])
  arm()
}
