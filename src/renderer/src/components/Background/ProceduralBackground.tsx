/**
 * Procedural preset patterns — CSS/SVG only, no shipped raster assets.
 * Each fills the L0 layer (100vw × 100vh, tiled or full-bleed).
 */
export default function ProceduralBackground({ id }: { id: string }): JSX.Element {
  switch (id) {
    case 'proof-strip':
      return (
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="pp-proof-strip" width="64" height="64" patternUnits="userSpaceOnUse">
              <rect width="64" height="64" fill="#1c1a18" />
              <rect x="4" y="4" width="10" height="10" fill="#2e93b8" />
              <rect x="18" y="4" width="10" height="10" fill="#c4457f" />
              <rect x="32" y="4" width="10" height="10" fill="#d9a521" />
              <rect x="46" y="4" width="10" height="10" fill="#2a2724" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pp-proof-strip)" />
        </svg>
      )
    case 'halftone':
      return (
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="pp-halftone" width="18" height="18" patternUnits="userSpaceOnUse">
              <rect width="18" height="18" fill="#141210" />
              <circle cx="9" cy="9" r="4" fill="#2a2724" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pp-halftone)" />
        </svg>
      )
    case 'registration':
      return (
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="pp-registration" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect width="80" height="80" fill="#141210" />
              <circle cx="40" cy="40" r="10" fill="none" stroke="#2a2724" strokeWidth="1.5" />
              <line x1="40" y1="20" x2="40" y2="60" stroke="#2a2724" strokeWidth="1.5" />
              <line x1="20" y1="40" x2="60" y2="40" stroke="#2a2724" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pp-registration)" />
        </svg>
      )
    case 'kraft':
      return (
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <filter id="pp-kraft-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.44  0 0 0 0 0.31  0 0 0 0.06 0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="#8b6f47" />
          <rect width="100%" height="100%" filter="url(#pp-kraft-noise)" />
        </svg>
      )
    default:
      return <div className="h-full w-full bg-substrate" />
  }
}
