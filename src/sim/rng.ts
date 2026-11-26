/** Mulberry32: RNG 32-bit có seed. Cùng seed cho cùng chuỗi số, nên mọi lượt câu tái hiện được trong test. */
export type Rng = () => number

/** Một bước thuần của mulberry32: trả về [số trong [0,1), trạng thái mới]. Dùng khi cần lưu trạng thái RNG trong state. */
export function rngStep(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a]
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    const [x, next] = rngStep(s)
    s = next
    return x
  }
}

/** Số thực đều trong [min, max). */
export function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}

/** Chọn theo trọng số. */
export function weighted<T>(rng: Rng, items: readonly { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = rng() * total
  for (const i of items) {
    r -= i.weight
    if (r < 0) return i.item
  }
  return items[items.length - 1]!.item
}
