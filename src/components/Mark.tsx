/**
 * The ShadowAI mark.
 *
 * One vector, four uses: sidebar lockup, empty-state hero, chat avatar, and
 * the pulse shown while a response streams. Keeping it inline (rather than an
 * <img>) means it inherits the live accent token and can spin for the loading
 * state without a second asset.
 */

interface MarkProps {
  size?: number
  /** rounded-square tile; off renders the ribbon alone */
  tile?: boolean
  className?: string
  spin?: boolean
}

export function Mark({ size = 28, tile = true, className, spin }: MarkProps) {
  const id = `sm-${size}-${tile ? 't' : 'p'}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      style={spin ? { animation: 'spin 1.6s linear infinite' } : undefined}
      role="img"
      aria-label="ShadowAI"
    >
      <defs>
        <linearGradient id={`${id}-ring`} x1="0.05" y1="0.02" x2="0.95" y2="0.98">
          <stop offset="0%" stopColor="var(--accent-bright, #4ade80)" />
          <stop offset="45%" stopColor="var(--accent, #22c55e)" />
          <stop offset="100%" stopColor="var(--accent, #22c55e)" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.015" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={`${id}-ribbon`} x1="0.08" y1="0.04" x2="0.92" y2="0.98">
          <stop offset="0%" stopColor="var(--accent-bright, #86efac)" />
          <stop offset="18%" stopColor="var(--accent-bright, #4ade80)" />
          <stop offset="46%" stopColor="var(--accent, #22c55e)" />
          <stop offset="72%" stopColor="var(--accent, #22c55e)" stopOpacity="0.68" />
          <stop offset="100%" stopColor="var(--accent, #22c55e)" stopOpacity="0.36" />
        </linearGradient>
        <linearGradient id={`${id}-spark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ECFDF5" />
          <stop offset="55%" stopColor="var(--accent-bright, #a7f3d0)" />
          <stop offset="100%" stopColor="var(--accent, #34d399)" />
        </linearGradient>
        <radialGradient id={`${id}-aura`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--accent, #22c55e)" stopOpacity="0.3" />
          <stop offset="60%" stopColor="var(--accent, #22c55e)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="var(--accent, #22c55e)" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={`${id}-sparkglow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {tile && (
        <>
          <circle cx="256" cy="256" r="250" fill={`url(#${id}-aura)`} />
          <rect x="48" y="48" width="416" height="416" rx="128" fill="#080c0a" />
          <rect x="48" y="48" width="416" height="416" rx="128" fill={`url(#${id}-sheen)`} />
          <rect
            x="48"
            y="48"
            width="416"
            height="416"
            rx="128"
            fill="none"
            stroke="var(--accent, #22c55e)"
            strokeOpacity="0.3"
            strokeWidth="14"
            filter={`url(#${id}-soft)`}
          />
          <rect
            x="48"
            y="48"
            width="416"
            height="416"
            rx="128"
            fill="none"
            stroke={`url(#${id}-ring)`}
            strokeWidth="6"
          />
        </>
      )}

      <g transform="translate(256 256) scale(0.74) translate(-253 -317)">
        <path
          d="M 350 150 C 300 116 216 124 174 166 C 138 202 140 252 180 283 C 210 307 252 319 298 335 C 340 349 368 375 366 411 C 363 456 312 486 259 484 C 211 482 170 464 141 435"
          fill="none"
          stroke={`url(#${id}-ribbon)`}
          strokeWidth="62"
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d="M 180 283 C 210 307 252 319 298 335 C 340 349 368 375 366 411 C 363 456 312 486 259 484"
          fill="none"
          stroke="#022c22"
          strokeOpacity="0.32"
          strokeWidth="62"
          strokeLinecap="butt"
        />
        <path
          d="M 210 268 C 216 289 227 300 248 306 C 227 312 216 323 210 344 C 204 323 193 312 172 306 C 193 300 204 289 210 268 Z"
          fill="var(--accent, #22c55e)"
          opacity="0.85"
          filter={`url(#${id}-sparkglow)`}
        />
        <path
          d="M 210 268 C 216 289 227 300 248 306 C 227 312 216 323 210 344 C 204 323 193 312 172 306 C 193 300 204 289 210 268 Z"
          fill={`url(#${id}-spark)`}
        />
  </g>
    </svg>
  )
}

export function BrandLockup({ size = 26 }: { size?: number }) {
  return (
    <div className="brand">
      <Mark size={size} />
      <span className="brand__text">
        <span className="brand__name">ShadowAI</span>
        <span className="brand__by">by ShadowMotion</span>
      </span>
    </div>
  )
}
