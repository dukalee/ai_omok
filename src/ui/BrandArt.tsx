/** 흑돌 하나: 광택, 반사광, 푸른 테두리 빛. 흰 돌: 부드러운 광택. */
function Stone({ kind, cx, cy, r, shadow = 'ba-shadow-big' }: { kind: 'k' | 'w'; cx: number; cy: number; r: number; shadow?: string }) {
  const black = kind === 'k'
  const hx = cx - r * 0.3
  const hy = cy - r * 0.46
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${black ? 'ba-black' : 'ba-white'})`} filter={`url(#${shadow})`} />
      <ellipse
        cx={hx}
        cy={hy}
        rx={r * 0.42}
        ry={r * 0.2}
        fill="#fff"
        opacity={black ? 0.24 : 0.85}
        transform={`rotate(-28 ${hx} ${hy})`}
        filter="url(#ba-spec)"
      />
      {black && <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="url(#ba-rim)" strokeWidth={4} />}
    </>
  )
}

/**
 * 시작 화면 왼쪽 아래에 깔리는 장식: 바닥 격자 위에 크게 놓인 흑돌과 백돌.
 * 장식이므로 보조 기술에는 숨긴다. 패널 폭에 맞춰 커지고, 아래 가운데를 기준으로 잘린다.
 */
export default function BrandArt() {
  const lines: number[] = Array.from({ length: 9 }, (_, i) => i)
  const rows: number[] = Array.from({ length: 6 }, (_, i) => i)

  return (
    <svg className="brand-art" viewBox="0 0 560 610" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ba-black" cx="33%" cy="28%" r="85%">
          <stop offset="0" stopColor="#6d6f8f" />
          <stop offset="0.45" stopColor="#23243a" />
          <stop offset="1" stopColor="#0a0b16" />
        </radialGradient>
        <radialGradient id="ba-white" cx="33%" cy="28%" r="85%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9daf0" />
        </radialGradient>
        <linearGradient id="ba-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9a0ff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#a9a0ff" stopOpacity="0" />
          <stop offset="1" stopColor="#b8b0ff" stopOpacity="0.95" />
        </linearGradient>
        <filter id="ba-shadow-big" x="-40%" y="-40%" width="200%" height="200%">
          <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor="#14143a" floodOpacity="0.55" />
        </filter>
        <filter id="ba-spec" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="ba-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* 바닥 격자: 위로 갈수록 좁아지는 원근 */}
      <g stroke="rgba(255,255,255,0.13)" strokeWidth="1">
        {lines.map((i) => (
          <line key={`v${i}`} x1={-20 + i * 90} y1={340} x2={-20 + i * 90 + (i - 4) * 36} y2={640} />
        ))}
        {rows.map((i) => (
          <line key={`h${i}`} x1={0} y1={370 + i * 56 + i * i * 6} x2={560} y2={370 + i * 56 + i * i * 6} />
        ))}
      </g>

      <ellipse cx={170} cy={620} rx={250} ry={40} fill="#0b0b2e" opacity={0.42} filter="url(#ba-blur)" />
      <Stone kind="k" cx={150} cy={560} r={190} />
      <Stone kind="w" cx={470} cy={600} r={138} />
    </svg>
  )
}
