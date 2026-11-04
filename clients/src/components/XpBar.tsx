/** XpBar — thanh kinh nghiệm, hiển thị level và % */
export function XpBar({
  level,
  xp,
  xpForNext,
}: {
  level: number
  xp: number
  xpForNext: number
}) {
  const pct = xpForNext > 0 ? Math.min(100, Math.round((xp / xpForNext) * 100)) : 100
  return (
    <div className="xp-bar-wrap">
      <div className="xp-bar-labels">
        <span className="xp-level">Cấp {level}</span>
        <span className="xp-count">
          {xp} / {xpForNext} XP
        </span>
      </div>
      <div
        className="xp-bar"
        role="progressbar"
        aria-valuenow={xp}
        aria-valuemin={0}
        aria-valuemax={xpForNext}
        aria-label={`${pct}% tới cấp ${level + 1}`}
      >
        <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

