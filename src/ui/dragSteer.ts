/**
 * Kiểu kéo "rê": vị trí ngang của chuột/ngón tay trên mặt kéo cá → góc cần.
 * Sim chỉ có ba thế cần (-1 trái, 0 thẳng, 1 phải) giống phím A/D, nên ở đây chia ba vùng với một vùng chết ở giữa.
 */

/** Nửa bề rộng vùng giữa (tính theo nửa bề rộng mặt kéo): rê lệch ít hơn ngần này thì cần vẫn thẳng. */
export const DRAG_DEAD_ZONE = 0.2

/** Góc ngắm liên tục trong [-1, 1]: -1 mép trái, 0 giữa, 1 mép phải (ngoài mép thì kẹp lại). */
export function aimAt(x: number, left: number, width: number): number {
  if (!(width > 0)) return 0
  const u = ((x - left) / width) * 2 - 1
  return Math.max(-1, Math.min(1, u))
}

/** Góc ngắm → thế cần cho sim, cùng giá trị phím A/D gửi đi. */
export function sideFromAim(aim: number): -1 | 0 | 1 {
  if (aim <= -DRAG_DEAD_ZONE) return -1
  if (aim >= DRAG_DEAD_ZONE) return 1
  return 0
}
