/**
 * Channel display colors — single source of truth
 *
 * Used by:
 * - WGSL shader (via generateColorArrayWGSL)
 * - HTML overlay (WaveformOverlay.tsx)
 */

export const CHANNEL_COLORS = [
  '#4EC9B0', // --color-rx
  '#569CD6', // --color-tx
  '#CE9178',
  '#DCDCAA',
  '#C586C0',
  '#6A9955',
  '#007ACC', // --color-accent
  '#F4A540',
] as const

export const MAX_CHANNELS = CHANNEL_COLORS.length

/** Convert #RRGGBB to WGSL vec3f literal */
function hexToVec3f(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  return `vec3f(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`
}

/** Generate WGSL constant array declaration for channel colors */
export function generateColorArrayWGSL(): string {
  const entries = CHANNEL_COLORS.map(hex =>
    `  ${hexToVec3f(hex)}, // ${hex}`,
  ).join('\n')
  return `const CHANNEL_COLORS = array<vec3f, ${CHANNEL_COLORS.length}>(\n${entries}\n);`
}
