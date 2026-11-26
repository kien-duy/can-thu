/**
 * Dòng thời gian sự kiện theo mốc tuyệt đối (ms epoch).
 *
 * Mô phỏng không chạy theo tick: mọi sự kiện được lên lịch trước bằng mốc thời gian, rồi được
 * "rút ra" khi đồng hồ đã vượt qua mốc đó. Trình duyệt có bóp timer lúc tab ẩn thì sự kiện chỉ
 * tới trễ, không bị mất, và thứ tự vẫn đúng.
 */
export interface TimelineEvent<K extends string = string> {
  readonly at: number
  readonly kind: K
}

export class Timeline<E extends TimelineEvent> {
  private readonly events: E[]
  private cursor = 0

  constructor(events: Iterable<E>) {
    this.events = [...events].sort((a, b) => a.at - b.at)
  }

  /** Các sự kiện đã tới hạn (at <= now) mà chưa được rút, theo đúng thứ tự thời gian. */
  drain(now: number): E[] {
    const out: E[] = []
    while (this.cursor < this.events.length) {
      const e = this.events[this.cursor]!
      if (e.at > now) break
      out.push(e)
      this.cursor++
    }
    return out
  }

  /** Mốc của sự kiện kế tiếp chưa rút, hoặc undefined khi đã hết. */
  nextAt(): number | undefined {
    return this.events[this.cursor]?.at
  }

  get done(): boolean {
    return this.cursor >= this.events.length
  }
}

/** Chờ bao lâu thì đặt setTimeout tiếp theo (không âm, có trần để tự "tỉnh" lại định kỳ). */
export function delayUntil(nextAt: number | undefined, now: number, maxMs = 60_000): number | undefined {
  if (nextAt === undefined) return undefined
  return Math.min(Math.max(0, nextAt - now), maxMs)
}
