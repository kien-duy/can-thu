import type { Location } from '../content'
import type { Weather, WeatherKind } from '../data/types'
import { between, createRng, weighted } from './rng'

/** Múi giờ của thiết bị: "giờ thật" của game là giờ trên máy người chơi. */
export const DEVICE_TZ: string = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
  } catch {
    return 'Asia/Ho_Chi_Minh'
  }
})()

/** Giờ địa phương (0–23) theo múi giờ của người chơi. Đồng hồ game = đồng hồ thật. */
export function localHour(ms: number, timeZone = DEVICE_TZ): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(ms)
  return Number(h) % 24
}

export function clockLabel(ms: number, timeZone = DEVICE_TZ): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone }).format(ms)
}

export function dayPart(hour: number): string {
  if (hour < 5) return 'Đêm'
  if (hour < 8) return 'Sáng sớm'
  if (hour < 11) return 'Buổi sáng'
  if (hour < 14) return 'Trưa'
  if (hour < 17) return 'Buổi chiều'
  if (hour < 19) return 'Chiều tà'
  return 'Tối'
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Thời tiết của một ngày ở một địa điểm: tất định theo (ngày, địa điểm), ai mở game hôm đó cũng thấy giống nhau. */
export function weatherFor(ms: number, loc: Location, timeZone = DEVICE_TZ): Weather {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone }).format(ms) // yyyy-mm-dd
  const rng = createRng(hashString(`${day}:${loc.id}`))
  const kind = weighted<WeatherKind>(rng, [
    { item: 'sunny', weight: 5 },
    { item: 'cloudy', weight: 3 },
    { item: 'rain', weight: 1.5 },
    { item: 'fog', weight: 0.5 },
  ])
  const tempC = Math.round(between(rng, kind === 'rain' ? 22 : 25, kind === 'sunny' ? 34 : 30))
  return {
    kind,
    tempC,
    windMs: Math.round(between(rng, 0.5, 4.5) * 10) / 10,
    waterTempC: Math.round((tempC - between(rng, 1, 3)) * 10) / 10,
  }
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  sunny: 'Nắng',
  cloudy: 'Nhiều mây',
  rain: 'Mưa',
  storm: 'Giông',
  fog: 'Sương mù',
}

export function dateTimeLabel(ms: number, timeZone = DEVICE_TZ): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(ms)
}
