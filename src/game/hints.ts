import { speciesOf } from '../content'
import { LANDABLE_STAMINA } from '../sim/fight'
import { type GameState, waitStatus } from '../sim/game'
import type { FightStyle } from './prefs'

export interface HintContext {
  hasBait: boolean
  sounded: boolean
  /** kiểu kéo cá đang chọn trong Cài đặt (mặc định: phím) */
  fightStyle?: FightStyle
}

/** Nút hành động chính và dòng gợi ý theo tình huống (giọng văn: thong thả, rành nghề, gần gũi). */
export interface ActionHint {
  label: string
  hint: string
  /** 'hold' = giữ rồi thả; 'tap' = bấm */
  mode: 'hold' | 'tap' | 'none'
  urgent?: boolean
}

export function actionFor(s: GameState, t: number, ctx: HintContext = { hasBait: true, sounded: true }): ActionHint {
  switch (s.phase) {
    case 'ready':
      if (!ctx.hasBait) return { label: 'Giữ để quăng', hint: 'Hết mồi rồi. Mở Chuẩn bị → Mồi để trộn chậu mới, không thì cá rất ít ăn.', mode: 'hold' }
      if (!ctx.sounded) return { label: 'Giữ để quăng', hint: 'Mồi trên lưỡi rồi. Chưa dò đáy: mở Chuẩn bị → Cân phao để mồi nằm đúng chỗ.', mode: 'hold' }
      return { label: 'Giữ để quăng', hint: 'Mồi trên lưỡi rồi. Giữ để lấy đà, thả ra để quăng.', mode: 'hold' }
    case 'charging':
      return { label: 'Thả để quăng', hint: 'Giữ càng lâu quăng càng xa.', mode: 'hold' }
    case 'sinking':
      return { label: 'Nhấc cần', hint: 'Mồi đang chìm xuống đáy, phao dựng dần lên.', mode: 'tap' }
    case 'waiting': {
      const w = waitStatus(s, t)
      if (w === 'nibbling') return { label: 'Giật', hint: 'Có cá quanh mồi. Đừng vội.', mode: 'tap' }
      if (w === 'window') return { label: 'Giật', hint: 'Giờ!', mode: 'tap', urgent: true }
      if (w === 'after') return { label: 'Giật', hint: 'Phao đang trả về nấc cũ…', mode: 'tap' }
      return { label: 'Giật', hint: 'Phao đứng yên. Cứ làm việc, cá tới phao sẽ báo.', mode: 'tap' }
    }
    case 'fighting':
      return {
        label: s.reeling ? 'Đang ghì' : 'Giữ để ghì',
        hint: fightHint(s, ctx.fightStyle ?? 'keys'),
        mode: 'hold',
        urgent: (s.fight?.tension ?? 0) > 0.8,
      }
    case 'landable':
      return { label: 'Vớt', hint: 'Cá đuối rồi, nổi đầu cạnh bờ. Vớt đi, chần chừ là cá lặn mất!', mode: 'tap', urgent: true }
    case 'result':
      return { label: 'Câu tiếp', hint: resultText(s), mode: 'tap' }
  }
}

export const ANNOUNCE_TIGHT = 'Dây căng quá, thả tay ra!'
const ANNOUNCE_DIR = { [-1]: 'Cá chạy sang trái, dòng cần sang phải.', 0: 'Cá ghì thẳng.', 1: 'Cá chạy sang phải, dòng cần sang trái.' } as const

/**
 * Lời đọc cho trình đọc màn hình (vùng aria-live riêng). Lời gợi ý trên màn hình đổi liên tục trong trận kéo;
 * lời đọc chỉ đổi khi có chuyện: cá đổi hướng, cá đuối, dây sắp đứt, có kết quả. Ngoài trận kéo thì đọc đúng
 * lời gợi ý (vốn chỉ đổi theo pha). `prev` là lời vừa đọc: dây căng thì giữ lời cảnh báo tới khi căng dưới 0.6,
 * để độ căng lượn quanh ngưỡng không làm đọc đi đọc lại.
 */
export function announceFor(s: GameState, t: number, ctx: HintContext | undefined, prev: string): string {
  if (s.phase !== 'fighting') return actionFor(s, t, ctx).hint
  const f = s.fight
  if (!f) return prev
  if (f.tension > 0.8 || (prev === ANNOUNCE_TIGHT && f.tension > 0.6)) return ANNOUNCE_TIGHT
  if (f.stamina <= LANDABLE_STAMINA) return 'Cá đuối rồi, thu dây vào bờ.'
  return ANNOUNCE_DIR[f.fishDir]
}

function fightHint(s: GameState, style: FightStyle): string {
  const f = s.fight
  const drag = style === 'drag'
  if ((f?.tension ?? 0) > 0.8) return 'Dây căng quá, thả tay ra!'
  if (f?.fishDir === -1) return f.rodSide === 1 ? 'Cá chạy trái, cần đang dòng phải. Đúng bài, cá sẽ đuối nhanh.' : `Cá chạy sang trái. Dòng cần ngược hướng cá chạy: ${drag ? 'rê sang phải' : 'giữ D hoặc ▶'}.`
  if (f?.fishDir === 1) return f.rodSide === -1 ? 'Cá chạy phải, cần đang dòng trái. Đúng bài, cá sẽ đuối nhanh.' : `Cá chạy sang phải. Dòng cần ngược hướng cá chạy: ${drag ? 'rê sang trái' : 'giữ A hoặc ◀'}.`
  return drag
    ? 'Giữ chuột hoặc ngón tay để thu dây, nhấc lên khi dây căng đỏ. Cá chạy ngang thì rê ngược hướng cá chạy.'
    : 'Giữ để thu dây, thả khi dây căng đỏ. Cá chạy ngang thì dòng cần ngược hướng cá chạy.'
}

function resultText(s: GameState): string {
  const r = s.result
  if (!r) return ''
  const name = 'speciesId' in r ? speciesOf(r.speciesId).nameVi.toLowerCase() : ''
  switch (r.kind) {
    case 'landed':
      return `${speciesOf(r.fish.speciesId).nameVi} lên bờ rồi.`
    case 'short_cast':
      return 'Thả vội quá, mồi rơi ngay chân. Giữ lâu hơn chút.'
    case 'nothing':
      return 'Chưa có cá. Nhấc cần lên rồi, quăng lại nhé.'
    case 'too_early':
      return `Sớm quá, ${name} mới thử mồi.`
    case 'too_late':
      return `Muộn rồi, ${name} đã nhả mồi.`
    case 'bait_gone':
      return 'Mồi rã hết rồi, phao nổi về nấc cân. Nhấc cần móc mồi mới. Mồi tơi rã nhanh, mồi có bột kéo sợi bền hơn.'
    case 'gone':
      return `${capital(name)} ăn xong mồi rồi bỏ đi. Lần sau thấy phao đứng hẳn là giật.`
    case 'broke':
      return 'Phựt. Thẻo đứt, cá đi rồi. Lần sau thả tay khi dây căng đỏ.'
    case 'rod_broke':
      return 'Rắc, gãy cần, cá đi rồi. Dây căng đỏ là thả tay ngay. Dây khoẻ hơn cần nhiều thì lúc quá tải cần gánh hết lực: chọn dây vừa sức cần.'
    case 'escaped':
      if (r.reason === 'unhooked') return 'Tuột lưỡi: lưỡi nhỏ so với cá. Gặp cá cỡ này thì buộc lưỡi to hơn.'
      return 'Cá chạy xa quá, tuột lưỡi rồi.'
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
