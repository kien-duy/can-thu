import { speciesOf } from '../content'
import { type GameState, waitStatus } from '../sim/game'

export interface HintContext {
  hasBait: boolean
  sounded: boolean
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
        hint: fightHint(s),
        mode: 'hold',
        urgent: (s.fight?.tension ?? 0) > 0.8,
      }
    case 'landable':
      return { label: 'Vớt', hint: 'Cá đuối rồi, nổi đầu cạnh bờ. Vớt đi, chần chừ là cá lặn mất!', mode: 'tap', urgent: true }
    case 'result':
      return { label: 'Câu tiếp', hint: resultText(s), mode: 'tap' }
  }
}

function fightHint(s: GameState): string {
  const f = s.fight
  if ((f?.tension ?? 0) > 0.8) return 'Dây căng quá, thả tay ra!'
  if (f?.fishDir === -1) return f.rodSide === 1 ? 'Cá chạy trái, cần đang dòng phải. Đúng bài, cá sẽ đuối nhanh.' : 'Cá chạy sang trái. Dòng cần ngược hướng cá chạy: giữ D hoặc ▶.'
  if (f?.fishDir === 1) return f.rodSide === -1 ? 'Cá chạy phải, cần đang dòng trái. Đúng bài, cá sẽ đuối nhanh.' : 'Cá chạy sang phải. Dòng cần ngược hướng cá chạy: giữ A hoặc ◀.'
  return 'Giữ để thu dây, thả khi dây căng đỏ. Cá chạy ngang thì dòng cần ngược hướng cá chạy.'
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
