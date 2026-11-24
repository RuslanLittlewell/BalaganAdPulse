const GLOW_ID = "app-backdrop-glow";

const WAVES = [
  "M-120 690 C 160 600, 420 790, 760 700 S 1380 590, 1720 690",
  "M-120 750 C 200 670, 480 840, 820 760 S 1400 660, 1720 750",
  "M-120 810 C 240 740, 520 890, 880 820 S 1420 730, 1720 810",
] as const;

export function AppBackdrop() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className="size-full"
    >
      <defs>
        <radialGradient id={GLOW_ID} cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: "var(--backdrop-glow)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <ellipse cx="1380" cy="110" rx="960" ry="650" fill={`url(#${GLOW_ID})`} />
      <ellipse cx="150" cy="830" rx="880" ry="590" fill={`url(#${GLOW_ID})`} />
      <g fill="none" strokeWidth="1.2" style={{ stroke: "var(--primary)", strokeOpacity: "var(--backdrop-line)" }}>
        {WAVES.map((path) => <path key={path} d={path} />)}
      </g>
    </svg>
  );
}
