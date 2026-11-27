/** Cài đặt riêng máy này (localStorage `can-thu:prefs`). Hàm thuần để test được ngoài trình duyệt. */
export type Quality = 'low' | 'medium' | 'high'

/** Kiểu kéo cá: 'keys' = giữ nút/Space để ghì, A/D để dòng; 'drag' = giữ chuột/ngón tay để ghì, rê ngang để dòng. */
export type FightStyle = 'keys' | 'drag'

/** Cảnh câu khi không ở chế độ văn phòng: '3d' = cảnh WebGL; '2d' = mặt cắt nhìn ngang bờ, vẽ bằng SVG, không tải 3D. */
export type SceneKind = '3d' | '2d'

export interface Prefs {
  quality: Quality
  floatSize: 's' | 'm' | 'l'
  sound: boolean
  /** góc rộng: camera lùi xa nhìn toàn cảnh hồ */
  wide: boolean
  xray: boolean
  fightStyle: FightStyle
  scene: SceneKind
}

export const DEFAULT_PREFS: Prefs = { quality: 'medium', floatSize: 'm', sound: true, wide: false, xray: false, fightStyle: 'keys', scene: '3d' }

const pick = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)

/** Đọc bản lưu: thiếu hoặc sai giá trị nào thì lấy mặc định của giá trị đó (bản lưu cũ chưa có kiểu kéo cá, chưa có mặt cắt 2D). */
export function parsePrefs(raw: unknown): Prefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_PREFS
  return {
    quality: pick(r.quality, ['low', 'medium', 'high'] as const, d.quality),
    floatSize: pick(r.floatSize, ['s', 'm', 'l'] as const, d.floatSize),
    sound: pick(r.sound, [true, false], d.sound),
    wide: pick(r.wide, [true, false], d.wide),
    xray: pick(r.xray, [true, false], d.xray),
    fightStyle: pick(r.fightStyle, ['keys', 'drag'] as const, d.fightStyle),
    scene: pick(r.scene, ['3d', '2d'] as const, d.scene),
  }
}
