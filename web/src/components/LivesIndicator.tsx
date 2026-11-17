/** LivesIndicator — hiển thị tim, mất tim có hiệu ứng */
export function LivesIndicator({ lives, maxLives = 3 }: { lives: number; maxLives?: number }) {
  return (
    <div className="lives-indicator" aria-label={`Còn ${lives} mạng`}>
      {Array.from({ length: maxLives }, (_, i) => (
        <span
          key={i}
          className={`life-icon ${i < lives ? 'alive' : 'lost'}`}
          aria-hidden="true"
        >
          ♥
        </span>
      ))}
    </div>
  )
}

