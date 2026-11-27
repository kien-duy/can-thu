import { useEffect, useMemo, useState } from 'react'
import { type Location, SPECIES, speciesOf } from '../content'
import { floatOffset, judgeStrike, planSpeciesBite, roundAt, type SpeciesBitePlan, type StrikeResult } from '../sim/bite'
import { createRng } from '../sim/rng'
import { FloatSvg } from './FloatView'

/**
 * Kho nhịp phao (S12): xem thử cách ăn phao của từng loài, bấm "Giật" để tập tay.
 * Mỗi lần xem là một mô phỏng riêng, chạy nhanh hơn thật, không ảnh hưởng ca đang câu.
 */
const DEMO_SCALE = 0.3

function demoPlan(speciesId: string, seed: number, t0: number): SpeciesBitePlan {
  const loc: Location = {
    id: 'demo',
    nameVi: 'demo',
    kind: 'fee_pond',
    summary: '-',
    bottomDepthCm: 150,
    castDistanceM: [5, 6],
    waitSec: [8, 12],
    tickets: [],
    minLevel: 1,
    saleFactor: 1,
    theme: 'fee_pond',
    species: [{ id: speciesId, weight: 1 }],
  }
  return planSpeciesBite(createRng(seed), loc, SPECIES, { castAt: t0, settledAt: t0, hour: 12, timeScale: DEMO_SCALE })
}

const VERDICT: Record<StrikeResult, string> = {
  hooked: 'Dính! Đúng nhịp ăn thật.',
  too_early: 'Sớm quá: cá mới rỉa thử.',
  too_late: 'Muộn rồi: cá đã nhả mồi.',
  nothing: 'Chưa có cá: phao chưa báo gì.',
}

export function RhythmLab({ unlocked }: { unlocked: Set<string> }) {
  const list = SPECIES.filter((s) => unlocked.has(s.id))
  const [speciesId, setSpecies] = useState(list[0]?.id ?? 'ro_phi_den')
  const [run, setRun] = useState(() => ({ seed: 1, t0: Date.now() }))
  const [now, setNow] = useState(() => Date.now())
  const [verdict, setVerdict] = useState<string>()
  const plan = useMemo(() => demoPlan(speciesId, run.seed, run.t0), [speciesId, run])
  useEffect(() => {
    let raf = 0
    const f = () => {
      setNow(Date.now())
      raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (list.length === 0) return <p className="muted">Câu được một loài để mở nhịp phao của loài đó.</p>
  const sp = speciesOf(speciesId)
  const round = roundAt(plan, now)
  const phase = now < plan.nibbleStart ? 'Chờ cá…' : now < round.strikeOpen ? 'Cá đang rỉa: chờ' : now <= round.strikeClose ? 'Ăn thật: GIẬT!' : 'Cá nhả mồi'
  const restart = (sid = speciesId) => {
    setSpecies(sid)
    setRun((r) => ({ seed: r.seed + 1, t0: Date.now() }))
    setVerdict(undefined)
  }
  return (
    <div className="lab">
      <div className="row">
        {list.map((s) => (
          <button key={s.id} type="button" className={`choice choice--inline${s.id === speciesId ? ' is-active' : ''}`} aria-pressed={s.id === speciesId} onClick={() => restart(s.id)}>
            {s.nameVi}
          </button>
        ))}
      </div>
      <div className="lab__body">
        <div className="lab__float">
          <FloatSvg pose={{ visible: true, sink: floatOffset(plan, now), tilt: 0 }} alert={now >= round.strikeOpen && now <= round.strikeClose} />
        </div>
        <div className="stack">
          <p>
            <strong>{sp.nameVi}:</strong> {sp.floatTell}
          </p>
          <p className="muted" aria-live="polite">
            {phase}
          </p>
          <div className="row">
            <button type="button" className="primary" data-testid="lab-strike" onClick={() => setVerdict(VERDICT[judgeStrike(plan, Date.now())])}>
              Giật!
            </button>
            <button type="button" className="ghost" onClick={() => restart()}>
              Xem lại
            </button>
          </div>
          {verdict && <p data-testid="lab-verdict">{verdict}</p>}
          <p className="muted small">Chạy nhanh gấp khoảng 3 lần thật. Cửa sổ giật vẫn giữ đúng độ dài như khi câu.</p>
        </div>
      </div>
    </div>
  )
}
