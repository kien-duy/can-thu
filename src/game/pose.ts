import { floatOffset } from '../sim/bite'
import type { GameState } from '../sim/game'

export interface FloatPose {
  /** phao đang nằm trên mặt nước (đã quăng, chưa bị cá kéo chìm) */
  visible: boolean
  /** lệch so với nấc câu, đơn vị nấc; dương = chìm */
  sink: number
  /** góc nghiêng, radian (phao nằm ngang lúc mới quăng) */
  tilt: number
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function floatPose(g: GameState, t: number): FloatPose {
  if (g.phase === 'sinking' && g.cast) {
    const p = (t - g.cast.at) / Math.max(1, g.cast.settledAt - g.cast.at)
    return { visible: true, sink: -2.5 * (1 - ease(p)), tilt: (1 - ease(p / 0.45)) * (Math.PI / 2) }
  }
  if (g.phase === 'waiting' && g.bite) return { visible: true, sink: floatOffset(g.bite, t), tilt: 0 }
  return { visible: false, sink: 0, tilt: 0 }
}
